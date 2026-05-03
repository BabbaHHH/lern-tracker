import { Progress, LearningEntry, CalendarEvent, Klausur, KlausurType, TrackingEntry } from "./types";

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

function save<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
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
): KlausurBoostPreview[] {
  const all = getProgress();
  return topicIds.map(tid => {
    const before = all[tid]?.percent ?? 0;
    const rawDelta = calculateKlausurDelta(before, rating);
    const after = Math.min(95, before + rawDelta);
    return { topicId: tid, before, after, delta: after - before };
  });
}

export function applyKlausurProgressBoosts(
  topicIds: string[],
  rating: number,
): KlausurBoostPreview[] {
  const all = getProgress();
  const now = new Date().toISOString();
  const applied: KlausurBoostPreview[] = [];
  for (const tid of topicIds) {
    const before = all[tid]?.percent ?? 0;
    const rawDelta = calculateKlausurDelta(before, rating);
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
  return load<string>(STORAGE_KEYS.examDate, "2026-09-03");
}

export function getLernstart(): string {
  return load<string>(STORAGE_KEYS.lernstart, "2026-04-06");
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
  name: string;
  type: string;
  summary?: string;
  description?: string;
  topicIds?: string[];
}

export interface OnboardingData {
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
  vacationDates: string[];
  selfAssessment: Record<string, number>;
  documents: OnboardingDocument[];
  notes: string;
}

const ONBOARDING_KEY = STORAGE_KEYS.onboarding;

const DEFAULT_ONBOARDING: OnboardingData = {
  completed: false,
  bundesland: "Berlin",
  examDate: "2026-09-03",
  lernstart: "2026-04-06",
  ags: [],
  lerngruppen: [],
  reps: [],
  sonstiges: [],
  kaiserSeminare: [],
  probeexamen1Start: "2026-06-01",
  probeexamen2Start: "2026-07-06",
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

export function saveOnboarding(data: OnboardingData): void {
  save(ONBOARDING_KEY, data);
}

export function resetOnboarding(): void {
  save(ONBOARDING_KEY, DEFAULT_ONBOARDING);
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
  save(STORAGE_KEYS.tracking, all);
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

export interface MarkKlausurWrittenOpts {
  rating: number;
  /** Datum der Klausur — Default: heute */
  date?: string;
  /** Notizen — Default: "" */
  note?: string;
  /** Welche Topics decken diese Klausur ab? Default: alle Topics der Klausur (gefiltert auf gültige Leaves) */
  topicIds?: string[];
  /** Tatsächliche Dauer der Klausur — Default: DEFAULT_KLAUSUR_DURATION_MIN (300) */
  durationMinutes?: number;
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
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const note = opts.note ?? "";
  const durationMinutes = opts.durationMinutes ?? DEFAULT_KLAUSUR_DURATION_MIN;
  const requested = opts.topicIds ?? klausur.topicIds;
  const validIds = requested.filter(id => opts.validLeafIds.has(id));

  addTrackingEntry({
    date,
    activityType: "klausur",
    topicIds: validIds,
    klausurId: klausur.id,
    durationMinutes,
    rating: opts.rating,
    note,
  });

  const boosts = validIds.length > 0
    ? applyKlausurProgressBoosts(validIds, opts.rating)
    : [];

  return { boosts };
}

// === Recommender Gewichte ===

export interface RecommenderWeights {
  tagesplanOverlap: number;
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
  tagesplanOverlap: 40,
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
  schwacheThemen: "Schwache Themen abdecken (pro Thema)",
  nochNieGeschrieben: "Noch nie geschrieben",
  spacedRepetition: "Spaced Repetition (pro Thema >14d)",
  rechtsgebietsBalance: "Rechtsgebiets-Balance (3:2:2)",
  kuerzlichGeschrieben: "Kürzlich geschrieben (<7 Tage)",
  schwierigkeitsMatch: "Schwierigkeits-Match",
  neuheitsBonus: "Neuheits-Bonus (neuere Klausuren)",
  wiederholungsDistanz: "Gute Wiederholungs-Distanz (>21d)",
  anspruchsgrundlagenFrische: "Anspruchsgrundlagen-Frische (pro AG >21d)",
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

const WEEKDAY_TO_INDEX: Record<string, number> = {
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

/** Anzahl ganzer Wochen zwischen zwei Daten (Montag → Montag) */
function weeksBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 86400000));
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

    // Frequenz-Logik
    switch (ag.frequency) {
      case "wöchentlich":
      case "2x/Woche":
        days.add(idx);
        break;
      case "14-tägig": {
        // Anchor: erste mögliche Woche (Start-Datum oder erste Woche überhaupt)
        const anchorMonday = ag.startDate
          ? weekKeyToMonday(getWeekKey(new Date(ag.startDate + "T00:00:00Z")))
          : monday;
        if (anchorMonday && weeksBetween(anchorMonday, monday) % 2 === 0) {
          days.add(idx);
        }
        break;
      }
      case "unregelmäßig":
      case "selten":
        // Kein Auto-Add — nur via Override.
        break;
      default:
        days.add(idx);
    }

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
  /** Wenn die Task eine Klausur ist: ID aus der Klausuren-DB.
   *  Beim Abhaken öffnet sich der Eintragen-Dialog (Rating, Topics, Boost). */
  linkedKlausurId?: string;
  /** auto = zufällig aus schwachen Themen; plan = aus KI-Lernplan; manual = manuell */
  source: "auto" | "manual" | "plan";
  createdAt: string;
  trackingEntryId?: string;
}

const TASKS_KEY = STORAGE_KEYS.tasks;

export function getTasks(): DailyTask[] {
  return load<DailyTask[]>(TASKS_KEY, []);
}

export function getTasksForDate(date: string): DailyTask[] {
  return getTasks().filter((t) => t.date === date);
}

export function getTasksSince(daysBack: number): DailyTask[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
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
  save(TASKS_KEY, all);
  return all;
}

export function updateTask(id: string, updates: Partial<DailyTask>): DailyTask[] {
  const all = getTasks();
  const idx = all.findIndex((t) => t.id === id);
  if (idx >= 0) all[idx] = { ...all[idx], ...updates };
  save(TASKS_KEY, all);
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
export function completeTask(id: string, durationMinutes = 30): DailyTask[] {
  const all = getTasks();
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) return all;
  const t = all[idx];
  if (t.done) return all;
  const now = new Date().toISOString();

  // TrackingEntry erzeugen
  const topicIds = t.linkedTopicId ? [t.linkedTopicId] : [];
  const trackingAll = getTrackingEntries();
  const trackingEntry: TrackingEntry = {
    id: crypto.randomUUID(),
    date: t.date,
    activityType: "theorie",
    topicIds,
    durationMinutes,
    note: `[Task] ${t.title}`,
    createdAt: now,
  };
  trackingAll.unshift(trackingEntry);
  save(STORAGE_KEYS.tracking, trackingAll);

  all[idx] = { ...t, done: true, doneAt: now, trackingEntryId: trackingEntry.id };
  save(TASKS_KEY, all);
  return all;
}

export function uncompleteTask(id: string): DailyTask[] {
  const all = getTasks();
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) return all;
  const t = all[idx];
  // Tracking-Entry zurücknehmen
  if (t.trackingEntryId) {
    const tracking = getTrackingEntries().filter((e) => e.id !== t.trackingEntryId);
    save(STORAGE_KEYS.tracking, tracking);
  }
  all[idx] = { ...t, done: false, doneAt: undefined, trackingEntryId: undefined };
  save(TASKS_KEY, all);
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

export function setPlanAppliedRange(range: PlanAppliedRange): void {
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
];

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
  if (!bundle || bundle.version !== 1 || !bundle.data) {
    throw new Error("Ungültiges Backup-Format");
  }
  let restored = 0;
  for (const [key, value] of Object.entries(bundle.data)) {
    if (!key.startsWith("lerntracker-")) continue;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      restored++;
    } catch { /* ignore single failure */ }
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
