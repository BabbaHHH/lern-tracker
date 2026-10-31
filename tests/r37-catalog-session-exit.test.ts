import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('helper emits session_saved after TTY cleanup, closes, and lets its waiting parent continue', async () => {
  const tempParent = await realpath(tmpdir());
  const tempRoot = await mkdtemp(join(tempParent, 'r37-session-exit-'));
  const sessionPath = join(tempRoot, 'private', 'synthetic-session.json');
  const harnessPath = join(tempRoot, 'synthetic-login-child.mts');
  const sessionModuleUrl = pathToFileURL(join(REPOSITORY_ROOT, 'scripts/data-migration/catalog-session.mts')).href;
  const syntheticEmail = 'synthetic@example.test';
  const syntheticPassword = 'Synthetic-Password-12345';
  const syntheticFactor = '123456';
  const promptValues = [syntheticEmail, syntheticPassword, syntheticFactor];
  const prompts = ['E-Mail (verborgen): ', 'Passwort (verborgen): ', 'Authenticator-Code (verborgen): '];
  const source = [
    `import { main } from ${JSON.stringify(sessionModuleUrl)};`,
    'const input = process.stdin;',
    "Object.defineProperty(input, 'isTTY', { configurable: true, value: true });",
    "Object.defineProperty(input, 'isRaw', { configurable: true, writable: true, value: false });",
    "Object.defineProperty(input, 'setRawMode', { configurable: true, value: mode => { input.isRaw = mode; return input; } });",
    "Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });",
    "Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true });",
    'input.resume();',
    "const originalPause = input.pause.bind(input); input.pause = (...args) => { process.stdout.write('TTY_PAUSED\\n'); return originalPause(...args); };",
    'const json = (value, status = 200, extraHeaders = {}) => new Response(JSON.stringify(value), {',
    "  status, headers: { 'content-type': 'application/json', ...extraHeaders },",
    '});',
    'const transport = async request => {',
    '  const path = new URL(request.url).pathname;',
    "  if (path === '/api/auth/sign-in/email') return json({ twoFactorRedirect: true, twoFactorMethods: ['totp'] }, 200, { 'set-cookie': '__Secure-better-auth.two_factor=synthetic-challenge; Path=/; HttpOnly; Secure; SameSite=Lax' });",
    "  if (path === '/api/auth/two-factor/verify-totp') return json({}, 200, { 'set-cookie': '__Secure-better-auth.session_token=synthetic-session; Path=/; HttpOnly; Secure; SameSite=Lax' });",
    "  if (path === '/api/account') return json({ contractVersion: 1, account: { role: 'admin', status: 'active', email: 'synthetic@example.test', userId: 'synthetic-admin' } });",
    "  if (path === '/api/catalog/legacy-import') return json({ contractVersion: 1, error: { code: 'not_found' } }, 404);",
    "  throw new Error('unexpected synthetic route');",
    '};',
    `void main(['--output', ${JSON.stringify(sessionPath)}], { transport }).catch(() => {`,
    "  process.stderr.write('synthetic_login_failed\\n'); process.exitCode = 1;",
    '});',
  ].join('\n');
  await writeFile(harnessPath, `${source}\n`, { mode: 0o600 });

  const child = spawn(process.execPath, ['--no-warnings', '--experimental-strip-types', harnessPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let promptIndex = 0;
  child.stdout?.on('data', (part: Buffer) => { stdout += part.toString('utf8'); });
  child.stderr?.on('data', (part: Buffer) => {
    stderr += part.toString('utf8');
    while (promptIndex < prompts.length && stderr.includes(prompts[promptIndex])) {
      child.stdin?.write(`${promptValues[promptIndex]}\n`);
      promptIndex++;
    }
  });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise);
    child.once('close', (code, signal) => resolvePromise({ code, signal }));
  });
  let timeout: NodeJS.Timeout | undefined;
  try {
    const outcome = await Promise.race([
      closed,
      new Promise<never>((_resolvePromise, rejectPromise) => {
        timeout = setTimeout(() => rejectPromise(new Error('synthetic login child did not close')), 2_500);
      }),
    ]);
    assert.equal(outcome.code, 0);
    assert.equal(outcome.signal, null);
    assert.equal(promptIndex, 3);
    assert.ok(stdout.includes('"code":"session_saved"'));
    assert.ok(stdout.indexOf('TTY_PAUSED') >= 0 && stdout.indexOf('TTY_PAUSED') < stdout.indexOf('session_saved'));
    assert.equal([stdout, stderr].some(value => value.includes(syntheticPassword) || value.includes(syntheticFactor)), false);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    child.stdin?.end();
    await closed.catch(() => undefined);
    await rm(tempRoot, { recursive: true, force: true });
  }
});
