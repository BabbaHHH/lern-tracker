import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TOPICS, getLeafTopics } from '../../src/lib/topics';
import { CATALOG_MAX_FILE_BYTES } from '../../src/lib/catalog/limits';

/** Offline proposal/verification only. No database, HTTP, browser or write imports. */
export const TARGET = { database: 'stex_rollback_r36_20261023', schemaVersion: 18,
  fileRoot: '/srv/stex/data/contabo-test/r36-rollback-20261023/files' } as const;
const hash = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v !== null && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
  : JSON.stringify(v);
const digestPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const types = new Set(['Urteil', 'Beschluss', 'Anwaltsklausur', 'Kautelarklausur', 'Behördenklausur', 'Aktenvortrag',
  'Anklageklausur', 'Revisionsklausur', 'Plädoyer', 'Haftklausur', 'Einspruch Strafbefehl', 'Abschlussverfügung']);
const topics = new Set(getLeafTopics(TOPICS).map(t => t.id));
const supplements = new Set([
  'Klausuren KG/Sonstiges/merged/Europarecht/EURS 29 Wolke - Komplett.json',
  'Klausuren KG/Sonstiges/merged/Europarecht/EURS 39 Wolke - Komplett.json',
  'Klausuren KG/Sonstiges/merged/Steuerrecht/STEURS 30 Wolke - Komplett.json',
]);
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function fail(code: string): never { throw new PlanError(code); }
export class PlanError extends Error { constructor(readonly code: string) { super(code); } }
function exact(v: object, keys: string[]) { if (Object.keys(v).some(k => !keys.includes(k))) fail('unexpected_field'); }
function text(v: unknown): v is string { return typeof v === 'string' && !!v && !/[\x00-\x1f\x7f]/.test(v); }
function sha(v: unknown): v is string { return typeof v === 'string' && digestPattern.test(v); }
function localPath(p: string): boolean { return !!p && !isAbsolute(p) && !p.split('/').some(c => !c || c === '.' || c === '..') && !/[\\\x00-\x1f\x7f]/.test(p); }
function pdfPath(p: string) { return localPath(p) && /^Klausuren_Komplett\/[^/]+\.pdf$/i.test(p); }
function metadataPath(p: string) { return localPath(p) && (/^Klausuren_Komplett\/[^/]+\.json$/i.test(p)
  || p === 'Lernplan Dokumente/klausuren_clean.json' || supplements.has(p)); }

export interface PdfBinding { relativePath: string; byteSize: number; sha256: string; verifiedDocumentRole: string | null }
export interface Association { originPath: string; originFileSha256: string; recordIndex: number; id: string;
  source: string; area: string; type: string; topicIds: string[]; resolvedPdfPath: string; resolution: string }
interface Manifest { format: string; version: number; target: typeof TARGET;
  userNamedFolderObservation: { pdfFiles: PdfBinding[]; metadataAssociations: Association[] } }
export interface MapEntry {
  pdfPath: string; pdfSha256: string; sourceId: string | null; metadata: Association | null;
  proposedTargetId: string | null; idPolicy: 'retain-unique-source-id' | 'namespace-all-collision-members' | 'unresolved';
  historicalBrowserId: null; requestedRole: 'kombiniert'; roleVerified: boolean;
  typeProjection?: { source: string | null; target: string | null; status: 'accepted-alias' | 'unchanged' | 'unresolved' };
}
export interface ProjectionPolicy {
  decisionReference: string;
  aliasSource: { path: 'lern-tracker/src/lib/store.ts'; sha256: string };
  aliases: Record<string, string>;
  combinedRoleDeclaration: { basis: 'user-declaration'; reference: string; contentCompletenessVerified: false };
}
export interface IdProposal {
  format: 'stex-r37-catalog-id-map'; version: 1 | 2; status: 'proposal' | 'accepted'; decisionReference: string | null;
  manifestSha256: string; target: typeof TARGET; supplementalMetadata: Association[]; entries: MapEntry[];
  projection?: ProjectionPolicy;
}
export function proposedCollisionId(pdfRelativePath: string): string {
  return `r37-${hash(canonical(['stex-r37-case-v1', pdfRelativePath])).slice(0, 32)}`;
}
export function proposeIds(manifest: Manifest, manifestSha256: string, supplementalMetadata: Association[] = []): IdProposal {
  const associations = [...manifest.userNamedFolderObservation.metadataAssociations, ...supplementalMetadata];
  const counts = new Map<string, number>();
  for (const a of associations) counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
  return { format: 'stex-r37-catalog-id-map', version: 1, status: 'proposal', decisionReference: null,
    manifestSha256, target: TARGET, supplementalMetadata,
    entries: manifest.userNamedFolderObservation.pdfFiles.map(pdf => {
      const found = associations.filter(a => a.resolvedPdfPath === pdf.relativePath);
      const a = found.length === 1 ? found[0] : null;
      const policy = !a ? 'unresolved' : counts.get(a.id) === 1 && idPattern.test(a.id)
        ? 'retain-unique-source-id' : 'namespace-all-collision-members';
      return { pdfPath: pdf.relativePath, pdfSha256: pdf.sha256, sourceId: a?.id ?? null, metadata: a,
        proposedTargetId: !a ? null : policy === 'retain-unique-source-id' ? a.id : proposedCollisionId(pdf.relativePath),
        idPolicy: policy, historicalBrowserId: null, requestedRole: 'kombiniert', roleVerified: false };
    }) };
}

/** Read only the existing literal alias declaration, never execute source code. */
export function declaredTypeAliases(source: string): Record<string, string> {
  const block = source.match(/const TYPE_NORMALIZE: Record<string, KlausurType> = \{([\s\S]*?)\n\};/);
  if (!block) fail('alias_declaration_changed');
  const clean = block[1].replace(/\/\/[^\n]*/g, '');
  const result: Record<string, string> = {};
  const remainder = clean.replace(/"([^"\\]+)"\s*:\s*"([^"\\]+)"\s*,?/g, (_all, key: string, value: string) => {
    if (Object.hasOwn(result, key) || !types.has(value)) fail('alias_declaration_changed');
    result[key] = value; return '';
  });
  if (remainder.trim() || !Object.keys(result).length) fail('alias_declaration_changed');
  return result;
}
function projectionPolicy(v: unknown): ProjectionPolicy {
  if (!object(v)) fail('projection_shape');
  exact(v, ['decisionReference','aliasSource','aliases','combinedRoleDeclaration']);
  if (!text(v.decisionReference) || !object(v.aliasSource) || !object(v.aliases) || !object(v.combinedRoleDeclaration)) fail('projection_shape');
  exact(v.aliasSource, ['path','sha256']); exact(v.combinedRoleDeclaration, ['basis','reference','contentCompletenessVerified']);
  if (v.aliasSource.path !== 'lern-tracker/src/lib/store.ts' || !sha(v.aliasSource.sha256)
    || Object.values(v.aliases).some(value => typeof value !== 'string' || !types.has(value))
    || v.combinedRoleDeclaration.basis !== 'user-declaration' || !text(v.combinedRoleDeclaration.reference)
    || v.combinedRoleDeclaration.contentCompletenessVerified !== false) fail('projection_shape');
  return v as unknown as ProjectionPolicy;
}
export function projectIds(base: IdProposal, projection: ProjectionPolicy): IdProposal {
  projectionPolicy(projection);
  return { ...structuredClone(base), version: 2, status: 'accepted', decisionReference: projection.decisionReference, projection,
    entries: base.entries.map(e => {
      const source = e.metadata?.type ?? null;
      const alias = source ? projection.aliases[source.toLowerCase()] : undefined;
      const unchanged = source !== null && types.has(source);
      return { ...structuredClone(e), typeProjection: { source, target: unchanged ? source : alias ?? null,
        status: unchanged ? 'unchanged' : alias ? 'accepted-alias' : 'unresolved' } };
    }) };
}

async function boundPath(root: string, p: string, allowed: (p: string) => boolean): Promise<string> {
  if (!allowed(p)) fail('source_path_not_allowed');
  let current = root;
  for (const part of p.split('/')) {
    current = resolve(current, part);
    if ((await lstat(current)).isSymbolicLink()) fail('source_symlink');
  }
  const actual = await realpath(current), rel = relative(root, actual);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) fail('source_outside_root');
  return actual;
}
async function hashedPdf(root: string, pdf: PdfBinding): Promise<void> {
  const path = await boundPath(root, pdf.relativePath, pdfPath);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size !== pdf.byteSize) fail('pdf_size_changed');
    const h = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false })) h.update(chunk);
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) fail('pdf_changed_during_read');
    if (h.digest('hex') !== pdf.sha256) fail('pdf_hash_changed');
  } finally { await handle.close(); }
}
async function explicitJson(path: string, expected: string): Promise<unknown> {
  if (!sha(expected)) fail('expected_digest_required');
  if ((await lstat(path)).isSymbolicLink()) fail('input_symlink');
  const s = await lstat(path);
  if (!s.isFile() || s.size > 8 * 1024 * 1024) fail('input_size');
  const bytes = await readFile(path);
  if (hash(bytes) !== expected) fail('input_hash_changed');
  try { return JSON.parse(bytes.toString('utf8')); } catch { return fail('input_json'); }
}
function association(v: unknown): Association {
  if (!object(v)) fail('association_shape');
  exact(v, ['originPath','originFileSha256','recordIndex','id','source','area','type','topicIds','resolvedPdfPath','resolution']);
  if (!text(v.originPath) || !metadataPath(v.originPath) || !sha(v.originFileSha256)
    || !Number.isSafeInteger(v.recordIndex) || Number(v.recordIndex) < 0 || !text(v.id) || !text(v.source)
    || !text(v.area) || typeof v.type !== 'string' || !Array.isArray(v.topicIds) || v.topicIds.some(t => !text(t))
    || !text(v.resolvedPdfPath) || !pdfPath(v.resolvedPdfPath)
    || !['exact-source-name','existing-complett-fallback-rule'].includes(String(v.resolution))) fail('association_shape');
  return v as unknown as Association;
}
function manifestValue(v: unknown): Manifest {
  if (!object(v) || v.format !== 'stex-r37-catalog-source-observation' || v.version !== 1 || !object(v.target)
    || v.target.database !== TARGET.database || v.target.schemaVersion !== TARGET.schemaVersion || v.target.fileRoot !== TARGET.fileRoot
    || !object(v.userNamedFolderObservation)) fail('manifest_shape_or_target');
  const o = v.userNamedFolderObservation;
  if (!Array.isArray(o.pdfFiles) || !o.pdfFiles.length || o.pdfFiles.length > 1000 || !Array.isArray(o.metadataAssociations)) fail('manifest_shape');
  for (const p of o.pdfFiles) if (!object(p) || !text(p.relativePath) || !pdfPath(p.relativePath) || !sha(p.sha256)
    || !Number.isSafeInteger(p.byteSize) || Number(p.byteSize) <= 0) fail('pdf_binding_shape');
  if (new Set(o.pdfFiles.map(p => p.relativePath)).size !== o.pdfFiles.length) fail('duplicate_pdf_path');
  o.metadataAssociations.forEach(association);
  return v as unknown as Manifest;
}
function proposalValue(v: unknown, manifest: Manifest, manifestSha256: string): IdProposal {
  if (!object(v)) fail('map_shape');
  exact(v, ['format','version','status','decisionReference','manifestSha256','target','supplementalMetadata','entries','projection']);
  if (v.format !== 'stex-r37-catalog-id-map' || (v.version !== 1 && v.version !== 2) || !['proposal','accepted'].includes(String(v.status))
    || v.manifestSha256 !== manifestSha256 || canonical(v.target) !== canonical(TARGET)
    || !Array.isArray(v.supplementalMetadata) || !Array.isArray(v.entries)
    || (v.status === 'accepted' && !text(v.decisionReference))) fail('map_shape_or_binding');
  const extra = v.supplementalMetadata.map(association);
  if (extra.some(a => !supplements.has(a.originPath)) || new Set(extra.map(a => a.originPath)).size !== extra.length) fail('supplement_not_allowed');
  let expected = proposeIds(manifest, manifestSha256, extra);
  if (v.version === 2) {
    const policy = projectionPolicy(v.projection);
    if (v.decisionReference !== policy.decisionReference) fail('projection_decision_changed');
    expected = projectIds(expected, policy);
  }
  else if (v.projection !== undefined) fail('projection_version_required');
  if (v.entries.length !== expected.entries.length) fail('map_coverage');
  const actual = v.entries as unknown[];
  for (const e of expected.entries) {
    const matches = actual.filter(x => object(x) && x.pdfPath === e.pdfPath);
    if (matches.length !== 1 || !object(matches[0])) fail('map_coverage');
    const a = matches[0];
    exact(a, ['pdfPath','pdfSha256','sourceId','metadata','proposedTargetId','idPolicy','historicalBrowserId','requestedRole','roleVerified', ...(v.version === 2 ? ['typeProjection'] : [])]);
    // Initial proposal has no verified historical-browser evidence. No claimed
    // UUID or arbitrary winner can be smuggled into this source-only operator.
    if (a.historicalBrowserId !== null || typeof a.roleVerified !== 'boolean' || (v.version === 2 && a.roleVerified !== false)
      || canonical({ ...a, roleVerified: false }) !== canonical(e)) fail('map_policy_or_source_changed');
  }
  const ids = actual.filter(object).map(e => e.proposedTargetId).filter(id => id !== null);
  if (new Set(ids).size !== ids.length) fail('duplicate_target_id');
  return v as unknown as IdProposal;
}

export interface TargetRecord { id: string; revision: number; metadataSha256: string; fullPayloadSha256: string;
  documents: { role: string; sha256: string; byteSize: number; versionNumber: number; documentVersionId: string; documentId: string }[] }
interface TargetSnapshot { format: 'stex-r37-catalog-target-snapshot'; version: 1; target: typeof TARGET;
  snapshotReference: string; sourceMapSha256: string; coveredTargetIds: string[]; generation: number; records: TargetRecord[] }
function snapshotValue(v: unknown, mapSha256: string, ids: string[]): TargetSnapshot {
  if (!object(v)) fail('target_snapshot_shape');
  exact(v, ['format','version','target','snapshotReference','sourceMapSha256','coveredTargetIds','generation','records']);
  if (v.format !== 'stex-r37-catalog-target-snapshot' || v.version !== 1 || canonical(v.target) !== canonical(TARGET)
    || !text(v.snapshotReference) || !Array.isArray(v.records) || v.sourceMapSha256 !== mapSha256
    || !Number.isSafeInteger(v.generation) || Number(v.generation) < 0 || !Array.isArray(v.coveredTargetIds)
    || v.coveredTargetIds.some(id => typeof id !== 'string')
    || canonical([...v.coveredTargetIds].sort()) !== canonical([...ids].sort())) fail('target_snapshot_shape_or_coverage');
  for (const r of v.records) {
    if (!object(r)) fail('target_snapshot_shape');
    exact(r, ['id','revision','metadataSha256','fullPayloadSha256','documents']);
    if (!text(r.id) || !ids.includes(r.id) || !idPattern.test(r.id) || !Number.isSafeInteger(r.revision) || Number(r.revision) < 1 || !sha(r.metadataSha256) || !sha(r.fullPayloadSha256) || !Array.isArray(r.documents)) fail('target_snapshot_shape');
    for (const d of r.documents) {
      if (!object(d)) fail('target_snapshot_shape');
      exact(d, ['role','sha256','byteSize','versionNumber','documentVersionId','documentId']);
      if (!['sachverhalt','loesung','kombiniert','unbekannt'].includes(String(d.role)) || !sha(d.sha256)
        || !Number.isSafeInteger(d.byteSize) || Number(d.byteSize) <= 0 || !Number.isSafeInteger(d.versionNumber)
        || Number(d.versionNumber) < 1 || !text(d.documentVersionId) || !text(d.documentId)) fail('target_snapshot_shape');
    }
  }
  if (new Set(v.records.map(r => r.id)).size !== v.records.length) fail('target_snapshot_duplicate');
  return v as unknown as TargetSnapshot;
}
export function publicMetadataDigest(value: Record<string, unknown>, targetId: string): string {
  return hash(canonical(Object.fromEntries(['id','source','date','title','area','type','topicIds']
    .filter(k => k === 'id' || Object.hasOwn(value, k)).map(k => [k, k === 'id' ? targetId : value[k]]))));
}
function metadataIssues(r: Record<string, unknown>, allowBoundLegacyArea = false): string[] {
  const issues: string[] = [];
  if (!['zr','oeffr','sr'].includes(String(r.area))
    && !(allowBoundLegacyArea && ['eur','steuer'].includes(String(r.area)))) issues.push('unsupported_area');
  if (r.type !== undefined && r.type !== null && r.type !== '' && !types.has(String(r.type))) issues.push('unsupported_legacy_type');
  if (!text(r.source) || r.source.length > 255) issues.push('invalid_source');
  if (!text(r.title) || r.title.length > 300) issues.push('invalid_title');
  if (typeof r.date !== 'string' || (r.date !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)
    || !Number.isFinite(Date.parse(`${r.date}T00:00:00Z`)) || new Date(`${r.date}T00:00:00Z`).toISOString().slice(0,10) !== r.date))) issues.push('invalid_date');
  if (!Array.isArray(r.topicIds) || r.topicIds.length > 80 || r.topicIds.some(t => typeof t !== 'string' || !topics.has(t))
    || new Set(r.topicIds).size !== r.topicIds.length) issues.push('unsupported_topic_ids');
  return issues;
}
export interface PlanOptions { root: string; manifestPath: string; manifestSha256: string; mapPath: string; mapSha256: string;
  targetSnapshotPath?: string; targetSnapshotSha256?: string; neutralPolicyPath?: string; neutralPolicySha256?: string }
export interface PlanRow { pdfPath: string; sourceId: string | null; proposedTargetId: string | null; idPolicy: string;
  metadataSha256: string | null; issues: string[]; targetBinding: TargetRecord | null;
  targetDisposition: 'unchecked' | 'create' | 'identical' | 'attach' | 'conflict';
  projectedMetadata: Record<string, unknown> | null;
  provenance: { originPath: string; originFileSha256: string; recordIndex: number; sourceId: string; source: string; area: string; rawType: string; topicIds: string[] } | null;
  pdfBinding: { filename: string; sha256: string; byteSize: number; edition: string } | null;
  typeProjection: 'canonical' | 'neutral' | null }

interface NeutralPolicyRecord {
  case: 'unknown-sr-type-neutral' | 'legacy-area-preservation'; pdfPath: string; pdfSha256: string; byteSize: number;
  sourceId: string; targetId: string; idPolicy: 'retain-unique-source-id' | 'namespace-all-collision-members';
  originPath: string; originFileSha256: string; recordIndex: number; source: string; area: string; rawType: string;
  topicIds: string[]; pdfResolution: string; typeProjection: 'canonical' | 'neutral'; projectedType: string | null;
  areaDisposition: 'preserve-source'; roleDeclaration: 'user-declared-combined'; contentCompletenessVerified: false;
}
interface NeutralPolicy {
  format: 'stex-r37-catalog-neutral-policy'; version: 1; policyId: string; decisionReference: string;
  sourceBindings: { manifest: { path: string; sha256: string }; idMap: { path: string; sha256: string; version: 2; status: 'accepted'; entryCount: number };
    targetSnapshot: { path: string; sha256: string; snapshotReference: string; generation: number; sourceMapSha256: string; coveredTargetIdCount: number; recordCount: number } };
  rolePolicy: { roleDeclaration: 'user-declared-combined'; reference: string; contentCompletenessVerified: false };
  rules: { unknownSrTypes: { sourceArea: 'sr'; sourceTypes: string[]; projectedType: 'omit-field'; typeProjection: 'neutral'; preserveRawTypeAndJsonProvenance: true; reclassification: false };
    legacyAreas: { sourceAreas: string[]; sourceType: 'OR-Aktenvortrag'; projectedType: 'Aktenvortrag'; areaDisposition: 'preserve-source'; typeProjection: 'canonical'; reclassification: false };
    idMapDisposition: string };
  records: NeutralPolicyRecord[];
}
function neutralPolicyValue(v: unknown, manifestSha256: string, mapSha256: string, manifest: Manifest, map: IdProposal,
  snapshotSha256: string, target: TargetSnapshot): NeutralPolicy {
  if (!object(v)) fail('neutral_policy_shape');
  exact(v, ['format','version','policyId','decisionReference','sourceBindings','rolePolicy','rules','records']);
  if (v.format !== 'stex-r37-catalog-neutral-policy' || v.version !== 1 || !text(v.policyId)
    || !/^[A-Za-z0-9_-]{8,128}$/.test(v.policyId) || !text(v.decisionReference)
    || !object(v.sourceBindings) || !object(v.rolePolicy) || !object(v.rules) || !Array.isArray(v.records)) fail('neutral_policy_shape');
  exact(v.sourceBindings, ['manifest','idMap','targetSnapshot']);
  const bindings = v.sourceBindings;
  if (!object(bindings.manifest) || !object(bindings.idMap) || !object(bindings.targetSnapshot)) fail('neutral_policy_shape');
  exact(bindings.manifest, ['path','sha256']); exact(bindings.idMap, ['path','sha256','version','status','entryCount']);
  exact(bindings.targetSnapshot, ['path','sha256','snapshotReference','generation','sourceMapSha256','coveredTargetIdCount','recordCount']);
  if (!text(bindings.manifest.path) || bindings.manifest.sha256 !== manifestSha256
    || !text(bindings.idMap.path) || bindings.idMap.sha256 !== mapSha256 || bindings.idMap.version !== 2
    || bindings.idMap.status !== 'accepted' || bindings.idMap.entryCount !== map.entries.length
    || !text(bindings.targetSnapshot.path) || bindings.targetSnapshot.sha256 !== snapshotSha256
    || bindings.targetSnapshot.snapshotReference !== target.snapshotReference || bindings.targetSnapshot.generation !== target.generation
    || bindings.targetSnapshot.sourceMapSha256 !== mapSha256 || bindings.targetSnapshot.coveredTargetIdCount !== target.coveredTargetIds.length
    || bindings.targetSnapshot.recordCount !== target.records.length) fail('neutral_policy_binding_changed');
  exact(v.rolePolicy, ['roleDeclaration','reference','contentCompletenessVerified']);
  if (v.rolePolicy.roleDeclaration !== 'user-declared-combined' || !text(v.rolePolicy.reference)
    || v.rolePolicy.contentCompletenessVerified !== false) fail('neutral_policy_role_changed');
  exact(v.rules, ['unknownSrTypes','legacyAreas','idMapDisposition']);
  if (!object(v.rules.unknownSrTypes) || !object(v.rules.legacyAreas)) fail('neutral_policy_shape');
  exact(v.rules.unknownSrTypes, ['sourceArea','sourceTypes','projectedType','typeProjection','preserveRawTypeAndJsonProvenance','reclassification']);
  exact(v.rules.legacyAreas, ['sourceAreas','sourceType','projectedType','areaDisposition','typeProjection','reclassification']);
  if (v.rules.unknownSrTypes.sourceArea !== 'sr'
    || canonical(v.rules.unknownSrTypes.sourceTypes) !== canonical(['SR-Angestelltenklausur','SR-Anwaltsklausur'])
    || v.rules.unknownSrTypes.projectedType !== 'omit-field' || v.rules.unknownSrTypes.typeProjection !== 'neutral'
    || v.rules.unknownSrTypes.preserveRawTypeAndJsonProvenance !== true || v.rules.unknownSrTypes.reclassification !== false
    || canonical(v.rules.legacyAreas.sourceAreas) !== canonical(['eur','steuer']) || v.rules.legacyAreas.sourceType !== 'OR-Aktenvortrag'
    || v.rules.legacyAreas.projectedType !== 'Aktenvortrag' || v.rules.legacyAreas.areaDisposition !== 'preserve-source'
    || v.rules.legacyAreas.typeProjection !== 'canonical' || v.rules.legacyAreas.reclassification !== false
    || v.rules.idMapDisposition !== 'unchanged; use exactly the existing V2 target IDs and map hash') fail('neutral_policy_rule_changed');
  const fields = ['case','pdfPath','pdfSha256','byteSize','sourceId','targetId','idPolicy','originPath','originFileSha256','recordIndex',
    'source','area','rawType','topicIds','pdfResolution','typeProjection','projectedType','areaDisposition','roleDeclaration','contentCompletenessVerified'];
  const records = v.records as unknown[];
  for (const item of records) {
    if (!object(item)) fail('neutral_policy_shape');
    exact(item, fields);
    if (!['unknown-sr-type-neutral','legacy-area-preservation'].includes(String(item.case))
      || !text(item.pdfPath) || !sha(item.pdfSha256) || !Number.isSafeInteger(item.byteSize) || Number(item.byteSize) <= 0
      || !text(item.sourceId) || !text(item.targetId) || !['retain-unique-source-id','namespace-all-collision-members'].includes(String(item.idPolicy))
      || !text(item.originPath) || !sha(item.originFileSha256) || !Number.isSafeInteger(item.recordIndex) || Number(item.recordIndex) < 0
      || !text(item.source) || !text(item.area) || !text(item.rawType) || !Array.isArray(item.topicIds) || item.topicIds.some(t => !text(t))
      || !text(item.pdfResolution) || !['canonical','neutral'].includes(String(item.typeProjection))
      || (item.projectedType !== null && !text(item.projectedType)) || item.areaDisposition !== 'preserve-source'
      || item.roleDeclaration !== 'user-declared-combined' || item.contentCompletenessVerified !== false) fail('neutral_policy_shape');
    const entry = map.entries.find(e => e.pdfPath === item.pdfPath);
    const pdf = manifest.userNamedFolderObservation.pdfFiles.find(p => p.relativePath === item.pdfPath);
    const a = entry?.metadata;
    if (!entry || !pdf || pdf.sha256 !== item.pdfSha256 || pdf.byteSize !== item.byteSize || !a
      || entry.pdfSha256 !== item.pdfSha256 || entry.sourceId !== item.sourceId
      || entry.proposedTargetId !== item.targetId || entry.idPolicy !== item.idPolicy
      || a.originPath !== item.originPath || a.originFileSha256 !== item.originFileSha256 || a.recordIndex !== item.recordIndex
      || a.id !== item.sourceId || a.source !== item.source || a.area !== item.area || a.type !== item.rawType
      || canonical(a.topicIds) !== canonical(item.topicIds) || a.resolution !== item.pdfResolution) fail('neutral_policy_map_mismatch');
    if (item.case === 'unknown-sr-type-neutral') {
      if (item.area !== 'sr' || !['SR-Angestelltenklausur','SR-Anwaltsklausur'].includes(String(item.rawType))
        || item.typeProjection !== 'neutral' || item.projectedType !== null || entry.typeProjection?.status !== 'unresolved'
        || entry.typeProjection.source !== item.rawType || entry.typeProjection.target !== null) fail('neutral_policy_projection_mismatch');
    } else if (!['eur','steuer'].includes(String(item.area)) || item.rawType !== 'OR-Aktenvortrag'
      || item.typeProjection !== 'canonical' || item.projectedType !== 'Aktenvortrag' || entry.typeProjection?.target !== 'Aktenvortrag'
      || entry.typeProjection.status !== 'accepted-alias') fail('neutral_policy_projection_mismatch');
  }
  if (records.length !== 7 || records.filter(r => object(r) && r.case === 'unknown-sr-type-neutral').length !== 4
    || records.filter(r => object(r) && r.case === 'legacy-area-preservation').length !== 3
    || new Set(records.filter(object).map(r => r.pdfPath)).size !== records.length) fail('neutral_policy_coverage');
  const unresolved = map.entries.filter(e => e.typeProjection?.status === 'unresolved').map(e => e.pdfPath).sort();
  const neutral = records.filter(object).filter(r => r.case === 'unknown-sr-type-neutral').map(r => String(r.pdfPath)).sort();
  if (canonical(unresolved) !== canonical(neutral)) fail('neutral_policy_coverage');
  return v as unknown as NeutralPolicy;
}
export async function planCatalog(options: PlanOptions) {
  if (!isAbsolute(options.root)) fail('absolute_root_required');
  const root = await realpath(options.root);
  const m = manifestValue(await explicitJson(options.manifestPath, options.manifestSha256));
  const map = proposalValue(await explicitJson(options.mapPath, options.mapSha256), m, options.manifestSha256);
  if (map.projection) {
    const binding = map.projection.aliasSource;
    const p = await boundPath(root, binding.path, p => p === 'lern-tracker/src/lib/store.ts');
    const bytes = await readFile(p);
    if (hash(bytes) !== binding.sha256) fail('alias_source_hash_changed');
    if (canonical(declaredTypeAliases(bytes.toString('utf8'))) !== canonical(map.projection.aliases)) fail('alias_table_changed');
  }
  if (!!options.targetSnapshotPath !== !!options.targetSnapshotSha256) fail('target_snapshot_binding_required');
  const target = options.targetSnapshotPath ? snapshotValue(await explicitJson(options.targetSnapshotPath, options.targetSnapshotSha256!),
    options.mapSha256, map.entries.flatMap(e => e.proposedTargetId ? [e.proposedTargetId] : [])) : null;
  if (!!options.neutralPolicyPath !== !!options.neutralPolicySha256) fail('neutral_policy_binding_required');
  if (options.neutralPolicyPath && !target) fail('target_snapshot_binding_required');
  const neutralPolicy = options.neutralPolicyPath ? neutralPolicyValue(await explicitJson(options.neutralPolicyPath, options.neutralPolicySha256!),
    options.manifestSha256, options.mapSha256, m, map, options.targetSnapshotSha256!, target!) : null;
  const neutralRecords = new Map((neutralPolicy?.records ?? []).map(r => [r.pdfPath, r]));
  const metadata = new Map<string, unknown>();
  const rows: PlanRow[] = [];
  for (const e of map.entries) {
    const pdf = m.userNamedFolderObservation.pdfFiles.find(p => p.relativePath === e.pdfPath)!;
    const row: PlanRow = { pdfPath: e.pdfPath, sourceId: e.sourceId, proposedTargetId: e.proposedTargetId,
      idPolicy: e.idPolicy, metadataSha256: null, issues: [], targetBinding: null, targetDisposition: 'unchecked',
      projectedMetadata: null, provenance: null, pdfBinding: null, typeProjection: null };
    try { await hashedPdf(root, pdf); }
    catch (error) { row.issues.push(error instanceof PlanError ? error.code : 'pdf_unreadable'); }
    if (pdf.byteSize > CATALOG_MAX_FILE_BYTES) row.issues.push('pdf_over_import_limit');
    if (!e.roleVerified && !map.projection) row.issues.push('combined_role_unverified');
    const a = e.metadata;
    if (!a || !e.proposedTargetId) row.issues.push('missing_metadata_or_id');
    else {
      try {
        const key = `${a.originPath}:${a.originFileSha256}`;
        if (!metadata.has(key)) metadata.set(key, await explicitJson(await boundPath(root, a.originPath, metadataPath), a.originFileSha256));
        const d = metadata.get(key), r = Array.isArray(d) ? d[a.recordIndex] : a.recordIndex === 0 ? d : null;
        if (!object(r)) fail('metadata_record_missing');
        exact(r, ['id','model_version','source','date','title','area','type','topicIds','_source_file','createdAt','updatedAt']);
        if (canonical([r.id,r.source,r.area,r.type,r.topicIds]) !== canonical([a.id,a.source,a.area,a.type,a.topicIds])) fail('metadata_association_changed');
        const filename = e.pdfPath.slice('Klausuren_Komplett/'.length);
        const expectedName = a.resolution === 'exact-source-name' ? a.source : a.source.replace(/\.pdf$/i, '_komplett.pdf');
        if (filename !== expectedName) fail('metadata_pdf_relation_changed');
        if (a.resolution === 'existing-complett-fallback-rule') {
          // The historical resolver always prefers an existing direct filename.
          // A newly added direct file invalidates the formerly bound fallback.
          try { await lstat(resolve(root, 'Klausuren_Komplett', a.source)); fail('resolver_selection_changed'); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        }
        let projected = r;
        const unresolvedType = !!e.typeProjection && e.typeProjection.status === 'unresolved';
        const neutralRecord = neutralRecords.get(e.pdfPath);
        const preservingLegacyArea = neutralRecord?.case === 'legacy-area-preservation';
        if (e.typeProjection) {
          projected = { ...r };
          if (unresolvedType) {
            delete projected.type;
            if (neutralRecord?.case === 'unknown-sr-type-neutral') row.typeProjection = 'neutral';
            else row.issues.push('unresolved_type_projection');
          } else {
            projected.type = e.typeProjection.target;
            row.typeProjection = 'canonical';
          }
        }
        if (neutralRecord && !unresolvedType && neutralRecord.case !== 'legacy-area-preservation') fail('neutral_policy_projection_mismatch');
        row.issues.push(...metadataIssues(projected, preservingLegacyArea));
        if (!unresolvedType) row.metadataSha256 = publicMetadataDigest(projected, e.proposedTargetId);
        if (neutralRecord?.case === 'unknown-sr-type-neutral') row.metadataSha256 = publicMetadataDigest(projected, e.proposedTargetId);
        if (neutralPolicy) {
          row.projectedMetadata = { id: e.proposedTargetId, source: projected.source, date: projected.date, title: projected.title,
            area: projected.area, ...(Object.hasOwn(projected, 'type') ? { type: projected.type } : {}), topicIds: projected.topicIds };
          row.provenance = { originPath: a.originPath, originFileSha256: a.originFileSha256, recordIndex: a.recordIndex,
            sourceId: a.id, source: a.source, area: a.area, rawType: a.type, topicIds: [...a.topicIds] };
          row.pdfBinding = { filename: e.pdfPath.slice(e.pdfPath.lastIndexOf('/') + 1), sha256: pdf.sha256, byteSize: pdf.byteSize,
            edition: `sha256:${pdf.sha256}` };
        }
        if (target && row.metadataSha256) {
          const old = target.records.find(r => r.id === e.proposedTargetId);
          row.targetBinding = old ?? null;
          row.targetDisposition = !old ? 'create' : old.metadataSha256 !== row.metadataSha256 ? 'conflict'
            : old.documents.length === 0 ? 'attach' : old.documents.length === 1 && old.documents[0].role === 'kombiniert'
              && old.documents[0].sha256 === pdf.sha256 && old.documents[0].byteSize === pdf.byteSize ? 'identical' : 'conflict';
          if (row.targetDisposition === 'conflict') row.issues.push('target_conflict');
        }
      } catch (error) { row.issues.push(error instanceof PlanError ? error.code : 'metadata_unreadable'); }
    }
    rows.push(row);
  }
  const gates: string[] = [];
  if (map.status !== 'accepted') gates.push('id_map_not_accepted');
  if (!target) gates.push('target_snapshot_not_supplied');
  if (options.neutralPolicyPath && !neutralPolicy) gates.push('neutral_policy_not_supplied');
  const issueCounts: Record<string, number> = {};
  for (const r of rows) for (const code of new Set(r.issues)) issueCounts[code] = (issueCounts[code] ?? 0) + 1;
  return { format: 'stex-r37-catalog-local-plan', version: 1, mode: 'plan-only', target: TARGET,
    manifestSha256: options.manifestSha256, mapSha256: options.mapSha256, targetSnapshotSha256: options.targetSnapshotSha256 ?? null,
    projectionBinding: map.projection ? { decisionReference: map.projection.decisionReference, aliasSource: map.projection.aliasSource,
      combinedRoleDeclaration: map.projection.combinedRoleDeclaration } : null,
    neutralPolicyBinding: neutralPolicy ? { policyId: neutralPolicy.policyId, policySha256: options.neutralPolicySha256,
      recordCount: neutralPolicy.records.length, rolePolicy: neutralPolicy.rolePolicy } : null,
    readyForReview: true, localPreconditionsSatisfied: !gates.length && rows.every(r => !r.issues.length), executionSupported: false,
    gates, summary: { pdfs: rows.length, metadataAssociations: rows.filter(r => r.sourceId !== null).length,
      retainedUniqueSourceIds: rows.filter(r => r.idPolicy === 'retain-unique-source-id').length,
      proposedCollisionIds: rows.filter(r => r.idPolicy === 'namespace-all-collision-members').length,
      projectedAliasRows: map.entries.filter(e => e.typeProjection?.status === 'accepted-alias').length,
      unresolvedTypeRows: map.entries.filter(e => e.typeProjection?.status === 'unresolved').length,
      neutralTypeRows: rows.filter(r => r.typeProjection === 'neutral').length,
      legacyAreaPreservedRows: neutralPolicy?.records.filter(r => r.case === 'legacy-area-preservation').length ?? 0,
      rowsWithIssues: rows.filter(r => r.issues.length).length, issueCounts }, rows };
}

export function parseArguments(argv: readonly string[]): PlanOptions {
  if (argv[0] !== 'plan') fail('plan_only');
  const allowed = ['--root','--manifest','--manifest-sha256','--id-map','--id-map-sha256','--target-snapshot','--target-snapshot-sha256',
    '--neutral-policy','--neutral-policy-sha256'];
  const args = new Map<string, string>();
  for (let i = 1; i < argv.length; i += 2) {
    if (!allowed.includes(argv[i]) || args.has(argv[i]) || !argv[i+1] || argv[i+1].startsWith('--')) fail('invalid_invocation');
    args.set(argv[i], argv[i+1]);
  }
  for (const k of allowed.slice(0,5)) if (!args.has(k)) fail('missing_argument');
  if (!!args.get('--neutral-policy') !== !!args.get('--neutral-policy-sha256')) fail('neutral_policy_binding_required');
  return { root: args.get('--root')!, manifestPath: args.get('--manifest')!, manifestSha256: args.get('--manifest-sha256')!,
    mapPath: args.get('--id-map')!, mapSha256: args.get('--id-map-sha256')!, targetSnapshotPath: args.get('--target-snapshot'), targetSnapshotSha256: args.get('--target-snapshot-sha256'),
    neutralPolicyPath: args.get('--neutral-policy'), neutralPolicySha256: args.get('--neutral-policy-sha256') };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void (async () => {
    const plan = await planCatalog(parseArguments(process.argv.slice(2)));
    process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
    if (!plan.localPreconditionsSatisfied) process.exitCode = 2;
  })().catch(error => {
    process.stderr.write(JSON.stringify({ error: error instanceof PlanError ? error.code : 'plan_unavailable' }) + '\n');
    process.exitCode = 1;
  });
}
