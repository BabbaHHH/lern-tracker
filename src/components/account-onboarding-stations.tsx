"use client";

import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AREA_LABELS } from "@/lib/types";
import { isDateOnly, localDate } from "@/lib/dates";
import { createBerlinStudyPhases, PERSPECTIVE_LABELS, studyPhaseErrors, type StudyPhase, type StudyPhaseSettings } from "@/lib/study-phases";

export function AccountOnboardingStations({ settings, onSave, accountMode=true, disabled=false }: { settings: StudyPhaseSettings; onSave: (settings: StudyPhaseSettings) => void | Promise<void>; accountMode?:boolean;disabled?:boolean }) {
  const [start, setStart] = useState(settings.refStartDate ?? "");
  const [phases, setPhases] = useState<StudyPhase[]>(studyPhaseErrors(settings.studyPhases ?? []).length ? [] : settings.studyPhases ?? []);
  const [mode, setMode] = useState(settings.studyPlanningMode ?? "station");
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const errors = studyPhaseErrors(phases);
  const sorted = [...phases].sort((a, b) => a.start.localeCompare(b.start));
  const gaps = errors.length ? [] : sorted.slice(1).filter((phase, i) => phase.start > localDate(addDays(parseISO(sorted[i].end), 1)));
  const dirty = start !== (settings.refStartDate ?? "") || mode !== (settings.studyPlanningMode ?? "station") || JSON.stringify(phases) !== JSON.stringify(settings.studyPhases ?? []);
  function edit(id: string, patch: Partial<StudyPhase>) {
    setPhases(previous => previous.map(phase => phase.id === id ? { ...phase, ...patch } : phase));
    setMessage("");
  }
  async function save() {
    try {
      await onSave({ refStartDate: start, studyPhasesEnabled: mode === "station", studyPlanningMode: mode, studyPhases: sorted });
      setPhases(sorted);
      setSaveError("");
      setMessage(accountMode?"Stationsplan gespeichert.":"Stationsplan gespeichert. Die automatischen Sprints werden beim Öffnen des Tages- oder Wochenplans angepasst.");
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Speichern fehlgeschlagen."); }
  }
  const dateLabel = (date: string) => isDateOnly(date) ? format(parseISO(date), "dd.MM.yy") : "Datum offen";
  return (
    <Card id="stationsplan">
      <CardHeader><CardTitle>{accountMode?"Stationsabschnitte":"Stationsplan & Sprints"}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">{accountMode?"Hier kannst du deine Stationsabschnitte prüfen und bearbeiten. Deine privaten Originale verwaltest du unter Meine Dokumente. Automatische Auswertung und neue KI-Planung sind im Pilot geschlossen.":<>Der Lernplan folgt standardmäßig deinem persönlichen Stationsplan, den du im Schritt „Dokumente“ hochlädst. Die erkannten Abschnitte werden bei der Planübernahme gespeichert. Hier kannst du sie anschließend prüfen oder ändern. Der Klausurenkurs läuft während aller Stationen weiter.</>}</p>
        <label className="block text-sm">Planungsgrundlage
          <select aria-label="Planungsgrundlage" className="mt-1 w-full rounded-md border px-3 py-2" value={mode} onChange={event => { setMode(event.target.value as "station" | "custom"); setMessage(""); }}>
            <option value="station">Persönlicher Stationsplan (Standard)</option>
            <option value="custom">Abweichender Lernplan nach meinem Planungswunsch</option>
          </select>
        </label>
        <details><summary className="text-sm cursor-pointer">Abschnitte manuell bearbeiten / Beispielvorlage</summary>
        <div className="flex items-end flex-wrap gap-3">
          <div>
            <label htmlFor="ref-start" className="text-sm font-medium block mb-1">Startmonat des Referendariats</label>
            <Input id="ref-start" type="month" value={start.slice(0, 7)} onChange={event => { setStart(event.target.value ? `${event.target.value}-01` : ""); setMessage(""); }} />
          </div>
          <Button type="button" variant="outline" disabled={!isDateOnly(start)} onClick={() => {
            setPhases(createBerlinStudyPhases(start)); setMessage("Vorlage geladen. Zeiträume prüfen und Stationsplan speichern.");
          }}>Berliner Beispielplan laden</Button>
        </div>
        <p className="text-xs text-slate-500">Vorlage nach dem mitgebrachten 24-Monats-Plan für eine Februar-Einstellung: 4 Monate Zivil, 3½ Monate Straf, 3½ Monate Verwaltung. Die anwaltlichen AG-Blöcke sind näherungsweise verteilt. Bei anderem Startmonat wird die Vorlage verschoben. Alle Termine bitte mit deinem Plan abgleichen; der Examenstermin wird separat eingetragen.</p>
        <div className="space-y-2">
          {phases.map((phase, index) => (
            <details key={phase.id} className="border border-slate-200 rounded-md p-3">
              <summary className="cursor-pointer text-sm leading-relaxed">
                <span className="font-medium">{index + 1}. {phase.label || "Neuer Abschnitt"}</span>
                <span className="block pl-4 text-xs text-slate-500">{dateLabel(phase.start)} – {dateLabel(phase.end)} · {PERSPECTIVE_LABELS[phase.perspective]} · {phase.focus === "mixed" ? "Alle Rechtsgebiete" : AREA_LABELS[phase.focus]}</span>
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                <label className="text-xs sm:col-span-2">Bezeichnung
                  <Input aria-label={`Abschnitt ${index + 1}: Bezeichnung`} value={phase.label} maxLength={120} onChange={event => edit(phase.id, { label: event.target.value })} />
                </label>
                <label className="text-xs">Beginn
                  <Input aria-label={`Abschnitt ${index + 1}: Beginn`} type="date" value={phase.start} onChange={event => edit(phase.id, { start: event.target.value })} />
                </label>
                <label className="text-xs">Ende (einschließlich)
                  <Input aria-label={`Abschnitt ${index + 1}: Ende`} type="date" value={phase.end} onChange={event => edit(phase.id, { end: event.target.value })} />
                </label>
                <label className="text-xs">Schwerpunkt
                  <select aria-label={`Abschnitt ${index + 1}: Schwerpunkt`} className="w-full rounded-md border px-3 py-2 text-sm" value={phase.focus} onChange={event => edit(phase.id, { focus: event.target.value as StudyPhase["focus"] })}>
                    <option value="zr">Zivilrecht</option><option value="sr">Strafrecht</option><option value="oeffr">Öffentliches Recht</option><option value="mixed">Alle Rechtsgebiete</option>
                  </select>
                </label>
                <label className="text-xs">Perspektive
                  <select aria-label={`Abschnitt ${index + 1}: Perspektive`} className="w-full rounded-md border px-3 py-2 text-sm" value={phase.perspective} onChange={event => edit(phase.id, { perspective: event.target.value as StudyPhase["perspective"] })}>
                    {Object.entries(PERSPECTIVE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-red-700 mt-2" onClick={() => { setPhases(previous => previous.filter(item => item.id !== phase.id)); setMessage(""); }}>Abschnitt entfernen</Button>
            </details>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={phases.length >= 40} onClick={() => {
          const last = sorted.at(-1);
          const next = last && isDateOnly(last.end) ? localDate(addDays(parseISO(last.end), 1)) : start;
          setPhases(previous => [...previous, { id: crypto.randomUUID(), label: "Eigener Abschnitt", start: next, end: next, focus: "mixed", perspective: "mixed" }]); setMessage("");
        }}>Abschnitt hinzufügen</Button>
        {errors.length > 0 && <ul className="text-sm text-red-700 list-disc pl-5" role="alert">{errors.map((error, i) => <li key={i}>{error}</li>)}</ul>}
        {!phases.length && <p className="text-sm text-slate-600">{accountMode?"Noch keine Abschnitte gespeichert. Du kannst sie hier manuell ergänzen.":"Noch keine Abschnitte übernommen. Lade deinen persönlichen Plan im Schritt „Dokumente“ hoch."}</p>}
        {gaps.length > 0 && <p className="text-sm text-amber-800">Zwischen {gaps.length} Abschnitten liegen freie Zeiträume. Dort werden alle Gebiete gemischt vorgeschlagen.</p>}
        </details>
        <p className="text-xs text-slate-500">{accountMode?"Die Abschnitte bleiben persönlich gespeichert. Tages- und Wochenplan zeigen den zugehörigen Abschnitt; neue Aufgaben werden erst nach bestätigter Vorbereitung oder Planübernahme angelegt.":"Schwerpunkte und fällige Wiederholungen teilen die verfügbare Lernzeit. AG, Urlaub und deine Tagesgrenze gehen vor. Abweichende Wünsche kannst du bei der Planerstellung ergänzen."}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button type="button" onClick={save} disabled={disabled || !dirty || errors.length > 0}>Stationsplan speichern</Button>
          {dirty && <span className="text-xs text-amber-800">Änderungen noch nicht gespeichert</span>}
        </div>
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
      </CardContent>
    </Card>
  );
}
