import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { computeDayBudget, taskMinutes, isStudyFreeDay, dailyHours, eventsOnDate, planningEvents } from "../src/lib/day-budget";
import { autoTopicCount, rebalanceTasks } from "../src/lib/learning-planner";
import { applyStructuredPlan, undoApply, materializeRecurringTermine, parseStructuredPlan, prepareLearningDays } from "../src/lib/plan-applier";
import { getOnboarding, getTasks, getTasksForDate, getCalendarEvents, getPlanAppliedRange, addTask, markKlausurWritten, getTrackingEntries, completeTask, STORAGE_KEYS, type DailyTask } from "../src/lib/store";
import type { CalendarEvent } from "../src/lib/types";
import { buildContextFor } from "../src/lib/prompt-context";
import { localDate } from "../src/lib/dates";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const previous = new Map(["window", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
afterEach(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
function setup() {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {}, localStorage: storage } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return storage;
}
const date = "2026-11-02"; // Monday, after the audit date.
function task(id: string, minutes: number, changes: Partial<DailyTask> = {}): DailyTask {
  return { id, date, title: `Lernaufgabe ${id}`, durationMinutes: minutes, source: "plan", done: false, createdAt: "2026-10-09", ...changes };
}
function exam(changes: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id: "exam", date, label: "Übungsklausur", eventType: "klausur", recurring: false, ...changes };
}

test("a calendar slot and its selected or completed exam occupy five hours once", () => {
  const written = task("written", 300, { linkedKlausurId: "case" });
  assert.equal(computeDayBudget([written], [exam()]).totalH, 5);
  assert.equal(computeDayBudget([{ ...written, done: true }], 1).totalH, 5);
  assert.equal(computeDayBudget([task("sketch", 120, { title: "Skizze: Fall", linkedKlausurId: "case" })], 1).totalH, 7);
  assert.equal(computeDayBudget([written], 1).reserveH, 0);
  assert.equal(computeDayBudget([written], 2).totalH, 10); // Real conflict stays visible.
});

test("duration handling accepts comma hours and rejects NaN/negative legacy values", () => {
  assert.equal(taskMinutes({ title: "Vorb. AG (1,5 h)" }), 90);
  assert.equal(taskMinutes({ title: "Fall", durationMinutes: NaN }), 90);
  assert.equal(taskMinutes({ title: "Fall", durationMinutes: -120 }), 90);
  assert.equal(dailyHours({ maxDailyHours: NaN }), 7);
  assert.equal(computeDayBudget([task("fixed", 840)], 0).overloadH, 7);
});

test("auto filler respects fixed work, manual tasks, free weekdays and vacations", () => {
  setup(); const settings = getOnboarding();
  const fixed = [task("ag", 240, { title: "AG (4h)" }), task("prep", 120, { title: "Vorb. AG (2h)" }), task("anki", 30, { title: "Anki (0.5h)" })];
  assert.equal(autoTopicCount(date, fixed, [], settings, null, date), 0);
  assert.equal(autoTopicCount(date, [fixed[0], fixed[2]], [], settings, null, date), 1);
  assert.equal(autoTopicCount(date, [task("manual", 300, { source: "manual" })], [], settings, null, date), 0);
  assert.equal(autoTopicCount("2026-11-08", [], [], settings, null, date), 0);
  assert.equal(autoTopicCount(date, [], [], { ...settings, vacationDates: [date] }, null, date), 0);
  assert.equal(autoTopicCount(date, [], [], settings, null, date), 2);
  assert.equal(autoTopicCount(date, [], [], { ...settings, maxDailyHours: 5 }, null, date), 2);
  assert.equal(autoTopicCount(date, [], [], { ...settings, maxDailyHours: 2 }, null, date), 1);
  assert.equal(autoTopicCount(date, [], [exam()], settings, null, date), 1);
});

test("overfull plans move forward without altering manual or completed work", () => {
  setup(); const settings = getOnboarding();
  const input = [task("manual", 300, { source: "manual" }), task("one", 180), task("two", 180), task("done", 60, { done: true })];
  const result = rebalanceTasks(input, [], settings, date, "2026-11-05");
  assert.equal(result.tasks.find(item => item.id === "manual")?.date, date);
  assert.equal(result.tasks.find(item => item.id === "done")?.date, date);
  assert.equal(result.moved.length, 2);
  assert.equal(result.tasks.filter(item => item.date === "2026-11-03").length, 2);
  for (const day of new Set(result.tasks.map(item => item.date))) assert.ok(computeDayBudget(result.tasks.filter(item => item.date === day), 0).totalH <= 7);
  assert.deepEqual(rebalanceTasks(result.tasks, [], settings, date, "2026-11-05").tasks, result.tasks);
});

test("overflow is preserved as backlog and never pushed onto a free day", () => {
  setup(); const settings = getOnboarding();
  const input = [task("one", 480), task("two", 180)];
  const result = rebalanceTasks(input, [], { ...settings, vacationDates: [date] }, date, "2026-11-03");
  assert.equal(result.tasks.find(item => item.id === "one")?.deferred, true);
  assert.equal(result.tasks.find(item => item.id === "two")?.date, "2026-11-03");
  assert.equal(computeDayBudget(result.tasks.filter(item => item.date === date), 0).totalH, 0);
});

test("weekly and home navigation have identical, idempotent daily suggestions", () => {
  const storage = setup(); const dates = [date, "2026-11-03", "2026-11-08"];
  prepareLearningDays([date], date); prepareLearningDays(dates, date);
  const normalize = () => getTasks().map(({ date, title, durationMinutes }) => ({ date, title, durationMinutes })).sort((a,b) => (a.date+a.title).localeCompare(b.date+b.title));
  const first = normalize();
  storage.values.clear();
  prepareLearningDays(dates, date); prepareLearningDays([date], date);
  assert.deepEqual(normalize(), first);
  assert.equal(getTasksForDate("2026-11-08").length, 0);
  assert.equal(getTasksForDate(date).length, 2);
});

test("recurring duration edits update tasks and remove zero prep, preserving done history", () => {
  const storage = setup(); const settings = getOnboarding();
  const ag = { id: "a", label: "AG Zivil", day: "Montag", frequency: "wöchentlich", durationHours: 4, prepHours: 2, postHours: 1, startDate: "", endDate: "" };
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...settings, ags: [ag] }));
  materializeRecurringTermine("2026-11-01", "2026-11-03");
  assert.equal(getTasks().length, 3);
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...settings, ags: [{ ...ag, durationHours: 2, prepHours: 0, postHours: 0 }] }));
  materializeRecurringTermine("2026-11-01", "2026-11-03");
  assert.equal(getTasks().length, 1);
  assert.equal(getTasks()[0].durationMinutes, 120);
  assert.match(getTasks()[0].title, /\(2h\)/);
});

test("preparation for a next-day appointment is included at the range boundary", () => {
  const storage = setup(); const settings = getOnboarding();
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...settings, ags: [{ id:"a", label:"AG", day:"Dienstag", frequency:"wöchentlich", durationHours:4, prepHours:2, postHours:0, startDate:"", endDate:"" }] }));
  materializeRecurringTermine(date, date);
  assert.equal(getTasks().length, 1); assert.equal(getTasks()[0].durationMinutes, 120);
  materializeRecurringTermine(date, date); assert.equal(getTasks().length, 1);
});

test("AI plan application enforces capacity, schedules exams first, and restores replaced data on undo", () => {
  const storage = setup();
  const old = task("old", 60);
  storage.setItem(STORAGE_KEYS.tasks, JSON.stringify([old]));
  const applied = applyStructuredPlan({ tasks: [1,2,3,4].map(number => ({ date, title:`Fall ${number}`, minutes:180 })), klausuren:[{date, label:"ZR", area:"zr"}] }, date);
  assert.equal(applied.tasksCreated, 4); assert.ok(applied.moved > 0);
  for (const day of new Set(getTasks().map(item => item.date))) assert.ok(computeDayBudget(getTasksForDate(day), eventsOnDate(getCalendarEvents(), day)).totalH <= 7);
  assert.equal(getTasks().some(item => item.id === "old"), false);
  undoApply(applied);
  assert.deepEqual(getTasks(), [old]); assert.equal(getPlanAppliedRange(), null); assert.deepEqual(getCalendarEvents(), []);
});

test("undo refuses to overwrite edits made after applying a plan", () => {
  setup(); const applied = applyStructuredPlan({ tasks:[{date, title:"Fall", minutes:90}], klausuren:[] }, date);
  addTask({ date, title:"Eigene Notiz", source:"manual" });
  assert.throws(() => undoApply(applied), /inzwischen geändert/);
  assert.equal(getTasks().some(item => item.title === "Eigene Notiz"), true);
});

test("invalid, empty and past AI plans cannot erase existing work", () => {
  setup(); addTask({ date, title:"Bestehend", source:"plan" }); const before = getTasks();
  for (const bad of [{ tasks:[{date:"2026-02-30",title:"X"}],klausuren:[] }, {tasks:[{date,title:42}],klausuren:[]}, {tasks:[{date,title:"X",minutes:-10}],klausuren:[]}]) assert.equal(parseStructuredPlan('```json\n'+JSON.stringify(bad)+'\n```'), null);
  assert.throws(() => applyStructuredPlan({tasks:[],klausuren:[]}, date), /keine/);
  assert.throws(() => applyStructuredPlan({tasks:[{date:"2026-10-01",title:"Alt"}],klausuren:[]}, date), /vergangene/);
  assert.deepEqual(getTasks(), before);
});

test("failed plan writes roll back instead of reporting a partial successful plan", () => {
  const storage = setup(); addTask({date,title:"Bestehend",source:"plan"}); const before = getTasks();
  const original = storage.setItem.bind(storage); let fail = true;
  storage.setItem = (key,value) => { if (key === STORAGE_KEYS.calendar && fail) { fail = false; throw new Error("QuotaExceededError"); } original(key,value); };
  assert.throws(() => applyStructuredPlan({tasks:[{date,title:"Neu"}],klausuren:[]},date), /bisherigen Daten/);
  assert.deepEqual(getTasks(),before);
});

test("recording an exam completes its planned task and logs only one session", () => {
  setup(); const completedDate = localDate(); addTask({date:completedDate,title:"Fall",linkedKlausurId:"case",klausurMode:"written",durationMinutes:300,source:"manual"});
  const options = {date:completedDate,rating:3,validLeafIds:new Set<string>()};
  markKlausurWritten({id:"case",topicIds:[]},options);
  const written = getTasks()[0]; assert.equal(written.done,true); assert.equal(written.durationMinutes,300);
  completeTask(written.id); markKlausurWritten({id:"case",topicIds:[]},options);
  assert.equal(getTrackingEntries().length,1); assert.equal(getTasks().length,1);
  assert.equal(computeDayBudget(getTasks(),[exam()]).totalH,5);
});

test("ordinary task completion uses planned duration, not an unrelated 30-minute default", () => {
  setup(); addTask({date,title:"AG (4h)",source:"plan",durationMinutes:240}); completeTask(getTasks()[0].id);
  assert.equal(getTrackingEntries()[0].durationMinutes,240);
});

test("calendar recurrence and multi-day seminars consume the same budget everywhere", () => {
  setup(); const settings = getOnboarding();
  const all = planningEvents([exam({date:"2026-10-26",recurring:true,recurringDay:1})],{...settings,kaiserSeminare:[{date:"2026-11-03",topic:"Strafrecht",durationDays:2}]});
  assert.equal(computeDayBudget([],eventsOnDate(all,date)).totalH,5);
  assert.equal(computeDayBudget([],eventsOnDate(all,"2026-11-04")).totalH,7);
  assert.equal(isStudyFreeDay("2026-11-08",settings,all),true);
});

test("AI context handles unset exam dates and includes the enforced daily limit", () => {
  setup(); const text = buildContextFor(["timeStatus", "dailyBudget"]);
  assert.doesNotMatch(text,/NaN/); assert.match(text,/Obergrenze 7h/);
});

test("moving an AG in the weekly editor moves its work and preparation as well", () => {
  const storage = setup(); const settings = getOnboarding();
  storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({...settings,ags:[{id:"a",label:"AG",day:"Montag",frequency:"wöchentlich",durationHours:4,prepHours:2,postHours:1,startDate:"",endDate:""}]}));
  materializeRecurringTermine(date,"2026-11-06");
  storage.setItem(STORAGE_KEYS.agWeeks, JSON.stringify({"2026-W45":{weekKey:"2026-W45",agDays:[2],source:"manual"}}));
  materializeRecurringTermine(date,"2026-11-06");
  assert.equal(getTasksForDate(date).length,0);
  assert.equal(getTasksForDate("2026-11-03")[0].durationMinutes,120);
  assert.equal(computeDayBudget(getTasksForDate("2026-11-04"),0).totalH,5);
});

test("renaming a recurring appointment preserves its identity and entered content", () => {
  const storage = setup(); const settings = getOnboarding();
  const ag = {id:"a",label:"AG",day:"Montag",frequency:"wöchentlich",durationHours:4,prepHours:0,postHours:0,startDate:"",endDate:""};
  storage.setItem(STORAGE_KEYS.onboarding,JSON.stringify({...settings,ags:[ag]}));
  materializeRecurringTermine(date,date); const id=getTasks()[0].id;
  storage.setItem(STORAGE_KEYS.tasks,JSON.stringify(getTasks().map(task=>({...task,contentSummary:"Eigene Notiz"}))));
  storage.setItem(STORAGE_KEYS.onboarding,JSON.stringify({...settings,ags:[{...ag,label:"Zivil-AG",durationHours:3}]}));
  materializeRecurringTermine(date,date);
  assert.equal(getTasks().length,1); assert.equal(getTasks()[0].id,id); assert.equal(getTasks()[0].contentSummary,"Eigene Notiz"); assert.equal(getTasks()[0].durationMinutes,180);
});

test("learning group preparation stays on the group day during legacy migration", () => {
  const storage = setup(); const settings = getOnboarding();
  storage.setItem(STORAGE_KEYS.onboarding,JSON.stringify({...settings,lerngruppen:[{id:"g",label:"Lerngruppe",day:"Montag",frequency:"wöchentlich",durationHours:2,prepHours:2,postHours:0,startDate:"",endDate:""}]}));
  storage.setItem(STORAGE_KEYS.tasks,JSON.stringify([task("old",120,{title:"Vorb. Lerngruppe (2h)"})]));
  materializeRecurringTermine(date,"2026-11-03"); materializeRecurringTermine(date,"2026-11-03");
  assert.equal(getTasks().length,2); assert.equal(computeDayBudget(getTasksForDate(date),0).totalH,4);
});

test("unrelated named calendar appointments are not merged merely because both are AGs", () => {
  const tasks=[task("ag",240,{title:"AG Zivil (4h)",recurringKey:"ag|id:a|2026-11-02|main"})];
  assert.equal(computeDayBudget(tasks,[exam({eventType:"ag",label:"AG Straf",durationMinutes:120})]).totalH,6);
});

test("exam review tasks are preserved and subject to the same daily limit", () => {
  setup();
  const applied=applyStructuredPlan({tasks:[{date,title:"Nachb. Klausur ZR",minutes:180}],klausuren:[{date,label:"ZR",area:"zr"}]},date);
  assert.equal(applied.tasksCreated,1);
  assert.equal(getTasks().find(task=>task.title==="Nachb. Klausur ZR")?.date,"2026-11-03");
});

test("switching a planned exam to a completed sketch updates that task", () => {
  setup(); const completedDate = localDate(); addTask({date:completedDate,title:"Fall",linkedKlausurId:"case",durationMinutes:300,source:"manual"}); const id=getTasks()[0].id;
  markKlausurWritten({id:"case",topicIds:[]},{date:completedDate,rating:3,klausurMode:"read",taskId:id,validLeafIds:new Set()});
  assert.equal(getTasks().length,1); assert.equal(getTasks()[0].durationMinutes,120); assert.equal(getTasks()[0].done,true);
});

test("two distinct same-named profile appointments keep distinct slots", () => {
  const storage=setup(); const settings=getOnboarding();
  const ag={id:"a",label:"AG",day:"Montag",frequency:"wöchentlich",durationHours:4,prepHours:0,postHours:0,startDate:"",endDate:""};
  storage.setItem(STORAGE_KEYS.onboarding,JSON.stringify({...settings,ags:[ag,{...ag,id:"b"}]}));
  materializeRecurringTermine(date,date); materializeRecurringTermine(date,date);
  assert.equal(getTasks().length,2); assert.equal(computeDayBudget(getTasks(),0).totalH,8);
});

test("missed plan content is carried forward while historical and fixed work stays unchanged", () => {
  setup(); const settings = getOnboarding();
  const missed = task("missed", 180, { date: "2026-10-30", contentSummary: "Eigene Notiz" });
  const done = task("done", 90, { date: "2026-10-30", done: true });
  const fixed = task("fixed", 240, { date: "2026-10-30", title: "AG Zivil (4h)" });
  const manual = task("manual", 90, { date: "2026-10-30", source: "manual" });
  const result = rebalanceTasks([missed, done, fixed, manual], [], { ...settings, vacationDates: [date] }, date, "2026-11-03");
  assert.deepEqual(result.tasks.find(item => item.id === missed.id), { ...missed, date: "2026-11-03", deferred: false, rescheduledFrom: missed.date });
  for (const unchanged of [done, fixed, manual]) assert.deepEqual(result.tasks.find(item => item.id === unchanged.id), unchanged);
  assert.deepEqual(rebalanceTasks(result.tasks, [], settings, date, "2026-11-03").tasks, result.tasks);
});

test("a replacement plan retains overflow, its notes and identity, and undo restores it", () => {
  const storage = setup();
  const backlog = task("backlog", 480, { deferred: true, contentSummary: "Noch zu bearbeiten" });
  storage.setItem(STORAGE_KEYS.tasks, JSON.stringify([backlog]));
  const result = applyStructuredPlan({ tasks: [{ date, title: "Neuer Lernblock", minutes: 90 }], klausuren: [] }, date);
  assert.deepEqual(getTasks().find(item => item.id === backlog.id), backlog);
  assert.equal(result.deferred, 1);
  undoApply(result); assert.deepEqual(getTasks(), [backlog]);
});

test("replacing content preserves calendar references of completed and manually assigned exams", () => {
  const storage = setup();
  const slot = exam({ source: "plan", linkedKlausurId: "case" });
  const written = task("written", 300, { done: true, calendarEventId: slot.id, linkedKlausurId: "case", klausurMode: "written", contentSummary: "Ergebnis" });
  storage.setItem(STORAGE_KEYS.tasks, JSON.stringify([written]));
  storage.setItem(STORAGE_KEYS.calendar, JSON.stringify([slot]));
  const result = applyStructuredPlan({ tasks: [{ date, title: "Wiederholung", minutes: 90 }], klausuren: [{ date, label: "Weitere Klausur", area: "zr" }] }, date);
  assert.deepEqual(getTasks().find(item => item.id === written.id), written);
  assert.deepEqual(getCalendarEvents(), [slot]);
  assert.equal(result.klausurenSkipped, 1);
  assert.equal(computeDayBudget(getTasksForDate(date), getCalendarEvents()).totalH, 6.5);
  undoApply(result); assert.deepEqual(getCalendarEvents(), [slot]);
});

test("AI daily budget retains calendar slots referenced by fixed tasks", () => {
  const storage = setup();
  const today = localDate();
  storage.setItem(STORAGE_KEYS.calendar, JSON.stringify([exam({ date: today, source: "plan" })]));
  storage.setItem(STORAGE_KEYS.tasks, JSON.stringify([task("slot-reference", 90, { date: today, calendarEventId: "exam" })]));
  const line = buildContextFor(["dailyBudget"]).split("\n").find(line => line.startsWith(today))!;
  assert.match(line, /6\.5h belegt/);
});

test("missed work never moves to the exam day or later, and completed history stays intact", () => {
  setup(); const settings = { ...getOnboarding(), examDate: date };
  const missed = task("missed", 90, { date: "2026-10-30" });
  const done = task("done", 90, { date: "2026-10-30", done: true });
  const result = rebalanceTasks([missed, done], [], settings, date, "2026-11-03");
  assert.deepEqual(result.tasks.find(item => item.id === missed.id), { ...missed, deferred: true });
  assert.deepEqual(result.tasks.find(item => item.id === done.id), done);
  assert.equal(autoTopicCount(date, [], [], settings, null, date), 0);
});
