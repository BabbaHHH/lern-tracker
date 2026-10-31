import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn as spawnChild, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runWorkflow, StartFailure } from '../scripts/data-migration/catalog-start.mts';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY_RELATIVE = 'scripts/data-migration/catalog-apply.mts';
const SESSION_RELATIVE = 'scripts/data-migration/catalog-session.mts';
const CORE_RELATIVE = 'docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-CORE.json';
const METADATA_RELATIVE = 'docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-METADATEN-VORLAGEN.json';
const PDF_RELATIVE = 'docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-PDF-VORLAGEN.json';
const CORE_SHA256 = 'dda48b8f5fed009f6a262e392aecb66841c9391d7e4ec5f03fe18c0f29f95d9d';
const TARGET = { database: 'stex_rollback_r36_20261023', schemaVersion: 18, fileRoot: '/srv/stex/data/contabo-test/r36-rollback-20261023/files' };
const SUMMARY_FIELDS = [
  'planSha256', 'metadataDone', 'metadataTotal', 'pdfDone', 'pdfTotal', 'pendingMetadata', 'pendingPdf',
  'pdfBindingsSha256', 'metadataReceiptsSha256',
].sort();

function sha256(value: Uint8Array | string): string { return createHash('sha256').update(value).digest('hex'); }

async function runOfflinePrepare(workspaceRoot: string, applyPath: string, stateDir: string): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string }> {
  const args = [
    '--no-warnings', '--experimental-strip-types', applyPath, 'prepare',
    '--core', join(workspaceRoot, CORE_RELATIVE),
    '--metadata-templates', join(workspaceRoot, METADATA_RELATIVE),
    '--pdf-templates', join(workspaceRoot, PDF_RELATIVE),
    '--state-dir', stateDir,
  ];
  const child = spawnChild(process.execPath, args, { cwd: workspaceRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout?.on('data', (part: Buffer) => { stdout += part.toString('utf8'); });
  child.stderr?.on('data', () => {});
  return await new Promise((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise);
    child.once('close', (code, signal) => resolvePromise({ code, signal, stdout }));
  });
}

test('real offline apply CLI output reaches login while preserving an existing synthetic checkpoint', async () => {
  const tempParent = await realpath(tmpdir());
  const tempRoot = await mkdtemp(join(tempParent, 'r37-catalog-start-real-offline-'));
  try {
    const workspaceRoot = join(tempRoot, 'workspace');
    const homeDirectory = join(tempRoot, 'home');
    await mkdir(workspaceRoot, { mode: 0o700 });
    await mkdir(homeDirectory, { mode: 0o700 });
    const privateRoot = join(homeDirectory, '.stex-catalog-import');
    const stateDir = join(privateRoot, 'r37-apply-state-20261025');
    await mkdir(privateRoot, { mode: 0o700 });

    for (const relativePath of [APPLY_RELATIVE, CORE_RELATIVE, METADATA_RELATIVE, PDF_RELATIVE]) {
      const destination = join(workspaceRoot, relativePath);
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await copyFile(join(REPOSITORY_ROOT, relativePath), destination);
    }

    const now = Date.now();
    const applyPath = join(workspaceRoot, APPLY_RELATIVE);
    const gatePath = join(tempRoot, 'synthetic-metadata-gate.json');
    const gate = {
      format: 'stex-r37-catalog-apply-gate', version: 1, phase: 'metadata',
      origin: 'https://stex.62-171-162-115.sslip.io', target: TARGET,
      coreSha256: CORE_SHA256, operatorSha256: sha256(await readFile(applyPath)),
      releaseManifestSha256: 'a'.repeat(64), sourcePackageSha256: 'b'.repeat(64),
      backupManifestSha256: 'c'.repeat(64), backupCapturedAt: new Date(now - 600_000).toISOString(),
      restoreVerifiedAt: new Date(now - 300_000).toISOString(), restoreReference: 'synthetic-test-only restore reference',
      targetSnapshotSha256: 'd'.repeat(64), targetSnapshotReference: 'synthetic-test-only snapshot reference',
      issuedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 600_000).toISOString(),
      metadataReceiptsSha256: null, pdfBindingsSha256: null,
    };
    const gateBytes = `${JSON.stringify(gate)}\n`;
    await writeFile(gatePath, gateBytes, { mode: 0o600 });

    const configPath = join(workspaceRoot, 'deploy/pilot/targets/contabo-test/import-r37-20261025/run-config.json');
    await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
    await writeFile(configPath, `${JSON.stringify({
      format: 'stex-r37-catalog-start-config', version: 1,
      sourceRoot: join(tempRoot, 'synthetic-source-root-does-not-exist'),
      metadataGate: { path: gatePath, sha256: sha256(gateBytes) },
    })}\n`, { mode: 0o600 });

    const prepareChild = await runOfflinePrepare(workspaceRoot, applyPath, stateDir);
    assert.equal(prepareChild.code, 0);
    assert.equal(prepareChild.signal, null);
    const prepared = JSON.parse(prepareChild.stdout) as Record<string, unknown>;
    assert.deepEqual(Object.keys(prepared).sort(), ['mode', ...SUMMARY_FIELDS, 'runnable'].sort());
    assert.equal(prepared.mode, 'offline-prepare');
    assert.equal(prepared.runnable, false);
    assert.equal(prepared.planSha256, CORE_SHA256);
    assert.equal(prepared.metadataDone, 0);
    assert.equal(prepared.metadataTotal, 5);
    assert.equal(prepared.pdfDone, 0);
    assert.equal(prepared.pdfTotal, 449);
    const checkpointPath = join(stateDir, 'checkpoint.json');
    const checkpointHashBefore = sha256(await readFile(checkpointPath));

    const actualOfflineActions: string[] = [];
    const childOutputs = new Map<string, { code: number | null; signal: NodeJS.Signals | null; stdout: string }>();
    let loginBlockedBeforeSpawn = false;
    const spawnImpl = ((command: string, args: string[], options: SpawnOptions): ChildProcess => {
      assert.equal(command, process.execPath);
      const scriptPath = args[2];
      const action = basename(scriptPath) === 'catalog-session.mts' ? 'login' : args[3];
      if (action === 'login') {
        loginBlockedBeforeSpawn = true;
        assert.equal(scriptPath, join(workspaceRoot, SESSION_RELATIVE));
        assert.equal(options.stdio, 'inherit');
        throw new Error('test boundary blocks the interactive login process before spawn or network access');
      }

      assert.equal(scriptPath, applyPath);
      assert.ok(['inspect', 'prepare', 'status'].includes(action));
      assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
      actualOfflineActions.push(action);
      const child = spawnChild(command, args, options);
      let stdout = '';
      child.stdout?.on('data', (part: Buffer) => { stdout += part.toString('utf8'); });
      child.once('close', (code, signal) => childOutputs.set(action, { code, signal, stdout }));
      return child;
    }) as (command: string, args: string[], options: SpawnOptions) => ChildProcess;

    await assert.rejects(
      runWorkflow({ workspaceRoot, homeDirectory, spawnImpl }),
      (error: unknown) => error instanceof StartFailure && error.code === 'helper_unavailable',
    );

    assert.deepEqual(actualOfflineActions, ['inspect', 'status']);
    assert.equal(loginBlockedBeforeSpawn, true);
    assert.deepEqual([...childOutputs.keys()], ['inspect', 'status']);
    for (const action of actualOfflineActions) {
      const output = childOutputs.get(action);
      assert.ok(output, `${action} child output was captured`);
      assert.equal(output.code, 0, `${action} child exited successfully`);
      assert.equal(output.signal, null, `${action} child was not signalled`);
    }

    const inspect = JSON.parse(childOutputs.get('inspect')!.stdout) as Record<string, unknown>;
    assert.deepEqual(Object.keys(inspect).sort(), ['mode', 'records', 'metadataBatches', 'pdfTemplates', 'planSha256', 'runnable'].sort());
    assert.equal(inspect.mode, 'offline-inspect');
    assert.equal(inspect.records, 449);
    assert.equal(inspect.metadataBatches, 5);
    assert.equal(inspect.pdfTemplates, 449);
    assert.equal(inspect.planSha256, CORE_SHA256);
    assert.equal(inspect.runnable, false);

    const status = JSON.parse(childOutputs.get('status')!.stdout) as Record<string, unknown>;
    assert.deepEqual(Object.keys(status).sort(), SUMMARY_FIELDS);
    assert.equal(Object.hasOwn(status, 'mode'), false);
    assert.equal(Object.hasOwn(status, 'runnable'), false);
    assert.equal(status.planSha256, CORE_SHA256);
    assert.equal(status.metadataDone, 0);
    assert.equal(status.metadataTotal, 5);
    assert.equal(status.pdfDone, 0);
    assert.equal(status.pdfTotal, 449);
    assert.equal(status.pdfBindingsSha256, null);
    assert.equal(status.metadataReceiptsSha256, null);
    assert.equal(sha256(await readFile(checkpointPath)), checkpointHashBefore, 'existing private synthetic checkpoint is unchanged');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
