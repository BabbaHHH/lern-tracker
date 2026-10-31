import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { testRuntime } from '../scripts/data-migration/postgres-test-runtime';
import { SyntheticAccount, syntheticPassword, syntheticPdf } from '../scripts/pdf-a/fixtures';
import { AccountService } from '../src/lib/server/auth/service';
import { CatalogMetadataService } from '../src/lib/server/catalog/metadata-service';
import { CatalogImportService } from '../src/lib/server/catalog/import-service';
import { catalogMetadataHTTP } from '../src/lib/server/catalog/metadata-http';
import { catalogLegacyImportHTTP } from '../src/lib/server/catalog/legacy-import-http';
import { catalogListHTTP } from '../src/lib/server/catalog/http';
import { lockState } from '../src/lib/server/persistence/repository';
import { TOPICS, getLeafTopics } from '../src/lib/topics';
import { ApplyError, CatalogAPI, TARGET, SessionInput, applyMetadata, applyPdfs, canonical, digest, loadPlan, loadState, prepare, preparePdfs, recoverLock, sessionFile, sha256, stableRequestId, type HostGate, type PlanRow, type Profile, type RunOptions, type State } from '../scripts/data-migration/catalog-apply.mts';

function totp(uri: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of new URL(uri).searchParams.get('secret')!.replace(/=+$/, '')) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(v => parseInt(v, 2))), counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', key).update(counter).digest(), offset = mac[mac.length - 1] & 15; return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
const errorCode = (code: string) => (e: unknown) => e instanceof ApplyError && e.code === code;

test('R37 actual apply operator: durable two-phase recovery against real synthetic commits', { timeout: 180000 }, async t => {
  const rt = await testRuntime(); t.after(() => rt.close()); const repo = await rt.repository('r37_apply_operator');
  const base = 'http://localhost:3099', auth = new AccountService({ database: repo.database, files: repo.files, baseURL: base, secret: randomBytes(40).toString('hex'), mailKey: randomBytes(40).toString('hex') });
  const metadata = new CatalogMetadataService(auth), pdf = new CatalogImportService(auth, repo.files);
  const change = (sql: string, args: unknown[] = []) => repo.database.transaction(async c => { await lockState(c); return c.query(sql, args); });
  const admin = new SyntheticAccount(auth, 'r37-apply-admin'), other = new SyntheticAccount(auth, 'r37-apply-other');
  await admin.initialize(); await other.initialize(); await change("INSERT INTO stex.auth_bootstrap(singleton,user_id,expires_at) VALUES(true,$1,now()+interval '1 hour')", [admin.name]);
  const factors = new Map<SyntheticAccount, string>();
  for (const a of [admin, other]) {
    await change('UPDATE stex.auth_bootstrap SET user_id=$1', [a.name]);
    const enabled = await (await a.auth('/two-factor/enable', { password: syntheticPassword, method: 'totp' })).json(); factors.set(a, enabled.totpURI);
    await a.auth('/two-factor/verify-totp', { code: totp(enabled.totpURI), trustDevice: false }); await change("UPDATE stex.accounts SET role='admin' WHERE user_id=$1", [a.name]);
    await a.auth('/sign-in/email', { email: `${a.name}@example.test`, password: syntheticPassword }); await a.auth('/two-factor/verify-totp', { code: totp(enabled.totpURI), trustDevice: false });
  }
  const cookie = (a = admin) => a.headers().get('cookie')!.split('; ').find(c => /better-auth\.session_token=/.test(c))!;
  const session = (a = admin) => new SessionInput({ format: 'stex-catalog-session', version: 1, origin: base, cookie: cookie(a) }, base);
  const counts = async () => (await repo.database.pool.query(`SELECT (SELECT count(*)::int FROM stex.catalog_records) AS records,(SELECT count(*)::int FROM stex.catalog_metadata_commands) AS metadata,(SELECT count(*)::int FROM stex.catalog_document_versions) AS versions,(SELECT count(*)::int FROM stex.catalog_imports) AS imports,(SELECT count(*)::int FROM stex.search_jobs) AS jobs`)).rows[0];
  const calls: string[] = []; let dropMetadata = false, dropPdf = false, expireBeforePost = false;
  const transport = async (request: Request) => {
    const url = new URL(request.url); calls.push(`${request.method} ${url.pathname}${url.search}`);
    if (expireBeforePost && request.method === 'POST' && url.pathname === '/api/catalog/metadata') {
      expireBeforePost = false; const who = await auth.principal(admin.headers(), 'admin');
      await change('UPDATE public.stex_auth_session SET "factorVerifiedAt"=now()-interval \'11 minutes\' WHERE id=$1', [who.sessionId]);
    }
    let response: Response;
    if (url.pathname.startsWith('/api/catalog/metadata')) response = await catalogMetadataHTTP(request, metadata, url.pathname.endsWith('/preview'));
    else if (url.pathname === '/api/catalog/legacy-import') response = await catalogLegacyImportHTTP(request, pdf);
    else response = await catalogListHTTP(request, pdf);
    if (request.method === 'POST' && url.pathname === '/api/catalog/metadata' && dropMetadata && response.ok) { dropMetadata = false; throw Error('synthetic response loss after real metadata commit'); }
    if (request.method === 'POST' && url.pathname === '/api/catalog/legacy-import' && dropPdf && response.ok) { dropPdf = false; throw Error('synthetic response loss after real PDF commit'); }
    return response;
  };
  let fixtureNumber = 0;
  const fixture = async (n = 2) => {
    const name = `fixture-${++fixtureNumber}`, root = join(await realpath(rt.root), name); await mkdir(root, { mode: 0o700 });
    await mkdir(join(root, 'synthetic')); await mkdir(join(root, 'Klausuren_Komplett'));
    const rows: PlanRow[] = [], rawPdfs: Buffer[] = [], topic = getLeafTopics(TOPICS)[0].id;
    for (let i = 0; i < n; i++) {
      const neutral = i % 2 === 0, area = neutral ? 'sr' : 'eur', filename = `synthetic-${i}.pdf`, bytes = syntheticPdf(i + 1); rawPdfs.push(bytes);
      const raw = { id: `${name}-source-${i}`, source: `original-${i}.pdf`, area, type: neutral ? 'SR-Anwaltsklausur' : 'OR-Aktenvortrag', title: `Synthetischer Operatorfall ${name}/${i}`, date: '', topicIds: [topic] };
      const sourceBytes = JSON.stringify(raw); await writeFile(join(root, 'synthetic', `source-${i}.json`), sourceBytes); await writeFile(join(root, 'Klausuren_Komplett', filename), bytes);
      const { type, ...publicFields } = raw; void type; const publicMetadata = { ...publicFields, id: `${name}-target-${i}`, ...(!neutral ? { type: 'Aktenvortrag' } : {}) };
      rows.push({ klausurId: publicMetadata.id, publicMetadata, plannedPublicMetadataSha256: digest(publicMetadata), sourceId: raw.id, typeProjection: neutral ? 'neutral' : 'canonical', pdf: { filename, byteSize: bytes.length, sha256: sha256(bytes), edition: `sha256:${sha256(bytes)}` },
        provenance: { originPath: `synthetic/source-${i}.json`, originFileSha256: sha256(sourceBytes), recordIndex: 0, sourceId: raw.id, source: raw.source, area, rawType: raw.type, topicIds: raw.topicIds } });
    }
    const core = { format: 'stex-r37-final-data-plan-core', version: 1, executionSupported: false, status: 'local-plan-only', planId: `synthetic-${name}-plan`, sourceBindings: { manifest: { sha256: digest('synthetic-manifest') }, idMap: { sha256: digest('synthetic-idmap') } }, records: rows };
    const coreBytes = JSON.stringify(core), coreHash = sha256(coreBytes);
    const records = rows.map(r => ({ ...r.publicMetadata, legacy: { version: 1, planId: core.planId, planSha256: coreHash, manifestSha256: core.sourceBindings.manifest.sha256, idMapSha256: core.sourceBindings.idMap.sha256,
      metadata: { originPath: r.provenance.originPath, originFileSha256: r.provenance.originFileSha256, recordIndex: 0, sourceId: r.sourceId, source: r.provenance.source, area: r.provenance.area, type: r.provenance.rawType }, pdf: r.pdf, typeProjection: r.typeProjection, roleDeclaration: 'user-declared-combined' } }));
    const batches = records.map((r, i) => ({ batch: i + 1, recordCount: 1, requestTemplate: { action: 'legacy-import', contractVersion: 1, records: [r] } }));
    const metaBytes = JSON.stringify({ format: 'stex-r37-metadata-request-templates', version: 1, templateOnly: true, runnable: false, action: 'legacy-import', planSha256: coreHash, planId: core.planId, batches });
    const pdfBytes = JSON.stringify({ format: 'stex-r37-pdf-import-command-templates', version: 1, templateOnly: true, runnable: false, bindAfterMetadataCommit: true, planId: core.planId, planSha256: coreHash, commands: rows.map(r => ({ contractVersion: 1, klausurId: r.klausurId, planId: core.planId, planSha256: coreHash, source: { ...r.pdf, role: 'kombiniert' } })) });
    const files = { core: join(root, 'core.json'), metadata: join(root, 'metadata.json'), pdf: join(root, 'pdf.json') }; await writeFile(files.core, coreBytes); await writeFile(files.metadata, metaBytes); await writeFile(files.pdf, pdfBytes);
    const profile: Profile = { origin: base, target: TARGET, records: n, batchSizes: Array.from({ length: n }, () => 1), hashes: { core: coreHash, metadata: sha256(metaBytes), pdf: sha256(pdfBytes) }, operatorSha256: sha256(await readFile(resolve('scripts/data-migration/catalog-apply.mts'))) };
    const dir = join(root, 'state'); const initial = await prepare(dir, files, profile);
    const gate = (phase: 'metadata' | 'pdf', state: State = initial): HostGate => ({ format: 'stex-r37-catalog-apply-gate', version: 1, phase, origin: base, target: TARGET, coreSha256: coreHash, operatorSha256: profile.operatorSha256, releaseManifestSha256: digest('synthetic-release'), sourcePackageSha256: digest('synthetic-package'), backupManifestSha256: digest('synthetic-backup'), backupCapturedAt: new Date(Date.now() - 3000).toISOString(), restoreVerifiedAt: new Date(Date.now() - 2000).toISOString(), restoreReference: 'synthetic-verified-restore', targetSnapshotSha256: digest('synthetic-target'), targetSnapshotReference: 'synthetic-current-target', issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), metadataReceiptsSha256: phase === 'pdf' ? state.metadataReceiptsSha256 : null, pdfBindingsSha256: phase === 'pdf' ? state.pdfBindingsSha256 : null });
    const options = (phase: 'metadata' | 'pdf', state = initial): RunOptions => ({ dir, profile, session: session(), sourceRoot: root, gate: gate(phase, state), maxSteps: n, transport });
    return { dir, root, rows, rawPdfs, profile, files, initial, gate, options };
  };

  const selected = process.env.STEX_R37_APPLY_CASE;
  const runCase = (name: string, work: () => Promise<void>) => t.test(name, { skip: !!selected && !name.includes(selected) }, work);
  await runCase('metadata response lost after actual commit resumes through receipt and never repeats that POST', async () => {
    const f = await fixture(), before = await counts(); dropMetadata = true; calls.length = 0;
    await assert.rejects(applyMetadata(f.options('metadata')), errorCode('response_unknown'));
    const unknown = (await loadState(f.dir, f.profile)).state; assert.equal(unknown.metadata[0].status, 'pending'); assert.equal((await counts()).metadata, before.metadata + 1);
    const lostPostCount = calls.filter(c => c === 'POST /api/catalog/metadata?legacy=1').length; assert.equal(lostPostCount, 1);
    calls.length = 0; const resumed = await applyMetadata(f.options('metadata')); assert.ok(resumed.metadata.every(i => i.status === 'done'));
    assert.equal(calls.filter(c => c === 'POST /api/catalog/metadata?legacy=1').length, 1); // only the second batch
    assert.ok(calls.includes(`GET /api/catalog/metadata?requestId=${unknown.metadata[0].requestId}`));
    const after = await counts(); assert.equal(after.records, before.records + 2); assert.equal(after.metadata, before.metadata + 2);
    const saved = await readFile(join(f.dir, 'checkpoint.json'), 'utf8'), ctx = (await metadata.read(admin.headers())).account;
    assert.ok(!saved.includes(cookie()) && !saved.includes(ctx.sessionContext) && !saved.includes('session_token') && !saved.includes('expectedSessionContext'));
    assert.equal((await stat(f.dir)).mode & 0o777, 0o700); assert.equal((await stat(join(f.dir, 'checkpoint.json'))).mode & 0o777, 0o600);
    assert.equal(new Set([...resumed.metadata, ...resumed.pdf].map(i => i.requestId)).size, 4);
  });
  await runCase('second phase requires all metadata receipts and fresh actual full payload hashes; PDF response loss is write-free on recovery', async () => {
    const f = await fixture(), options = f.options('metadata');
    await assert.rejects(preparePdfs(f.dir, f.profile, session(), transport), errorCode('metadata_phase_incomplete'));
    await applyMetadata({ ...options, maxSteps: 1 }); await assert.rejects(preparePdfs(f.dir, f.profile, session(), transport), errorCode('metadata_phase_incomplete'));
    await applyMetadata(options); const bound = await preparePdfs(f.dir, f.profile, session(), transport); assert.ok(bound.pdfBindings);
    const target = (await pdf.list(admin.headers())).find(r => r.id === f.rows[0].klausurId)!;
    assert.equal(bound.pdfBindings[0].expectedMetadataSha256, digest(target.metadata)); assert.notEqual(bound.pdfBindings[0].expectedMetadataSha256, f.rows[0].plannedPublicMetadataSha256);
    const before = await counts(); dropPdf = true; calls.length = 0;
    await assert.rejects(applyPdfs(f.options('pdf', bound)), errorCode('response_unknown')); assert.equal((await counts()).versions, before.versions + 1);
    const pending = (await loadState(f.dir, f.profile)).state; assert.equal(pending.pdf[0].status, 'pending');
    calls.length = 0; const resumed = await applyPdfs(f.options('pdf', bound)); assert.ok(resumed.pdf.every(i => i.status === 'done'));
    assert.equal(calls.filter(c => c === 'POST /api/catalog/legacy-import').length, 1); assert.equal((await counts()).versions, before.versions + 2); assert.equal((await counts()).jobs, before.jobs + 2);
    const finalBefore = await counts(); calls.length = 0; await applyPdfs(f.options('pdf', bound)); assert.deepEqual(await counts(), finalBefore); assert.ok(calls.every(c => c.startsWith('GET ')));
    await change("INSERT INTO stex.catalog_documents(document_id,record_key,klausur_id,role,source_reference,created_by_user_id) SELECT 'synthetic-later-role',record_key,id,'loesung','synthetic-later-source',$2 FROM stex.catalog_records WHERE id=$1", [f.rows[0].klausurId, admin.name]);
    calls.length = 0; await assert.rejects(applyPdfs(f.options('pdf', bound)), errorCode('unexpected_document_state')); assert.ok(calls.every(c => c.startsWith('GET ')));
  });
  await runCase('source JSON/PDF tampering and core/template or physical target mismatch stop before further writes', async () => {
    const f = await fixture(1), before = await counts(); const badGate = f.options('metadata'); badGate.gate = { ...f.gate('metadata'), target: { ...TARGET, database: 'wrong-target' } };
    await assert.rejects(applyMetadata(badGate), errorCode('host_gate_mismatch')); assert.deepEqual(await counts(), before);
    await writeFile(join(f.root, 'synthetic/source-0.json'), '{}'); await assert.rejects(applyMetadata(f.options('metadata')), errorCode('source_json_hash_mismatch')); assert.deepEqual(await counts(), before);
    await writeFile(f.files.pdf, '{}'); await assert.rejects(loadPlan(f.files, f.profile), errorCode('artifact_hash_mismatch'));
    const g = await fixture(1); await applyMetadata(g.options('metadata')); const bound = await preparePdfs(g.dir, g.profile, session(), transport), beforePdf = await counts();
    await writeFile(join(g.root, 'Klausuren_Komplett', g.rows[0].pdf.filename), syntheticPdf(3)); await assert.rejects(applyPdfs(g.options('pdf', bound)), errorCode('source_pdf_hash_mismatch')); assert.deepEqual(await counts(), beforePdf);
  });
  await runCase('revision/full payload changes and additional document versions cannot be hidden by public DTO equality', async () => {
    const f = await fixture(1); await applyMetadata(f.options('metadata')); const bound = await preparePdfs(f.dir, f.profile, session(), transport), before = await counts();
    await change("UPDATE stex.catalog_records SET payload=payload||'{\"technicalExtension\":\"synthetic-changed\"}'::jsonb WHERE id=$1", [f.rows[0].klausurId]);
    await assert.rejects(applyPdfs(f.options('pdf', bound)), errorCode('target_revision_or_payload_changed')); assert.deepEqual(await counts(), before);
    const g = await fixture(1); await applyMetadata(g.options('metadata')); const b = await preparePdfs(g.dir, g.profile, session(), transport); await applyPdfs(g.options('pdf', b));
    // A second fresh checkpoint/binding is forbidden; no automatic version advancement.
    await assert.rejects(preparePdfs(g.dir, g.profile, session(), transport), errorCode('pdf_bindings_already_exist'));
    const h = await fixture(1); await applyMetadata(h.options('metadata'));
    const alteredDTO = async (req: Request) => { const response = await transport(req); if (new URL(req.url).pathname !== '/api/catalog/klausuren') return response; const value = await response.json(); for (const r of value.klausuren) { delete r.metadata.createdAt; delete r.metadata.updatedAt; } return Response.json(value); };
    await assert.rejects(preparePdfs(h.dir, h.profile, session(), alteredDTO), errorCode('full_target_payload_required'));
    const extra = await fixture(1); await applyMetadata(extra.options('metadata')); const binding = await preparePdfs(extra.dir, extra.profile, session(), transport);
    await change("INSERT INTO stex.catalog_documents(document_id,record_key,klausur_id,role,source_reference,created_by_user_id) SELECT 'synthetic-additional-role',record_key,id,'sachverhalt','synthetic-other-source',$2 FROM stex.catalog_records WHERE id=$1", [extra.rows[0].klausurId, admin.name]);
    await assert.rejects(applyPdfs(extra.options('pdf', binding)), errorCode('unexpected_document_state'));
  });
  await runCase('fresh TOTP failure after preparation leaves a pending request; renewed real session recovers using status first', async () => {
    const f = await fixture(1), before = await counts(); expireBeforePost = true;
    await assert.rejects(applyMetadata(f.options('metadata')), errorCode('http_401')); assert.deepEqual(await counts(), before);
    assert.equal((await loadState(f.dir, f.profile)).state.metadata[0].status, 'pending');
    await assert.rejects(applyMetadata(f.options('metadata')), errorCode('fresh_admin_required_401')); assert.deepEqual(await counts(), before);
    await admin.auth('/sign-in/email', { email: `${admin.name}@example.test`, password: syntheticPassword }); await admin.auth('/two-factor/verify-totp', { code: totp(factors.get(admin)!), trustDevice: false });
    calls.length = 0; const done = await applyMetadata(f.options('metadata')); assert.equal(done.metadata[0].status, 'done');
    const statusIndex = calls.findIndex(c => c === `GET /api/catalog/metadata?requestId=${done.metadata[0].requestId}`), postIndex = calls.findIndex(c => c === 'POST /api/catalog/metadata?legacy=1'); assert.ok(statusIndex >= 0 && statusIndex < postIndex);
  });
  await runCase('session revocation/expiry and different admin cannot continue another owner checkpoint', async () => {
    const f = await fixture(1); await applyMetadata(f.options('metadata')); const before = await counts();
    await assert.rejects(preparePdfs(f.dir, f.profile, session(other), transport), errorCode('owner_changed'));
    const who = await auth.principal(admin.headers(), 'admin');
    await change('UPDATE public.stex_auth_session SET "expiresAt"=now()-interval \'1 minute\' WHERE id=$1', [who.sessionId]);
    await assert.rejects(preparePdfs(f.dir, f.profile, session(), transport), errorCode('http_401')); assert.deepEqual(await counts(), before);
    await admin.auth('/sign-in/email', { email: `${admin.name}@example.test`, password: syntheticPassword }); await admin.auth('/two-factor/verify-totp', { code: totp(factors.get(admin)!), trustDevice: false });
    const second = await auth.principal(admin.headers(), 'admin'); await change('UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1', [admin.name]);
    await assert.rejects(preparePdfs(f.dir, f.profile, session(), transport), errorCode('http_401'));
    // Test-only restore of the generation; no product operator has such a path.
    await change('UPDATE stex.account_access SET generation=$2 WHERE user_id=$1', [admin.name, second.generation]);
  });
  await runCase('protected cookie input, symlinks, redirect/foreign origin and concurrent operator lock are fail-closed', async () => {
    const f = await fixture(1), credential = join(f.root, 'session.json'); await writeFile(credential, JSON.stringify({ format: 'stex-catalog-session', version: 1, origin: base, cookie: cookie() }), { mode: 0o600 });
    const input = await sessionFile(credential, base); assert.equal(JSON.stringify(input), '{}'); input.clear();
    await chmod(credential, 0o644); await assert.rejects(sessionFile(credential, base), errorCode('private_file_required')); await chmod(credential, 0o600);
    const linked = join(f.root, 'linked-session.json'); await symlink(credential, linked); await assert.rejects(sessionFile(linked, base), errorCode('symlink_denied'));
    assert.throws(() => new SessionInput({ format: 'stex-catalog-session', version: 1, origin: 'https://foreign.example', cookie: cookie() }, base), errorCode('invalid_session_input'));
    const api = new CatalogAPI(base, session(), async () => Response.redirect('https://foreign.example', 307)); await assert.rejects(api.call('/api/catalog/metadata'), errorCode('redirect_or_response_denied')); await assert.rejects(api.call('https://foreign.example/api/catalog/metadata'), errorCode('origin_or_route_denied'));
    await writeFile(join(f.dir, 'operator.lock'), JSON.stringify({ pid: process.pid, host: 'synthetic' }), { mode: 0o600 }); await assert.rejects(applyMetadata(f.options('metadata')), errorCode('operator_locked'));
    assert.deepEqual((await readdir(f.dir)).sort(), ['checkpoint.json', 'operator.lock']);
  });
});

test('R37 operator request identities: exactly five metadata UUIDs and 449 distinct PDF UUIDs', () => {
  const core = digest('synthetic-fixed-core'), ids = [...Array.from({ length: 5 }, (_, i) => stableRequestId(core, 'metadata', i)), ...Array.from({ length: 449 }, (_, i) => stableRequestId(core, 'pdf', i))];
  assert.equal(ids.length, 454); assert.equal(new Set(ids).size, 454); assert.equal(ids[0], stableRequestId(core, 'metadata', 0)); assert.notEqual(ids[0], stableRequestId(digest('changed'), 'metadata', 0)); assert.equal(canonical({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test('R37 operator crash lock: only a bound dead local process lock may be removed', async t => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'r37-apply-lock-')); t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'operator.lock');
  let bytes = JSON.stringify({ pid: process.pid, host: hostname() }); await writeFile(path, bytes, { mode: 0o600 });
  await assert.rejects(recoverLock(root, sha256(bytes)), errorCode('lock_process_alive'));
  bytes = JSON.stringify({ pid: 2147483647, host: 'synthetic-foreign-host' }); await writeFile(path, bytes);
  await assert.rejects(recoverLock(root, sha256(bytes)), errorCode('lock_host_mismatch'));
  bytes = JSON.stringify({ pid: 2147483647, host: hostname() }); await writeFile(path, bytes);
  await assert.rejects(recoverLock(root, digest('changed-lock')), errorCode('lock_changed'));
  await recoverLock(root, sha256(bytes)); assert.deepEqual(await readdir(root), []);
});
