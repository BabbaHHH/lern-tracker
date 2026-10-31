import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CatalogLogin, SessionError, sessionFailureOutput, type SessionDocument } from '../scripts/data-migration/catalog-session.mts';

const MAX_RESPONSE = 65_536;
const EMAIL = 'synthetic@example.test';
const PASSWORD = 'synthetic-password-123';
const CHALLENGE_COOKIE = '__Secure-better-auth.two_factor';
const SESSION_COOKIE = '__Secure-better-auth.session_token';
type Transport = (request: Request) => Promise<Response>;

function jsonResponse(value: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(value), { status, headers });
}

async function captureLoginError(transport: Transport): Promise<SessionError> {
  const login = new CatalogLogin(transport, AbortSignal.timeout(10_000));
  let caught: unknown;
  try {
    await login.login(EMAIL, PASSWORD, async () => { throw new Error('synthetic factor prompt should not run'); });
  } catch (error) { caught = error; }
  finally { login.clear(); }
  assert.ok(caught instanceof SessionError, 'login should reject with a fixed SessionError');
  return caught;
}

function expectDiagnostic(error: SessionError, code: string, httpStatus?: number): void {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.equal(error.httpStatus, httpStatus);
}

test('reports only a fixed code and numeric status for a non-JSON response', async () => {
  const error = await captureLoginError(async () => new Response('synthetic response body', {
    status: 502, headers: { 'content-type': 'text/html; synthetic=private-value' },
  }));
  expectDiagnostic(error, 'response_content_type_denied', 502);
});

test('distinguishes a response with no body', async () => {
  const error = await captureLoginError(async () => new Response(null, {
    status: 204, headers: { 'content-type': 'application/json' },
  }));
  expectDiagnostic(error, 'response_body_missing', 204);
});

test('rejects a body one byte above the unchanged response limit', async () => {
  const error = await captureLoginError(async () => new Response('x'.repeat(MAX_RESPONSE + 1), {
    status: 413, headers: { 'content-type': 'application/json' },
  }));
  expectDiagnostic(error, 'response_body_too_large', 413);
});

test('accepts exactly the configured body limit for JSON parsing', async () => {
  const prefix = '{"payload":"';
  const suffix = '"}';
  const body = `${prefix}${'x'.repeat(MAX_RESPONSE - prefix.length - suffix.length)}${suffix}`;
  assert.equal(Buffer.byteLength(body), MAX_RESPONSE);
  const error = await captureLoginError(async () => new Response(body, {
    status: 401, headers: { 'content-type': 'application/json' },
  }));
  expectDiagnostic(error, 'sign_in_denied');
});

test('maps a rejected response stream to a fixed read-failure code', async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.error(new Error('synthetic stream failure')); },
  });
  const error = await captureLoginError(async () => new Response(body, {
    status: 502, headers: { 'content-type': 'application/json' },
  }));
  expectDiagnostic(error, 'response_body_read_failed', 502);
});

test('distinguishes invalid JSON syntax', async () => {
  const error = await captureLoginError(async () => new Response('{', {
    status: 502, headers: { 'content-type': 'application/json' },
  }));
  expectDiagnostic(error, 'response_json_invalid', 502);
});

test('distinguishes valid JSON with the wrong top-level shape', async () => {
  const error = await captureLoginError(async () => new Response('[]', {
    status: 502, headers: { 'content-type': 'application/json' },
  }));
  expectDiagnostic(error, 'response_json_shape_denied', 502);
});

test('preserves the transport size category and only a numeric status', async () => {
  const error = await captureLoginError(async () => { throw new SessionError('response_body_too_large', 413); });
  expectDiagnostic(error, 'response_body_too_large', 413);
});

test('keeps other transport failures in the existing generic category', async () => {
  const error = await captureLoginError(async () => { throw new Error('synthetic private transport detail'); });
  expectDiagnostic(error, 'network_or_tls_failed');
});

test('serializes only a fixed code and an allowlisted numeric HTTP status', () => {
  assert.deepEqual(sessionFailureOutput(new SessionError('response_json_invalid', 502)), {
    code: 'response_json_invalid', status: 502,
  });
  assert.deepEqual(sessionFailureOutput(new SessionError('network_or_tls_failed', 502)), {
    code: 'network_or_tls_failed',
  });
  const hidden = sessionFailureOutput(new Error('synthetic private transport detail'));
  assert.deepEqual(hidden, { code: 'login_or_private_output_failed' });
  assert.equal(JSON.stringify(hidden).includes('synthetic private transport detail'), false);
  assert.deepEqual(sessionFailureOutput(new SessionError('synthetic private /path detail', 502)), {
    code: 'login_or_private_output_failed',
  });
  assert.deepEqual(sessionFailureOutput(new SessionError('response_json_invalid', 700)), {
    code: 'response_json_invalid',
  });
});

test('keeps redirect denial separate from response-shape diagnostics', async () => {
  const error = await captureLoginError(async () => new Response(null, {
    status: 302, headers: { location: 'https://redirect.synthetic.invalid/private' },
  }));
  expectDiagnostic(error, 'redirect_or_origin_denied');
});

test('keeps secure cookie validation before TOTP verification', async () => {
  const error = await captureLoginError(async () => jsonResponse(
    { twoFactorRedirect: true, twoFactorMethods: ['totp'] }, 200,
    [`${CHALLENGE_COOKIE}=synthetic-challenge; Path=/; Secure; SameSite=Lax`],
  ));
  expectDiagnostic(error, 'cookie_denied');
});

test('continues through the existing successful TOTP challenge flow', async () => {
  const calls: Array<{ method: string; path: string }> = [];
  let factorCalls = 0;
  const transport: Transport = async request => {
    const url = new URL(request.url);
    calls.push({ method: request.method, path: `${url.pathname}${url.search}` });
    if (url.pathname === '/api/auth/sign-in/email') {
      return jsonResponse({ twoFactorRedirect: true, twoFactorMethods: ['totp'] }, 200,
        [`${CHALLENGE_COOKIE}=synthetic-challenge; Path=/; Secure; HttpOnly; SameSite=Lax`]);
    }
    if (url.pathname === '/api/auth/two-factor/verify-totp') {
      return jsonResponse({ verified: true }, 200,
        [`${SESSION_COOKIE}=synthetic-session; Path=/; Secure; HttpOnly; SameSite=Lax`]);
    }
    if (url.pathname === '/api/account') {
      return jsonResponse({ contractVersion: 1, account: {
        role: 'admin', status: 'active', email: EMAIL, userId: 'synthetic-admin',
      } });
    }
    if (url.pathname === '/api/catalog/legacy-import') {
      return jsonResponse({ contractVersion: 1, error: { code: 'not_found' } }, 404);
    }
    assert.fail('unexpected synthetic route');
  };

  const login = new CatalogLogin(transport, AbortSignal.timeout(10_000));
  let session: SessionDocument;
  try {
    session = await login.login(EMAIL, PASSWORD, async () => { factorCalls += 1; return '123456'; });
  } finally { login.clear(); }

  assert.equal(factorCalls, 1);
  assert.deepEqual(calls.slice(0, 3), [
    { method: 'POST', path: '/api/auth/sign-in/email' },
    { method: 'POST', path: '/api/auth/two-factor/verify-totp' },
    { method: 'GET', path: '/api/account' },
  ]);
  assert.equal(calls[3].method, 'GET');
  assert.match(calls[3].path, /^\/api\/catalog\/legacy-import\?requestId=r37-session-[0-9a-f-]{36}$/);
  assert.equal(session.format, 'stex-catalog-session');
  assert.equal(session.version, 1);
  assert.equal(session.cookie, `${SESSION_COOKIE}=synthetic-session`);
});
