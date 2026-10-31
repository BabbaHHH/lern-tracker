"use client";
import { useState } from "react";
import Link from "next/link";
import { getKlausuren } from "@/lib/store";
import { linkCalendarKlausur } from "@/lib/klausur-calendar";
import type { CalendarEvent } from "@/lib/types";
import { Button } from "./ui/button";

export function KlausurCalendarLink({ event, onChange, completed = false }: { event: CalendarEvent; onChange: () => void; completed?: boolean }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState(""); const [error, setError] = useState("");
  const cases = open ? getKlausuren().filter(exam => `${exam.title} ${exam.id} ${exam.source}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).slice(0, 60) : [];
  return <div className="mt-1">
    {event.linkedKlausurId && <Link href={`/klausuren?case=${encodeURIComponent(event.linkedKlausurId)}`} className="text-xs underline">Zugeordnete Klausur öffnen</Link>}
    {!completed && !event.recurring && <Button size="sm" variant="ghost" className="text-xs h-7 px-1" onClick={() => setOpen(previous => !previous)}>{event.linkedKlausurId ? "Zuordnung ändern" : "Klausur zuordnen"}</Button>}
    {open && <div className="border p-2 mt-1 bg-white space-y-2">
      <input aria-label={`Klausur suchen für ${event.date}`} placeholder="Titel oder Klausurnummer suchen" className="border p-2 text-xs w-full" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label={`Klausur zuordnen für ${event.date}`} className="border p-2 text-xs w-full" value="" onChange={eventChange => {
        if (!eventChange.target.value) return;
        try { linkCalendarKlausur(event.id, eventChange.target.value); setOpen(false); setError(""); onChange(); window.dispatchEvent(new Event("lerntracker:tasks-changed")); }
        catch (error) { setError(error instanceof Error ? error.message : "Zuordnung fehlgeschlagen."); }
      }}><option value="">Klausur wählen…</option>{cases.map(exam => <option key={exam.id} value={exam.id}>{exam.area.toUpperCase()} · {exam.id} · {exam.title}</option>)}</select>
      {!cases.length && <p className="text-xs text-slate-500">Keine passenden Klausuren. Lege sie zuerst in der Klausurdatenbank an oder importiere deine Sammlung.</p>}
    </div>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}
