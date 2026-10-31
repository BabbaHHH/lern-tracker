import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { restoreStorage } from "../src/lib/storage-backup";
import { examCountdown, localDate } from "../src/lib/dates";
import { exportAll, importAll, saveKlausurDraft, getKlausurDraftById, STORAGE_KEYS } from "../src/lib/store";
import { splitKorrekturAntwort } from "../src/lib/klausur-korrektur";

class MemoryStorage {
  values = new Map<string, string>();
  failValue: string | null = null;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (value === this.failValue) throw new Error("QuotaExceededError"); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
afterEach(() => {
  for (const [key, descriptor] of [["window", previousWindow], ["localStorage", previousStorage]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
function storageSetup() {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {} } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return storage;
}

test("backup restores atomically even when a later write exceeds quota", () => {
  const storage = new MemoryStorage();
  storage.setItem("a", "old-a"); storage.setItem("b", "old-b");
  storage.failValue = JSON.stringify("too-big");
  assert.throws(() => restoreStorage(storage, [["a", "new"], ["b", "too-big"]]), /bisherigen Daten/);
  assert.equal(storage.getItem("a"), "old-a");
  assert.equal(storage.getItem("b"), "old-b");
});

test("backup roundtrip includes plan range and prompt arrays, ignores unknown keys", () => {
  const storage = storageSetup();
  storage.setItem(STORAGE_KEYS.planAppliedRange, JSON.stringify({ start: "2026-11-01", end: "2026-12-01", appliedAt: "now" }));
  storage.setItem(STORAGE_KEYS.prompts, JSON.stringify([{ id: "custom", prompt: "test" }]));
  const backup = exportAll();
  storage.values.clear();
  backup.data["lerntracker-untrusted"] = "ignore";
  assert.equal(importAll(backup).restored, 2);
  assert.notEqual(storage.getItem(STORAGE_KEYS.planAppliedRange), null);
  assert.equal(storage.getItem("lerntracker-untrusted"), null);
  assert.throws(() => importAll({ version: 1, exportedAt: "", data: { [STORAGE_KEYS.klausurDrafts]: {} } }), /Ungültiger Datenbereich/);
});

test("failed draft save cannot report success or replace stored text", () => {
  const storage = storageSetup();
  const saved = saveKlausurDraft({ id: "a", title: "Fall", contentHtml: "alt", contentText: "alt", feedback: [], createdAt: "", updatedAt: "" });
  const originalSet = storage.setItem.bind(storage);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => saveKlausurDraft({ ...saved, contentText: "neu" }), /nicht gespeichert/);
  storage.setItem = originalSet;
  assert.equal(getKlausurDraftById("a")?.contentText, "alt");
});

test("countdown uses calendar days, handles unset/past dates and exact progress", () => {
  assert.equal(examCountdown("", ""), null);
  assert.equal(examCountdown("2026-02-30", ""), null);
  assert.equal(examCountdown("2026-10-08", "2026-10-01", new Date(2026, 9, 7, 23, 59))?.days, 1);
  assert.deepEqual(examCountdown("2026-10-07", "2026-10-01", new Date(2026, 9, 8)), { days: 0, weeks: 0, passed: true, progress: 100 });
  assert.equal(localDate(new Date(2026, 9, 7, 0, 5)), "2026-10-07");
});

test("malformed AI markers and prototype keys are rejected without crashing", () => {
  assert.deepEqual(splitKorrekturAntwort('Text\n---MARKER-JSON---\n{"markers":[{"key":"__proto__","label":"bad"},{"key":"stil","label":"Stil"}]}').markers, [{key:"stil",label:"Stil"}]);
  for (const value of ["bad", {}, null]) assert.deepEqual(splitKorrekturAntwort(`Text\n---MARKER-JSON---\n${JSON.stringify({ markers: value })}`).markers, []);
});
