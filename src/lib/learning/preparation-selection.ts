import { differenceInCalendarDays, parseISO } from "date-fns";
import { isDateOnly } from "../dates";
import { getStudyPhase, getStudyBlock, topicPerspective, type StudyPhaseSettings } from "../study-phases";
import type { Area, Progress, Topic } from "../types";
import type { TopicReview } from "../spaced-repetition";

const AREAS: Area[] = ["zr", "sr", "oeffr"];
export interface AutoSprint { topic: Topic; title: string; isReview?: boolean }

/** Date-stable selection; focus and review share the available slots, never add hours. */
export function selectAutoSprints(date: string, count: number, topics: Topic[], progress: Record<string, Progress>, settings: StudyPhaseSettings, due: TopicReview[] = []): AutoSprint[] {
  if (!isDateOnly(date) || !Number.isFinite(count) || count < 1) return [];
  const phase = getStudyPhase(date, settings);
  const sprint = getStudyBlock(date, settings);
  const day = Math.abs(differenceInCalendarDays(parseISO(date), parseISO(phase?.start ?? "1970-01-05")));
  const result: AutoSprint[] = [];
  count = Math.min(Math.floor(count), topics.length);
  for (const review of due) {
    const topic = topics.find(topic => topic.id === review.topicId);
    if (topic && result.length < count && !result.some(item => item.topic.id === topic.id)) result.push({ topic, title: `Wiederholung: ${topic.label}`, isReview: true });
  }
  const percent = (topic: Topic) => progress[topic.id]?.percent ?? 0;
  for (let i = result.length; i < count; i++) {
    const slot = day * count + i;
    const focus = phase?.focus ?? "mixed";
    const review = focus !== "mixed" && slot % 5 === 4;
    const others = AREAS.filter(area => area !== focus);
    const area = focus === "mixed" ? AREAS[slot % 3] : review ? others[Math.floor(slot / 5) % others.length] : focus;
    const perspective = review ? "mixed" : phase?.perspective ?? "mixed";
    let pool = topics.filter(topic => topic.area === area);
    if (perspective !== "mixed") pool = pool.filter(topic => topicPerspective(topic) === perspective || topicPerspective(topic) === "mixed");
    // Alternate practical technique and shared foundations. The latter stay
    // within one small topic family for each fortnight when sufficient leaves exist.
    const technique = pool.filter(topic => topicPerspective(topic) === perspective && perspective !== "mixed");
    if (i === 0 && day % 2 === 0 && technique.length) pool = technique;
    else if (sprint && !review) {
      const common = topics.filter(topic => topic.area === area && topicPerspective(topic) === "mixed");
      const parents = [...new Set(common.map(topic => topic.parentId))];
      const families = parents.map(parent => common.filter(topic => topic.parentId === parent)).filter(group => group.length >= 3)
        .sort((a, b) => Math.min(...a.map(percent)) - Math.min(...b.map(percent)));
      if (families.length) {
        const family = families[(sprint.number - 1) % families.length];
        if (family.length) pool = family;
      }
    }
    if (!pool.length) continue;
    pool.sort((a, b) => percent(a) - percent(b) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    const weakest = percent(pool[0]);
    const candidates = pool.filter(topic => percent(topic) <= weakest + 20);
    // Rotate over a stable pool. Removing an earlier slot before calculating
    // the offset made the same foundation appear on three consecutive days.
    const offset = slot % candidates.length;
    const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
    const unused = (topic: Topic) => !result.some(item => item.topic.id === topic.id);
    const topic = rotated.find(unused) ?? pool.find(unused);
    if (!topic) continue;
    result.push({ topic, title: topic.label });
  }
  return result;
}

