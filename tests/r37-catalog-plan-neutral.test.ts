import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { TARGET, declaredTypeAliases, planCatalog, proposeIds, projectIds,
  type Association, type ProjectionPolicy } from '../scripts/data-migration/catalog-legacy.mts';

const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const snapshotReference = 'synthetic-r37-generation-one';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'r37-neutral-plan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const records = [
    ...['SR-Angestelltenklausur','SR-Anwaltsklausur','SR-Anwaltsklausur','SR-Anwaltsklausur'].map((type, i) => ({
      name: `synthetic-sr-${i}`, area: 'sr', type, path: `Klausuren_Komplett/synthetic-sr-${i}.json`,
      pdf: `Klausuren_Komplett/synthetic-sr-${i}.pdf`, resolution: 'exact-source-name',
    })),
    { name: 'Synthetic EUR 29', area: 'eur', type: 'OR-Aktenvortrag', path: 'Klausuren KG/Sonstiges/merged/Europarecht/EURS 29 Wolke - Komplett.json',
      pdf: 'Klausuren_Komplett/Synthetic EUR 29_komplett.pdf', resolution: 'existing-complett-fallback-rule' },
    { name: 'Synthetic EUR 39', area: 'eur', type: 'OR-Aktenvortrag', path: 'Klausuren KG/Sonstiges/merged/Europarecht/EURS 39 Wolke - Komplett.json',
      pdf: 'Klausuren_Komplett/Synthetic EUR 39_komplett.pdf', resolution: 'existing-complett-fallback-rule' },
    { name: 'Synthetic STEUER 30', area: 'steuer', type: 'OR-Aktenvortrag', path: 'Klausuren KG/Sonstiges/merged/Steuerrecht/STEURS 30 Wolke - Komplett.json',
      pdf: 'Klausuren_Komplett/Synthetic STEUER 30_komplett.pdf', resolution: 'existing-complett-fallback-rule' },
  ];
  const associations: Association[] = [];
  const pdfFiles = [];
  const sourceIds = ['synthetic-sr-0','synthetic-sr-1','synthetic-sr-2','synthetic-sr-3','synthetic-eur-29','synthetic-eur-39','synthetic-steuer-30'];
  for (const [i, item] of records.entries()) {
    const bytes = Buffer.from(`synthetic-pdf-${i}`);
    const source = `${item.name}.pdf`;
    const record = { id: sourceIds[i], source, date: '2025-01-01', title: `Synthetic ${item.name}`,
      area: item.area, type: item.type, topicIds: [] as string[] };
    const json = JSON.stringify(record);
    await mkdir(join(root, item.pdf, '..'), { recursive: true });
    await mkdir(join(root, item.path, '..'), { recursive: true });
    await writeFile(join(root, item.pdf), bytes);
    await writeFile(join(root, item.path), json);
    pdfFiles.push({ relativePath: item.pdf, byteSize: bytes.length, sha256: hash(bytes), verifiedDocumentRole: null });
    associations.push({ originPath: item.path, originFileSha256: hash(json), recordIndex: 0, id: record.id,
      source, area: record.area, type: record.type, topicIds: [], resolvedPdfPath: item.pdf, resolution: item.resolution });
  }
  const manifest = { format: 'stex-r37-catalog-source-observation', version: 1, target: TARGET,
    userNamedFolderObservation: { pdfFiles, metadataAssociations: associations.slice(0, 4) } };
  const manifestPath = join(root, 'manifest.json');
  const manifestJson = JSON.stringify(manifest);
  const manifestSha256 = hash(manifestJson);
  await writeFile(manifestPath, manifestJson);

  const aliasSource = 'const TYPE_NORMALIZE: Record<string, KlausurType> = {\n  "or-aktenvortrag": "Aktenvortrag",\n};\n';
  const aliasPath = join(root, 'lern-tracker/src/lib/store.ts');
  await mkdir(join(root, 'lern-tracker/src/lib'), { recursive: true });
  await writeFile(aliasPath, aliasSource);
  const projection: ProjectionPolicy = { decisionReference: 'synthetic-architecture-decision',
    aliasSource: { path: 'lern-tracker/src/lib/store.ts', sha256: hash(aliasSource) }, aliases: declaredTypeAliases(aliasSource),
    combinedRoleDeclaration: { basis: 'user-declaration', reference: 'synthetic-user-declaration', contentCompletenessVerified: false } };
  const mapPath = join(root, 'map.json');
  const map = projectIds(proposeIds(manifest, manifestSha256, associations.slice(4)), projection);
  const mapJson = JSON.stringify(map);
  const mapSha256 = hash(mapJson);
  await writeFile(mapPath, mapJson);

  const targetSnapshot = { format: 'stex-r37-catalog-target-snapshot', version: 1, target: TARGET,
    snapshotReference, sourceMapSha256: mapSha256, generation: 1,
    coveredTargetIds: map.entries.map(e => e.proposedTargetId!).sort(), records: [] as unknown[] };
  const targetSnapshotPath = join(root, 'target-snapshot.json');
  const snapshotJson = JSON.stringify(targetSnapshot);
  const targetSnapshotSha256 = hash(snapshotJson);
  await writeFile(targetSnapshotPath, snapshotJson);

  const rules = { unknownSrTypes: { sourceArea: 'sr', sourceTypes: ['SR-Angestelltenklausur','SR-Anwaltsklausur'],
      projectedType: 'omit-field', typeProjection: 'neutral', preserveRawTypeAndJsonProvenance: true, reclassification: false },
    legacyAreas: { sourceAreas: ['eur','steuer'], sourceType: 'OR-Aktenvortrag', projectedType: 'Aktenvortrag',
      areaDisposition: 'preserve-source', typeProjection: 'canonical', reclassification: false },
    idMapDisposition: 'unchanged; use exactly the existing V2 target IDs and map hash' };
  const neutralPolicy = { format: 'stex-r37-catalog-neutral-policy', version: 1, policyId: 'SYNTHETIC-R37-NEUTRAL',
    decisionReference: 'synthetic-only-decision',
    sourceBindings: { manifest: { path: 'manifest.json', sha256: manifestSha256 },
      idMap: { path: 'map.json', sha256: mapSha256, version: 2, status: 'accepted', entryCount: 7 },
      targetSnapshot: { path: 'target-snapshot.json', sha256: targetSnapshotSha256, snapshotReference, generation: 1,
        sourceMapSha256: mapSha256, coveredTargetIdCount: 7, recordCount: 0 } },
    rolePolicy: { roleDeclaration: 'user-declared-combined', reference: 'synthetic declaration', contentCompletenessVerified: false },
    rules,
    records: records.map((item, i) => {
      const e = map.entries.find(candidate => candidate.pdfPath === item.pdf)!;
      const a = e.metadata!;
      const neutral = i < 4;
      return { case: neutral ? 'unknown-sr-type-neutral' : 'legacy-area-preservation', pdfPath: item.pdf,
        pdfSha256: pdfFiles[i].sha256, byteSize: pdfFiles[i].byteSize, sourceId: e.sourceId, targetId: e.proposedTargetId,
        idPolicy: e.idPolicy, originPath: a.originPath, originFileSha256: a.originFileSha256, recordIndex: a.recordIndex,
        source: a.source, area: a.area, rawType: a.type, topicIds: a.topicIds, pdfResolution: a.resolution,
        typeProjection: neutral ? 'neutral' : 'canonical', projectedType: neutral ? null : 'Aktenvortrag',
        areaDisposition: 'preserve-source', roleDeclaration: 'user-declared-combined', contentCompletenessVerified: false };
    }) };
  const neutralPolicyPath = join(root, 'neutral-policy.json');
  const policyJson = JSON.stringify(neutralPolicy);
  const neutralPolicySha256 = hash(policyJson);
  await writeFile(neutralPolicyPath, policyJson);
  const options = { root, manifestPath, manifestSha256, mapPath, mapSha256,
    targetSnapshotPath, targetSnapshotSha256, neutralPolicyPath, neutralPolicySha256 };
  return { root, options, neutralPolicy, neutralPolicyPath, policyJson, sourceIds };
}

test('bound neutral policy omits only four unknown type fields and preserves three legacy areas', async t => {
  const f = await fixture(t);
  const plan = await planCatalog(f.options);
  assert.equal(plan.localPreconditionsSatisfied, true, JSON.stringify({ gates: plan.gates, summary: plan.summary,
    rows: plan.rows.map(row => ({ pdfPath: row.pdfPath, issues: row.issues })) }));
  assert.equal(plan.summary.pdfs, 7);
  assert.equal(plan.summary.neutralTypeRows, 4);
  assert.equal(plan.summary.legacyAreaPreservedRows, 3);
  assert.equal(plan.summary.rowsWithIssues, 0);
  assert.deepEqual(plan.rows.map(row => row.typeProjection), ['neutral','neutral','neutral','neutral','canonical','canonical','canonical']);
  for (const row of plan.rows.slice(0, 4)) {
    assert.equal(Object.hasOwn(row.projectedMetadata!, 'type'), false);
    assert(['SR-Angestelltenklausur','SR-Anwaltsklausur'].includes(row.provenance!.rawType));
    assert.equal(row.projectedMetadata!.area, 'sr');
  }
  assert.deepEqual(plan.rows.slice(4).map(row => [row.projectedMetadata!.area, row.projectedMetadata!.type]), [
    ['eur','Aktenvortrag'], ['eur','Aktenvortrag'], ['steuer','Aktenvortrag'],
  ]);
  assert.equal(plan.rows.every(row => row.targetDisposition === 'create'), true);
});

test('neutral policy cannot widen a classification or change a bound case', async t => {
  const f = await fixture(t);
  const changed = structuredClone(f.neutralPolicy);
  changed.rules.unknownSrTypes.reclassification = true;
  const bytes = JSON.stringify(changed);
  await writeFile(f.neutralPolicyPath, bytes);
  await assert.rejects(planCatalog({ ...f.options, neutralPolicySha256: hash(bytes) }), /neutral_policy_rule_changed/);
  assert.equal(await readFile(f.neutralPolicyPath, 'utf8'), bytes);
});
