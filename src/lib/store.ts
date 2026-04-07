import { Progress, LearningEntry, CalendarEvent, ScheduleItem, Klausur, TrackingEntry } from "./types";

const STORAGE_KEYS = {
  progress: "lerntracker-progress",
  entries: "lerntracker-entries",
  calendar: "lerntracker-calendar",
  schedule: "lerntracker-schedule",
  examDate: "lerntracker-exam-date",
  klausuren: "lerntracker-klausuren",
  tracking: "lerntracker-tracking",
  recommenderWeights: "lerntracker-recommender-weights",
} as const;

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
  localStorage.setItem(key, JSON.stringify(data));
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

// === Schedule ===

export function getSchedule(): ScheduleItem[] {
  return load<ScheduleItem[]>(STORAGE_KEYS.schedule, []);
}

export function updateScheduleItem(item: ScheduleItem): ScheduleItem[] {
  const all = getSchedule();
  const idx = all.findIndex(s => s.id === item.id);
  if (idx >= 0) {
    all[idx] = item;
  } else {
    all.push(item);
  }
  save(STORAGE_KEYS.schedule, all);
  return all;
}

// === Exam Date ===

export function getExamDate(): string {
  return load<string>(STORAGE_KEYS.examDate, "2026-09-03");
}

export function getLernstart(): string {
  return load<string>("lerntracker-lernstart", "2026-04-06");
}

export function setLernstart(date: string): void {
  save("lerntracker-lernstart", date);
}

// === Onboarding ===

export interface OnboardingData {
  completed: boolean;
  bundesland: string;
  examDate: string;
  lernstart: string;
  agDay: string;
  agTopic: string;
  repDay: string;
  kaiserDates: string[];
  probeexamen1Start: string;
  probeexamen2Start: string;
  freeDayPerWeek: string;
  vacationDates: string[];
  selfAssessment: Record<string, number>;
  documents: { name: string; type: string; summary?: string }[];
  notes: string;
}

const ONBOARDING_KEY = "lerntracker-onboarding";

const DEFAULT_ONBOARDING: OnboardingData = {
  completed: false,
  bundesland: "Berlin",
  examDate: "2026-09-03",
  lernstart: "2026-04-06",
  agDay: "Montag",
  agTopic: "",
  repDay: "Mittwoch",
  kaiserDates: [],
  probeexamen1Start: "2026-06-01",
  probeexamen2Start: "2026-07-06",
  freeDayPerWeek: "Sonntag",
  vacationDates: [],
  selfAssessment: {},
  documents: [],
  notes: "",
};

export function getOnboarding(): OnboardingData {
  return load<OnboardingData>(ONBOARDING_KEY, DEFAULT_ONBOARDING);
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

export function addKlausur(klausur: Omit<Klausur, "id" | "createdAt" | "updatedAt">): Klausur[] {
  const all = getKlausuren();
  const now = new Date().toISOString();
  all.push({ ...klausur, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
  save(STORAGE_KEYS.klausuren, all);
  return all;
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

const THEME_KEY = "lerntracker-theme";

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

const AG_WEEKS_KEY = "lerntracker-ag-weeks";

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

export function getAgDaysForWeek(weekKey: string): number[] {
  const overrides = getAgWeekOverrides();
  if (overrides[weekKey]) return overrides[weekKey].agDays;
  // Fallback: onboarding.agDay
  const fallbackDay = getOnboarding().agDay;
  const idx = WEEKDAY_TO_INDEX[fallbackDay];
  return idx !== undefined ? [idx] : [];
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
}

const DOCUMENTS_KEY = "lerntracker-documents";

export function getDocuments(): StoredDocument[] {
  return load<StoredDocument[]>(DOCUMENTS_KEY, []);
}

export function addDocument(doc: Omit<StoredDocument, "id" | "uploadedAt">): StoredDocument[] {
  const all = getDocuments();
  all.unshift({ ...doc, id: crypto.randomUUID(), uploadedAt: new Date().toISOString() });
  save(DOCUMENTS_KEY, all);
  return all;
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
  source: "auto" | "manual";
  createdAt: string;
  trackingEntryId?: string;
}

const TASKS_KEY = "lerntracker-tasks";

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
  const all = getTasks().filter((t) => t.id !== id);
  save(TASKS_KEY, all);
  return all;
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
