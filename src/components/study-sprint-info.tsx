import Link from "next/link";
import { format, parseISO } from "date-fns";
import { describeStudyPhase, getStudyPhase, getStudyBlock, studyPhaseErrors, type StudyPhaseSettings } from "@/lib/study-phases";

export function StudySprintInfo({ date, settings }: { date: string; settings: StudyPhaseSettings }) {
  const phase = getStudyPhase(date, settings);
  const sprint = getStudyBlock(date, settings);
  const followsStations = settings.studyPlanningMode !== "custom";
  const invalid = !!settings.studyPhases?.length && studyPhaseErrors(settings.studyPhases).length > 0;
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm">
      {phase ? <>
        <p className="font-medium text-slate-800">{describeStudyPhase(phase)}</p>
        {sprint && <p className="text-xs text-slate-600 mt-1">Lernblock {sprint.number} · {format(parseISO(sprint.start), "dd.MM.")}–{format(parseISO(sprint.end), "dd.MM.yyyy")} · {phase.focus === "mixed" ? "Alle drei Rechtsgebiete trainieren" : "Schwerpunkt vertiefen, andere Gebiete wiederholen"}</p>}
      </> : <p className="text-slate-600">{!followsStations ? "Abweichende Planung gewählt." : invalid ? "Bitte die Zeiträume im Stationsplan prüfen." : "Für diesen Tag ist noch kein Abschnitt übernommen. Lade deinen Stationsplan im Onboarding hoch und erstelle deinen Lernplan."}</p>}
      <Link href="/onboarding#stationsplan" className="text-xs text-accent-700 underline underline-offset-2">Stationsplan und Dokumente prüfen</Link>
    </div>
  );
}
