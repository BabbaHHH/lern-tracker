import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { PDF_TEXT_VERSION } from "../../pdf-viewer/contract";
import { currentIndex, SEARCH_INDEX_VERSION, SEARCH_NORMALIZATION_VERSION,
  type SearchDocument, type SearchIndexAdapter, type SearchManifest, type SearchPage } from "../../search/contract";
import { indexTextRuns } from "../../search/core";

export const SEARCH_EXTRACTION_LIMITS = { maxPages: 8, maxBytes: 32 * 1024 * 1024, maxPageCharacters: 500_000 } as const;
export interface ExtractionOptions {
  maxPages?: number;
  maxBytes?: number;
  maxPageCharacters?: number;
  rebuild?: boolean;
  signal?: AbortSignal;
}
function bounded(value: number | undefined, fallback: number, ceiling: number) {
  const limit = value ?? fallback;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > ceiling) throw new Error("invalid_extraction_limit");
  return limit;
}
function checkDocument(document: SearchDocument) {
  if (![document.klausurId, document.documentId, document.documentVersionId].every(value =>
    typeof value === "string" && value.length > 0 && value.length <= 255 && !/[\x00-\x1f]/.test(value))
    || !["sachverhalt", "loesung", "kombiniert", "unbekannt"].includes(document.role)
    || !/^[a-f0-9]{64}$/.test(document.sha256)) throw new Error("invalid_search_document");
}

/** Local internal extraction only. No routes, catalog discovery, OCR or model calls.
 * Each call reopens immutable bytes and commits at most maxPages pages atomically.
 * This bounds work retained per batch, not PDF.js CPU/RAM within an individual page. */
export async function extractSearchBatch(bytes: Uint8Array, document: SearchDocument,
  adapter: SearchIndexAdapter, options: ExtractionOptions = {}): Promise<SearchManifest> {
  checkDocument(document);
  const maxPages = bounded(options.maxPages, SEARCH_EXTRACTION_LIMITS.maxPages, 16);
  const maxBytes = bounded(options.maxBytes, SEARCH_EXTRACTION_LIMITS.maxBytes, 64 * 1024 * 1024);
  const maxCharacters = bounded(options.maxPageCharacters, SEARCH_EXTRACTION_LIMITS.maxPageCharacters, 1_000_000);
  options.signal?.throwIfAborted();
  if (createHash("sha256").update(bytes).digest("hex") !== document.sha256) throw new Error("source_hash_mismatch");
  const previous = await adapter.readManifest(document);
  if (previous && (previous.document.sha256 !== document.sha256 || previous.document.role !== document.role)) {
    throw new Error("immutable_document_conflict");
  }
  if (previous && !currentIndex(previous) && !options.rebuild) throw new Error("index_rebuild_required");
  if (previous && !options.rebuild && previous.status !== "pending") return previous;
  const manifest: SearchManifest = previous && !options.rebuild ? { ...previous, revision: previous.revision + 1 }
    : { document: { ...document }, indexVersion: SEARCH_INDEX_VERSION,
      normalizationVersion: SEARCH_NORMALIZATION_VERSION, textVersion: PDF_TEXT_VERSION,
      revision: (previous?.revision ?? 0) + 1, pageCount: null, nextPage: 1, status: "pending",
      readyPages: 0, missingTextPages: 0, failedPages: 0, failure: null };
  const pages: SearchPage[] = [];
  const commit = async () => {
    options.signal?.throwIfAborted();
    await adapter.commitBatch({ expectedRevision: previous?.revision ?? null,
      replacePages: !!options.rebuild, manifest, pages });
    return manifest;
  };
  if (bytes.byteLength > maxBytes) {
    manifest.status = "failed"; manifest.failure = "document_byte_limit";
    return commit();
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const packageRoot = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  const loading = pdfjs.getDocument({ data: Uint8Array.from(bytes), isEvalSupported: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS, useSystemFonts: false,
    standardFontDataUrl: join(packageRoot, "standard_fonts") + "/",
    cMapUrl: join(packageRoot, "cmaps") + "/", cMapPacked: true,
    wasmUrl: join(packageRoot, "wasm") + "/" });
  const abort = () => { void loading.destroy(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await loading.promise.catch(() => null);
    options.signal?.throwIfAborted();
    if (!pdf) { manifest.status = "failed"; manifest.failure = "invalid_pdf"; }
    else {
      if (manifest.pageCount !== null && manifest.pageCount !== pdf.numPages) throw new Error("immutable_page_count_conflict");
      manifest.pageCount = pdf.numPages;
      const end = Math.min(pdf.numPages, manifest.nextPage + maxPages - 1);
      for (let pageNumber = manifest.nextPage; pageNumber <= end; pageNumber++) {
        options.signal?.throwIfAborted();
        let indexed = indexTextRuns(document, pageNumber, []);
        const page = await pdf.getPage(pageNumber).catch(() => null);
        try {
          if (!page) throw new Error("missing_page");
          // Same getTextContent defaults, run filtering and pageText helper as PDF-A.
          const content = await page.getTextContent();
          const runs = content.items.filter((item): item is TextItem => "str" in item);
          const length = runs.reduce((sum, run) => sum + run.str.length + (run.hasEOL ? 1 : 0), 0);
          if (length > maxCharacters) {
            indexed.textStatus = "failed"; indexed.failure = "page_text_limit";
          } else indexed = indexTextRuns(document, pageNumber, runs);
        } catch {
          options.signal?.throwIfAborted();
          indexed.textStatus = "failed"; indexed.failure = "extraction_failed";
        } finally { page?.cleanup(); }
        pages.push(indexed);
        if (indexed.textStatus === "ready") manifest.readyPages++;
        else if (indexed.textStatus === "needs_ocr") manifest.missingTextPages++;
        else manifest.failedPages++;
        manifest.nextPage = pageNumber + 1;
      }
      if (manifest.nextPage > pdf.numPages) manifest.status = manifest.failedPages ? "failed"
        : manifest.missingTextPages ? "needs_ocr" : "ready";
    }
  } finally {
    options.signal?.removeEventListener("abort", abort);
    await loading.destroy();
  }
  return commit();
}
