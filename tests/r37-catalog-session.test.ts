import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { ReadStream, WriteStream } from 'node:tty';
import { CatalogLogin, ORIGIN, SessionError, outputTarget, privateTerminal, secureTransport, tlsPolicy, type SessionDocument } from '../scripts/data-migration/catalog-session.mts';
import { sessionFile } from '../scripts/data-migration/catalog-apply.mts';
import { testRuntime } from '../scripts/data-migration/postgres-test-runtime';
import { AccountService } from '../src/lib/server/auth/service';
import { catalogLegacyImportHTTP } from '../src/lib/server/catalog/legacy-import-http';
import { CatalogImportService } from '../src/lib/server/catalog/import-service';

const code = (expected: string) => (e: unknown) => e instanceof SessionError && e.code === expected;
const sessionName = '__Secure-better-auth.session_token';
const challengeName = '__Secure-better-auth.two_factor';
const cookie = (name: string, value: string) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`;
const json = (value: unknown, status = 200, cookies: string[] = []) => {
  const headers = new Headers({ 'content-type': 'application/json' });
  for (const v of cookies) headers.append('set-cookie', v);
  return new Response(JSON.stringify(value), { status, headers });
};
const syntheticSession: SessionDocument = { format: 'stex-catalog-session', version: 1, origin: ORIGIN, cookie: `${sessionName}=synthetic-only%2Esignature` };
const password = 'Only synthetic AUTH helper 2026!';
function totp(uri: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of new URL(uri).searchParams.get('secret')!) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(v => parseInt(v, 2))), counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', key).update(counter).digest(); return ((mac.readUInt32BE(mac.at(-1)! & 15) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
class NativeClient {
  cookies = new Map<string, string>();
  constructor(readonly service: AccountService) {}
  async call(path: string, body?: Record<string, unknown>) {
    const headers = new Headers({ cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '), origin: ORIGIN, 'x-stex-action': '1' });
    if (body) headers.set('content-type', 'application/json');
    const request = new Request(ORIGIN + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
    const response = path.startsWith('/api/auth/') ? await this.service.authHTTP(request) : await this.service.accountHTTP(request);
    for (const raw of response.headers.getSetCookie()) { const pair = raw.split(';')[0], i = pair.indexOf('='); if (pair.slice(i + 1)) this.cookies.set(pair.slice(0, i), pair.slice(i + 1)); else this.cookies.delete(pair.slice(0, i)); }
    return response;
  }
}
function fakeFlow(change?: (request: Request, result: Response) => Response) {
  const requests: Request[] = [];
  const transport = async (request: Request) => {
    requests.push(request); const path = new URL(request.url).pathname;
    let result: Response;
    if (path === '/api/auth/sign-in/email') result = json({ twoFactorRedirect: true, twoFactorMethods: ['totp'] }, 200, [cookie(challengeName, 'synthetic-challenge')]);
    else if (path === '/api/auth/two-factor/verify-totp') result = json({ user: { id: 'synthetic' } }, 200, [cookie(sessionName, 'synthetic-only%2Esignature'), cookie('ignored.cookie', 'never-export')]);
    else if (path === '/api/account') result = json({ contractVersion: 1, account: { userId: 'synthetic-admin', email: 'admin@example.test', status: 'active', role: 'admin' } });
    else if (path === '/api/auth/sign-out') result = json({ success: true });
    else result = json({ contractVersion: 1, error: { code: 'not_found' } }, 404);
    return change ? change(request, result) : result;
  };
  return { requests, transport };
}

test('new helper fixed-origin request/cookie contract and genuine fresh gate required', async () => {
  const flow = fakeFlow(), login = new CatalogLogin(flow.transport);
  const document = await login.login('admin@example.test', 'Only synthetic password 2026!', async () => '123456');
  assert.deepEqual(Object.keys(document).sort(), ['cookie', 'format', 'origin', 'version']);
  assert.equal(document.cookie.split('=')[0], sessionName);
  assert.equal(flow.requests.length, 4);
  for (const r of flow.requests) { assert.equal(new URL(r.url).origin, ORIGIN); assert.equal(r.redirect, 'error'); assert.equal(r.headers.get('origin'), ORIGIN); assert.equal(r.headers.get('x-stex-action'), '1'); }
  const body = await flow.requests[1].json(); assert.equal(body.trustDevice, false); assert.deepEqual(Object.keys(body).sort(), ['code', 'trustDevice']);
  assert.equal(flow.requests[2].headers.get('cookie')?.includes('ignored.cookie'), false);
  login.clear();
});

test('new helper denies redirects, changed response origin, bad factor, member, stale factor, malformed/unsafe cookies', async t => {
  const cases: [string, (r: Request, response: Response) => Response, string][] = [
    ['redirect', () => new Response(null, { status: 302, headers: { location: 'https://example.test' } }), 'redirect_or_origin_denied'],
    ['response origin', (_, response) => { Object.defineProperty(response, 'url', { value: 'https://example.test/api/account' }); return response; }, 'redirect_or_origin_denied'],
    ['factor failure', (r, response) => r.url.endsWith('/verify-totp') ? json({ error: { message: 'untrusted server detail' } }, 401) : response, 'factor_denied'],
    ['member', (r, response) => r.url.endsWith('/api/account') ? json({ contractVersion: 1, account: { userId: 'synthetic-member', email: 'admin@example.test', status: 'active', role: 'member' } }) : response, 'admin_required'],
    ['stale gate', (r, response) => r.url.includes('legacy-import') ? json({ contractVersion: 1, error: { code: 'reauthenticate' } }, 401) : response, 'fresh_admin_required'],
    ['missing secure', (r, response) => r.url.endsWith('/verify-totp') ? json({}, 200, [`${sessionName}=synthetic; Path=/; HttpOnly; SameSite=Lax`]) : response, 'cookie_denied'],
    ['domain cookie', (r, response) => r.url.endsWith('/verify-totp') ? json({}, 200, [cookie(sessionName, 'synthetic') + '; Domain=example.test']) : response, 'cookie_denied'],
    ['oversized response', () => json({ value: 'x'.repeat(65536) }), 'response_denied'],
    ['limit', () => json({ error: { message: 'untrusted server detail' } }, 429), 'rate_limited'],
  ];
  for (const [name, change, expected] of cases) await t.test(name, async () => {
    const flow = fakeFlow(change), login = new CatalogLogin(flow.transport);
    await assert.rejects(login.login('admin@example.test', 'Only synthetic password 2026!', async () => '123456'), code(expected));
    login.clear(); assert.ok(flow.requests.length <= 4);
  });
});

test('new helper rejects TLS disablement and nonfixed origin before any network', async () => {
  assert.throws(() => tlsPolicy({ NODE_TLS_REJECT_UNAUTHORIZED: '0' }), code('tls_policy_denied'));
  tlsPolicy({}); tlsPolicy({ NODE_TLS_REJECT_UNAUTHORIZED: '1' });
  await assert.rejects(secureTransport(new Request('https://example.test/api/auth/sign-in/email')), code('origin_denied'));
});

class FakeTTY extends EventEmitter {
  isTTY = true; isRaw = false; paused = true; output = '';
  setRawMode(value: boolean) { this.isRaw = value; return this; }
  isPaused() { return this.paused; }
  resume() { this.paused = false; return this; }
  pause() { this.paused = true; return this; }
  write(value: string) { this.output += value; return true; }
}
test('new helper terminal requires TTY, never echoes input, handles UTF-8/backspace and restores raw mode', async () => {
  const input = new FakeTTY(), output = new FakeTTY();
  input.isTTY = false;
  assert.throws(() => privateTerminal(input as unknown as ReadStream, output as unknown as WriteStream), code('private_tty_required'));
  input.isTTY = true;
  const terminal = privateTerminal(input as unknown as ReadStream, output as unknown as WriteStream);
  try {
    const value = terminal.ask('Passwort: ', 128), bytes = Buffer.from('Synthetisch ä!');
    input.emit('data', bytes.subarray(0, bytes.length - 2)); input.emit('data', bytes.subarray(bytes.length - 2));
    input.emit('data', Buffer.from('\x7f?\r'));
    assert.equal(await value, 'Synthetisch ä?'); assert.equal(output.output, 'Passwort: \n');
    assert.equal(input.isRaw, true);
    const cancelled = terminal.ask('Code: ', 6); input.emit('data', Buffer.from('123\x03'));
    await assert.rejects(cancelled, code('input_cancelled')); assert.equal(terminal.signal.aborted, true);
  } finally { terminal.close(); }
  assert.equal(input.isRaw, false); assert.equal(input.paused, true); assert.equal(input.listenerCount('data'), 0);
});
test('new helper rejects multiline terminal paste and clears hidden pending entry', async () => {
  const input = new FakeTTY(), output = new FakeTTY(); const terminal = privateTerminal(input as unknown as ReadStream, output as unknown as WriteStream);
  try { const pending = terminal.ask('Passwort: ', 128); input.emit('data', Buffer.from('synthetic\nsecond-line')); await assert.rejects(pending, code('input_cancelled')); assert.equal(output.output, 'Passwort: '); }
  finally { terminal.close(); }
});

test('new helper private output: apply-compatible only, exact rights, exclusive creation, symlink/unsafe-parent denial and cleanup', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'stex-r37-session-output-'))); t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'private', 'session.json'), target = await outputTarget(path); await target.save(syntheticSession);
  assert.equal((await lstat(join(root, 'private'))).mode & 0o777, 0o700); assert.equal((await lstat(path)).mode & 0o777, 0o600);
  assert.equal((await lstat(path)).uid, process.getuid?.()); assert.equal((await lstat(path)).nlink, 1);
  const accepted = await sessionFile(path, ORIGIN); assert.equal(accepted.headers(ORIGIN).get('cookie')?.split('=')[0], sessionName); accepted.clear();
  const bytes = await readFile(path); assert.deepEqual(Object.keys(JSON.parse(bytes.toString())).sort(), ['cookie', 'format', 'origin', 'version']);
  await assert.rejects(outputTarget(path), code('output_exists')); assert.equal((await readFile(path)).equals(bytes), true);
  await symlink(join(root, 'private'), join(root, 'link')); await assert.rejects(outputTarget(join(root, 'link', 'other.json')), code('unsafe_parent'));
  await symlink(path, join(root, 'private', 'link.json')); await assert.rejects(outputTarget(join(root, 'private', 'link.json')), code('output_exists'));
  await chmod(join(root, 'private'), 0o755); await assert.rejects(outputTarget(join(root, 'private', 'other.json')), code('private_output_required')); await chmod(join(root, 'private'), 0o700);
  await target.clean(); await assert.rejects(lstat(path), { code: 'ENOENT' });
  const failed = await outputTarget(join(root, 'new-empty', 'session.json')); await failed.clean(); await assert.rejects(lstat(join(root, 'new-empty')), { code: 'ENOENT' });
  const foreign = join(root, 'foreign'); await mkdir(foreign, { mode: 0o700 }); await writeFile(join(foreign, 'existing'), 'untouched');
  const other = await outputTarget(join(foreign, 'session.json')); await other.clean(); assert.equal(await readFile(join(foreign, 'existing'), 'utf8'), 'untouched');
});

test('new helper regular Better-Auth/TOTP flow against real synthetic PostgreSQL, no external HTTPS', { timeout: 180000 }, async t => {
  const rt = await testRuntime(); t.after(() => rt.close());
  const repository = await rt.repository('r37_session_auth');
  const service = new AccountService({ database: repository.database, files: repository.files, baseURL: ORIGIN, secret: randomBytes(48).toString('hex'), mailKey: randomBytes(48).toString('hex') });
  const adminEmail = 'r37-session-admin@example.test', admin = new NativeClient(service);
  const adminId = (await service.prepareAdmin(adminEmail, 'Synthetic helper admin') as { userId: string }).userId;
  const mail = async (email: string, purpose: 'invitation' | 'verification') => (await service.localMails(email)).filter(m => m.purpose === purpose).at(-1)!;
  const register = async (client: NativeClient, email: string) => {
    const token = new URL((await mail(email, 'invitation')).url).searchParams.get('token');
    assert.equal((await client.call('/api/auth/sign-up/email', { email, password, invitationToken: token })).status, 200);
    const url = new URL((await mail(email, 'verification')).url);
    assert.equal((await client.call(url.pathname + url.search)).status, 302);
  };
  await register(admin, adminEmail);
  assert.equal((await admin.call('/api/auth/sign-in/email', { email: adminEmail, password })).status, 200);
  const enabled = await admin.call('/api/auth/two-factor/enable', { password, method: 'totp' }); assert.equal(enabled.status, 200);
  const adminURI = (await enabled.json()).totpURI as string;
  assert.equal((await admin.call('/api/auth/two-factor/verify-totp', { code: totp(adminURI), trustDevice: false })).status, 200);
  await service.finishAdmin(adminId);
  assert.equal((await admin.call('/api/auth/sign-in/email', { email: adminEmail, password })).status, 200);
  assert.equal((await admin.call('/api/auth/two-factor/verify-totp', { code: totp(adminURI), trustDevice: false })).status, 200);
  const f = { service, repository, database: repository.database, admin, adminEmail, adminURI, adminId };
  const catalog = new CatalogImportService(f.service, f.repository.files);
  let expire = false, authPosts = 0;
  const transport = async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path === '/api/catalog/legacy-import') {
      if (expire) {
        expire = false; const who = await f.service.principal(request.headers, 'admin');
        await f.database.pool.query('UPDATE public.stex_auth_session SET "factorVerifiedAt"=now()-interval \'11 minutes\' WHERE id=$1', [who.sessionId]);
      }
      return catalogLegacyImportHTTP(request, catalog);
    }
    if (path.startsWith('/api/auth/')) { authPosts++; return f.service.authHTTP(request); }
    return f.service.accountHTTP(request);
  };
  await t.test('normal password and actual TOTP produce only real apply-compatible session after server freshness check', async () => {
    const targetPath = join(await realpath(rt.root), 'new-session-output', 'session.json'), target = await outputTarget(targetPath);
    const login = new CatalogLogin(transport);
    const document = await login.login(f.adminEmail, password, async () => totp(f.adminURI));
    await target.save(document); const input = await sessionFile(targetPath, ORIGIN);
    const who = await f.service.principal(input.headers(ORIGIN), 'admin', true); assert.equal(who.userId, f.adminId);
    assert.equal(authPosts, 2); assert.equal(document.cookie.startsWith(sessionName + '='), true);
    input.clear(); await login.discard(); await target.clean();
  });
  await t.test('wrong actual factor produces no session document and no automatic retry', async () => {
    const before = authPosts, login = new CatalogLogin(transport);
    await assert.rejects(login.login(f.adminEmail, password, async () => String((Number(totp(f.adminURI)) + 1) % 1000000).padStart(6, '0')), code('factor_denied'));
    assert.equal(authPosts - before, 2); await login.discard();
  });
  await t.test('regular active member cannot use helper, no promotion or factor setup', async () => {
    const member = new NativeClient(service), email = 'r37-session-member@example.test';
    const invitationResponse = await admin.call('/api/account/admin/invitations', { email, name: 'Synthetic helper member', requestId: randomUUID() }); assert.equal(invitationResponse.status, 201);
    const invitation = await invitationResponse.json(); await register(member, email);
    assert.equal((await admin.call('/api/account/admin/account-action', { userId: invitation.userId, action: 'activate', expectedRevision: 1, requestId: randomUUID() })).status, 200);
    const login = new CatalogLogin(transport); let factorPrompts = 0;
    await assert.rejects(login.login(email, password, async () => { factorPrompts++; return '123456'; }), code('admin_factor_required'));
    assert.equal(factorPrompts, 0); await login.discard();
  });
  await t.test('actual stale factor gate after login prevents output; no local fresh-factor assertion', async () => {
    const login = new CatalogLogin(transport); expire = true;
    await assert.rejects(login.login(f.adminEmail, password, async () => totp(f.adminURI)), code('fresh_admin_required')); await login.discard();
  });
});
