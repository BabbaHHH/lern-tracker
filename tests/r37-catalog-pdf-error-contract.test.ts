import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { runWorkflow, type WorkflowResult } from '../scripts/data-migration/catalog-pdf-start.mts';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY_RELATIVE = 'scripts/data-migration/catalog-apply.mts';
const CONFIG_RELATIVE = 'deploy/pilot/targets/contabo-test/import-r37-20261025/pdf-run-config.json';
const CORE_SHA256 = 'dda48b8f5fed009f6a262e392aecb66841c9391d7e4ec5f03fe18c0f29f95d9d';
const TARGET = { database: 'stex_rollback_r36_20261023', schemaVersion: 18, fileRoot: '/srv/stex/data/contabo-test/r36-rollback-20261023/files' };
const RECEIPTS_SHA256 = 'a'.repeat(64);
const BINDINGS_SHA256 = 'b'.repeat(64);
const PROGRESS = { metadataDone: 5, metadataTotal: 5, pdfDone: 0, pdfTotal: 449, pendingPdf: 1 };

type SyntheticChild = EventEmitter & {
  stdout: PassThrough | null;
  stderr: PassThrough | null;
  kill: (signal?: NodeJS.Signals) => boolean;
};

function sha256(value: Uint8Array | string): string { return createHash('sha256').update(value).digest('hex'); }

function childProcess(interactive: boolean): SyntheticChild {
  const child = new EventEmitter() as SyntheticChild;
  child.stdout = interactive ? null : new PassThrough();
  child.stderr = interactive ? null : new PassThrough();
  child.kill = () => true;
  return child;
}

function finishChild(child: SyntheticChild, code: number, stdout = '', stderr = ''): void {
  const streams = [
    ...(child.stdout ? [{ stream: child.stdout, text: stdout }] : []),
    ...(child.stderr ? [{ stream: child.stderr, text: stderr }] : []),
  ];
  if (!streams.length) { setImmediate(() => child.emit('close', code, null)); return; }
  let pending = streams.length;
  const complete = () => {
    pending -= 1;
    if (pending === 0) child.emit('close', code, null);
  };
  for (const { stream, text } of streams) {
    stream.once('end', complete);
    stream.end(text);
  }
}

async function fixture(stderr: string): Promise<{ run: () => Promise<WorkflowResult>; cleanup: () => Promise<void> }> {
  const tempParent = await realpath(tmpdir());
  const tempRoot = await mkdtemp(join(tempParent, 'r37-catalog-pdf-error-'));
  const workspaceRoot = join(tempRoot, 'workspace');
  const homeDirectory = join(tempRoot, 'home');
  const privateDir = join(homeDirectory, '.stex-catalog-import');
  const stateDir = join(privateDir, 'r37-apply-state-20261025');
  await mkdir(workspaceRoot, { mode: 0o700 });
  await mkdir(homeDirectory, { mode: 0o700 });
  await mkdir(privateDir, { mode: 0o700 });
  await mkdir(stateDir, { mode: 0o700 });

  const applyPath = join(workspaceRoot, APPLY_RELATIVE);
  await mkdir(dirname(applyPath), { recursive: true, mode: 0o700 });
  await copyFile(join(REPOSITORY_ROOT, APPLY_RELATIVE), applyPath);

  const gatePath = join(tempRoot, 'synthetic-pdf-gate.json');
  const now = Date.now();
  const gate = {
    format: 'stex-r37-catalog-apply-gate', version: 1, phase: 'pdf',
    origin: 'https://stex.62-171-162-115.sslip.io', target: TARGET,
    coreSha256: CORE_SHA256, operatorSha256: sha256(await readFile(applyPath)),
    releaseManifestSha256: 'c'.repeat(64), sourcePackageSha256: 'd'.repeat(64), backupManifestSha256: 'e'.repeat(64),
    backupCapturedAt: new Date(now - 600_000).toISOString(), restoreVerifiedAt: new Date(now - 300_000).toISOString(),
    restoreReference: 'synthetic-only-restore', targetSnapshotSha256: 'f'.repeat(64), targetSnapshotReference: 'synthetic-only-snapshot',
    issuedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 600_000).toISOString(),
    metadataReceiptsSha256: RECEIPTS_SHA256, pdfBindingsSha256: BINDINGS_SHA256,
  };
  const gateBytes = `${JSON.stringify(gate)}\n`;
  await writeFile(gatePath, gateBytes, { mode: 0o600 });
  const configPath = join(workspaceRoot, CONFIG_RELATIVE);
  await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
  await writeFile(configPath, `${JSON.stringify({
    format: 'stex-r37-catalog-pdf-start-config', version: 1,
    sourceRoot: join(tempRoot, 'synthetic-source-root'),
    pdfGate: { path: gatePath, sha256: sha256(gateBytes) },
  })}\n`, { mode: 0o600 });

  const summary = JSON.stringify({
    planSha256: CORE_SHA256, metadataDone: 5, metadataTotal: 5, pdfDone: 0, pdfTotal: 449,
    pendingMetadata: [], pendingPdf: ['synthetic-pending-request'],
    pdfBindingsSha256: BINDINGS_SHA256, metadataReceiptsSha256: RECEIPTS_SHA256,
  }) + '\n';

  const spawnImpl = ((command: string, args: string[], options: SpawnOptions): ChildProcess => {
    assert.equal(command, process.execPath);
    const childScript = basename(args[2] ?? '');
    const child = childProcess(options.stdio === 'inherit');
    if (childScript === 'catalog-session.mts') {
      assert.equal(options.stdio, 'inherit');
      const sessionPath = args[4];
      assert.equal(args[3], '--output');
      assert.ok(sessionPath);
      void writeFile(sessionPath, '{"synthetic":true}\n', { mode: 0o600 })
        .then(() => finishChild(child, 0));
    } else {
      assert.equal(childScript, 'catalog-apply.mts');
      assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
      if (args[3] === 'status') finishChild(child, 0, summary);
      else {
        assert.equal(args[3], 'apply-pdfs');
        finishChild(child, 7, '', stderr);
      }
    }
    return child as unknown as ChildProcess;
  }) as (command: string, args: string[], options: SpawnOptions) => ChildProcess;

  return {
    run: () => runWorkflow({ workspaceRoot, homeDirectory, spawnImpl }),
    cleanup: () => rm(tempRoot, { recursive: true, force: true }),
  };
}

async function runAndClean(stderr: string): Promise<WorkflowResult> {
  const f = await fixture(stderr);
  try { return await f.run(); }
  finally { await f.cleanup(); }
}

test('passes one allowlisted fixed ApplyError code while retaining exit status and offline progress', async () => {
  const result = await runAndClean('{"error":"response_unknown"}\n');
  assert.deepEqual(result, { progress: PROGRESS, exitCode: 7, errorCode: 'response_unknown' });
});

test('hides unknown and path-injected child error content', async () => {
  const secretPath = '/private/synthetic/source-secret.pdf';
  const result = await runAndClean(`${JSON.stringify({ error: `response_unknown ${secretPath}` })}\n`);
  assert.deepEqual(result, { progress: PROGRESS, exitCode: 7, errorCode: 'helper_failed' });
  assert.equal(JSON.stringify(result).includes(secretPath), false);
});

test('rejects extra fields even when the error field is allowlisted', async () => {
  const secretPath = '/private/synthetic/extra-field-secret.pdf';
  const result = await runAndClean(`${JSON.stringify({ error: 'response_unknown', detail: secretPath })}\n`);
  assert.deepEqual(result, { progress: PROGRESS, exitCode: 7, errorCode: 'helper_failed' });
  assert.equal(JSON.stringify(result).includes(secretPath), false);
});

test('rejects duplicate JSON keys instead of accepting the parsed last value', async () => {
  const result = await runAndClean('{"error":"unknown_operator_error","error":"response_unknown"}\n');
  assert.deepEqual(result, { progress: PROGRESS, exitCode: 7, errorCode: 'helper_failed' });
});

test('overlong child stderr stays generic without losing the child exit code or actual status counts', async () => {
  const secretPath = '/private/synthetic/overlong-secret.pdf';
  const result = await runAndClean(`{"error":"response_unknown"}\n${secretPath}\n${'x'.repeat(4096)}`);
  assert.deepEqual(result, { progress: PROGRESS, exitCode: 7, errorCode: 'helper_failed' });
  assert.equal(JSON.stringify(result).includes(secretPath), false);
});
