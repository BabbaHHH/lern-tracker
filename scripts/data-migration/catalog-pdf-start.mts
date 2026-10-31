import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, realpath, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_RELATIVE = 'deploy/pilot/targets/contabo-test/import-r37-20261025/pdf-run-config.json';
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
const SUMMARY_FIELDS = [
  'planSha256', 'metadataDone', 'metadataTotal', 'pdfDone', 'pdfTotal', 'pendingMetadata', 'pendingPdf',
  'pdfBindingsSha256', 'metadataReceiptsSha256',
] as const;
const MAX_CONFIG_BYTES = 16 * 1024;
const MAX_GATE_BYTES = 32 * 1024;
const MAX_CHILD_OUTPUT = 128 * 1024;
const MAX_CHILD_ERROR_OUTPUT = 2 * 1024;
const PRIVATE_ROOT_NAME = '.stex-catalog-import';
const STATE_NAME = 'r37-apply-state-20261025';
// Only fixed codes from the current Apply CLI are eligible; never return arbitrary stderr data.
const SAFE_APPLY_ERROR_CODES = new Set([
  'local_io_or_operator_unavailable', 'private_directory_required', 'checkpoint_mismatch', 'operator_locked', 'lock_changed',
  'invalid_step_limit', 'invalid_time_limit', 'invalid_session_input', 'one_session_input_required', 'tls_verification_required',
  'host_gate_mismatch', 'host_gate_expired_or_incomplete', 'phase_binding_mismatch', 'host_gate_hash_mismatch',
  'metadata_phase_incomplete', 'pdf_bindings_already_exist', 'target_coverage_mismatch', 'owner_changed', 'account_changed',
  'invalid_account_context', 'origin_or_route_denied', 'response_unknown', 'redirect_or_response_denied', 'invalid_response',
  'response_too_large', 'invalid_json', 'fresh_admin_required_401', 'fresh_admin_required_403', 'fresh_admin_required_404',
  'fresh_admin_required_409', 'fresh_admin_required_429', 'fresh_admin_required_500', 'fresh_admin_required_502',
  'fresh_admin_required_503', 'fresh_admin_required_504', 'http_400', 'http_401', 'http_403', 'http_404', 'http_409',
  'http_413', 'http_415', 'http_422', 'http_429', 'http_500', 'http_502', 'http_503', 'http_504', 'invalid_catalog',
  'full_target_payload_required', 'target_metadata_mismatch', 'pdf_receipt_conflict', 'pdf_receipt_failed',
  'target_revision_or_payload_changed', 'unexpected_document_state', 'source_path_denied', 'file_too_large', 'source_changed',
  'source_pdf_hash_mismatch', 'pdf_request_limit', 'receipt_without_pending_command',
  'retry_scope_mismatch', 'retry_parent_not_terminal_empty', 'retry_parent_mismatch', 'retry_parent_changed',
  'retry_ledger_mismatch', 'retry_receipt_without_send', 'retry_outcome_unknown', 'explicit_retry_required',
]);

type Obj = Record<string, unknown>;
type SpawnImpl = (command: string, args: string[], options: SpawnOptions) => ChildProcess;
type Signals = NodeJS.Signals;
type SummaryMode = 'apply-pdfs' | 'retry-first-pdf';

export class PdfStartFailure extends Error {
  readonly code: string;
  readonly exitCode: number;
  constructor(code: string, exitCode = 1) { super(code); this.code = code; this.exitCode = exitCode; }
}

interface GateConfig { path: string; sha256: string }
interface StartConfig { sourceRoot: string; pdfGate: GateConfig }
interface ChildResult { code: number | null; signal: Signals | null; stdout: string; fixedErrorCode?: string }
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
interface PdfProgress { metadataDone: number; metadataTotal: number; pdfDone: number; pdfTotal: number; pendingPdf: number }
export interface WorkflowResult { progress: PdfProgress; exitCode: number; errorCode?: string }
export interface WorkflowDependencies {
  /** Test seam; the executable CLI always uses fixed paths and the real process starter. */
  workspaceRoot?: string;
  homeDirectory?: string;
  spawnImpl?: SpawnImpl;
}

function fail(code: string): never { throw new PdfStartFailure(code); }
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

async function assertNoLinks(path: string, missingCode = 'local_file_unavailable'): Promise<void> {
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
  catch (error) { if (error instanceof PdfStartFailure) throw error; fail(missingCode); }
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
  const bytes = await readChecked(path, MAX_CONFIG_BYTES, true, 'pdf_run_config_missing');
  const value = parseJson(bytes);
  exact(value, ['format', 'version', 'sourceRoot', 'pdfGate']);
  if (value.format !== 'stex-r37-catalog-pdf-start-config' || value.version !== 1
    || typeof value.sourceRoot !== 'string' || !isAbsolute(value.sourceRoot) || resolve(value.sourceRoot) !== value.sourceRoot
    || /[\x00-\x1f\x7f]/.test(value.sourceRoot)) fail('configuration_incomplete');
  exact(value.pdfGate, ['path', 'sha256']);
  if (typeof value.pdfGate.path !== 'string' || !isAbsolute(value.pdfGate.path) || resolve(value.pdfGate.path) !== value.pdfGate.path
    || basename(value.pdfGate.path) === 'pdf-run-config.template.json' || !isHash(value.pdfGate.sha256)) fail('configuration_incomplete');
  return { sourceRoot: value.sourceRoot, pdfGate: value.pdfGate as unknown as GateConfig };
}

async function privateDirectory(path: string, missingCode: string, invalidCode: string): Promise<void> {
  await assertNoLinks(path, missingCode);
  let stat;
  try { stat = await lstat(path); } catch { return fail(missingCode); }
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) fail(invalidCode);
}

async function existingStateDirectories(homeDirectory: string): Promise<{ privateDir: string; stateDir: string }> {
  await assertNoLinks(homeDirectory, 'private_home_unavailable');
  const privateDir = join(homeDirectory, PRIVATE_ROOT_NAME);
  await privateDirectory(privateDir, 'private_state_missing', 'private_directory_required');
  const stateDir = join(privateDir, STATE_NAME);
  await privateDirectory(stateDir, 'private_state_missing', 'state_directory_requires_review');
  try { await lstat(join(stateDir, 'operator.lock')); fail('state_lock_requires_review'); }
  catch (error) { if (error instanceof PdfStartFailure) throw error; if (!object(error) || error.code !== 'ENOENT') fail('state_lock_requires_review'); }
  return { privateDir, stateDir };
}

async function ensureAbsent(path: string, code: string): Promise<void> {
  try { await lstat(path); fail(code); }
  catch (error) { if (error instanceof PdfStartFailure) throw error; if (!object(error) || error.code !== 'ENOENT') fail(code); }
}

function summary(value: unknown, expectedMode?: SummaryMode): Summary {
  if (!object(value)) fail('operator_output_invalid');
  const expectedFields = expectedMode ? ['mode', ...SUMMARY_FIELDS] : [...SUMMARY_FIELDS];
  if (Object.keys(value).length !== expectedFields.length || !expectedFields.every(key => Object.hasOwn(value, key))) fail('operator_output_invalid');
  if (expectedMode && value.mode !== expectedMode) fail('operator_output_invalid');
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

function ensurePdfReady(value: Summary): void {
  if (value.metadataDone !== value.metadataTotal || value.pendingMetadata.length !== 0) fail('metadata_phase_incomplete');
  if (!value.metadataReceiptsSha256 || !value.pdfBindingsSha256) fail('pdf_binding_unavailable');
}

async function validateGate(config: StartConfig, configPath: string, current: Summary, workspaceRoot: string): Promise<void> {
  if (config.pdfGate.path === configPath) fail('host_gate_mismatch');
  const bytes = await readChecked(config.pdfGate.path, MAX_GATE_BYTES, true, 'pdf_gate_unavailable');
  if (sha256(bytes) !== config.pdfGate.sha256) fail('pdf_gate_hash_mismatch');
  const gate = parseJson(bytes);
  exact(gate, GATE_FIELDS);
  exact(gate.target, ['database', 'schemaVersion', 'fileRoot']);
  const operatorPath = join(workspaceRoot, APPLY_RELATIVE);
  const operatorSha256 = sha256(await readChecked(operatorPath, 2 * 1024 * 1024));
  if (gate.format !== 'stex-r37-catalog-apply-gate' || gate.version !== 1 || gate.phase !== 'pdf'
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
    || !validText(gate.restoreReference, 512) || !validText(gate.targetSnapshotReference, 512)) fail('host_gate_incomplete');
  if (gate.metadataReceiptsSha256 !== current.metadataReceiptsSha256 || gate.pdfBindingsSha256 !== current.pdfBindingsSha256) fail('host_gate_binding_mismatch');
}

function resultJson(result: ChildResult): unknown {
  if (Buffer.byteLength(result.stdout) > MAX_CHILD_OUTPUT) fail('operator_output_limit');
  try { return JSON.parse(result.stdout); } catch { return fail('operator_output_invalid'); }
}

function exitFor(result: ChildResult): number {
  if (result.signal) return ({ SIGHUP: 129, SIGINT: 130, SIGQUIT: 131, SIGTERM: 143 } as Partial<Record<Signals, number>>)[result.signal] ?? 1;
  return result.code === null ? 1 : result.code;
}

function fixedApplyErrorCode(stderr: Uint8Array): string | undefined {
  if (stderr.length === 0 || stderr.length > MAX_CHILD_ERROR_OUTPUT) return undefined;
  let line: string;
  try { line = new TextDecoder('utf-8', { fatal: true }).decode(stderr); }
  catch { return undefined; }
  if (!line.endsWith('\n') || line.slice(0, -1).includes('\n') || line.includes('\r')) return undefined;
  let value: unknown;
  try { value = JSON.parse(line.slice(0, -1)); }
  catch { return undefined; }
  if (!object(value) || Object.keys(value).length !== 1 || typeof value.error !== 'string' || !SAFE_APPLY_ERROR_CODES.has(value.error)) return undefined;
  if (`${JSON.stringify(value)}\n` !== line) return undefined;
  return value.error;
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
  const errorOutput: Buffer[] = [];
  let errorOutputBytes = 0;
  let errorOutputOverflow = false;
  if (!interactive && child.stdout) child.stdout.on('data', (part: Buffer) => {
    outputBytes += part.length;
    if (outputBytes > MAX_CHILD_OUTPUT) { outputOverflow = true; try { child.kill('SIGTERM'); } catch { /* child is already stopping */ } }
    else output.push(Buffer.from(part));
  });
  if (!interactive && child.stderr) child.stderr.on('data', (part: Buffer) => {
    errorOutputBytes += part.length;
    if (errorOutputBytes > MAX_CHILD_ERROR_OUTPUT) { errorOutputOverflow = true; errorOutput.length = 0; }
    else if (!errorOutputOverflow) errorOutput.push(Buffer.from(part));
  });

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
      if (outputOverflow) { rejectPromise(new PdfStartFailure('operator_output_limit')); return; }
      resolvePromise({
        code: code ?? null,
        signal: requestedSignal ?? signal ?? null,
        stdout: Buffer.concat(output, outputBytes).toString('utf8'),
        ...(!errorOutputOverflow ? { fixedErrorCode: fixedApplyErrorCode(Buffer.concat(errorOutput, errorOutputBytes)) } : {}),
      });
    };
    for (const signal of signals) process.on(signal, onSignal);
    child.once('error', () => finish(new PdfStartFailure('helper_unavailable')));
    child.once('close', (code, signal) => finish(undefined, code, signal));
  });
}

function requireSuccess(result: ChildResult, allowFixedApplyError = false): void {
  if (result.code !== 0 || result.signal !== null) {
    throw new PdfStartFailure(allowFixedApplyError && result.fixedErrorCode ? result.fixedErrorCode : 'helper_failed', exitFor(result));
  }
}

async function invokeJson(spawnImpl: SpawnImpl, workspaceRoot: string, scriptPath: string, args: string[]): Promise<unknown> {
  const result = await runChild(spawnImpl, workspaceRoot, scriptPath, args);
  requireSuccess(result);
  return resultJson(result);
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

function progressOf(value: Summary): PdfProgress {
  return { metadataDone: value.metadataDone, metadataTotal: value.metadataTotal, pdfDone: value.pdfDone, pdfTotal: value.pdfTotal, pendingPdf: value.pendingPdf.length };
}

function ensureBindingsStable(before: Summary, after: Summary): void {
  if (before.metadataDone !== after.metadataDone || before.metadataTotal !== after.metadataTotal
    || before.metadataReceiptsSha256 !== after.metadataReceiptsSha256 || before.pdfBindingsSha256 !== after.pdfBindingsSha256
    || after.pdfDone < before.pdfDone) fail('checkpoint_changed');
}

function failureFrom(error: unknown): PdfStartFailure {
  return error instanceof PdfStartFailure ? error : new PdfStartFailure('local_preflight_failed');
}

export async function runWorkflow(deps: WorkflowDependencies = {}, retryFirst = false): Promise<WorkflowResult> {
  const workspaceRoot = resolve(deps.workspaceRoot ?? ROOT);
  const homeDirectory = resolve(deps.homeDirectory ?? homedir());
  const spawnImpl = deps.spawnImpl ?? ((command, args, options) => spawn(command, args, options));
  const configPath = join(workspaceRoot, CONFIG_RELATIVE);
  const config = await readConfig(configPath);
  const { privateDir, stateDir } = await existingStateDirectories(homeDirectory);

  const applyPath = join(workspaceRoot, APPLY_RELATIVE);
  const sessionHelperPath = join(workspaceRoot, SESSION_RELATIVE);
  const before = summary(await invokeJson(spawnImpl, workspaceRoot, applyPath, ['status', '--state-dir', stateDir]));
  ensurePdfReady(before);
  if (retryFirst && !(before.pdfDone === 0 && before.pendingPdf.length === 1 && before.pendingPdf[0] === 'a834ffa0-f351-52b3-b55b-3e6184a8c1c0'
    || before.pdfDone >= 1 && before.pendingPdf.length === 0)) fail('retry_scope_mismatch');
  await validateGate(config, configPath, before, workspaceRoot);

  const sessionPath = join(privateDir, `r37-pdf-session-20261025-${process.pid}.json`);
  await ensureAbsent(sessionPath, 'session_file_exists');
  let sessionIdentity: { dev: number; ino: number } | undefined;
  let result: WorkflowResult | undefined;
  let failure: PdfStartFailure | undefined;
  try {
    const login = await runChild(spawnImpl, workspaceRoot, sessionHelperPath, ['--output', sessionPath], true);
    requireSuccess(login);
    sessionIdentity = await captureSessionIdentity(sessionPath);

    let applyFailure: PdfStartFailure | undefined;
    try {
      const appliedResult = await runChild(spawnImpl, workspaceRoot, applyPath, [
        retryFirst ? 'retry-first-pdf' : 'apply-pdfs', '--state-dir', stateDir, '--source-root', config.sourceRoot, '--cookie-file', sessionPath,
        '--host-gate', config.pdfGate.path, '--host-gate-sha256', config.pdfGate.sha256,
        '--max-steps', retryFirst ? '1' : '449', '--max-seconds', '480',
      ]);
      requireSuccess(appliedResult, true);
      const applied = summary(resultJson(appliedResult), retryFirst ? 'retry-first-pdf' : 'apply-pdfs');
      ensurePdfReady(applied);
      ensureBindingsStable(before, applied);
    } catch (error) { applyFailure = failureFrom(error); }

    const after = summary(await invokeJson(spawnImpl, workspaceRoot, applyPath, ['status', '--state-dir', stateDir]));
    ensurePdfReady(after);
    ensureBindingsStable(before, after);
    result = { progress: progressOf(after), exitCode: applyFailure?.exitCode ?? 0, ...(applyFailure ? { errorCode: applyFailure.code } : {}) };
  } catch (error) { failure = failureFrom(error); }

  if (sessionIdentity) {
    try { await removeOwnSession(sessionPath, sessionIdentity); }
    catch (error) { if (!failure) failure = failureFrom(error); }
  }
  if (failure) throw failure;
  if (!result) fail('workflow_incomplete');
  return result;
}

function progressLine(progress: PdfProgress): string {
  const remaining = progress.pdfTotal - progress.pdfDone;
  return `PDF-FORTSCHRITT ${progress.pdfDone}/${progress.pdfTotal}; offen=${remaining}; wartend=${progress.pendingPdf}; Metadaten=${progress.metadataDone}/${progress.metadataTotal}`;
}

async function cli(): Promise<void> {
  try {
    if (!(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--retry-first')) fail('invalid_arguments');
    const result = await runWorkflow({}, process.argv[2] === '--retry-first');
    process.stdout.write(`${progressLine(result.progress)}\n`);
    if (result.errorCode) process.stderr.write(`${JSON.stringify({ error: result.errorCode })}\n`);
    process.exitCode = result.exitCode;
  } catch (error) {
    const code = error instanceof PdfStartFailure ? error.code : 'local_preflight_failed';
    process.stderr.write(`${JSON.stringify({ error: code })}\n`);
    process.exitCode = error instanceof PdfStartFailure ? error.exitCode : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void cli();
