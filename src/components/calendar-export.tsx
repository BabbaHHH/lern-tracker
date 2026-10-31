"use client";
import { currentDate } from "@/lib/dates";
import { useState,useRef,useEffect } from "react";
import { addDays } from "date-fns";
import { Button } from "./ui/button";
import { getCalendarEvents, getKlausuren, getOnboarding, getTasks, getTrackingEntries } from "@/lib/store";
import { materializeRecurringTermine } from "@/lib/plan-applier";
import { planningEvents } from "@/lib/day-budget";
import { localDate } from "@/lib/dates";
import { buildCalendarIcs } from "@/lib/calendar-export";

export function CalendarExport({accountInput,accountContext}:{accountInput?:Omit<import("@/lib/calendar-export").CalendarExportInput,"start"|"end">;accountContext?:import("@/lib/learning/progress-contract").LearningAccount}={}) {
  const [start, setStart] = useState(() => localDate(addDays(currentDate(), -14)));
  const [end, setEnd] = useState(() => localDate(addDays(currentDate(), 90)));
  const [message, setMessage] = useState("");
  const generation=useRef(0);
  useEffect(()=>()=>{generation.current++;},[]);
  async function download() {
    const epoch=generation.current;
    try {
      // Validate before a materialization can change storage.
      buildCalendarIcs({ start, end, tasks: [], events: [], tracking: [], klausuren: [] });
      if(!accountInput)materializeRecurringTermine(start, end);
      let confirmed=accountInput;
      if(accountInput){
        const response=await fetch('/api/learning/schedule',{credentials:'same-origin',cache:'no-store'});
        const snapshot=await response.json();
        if(epoch!==generation.current)return;
        if(!response.ok||!accountContext||snapshot.account?.userId!==accountContext.userId||snapshot.account?.accessGeneration!==accountContext.accessGeneration||snapshot.account?.sessionContext!==accountContext.sessionContext)throw new Error('Die Anmeldung hat sich geändert. Bitte den Kalender neu laden.');
        const {scheduleValues}=await import('@/lib/learning/schedule-contract');
        confirmed={tasks:scheduleValues(snapshot,'task'),events:scheduleValues(snapshot,'calendar-event'),tracking:scheduleValues(snapshot,'tracking-entry'),klausuren:snapshot.klausuren};
        if(epoch!==generation.current)return;
      }
      const text = buildCalendarIcs(confirmed?{...confirmed,start,end}:{ start, end, tasks: getTasks(), events: planningEvents(getCalendarEvents(), getOnboarding()), tracking: getTrackingEntries(), klausuren: getKlausuren() });
      const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `stex-lernkalender-${start}-${end}.ics`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Kalenderdatei erstellt. Importiere sie in einen eigenen Kalender „Stex“, damit du einen alten Stand vollständig ersetzen kannst.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export fehlgeschlagen."); }
  }
  return <details className="border border-slate-200 bg-white p-4 mb-4">
    <summary className="cursor-pointer text-sm font-medium">In Apple-, Google- oder Outlook-Kalender exportieren</summary>
    <p className="text-xs text-slate-600 mt-3">Die ICS-Datei enthält Aufgaben, Termine und erledigte Lerneinheiten als ganztägige Einträge. Sie ist eine Momentaufnahme. Ein erneuter Import aktualisiert bestehende Einträge je nach Kalender nicht zuverlässig; ersetze dafür den Inhalt eines eigenen Stex-Kalenders. Ein abonnierbarer Kalender ist für später vorgesehen.</p>
    <div className="flex flex-wrap items-end gap-3 mt-3">
      <label className="text-xs">Von<input aria-label="Kalenderexport von" type="date" className="block border p-2" value={start} onChange={event => setStart(event.target.value)} /></label>
      <label className="text-xs">Bis<input aria-label="Kalenderexport bis" type="date" className="block border p-2" value={end} onChange={event => setEnd(event.target.value)} /></label>
      <Button variant="outline" onClick={download}>ICS-Datei herunterladen</Button>
    </div>
    {message && <p role="status" className="text-xs mt-3">{message}</p>}
  </details>;
}
