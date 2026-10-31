import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { testRuntime } from '../scripts/data-migration/postgres-test-runtime';
import { syntheticPdf } from '../scripts/pdf-a/fixtures';
import type { AccountService, Principal } from '../src/lib/server/auth/service';
import { CatalogImportService } from '../src/lib/server/catalog/import-service';
import { catalogLegacyImportHTTP } from '../src/lib/server/catalog/legacy-import-http';
import { Database } from '../src/lib/server/persistence/database';
import { fileHash } from '../src/lib/server/persistence/files';
import { digest, recordKey } from '../src/lib/data-migration/migration';
import { getLeafTopics, TOPICS } from '../src/lib/topics';
import type { LegacyImportCommand } from '../src/lib/catalog/legacy-import-contract';

type Phase = 'setup' | 'legacy_state_lock' | 'catalog_record_lock' | 'document_identity_lookup' | 'document_version_insert' | 'storage_put' | 'other_query' | 'verification' | 'cleanup';
type Diagnosis = { phase: Phase; sqlstate: string | null; oserrno: string | null };
const osCodes = new Set(['EACCES', 'EPERM', 'ENOENT', 'ENOSPC', 'EROFS', 'EIO', 'EEXIST', 'EMFILE', 'ENFILE', 'EDQUOT']);
function diagnosis(error: unknown, phase: Phase, fromQuery = false): Diagnosis {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  const postgres = fromQuery && error && typeof error === 'object' && 'severity' in error && typeof error.severity === 'string';
  return { phase, sqlstate: postgres && typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) && !osCodes.has(code) ? code : null, oserrno: typeof code === 'string' && osCodes.has(code) ? code : null };
}
function phaseOf(sql: unknown): Phase {
  if (typeof sql !== 'string') return 'other_query';
  if (sql.startsWith('SELECT document_id FROM stex.catalog_documents WHERE record_key=')) return 'document_identity_lookup';
  if (sql.startsWith('SELECT id,payload FROM stex.catalog_records')) return 'catalog_record_lock';
  if (sql.startsWith('SELECT revision,payload FROM stex.catalog_records') && sql.includes('FOR UPDATE')) return 'legacy_state_lock';
  if (sql.startsWith('INSERT INTO stex.catalog_document_versions')) return 'document_version_insert';
  return 'other_query';
}

test('R37 combined commit under restricted schema18 app role', { timeout: 120000 }, async () => {
  const selected = process.env.STEX_R37_COMMIT_MODE;
  const mode = selected === 'baseline' || selected === 'concurrency' ? selected : 'regression';
  let rt: Awaited<ReturnType<typeof testRuntime>> | undefined, app: Database | undefined;
  let phase: Phase = 'setup', firstFailure: Diagnosis | null = null;
  try {
    rt = await testRuntime();
    const repo = await rt.repository('r37_commit_only');
    assert.equal((await repo.database.pool.query('SELECT count(*)::int AS n FROM stex.schema_migrations')).rows[0].n, 18);
    await repo.files.initialize();
    assert.equal((await lstat(repo.files.root)).mode & 0o777, 0o700);
    const role = 'r37_commit_app', password = randomBytes(24).toString('hex');
    await repo.database.pool.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    await repo.database.pool.query(`REVOKE ALL ON SCHEMA stex FROM PUBLIC; GRANT USAGE ON SCHEMA stex TO ${role};
      REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stex FROM PUBLIC;
      GRANT SELECT,UPDATE ON stex.state TO ${role};
      GRANT SELECT,INSERT,UPDATE ON stex.catalog_imports TO ${role};
      GRANT SELECT,INSERT,DELETE ON stex.catalog_records TO ${role};
      GRANT UPDATE(payload,normalized,revision) ON stex.catalog_records TO ${role};
      GRANT SELECT,INSERT ON stex.catalog_documents,stex.catalog_document_versions,stex.catalog_import_documents TO ${role};
      GRANT SELECT,INSERT,UPDATE ON stex.search_jobs TO ${role}`);
    const config = repo.database.pool.options;
    app = new Database({ host: config.host, port: config.port, database: config.database, user: role, password, connectionTimeoutMillis: 5000, options: '-c statement_timeout=10000' });
    const transaction = app.transaction.bind(app);
    app.transaction = (work, readOnly = false) => transaction(client => work(new Proxy(client, {
      get(target, property, receiver) {
        if (property !== 'query') return Reflect.get(target, property, receiver);
        return async (...args: unknown[]) => {
          const queryPhase = phaseOf(args[0]);
          try { return await Reflect.apply(target.query, target, args); }
          catch (error) { firstFailure ??= diagnosis(error, queryPhase, true); throw error; }
        };
      },
    })), readOnly);
    const put = repo.files.put.bind(repo.files);
    repo.files.put = async (...args) => { try { await put(...args); } catch (error) { firstFailure ??= diagnosis(error, 'storage_put'); throw error; } };
    const principal = { userId: 'synthetic-commit-admin', sessionId: 'synthetic-injected-principal', role: 'admin', status: 'active', generation: 1 } as Principal;
    const base = 'https://synthetic.invalid';
    const auth = { database: app, files: repo.files, baseURL: base, principal: async () => principal, checkPrincipal: async () => principal } as unknown as AccountService;
    const service = new CatalogImportService(auth, repo.files);
    await repo.database.pool.query("INSERT INTO stex.accounts(user_id,status,role,revision) VALUES($1,'active','admin',1)", [principal.userId]);
    const bytes = syntheticPdf(1), topic = getLeafTopics(TOPICS)[0].id;
    const fixture = async (suffix: string) => {
      const id = `synthetic-commit-${suffix}`, source = `synthetic-${suffix}.pdf`, planId = 'synthetic-commit-plan';
      const pdf = { filename: source, sha256: fileHash(bytes), byteSize: bytes.length, edition: 'synthetic-v1' };
      const payload = { id, source, date: '', title: 'Synthetic combined commit', area: 'sr', topicIds: [topic], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        legacy: { version: 1, planId, planSha256: digest(planId), manifestSha256: digest('synthetic-manifest'), idMapSha256: digest('synthetic-map'), metadata: { originPath: `synthetic/${suffix}.json`, originFileSha256: digest(suffix), recordIndex: 0, sourceId: id, source, area: 'sr', type: 'SR-Anwaltsklausur' }, pdf, typeProjection: 'neutral', roleDeclaration: 'user-declared-combined' } };
      await repo.database.pool.query("INSERT INTO stex.catalog_records(record_key,kind,id,revision,legacy_key,payload,normalized) VALUES($1,'klausur',$2,1,'synthetic',$3::jsonb,'{}'::jsonb)", [recordKey('klausur', null, id), id, JSON.stringify(payload)]);
      const command: LegacyImportCommand = { contractVersion: 1, requestId: randomUUID(), planId, planSha256: digest(planId), klausurId: id, expectedMetadataRevision: 1, expectedMetadataSha256: digest(payload), expectedDocuments: [], source: { ...pdf, role: 'kombiniert' } };
      return { id, payload, command };
    };
    const send = (command: LegacyImportCommand) => {
      const form = new FormData(); form.set('command', JSON.stringify(command)); form.set('kombiniert', new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }), command.source.filename);
      return catalogLegacyImportHTTP(new Request(`${base}/api/catalog/legacy-import`, { method: 'POST', headers: { origin: base, 'x-stex-action': '1' }, body: form }), service);
    };
    const counts = async () => (await repo.database.pool.query(`SELECT (SELECT generation::int FROM stex.state) AS generation,
      (SELECT count(*)::int FROM stex.catalog_documents) AS documents,(SELECT count(*)::int FROM stex.catalog_document_versions) AS versions,
      (SELECT count(*)::int FROM stex.catalog_import_documents) AS links,(SELECT count(*)::int FROM stex.search_jobs) AS jobs`)).rows[0];
    const rights = (await app.pool.query("SELECT rolsuper,rolcreaterole,rolcreatedb,rolbypassrls,has_table_privilege(current_user,'stex.catalog_documents','UPDATE') AS document_update,has_table_privilege(current_user,'stex.catalog_documents','DELETE') AS document_delete,has_table_privilege(current_user,'stex.catalog_records','UPDATE') AS record_table_update,has_column_privilege(current_user,'stex.catalog_records','revision','UPDATE') AS record_revision_update FROM pg_roles WHERE rolname=current_user")).rows[0];
    assert.deepEqual(rights, { rolsuper: false, rolcreaterole: false, rolcreatedb: false, rolbypassrls: false, document_update: false, document_delete: false, record_table_update: false, record_revision_update: true });
    if (mode === 'concurrency') {
      const f = await fixture('cross-request'), before = await counts();
      const other = { ...f.command, requestId: randomUUID() };
      const responses = await Promise.all([send(f.command), send(other)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
      const rows = (await repo.database.pool.query('SELECT status,error_code FROM stex.catalog_imports ORDER BY status')).rows;
      assert.deepEqual(rows, [{ status: 'committed', error_code: null }, { status: 'failed', error_code: 'conflict' }]);
      assert.deepEqual(await counts(), { generation: before.generation + 4, documents: 1, versions: 1, links: 1, jobs: 1 });
      const stored = (await repo.database.pool.query('SELECT revision,payload FROM stex.catalog_records WHERE id=$1', [f.id])).rows[0];
      assert.equal(stored.revision, 1); assert.deepEqual(stored.payload, f.payload);
      assert.equal(firstFailure, null);
      process.send?.({ kind: 'complete', mode, schema18: true, restrictedRole: true, distinctRequestsSerialized: true, oneCommitOneConflict: true, metadataPreserved: true, documents: 1, versions: 1, links: 1, jobs: 1 });
      return;
    }
    const f = await fixture('first'), before = await counts();
    const response = await send(f.command);
    phase = 'verification';
    const receipt = (await repo.database.pool.query('SELECT status,error_code FROM stex.catalog_imports WHERE request_id=$1', [f.command.requestId])).rows[0];
    const after = await counts();
    const stored = (await repo.database.pool.query('SELECT revision,payload FROM stex.catalog_records WHERE id=$1', [f.id])).rows[0];
    assert.equal(stored.revision, 1); assert.deepEqual(stored.payload, f.payload);
    if (mode === 'baseline') {
      assert.equal(response.status, 503); assert.deepEqual(receipt, { status: 'failed', error_code: 'unavailable' });
      assert.deepEqual(firstFailure, { phase: 'document_identity_lookup', sqlstate: '42501', oserrno: null });
      assert.deepEqual(after, { ...before, generation: before.generation + 2 });
      assert.equal(await lstat(join(repo.files.root, 'objects')).then(() => true, () => false), false);
      const retry = await send(f.command); assert.equal(retry.status, 409); assert.deepEqual(await counts(), after);
    } else {
      assert.equal(response.status, 201); assert.deepEqual(receipt, { status: 'committed', error_code: null }); assert.equal(firstFailure, null);
      assert.deepEqual(after, { generation: before.generation + 2, documents: 1, versions: 1, links: 1, jobs: 1 });
      const version = (await repo.database.pool.query('SELECT storage_key,sha256,byte_size FROM stex.catalog_document_versions')).rows[0];
      assert.deepEqual(await repo.files.read(version.storage_key, version.sha256, Number(version.byte_size)), bytes);
      const replay = await send(f.command); assert.equal(replay.status, 200); assert.deepEqual(await counts(), after);
      const concurrent = await fixture('concurrent'), beforeConcurrent = await counts();
      const responses = await Promise.all([send(concurrent.command), send(concurrent.command)]);
      assert.ok(responses.every(r => r.status === 200 || r.status === 201));
      const afterConcurrent = await counts();
      assert.deepEqual(afterConcurrent, { generation: beforeConcurrent.generation + 2, documents: 2, versions: 2, links: 2, jobs: 2 });
      const concurrentStored = (await repo.database.pool.query('SELECT revision,payload FROM stex.catalog_records WHERE id=$1', [concurrent.id])).rows[0];
      assert.equal(concurrentStored.revision, 1); assert.deepEqual(concurrentStored.payload, concurrent.payload);
      const terminal = { ...f.command, requestId: randomUUID() };
      await repo.database.pool.query("INSERT INTO stex.catalog_imports(import_id,submitted_by_user_id,request_id,source_digest,source_reference,status,acceptance_mode,content_check,technical_validation,duplicate_status,metadata,warnings,error_code,error_message,completed_at) VALUES('synthetic-terminal',$1,$2,$3,$4,'failed','direct','not-performed','valid','pending',$5::jsonb,'[]'::jsonb,'unavailable','synthetic historical failure',now())", [principal.userId, terminal.requestId, digest({ legacy: terminal }), terminal.source.filename, JSON.stringify({ ...f.payload, legacy: terminal })]);
      const historyBefore = (await repo.database.pool.query('SELECT * FROM stex.catalog_imports WHERE request_id=$1', [terminal.requestId])).rows[0];
      assert.equal((await send(terminal)).status, 409);
      assert.deepEqual((await repo.database.pool.query('SELECT * FROM stex.catalog_imports WHERE request_id=$1', [terminal.requestId])).rows[0], historyBefore);
      assert.deepEqual(await counts(), afterConcurrent);
      process.send?.({ kind: 'preservation', concurrentSingleCommit: true, terminalFailedUnchanged: true, noPrivilegeExpansion: true });
    }
    process.send?.({ kind: 'complete', mode, diagnostic: firstFailure, schema18: true, restrictedRole: true, metadataPreserved: true, result: receipt.status, generationDelta: after.generation - before.generation, documents: after.documents, versions: after.versions, links: after.links, jobs: after.jobs, replayPreserved: true });
  } catch (error) {
    process.send?.({ kind: 'failure', diagnostic: firstFailure ?? diagnosis(error, phase) });
    throw new Error('r37_commit_check_failed');
  } finally {
    phase = 'cleanup';
    await app?.close();
    const root = rt?.root;
    await rt?.close();
    process.send?.({ kind: 'cleanup', removed: root ? await lstat(root).then(() => false, () => true) : true }, () => process.disconnect?.());
  }
});
