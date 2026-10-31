import { getCalendarEvents, getKlausuren, getTasks, STORAGE_KEYS } from "./store";
import { restoreStorage } from "./storage-backup";
import type { CalendarEvent, TrackingEntry } from "./types";
import type { DailyTask } from "./store";

/** Explicit assignments must never be checked off by a different exam. */
export function completedExamSlots(events: CalendarEvent[], tracking: TrackingEntry[], date: string): Set<string> {
  const available = tracking.filter(entry => entry.date === date && entry.activityType === "klausur" && entry.klausurMode !== "read");
  const completed = new Set<string>();
  const slots = events.filter(event => event.eventType === "klausur" || event.eventType === "probeexamen")
    .sort((a, b) => Number(!!b.linkedKlausurId) - Number(!!a.linkedKlausurId));
  for (const event of slots) {
    const index = available.findIndex(entry => !event.linkedKlausurId || entry.klausurId === event.linkedKlausurId);
    if (index >= 0) { available.splice(index, 1); completed.add(event.id); }
  }
  return completed;
}

/** Link a planned slot and its concrete case in one browser transaction. */
export function linkCalendarKlausur(eventId: string, klausurId: string): void {
  const events = getCalendarEvents(); const tasks = getTasks();
  const event = events.find(event => event.id === eventId);
  const exam = getKlausuren().find(exam => exam.id === klausurId);
  if (!event || !exam || !["klausur", "probeexamen"].includes(event.eventType)) throw new Error("Termin oder Klausur nicht gefunden.");
  if (event.recurring) throw new Error("Bitte wiederkehrende Kurstermine zunächst als einzelne Klausurtage anlegen.");
  const existing = tasks.find(task => task.calendarEventId === eventId)
    ?? tasks.find(task => task.date === event.date && task.linkedKlausurId === klausurId && task.klausurMode !== "read" && !task.deferred);
  if (existing?.done && existing.linkedKlausurId !== klausurId) throw new Error("Eine erledigte Klausurzuordnung kann nicht geändert werden.");
  const assigned: DailyTask = { ...existing, id: existing?.id ?? crypto.randomUUID(), date: event.date, title: exam.title, done: existing?.done ?? false, linkedKlausurId: exam.id, linkedTopicIds: exam.topicIds, calendarEventId: event.id, klausurMode: "written", durationMinutes: 300, source: existing?.source ?? "plan", createdAt: existing?.createdAt ?? new Date().toISOString() };
  const nextTasks = existing ? tasks.map(task => task.id === existing.id ? assigned : task) : [assigned, ...tasks];
  restoreStorage(localStorage, [[STORAGE_KEYS.calendar, events.map(item => item.id === eventId ? { ...item, linkedKlausurId: exam.id } : item)], [STORAGE_KEYS.tasks, nextTasks]]);
}
