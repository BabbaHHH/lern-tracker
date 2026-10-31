import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { addDays, parseISO } from "date-fns";
import { localDate } from "../src/lib/dates";
import { buildTopicReviews, dueTopicReviews } from "../src/lib/spaced-repetition";
import { planningDocumentsContext, composePlanningPrompt } from "../src/lib/planning-documents";
import { buildCalendarIcs, foldCalendarLine } from "../src/lib/calendar-export";
import { validateFeedback } from "../src/lib/feedback";
import { completedExamSlots, linkCalendarKlausur } from "../src/lib/klausur-calendar";
import { parseStructuredPlan, applyStructuredPlan, undoApply, prepareLearningDays } from "../src/lib/plan-applier";
import { STORAGE_KEYS, getOnboarding, getTasks, getCalendarEvents, getTrackingEntries, addTask, completeTask, uncompleteTask, markKlausurWritten } from "../src/lib/store";
import { computeDayBudget } from "../src/lib/day-budget";
import { TOPICS, getLeafTopics } from "../src/lib/topics";
import { buildContextFor } from "../src/lib/prompt-context";
import type { CalendarEvent, Klausur, TrackingEntry } from "../src/lib/types";
import type { RecallRating } from "../src/lib/spaced-repetition";

const date = "2026-11-02";
const topicId = getLeafTopics(TOPICS)[0].id;
const original = new Map(["window", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
afterEach(() => { for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
function setup() {
  const values = new Map<string, string>();
  const storage = { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {}, localStorage: storage } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return storage;
}
function session(day: string, recallRating?: RecallRating, id = day): TrackingEntry { return { id, date: day, createdAt: `${day}T12:00:00Z`, topicIds: [topicId], activityType: recallRating ? "wiederholung" : "theorie", durationMinutes: 90, recallRating, note: "" }; }
const exam: Klausur = { id: "case", title: "Testklausur", source: "test.pdf", date: "2026-01-01", area: "zr", topicIds: [topicId], createdAt: date, updatedAt: date };
const event: CalendarEvent = { id: "slot", date, label: "ZR-Klausur", eventType: "klausur", recurring: false };
const profile = () => ({ ...getOnboarding(), documents: [{ id: "doc", name: "Stationsplan.txt", type: "other" as const, description: "Persönlicher Plan", fullText: "Zivilstation 02.11.2026 bis 30.11.2026; AG 02.11.2026 4 Stunden.", parseStatus: "ready" as const }] });
const plan = () => ({ tasks: [{ date, title: "Zivilrecht vertiefen", topicId, minutes: 90 }], klausuren: [], studyPhases: [{ id: "civil", label: "Zivilstation", start: date, end: "2026-11-30", focus: "zr" as const, perspective: "state" as const, sourceDocument: "Stationsplan.txt" }], appointments: [{ date, label: "AG Zivil", eventType: "ag" as const, durationMinutes: 240, sourceDocument: "Stationsplan.txt" }] });

test("full document text reaches onboarding context and standard rules are appended", () => {
  const storage = setup(); storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(profile()));
  assert.match(buildContextFor(["onboarding"]), /Zivilstation 02\.11\.2026 bis 30\.11\.2026/);
  assert.match(composePlanningPrompt("custom"), /Klausurenkurs begleitet das gesamte Referendariat/);
  assert.match(planningDocumentsContext([{ ...profile().documents[0], fullText: "x".repeat(18000) }]), /Nur ein Ausschnitt/);
  assert.match(planningDocumentsContext([{ ...profile().documents[0], fullText: "", parseError: "Scan ohne Text" }]), /Scan ohne Text/);
});

test("structured document sources and intervals validate before changing storage", () => {
  const storage = setup(); storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(profile()));
  assert.ok(parseStructuredPlan(`\`\`\`json\n${JSON.stringify(plan())}\n\`\`\``));
  for (const invalid of [{ ...plan(), studyPhases: [{ ...plan().studyPhases[0], end: "2026-02-30" }] }, { ...plan(), appointments: [{ ...plan().appointments[0], durationMinutes: -2 }] }, { ...plan(), tasks: [{ date, title: "Review", isReview: "yes" }] }]) assert.equal(parseStructuredPlan(`\`\`\`json\n${JSON.stringify(invalid)}\n\`\`\``), null);
  const before = [...storage.values];
  assert.throws(() => applyStructuredPlan({ ...plan(), appointments: [{ ...plan().appointments[0], sourceDocument: "invented.pdf" }] }, date), /Quelle/);
  assert.deepEqual([...storage.values], before);
});

test("normal plan adoption saves extracted stations/appointments, counts their hours, and undo restores all", () => {
  const storage = setup(); storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(profile()));
  const result = applyStructuredPlan(plan(), date);
  assert.equal(getOnboarding().studyPhases?.[0].id, "civil");
  assert.equal(getCalendarEvents()[0].sourceDocument, "Stationsplan.txt");
  assert.equal(computeDayBudget(getTasks(), getCalendarEvents()).totalH, 5.5);
  undoApply(result); assert.equal(getTasks().length, 0); assert.equal(getCalendarEvents().length, 0); assert.deepEqual(getOnboarding().studyPhases, []);
});

test("distant document appointments do not mark the whole ref as concretely planned", () => {
  const storage = setup(); storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(profile()));
  const result = applyStructuredPlan({ ...plan(), appointments: [{ ...plan().appointments[0], date: "2027-11-02" }] }, date);
  assert.equal(result.after.range?.end, date);
  assert.equal(getCalendarEvents()[0].date, "2027-11-02");
});

test("document slots displace content without creating 14-hour learning days", () => {
  const storage = setup(); storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(profile()));
  const result = applyStructuredPlan({ ...plan(), tasks: [{ date, title: "Langer Lernblock", minutes: 300 }] }, date);
  assert.equal(result.moved, 1); assert.equal(getTasks()[0].date, "2026-11-03");
});

test("spaced repetition starts at one day and expands only from explicit recall", () => {
  const entries = [session("2026-10-01"), session("2026-10-02", "good"), session("2026-10-03", "good"), session("2026-10-09", "good")];
  assert.equal(buildTopicReviews(entries.slice(0, 1), date)[0].due, "2026-10-02");
  assert.equal(buildTopicReviews(entries.slice(0, 3), date)[0].intervalDays, 6);
  assert.equal(buildTopicReviews(entries, date)[0].intervalDays, 15);
  assert.equal(buildTopicReviews([...entries, session("2026-10-24", "again")], date)[0].due, "2026-10-25");
  assert.equal(buildTopicReviews([...entries, session("2026-10-24", "hard")], date)[0].intervalDays < buildTopicReviews([...entries, session("2026-10-24", "easy")], date)[0].intervalDays, true);
});

test("exam ratings, multiple sessions in one day, and future entries cannot fake recall intervals", () => {
  const entries = [session("2026-10-01"), { ...session("2026-10-02"), activityType: "klausur" as const, rating: 5 }, session("2026-12-01", "easy")];
  assert.equal(buildTopicReviews(entries, date)[0].due, "2026-10-02");
  const sameDay = [session("2026-10-02", "good", "a"), { ...session("2026-10-02", "easy", "b"), createdAt: "2026-10-02T13:00:00Z" }];
  assert.equal(buildTopicReviews(sameDay, date)[0].repetitions, 1);
  assert.equal(dueTopicReviews(entries, "2026-10-01", date).length, 0);
});

test("review completion and undo use actual history and preserve the planned duration", () => {
  setup(); addTask({ date: localDate(), title: "Wiederholung", source: "manual", durationMinutes: 45, linkedTopicId: topicId, isReview: true });
  const id = getTasks()[0].id; completeTask(id, undefined, "again");
  assert.equal(getTrackingEntries()[0].activityType, "wiederholung"); assert.equal(getTrackingEntries()[0].durationMinutes, 45);
  assert.equal(buildTopicReviews(getTrackingEntries())[0].intervalDays, 1);
  uncompleteTask(id); assert.equal(buildTopicReviews(getTrackingEntries()).length, 0);
});

test("due reviews occupy existing automatic slots once and leave spare hours unchanged", () => {
  const storage = setup(); storage.setItem(STORAGE_KEYS.tracking, JSON.stringify([session("2026-11-01")]));
  prepareLearningDays([date, "2026-11-03"], date);
  assert.equal(getTasks().filter(task => task.isReview && task.linkedTopicId === topicId).length, 1);
  assert.equal(getTasks().find(task => task.isReview)?.date, date);
  assert.equal(computeDayBudget(getTasks().filter(task => task.date === date), []).totalH, 3);
  const before = JSON.stringify(getTasks()); prepareLearningDays([date], date); assert.equal(JSON.stringify(getTasks()), before);
});

test("finishing one automatic sprint retains a second useful sprint", () => {
  setup(); const today = localDate(); prepareLearningDays([today], today);
  if (!getTasks().length) return; // configured free weekday
  const first = getTasks()[0]; completeTask(first.id); prepareLearningDays([today], today);
  assert.equal(getTasks().filter(task => task.date === today).length, 2);
  assert.equal(getTasks().filter(task => task.date === today && task.linkedTopicId === first.linkedTopicId).length, 1);
});

test("case assignment is idempotent, charges five hours once, and matches actual completion", () => {
  const storage = setup(); storage.setItem(STORAGE_KEYS.klausuren, JSON.stringify([exam])); storage.setItem(STORAGE_KEYS.calendar, JSON.stringify([event]));
  linkCalendarKlausur(event.id, exam.id); linkCalendarKlausur(event.id, exam.id);
  assert.equal(getTasks().length, 1); assert.equal(getTasks()[0].calendarEventId, event.id);
  assert.equal(computeDayBudget(getTasks(), getCalendarEvents()).totalH, 5);
  const record = { ...session(date), activityType: "klausur" as const, klausurId: "other" };
  assert.equal(completedExamSlots(getCalendarEvents(), [record], date).size, 0);
  assert.equal(completedExamSlots(getCalendarEvents(), [{ ...record, klausurId: exam.id }], date).size, 1);
  assert.equal(computeDayBudget([{ ...getTasks()[0], linkedKlausurId: "other", calendarEventId: undefined }], getCalendarEvents()).totalH, 10);
});

test("ICS export has stable UIDs across moves, exclusive all-day end, and no duplicates", () => {
  setup(); addTask({ date, title: "Übung; a,b\nZeile", source: "manual", linkedKlausurId: "case", calendarEventId: event.id, durationMinutes: 300 });
  const input = { start: date, end: "2026-11-04", tasks: getTasks(), events: [event], tracking: [], klausuren: [exam], now: new Date("2026-10-09T12:00:00Z") };
  const first = buildCalendarIcs(input); const moved = buildCalendarIcs({ ...input, tasks: [{ ...input.tasks[0], date: "2026-11-03" }], events: [{ ...event, date: "2026-11-03" }] });
  assert.equal((first.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.match(first, /DTEND;VALUE=DATE:20261103/); assert.match(first, /Übung\\; a\\,b\\nZeile/);
  assert.equal(first.match(/UID:(.*)/)?.[1], moved.match(/UID:(.*)/)?.[1]);
  for (const line of foldCalendarLine("SUMMARY:" + "ä🙂".repeat(70)).split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(foldCalendarLine("SUMMARY:" + "ä🙂".repeat(70)).replace(/\r\n /g, ""), "SUMMARY:" + "ä🙂".repeat(70));
});

test("ICS tracks historical work without leaking notes or duplicating a completed task", () => {
  setup(); const today = localDate(); addTask({ date: today, title: "Test", source: "manual", linkedTopicId: topicId }); completeTask(getTasks()[0].id);
  const input = { start: today, end: localDate(addDays(parseISO(today), 2)), tasks: getTasks(), events: [], tracking: [...getTrackingEntries(), { ...session(today, undefined, "legacy"), klausurId: exam.id, note: "PRIVATE NOTE", activityType: "klausur" as const }], klausuren: [exam] };
  const text = buildCalendarIcs(input); assert.equal((text.match(/BEGIN:VEVENT/g) ?? []).length, 2); assert.doesNotMatch(text, /PRIVATE NOTE/);
  assert.throws(() => buildCalendarIcs({ ...input, end: "2035-01-01" }), /höchstens/);
});

test("feedback accepts a bounded message and strips unrelated fields", () => {
  const item = { id: crypto.randomUUID(), category: "bug", text: "Kalender zeigt doppelte Klausur", page: "/wochenplan", createdAt: new Date().toISOString(), version: "0.1.0" };
  assert.ok(validateFeedback(item)); assert.equal("documents" in validateFeedback({ ...item, documents: "private" })!, false);
  for (const changes of [{ id: "../../secret" }, { text: "x" }, { text: "x".repeat(4001) }, { page: "/?token=secret" }, { category: "__proto__" }, { createdAt: "invalid" }]) assert.equal(validateFeedback({ ...item, ...changes }), null);
});

test("a failed review transaction restores both history and completion", () => {
  const storage = setup(); addTask({ date: localDate(), title: "Review", source: "manual", linkedTopicId: topicId, isReview: true });
  const before = JSON.stringify(getTasks()); const originalSet = storage.setItem; let failed = false;
  storage.setItem = (key, value) => { if (key === STORAGE_KEYS.tasks && !failed) { failed = true; throw new Error("quota"); } originalSet(key, value); };
  assert.throws(() => completeTask(getTasks()[0].id, undefined, "good")); assert.equal(JSON.stringify(getTasks()), before); assert.equal(getTrackingEntries().length, 0);
});

test("concrete planned case IDs must exist in the database and match its area", () => {
  const storage = setup(); storage.setItem(STORAGE_KEYS.klausuren, JSON.stringify([exam]));
  assert.throws(() => applyStructuredPlan({ tasks: [], klausuren: [{ date, label: "Fall", area: "sr", klausurId: exam.id }] }, date), /Rechtsgebiet/);
  const result = applyStructuredPlan({ tasks: [], klausuren: [{ date, label: "Fall", area: "zr", klausurId: exam.id }] }, date);
  assert.equal(getTasks()[0].linkedKlausurId, exam.id); assert.equal(computeDayBudget(getTasks(), getCalendarEvents()).totalH, 5); undoApply(result);
});

test("failed exam completion rolls back tracking, progress and tasks", () => {
  const storage = setup(); const originalSet = storage.setItem; let failed = false;
  storage.setItem = (key, value) => { if (key === STORAGE_KEYS.tasks && !failed) { failed = true; throw new Error("quota"); } originalSet(key, value); };
  assert.throws(() => markKlausurWritten(exam, { rating: 3, date: localDate(), validLeafIds: new Set([topicId]) }));
  assert.equal(getTrackingEntries().length, 0); assert.equal(getTasks().length, 0); assert.equal(storage.getItem(STORAGE_KEYS.progress), null);
});
