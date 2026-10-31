import { constants } from 'node:fs';
import { lstat, mkdir, open, rmdir, unlink } from 'node:fs/promises';
import { request as httpsRequest } from 'node:https';
import { randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ReadStream, WriteStream } from 'node:tty';

export const ORIGIN = 'https://stex.62-171-162-115.sslip.io';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COOKIE = '__Secure-better-auth.session_token';
const CHALLENGE = '__Secure-better-auth.two_factor';
const MAX_RESPONSE = 65536;
const FIXED_SESSION_CODES = new Set([
  'tls_policy_denied', 'origin_denied', 'network_or_tls_failed', 'response_body_too_large', 'cookie_denied', 'route_denied',
  'redirect_or_origin_denied', 'response_content_type_denied', 'response_body_missing', 'response_body_read_failed',
  'response_json_invalid', 'response_json_shape_denied', 'input_denied', 'rate_limited', 'sign_in_denied',
  'admin_factor_required', 'factor_input_denied', 'factor_denied', 'session_missing', 'admin_required',
  'fresh_admin_required', 'session_changed_or_expired', 'unsafe_parent', 'private_output_required', 'output_exists',
  'private_tty_required', 'input_cancelled', 'invalid_arguments',
]);
const RESPONSE_DIAGNOSTIC_CODES = new Set([
  'response_content_type_denied', 'response_body_missing', 'response_body_too_large',
  'response_body_read_failed', 'response_json_invalid', 'response_json_shape_denied',
]);
type ObjectValue = Record<string, unknown>;
export interface SessionDocument { format: 'stex-catalog-session'; version: 1; origin: typeof ORIGIN; cookie: string }
export class SessionError extends Error {
  readonly code: string;
  readonly httpStatus?: number;
  constructor(code: string, httpStatus?: number) {
    super(code); this.code = code;
    if (httpStatus !== undefined && Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) this.httpStatus = httpStatus;
  }
}
export interface SessionFailureOutput { code: string; status?: number }
export function sessionFailureOutput(error: unknown): SessionFailureOutput {
  const sessionError = error instanceof SessionError ? error : undefined;
  const code = sessionError && FIXED_SESSION_CODES.has(sessionError.code) ? sessionError.code : 'login_or_private_output_failed';
  const status = sessionError && RESPONSE_DIAGNOSTIC_CODES.has(code) ? sessionError.httpStatus : undefined;
  return { code, ...(status === undefined ? {} : { status }) };
}
function deny(code: string, httpStatus?: number): never { throw new SessionError(code, httpStatus); }
function check(value: unknown, code: string, httpStatus?: number): asserts value { if (!value) deny(code, httpStatus); }
function object(value: unknown): value is ObjectValue { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function tlsPolicy(env: NodeJS.ProcessEnv): void {
  check(env.NODE_TLS_REJECT_UNAUTHORIZED === undefined || env.NODE_TLS_REJECT_UNAUTHORIZED === '1', 'tls_policy_denied');
}

/** Fixed HTTPS only, no redirects/proxy overrides/retries or logging of errors. */
export async function secureTransport(request: Request): Promise<Response> {
  tlsPolicy(process.env);
  const url = new URL(request.url);
  check(url.origin === ORIGIN && !url.username && !url.password && !url.hash, 'origin_denied');
  const body = request.body ? await request.text() : undefined;
  return new Promise((accept, reject) => {
    let responseTooLarge = false;
    let responseStatus: number | undefined;
    const fail = () => reject(responseTooLarge
      ? new SessionError('response_body_too_large', responseStatus)
      : new SessionError('network_or_tls_failed'));
    const outgoing = httpsRequest(url, { method: request.method, headers: Object.fromEntries(request.headers),
      agent: false, rejectUnauthorized: true, minVersion: 'TLSv1.2', maxHeaderSize: 16384, signal: request.signal }, incoming => {
      responseStatus = incoming.statusCode;
      const chunks: Buffer[] = []; let size = 0;
      incoming.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_RESPONSE) {
          responseTooLarge = true;
          incoming.destroy(); outgoing.destroy(); reject(new SessionError('response_body_too_large', incoming.statusCode));
        }
        else chunks.push(chunk);
      });
      incoming.on('error', fail);
      incoming.on('aborted', fail);
      incoming.on('end', () => {
        try {
          const headers = new Headers();
          for (let i = 0; i < incoming.rawHeaders.length; i += 2) headers.append(incoming.rawHeaders[i], incoming.rawHeaders[i + 1]);
          accept(new Response(Buffer.concat(chunks), { status: incoming.statusCode ?? 503, headers }));
        } catch { fail(); }
      });
    });
    outgoing.on('error', fail); outgoing.end(body);
  });
}

/** Injected transport is for synthetic tests; the CLI always uses secureTransport. */
export class CatalogLogin {
  #cookies = new Map<string, string>();
  private readonly transport: (request: Request) => Promise<Response>;
  private readonly signal: AbortSignal;
  constructor(transport: (request: Request) => Promise<Response> = secureTransport,
    signal: AbortSignal = AbortSignal.timeout(300000)) { this.transport = transport; this.signal = signal; }
  private cookies(response: Response): void {
    for (const raw of response.headers.getSetCookie()) {
      const parts = raw.split(';').map(v => v.trim()), pair = parts.shift()!, index = pair.indexOf('=');
      const name = pair.slice(0, index), value = pair.slice(index + 1);
      // No cookiejar export: retain only the two cookies needed by this flow.
      if (![COOKIE, CHALLENGE].includes(name)) continue;
      check(index > 0 && value.length <= 4096 && /^[A-Za-z0-9._~%+/=\-]*$/.test(value), 'cookie_denied');
      const attributes = new Map(parts.map(part => { const i = part.indexOf('='); return i < 0 ? [part.toLowerCase(), ''] : [part.slice(0, i).toLowerCase(), part.slice(i + 1)]; }));
      check(attributes.has('secure') && attributes.has('httponly') && attributes.get('path') === '/'
        && !attributes.has('domain') && attributes.get('samesite')?.toLowerCase() === 'lax', 'cookie_denied');
      if (!value || (attributes.has('max-age') && Number(attributes.get('max-age')) <= 0)
        || (attributes.has('expires') && Date.parse(attributes.get('expires')!) <= Date.now())) this.#cookies.delete(name);
      else this.#cookies.set(name, value);
    }
  }
  private async call(path: string, body?: ObjectValue): Promise<{ status: number; value: ObjectValue }> {
    check(/^\/api\/(?:auth\/(?:sign-in\/email|two-factor\/verify-totp|sign-out)|account|catalog\/legacy-import\?requestId=r37-session-[0-9a-f-]{36})$/.test(path), 'route_denied');
    const headers = new Headers({ origin: ORIGIN, 'x-stex-action': '1', accept: 'application/json' });
    if (this.#cookies.size) headers.set('cookie', [...this.#cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    if (body) headers.set('content-type', 'application/json');
    const request = new Request(ORIGIN + path, { method: body ? 'POST' : 'GET', headers,
      body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.any([this.signal, AbortSignal.timeout(15000)]) });
    let response: Response;
    try { response = await this.transport(request); }
    catch (error) {
      if (error instanceof SessionError && error.code === 'response_body_too_large') deny(error.code, error.httpStatus);
      deny('network_or_tls_failed');
    }
    check(!response.redirected && !(response.status >= 300 && response.status < 400)
      && (!response.url || response.url === request.url) && !response.headers.has('location'), 'redirect_or_origin_denied');
    check(response.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'response_content_type_denied', response.status);
    if (!response.body) deny('response_body_missing', response.status);
    const chunks: Uint8Array[] = [], reader = response.body.getReader(); let size = 0;
    let readError: SessionError | undefined;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX_RESPONSE) {
          try { await reader.cancel(); } catch { /* Keep the fixed size classification. */ }
          deny('response_body_too_large', response.status);
        }
        chunks.push(part.value);
      }
    } catch (error) {
      readError = error instanceof SessionError && error.code === 'response_body_too_large'
        ? error : new SessionError('response_body_read_failed', response.status);
    } finally { reader.releaseLock(); }
    if (readError) throw readError;
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { deny('response_json_invalid', response.status); }
    check(object(value), 'response_json_shape_denied', response.status);
    this.cookies(response);
    return { status: response.status, value };
  }
  async login(email: string, password: string, factor: () => Promise<string>): Promise<SessionDocument> {
    check(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 15 && password.length <= 128, 'input_denied');
    const started = Date.now();
    const signed = await this.call('/api/auth/sign-in/email', { email: email.toLowerCase(), password });
    password = '';
    check(signed.status === 200, signed.status === 429 ? 'rate_limited' : 'sign_in_denied');
    check(signed.value.twoFactorRedirect === true && Array.isArray(signed.value.twoFactorMethods)
      && signed.value.twoFactorMethods.includes('totp') && this.#cookies.has(CHALLENGE), 'admin_factor_required');
    let code = await factor(); check(/^\d{6}$/.test(code), 'factor_input_denied');
    const verified = await this.call('/api/auth/two-factor/verify-totp', { code, trustDevice: false }); code = '';
    check(verified.status === 200, verified.status === 429 ? 'rate_limited' : 'factor_denied');
    check(this.#cookies.has(COOKIE), 'session_missing');
    this.#cookies.delete(CHALLENGE);
    const account = await this.call('/api/account');
    check(account.status === 200 && account.value.contractVersion === 1 && object(account.value.account), 'admin_required');
    const who = account.value.account;
    check(who.role === 'admin' && who.status === 'active' && who.email === email.toLowerCase() && typeof who.userId === 'string' && !!who.userId, 'admin_required');
    const cookie = `${COOKIE}=${this.#cookies.get(COOKIE)}`;
    const fresh = await this.call(`/api/catalog/legacy-import?requestId=r37-session-${randomUUID()}`);
    // The real route checks active admin + fresh session/TOTP before the lookup.
    check(fresh.value.contractVersion === 1 && (fresh.status === 200 || (fresh.status === 404 && object(fresh.value.error) && fresh.value.error.code === 'not_found')), 'fresh_admin_required');
    check(Date.now() - started < 300000 && cookie === `${COOKIE}=${this.#cookies.get(COOKIE)}` && !this.signal.aborted, 'session_changed_or_expired');
    return { format: 'stex-catalog-session', version: 1, origin: ORIGIN, cookie };
  }
  async discard(): Promise<void> {
    if (this.#cookies.has(COOKIE) && !this.signal.aborted) { try { await this.call('/api/auth/sign-out', {}); } catch { /* Do not obscure the original sanitized failure. */ } }
    this.clear();
  }
  clear(): void { this.#cookies.clear(); }
}

type Identity = { dev: number; ino: number };
const identical = (a: Identity, b: Identity) => a.dev === b.dev && a.ino === b.ino;
async function ancestors(path: string): Promise<void> {
  let current: string = sep;
  for (const part of resolve(path).split(sep).filter(Boolean)) {
    current = resolve(current, part); const s = await lstat(current);
    check(!s.isSymbolicLink() && s.isDirectory() && [0, process.getuid?.()].includes(s.uid)
      && ((s.mode & 0o022) === 0 || (s.uid === 0 && (s.mode & 0o1000) !== 0)), 'unsafe_parent');
  }
}
export async function outputTarget(path: string): Promise<{ save(value: SessionDocument): Promise<void>; clean(): Promise<void> }> {
  check(isAbsolute(path) && resolve(path) === path && !/[\x00-\x1f\x7f]/.test(path)
    && path !== ROOT && !path.startsWith(ROOT + sep)
    && !path.split(sep).some(p => ['public', '.git', '.next', '.next-qa', 'node_modules'].includes(p.toLowerCase())), 'private_output_required');
  const parent = dirname(path); let created = false;
  await ancestors(dirname(parent));
  try { await mkdir(parent, { mode: 0o700 }); created = true; }
  catch (error) { if (!object(error) || error.code !== 'EEXIST') deny('private_output_required'); }
  const initial = await lstat(parent);
  const guard = async () => { await ancestors(parent); const s = await lstat(parent);
    check(identical(s, initial) && s.uid === process.getuid?.() && (s.mode & 0o777) === 0o700, 'private_output_required'); };
  await guard();
  try { await lstat(path); deny('output_exists'); } catch (error) { if (!object(error) || error.code !== 'ENOENT') throw error; }
  let own: Identity | undefined;
  return {
    async save(value) {
      await guard();
      const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try {
        own = await handle.stat();
        check(own && (await handle.stat()).uid === process.getuid?.(), 'private_output_required');
        await handle.writeFile(JSON.stringify(value) + '\n'); await handle.sync();
        await guard(); const s = await lstat(path);
        check(identical(s, own) && s.isFile() && s.nlink === 1 && s.uid === process.getuid?.() && (s.mode & 0o777) === 0o600, 'private_output_required');
      } finally { await handle.close(); }
    },
    async clean() {
      if (own) { const s = await lstat(path).catch(() => undefined); if (s && identical(s, own)) await unlink(path); }
      if (created) { const s = await lstat(parent).catch(() => undefined); if (s && identical(s, initial)) await rmdir(parent).catch(() => {}); }
    },
  };
}

/** Raw mode stays enabled across requests: early/pasted input never echoes. */
export function privateTerminal(input: ReadStream, output: WriteStream, pauseOnClose = false) {
  check(input.isTTY && output.isTTY && typeof input.setRawMode === 'function', 'private_tty_required');
  const abort = new AbortController(); let pending: { resolve(v: string): void; reject(e: unknown): void; value: string; max: number } | undefined;
  const previousRaw = !!input.isRaw, previousPaused = input.isPaused();
  const decoder = new StringDecoder('utf8');
  const stop = () => { abort.abort(); pending?.reject(new SessionError('input_cancelled')); pending = undefined; };
  const data = (bytes: Buffer) => {
    const text = decoder.write(bytes);
    if (/[\x03\x04\x1b]/.test(text)) { stop(); return; }
    if (!pending) return;
    const lineEnd = text.search(/[\r\n]/);
    if (lineEnd >= 0 && !/^(?:\r\n|\r|\n)$/.test(text.slice(lineEnd))) { stop(); return; }
    for (const c of text.slice(0, lineEnd < 0 ? undefined : lineEnd)) {
      if (c === '\x7f' || c === '\b') pending.value = [...pending.value].slice(0, -1).join('');
      else if (/[\x00-\x1f]/.test(c) || pending.value.length + c.length > pending.max) { stop(); return; }
      else pending.value += c;
    }
    if (lineEnd >= 0) { const done = pending; pending = undefined; output.write('\n'); done.resolve(done.value); }
  };
  input.setRawMode(true); input.resume(); input.on('data', data); input.on('end', stop); input.on('error', stop);
  process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('SIGHUP', stop);
  const timer = setTimeout(stop, 300000);
  return {
    signal: abort.signal,
    ask(label: string, max: number): Promise<string> {
      check(!abort.signal.aborted && !pending, 'input_cancelled'); output.write(label);
      return new Promise((resolve, reject) => { pending = { resolve, reject, value: '', max }; });
    },
    close() {
      clearTimeout(timer); stop(); input.off('data', data); input.off('end', stop); input.off('error', stop);
      process.off('SIGINT', stop); process.off('SIGTERM', stop); process.off('SIGHUP', stop);
      try { input.setRawMode(previousRaw); }
      finally { if (pauseOnClose || previousPaused) input.pause(); }
    },
  };
}

export async function main(argv: string[], dependencies: { transport?: (request: Request) => Promise<Response> } = {}): Promise<void> {
  check(argv.length === 2 && argv[0] === '--output', 'invalid_arguments'); tlsPolicy(process.env);
  check(process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY, 'private_tty_required');
  const target = await outputTarget(argv[1]);
  let terminal: ReturnType<typeof privateTerminal> | undefined;
  let login: CatalogLogin | undefined;
  let saved = false;
  try {
    terminal = privateTerminal(process.stdin, process.stderr, true);
    const activeTerminal = terminal;
    login = new CatalogLogin(dependencies.transport ?? secureTransport, AbortSignal.any([terminal.signal, AbortSignal.timeout(300000)]));
    let email = (await terminal.ask('E-Mail (verborgen): ', 254)).trim();
    let password = await terminal.ask('Passwort (verborgen): ', 128);
    let document = await login.login(email, password, () => activeTerminal.ask('Authenticator-Code (verborgen): ', 6));
    email = ''; password = '';
    await target.save(document); document = { ...document, cookie: '' };
    check(!terminal.signal.aborted, 'input_cancelled');
    saved = true;
  } finally {
    try { if (!saved) { await login?.discard(); await target.clean(); } }
    finally { login?.clear(); terminal?.close(); }
  }
  process.stdout.write(JSON.stringify({ code: 'session_saved', path: argv[1] }) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main(process.argv.slice(2)).catch(error => {
    process.stderr.write(JSON.stringify(sessionFailureOutput(error)) + '\n'); process.exitCode = 1;
  });
}
