import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { applyMigration, canonical, exportLegacy, MemoryMigrationStore, previewMigration, rollbackMigration } from "../../src/lib/data-migration/migration";
import { fixtureBackup, fixtureContext } from "./fixture";

// No input-file option: DATA-A is authorized for synthetic migration only.
if (process.argv.length > 2) throw new Error("Diese Probe erlaubt ausschließlich die eingebaute synthetische Beispielsammlung.");
const output = new URL("../../docs/entwuerfe/DATA-01/probe/", import.meta.url);
const source = fixtureBackup();
const original = canonical(source);
const store = new MemoryMigrationStore();
const before = store.snapshot();
const plan = previewMigration(source, fixtureContext(), before);
const result = applyMigration(store, plan, "data-a-demo-1");
assert.equal(result.comparison.equal, true);
const after = store.snapshot();
const restored = exportLegacy(after, result.receipt);
assert.deepEqual(restored, source);
const replay = applyMigration(store, previewMigration(source, fixtureContext(), after), "data-a-demo-1");
assert.equal(replay.replay, true);
assert.deepEqual(store.snapshot(), after);
assert.ok(result.undo);
rollbackMigration(store, result.undo);
const rolledBack = store.snapshot();
assert.deepEqual({ ...rolledBack, generation: before.generation }, before);
assert.equal(canonical(source), original);
const summary = { contractVersion: 1, fixture: "synthetic-only", adapter: "in-process-test-only",
  comparison: result.comparison, replayWithoutWrite: true, rollbackRestoredTarget: true,
  sourceUnchanged: true, documentVersionCount: Object.keys(after.documentVersions).length,
  warnings: plan.warnings, excluded: plan.excluded, databaseAcceptance: false, browserMigrationPerformed: false };
await mkdir(output, { recursive: true });
// Artifacts are entirely generated examples; rerunning replaces this demo only.
for (const [name, value] of Object.entries({ "source-backup.json": source, "preview.json": {
  contractVersion: plan.contractVersion, sourceDigest: plan.sourceDigest, baseGeneration: plan.baseGeneration,
  changes: plan.changes, warnings: plan.warnings, conflicts: plan.conflicts, excluded: plan.excluded },
  "test-store.json": after, "restored-backup.json": restored, "rolled-back-store.json": rolledBack, "summary.json": summary })) {
  await writeFile(new URL(name, output), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}
console.log(JSON.stringify({ ...summary, outputDirectory: fileURLToPath(output) }, null, 2));
