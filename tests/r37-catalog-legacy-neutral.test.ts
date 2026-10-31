import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { testRuntime } from '../scripts/data-migration/postgres-test-runtime';
import { SyntheticAccount, syntheticPassword, syntheticPdf } from '../scripts/pdf-a/fixtures';
import { AccountService } from '../src/lib/server/auth/service';
import { CatalogMetadataService } from '../src/lib/server/catalog/metadata-service';
import { catalogMetadataHTTP } from '../src/lib/server/catalog/metadata-http';
import { catalogLegacyImportHTTP } from '../src/lib/server/catalog/legacy-import-http';
import { catalogImportHTTP } from '../src/lib/server/catalog/http';
import { CatalogImportService, validateCatalogMetadata, validateLegacyCatalogMetadata } from '../src/lib/server/catalog/import-service';
import { metadataContext, type LegacyMetadataFields, type MetadataCommand } from '../src/lib/catalog/metadata-contract';
import { CatalogMetadataClient } from '../src/lib/catalog/metadata-client';
import type { LegacyImportCommand } from '../src/lib/catalog/legacy-import-contract';
import { digest } from '../src/lib/data-migration/migration';
import { fileHash } from '../src/lib/server/persistence/files';
import { lockState } from '../src/lib/server/persistence/repository';
import { getLeafTopics, TOPICS } from '../src/lib/topics';
import { KlausurenView, catalogReadAreas, type KlausurenAccountAdapter } from '../src/components/klausuren-view';
import { parsePublicCatalogJSON } from '../src/lib/catalog/use-account-catalog';
import type { CatalogKlausur } from '../src/lib/types';

function totp(uri: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of new URL(uri).searchParams.get('secret')!.replace(/=+$/, '')) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(v => parseInt(v, 2))), counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', key).update(counter).digest(), offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

test('R37 neutral legacy delta: seven original values, explicit provenance and strict boundaries', { timeout: 180000 }, async t => {
  const rt = await testRuntime(); t.after(() => rt.close());
  const repo = await rt.repository('r37_legacy_neutral');
  const base = 'http://localhost:3098';
  const auth = new AccountService({ database: repo.database, files: repo.files, baseURL: base, secret: randomBytes(40).toString('hex'), mailKey: randomBytes(40).toString('hex') });
  const metadata = new CatalogMetadataService(auth), pdfService = new CatalogImportService(auth, repo.files);
  const change = (sql: string, args: unknown[] = []) => repo.database.transaction(async c => { await lockState(c); return c.query(sql, args); });
  const admin = new SyntheticAccount(auth, 'r37-neutral-admin'), member = new SyntheticAccount(auth, 'r37-neutral-member');
  await admin.initialize(); await member.initialize();
  await change("INSERT INTO stex.auth_bootstrap(singleton,user_id,expires_at) VALUES(true,$1,now()+interval '1 hour')", [admin.name]);
  const factor = await (await admin.auth('/two-factor/enable', { password: syntheticPassword, method: 'totp' })).json();
  await admin.auth('/two-factor/verify-totp', { code: totp(factor.totpURI), trustDevice: false });
  await change("UPDATE stex.accounts SET role='admin' WHERE user_id=$1", [admin.name]);
  await admin.auth('/sign-in/email', { email: `${admin.name}@example.test`, password: syntheticPassword });
  await admin.auth('/two-factor/verify-totp', { code: totp(factor.totpURI), trustDevice: false });
  const bytes = syntheticPdf(2), topic = getLeafTopics(TOPICS)[0].id;
  const sources = [
    ['sr', 'SR-Angestelltenklausur'], ['sr', 'SR-Anwaltsklausur'], ['sr', 'SR-Anwaltsklausur'], ['sr', 'SR-Anwaltsklausur'],
    ['eur', 'OR-Aktenvortrag'], ['eur', 'OR-Aktenvortrag'], ['steuer', 'OR-Aktenvortrag'],
  ] as const;
  const rows: LegacyMetadataFields[] = sources.map(([area, type], i) => ({
    id: `synthetic-legacy-${i}`, source: `synthetic-source-${i}.pdf`, date: '', title: `Synthetischer Altfall ${i}`, area, ...(i >= 4 ? { type: 'Aktenvortrag' as const } : {}), topicIds: [topic],
    legacy: { version: 1, planId: 'synthetic-neutral-plan', planSha256: digest('synthetic-neutral-plan'), manifestSha256: digest('synthetic-manifest'), idMapSha256: digest('synthetic-idmap'),
      metadata: { originPath: `synthetic/source-${i}.json`, originFileSha256: digest(`synthetic-json-${i}`), recordIndex: i, sourceId: `synthetic-original-${i}`, source: `synthetic-source-${i}.pdf`, area, type },
      pdf: { filename: `synthetic-combined-${i}.pdf`, sha256: fileHash(bytes), byteSize: bytes.length, edition: 'synthetic-v1' }, typeProjection: i < 4 ? 'neutral' : 'canonical', roleDeclaration: 'user-declared-combined' },
  }));
  const headers = (who = admin, extra: Record<string, string> = {}) => { const h = who.headers(); h.set('origin', base); h.set('x-stex-action', '1'); Object.entries(extra).forEach(([k, v]) => h.set(k, v)); return h; };
  const request = (body: unknown, preview = false, legacy = true, who = admin) => {
    const h = headers(who); h.set('content-type', 'application/json');
    return catalogMetadataHTTP(new Request(`${base}/api/catalog/metadata${preview ? '/preview' : ''}${legacy ? '?legacy=1' : ''}`, { method: 'POST', headers: h, body: JSON.stringify(body) }), metadata, preview);
  };
  const prepare = async (records: LegacyMetadataFields[]): Promise<MetadataCommand> => {
    const view = await metadata.read(admin.headers());
    const response = await request({ ...metadataContext(view.account), action: 'legacy-import', records }, true);
    assert.equal(response.status, 200, await response.clone().text()); const p = await response.json();
    return { ...metadataContext(p.account), requestId: randomUUID(), action: 'legacy-import', snapshot: p.snapshot, records: p.records };
  };
  const payload = async (id: string) => (await repo.database.pool.query('SELECT revision,payload FROM stex.catalog_records WHERE id=$1', [id])).rows[0];
  const counts = async () => (await repo.database.pool.query(`SELECT (SELECT count(*)::int FROM stex.catalog_records) AS records,(SELECT count(*)::int FROM stex.catalog_metadata_commands) AS receipts,(SELECT count(*)::int FROM stex.catalog_document_versions) AS versions,(SELECT count(*)::int FROM stex.search_jobs) AS jobs,(SELECT generation FROM stex.state) AS generation`)).rows[0];
  const pdfCommand = async (r: LegacyMetadataFields): Promise<LegacyImportCommand> => {
    const p = await payload(r.id);
    return { contractVersion: 1, requestId: randomUUID(), planId: r.legacy.planId, planSha256: r.legacy.planSha256, klausurId: r.id, expectedMetadataRevision: Number(p.revision), expectedMetadataSha256: digest(p.payload), expectedDocuments: [], source: { role: 'kombiniert', ...r.legacy.pdf } };
  };
  const upload = (c: LegacyImportCommand) => { const form = new FormData(); form.set('command', JSON.stringify(c)); form.set('kombiniert', new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }), c.source.filename); return catalogLegacyImportHTTP(new Request(`${base}/api/catalog/legacy-import`, { method: 'POST', headers: headers(), body: form }), pdfService); };
  let firstCommand: MetadataCommand;
  for (const [i, r] of rows.entries()) await t.test(`source ${i + 1}: ${r.area}/${r.legacy.metadata.type} is preserved without guessed classification`, async () => {
    const command = await prepare([r]); if (i === 0) firstCommand = command;
    const response = await request(command); assert.equal(response.status, 200, await response.clone().text()); assert.equal((await response.json()).status, 'committed');
    const p = await payload(r.id); assert.equal(p.payload.area, r.area); assert.deepEqual(p.payload.legacy, r.legacy); assert.equal(Object.hasOwn(p.payload, 'type'), i >= 4);
    if (i < 4) assert.equal(p.payload.type, undefined); else assert.equal(p.payload.type, 'Aktenvortrag');
    const read = await metadata.read(admin.headers(), r.id); assert.deepEqual(read.entry!.metadata, r);
  });
  await t.test('all seven attach their declared combined file only after metadata creation and exact plan binding', async () => {
    const before = await counts();
    for (const r of rows) { const c = await pdfCommand(r), response = await upload(c); assert.equal(response.status, 201, await response.clone().text()); const summary = (await response.json()).import; assert.equal(summary.klausurId, r.id); assert.equal(summary.documents.length, 1); assert.equal(summary.documents[0].role, 'kombiniert'); }
    const after = await counts(); assert.equal(after.versions, before.versions + 7); assert.equal(after.jobs, before.jobs + 7); assert.equal(after.records, before.records);
    const receipt = (await repo.database.pool.query('SELECT metadata FROM stex.catalog_imports ORDER BY created_at LIMIT 1')).rows[0].metadata; assert.deepEqual(receipt.legacyMetadata, rows[0].legacy);
    const absent = await pdfCommand(rows[0]); absent.klausurId = 'synthetic-absent'; assert.equal((await upload(absent)).status, 409);
  });
  await t.test('metadata replay is write-free and changed raw provenance/plan stays conflicting', async () => {
    const before = await counts(), replay = await request(firstCommand); assert.equal(replay.status, 200); assert.equal((await replay.json()).replay, true); assert.deepEqual(await counts(), before);
    const changed = structuredClone(firstCommand); assert.ok(changed.action === 'legacy-import'); changed.records[0].legacy.metadata.originFileSha256 = digest('changed'); assert.equal((await request(changed)).status, 409); assert.deepEqual(await counts(), before);
    const fresh = await prepare([{ ...rows[0], legacy: { ...rows[0].legacy, planSha256: digest('changed-plan') } }]);
    const conflict = await request(fresh); assert.equal((await conflict.json()).status, 'conflict'); assert.deepEqual((await payload(rows[0].id)).payload.legacy, rows[0].legacy);
  });
  await t.test('legacy PDF cannot use an unrelated plan, edition, source hash or revision', async () => {
    const c = await pdfCommand(rows[0]), before = await counts();
    for (const bad of [{ ...c, planId: 'unrelated-plan' }, { ...c, planSha256: digest('unrelated-plan') }, { ...c, source: { ...c.source, edition: 'synthetic-v2' } }, { ...c, expectedMetadataRevision: 99 }]) assert.equal((await upload(bad)).status, 409);
    assert.deepEqual(await counts(), before);
  });
  await t.test('normal JSON/two-document boundaries reject legacy claims and raw areas/types; unbound missing type stays blocked in combined legacy entry', async () => {
    for (const r of rows) {
      assert.throws(() => validateCatalogMetadata(r)); assert.throws(() => parsePublicCatalogJSON(JSON.stringify(r)));
      const { legacy, ...ordinary } = r; void legacy;
      if (r.area === 'eur' || r.area === 'steuer') assert.throws(() => validateCatalogMetadata(ordinary));
      const view = await metadata.read(admin.headers()); assert.equal((await request({ ...metadataContext(view.account), records: [r] }, true, false)).status, 422);
      const f = new FormData(); f.set('requestId', randomUUID()); f.set('metadata', JSON.stringify(r)); f.set('sachverhalt', new Blob([Uint8Array.from(bytes)]), 's.pdf'); f.set('loesung', new Blob([Uint8Array.from(bytes)]), 'l.pdf');
      assert.equal((await catalogImportHTTP(new Request(`${base}/api/catalog/import`, { method: 'POST', headers: headers(), body: f }), pdfService)).status, 422);
      assert.throws(() => validateCatalogMetadata({ ...ordinary, type: r.legacy.metadata.type }));
    }
    const normal = { id: 'synthetic-unbound-neutral', source: 'synthetic.pdf', date: '', title: 'Synthetischer ungeklärter Fall', area: 'sr', topicIds: [topic] };
    const view = await metadata.read(admin.headers()), p = await metadata.preview(admin.headers(), { ...metadataContext(view.account), records: [normal] });
    await metadata.submit(admin.headers(), { ...metadataContext(p.account), requestId: randomUUID(), action: 'import', records: p.records, snapshot: p.snapshot });
    const c = await pdfCommand({ ...rows[0], id: normal.id }); assert.equal((await upload(c)).status, 409);
  });
  await t.test('neutral provenance cannot be stripped, guessed, made absolute or used to relabel eur as oeffr', async () => {
    assert.throws(() => validateLegacyCatalogMetadata({ ...rows[0], type: 'Anklageklausur' }));
    assert.throws(() => validateLegacyCatalogMetadata({ ...rows[0], legacy: { ...rows[0].legacy, metadata: { ...rows[0].legacy.metadata, type: 'Invented-type' } } }));
    assert.throws(() => validateLegacyCatalogMetadata({ ...rows[4], area: 'oeffr' }));
    assert.throws(() => validateLegacyCatalogMetadata({ ...rows[0], legacy: { ...rows[0].legacy, metadata: { ...rows[0].legacy.metadata, originPath: '/synthetic/source.json' } } }));
    assert.throws(() => validateLegacyCatalogMetadata({ ...rows[0], legacy: { ...rows[0].legacy, roleDeclaration: 'content-verified' } }));
    const entry = (await metadata.read(admin.headers(), rows[0].id)).entry!, view = await metadata.read(admin.headers());
    const response = await request({ ...metadataContext(view.account), action: 'patch', requestId: randomUUID(), id: entry.id, expectedRevision: entry.revision, expectedSnapshot: entry.snapshot, fields: { type: 'Anklageklausur' } }, false, false); assert.equal(response.status, 409);
    assert.deepEqual((await payload(rows[0].id)).payload.legacy, rows[0].legacy);
  });
  await t.test('original catalog markup shows the seven rows and separate neutral area filters without creating writing categories', async () => {
    const list = await pdfService.list(member.headers()); const exams: CatalogKlausur[] = list.filter(v => rows.some(r => r.id === v.id)).map(r => ({ ...r.metadata, createdAt: '', updatedAt: '' }));
    const adapter: KlausurenAccountAdapter = { klausuren: exams, trackingEntries: [], admin: false, busy: false, statusPanel: 'synthetic catalog confirmed', uploadPanel: null, importPanel: null, pdfLinks: () => null, edit: async () => null, save: async () => false, remove: async () => false, previewImport: async () => {}, jsonChanged: () => {}, done: async () => false, plan: async () => false, write: async () => {}, boosts: () => [] };
    const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch: async () => {} } as unknown as AppRouterInstance;
    const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(KlausurenView, { account: adapter })));
    for (const r of rows) assert.ok(html.includes(r.id) && html.includes(r.title));
    assert.match(html, />Europarecht<\/button>/); assert.match(html, />Steuerrecht<\/button>/); assert.match(html, /bg-slate-100 text-slate-700/);
    assert.doesNotMatch(html, /SR-Angestelltenklausur|SR-Anwaltsklausur/); assert.match(html, /lg:grid-cols-\[1fr_240px\]/);
    assert.deepEqual(catalogReadAreas(exams), ['zr', 'oeffr', 'sr', 'eur', 'steuer']); assert.deepEqual(catalogReadAreas([]), ['zr', 'oeffr', 'sr']);
    assert.equal(exams.filter(k => k.area === 'eur').length, 2); assert.equal(exams.filter(k => k.area === 'steuer').length, 1); assert.equal(exams.filter(k => k.area === 'oeffr').length, 0);
  });
  await t.test('existing client carries legacy mode through preview/import and receipt recovery using the real handler', async () => {
    const record = { ...rows[0], id: 'synthetic-client-neutral' }; let drop = true;
    const client = new CatalogMetadataClient(async (url, init) => {
      const h = headers(); new Headers(init?.headers).forEach((v, k) => h.set(k, v));
      const response = await catalogMetadataHTTP(new Request(`${base}${url}`, { ...init, headers: h }), metadata, String(url).includes('/preview'));
      if (drop && init?.method === 'POST' && !String(url).includes('/preview')) { drop = false; throw Error('synthetic response loss after actual commit'); }
      return response;
    });
    await client.load(); const preview = await client.preview([record], client.state.view!.account, true); assert.ok(preview); assert.equal(preview.action, 'legacy-import');
    assert.equal(await client.import(preview), null); assert.equal(client.state.uncertain, true);
    const before = await counts(), recovered = await client.recover(); assert.equal(recovered?.status, 'committed'); assert.equal(recovered?.action, 'legacy-import'); assert.equal(recovered?.replay, true); assert.deepEqual(await counts(), before);
  });
  await t.test('fresh admin/origin/context checks protect new metadata mode and commit rechecks a demotion', async () => {
    const r = { ...rows[0], id: 'synthetic-auth-neutral' }, command = await prepare([r]);
    assert.equal((await request(command, false, true, member)).status, 403);
    let consumed = false; const who = await auth.principal(admin.headers(), 'admin');
    await change('UPDATE public.stex_auth_session SET "factorVerifiedAt"=now()-interval \'11 minutes\' WHERE id=$1', [who.sessionId]);
    const denied = await catalogMetadataHTTP(new Request(`${base}/api/catalog/metadata?legacy=1`, { method: 'POST', headers: headers(), body: new ReadableStream<Uint8Array>({ pull(controller) { consumed = true; controller.close(); } }, { highWaterMark: 0 }), duplex: 'half' } as RequestInit), metadata);
    assert.equal(denied.status, 401); assert.equal(consumed, false);
    await change('UPDATE public.stex_auth_session SET "factorVerifiedAt"=now() WHERE id=$1', [who.sessionId]);
    const before = await counts(); const service = new CatalogMetadataService(auth, { beforeTransaction: async () => { await change("UPDATE stex.accounts SET role='member' WHERE user_id=$1", [admin.name]); } });
    try { await assert.rejects(service.submit(admin.headers(), command, true), (e: unknown) => (e as { status: number }).status === 403); }
    finally { await change("UPDATE stex.accounts SET role='admin' WHERE user_id=$1", [admin.name]); }
    assert.deepEqual(await counts(), before);
    const h = headers(admin, { origin: 'https://outside.example.test', 'content-type': 'application/json' });
    assert.equal((await catalogMetadataHTTP(new Request(`${base}/api/catalog/metadata?legacy=1`, { method: 'POST', headers: h, body: JSON.stringify(command) }), metadata)).status, 403);
    assert.equal((await request({ ...command, expectedSessionContext: digest('wrong-session') })).status, 409);
  });
});

test('R37 neutral policy: unknown source types cannot be relabelled as canonical by changing the projection flag', () => {
  for (const rawType of ['SR-Angestelltenklausur', 'SR-Anwaltsklausur']) {
    const value: LegacyMetadataFields = {
      id: 'synthetic-neutral-policy', source: 'synthetic.pdf', title: 'Synthetische Typgrenze', date: '', area: 'sr', topicIds: [getLeafTopics(TOPICS)[0].id],
      legacy: { version: 1, planId: 'synthetic-plan', planSha256: digest('plan'), manifestSha256: digest('manifest'), idMapSha256: digest('idmap'),
        metadata: { originPath: 'synthetic/source.json', originFileSha256: digest('source'), recordIndex: 0, sourceId: 'synthetic-source', source: 'synthetic.pdf', area: 'sr', type: rawType },
        pdf: { filename: 'synthetic-combined.pdf', sha256: digest('synthetic-bytes'), byteSize: 100, edition: 'synthetic-v1' }, typeProjection: 'neutral', roleDeclaration: 'user-declared-combined' },
    };
    assert.equal(Object.hasOwn(validateLegacyCatalogMetadata(value), 'type'), false);
    assert.throws(() => validateLegacyCatalogMetadata({ ...value, type: 'Anklageklausur', legacy: { ...value.legacy, typeProjection: 'canonical' } }), /nicht als kanonischer Typ/);
  }
});
