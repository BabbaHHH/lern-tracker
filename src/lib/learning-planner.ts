import { addDays, parseISO } from "date-fns";
import { computeDayBudget, dailyHours, eventsOnDate, isFixedTask, isStudyFreeDay } from "./day-budget";
import { isDateOnly, localDate } from "./dates";
import type { DailyTask, OnboardingData, PlanAppliedRange } from "./store";
import type { CalendarEvent } from "./types";

export function planningEnd(start: string, settings: OnboardingData, days = 90): string {
  const end = localDate(addDays(parseISO(start), days));
  return isDateOnly(settings.examDate) && settings.examDate > start
    ? [end, localDate(addDays(parseISO(settings.examDate), -1))].sort()[0] : end;
}

/** Pure, deterministic repair. Fixed/manual/done work is never moved or hidden. */
export function rebalanceTasks(tasks: DailyTask[], events: CalendarEvent[], settings: OnboardingData, start: string, end: string, options?:{preserveSuggestions?:boolean;movableIds?:ReadonlySet<string>;movableAutoIds?:ReadonlySet<string>;planFirst?:boolean}) {
  const movable = (task: DailyTask) => !task.done && (task.source === "plan" || (task.source === "auto" && options?.movableAutoIds?.has(task.id))) && !isFixedTask(task)
    && isDateOnly(task.date) && task.date <= end && (!options?.movableIds || options.movableIds.has(task.id));
  const pending = tasks.filter(movable).sort((a, b) => (options?.planFirst ? Number(a.source === "auto")-Number(b.source === "auto") : 0) || a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || (options?.planFirst ? a.id.localeCompare(b.id) : 0));
  const kept = tasks.filter(task => !movable(task));
  // Auto suggestions yield to real tasks. Keep only suggestions that still fit;
  // do not discard any completed work.
  const suggestions = options?.preserveSuggestions?[]:kept.filter(task => task.source === "auto" && !task.done && task.date >= start && task.date <= end);
  const result = kept.filter(task => !suggestions.includes(task));
  const moved: string[] = [];
  const deferred: string[] = [];
  const maxHours = dailyHours(settings);
  const placementEnd = isDateOnly(settings.examDate)
    ? [end, localDate(addDays(parseISO(settings.examDate), -1))].sort()[0] : end;
  const fits = (task: DailyTask, date: string) => date <= placementEnd && !isStudyFreeDay(date, settings, events)
    && computeDayBudget([...result.filter(item => item.date === date && !item.deferred), { ...task, date, deferred: false }], eventsOnDate(events, date), { maxHours, suppressReserve: true }).overloadH === 0;
  for (const task of pending) {
    let date = task.date < start ? start : task.date;
    while (date <= placementEnd && !fits(task, date)) date = localDate(addDays(parseISO(date), 1));
    if (date <= placementEnd) {
      if (date !== task.date) moved.push(task.id);
      result.push({ ...task, date, deferred: false, rescheduledFrom: date !== task.date ? task.rescheduledFrom ?? task.date : task.rescheduledFrom });
    } else {
      result.push({ ...task, deferred: true });
      deferred.push(task.id);
    }
  }
  for (const task of suggestions) {
    // Manual/AI content takes precedence over generated filler.
    if (result.some(item => item.date === task.date && !item.deferred && !isFixedTask(item) && item.source !== "auto")) continue;
    if (fits(task, task.date)) result.push(task);
  }
  // Preserve storage order; only placement fields change.
  const byId = new Map(result.map(task => [task.id, task]));
  return { tasks: tasks.flatMap(task => byId.has(task.id) ? [byId.get(task.id)!] : []), moved, deferred };
}

export function autoTopicCount(date: string, tasks: DailyTask[], events: CalendarEvent[], settings: OnboardingData, range: PlanAppliedRange | null, today = localDate()): number {
  if (date < today || (isDateOnly(settings.examDate) && date >= settings.examDate)
    || isStudyFreeDay(date, settings, events) || (range && date >= range.start && date <= range.end)) return 0;
  const dayTasks = tasks.filter(task => task.date === date && !task.deferred);
  if (dayTasks.some(task => !isFixedTask(task) && !(task.done && task.source === "auto"))) return 0;
  const budget = computeDayBudget(dayTasks, eventsOnDate(events, date), { maxHours: dailyHours(settings) });
  // One or two core sprints come first. Optional sketches use only the capacity
  // left afterwards; a suggestion must never reserve time ahead of real work.
  return Math.max(0, Math.min(2 - dayTasks.filter(task => task.done && task.source === "auto").length, Math.floor(budget.remainingMinutes / 90)));
}
