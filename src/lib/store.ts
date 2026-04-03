import { Progress, LearningEntry, CalendarEvent, ScheduleItem } from "./types";

const STORAGE_KEYS = {
  progress: "lerntracker-progress",
  entries: "lerntracker-entries",
  calendar: "lerntracker-calendar",
  schedule: "lerntracker-schedule",
  examDate: "lerntracker-exam-date",
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
  return load<string>(STORAGE_KEYS.examDate, "2026-10-26");
}

export function setExamDate(date: string): void {
  save(STORAGE_KEYS.examDate, date);
}
