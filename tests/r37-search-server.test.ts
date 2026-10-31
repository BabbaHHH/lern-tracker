import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runSearchWorker, type SearchWorkerBindings } from "../scripts/search/worker.mjs";
import { searchWorkerInvocation } from "../scripts/search/worker-config";
import { CatalogSearchService, SEARCH_QUERY_PAGE_BATCH } from "../src/lib/server/search/service";
import { PostgresSearchStore, currentDocumentsSQL } from "../src/lib/server/search/store";
import { SearchWorker } from "../src/lib/server/search/worker";
import { summarizeSearch, type SearchStatusRow } from "../src/lib/server/search/status";
import { indexTextRuns } from "../src/lib/search/core";
import type { SearchManifest } from "../src/lib/search/contract";
import type { SearchIndexSummary } from "../src/lib/search/catalog-contract";
import type { AccountService } from "../src/lib/server/auth/service";
import { AccountError } from "../src/lib/server/auth/security";
import { catalogSearchHTTP } from "../src/lib/server/search/http";
import type { Database } from "../src/lib/server/persistence/database";
import type { PrivateFiles } from "../src/lib/server/persistence/files";

const local = { NODE_ENV: "test", STEX_AUTH_MODE: "local" }, root = "/srv/stex/releases/r37-fixture";
const summary: SearchIndexSummary = { documents: 3, readyDocuments: 1, pendingDocuments: 1, missingTextDocuments: 0,
  failedDocuments: 1, readyPages: 2, missingTextPages: 0, failedPages: 0, pendingPages: 4 };
function cli() {
  let stop = () => {};
  const calls = { opens: 0, close: 0, detach: 0, status: 0, discover: [] as boolean[], pages: [] as (number | undefined)[], output: [] as string[] };
  const database = { close: async () => { calls.close++; } } as unknown as Database;
  const bindings: SearchWorkerBindings = {
    persistence: async () => { calls.opens++; return { database, files: {} as PrivateFiles, production: undefined }; },
    work: () => ({ discover: async rebuild => { calls.discover.push(rebuild); },
      step: async options => { calls.pages.push(options.maxPages); return true; },
      status: async () => { calls.status++; return { ...summary, forbiddenText: "must not appear" }; } }),
    signals: handler => { stop = handler; return () => { calls.detach++; }; },
    pause: async () => stop(), output: value => calls.output.push(value),
  };
  return { calls, bindings };
}
test("R37: bounded operator run forwards page limit, preserves pending/errors, closes without rebuild", async () => {
  const h = cli(); await runSearchWorker(["once", "--max-batches=2", "--pages-per-batch=2"], local, root, h.bindings);
  assert.deepEqual(h.calls.pages, [2, 2]); assert.ok(h.calls.discover.every(value => value === false));
  assert.equal(h.calls.close, 1); assert.equal(h.calls.detach, 1);
  const result = JSON.parse(h.calls.output[0]);
  assert.equal(result.batches, 2); assert.equal(result.stopped, "batch_limit");
  assert.deepEqual(result.index, summary); assert.equal(h.calls.output[0].includes("must not appear"), false);
});
test("R37: status is read-only and invalid limits fail before opening resources", async () => {
  const h = cli(); await runSearchWorker(["status"], local, root, h.bindings);
  assert.deepEqual(h.calls.discover, []); assert.deepEqual(h.calls.pages, []); assert.equal(h.calls.status, 1);
  assert.equal(h.calls.close, 1); assert.equal(JSON.parse(h.calls.output[0]).stopped, "status");
  for (const args of [["once", "--max-batches=0"], ["once", "--pages-per-batch=9"], ["once", "--max-batches=1001"],
    ["once", "--max-batches=1", "--max-batches=2"], ["status", "--max-batches=1"], ["once", "--unknown=2"]]) {
    const invalid = cli(); await assert.rejects(runSearchWorker(args, local, root, invalid.bindings)); assert.equal(invalid.calls.opens, 0);
  }
  assert.equal(searchWorkerInvocation(["rebuild", "--max-batches=1"], local, root).mode, "rebuild");
});

const document = { klausurId: "r37-classified", documentId: "r37-combined", documentVersionId: "r37-version-current",
  role: "kombiniert" as const, sha256: "a".repeat(64) };
function indexed(count: number, text: (page: number) => string) {
  const pages = Array.from({ length: count }, (_, n) => indexTextRuns(document, n + 1, [{ str: text(n + 1) }]));
  const manifest: SearchManifest = { document, indexVersion: pages[0].indexVersion, normalizationVersion: pages[0].normalizationVersion,
    textVersion: pages[0].textVersion, revision: 1, pageCount: count, nextPage: count + 1, status: "ready", readyPages: count,
    missingTextPages: 0, failedPages: 0, failure: null };
  const row: SearchStatusRow = { klausur_id: document.klausurId, document_id: document.documentId, document_version_id: document.documentVersionId,
    sha256: document.sha256, role: "kombiniert", title: "Klassifizierter Fall ohne PDF-Suchwort", page_count: count,
    epoch: "00000000-0000-4000-8000-000000000001", manifest, job_state: "complete", error_code: null };
  return { pages, row };
}
function searchHarness(fixture: ReturnType<typeof indexed>) {
  const calls = { pageReads: 0, pageSizes: [] as number[], checks: 0, auth: 0 };
  let denyAt = Infinity, changed = false;
  const client = { query: async (sql: string, parameters: unknown[] = []) => {
    if (sql.includes("FROM stex.search_pages p JOIN unnest")) {
      calls.pageReads++;
      assert.ok(sql.includes(`LIMIT ${SEARCH_QUERY_PAGE_BATCH}`));
      assert.deepEqual(parameters[0], [document.documentVersionId]); assert.deepEqual(parameters[1], [fixture.row.epoch]);
      const pageLimit = (parameters[2] as number[])[0], cursor = Number(parameters[4]);
      const pages = fixture.pages.filter(page => page.pageNumber > cursor && page.pageNumber <= pageLimit).slice(0, SEARCH_QUERY_PAGE_BATCH);
      calls.pageSizes.push(pages.length);
      return { rows: pages.map(page => ({ position: 1, page_number: page.pageNumber, payload: page })) };
    }
    assert.ok(!sql.includes("jsonb_agg"));
    if (sql.includes("SELECT docs.document_version_id,docs.role")) return { rows: [{ document_version_id: document.documentVersionId,
      role: "kombiniert", epoch: changed ? "changed-epoch" : fixture.row.epoch }] };
    return { rows: [fixture.row] };
  } };
  const auth = { principal: async () => { calls.auth++; return { userId: "r37-member", sessionId: "r37-session", generation: 1 }; },
    checkPrincipal: async () => { calls.checks++; if (calls.checks >= denyAt) throw new AccountError("unauthenticated", "Bitte neu anmelden.", 401);
      return { userId: "r37-member", sessionId: "r37-session", generation: 1 }; },
    database: { transaction: async <T>(work: (value: typeof client) => Promise<T>) => work(client) } } as unknown as AccountService;
  return { service: new CatalogSearchService(auth), calls, denyAt: (value: number) => { denyAt = value; }, changed: () => { changed = true; } };
}
test("R37: PDF-only keyword after first read batch is found with current combined viewer page", async () => {
  const fixture = indexed(19, page => page === 17 ? "R37-PDF-ONLY" : "Anderer Seitentext");
  const h = searchHarness(fixture); const result = await h.service.search(new Headers(), { text: "r37-pdf-only" });
  assert.equal(result.totalHits, 1); assert.equal(result.hits[0].pageNumber, 17);
  assert.equal(result.hits[0].role, "kombiniert"); assert.equal(result.hits[0].documentVersionId, document.documentVersionId);
  assert.match(result.hits[0].viewerURL, /page=17&start=0&end=12&textVersion=/);
  assert.equal(result.documents[0].title.includes("R37-PDF-ONLY"), false);
  assert.ok(h.calls.pageReads > 1); assert.ok(h.calls.pageSizes.every(size => size <= 8));
});
test("R37: result cap never cuts off candidate enumeration/counts or empty-query status", async () => {
  const fixture = indexed(19, () => "Treffer ".repeat(20)), h = searchHarness(fixture);
  const result = await h.service.search(new Headers(), { text: "Treffer" });
  assert.equal(result.hits.length, 100); assert.equal(result.totalHits, 380); assert.equal(result.limited, true);
  const status = searchHarness(fixture); await status.service.search(new Headers(), null); assert.equal(status.calls.pageReads, 0);
});
test("R37: snapshot page boundary, member revocation and epoch replacement prevent stale disclosures", async () => {
  const fixture = indexed(19, page => page === 19 ? "Spaeter hinzugefuegt" : "Basistext");
  fixture.row.manifest = { ...fixture.row.manifest!, nextPage: 10, status: "pending", readyPages: 9 };
  const result = await searchHarness(fixture).service.search(new Headers(), { text: "Spaeter hinzugefuegt" });
  assert.equal(result.totalHits, 0); assert.equal(result.documents[0].pendingPages, 10);
  const revoked = searchHarness(fixture); revoked.denyAt(3);
  await assert.rejects(revoked.service.search(new Headers(), { text: "Basistext" }), /neu anmelden/);
  assert.equal(revoked.calls.pageReads, 1);
  const changed = searchHarness(fixture); changed.changed();
  await assert.rejects(changed.service.search(new Headers(), { text: "Basistext" }), /Katalog wird aktualisiert/);
});
test("R37: status distinguishes queue/text gaps/invalid or missing files and hides unavailable old payload", async () => {
  const fixture = indexed(1, () => "Vorheriger Text");
  const queued = { ...fixture.row, manifest: null, job_state: "queued" };
  const blank = { ...fixture.row, manifest: { ...fixture.row.manifest!, status: "needs_ocr" as const, readyPages: 0, missingTextPages: 1 } };
  const invalid = { ...fixture.row, manifest: { ...fixture.row.manifest!, status: "failed" as const, readyPages: 0, failure: "invalid_pdf" as const } };
  const missing = { ...fixture.row, job_state: "failed", error_code: "file_unavailable" };
  const values = summarizeSearch([queued, blank, invalid, missing]);
  assert.equal(values.documents, 4); assert.equal(values.readyDocuments, 0); assert.equal(values.pendingDocuments, 1);
  assert.equal(values.missingTextDocuments, 1); assert.equal(values.failedDocuments, 2);
  fixture.row = missing;
  const h = searchHarness(fixture); const result = await h.service.search(new Headers(), { text: "Vorheriger Text" });
  assert.equal(result.totalHits, 0); assert.equal(h.calls.pageReads, 0); assert.equal(result.documents[0].reason, "file_unavailable");
});
test("R37: missing PDF is a fenced job error and operator status has no page query or contents", async () => {
  let reason = "", release = 0;
  const job = { byteSize: 100, document };
  const store = { claim: async () => job, fail: async (_job: unknown, code: string) => { reason = code; }, release: async () => { release++; } } as unknown as PostgresSearchStore;
  await new SearchWorker(store, { read: async () => { throw new Error("private internal path"); } } as unknown as PrivateFiles).step();
  assert.equal(reason, "file_unavailable"); assert.equal(release, 1);
  const fixture = indexed(1, () => "must not be logged");
  const database = { pool: { query: async (sql: string) => { assert.ok(!sql.includes("search_pages")); return { rows: [fixture.row] }; } } } as unknown as Database;
  const status = await new PostgresSearchStore(database).status();
  assert.equal(status.readyDocuments, 1); assert.equal(JSON.stringify(status).includes("r37-classified"), false);
  assert.ok(currentDocumentsSQL.includes("NOT EXISTS")); assert.ok(!currentDocumentsSQL.includes("personal_records") && !currentDocumentsSQL.includes("stex.document_versions"));
});
test("R37: existing Combined version insertion and migration005 job trigger remain the handoff contract", async () => {
  // Read-only source evidence; not another importer test or proof of a real import.
  const service = await readFile("src/lib/server/catalog/import-service.ts", "utf8");
  const trigger = await readFile("db/migrations/005_catalog_search.sql", "utf8");
  assert.ok(service.includes("async submitLegacy(") && service.includes("INSERT INTO stex.catalog_document_versions"));
  assert.ok(trigger.includes("AFTER INSERT ON stex.catalog_document_versions") && trigger.includes("INSERT INTO stex.search_jobs"));
});
test("R37: search body keeps keyword out of URLs with member/origin and hard byte boundaries", async () => {
  let allowed = true, searches = 0;
  const base = "http://localhost:3001";
  const service = { auth: { baseURL: base, principal: async () => { if (!allowed) throw new AccountError("unauthenticated", "Bitte anmelden.", 401); return { userId: "r37-member" }; },
    database: { transaction: async (work: (c: unknown) => unknown) => work({ query: async () => ({ rows: [{ count: 1 }] }) }) } },
    search: async (_headers: Headers, query: unknown) => { searches++; assert.deepEqual(query, { text: "r37-pdf-only" }); return { totalHits: 1 }; } } as unknown as CatalogSearchService;
  const post = (body: string, origin = base) => new Request(`${base}/api/catalog/search`, { method: "POST",
    headers: { origin, "x-stex-action": "1", "content-type": "application/json" }, body });
  const response = await catalogSearchHTTP(post(JSON.stringify({ q: "r37-pdf-only" })), service);
  assert.equal(response.status, 200); assert.equal(searches, 1);
  assert.equal((await catalogSearchHTTP(post(" ".repeat(16385)), service)).status, 413);
  assert.equal((await catalogSearchHTTP(post("[1,2]"), service)).status, 400);
  assert.equal((await catalogSearchHTTP(post("{}", "https://other.example.test"), service)).status, 403);
  allowed = false; assert.equal((await catalogSearchHTTP(post("{}"), service)).status, 401); assert.equal(searches, 1);
  const component = await readFile("src/components/catalog-search-app.tsx", "utf8");
  assert.ok(!component.includes("/api/catalog/search?")); assert.ok(component.includes('method: "POST"'));
});
