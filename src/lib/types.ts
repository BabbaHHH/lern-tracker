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
