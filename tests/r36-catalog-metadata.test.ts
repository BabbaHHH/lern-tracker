import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { testRuntime } from '../scripts/data-migration/postgres-test-runtime';
import { SyntheticAccount, syntheticPassword } from '../scripts/pdf-a/fixtures';
import { AccountService } from '../src/lib/server/auth/service';
import { CatalogMetadataService } from '../src/lib/server/catalog/metadata-service';
import { catalogMetadataHTTP } from '../src/lib/server/catalog/metadata-http';
import { CatalogMetadataClient } from '../src/lib/catalog/metadata-client';
import { METADATA_MAX_BATCH, METADATA_MAX_BYTES, metadataContext, type MetadataCommand, type MetadataFields } from '../src/lib/catalog/metadata-contract';
import { lockState } from '../src/lib/server/persistence/repository';
import { canonical, digest, recordKey } from '../src/lib/data-migration/migration';
import { backup, restore } from '../src/lib/server/persistence/backup';
import { seal, unseal } from '../src/lib/server/auth/security';
import { getLeafTopics, TOPICS } from '../src/lib/topics';

function totp(uri: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of new URL(uri).searchParams.get('secret')!.toUpperCase().replace(/=+$/, '')) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(v => parseInt(v, 2))), counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', key).update(counter).digest(), offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
const topic = getLeafTopics(TOPICS)[0].id;
const value = (id: string): MetadataFields => ({ id, source: 'synthetic', title: `Fall ${id}`, area: 'zr', date: '', topicIds: [topic] });

test('R36-B2 real PostgreSQL, verified sessions, admin TOTP, bounded HTTP and restore', { timeout: 180000 }, async t => {
  const rt = await testRuntime(); t.after(() => rt.close());
  const repo = await rt.repository('r36_b2_source');
  let base = '';
  let dropNext = false;
  const server = createServer(async (req, res) => {
    try {
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
      const request = new Request(`${base}${req.url}`, { method: req.method, headers, ...(req.method === 'POST' ? { body: Readable.toWeb(req), duplex: 'half' } : {}) } as RequestInit);
      const response = await catalogMetadataHTTP(request, svc, req.url === '/api/catalog/metadata/preview');
      if (dropNext && req.method === 'POST' && req.url === '/api/catalog/metadata') { dropNext = false; res.destroy(); return; }
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(503); res.end(); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); });
  const address = server.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
  const syntheticSecret = randomBytes(40).toString('hex');
  const auth = new AccountService({ database: repo.database, files: repo.files, baseURL: base, secret: syntheticSecret, mailKey: randomBytes(40).toString('hex') });
  const svc = new CatalogMetadataService(auth);
  const admin = new SyntheticAccount(auth, 'r36-admin'), member = new SyntheticAccount(auth, 'r36-member'), pending = new SyntheticAccount(auth, 'r36-pending'), other = new SyntheticAccount(auth, 'r36-other-admin');
  await admin.initialize(); await member.initialize(); await pending.initialize(false); await other.initialize();
  const change = async (sql: string, args: unknown[] = []) => auth.database.transaction(async c => { await lockState(c); return c.query(sql, args); });
  await change("INSERT INTO stex.auth_bootstrap(singleton,user_id,expires_at) VALUES(true,$1,now()+interval '1 hour')", [admin.name]);
  const adminURIs = new Map<SyntheticAccount, string>();
  for (const a of [admin, other]) {
    await change('UPDATE stex.auth_bootstrap SET user_id=$1 WHERE singleton', [a.name]);
    const enabled = await (await a.auth('/two-factor/enable', { password: syntheticPassword, method: 'totp' })).json();
    await a.auth('/two-factor/verify-totp', { code: totp(enabled.totpURI), trustDevice: false });
    await change("UPDATE stex.accounts SET role='admin' WHERE user_id=$1", [a.name]); adminURIs.set(a, enabled.totpURI);
  }
  const loginAdmin = async (a = admin) => {
    await a.auth('/sign-in/email', { email: `${a.name}@example.test`, password: syntheticPassword });
    await a.auth('/two-factor/verify-totp', { code: totp(adminURIs.get(a)!), trustDevice: false });
  };
  const request = (body?: unknown, path = '', who = admin, extra: Record<string, string> = {}) => {
    const headers = who.headers(); headers.set('origin', base); headers.set('x-stex-action', '1'); headers.set('content-type', 'application/json');
    for (const [k, v] of Object.entries(extra)) headers.set(k, v);
    return fetch(`${base}/api/catalog/metadata${path}`, { headers, method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
  };
  const view = () => svc.read(admin.headers());
  const counts = async () => (await repo.database.pool.query("SELECT (SELECT count(*) FROM stex.catalog_records)::int AS records,(SELECT count(*) FROM stex.catalog_metadata_commands)::int AS receipts,(SELECT generation FROM stex.state) AS generation")).rows[0];
  const commandFor = async (records: MetadataFields[]): Promise<MetadataCommand> => {
    const v = await view(), p = await svc.preview(admin.headers(), { ...metadataContext(v.account), records });
    return { ...metadataContext(v.account), action: 'import', records: p.records, snapshot: p.snapshot, requestId: randomUUID() };
  };
  let first: MetadataCommand;
  await t.test('read/preview creates no defaults; member/pending/anonym and cross-origin denied before JSON', async () => {
    const before = await counts(), v = await view();
    assert.equal(v.entry, null);
    const p = await request({ ...metadataContext(v.account), records: [value('B2-A')] }, '/preview');
    assert.equal(p.status, 200); assert.equal((await p.json()).rows[0].expectedRevision, null);
    assert.deepEqual(await counts(), before);
    assert.equal((await request(undefined, '', member)).status, 403);
    assert.equal((await request(undefined, '', pending)).status, 403);
    assert.equal((await request({}, '', admin, { cookie: '' })).status, 401);
    assert.equal((await request({}, '', admin, { origin: 'https://outside.example.test' })).status, 403);
    const response = await request(); assert.match(response.headers.get('cache-control')!, /private.*no-store/); assert.equal(response.headers.get('vary'), 'Cookie');
  });
  await t.test('strict JSON/allowlists, dates/topics/duplicates and bounded actual bytes without Content-Length', async () => {
    const a = metadataContext((await view()).account), before = await counts();
    const bad = [[], Array.from({ length: METADATA_MAX_BATCH + 1 }, (_, n) => value(`limit-${n}`)), [value('dup'), value('dup')], [{ ...value('x'), notes: 'private' }], [{ ...value('x'), id: '' }], [{ ...value('x'), date: '2026-02-30' }], [{ ...value('x'), topicIds: ['unknown'] }]];
    for (const [i, records] of bad.entries()) assert.equal((await request({ ...a, records }, '/preview')).status, [400, 400, 400, 422, 400, 422, 422][i]);
    const headers = admin.headers(); headers.set('origin', base); headers.set('x-stex-action', '1'); headers.set('content-type', 'application/json');
    let cancelled = false;
    const oversized = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(METADATA_MAX_BYTES)); c.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } });
    const response = await catalogMetadataHTTP(new Request(`${base}/api/catalog/metadata/preview`, { method: 'POST', headers, body: oversized, duplex: 'half' } as RequestInit), svc, true);
    assert.equal(response.status, 413); assert.equal(cancelled, true); assert.deepEqual(await counts(), before);
  });
  await t.test('explicit IDs/classification and unknown date survive; concurrent replay writes once', async () => {
    first = await commandFor([value('B2-A'), value('B2-B')]);
    const before = await counts();
    const results = await Promise.all(Array.from({ length: 6 }, () => request(first)));
    for (const response of results) assert.equal(response.status, 200);
    const bodies = await Promise.all(results.map(r => r.json())); assert.equal(bodies.filter(r => !r.replay).length, 1);
    assert.equal((await counts()).receipts, before.receipts + 1);
    const stored = await svc.read(admin.headers(), 'B2-A'); assert.deepEqual(stored.entry?.metadata, value('B2-A')); assert.equal(stored.entry?.revision, 1);
    assert.equal((await repo.database.pool.query('SELECT count(*) FROM stex.record_references WHERE target_topic_id=$1', [topic])).rows[0].count, '2');
    assert.equal((await request({ ...first, records: [value('different')] })).status, 409);
  });
  await t.test('batch ID conflicts are durable all-or-nothing; stale preview/revision cannot overwrite', async () => {
    const conflictCommand = await commandFor([{ ...value('B2-A'), title: 'abweichend' }, value('not-created')]);
    const response = await request(conflictCommand); assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.status, 'conflict'); assert.deepEqual(result.rows.map((r: { outcome: string }) => r.outcome), ['conflict', 'skipped']);
    assert.equal((await request(undefined, '?id=not-created')).status, 404);
    const stale = await commandFor([value('stale')]);
    await svc.submit(admin.headers(), await commandFor([value('stale')]));
    assert.equal((await request(stale)).status, 409);
    const v = await svc.read(admin.headers(), 'B2-A'); assert.equal((await request({ ...metadataContext(v.account), action: 'patch', requestId: randomUUID(), id: 'B2-A', expectedRevision: 99, expectedSnapshot: v.entry!.snapshot, fields: { title: 'bad' } })).status, 409);
  });
  await t.test('patch preserves unknown provenance/private extensions; public projection hides them and topic refs update', async () => {
    const key = recordKey('klausur', null, 'B2-A');
    await change("UPDATE stex.catalog_records SET payload=payload||$2::jsonb,normalized=normalized||$3::jsonb WHERE record_key=$1", [key, JSON.stringify({ notes: 'synthetic private marker', provenance: { origin: 'keep' }, type: 'Urteil' }), JSON.stringify({ sourceReference: 'historical', extension: 42 })]);
    const v = await svc.read(admin.headers(), 'B2-A'), base = { ...metadataContext(v.account), action: 'patch', requestId: randomUUID(), id: 'B2-A', expectedRevision: 1, expectedSnapshot: v.entry!.snapshot };
    assert.equal((await request({ ...base, fields: { id: 'new-id' } })).status, 400);
    assert.equal((await request({ ...base, fields: { notes: 'publish' } })).status, 400);
    assert.equal((await request({ ...base, fields: { title: 'Geändert', topicIds: [], type: null } })).status, 200);
    const stored = (await repo.database.pool.query('SELECT payload,normalized,revision FROM stex.catalog_records WHERE record_key=$1', [key])).rows[0];
    assert.equal(stored.payload.notes, 'synthetic private marker'); assert.equal(stored.payload.provenance.origin, 'keep'); assert.equal(stored.normalized.extension, 42); assert.equal(stored.normalized.sourceReference, 'historical'); assert.equal(Object.hasOwn(stored.payload, 'type'), false);
    assert.equal((await repo.database.pool.query('SELECT count(*) FROM stex.record_references WHERE source_catalog_key=$1', [key])).rows[0].count, '0');
    const projection = await (await request(undefined, '?id=B2-A')).text(); assert.doesNotMatch(projection, /synthetic private marker|provenance|historical|extension/);
  });
  await t.test('account/session binding, owner-scoped receipts and authorized replay after fresh sign-in', async () => {
    const receipt = await svc.status(admin.headers(), first!.requestId); assert.equal(receipt.replay, true);
    assert.equal((await request(undefined, `?requestId=${first!.requestId}`, other)).status, 404);
    await loginAdmin();
    assert.equal((await request(first!)).status, 409);
    const rebound = { ...first!, ...metadataContext((await view()).account) };
    const replay = await request(rebound); assert.equal(replay.status, 200); assert.equal((await replay.json()).replay, true);
    assert.equal((await request({ ...rebound, expectedAccountId: other.name })).status, 409);
    await change("UPDATE stex.accounts SET role='member' WHERE user_id=$1", [admin.name]);
    assert.equal((await request(undefined, `?requestId=${first!.requestId}`)).status, 403);
    await change("UPDATE stex.accounts SET role='admin' WHERE user_id=$1", [admin.name]);
  });
  await t.test('blocked between initial auth and transaction; commit fault rolls all rows/receipt back', async () => {
    const command = await commandFor([value('not-committed')]), before = await counts();
    const blocked = new CatalogMetadataService(auth, { beforeTransaction: async () => { await change("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [admin.name]); } });
    await assert.rejects(blocked.submit(admin.headers(), command), (e: unknown) => (e as { status: number }).status === 401);
    await change("UPDATE stex.accounts SET status='active' WHERE user_id=$1", [admin.name]);
    assert.deepEqual(await counts(), before);
    const faulty = new CatalogMetadataService(auth, { beforeCommit: () => { throw new Error('synthetic commit failure'); } });
    await assert.rejects(faulty.submit(admin.headers(), command), /synthetic commit/); assert.deepEqual(await counts(), before);
    await change("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [member.name]);
    assert.equal((await request(undefined, '', member)).status, 401);
    await change("UPDATE stex.accounts SET status='active' WHERE user_id=$1", [member.name]);
  });
  await t.test('delete guards indexed and nested unindexed personal calendar/task/draft links and import/file FKs', async () => {
    const deletion = async (id: string) => { const v = await svc.read(admin.headers(), id); return { ...metadataContext(v.account), action: 'delete', id, expectedRevision: v.entry!.revision, expectedSnapshot: v.entry!.snapshot, requestId: randomUUID() }; };
    for (const kind of ['calendar-event', 'day-task', 'plan-draft', 'writing-draft']) {
      const id = `guard-${kind}`; await svc.submit(admin.headers(), await commandFor([value(id)]));
      const key = recordKey(kind, member.name, id);
      await change("INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,$3,$4,1,'synthetic',$5::jsonb,'{}')", [key, member.name, kind, id, JSON.stringify({ id: `personal-${id}`, nested: [{ linkedKlausurId: id }] })]);
      const denied = await request(await deletion(id)); assert.equal(denied.status, 409); assert.doesNotMatch(await denied.text(), new RegExp(`${member.name}|nested|${kind}`));
      await change("UPDATE stex.personal_records SET payload='{}' WHERE record_key=$1", [key]);
      await change("INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_catalog_key) VALUES($1,'value.klausurId',$2,$1,$3)", [key, member.name, recordKey('klausur', null, id)]);
      assert.equal((await request(await deletion(id))).status, 409);
    }
    const id = 'guard-import'; await svc.submit(admin.headers(), await commandFor([value(id)])); const key = recordKey('klausur', null, id);
    await change("INSERT INTO stex.imports(owner_user_id,request_id,source_digest,exported_at,areas) VALUES($1,'synthetic-import',$2,'2026-10-23','[]')", [member.name, 'a'.repeat(64)]);
    await change("INSERT INTO stex.import_records(owner_user_id,request_id,record_key,revision,catalog_key) VALUES($1,'synthetic-import',$2,1,$2)", [member.name, key]);
    assert.equal((await request(await deletion(id))).status, 409);
    await change("INSERT INTO stex.catalog_imports(import_id,submitted_by_user_id,request_id,source_digest,source_reference,status,acceptance_mode,content_check,technical_validation,duplicate_status,klausur_id,metadata,warnings) VALUES('synthetic-import',$1,'synthetic-pdf',$2,'synthetic','committed','direct','not-performed','valid','distinct',$3,'{}','[]')", [member.name, 'b'.repeat(64), id]);
    await change("DELETE FROM stex.import_records WHERE catalog_key=$1", [key]);
    assert.equal((await request(await deletion(id))).status, 409);
    await change("INSERT INTO stex.catalog_documents(document_id,record_key,klausur_id,role,source_reference,created_by_user_id) VALUES('synthetic-doc',$1,$2,'sachverhalt','synthetic',$3)", [key, id, member.name]);
    await change("UPDATE stex.catalog_imports SET klausur_id=NULL WHERE import_id='synthetic-import'");
    assert.equal((await request(await deletion(id))).status, 409);
    const free = 'delete-free'; await svc.submit(admin.headers(), await commandFor([value(free)]));
    const command = await deletion(free); assert.equal((await request(command)).status, 200); assert.equal((await request(command)).status, 200);
    assert.equal((await request(undefined, `?id=${free}`)).status, 404);
  });
  await t.test('actual lost HTTP reply, client recovery/status-first, re-login and missing-receipt retry', async () => {
    const transport: typeof fetch = async (url, init) => {
      const headers = admin.headers(); new Headers(init?.headers).forEach((v, k) => headers.set(k, v)); headers.set('origin', base);
      return fetch(`${base}${url}`, { ...init, headers });
    };
    const client = new CatalogMetadataClient(transport); await client.load();
    const p = await client.preview([value('client-drop')], client.state.view!.account); assert.ok(p);
    const before = await counts(); dropNext = true; assert.equal(await client.import(p), null); assert.equal(client.state.uncertain, true);
    const after = await counts(); assert.equal(after.receipts, before.receipts + 1);
    await loginAdmin(); assert.equal((await client.recover())?.replay, true); assert.equal(client.state.uncertain, false); assert.equal((await counts()).receipts, after.receipts);
    let failBefore = true;
    const offline = new CatalogMetadataClient(async (url, init) => { if (url === '/api/catalog/metadata' && init?.method === 'POST' && failBefore) { failBefore = false; throw new Error('synthetic offline before send'); } return transport(url, init); });
    await offline.load(); const preview = await offline.preview([value('client-retry')], offline.state.view!.account); assert.ok(preview);
    assert.equal(await offline.import(preview), null); assert.equal((await offline.recover())?.status, 'committed');
    const saved = offline.state.result!.requestId;
    await change("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [admin.name]); await offline.load(); assert.equal(offline.state.view, null);
    await change("UPDATE stex.accounts SET status='active' WHERE user_id=$1", [admin.name]); assert.equal((await svc.status(admin.headers(), saved)).status, 'committed');
  });
  await t.test('confirmed object proof prevents edits of a recreated ID, even at the same revision', async () => {
    const id = 'recreated-id'; await svc.submit(admin.headers(), await commandFor([value(id)]));
    const old = await svc.read(admin.headers(), id), account = metadataContext(old.account), proof = { id, expectedRevision: old.entry!.revision, expectedSnapshot: old.entry!.snapshot };
    await svc.submit(admin.headers(), { ...account, ...proof, action: 'delete', requestId: randomUUID() });
    await svc.submit(admin.headers(), await commandFor([{ ...value(id), title: 'Neu erstellter Fall' }]));
    assert.equal((await svc.read(admin.headers(), id)).entry!.revision, old.entry!.revision);
    assert.equal((await request({ ...account, ...proof, action: 'patch', fields: { title: 'Stale edit' }, requestId: randomUUID() })).status, 409);
  });
  await t.test('client hides unknown result and drops pending content when a different admin signs in', async () => {
    let actor = admin;
    const client = new CatalogMetadataClient(async (url, init) => {
      const headers = actor.headers(); new Headers(init?.headers).forEach((v, k) => headers.set(k, v)); headers.set('origin', base);
      return fetch(`${base}${url}`, { ...init, headers });
    });
    await client.load(); const p = await client.preview([value('owner-switch')], client.state.view!.account); assert.ok(p);
    dropNext = true; await client.import(p); assert.equal(client.state.uncertain, true);
    const before = await counts(); actor = other; client.hide(); assert.equal(client.state.view, null); assert.equal(client.state.result, null);
    await client.load(); assert.equal(client.state.uncertain, false); assert.equal(await client.recover(), null); assert.deepEqual(await counts(), before);
  });
  await t.test('format4 fixed-table backup/restore preserves receipts + personal/catalog data; old sessions revoked', async () => {
    const protection = { encryptionKey: randomBytes(40).toString('hex'), authSecret: syntheticSecret }, path = join(rt.root, 'r36-b2-backup');
    const receipts = (await repo.database.pool.query('SELECT to_jsonb(t) AS row FROM stex.catalog_metadata_commands t ORDER BY request_id')).rows;
    const personal = (await repo.database.pool.query('SELECT to_jsonb(t) AS row FROM stex.personal_records t ORDER BY record_key')).rows;
    const catalog = (await repo.database.pool.query('SELECT to_jsonb(t) AS row FROM stex.catalog_records t ORDER BY record_key')).rows;
    await backup(repo.database, repo.files, path, protection);
    const target = await rt.repository('r36_b2_restore'); await restore(target.database, target.files, path, protection);
    assert.deepEqual((await target.database.pool.query('SELECT to_jsonb(t) AS row FROM stex.catalog_metadata_commands t ORDER BY request_id')).rows, receipts);
    assert.deepEqual((await target.database.pool.query('SELECT to_jsonb(t) AS row FROM stex.personal_records t ORDER BY record_key')).rows, personal);
    assert.deepEqual((await target.database.pool.query('SELECT to_jsonb(t) AS row FROM stex.catalog_records t ORDER BY record_key')).rows, catalog);
    assert.equal((await target.database.pool.query('SELECT count(*) FROM public.stex_auth_session')).rows[0].count, '0');
    await assert.rejects(restore(target.database, target.files, path, protection), /leere Zieldatenbank/);
    const restored = new AccountService({ database: target.database, files: target.files, baseURL: base, secret: protection.authSecret, mailKey: randomBytes(40).toString('hex') });
    const restoredAdmin = new SyntheticAccount(restored, admin.name); await restoredAdmin.auth('/sign-in/email', { email: `${admin.name}@example.test`, password: syntheticPassword }); await restoredAdmin.auth('/two-factor/verify-totp', { code: totp(adminURIs.get(admin)!), trustDevice: false });
    const restoredSvc = new CatalogMetadataService(restored); assert.equal((await restoredSvc.status(restoredAdmin.headers(), first!.requestId)).replay, true);
    assert.equal((await restoredSvc.submit(restoredAdmin.headers(), { ...first!, ...metadataContext((await restoredSvc.read(restoredAdmin.headers())).account) })).replay, true);
    const filename = join(path, 'manifest.json'), outer = JSON.parse(await readFile(filename, 'utf8')), decoded = JSON.parse(unseal(outer.sealed, protection.encryptionKey));
    delete decoded.manifest.rows.catalog_metadata_commands; const { sha256, ...content } = decoded.manifest; void sha256; decoded.manifest.sha256 = digest(content); outer.sealed = seal(JSON.stringify(decoded), protection.encryptionKey); await writeFile(filename, JSON.stringify(outer));
    const empty = await rt.repository('r36_b2_missing_receipts'); await assert.rejects(restore(empty.database, empty.files, path, protection), /Sicherungstabellen/);
    assert.equal((await empty.database.pool.query('SELECT count(*) FROM stex.catalog_metadata_commands')).rows[0].count, '0');
    assert.equal(canonical(receipts), canonical((await target.database.pool.query('SELECT to_jsonb(t) AS row FROM stex.catalog_metadata_commands t ORDER BY request_id')).rows));
  });
});
