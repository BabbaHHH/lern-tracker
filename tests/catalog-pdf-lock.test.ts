import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile, unlink, symlink } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import { pdfR1Fixture } from "../scripts/pdf-viewer/pdf-a-r1-fixture";
import { syntheticPassword, syntheticPdf } from "../scripts/pdf-a/fixtures";
import { fileHash, storageKey } from "../src/lib/server/persistence/files";
import type { PdfIdentity } from "../src/lib/pdf-viewer/contract";
import { TOPICS } from "../src/lib/topics";

async function deadline<T>(promise: Promise<T>, milliseconds = 3000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Controlled concurrency deadline exceeded")), milliseconds); })]); }
  finally { clearTimeout(timeout); }
}

test("PDF-A-R1: real HTTP, PostgreSQL and unchanged PrivateFiles with delayed I/O", { timeout: 120000 }, async t => {
  const f = await pdfR1Fixture(); t.after(() => f.close());
  async function restoreReader() {
    await f.change(async client => {
      await client.query("UPDATE stex.accounts SET status='active' WHERE user_id=$1", [f.reader.name]);
      await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1", [f.reader.name]);
    });
    await f.reader.auth("/sign-in/email", { email: `${f.reader.name}@example.test`, password: syntheticPassword });
  }
  async function duringRead(identity: PdfIdentity, action: () => Promise<void>, extra?: Record<string, string>) {
    const gate = f.files.arm();
    const response = f.get(identity, { extra });
    let problem: unknown;
    try { await deadline(gate.entered); await action(); }
    catch (error) { problem = error; }
    finally { gate.release(); }
    const result = await response;
    if (problem) throw problem;
    return result;
  }
  function denied(response: Response, expected: number) {
    assert.equal(response.status, expected);
    for (const header of ["content-range", "accept-ranges", "etag", "last-modified", "content-disposition"]) assert.equal(response.headers.has(header), false, header);
    assert.match(response.headers.get("cache-control")!, /private.*no-store/);
    assert.match(response.headers.get("content-type")!, /application\/json/);
  }

  await t.test("independent real account writer commits before the file gate opens; no idle transaction", async () => {
    const identity = await f.seed();
    let completed = false;
    const gate = f.files.arm(), started = performance.now();
    const response = f.get(identity, { extra: { Range: "bytes=0-15" } }).then(value => { completed = true; return value; });
    try {
      await deadline(gate.entered);
      const transactions = await f.auth.database.pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND state LIKE 'idle in transaction%'");
      assert.equal(transactions.rows[0].count, 0);
      const headers = f.writer.headers();
      headers.set("origin", f.base); headers.set("x-stex-action", "1"); headers.set("content-type", "application/json");
      const writerStarted = performance.now();
      const written = await deadline(fetch(`${f.base}/api/account/notes`, { method: "POST", headers,
        body: JSON.stringify({ id: "r1-independent-writer", note: "Synthetischer Kontoschreiber", topicId: TOPICS[0].id, expectedRevision: null }) }));
      assert.equal(written.status, 200, await written.clone().text());
      assert.equal((await written.json()).note.revision, 1);
      const writerMs = performance.now() - writerStarted;
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.equal(completed, false, "PDF must still be held behind file I/O");
      t.diagnostic(JSON.stringify({ writerMs: Math.round(writerMs), fileHeldMs: Math.round(performance.now() - started), writerCommittedBeforeFileRelease: true, idleTransactionsDuringFileWait: 0 }));
    } finally { gate.release(); }
    const result = await response;
    assert.equal(result.status, 206); assert.deepEqual(Buffer.from(await result.arrayBuffer()), f.bytes.subarray(0, 16));
    assert.equal(f.files.calls.at(-1)!.size, f.bytes.length, "full original required for a tiny range");
  });

  await t.test("account block committed during I/O suppresses Range bytes", async () => {
    const response = await duringRead(await f.seed(), () => f.change(async client => {
      await client.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id=$1", [f.reader.name]);
      await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1", [f.reader.name]);
    }), { Range: "bytes=0-15" });
    denied(response, 401); await restoreReader();
  });
  await t.test("deleted session during I/O suppresses full bytes", async () => {
    const who = await f.auth.principal(f.reader.headers());
    const response = await duringRead(await f.seed(), () => f.change(async client => {
      await client.query("DELETE FROM public.stex_auth_session WHERE id=$1", [who.sessionId]);
    }));
    denied(response, 401); await restoreReader();
  });
  await t.test("generation change is rejected even if the same session was updated to the new generation", async () => {
    const who = await f.auth.principal(f.reader.headers());
    const response = await duringRead(await f.seed(), () => f.change(async client => {
      await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1", [f.reader.name]);
      await client.query('UPDATE public.stex_auth_session SET "stexGeneration"=(SELECT generation FROM stex.account_access WHERE user_id=$2) WHERE id=$1', [who.sessionId, f.reader.name]);
    }));
    denied(response, 401); await restoreReader();
  });
  await t.test("pending status effective during I/O suppresses If-Range fallback bytes", async () => {
    const response = await duringRead(await f.seed(), () => f.change(async client => {
      await client.query("UPDATE stex.accounts SET status='pending' WHERE user_id=$1", [f.reader.name]);
    }), { Range: "bytes=0-15", "If-Range": '"unknown"' });
    denied(response, 403); await restoreReader();
  });
  await t.test("changed document association during I/O suppresses the original bytes", async () => {
    const identity = await f.seed(), other = await f.seed();
    const response = await duringRead(identity, () => f.change(async client => {
      await client.query("UPDATE stex.catalog_documents SET klausur_id=$1,record_key=$2,role='unbekannt' WHERE document_id=$3", [other.klausurId, JSON.stringify(["klausur", null, other.klausurId]), identity.documentId]);
    }));
    denied(response, 404);
  });
  await t.test("changed document role during I/O is rejected", async () => {
    const identity = await f.seed();
    const response = await duringRead(identity, () => f.change(async client => {
      await client.query("UPDATE stex.catalog_documents SET role='unbekannt' WHERE document_id=$1", [identity.documentId]);
    }));
    denied(response, 409);
  });
  await t.test("deleted version during I/O is not returned from the captured metadata", async () => {
    const identity = await f.seed();
    const response = await duringRead(identity, () => f.change(async client => {
      await client.query("DELETE FROM stex.catalog_import_documents WHERE document_version_id=$1", [identity.documentVersionId]);
      await client.query("DELETE FROM stex.catalog_document_versions WHERE document_version_id=$1", [identity.documentVersionId]);
    }));
    denied(response, 404);
  });
  await t.test("replacement file identity under the same version ID suppresses previously verified bytes", async () => {
    const identity = await f.seed(), replacement = syntheticPdf(4);
    const key = storageKey("pdf-r1-replacement", randomUUID()), sha256 = fileHash(replacement);
    await f.repository.files.put(key, replacement, sha256);
    const response = await duringRead(identity, () => f.change(async client => {
      const old = (await client.query("SELECT to_jsonb(v) AS value FROM stex.catalog_document_versions v WHERE document_version_id=$1", [identity.documentVersionId])).rows[0].value;
      await client.query("DELETE FROM stex.catalog_import_documents WHERE document_version_id=$1", [identity.documentVersionId]);
      await client.query("DELETE FROM stex.catalog_document_versions WHERE document_version_id=$1", [identity.documentVersionId]);
      const changed = { ...old, sha256, storage_key: key, byte_size: replacement.length, created_at: new Date().toISOString() };
      await client.query("INSERT INTO stex.catalog_document_versions SELECT * FROM jsonb_populate_record(NULL::stex.catalog_document_versions,$1::jsonb)", [JSON.stringify(changed)]);
    }));
    denied(response, 409);
  });
  await t.test("HEAD/description/416 perform no file read; valid GET/Range/If-Range still verify full file each time", async () => {
    const identity = await f.seed(), before = f.files.calls.length;
    for (const options of [{ method: "HEAD", extra: { Range: "bytes=0-1" } }, { describe: true }, { method: "HEAD", describe: true }, { extra: { Range: "bytes=999999999-" } }]) {
      const response = await f.get(identity, options);
      assert.equal(response.status, options.extra?.Range === "bytes=999999999-" ? 416 : 200);
      assert.match(response.headers.get("cache-control")!, /private.*no-store/);
      if (options.method === "HEAD") assert.equal(await response.text(), "");
      else await response.arrayBuffer();
    }
    assert.equal(f.files.calls.length, before);
    const checks: { extra: Record<string, string>; status: number; length: number }[] = [
      { extra: {}, status: 200, length: f.bytes.length }, { extra: { Range: "bytes=0-7" }, status: 206, length: 8 },
      { extra: { Range: "bytes=-8" }, status: 206, length: 8 }, { extra: { Range: "bytes=0-7", "If-Range": '"guessed"' }, status: 200, length: f.bytes.length },
      { extra: { "If-None-Match": "*" }, status: 200, length: f.bytes.length },
    ];
    for (const check of checks) {
      const response = await f.get(identity, check); assert.equal(response.status, check.status); assert.equal((await response.arrayBuffer()).byteLength, check.length);
      assert.equal(response.headers.get("vary"), "Cookie");
    }
    assert.equal(f.files.calls.length - before, checks.length);
    assert.ok(f.files.calls.slice(before).every(call => call.completed && call.size === f.bytes.length));
  });
  for (const variant of ["HEAD", "description", "416"] as const) await t.test(`${variant} rechecks revocation under the final writer lock before exposing metadata`, async () => {
    const identity = await f.seed(), before = f.files.calls.length;
    const client = await f.auth.database.pool.connect();
    let pending: Promise<Response> | undefined;
    try {
      await client.query("BEGIN");
      await client.query("SELECT generation FROM stex.state WHERE singleton FOR UPDATE");
      pending = f.get(identity, variant === "HEAD" ? { method: "HEAD" } : variant === "description" ? { describe: true } : { extra: { Range: "bytes=999999999-" } });
      await deadline((async () => {
        for (;;) {
          const waiting = await f.auth.database.pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT generation FROM stex.state%'");
          if (waiting.rows[0].count > 0) return;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })());
      await client.query("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [f.reader.name]);
      await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1", [f.reader.name]);
      await client.query("COMMIT");
    } finally { await client.query("ROLLBACK"); client.release(); }
    const result = await pending!; denied(result, 401);
    if (variant === "HEAD") assert.equal(await result.text(), "");
    assert.equal(f.files.calls.length, before);
    await restoreReader();
  });
  await t.test("a second Range detects corruption beyond that range, even after an earlier successful read", async () => {
    const identity = await f.seed();
    assert.equal((await f.get(identity, { extra: { Range: "bytes=0-7" } })).status, 206);
    const row = (await f.auth.database.pool.query("SELECT storage_key FROM stex.catalog_document_versions WHERE document_version_id=$1", [identity.documentVersionId])).rows[0];
    const corrupt = Buffer.from(f.bytes); corrupt[corrupt.length - 32] ^= 1;
    await writeFile(join(f.files.root, row.storage_key), corrupt);
    const response = await f.get(identity, { extra: { Range: "bytes=0-7" } }); denied(response, 503);
    assert.equal((await response.json()).error.code, "unavailable");
  });
  for (const kind of ["missing", "wrong-size", "symlink"] as const) await t.test(`${kind} private file fails without PDF bytes or internal paths`, async () => {
    const identity = await f.seed();
    const row = (await f.auth.database.pool.query("SELECT storage_key FROM stex.catalog_document_versions WHERE document_version_id=$1", [identity.documentVersionId])).rows[0];
    const path = join(f.files.root, row.storage_key);
    if (kind === "missing") await unlink(path);
    else if (kind === "wrong-size") await writeFile(path, f.bytes.subarray(0, 64));
    else { const target = join(f.files.root, "synthetic-target.pdf"); await writeFile(target, f.bytes); await unlink(path); await symlink(target, path); }
    const response = await f.get(identity); denied(response, 503); const text = await response.text();
    assert.ok(!text.includes(f.files.root) && !text.includes(row.storage_key));
  });
  await t.test("database failure after successful file verification releases no PDF bytes", async () => {
    const result = await duringRead(await f.seed(), () => f.auth.database.close());
    denied(result, 503);
    assert.equal(f.files.calls.at(-1)!.completed, true);
    assert.equal((await result.json()).error.code, "unavailable");
  });
});
