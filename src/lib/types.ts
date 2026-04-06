export type Area = "zr" | "oeffr" | "sr";

export interface Topic {
  id: string;
  parentId: string | null;
  label: string;
  area: Area;
  sortOrder: number;
  children?: Topic[];
}

export interface Progress {
  topicId: string;
  percent: number;
  source: "manual" | "ai" | "upload";
  updatedAt: string;
}

export interface LearningEntry {
  id: string;
  topicId: string;
  note: string;
  source: "chat" | "manual" | "upload";
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  eventType: "ag" | "rep" | "kaiser" | "probeexamen" | "urlaub" | "frei" | "sport" | "klausur";
  label: string;
  recurring: boolean;
  recurringDay?: number; // 0=Sun, 1=Mon, ...
}

export interface ScheduleItem {
  id: string;
  date: string;
  topicId: string;
  status: "planned" | "done" | "skipped" | "moved";
}

export interface WeekPlan {
  weekNumber: number;
  startDate: string;
  phase: "aufbau" | "probeexamen" | "output" | "puffer" | "tapering";
  items: ScheduleItem[];
}

export const AREA_LABELS: Record<Area, string> = {
  zr: "Zivilrecht",
  oeffr: "Öffentliches Recht",
  sr: "Strafrecht",
};

export const AREA_COLORS: Record<Area, string> = {
  zr: "bg-blue-500",
  oeffr: "bg-amber-500",
  sr: "bg-red-500",
};

export const AREA_COLORS_LIGHT: Record<Area, string> = {
  zr: "bg-blue-100",
  oeffr: "bg-amber-100",
  sr: "bg-red-100",
};

// === Klausur-Datenbank ===

export type KlausurDifficulty = "leicht" | "mittel" | "schwer";

export interface Klausur {
  id: string;
  title: string;
  area: Area;
  /** IDs aus dem Topic-Tree die diese Klausur abdeckt */
  topicIds: string[];
  difficulty: KlausurDifficulty;
  /** Quelle: z.B. "Probeexamen 2024", "Kaiser-Klausurenkurs" */
  source: string;
  /** Freitext-Lösung / Lösungsskizze */
  solution: string;
  /** Sachverhalt / Aufgabenstellung */
  sachverhalt: string;
  /** Geschätzte Bearbeitungszeit in Minuten (default 300 = 5h) */
  durationMinutes: number;
  /** 1-2 Sätze: Materiell-rechtlicher Kern */
  materialSchwerpunkt?: string;
  /** 1-2 Sätze: Prozessuale Lage / Klausurtyp */
  prozessualSchwerpunkt?: string;
  /** Liste klassischer Probleme die in dieser Klausur vorkommen */
  klassischeProbleme?: string[];
  /** Zentrale Anspruchsgrundlagen / Normen (z.B. "§ 433 II BGB") */
  anspruchsgrundlagen?: string[];
  /** True wenn NotebookLM die Lösung eindeutig zuordnen konnte */
  solutionMatched?: boolean;
  createdAt: string;
  updatedAt: string;
}

// === Erweitertes Lern-Tracking ===

export type ActivityType = "theorie" | "klausur" | "wiederholung" | "karteikarten" | "ag" | "rep";

export interface TrackingEntry {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  /** Was wurde gemacht? */
  activityType: ActivityType;
  /** Welche Themen wurden behandelt? */
  topicIds: string[];
  /** Referenz auf geschriebene Klausur (optional) */
  klausurId?: string;
  /** Wie lange in Minuten? */
  durationMinutes: number;
  /** Selbsteinschätzung 1-5 (wie gut lief es?) */
  rating?: number;
  /** Notizen */
  note: string;
  createdAt: string;
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  theorie: "Theorie",
  klausur: "Klausur",
  wiederholung: "Wiederholung",
  karteikarten: "Karteikarten",
  ag: "AG",
  rep: "Rep",
};
