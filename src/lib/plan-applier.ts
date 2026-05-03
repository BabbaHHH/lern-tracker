// Parsed strukturierte Plan-Outputs aus Opus und schreibt sie in Tasks + Calendar.

import {
  addTask, addCalendarEvent, getCalendarEvents, removeCalendarEvent,
  removeTask, getTasks, STORAGE_KEYS,
} from "@/lib/store";
import type { Area } from "@/lib/types";

export interface PlanTask {
  date: string;
  title: string;
  topicId?: string;
  minutes?: number;
}

export interface PlanKlausur {
  date: string;
  label: string;
  area: Area;
}

export interface StructuredPlan {
  tasks: PlanTask[];
  klausuren: PlanKlausur[];
}

/** Extrahiert den letzten ```json … ``` Block aus dem Markdown-Output. */
export function parseStructuredPlan(reply: string): StructuredPlan | null {
  if (!reply) return null;
  // Letzter ```json ... ``` Block (bevorzugt explizit markiert)
  const jsonBlocks = [...reply.matchAll(/```json\s*([\s\S]*?)```/gi)];
  let raw: string | null = null;
  if (jsonBlocks.length > 0) {
    raw = jsonBlocks[jsonBlocks.length - 1][1].trim();
  } else {
    // Fallback: irgendein ``` block
    const anyBlocks = [...reply.matchAll(/```\s*([\s\S]*?)```/g)];
    if (anyBlocks.length > 0) raw = anyBlocks[anyBlocks.length - 1][1].trim();
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StructuredPlan>;
    if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.klausuren)) return null;
    return {
      tasks: parsed.tasks.filter((t) => t && t.date && t.title),
      klausuren: parsed.klausuren.filter((k) => k && k.date && k.label && k.area),
    };
  } catch {
    return null;
  }
}

/** Entfernt den JSON-Block aus dem Markdown — für die UI-Anzeige. */
export function stripJsonBlock(reply: string): string {
  return reply.replace(/```json\s*[\s\S]*?```/gi, "").trim();
}

// === Plan-Historie (letzte 3) ===

const HISTORY_KEY = STORAGE_KEYS.planHistory;
const MAX_HISTORY = 3;

export interface PlanHistoryEntry {
  id: string;
  createdAt: string;
  reply: string;
  structured: StructuredPlan | null;
}

export function savePlanToHistory(reply: string, structured: StructuredPlan | null): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: PlanHistoryEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      reply,
      structured,
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

export function getPlanHistory(): PlanHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export interface ApplyResult {
  tasksCreated: number;
  klausurenCreated: number;
  klausurenSkipped: number;
  /** IDs zum späteren Undo */
  createdTaskIds: string[];
  createdEventIds: string[];
}

/** Schreibt Tasks + Klausuren in den Store. Dedupliziert Klausuren auf (date, label). */
export function applyStructuredPlan(plan: StructuredPlan): ApplyResult {
  const result: ApplyResult = {
    tasksCreated: 0, klausurenCreated: 0, klausurenSkipped: 0,
    createdTaskIds: [], createdEventIds: [],
  };

  // Tasks: Diff via getTasks() vor/nach
  for (const t of plan.tasks) {
    const before = new Set(getTasks().map((x) => x.id));
    addTask({
      date: t.date,
      title: t.title,
      linkedTopicId: t.topicId || undefined,
      source: "auto",
    });
    const after = getTasks();
    const newOne = after.find((x) => !before.has(x.id));
    if (newOne) result.createdTaskIds.push(newOne.id);
    result.tasksCreated++;
  }

  for (const k of plan.klausuren) {
    const existing = getCalendarEvents();
    const dup = existing.some((e) => e.date === k.date && e.label === k.label);
    if (dup) { result.klausurenSkipped++; continue; }
    const before = new Set(existing.map((e) => e.id));
    addCalendarEvent({
      date: k.date,
      eventType: "klausur",
      label: k.label,
      recurring: false,
    });
    const after = getCalendarEvents();
    const newOne = after.find((e) => !before.has(e.id));
    if (newOne) result.createdEventIds.push(newOne.id);
    result.klausurenCreated++;
  }
  return result;
}

/** Macht ein vorheriges applyStructuredPlan rückgängig. */
export function undoApply(applied: { createdTaskIds: string[]; createdEventIds: string[] }): void {
  for (const id of applied.createdTaskIds) removeTask(id);
  for (const id of applied.createdEventIds) removeCalendarEvent(id);
}
