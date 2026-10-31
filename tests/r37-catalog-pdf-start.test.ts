import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn as spawnChild, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { digest, loadPlan, stableRequestId } from '../scripts/data-migration/catalog-apply.mts';
import type { Profile } from '../scripts/data-migration/catalog-apply.mts';
import { PdfStartFailure, runWorkflow } from '../scripts/data-migration/catalog-pdf-start.mts';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY_RELATIVE = 'scripts/data-migration/catalog-apply.mts';
const CORE_RELATIVE = 'docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-CORE.json';
const METADATA_RELATIVE = 'docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-METADATEN-VORLAGEN.json';
const PDF_RELATIVE = 'docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-PDF-VORLAGEN.json';
const CONFIG_RELATIVE = 'deploy/pilot/targets/contabo-test/import-r37-20261025/pdf-run-config.json';
const CONFIG_TEMPLATE_RELATIVE = 'deploy/pilot/targets/contabo-test/import-r37-20261025/pdf-run-config.template.json';
const CORE_SHA256 = 'dda48b8f5fed009f6a262e392aecb66841c9391d7e4ec5f03fe18c0f29f95d9d';
const TARGET = { database: 'stex_rollback_r36_20261023', schemaVersion: 18, fileRoot: '/srv/stex/data/contabo-test/r36-rollback-20261023/files' };
const SUMMARY_FIELDS = [
  'planSha256', 'metadataDone', 'metadataTotal', 'pdfDone', 'pdfTotal', 'pendingMetadata', 'pendingPdf',
  'pdfBindingsSha256', 'metadataReceiptsSha256',
].sort();

type GateMode = 'valid' | 'missing' | 'wrong-binding';
type FixtureOptions = { metadataDone?: number; pdfDone?: number; pendingPdf?: number; withBindings?: boolean; gate?: GateMode; writeConfig?: boolean };
type SyntheticState = Record<string, unknown>;

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

async function installSyntheticState(checkpointPath: string, metadataDone: number, pdfDone: number, pendingPdf: number, withBindings: boolean): Promise<{ metadataReceiptsSha256: string | null; pdfBindingsSha256: string | null }> {
  const envelope = JSON.parse(await readFile(checkpointPath, 'utf8')) as { state: SyntheticState; sha256: string };
  const state = envelope.state;
  const profile = state.profile as Profile;
  const files = state.files as { core: string; metadata: string; pdf: string };
  const plan = await loadPlan(files, profile);
  const owner = 'synthetic-pdf-start-user';
  const metadata = plan.batches.map((records, index) => {
    const requestId = stableRequestId(profile.hashes.core, 'metadata', index);
    if (index >= metadataDone) return { requestId, status: 'new' };
    const result = { requestId, status: 'committed', rows: [] };
    return {
      requestId,
      status: 'done',
      semantic: { requestId, action: 'legacy-import', expectedAccountId: owner, records, snapshot: 'e'.repeat(64) },
      result,
    };
  });
  const bindings = withBindings && metadataDone === 5
    ? plan.pdfTemplates.map((template, index) => ({
      ...template,
      requestId: stableRequestId(profile.hashes.core, 'pdf', index),
      expectedMetadataRevision: 1,
      expectedMetadataSha256: 'f'.repeat(64),
      expectedDocuments: [],
    }))
    : null;
  const pdf = plan.rows.map((row, index) => {
    const requestId = stableRequestId(profile.hashes.core, 'pdf', index);
    const binding = bindings?.[index];
    if (index < pdfDone && binding) return {
      requestId, status: 'done', semantic: binding,
      result: {
        requestId, status: 'committed', importId: `synthetic-import-${index}`, klausurId: row.klausurId,
        documentId: `synthetic-document-${index}`, documentVersionId: `synthetic-version-${index}`,
        versionNumber: 1, sha256: row.pdf.sha256, byteSize: row.pdf.byteSize,
      },
    };
    if (index >= pdfDone && index < pdfDone + pendingPdf && binding) return { requestId, status: 'pending', semantic: binding };
    return { requestId, status: 'new' };
  });
  const metadataReceiptsSha256 = bindings ? digest(metadata.map(item => 'result' in item ? item.result : null)) : null;
  const pdfBindingsSha256 = bindings ? digest(bindings) : null;
  state.owner = owner;
  state.lastAccessGeneration = 1;
  state.metadata = metadata;
  state.pdf = pdf;
  state.pdfBindings = bindings;
  state.metadataReceiptsSha256 = metadataReceiptsSha256;
  state.pdfBindingsSha256 = pdfBindingsSha256;
  await writeFile(checkpointPath, `${JSON.stringify({ state, sha256: digest(state) })}\n`, { mode: 0o600 });
  return { metadataReceiptsSha256, pdfBindingsSha256 };
}

async function fixture(options: FixtureOptions = {}) {
  const tempParent = await realpath(tmpdir());
  const tempRoot = await mkdtemp(join(tempParent, 'r37-catalog-pdf-start-'));
  const workspaceRoot = join(tempRoot, 'workspace');
  const homeDirectory = join(tempRoot, 'home');
  const privateDir = join(homeDirectory, '.stex-catalog-import');
  const stateDir = join(privateDir, 'r37-apply-state-20261025');
  await mkdir(workspaceRoot, { mode: 0o700 });
  await mkdir(homeDirectory, { mode: 0o700 });
  await mkdir(privateDir, { mode: 0o700 });

  for (const relativePath of [APPLY_RELATIVE, CORE_RELATIVE, METADATA_RELATIVE, PDF_RELATIVE]) {
    const destination = join(workspaceRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await copyFile(join(REPOSITORY_ROOT, relativePath), destination);
  }

  const applyPath = join(workspaceRoot, APPLY_RELATIVE);
  const prepared = await runOfflinePrepare(workspaceRoot, applyPath, stateDir);
  assert.equal(prepared.code, 0, 'real offline prepare child exits successfully');
  assert.equal(prepared.signal, null);
  const preparedOutput = JSON.parse(prepared.stdout) as Record<string, unknown>;
  assert.deepEqual(Object.keys(preparedOutput).sort(), ['mode', ...SUMMARY_FIELDS, 'runnable'].sort());
  assert.equal(preparedOutput.mode, 'offline-prepare');
  assert.equal(preparedOutput.runnable, false);
  assert.equal(preparedOutput.metadataTotal, 5);
  assert.equal(preparedOutput.pdfTotal, 449);

  const configPath = join(workspaceRoot, CONFIG_RELATIVE);
  const gatePath = join(tempRoot, 'synthetic-pdf-gate.json');
  let bindings = { metadataReceiptsSha256: null as string | null, pdfBindingsSha256: null as string | null };
  if (options.metadataDone === undefined) options.metadataDone = 5;
  if (options.pdfDone === undefined) options.pdfDone = 0;
  if (options.pendingPdf === undefined) options.pendingPdf = 0;
  if (options.withBindings === undefined) options.withBindings = true;
  bindings = await installSyntheticState(join(stateDir, 'checkpoint.json'), options.metadataDone, options.pdfDone, options.pendingPdf, options.withBindings);

  if (options.gate !== 'missing') {
    const now = Date.now();
    const gate = {
      format: 'stex-r37-catalog-apply-gate', version: 1, phase: 'pdf',
      origin: 'https://stex.62-171-162-115.sslip.io', target: TARGET,
      coreSha256: CORE_SHA256, operatorSha256: sha256(await readFile(applyPath)),
      releaseManifestSha256: 'a'.repeat(64), sourcePackageSha256: 'b'.repeat(64),
      backupManifestSha256: 'c'.repeat(64), backupCapturedAt: new Date(now - 600_000).toISOString(),
      restoreVerifiedAt: new Date(now - 300_000).toISOString(), restoreReference: 'synthetic-test-only restore reference',
      targetSnapshotSha256: 'd'.repeat(64), targetSnapshotReference: 'synthetic-test-only snapshot reference',
      issuedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 600_000).toISOString(),
      metadataReceiptsSha256: options.gate === 'wrong-binding' ? '0'.repeat(64) : bindings.metadataReceiptsSha256,
      pdfBindingsSha256: bindings.pdfBindingsSha256,
    };
    const gateBytes = `${JSON.stringify(gate)}\n`;
    await writeFile(gatePath, gateBytes, { mode: 0o600 });
  }

  if (options.writeConfig !== false) {
    await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
    await writeFile(configPath, `${JSON.stringify({
      format: 'stex-r37-catalog-pdf-start-config', version: 1,
      sourceRoot: join(tempRoot, 'synthetic-source-root-does-not-exist'),
      pdfGate: { path: gatePath, sha256: options.gate === 'missing' ? '1'.repeat(64) : sha256(await readFile(gatePath)) },
    })}\n`, { mode: 0o600 });
  }

  const actions: string[] = [];
  const statusOutputs: string[] = [];
  let loginBlockedBeforeSpawn = false;
  const spawnImpl = ((command: string, args: string[], spawnOptions: SpawnOptions): ChildProcess => {
    assert.equal(command, process.execPath);
    const childScript = basename(args[2]);
    if (childScript === 'catalog-session.mts') {
      loginBlockedBeforeSpawn = true;
      assert.equal(spawnOptions.stdio, 'inherit');
      throw new Error('test boundary blocks the interactive login process before spawn or network access');
    }
    assert.equal(childScript, 'catalog-apply.mts');
    const action = args[3];
    actions.push(action);
    assert.equal(action, 'status', 'only the actual read-only offline status child may run');
    assert.deepEqual(spawnOptions.stdio, ['ignore', 'pipe', 'pipe']);
    const child = spawnChild(command, args, spawnOptions);
    let stdout = '';
    child.stdout?.on('data', (part: Buffer) => { stdout += part.toString('utf8'); });
    child.once('close', () => statusOutputs.push(stdout));
    return child;
  }) as (command: string, args: string[], spawnOptions: SpawnOptions) => ChildProcess;

  return {
    tempRoot, workspaceRoot, homeDirectory, stateDir, actions, statusOutputs,
    get loginBlockedBeforeSpawn() { return loginBlockedBeforeSpawn; },
    run: () => runWorkflow({ workspaceRoot, homeDirectory, spawnImpl }),
    cleanup: () => rm(tempRoot, { recursive: true, force: true }),
  };
}

test('the PDF run-config template is intentionally unfilled', async () => {
  const template = JSON.parse(await readFile(join(REPOSITORY_ROOT, CONFIG_TEMPLATE_RELATIVE), 'utf8')) as Record<string, unknown>;
  assert.deepEqual(template, {
    format: 'stex-r37-catalog-pdf-start-config', version: 1, sourceRoot: null,
    pdfGate: { path: null, sha256: null },
  });
});

test('missing PDF run config stops before status or login', async () => {
  const f = await fixture({ writeConfig: false });
  try {
    await assert.rejects(f.run(), (error: unknown) => error instanceof PdfStartFailure && error.code === 'pdf_run_config_missing');
    assert.deepEqual(f.actions, []);
    assert.equal(f.loginBlockedBeforeSpawn, false);
  } finally { await f.cleanup(); }
});

test('missing actual PDF gate stops after read-only status and before login', async () => {
  const f = await fixture({ gate: 'missing' });
  try {
    await assert.rejects(f.run(), (error: unknown) => error instanceof PdfStartFailure && error.code === 'pdf_gate_unavailable');
    assert.deepEqual(f.actions, ['status']);
    assert.equal(f.loginBlockedBeforeSpawn, false);
    const status = JSON.parse(f.statusOutputs[0]) as Record<string, unknown>;
    assert.deepEqual(Object.keys(status).sort(), SUMMARY_FIELDS);
    assert.equal(Object.hasOwn(status, 'mode'), false);
  } finally { await f.cleanup(); }
});

test('a PDF gate bound to different metadata receipts stops before login', async () => {
  const f = await fixture({ gate: 'wrong-binding' });
  try {
    await assert.rejects(f.run(), (error: unknown) => error instanceof PdfStartFailure && error.code === 'host_gate_binding_mismatch');
    assert.deepEqual(f.actions, ['status']);
    assert.equal(f.loginBlockedBeforeSpawn, false);
  } finally { await f.cleanup(); }
});

test('partial metadata cannot reach the PDF login transition', async () => {
  const f = await fixture({ metadataDone: 2, withBindings: false, gate: 'missing' });
  try {
    await assert.rejects(f.run(), (error: unknown) => error instanceof PdfStartFailure && error.code === 'metadata_phase_incomplete');
    assert.deepEqual(f.actions, ['status']);
    assert.equal(f.loginBlockedBeforeSpawn, false);
  } finally { await f.cleanup(); }
});

test('complete metadata and bound partial PDF state pass preflight; login is blocked before spawn', async () => {
  const f = await fixture({ metadataDone: 5, pdfDone: 1, pendingPdf: 1, gate: 'valid' });
  try {
    await assert.rejects(f.run(), (error: unknown) => error instanceof PdfStartFailure && error.code === 'helper_unavailable');
    assert.deepEqual(f.actions, ['status']);
    assert.equal(f.loginBlockedBeforeSpawn, true);
    assert.equal(f.statusOutputs.length, 1);
    const status = JSON.parse(f.statusOutputs[0]) as Record<string, unknown>;
    assert.deepEqual(Object.keys(status).sort(), SUMMARY_FIELDS);
    assert.equal(Object.hasOwn(status, 'mode'), false);
    assert.equal(status.metadataDone, 5);
    assert.equal(status.metadataTotal, 5);
    assert.equal(status.pdfDone, 1);
    assert.equal(status.pdfTotal, 449);
    assert.equal((status.pendingPdf as string[]).length, 1);
    assert.equal(typeof status.metadataReceiptsSha256, 'string');
    assert.equal(typeof status.pdfBindingsSha256, 'string');
  } finally { await f.cleanup(); }
});

test('complete metadata without existing PDF bindings is refused before gate or login', async () => {
  const f = await fixture({ metadataDone: 5, withBindings: false, gate: 'missing' });
  try {
    await assert.rejects(f.run(), (error: unknown) => error instanceof PdfStartFailure && error.code === 'pdf_binding_unavailable');
    assert.deepEqual(f.actions, ['status']);
    assert.equal(f.loginBlockedBeforeSpawn, false);
  } finally { await f.cleanup(); }
});
