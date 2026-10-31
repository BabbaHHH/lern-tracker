import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { eventsOnDate, isFixedTask, isWrittenTask, taskMinutes } from "./day-budget";
import { isDateOnly, localDate } from "./dates";
import type { DailyTask } from "./store";
import { ACTIVITY_LABELS, type CalendarEvent, type Klausur, type TrackingEntry } from "./types";

export interface CalendarExportInput { start: string; end: string; tasks: DailyTask[]; events: CalendarEvent[]; tracking: TrackingEntry[]; klausuren: Klausur[]; now?: Date }
export function escapeCalendarText(text: string): string { return text.replace(/\\/g, "\\\\").replace(/\r?\n|\r/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,"); }
/** RFC 5545: lines max 75 UTF-8 octets; never split a Unicode character. */
export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = []; let current = ""; let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { lines.push(current); current = " "; bytes = 1; }
    current += char; bytes += size;
  }
  lines.push(current); return lines.join("\r\n");
}

/** Snapshot export. Stable UIDs help consumers identify items, but re-import is
 * not guaranteed to replace them. Dates are all-day because the app has no times. */
export function buildCalendarIcs(input: CalendarExportInput): string {
  const { start, end, tasks, events, tracking, klausuren } = input;
  if (!isDateOnly(start) || !isDateOnly(end) || end < start || differenceInCalendarDays(parseISO(end), parseISO(start)) > 730) throw new Error("Bitte einen gültigen Exportzeitraum von höchstens zwei Jahren wählen.");
  const stamp = (input.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stex Tracker//Lernkalender//DE", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Stex Lernkalender"];
  const byCase = new Map(klausuren.map(exam => [exam.id, exam]));
  const coveredTracking = new Set<string>();
  const emit = (id: string, date: string, title: string, description: string) => {
    const until = localDate(addDays(parseISO(date), 1));
    lines.push("BEGIN:VEVENT", `UID:${encodeURIComponent(id)}@stex-tracker.local`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${until.replace(/-/g, "")}`, `SUMMARY:${escapeCalendarText(title)}`, `DESCRIPTION:${escapeCalendarText(description)}`, "CLASS:PRIVATE", "TRANSP:TRANSPARENT", "END:VEVENT");
  };
  for (let day = start; day <= end; day = localDate(addDays(parseISO(day), 1))) {
    const dayTasks = tasks.filter(task => task.date === day && !task.deferred);
    const dayTracking = tracking.filter(entry => entry.date === day);
    for (const task of dayTasks) {
      if (task.trackingEntryId) coveredTracking.add(task.trackingEntryId);
      const exam = task.linkedKlausurId ? byCase.get(task.linkedKlausurId) : undefined;
      emit(`task-${task.id}`, day, `${task.done ? "✓ " : ""}${task.title}`, `${task.done ? "Erledigt" : "Geplant"} · ${taskMinutes(task)} Minuten${task.isReview ? " · aktive Wiederholung" : ""}${exam ? `\nKlausur: ${exam.title} [${exam.id}] · ${task.klausurMode === "read" ? "gelesen/skizziert" : "geschrieben"}` : ""}`);
    }
    const unmatched = dayTasks.filter(isFixedTask);
    const written = dayTasks.filter(isWrittenTask);
    for (const event of eventsOnDate(events, day)) {
      if (["klausur", "probeexamen"].includes(event.eventType)) {
        const index = written.findIndex(task => task.calendarEventId === event.id || (!event.linkedKlausurId || task.linkedKlausurId === event.linkedKlausurId));
        if (index >= 0) { written.splice(index, 1); continue; }
        // Legacy exam records without a task still occupy their planned slot.
        const entry = dayTracking.find(entry => entry.activityType === "klausur" && entry.klausurMode !== "read" && !coveredTracking.has(entry.id) && (!event.linkedKlausurId || entry.klausurId === event.linkedKlausurId));
        if (entry) { coveredTracking.add(entry.id); const exam = entry.klausurId ? byCase.get(entry.klausurId) : undefined; emit(`event-${event.id}-${event.recurring ? day : "single"}`, day, `✓ ${event.label}`, `Geschrieben · ${entry.durationMinutes} Minuten${exam ? `\n${exam.title} [${exam.id}]` : ""}`); continue; }
      }
      const match = unmatched.findIndex(task => !/^(Vorb\.|Nachb\.)/.test(task.title) && (task.title.startsWith(event.label) || task.recurringKey?.startsWith(`${event.eventType}|`)));
      if (match >= 0) { unmatched.splice(match, 1); continue; }
      emit(`event-${event.id}-${event.recurring ? day : "single"}`, day, event.label, `Fester Termin${event.durationMinutes ? ` · ${event.durationMinutes} Minuten` : ""}${event.sourceDocument ? `\nQuelle: ${event.sourceDocument}` : ""}`);
    }
    for (const entry of dayTracking) {
      if (coveredTracking.has(entry.id)) continue;
      const exam = entry.klausurId ? byCase.get(entry.klausurId) : undefined;
      emit(`tracking-${entry.id}`, day, `✓ ${exam ? `${entry.klausurMode === "read" ? "Skizze" : "Klausur"}: ${exam.title}` : ACTIVITY_LABELS[entry.activityType]}`, `${entry.durationMinutes} Minuten${entry.rating ? ` · Bewertung ${entry.rating}/5` : ""}${entry.klausurId ? `\nKlausur-ID: ${entry.klausurId}` : ""}`);
    }
  }
  lines.push("END:VCALENDAR"); return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}
