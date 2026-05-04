// Deterministischer Auto-Topic-Picker — wählt 3 schwache Themen pro Tag
// als Fallback, wenn weder KI-Plan-Content noch (für den Tag) ein Plan-Bereich
// existiert. Per Datum stabil, damit ein Tag immer dieselben Vorschläge bekommt.

import { TOPICS, getLeafTopics } from "@/lib/topics";
import { getProgress } from "@/lib/store";
import type { Topic } from "@/lib/types";

function dateToDayIdx(dateStr: string): number {
  // YYYY-MM-DD → Tage seit Epoch
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 86400000);
}

export function pickAutoTopicsForDate(dateStr: string, count = 3): Topic[] {
  const leafs = getLeafTopics(TOPICS);
  const progress = getProgress();
  const ranked = [...leafs].sort((a, b) => {
    const pa = progress[a.id]?.percent ?? 0;
    const pb = progress[b.id]?.percent ?? 0;
    return pa - pb;
  });
  const dayIdx = dateToDayIdx(dateStr);
  const offset = dayIdx % Math.max(1, Math.floor(ranked.length / count));
  return ranked.slice(offset * count, offset * count + count);
}

export function pickAutoTopicsToday(count = 3): Topic[] {
  const today = new Date().toISOString().slice(0, 10);
  return pickAutoTopicsForDate(today, count);
}
