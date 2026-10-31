import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { JsonObject, LegacyBackup } from "../src/lib/data-migration/contract";
import { BACKUP_AREAS } from "../src/lib/data-migration/inventory";
import { MigrationValidationError } from "../src/lib/data-migration/validation";
import { applyMigration, canonical, compareMigration, digest, emptySnapshot, exportLegacy, MemoryMigrationStore, previewMigration, recordKey, rollbackMigration } from "../src/lib/data-migration/migration";
import { fixtureBackup, fixtureContext, TEST_OWNER, TEST_TOPIC } from "../scripts/data-migration/fixture";
import { exportAll, STORAGE_KEYS } from "../src/lib/store";

function rows(backup: LegacyBackup, key: string) { return backup.data[key] as JsonObject[]; }
function migrate(backup = fixtureBackup(), store = new MemoryMigrationStore(), request = "migration-1", owner = TEST_OWNER) {
  const plan = previewMigration(backup, fixtureContext(owner), store.snapshot());
  return { store, plan, result: applyMigration(store, plan, request) };
}
function invalid(input: unknown, code: string) {
  assert.throws(() => previewMigration(input, fixtureContext()), (error: unknown) => error instanceof MigrationValidationError && error.issues.some(issue => issue.code === code));
}

test("inventory covers every actual backup area and accounts for all extra browser keys", () => {
  const source = readFileSync(new URL("../src/lib/store.ts", import.meta.url), "utf8");
  const names = [...source.matchAll(/STORAGE_KEYS\.(\w+)/g)].map(match => match[1]);
  const block = source.match(/const ALL_BACKUP_KEYS = \[([\s\S]*?)\];/)![1];
  const actual = [...block.matchAll(/STORAGE_KEYS\.(\w+)/g)].map(match => STORAGE_KEYS[match[1] as keyof typeof STORAGE_KEYS]);
  assert.deepEqual(BACKUP_AREAS.map(area => area.key).sort(), [...actual].sort());
  assert.equal(BACKUP_AREAS.length, 24);
  assert.ok(names.length > 23);
  const extra = Object.values(STORAGE_KEYS).filter(key => !actual.includes(key));
  assert.deepEqual(extra.sort(), [STORAGE_KEYS.lastBackup, STORAGE_KEYS.klausurRecPrefix].sort());
});

test("accepts a backup emitted by the actual exportAll implementation", () => {
  const fixture = fixtureBackup();
  const values = new Map(Object.entries(fixture.data).map(([key, value]) => [key, JSON.stringify(value)]));
  const descriptors = new Map(["window", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
    const actual = exportAll();
    assert.deepEqual(actual.data, fixture.data);
    const { result } = migrate(actual as LegacyBackup);
    assert.equal(result.comparison.equal, true);
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("all 24 areas roundtrip with notes, classifications, ordering, feedback and references intact", () => {
  const source = fixtureBackup();
  const { store, plan, result } = migrate(source);
  assert.deepEqual(exportLegacy(store.snapshot(), result.receipt), source);
  assert.equal(result.comparison.equal, true);
  assert.equal(result.comparison.areaCount, 24);
  assert.equal(result.comparison.recordCount, 25); // one private legacy extension
  assert.equal((store.snapshot().records[recordKey("klausur", null, "example-case")].value as JsonObject).type, "ZR-Urteil");
  assert.deepEqual(plan.conflicts, []);
  assert.equal(plan.warnings.some(issue => issue.code === "unknown-date"), true);
});

test("missing, empty and null exam dates remain unknown without changing original payloads", () => {
  for (const mode of ["missing", "empty", "null"] as const) {
    const source = fixtureBackup();
    const exam = rows(source, "lerntracker-klausuren")[0];
    if (mode === "missing") delete exam.date;
    else exam.date = mode === "empty" ? "" : null;
    const { store, result } = migrate(source);
    assert.equal(store.snapshot().records[recordKey("klausur", null, "example-case")].normalized.date, null);
    assert.deepEqual(exportLegacy(store.snapshot(), result.receipt), source);
  }
  const source = fixtureBackup(); rows(source, "lerntracker-klausuren")[0].date = "2026-02-30";
  invalid(source, "date");
});

test("absent, empty arrays/maps and explicit null are not conflated", () => {
  const source: LegacyBackup = { version: 1, exportedAt: fixtureBackup().exportedAt, data: {
    "lerntracker-progress": {}, "lerntracker-klausuren": [], "lerntracker-entries": [],
    "lerntracker-plan-applied-range": null, "lerntracker-exam-date": "",
  } };
  const { store, result } = migrate(source);
  assert.deepEqual(exportLegacy(store.snapshot(), result.receipt), source);
  assert.equal(Object.hasOwn(exportLegacy(store.snapshot(), result.receipt).data, "lerntracker-tasks"), false);
});

test("repeating a request performs no writes and a new request never duplicates records", () => {
  const source = fixtureBackup(); const { store, result } = migrate(source);
  const before = store.snapshot();
  const replay = applyMigration(store, previewMigration(source, fixtureContext(), before), "migration-1");
  assert.equal(replay.replay, true); assert.deepEqual(store.snapshot(), before);
  assert.equal(replay.undo, null);
  const again = migrate(source, store, "migration-2");
  assert.equal(Object.keys(again.store.snapshot().records).length, result.comparison.recordCount);
  assert.ok(again.plan.changes.every(change => change.action === "unchanged"));
});

test("reusing a request ID for different source data is a conflict", () => {
  const { store } = migrate(); const before = store.snapshot();
  const source = fixtureBackup(); (source.data["lerntracker-freitext"] as JsonObject).text = "Andere Notiz";
  assert.throws(() => migrate(source, store), /Vorgangs-ID/);
  assert.deepEqual(store.snapshot(), before);
});

test("duplicate IDs inside the source block migration without ID replacement", () => {
  const source = fixtureBackup(); const exams = rows(source, "lerntracker-klausuren");
  exams.push({ ...exams[0], title: "Anderer Fall" });
  invalid(source, "id-collision");
});

test("existing catalog ID with different content reports conflict and leaves notes untouched", () => {
  const { store } = migrate(); const before = store.snapshot();
  const source = fixtureBackup(); rows(source, "lerntracker-klausuren")[0].title = "Anderer Fall";
  const plan = previewMigration(source, fixtureContext(), before);
  assert.equal(plan.conflicts[0].code, "id-collision");
  assert.throws(() => applyMigration(store, plan, "other-request"), MigrationValidationError);
  assert.deepEqual(store.snapshot(), before);
});

test("possible duplicates are marked and never silently merged", () => {
  const source = fixtureBackup(); const exams = rows(source, "lerntracker-klausuren");
  exams.push({ ...exams[0], id: "other-case" });
  const { store, plan } = migrate(source);
  assert.ok(plan.warnings.some(issue => issue.code === "duplicate-candidate"));
  assert.equal(Object.values(store.snapshot().records).filter(record => record.kind === "klausur").length, 2);
});

test("broken exam, task-calendar, tracking and topic references block migration", () => {
  for (const field of ["linkedKlausurId", "calendarEventId", "trackingEntryId", "linkedTopicId"]) {
    const source = fixtureBackup(); rows(source, "lerntracker-tasks")[0][field] = "does-not-exist";
    invalid(source, "broken-reference");
  }
  const source = fixtureBackup(); rows(source, "lerntracker-klausuren")[0].topicIds = ["obsolete-topic"];
  invalid(source, "broken-topic");
});

test("nested plan and profile references are checked, including schedule document indexes", () => {
  const source = fixtureBackup();
  const profile = source.data["lerntracker-onboarding"] as JsonObject;
  (profile.reps as JsonObject[])[0].scheduleDocIndex = 7;
  invalid(source, "broken-document-index");
  const second = fixtureBackup();
  ((rows(second, "lerntracker-plan-history")[0].structured as JsonObject).klausuren as JsonObject[])[0].klausurId = "missing";
  invalid(second, "broken-reference");
  const third = fixtureBackup();
  (third.data["lerntracker-onboarding"] as JsonObject).selfAssessment = { missing: 30 };
  invalid(third, "broken-topic");
});

test("private source document name without identity remains a visible unresolved hint", () => {
  const source = fixtureBackup(); rows(source, "lerntracker-calendar")[0].sourceDocument = "Alter Plan.pdf";
  const { store, plan, result } = migrate(source);
  assert.ok(plan.warnings.some(issue => issue.code === "unresolved-source-name"));
  assert.deepEqual(exportLegacy(store.snapshot(), result.receipt), source);
});

test("same personal IDs in two accounts remain separate while catalog IDs are shared", () => {
  const { store } = migrate();
  const second = migrate(fixtureBackup(), store, "migration-1", "second-owner");
  const snapshot = second.store.snapshot();
  assert.equal(Object.values(snapshot.records).filter(record => record.kind === "klausur").length, 1);
  assert.equal(Object.values(snapshot.records).filter(record => record.kind === "draft").length, 2);
  assert.equal(Object.keys(snapshot.documentVersions).length, 2);
  assert.ok(Object.values(snapshot.records).filter(record => record.ownerUserId === null).every(record => record.kind === "klausur"));
  assert.equal(canonical(snapshot.records[recordKey("klausur", null, "example-case")]).includes("Meine private Lösung"), false);
});

test("a foreign account's calendar reference is unavailable", () => {
  const { store } = migrate(); const source = fixtureBackup();
  delete source.data["lerntracker-calendar"];
  assert.throws(() => previewMigration(source, fixtureContext("second-owner"), store.snapshot()), (e: unknown) => e instanceof MigrationValidationError && e.issues.some(issue => issue.code === "broken-reference"));
});

test("document versions hash actual bytes and never fabricate pages or full-text status", () => {
  const { store } = migrate(); const version = Object.values(store.snapshot().documentVersions)[0];
  const doc = rows(fixtureBackup(), "lerntracker-documents")[0];
  const encoded = String(doc.dataUrl).split(",")[1];
  assert.equal(version.byteSize, Buffer.from(encoded, "base64").byteLength);
  assert.equal(version.pageCount, null); assert.equal(version.textStatus, "pending");
  assert.equal(version.extractionVersion, null);
  const snapshot = store.snapshot(); snapshot.documentVersions[version.documentVersionId].sha256 = "wrong";
  const receipt = Object.values(snapshot.imports)[0];
  assert.equal(compareMigration(fixtureBackup(), snapshot, receipt).equal, false);
});

test("malformed file bytes, sizes and media types cannot be imported", () => {
  for (const update of [{ dataUrl: "data:application/pdf;base64,%%%=" }, { size: 1000 }, { type: "text/plain" }]) {
    const source = fixtureBackup(); Object.assign(rows(source, "lerntracker-documents")[0], update);
    invalid(source, "document-bytes");
  }
});

test("same bytes in distinct private documents do not collapse document ownership or IDs", () => {
  const source = fixtureBackup(); const docs = rows(source, "lerntracker-documents"); docs.push({ ...docs[0], id: "doc-2" });
  const { store, plan } = migrate(source);
  assert.equal(Object.keys(store.snapshot().documentVersions).length, 2);
  assert.ok(plan.warnings.some(issue => issue.code === "identical-bytes"));
});

test("derived caches and device backup markers are disclosed but never persisted", () => {
  const source = fixtureBackup();
  source.data["lerntracker-klausur-rec-2026-10-10"] = { klausurId: "stale-case" };
  source.data["lerntracker-free-models"] = { models: [] };
  source.data["lerntracker-last-backup"] = "2026-10-10T10:00:00Z";
  const { store, plan, result } = migrate(source);
  assert.equal(plan.excluded.length, 3);
  assert.deepEqual(exportLegacy(store.snapshot(), result.receipt).data, fixtureBackup().data);
  assert.equal(canonical(store.snapshot()).includes("stale-case"), false);
});

test("unknown areas and credential fields stop migration without echoing their values", () => {
  const source = fixtureBackup(); source.data["OPENROUTER_API_KEY"] = "synthetic-secret-value";
  invalid(source, "credential");
  const nested = fixtureBackup(); (nested.data["lerntracker-onboarding"] as JsonObject).apiKey = "synthetic-secret-value";
  try { previewMigration(nested, fixtureContext()); assert.fail("must reject"); }
  catch (error) {
    assert.ok(error instanceof MigrationValidationError);
    assert.ok(error.issues.some(issue => issue.code === "credential"));
    assert.equal(canonical(error.issues).includes("synthetic-secret-value"), false);
  }
  const unknown = fixtureBackup(); unknown.data["lerntracker-new-persistent-data"] = [];
  invalid(unknown, "unknown-area");
});

test("ownership fields, prototype keys, non-JSON values and unsupported versions are rejected", () => {
  const source = fixtureBackup(); rows(source, "lerntracker-klausur-drafts")[0].ownerUserId = "foreign-owner";
  invalid(source, "ownership");
  const hostile = fixtureBackup(); (hostile.data["lerntracker-fehlerprofil"] as JsonObject).markers = JSON.parse('{"__proto__":{"bad":true}}');
  invalid(hostile, "unsafe-key");
  const nonJson = fixtureBackup(); (nonJson.data["lerntracker-ai-metrics"] as JsonObject).plansApplied = NaN;
  invalid(nonJson, "json");
  invalid({ ...fixtureBackup(), version: 2 }, "format");
});

test("mismatched map identities and malformed record shapes fail before any writes", () => {
  const source = fixtureBackup(); (source.data["lerntracker-progress"] as JsonObject)[TEST_TOPIC] = { topicId: "other", percent: 45, source: "manual", updatedAt: "" };
  invalid(source, "map-id");
  const second = fixtureBackup(); second.data["lerntracker-klausur-drafts"] = {};
  invalid(second, "area-shape");
  const third = fixtureBackup(); rows(third, "lerntracker-tasks")[0].done = "yes";
  invalid(third, "field-type");
});

test("failure halfway through and cancellation leave target and source exactly intact", () => {
  const source = fixtureBackup(); const sourceBefore = structuredClone(source); const store = new MemoryMigrationStore();
  const before = store.snapshot(); const plan = previewMigration(source, fixtureContext());
  assert.throws(() => applyMigration(store, plan, "failure", { beforeRecord(index) { if (index === 8) throw new Error("simulated failure"); } }), /simulated failure/);
  assert.deepEqual(store.snapshot(), before); assert.deepEqual(source, sourceBefore);
  const controller = new AbortController();
  assert.throws(() => applyMigration(store, plan, "abort", { signal: controller.signal, beforeRecord(index) { if (index === 8) controller.abort(); } }), /abgebrochen/);
  assert.deepEqual(store.snapshot(), before);
  assert.equal(applyMigration(store, plan, "failure").comparison.equal, true);
});

test("stale preview and competing record revision cannot overwrite later edits", () => {
  const { store } = migrate(); const key = recordKey("draft", TEST_OWNER, "draft-1");
  const plan = previewMigration(fixtureBackup(), fixtureContext(), store.snapshot());
  const existing = store.snapshot().records[key];
  store.edit(key, { ...(existing.value as JsonObject), contentText: "Spätere Änderung" }, 1);
  assert.throws(() => store.edit(key, existing.value, 1), /Revisionskonflikt/);
  assert.throws(() => applyMigration(store, plan, "new-request"), /Revisionskonflikt/);
  assert.throws(() => applyMigration(store, plan, "migration-1"), /geänderte Daten/);
  assert.equal((store.snapshot().records[key].value as JsonObject).contentText, "Spätere Änderung");
});

test("tampered preview payload and record set require a fresh preview", () => {
  const store = new MemoryMigrationStore();
  const plan = previewMigration(fixtureBackup(), fixtureContext());
  (plan.backup.data["lerntracker-freitext"] as JsonObject).text = "Changed after preview";
  assert.throws(() => applyMigration(store, plan, "tampered"), /Vorschau verändert/);
  const second = previewMigration(fixtureBackup(), fixtureContext());
  second.records[recordKey("draft", TEST_OWNER, "draft-1")].ownerUserId = null;
  assert.throws(() => applyMigration(store, second, "tampered"), /Vorschau verändert/);
  assert.deepEqual(store.snapshot(), emptySnapshot());
});

test("a concurrent commit during staging is detected at atomic commit", () => {
  const store = new MemoryMigrationStore(); const plan = previewMigration(fixtureBackup(), fixtureContext());
  assert.throws(() => applyMigration(store, plan, "outer", { beforeRecord(index) {
    if (index === 4) store.commit(0, emptySnapshot());
  } }), /Revisionskonflikt/);
  assert.equal(store.snapshot().generation, 1);
  assert.equal(Object.keys(store.snapshot().records).length, 0);
});

test("rollback restores previous target and receipts, keeps source, and allows a clean retry", () => {
  const store = new MemoryMigrationStore(); migrate(fixtureBackup(), store, "prior", "other-owner");
  const before = store.snapshot(); const source = fixtureBackup(); const { result } = migrate(source, store);
  assert.ok(result.undo);
  assert.deepEqual(exportLegacy(store.snapshot(), result.receipt), source);
  rollbackMigration(store, result.undo);
  const after = store.snapshot(); assert.equal(after.generation, before.generation + 2);
  assert.deepEqual({ ...after, generation: before.generation }, before);
  assert.equal(migrate(source, store).result.comparison.equal, true);
});

test("rollback cannot erase a later edit or reuse a consumed undo token", () => {
  const { store, result } = migrate(); assert.ok(result.undo);
  const key = recordKey("learning-entry", TEST_OWNER, "note-1"); const existing = store.snapshot().records[key];
  store.edit(key, { ...(existing.value as JsonObject), note: "Später ergänzt" }, 1);
  assert.throws(() => rollbackMigration(store, result.undo!), /spätere Änderungen/);
  const clean = migrate(); assert.ok(clean.result.undo);
  rollbackMigration(clean.store, clean.result.undo);
  assert.throws(() => rollbackMigration(clean.store, clean.result.undo!), /spätere Änderungen/);
});

test("export comparison catches a changed note, array order and lost reference without leaking text", () => {
  const source = fixtureBackup(); rows(source, "lerntracker-entries").push({ ...rows(source, "lerntracker-entries")[0], id: "note-2", note: "Zweite persönliche Notiz" });
  const { store, result } = migrate(source); const snapshot = store.snapshot();
  const key = recordKey("learning-entry", TEST_OWNER, "note-1"); (snapshot.records[key].value as JsonObject).note = "Verändert";
  const comparison = compareMigration(source, snapshot, result.receipt);
  assert.equal(comparison.equal, false); assert.deepEqual(comparison.differences, ["lerntracker-entries"]);
  const reordered = structuredClone(result.receipt);
  reordered.areas.find(area => area.key === "lerntracker-entries")!.recordKeys.reverse();
  assert.equal(compareMigration(source, store.snapshot(), reordered).equal, false);
  assert.equal(digest(source.data), result.receipt.sourceDigest);
});

test("old backups without reasoning settings and legacy profiles without document IDs remain usable", () => {
  const source = fixtureBackup(); delete source.data["lerntracker-ai-reasoning"];
  const profile = source.data["lerntracker-onboarding"] as JsonObject;
  delete (profile.documents as JsonObject[])[0].id;
  profile.agDay = "Montag"; profile.agFrequency = "wöchentlich"; profile.ags = [];
  const { store, result } = migrate(source);
  assert.deepEqual(exportLegacy(store.snapshot(), result.receipt), source);
});

test("unknown original file type retains the Data-URL media type without changing legacy fields", () => {
  const source = fixtureBackup(); rows(source, "lerntracker-documents")[0].type = "";
  const { store, result } = migrate(source);
  assert.equal(Object.values(store.snapshot().documentVersions)[0].mediaType, "application/pdf");
  assert.deepEqual(exportLegacy(store.snapshot(), result.receipt), source);
});

test("replay checks revisions even if text is restored to the same value", () => {
  const { store } = migrate(); const key = recordKey("draft", TEST_OWNER, "draft-1");
  store.edit(key, store.snapshot().records[key].value, 1);
  assert.throws(() => migrate(fixtureBackup(), store), /geänderte Datenrevisionen/);
});

test("changed normalized exam date is caught by comparison and cannot replay as success", () => {
  const { store, result } = migrate(); const snapshot = store.snapshot();
  snapshot.records[recordKey("klausur", null, "example-case")].normalized.date = "2030-01-01";
  assert.equal(compareMigration(fixtureBackup(), snapshot, result.receipt).equal, false);
  store.commit(snapshot.generation, snapshot);
  assert.throws(() => migrate(fixtureBackup(), store), /geänderte Daten/);
});

test("unknown catalog fields cannot leak private text into the shared catalog", () => {
  const source = fixtureBackup(); const exam = rows(source, "lerntracker-klausuren")[0];
  exam.myNote = "Persönliche Zusatznotiz im alten Datensatz";
  exam.contentHtml = "<p>Persönlicher Alttext</p>";
  const { store, result, plan } = migrate(source);
  const snapshot = store.snapshot();
  const shared = snapshot.records[recordKey("klausur", null, "example-case")];
  const personal = snapshot.records[recordKey("catalog-extension", TEST_OWNER, "example-case")];
  assert.equal(canonical(shared).includes("Persönlicher"), false);
  assert.equal((personal.value as JsonObject).myNote, exam.myNote);
  assert.deepEqual(exportLegacy(snapshot, result.receipt), source);
  assert.ok(plan.warnings.some(issue => issue.code === "private-catalog-extension"));
});

test("disagreeing duplicate profile dates preserve both values and warn instead of choosing", () => {
  const source = fixtureBackup(); source.data["lerntracker-exam-date"] = "2027-05-01";
  const { store, plan, result } = migrate(source);
  assert.ok(plan.warnings.some(issue => issue.code === "duplicated-setting-conflict"));
  assert.deepEqual(exportLegacy(store.snapshot(), result.receipt), source);
});
