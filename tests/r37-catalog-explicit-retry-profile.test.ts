import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { ApplyError, ORIGIN, TARGET, PINNED, PRE_RETRY_OPERATOR, checkGate, digest, firstRetryRequestId, loadState, prepare, sha256, type HostGate, type Profile } from '../scripts/data-migration/catalog-apply.mts';

// Only public plan artifacts and a freshly created artificial empty checkpoint.
// No existing checkpoint, owner, receipt, session, configuration or PDF is read.
test('R37 additive profile compatibility retains exact known predecessor; new HOST gate binds running code', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'r37-retry-profile-'));
  try {
    const profile: Profile = { origin: ORIGIN, target: TARGET, records: 449, batchSizes: [100, 100, 100, 100, 49], hashes: PINNED,
      operatorSha256: sha256(await readFile(resolve('scripts/data-migration/catalog-apply.mts'))) };
    const dir = join(root, 'synthetic-empty-state');
    const state = await prepare(dir, {
      core: resolve('docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-CORE.json'),
      metadata: resolve('docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-METADATEN-VORLAGEN.json'),
      pdf: resolve('docs/entwuerfe/DATA-01/R37-FINALER-DATENPLAN-PDF-VORLAGEN.json'),
    }, profile);
    state.profile = { ...profile, operatorSha256: PRE_RETRY_OPERATOR };
    const path = join(dir, 'checkpoint.json');
    const persist = () => writeFile(path, JSON.stringify({ state, sha256: digest(state) }), { mode: 0o600 });
    await persist(); const before = await readFile(path);
    const loaded = await loadState(dir, profile); assert.equal(loaded.state.profile.operatorSha256, PRE_RETRY_OPERATOR);
    assert.deepEqual(await readFile(path), before);
    const gate: HostGate = { format: 'stex-r37-catalog-apply-gate', version: 1, phase: 'metadata', origin: ORIGIN, target: TARGET,
      coreSha256: PINNED.core, operatorSha256: profile.operatorSha256, releaseManifestSha256: digest('synthetic-release'), sourcePackageSha256: digest('synthetic-package'), backupManifestSha256: digest('synthetic-backup'),
      backupCapturedAt: new Date(Date.now() - 3000).toISOString(), restoreVerifiedAt: new Date(Date.now() - 2000).toISOString(), restoreReference: 'synthetic-restore', targetSnapshotSha256: digest('synthetic-snapshot'), targetSnapshotReference: 'synthetic-target', issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), metadataReceiptsSha256: null, pdfBindingsSha256: null };
    checkGate(gate, 'metadata', loaded.state, Date.now(), profile.operatorSha256);
    assert.throws(() => checkGate({ ...gate, operatorSha256: PRE_RETRY_OPERATOR }, 'metadata', loaded.state, Date.now(), profile.operatorSha256), (e: unknown) => e instanceof ApplyError && e.code === 'host_gate_mismatch');
    state.profile.operatorSha256 = digest('unknown predecessor'); await persist();
    await assert.rejects(loadState(dir, profile), (e: unknown) => e instanceof ApplyError && e.code === 'checkpoint_mismatch');
    state.profile.operatorSha256 = PRE_RETRY_OPERATOR; await persist();
    await assert.rejects(loadState(dir, { ...profile, operatorSha256: digest('unbound runtime') }), (e: unknown) => e instanceof ApplyError && e.code === 'checkpoint_mismatch');
    const command = loaded.plan.pdfTemplates[0], original = structuredClone(command), parent = loaded.state.pdf[0].requestId;
    assert.equal(parent, 'a834ffa0-f351-52b3-b55b-3e6184a8c1c0');
    const child = firstRetryRequestId(parent, command);
    assert.notEqual(child, parent); assert.equal(child, firstRetryRequestId(parent, command)); assert.deepEqual(command, original);
    assert.notEqual(child, firstRetryRequestId(parent, { ...command, planSha256: digest('other command') }));
  } finally { await rm(root, { recursive: true, force: true }); }
});
