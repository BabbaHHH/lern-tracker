export type Area = "zr" | "oeffr" | "sr";

/** Read-only catalog values from the explicitly bound old collection. */
export type CatalogArea = Area | "eur" | "steuer";
export function isCoreArea(area: CatalogArea): area is Area {
  return area === "zr" || area === "oeffr" || area === "sr";
}

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
  durationMinutes?: number;
  source?: "manual" | "plan" | "document";
  sourceDocument?: string;
  linkedKlausurId?: string;
}

export const AREA_LABELS: Record<Area, string> = {
  zr: "Zivilrecht",
  oeffr: "Öffentliches Recht",
  sr: "Strafrecht",
};

export const CATALOG_AREA_LABELS: Record<CatalogArea, string> = {
  ...AREA_LABELS,
  eur: "Europarecht",
  steuer: "Steuerrecht",
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

/** Does not widen normal uploads, topic areas or private writing contracts. */
export type CatalogKlausur = Omit<Klausur, "area"> & { area: CatalogArea };

/** Herkunft einer Klausur, abgeleitet aus dem Quell-Dateinamen. */
export type KlausurHerkunft = "berlin" | "hamburg" | "unbekannt";

export const HERKUNFT_LABELS: Record<KlausurHerkunft, string> = {
  berlin: "Berlin",
  hamburg: "Hamburg",
  unbekannt: "?",
};

/**
 * Leitet die Herkunft rein aus dem `source`-Dateinamen ab (keine Neu-Extraktion nötig).
 * - Hamburg: "088_ZR_I_combined_komplett.pdf" → beginnt mit 2-3 Ziffern + Unterstrich
 * - Berlin (KG): "ZR 130 Sternberg" → Buchstaben + Leerzeichen + Zahl
 */
export function klausurHerkunft(source: string | undefined): KlausurHerkunft {
  const s = (source ?? "").trim();
  if (/^\d{2,3}_/.test(s)) return "hamburg";
  if (/^[A-Za-zÄÖÜ]+\s+\d/.test(s)) return "berlin";
  return "unbekannt";
}

/**
 * Kurz-Kürzel einer Klausur aus dem Dateinamen, z.B. "ZR 130" oder "088 ZR I".
 * Fällt auf die ID zurück, wenn kein Muster greift.
 */
export function klausurKuerzel(k: { id: string; source?: string }): string {
  const s = (k.source ?? "").trim();
  // Hamburg: "088_ZR_I_combined..." → "088 ZR I"
  const hh = s.match(/^(\d{2,3})_([A-Za-zÄÖÜ]+)_([IVX]+)/);
  if (hh) return `${hh[1]} ${hh[2]} ${hh[3]}`;
  // Berlin (KG): "ZR 130 Sternberg" → "ZR 130"
  const be = s.match(/^([A-Za-zÄÖÜ]+)\s+(\d+)/);
  if (be) return `${be[1]} ${be[2]}`;
  return k.id;
}

// === Klausur-Schreibtraining (KI-Korrektur) ===

export type KorrekturGranularity = "manuell" | "wort" | "satz" | "absatz";

/** Ein erkanntes, potenziell wiederkehrendes Stil-/Sorgfaltsmuster. */
export interface FehlerMarker {
  /** stabiler Slug, z.B. "gutachtenstil_in_urteilsgruenden" */
  key: string;
  label: string;
  severity?: "hoch" | "mittel" | "niedrig";
}

export interface KlausurFeedback {
  id: string;
  scope: "wort" | "satz" | "absatz" | "abschnitt" | "gesamt";
  /** Der bewertete Fokus-Text. */
  excerpt?: string;
  feedbackText: string;
  markers: FehlerMarker[];
  /** Verwendeter OpenRouter-Slug. */
  model: string;
  createdAt: string;
}

/** Eine Schreibsession: Entwurf der Lösung + Feedback-Verlauf. */
export interface KlausurDraft {
  id: string;
  title: string;
  area?: Area;
  type?: KlausurType;
  /** Optionale Verknüpfung zu einem Eintrag der Klausur-DB. */
  klausurId?: string;
  /** Optional eingefügter Sachverhalt (sonst extern als PDF gelesen). */
  sachverhalt?: string;
  /** TipTap-HTML der Lösung. */
  contentHtml: string;
  /** Plaintext-Spiegel (Wortzähler + KI-Payload). */
  contentText: string;
  feedback: KlausurFeedback[];
  createdAt: string;
  updatedAt: string;
}

export type TrendDir = "neu" | "steigend" | "konstant" | "fallend";

export interface FehlerProfilEntry {
  label: string;
  count: number;
  trend: TrendDir;
  /** ISO-Zeitpunkt des letzten Auftretens. */
  lastSeen: string;
  /** Wie oft je Klausurtyp aufgetreten. */
  byType?: Partial<Record<KlausurType, number>>;
}

/** Lernende Schicht (Ebene 3): wächst über mehrere Klausuren. */
export interface FehlerProfil {
  markers: Record<string, FehlerProfilEntry>;
  updatedAt: string;
}

export interface KorrekturSettings {
  /** OpenRouter-Slug des gewählten Korrektur-Modells. */
  model: string;
  granularity: KorrekturGranularity;
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
  /** Referenz auf geschriebene/gelesene Klausur (optional) */
  klausurId?: string;
  /** "written" = vollständig geschrieben (100% Boost), "read" = gelesen/skizziert (50% Boost) */
  klausurMode?: "written" | "read";
  /** Wie lange in Minuten? */
  durationMinutes: number;
  /** Selbsteinschätzung 1-5 (wie gut lief es?) */
  rating?: number;
  /** Explicit active-recall assessment; independent from an exam's 1–5 grade. */
  recallRating?: import("./spaced-repetition").RecallRating;
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
