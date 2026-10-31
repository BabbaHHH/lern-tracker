import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { TARGET, parseArguments, planCatalog, proposeIds, proposedCollisionId, publicMetadataDigest, projectIds, declaredTypeAliases,
  type Association, type IdProposal, type PlanOptions, type ProjectionPolicy } from '../scripts/data-migration/catalog-legacy.mts';

const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
async function fixture(t: TestContext, ids = ['unique']) {
  const root = await mkdtemp(join(tmpdir(), 'r37-plan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'Klausuren_Komplett'));
  const records = ids.map((id, i) => ({ id, source: `${i}.pdf`, title: 'SYNTHETIC-TITLE-NEVER-OUTPUT', date: '', area: 'zr', type: 'Urteil', topicIds: [] }));
  const associations: Association[] = [];
  const pdfFiles = [];
  for (const [i, record] of records.entries()) {
    const bytes = Buffer.from(`synthetic-bytes-${i}`), json = JSON.stringify(record);
    await writeFile(join(root, 'Klausuren_Komplett', record.source), bytes);
    await writeFile(join(root, 'Klausuren_Komplett', `${i}.json`), json);
    pdfFiles.push({ relativePath: `Klausuren_Komplett/${record.source}`, byteSize: bytes.length, sha256: hash(bytes), verifiedDocumentRole: null });
    associations.push({ originPath: `Klausuren_Komplett/${i}.json`, originFileSha256: hash(json), recordIndex: 0,
      id: record.id, source: record.source, area: record.area, type: record.type, topicIds: [],
      resolvedPdfPath: `Klausuren_Komplett/${record.source}`, resolution: 'exact-source-name' });
  }
  const manifest = { format: 'stex-r37-catalog-source-observation', version: 1, target: TARGET,
    userNamedFolderObservation: { pdfFiles, metadataAssociations: associations } };
  const manifestPath = join(root, 'manifest.json'), mapPath = join(root, 'map.json');
  let manifestSha256 = hash(JSON.stringify(manifest)), map: IdProposal = proposeIds(manifest, manifestSha256);
  const options: PlanOptions = { root, manifestPath, manifestSha256, mapPath, mapSha256: '' };
  async function persist() {
    const m = JSON.stringify(manifest); manifestSha256 = hash(m); options.manifestSha256 = manifestSha256;
    map.manifestSha256 = manifestSha256;
    await writeFile(manifestPath, m);
    const j = JSON.stringify(map); options.mapSha256 = hash(j); await writeFile(mapPath, j);
  }
  await persist();
  return { root, records, manifest, options, get map() { return map; }, set map(v) { map = v; }, persist };
}

test('ID policy keeps unique source IDs and namespaces every collision member reproducibly', async t => {
  const f = await fixture(t, ['collision','collision','unique']);
  assert.deepEqual(f.map.entries.map(e => e.idPolicy), ['namespace-all-collision-members','namespace-all-collision-members','retain-unique-source-id']);
  assert.equal(f.map.entries[2].proposedTargetId, 'unique');
  assert.equal(f.map.entries[0].proposedTargetId, proposedCollisionId('Klausuren_Komplett/0.pdf'));
  const reversed = structuredClone(f.manifest); reversed.userNamedFolderObservation.pdfFiles.reverse();
  assert.equal(proposeIds(reversed, f.options.manifestSha256).entries[2].proposedTargetId, f.map.entries[0].proposedTargetId);
  assert.equal(new Set(f.map.entries.map(e => e.proposedTargetId)).size, 3);
  const plan = await planCatalog(f.options);
  assert.equal(plan.summary.proposedCollisionIds, 2);
  assert.equal(plan.executionSupported, false);
  assert.deepEqual(plan.gates, ['id_map_not_accepted','target_snapshot_not_supplied']);
  assert(!JSON.stringify(plan).includes('SYNTHETIC-TITLE-NEVER-OUTPUT'));
});

test('legacy values are reported unchanged, not translated or reclassified', async t => {
  const f = await fixture(t);
  const r = { ...f.records[0], area: 'eur', type: 'OR-Aktenvortrag', topicIds: ['nonexistent-topic'] };
  const json = JSON.stringify(r);
  await writeFile(join(f.root, 'Klausuren_Komplett/0.json'), json);
  Object.assign(f.manifest.userNamedFolderObservation.metadataAssociations[0], { area: r.area, type: r.type, topicIds: r.topicIds, originFileSha256: hash(json) });
  f.map = proposeIds(f.manifest, ''); await f.persist();
  const p = await planCatalog(f.options);
  assert.deepEqual(p.rows[0].issues, ['combined_role_unverified','unsupported_area','unsupported_legacy_type','unsupported_topic_ids']);
  assert.equal(await readFile(join(f.root, 'Klausuren_Komplett/0.json'), 'utf8'), json);
});

test('same-sized changed PDF bytes fail their source hash', async t => {
  const f = await fixture(t); await writeFile(join(f.root,'Klausuren_Komplett/0.pdf'), 'Synthetic-bytes-0');
  assert((await planCatalog(f.options)).rows[0].issues.includes('pdf_hash_changed'));
});

test('changed JSON is rejected without exposing its content', async t => {
  const f = await fixture(t); await writeFile(join(f.root,'Klausuren_Komplett/0.json'), '{"private":"SECRET-SENTINEL"}');
  const p = await planCatalog(f.options);
  assert(p.rows[0].issues.includes('input_hash_changed')); assert(!JSON.stringify(p).includes('SECRET-SENTINEL'));
});

test('arbitrary target-ID replacements and duplicate map coverage are rejected', async t => {
  const f = await fixture(t, ['same','same']);
  f.map.entries[0].proposedTargetId = 'winner'; await f.persist();
  await assert.rejects(planCatalog(f.options), /map_policy_or_source_changed/);
  f.map = proposeIds(f.manifest, f.options.manifestSha256);
  f.map.entries[1] = structuredClone(f.map.entries[0]); await f.persist();
  await assert.rejects(planCatalog(f.options), /map_coverage/);
});

test('missing metadata remains unresolved with no generated ID', async t => {
  const f = await fixture(t); f.manifest.userNamedFolderObservation.metadataAssociations = [];
  f.map = proposeIds(f.manifest, ''); await f.persist();
  const p = await planCatalog(f.options);
  assert.equal(p.rows[0].proposedTargetId, null); assert(p.rows[0].issues.includes('missing_metadata_or_id'));
});

test('only the three explicitly bound supplemental paths can be read', async t => {
  const f = await fixture(t); const a = structuredClone(f.map.entries[0].metadata!);
  a.originPath = 'private/notes.json'; f.map.supplementalMetadata = [a]; await f.persist();
  await assert.rejects(planCatalog(f.options), /association_shape/);
});

test('a permitted supplemental JSON still preserves unsupported area/type as hard issues', async t => {
  const f = await fixture(t); const source = 'EURS 29 Wolke - Komplett.pdf';
  const selected = 'Klausuren_Komplett/EURS 29 Wolke - Komplett_komplett.pdf';
  const p = 'Klausuren KG/Sonstiges/merged/Europarecht/EURS 29 Wolke - Komplett.json';
  await writeFile(join(f.root, selected), 'synthetic-bytes-0');
  await mkdir(join(f.root,'Klausuren KG/Sonstiges/merged/Europarecht'), {recursive:true});
  const r = {...f.records[0], source, area:'eur', type:'OR-Aktenvortrag'}; const json = JSON.stringify(r);
  await writeFile(join(f.root,p),json);
  f.manifest.userNamedFolderObservation.pdfFiles[0].relativePath = selected;
  f.manifest.userNamedFolderObservation.metadataAssociations = [];
  const a: Association = {originPath:p,originFileSha256:hash(json),recordIndex:0,id:r.id,source,area:r.area,type:r.type,topicIds:[],resolvedPdfPath:selected,resolution:'existing-complett-fallback-rule'};
  f.map = proposeIds(f.manifest,'',[a]); await f.persist();
  const plan = await planCatalog(f.options);
  assert(plan.rows[0].issues.includes('unsupported_area')); assert(plan.rows[0].issues.includes('unsupported_legacy_type'));
  assert.equal(await readFile(join(f.root,p),'utf8'),json);
});

test('a generated collision ID cannot collide with a retained original ID', async t => {
  const f = await fixture(t,['same','same',proposedCollisionId('Klausuren_Komplett/0.pdf')]);
  await assert.rejects(planCatalog(f.options), /duplicate_target_id/);
});

test('source path traversal is rejected and PDF symlinks are not followed', async t => {
  const f = await fixture(t); const original = join(f.root,'Klausuren_Komplett/0.pdf');
  await writeFile(join(f.root,'outside.pdf'), 'synthetic-bytes-0'); await rm(original); await symlink(join(f.root,'outside.pdf'), original);
  assert((await planCatalog(f.options)).rows[0].issues.includes('source_symlink'));
  f.manifest.userNamedFolderObservation.pdfFiles[0].relativePath = '../outside.pdf';
  f.map = proposeIds(f.manifest, ''); await f.persist();
  await assert.rejects(planCatalog(f.options), /pdf_binding_shape/);
});

test('target snapshot must cover the exact map and detects changed metadata/documents', async t => {
  const f = await fixture(t); f.map.status = 'accepted'; f.map.decisionReference = 'synthetic-only-decision';
  f.map.entries[0].roleVerified = true; await f.persist();
  const target = { format: 'stex-r37-catalog-target-snapshot', version: 1, target: TARGET,
    snapshotReference: 'synthetic-snapshot', generation: 1, sourceMapSha256: f.options.mapSha256,
    coveredTargetIds: ['unique'], records: [] as { id:string; revision:number; metadataSha256:string; fullPayloadSha256:string;
      documents: { role:string;sha256:string;byteSize:number;versionNumber:number;documentVersionId:string;documentId:string }[] }[] };
  async function run() {
    const json = JSON.stringify(target); f.options.targetSnapshotPath = join(f.root,'target.json');
    f.options.targetSnapshotSha256 = hash(json); await writeFile(f.options.targetSnapshotPath, json);
    return planCatalog(f.options);
  }
  const p = await run(); assert.equal(p.localPreconditionsSatisfied, true); assert.equal(p.rows[0].targetDisposition, 'create');
  target.records.push({ id:'unique', revision:2, metadataSha256:publicMetadataDigest(f.records[0], 'unique'), fullPayloadSha256:'a'.repeat(64), documents:[] });
  assert.equal((await run()).rows[0].targetDisposition,'attach');
  const pdf = f.manifest.userNamedFolderObservation.pdfFiles[0];
  target.records[0].documents.push({role:'kombiniert',sha256:pdf.sha256,byteSize:pdf.byteSize,versionNumber:1,documentVersionId:'synthetic-version',documentId:'synthetic-document'});
  assert.equal((await run()).rows[0].targetDisposition,'identical');
  assert.equal((await run()).rows[0].targetBinding?.fullPayloadSha256,'a'.repeat(64));
  target.records[0].documents.push({...target.records[0].documents[0],versionNumber:2,documentVersionId:'synthetic-version-2'});
  assert.equal((await run()).rows[0].targetDisposition,'conflict');
  target.records[0].documents.pop();
  target.records[0].documents[0].sha256 = '0'.repeat(64);
  assert.equal((await run()).rows[0].targetDisposition,'conflict');
  target.records[0].documents = []; target.records[0].metadataSha256 = '0'.repeat(64);
  assert((await run()).rows[0].issues.includes('target_conflict'));
  target.coveredTargetIds = [];
  await assert.rejects(run(), /target_snapshot_shape_or_coverage/);
});

test('input digest is mandatory and there is no apply/restore command or switch', async t => {
  const f = await fixture(t); await assert.rejects(planCatalog({ ...f.options, mapSha256: '' }), /expected_digest_required/);
  for (const args of [['apply'],['restore'],['plan','--apply','yes'],['plan','--root','x','--root','x']]) assert.throws(() => parseArguments(args));
});

async function projectionFixture(t: TestContext, rawType = 'ZR-Urteil') {
  const f = await fixture(t);
  const source = 'const TYPE_NORMALIZE: Record<string, KlausurType> = {\n  "zr-urteil": "Urteil",\n  "or-aktenvortrag": "Aktenvortrag",\n};\n';
  await mkdir(join(f.root,'lern-tracker/src/lib'),{recursive:true});
  await writeFile(join(f.root,'lern-tracker/src/lib/store.ts'),source);
  const policy: ProjectionPolicy = { decisionReference:'synthetic-architecture-decision',
    aliasSource:{path:'lern-tracker/src/lib/store.ts',sha256:hash(source)},aliases:declaredTypeAliases(source),
    combinedRoleDeclaration:{basis:'user-declaration',reference:'synthetic-user-declaration',contentCompletenessVerified:false} };
  f.records[0].type = rawType;
  const json = JSON.stringify(f.records[0]); await writeFile(join(f.root,'Klausuren_Komplett/0.json'),json);
  Object.assign(f.manifest.userNamedFolderObservation.metadataAssociations[0],{type:rawType,originFileSha256:hash(json)});
  f.map = projectIds(proposeIds(f.manifest,''),policy); await f.persist();
  return {f,policy,json};
}

test('projection delta: bound existing aliases and declared combined role retain original JSON', async t => {
  const {f,json} = await projectionFixture(t);
  const p = await planCatalog(f.options);
  assert.equal(p.summary.projectedAliasRows,1); assert.equal(p.summary.rowsWithIssues,0);
  assert.deepEqual(p.gates,['target_snapshot_not_supplied']);
  assert.equal(p.projectionBinding?.combinedRoleDeclaration.contentCompletenessVerified,false);
  assert.equal(f.map.entries[0].roleVerified,false);
  assert.equal(f.map.entries[0].typeProjection?.target,'Urteil');
  assert.equal(await readFile(join(f.root,'Klausuren_Komplett/0.json'),'utf8'),json);
});

test('projection delta: unknown source type stays unresolved without inventing or dropping a classification', async t => {
  const {f,json} = await projectionFixture(t,'SR-Anwaltsklausur');
  const p = await planCatalog(f.options);
  assert.deepEqual(p.rows[0].issues,['unresolved_type_projection']); assert.equal(p.rows[0].metadataSha256,null);
  assert.equal(f.map.entries[0].typeProjection?.target,null);
  assert.equal(await readFile(join(f.root,'Klausuren_Komplett/0.json'),'utf8'),json);
});

test('projection delta: a changed alias source or invented alias is rejected', async t => {
  const {f} = await projectionFixture(t); const p = join(f.root,'lern-tracker/src/lib/store.ts');
  const source = await readFile(p,'utf8');
  await writeFile(p,source+'\n'); await assert.rejects(planCatalog(f.options),/alias_source_hash_changed/);
  await writeFile(p,source);
  f.map.projection!.aliases['zr-urteil'] = 'Anklageklausur';
  f.map.entries[0].typeProjection!.target = 'Anklageklausur'; await f.persist();
  await assert.rejects(planCatalog(f.options),/alias_table_changed/);
});

test('projection delta: bound fallback follows old direct-name precedence without byte equality inference', async t => {
  const {f,policy} = await projectionFixture(t);
  const a = f.manifest.userNamedFolderObservation.metadataAssociations[0];
  await writeFile(join(f.root,'Klausuren_Komplett/0_komplett.pdf'),'synthetic-bytes-0');
  await rm(join(f.root,'Klausuren_Komplett/0.pdf'));
  a.resolvedPdfPath = 'Klausuren_Komplett/0_komplett.pdf'; a.resolution = 'existing-complett-fallback-rule';
  f.manifest.userNamedFolderObservation.pdfFiles[0].relativePath = a.resolvedPdfPath;
  f.map = projectIds(proposeIds(f.manifest,''),policy); await f.persist();
  assert.equal((await planCatalog(f.options)).rows[0].issues.length,0);
  await writeFile(join(f.root,'Klausuren_Komplett/0.pdf'),'a different direct original version');
  assert((await planCatalog(f.options)).rows[0].issues.includes('resolver_selection_changed'));
});

test('projection delta: supplemental eur source is linked by resolver but its area is never changed', async t => {
  const {f,policy} = await projectionFixture(t);
  const source = 'EURS 29 Wolke - Komplett.pdf'; const selected = 'Klausuren_Komplett/EURS 29 Wolke - Komplett_komplett.pdf';
  const path = 'Klausuren KG/Sonstiges/merged/Europarecht/EURS 29 Wolke - Komplett.json';
  await writeFile(join(f.root,selected),'synthetic-bytes-0');
  await mkdir(join(f.root,'Klausuren KG/Sonstiges/merged/Europarecht'),{recursive:true});
  const r = {...f.records[0],source,area:'eur',type:'OR-Aktenvortrag'}; const json = JSON.stringify(r);
  await writeFile(join(f.root,path),json);
  f.manifest.userNamedFolderObservation.pdfFiles[0].relativePath = selected;
  f.manifest.userNamedFolderObservation.metadataAssociations = [];
  const a: Association = {originPath:path,originFileSha256:hash(json),recordIndex:0,id:r.id,source,area:r.area,type:r.type,
    topicIds:[],resolvedPdfPath:selected,resolution:'existing-complett-fallback-rule'};
  f.map = projectIds(proposeIds(f.manifest,'',[a]),policy); await f.persist();
  const p = await planCatalog(f.options);
  assert.deepEqual(p.rows[0].issues,['unsupported_area']); assert.equal(p.summary.metadataAssociations,1);
  assert.equal(f.map.entries[0].metadata?.area,'eur'); assert.equal(f.map.entries[0].typeProjection?.target,'Aktenvortrag');
  assert.equal(await readFile(join(f.root,path),'utf8'),json);
});

test('projection delta: user declaration cannot claim verified content or a different accepted decision', async t => {
  const {f} = await projectionFixture(t);
  Object.assign(f.map.projection!.combinedRoleDeclaration,{contentCompletenessVerified:true}); await f.persist();
  await assert.rejects(planCatalog(f.options),/projection_shape/);
  Object.assign(f.map.projection!.combinedRoleDeclaration,{contentCompletenessVerified:false});
  f.map.entries[0].roleVerified = true; await f.persist();
  await assert.rejects(planCatalog(f.options),/map_policy_or_source_changed/);
  f.map.entries[0].roleVerified = false;
  f.map.decisionReference = 'different-decision'; await f.persist();
  await assert.rejects(planCatalog(f.options),/projection_decision_changed/);
});
