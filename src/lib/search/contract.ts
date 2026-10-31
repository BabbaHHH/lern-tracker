import type { CatalogImportContract } from "../data-migration/contract";
import { PDF_TEXT_VERSION, type PdfIdentity, type PdfSearchTarget } from "../pdf-viewer/contract";

export const SEARCH_INDEX_VERSION = "search-pages-v1";
export const SEARCH_NORMALIZATION_VERSION = "pdf-phrase-nfkc-de-v1";
export type DocumentRole = CatalogImportContract["documents"][number]["role"];
export interface SearchDocument extends PdfIdentity { role: DocumentRole; sha256: string }
export interface NormalizedText {
  value: string;
  /** One entry per normalized UTF-16 code unit; intervals refer to original text. */
  starts: number[];
  ends: number[];
}
export interface NormReference {
  law: string;
  paragraph: string;
  start: number;
  end: number;
}
export interface SearchPage {
  document: SearchDocument;
  pageNumber: number;
  indexVersion: typeof SEARCH_INDEX_VERSION;
  normalizationVersion: typeof SEARCH_NORMALIZATION_VERSION;
  textVersion: string;
  textStatus: "ready" | "needs_ocr" | "failed";
  failure: "no_text" | "extraction_failed" | "page_text_limit" | null;
  originalText: string;
  normalized: NormalizedText;
  norms: NormReference[];
}
export interface SearchManifest {
  document: SearchDocument;
  indexVersion: typeof SEARCH_INDEX_VERSION;
  normalizationVersion: typeof SEARCH_NORMALIZATION_VERSION;
  textVersion: string;
  revision: number;
  pageCount: number | null;
  /** Next unprocessed PDF page (1-based), pageCount + 1 when complete. */
  nextPage: number;
  status: "pending" | "ready" | "needs_ocr" | "failed";
  readyPages: number;
  missingTextPages: number;
  failedPages: number;
  failure: "invalid_pdf" | "document_byte_limit" | null;
}
export interface SearchBatch {
  expectedRevision: number | null;
  replacePages: boolean;
  manifest: SearchManifest;
  pages: SearchPage[];
}
/** Internal worker capability, never expose as an unfiltered public API.
 * commitBatch must atomically compare revision, replace/upsert pages and checkpoint.
 * Persist JSON as-is; a DB adapter and access checks are supplied in SEARCH-A1. */
export interface SearchIndexAdapter {
  readManifest(identity: PdfIdentity): Promise<SearchManifest | null>;
  commitBatch(batch: SearchBatch): Promise<void>;
}
export interface SearchQuery { text?: string; norm?: { law: string; paragraph: string } }
export interface SearchHit extends PdfIdentity {
  role: DocumentRole;
  pageNumber: number;
  start: number;
  end: number;
  /** Zero-based occurrence of this query on this page, in original-text order. */
  occurrence: number;
  evidence: string;
  excerpt: { text: string; start: number; end: number };
  kinds: ("text" | "norm")[];
  relevance: "mention";
  textVersion: string;
  indexVersion: typeof SEARCH_INDEX_VERSION;
  target: PdfSearchTarget;
  viewerURL: string;
}
export function currentIndex(value: { indexVersion: string; normalizationVersion: string; textVersion: string }) {
  return value.indexVersion === SEARCH_INDEX_VERSION
    && value.normalizationVersion === SEARCH_NORMALIZATION_VERSION && value.textVersion === PDF_TEXT_VERSION;
}
