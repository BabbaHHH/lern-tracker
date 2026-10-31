import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { test } from "node:test";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import { SyntheticAccount, syntheticPassword } from "../scripts/pdf-a/fixtures";
import { importSearchFixture } from "../scripts/search/catalog-fixture";
import { SearchBoundary } from "../src/lib/search/client-boundary";
import { AccountService } from "../src/lib/server/auth/service";
import { CatalogSearchService } from "../src/lib/server/search/service";
import { PostgresSearchStore } from "../src/lib/server/search/store";
import { SearchWorker } from "../src/lib/server/search/worker";
import { catalogSearchHTTP } from "../src/lib/server/search/http";
import { extractSearchBatch } from "../src/lib/server/search/extract";
import { lockState } from "../src/lib/server/persistence/repository";
import { backup, restore } from "../src/lib/server/persistence/backup";
import { ProgressService } from "../src/lib/server/learning/progress-service";
import { getLeafTopics, TOPICS } from "../src/lib/topics";
import { syntheticSearchPdf } from "../scripts/search/fixtures";
import { storageKey, fileHash } from "../src/lib/server/persistence/files";
import { CatalogImportService, validateCatalogPdf } from "../src/lib/server/catalog/import-service";
import type { PrivateFiles } from "../src/lib/server/persistence/files";

test("SEARCH-A1: durable real catalog/search/restart/access/restore integration", { timeout: 180000 }, async t => {
  const runtime = await testRuntime(); t.after(() => runtime.close());
  let repository = await runtime.repository("search_source");
  const secret = randomBytes(48).toString("hex"), mailKey = randomBytes(48).toString("hex"), encryptionKey = randomBytes(48).toString("hex");
  const baseURL = "http://localhost:3057";
  const makeAuth = () => new AccountService({ database: repository.database, files: repository.files, baseURL, secret, mailKey });
  let auth = makeAuth(), service = new CatalogSearchService(auth), store = new PostgresSearchStore(repository.database);
  const a = new SyntheticAccount(auth, "search-a"), b = new SyntheticAccount(auth, "search-b"), pending = new SyntheticAccount(auth, "search-pending");
  await a.initialize(); await b.initialize(); await pending.initialize(false);
  const imported = await importSearchFixture(auth, a.headers());
  const identity = imported.summary.documents.find(doc => doc.role === "sachverhalt")!;
  const api = (headers: Headers, parameters = "") => catalogSearchHTTP(new Request(`${baseURL}/api/catalog/search${parameters}`, { headers }), service);
  const drain = async () => { const worker = new SearchWorker(store, repository.files); for (let count = 0; await worker.step(); count++) assert.ok(count < 50); };

  await t.test("new versions enqueue in the catalog commit, and unauthorized status/counts/excerpts are absent", async () => {
    assert.equal((await repository.database.pool.query("SELECT count(*)::int n FROM stex.search_jobs")).rows[0].n, 2);
    const before = await service.search(a.headers(), { text: "Bestätigungsschreiben" });
    assert.equal(before.totalHits, 0); assert.ok(before.documents.every(doc => doc.status === "pending"));
    for (const headers of [new Headers(), pending.headers()]) {
      const response = await api(headers, "?q=Bestätigungsschreiben");
      assert.ok([401, 403].includes(response.status));
      const body = await response.json(); assert.equal(body.totalHits, undefined); assert.equal(body.documents, undefined);
    }
    const cross = a.headers(); cross.set("sec-fetch-site", "cross-site"); assert.equal((await api(cross)).status, 403);
  });
  await t.test("one committed page survives a real PostgreSQL restart; live workers cannot double-claim", async () => {
    const claimed = await store.claim(); assert.ok(claimed);
    const bytes = await repository.files.read(claimed.storageKey, claimed.document.sha256, claimed.byteSize);
    await extractSearchBatch(bytes, claimed.document, store.adapter(claimed), { maxPages: 1 });
    const other = await store.claim();
    if (other) { assert.notEqual(other.document.documentVersionId, claimed.document.documentVersionId); await store.release(other); }
    const saved = await store.adapter(claimed).readManifest(claimed.document);
    assert.equal(saved?.nextPage, 2);
    await store.release(claimed);
    repository = await runtime.restart("search_source", repository.files);
    auth = makeAuth(); service = new CatalogSearchService(auth); store = new PostgresSearchStore(repository.database);
    await drain();
    assert.equal((await repository.database.pool.query("SELECT manifest->>'nextPage' n FROM stex.search_jobs WHERE document_version_id=$1", [claimed.document.documentVersionId])).rows[0].n, String((saved?.pageCount ?? 0) + 1));
  });
  await t.test("phrase, distinct laws, repeated occurrences, blank page and combined role use exact PDF links", async () => {
    const phrase = await service.search(a.headers(), { text: "KAUFMÄNNISCHES BESTÄTIGUNGSSCHREIBEN" });
    assert.equal(phrase.totalHits, 2); assert.notEqual(phrase.hits[0].start, phrase.hits[1].start);
    assert.ok(phrase.hits.every(hit => hit.pageNumber === 1 && hit.viewerURL.includes("textVersion=")));
    const norm = await service.search(b.headers(), { text: "§ 172 ZPO" });
    assert.equal(norm.totalHits, 3); assert.ok(norm.hits.every(hit => !hit.evidence.includes("BGB")));
    assert.equal(norm.documents.find(doc => doc.role === "sachverhalt")?.missingTextPages, 1);
    await repository.database.transaction(async client => { await lockState(client); await client.query("UPDATE stex.catalog_documents SET role='kombiniert' WHERE document_id=$1", [identity.documentId]); });
    await store.discover(); await drain();
    assert.ok((await service.search(a.headers(), { text: "Bestätigungsschreiben" })).hits.every(hit => hit.role === "kombiniert"));
    // Restore the role for the real importer to append to that same logical document.
    await repository.database.transaction(async client => { await lockState(client); await client.query("UPDATE stex.catalog_documents SET role='sachverhalt' WHERE document_id=$1", [identity.documentId]); });
  });
  await t.test("new version immediately replaces old results; fenced old jobs cannot publish after rebuild", async () => {
    const v2 = await importSearchFixture(auth, a.headers(), 2);
    const next = v2.summary.documents.find(doc => doc.role === "sachverhalt")!;
    assert.equal(next.documentId, identity.documentId); assert.equal(next.versionNumber, 2);
    const waiting = await service.search(a.headers(), { text: "Bestätigungsschreiben" });
    assert.equal(waiting.totalHits, 0); assert.ok(waiting.documents.every(doc => doc.documentVersionId !== identity.documentVersionId));
    const job = await store.claim(); assert.ok(job);
    await store.discover(true);
    await assert.rejects(() => store.adapter(job).readManifest(job.document), /search_job_replaced/);
    await store.release(job); await drain();
    const result = await service.search(a.headers(), { text: "Bestätigungsschreiben" });
    assert.equal(result.totalHits, 1); assert.equal(result.hits[0].documentVersionId, next.documentVersionId);
    assert.equal((await service.search(a.headers(), { norm: { law: "ZPO", paragraph: "172" } })).totalHits, 0);
  });
  await t.test("session renewal, account mismatch and committed block reject existing query contexts", async () => {
    const view = await service.search(a.headers(), null);
    await assert.rejects(() => service.search(b.headers(), { text: "Bestätigungsschreiben" }, view.context), /Anmeldung/);
    const renewed = new SyntheticAccount(auth, "search-a"); await renewed.auth("/sign-in/email", { email: "search-a@example.test", password: syntheticPassword });
    await assert.rejects(() => service.search(renewed.headers(), null, view.context), /Anmeldung/);
    await repository.database.transaction(async client => { await lockState(client); await client.query("UPDATE stex.accounts SET status='blocked' WHERE user_id='search-b'"); await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id='search-b'"); });
    assert.equal((await api(b.headers(), "?q=Bestätigungsschreiben")).status, 401);
    assert.equal((await api(a.headers(), "?law=ZPO&paragraph=bad")).status, 400);
  });
  await t.test("private documents never enter discovery; abort leaves durable work resumable", async () => {
    // A personal record is intentionally the same document-like text, but has no shared version FK.
    await repository.database.transaction(async client => { await lockState(client); await client.query("INSERT INTO stex.personal_records VALUES($1,'search-a','document','private-case',1,'synthetic',$2::jsonb,'{}')", [JSON.stringify(["document", "search-a", "private-case"]), JSON.stringify({ text: "Bestätigungsschreiben" })]); });
    const privateBytes = syntheticSearchPdf([["Privates Geheimnis: Bestätigungsschreiben"]]), privateKey = storageKey("search-a", "private-version");
    await repository.files.put(privateKey, privateBytes, fileHash(privateBytes));
    await repository.database.transaction(async client => {
      await lockState(client);
      await client.query("INSERT INTO stex.document_versions VALUES('private-version','private-case','search-a',$1,$2,$3,'application/pdf',1,'ready',NULL,$4,'data:application/pdf;base64,')", [JSON.stringify(["document", "search-a", "private-case"]), fileHash(privateBytes), privateBytes.length, privateKey]);
    });
    await store.discover(true);
    const cancellation = new AbortController();
    const originalRead = repository.files.read;
    repository.files.read = async (...args) => { const bytes = await originalRead.call(repository.files, ...args); cancellation.abort(); return bytes; };
    try { await assert.rejects(() => new SearchWorker(store, repository.files).step({ signal: cancellation.signal })); }
    finally { repository.files.read = originalRead; }
    assert.equal((await repository.database.pool.query("SELECT count(*)::int n FROM stex.search_jobs WHERE state='running'")).rows[0].n, 1);
    assert.equal((await repository.database.pool.query("SELECT count(*)::int n FROM stex.search_jobs")).rows[0].n, 3);
    await drain(); assert.equal((await service.search(a.headers(), { text: "Bestätigungsschreiben" })).totalHits, 1);
    assert.equal((await service.search(a.headers(), { text: "Privates Geheimnis" })).totalHits, 0);
  });
  await t.test("a real 33 MiB catalog PDF is accepted by the worker's explicit 50 MiB limit", async () => {
    const large = syntheticSearchPdf([["Suchbeleg in grosser PDF"]], 33 * 1024 * 1024), small = syntheticSearchPdf([["Kleine Loesung"]]);
    const documents = await Promise.all((["sachverhalt", "loesung"] as const).map(role => {
      const bytes = role === "sachverhalt" ? large : small;
      return validateCatalogPdf({ name: `${role}.pdf`, size: bytes.length, type: "application/pdf", arrayBuffer: async () => Uint8Array.from(bytes).buffer }, role);
    }));
    await new CatalogImportService(auth, repository.files).submit(a.headers(), { requestId: "search-large-import", metadata: { id: "search-large", source: "synthetic", title: "Grosse Suchprobe", area: "zr", date: "", topicIds: [] }, documents });
    await drain();
    assert.equal((await service.search(a.headers(), { text: "Suchbeleg in grosser PDF" })).totalHits, 1);
  });
  await t.test("format-4 restore preserves C1 commands, revokes sessions, and rebuilds derived search state", async () => {
    const progress = new ProgressService(auth), view = await progress.read(a.headers());
    const topicId = getLeafTopics(TOPICS)[0].id;
    await progress.submit(a.headers(), { contractVersion: 1, requestId: "search-preserve-c1", action: "set", expectedAccountId: view.account.userId,
      expectedAccessGeneration: view.account.accessGeneration, expectedSessionContext: view.account.sessionContext, changes: [{ topicId, percent: 37, expectedRevision: null }] });
    const target = await runtime.repository("search_restored"), directory = join(runtime.root, "search-backup");
    const protection = { encryptionKey, authSecret: secret };
    await backup(repository.database, repository.files, directory, protection);
    await restore(target.database, target.files, directory, protection);
    const restoredAuth = new AccountService({ database: target.database, files: target.files, baseURL, secret, mailKey });
    await assert.rejects(() => restoredAuth.principal(a.headers()), /anmelden/);
    assert.equal((await target.database.pool.query("SELECT count(*)::int n FROM stex.learning_commands")).rows[0].n, 1);
    assert.equal((await target.database.pool.query("SELECT count(*)::int n FROM stex.search_pages")).rows[0].n, 0);
    assert.ok((await target.database.pool.query("SELECT state,manifest FROM stex.search_jobs")).rows.every(row => row.state === "queued" && row.manifest === null));
    const restoredA = new SyntheticAccount(restoredAuth, "search-a"); await restoredA.auth("/sign-in/email", { email: "search-a@example.test", password: syntheticPassword });
    const restoredService = new CatalogSearchService(restoredAuth);
    assert.equal((await restoredService.search(restoredA.headers(), { text: "Bestätigungsschreiben" })).totalHits, 0);
    const worker = new SearchWorker(new PostgresSearchStore(target.database), target.files);
    while (await worker.step()) { /* bounded portions until the synthetic fixture is complete */ }
    assert.equal((await restoredService.search(restoredA.headers(), { text: "Bestätigungsschreiben" })).totalHits, 1);
    assert.equal((await new ProgressService(restoredAuth).read(restoredA.headers())).progress[0].value.percent, 37);
  });
});

test("SEARCH-A1: client boundary discards old responses and changed sessions without browser cache", () => {
  const boundary = new SearchBoundary(), a = { accountId: "A", generation: 1, sessionContext: "session-A" };
  assert.equal(boundary.accept(boundary.invalidate(), a), "accepted");
  const request = boundary.invalidate(); boundary.invalidate(); assert.equal(boundary.accept(request, a), "stale");
  assert.equal(boundary.accept(boundary.sequence, { ...a, sessionContext: "session-B" }), "changed");
  assert.equal(boundary.context, null);
});

test("SEARCH-A1: oversized legacy metadata is rejected before any private file I/O", async () => {
  let read = false, reason = "";
  // Resource guard unit, not a simulated persistence acceptance.
  const store = { claim: async () => ({ byteSize: 50 * 1024 * 1024 + 1 }),
    fail: async (_job: unknown, code: string) => { reason = code; }, release: async () => {} } as unknown as PostgresSearchStore;
  const files = { read: async () => { read = true; throw new Error("must not load oversized bytes"); } } as unknown as PrivateFiles;
  assert.equal(await new SearchWorker(store, files).step(), true);
  assert.equal(read, false); assert.equal(reason, "document_byte_limit");
});
