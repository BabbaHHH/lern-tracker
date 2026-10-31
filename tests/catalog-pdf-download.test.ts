import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { pdfR1Fixture } from "../scripts/pdf-viewer/pdf-a-r1-fixture";
import { SyntheticAccount, syntheticPassword } from "../scripts/pdf-a/fixtures";
import { CatalogPdfService } from "../src/lib/server/catalog-pdf/service";
import { AccountService } from "../src/lib/server/auth/service";
import { catalogPdfDownloadHTTP, pdfDownloadFilename } from "../src/lib/server/catalog-pdf/download-http";
import { backup, restore } from "../src/lib/server/persistence/backup";
import { digest } from "../src/lib/data-migration/migration";
import { seal, unseal, tokenHash } from "../src/lib/server/auth/security";
import type { PdfIdentity } from "../src/lib/pdf-viewer/contract";
import { TOPICS } from "../src/lib/topics";

test("PDF-DL1: safe attachment basenames", () => {
  for (const name of ['../../evil.pdf', 'x\\y.pdf', 'a\r\nHeader: v.pdf', '";file.exe', '😀.pdf', '.pdf', 'a'.repeat(400)]) {
    const result = pdfDownloadFilename(name);
    assert.match(result, /^[a-zA-Z0-9_(). -]+\.pdf$/); assert.ok(result.length <= 124);
    assert.equal(/[\\/\r\n"]/.test(result), false);
  }
});

test("PDF-DL1: real PostgreSQL, files, sessions and loopback download HTTP", { timeout: 120000 }, async t => {
  const f = await pdfR1Fixture(); t.after(() => f.close());
  const pdf = new CatalogPdfService(f.auth, f.files);
  let base = "";
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      // The auth origin remains the synthetic application's origin; this second
      // loopback listener transports the same Request contract without Next.
      const request = new Request(`${f.base}/api/catalog/pdf-download`, { method: incoming.method,
        headers: new Headers({ ...incoming.headers, host: new URL(f.base).host } as unknown as Record<string, string>),
        body: chunks.length ? Buffer.concat(chunks) : undefined });
      const response = await catalogPdfDownloadHTTP(request, pdf);
      outgoing.statusCode = response.status; response.headers.forEach((value, key) => outgoing.setHeader(key, value));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.statusCode = 503; outgoing.end(); }
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address(); assert.ok(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); });
  const count = async () => Number((await f.auth.database.pool.query("SELECT count(*) FROM stex.catalog_pdf_downloads")).rows[0].count);
  const clear = () => f.change(async client => { await client.query("DELETE FROM stex.catalog_pdf_downloads"); });
  const download = (identity: PdfIdentity, requestId = randomUUID(), who = f.reader, extra: Record<string, string> = {}) => {
    const headers = who.headers(); headers.set("content-type", "application/json"); headers.set("origin", f.base); headers.set("x-stex-action", "1");
    Object.entries(extra).forEach(([key, value]) => headers.set(key, value));
    return fetch(base, { method: "POST", headers, body: JSON.stringify({ ...identity, requestId }) });
  };
  const restoreReader = async () => {
    await f.change(async client => { await client.query("UPDATE stex.accounts SET status='active' WHERE user_id=$1", [f.reader.name]); await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1", [f.reader.name]); });
    await f.reader.auth("/sign-in/email", { email: `${f.reader.name}@example.test`, password: syntheticPassword });
  };
  const identity = await f.seed();
  await t.test("viewer full/Range/HEAD/describe/416 consume nothing", async () => {
    for (const options of [{}, { extra: { Range: "bytes=0-15" } }, { method: "HEAD" }, { describe: true }, { extra: { Range: "bytes=999999999-" } }]) await (await f.get(identity, options)).arrayBuffer();
    assert.equal(await count(), 0);
  });
  await t.test("many concurrent commands across account sessions stop at five; second account is independent", async () => {
    const secondSession = new SyntheticAccount(f.auth, f.reader.name);
    await secondSession.auth("/sign-in/email", { email: `${f.reader.name}@example.test`, password: syntheticPassword });
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => download(identity, randomUUID(), index % 2 ? secondSession : f.reader)));
    assert.equal(results.filter(response => response.status === 200).length, 5);
    assert.equal(results.filter(response => response.status === 429).length, 7);
    assert.equal(await count(), 5);
    const success = results.find(response => response.status === 200)!;
    assert.deepEqual(Buffer.from(await success.arrayBuffer()), f.bytes);
    assert.match(success.headers.get("content-disposition")!, /^attachment; filename="sachverhalt.pdf"$/);
    assert.match(success.headers.get("cache-control")!, /private.*no-store/); assert.equal(success.headers.get("vary"), "Cookie");
    const denied = await results.find(response => response.status === 429)!.json();
    assert.doesNotMatch(denied.error.message, /\d/); assert.match(denied.error.message, /weiterhin lesen/);
    assert.equal((await download(identity, randomUUID(), f.writer)).status, 200);
    const viewer = await f.get(identity); assert.equal(viewer.status, 200); await viewer.arrayBuffer();
    assert.equal(await count(), 6);
  });
  await t.test("parallel technical replay uses one slot, rechecks rights and target, fresh actions still count", async () => {
    await clear(); const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 8 }, () => download(identity, key)));
    assert.ok(responses.every(value => value.status === 200)); assert.equal(await count(), 1);
    const other = await f.seed(); assert.equal((await download(other, key)).status, 409); assert.equal(await count(), 1);
    assert.equal((await download(identity)).status, 200); assert.equal(await count(), 2);
    await f.change(async client => { await client.query("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [f.reader.name]); });
    try { assert.equal((await download(identity, key)).status, 401); assert.equal(await count(), 2); }
    finally { await restoreReader(); }
    const anotherService = new CatalogPdfService(f.auth, f.files);
    const headers = f.reader.headers(); headers.set("origin", f.base); headers.set("x-stex-action", "1"); headers.set("content-type", "application/json");
    assert.equal((await catalogPdfDownloadHTTP(new Request(`${f.base}/api/catalog/pdf-download`, { method: "POST", headers, body: JSON.stringify({ ...identity, requestId: key }) }), anotherService)).status, 200);
    assert.equal(await count(), 2);
  });
  await t.test("malformed, unauthenticated, cross-origin, missing target and missing/tampered bytes cost nothing", async () => {
    await clear();
    assert.equal((await download(identity, "bad" as ReturnType<typeof randomUUID>)).status, 400);
    assert.equal((await download({ ...identity, documentId: "missing" })).status, 404);
    assert.equal((await download(identity, randomUUID(), f.reader, { origin: "https://outside.example.test" })).status, 403);
    assert.equal((await download(identity, randomUUID(), f.reader, { cookie: "" })).status, 401);
    const missing = await f.seed();
    const row = (await f.auth.database.pool.query("SELECT storage_key FROM stex.catalog_document_versions WHERE document_version_id=$1", [missing.documentVersionId])).rows[0];
    const path = join(f.files.root, row.storage_key); const original = await readFile(path);
    await writeFile(path, "tampered"); assert.equal((await download(missing)).status, 503);
    await unlink(path); assert.equal((await download(missing)).status, 503);
    await writeFile(path, original); assert.equal(await count(), 0);
  });
  await t.test("revocation and changed identity during unlocked file I/O deny bytes and spend nothing", async () => {
    for (const variant of ["session", "target"] as const) {
      const doc = await f.seed(), gate = f.files.arm(); const pending = download(doc);
      try {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try { await Promise.race([gate.entered, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("file gate deadline")), 5000); })]); }
        finally { clearTimeout(timer); }
        const idle = await f.auth.database.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND state LIKE 'idle in transaction%'"); assert.equal(idle.rows[0].n, 0);
        await f.change(async client => {
          if (variant === "session") { const who = await f.auth.principal(f.reader.headers()); await client.query("DELETE FROM public.stex_auth_session WHERE id=$1", [who.sessionId]); }
          else await client.query("UPDATE stex.catalog_documents SET role='unbekannt' WHERE document_id=$1", [doc.documentId]);
        });
      } finally { gate.release(); }
      const response = await pending; assert.equal(response.status, variant === "session" ? 401 : 409); assert.equal(response.headers.has("content-disposition"), false); assert.equal(await count(), 0);
      if (variant === "session") await restoreReader();
    }
  });
  await t.test("response assembly failure rolls back; yesterday receipts do not consume today or replay across days", async () => {
    const requestId = randomUUID();
    await assert.rejects(pdf.read(f.reader.headers(), identity, { downloadRequestId: requestId, needsBytes: () => true, respond: () => { throw new Error("synthetic assembly failure"); } }), /synthetic assembly/);
    assert.equal(await count(), 0);
    assert.equal((await download(identity, requestId)).status, 200);
    await f.change(async client => { await client.query("UPDATE stex.catalog_pdf_downloads SET download_day=download_day-1"); });
    assert.equal((await download(identity, requestId)).status, 409);
    for (let n = 0; n < 5; n++) assert.equal((await download(identity)).status, 200);
    assert.equal((await download(identity)).status, 429); assert.equal(await count(), 6);
  });
  await t.test("database Berlin day covers midnight, winter/summer and both DST boundaries", async () => {
    const cases = [
      ["2026-01-01T22:59:59Z", "2026-01-01"], ["2026-01-01T23:00:00Z", "2026-01-02"],
      ["2026-07-01T21:59:59Z", "2026-07-01"], ["2026-07-01T22:00:00Z", "2026-07-02"],
      ["2026-03-28T23:00:00Z", "2026-03-29"], ["2026-03-29T00:59:59Z", "2026-03-29"], ["2026-03-29T01:00:00Z", "2026-03-29"], ["2026-03-29T22:00:00Z", "2026-03-30"],
      ["2026-10-24T22:00:00Z", "2026-10-25"], ["2026-10-25T00:59:59Z", "2026-10-25"], ["2026-10-25T01:00:00Z", "2026-10-25"], ["2026-10-25T23:00:00Z", "2026-10-26"],
    ];
    for (const [instant, expected] of cases) assert.equal((await f.auth.database.pool.query("SELECT to_char($1::timestamptz AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS day", [instant])).rows[0].day, expected);
    await assert.rejects(f.auth.database.pool.query("INSERT INTO stex.catalog_pdf_downloads(owner_user_id,request_id,download_day,slot,fingerprint) VALUES($1,$2,current_date,6,$3)", [f.reader.name, randomUUID(), "a".repeat(64)]), /check constraint/);
  });
  await t.test("format4 encrypted backup/restore preserves receipts, rejects missing quota table and occupied target", async () => {
    // Synthetic protection values only; never use application environment secrets.
    const protection = { encryptionKey: randomBytes(40).toString("hex"), authSecret: randomBytes(40).toString("hex") };
    const noteHeaders = f.writer.headers(); noteHeaders.set("origin", f.base); noteHeaders.set("x-stex-action", "1"); noteHeaders.set("content-type", "application/json");
    const note = await f.auth.accountHTTP(new Request(`${f.base}/api/account/notes`, { method: "POST", headers: noteHeaders,
      body: JSON.stringify({ id: "pdf-dl1-private-note", note: "Private synthetic note survives quota backup changes", topicId: TOPICS[0].id, expectedRevision: null }) }));
    assert.equal(note.status, 200);
    const personalBefore = (await f.auth.database.pool.query("SELECT to_jsonb(p) AS row FROM stex.personal_records p ORDER BY record_key")).rows;
    const path = join(f.runtime.root, "pdf-download-backup");
    const before = (await f.auth.database.pool.query("SELECT to_jsonb(d) AS row FROM stex.catalog_pdf_downloads d ORDER BY request_id")).rows;
    await backup(f.auth.database, f.repository.files, path, protection);
    const target = await f.runtime.repository("pdf_download_restore");
    await restore(target.database, target.files, path, protection);
    assert.deepEqual((await target.database.pool.query("SELECT to_jsonb(d) AS row FROM stex.catalog_pdf_downloads d ORDER BY request_id")).rows, before);
    assert.deepEqual((await target.database.pool.query("SELECT to_jsonb(p) AS row FROM stex.personal_records p ORDER BY record_key")).rows, personalBefore);
    assert.equal((await target.database.pool.query("SELECT count(*) FROM public.stex_auth_session")).rows[0].count, "0");
    assert.ok(Number((await target.database.pool.query("SELECT count(*) FROM stex.catalog_records")).rows[0].count) > 0);
    await assert.rejects(restore(target.database, target.files, path, protection), /leere Zieldatenbank/);
    const filename = join(path, "manifest.json"), outer = JSON.parse(await readFile(filename, "utf8"));
    const decoded = JSON.parse(unseal(outer.sealed, protection.encryptionKey)); delete decoded.manifest.rows.catalog_pdf_downloads;
    const { sha256: ignored, ...content } = decoded.manifest; void ignored; decoded.manifest.sha256 = digest(content);
    outer.sealed = seal(JSON.stringify({ ...decoded, authSecretFingerprint: tokenHash(protection.authSecret) }), protection.encryptionKey);
    await writeFile(filename, JSON.stringify(outer));
    const empty = await f.runtime.repository("pdf_download_missing_table");
    await assert.rejects(restore(empty.database, empty.files, path, protection), /Sicherungstabellen/);
    assert.equal((await empty.database.pool.query("SELECT count(*) FROM stex.catalog_pdf_downloads")).rows[0].count, "0");
    const restarted = await f.runtime.restart("pdf_download_restore", target.files);
    assert.deepEqual((await restarted.database.pool.query("SELECT to_jsonb(d) AS row FROM stex.catalog_pdf_downloads d ORDER BY request_id")).rows, before);
    const restoredAuth = new AccountService({ database: restarted.database, files: restarted.files, baseURL: f.base,
      secret: protection.authSecret, mailKey: randomBytes(40).toString("hex") });
    const restoredReader = new SyntheticAccount(restoredAuth, f.reader.name);
    await restoredReader.auth("/sign-in/email", { email: `${f.reader.name}@example.test`, password: syntheticPassword });
    const headers = restoredReader.headers(); headers.set("origin", f.base); headers.set("x-stex-action", "1"); headers.set("content-type", "application/json");
    const denied = await catalogPdfDownloadHTTP(new Request(`${f.base}/api/catalog/pdf-download`, { method: "POST", headers,
      body: JSON.stringify({ ...identity, requestId: randomUUID() }) }), new CatalogPdfService(restoredAuth, restarted.files));
    assert.equal(denied.status, 429, "restore/restart and fresh sign-in must not replenish today's quota");
  });
});
