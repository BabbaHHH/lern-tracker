import { AI_DEFAULTS, normalizeReasoningSettings, type ReasoningSettings } from "./ai-config";
import { restoreStorage } from "./storage-backup";
import { isDateOnly, localDate, currentDate } from "./dates";
import { frequencyMatches } from "./recurrence";
import type { StudyPhaseSettings } from "./study-phases";
import { isSketchTask, taskMinutes } from "./day-budget";
import { Progress, LearningEntry, CalendarEvent, Klausur, KlausurType, TrackingEntry, KlausurDraft, FehlerProfil, FehlerMarker, KorrekturSettings, KorrekturGranularity } from "./types";
import { DEFAULT_KORREKTUR_MODEL, DEFAULT_PLAN_MODEL, PLAN_MODELS } from "./ai-models";

/**
 * Zentrale Liste aller localStorage-Keys.
 * Niemals Inline-Strings verwenden — Tippfehler wären stiller Datenverlust.
 * Bei neuen Keys hier ergänzen UND in ALL_BACKUP_KEYS aufnehmen.
 */
export const STORAGE_KEYS = {
  progress: "lerntracker-progress",
  entries: "lerntracker-entries",
  calendar: "lerntracker-calendar",
  examDate: "lerntracker-exam-date",
  klausuren: "lerntracker-klausuren",
  tracking: "lerntracker-tracking",
  recommenderWeights: "lerntracker-recommender-weights",
  lernstart: "lerntracker-lernstart",
  onboarding: "lerntracker-onboarding",
  onboardingAiResult: "lerntracker-onboarding-airesult",
  theme: "lerntracker-theme",
  agWeeks: "lerntracker-ag-weeks",
  documents: "lerntracker-documents",
  tasks: "lerntracker-tasks",
  aiMetrics: "lerntracker-ai-metrics",
  prompts: "lerntracker-prompts",
  planHistory: "lerntracker-plan-history",
  planAppliedRange: "lerntracker-plan-applied-range",
  lastBackup: "lerntracker-last-backup",
  klausurDrafts: "lerntracker-klausur-drafts",
  fehlerProfil: "lerntracker-fehlerprofil",
  korrekturSettings: "lerntracker-korrektur-settings",
  planModel: "lerntracker-plan-model",
  aiReasoning: "lerntracker-ai-reasoning",
  freitext: "lerntracker-freitext",
  /** Prefix für tagesaktuelle Klausur-Empfehlungs-Caches: `${klausurRecPrefix}YYYY-MM-DD` */
  klausurRecPrefix: "lerntracker-klausur-rec-",
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

// TODO(timezone): Alle Datums-Operationen laufen aktuell mit System-Timezone.
// Für Multi-Device/Sync später auf zonedTimeToUtc(..., "Europe/Berlin") via date-fns-tz umstellen.

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    // Quota überschritten — Nutzer informieren statt silent fail
    const isQuota = e instanceof Error && /quota|exceeded/i.test(e.message);
    if (isQuota && typeof window !== "undefined") {
      console.error("[lerntracker] localStorage quota überschritten beim Speichern von", key);
      try {
        window.dispatchEvent(new CustomEvent("lerntracker:quota-exceeded", { detail: { key } }));
      } catch { /* ignore */ }
    } else {
      console.error("[lerntracker] save failed", key, e);
    }
    return false;
  }
}

// === Progress ===

export function getProgress(): Record<string, Progress> {
  return load<Record<string, Progress>>(STORAGE_KEYS.progress, {});
}

export function setTopicProgress(topicId: string, percent: number, source: Progress["source"] = "manual"): Record<string, Progress> {
  const all = getProgress();
  all[topicId] = {
    topicId,
    percent: Math.max(0, Math.min(100, percent)),
    source,
    updatedAt: new Date().toISOString(),
  };
  save(STORAGE_KEYS.progress, all);
  return all;
}

export function getTopicProgress(topicId: string): number {
  const all = getProgress();
  return all[topicId]?.percent ?? 0;
}

/**
 * Setzt den Progress auf einen gesamten Teilbaum: rekursiv alle LEAF-Topics
 * unterhalb von rootId bekommen den angegebenen Prozentwert.
 * Branches selbst speichern keinen Progress — der wird aus den Leaves
 * aggregiert. So bleibt die Datenstruktur konsistent.
 */
export function setSubtreeProgress(
  leafIdsUnderRoot: string[],
  percent: number,
  source: Progress["source"] = "manual",
): Record<string, Progress> {
  const all = getProgress();
  const now = new Date().toISOString();
  const clamped = Math.max(0, Math.min(100, percent));
  for (const id of leafIdsUnderRoot) {
    all[id] = { topicId: id, percent: clamped, source, updatedAt: now };
  }
  save(STORAGE_KEYS.progress, all);
  return all;
}

/**
 * Schreibt mehrere Topic-Progress-Werte in einem Rutsch (eine localStorage-
 * Operation). Wird für Branch-Slider mit proportionaler Skalierung genutzt
 * und für Undo (Snapshot zurückspielen).
 */
export function setManyTopicProgress(
  updates: Record<string, number>,
  source: Progress["source"] = "manual",
): Record<string, Progress> {
  const all = getProgress();
  const now = new Date().toISOString();
  for (const [id, percent] of Object.entries(updates)) {
    all[id] = {
      topicId: id,
      percent: Math.max(0, Math.min(100, percent)),
      source,
      updatedAt: now,
    };
  }
  save(STORAGE_KEYS.progress, all);
  return all;
}

// === Klausur-Progress-Boost ===
// Adaptive Formel:
//   - Basisboost ist abhängig vom aktuellen Stand (je niedriger, desto größer)
//   - Multipliziert mit Rating-Faktor (wie gut der Nutzer klargekommen ist)
//   - Cap bei 95% — die letzten 5% nur über bewusste Lern-Sessions

export function calculateKlausurDelta(currentPercent: number, rating: number): number {
  const baseBoost =
    currentPercent < 20 ? 12 :
    currentPercent < 50 ? 7 :
    currentPercent < 80 ? 4 :
    2;
  const ratingFactor =
    rating >= 5 ? 1.0 :
    rating === 4 ? 0.85 :
    rating === 3 ? 0.7 :
    rating === 2 ? 0.5 :
    0.3;
  return Math.round(baseBoost * ratingFactor);
}

export interface KlausurBoostPreview {
  topicId: string;
  before: number;
  after: number;
  delta: number;
}

export function previewKlausurProgressBoosts(
  topicIds: string[],
  rating: number,
  scale = 1.0,
): KlausurBoostPreview[] {
  const all = getProgress();
  return topicIds.map(tid => {
    const before = all[tid]?.percent ?? 0;
    const rawDelta = Math.round(calculateKlausurDelta(before, rating) * scale);
    const after = Math.min(95, before + rawDelta);
    return { topicId: tid, before, after, delta: after - before };
  });
}

export function applyKlausurProgressBoosts(
  topicIds: string[],
  rating: number,
  scale = 1.0,
): KlausurBoostPreview[] {
  const all = getProgress();
  const now = new Date().toISOString();
  const applied: KlausurBoostPreview[] = [];
  for (const tid of topicIds) {
    const before = all[tid]?.percent ?? 0;
    const rawDelta = Math.round(calculateKlausurDelta(before, rating) * scale);
    const after = Math.min(95, before + rawDelta);
    const delta = after - before;
    if (delta > 0) {
      all[tid] = {
        topicId: tid,
        percent: after,
        source: "klausur",
        updatedAt: now,
      };
    }
    applied.push({ topicId: tid, before, after, delta });
  }
  save(STORAGE_KEYS.progress, all);
  return applied;
}

// === Learning Entries ===

export function getLearningEntries(): LearningEntry[] {
  return load<LearningEntry[]>(STORAGE_KEYS.entries, []);
}

export function addLearningEntry(entry: Omit<LearningEntry, "id" | "createdAt">): LearningEntry[] {
  const all = getLearningEntries();
  const newEntry: LearningEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  all.unshift(newEntry);
  save(STORAGE_KEYS.entries, all);
  return all;
}

export function getEntriesForTopic(topicId: string): LearningEntry[] {
  return getLearningEntries().filter(e => e.topicId === topicId);
}

// === Calendar Events ===

export function getCalendarEvents(): CalendarEvent[] {
  return load<CalendarEvent[]>(STORAGE_KEYS.calendar, []);
}

export function addCalendarEvent(event: Omit<CalendarEvent, "id">): CalendarEvent[] {
  const all = getCalendarEvents();
  all.push({ ...event, id: crypto.randomUUID() });
  save(STORAGE_KEYS.calendar, all);
  return all;
}

export function removeCalendarEvent(id: string): CalendarEvent[] {
  const all = getCalendarEvents().filter(e => e.id !== id);
  save(STORAGE_KEYS.calendar, all);
  return all;
}

// === Exam Date ===

export function getExamDate(): string {
  return load<string>(STORAGE_KEYS.examDate, "");
}

export function getLernstart(): string {
  return load<string>(STORAGE_KEYS.lernstart, "");
}

export function setLernstart(date: string): void {
  save(STORAGE_KEYS.lernstart, date);
}

// === Onboarding ===

export interface AgEntry {
  id: string;
  label: string;
  day: string;
  frequency: string;
  topic: string;
  durationHours: number;
  prepHours: number;
  postHours: number;
  startDate: string;
  endDate: string;
}

export interface LerngruppeEntry {
  id: string;
  label: string;
  day: string;
  frequency: string;
  durationHours: number;
  prepHours: number;
  postHours: number;
  startDate: string;
  endDate: string;
}

export interface RepEntry {
  id: string;
  label: string;
  day: string;
  durationHours: number;
  prepHours: number;
  postHours: number;
  startDate: string;
  endDate: string;
  /** Index des OnboardingDocument das den Schedule enthält (für Re-Parse). */
  scheduleDocIndex?: number;
  /** Geparste Themen-Liste pro Termin. Wenn gesetzt: jedes Rep-Datum mit
   *  Match bekommt erweiterten Task-Titel + linkedTopicIds. */
  schedule?: RepScheduleEntry[];
}

export interface SonstigesEntry {
  id: string;
  label: string;
  day: string;
  frequency: string;
  durationHours: number;
  startDate: string;
  endDate: string;
}

export interface OnboardingDocument {
  id?: string;
  name: string;
  type: string;
  summary?: string;
  description?: string;
  topicIds?: string[];
  /** Voller, beim Upload extrahierter Text (max 15k chars).
   *  Wird für strukturierte Folgeparser benötigt (z.B. Rep-Schedule-Parser),
   *  die mehr Kontext brauchen als nur summary/description. */
  fullText?: string;
  parseStatus?: "pending" | "ready" | "error";
  parseError?: string;
  textTruncated?: boolean;
}

/** Ein einzelner Termin aus dem Repetitorium-Plan (aus Doc geparst). */
export interface RepScheduleEntry {
  date: string;          // "2026-05-11"
  title: string;         // "Zulässigkeit einer Klage"
  content: string;       // Roh-Text aus dem Doc: "Prüfungsschema, Zuständigkeiten, ..."
  topicIds: string[];    // Auf Leaf-IDs gemappt — multi-topic
  weekNumber?: number;
  akte?: string;         // "Akte 4: Götz u.a. ./. Becker"
}

export interface OnboardingData extends StudyPhaseSettings {
  completed: boolean;
  bundesland: string;
  examDate: string;
  lernstart: string;
  /** Liste aller AGs (jede mit eigenem Zeitraum + Vor-/Nachbereitung) */
  ags: AgEntry[];
  /** @deprecated — einzelne AG-Felder; werden in `ags[0]` migriert */
  agDay?: string;
  /** @deprecated */
  agTopic?: string;
  /** @deprecated */
  agFrequency?: string;
  /** @deprecated */
  agDurationHours?: number;
  /** @deprecated */
  agEndDate?: string;
  /** @deprecated */
  agPrepHours?: number;
  /** @deprecated */
  agPostHours?: number;
  /** Liste aller Lerngruppen */
  lerngruppen: LerngruppeEntry[];
  /** @deprecated — alte Single-Felder, werden in `lerngruppen[0]` migriert */
  lerngruppeDay?: string;
  /** @deprecated */
  lerngruppeDurationHours?: number;
  /** @deprecated */
  lerngruppeEndDate?: string;
  /** @deprecated */
  lerngruppePrepHours?: number;
  /** @deprecated */
  lerngruppePostHours?: number;
  /** Liste aller Repetitorien */
  reps: RepEntry[];
  /** @deprecated → reps[0] */
  repDay?: string;
  /** @deprecated */
  repDurationHours?: number;
  /** Sonstige wiederkehrende Termine */
  sonstiges: SonstigesEntry[];
  /** Probeexamen-Startdaten (löschbar) */
  /** Kaiserseminare: Datum + Rechtsgebiet + ggf. Dauer */
  kaiserSeminare: { date: string; topic: string; durationDays: number }[];
  /** @deprecated — alter Key, nur für Migration */
  kaiserDates?: string[];
  probeexamen1Start: string;
  probeexamen2Start: string;
  freeDayPerWeek: string;
  /** Maximum daily workload including appointments; default 7 hours. */
  maxDailyHours?: number;
  vacationDates: string[];
  selfAssessment: Record<string, number>;
  documents: OnboardingDocument[];
  notes: string;
}

const ONBOARDING_KEY = STORAGE_KEYS.onboarding;

const DEFAULT_ONBOARDING: OnboardingData = {
  completed: false,
  bundesland: "Berlin",
  examDate: "",
  lernstart: "",
  refStartDate: "",
  studyPhasesEnabled: true,
  studyPlanningMode: "station",
  studyPhases: [],
  ags: [],
  lerngruppen: [],
  reps: [],
  sonstiges: [],
  kaiserSeminare: [],
  probeexamen1Start: "",
  probeexamen2Start: "",
  freeDayPerWeek: "Sonntag",
  vacationDates: [],
  selfAssessment: {},
  documents: [],
  notes: "",
};

function makeAgId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getOnboarding(): OnboardingData {
  const stored = load<Partial<OnboardingData>>(ONBOARDING_KEY, DEFAULT_ONBOARDING);
  const merged = { ...DEFAULT_ONBOARDING, ...stored };
  // Former opt-in checkboxes no longer turn off the onboarding default.
  merged.studyPhasesEnabled = merged.studyPlanningMode !== "custom";
  // Migration: legacy Single-AG-Felder → ags[0]
  if ((!merged.ags || merged.ags.length === 0) && (stored.agDay || stored.agFrequency)) {
    merged.ags = [{
      id: makeAgId(),
      label: stored.agTopic || "AG",
      day: stored.agDay || "Montag",
      frequency: stored.agFrequency || "wöchentlich",
      topic: stored.agTopic || "",
      durationHours: stored.agDurationHours ?? 5,
      prepHours: stored.agPrepHours ?? 2,
      postHours: stored.agPostHours ?? 1,
      startDate: "",
      endDate: stored.agEndDate || "",
    }];
  }
  // Migration: legacy Single-Lerngruppe-Felder → lerngruppen[0]
  if ((!merged.lerngruppen || merged.lerngruppen.length === 0) && stored.lerngruppeDay) {
    merged.lerngruppen = [{
      id: makeAgId(),
      label: "Lerngruppe",
      day: stored.lerngruppeDay,
      frequency: "wöchentlich",
      durationHours: stored.lerngruppeDurationHours ?? 2,
      prepHours: stored.lerngruppePrepHours ?? 1,
      postHours: stored.lerngruppePostHours ?? 0.5,
      startDate: "",
      endDate: stored.lerngruppeEndDate || "",
    }];
  }
  // Migration: legacy repDay/repDurationHours → reps[0]
  if ((!merged.reps || merged.reps.length === 0) && stored.repDay) {
    merged.reps = [{
      id: makeAgId(),
      label: "Repetitorium",
      day: stored.repDay,
      durationHours: stored.repDurationHours ?? 4,
      prepHours: 0,
      postHours: 0,
      startDate: "",
      endDate: "",
    }];
  }
  if (!merged.sonstiges) merged.sonstiges = [];
  return merged;
}

export function saveOnboarding(data: OnboardingData): boolean {
  if (save(ONBOARDING_KEY, data)) {
    setExamDate(data.examDate);
    setLernstart(data.lernstart);
    return true;
  }
  return false;
}

export function resetOnboarding(): void {
  saveOnboarding({ ...DEFAULT_ONBOARDING });
}

export function setExamDate(date: string): void {
  save(STORAGE_KEYS.examDate, date);
}

// === Klausur-Datenbank ===

export function getKlausuren(): Klausur[] {
  return load<Klausur[]>(STORAGE_KEYS.klausuren, []);
}

/**
 * Fügt eine Klausur hinzu. Wenn `id` mitgegeben ist (z.B. "kg-oeffr-16" aus KI-Extraktion),
 * wird sie übernommen — ansonsten UUID-Fallback. Bei ID-Kollision wird die bestehende
 * Klausur ersetzt (idempotenter Reimport).
 */
export function addKlausur(klausur: Omit<Klausur, "id" | "createdAt" | "updatedAt"> & { id?: string }): Klausur[] {
  const all = getKlausuren();
  const now = new Date().toISOString();
  const id = klausur.id || crypto.randomUUID();
  const existing = all.findIndex(k => k.id === id);
  const entry: Klausur = {
    ...klausur,
    id,
    createdAt: existing >= 0 ? all[existing].createdAt : now,
    updatedAt: now,
  };
  if (existing >= 0) all[existing] = entry;
  else all.push(entry);
  save(STORAGE_KEYS.klausuren, all);
  return all;
}

/**
 * Batch-Import: dedupliziert nach SOURCE (nicht ID).
 * - Gleiche Source → Update in-place (bestehende ID bleibt erhalten)
 * - Neue Source, aber ID-Kollision → neue UUID automatisch
 * - Neue Source, neue ID → normal einfügen
 * Damit können Bundles mit doppelten IDs (aber unterschiedlichen Sources)
 * vollständig importiert werden.
 */
export function importKlausuren(
  items: Array<Omit<Klausur, "id" | "createdAt" | "updatedAt"> & { id?: string }>
): { added: number; updated: number } {
  const all = getKlausuren();
  const now = new Date().toISOString();

  // Lookup-Maps für O(n) statt O(n²)
  const sourceIdx = new Map(all.map((k, i) => [k.source, i]));
  const usedIds = new Set(all.map(k => k.id));

  let added = 0, updated = 0;

  for (const item of items) {
    const source = item.source ?? "";
    const existingIdx = source ? (sourceIdx.get(source) ?? -1) : -1;

    const normalizedType = normalizeKlausurType(item.type);
    if (existingIdx >= 0) {
      // Gleiche Source → Update, ID bleibt
      all[existingIdx] = {
        ...all[existingIdx],
        ...item,
        type: normalizedType,
        id: all[existingIdx].id,
        createdAt: all[existingIdx].createdAt,
        updatedAt: now,
      };
      updated++;
    } else {
      // Neue Source → sicheres ID bestimmen
      let id = item.id?.trim() || crypto.randomUUID();
      if (usedIds.has(id)) id = crypto.randomUUID(); // Kollision → neue UUID
      const entry: Klausur = {
        ...item,
        type: normalizedType,
        id,
        source,
        createdAt: now,
        updatedAt: now,
      };
      all.push(entry);
      sourceIdx.set(source, all.length - 1);
      usedIds.add(id);
      added++;
    }
  }

  save(STORAGE_KEYS.klausuren, all);
  return { added, updated };
}

export function updateKlausur(id: string, updates: Partial<Omit<Klausur, "id" | "createdAt">>): Klausur[] {
  const all = getKlausuren();
  const idx = all.findIndex(k => k.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  }
  save(STORAGE_KEYS.klausuren, all);
  return all;
}

export function removeKlausur(id: string): Klausur[] {
  const all = getKlausuren().filter(k => k.id !== id);
  save(STORAGE_KEYS.klausuren, all);
  return all;
}

export function getKlausurById(id: string): Klausur | undefined {
  return getKlausuren().find(k => k.id === id);
}

/**
 * Normalisiert KI-generierte Typ-Strings auf unsere KlausurType-Enum.
 * KI-Extraktion produziert Prefixe wie "ZR-Urteil", "OR-Behoerdenklausur",
 * "SR-Einspruch-Strafbefehl" — diese werden auf die kanonischen Werte gemappt.
 */
const VALID_KLAUSUR_TYPES = new Set<KlausurType>([
  "Urteil", "Beschluss", "Anwaltsklausur", "Kautelarklausur",
  "Behördenklausur", "Aktenvortrag",
  "Anklageklausur", "Revisionsklausur", "Plädoyer",
  "Haftklausur", "Einspruch Strafbefehl", "Abschlussverfügung",
]);

const TYPE_NORMALIZE: Record<string, KlausurType> = {
  // ZR prefixed
  "zr-urteil": "Urteil",
  "zr-beschluss": "Beschluss",
  "zr-anwaltsklausur": "Anwaltsklausur",
  "zr-kautelarklausur": "Kautelarklausur",
  // OR/ÖR prefixed
  "or-urteil": "Urteil",
  "or-beschluss": "Beschluss",
  "or-anwaltsklausur": "Anwaltsklausur",
  "or-aktenvortrag": "Aktenvortrag",
  "or-behoerdenklausur": "Behördenklausur",
  "or-behördenklausur": "Behördenklausur",
  // SR prefixed
  "sr-anklageklausur": "Anklageklausur",
  "sr-revisionsklausur": "Revisionsklausur",
  "sr-plaedoyer": "Plädoyer",
  "sr-plädoyer": "Plädoyer",
  "sr-haftklausur": "Haftklausur",
  "sr-einspruch-strafbefehl": "Einspruch Strafbefehl",
  "sr-einspruchstrafbefehl": "Einspruch Strafbefehl",
  "sr-abschlussverfuegung": "Abschlussverfügung",
  "sr-abschlussverfuegung-einstellung": "Abschlussverfügung",
  "sr-abschlussverfügung": "Abschlussverfügung",
  "sr-abschlussverfügung-einstellung": "Abschlussverfügung",
};

export function normalizeKlausurType(raw: string | undefined): KlausurType | undefined {
  if (!raw) return undefined;
  // Already canonical?
  if (VALID_KLAUSUR_TYPES.has(raw as KlausurType)) return raw as KlausurType;
  // Map via lowercase lookup
  return TYPE_NORMALIZE[raw.toLowerCase()] ?? undefined;
}

/**
 * Einmalige Migration: normalisiert alle gespeicherten Klausur-Typen
 * die noch KI-Prefixe haben ("ZR-Urteil" → "Urteil" etc.).
 * Gibt Anzahl der geänderten Einträge zurück.
 */
export function migrateKlausurTypes(): number {
  const all = getKlausuren();
  let changed = 0;
  const migrated = all.map(k => {
    const normalized = normalizeKlausurType(k.type);
    if (normalized !== k.type) {
      changed++;
      return { ...k, type: normalized, updatedAt: new Date().toISOString() };
    }
    return k;
  });
  if (changed > 0) save(STORAGE_KEYS.klausuren, migrated);
  return changed;
}

// === Erweitertes Tracking ===

export function getTrackingEntries(): TrackingEntry[] {
  return load<TrackingEntry[]>(STORAGE_KEYS.tracking, []);
}

export function addTrackingEntry(entry: Omit<TrackingEntry, "id" | "createdAt">): TrackingEntry[] {
  const all = getTrackingEntries();
  all.unshift({ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  if (!save(STORAGE_KEYS.tracking, all)) throw new Error("Die Lerneinheit konnte nicht gespeichert werden. Bitte Browserspeicher prüfen.");
  return all;
}

export function getTrackingForDate(date: string): TrackingEntry[] {
  return getTrackingEntries().filter(e => e.date === date);
}

export function getTrackingForTopic(topicId: string): TrackingEntry[] {
  return getTrackingEntries().filter(e => e.topicIds.includes(topicId));
}

export function getKlausurenWritten(): TrackingEntry[] {
  return getTrackingEntries().filter(e => e.activityType === "klausur");
}

/**
 * Default Klausur-Dauer in Minuten (5h Examen).
 * Kann via opts.durationMinutes überschrieben werden.
 */
export const DEFAULT_KLAUSUR_DURATION_MIN = 300;

/**
 * Mehr als ~15 Topics pro Klausur ist ein Extraktions-Fehler (manche Import-
 * JSONs haben 50-115 topicIds — ganze Taxonomie ausgekippt). Oberhalb dieser
 * Schwelle: keine automatische Vorauswahl / kein automatischer Boost — der
 * Nutzer muss die echten Themen manuell anwählen.
 */
export const PLAUSIBLE_KLAUSUR_TOPICS_MAX = 15;

export interface MarkKlausurWrittenOpts {
  rating: number;
  taskId?: string;
  /** Datum der Klausur — Default: heute */
  date?: string;
  /** Notizen — Default: "" */
  note?: string;
  /** Welche Topics decken diese Klausur ab? Default: alle Topics der Klausur (gefiltert auf gültige Leaves) */
  topicIds?: string[];
  /** Tatsächliche Dauer der Klausur — Default: DEFAULT_KLAUSUR_DURATION_MIN (300) */
  durationMinutes?: number;
  /**
   * "written" (default) = vollständig geschrieben, 100% Boost.
   * "read" = gelesen / skizziert, 50% Boost, kürzere Tracking-Dauer.
   */
  klausurMode?: "written" | "read";
  /**
   * Set der gültigen Leaf-Topic-IDs.
   * Pflicht, weil die Validierung sonst doppelt passieren müsste —
   * Caller hat die Leafs meist eh schon im Speicher (useMemo).
   */
  validLeafIds: Set<string>;
}

/**
 * Trägt eine geschriebene Klausur ein:
 * 1. TrackingEntry mit activityType "klausur"
 * 2. Progress-Boost auf alle gültigen Topic-IDs (rating-abhängig)
 *
 * Eine Funktion statt zwei manuelle Calls weil das Pärchen vorher 2× kopiert
 * war (klausur-des-tages + klausuren-page) und Drift drohte.
 */
export function markKlausurWritten(
  klausur: Pick<Klausur, "id" | "topicIds">,
  opts: MarkKlausurWrittenOpts,
): { boosts: KlausurBoostPreview[] } {
  const now = new Date().toISOString();
  const date = opts.date || localDate();
  const note = opts.note ?? "";
  const klausurMode = opts.klausurMode ?? "written";
  // Gelesen/skizziert → kürzere Tracking-Dauer, halber Boost
  const durationMinutes = opts.durationMinutes ?? (klausurMode === "read" ? 120 : DEFAULT_KLAUSUR_DURATION_MIN);
  const boostScale = klausurMode === "read" ? 0.5 : 1.0;
  // Ohne explizite Auswahl des Nutzers: unplausibel lange Topic-Listen
  // (Extraktions-Fehler) NICHT automatisch boosten — sonst springen 100+
  // Themen auf einmal hoch.
  const requested = opts.topicIds
    ?? (klausur.topicIds.length > PLAUSIBLE_KLAUSUR_TOPICS_MAX ? [] : klausur.topicIds);
  const validIds = [...new Set(requested.filter(id => opts.validLeafIds.has(id)))];
  if (!isDateOnly(date) || date > localDate() || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440 || !Number.isFinite(opts.rating) || opts.rating < 1 || opts.rating > 5) throw new Error("Bitte ein gültiges Bearbeitungsdatum (bis heute), eine Dauer und eine Bewertung von 1 bis 5 angeben.");

  const existingTask = getTasks().find(task => task.linkedKlausurId === klausur.id && task.date === date
    && (task.id === opts.taskId || (isSketchTask(task) ? "read" : "written") === klausurMode));
  if (existingTask?.done) return { boosts: [] };
  const entry: TrackingEntry = {
    id: crypto.randomUUID(), createdAt: now,
    date,
    activityType: "klausur",
    topicIds: validIds,
    klausurId: klausur.id,
    klausurMode,
    durationMinutes,
    rating: opts.rating,
    note,
  };
  const boosts = previewKlausurProgressBoosts(validIds, opts.rating, boostScale);
  const progress = getProgress();
  for (const boost of boosts) if (boost.delta > 0) progress[boost.topicId] = { topicId: boost.topicId, percent: boost.after, source: "klausur", updatedAt: now };

  const baseTitle = getKlausurById(klausur.id)?.title ?? existingTask?.title.replace(/^Skizze:\s*/i, "") ?? "Klausur";
  const fields = {
    date, title: klausurMode === "read" ? `Skizze: ${baseTitle}` : baseTitle,
    done: true, doneAt: now, linkedKlausurId: klausur.id, linkedTopicIds: validIds,
    durationMinutes, klausurMode, trackingEntryId: entry.id,
    recurringKey: `klausur-written|${klausur.id}|${date}|${klausurMode}`,
  };
  const tasks = existingTask ? getTasks().map(task => task.id === existingTask.id ? { ...task, ...fields } : task)
    : [{ ...fields, id: crypto.randomUUID(), source: "manual" as const, createdAt: now }, ...getTasks()];
  restoreStorage(localStorage, [[STORAGE_KEYS.tracking, [entry, ...getTrackingEntries()]], [STORAGE_KEYS.progress, progress], [STORAGE_KEYS.tasks, tasks]]);

  return { boosts };
}

// === Recommender Gewichte ===

export interface RecommenderWeights {
  tagesplanOverlap: number;
  tagesAreaMatch: number;
  schwacheThemen: number;
  nochNieGeschrieben: number;
  spacedRepetition: number;
  rechtsgebietsBalance: number;
  kuerzlichGeschrieben: number;
  schwierigkeitsMatch: number;
  neuheitsBonus: number;
  wiederholungsDistanz: number;
  anspruchsgrundlagenFrische: number;
}

export const DEFAULT_WEIGHTS: RecommenderWeights = {
  tagesplanOverlap: 60,
  tagesAreaMatch: 200,
  schwacheThemen: 20,
  nochNieGeschrieben: 30,
  spacedRepetition: 15,
  rechtsgebietsBalance: 20,
  kuerzlichGeschrieben: -50,
  schwierigkeitsMatch: 10,
  neuheitsBonus: 25,
  wiederholungsDistanz: 10,
  anspruchsgrundlagenFrische: 12,
};

export const WEIGHT_LABELS: Record<keyof RecommenderWeights, string> = {
  tagesplanOverlap: "Tagesplan-Overlap (pro Thema)",
  tagesAreaMatch: "Rechtsgebiet matcht heutige Tasks (Bonus/Malus)",
  schwacheThemen: "Schwache Themen abdecken (pro Thema)",
  nochNieGeschrieben: "Noch nie geschrieben",
  spacedRepetition: "Spaced Repetition (pro Thema >14d)",
  rechtsgebietsBalance: "Rechtsgebiets-Balance (3:2:2)",
  kuerzlichGeschrieben: "Kürzlich geschrieben (<7 Tage)",
  schwierigkeitsMatch: "Schwierigkeits-Match",
  neuheitsBonus: "Neuheits-Bonus (neuere Klausuren)",
  wiederholungsDistanz: "Gute Wiederholungs-Distanz (>21d)",
  // Hinweis: interner Key heißt historisch "anspruchsgrundlagenFrische", misst aber
  // rechtsgebiets-NEUTRAL Themen mit mittlerem Lernstand (30–80%). Label entsprechend neutral.
  anspruchsgrundlagenFrische: "Auffrischung mittlerer Lernstand (Themen 30–80 %)",
};

export function getRecommenderWeights(): RecommenderWeights {
  return load<RecommenderWeights>(STORAGE_KEYS.recommenderWeights, DEFAULT_WEIGHTS);
}

export function saveRecommenderWeights(weights: RecommenderWeights): void {
  save(STORAGE_KEYS.recommenderWeights, weights);
}

export function resetRecommenderWeights(): void {
  save(STORAGE_KEYS.recommenderWeights, DEFAULT_WEIGHTS);
}

// === Theme ===

export type ThemeId = "indigo" | "azure" | "sapphire" | "bordeaux" | "forest" | "graphite";

export const THEMES: { id: ThemeId; label: string; hue: string; description: string }[] = [
  { id: "indigo",   label: "Indigo",   hue: "#4f46e5", description: "Tiefes Blauviolett — Default" },
  { id: "azure",    label: "Azure",    hue: "#2563eb", description: "Lebendiges Mittelblau" },
  { id: "sapphire", label: "Sapphire", hue: "#0369a1", description: "Edles Dunkelblau" },
  { id: "bordeaux", label: "Bordeaux", hue: "#b91c1c", description: "Tiefes Weinrot" },
  { id: "forest",   label: "Forest",   hue: "#15803d", description: "Gedeckter Tannengrün" },
  { id: "graphite", label: "Graphite", hue: "#475569", description: "Reduzierte Monochromie" },
];

const THEME_KEY = STORAGE_KEYS.theme;

export function getTheme(): ThemeId {
  return load<ThemeId>(THEME_KEY, "indigo");
}

export function setTheme(id: ThemeId): void {
  save(THEME_KEY, id);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = id;
  }
}

// === AG-Wochen (flexibel pro Kalenderwoche) ===

/**
 * ISO-Wochenschlüssel: "2026-W15"
 * weekdays: 0=Mo, 1=Di, 2=Mi, 3=Do, 4=Fr, 5=Sa, 6=So
 */
export interface AgWeekOverride {
  weekKey: string;
  agDays: number[];
  source: "default" | "manual" | "ai";
}

const AG_WEEKS_KEY = STORAGE_KEYS.agWeeks;

export function getWeekKey(date: Date): string {
  // ISO 8601 week
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export const WEEKDAY_TO_INDEX: Record<string, number> = {
  Montag: 0, Dienstag: 1, Mittwoch: 2, Donnerstag: 3,
  Freitag: 4, Samstag: 5, Sonntag: 6,
};

export function getAgWeekOverrides(): Record<string, AgWeekOverride> {
  return load<Record<string, AgWeekOverride>>(AG_WEEKS_KEY, {});
}

/** ISO weekKey "2026-W17" → Montag (UTC) der Woche */
function weekKeyToMonday(weekKey: string): Date | null {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // ISO: Donnerstag der Woche bestimmt das Jahr
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

function dateInRange(date: Date, startStr: string, endStr: string): boolean {
  const iso = date.toISOString().slice(0, 10);
  if (startStr && iso < startStr) return false;
  if (endStr && iso > endStr) return false;
  return true;
}

export function getAgDaysForWeek(weekKey: string): number[] {
  const overrides = getAgWeekOverrides();
  if (overrides[weekKey]) return overrides[weekKey].agDays;

  const monday = weekKeyToMonday(weekKey);
  if (!monday) return [];
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const onb = getOnboarding();
  const days = new Set<number>();
  (onb.ags || []).forEach(ag => {
    const idx = WEEKDAY_TO_INDEX[ag.day];
    if (idx === undefined) return;

    // Konkretes AG-Datum dieser Woche = Montag + idx
    const agDate = new Date(monday);
    agDate.setUTCDate(monday.getUTCDate() + idx);

    // Datumsfenster prüfen (Start/End-Datum der AG)
    if (!dateInRange(agDate, ag.startDate, ag.endDate)) return;

    if (frequencyMatches(ag.frequency, agDate, ag.startDate)) days.add(idx);

    // suppress unused var lint if compilers complain
    void sunday;
  });
  return Array.from(days).sort();
}

export function setAgDaysForWeek(weekKey: string, agDays: number[], source: AgWeekOverride["source"] = "manual"): void {
  const all = getAgWeekOverrides();
  all[weekKey] = { weekKey, agDays, source };
  save(AG_WEEKS_KEY, all);
}

export function clearAgWeekOverride(weekKey: string): void {
  const all = getAgWeekOverrides();
  delete all[weekKey];
  save(AG_WEEKS_KEY, all);
}

// === Dokumente (localStorage, base64 — MVP, später ggf. Supabase Storage) ===

export interface StoredDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string; // base64 data URL
  uploadedAt: string;
  tags: string[];
  includeInNextPlan: boolean;
  summary?: string;
  textContent?: string; // extrahierter Plaintext (PDF/DOCX/XLSX), max 15000 Zeichen
}

const DOCUMENTS_KEY = STORAGE_KEYS.documents;

export function getDocuments(): StoredDocument[] {
  return load<StoredDocument[]>(DOCUMENTS_KEY, []);
}

export function addDocument(doc: Omit<StoredDocument, "id" | "uploadedAt">): StoredDocument {
  const all = getDocuments();
  const created: StoredDocument = { ...doc, id: crypto.randomUUID(), uploadedAt: new Date().toISOString() };
  all.unshift(created);
  save(DOCUMENTS_KEY, all);
  return created;
}

export function updateDocument(id: string, updates: Partial<StoredDocument>): void {
  const all = getDocuments();
  const idx = all.findIndex((d) => d.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...updates };
  save(DOCUMENTS_KEY, all);
}

export function removeDocument(id: string): StoredDocument[] {
  const all = getDocuments().filter(d => d.id !== id);
  save(DOCUMENTS_KEY, all);
  return all;
}

export function toggleDocumentInclude(id: string): StoredDocument[] {
  const all = getDocuments();
  const idx = all.findIndex(d => d.id === id);
  if (idx >= 0) all[idx].includeInNextPlan = !all[idx].includeInNextPlan;
  save(DOCUMENTS_KEY, all);
  return all;
}

// === Tages-Aufgaben (persistent pro Tag) ===

export interface DailyTask {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  done: boolean;
  doneAt?: string;
  linkedTopicId?: string;
  /** Mehrere Topics pro Task — z.B. wenn Rep an einem Tag 3 Themen abdeckt,
   *  oder bei manueller Aufgabe "klausur Zivilurteil Mietrecht Eigenbedarf".
   *  linkedTopicId bleibt für Single-Topic-Tasks (Tagesprogramm-Auto-Picks). */
  linkedTopicIds?: string[];
  /** Beschreibung des Inhalts (aus Rep-Schedule oder Lerngruppen-Eintragung).
   *  Wird in der UI als Untertitel angezeigt. */
  contentSummary?: string;
  /** Wenn die Task eine Klausur ist: ID aus der Klausuren-DB.
   *  Beim Abhaken öffnet sich der Eintragen-Dialog (Rating, Topics, Boost). */
  linkedKlausurId?: string;
  calendarEventId?: string;
  klausurMode?: "written" | "read";
  /** Preserved overflow: visible in the backlog, excluded from daily workload. */
  deferred?: boolean;
  rescheduledFrom?: string;
  /** Geplante Dauer in Minuten. Wenn gesetzt, zählen Zeitbudget + Lernkalender
   *  diese Dauer statt der 1.5h-Pauschale (z.B. Skizze 120, Klausur 300). */
  durationMinutes?: number;
  /** auto = nach Datum, Lernstand und Abschnitt; plan = aus KI-Lernplan; manual = eigene Aufgabe */
  source: "auto" | "manual" | "plan";
  /** Identifies the phase configuration used for an automatic suggestion. */
  studySuggestionKey?: string;
  isReview?: boolean;
  createdAt: string;
  trackingEntryId?: string;
  /** ISO-Timestamp wann diese Task an die Fortschritts-Bewertungs-KI gegeben wurde.
   *  Verhindert doppelte Auswertung beim erneuten Auslösen. */
  reviewedAt?: string;
  /** Stabiler Schlüssel für wiederkehrende Termine (z.B. "lerngruppe|2026-05-12").
   *  Wird von materializeRecurringTermine genutzt: Idempotenz-Check via recurringKey
   *  statt via Titel, damit Titel-Änderungen (Reverse-Flow, manuelle Edits) keinen
   *  Duplikat-Termin erzeugen. */
  recurringKey?: string;
}

const TASKS_KEY = STORAGE_KEYS.tasks;

export function getTasks(): DailyTask[] {
  return load<DailyTask[]>(TASKS_KEY, []);
}

export function getTasksForDate(date: string): DailyTask[] {
  return getTasks().filter((t) => t.date === date && !t.deferred);
}

export function getTasksSince(daysBack: number): DailyTask[] {
  const cutoff = currentDate();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = localDate(cutoff);
  return getTasks().filter((t) => t.date >= cutoffStr);
}

export function addTask(task: Omit<DailyTask, "id" | "createdAt" | "done">): DailyTask[] {
  const all = getTasks();
  all.unshift({
    ...task,
    id: crypto.randomUUID(),
    done: false,
    createdAt: new Date().toISOString(),
  });
  if (!save(TASKS_KEY, all)) throw new Error("Aufgaben konnten nicht gespeichert werden. Bitte Browserspeicher prüfen und Backup sichern.");
  return all;
}

export function updateTask(id: string, updates: Partial<DailyTask>): DailyTask[] {
  const all = getTasks();
  const idx = all.findIndex((t) => t.id === id);
  if (idx >= 0) all[idx] = { ...all[idx], ...updates };
  if (!save(TASKS_KEY, all)) throw new Error("Aufgaben konnten nicht gespeichert werden. Bitte Browserspeicher prüfen und Backup sichern.");
  return all;
}

/**
 * Markiert eine Liste von Tasks als "von KI-Review gesehen" (reviewedAt = now).
 * Damit erscheinen sie beim nächsten Review-Lauf nicht mehr im Kontext.
 * Idempotent: vorhandene reviewedAt werden überschrieben (neuestes Datum gewinnt).
 */
export function markTasksReviewed(ids: string[]): DailyTask[] {
  if (ids.length === 0) return getTasks();
  const set = new Set(ids);
  const now = new Date().toISOString();
  const all = getTasks();
  let changed = false;
  for (const t of all) {
    if (set.has(t.id)) {
      t.reviewedAt = now;
      changed = true;
    }
  }
  if (changed) save(TASKS_KEY, all);
  return all;
}

export function removeTask(id: string): DailyTask[] {
  const all = getTasks();
  const target = all.find((t) => t.id === id);
  // Cascade: verlinkten TrackingEntry mit löschen, sonst bleibt Phantom-Tracking liegen
  if (target?.trackingEntryId) {
    const tracking = getTrackingEntries().filter((e) => e.id !== target.trackingEntryId);
    save(STORAGE_KEYS.tracking, tracking);
  }
  const filtered = all.filter((t) => t.id !== id);
  save(TASKS_KEY, filtered);
  return filtered;
}

/**
 * Abhaken einer Aufgabe: erzeugt TrackingEntry (theorie, 30 min default),
 * schreibt KEINEN Progress-Bump — Progress kommt später via KI-Review.
 */
export function completeTask(id: string, durationMinutes?: number, recallRating?: import("./spaced-repetition").RecallRating): DailyTask[] {
  const all = getTasks();
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) return all;
  const t = all[idx];
  if (t.done) return all;
  const now = new Date().toISOString();

  // TrackingEntry erzeugen
  const topicIds = Array.from(new Set([...(t.linkedTopicIds ?? []), ...(t.linkedTopicId ? [t.linkedTopicId] : [])]));
  const trackingAll = getTrackingEntries();
  const trackingEntry: TrackingEntry = {
    id: crypto.randomUUID(),
    date: t.date,
    activityType: t.isReview ? "wiederholung" : "theorie",
    recallRating,
    topicIds,
    durationMinutes: durationMinutes ?? taskMinutes(t),
    note: `[Task] ${t.title}`,
    createdAt: now,
  };
  trackingAll.unshift(trackingEntry);
  all[idx] = { ...t, done: true, doneAt: now, trackingEntryId: trackingEntry.id };
  restoreStorage(localStorage, [[STORAGE_KEYS.tracking, trackingAll], [TASKS_KEY, all]]);
  return all;
}

export function uncompleteTask(id: string): DailyTask[] {
  const all = getTasks();
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) return all;
  const t = all[idx];
  // Tracking-Entry zurücknehmen
  const tracking = getTrackingEntries().filter((e) => e.id !== t.trackingEntryId);
  // reviewedAt zurücksetzen: das Abhaken wird semantisch rückgängig gemacht,
  // also soll die Task beim nächsten Mal wieder bewertbar sein.
  all[idx] = { ...t, done: false, doneAt: undefined, trackingEntryId: undefined, reviewedAt: undefined };
  restoreStorage(localStorage, [[STORAGE_KEYS.tracking, tracking], [TASKS_KEY, all]]);
  return all;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// === KI-Akzeptanz-Metrik ===
// Trackt wie oft KI-Vorschläge akzeptiert/abgelehnt werden — für späteres Prompt-Tuning.

const AI_METRIC_KEY = STORAGE_KEYS.aiMetrics;

export interface AiMetrics {
  proposalsAccepted: number;
  proposalsRejected: number;
  plansApplied: number;
  plansUndone: number;
}

const DEFAULT_METRICS: AiMetrics = {
  proposalsAccepted: 0, proposalsRejected: 0,
  plansApplied: 0, plansUndone: 0,
};

export function getAiMetrics(): AiMetrics {
  return load<AiMetrics>(AI_METRIC_KEY, DEFAULT_METRICS);
}

export function bumpAiMetric(field: keyof AiMetrics, by = 1): void {
  const m = getAiMetrics();
  m[field] = (m[field] || 0) + by;
  save(AI_METRIC_KEY, m);
}

// === Backup / Restore ===
// Alle bekannten lerntracker-* keys für Export/Import.

// ─── Plan Applied Range ──────────────────────────────────────────────────────

export interface PlanAppliedRange {
  start: string; // "YYYY-MM-DD"
  end: string;   // "YYYY-MM-DD"
  appliedAt: string; // ISO
}

export function setPlanAppliedRange(range: PlanAppliedRange | null): void {
  save(STORAGE_KEYS.planAppliedRange, range);
}

export function getPlanAppliedRange(): PlanAppliedRange | null {
  return load<PlanAppliedRange | null>(STORAGE_KEYS.planAppliedRange, null);
}

export function isTodayInPlanRange(today: string): boolean {
  const range = getPlanAppliedRange();
  if (!range) return false;
  return today >= range.start && today <= range.end;
}

/**
 * Löscht alle plan-bezogenen Daten — für "kompletten Neustart" im Onboarding.
 * Behält: Klausuren-DB, Progress, Tracking-Einträge, Lern-Notizen, Materialien (Dokumente).
 * Löscht: Tasks (auto + plan, NICHT manuelle), Calendar-Events vom Typ klausur,
 *         Plan-Applied-Range, Onboarding AI-Result, Plan-Historie.
 */
export function wipePlanData(opts: { keepManualTasks?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  const keepManual = opts.keepManualTasks ?? true;
  // Tasks: nur auto/plan Tasks entfernen, manuelle behalten (sofern keepManual=true)
  const tasks = getTasks();
  const filtered = keepManual
    ? tasks.filter((t) => t.source === "manual")
    : [];
  save(STORAGE_KEYS.tasks, filtered);
  // Calendar-Events: nur KI-generierte Klausurtermine entfernen
  const events = getCalendarEvents();
  save(STORAGE_KEYS.calendar, events.filter((e) => e.eventType !== "klausur"));
  // Plan-Applied-Range
  if (window.localStorage) {
    localStorage.removeItem(STORAGE_KEYS.planAppliedRange);
    localStorage.removeItem(STORAGE_KEYS.onboardingAiResult);
    localStorage.removeItem(STORAGE_KEYS.planHistory);
    // Klausur-Empfehlungs-Cache: alle Tageskeys löschen
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(STORAGE_KEYS.klausurRecPrefix)) localStorage.removeItem(k);
    });
  }
}

const ALL_BACKUP_KEYS = [
  STORAGE_KEYS.progress,
  STORAGE_KEYS.entries,
  STORAGE_KEYS.calendar,
  STORAGE_KEYS.examDate,
  STORAGE_KEYS.klausuren,
  STORAGE_KEYS.tracking,
  STORAGE_KEYS.recommenderWeights,
  STORAGE_KEYS.onboarding,
  STORAGE_KEYS.onboardingAiResult,
  STORAGE_KEYS.theme,
  STORAGE_KEYS.agWeeks,
  STORAGE_KEYS.documents,
  STORAGE_KEYS.tasks,
  STORAGE_KEYS.aiMetrics,
  STORAGE_KEYS.lernstart,
  STORAGE_KEYS.prompts,
  STORAGE_KEYS.planHistory,
  STORAGE_KEYS.planAppliedRange,
  STORAGE_KEYS.klausurDrafts,
  STORAGE_KEYS.fehlerProfil,
  STORAGE_KEYS.korrekturSettings,
  STORAGE_KEYS.planModel,
  STORAGE_KEYS.aiReasoning,
  STORAGE_KEYS.freitext,
];

// === Persönlicher Denkaufwand je Modell ===
export function getAiReasoningSettings(): ReasoningSettings {
  return normalizeReasoningSettings(load<unknown>(STORAGE_KEYS.aiReasoning, {}));
}

export function saveAiReasoningSettings(settings: ReasoningSettings): boolean {
  return save(STORAGE_KEYS.aiReasoning, normalizeReasoningSettings(settings));
}

// === Plan-Modell (Modellwahl für die Lernplan-Anpassung) ===

export function getPlanModel(): string {
  const id = load<string>(STORAGE_KEYS.planModel, DEFAULT_PLAN_MODEL);
  return PLAN_MODELS.some(model => model.id === id) ? id : DEFAULT_PLAN_MODEL;
}

export function setPlanModel(id: string): void {
  save(STORAGE_KEYS.planModel, id);
}

// === Freitext / Notizblock (leerer TextEdit-Modus) ===

/** Ein einzelner, immer vorhandener Notizblock fürs freie Schreiben. */
export interface Freitext {
  html: string;
  text: string;
  updatedAt: string;
}

export function getFreitext(): Freitext {
  return load<Freitext>(STORAGE_KEYS.freitext, { html: "", text: "", updatedAt: "" });
}

export function saveFreitext(html: string, text: string): boolean {
  return save(STORAGE_KEYS.freitext, { html, text, updatedAt: new Date().toISOString() });
}

export interface BackupBundle {
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function exportAll(): BackupBundle {
  const data: Record<string, unknown> = {};
  if (typeof window === "undefined") return { version: 1, exportedAt: new Date().toISOString(), data };
  for (const key of ALL_BACKUP_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
    }
  }
  markBackupDone();
  return { version: 1, exportedAt: new Date().toISOString(), data };
}

export function importAll(bundle: BackupBundle): { restored: number } {
  if (!bundle || bundle.version !== 1 || !bundle.data || typeof bundle.data !== "object" || Array.isArray(bundle.data)) {
    throw new Error("Ungültiges Backup-Format");
  }
  const arrayKeys: string[] = [STORAGE_KEYS.entries, STORAGE_KEYS.calendar, STORAGE_KEYS.klausuren,
    STORAGE_KEYS.tracking, STORAGE_KEYS.documents, STORAGE_KEYS.tasks, STORAGE_KEYS.planHistory, STORAGE_KEYS.klausurDrafts, STORAGE_KEYS.prompts];
  const stringKeys: string[] = [STORAGE_KEYS.examDate, STORAGE_KEYS.lernstart, STORAGE_KEYS.theme, STORAGE_KEYS.planModel];
  const allowed = new Set<string>(ALL_BACKUP_KEYS);
  const entries = Object.entries(bundle.data).filter(([key]) => allowed.has(key));
  for (const [key, value] of entries) {
    const valid = key === STORAGE_KEYS.planAppliedRange && value === null ? true : stringKeys.includes(key) ? typeof value === "string"
      : arrayKeys.includes(key) ? Array.isArray(value)
      : value !== null && typeof value === "object" && !Array.isArray(value);
    if (!valid) throw new Error(`Ungültiger Datenbereich im Backup: ${key}`);
  }
  if (!entries.length) throw new Error("Das Backup enthält keine bekannten Datenbereiche.");
  const restored = restoreStorage(localStorage, entries);
  // Recommendation caches are derived data, never restore stale cached decisions.
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(STORAGE_KEYS.klausurRecPrefix)) localStorage.removeItem(key);
  }
  return { restored };
}

// === Backup Reminder ===

const LAST_BACKUP_KEY = STORAGE_KEYS.lastBackup;

export function getLastBackupDate(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_BACKUP_KEY);
}

export function markBackupDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
}

export function isBackupOverdue(days = 3): boolean {
  const last = getLastBackupDate();
  if (!last) return true;
  const diff = Date.now() - new Date(last).getTime();
  return diff > days * 24 * 60 * 60 * 1000;
}

// === Klausur-Schreibtraining: Entwürfe ===

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getKlausurDrafts(): KlausurDraft[] {
  return load<KlausurDraft[]>(STORAGE_KEYS.klausurDrafts, []);
}

export function getKlausurDraftById(id: string): KlausurDraft | undefined {
  return getKlausurDrafts().find((d) => d.id === id);
}

/** Upsert eines Entwurfs; setzt id/createdAt bei neuen, touched updatedAt immer. */
export function saveKlausurDraft(draft: KlausurDraft): KlausurDraft {
  const all = getKlausurDrafts();
  const now = new Date().toISOString();
  const idx = all.findIndex((d) => d.id === draft.id);
  const merged: KlausurDraft = {
    ...draft,
    id: draft.id || newId(),
    createdAt: draft.createdAt || now,
    updatedAt: now,
  };
  if (idx >= 0) all[idx] = merged;
  else all.unshift(merged);
  if (!save(STORAGE_KEYS.klausurDrafts, all)) throw new Error("Entwurf konnte nicht gespeichert werden. Bitte Text sichern und Browserspeicher prüfen.");
  return merged;
}

export function removeKlausurDraft(id: string): void {
  save(STORAGE_KEYS.klausurDrafts, getKlausurDrafts().filter((d) => d.id !== id));
}

/**
 * Liefert den (ersten) Entwurf, der mit dieser Klausur verknüpft ist, oder legt
 * einen neuen an (Titel/Rechtsgebiet/Typ vorbelegt, klausurId gesetzt). So springt
 * der „Im Tool schreiben"-Button aus der Klausur-DB immer in denselben Entwurf,
 * statt bei jedem Klick ein Duplikat zu erzeugen.
 */
export function getOrCreateDraftForKlausur(
  klausur: Pick<Klausur, "id" | "title" | "area" | "type">,
): KlausurDraft {
  const existing = getKlausurDrafts().find((d) => d.klausurId === klausur.id);
  if (existing) return existing;
  return saveKlausurDraft({
    id: "",
    title: klausur.title,
    area: klausur.area,
    type: klausur.type,
    klausurId: klausur.id,
    sachverhalt: "",
    contentHtml: "",
    contentText: "",
    feedback: [],
    createdAt: "",
    updatedAt: "",
  });
}

// === Klausur-Schreibtraining: lernendes Fehlerprofil (Ebene 3) ===

export function getFehlerProfil(): FehlerProfil {
  return load<FehlerProfil>(STORAGE_KEYS.fehlerProfil, { markers: {}, updatedAt: new Date(0).toISOString() });
}

/**
 * Zählt erkannte Marker ins Profil hoch. trend wird aus dem vorherigen count abgeleitet:
 * neu → erstes Auftreten, steigend → erneut gesehen. lastSeen + optionaler byType-Zähler.
 */
export function mergeFehlerMarkers(markers: FehlerMarker[], type?: KlausurType): FehlerProfil {
  const profil = getFehlerProfil();
  const now = new Date().toISOString();
  for (const m of markers) {
    if (!m.key || ["__proto__", "prototype", "constructor"].includes(m.key)) continue;
    const prev = profil.markers[m.key];
    const count = (prev?.count ?? 0) + 1;
    const byType = { ...(prev?.byType ?? {}) };
    if (type) byType[type] = (byType[type] ?? 0) + 1;
    profil.markers[m.key] = {
      label: m.label || prev?.label || m.key,
      count,
      trend: prev ? "steigend" : "neu",
      lastSeen: now,
      byType,
    };
  }
  profil.updatedAt = now;
  save(STORAGE_KEYS.fehlerProfil, profil);
  return profil;
}

export function resetFehlerProfil(): void {
  save(STORAGE_KEYS.fehlerProfil, { markers: {}, updatedAt: new Date().toISOString() });
}

// === Klausur-Schreibtraining: Korrektur-Einstellungen ===

const DEFAULT_KORREKTUR_SETTINGS: KorrekturSettings = {
  model: DEFAULT_KORREKTUR_MODEL,
  granularity: "manuell" as KorrekturGranularity,
};

export function getKorrekturSettings(): KorrekturSettings {
  const settings = { ...DEFAULT_KORREKTUR_SETTINGS, ...load<Partial<KorrekturSettings>>(STORAGE_KEYS.korrekturSettings, {}) };
  // Upgrade the replaced Opus version without rewriting the saved user data.
  return settings.model === "anthropic/claude-opus-4.8" ? { ...settings, model: AI_DEFAULTS.premium.id } : settings;
}

export function saveKorrekturSettings(settings: KorrekturSettings): void {
  save(STORAGE_KEYS.korrekturSettings, settings);
}
