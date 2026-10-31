import { addDays, addMonths, differenceInCalendarDays, parseISO } from "date-fns";
import { isDateOnly, localDate } from "./dates";
import { AREA_LABELS, type Area, type KlausurType, type Topic } from "./types";

export type StudyPerspective = "state" | "lawyer" | "mixed";
export interface StudyPhase {
  id: string;
  label: string;
  start: string;
  end: string;
  focus: Area | "mixed";
  perspective: StudyPerspective;
  sourceDocument?: string;
}
export interface StudyPhaseSettings {
  refStartDate?: string;
  studyPhasesEnabled?: boolean;
  /** Station is the default; custom explicitly opts for a different approach. */
  studyPlanningMode?: "station" | "custom";
  studyPhases?: StudyPhase[];
  examDate?: string;
}
export const PERSPECTIVE_LABELS: Record<StudyPerspective, string> = {
  state: "Staatliche Sicht", lawyer: "Anwaltliche Sicht", mixed: "Beide Perspektiven",
};

/** Inclusive intervals. Invalid imported/draft settings must never choose a random phase. */
export function studyPhaseErrors(input: unknown): string[] {
  if (!Array.isArray(input)) return ["Die Ausbildungsabschnitte fehlen."];
  if (input.length > 40) return ["Bitte höchstens 40 Ausbildungsabschnitte anlegen."];
  const errors: string[] = [];
  const valid: StudyPhase[] = [];
  const ids = new Set<string>();
  input.forEach((phase, index) => {
    if (!phase || typeof phase !== "object") { errors.push(`Abschnitt ${index + 1} ist ungültig.`); return; }
    if (typeof phase.id !== "string" || !phase.id || ids.has(phase.id)) errors.push(`Abschnitt ${index + 1} braucht eine eindeutige Kennung.`);
    ids.add(phase.id);
    if (typeof phase.label !== "string" || !phase.label.trim()) errors.push(`Abschnitt ${index + 1} braucht einen Namen.`);
    if (!["zr", "sr", "oeffr", "mixed"].includes(phase.focus) || !["state", "lawyer", "mixed"].includes(phase.perspective)) errors.push(`Abschnitt ${index + 1}: Rechtsgebiet oder Perspektive fehlt.`);
    if (typeof phase.start !== "string" || typeof phase.end !== "string" || !isDateOnly(phase.start) || !isDateOnly(phase.end) || phase.start > phase.end) {
      errors.push(`Abschnitt ${index + 1}: Bitte gültiges Start- und Enddatum in dieser Reihenfolge eintragen.`);
    } else valid.push(phase);
  });
  valid.sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < valid.length; i++) {
    if (valid[i].start <= valid[i - 1].end) errors.push(`„${valid[i - 1].label}“ und „${valid[i].label}“ überschneiden sich.`);
  }
  return errors;
}

/** Based on the supplied February-cohort diagram; lawyer-block dates are editable estimates. */
export function createBerlinStudyPhases(start: string): StudyPhase[] {
  if (!isDateOnly(start) || !start.endsWith("-01")) throw new Error("Bitte den Startmonat des Referendariats wählen.");
  const first = parseISO(start);
  const month = (n: number) => localDate(addMonths(first, n));
  const lawyerStart = month(11);
  const boundaries = [start, month(4), localDate(addDays(parseISO(month(7)), 15)), lawyerStart,
    localDate(addDays(parseISO(lawyerStart), 49)), localDate(addDays(parseISO(lawyerStart), 98)), month(16), month(20), month(24)];
  const definitions: [string, string, StudyPhase["focus"], StudyPerspective][] = [
    ["civil-state", "Zivilstation · Zivilrecht I", "zr", "state"],
    ["criminal-state", "Strafstation · Strafrecht I", "sr", "state"],
    ["public-state", "Verwaltungsstation · Öffentliches Recht I", "oeffr", "state"],
    ["civil-lawyer", "Anwaltsstation · Zivilrecht II", "zr", "lawyer"],
    ["criminal-lawyer", "Anwaltsstation · Strafrecht II", "sr", "lawyer"],
    ["public-lawyer", "Anwaltsstation · Öffentliches Recht II", "oeffr", "lawyer"],
    ["mixed", "Gemischte Examensvorbereitung / Tauchen", "mixed", "mixed"],
    ["elective", "Wahlstation", "mixed", "mixed"],
  ];
  return definitions.map(([id, label, focus, perspective], i) => ({ id, label, focus, perspective,
    start: boundaries[i], end: localDate(addDays(parseISO(boundaries[i + 1]), -1)) }));
}

export function getStudyPhase(date: string, settings: StudyPhaseSettings): StudyPhase | null {
  if (!isDateOnly(date) || settings.studyPlanningMode === "custom" || studyPhaseErrors(settings.studyPhases).length) return null;
  return settings.studyPhases!.find(phase => phase.start <= date && date <= phase.end) ?? null;
}

export function describeStudyPhase(phase: StudyPhase): string {
  return `${phase.label} · ${phase.focus === "mixed" ? "Alle Rechtsgebiete" : AREA_LABELS[phase.focus]} · ${PERSPECTIVE_LABELS[phase.perspective]}`;
}

/** A learning block lasts at most 14 days and ends at the phase boundary or written exam. */
export function getStudyBlock(date: string, settings: StudyPhaseSettings) {
  const phase = getStudyPhase(date, settings);
  if (!phase || (isDateOnly(settings.examDate ?? "") && date >= settings.examDate!)) return null;
  const index = Math.floor(differenceInCalendarDays(parseISO(date), parseISO(phase.start)) / 14);
  const start = localDate(addDays(parseISO(phase.start), index * 14));
  const ends = [phase.end, localDate(addDays(parseISO(start), 13))];
  if (isDateOnly(settings.examDate ?? "")) ends.push(localDate(addDays(parseISO(settings.examDate!), -1)));
  return { phase, number: index + 1, start, end: ends.sort()[0] };
}

/** Only future, unfinished automatic suggestions carry this key and may be refreshed. */
export function studySuggestionKey(date: string, settings: StudyPhaseSettings): string {
  const phase = getStudyPhase(date, settings);
  return JSON.stringify(["study-sprints-v3", phase && [phase.id, phase.start, phase.end, phase.focus, phase.perspective, phase.label]]);
}

export function topicPerspective(topic: Topic): StudyPerspective {
  if (/^(zr|or)-proz-klausurtyp-anwalt-|^sr-proz-rev-/.test(topic.id)) return "lawyer";
  if (/^(zr|or)-proz-urteil-|^zr-proz-berufungsurteil-|^sr-proz-sta-/.test(topic.id)) return "state";
  return "mixed";
}

export function klausurPerspective(type?: KlausurType): StudyPerspective {
  if (type && ["Anwaltsklausur", "Kautelarklausur", "Revisionsklausur", "Einspruch Strafbefehl"].includes(type)) return "lawyer";
  if (type && ["Urteil", "Beschluss", "Behördenklausur", "Anklageklausur", "Abschlussverfügung"].includes(type)) return "state";
  return "mixed";
}

export function studyPhasesContext(settings: StudyPhaseSettings): string {
  if (settings.studyPlanningMode === "custom") return "STATIONSPLANUNG: ausdrücklich abweichende Planung gewählt. Persönlichen Planungswunsch beachten; Termine aus den Dokumenten gelten weiterhin.";
  if (!settings.studyPhases?.length) return "STATIONSPLANUNG: Standard. Den persönlichen Stationsplan aus den hochgeladenen Dokumenttexten ableiten; es sind noch keine konkreten Abschnitte übernommen. Ohne belastbare Daten keine Stationsdaten erfinden.";
  const errors = studyPhaseErrors(settings.studyPhases);
  if (errors.length) return `STATIONSPLANUNG: ungültig — keine Abschnitte unterstellen. ${errors.join(" ")}`;
  return `STATIONSPLANUNG (persönlich gespeicherte Zeiträume, jeweils einschließlich Enddatum):\n${settings.studyPhases!.map(phase => `- ${phase.start} bis ${phase.end}: ${describeStudyPhase(phase)}${phase.sourceDocument ? ` [Quelle: ${phase.sourceDocument}]` : " [manuell bzw. Beispielvorlage; bei abweichendem persönlichem Dokument prüfen]"}`).join("\n")}\nArbeite in höchstens 14-tägigen Lernblöcken ab Abschnittsbeginn; an jedem Abschnittswechsel einen neuen Lernblock beginnen. In Fokusabschnitten Schwerpunkt und Wiederholung anderer Gebiete verbinden. Der Klausurenkurs begleitet sämtliche Stationen; seine realen Termine aus den Dokumenten beachten. Staatliche und anwaltliche Perspektiven unterscheiden, die konkrete Lernaufgabe aus den Unterlagen und dem Lernstand formulieren. Gemischte Phasen decken alle drei Gebiete und beide Perspektiven ab. Die Tagesgrenze und freie Tage haben Vorrang vor Quoten. Keine zusätzlichen AG-/Kurstermine erfinden.`;
}
