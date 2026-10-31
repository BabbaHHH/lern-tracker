import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { currentDate, localDate, testReferenceDate } from "../src/lib/dates";
import { buildContextFor } from "../src/lib/prompt-context";
import { STORAGE_KEYS, getOnboarding, getCalendarEvents, getTasks } from "../src/lib/store";
import { applyStructuredPlan, undoApply } from "../src/lib/plan-applier";
import { computeDayBudget, eventsOnDate } from "../src/lib/day-budget";

const originalEnv = process.env;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
function setupHistorical() {
  process.env = { ...originalEnv, NODE_ENV: "test", STEX_REFERENCE_DATE: "2026-04-08" };
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage, dispatchEvent() {} } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return storage;
}
afterEach(() => {
  process.env = originalEnv;
  for (const [key, value] of [["window", originalWindow], ["localStorage", originalStorage]] as const) {
    if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
  }
});

test("historical planning uses one reference day and production ignores it", () => {
  process.env = { ...originalEnv, NODE_ENV: "test", STEX_REFERENCE_DATE: "2026-04-08" };
  assert.equal(localDate(), "2026-04-08");
  assert.equal(currentDate().getHours(), 12);
  assert.equal(testReferenceDate(), "2026-04-08");
  const context = buildContextFor(["timeStatus", "dailyBudget"]);
  assert.match(context, /08\.04\.2026/);
  assert.match(context, /2026-04-08/);
  process.env = { ...process.env, STEX_REFERENCE_DATE: "2026-02-30" };
  assert.equal(testReferenceDate(), null);
  process.env = { ...process.env, NODE_ENV: "production", STEX_REFERENCE_DATE: "2026-04-08" };
  assert.equal(testReferenceDate(), null);
  assert.ok(Math.abs(currentDate().getTime() - Date.now()) < 1000);
});

test("today's imported exam appears as fixed context and future tracking stays out of last seven days", () => {
  process.env = { ...originalEnv, NODE_ENV: "test", STEX_REFERENCE_DATE: "2026-04-08" };
  const values = new Map<string, string>([
    [STORAGE_KEYS.calendar, JSON.stringify([{ id: "document-exam", date: "2026-04-08", label: "Pflichtklausur", eventType: "klausur", source: "document" }])],
    [STORAGE_KEYS.tracking, JSON.stringify([{ id: "future", date: "2026-04-09", durationMinutes: 90, topicIds: [], activityType: "theorie" }])],
  ]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  assert.match(buildContextFor(["calendar"]), /Pflichtklausur/);
  assert.match(buildContextFor(["tracking"]), /LETZTE 7 TAGE: Keine Aktivität/);
});

test("source-backed calendar-only conflicts are reported without extending the concrete learning range", () => {
  const storage = setupHistorical();
  // Dates checked against the original KISS and Pflichtklausurenkurs PDFs on 10.10.2026.
  // Their durations are NOT established by these sources; 4h/5h are conservative defaults.
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...getOnboarding(), examDate: "2026-09-01", documents: [
    { id: "kiss", name: "Kiss Kursplan_Assessorkurs_2026_Canvas.pdf", fullText: "Subjektive Klagehäufung I 01.06.2026; Erledigung und Rücknahme 06.07.2026" },
    { id: "probe", name: "Probeexamen.pdf", fullText: "ZR I 01. Jun 2026; VR II 06. Jul 2026; VR I Besprechung 25. Jun 2026; VRA I Besprechung 25. Jun 2026" },
  ] }));
  const result = applyStructuredPlan({ tasks: [{ date: "2026-04-08", title: "Anfechtung: Kurzfälle", minutes: 90 }], klausuren: [], appointments: [
    ...["2026-06-01", "2026-07-06"].flatMap(date => [
      { date, label: "KISS Kurs", eventType: "rep" as const, sourceDocument: "Kiss Kursplan_Assessorkurs_2026_Canvas.pdf" },
      { date, label: "Pflichtklausur", eventType: "probeexamen" as const, sourceDocument: "Probeexamen.pdf" },
    ]),
    ...["VR I", "VRA I"].map(label => ({ date: "2026-06-25", label: `Besprechung ${label}`, eventType: "ag" as const, sourceDocument: "Probeexamen.pdf" })),
  ] }, "2026-04-08");
  for (const [date, hours] of [["2026-06-01", 9], ["2026-07-06", 9], ["2026-06-25", 8]] as const) {
    assert.equal(computeDayBudget([], eventsOnDate(getCalendarEvents(), date)).totalH, hours);
    assert.ok(result.warnings.some(warning => warning.startsWith(date) && warning.includes("über der Tagesgrenze")), `${date}: conflict must be visible`);
  }
  assert.equal(getCalendarEvents().length, 6);
  assert.equal(result.after.range?.end, "2026-04-08");
  undoApply(result); assert.deepEqual(getCalendarEvents(), []); assert.deepEqual(getTasks(), []);
});

test("dated lawyer-AG annotations retain their dates and do not establish station boundaries", () => {
  const storage = setupHistorical();
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...getOnboarding(), documents: [{
    id: "ag", name: "AG Termine.pdf", fullText: "Öffentliches Recht aus Sicht der RAin / des RA; dritte übungsstunde ist am 05.05.2026, immer eine woche dazu rechnen; die AG ist einmal die woche dienstags; zweite klausur ist mittwoch 13.05",
  }] }));
  const context = buildContextFor(["onboarding"]);
  assert.match(context, /05\.05\.2026/); assert.match(context, /mittwoch 13\.05/);
  const result = applyStructuredPlan({ tasks: [{ date: "2026-05-05", title: "Baurecht: Baugenehmigung", minutes: 300 }], klausuren: [], appointments: [
    ...["2026-05-05", "2026-05-12", "2026-05-19", "2026-05-26"].map(date => ({ date, label: "Anwaltliche ÖR-AG", eventType: "ag" as const, sourceDocument: "AG Termine.pdf" })),
    { date: "2026-05-13", label: "Zweite AG-Klausur", eventType: "klausur", sourceDocument: "AG Termine.pdf" },
  ] }, "2026-04-08");
  assert.equal(getCalendarEvents().length, 5);
  assert.equal(getTasks()[0].date, "2026-05-06");
  assert.deepEqual(getOnboarding().studyPhases, []);
  assert.ok(result.warnings.some(warning => warning.startsWith("2026-05-05") && warning.includes("Dauer")));
  undoApply(result);
});

test("source Sunday-review proposals yield to the personal free day and fixed conflicts are disclosed", () => {
  const storage = setupHistorical();
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...getOnboarding(), freeDayPerWeek: "Sonntag", documents: [{ id: "plan", name: "Lernplan.docx", fullText: "12.04.2026 Sonntag Wiederholung" }, { id: "other", name: "Testtermin.txt", fullText: "Termin am 12.04.2026, 60 Minuten" }] }));
  const result = applyStructuredPlan({ tasks: [{ date: "2026-04-12", title: "Wiederholung", minutes: 90, isReview: true }], klausuren: [], appointments: [{ date: "2026-04-12", label: "Fester Testtermin", eventType: "ag", durationMinutes: 60, sourceDocument: "Testtermin.txt" }] }, "2026-04-08");
  assert.equal(getTasks()[0].date, "2026-04-13");
  assert.equal(getCalendarEvents()[0].date, "2026-04-12");
  assert.ok(result.warnings.some(warning => warning.startsWith("2026-04-12") && warning.includes("freien Tag")));
  undoApply(result);
});
