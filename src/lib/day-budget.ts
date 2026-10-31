import type { DailyTask, OnboardingData } from "./store";
import type { CalendarEvent } from "./types";
import { addDays, parseISO } from "date-fns";
import { isDateOnly, localDate } from "./dates";

export const DEFAULT_DAILY_HOURS = 7;
type BudgetTask = Pick<DailyTask, "title" | "durationMinutes"> & Partial<DailyTask>;

export function dailyHours(settings: Pick<OnboardingData, "maxDailyHours">): number {
  const hours = settings.maxDailyHours;
  return typeof hours === "number" && Number.isFinite(hours) && hours >= 1 && hours <= 10 ? hours : DEFAULT_DAILY_HOURS;
}
export function isSketchTask(task: BudgetTask): boolean {
  return task.klausurMode === "read" || /^Skizze\b/i.test(task.title);
}
export function isWrittenTask(task: BudgetTask): boolean {
  return !isSketchTask(task) && (task.klausurMode === "written" || !!task.linkedKlausurId
    || ((task.durationMinutes ?? 0) >= 240 && /klausur.*schreib|vollklausur|^(?:ZR|SR|ÖffR)[- ]Klausur/i.test(task.title)));
}
/** One duration rule for the UI, scheduler, tracking and AI context. */
export function taskMinutes(task: BudgetTask): number {
  if (typeof task.durationMinutes === "number" && Number.isFinite(task.durationMinutes) && task.durationMinutes > 0) return Math.round(task.durationMinutes);
  const match = task.title.match(/\((\d+(?:[.,]\d+)?)\s*h\)/i);
  if (match && Number(match[1].replace(",", ".")) > 0) return Math.round(Number(match[1].replace(",", ".")) * 60);
  return isSketchTask(task) ? 120 : isWrittenTask(task) ? 300 : 90;
}
export function isTerminTitle(title: string): boolean {
  // Exam review is learning content, not a generated AG/Rep appointment.
  if (/^(Vorb\.|Nachb\.).*Klausur/i.test(title)) return false;
  // A duration alone does not turn a learning task into an appointment.
  return /^(Vorb\.|Nachb\.|AG\b|Lerngruppe\b|KISS\b|Rep\b|Repetitorium\b|Anki\b)/i.test(title);
}
export function isFixedTask(task: BudgetTask): boolean {
  return !!task.calendarEventId || /^(ag|rep|lerngruppe|sonstiges)\|/.test(task.recurringKey ?? "") || isTerminTitle(task.title);
}
export function eventsOnDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  const weekday = parseISO(date).getDay();
  return events.filter(event => event.date === date || (event.recurring && event.date <= date && event.recurringDay === weekday));
}
export function isStudyFreeDay(date: string, settings: Pick<OnboardingData, "freeDayPerWeek" | "vacationDates">, events: CalendarEvent[]): boolean {
  const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  return weekdays[parseISO(date).getDay()] === settings.freeDayPerWeek || settings.vacationDates.includes(date)
    || eventsOnDate(events, date).some(event => event.eventType === "frei" || event.eventType === "urlaub");
}
/** Onboarding seminars block their entire date range, even without calendar copies. */
export function planningEvents(events: CalendarEvent[], settings: OnboardingData): CalendarEvent[] {
  const result = [...events];
  for (const seminar of settings.kaiserSeminare) {
    if (!isDateOnly(seminar.date)) continue;
    const days = Math.min(30, Math.max(1, Math.round(seminar.durationDays) || 1));
    for (let i = 0; i < days; i++) {
      const date = localDate(addDays(parseISO(seminar.date), i));
      if (eventsOnDate(result, date).some(event => event.eventType === "kaiser")) continue;
      result.push({ id: `seminar-${seminar.date}-${i}-${seminar.topic}`, date, eventType: "kaiser", label: seminar.topic || "Kaiserseminar", recurring: false, durationMinutes: dailyHours(settings) * 60 });
    }
  }
  return result;
}
export interface DayBudget {
  totalH: number; reserveH: number; sketchCount: number; shown: number;
  remainingMinutes: number; overloadH: number; unassignedExamCount: number;
}
/** Concrete exams occupy their calendar slots; they are never charged twice. */
export function computeDayBudget(tasks: BudgetTask[], events: CalendarEvent[] | number, opts?: { suppressReserve?: boolean; maxHours?: number }): DayBudget {
  const active = tasks.filter(task => !task.deferred);
  const maxMinutes = (opts?.maxHours ?? DEFAULT_DAILY_HOURS) * 60;
  const examCount = typeof events === "number" ? events : events.filter(event => event.eventType === "klausur" || event.eventType === "probeexamen").length;
  const writtenCount = active.filter(isWrittenTask).length;
  const written = active.filter(isWrittenTask);
  let unassignedExamCount = Math.max(0, examCount - writtenCount);
  if (Array.isArray(events)) {
    unassignedExamCount = 0;
    const slots = events.filter(event => event.eventType === "klausur" || event.eventType === "probeexamen").sort((a, b) => Number(!!b.linkedKlausurId) - Number(!!a.linkedKlausurId));
    for (const event of slots) {
      const index = written.findIndex(task => task.calendarEventId === event.id || (!event.linkedKlausurId || task.linkedKlausurId === event.linkedKlausurId));
      if (index < 0) unassignedExamCount++; else written.splice(index, 1);
    }
  }
  let minutes = active.reduce((sum, task) => sum + taskMinutes(task), 0) + unassignedExamCount * 300;
  if (Array.isArray(events)) {
    // Match calendar appointments to materialized tasks one-to-one by label/type.
    const remainingTasks = active.filter(isFixedTask);
    for (const event of events) {
      if (["frei", "urlaub", "klausur", "probeexamen"].includes(event.eventType)) continue;
      const index = remainingTasks.findIndex(task => !/^(Vorb\.|Nachb\.)/.test(task.title)
        && (task.title.startsWith(event.label) || (/^(AG|Rep|Repetitorium)$/i.test(event.label.trim()) && task.recurringKey?.startsWith(`${event.eventType}|`))));
      if (index >= 0) { remainingTasks.splice(index, 1); continue; }
      const defaults = { ag: 240, rep: 240, kaiser: maxMinutes, sport: 60 };
      minutes += typeof event.durationMinutes === "number" && Number.isFinite(event.durationMinutes) && event.durationMinutes > 0
        ? event.durationMinutes : (defaults[event.eventType as keyof typeof defaults] ?? 0);
    }
  }
  const sketchMinutes = active.filter(isSketchTask).reduce((sum, task) => sum + taskMinutes(task), 0);
  const desiredReserve = opts?.suppressReserve || examCount > 0 || writtenCount > 0 ? 0 : Math.max(0, 240 - sketchMinutes);
  const sketchCount = Math.floor(Math.max(0, Math.min(desiredReserve, maxMinutes - minutes)) / 120);
  const reserveH = sketchCount * 2;
  return { totalH: minutes / 60, reserveH, sketchCount, shown: minutes / 60 + reserveH,
    remainingMinutes: Math.max(0, maxMinutes - minutes), overloadH: Math.max(0, minutes - maxMinutes) / 60, unassignedExamCount };
}
export function sketchCountLabel(count: number): string {
  return count === 1 ? "1 Klausur" : `${count} Klausuren`;
}
