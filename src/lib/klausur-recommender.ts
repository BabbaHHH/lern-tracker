import { Klausur, Area } from "./types";
import { getKlausuren, getTrackingEntries, getProgress, getSchedule, getRecommenderWeights } from "./store";
import { getLeafTopics, TOPICS } from "./topics";
import { format, parseISO, differenceInDays } from "date-fns";

export interface KlausurScore {
  klausur: Klausur;
  score: number;
  reasons: string[];
}

function scoreKlausuren(date: string): KlausurScore[] {
  const klausuren = getKlausuren();
  if (klausuren.length === 0) return [];

  const w = getRecommenderWeights();
  const progress = getProgress();
  const tracking = getTrackingEntries();
  const schedule = getSchedule();
  const today = parseISO(date);

  // Themen die heute auf dem Plan stehen
  const todaysTopicIds = schedule
    .filter(s => s.date === date && s.status !== "skipped")
    .map(s => s.topicId);

  // Klausur-History: welche Klausuren wurden wann geschrieben?
  const klausurHistory = new Map<string, string[]>();
  const areaKlausurCount: Record<Area, number> = { zr: 0, oeffr: 0, sr: 0 };

  tracking
    .filter(t => t.activityType === "klausur" && t.klausurId)
    .forEach(t => {
      const dates = klausurHistory.get(t.klausurId!) || [];
      dates.push(t.date);
      klausurHistory.set(t.klausurId!, dates);
    });

  tracking
    .filter(t => t.activityType === "klausur")
    .forEach(t => {
      const k = klausuren.find(kl => kl.id === t.klausurId);
      if (k) areaKlausurCount[k.area]++;
    });

  const totalKlausurenWritten = Object.values(areaKlausurCount).reduce((a, b) => a + b, 0);

  // Letzte Lernaktivität pro Thema
  const lastStudied = new Map<string, string>();
  tracking.forEach(t => {
    t.topicIds.forEach(tid => {
      const existing = lastStudied.get(tid);
      if (!existing || t.date > existing) {
        lastStudied.set(tid, t.date);
      }
    });
  });

  // Neueste und älteste Klausur für Normalisierung
  const createdDates = klausuren.map(k => new Date(k.createdAt).getTime());
  const newestCreated = Math.max(...createdDates);
  const oldestCreated = Math.min(...createdDates);
  const createdRange = newestCreated - oldestCreated;

  return klausuren.map(k => {
    let score = 0;
    const reasons: string[] = [];

    // 1. Overlap mit Tagesplan
    const overlap = k.topicIds.filter(t => todaysTopicIds.includes(t));
    if (overlap.length > 0) {
      score += overlap.length * w.tagesplanOverlap;
      reasons.push(`${overlap.length} Themen im Tagesplan`);
    }

    // 2. Schwache Themen abdecken
    const weakTopics = k.topicIds.filter(t => (progress[t]?.percent || 0) < 50);
    if (weakTopics.length > 0) {
      score += weakTopics.length * w.schwacheThemen;
      reasons.push(`${weakTopics.length} schwache Themen`);
    }

    // 3. Noch nie geschrieben
    const history = klausurHistory.get(k.id);
    if (!history || history.length === 0) {
      score += w.nochNieGeschrieben;
      reasons.push("Noch nicht geschrieben");
    } else {
      const lastDate = history.sort().reverse()[0];
      const daysSince = differenceInDays(today, parseISO(lastDate));
      if (daysSince < 7) {
        score += w.kuerzlichGeschrieben; // negative weight
        reasons.push(`Vor ${daysSince} Tagen geschrieben`);
      } else if (daysSince > 21) {
        score += w.wiederholungsDistanz;
        reasons.push("Gute Wiederholungs-Distanz");
      }
    }

    // 4. Spaced Repetition
    const staleTopics = k.topicIds.filter(tid => {
      const last = lastStudied.get(tid);
      if (!last) return true;
      return differenceInDays(today, parseISO(last)) > 14;
    });
    if (staleTopics.length > 0) {
      score += staleTopics.length * w.spacedRepetition;
      reasons.push(`${staleTopics.length} Themen brauchen Wiederholung`);
    }

    // 5. Rechtsgebiets-Balance
    if (totalKlausurenWritten > 0) {
      const idealRatio: Record<Area, number> = { zr: 3 / 7, oeffr: 2 / 7, sr: 2 / 7 };
      const actualRatio = areaKlausurCount[k.area] / totalKlausurenWritten;
      if (actualRatio < idealRatio[k.area]) {
        score += w.rechtsgebietsBalance;
        reasons.push(`${k.area.toUpperCase()} unterrepräsentiert`);
      }
    }

    // 6. Schwierigkeits-Match
    const avgProgress = k.topicIds.length > 0
      ? k.topicIds.reduce((sum, t) => sum + (progress[t]?.percent || 0), 0) / k.topicIds.length
      : 0;
    if (k.difficulty === "leicht" && avgProgress < 30) score += w.schwierigkeitsMatch;
    if (k.difficulty === "mittel" && avgProgress >= 30 && avgProgress < 70) score += w.schwierigkeitsMatch;
    if (k.difficulty === "schwer" && avgProgress >= 70) score += w.schwierigkeitsMatch;

    // 7. Neuheits-Bonus: neuere Klausuren bevorzugen
    if (createdRange > 0 && w.neuheitsBonus !== 0) {
      const createdTime = new Date(k.createdAt).getTime();
      const freshness = (createdTime - oldestCreated) / createdRange; // 0..1
      const bonus = Math.round(freshness * w.neuheitsBonus);
      if (bonus > 0) {
        score += bonus;
        reasons.push("Neu hinzugefügt");
      }
    }

    return { klausur: k, score, reasons };
  });
}

/**
 * Empfiehlt die beste Klausur für einen gegebenen Tag.
 */
export function recommendKlausur(date?: string): KlausurScore | null {
  const today = date || format(new Date(), "yyyy-MM-dd");
  const scored = scoreKlausuren(today);
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

/**
 * Gibt die Top-N Empfehlungen zurück.
 */
export function getTopRecommendations(date?: string, n: number = 3): KlausurScore[] {
  const today = date || format(new Date(), "yyyy-MM-dd");
  const scored = scoreKlausuren(today);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n);
}
