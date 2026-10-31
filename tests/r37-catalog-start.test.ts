import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { lstat, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { runWorkflow, StartFailure } from '../scripts/data-migration/catalog-start.mts';

const TARGET = { database: 'stex_rollback_r36_20261023', schemaVersion: 18, fileRoot: '/srv/stex/data/contabo-test/r36-rollback-20261023/files' };
const CORE_SHA256 = 'dda48b8f5fed009f6a262e392aecb66841c9391d7e4ec5f03fe18c0f29f95d9d';
const INITIAL = {
  planSha256: CORE_SHA256, metadataDone: 0, metadataTotal: 5, pdfDone: 0, pdfTotal: 449,
  pendingMetadata: [], pendingPdf: [], pdfBindingsSha256: null, metadataReceiptsSha256: null,
};
const METADATA_COMPLETE = { ...INITIAL, metadataDone: 5 };
const COMPLETE = {
  ...METADATA_COMPLETE,
  pdfBindingsSha256: '4'.repeat(64), metadataReceiptsSha256: '5'.repeat(64),
};

type ChildOutcome = { code: number | null; signal: NodeJS.Signals | null; output?: unknown };
type FixtureOptions = { login?: ChildOutcome; apply?: ChildOutcome; existingConfig?: boolean; existingState?: 'normal' | 'locked'; existingBindings?: boolean };

function hash(bytes: string | Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }
function jsonChild(value: unknown): string { return `${JSON.stringify(value)}\n`; }

async function fixture(options: FixtureOptions = {}) {
  const tempBase = await realpath(tmpdir());
  const workspaceRoot = await mkdtemp(join(tempBase, 'r37-catalog-start-'));
  const homeDirectory = join(workspaceRoot, 'home');
  await mkdir(homeDirectory, { mode: 0o700 });
  const privateRoot = join(homeDirectory, '.stex-catalog-import');
  const stateDir = join(privateRoot, 'r37-apply-state-20261025');
  let lockPath: string | undefined;
  if (options.existingState) {
    await mkdir(stateDir, { recursive: true, mode: 0o700 });
    if (options.existingState === 'locked') {
      lockPath = join(stateDir, 'operator.lock');
      await writeFile(lockPath, 'test-only lock placeholder\n', { mode: 0o600 });
    }
  }
  const scripts = join(workspaceRoot, 'scripts/data-migration');
  await mkdir(scripts, { recursive: true });
  const applyPath = join(scripts, 'catalog-apply.mts');
  const sessionPath = join(scripts, 'catalog-session.mts');
  await writeFile(applyPath, 'fixture apply operator\n', { mode: 0o600 });
  await writeFile(sessionPath, 'fixture login helper\n', { mode: 0o600 });

  if (options.existingConfig !== false) {
    const now = Date.now();
    const gatePath = join(workspaceRoot, 'metadata-gate.json');
    const gate = {
      format: 'stex-r37-catalog-apply-gate', version: 1, phase: 'metadata',
      origin: 'https://stex.62-171-162-115.sslip.io', target: TARGET,
      coreSha256: CORE_SHA256, operatorSha256: hash(await readFile(applyPath)),
      releaseManifestSha256: 'a'.repeat(64), sourcePackageSha256: 'b'.repeat(64),
      backupManifestSha256: 'c'.repeat(64), backupCapturedAt: new Date(now - 600_000).toISOString(),
      restoreVerifiedAt: new Date(now - 300_000).toISOString(), restoreReference: 'test-only fake restore reference',
      targetSnapshotSha256: 'd'.repeat(64), targetSnapshotReference: 'test-only fake snapshot reference',
      issuedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 600_000).toISOString(),
      metadataReceiptsSha256: null, pdfBindingsSha256: null,
    };
    const gateBytes = `${JSON.stringify(gate)}\n`;
    await writeFile(gatePath, gateBytes, { mode: 0o600 });
    const configPath = join(workspaceRoot, 'deploy/pilot/targets/contabo-test/import-r37-20261025/run-config.json');
    await mkdir(join(workspaceRoot, 'deploy/pilot/targets/contabo-test/import-r37-20261025'), { recursive: true });
    await writeFile(configPath, `${JSON.stringify({
      format: 'stex-r37-catalog-start-config', version: 1,
      sourceRoot: join(workspaceRoot, 'private-source-root'),
      metadataGate: { path: gatePath, sha256: hash(gateBytes) },
    })}\n`, { mode: 0o600 });
  }

  const calls: string[] = [];
  const commandArgs: string[][] = [];
  let statusCalls = 0;
  const suppliedApplyOutput = options.apply?.output;
  const completedApplyState = suppliedApplyOutput && typeof suppliedApplyOutput === 'object' && !Array.isArray(suppliedApplyOutput)
    ? Object.fromEntries(Object.entries(suppliedApplyOutput as Record<string, unknown>).filter(([key]) => key !== 'mode'))
    : METADATA_COMPLETE;
  const spawnImpl = ((command: string, args: string[], spawnOptions: SpawnOptions) => {
    assert.ok(command.length > 0);
    assert.equal(spawnOptions.shell, undefined);
    const script = args[2];
    const name = basename(script);
    const action = name === 'catalog-session.mts' ? 'login' : args[3];
    calls.push(String(action));
    commandArgs.push([...args]);

    let outcome: ChildOutcome = { code: 0, signal: null };
    let output: unknown = {};
    if (action === 'inspect') output = { mode: 'offline-inspect', records: 449, metadataBatches: 5, pdfTemplates: 449, planSha256: CORE_SHA256, runnable: false };
    else if (action === 'prepare') output = { mode: 'offline-prepare', ...INITIAL };
    else if (action === 'status') {
      statusCalls++;
      const applyOutcome = options.apply ?? { code: 0, signal: null };
      output = statusCalls === 1
        ? (options.existingBindings ? COMPLETE : INITIAL)
        : (applyOutcome.code === 0 && !applyOutcome.signal ? (options.existingBindings ? COMPLETE : completedApplyState) : INITIAL);
    }
    else if (action === 'login') outcome = options.login ?? { code: 0, signal: null };
    else if (action === 'apply-metadata') {
      outcome = options.apply ?? { code: 0, signal: null };
      const applySummary = outcome.output && typeof outcome.output === 'object' && !Array.isArray(outcome.output)
        ? outcome.output as Record<string, unknown> : (options.existingBindings ? COMPLETE : METADATA_COMPLETE);
      output = { mode: 'apply-metadata', ...applySummary };
    }
    else if (action === 'prepare-pdfs') output = { mode: 'online-read-only-bind', ...COMPLETE };

    const emitter = new EventEmitter() as EventEmitter & { stdout?: PassThrough | null; stderr?: PassThrough | null; kill?: () => boolean };
    const pipes = spawnOptions.stdio !== 'inherit';
    emitter.stdout = pipes ? new PassThrough() : null;
    emitter.stderr = pipes ? new PassThrough() : null;
    queueMicrotask(() => { void (async () => {
      if (action === 'login' && outcome.code === 0 && outcome.signal === null) {
        await writeFile(args[4], 'test-only empty session placeholder\n', { mode: 0o600 });
      }
      if (pipes) {
        emitter.stdout?.end(jsonChild(output));
        emitter.stderr?.end();
      }
      emitter.emit('close', outcome.code, outcome.signal);
    })(); });
    return emitter as unknown as ChildProcess;
  }) as (command: string, args: string[], options: SpawnOptions) => ChildProcess;

  return {
    workspaceRoot, homeDirectory, calls, commandArgs, stateDir, lockPath,
    run: () => runWorkflow({ workspaceRoot, homeDirectory, spawnImpl }),
    cleanup: () => rm(workspaceRoot, { recursive: true, force: true }),
  };
}

test('missing run config stops before any helper or login starts', async () => {
  const f = await fixture({ existingConfig: false });
  try {
    await assert.rejects(f.run(), (error: unknown) => error instanceof StartFailure && error.code === 'run_config_missing');
    assert.deepEqual(f.calls, []);
  } finally { await f.cleanup(); }
});

test('login failure or abort never starts apply and preserves the child exit status', async t => {
  for (const scenario of [
    { name: 'nonzero exit', outcome: { code: 17, signal: null }, expectedExit: 17 },
    { name: 'terminal abort', outcome: { code: null, signal: 'SIGINT' as const }, expectedExit: 130 },
  ]) {
    await t.test(scenario.name, async () => {
      const f = await fixture({ login: scenario.outcome });
      try {
        await assert.rejects(f.run(), (error: unknown) => error instanceof StartFailure && error.exitCode === scenario.expectedExit);
        assert.deepEqual(f.calls, ['inspect', 'prepare', 'status', 'login']);
        assert.ok(!f.calls.includes('apply-metadata'));
        assert.ok(!f.calls.includes('prepare-pdfs'));
        assert.ok(!f.calls.includes('apply-pdfs'));
      } finally { await f.cleanup(); }
    });
  }
});

test('metadata helper failure stops before any PDF operation and keeps its exit status', async () => {
  const f = await fixture({ apply: { code: 23, signal: null } });
  try {
    await assert.rejects(f.run(), (error: unknown) => error instanceof StartFailure && error.exitCode === 23);
    assert.deepEqual(f.calls, ['inspect', 'prepare', 'status', 'login', 'apply-metadata']);
    assert.ok(!f.calls.includes('prepare-pdfs'));
    assert.ok(!f.calls.includes('apply-pdfs'));
  } finally { await f.cleanup(); }
});

test('an existing checkpoint is inspected and reused without prepare or lock recovery', async () => {
  const f = await fixture({ existingState: 'normal' });
  try {
    const result = await f.run();
    assert.equal(result.kind, 'handoff');
    assert.deepEqual(f.calls, ['inspect', 'status', 'login', 'apply-metadata', 'status', 'prepare-pdfs']);
    const applyArgs = f.commandArgs.find(args => args[3] === 'apply-metadata');
    assert.ok(applyArgs);
    assert.equal(applyArgs[applyArgs.indexOf('--state-dir') + 1], f.stateDir);
    assert.ok(!f.calls.includes('prepare'));
    assert.ok(!f.calls.includes('recover-lock'));
    assert.ok(!f.calls.includes('apply-pdfs'));
  } finally { await f.cleanup(); }
});

test('an existing operator lock is preserved and stops before login', async () => {
  const f = await fixture({ existingState: 'locked' });
  try {
    await assert.rejects(f.run(), (error: unknown) => error instanceof StartFailure && error.code === 'state_lock_requires_review');
    assert.deepEqual(f.calls, ['inspect']);
    assert.ok(f.lockPath);
    assert.ok((await lstat(f.lockPath)).isFile());
  } finally { await f.cleanup(); }
});

test('completed metadata produces only the sanitized read-only handoff; no PDF writer starts', async () => {
  const f = await fixture();
  try {
    const result = await f.run();
    assert.deepEqual(f.calls, ['inspect', 'prepare', 'status', 'login', 'apply-metadata', 'status', 'prepare-pdfs']);
    assert.deepEqual(result, {
      kind: 'handoff',
      handoff: {
        coreHash: CORE_SHA256, metadataReceiptsSha256: '5'.repeat(64), pdfBindingsSha256: '4'.repeat(64),
        metadataDone: 5, metadataTotal: 5, pdfBindingCount: 449,
      },
    });
    assert.ok(!f.calls.includes('apply-pdfs'));
  } finally { await f.cleanup(); }
});

test('partial metadata completion stops before PDF binding', async () => {
  const partial = { ...METADATA_COMPLETE, metadataDone: 2, pendingMetadata: ['open-request'] };
  const f = await fixture({ apply: { code: 0, signal: null, output: partial } });
  try {
    assert.deepEqual(await f.run(), { kind: 'metadata-incomplete', metadataDone: 2, metadataTotal: 5 });
    assert.deepEqual(f.calls, ['inspect', 'prepare', 'status', 'login', 'apply-metadata', 'status']);
    assert.ok(!f.calls.includes('prepare-pdfs'));
    assert.ok(!f.calls.includes('apply-pdfs'));
  } finally { await f.cleanup(); }
});

test('an existing PDF binding is handed off without a second binding attempt', async () => {
  const f = await fixture({ existingState: 'normal', existingBindings: true });
  try {
    const result = await f.run();
    assert.deepEqual(f.calls, ['inspect', 'status', 'login', 'apply-metadata', 'status']);
    assert.equal(result.kind, 'handoff');
    assert.ok(!f.calls.includes('prepare-pdfs'));
    assert.ok(!f.calls.includes('apply-pdfs'));
  } finally { await f.cleanup(); }
});
