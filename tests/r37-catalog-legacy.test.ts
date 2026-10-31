import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { testRuntime } from '../scripts/data-migration/postgres-test-runtime';
import { SyntheticAccount, syntheticPassword, syntheticPdf } from '../scripts/pdf-a/fixtures';
import { AccountService } from '../src/lib/server/auth/service';
import { CatalogImportService, CATALOG_MAX_REQUEST_BYTES, validateCatalogPdf, validateLegacyImportCommand } from '../src/lib/server/catalog/import-service';
import { catalogLegacyImportHTTP } from '../src/lib/server/catalog/legacy-import-http';
import { catalogImportHTTP } from '../src/lib/server/catalog/http';
import { digest, recordKey } from '../src/lib/data-migration/migration';
import { fileHash } from '../src/lib/server/persistence/files';
import { lockState } from '../src/lib/server/persistence/repository';
import type { LegacyImportCommand } from '../src/lib/catalog/legacy-import-contract';
import { getLeafTopics, TOPICS } from '../src/lib/topics';

function totp(uri: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of new URL(uri).searchParams.get('secret')!.replace(/=+$/, '')) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(v => parseInt(v, 2))), counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', key).update(counter).digest(), offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

test('R37 combined legacy delta: real PostgreSQL, private files and verified sessions', { timeout: 180000 }, async t => {
  const rt = await testRuntime(); t.after(() => rt.close());
  const repo = await rt.repository('r37_legacy_delta');
  const base = 'http://localhost:3097';
  const auth = new AccountService({ database: repo.database, files: repo.files, baseURL: base, secret: randomBytes(40).toString('hex'), mailKey: randomBytes(40).toString('hex') });
  const service = new CatalogImportService(auth, repo.files);
  const change = (sql: string, args: unknown[] = []) => repo.database.transaction(async c => { await lockState(c); return c.query(sql, args); });
  const admin = new SyntheticAccount(auth, 'r37-admin'), member = new SyntheticAccount(auth, 'r37-member'), pending = new SyntheticAccount(auth, 'r37-pending'), other = new SyntheticAccount(auth, 'r37-other');
  await admin.initialize(); await member.initialize(); await pending.initialize(false); await other.initialize();
  await change("INSERT INTO stex.auth_bootstrap(singleton,user_id,expires_at) VALUES(true,$1,now()+interval '1 hour')", [admin.name]);
  const uris = new Map<SyntheticAccount, string>();
  for (const a of [admin, other]) {
    await change('UPDATE stex.auth_bootstrap SET user_id=$1', [a.name]);
    const enabled = await (await a.auth('/two-factor/enable', { password: syntheticPassword, method: 'totp' })).json();
    await a.auth('/two-factor/verify-totp', { code: totp(enabled.totpURI), trustDevice: false });
    await change("UPDATE stex.accounts SET role='admin' WHERE user_id=$1", [a.name]); uris.set(a, enabled.totpURI);
    await a.auth('/sign-in/email', { email: `${a.name}@example.test`, password: syntheticPassword });
    await a.auth('/two-factor/verify-totp', { code: totp(enabled.totpURI), trustDevice: false });
  }
  const topic = getLeafTopics(TOPICS)[0].id;
  const metadata = (id: string) => ({ id, source: 'synthetic-source.pdf', title: 'Synthetischer R37 Fall', area: 'zr' as const, type: 'Urteil' as const, topicIds: [topic], date: '', createdAt: '2026-10-24T00:00:00Z', updatedAt: '2026-10-24T00:00:00Z' });
  const seed = async (id: string) => change("INSERT INTO stex.catalog_records(record_key,kind,id,revision,legacy_key,payload,normalized) VALUES($1,'klausur',$2,1,'synthetic-r37',$3::jsonb,'{}'::jsonb)", [recordKey('klausur', null, id), id, JSON.stringify(metadata(id))]);
  const bytes = syntheticPdf(2), filename = 'synthetic-combined.pdf';
  const document = await validateCatalogPdf({ name: filename, type: 'application/pdf', size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer }, 'kombiniert');
  const command = (id: string): LegacyImportCommand => ({ contractVersion: 1, requestId: randomUUID(), planId: 'synthetic-plan-r37', planSha256: digest('synthetic-plan'), klausurId: id, expectedMetadataRevision: 1, expectedMetadataSha256: digest(metadata(id)), expectedDocuments: [], source: { role: 'kombiniert', filename, sha256: fileHash(bytes), byteSize: bytes.length, edition: 'synthetic-v1' } });
  const headers = (who = admin, extra: Record<string, string> = {}) => { const h = who.headers(); h.set('origin', base); h.set('x-stex-action', '1'); for (const [k, v] of Object.entries(extra)) h.set(k, v); return h; };
  const form = (c: unknown) => { const f = new FormData(); f.set('command', JSON.stringify(c)); f.set('kombiniert', new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }), filename); return f; };
  const upload = (c: unknown, who = admin, extra: Record<string, string> = {}, f = form(c)) => catalogLegacyImportHTTP(new Request(`${base}/api/catalog/legacy-import`, { method: 'POST', headers: headers(who, extra), body: f }), service);
  const counts = async () => (await repo.database.pool.query(`SELECT (SELECT count(*)::int FROM stex.catalog_documents) AS documents,(SELECT count(*)::int FROM stex.catalog_document_versions) AS versions,(SELECT count(*)::int FROM stex.catalog_imports) AS receipts,(SELECT count(*)::int FROM stex.search_jobs) AS jobs,(SELECT generation FROM stex.state) AS generation`)).rows[0];
  let first: LegacyImportCommand;
  await t.test('one combined PDF creates one immutable version, receipt relation and existing search job', async () => {
    await seed('r37-first'); first = command('r37-first');
    const before = await counts(), response = await upload(first);
    assert.equal(response.status, 201, await response.clone().text());
    const summary = (await response.json()).import;
    assert.equal(summary.documents.length, 1); assert.equal(summary.documents[0].role, 'kombiniert'); assert.equal(summary.documents[0].versionNumber, 1);
    const after = await counts(); for (const k of ['documents', 'versions', 'receipts', 'jobs']) assert.equal(after[k], before[k] + 1);
    const row = (await repo.database.pool.query('SELECT * FROM stex.catalog_document_versions WHERE document_version_id=$1', [summary.documents[0].documentVersionId])).rows[0];
    assert.deepEqual(await repo.files.read(row.storage_key, row.sha256, Number(row.byte_size)), bytes);
    assert.equal((await repo.database.pool.query('SELECT count(*)::int AS n FROM stex.catalog_import_documents WHERE import_id=$1', [summary.importId])).rows[0].n, 1);
    const receipt = (await repo.database.pool.query('SELECT metadata FROM stex.catalog_imports WHERE import_id=$1', [summary.importId])).rows[0]; assert.deepEqual(receipt.metadata.legacy, first);
    const catalog = (await repo.database.pool.query('SELECT revision,payload FROM stex.catalog_records WHERE id=$1', [first.klausurId])).rows[0]; assert.equal(Number(catalog.revision), 1); assert.deepEqual(catalog.payload, metadata(first.klausurId));
  });
  await t.test('unchanged retry after lost response is write-free; receipt remains owner scoped', async () => {
    const before = await counts(), retry = await upload(first); assert.equal(retry.status, 200); assert.deepEqual(await counts(), before);
    const status = await catalogLegacyImportHTTP(new Request(`${base}/api/catalog/legacy-import?requestId=${first.requestId}`, { headers: headers() }), service);
    assert.equal(status.status, 200); assert.equal((await status.json()).import.status, 'committed');
    const foreign = await catalogLegacyImportHTTP(new Request(`${base}/api/catalog/legacy-import?requestId=${first.requestId}`, { headers: headers(other) }), service); assert.equal(foreign.status, 404);
    const changed = await upload({ ...first, planSha256: digest('another-plan') }); assert.equal(changed.status, 409); assert.deepEqual(await counts(), before);
  });
  await t.test('explicit identical current version reuses bytes and adds no version/index job', async () => {
    const c = command(first.klausurId), entry = (await service.list(admin.headers())).find(v => v.id === c.klausurId)!;
    c.expectedDocuments = entry.documents.map(({ documentId, documentVersionId, versionNumber, role, sha256, byteSize }) => ({ documentId, documentVersionId, versionNumber, role, sha256, byteSize }));
    const before = await counts(), response = await upload(c); assert.equal(response.status, 201); assert.equal((await response.json()).import.duplicateStatus, 'identical');
    const after = await counts(); assert.equal(after.versions, before.versions); assert.equal(after.documents, before.documents); assert.equal(after.jobs, before.jobs); assert.equal(after.receipts, before.receipts + 1);
  });
  await t.test('stale document expectation and different combined bytes cannot create another version', async () => {
    const before = await counts(); assert.equal((await upload(command(first.klausurId))).status, 409);
    const c = command(first.klausurId), entry = (await service.list(admin.headers())).find(v => v.id === c.klausurId)!;
    c.expectedDocuments = entry.documents.map(({ documentId, documentVersionId, versionNumber, role, sha256, byteSize }) => ({ documentId, documentVersionId, versionNumber, role, sha256, byteSize }));
    c.expectedDocuments[0].documentVersionId = 'wrong-version'; assert.equal((await upload(c)).status, 409);
    const otherBytes = syntheticPdf(3), otherDocument = await validateCatalogPdf({ name: filename, type: 'application/pdf', size: otherBytes.length, arrayBuffer: async () => Uint8Array.from(otherBytes).buffer }, 'kombiniert');
    c.requestId = randomUUID(); c.expectedDocuments[0].documentVersionId = entry.documents[0].documentVersionId; c.source.sha256 = otherDocument.sha256; c.source.byteSize = otherDocument.byteSize;
    await assert.rejects(service.submitLegacy(admin.headers(), c, otherDocument), (e: unknown) => (e as { status: number }).status === 409);
    const after = await counts(); assert.equal(after.versions, before.versions); assert.equal(after.documents, before.documents); assert.equal(after.jobs, before.jobs);
  });
  await t.test('missing ID, missing classification, revision/payload conflict and source hash/size fail without catalog writes', async () => {
    await seed('r37-conflict'); const c = command('r37-conflict'), before = await counts();
    for (const modified of [{ ...c, klausurId: 'missing-id' }, { ...c, expectedMetadataRevision: 2 }, { ...c, expectedMetadataSha256: digest('wrong') }, { ...c, source: { ...c.source, sha256: digest('wrong') } }, { ...c, source: { ...c.source, byteSize: bytes.length + 1 } }]) assert.equal((await upload(modified)).status, 409);
    await change("UPDATE stex.catalog_records SET payload=payload-'type' WHERE id=$1", [c.klausurId]);
    const payload = (await repo.database.pool.query('SELECT payload FROM stex.catalog_records WHERE id=$1', [c.klausurId])).rows[0].payload; c.expectedMetadataSha256 = digest(payload);
    assert.equal((await upload(c)).status, 409); assert.deepEqual(await counts(), before);
  });
  await t.test('metadata state is checked again at commit after receipt creation', async () => {
    await seed('r37-race'); const c = command('r37-race'); let puts = 0;
    const put = repo.files.put.bind(repo.files); repo.files.put = async (...args) => { puts++; return put(...args); };
    const transaction = auth.database.transaction.bind(auth.database); let writers = 0;
    auth.database.transaction = async (fn, readonly = false) => {
      // HTTP principal, service principal, begin, then commit use writer transactions.
      if (!readonly && ++writers === 4) await transaction(async client => { await lockState(client); await client.query("UPDATE stex.catalog_records SET revision=2 WHERE id=$1", [c.klausurId]); });
      return transaction(fn, readonly);
    };
    try { assert.equal((await upload(c)).status, 409); assert.equal(puts, 0); }
    finally { auth.database.transaction = transaction; repo.files.put = put; }
  });
  await t.test('admin demotion after begin prevents the commit and leaves only a failed receipt', async () => {
    await seed('r37-demotion'); const c = command('r37-demotion'), before = await counts();
    const transaction = auth.database.transaction.bind(auth.database); let writers = 0;
    auth.database.transaction = async (fn, readonly = false) => {
      if (!readonly && ++writers === 4) await transaction(async client => { await lockState(client); await client.query("UPDATE stex.accounts SET role='member' WHERE user_id=$1", [admin.name]); });
      return transaction(fn, readonly);
    };
    try { assert.equal((await upload(c)).status, 403); }
    finally { auth.database.transaction = transaction; await change("UPDATE stex.accounts SET role='admin' WHERE user_id=$1", [admin.name]); }
    const after = await counts(); assert.equal(after.documents, before.documents); assert.equal(after.versions, before.versions); assert.equal(after.jobs, before.jobs);
    const row = (await repo.database.pool.query('SELECT status,error_code FROM stex.catalog_imports WHERE request_id=$1', [c.requestId])).rows[0]; assert.equal(row.status, 'failed'); assert.equal(row.error_code, 'forbidden');
  });
  await t.test('interrupted processing receipt resumes once and concurrent equal requests share its version', async () => {
    await seed('r37-resume'); const c = command('r37-resume'), importId = `ci-${randomUUID()}`;
    await change(`INSERT INTO stex.catalog_imports(import_id,submitted_by_user_id,request_id,source_digest,source_reference,status,acceptance_mode,content_check,technical_validation,duplicate_status,metadata,warnings)
      VALUES($1,$2,$3,$4,$5,'processing','direct','not-performed','valid','pending',$6::jsonb,'[]'::jsonb)`, [importId, admin.name, c.requestId, digest({ legacy: c }), metadata(c.klausurId).source, JSON.stringify({ ...metadata(c.klausurId), legacy: c })]);
    const before = await counts();
    const results = await Promise.all([service.submitLegacy(admin.headers(), c, document), service.submitLegacy(admin.headers(), c, document)]);
    assert.ok(results.every(v => v.summary.importId === importId && v.summary.status === 'committed'));
    assert.equal(results[0].summary.documents[0].documentVersionId, results[1].summary.documents[0].documentVersionId);
    const after = await counts(); assert.equal(after.receipts, before.receipts); assert.equal(after.versions, before.versions + 1); assert.equal(after.jobs, before.jobs + 1);
  });
  await t.test('anonymous/member/pending/blocked/stale-factor and cross-origin fail before consuming the body', async () => {
    const deny = async (h: Headers) => {
      let reads = 0;
      const body = new ReadableStream<Uint8Array>({ pull(controller) { reads++; controller.enqueue(new Uint8Array([1])); controller.close(); } }, { highWaterMark: 0 });
      const response = await catalogLegacyImportHTTP(new Request(`${base}/api/catalog/legacy-import`, { method: 'POST', headers: h, body, duplex: 'half' } as RequestInit), service);
      assert.equal(reads, 0); assert.ok([401, 403].includes(response.status));
    };
    await deny(headers(admin, { cookie: '' })); await deny(headers(member)); await deny(headers(pending)); await deny(headers(admin, { origin: 'https://outside.example.test' }));
    await change("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [admin.name]); await deny(headers()); await change("UPDATE stex.accounts SET status='active' WHERE user_id=$1", [admin.name]);
    const who = await auth.principal(admin.headers(), 'admin');
    await change('UPDATE public.stex_auth_session SET "factorVerifiedAt"=now()-interval \'11 minutes\' WHERE id=$1', [who.sessionId]); await deny(headers());
    await change('UPDATE public.stex_auth_session SET "factorVerifiedAt"=now() WHERE id=$1', [who.sessionId]);
  });
  await t.test('strict multipart rejects extra/duplicate fields, client claims, malformed PDF and bounded streams', async () => {
    const c = command('r37-conflict');
    const extra = form(c); extra.append('owner', admin.name); assert.equal((await upload(c, admin, {}, extra)).status, 400);
    const duplicate = form(c); duplicate.append('command', '{}'); assert.equal((await upload(c, admin, {}, duplicate)).status, 400);
    assert.equal((await upload({ ...c, ownerUserId: admin.name })).status, 422);
    const bad = form(c); bad.set('kombiniert', new Blob(['not a PDF'], { type: 'application/pdf' }), filename); assert.equal((await upload(c, admin, {}, bad)).status, 422);
    const large = form(c); large.set('command', 'x'.repeat(32769)); assert.equal((await upload(c, admin, {}, large)).status, 413);
    assert.equal((await upload(c, admin, { 'content-length': String(CATALOG_MAX_REQUEST_BYTES + 1) })).status, 413);
    let canceled = false, sent = 0; const chunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({ pull(controller) { sent++; controller.enqueue(chunk); }, cancel() { canceled = true; } });
    const limited = await catalogLegacyImportHTTP(new Request(`${base}/api/catalog/legacy-import`, { method: 'POST', headers: headers(admin, { 'content-type': 'multipart/form-data; boundary=synthetic', 'content-length': '1' }), body, duplex: 'half' } as RequestInit), service);
    assert.equal(limited.status, 413); assert.equal(canceled, true); assert.ok(sent <= 112);
    assert.throws(() => validateLegacyImportCommand({ ...c, source: { ...c.source, role: 'sachverhalt' } }));
    assert.throws(() => validateLegacyImportCommand({ ...c, expectedDocuments: [{ documentId: 'a', documentVersionId: 'b', versionNumber: 2, role: 'kombiniert', sha256: fileHash(bytes), byteSize: bytes.length }] }));
  });
  await t.test('normal submit and normal HTTP still require separate Sachverhalt and Loesung', async () => {
    const before = await counts(), { createdAt, updatedAt, ...value } = metadata('r37-normal'); void createdAt; void updatedAt;
    // Deliberately bypass TypeScript to verify the unchanged runtime boundary.
    await assert.rejects(service.submit(admin.headers(), { requestId: randomUUID(), metadata: value, documents: [document] } as never), /Sachverhalt und Lösung/);
    const f = new FormData(); f.set('requestId', randomUUID()); f.set('metadata', JSON.stringify(value)); f.set('kombiniert', new Blob([Uint8Array.from(bytes)]), filename);
    const response = await catalogImportHTTP(new Request(`${base}/api/catalog/import`, { method: 'POST', headers: headers(), body: f }), service); assert.equal(response.status, 400);
    const sachverhalt = await validateCatalogPdf({ name: 's.pdf', type: 'application/pdf', size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer }, 'sachverhalt');
    const loesung = { ...sachverhalt, role: 'loesung' as const, filename: 'l.pdf' };
    const result = await service.submit(member.headers(), { requestId: randomUUID(), metadata: value, documents: [sachverhalt, loesung] }); assert.equal(result.summary.documents.length, 2);
    const after = await counts(); assert.equal(after.documents, before.documents + 2); assert.equal(after.versions, before.versions + 2);
    const legacy = command(value.id); legacy.expectedMetadataSha256 = digest((await repo.database.pool.query('SELECT payload FROM stex.catalog_records WHERE id=$1', [value.id])).rows[0].payload);
    assert.equal((await upload(legacy)).status, 409); assert.equal((await counts()).versions, after.versions);
  });
});
