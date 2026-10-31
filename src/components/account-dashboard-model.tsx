import type { DailyTask } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { eventsOnDate } from "@/lib/day-budget";
import { scheduleValues, type ScheduleView } from "@/lib/learning/schedule-contract";

/** A calendar assignment is evidence; catalogue order alone is not a recommendation. */
export function accountDashboardCases(view: ScheduleView, date: string) {
  const tasks = scheduleValues<DailyTask>(view, "task").filter(t => t.date === date && !t.deferred);
  const ids = new Set<string>();
  for (const task of tasks) if (task.linkedKlausurId) ids.add(task.linkedKlausurId);
  for (const event of eventsOnDate(scheduleValues<CalendarEvent>(view, "calendar-event"), date)) {
    if (event.linkedKlausurId) ids.add(event.linkedKlausurId);
  }
  return [...ids].map(id => ({ id, klausur: view.klausuren.find(k => k.id === id) ?? null }));
}
