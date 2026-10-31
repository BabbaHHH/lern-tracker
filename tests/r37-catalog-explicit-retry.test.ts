import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
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
import { TOPICS, getLeafTopics } from '../src/lib/topics';
import { ApplyError, TARGET, SessionInput, applyMetadata, applyPdfs, digest, firstRetryRequestId, loadState, prepare, preparePdfs, retryFirstPdf, sha256, type HostGate, type PlanRow, type Profile, type State } from '../scripts/data-migration/catalog-apply.mts';

const code = (expected: string) => (error: unknown) => error instanceof ApplyError && error.code === expected;
function totp(uri: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of new URL(uri).searchParams.get('secret')!.replace(/=+$/, '')) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(v => parseInt(v, 2))), counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', key).update(counter).digest(), offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

for (const loseResponse of [true, false]) test(`R37 explicit child attempt: ${loseResponse ? 'lost' : 'delivered'} response, real schema18/auth/HTTP and preserved history`, { timeout: 180000 }, async t => {
  const rt = await testRuntime(); t.after(async () => { await rt.close(); });
  const repo = await rt.repository('r37_explicit_retry');
  assert.equal((await repo.database.pool.query('SELECT count(*)::int AS n FROM stex.schema_migrations')).rows[0].n, 18);
  const base = 'http://localhost:3099';
  const auth = new AccountService({ database: repo.database, files: repo.files, baseURL: base, secret: randomBytes(40).toString('hex'), mailKey: randomBytes(40).toString('hex') });
  const metadata = new CatalogMetadataService(auth), service = new CatalogImportService(auth, repo.files), admin = new SyntheticAccount(auth, 'synthetic-retry-admin');
  await admin.initialize();
  await repo.database.pool.query("INSERT INTO stex.auth_bootstrap(singleton,user_id,expires_at) VALUES(true,$1,now()+interval '1 hour')", [admin.name]);
  const enabled = await (await admin.auth('/two-factor/enable', { password: syntheticPassword, method: 'totp' })).json();
  await admin.auth('/two-factor/verify-totp', { code: totp(enabled.totpURI), trustDevice: false });
  await repo.database.pool.query("UPDATE stex.accounts SET role='admin' WHERE user_id=$1", [admin.name]);
  await admin.auth('/sign-in/email', { email: `${admin.name}@example.test`, password: syntheticPassword });
  await admin.auth('/two-factor/verify-totp', { code: totp(enabled.totpURI), trustDevice: false });
  const cookie = admin.headers().get('cookie')!.split('; ').find(c => /better-auth\.session_token=/.test(c))!;
  const session = () => new SessionInput({ format: 'stex-catalog-session', version: 1, origin: base, cookie }, base);
  let drop = false, postCount = 0, hold: (() => Promise<void>) | undefined;
  const transport = async (request: Request) => {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/catalog/legacy-import') { postCount++; if (hold) await hold(); }
    const response = url.pathname.startsWith('/api/catalog/metadata') ? await catalogMetadataHTTP(request, metadata, url.pathname.endsWith('/preview'))
      : url.pathname === '/api/catalog/legacy-import' ? await catalogLegacyImportHTTP(request, service) : await catalogListHTTP(request, service);
    if (drop && request.method === 'POST' && url.pathname === '/api/catalog/legacy-import' && response.ok) { drop = false; throw Error('synthetic response loss'); }
    return response;
  };
  const root = join(await realpath(rt.root), 'synthetic-input'); await mkdir(root, { mode: 0o700 });
  await mkdir(join(root, 'synthetic')); await mkdir(join(root, 'Klausuren_Komplett'));
  const small = syntheticPdf(1), marker = small.lastIndexOf('startxref'); assert.ok(marker > 0);
  const large = Buffer.concat([small.subarray(0, marker), Buffer.alloc(4451270 - small.length, 32), small.subarray(marker)]);
  const rows: PlanRow[] = [], topic = getLeafTopics(TOPICS)[0].id;
  // Full production cardinality, five real metadata receipts and 449 original bindings.
  for (let i = 0; i < 449; i++) {
    const bytes = i === 0 ? large : small, filename = `synthetic-${i}.pdf`;
    const raw = { id: `synthetic-source-${i}`, source: filename, area: 'sr', type: 'SR-Anwaltsklausur', title: `Synthetic retry ${i}`, date: '', topicIds: [topic] };
    const originPath = `synthetic/source-${i}.json`, rawBytes = JSON.stringify(raw);
    await writeFile(join(root, originPath), rawBytes); await writeFile(join(root, 'Klausuren_Komplett', filename), bytes);
    const { type, ...fields } = raw; void type;
    const publicMetadata = { ...fields, id: i === 0 ? 'kg-sr-061' : `synthetic-case-${i}` };
    rows.push({ klausurId: publicMetadata.id, publicMetadata, plannedPublicMetadataSha256: digest(publicMetadata), sourceId: raw.id, typeProjection: 'neutral',
      pdf: { filename, sha256: sha256(bytes), byteSize: bytes.length, edition: `sha256:${sha256(bytes)}` },
      provenance: { originPath, originFileSha256: sha256(rawBytes), recordIndex: 0, sourceId: raw.id, source: raw.source, area: 'sr', rawType: raw.type, topicIds: raw.topicIds } });
  }
  const core = { format: 'stex-r37-final-data-plan-core', version: 1, executionSupported: false, status: 'local-plan-only', planId: 'synthetic-explicit-retry-plan', sourceBindings: { manifest: { sha256: digest('synthetic-manifest') }, idMap: { sha256: digest('synthetic-map') } }, records: rows };
  const coreBytes = JSON.stringify(core), coreHash = sha256(coreBytes);
  const records = rows.map(r => ({ ...r.publicMetadata, legacy: { version: 1, planId: core.planId, planSha256: coreHash, manifestSha256: core.sourceBindings.manifest.sha256, idMapSha256: core.sourceBindings.idMap.sha256,
    metadata: { originPath: r.provenance.originPath, originFileSha256: r.provenance.originFileSha256, recordIndex: 0, sourceId: r.sourceId, source: r.provenance.source, area: 'sr', type: r.provenance.rawType }, pdf: r.pdf, typeProjection: 'neutral', roleDeclaration: 'user-declared-combined' } }));
  const batches = [0, 100, 200, 300, 400].map((start, i) => ({ batch: i + 1, recordCount: Math.min(100, 449 - start), requestTemplate: { contractVersion: 1, action: 'legacy-import', records: records.slice(start, start + 100) } }));
  const metadataBytes = JSON.stringify({ format: 'stex-r37-metadata-request-templates', version: 1, templateOnly: true, runnable: false, planSha256: coreHash, planId: core.planId, action: 'legacy-import', batches });
  const pdfBytes = JSON.stringify({ format: 'stex-r37-pdf-import-command-templates', version: 1, templateOnly: true, runnable: false, bindAfterMetadataCommit: true, planSha256: coreHash, planId: core.planId, commands: rows.map(r => ({ contractVersion: 1, klausurId: r.klausurId, planId: core.planId, planSha256: coreHash, source: { ...r.pdf, role: 'kombiniert' } })) });
  const files = { core: join(root, 'core.json'), metadata: join(root, 'metadata.json'), pdf: join(root, 'pdf.json') };
  await writeFile(files.core, coreBytes); await writeFile(files.metadata, metadataBytes); await writeFile(files.pdf, pdfBytes);
  const profile: Profile = { origin: base, target: TARGET, records: 449, batchSizes: [100, 100, 100, 100, 49], hashes: { core: coreHash, metadata: sha256(metadataBytes), pdf: sha256(pdfBytes) }, operatorSha256: sha256(await readFile(resolve('scripts/data-migration/catalog-apply.mts'))) };
  const dir = join(root, 'state'); const initial = await prepare(dir, files, profile);
  const gate = (phase: 'metadata' | 'pdf', state: State): HostGate => ({ format: 'stex-r37-catalog-apply-gate', version: 1, phase, origin: base, target: TARGET, coreSha256: coreHash, operatorSha256: profile.operatorSha256, releaseManifestSha256: digest('synthetic-release'), sourcePackageSha256: digest('synthetic-package'), backupManifestSha256: digest('synthetic-backup'), backupCapturedAt: new Date(Date.now() - 3000).toISOString(), restoreVerifiedAt: new Date(Date.now() - 2000).toISOString(), restoreReference: 'synthetic-restore', targetSnapshotSha256: digest('synthetic-snapshot'), targetSnapshotReference: 'synthetic-current', issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), metadataReceiptsSha256: phase === 'pdf' ? state.metadataReceiptsSha256 : null, pdfBindingsSha256: phase === 'pdf' ? state.pdfBindingsSha256 : null });
  const options = (phase: 'metadata' | 'pdf', state: State) => ({ dir, profile, session: session(), sourceRoot: root, gate: gate(phase, state), maxSteps: phase === 'metadata' ? 5 : 1, transport });
  await applyMetadata(options('metadata', initial)); const bound = await preparePdfs(dir, profile, session(), transport);
  const originalCommand = bound.pdfBindings![0], parentRequestId = bound.pdf[0].requestId;
  // Only artificial historical fixture setup: no real parent request is ever replayed.
  const pending = structuredClone(bound); pending.pdf[0] = { requestId: parentRequestId, status: 'pending', semantic: originalCommand };
  const saveFixture = async (state: State) => writeFile(join(dir, 'checkpoint.json'), JSON.stringify({ state, sha256: digest(state) }), { mode: 0o600 });
  await saveFixture(pending);
  await repo.database.pool.query("INSERT INTO stex.catalog_imports(import_id,submitted_by_user_id,request_id,source_digest,source_reference,status,acceptance_mode,content_check,technical_validation,duplicate_status,metadata,warnings,error_code,error_message,completed_at) VALUES('ci-synthetic-parent-retry',$1,$2,$3,$4,'failed','direct','not-performed','valid','pending',$5::jsonb,'[]'::jsonb,'unavailable','synthetic historical failure',now())", [admin.name, parentRequestId, digest({ legacy: originalCommand }), rows[0].pdf.filename, JSON.stringify({ ...records[0], legacy: originalCommand })]);
  const history = async () => (await repo.database.pool.query('SELECT * FROM stex.catalog_imports WHERE request_id=$1', [parentRequestId])).rows[0];
  const originalHistory = await history();
  const retryOptions = () => options('pdf', pending);
  const childId = firstRetryRequestId(parentRequestId, originalCommand);
  if (loseResponse) await t.test('owner, revision, terminal parent, gate, source, generation, TOTP and document deviations stop without reserving or posting', async () => {
    for (const mutate of ['owner', 'revision', 'parent', 'gate', 'documents', 'source', 'generation', 'totp']) {
      const o = retryOptions();
      if (mutate === 'owner') { const changed = structuredClone(pending); changed.owner = 'synthetic-wrong-owner'; changed.metadata.forEach(i => { i.semantic!.expectedAccountId = changed.owner; }); await saveFixture(changed); }
      if (mutate === 'revision') await repo.database.pool.query("UPDATE stex.catalog_records SET revision=2 WHERE id='kg-sr-061'");
      if (mutate === 'parent') await repo.database.pool.query("UPDATE stex.catalog_imports SET status='processing' WHERE request_id=$1", [parentRequestId]);
      if (mutate === 'gate') o.gate.operatorSha256 = digest('wrong operator');
      if (mutate === 'documents') o.transport = async request => {
        const response = await transport(request);
        if (new URL(request.url).pathname !== '/api/catalog/klausuren') return response;
        const value = await response.json();
        value.klausuren.find((row: { id: string }) => row.id === 'kg-sr-061').documents.push({ documentId: 'synthetic-unexpected' });
        return Response.json(value); // Deliberately corrupted response, not an auth/capability simulation.
      };
      const principal = await auth.principal(admin.headers(), 'admin');
      const factor = (await repo.database.pool.query('SELECT "factorVerifiedAt" FROM public.stex_auth_session WHERE id=$1', [principal.sessionId])).rows[0].factorVerifiedAt;
      if (mutate === 'source') await writeFile(join(root, 'Klausuren_Komplett', rows[0].pdf.filename), Buffer.alloc(large.length));
      if (mutate === 'generation') await repo.database.pool.query('UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1', [admin.name]);
      if (mutate === 'totp') await repo.database.pool.query(`UPDATE public.stex_auth_session SET "factorVerifiedAt"=now()-interval '11 minutes' WHERE id=$1`, [principal.sessionId]);
      const expected: Record<string, string> = { owner: 'owner_changed', revision: 'target_revision_or_payload_changed', parent: 'retry_parent_not_terminal_empty', gate: 'host_gate_mismatch', documents: 'unexpected_document_state', source: 'source_pdf_hash_mismatch', generation: 'http_401', totp: 'fresh_admin_required_401' };
      try { await assert.rejects(retryFirstPdf(o), code(expected[mutate])); assert.equal(postCount, 0); }
      finally {
      if (mutate === 'source') await writeFile(join(root, 'Klausuren_Komplett', rows[0].pdf.filename), large);
      if (mutate === 'generation') await repo.database.pool.query('UPDATE stex.account_access SET generation=$2 WHERE user_id=$1', [admin.name, principal.generation]);
      if (mutate === 'totp') await repo.database.pool.query('UPDATE public.stex_auth_session SET "factorVerifiedAt"=$2 WHERE id=$1', [principal.sessionId, factor]);
      await saveFixture(pending);
      await repo.database.pool.query("UPDATE stex.catalog_records SET revision=1 WHERE id='kg-sr-061'");
      await repo.database.pool.query("UPDATE stex.catalog_imports SET status='failed' WHERE request_id=$1", [parentRequestId]);
      }
    }
    assert.deepEqual(await history(), originalHistory);
  });
  await t.test('one durable child; a concurrent runner cannot race the lock; direct success and receipt reconciliation', async () => {
    let release!: () => void, reached!: () => void;
    const entered = new Promise<void>(r => { reached = r; }), barrier = new Promise<void>(r => { release = r; });
    hold = async () => { reached(); await barrier; }; drop = loseResponse;
    const first = retryFirstPdf(retryOptions()); await entered;
    const sent = (await loadState(dir, profile)).state;
    assert.equal(sent.firstPdfRetry!.status, 'sent'); assert.equal(sent.firstPdfRetry!.childRequestId, childId);
    assert.deepEqual(sent.firstPdfRetry!.parentItem, pending.pdf[0]);
    await assert.rejects(retryFirstPdf(retryOptions()), code('operator_locked')); release(); hold = undefined;
    if (loseResponse) await assert.rejects(first, code('response_unknown'));
    else { const delivered = await first; assert.equal(delivered.firstPdfRetry!.status, 'done'); assert.equal(delivered.pdf[0].status, 'done'); }
    assert.equal(postCount, 1); assert.deepEqual(await history(), originalHistory);
    if (loseResponse) await assert.rejects(applyPdfs(retryOptions()), code('explicit_retry_required'));
    const complete = await retryFirstPdf(retryOptions()); assert.equal(postCount, 1);
    assert.equal(complete.pdf[0].status, 'done'); assert.equal(complete.pdf[0].requestId, parentRequestId); assert.equal(complete.pdf[0].result!.requestId, childId);
    assert.deepEqual(complete.pdfBindings, bound.pdfBindings); assert.deepEqual(complete.metadata, bound.metadata);
    assert.deepEqual(complete.pdf.slice(1), bound.pdf.slice(1)); assert.deepEqual(await history(), originalHistory);
    assert.equal(complete.firstPdfRetry!.parentFingerprint, originalHistory.source_digest);
    const child = (await repo.database.pool.query('SELECT source_digest,metadata,status FROM stex.catalog_imports WHERE request_id=$1', [childId])).rows[0];
    assert.equal(child.status, 'committed'); assert.equal(child.source_digest, complete.firstPdfRetry!.childFingerprint);
    assert.deepEqual({ ...child.metadata.legacy, requestId: parentRequestId }, originalCommand);
    await retryFirstPdf(retryOptions()); assert.equal(postCount, 1);
    const saved = await readFile(join(dir, 'checkpoint.json'), 'utf8'); assert.ok(!saved.includes(cookie));
  });
  if (loseResponse) await t.test('sent child missing, failed, wrong result and corrupt ledger never create another attempt', async () => {
    const complete = (await loadState(dir, profile)).state, originalTransport = retryOptions().transport;
    for (const kind of ['missing', 'failed', 'hash', 'version', 'case', 'document']) {
      const o = retryOptions();
      o.transport = async request => {
        const response = await originalTransport(request), url = new URL(request.url);
        if (request.method !== 'GET' || url.searchParams.get('requestId') !== childId) return response;
        if (kind === 'missing') return Response.json({ contractVersion: 1, error: { code: 'not_found' } }, { status: 404 });
        const value = await response.json();
        if (kind === 'failed') value.import.status = 'failed';
        if (kind === 'hash') value.import.documents[0].sha256 = digest('wrong bytes');
        if (kind === 'version') value.import.documents[0].versionNumber = 2;
        if (kind === 'case') value.import.klausurId = 'synthetic-other-case';
        if (kind === 'document') value.import.documents[0].documentId = 'cd-other';
        return Response.json(value);
      };
      await assert.rejects(retryFirstPdf(o)); assert.equal(postCount, 1);
    }
    const corrupt = structuredClone(complete); corrupt.firstPdfRetry!.childCommand.klausurId = 'synthetic-other'; await saveFixture(corrupt);
    await assert.rejects(loadState(dir, profile), code('retry_ledger_mismatch')); await saveFixture(complete);
    assert.deepEqual(await history(), originalHistory);
  });
  if (loseResponse) await t.test('remaining normal uploads keep their original request and source bindings', async () => {
    const result = await applyPdfs(retryOptions()); assert.equal(result.pdf[1].status, 'done'); assert.equal(result.pdf[1].requestId, bound.pdf[1].requestId);
    assert.equal(result.pdf[1].result!.requestId, bound.pdf[1].requestId); assert.equal(postCount, 2);
    assert.deepEqual(result.pdfBindings, bound.pdfBindings); assert.deepEqual(result.metadata, bound.metadata); assert.deepEqual(await history(), originalHistory);
    const counts = (await repo.database.pool.query('SELECT (SELECT count(*)::int FROM stex.catalog_documents) AS documents,(SELECT count(*)::int FROM stex.catalog_document_versions) AS versions,(SELECT count(*)::int FROM stex.catalog_import_documents) AS links,(SELECT count(*)::int FROM stex.search_jobs) AS jobs')).rows[0];
    assert.deepEqual(counts, { documents: 2, versions: 2, links: 2, jobs: 2 });
  });
});
