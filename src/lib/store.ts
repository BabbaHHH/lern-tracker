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
