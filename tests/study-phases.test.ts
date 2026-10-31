import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { addDays, parseISO } from "date-fns";
import { localDate } from "../src/lib/dates";
import { createBerlinStudyPhases, getStudyPhase, getStudyBlock, studyPhaseErrors, topicPerspective, type StudyPhase, type StudyPhaseSettings } from "../src/lib/study-phases";
import { selectAutoSprints } from "../src/lib/auto-picker";
import { TOPICS, getLeafTopics } from "../src/lib/topics";
import { prepareLearningDays } from "../src/lib/plan-applier";
import { getOnboarding, getTasks, getTasksForDate, addTask, updateTask, saveOnboarding, STORAGE_KEYS } from "../src/lib/store";
import { computeDayBudget } from "../src/lib/day-budget";
import { getTop3Klausuren, buildKiCandidatesMessage } from "../src/lib/klausur-recommender";
import { buildContextFor } from "../src/lib/prompt-context";
import type { Klausur } from "../src/lib/types";

const phases = createBerlinStudyPhases("2026-02-01");
const settings: StudyPhaseSettings = { studyPhasesEnabled: true, studyPhases: phases };
const leafs = getLeafTopics(TOPICS);
const previous = new Map(["window", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
afterEach(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
function setup() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {}, localStorage: storage } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return storage;
}
function onePhase(changes: Partial<StudyPhase> = {}): StudyPhase {
  return { id: "test", label: "Teststation", start: "2026-10-01", end: "2026-12-31", focus: "zr", perspective: "state", ...changes };
}

test("February example maps state and lawyer passes separately, including the mid-month switch", () => {
  assert.deepEqual(phases.slice(0, 3).map(p => [p.start, p.end, p.focus, p.perspective]), [
    ["2026-02-01", "2026-05-31", "zr", "state"],
    ["2026-06-01", "2026-09-15", "sr", "state"],
    ["2026-09-16", "2026-12-31", "oeffr", "state"],
  ]);
  assert.deepEqual(phases.slice(3, 6).map(p => [p.focus, p.perspective]), [["zr", "lawyer"], ["sr", "lawyer"], ["oeffr", "lawyer"]]);
  assert.equal(phases[6].start, "2027-06-01");
  assert.equal(phases[7].start, "2027-10-01");
  assert.equal(phases[7].end, "2028-01-31");
  assert.equal(getStudyPhase("2026-09-15", settings)?.focus, "sr");
  assert.equal(getStudyPhase("2026-09-16", settings)?.focus, "oeffr");
});

test("template stays contiguous across leap years and shifted cohorts; invalid dates are rejected", () => {
  for (const start of ["2027-02-01", "2026-11-01", "2028-01-01"]) {
    const template = createBerlinStudyPhases(start);
    assert.deepEqual(studyPhaseErrors(template), []);
    template.slice(1).forEach((phase, i) => assert.equal(phase.start, localDate(addDays(parseISO(template[i].end), 1))));
  }
  assert.throws(() => createBerlinStudyPhases("2026-02-30"));
  assert.throws(() => createBerlinStudyPhases("2026-02-15"));
});

test("malformed settings do not choose a phase; default needs no activation and explicit custom opts out", () => {
  for (const invalid of [null, [null], [{ ...phases[0], focus: "invalid" }], [phases[0], { ...phases[1], start: phases[0].end }]]) {
    assert.ok(studyPhaseErrors(invalid).length);
    assert.equal(getStudyPhase("2026-02-02", { studyPhasesEnabled: true, studyPhases: invalid as StudyPhase[] }), null);
  }
  assert.equal(getStudyPhase("2026-02-02", { ...settings, studyPhasesEnabled: false })?.id, phases[0].id);
  assert.equal(getStudyPhase("2026-02-02", { ...settings, studyPlanningMode: "custom" }), null);
  assert.equal(getStudyPhase("2026-06-10", { ...settings, studyPhases: [phases[0], phases[2]] }), null);
});

test("fortnight learning blocks end at a station switch and written exam, then restart at one", () => {
  const end = getStudyBlock("2026-09-15", settings)!;
  assert.equal(end.end, "2026-09-15");
  assert.equal(getStudyBlock("2026-09-16", settings)?.number, 1);
  assert.equal(getStudyBlock("2026-09-16", settings)?.start, "2026-09-16");
  assert.equal(getStudyBlock("2026-09-17", { ...settings, examDate: "2026-09-20" })?.end, "2026-09-19");
  assert.equal(getStudyBlock("2026-09-20", { ...settings, examDate: "2026-09-20" }), null);
});

test("state and lawyer sprints select the corresponding practical technique in all three areas", () => {
  for (const phase of phases.slice(0, 6)) {
    const selected = selectAutoSprints(phase.start, 2, leafs, {}, settings);
    assert.equal(selected.length, 2);
    assert.equal(new Set(selected.map(item => item.topic.id)).size, 2);
    assert.equal(selected[0].topic.area, phase.focus);
    assert.equal(topicPerspective(selected[0].topic), phase.perspective);
    assert.equal(selected[0].title, selected[0].topic.label);
  }
});

test("focus leaves a regular review share; mixed stages cover all areas even with one slot", () => {
  const selected = Array.from({ length: 25 }, (_, i) => selectAutoSprints(localDate(addDays(parseISO(phases[0].start), i)), 2, leafs, {}, settings)).flat();
  assert.equal(selected.length, 50);
  assert.equal(selected.filter(item => item.topic.area === "zr").length, 40);
  assert.ok(selected.every(item => item.title === item.topic.label));
  const mixed = Array.from({ length: 3 }, (_, i) => selectAutoSprints(localDate(addDays(parseISO(phases[6].start), i)), 1, leafs, {}, settings)).flat();
  assert.equal(new Set(mixed.map(item => item.topic.area)).size, 3);
  assert.deepEqual(selectAutoSprints("2026-02-01", 0, leafs, {}, settings), []);
});

test("stable topic rotation does not repeat the same foundation on consecutive days", () => {
  const config = { studyPhasesEnabled: true, studyPhases: [onePhase({ perspective: "lawyer" })] };
  const days = ["2026-10-12", "2026-10-13", "2026-10-14"].map(date => selectAutoSprints(date, 2, leafs, {}, config));
  for (let i = 1; i < days.length; i++) {
    assert.ok(days[i].every(item => !days[i - 1].some(previous => previous.topic.id === item.topic.id)));
  }
});

test("editing a station refreshes only future open automatic work and stays within capacity", () => {
  const storage = setup();
  const date = "2026-11-02";
  const profile = { ...getOnboarding(), ...settings, maxDailyHours: 5, studyPhases: [onePhase()] };
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(profile));
  prepareLearningDays([date], date);
  const first = getTasksForDate(date)[0];
  assert.equal(first.title, leafs.find(topic => topic.id === first.linkedTopicId)?.label);
  addTask({ date: "2026-11-03", title: "Eigener Lerninhalt", source: "manual", durationMinutes: 90 });
  addTask({ date: "2026-11-04", title: "Erledigter Sprint", source: "auto", durationMinutes: 90 });
  const done = getTasksForDate("2026-11-04")[0]; updateTask(done.id, { done: true });
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...profile, studyPhases: [onePhase({ perspective: "lawyer" })] }));
  prepareLearningDays([date, "2026-11-03", "2026-11-04", "2026-11-08"], date);
  assert.ok(getTasksForDate(date).every(task => topicPerspective(leafs.find(topic => topic.id === task.linkedTopicId)!) !== "state"));
  assert.equal(getTasks().some(task => task.id === first.id), false);
  assert.equal(getTasksForDate("2026-11-03")[0].title, "Eigener Lerninhalt");
  assert.deepEqual(getTasks().find(task => task.id === done.id), { ...done, done: true });
  assert.equal(getTasksForDate("2026-11-08").length, 0);
  assert.ok(computeDayBudget(getTasksForDate(date), []).totalH <= 5);
  const once = JSON.stringify(getTasks()); prepareLearningDays([date], date);
  assert.equal(JSON.stringify(getTasks()), once);
});

test("station settings save and AI context carries the complete timeline plus daily sprint boundaries", () => {
  setup(); const today = localDate();
  const profile = { ...getOnboarding(), studyPhasesEnabled: true, studyPhases: [onePhase({ start: today, end: localDate(addDays(parseISO(today), 10)), perspective: "lawyer" })] };
  assert.equal(saveOnboarding(profile), true);
  assert.deepEqual(getOnboarding().studyPhases, profile.studyPhases);
  const context = buildContextFor(["onboarding", "dailyBudget"]);
  assert.match(context, /STATIONSPLANUNG/);
  assert.match(context, /Anwaltliche Sicht/);
  assert.match(context, /Lernblock 1/);
  assert.match(context, /harte Obergrenze 7h/);
});

test("main exam recommendation follows station perspective while a calendar area takes precedence", () => {
  const storage = setup(); const date = "2026-11-02";
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...getOnboarding(), studyPhasesEnabled: true, studyPhases: [onePhase({ perspective: "lawyer" })] }));
  const cases: Klausur[] = [
    { id: "civil-state", title: "Urteil", area: "zr", type: "Urteil" },
    { id: "civil-lawyer", title: "Mandat", area: "zr", type: "Anwaltsklausur" },
    { id: "criminal", title: "Revision", area: "sr", type: "Revisionsklausur" },
  ].map(k => ({ source: "", date: "2026-01-01", topicIds: [], createdAt: date, updatedAt: date, ...k } as Klausur));
  assert.equal(getTop3Klausuren(cases, date)[0].klausur.id, "civil-lawyer");
  assert.match(buildKiCandidatesMessage(getTop3Klausuren(cases, date), date), /Anwaltliche Sicht/);
  storage.setItem(STORAGE_KEYS.calendar, JSON.stringify([{ id: "event", date, label: "SR-Klausur", eventType: "klausur", recurring: false }]));
  assert.equal(getTop3Klausuren(cases, date)[0].klausur.id, "criminal");
});
