import { currentIndex, type SearchManifest } from "../../search/contract";
import type { CatalogSearchStatus, SearchIndexSummary } from "../../search/catalog-contract";

export interface SearchStatusRow {
  klausur_id: string; document_id: string; document_version_id: string; sha256: string; role: string;
  title: string; page_count: number | null; epoch: string | null; manifest: SearchManifest | null;
  job_state: string | null; error_code: string | null;
}
export function matchingManifest(row: SearchStatusRow) {
  const m = row.manifest;
  return m && currentIndex(m) && m.document.role === row.role && m.document.sha256 === row.sha256
    && m.document.klausurId === row.klausur_id && m.document.documentId === row.document_id
    && m.document.documentVersionId === row.document_version_id ? m : null;
}
export function searchDocumentStatus(row: SearchStatusRow): CatalogSearchStatus {
  const m = matchingManifest(row), pageCount = m?.pageCount ?? row.page_count;
  const status = row.job_state === "failed" ? "failed" : m?.status ?? "pending";
  return { klausurId: row.klausur_id, documentId: row.document_id, documentVersionId: row.document_version_id,
    title: row.title, role: row.role, status, pageCount, readyPages: m?.readyPages ?? 0,
    missingTextPages: m?.missingTextPages ?? 0, failedPages: m?.failedPages ?? 0,
    pendingPages: status === "pending" ? pageCount === null ? null : Math.max(0, pageCount - (m ? m.nextPage - 1 : 0)) : 0,
    reason: row.error_code ?? m?.failure ?? (m?.failedPages ? "page_text_limit_or_extraction" : null) };
}
export function summarizeSearch(rows: SearchStatusRow[]): SearchIndexSummary {
  const result: SearchIndexSummary = { documents: rows.length, readyDocuments: 0, pendingDocuments: 0,
    missingTextDocuments: 0, failedDocuments: 0, readyPages: 0, missingTextPages: 0, failedPages: 0, pendingPages: 0 };
  for (const row of rows) {
    const status = searchDocumentStatus(row);
    if (status.status === "ready") result.readyDocuments++;
    else if (status.status === "pending") result.pendingDocuments++;
    else if (status.status === "needs_ocr") result.missingTextDocuments++;
    else result.failedDocuments++;
    result.readyPages += status.readyPages; result.missingTextPages += status.missingTextPages;
    result.failedPages += status.failedPages; result.pendingPages += status.pendingPages ?? 0;
  }
  return result;
}
