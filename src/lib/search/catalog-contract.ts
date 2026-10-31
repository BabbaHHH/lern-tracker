import type { SearchHit, SearchManifest } from "./contract";
export interface SearchContext { accountId: string; generation: number; sessionContext: string }
export interface CatalogSearchStatus {
  klausurId: string; documentId: string; documentVersionId: string; title: string; role: string;
  status: SearchManifest["status"]; pageCount: number | null; readyPages: number; missingTextPages: number;
  failedPages: number; pendingPages: number | null; reason: string | null;
}
export interface CatalogSearchResponse {
  context: SearchContext; hits: SearchHit[]; totalHits: number; limited: boolean;
  documents: CatalogSearchStatus[];
}
/** Aggregate operator evidence only: no titles, snippets, paths or personal data. */
export interface SearchIndexSummary {
  documents: number; readyDocuments: number; pendingDocuments: number; missingTextDocuments: number;
  failedDocuments: number; readyPages: number; missingTextPages: number; failedPages: number; pendingPages: number;
}
export function sameSearchContext(a: SearchContext, b: SearchContext) {
  return a.accountId === b.accountId && a.generation === b.generation && a.sessionContext === b.sessionContext;
}
