// Parsed strukturierte Plan-Outputs aus Opus und schreibt sie in Tasks + Calendar.

import {
  addTask, addCalendarEvent, getCalendarEvents, removeCalendarEvent,
  removeTask, getTasks, STORAGE_KEYS, setPlanAppliedRange,
  getOnboarding, WEEKDAY_TO_INDEX,
} from "@/lib/store";
import type { Area } from "@/lib/types";

// ─── Recurring Termine Materialisierung ──────────────────────────────────────

interface RecurringTermin {
  label: string;
  day: string; // "Montag"|"Dienstag"|...
  frequency?: string; // "wöchentlich"|"alle 2 Wochen"|...
  durationHours: number;
  prepHours: number;
  postHours: number;
  startDate?: string;
  endDate?: string;
  kind: "ag" | "rep" | "lerngruppe" | "sonstiges";
}

function* eachDateInRange(start: string, end: string): Generator<Date> {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const cur = new Date(s);
  while (cur <= e) {
    yield new Date(cur);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function freqMatches(frequency: string | undefined, weekIdx: number): boolean {
  if (!frequency || frequency === "wöchentlich") return true;
  if (frequency === "alle 2 Wochen" || frequency === "zweiwöchentlich") return weekIdx % 2 === 0;
  if (frequency === "monatlich") return weekIdx % 4 === 0;
  return true;
}

/**
 * Erzeugt Tasks für wiederkehrende Termine (AG, Rep, Lerngruppe, Sonstiges) im Bereich [start, end].
 * Pro Termin: 1 Task am Termintag (Inhalt + Dauer) + optional Vorb./Nachb. Tasks.
 * Idempotent: prüft auf Duplikate via (date, title).
 */
export function materializeRecurringTermine(start: string, end: string): { created: number } {
  const o = getOnboarding();
  const termine: RecurringTermin[] = [
    ...(o.ags || []).map(a => ({ label: a.label, day: a.day, frequency: a.frequency, durationHours: a.durationHours, prepHours: a.prepHours, postHours: a.postHours, startDate: a.startDate, endDate: a.endDate, kind: "ag" as const })),
    ...(o.reps || []).map(r => ({ label: r.label, day: r.day, durationHours: r.durationHours, prepHours: r.prepHours, postHours: r.postHours, startDate: r.startDate, endDate: r.endDate, kind: "rep" as const })),
    ...(o.lerngruppen || []).map(l => ({ label: l.label, day: l.day, frequency: l.frequency, durationHours: l.durationHours, prepHours: l.prepHours, postHours: l.postHours, startDate: l.startDate, endDate: l.endDate, kind: "lerngruppe" as const })),
    ...(o.sonstiges || []).map(s => ({ label: s.label || "Sonstiger Termin", day: s.day, frequency: s.frequency, durationHours: s.durationHours, prepHours: 0, postHours: 0, startDate: s.startDate, endDate: s.endDate, kind: "sonstiges" as const })),
  ];

  const existing = getTasks();
  const existingKey = new Set(existing.map(t => `${t.date}|${t.title}`));
  let created = 0;
  let weekCounter = 0;

  for (const d of eachDateInRange(start, end)) {
    const dayIdx = (d.getUTCDay() + 6) % 7; // 0=Mo
    if (dayIdx === 0) weekCounter++;
    for (const t of termine) {
      const wantedIdx = WEEKDAY_TO_INDEX[t.day];
      if (wantedIdx === undefined || wantedIdx !== dayIdx) continue;
      if (t.startDate && isoDate(d) < t.startDate) continue;
      if (t.endDate && isoDate(d) > t.endDate) continue;
      if (!freqMatches(t.frequency, weekCounter)) continue;

      // Termin-Task am Termintag
      const dateStr = isoDate(d);
      const mainTitle = `${t.label} (${t.durationHours}h)`;
      if (!existingKey.has(`${dateStr}|${mainTitle}`)) {
        addTask({ date: dateStr, title: mainTitle, source: "plan" });
        existingKey.add(`${dateStr}|${mainTitle}`);
        created++;
      }
      // Vorbereitung am Vortag
      if (t.prepHours > 0) {
        const prep = new Date(d); prep.setUTCDate(prep.getUTCDate() - 1);
        const prepDate = isoDate(prep);
        const prepTitle = `Vorb. ${t.label} (${t.prepHours}h)`;
        if (prepDate >= start && !existingKey.has(`${prepDate}|${prepTitle}`)) {
          addTask({ date: prepDate, title: prepTitle, source: "plan" });
          existingKey.add(`${prepDate}|${prepTitle}`);
          created++;
        }
      }
      // Nachbereitung am Termintag (abends, gleicher Tag)
      if (t.postHours > 0) {
        const postTitle = `Nachb. ${t.label} (${t.postHours}h)`;
        if (!existingKey.has(`${dateStr}|${postTitle}`)) {
          addTask({ date: dateStr, title: postTitle, source: "plan" });
          existingKey.add(`${dateStr}|${postTitle}`);
          created++;
        }
      }
    }
  }
  return { created };
}

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

  // Plan-Datumsbereich ermitteln + speichern (damit TodayProgram weiß: "heute ist Freier Tag laut Plan")
  const allDates = plan.tasks.map((t) => t.date).concat(plan.klausuren.map((k) => k.date)).sort();
  if (allDates.length > 0) {
    const start = allDates[0];
    const end = allDates[allDates.length - 1];
    setPlanAppliedRange({ start, end, appliedAt: new Date().toISOString() });
    // Wiederkehrende Termine (AG/Rep/LG/Sonstiges) + ihre Vor-/Nachbereitung deterministisch einfügen.
    // Idempotent: dupliziert nicht, falls ein erneuter Plan-Apply läuft.
    materializeRecurringTermine(start, end);
  }

  // Tasks: Diff via getTasks() vor/nach
  for (const t of plan.tasks) {
    const before = new Set(getTasks().map((x) => x.id));
    addTask({
      date: t.date,
      title: t.title,
      linkedTopicId: t.topicId || undefined,
      source: "plan",
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
