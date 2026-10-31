import { localDate } from "./dates";
import { TOPICS, getLeafTopics } from "./topics";
import { getOnboarding, getProgress, getTrackingEntries, getTasks } from "./store";
import { dueTopicReviews } from "./spaced-repetition";
import type { Topic } from "./types";

import {selectAutoSprints,type AutoSprint} from './learning/preparation-selection';
export {selectAutoSprints,type AutoSprint} from './learning/preparation-selection';

export function pickAutoSprintsForDate(date: string, count = 3, asOf = localDate()): AutoSprint[] {
  const pending = new Set(getTasks().filter(task => !task.done && !task.deferred && task.isReview && task.date >= asOf && task.date <= date).flatMap(task => task.linkedTopicIds ?? (task.linkedTopicId ? [task.linkedTopicId] : [])));
  const doneToday = new Set(getTasks().filter(task => task.done && task.date === date).flatMap(task => task.linkedTopicIds ?? (task.linkedTopicId ? [task.linkedTopicId] : [])));
  return selectAutoSprints(date, count, getLeafTopics(TOPICS).filter(topic => !doneToday.has(topic.id)), getProgress(), getOnboarding(), dueTopicReviews(getTrackingEntries(), date, asOf).filter(review => !pending.has(review.topicId)));
}
export function pickAutoTopicsForDate(date: string, count = 3): Topic[] {
  return pickAutoSprintsForDate(date, count).map(item => item.topic);
}
export function pickAutoTopicsToday(count = 3): Topic[] {
  return pickAutoTopicsForDate(localDate(), count);
}
