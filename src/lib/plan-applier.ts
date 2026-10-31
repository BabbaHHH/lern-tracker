import {applyPlanWithAdapter,materializeRecurringWithAdapter,type PlanDataAdapter,type PlanningSnapshot,type StructuredPlan,type ApplyResult} from './plan-core';
export {parseStructuredPlan,stripJsonBlock} from './plan-core';
export type {PlanTask,PlanKlausur,PlanAppointment,StructuredPlan,ApplyResult} from './plan-core';
import { isDateOnly, localDate } from "./dates";

import {planningEvents} from "./day-budget";
import { autoTopicCount, planningEnd, rebalanceTasks } from "./learning-planner";
import { pickAutoSprintsForDate } from "./auto-picker";
import {studySuggestionKey} from "./study-phases";
import { reviewHistoryKey } from "./spaced-repetition";

import { restoreStorage } from "./storage-backup";
export { isTerminTitle } from "./day-budget";
// Parsed strukturierte Plan-Outputs aus Opus und schreibt sie in Tasks + Calendar.

import {
  addTask, getCalendarEvents,
  removeTask, getTasks, STORAGE_KEYS,
  getOnboarding, getTrackingEntries, getKlausuren, updateTask, getPlanAppliedRange, getAgWeekOverrides,
} from "@/lib/store";




// ─── Recurring Termine Materialisierung ──────────────────────────────────────



export function materializeRecurringTermine(start:string,end:string){return materializeRecurringWithAdapter(browserAdapter(),start,end);}

/**
 * Löscht alle plan-source Tasks im Range deren Titel mit dem Rep-Label beginnt
 * (Haupttask, Vorb./Nachb.). Genutzt beim Anwenden eines neuen Rep-Schedules
 * um saubere Re-Materialisierung zu ermöglichen (Option a aus dem UX-Design).
 * Erledigte Tasks (done=true) bleiben erhalten — die sind Historie.
 */
export function clearRepTasksForRelabel(repLabel: string, start: string, end: string): number {
  const all = getTasks();
  let removed = 0;
  const labelRegex = new RegExp(`^(Vorb\\. |Nachb\\. )?${repLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( | —|\\()`);
  for (const t of all) {
    if (t.date < start || t.date > end) continue;
    if (t.source !== "plan") continue;
    if (t.done) continue;
    if (!labelRegex.test(t.title)) continue;
    removeTask(t.id);
    removed++;
  }
  return removed;
}

// === Plan-Historie (letzte 3) ===

const HISTORY_KEY = STORAGE_KEYS.planHistory;
const MAX_HISTORY = 3;

export interface PlanHistoryEntry {
  id: string;
  createdAt: string;
  reply: string;
  structured: StructuredPlan | null;
}

export function savePlanToHistory(reply: string, structured: StructuredPlan | null): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: PlanHistoryEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      reply,
      structured,
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

export function getPlanHistory(): PlanHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function snapshot(): PlanningSnapshot {
  return { tasks: getTasks(), events: getCalendarEvents(), range: getPlanAppliedRange(), onboarding: getOnboarding() };
}
function writeSnapshot(state: PlanningSnapshot): void {
  restoreStorage(localStorage, [[STORAGE_KEYS.tasks, state.tasks], [STORAGE_KEYS.calendar, state.events], [STORAGE_KEYS.planAppliedRange, state.range], [STORAGE_KEYS.onboarding, state.onboarding]]);
}

/** Both pages use this same bounded, idempotent planning pass. */
export function prepareLearningDays(dates: string[], today = localDate()) {
  const settings = getOnboarding();
  const end = planningEnd(today, settings);
  materializeRecurringTermine(today, end);
  const events = planningEvents(getCalendarEvents(), settings);
  const current = getTasks();
  const historyKey = reviewHistoryKey(getTrackingEntries(), today);
  const suggestionKey = (date: string) => studySuggestionKey(date, settings) + historyKey;
  const fresh = current.filter(task => task.source !== "auto" || task.done || task.date < today
    || (task.studySuggestionKey?.startsWith(studySuggestionKey(task.date, settings)) && (!dates.includes(task.date) || task.studySuggestionKey === suggestionKey(task.date))));
  const repaired = rebalanceTasks(fresh, events, settings, today, end);
  if (JSON.stringify(repaired.tasks) !== JSON.stringify(getTasks())) restoreStorage(localStorage, [[STORAGE_KEYS.tasks, repaired.tasks]]);
  for (const date of dates) {
    if (!isDateOnly(date) || date < today || date > end) continue;
    const count = autoTopicCount(date, getTasks(), events, settings, getPlanAppliedRange(), today);
    if (count <= 0) continue;
    for (const { topic, title, isReview } of pickAutoSprintsForDate(date, count, today)) addTask({ date, title, linkedTopicId: topic.id, isReview, durationMinutes: 90, source: "auto", studySuggestionKey: suggestionKey(date) });
  }
  return repaired;
}

function browserAdapter():PlanDataAdapter{return {mode:'browser',getTasks,getCalendarEvents,getOnboarding,getKlausuren,getAgWeekOverrides,addTask,updateTask,removeTask,snapshot,writeSnapshot,newId:()=>crypto.randomUUID(),now:()=>new Date().toISOString(),setOnboarding:value=>restoreStorage(localStorage,[[STORAGE_KEYS.onboarding,value]])};}
export function applyStructuredPlan(input:StructuredPlan,today=localDate()):ApplyResult{return applyPlanWithAdapter(input,browserAdapter(),today);}

/** Refuse to overwrite later edits; restore the previous plan, including deleted work. */
export function undoApply(applied: ApplyResult): void {
  if (JSON.stringify(snapshot()) !== JSON.stringify(applied.after)) throw new Error("Der Plan wurde inzwischen geändert. Rückgängig würde diese Änderungen überschreiben; bitte die Aufgaben einzeln anpassen.");
  writeSnapshot(applied.before);
}
