"use client";

import { useState } from "react";
import { Check, Plus, Pencil } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { currentDate, localDate } from "@/lib/dates";
import { eventsOnDate, computeDayBudget } from "@/lib/day-budget";
import type { CalendarEvent } from "@/lib/types";
import type { DailyTask } from "@/lib/store";
import { scheduleValues } from "@/lib/learning/schedule-contract";
import type { AccountScheduleData } from "./account-schedule";
import { TodayProgram } from "./today-program";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function AccountDashboardProgram({ data }: { data: AccountScheduleData }) {
  const [open, setOpen] = useState(false);
  const today = localDate();
  const tasks = scheduleValues<DailyTask>(data.view, "task").filter(t => t.date === today && !t.deferred);
  const events = eventsOnDate(scheduleValues<CalendarEvent>(data.view, "calendar-event"), today);
  const maxHours = data.view.settings.maxDailyHours ?? 7;
  const budget = computeDayBudget(tasks, events, { maxHours, suppressReserve: true });
  return <>
    <section aria-label="Tagesprogramm" className="border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0"><div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">Heute · {format(currentDate(), "EEEE, d. MMMM", { locale: de })}</div><h2 className="font-serif text-xl text-slate-900 leading-tight mt-1">Tagesprogramm</h2></div>
        <span className="font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-2 py-1 border border-slate-200 text-slate-500 shrink-0">{budget.totalH.toFixed(1)} / {maxHours}h</span>
      </header>
      {budget.overloadH > 0 && <p role="status" className="px-6 py-3 text-sm text-amber-800 bg-amber-50">Die geplante Dauer überschreitet deine Tagesgrenze. Feste Termine bleiben erhalten.</p>}
      <ul className="divide-y divide-slate-200">{tasks.map(task => <li key={task.id} className="px-6 py-4 flex items-center gap-3">
        <button aria-label={`${task.done ? "Bearbeitung ansehen" : "Bearbeitung eintragen"}: ${task.title}`} disabled={data.busy} onClick={() => setOpen(true)} className="h-6 w-6 border border-slate-300 shrink-0 flex items-center justify-center hover:border-accent-600 disabled:opacity-50">{task.done && <Check className="h-4 w-4" />}</button>
        <div className="flex-1 min-w-0"><p className={`font-serif text-[15px] break-words ${task.done ? "line-through text-slate-400" : "text-slate-900"}`}>{task.title}</p>{task.durationMinutes && <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-slate-500 mt-1">{task.durationMinutes} Minuten</p>}</div>
      </li>)}{events.filter(e => !tasks.some(t => t.calendarEventId === e.id)).map(event => <li key={event.id} className="px-6 py-3 text-sm text-slate-600">{event.label} · {event.durationMinutes ? `${event.durationMinutes} Min.` : "Dauer offen"}</li>)}</ul>
      {!tasks.length && !events.length && <p className="px-6 py-5 font-serif text-[15px] text-slate-500">Für heute sind noch keine Aufgaben oder Termine gespeichert.</p>}
      <footer className="border-t border-slate-200 px-6 py-3 flex flex-wrap gap-4"><button disabled={data.busy} onClick={() => setOpen(true)} className="inline-flex items-center gap-2 font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-600 hover:text-slate-900"><Plus className="h-3.5 w-3.5" />Aufgabe hinzufügen</button><button disabled={data.busy} onClick={() => setOpen(true)} className="inline-flex items-center gap-2 font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-600 hover:text-slate-900"><Pencil className="h-3.5 w-3.5" />Tagesprogramm bearbeiten</button></footer>
    </section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="rounded-none border border-slate-200 shadow-none sm:max-w-3xl max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle className="font-serif text-xl font-normal">Tagesprogramm bearbeiten</DialogTitle></DialogHeader><TodayProgram account={data} /></DialogContent></Dialog>
  </>;
}
