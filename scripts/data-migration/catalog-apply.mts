import { createHash } from 'node:crypto';
import { constants, fstatSync, readSync } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import { hostname } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Standalone Node operator. No SQL, auth bootstrap, model or product mutations. */
export const ORIGIN = 'https://stex.62-171-162-115.sslip.io';
export const TARGET = { database: 'stex_rollback_r36_20261023', schemaVersion: 18, fileRoot: '/srv/stex/data/contabo-test/r36-rollback-20261023/files' };
export const PINNED = {
  core: 'dda48b8f5fed009f6a262e392aecb66841c9391d7e4ec5f03fe18c0f29f95d9d',
  metadata: 'e4f838001c08921d7f8ca7f92857cc7dccccd36c35c6606e382a5344d066a620',
  pdf: '97b9d939b2af810d53b77b1c0efa5662e8687055816aba200d56a8441f1b53b4',
};
// Only this known predecessor may retain its original profile during the additive
// retry transition. A fresh HOST gate must bind the executing operator instead.
export const PRE_RETRY_OPERATOR = 'f3d5806a9f555f89fdb40936246e8d69c118104b427d7041b57efd129d896889';
const MAX_JSON = 16 * 1024 * 1024, MAX_METADATA = 256 * 1024, MAX_PDF = 50 * 1024 * 1024, MAX_REQUEST = 110 * 1024 * 1024;
type Obj = Record<string, unknown>;
export const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v !== null && typeof v === 'object'
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Obj)[k])}`).join(',')}}` : JSON.stringify(v);
export const sha256 = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
export const digest = (v: unknown) => sha256(canonical(v));
export class ApplyError extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
function fail(code: string): never { throw new ApplyError(code); }
function object(v: unknown): v is Obj { return !!v && typeof v === 'object' && !Array.isArray(v); }
function assert(v: unknown, code: string): asserts v { if (!v) fail(code); }
function exact(v: unknown, fields: readonly string[]): asserts v is Obj { assert(object(v) && Object.keys(v).length === fields.length && fields.every(k => Object.hasOwn(v, k)), 'invalid_shape'); }
const hash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const text = (v: unknown, max = 1024): v is string => typeof v === 'string' && !!v && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
function json(bytes: Uint8Array): unknown { try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('invalid_json'); } }
function relPath(p: unknown): p is string { return text(p) && !isAbsolute(p) && !p.includes('\\') && p.split('/').every(c => !!c && c !== '.' && c !== '..'); }

export interface Pdf { filename: string; sha256: string; byteSize: number; edition: string }
export interface PlanRow { klausurId: string; publicMetadata: Obj; plannedPublicMetadataSha256: string; sourceId: string; typeProjection: 'canonical' | 'neutral'; pdf: Pdf;
  provenance: { originPath: string; originFileSha256: string; recordIndex: number; sourceId: string; source: string; area: string; rawType: string; topicIds: string[] } }
export interface Profile { origin: string; target: typeof TARGET; records: number; batchSizes: number[]; hashes: typeof PINNED; operatorSha256: string }
export interface Plan { profile: Profile; planId: string; rows: PlanRow[]; batches: Obj[][]; pdfTemplates: Obj[]; metadataRecords: Obj[]; core: Obj }
export interface ArtifactFiles { core: string; metadata: string; pdf: string }
export function stableRequestId(coreSha256: string, phase: 'metadata' | 'pdf', index: number): string {
  const b = Buffer.from(digest(['stex-r37-catalog-apply-v1', coreSha256, phase, index]).slice(0, 32), 'hex');
  b[6] = (b[6] & 15) | 80; b[8] = (b[8] & 63) | 128;
  const h = b.toString('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function pdfShape(p: unknown): asserts p is Pdf {
  exact(p, ['filename', 'sha256', 'byteSize', 'edition']);
  assert(text(p.filename, 255) && basename(p.filename) === p.filename && !p.filename.includes('\\') && /\.pdf$/i.test(p.filename) && hash(p.sha256) && positive(p.byteSize) && p.byteSize <= MAX_PDF && text(p.edition, 255), 'invalid_pdf_binding');
}
function expectedRecord(row: PlanRow, core: Obj, profile: Profile): Obj {
  const bindings = core.sourceBindings as Obj, manifest = bindings.manifest as Obj, map = bindings.idMap as Obj, p = row.provenance;
  return { ...row.publicMetadata, legacy: { version: 1, planId: core.planId, planSha256: profile.hashes.core, manifestSha256: manifest.sha256, idMapSha256: map.sha256,
    metadata: { originPath: p.originPath, originFileSha256: p.originFileSha256, recordIndex: p.recordIndex, sourceId: p.sourceId, source: p.source, area: p.area, type: p.rawType },
    pdf: row.pdf, typeProjection: row.typeProjection, roleDeclaration: 'user-declared-combined' } };
}
export function validatePlan(core: unknown, metadata: unknown, pdf: unknown, profile: Profile): Plan {
  assert(object(core) && core.format === 'stex-r37-final-data-plan-core' && core.version === 1 && core.executionSupported === false && core.status === 'local-plan-only' && text(core.planId, 128) && /^[A-Za-z0-9_-]{8,128}$/.test(core.planId), 'core_mismatch');
  assert(object(core.sourceBindings) && object(core.sourceBindings.manifest) && object(core.sourceBindings.idMap) && hash(core.sourceBindings.manifest.sha256) && hash(core.sourceBindings.idMap.sha256), 'core_mismatch');
  assert(Array.isArray(core.records) && core.records.length === profile.records, 'record_count_mismatch');
  const rows = core.records as PlanRow[];
  assert(new Set(rows.map(r => r.klausurId)).size === rows.length, 'duplicate_id');
  for (const r of rows) {
    assert(object(r) && id(r.klausurId) && object(r.publicMetadata) && r.publicMetadata.id === r.klausurId && digest(r.publicMetadata) === r.plannedPublicMetadataSha256 && id(r.sourceId), 'row_mismatch');
    pdfShape(r.pdf);
    assert(object(r.provenance) && relPath(r.provenance.originPath) && /\.json$/i.test(r.provenance.originPath) && hash(r.provenance.originFileSha256) && Number.isSafeInteger(r.provenance.recordIndex) && r.provenance.recordIndex >= 0 && r.provenance.sourceId === r.sourceId, 'provenance_mismatch');
    assert(r.provenance.source === r.publicMetadata.source && r.provenance.area === r.publicMetadata.area && same(r.provenance.topicIds, r.publicMetadata.topicIds) && Array.isArray(r.publicMetadata.topicIds) && r.publicMetadata.topicIds.length > 0 && text(r.provenance.rawType, 255), 'provenance_mismatch');
    const neutral = ['SR-Angestelltenklausur', 'SR-Anwaltsklausur'].includes(r.provenance.rawType);
    assert(neutral ? r.typeProjection === 'neutral' && r.publicMetadata.area === 'sr' && !Object.hasOwn(r.publicMetadata, 'type') : r.typeProjection === 'canonical' && text(r.publicMetadata.type, 255), 'type_projection_mismatch');
    assert(['zr', 'oeffr', 'sr', 'eur', 'steuer'].includes(String(r.publicMetadata.area)), 'area_mismatch');
  }
  assert(object(metadata) && metadata.format === 'stex-r37-metadata-request-templates' && metadata.version === 1 && metadata.templateOnly === true && metadata.runnable === false && metadata.planSha256 === profile.hashes.core && metadata.planId === core.planId && metadata.action === 'legacy-import' && Array.isArray(metadata.batches), 'template_mismatch');
  const batches = metadata.batches.map((b: unknown, i: number) => {
    assert(object(b) && b.batch === i + 1 && b.recordCount === profile.batchSizes[i] && object(b.requestTemplate) && b.requestTemplate.contractVersion === 1 && b.requestTemplate.action === 'legacy-import' && Array.isArray(b.requestTemplate.records), 'batch_mismatch');
    exact(b.requestTemplate, ['action', 'contractVersion', 'records']);
    assert(b.requestTemplate.records.length === profile.batchSizes[i] && b.requestTemplate.records.length <= 100 && Buffer.byteLength(JSON.stringify(b.requestTemplate)) + 8192 <= MAX_METADATA, 'metadata_limit');
    return b.requestTemplate.records as Obj[];
  });
  const records = batches.flat();
  assert(batches.length === profile.batchSizes.length && records.length === rows.length && same(records, rows.map(r => expectedRecord(r, core, profile))), 'template_mismatch');
  assert(object(pdf) && pdf.format === 'stex-r37-pdf-import-command-templates' && pdf.version === 1 && pdf.planSha256 === profile.hashes.core && pdf.planId === core.planId && pdf.templateOnly === true && pdf.runnable === false && pdf.bindAfterMetadataCommit === true && Array.isArray(pdf.commands), 'pdf_template_mismatch');
  const commands = rows.map(r => ({ contractVersion: 1, klausurId: r.klausurId, planId: core.planId, planSha256: profile.hashes.core, source: { ...r.pdf, role: 'kombiniert' } }));
  assert(same(commands, pdf.commands), 'pdf_template_mismatch');
  return { profile, planId: core.planId, rows, batches, pdfTemplates: commands, metadataRecords: records, core };
}

/** Every path component is inspected, including parents; credentials/checkpoints cannot be symlinks. */
async function noLinks(path: string): Promise<string> {
  assert(isAbsolute(path), 'absolute_path_required');
  const p = resolve(path); let at = p;
  while (true) { assert(!(await lstat(at)).isSymbolicLink(), 'symlink_denied'); const parent = dirname(at); if (parent === at) break; at = parent; }
  assert(await realpath(p) === p, 'symlink_denied'); return p;
}
async function checkedBytes(path: string, max = MAX_JSON, privateFile = false): Promise<Buffer> {
  await noLinks(path);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    assert(before.isFile() && before.nlink === 1 && before.size <= max, 'file_shape');
    if (privateFile) assert(before.uid === process.getuid?.() && (before.mode & 0o077) === 0, 'private_file_required');
    const chunks: Buffer[] = []; let size = 0;
    while (true) {
      const part = Buffer.alloc(Math.min(1024 * 1024, max - size + 1)); const { bytesRead } = await handle.read(part, 0, part.length, null);
      if (!bytesRead) break; size += bytesRead; assert(size <= max, 'file_too_large'); chunks.push(part.subarray(0, bytesRead));
    }
    const after = await handle.stat(), pathStat = await lstat(path);
    assert(before.dev === pathStat.dev && before.ino === pathStat.ino && before.size === size && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'source_changed');
    return Buffer.concat(chunks, size);
  } finally { await handle.close(); }
}
export async function loadPlan(files: ArtifactFiles, profile: Profile): Promise<Plan> {
  const values: unknown[] = [];
  for (const k of ['core', 'metadata', 'pdf'] as const) { const bytes = await checkedBytes(files[k]); assert(sha256(bytes) === profile.hashes[k], 'artifact_hash_mismatch'); values.push(json(bytes)); }
  return validatePlan(values[0], values[1], values[2], profile);
}
async function sourceBytes(root: string, path: string, max: number): Promise<Buffer> {
  assert(relPath(path), 'source_path_denied'); const resolved = resolve(root, path), rel = relative(root, resolved);
  assert(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'source_path_denied'); return checkedBytes(resolved, max);
}
export async function verifyJsonSource(root: string, row: PlanRow): Promise<void> {
  const bytes = await sourceBytes(root, row.provenance.originPath, MAX_JSON); assert(sha256(bytes) === row.provenance.originFileSha256, 'source_json_hash_mismatch');
  const value = json(bytes), values = Array.isArray(value) ? value : [value], source = values[row.provenance.recordIndex];
  assert(object(source) && source.id === row.sourceId && source.source === row.provenance.source && source.area === row.provenance.area && source.type === row.provenance.rawType && same(source.topicIds, row.provenance.topicIds) && source.title === row.publicMetadata.title && (source.date ?? '') === row.publicMetadata.date, 'source_json_record_mismatch');
}
export async function verifiedPdf(root: string, row: PlanRow): Promise<Buffer> {
  await verifyJsonSource(root, row);
  const bytes = await sourceBytes(root, `Klausuren_Komplett/${row.pdf.filename}`, MAX_PDF);
  assert(bytes.length === row.pdf.byteSize && sha256(bytes) === row.pdf.sha256, 'source_pdf_hash_mismatch'); return bytes;
}

/** Auth is held only in this object. Never serialized into progress, receipts or errors. */
export class SessionInput {
  #cookie: string;
  constructor(input: unknown, origin: string) {
    exact(input, ['format', 'version', 'origin', 'cookie']);
    assert(input.format === 'stex-catalog-session' && input.version === 1 && input.origin === origin && typeof input.cookie === 'string' && input.cookie.length <= 4096 && /^(?:__Secure-)?better-auth\.session_token=[A-Za-z0-9._~%+\/=\-]+$/.test(input.cookie), 'invalid_session_input');
    this.#cookie = input.cookie;
  }
  headers(origin: string): Headers { return new Headers({ cookie: this.#cookie, origin, 'x-stex-action': '1' }); }
  clear(): void { this.#cookie = ''; }
}
export async function sessionFile(path: string, origin: string): Promise<SessionInput> { return new SessionInput(json(await checkedBytes(path, 8192, true)), origin); }
export function sessionFD(fd: number, origin: string): SessionInput {
  assert(Number.isInteger(fd) && fd >= 3, 'protected_fd_required'); const stat = fstatSync(fd);
  assert((stat.isFIFO() || stat.isSocket()) || (stat.isFile() && stat.uid === process.getuid?.() && (stat.mode & 0o077) === 0 && stat.nlink === 1), 'protected_fd_required');
  const bytes: Buffer[] = []; let size = 0;
  while (true) { const part = Buffer.alloc(1024), n = readSync(fd, part, 0, part.length, null); if (!n) break; size += n; assert(size <= 8192, 'invalid_session_input'); bytes.push(part.subarray(0, n)); }
  return new SessionInput(json(Buffer.concat(bytes)), origin);
}

interface Account { userId: string; accessGeneration: number; sessionContext: string }
interface Item { requestId: string; status: 'new' | 'pending' | 'done'; semantic?: Obj; result?: Obj }
interface FirstPdfRetry { version: 1; parentItem: Item; parentReceipt: Obj; parentFingerprint: string; childRequestId: string;
  childCommand: Obj; childFingerprint: string; status: 'reserved' | 'sent' | 'done'; result?: Obj }
export interface State { format: 'stex-r37-catalog-apply-state'; version: 1; profile: Profile; files: ArtifactFiles; planId: string;
  owner: string | null; lastAccessGeneration: number | null; metadata: Item[]; pdf: Item[]; pdfBindings: Obj[] | null; pdfBindingsSha256: string | null; metadataReceiptsSha256: string | null; firstPdfRetry?: FirstPdfRetry }
function stateShape(state: unknown, plan: Plan): asserts state is State {
  exact(state, ['format', 'version', 'profile', 'files', 'planId', 'owner', 'lastAccessGeneration', 'metadata', 'pdf', 'pdfBindings', 'pdfBindingsSha256', 'metadataReceiptsSha256', ...(object(state) && Object.hasOwn(state, 'firstPdfRetry') ? ['firstPdfRetry'] : [])]);
  assert(state.format === 'stex-r37-catalog-apply-state' && state.version === 1 && same(state.profile, plan.profile) && state.planId === plan.planId && (state.owner === null || text(state.owner, 255)) && (state.lastAccessGeneration === null || positive(state.lastAccessGeneration)), 'checkpoint_mismatch');
  for (const phase of ['metadata', 'pdf'] as const) {
    const items = state[phase]; assert(Array.isArray(items) && items.length === (phase === 'metadata' ? plan.batches.length : plan.rows.length), 'checkpoint_mismatch');
    for (const [i, item] of items.entries()) {
      assert(object(item) && Object.keys(item).every(k => ['requestId', 'status', 'semantic', 'result'].includes(k)) && item.requestId === stableRequestId(plan.profile.hashes.core, phase, i) && ['new', 'pending', 'done'].includes(String(item.status)), 'checkpoint_mismatch');
      assert(item.status === 'new' ? !item.semantic && !item.result : object(item.semantic), 'checkpoint_mismatch');
      if (item.status !== 'new') {
        const sem = item.semantic as Obj;
        if (phase === 'metadata') { exact(sem, ['requestId', 'action', 'expectedAccountId', 'records', 'snapshot']); assert(sem.requestId === item.requestId && sem.action === 'legacy-import' && sem.expectedAccountId === state.owner && same(sem.records, plan.batches[i]) && hash(sem.snapshot), 'checkpoint_mismatch'); }
        else assert(Array.isArray(state.pdfBindings) && same(sem, state.pdfBindings[i]), 'checkpoint_mismatch');
      }
      if (item.status === 'done') assert(object(item.result) && Object.keys(item.result).every(k => ['requestId', 'status', 'rows', 'importId', 'klausurId', 'documentVersionId', 'documentId', 'versionNumber', 'sha256', 'byteSize'].includes(k)), 'checkpoint_mismatch');
      else assert(!item.result, 'checkpoint_mismatch');
    }
  }
  assert(Array.isArray(state.metadata) && Array.isArray(state.pdf), 'checkpoint_mismatch');
  if (state.pdfBindings !== null) {
    assert(Array.isArray(state.pdfBindings) && state.pdfBindings.length === plan.rows.length && state.metadata.every((i: unknown) => object(i) && i.status === 'done') && digest(state.pdfBindings) === state.pdfBindingsSha256 && digest(state.metadata.map((i: Item) => i.result)) === state.metadataReceiptsSha256, 'checkpoint_mismatch');
    for (const [i, c] of state.pdfBindings.entries()) {
      exact(c, ['contractVersion', 'klausurId', 'planId', 'planSha256', 'source', 'requestId', 'expectedMetadataRevision', 'expectedMetadataSha256', 'expectedDocuments']);
      assert(same(Object.fromEntries(Object.keys(plan.pdfTemplates[i]).map(k => [k, c[k]])), plan.pdfTemplates[i]) && c.requestId === state.pdf[i].requestId && positive(c.expectedMetadataRevision) && hash(c.expectedMetadataSha256) && same(c.expectedDocuments, []), 'checkpoint_mismatch');
    }
  } else assert(state.pdfBindingsSha256 === null && state.metadataReceiptsSha256 === null && state.pdf.every((i: Item) => i.status === 'new'), 'checkpoint_mismatch');
  if (state.firstPdfRetry !== undefined) validateFirstRetry(state as unknown as State, plan);
}
async function privateDir(path: string): Promise<void> { await noLinks(path); const s = await lstat(path); assert(s.isDirectory() && s.uid === process.getuid?.() && (s.mode & 0o077) === 0, 'private_directory_required'); }
async function syncDir(path: string): Promise<void> { const h = await open(path, constants.O_RDONLY); try { await h.sync(); } finally { await h.close(); } }
async function save(dir: string, state: State): Promise<void> {
  await privateDir(dir); const path = resolve(dir, 'checkpoint.json'), temp = resolve(dir, `.checkpoint-${process.pid}-${Date.now()}`);
  const h = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await h.writeFile(JSON.stringify({ state, sha256: digest(state) }) + '\n'); await h.sync(); } finally { await h.close(); }
  await rename(temp, path); await syncDir(dir);
}
export async function prepare(dir: string, files: ArtifactFiles, profile: Profile): Promise<State> {
  const plan = await loadPlan(files, profile); assert(isAbsolute(dir), 'absolute_path_required'); await noLinks(dirname(dir));
  await mkdir(dir, { mode: 0o700 }); await privateDir(dir);
  const state: State = { format: 'stex-r37-catalog-apply-state', version: 1, profile, files: { core: resolve(files.core), metadata: resolve(files.metadata), pdf: resolve(files.pdf) }, planId: plan.planId, owner: null, lastAccessGeneration: null,
    metadata: plan.batches.map((_, i) => ({ requestId: stableRequestId(profile.hashes.core, 'metadata', i), status: 'new' })), pdf: plan.rows.map((_, i) => ({ requestId: stableRequestId(profile.hashes.core, 'pdf', i), status: 'new' })), pdfBindings: null, pdfBindingsSha256: null, metadataReceiptsSha256: null };
  await save(dir, state); return state;
}
export async function loadState(dir: string, profile: Profile): Promise<{ state: State; plan: Plan }> {
  await privateDir(dir); const envelope = json(await checkedBytes(resolve(dir, 'checkpoint.json'), MAX_JSON, true)); exact(envelope, ['state', 'sha256']);
  assert(object(envelope.state) && hash(envelope.sha256) && digest(envelope.state) === envelope.sha256, 'checkpoint_mismatch');
  const stored = envelope.state.profile;
  assert(same(stored, profile) || (object(stored) && profile.hashes.core === PINNED.core && profile.operatorSha256 === sha256(await readFile(fileURLToPath(import.meta.url))) && same(stored, { ...profile, operatorSha256: PRE_RETRY_OPERATOR })), 'checkpoint_mismatch');
  exact(envelope.state.files, ['core', 'metadata', 'pdf']); const plan = await loadPlan(envelope.state.files as unknown as ArtifactFiles, stored as Profile); stateShape(envelope.state, plan);
  return { state: envelope.state, plan };
}
async function locked<T>(dir: string, work: () => Promise<T>): Promise<T> {
  await privateDir(dir); const path = resolve(dir, 'operator.lock'); const h = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600).catch(() => fail('operator_locked'));
  const identity = await h.stat();
  try { await h.writeFile(JSON.stringify({ pid: process.pid, host: hostname() })); await h.sync(); await syncDir(dir); return await work(); }
  finally { await h.close(); const s = await lstat(path); assert(s.ino === identity.ino && s.dev === identity.dev, 'lock_changed'); await unlink(path); await syncDir(dir); }
}
export async function recoverLock(dir: string, expectedSha256: string): Promise<void> {
  await privateDir(dir); const path = resolve(dir, 'operator.lock'), bytes = await checkedBytes(path, 4096, true); assert(sha256(bytes) === expectedSha256, 'lock_changed');
  const v = json(bytes); exact(v, ['pid', 'host']); assert(positive(v.pid) && v.host === hostname(), 'lock_host_mismatch');
  try { process.kill(v.pid, 0); fail('lock_process_alive'); } catch (e) { assert(object(e) && e.code === 'ESRCH', 'lock_process_alive'); }
  await unlink(path); await syncDir(dir);
}

/** HOST evidence is a physical target/release/backup gate, never an auth claim. */
export interface HostGate { format: 'stex-r37-catalog-apply-gate'; version: 1; phase: 'metadata' | 'pdf'; origin: string; target: typeof TARGET;
  coreSha256: string; operatorSha256: string; releaseManifestSha256: string; sourcePackageSha256: string; backupManifestSha256: string;
  backupCapturedAt: string; restoreVerifiedAt: string; restoreReference: string; targetSnapshotSha256: string; targetSnapshotReference: string;
  issuedAt: string; expiresAt: string; metadataReceiptsSha256: string | null; pdfBindingsSha256: string | null }
export function checkGate(v: unknown, phase: 'metadata' | 'pdf', state: State, now = Date.now(), operatorSha256 = state.profile.operatorSha256): asserts v is HostGate {
  exact(v, ['format', 'version', 'phase', 'origin', 'target', 'coreSha256', 'operatorSha256', 'releaseManifestSha256', 'sourcePackageSha256', 'backupManifestSha256', 'backupCapturedAt', 'restoreVerifiedAt', 'restoreReference', 'targetSnapshotSha256', 'targetSnapshotReference', 'issuedAt', 'expiresAt', 'metadataReceiptsSha256', 'pdfBindingsSha256']);
  assert(v.format === 'stex-r37-catalog-apply-gate' && v.version === 1 && v.phase === phase && v.origin === state.profile.origin && same(v.target, state.profile.target) && v.coreSha256 === state.profile.hashes.core && v.operatorSha256 === operatorSha256, 'host_gate_mismatch');
  for (const k of ['releaseManifestSha256', 'sourcePackageSha256', 'backupManifestSha256', 'targetSnapshotSha256']) assert(hash(v[k]), 'host_gate_mismatch');
  const issued = Date.parse(String(v.issuedAt)), expires = Date.parse(String(v.expiresAt)), backup = Date.parse(String(v.backupCapturedAt)), restore = Date.parse(String(v.restoreVerifiedAt));
  assert(Number.isFinite(issued) && Number.isFinite(expires) && Number.isFinite(backup) && Number.isFinite(restore) && backup <= restore && restore <= issued && issued <= now + 30000 && expires > now && expires - issued <= 86400000 && issued - backup <= 86400000 && text(v.restoreReference, 512) && text(v.targetSnapshotReference, 512), 'host_gate_expired_or_incomplete');
  assert(phase === 'pdf' ? state.pdfBindings !== null && v.pdfBindingsSha256 === state.pdfBindingsSha256 && v.metadataReceiptsSha256 === state.metadataReceiptsSha256 : v.pdfBindingsSha256 === null && v.metadataReceiptsSha256 === null, 'phase_binding_mismatch');
}

type Transport = (request: Request) => Promise<Response>;
export class CatalogAPI {
  readonly origin: string;
  private readonly session: SessionInput;
  private readonly transport: Transport;
  constructor(origin: string, session: SessionInput, transport: Transport = request => fetch(request, { redirect: 'error' })) {
    this.origin = origin; this.session = session; this.transport = transport;
  }
  async call(path: string, method = 'GET', body?: Obj | FormData): Promise<{ status: number; value: Obj }> {
    const url = new URL(path, this.origin); assert(url.origin === this.origin && !url.username && !url.password && !url.hash && /^\/api\/catalog\/(metadata(?:\/preview)?|legacy-import|klausuren)$/.test(url.pathname), 'origin_or_route_denied');
    const headers = this.session.headers(this.origin); let bytes: string | FormData | undefined;
    if (body instanceof FormData) bytes = body; else if (body) { headers.set('content-type', 'application/json'); bytes = JSON.stringify(body); assert(Buffer.byteLength(bytes) <= MAX_METADATA, 'metadata_limit'); }
    const request = new Request(url, { method, headers, body: bytes, redirect: 'error', signal: AbortSignal.timeout(60000) });
    let response: Response; try { response = await this.transport(request); } catch { fail('response_unknown'); }
    assert(!response.redirected && (response.status < 300 || response.status >= 400) && (!response.url || new URL(response.url).origin === this.origin), 'redirect_or_response_denied');
    assert(response.headers.get('content-type')?.split(';', 1)[0].trim() === 'application/json' && !!response.body, 'invalid_response');
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_JSON) { await reader.cancel(); fail('response_too_large'); } chunks.push(value); } }
    catch (e) { if (e instanceof ApplyError) throw e; fail('response_unknown'); }
    finally { reader.releaseLock(); }
    const value = json(Buffer.concat(chunks, size)); assert(object(value) && value.contractVersion === 1, 'invalid_response');
    return { status: response.status, value };
  }
  async ok(path: string, method = 'GET', body?: Obj | FormData): Promise<Obj> { const r = await this.call(path, method, body); assert(r.status >= 200 && r.status < 300, `http_${r.status}`); return r.value; }
  async context(probeRequestId: string): Promise<Account> {
    const value = await this.ok('/api/catalog/metadata'), a = value.account;
    assert(object(a) && text(a.userId, 255) && positive(a.accessGeneration) && hash(a.sessionContext), 'invalid_account_context');
    // Existing route checks active admin + fresh session/TOTP before owner-scoped lookup.
    const probe = await this.call(`/api/catalog/legacy-import?requestId=${encodeURIComponent(probeRequestId)}`);
    assert(probe.status === 200 || (probe.status === 404 && object(probe.value.error) && probe.value.error.code === 'not_found'), `fresh_admin_required_${probe.status}`);
    return a as unknown as Account;
  }
}
function context(a: Account): Obj { return { contractVersion: 1, expectedAccountId: a.userId, expectedAccessGeneration: a.accessGeneration, expectedSessionContext: a.sessionContext }; }
function assertAccount(value: Obj, account: Account): void { assert(same(value.account, account), 'account_changed'); }
interface CatalogRow { id: string; revision: number; metadata: Obj; documents: Obj[] }
async function catalog(api: CatalogAPI, plan: Plan): Promise<Map<string, CatalogRow>> {
  const value = await api.ok('/api/catalog/klausuren'); assert(Array.isArray(value.klausuren), 'invalid_catalog'); const result = new Map<string, CatalogRow>();
  for (const raw of value.klausuren) {
    assert(object(raw) && id(raw.id), 'invalid_catalog'); if (!plan.rows.some(r => r.klausurId === raw.id)) continue;
    assert(!result.has(raw.id) && positive(raw.revision) && object(raw.metadata) && Array.isArray(raw.documents), 'invalid_catalog'); result.set(raw.id, raw as unknown as CatalogRow);
  }
  return result;
}
function assertMetadata(row: CatalogRow | undefined, expected: Obj): asserts row is CatalogRow {
  assert(row && row.metadata.id === expected.id && text(row.metadata.createdAt) && text(row.metadata.updatedAt) && Number.isFinite(Date.parse(row.metadata.createdAt)) && Number.isFinite(Date.parse(row.metadata.updatedAt)), 'full_target_payload_required');
  const projection = Object.fromEntries(['id', 'source', 'date', 'title', 'area', 'type', 'topicIds', 'legacy'].filter(k => Object.hasOwn(row.metadata, k)).map(k => [k, row.metadata[k]]));
  assert(same(projection, expected), 'target_metadata_mismatch');
}
function metadataResult(v: Obj, item: Item, batch: Obj[], account: Account): Obj {
  assertAccount(v, account); assert(v.requestId === item.requestId && v.action === 'legacy-import' && v.status === 'committed' && Array.isArray(v.rows) && v.rows.length === batch.length, 'metadata_receipt_conflict');
  assert(v.rows.every((r, i) => object(r) && r.id === batch[i].id && positive(r.revision) && ['created', 'identical'].includes(String(r.outcome))), 'metadata_receipt_conflict');
  return { requestId: item.requestId, status: 'committed', rows: v.rows.map(r => ({ id: r.id, revision: r.revision, outcome: r.outcome })) };
}
function pdfResult(v: Obj, item: Item, row: PlanRow): Obj {
  const r = v.import; assert(object(r) && r.requestId === item.requestId && r.status === 'committed' && r.technicalValidation === 'valid' && r.errorCode === null && r.errorMessage === null && r.klausurId === row.klausurId && text(r.importId) && Array.isArray(r.documents) && r.documents.length === 1, 'pdf_receipt_conflict');
  const d = r.documents[0]; assert(object(d) && d.role === 'kombiniert' && d.versionNumber === 1 && d.sha256 === row.pdf.sha256 && Number(d.byteSize) === row.pdf.byteSize && d.sourceFilename === row.pdf.filename && text(d.documentId) && text(d.documentVersionId), 'pdf_receipt_conflict');
  return { requestId: item.requestId, status: 'committed', importId: r.importId, klausurId: r.klausurId, documentId: d.documentId, documentVersionId: d.documentVersionId, versionNumber: 1, sha256: d.sha256, byteSize: Number(d.byteSize) };
}
export interface RunOptions { dir: string; profile: Profile; session: SessionInput; gate: unknown; sourceRoot: string; maxSteps: number; maxSeconds?: number; transport?: Transport }
async function run(options: RunOptions, phase: 'metadata' | 'pdf', work: (state: State, plan: Plan, api: CatalogAPI, account: Account, deadline: number) => Promise<void>): Promise<State> {
  assert(Number.isSafeInteger(options.maxSteps) && options.maxSteps >= 1 && options.maxSteps <= (phase === 'metadata' ? 5 : 449), 'invalid_step_limit');
  assert((options.maxSeconds ?? 300) >= 1 && (options.maxSeconds ?? 300) <= 480, 'invalid_time_limit');
  return locked(options.dir, async () => {
    const { state, plan } = await loadState(options.dir, options.profile); checkGate(options.gate, phase, state, Date.now(), options.profile.operatorSha256);
    const api = new CatalogAPI(options.profile.origin, options.session, options.transport), account = await api.context(state.pdf[0].requestId);
    assert(state.owner === null || state.owner === account.userId, 'owner_changed'); state.owner = account.userId; state.lastAccessGeneration = account.accessGeneration; await save(options.dir, state);
    await work(state, plan, api, account, Date.now() + (options.maxSeconds ?? 300) * 1000); return state;
  });
}
export async function applyMetadata(options: RunOptions): Promise<State> {
  return run(options, 'metadata', async (state, plan, api, initialAccount, deadline) => {
    let steps = 0;
    for (const [i, item] of state.metadata.entries()) {
      if (item.status === 'done') continue; if (steps >= options.maxSteps || Date.now() >= deadline) break;
      checkGate(options.gate, 'metadata', state, Date.now(), options.profile.operatorSha256); const account = await api.context(state.pdf[0].requestId); assert(account.userId === initialAccount.userId, 'owner_changed');
      // Always resolve the durable, owner-scoped receipt before considering a POST.
      const status = await api.call(`/api/catalog/metadata?requestId=${encodeURIComponent(item.requestId)}`);
      if (status.status === 200) {
        assert(item.status === 'pending' && item.semantic, 'receipt_without_pending_command');
        item.result = metadataResult(status.value, item, plan.batches[i], account);
      } else {
        assert(status.status === 404 && object(status.value.error) && status.value.error.code === 'not_found', `http_${status.status}`);
        for (const row of plan.rows.slice(plan.batches.slice(0, i).flat().length, plan.batches.slice(0, i + 1).flat().length)) await verifyJsonSource(options.sourceRoot, row);
        const before = await catalog(api, plan);
        for (const record of plan.batches[i]) { const row = before.get(String(record.id)); if (row) { assertMetadata(row, record); assert(row.documents.length === 0, 'unexpected_document_state'); } }
        const p = await api.ok('/api/catalog/metadata/preview?legacy=1', 'POST', { ...context(account), action: 'legacy-import', records: plan.batches[i] });
        assertAccount(p, account); assert(p.action === 'legacy-import' && same(p.records, plan.batches[i]) && hash(p.snapshot) && Array.isArray(p.rows) && p.rows.length === plan.batches[i].length && p.rows.every((r, n) => object(r) && r.id === plan.batches[i][n].id && ['create', 'identical'].includes(String(r.disposition))), 'target_preview_conflict');
        if (item.semantic) assert(item.semantic.snapshot === p.snapshot, 'pending_preview_changed');
        else item.semantic = { requestId: item.requestId, action: 'legacy-import', expectedAccountId: account.userId, records: p.records, snapshot: p.snapshot };
        item.status = 'pending'; await save(options.dir, state);
        const result = await api.ok('/api/catalog/metadata?legacy=1', 'POST', { ...item.semantic, ...context(account) });
        item.result = metadataResult(result, item, plan.batches[i], account);
      }
      const current = await catalog(api, plan); for (const record of plan.batches[i]) { const row = current.get(String(record.id)); assertMetadata(row, record); assert(row.documents.length === 0, 'unexpected_document_state'); }
      item.status = 'done'; state.lastAccessGeneration = account.accessGeneration; await save(options.dir, state); steps++;
    }
  });
}
/** Online read-only binding step, after every metadata batch is confirmed. No source PDF is read. */
export async function preparePdfs(dir: string, profile: Profile, session: SessionInput, transport?: Transport): Promise<State> {
  return locked(dir, async () => {
    const { state, plan } = await loadState(dir, profile); assert(state.metadata.every(v => v.status === 'done'), 'metadata_phase_incomplete'); assert(state.pdfBindings === null, 'pdf_bindings_already_exist');
    const api = new CatalogAPI(profile.origin, session, transport), account = await api.context(state.pdf[0].requestId); assert(account.userId === state.owner, 'owner_changed');
    const current = await catalog(api, plan); assert(current.size === plan.rows.length, 'target_coverage_mismatch');
    state.pdfBindings = plan.rows.map((r, i) => {
      const row = current.get(r.klausurId); assertMetadata(row, plan.metadataRecords[i]); assert(row.documents.length === 0, 'unexpected_document_state');
      return { ...plan.pdfTemplates[i], requestId: state.pdf[i].requestId, expectedMetadataRevision: row.revision, expectedMetadataSha256: digest(row.metadata), expectedDocuments: [] };
    });
    state.pdfBindingsSha256 = digest(state.pdfBindings); state.metadataReceiptsSha256 = digest(state.metadata.map(i => i.result)); state.lastAccessGeneration = account.accessGeneration;
    await save(dir, state); return state;
  });
}
function checkCompletedPdfs(state: State, plan: Plan, current: Map<string, CatalogRow>): void {
  for (const [i, item] of state.pdf.entries()) {
    if (item.status !== 'done') continue;
    const row = current.get(plan.rows[i].klausurId), command = state.pdfBindings![i]; assertMetadata(row, plan.metadataRecords[i]);
    assert(row.revision === command.expectedMetadataRevision && digest(row.metadata) === command.expectedMetadataSha256, 'target_revision_or_payload_changed');
    const d = row.documents[0];
    assert(row.documents.length === 1 && d.documentVersionId === item.result!.documentVersionId && d.documentId === item.result!.documentId && d.role === 'kombiniert' && d.versionNumber === 1 && d.sha256 === plan.rows[i].pdf.sha256 && Number(d.byteSize) === plan.rows[i].pdf.byteSize, 'unexpected_document_state');
  }
}

/** One additive technical attempt for index zero. Never changes plan/source IDs. */
export function firstRetryRequestId(parentRequestId: string, command: Obj): string {
  const h = digest(['stex-r37-first-pdf-explicit-retry-v1', parentRequestId, digest({ legacy: command })]);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function firstRetryScope(state: State, plan: Plan): void {
  assert(state.pdfBindings && state.owner && state.metadata.every(i => i.status === 'done') && plan.rows[0].klausurId === 'kg-sr-061'
    && plan.rows[0].pdf.byteSize === 4451270 && state.pdfBindings[0].expectedMetadataRevision === 1, 'retry_scope_mismatch');
  if (plan.profile.hashes.core === PINNED.core) assert(state.pdf[0].requestId === 'a834ffa0-f351-52b3-b55b-3e6184a8c1c0', 'retry_scope_mismatch');
}
function failedParent(receipt: unknown, state: State): asserts receipt is Obj {
  assert(object(receipt) && receipt.requestId === state.pdf[0].requestId && receipt.status === 'failed' && receipt.errorCode === 'unavailable'
    && receipt.technicalValidation === 'valid' && receipt.klausurId === null && Array.isArray(receipt.documents) && receipt.documents.length === 0 && text(receipt.importId), 'retry_parent_not_terminal_empty');
  if (state.profile.hashes.core === PINNED.core) assert(receipt.importId === 'ci-4f40317b-f17d-4e24-bbd2-2b036db9ff55', 'retry_parent_mismatch');
}
function validateFirstRetry(state: State, plan: Plan): void {
  firstRetryScope(state, plan);
  const r = state.firstPdfRetry!;
  exact(r, ['version', 'parentItem', 'parentReceipt', 'parentFingerprint', 'childRequestId', 'childCommand', 'childFingerprint', 'status', ...(object(r) && Object.hasOwn(r, 'result') ? ['result'] : [])]);
  const command = state.pdfBindings![0], child = { ...command, requestId: firstRetryRequestId(state.pdf[0].requestId, command) };
  assert(r.version === 1 && same(r.parentItem, { requestId: state.pdf[0].requestId, status: 'pending', semantic: command })
    && r.parentFingerprint === digest({ legacy: command }) && r.childRequestId === child.requestId && same(r.childCommand, child)
    && r.childFingerprint === digest({ legacy: child }) && ['reserved', 'sent', 'done'].includes(r.status), 'retry_ledger_mismatch');
  failedParent(r.parentReceipt, state);
  assert(r.status === 'done' ? state.pdf[0].status === 'done' && object(r.result) && same(state.pdf[0].result, r.result) && r.result.requestId === r.childRequestId
    : state.pdf[0].status === 'pending' && !r.result && !state.pdf[0].result && state.pdf.slice(1).every(i => i.status === 'new'), 'retry_ledger_mismatch');
}
export async function retryFirstPdf(options: RunOptions): Promise<State> {
  assert(options.maxSteps === 1, 'retry_scope_mismatch');
  return run(options, 'pdf', async (state, plan, api, account) => {
    firstRetryScope(state, plan);
    const item = state.pdf[0], command = state.pdfBindings![0], source = plan.rows[0];
    assert(state.firstPdfRetry || (item.status === 'pending' && same(item.semantic, command) && state.pdf.slice(1).every(i => i.status === 'new')), 'retry_scope_mismatch');
    const parent = await api.ok(`/api/catalog/legacy-import?requestId=${encodeURIComponent(item.requestId)}`);
    failedParent(parent.import, state);
    let retry = state.firstPdfRetry;
    if (retry) assert(same(parent.import, retry.parentReceipt), 'retry_parent_changed');
    const requestId = firstRetryRequestId(item.requestId, command);
    // GET always precedes any POST; a persisted sent/unknown attempt never POSTs again.
    const status = await api.call(`/api/catalog/legacy-import?requestId=${encodeURIComponent(requestId)}`);
    let result: Obj | undefined;
    if (status.status === 200) {
      assert(retry && retry.status !== 'reserved', 'retry_receipt_without_send');
      result = pdfResult(status.value, { requestId, status: 'pending' }, source);
      if (retry.status === 'done') assert(same(result, retry.result), 'pdf_receipt_conflict');
    } else {
      assert(status.status === 404 && object(status.value.error) && status.value.error.code === 'not_found', `http_${status.status}`);
      assert(!retry || retry.status === 'reserved', 'retry_outcome_unknown');
    }
    const before = await catalog(api, plan); assert(before.size === plan.rows.length, 'target_coverage_mismatch'); checkCompletedPdfs(state, plan, before);
    // Every original metadata row remains core-identical. Prior to the first child
    // commit the whole document set must still be empty.
    for (const [i, row] of plan.rows.entries()) {
      const current = before.get(row.klausurId); assertMetadata(current, plan.metadataRecords[i]);
      assert(current.revision === state.pdfBindings![i].expectedMetadataRevision && digest(current.metadata) === state.pdfBindings![i].expectedMetadataSha256, 'target_revision_or_payload_changed');
      if (i !== 0 && state.pdf[i].status === 'new') assert(current.documents.length === 0, 'unexpected_document_state');
    }
    if (!result) {
      assert(before.get(source.klausurId)!.documents.length === 0, 'unexpected_document_state');
      const bytes = await verifiedPdf(options.sourceRoot, source);
      const childCommand = { ...command, requestId };
      const form = new FormData(); form.set('command', JSON.stringify(childCommand)); form.set('kombiniert', new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }), source.pdf.filename);
      assert((await new Request(options.profile.origin, { method: 'POST', body: form }).arrayBuffer()).byteLength <= MAX_REQUEST && Buffer.byteLength(JSON.stringify(childCommand)) <= 32768, 'pdf_request_limit');
      // Recheck after source I/O; login remains a human action via catalog-session.
      assert(same(await api.context(item.requestId), account), 'account_changed');
      checkGate(options.gate, 'pdf', state, Date.now(), options.profile.operatorSha256);
      if (!retry) {
        retry = { version: 1, parentItem: structuredClone(item), parentReceipt: parent.import, parentFingerprint: digest({ legacy: command }), childRequestId: requestId,
          childCommand, childFingerprint: digest({ legacy: childCommand }), status: 'reserved' };
        state.firstPdfRetry = retry; await save(options.dir, state);
      }
      retry.status = 'sent'; await save(options.dir, state);
      result = pdfResult(await api.ok('/api/catalog/legacy-import', 'POST', form), { requestId, status: 'pending' }, source);
    }
    const after = await catalog(api, plan), current = after.get(source.klausurId); assertMetadata(current, plan.metadataRecords[0]);
    assert(current.revision === 1 && digest(current.metadata) === command.expectedMetadataSha256, 'target_revision_or_payload_changed');
    assert(current.documents.length === 1, 'unexpected_document_state');
    const confirmed = await api.ok(`/api/catalog/legacy-import?requestId=${encodeURIComponent(requestId)}`);
    assert(same(pdfResult(confirmed, { requestId, status: 'pending' }, source), result) && same(current.documents, (confirmed.import as Obj).documents), 'pdf_receipt_conflict');
    assert(same((await api.ok(`/api/catalog/legacy-import?requestId=${encodeURIComponent(item.requestId)}`)).import, retry!.parentReceipt), 'retry_parent_changed');
    assert(same(await api.context(item.requestId), account), 'account_changed');
    checkGate(options.gate, 'pdf', state, Date.now(), options.profile.operatorSha256);
    retry!.status = 'done'; retry!.result = result; item.result = result; item.status = 'done';
    checkCompletedPdfs(state, plan, after); await save(options.dir, state);
  });
}
export async function applyPdfs(options: RunOptions): Promise<State> {
  return run(options, 'pdf', async (state, plan, api, initialAccount, deadline) => {
    assert(state.pdfBindings && state.metadata.every(i => i.status === 'done'), 'metadata_phase_incomplete'); let steps = 0;
    for (const [i, item] of state.pdf.entries()) {
      if (item.status === 'done') continue; if (steps >= options.maxSteps || Date.now() >= deadline) break;
      assert(i !== 0 || !state.firstPdfRetry, 'explicit_retry_required');
      checkGate(options.gate, 'pdf', state, Date.now(), options.profile.operatorSha256); const account = await api.context(item.requestId); assert(account.userId === initialAccount.userId, 'owner_changed');
      const command = state.pdfBindings[i], row = plan.rows[i];
      const status = await api.call(`/api/catalog/legacy-import?requestId=${encodeURIComponent(item.requestId)}`);
      let processing = false;
      if (status.status === 200) {
        const r = status.value.import; assert(object(r), 'invalid_response');
        if (r.status === 'committed') { assert(item.status === 'pending' && item.semantic, 'receipt_without_pending_command'); item.result = pdfResult(status.value, item, row); }
        else { assert(r.status === 'processing' && r.requestId === item.requestId, 'pdf_receipt_failed'); processing = true; }
      } else assert(status.status === 404 && object(status.value.error) && status.value.error.code === 'not_found', `http_${status.status}`);
      const currentCatalog = await catalog(api, plan); checkCompletedPdfs(state, plan, currentCatalog);
      const current = currentCatalog.get(row.klausurId); assertMetadata(current, plan.metadataRecords[i]);
      assert(current.revision === command.expectedMetadataRevision && digest(current.metadata) === command.expectedMetadataSha256, 'target_revision_or_payload_changed');
      if (!item.result) {
        assert(current.documents.length === 0 && (!processing || item.status === 'pending'), 'unexpected_document_state');
        const bytes = await verifiedPdf(options.sourceRoot, row);
        const form = new FormData(); form.set('command', JSON.stringify(command)); form.set('kombiniert', new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }), row.pdf.filename);
        const requestBytes = (await new Request(options.profile.origin, { method: 'POST', body: form }).arrayBuffer()).byteLength; assert(requestBytes <= MAX_REQUEST && Buffer.byteLength(JSON.stringify(command)) <= 32768, 'pdf_request_limit');
        item.semantic = command; item.status = 'pending'; await save(options.dir, state);
        item.result = pdfResult(await api.ok('/api/catalog/legacy-import', 'POST', form), item, row);
      } else { item.semantic = command; assert(current.documents.length === 1 && current.documents[0].documentVersionId === item.result.documentVersionId && current.documents[0].documentId === item.result.documentId, 'unexpected_document_state'); }
      item.status = 'done'; state.lastAccessGeneration = account.accessGeneration; await save(options.dir, state); steps++;
    }
    checkCompletedPdfs(state, plan, await catalog(api, plan));
  });
}

export function summary(state: State): Obj { return { planSha256: state.profile.hashes.core, metadataDone: state.metadata.filter(i => i.status === 'done').length, metadataTotal: state.metadata.length, pdfDone: state.pdf.filter(i => i.status === 'done').length, pdfTotal: state.pdf.length, pendingMetadata: state.metadata.filter(i => i.status === 'pending').map(i => i.requestId), pendingPdf: state.pdf.filter(i => i.status === 'pending').map(i => i.requestId), pdfBindingsSha256: state.pdfBindingsSha256, metadataReceiptsSha256: state.metadataReceiptsSha256 }; }
async function main(argv: string[]): Promise<void> {
  const action = argv[0], allowed = ['--state-dir', '--core', '--metadata-templates', '--pdf-templates', '--source-root', '--cookie-file', '--cookie-fd', '--host-gate', '--host-gate-sha256', '--max-steps', '--max-seconds', '--lock-sha256'];
  assert(['inspect', 'prepare', 'status', 'prepare-pdfs', 'apply-metadata', 'apply-pdfs', 'retry-first-pdf', 'recover-lock'].includes(action), 'invalid_action'); const args = new Map<string, string>();
  for (let i = 1; i < argv.length; i += 2) { assert(allowed.includes(argv[i]) && !args.has(argv[i]) && !!argv[i + 1] && !argv[i + 1].startsWith('--'), 'invalid_argument'); args.set(argv[i], argv[i + 1]); }
  const required = (key: string) => { const value = args.get(key); assert(value, 'missing_argument'); return value; };
  const specific: Record<string, string[]> = { inspect: ['--core', '--metadata-templates', '--pdf-templates'], prepare: ['--core', '--metadata-templates', '--pdf-templates', '--state-dir'], status: ['--state-dir'], 'recover-lock': ['--state-dir', '--lock-sha256'], 'prepare-pdfs': ['--state-dir', '--cookie-file', '--cookie-fd'], 'apply-metadata': ['--state-dir', '--source-root', '--cookie-file', '--cookie-fd', '--host-gate', '--host-gate-sha256', '--max-steps', '--max-seconds'], 'apply-pdfs': ['--state-dir', '--source-root', '--cookie-file', '--cookie-fd', '--host-gate', '--host-gate-sha256', '--max-steps', '--max-seconds'] };
  specific['retry-first-pdf'] = specific['apply-pdfs'];
  assert([...args.keys()].every(k => specific[action].includes(k)), 'invalid_argument');
  const profile: Profile = { origin: ORIGIN, target: TARGET, records: 449, batchSizes: [100, 100, 100, 100, 49], hashes: PINNED, operatorSha256: sha256(await readFile(fileURLToPath(import.meta.url))) };
  if (action === 'inspect' || action === 'prepare') {
    const files = { core: resolve(required('--core')), metadata: resolve(required('--metadata-templates')), pdf: resolve(required('--pdf-templates')) };
    if (action === 'inspect') { const p = await loadPlan(files, profile); process.stdout.write(JSON.stringify({ mode: 'offline-inspect', records: p.rows.length, metadataBatches: p.batches.length, pdfTemplates: p.pdfTemplates.length, planSha256: PINNED.core, runnable: false }) + '\n'); }
    else process.stdout.write(JSON.stringify({ mode: 'offline-prepare', ...summary(await prepare(resolve(required('--state-dir')), files, profile)), runnable: false }) + '\n'); return;
  }
  const dir = resolve(required('--state-dir'));
  if (action === 'recover-lock') { await recoverLock(dir, required('--lock-sha256')); process.stdout.write('{"lockRecovered":true}\n'); return; }
  if (action === 'status') { process.stdout.write(JSON.stringify(summary((await loadState(dir, profile)).state)) + '\n'); return; }
  assert(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'tls_verification_required');
  assert(Number(args.has('--cookie-file')) + Number(args.has('--cookie-fd')) === 1, 'one_session_input_required');
  const session = args.has('--cookie-file') ? await sessionFile(resolve(required('--cookie-file')), ORIGIN) : sessionFD(Number(required('--cookie-fd')), ORIGIN);
  try {
    if (action === 'prepare-pdfs') { process.stdout.write(JSON.stringify({ mode: 'online-read-only-bind', ...summary(await preparePdfs(dir, profile, session)) }) + '\n'); return; }
    const gateBytes = await checkedBytes(resolve(required('--host-gate')), 32768, true); assert(sha256(gateBytes) === required('--host-gate-sha256'), 'host_gate_hash_mismatch');
    const options: RunOptions = { dir, profile, session, gate: json(gateBytes), sourceRoot: resolve(required('--source-root')), maxSteps: Number(args.get('--max-steps') ?? '1'), maxSeconds: Number(args.get('--max-seconds') ?? '300') };
    const state = action === 'apply-metadata' ? await applyMetadata(options) : action === 'retry-first-pdf' ? await retryFirstPdf(options) : await applyPdfs(options); process.stdout.write(JSON.stringify({ mode: action, ...summary(state) }) + '\n');
  } finally { session.clear(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main(process.argv.slice(2)).catch(error => { process.stderr.write(JSON.stringify({ error: error instanceof ApplyError ? error.code : 'local_io_or_operator_unavailable' }) + '\n'); process.exitCode = 1; });
}
