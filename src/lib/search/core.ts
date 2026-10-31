import { PDF_TEXT_VERSION, pdfViewerURL } from "../pdf-viewer/contract";
import { pageText, type TextRun } from "../pdf-viewer/text";
import { currentIndex, SEARCH_INDEX_VERSION, SEARCH_NORMALIZATION_VERSION,
  type SearchDocument, type SearchHit, type SearchPage, type SearchQuery } from "./contract";
import { extractNorms, normalizeLaw, normalizeParagraph, parseNormQuery } from "./norms";
import { normalizeSearchText, originalInterval } from "./normalize";

export function indexTextRuns(document: SearchDocument, pageNumber: number, runs: TextRun[]): SearchPage {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) throw new Error("invalid_page_number");
  const originalText = pageText(runs).text;
  const normalized = normalizeSearchText(originalText);
  const hasText = !!normalized.value.trim();
  return { document: { ...document }, pageNumber, indexVersion: SEARCH_INDEX_VERSION,
    normalizationVersion: SEARCH_NORMALIZATION_VERSION, textVersion: PDF_TEXT_VERSION,
    textStatus: hasText ? "ready" : "needs_ocr", failure: hasText ? null : "no_text",
    originalText, normalized, norms: hasText ? extractNorms(normalized) : [] };
}

/** Pure internal kernel over ALREADY authorized pages. It cannot authorize a corpus.
 * A1 must filter before invoking this function, including counts/excerpts/coverage. */
export function searchPages(pages: Iterable<SearchPage>, query: SearchQuery, limit = 100) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error("invalid_hit_limit");
  const raw = query.text?.trim() ?? "";
  if (raw.length > 2000) throw new Error("query_too_long");
  const automaticNorm = !query.norm && raw ? parseNormQuery(raw) : null;
  const normInput = query.norm ?? automaticNorm;
  const norm = normInput ? { law: normalizeLaw(normInput.law), paragraph: normalizeParagraph(normInput.paragraph) } : null;
  const needle = normalizeSearchText(raw).value.trim();
  if (!needle && !norm) throw new Error("empty_search_query");
  const hits: SearchHit[] = [];
  const coverage = { readyPages: 0, missingTextPages: 0, failedPages: 0, stalePages: 0 };
  let totalHits = 0;
  for (const page of pages) {
    if (!currentIndex(page)) { coverage.stalePages++; continue; }
    if (page.textStatus === "failed") { coverage.failedPages++; continue; }
    if (page.textStatus !== "ready") { coverage.missingTextPages++; continue; }
    coverage.readyPages++;
    const intervals = new Map<string, { start: number; end: number; kinds: ("text" | "norm")[] }>();
    const add = (interval: { start: number; end: number }, kind: "text" | "norm") => {
      const key = `${interval.start}:${interval.end}`, previous = intervals.get(key);
      if (previous) { if (!previous.kinds.includes(kind)) previous.kinds.push(kind); }
      else intervals.set(key, { ...interval, kinds: [kind] });
    };
    if (needle && !automaticNorm) {
      for (let position = page.normalized.value.indexOf(needle); position >= 0;
        position = page.normalized.value.indexOf(needle, position + 1)) {
        add(originalInterval(page.normalized, position, position + needle.length), "text");
      }
    }
    if (norm) {
      for (const reference of page.norms) {
        if (reference.law === norm.law && reference.paragraph === norm.paragraph) add(reference, "norm");
      }
    }
    const ordered = [...intervals.values()].sort((a, b) => a.start - b.start || a.end - b.end);
    ordered.forEach((interval, occurrence) => {
      totalHits++;
      if (hits.length >= limit) return;
      const { start, end, kinds } = interval;
      const target = { pageNumber: page.pageNumber, start, end, textVersion: page.textVersion };
      const excerptStart = Math.max(0, start - 80), excerptEnd = Math.min(page.originalText.length, end + 80);
      const { klausurId, documentId, documentVersionId, role } = page.document;
      hits.push({ klausurId, documentId, documentVersionId, role, pageNumber: page.pageNumber,
        start, end, occurrence, evidence: page.originalText.slice(start, end),
        excerpt: { text: page.originalText.slice(excerptStart, excerptEnd), start: excerptStart, end: excerptEnd },
        kinds, relevance: "mention", textVersion: page.textVersion, indexVersion: SEARCH_INDEX_VERSION,
        target, viewerURL: pdfViewerURL({ klausurId, documentId, documentVersionId }, target) });
    });
  }
  return { hits, totalHits, limited: totalHits > hits.length, coverage };
}
