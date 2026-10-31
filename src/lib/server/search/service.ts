import { searchPages } from "../../search/core";
import type { SearchPage, SearchQuery } from "../../search/contract";
import { sameSearchContext, type CatalogSearchResponse, type SearchContext } from "../../search/catalog-contract";
import { AccountService, type Principal } from "../auth/service";
import { AccountError, tokenHash } from "../auth/security";
import { currentDocumentsSQL } from "./store";
import { matchingManifest, searchDocumentStatus, type SearchStatusRow } from "./status";

export const SEARCH_QUERY_PAGE_BATCH = 8;

const context = (who: Principal): SearchContext => ({ accountId: who.userId, generation: who.generation, sessionContext: tokenHash(who.sessionId) });
export class CatalogSearchService {
  constructor(readonly auth: AccountService) {}
  async search(headers: Headers, query: SearchQuery | null, expected?: SearchContext): Promise<CatalogSearchResponse> {
    const who = await this.auth.principal(headers);
    if (expected && !sameSearchContext(expected, context(who))) throw new AccountError("account_changed", "Die Anmeldung hat sich geändert. Bitte neu laden.", 409);
    const rows = await this.auth.database.transaction(async client => {
      await this.auth.checkPrincipal(client, who.sessionId, "active", false, true);
      // Only shared current versions. Personal tables cannot enter this selection.
      return (await client.query<SearchStatusRow>(`SELECT docs.*,j.epoch,j.state AS job_state,j.manifest,j.error_code
        FROM (${currentDocumentsSQL}) docs LEFT JOIN stex.search_jobs j USING(document_version_id) ORDER BY docs.klausur_id,docs.document_id`)).rows;
    });
    const documents = rows.map(searchDocumentStatus);
    try { if (query) searchPages([], query); }
    catch { throw new AccountError("invalid_input", "Bitte einen gültigen Suchtext oder Gesetz und Paragraph eingeben."); }
    const found: Pick<CatalogSearchResponse, "hits" | "totalHits" | "limited"> = { hits: [], totalHits: 0, limited: false };
    if (query) {
      const selected = rows.filter(row => row.epoch && row.error_code !== "file_unavailable" && matchingManifest(row));
      const ids = selected.map(row => row.document_version_id), epochs = selected.map(row => row.epoch);
      const lastPages = selected.map(row => matchingManifest(row)!.nextPage - 1);
      let cursorDocument = 0, cursorPage = 0;
      while (selected.length) {
        const batch = await this.auth.database.transaction(async client => {
          await this.auth.checkPrincipal(client, who.sessionId, "active", false, true);
          return (await client.query<{ position: number; page_number: number; payload: SearchPage }>(`SELECT permitted.position::integer AS position,p.page_number,p.payload
            FROM stex.search_pages p JOIN unnest($1::text[],$2::uuid[],$3::integer[]) WITH ORDINALITY
              AS permitted(document_version_id,epoch,last_page,position)
              ON p.document_version_id=permitted.document_version_id AND p.epoch=permitted.epoch
            WHERE p.page_number<=permitted.last_page AND (permitted.position,p.page_number)>($4::integer,$5::integer)
            ORDER BY permitted.position,p.page_number LIMIT ${SEARCH_QUERY_PAGE_BATCH}`,
          [ids, epochs, lastPages, cursorDocument, cursorPage])).rows;
        });
        if (!batch.length) break;
        const result = searchPages(batch.map(row => row.payload), query, Math.max(1, 100 - found.hits.length));
        found.totalHits += result.totalHits; found.hits.push(...result.hits.slice(0, 100 - found.hits.length));
        const last = batch[batch.length - 1];
        cursorDocument = last.position; cursorPage = last.page_number;
      }
      found.limited = found.totalHits > found.hits.length;
    }
    // The potentially longer pure search runs outside locks. Revalidate before response.
    await this.auth.database.transaction(async client => {
      const current = await this.auth.checkPrincipal(client, who.sessionId, "active", false, true);
      if (!sameSearchContext(context(current), context(who))) throw new AccountError("account_changed", "Bitte neu anmelden.", 409);
      const latest = (await client.query(`SELECT docs.document_version_id,docs.role,j.epoch FROM (${currentDocumentsSQL}) docs
        LEFT JOIN stex.search_jobs j USING(document_version_id) ORDER BY docs.klausur_id,docs.document_id`)).rows;
      if (JSON.stringify(latest) !== JSON.stringify(rows.map(row => ({ document_version_id: row.document_version_id, role: row.role, epoch: row.epoch })))) {
        throw new AccountError("catalog_changed", "Der Katalog wird aktualisiert. Bitte nochmals suchen.", 409);
      }
    });
    return { context: context(who), hits: found.hits, totalHits: found.totalHits, limited: found.limited, documents };
  }
}
