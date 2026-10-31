/** Explicit manual UI fixture, isolated from every existing app/cache/account. */
import { randomBytes, createHmac } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { Database } from '../src/lib/server/persistence/database';
import { PrivateFiles } from '../src/lib/server/persistence/files';
import { AccountService } from '../src/lib/server/auth/service';
import { SyntheticAccount, syntheticPassword, syntheticPdf } from '../scripts/pdf-a/fixtures';
import { CatalogImportService, validateCatalogPdf } from '../src/lib/server/catalog/import-service';
import { CatalogMetadataService } from '../src/lib/server/catalog/metadata-service';
import { metadataContext } from '../src/lib/catalog/metadata-contract';
import { lockState } from '../src/lib/server/persistence/repository';
import { getLeafTopics, TOPICS } from '../src/lib/topics';

function totp(uri: string) {
  let bits = ''; for (const c of new URL(uri).searchParams.get('secret')!.toUpperCase().replace(/=+$/, '')) bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(v => parseInt(v, 2))), counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', key).update(counter).digest(); return ((mac.readUInt32BE(mac[mac.length - 1] & 15) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
async function freePort() { const s = createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r)); const a = s.address(); if (!a || typeof a === 'string') throw Error('test port'); await new Promise<void>(r => s.close(() => r())); return a.port; }
async function main() {
  const snapshot = resolve(process.argv[2]); if (!snapshot.startsWith('/private/tmp/r36-katalog-app-')) throw Error('Own public QA copy required.');
  const root = await mkdtemp('/private/tmp/r36-katalog-runtime-'), port = await freePort(), webPort = await freePort();
  const password = randomBytes(24).toString('hex'), secret = randomBytes(48).toString('hex'), mailKey = randomBytes(48).toString('hex');
  for (const [name, value] of [['postgres-password', password], ['auth-secret', secret], ['auth-mail-key', mailKey]]) await writeFile(join(root, name), value, { mode: 0o600 });
  const cluster = new EmbeddedPostgres({ databaseDir: join(root, 'postgres'), port, user: 'stex_local', password, persistent: true, authMethod: 'scram-sha-256', createPostgresUser: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1', '-k', root], onLog: () => {}, onError: () => {} });
  let next: ReturnType<typeof spawn> | undefined, database: Database | undefined, stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; if (next && next.exitCode === null) { next.kill('SIGTERM'); await new Promise<void>(r => next!.once('exit', () => r())); } await database?.close(); await cluster.stop(); await rm(root, { recursive: true, force: true }); console.log('R36-KATALOG own runtime cleaned'); };
  try {
    await cluster.initialise(); await cluster.start(); await cluster.createDatabase('stex_local');
    database = new Database({ host: '127.0.0.1', port, user: 'stex_local', password, database: 'stex_local' }); await database.migrate();
    const files = new PrivateFiles(join(root, 'files')); await files.initialize(); const baseURL = `http://localhost:${webPort}`;
    const auth = new AccountService({ database, files, baseURL, secret, mailKey }), admin = new SyntheticAccount(auth, 'r36-katalog-admin'), member = new SyntheticAccount(auth, 'r36-katalog-member');
    await admin.initialize(); await member.initialize();
    await database.transaction(async c => { await lockState(c); await c.query("INSERT INTO stex.auth_bootstrap(singleton,user_id,expires_at) VALUES(true,$1,now()+interval '1 hour')", [admin.name]); });
    const enabled = await (await admin.auth('/two-factor/enable', { password: syntheticPassword, method: 'totp' })).json();
    await admin.auth('/two-factor/verify-totp', { code: totp(enabled.totpURI), trustDevice: false });
    await database.transaction(async c => { await lockState(c); await c.query("UPDATE stex.accounts SET role='admin' WHERE user_id=$1", [admin.name]); });
    const bytes = syntheticPdf(1), documents = await Promise.all((['sachverhalt', 'loesung'] as const).map(role => validateCatalogPdf({ name: `${role}.pdf`, size: bytes.length, type: 'application/pdf', arrayBuffer: async () => Uint8Array.from(bytes).buffer }, role)));
    await new CatalogImportService(auth, files).submit(member.headers(), { requestId: 'r36-katalog-synthetic-pdf', metadata: { id: 'qa-zr', source: 'Hamburg synthetisch', date: '', title: 'Katalogprobe Zivilrecht', area: 'zr', type: 'Urteil', topicIds: [getLeafTopics(TOPICS).find(t => t.area === 'zr')?.id ?? getLeafTopics(TOPICS)[0].id] }, documents });
    const metadata = new CatalogMetadataService(auth), view = await metadata.read(admin.headers()), preview = await metadata.preview(admin.headers(), { ...metadataContext(view.account), records: [{ id: 'qa-sr', source: 'Berlin synthetisch', date: '2026-10-20', title: 'Katalogprobe Strafrecht', area: 'sr', type: 'Anklageklausur', topicIds: [] }] });
    await metadata.submit(admin.headers(), { ...metadataContext(view.account), action: 'import', requestId: crypto.randomUUID(), records: preview.records, snapshot: preview.snapshot });
    next = spawn(process.execPath, [join(snapshot, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(webPort)], { cwd: snapshot, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', TSX_DISABLE_CACHE: '1', STEX_AUTH_MODE: 'local', STEX_LEARNING_MODE: 'account', STEX_ISOLATED_DEV: '1', BETTER_AUTH_URL: baseURL, STEX_LOCAL_DATA_DIR: root, STEX_LOCAL_POSTGRES_PORT: String(port) }, stdio: ['ignore', 'inherit', 'inherit'] });
    console.log(JSON.stringify({ baseURL, snapshot, syntheticAccounts: [admin.name, member.name] }));
    createInterface({ input: process.stdin }).on('line', line => {
      if (line === 'code') console.log('Disposable synthetic admin TOTP:', totp(enabled.totpURI));
      if (line === 'audit') void database!.pool.query("SELECT kind,count(*)::int AS n FROM stex.personal_records GROUP BY kind ORDER BY kind").then(r => console.log(JSON.stringify({ syntheticPersonalCounts: r.rows })));
      if (line === 'stop') void stop().then(() => process.exit(0));
    });
    process.on('SIGTERM', () => void stop().then(() => process.exit(0))); process.on('SIGINT', () => void stop().then(() => process.exit(0)));
  } catch (e) { await stop(); throw e; }
}
// Ordinary test discovery does not start a browser runtime.
if (process.env.STEX_R36_KATALOG_BROWSER === '1') void main().catch(e => { console.error(e); process.exitCode = 1; });
