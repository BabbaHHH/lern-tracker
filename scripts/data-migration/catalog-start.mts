import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_RELATIVE = 'deploy/pilot/targets/contabo-test/import-r37-20261025/run-config.json';
const CORE_RELATIVE = 'docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-CORE.json';
const METADATA_RELATIVE = 'docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-METADATEN-VORLAGEN.json';
const PDF_RELATIVE = 'docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-PDF-VORLAGEN.json';
const APPLY_RELATIVE = 'scripts/data-migration/catalog-apply.mts';
const SESSION_RELATIVE = 'scripts/data-migration/catalog-session.mts';
const CORE_SHA256 = 'dda48b8f5fed009f6a262e392aecb66841c9391d7e4ec5f03fe18c0f29f95d9d';
const ORIGIN = 'https://stex.62-171-162-115.sslip.io';
const TARGET = { database: 'stex_rollback_r36_20261023', schemaVersion: 18, fileRoot: '/srv/stex/data/contabo-test/r36-rollback-20261023/files' };
const GATE_FIELDS = [
  'format', 'version', 'phase', 'origin', 'target', 'coreSha256', 'operatorSha256', 'releaseManifestSha256',
  'sourcePackageSha256', 'backupManifestSha256', 'backupCapturedAt', 'restoreVerifiedAt', 'restoreReference',
  'targetSnapshotSha256', 'targetSnapshotReference', 'issuedAt', 'expiresAt', 'metadataReceiptsSha256', 'pdfBindingsSha256',
] as const;
const MAX_CONFIG_BYTES = 16 * 1024;
const MAX_GATE_BYTES = 32 * 1024;
const MAX_CHILD_OUTPUT = 128 * 1024;
const PRIVATE_ROOT_NAME = '.stex-catalog-import';
const STATE_NAME = 'r37-apply-state-20261025';

type Obj = Record<string, unknown>;
type SpawnImpl = (command: string, args: string[], options: SpawnOptions) => ChildProcess;
type Signals = NodeJS.Signals;

export class StartFailure extends Error {
  readonly code: string;
  readonly exitCode: number;
  constructor(code: string, exitCode = 1) { super(code); this.code = code; this.exitCode = exitCode; }
}

interface GateConfig { path: string; sha256: string }
interface StartConfig { sourceRoot: string; metadataGate: GateConfig }
interface ChildResult { code: number | null; signal: Signals | null; stdout: string }
interface Summary {
  planSha256: string;
  metadataDone: number;
  metadataTotal: number;
  pdfDone: number;
  pdfTotal: number;
  pendingMetadata: string[];
  pendingPdf: string[];
  pdfBindingsSha256: string | null;
  metadataReceiptsSha256: string | null;
}
interface Handoff {
  coreHash: string;
  metadataReceiptsSha256: string;
  pdfBindingsSha256: string;
  metadataDone: number;
  metadataTotal: number;
  pdfBindingCount: number;
}
export type WorkflowResult =
  | { kind: 'metadata-incomplete'; metadataDone: number; metadataTotal: number }
  | { kind: 'handoff'; handoff: Handoff };
export interface WorkflowDependencies {
  /** Internal test seam. The CLI never accepts alternate workspace or state paths. */
  workspaceRoot?: string;
  homeDirectory?: string;
  spawnImpl?: SpawnImpl;
}

function fail(code: string): never { throw new StartFailure(code); }
function object(value: unknown): value is Obj { return !!value && typeof value === 'object' && !Array.isArray(value); }
function exact(value: unknown, fields: readonly string[]): asserts value is Obj {
  if (!object(value) || Object.keys(value).length !== fields.length || !fields.every(key => Object.hasOwn(value, key))) fail('invalid_configuration');
}
function sha256(value: Uint8Array | string): string { return createHash('sha256').update(value).digest('hex'); }
function isHash(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value); }
function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
}
function parseJson(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { return fail('invalid_configuration'); }
}

async function assertNoLinks(path: string, missingCode = 'local_file_unavailable'): Promise<string> {
  if (!isAbsolute(path) || resolve(path) !== path || /[\x00-\x1f\x7f]/.test(path)) fail('invalid_path');
  let at = path;
  while (true) {
    let stat;
    try { stat = await lstat(at); } catch { return fail(missingCode); }
    if (stat.isSymbolicLink()) fail('symlink_denied');
    const parent = dirname(at);
    if (parent === at) break;
    at = parent;
  }
  try { if (await realpath(path) !== path) fail('symlink_denied'); }
  catch (error) { if (error instanceof StartFailure) throw error; fail(missingCode); }
  return path;
}

async function readChecked(path: string, maxBytes: number, privateFile = false, missingCode = 'local_file_unavailable'): Promise<Buffer> {
  await assertNoLinks(path, missingCode);
  let handle;
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch { return fail(missingCode); }
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size > maxBytes) fail('file_shape');
    if (privateFile && (before.uid !== process.getuid?.() || (before.mode & 0o077) !== 0)) fail('private_file_required');
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const pathStat = await lstat(path);
    if (bytes.length !== before.size || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || before.dev !== pathStat.dev || before.ino !== pathStat.ino) fail('file_changed');
    return bytes;
  } finally { await handle.close(); }
}

async function readConfig(path: string): Promise<StartConfig> {
  const bytes = await readChecked(path, MAX_CONFIG_BYTES, true, 'run_config_missing');
  const value = parseJson(bytes);
  exact(value, ['format', 'version', 'sourceRoot', 'metadataGate']);
  if (value.format !== 'stex-r37-catalog-start-config' || value.version !== 1 || !isAbsolute(String(value.sourceRoot))
    || resolve(String(value.sourceRoot)) !== value.sourceRoot || /[\x00-\x1f\x7f]/.test(String(value.sourceRoot))) fail('configuration_incomplete');
  exact(value.metadataGate, ['path', 'sha256']);
  if (typeof value.metadataGate.path !== 'string' || !isAbsolute(value.metadataGate.path) || resolve(value.metadataGate.path) !== value.metadataGate.path
    || basename(value.metadataGate.path) === 'run-config.template.json' || !isHash(value.metadataGate.sha256)) fail('configuration_incomplete');
  return { sourceRoot: value.sourceRoot as string, metadataGate: value.metadataGate as unknown as GateConfig };
}

async function validateGate(config: StartConfig, configPath: string, workspaceRoot: string): Promise<void> {
  if (config.metadataGate.path === configPath) fail('host_gate_mismatch');
  const bytes = await readChecked(config.metadataGate.path, MAX_GATE_BYTES, true, 'host_gate_unavailable');
  if (sha256(bytes) !== config.metadataGate.sha256) fail('host_gate_hash_mismatch');
  const gate = parseJson(bytes);
  exact(gate, GATE_FIELDS);
  exact(gate.target, ['database', 'schemaVersion', 'fileRoot']);
  const operatorPath = join(workspaceRoot, APPLY_RELATIVE);
  const operatorSha256 = sha256(await readChecked(operatorPath, 2 * 1024 * 1024));
  if (gate.format !== 'stex-r37-catalog-apply-gate' || gate.version !== 1 || gate.phase !== 'metadata'
    || gate.origin !== ORIGIN || gate.target.database !== TARGET.database || gate.target.schemaVersion !== TARGET.schemaVersion
    || gate.target.fileRoot !== TARGET.fileRoot || gate.coreSha256 !== CORE_SHA256 || gate.operatorSha256 !== operatorSha256) fail('host_gate_mismatch');
  for (const key of ['releaseManifestSha256', 'sourcePackageSha256', 'backupManifestSha256', 'targetSnapshotSha256']) {
    if (!isHash(gate[key])) fail('host_gate_incomplete');
  }
  const issued = Date.parse(String(gate.issuedAt)), expires = Date.parse(String(gate.expiresAt));
  const backup = Date.parse(String(gate.backupCapturedAt)), restore = Date.parse(String(gate.restoreVerifiedAt));
  const now = Date.now();
  if (![issued, expires, backup, restore].every(Number.isFinite) || backup > restore || restore > issued || issued > now + 30_000
    || expires <= now || expires - issued > 86_400_000 || issued - backup > 86_400_000
    || !validText(gate.restoreReference, 512) || !validText(gate.targetSnapshotReference, 512)
    || gate.metadataReceiptsSha256 !== null || gate.pdfBindingsSha256 !== null) fail('host_gate_incomplete');
}

async function privateRoot(homeDirectory: string): Promise<string> {
  const root = resolve(homeDirectory, PRIVATE_ROOT_NAME);
  await assertNoLinks(homeDirectory);
  try { await mkdir(root, { mode: 0o700 }); }
  catch (error) {
    if (!object(error) || error.code !== 'EEXIST') fail('private_directory_required');
  }
  await assertNoLinks(root);
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) fail('private_directory_required');
  return root;
}

async function ensureAbsent(path: string, code: string): Promise<void> {
  try { await lstat(path); fail(code); }
  catch (error) { if (error instanceof StartFailure) throw error; if (!object(error) || error.code !== 'ENOENT') fail(code); }
}

async function existingState(stateDir: string): Promise<boolean> {
  try {
    const stat = await lstat(stateDir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) fail('state_directory_requires_review');
    try { await lstat(join(stateDir, 'operator.lock')); fail('state_lock_requires_review'); }
    catch (error) { if (error instanceof StartFailure) throw error; if (!object(error) || error.code !== 'ENOENT') fail('state_lock_requires_review'); }
    return true;
  } catch (error) {
    if (error instanceof StartFailure) throw error;
    if (object(error) && error.code === 'ENOENT') return false;
    fail('state_directory_requires_review');
  }
}

type SummaryMode = 'offline-prepare' | 'apply-metadata' | 'online-read-only-bind';
const SUMMARY_FIELDS = [
  'planSha256', 'metadataDone', 'metadataTotal', 'pdfDone', 'pdfTotal', 'pendingMetadata', 'pendingPdf',
  'pdfBindingsSha256', 'metadataReceiptsSha256',
] as const;

function summary(value: unknown, expectedMode?: SummaryMode): Summary {
  if (!object(value)) fail('operator_output_invalid');
  const expectedFields = expectedMode === 'offline-prepare'
    ? ['mode', ...SUMMARY_FIELDS, 'runnable']
    : expectedMode ? ['mode', ...SUMMARY_FIELDS] : [...SUMMARY_FIELDS];
  if (Object.keys(value).length !== expectedFields.length || !expectedFields.every(key => Object.hasOwn(value, key))) fail('operator_output_invalid');
  if (expectedMode && value.mode !== expectedMode) fail('operator_output_invalid');
  if (expectedMode === 'offline-prepare' && value.runnable !== false) fail('operator_output_invalid');
  if (value.planSha256 !== CORE_SHA256 || value.metadataTotal !== 5 || value.pdfTotal !== 449
    || !Number.isInteger(value.metadataDone) || Number(value.metadataDone) < 0 || Number(value.metadataDone) > 5
    || !Number.isInteger(value.pdfDone) || Number(value.pdfDone) < 0 || Number(value.pdfDone) > 449
    || !Array.isArray(value.pendingMetadata) || !Array.isArray(value.pendingPdf)
    || value.pendingMetadata.length > 5 || value.pendingPdf.length > 449
    || !value.pendingMetadata.every(id => typeof id === 'string') || !value.pendingPdf.every(id => typeof id === 'string')
    || !(value.pdfBindingsSha256 === null || isHash(value.pdfBindingsSha256))
    || !(value.metadataReceiptsSha256 === null || isHash(value.metadataReceiptsSha256))) fail('operator_output_invalid');
  if ((value.pdfBindingsSha256 === null) !== (value.metadataReceiptsSha256 === null)) fail('operator_output_invalid');
  return value as unknown as Summary;
}

function resultJson(result: ChildResult): unknown {
  if (Buffer.byteLength(result.stdout) > MAX_CHILD_OUTPUT) fail('operator_output_limit');
  return parseJson(Buffer.from(result.stdout));
}

function exitFor(result: ChildResult): number {
  if (result.signal) return ({ SIGHUP: 129, SIGINT: 130, SIGQUIT: 131, SIGTERM: 143 } as Partial<Record<Signals, number>>)[result.signal] ?? 1;
  return result.code === null ? 1 : result.code;
}

async function runChild(spawnImpl: SpawnImpl, workspaceRoot: string, scriptPath: string, args: string[], interactive = false): Promise<ChildResult> {
  let child: ChildProcess;
  try {
    child = spawnImpl(process.execPath, ['--no-warnings', '--experimental-strip-types', scriptPath, ...args], {
      cwd: workspaceRoot,
      stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
  } catch { fail('helper_unavailable'); }

  const output: Buffer[] = [];
  let outputBytes = 0;
  let outputOverflow = false;
  if (!interactive && child.stdout) child.stdout.on('data', (part: Buffer) => {
    outputBytes += part.length;
    if (outputBytes > MAX_CHILD_OUTPUT) { outputOverflow = true; try { child.kill('SIGTERM'); } catch { /* child is already stopping */ } }
    else output.push(Buffer.from(part));
  });
  if (!interactive && child.stderr) child.stderr.on('data', () => {});

  return new Promise<ChildResult>((resolvePromise, rejectPromise) => {
    let requestedSignal: Signals | null = null;
    let settled = false;
    const signals: Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
    const cleanup = () => { for (const signal of signals) process.off(signal, onSignal); };
    const onSignal = (signal: Signals) => {
      requestedSignal ??= signal;
      try { child.kill(signal); } catch { /* child is already stopping */ }
    };
    const finish = (error?: Error, code?: number | null, signal?: Signals | null) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) { rejectPromise(error); return; }
      if (outputOverflow) { rejectPromise(new StartFailure('operator_output_limit')); return; }
      resolvePromise({ code: code ?? null, signal: requestedSignal ?? signal ?? null, stdout: Buffer.concat(output, outputBytes).toString('utf8') });
    };
    for (const signal of signals) process.on(signal, onSignal);
    child.once('error', () => finish(new StartFailure('helper_unavailable')));
    child.once('close', (code, signal) => finish(undefined, code, signal));
  });
}

function requireSuccess(result: ChildResult): void {
  if (result.code !== 0 || result.signal !== null) throw new StartFailure('helper_failed', exitFor(result));
}

async function invokeJson(spawnImpl: SpawnImpl, workspaceRoot: string, scriptPath: string, args: string[]): Promise<unknown> {
  const result = await runChild(spawnImpl, workspaceRoot, scriptPath, args);
  requireSuccess(result);
  return resultJson(result);
}

function handoffFrom(value: Summary): Handoff {
  if (!value.metadataReceiptsSha256 || !value.pdfBindingsSha256 || value.metadataDone !== value.metadataTotal || value.pdfDone !== 0 || value.pendingPdf.length !== 0) fail('pdf_binding_unavailable');
  return {
    coreHash: value.planSha256,
    metadataReceiptsSha256: value.metadataReceiptsSha256,
    pdfBindingsSha256: value.pdfBindingsSha256,
    metadataDone: value.metadataDone,
    metadataTotal: value.metadataTotal,
    pdfBindingCount: value.pdfTotal,
  };
}

async function captureSessionIdentity(sessionPath: string): Promise<{ dev: number; ino: number }> {
  await assertNoLinks(sessionPath, 'session_file_missing');
  const stat = await lstat(sessionPath);
  if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) fail('session_file_invalid');
  return { dev: stat.dev, ino: stat.ino };
}

async function removeOwnSession(sessionPath: string, identity: { dev: number; ino: number }): Promise<void> {
  const stat = await lstat(sessionPath).catch(() => undefined);
  if (!stat) return;
  if (!stat.isFile() || stat.dev !== identity.dev || stat.ino !== identity.ino || stat.nlink !== 1 || stat.uid !== process.getuid?.()) fail('session_cleanup_requires_review');
  await unlink(sessionPath);
}

export async function runWorkflow(deps: WorkflowDependencies = {}): Promise<WorkflowResult> {
  const workspaceRoot = resolve(deps.workspaceRoot ?? ROOT);
  const homeDirectory = resolve(deps.homeDirectory ?? homedir());
  const spawnImpl = deps.spawnImpl ?? ((command, args, options) => spawn(command, args, options));
  const configPath = join(workspaceRoot, CONFIG_RELATIVE);
  const config = await readConfig(configPath);
  await validateGate(config, configPath, workspaceRoot);

  const applyPath = join(workspaceRoot, APPLY_RELATIVE);
  const sessionHelperPath = join(workspaceRoot, SESSION_RELATIVE);
  const corePath = join(workspaceRoot, CORE_RELATIVE);
  const metadataPath = join(workspaceRoot, METADATA_RELATIVE);
  const pdfPath = join(workspaceRoot, PDF_RELATIVE);
  const inspected = await invokeJson(spawnImpl, workspaceRoot, applyPath, [
    'inspect', '--core', corePath, '--metadata-templates', metadataPath, '--pdf-templates', pdfPath,
  ]);
  if (!object(inspected) || inspected.mode !== 'offline-inspect' || inspected.planSha256 !== CORE_SHA256
    || inspected.records !== 449 || inspected.metadataBatches !== 5 || inspected.pdfTemplates !== 449 || inspected.runnable !== false) fail('plan_preflight_failed');

  const privateDir = await privateRoot(homeDirectory);
  const stateDir = join(privateDir, STATE_NAME);
  const hasState = await existingState(stateDir);
  let beforeLogin: Summary;
  if (hasState) {
    beforeLogin = summary(await invokeJson(spawnImpl, workspaceRoot, applyPath, ['status', '--state-dir', stateDir]));
    ensureMetadataOnlyState(beforeLogin);
  } else {
    const prepared = summary(await invokeJson(spawnImpl, workspaceRoot, applyPath, [
      'prepare', '--core', corePath, '--metadata-templates', metadataPath, '--pdf-templates', pdfPath, '--state-dir', stateDir,
    ]), 'offline-prepare');
    ensureMetadataOnlyState(prepared);
    beforeLogin = summary(await invokeJson(spawnImpl, workspaceRoot, applyPath, ['status', '--state-dir', stateDir]));
    ensureMetadataOnlyState(beforeLogin);
  }

  const sessionPath = join(privateDir, `r37-session-20261025-${process.pid}.json`);
  await ensureAbsent(sessionPath, 'session_file_exists');
  let sessionIdentity: { dev: number; ino: number } | undefined;
  let workflowResult: WorkflowResult | undefined;
  let workflowFailure: unknown;
  try {
    const login = await runChild(spawnImpl, workspaceRoot, sessionHelperPath, ['--output', sessionPath], true);
    requireSuccess(login);
    sessionIdentity = await captureSessionIdentity(sessionPath);

    const applied = await invokeJson(spawnImpl, workspaceRoot, applyPath, [
      'apply-metadata', '--state-dir', stateDir, '--source-root', config.sourceRoot, '--cookie-file', sessionPath,
      '--host-gate', config.metadataGate.path, '--host-gate-sha256', config.metadataGate.sha256,
      '--max-steps', '5', '--max-seconds', '300',
    ]);
    summary(applied, 'apply-metadata');

    const afterMetadata = summary(await invokeJson(spawnImpl, workspaceRoot, applyPath, ['status', '--state-dir', stateDir]));
    ensureMetadataOnlyState(afterMetadata);
    if (afterMetadata.metadataDone !== afterMetadata.metadataTotal || afterMetadata.pendingMetadata.length > 0) {
      workflowResult = { kind: 'metadata-incomplete', metadataDone: afterMetadata.metadataDone, metadataTotal: afterMetadata.metadataTotal };
    } else if (afterMetadata.pdfBindingsSha256) {
      workflowResult = { kind: 'handoff', handoff: handoffFrom(afterMetadata) };
    } else {
      const bound = summary(await invokeJson(spawnImpl, workspaceRoot, applyPath, [
        'prepare-pdfs', '--state-dir', stateDir, '--cookie-file', sessionPath,
      ]), 'online-read-only-bind');
      workflowResult = { kind: 'handoff', handoff: handoffFrom(bound) };
    }
  } catch (error) { workflowFailure = error; }

  if (sessionIdentity) {
    try { await removeOwnSession(sessionPath, sessionIdentity); }
    catch (error) { if (!workflowFailure) workflowFailure = error; }
  }
  if (workflowFailure) throw workflowFailure;
  if (!workflowResult) fail('workflow_incomplete');
  return workflowResult;
}

function ensureMetadataOnlyState(value: Summary): void {
  if (value.pdfDone !== 0 || value.pendingPdf.length !== 0) fail('pdf_phase_requires_separate_gate');
}

async function cli(): Promise<void> {
  try {
    if (process.argv.length !== 2) fail('invalid_arguments');
    const result = await runWorkflow();
    if (result.kind === 'handoff') process.stdout.write(`HOST-HANDOFF ${JSON.stringify(result.handoff)}\n`);
    else process.stdout.write(`METADATA-INCOMPLETE ${result.metadataDone}/${result.metadataTotal}; PDF-BINDING NOT STARTED\n`);
  } catch (error) {
    const code = error instanceof StartFailure ? error.code : 'local_preflight_failed';
    process.stderr.write(`${JSON.stringify({ error: code })}\n`);
    process.exitCode = error instanceof StartFailure ? error.exitCode : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void cli();
