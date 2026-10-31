/** Explicit narrow UI fixture: one untyped shared case, no real data/providers. */
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm, open, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { Database } from '../src/lib/server/persistence/database';
import { PrivateFiles } from '../src/lib/server/persistence/files';
import { AccountService } from '../src/lib/server/auth/service';
import { SyntheticAccount } from '../scripts/pdf-a/fixtures';
import { lockState } from '../src/lib/server/persistence/repository';
import { recordKey } from '../src/lib/data-migration/migration';

async function port() { const s = createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r)); const a = s.address(); if (!a || typeof a === 'string') throw Error('test port'); await new Promise<void>(r => s.close(() => r())); return a.port; }
async function main() {
  const snapshot = resolve(process.argv[2]); if (!snapshot.startsWith('/private/tmp/r36-katalog-type-app-')) throw Error('Own public QA copy required.');
  const root = await mkdtemp('/private/tmp/r36-katalog-type-runtime-'), dbPort = await port(), webPort = await port();
  const password = randomBytes(24).toString('hex'), secret = randomBytes(48).toString('hex'), mailKey = randomBytes(48).toString('hex');
  for (const [name, value] of [['postgres-password', password], ['auth-secret', secret], ['auth-mail-key', mailKey]]) await writeFile(join(root, name), value, { mode: 0o600 });
  const cluster = new EmbeddedPostgres({ databaseDir: join(root, 'postgres'), port: dbPort, user: 'stex_local', password, persistent: true, authMethod: 'scram-sha-256', createPostgresUser: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1', '-k', root], onLog: () => {}, onError: () => {} });
  const log = await open(join(root, 'next.log'), 'a');
  let next: ReturnType<typeof spawn> | undefined, database: Database | undefined, stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; if (next && next.exitCode === null) { next.kill('SIGTERM'); await new Promise<void>(r => next!.once('exit', () => r())); } await database?.close(); await cluster.stop(); await log.close(); await rm(root, { recursive: true, force: true }); console.log('R36-KATALOG-TYP cleaned'); };
  try {
    await cluster.initialise(); await cluster.start(); await cluster.createDatabase('stex_local');
    database = new Database({ host: '127.0.0.1', port: dbPort, user: 'stex_local', password, database: 'stex_local' }); await database.migrate();
    const files = new PrivateFiles(join(root, 'files')); await files.initialize(); const baseURL = `http://localhost:${webPort}`;
    const auth = new AccountService({ database, files, baseURL, secret, mailKey }), member = new SyntheticAccount(auth, 'r36-type-member'); await member.initialize();
    await database.transaction(async c => { await lockState(c); await c.query("INSERT INTO stex.catalog_records(record_key,kind,id,revision,legacy_key,payload,normalized) VALUES($1,'klausur','type-missing',1,'synthetic',$2::jsonb,'{}')", [recordKey('klausur', null, 'type-missing'), JSON.stringify({ id: 'type-missing', title: 'Synthetischer Fall ohne Typ', source: 'Künstliche Typprüfung', date: '', area: 'zr', topicIds: [], createdAt: '', updatedAt: '' })]); });
    const web = () => {
      if (next && next.exitCode === null) return;
      next = spawn(process.execPath, [join(snapshot, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(webPort)], { cwd: snapshot, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', TSX_DISABLE_CACHE: '1', STEX_AUTH_MODE: 'local', STEX_LEARNING_MODE: 'account', STEX_ISOLATED_DEV: '1', BETTER_AUTH_URL: baseURL, STEX_LOCAL_DATA_DIR: root, STEX_LOCAL_POSTGRES_PORT: String(dbPort) }, stdio: ['ignore', log.fd, log.fd] });
    };
    web(); console.log(JSON.stringify({ baseURL, snapshot, syntheticAccount: member.name }));
    createInterface({ input: process.stdin }).on('line', line => {
      if (line === 'web') web();
      if (line === 'log') void readFile(join(root, 'next.log'), 'utf8').then(s => console.log(s.slice(-2200)));
      if (line === 'audit') void database!.pool.query("SELECT (SELECT count(*)::int FROM stex.personal_records WHERE kind='draft') AS drafts,(SELECT count(*)::int FROM stex.learning_commands WHERE action='writing') AS writing_commands,(SELECT payload->>'type' FROM stex.catalog_records WHERE id='type-missing') AS catalog_type,(SELECT coalesce(json_agg(json_build_object('id',id,'type',payload->>'type','klausurId',payload->>'klausurId')),'[]') FROM stex.personal_records WHERE kind='draft') AS private_drafts").then(r => console.log(JSON.stringify(r.rows[0])));
      if (line === 'stop') void stop().then(() => process.exit(0));
    });
    process.on('SIGTERM', () => void stop().then(() => process.exit(0))); process.on('SIGINT', () => void stop().then(() => process.exit(0)));
  } catch (e) { await stop(); throw e; }
}
if (process.env.STEX_R36_KATALOG_TYPE_BROWSER === '1') void main().catch(e => { console.error(e); process.exitCode = 1; });
