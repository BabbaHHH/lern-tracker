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
  source: "manual" | "ai" | "upload" | "klausur";
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

export type KlausurType =
  // ZR + OR
  | "Urteil" | "Beschluss" | "Anwaltsklausur"
  // ZR only
  | "Kautelarklausur"
  // OR only
  | "Behördenklausur" | "Aktenvortrag"
  // SR
  | "Anklageklausur" | "Revisionsklausur" | "Plädoyer"
  | "Haftklausur" | "Einspruch Strafbefehl" | "Abschlussverfügung";

export interface Klausur {
  /** Stabile ID aus dem Extraktions-Prompt, z.B. "kg-oeffr-16" */
  id: string;
  /** Quelle: Dateiname des Original-PDFs */
  source: string;
  /** Datum der Entscheidung / Bearbeitung im Format YYYY-MM-DD */
  date: string;
  /** Prägnanter Titel (max. 10 Wörter) */
  title: string;
  area: Area;
  /** Klausurtyp (Urteil, Anwaltsklausur, Anklageklausur etc.) */
  type?: KlausurType;
  /** IDs aus dem Topic-Tree die diese Klausur abdeckt */
  topicIds: string[];
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
