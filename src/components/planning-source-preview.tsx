import type { StructuredPlan } from "@/lib/plan-applier";
import { describeStudyPhase } from "@/lib/study-phases";

export function PlanningSourcePreview({ plan }: { plan: StructuredPlan }) {
  if (!plan.studyPhases?.length && !plan.appointments?.length) return <p className="text-xs text-amber-800">Keine neuen Ausbildungsabschnitte oder Dokumenttermine erkannt. Vorhandene Angaben bleiben maßgeblich; prüfe den hochgeladenen Text, falls etwas fehlt.</p>;
  return <details className="rounded border border-slate-200 bg-white p-3" open>
    <summary className="cursor-pointer text-sm font-medium">Aus deinen Dokumenten: {plan.studyPhases?.length ?? 0} Abschnitte · {plan.appointments?.length ?? 0} Termine</summary>
    <p className="text-xs text-slate-600 mt-2">Prüfe Zeiträume und Quellen vor „Übernehmen“. Bei Fehlern den Plan mit einer Korrektur neu erstellen lassen.</p>
    <ul className="space-y-1 text-xs mt-2 max-h-64 overflow-auto">
      {plan.studyPhases?.map(phase => <li key={phase.id}>{phase.start} – {phase.end} · {describeStudyPhase(phase)}<span className="block text-slate-500">Quelle: {phase.sourceDocument}</span></li>)}
      {plan.appointments?.map((event, i) => <li key={i}>{event.date} · {event.label} · {event.durationMinutes ? `${event.durationMinutes} Min.` : "Dauer bitte prüfen"}<span className="block text-slate-500">Quelle: {event.sourceDocument}</span></li>)}
    </ul>
  </details>;
}
