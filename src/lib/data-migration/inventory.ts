/** DATA-A: standalone contract, deliberately not wired into the browser store. */
export type AreaShape = "list" | "map" | "object" | "string" | "nullable-object";
export interface StorageArea {
  key: string;
  shape: AreaShape;
  kind: string;
  ownership: "personal" | "catalog";
  description: string;
}

export const BACKUP_AREAS: readonly StorageArea[] = [
  { key: "lerntracker-progress", shape: "map", kind: "progress", ownership: "personal", description: "Themenfortschritt" },
  { key: "lerntracker-entries", shape: "list", kind: "learning-entry", ownership: "personal", description: "Persönliche Lernnotizen" },
  { key: "lerntracker-calendar", shape: "list", kind: "calendar-event", ownership: "personal", description: "Kalender und Klausurzuordnung" },
  { key: "lerntracker-exam-date", shape: "string", kind: "exam-date", ownership: "personal", description: "Examensdatum" },
  { key: "lerntracker-klausuren", shape: "list", kind: "klausur", ownership: "catalog", description: "Gemeinsamer Klausurkatalog und Klassifizierungen" },
  { key: "lerntracker-tracking", shape: "list", kind: "tracking-entry", ownership: "personal", description: "Lernhistorie einschließlich Abrufbewertungen" },
  { key: "lerntracker-recommender-weights", shape: "object", kind: "recommender-settings", ownership: "personal", description: "Persönliche Empfehlungsgewichtung" },
  { key: "lerntracker-lernstart", shape: "string", kind: "learning-start", ownership: "personal", description: "Lernbeginn" },
  { key: "lerntracker-onboarding", shape: "object", kind: "profile", ownership: "personal", description: "Profil, Stationen, Termine, Quelltexte und Notizen" },
  { key: "lerntracker-onboarding-airesult", shape: "object", kind: "plan-result", ownership: "personal", description: "Letztes KI-Planergebnis, kein ersetzbarer Cache" },
  { key: "lerntracker-theme", shape: "string", kind: "theme", ownership: "personal", description: "Darstellung" },
  { key: "lerntracker-ag-weeks", shape: "map", kind: "ag-week", ownership: "personal", description: "Persönliche AG-Wochenabweichungen" },
  { key: "lerntracker-documents", shape: "list", kind: "document", ownership: "personal", description: "Private Originaldateien als Data-URL, Texte und Tags" },
  { key: "lerntracker-tasks", shape: "list", kind: "task", ownership: "personal", description: "Aufgaben, Rückstände und Kalender-/Historienbezüge" },
  { key: "lerntracker-ai-metrics", shape: "object", kind: "ai-metrics", ownership: "personal", description: "Persönliche Akzeptanzzähler, keine Kostenbuchhaltung" },
  { key: "lerntracker-prompts", shape: "list", kind: "prompt", ownership: "personal", description: "Persönliche Promptanpassungen" },
  { key: "lerntracker-plan-history", shape: "list", kind: "plan-history", ownership: "personal", description: "Die tatsächlich gespeicherten Planantworten" },
  { key: "lerntracker-plan-applied-range", shape: "nullable-object", kind: "plan-range", ownership: "personal", description: "Angewendeter Zeitraum; null bleibt null" },
  { key: "lerntracker-klausur-drafts", shape: "list", kind: "draft", ownership: "personal", description: "Eigene Lösungen, Sachverhalt und Korrekturverlauf" },
  { key: "lerntracker-fehlerprofil", shape: "object", kind: "error-profile", ownership: "personal", description: "Persönliches Fehlerprofil" },
  { key: "lerntracker-korrektur-settings", shape: "object", kind: "correction-settings", ownership: "personal", description: "Korrekturmodell und Granularität" },
  { key: "lerntracker-plan-model", shape: "string", kind: "plan-model", ownership: "personal", description: "Gewähltes Planmodell" },
  { key: "lerntracker-ai-reasoning", shape: "object", kind: "reasoning-settings", ownership: "personal", description: "Persönlicher Denkaufwand je Modell, ergänzt durch PLAN-01" },
  { key: "lerntracker-freitext", shape: "object", kind: "notepad", ownership: "personal", description: "Freier Notizblock mit HTML-/Textspiegel" },
];

export function excludedArea(key: string): "derived-cache" | "device-metadata" | null {
  if (key.startsWith("lerntracker-klausur-rec-") || key === "lerntracker-free-models") return "derived-cache";
  if (key === "lerntracker-last-backup") return "device-metadata";
  return null;
}
