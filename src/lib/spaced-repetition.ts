import { addDays, parseISO } from "date-fns";
import { isDateOnly, localDate } from "./dates";
import type { TrackingEntry } from "./types";

export type RecallRating = "again" | "hard" | "good" | "easy";
export const RECALL_LABELS: Record<RecallRating, string> = { again: "Nochmal", hard: "Schwer", good: "Gut", easy: "Leicht" };
export interface TopicReview { topicId: string; lastDate: string; due: string; intervalDays: number; ease: number; repetitions: number; lastEntryId: string }

/** Topic-level, SM-2-inspired scheduling. Only explicit recall grades advance
 * intervals; ordinary study starts a one-day review. This is not Anki/FSRS sync.
 * Rebuilding from history makes deletion and undo remove their scheduling effect. */
export function buildTopicReviews(entries: TrackingEntry[], asOf = localDate()): TopicReview[] {
  const states = new Map<string, TopicReview>();
  const ordered = entries.filter(entry => isDateOnly(entry.date) && entry.date <= asOf && entry.durationMinutes > 0 && Array.isArray(entry.topicIds))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const perDay = new Map<string, TrackingEntry>();
  for (const entry of ordered) for (const topicId of new Set(entry.topicIds)) {
    const key = `${entry.date}|${topicId}`;
    const previous = perDay.get(key);
    if (!previous || entry.recallRating || !previous.recallRating) perDay.set(key, { ...entry, topicIds: [topicId] });
  }
  for (const entry of perDay.values()) {
    for (const topicId of new Set(entry.topicIds)) {
      const previous = states.get(topicId);
      // Multiple ordinary sessions on the same day do not count as repeated recall.
      if (previous?.lastDate === entry.date && !entry.recallRating) continue;
      let intervalDays = previous?.intervalDays ?? 1;
      let repetitions = previous?.repetitions ?? 0;
      let ease = previous?.ease ?? 2.5;
      const rating = entry.recallRating && Object.hasOwn(RECALL_LABELS, entry.recallRating) ? entry.recallRating : undefined;
      if (rating === "again") { intervalDays = 1; repetitions = 0; ease = Math.max(1.3, ease - 0.2); }
      else if (rating) {
        repetitions++;
        const base = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(intervalDays * ease);
        intervalDays = rating === "hard" ? Math.max(1, Math.round(base * 0.6)) : rating === "easy" ? Math.max(2, Math.round(base * 1.3)) : base;
        ease = Math.max(1.3, ease + (rating === "hard" ? -0.15 : rating === "easy" ? 0.15 : 0));
      } else {
        // Reading or an exam grade is not an active-recall grade.
        // Keep an established interval, but don't postpone an already due review.
        if (previous) continue;
        intervalDays = 1;
      }
      intervalDays = Math.min(365, intervalDays);
      states.set(topicId, { topicId, lastDate: entry.date, due: localDate(addDays(parseISO(entry.date), intervalDays)), intervalDays, ease, repetitions, lastEntryId: entry.id });
    }
  }
  return [...states.values()].sort((a, b) => a.due.localeCompare(b.due) || a.topicId.localeCompare(b.topicId));
}

export function dueTopicReviews(entries: TrackingEntry[], date: string, asOf = localDate()): TopicReview[] {
  return buildTopicReviews(entries, asOf).filter(review => review.due <= date);
}

export function reviewHistoryKey(entries: TrackingEntry[], today = localDate()): string {
  const state = JSON.stringify(buildTopicReviews(entries, today).map(review => [review.topicId, review.lastEntryId, review.due]));
  // Compact change marker, not a security hash or a copy of the learning history.
  let hash = 2166136261;
  for (let i = 0; i < state.length; i++) hash = Math.imul(hash ^ state.charCodeAt(i), 16777619);
  return `|reviews-v1:${(hash >>> 0).toString(16)}`;
}
