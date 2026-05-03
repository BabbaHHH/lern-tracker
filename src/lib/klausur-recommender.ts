/**
 * Deterministischer Klausur-Recommender
 *
 * Zwei-Stufen-Architektur:
 * 1. scoreKlausur()   – berechnet einen gewichteten Score pro Klausur
 * 2. getTop3Klausuren() – sortiert und gibt Top-3 zurück
 *
 * Die KI-Qualitätsprüfung (Plausibilitätstest) läuft danach im Component,
 * wo sie nur noch zwischen 3 Kandidaten wählen muss — nicht aus 280.
 */

import { Klausur, Area } from "./types";
import {
  getProgress,
  getKlausurenWritten,
  getTasksForDate,
  getRecommenderWeights,
  RecommenderWeights,
} from "./store";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScoringContext {
  /** topicIds, die heute im Tagesplan stehen */
  todayTopicIds: Set<string>;
  /** topicId → Fortschritt in % */
  progressMap: Record<string, number>;
  /** klausurId → { date, rating } letzter Tracking-Eintrag */
  writtenMap: Map<string, { date: string; rating?: number }>;
  /** Anzahl geschriebener Klausuren je Rechtsgebiet (letzte 14 Tage) */
  recentByArea: Record<Area, number>;
}

export interface ScoredKlausur {
  klausur: Klausur;
  score: number;
  /** Welcher Signal hat wie viel beigetragen */
  breakdown: Partial<Record<keyof RecommenderWeights, number>>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysDiff(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

// ─── Context aufbauen ────────────────────────────────────────────────────────

/**
 * Liest alle relevanten Daten aus dem Store und baut den Scoring-Context.
 * @param allKlausuren Alle Klausuren aus der DB (für Area-Lookup bei recentByArea)
 * @param today        "YYYY-MM-DD"
 */
export function buildScoringContext(
  allKlausuren: Klausur[],
  today: string,
): ScoringContext {
  // Progress
  const progressRaw = getProgress();
  const progressMap: Record<string, number> = {};
  for (const [id, p] of Object.entries(progressRaw)) {
    progressMap[id] = p.percent;
  }

  // Heute's TopicIDs aus Tagesplan-Tasks
  const todayTasks = getTasksForDate(today);
  const todayTopicIds = new Set<string>(
    todayTasks.flatMap(t => (t.linkedTopicId ? [t.linkedTopicId] : [])),
  );

  // Area-Lookup für die Klausuren-DB
  const areaById = new Map<string, Area>(allKlausuren.map(k => [k.id, k.area]));

  // Tracking-Einträge
  const writtenEntries = getKlausurenWritten();

  // writtenMap: pro klausurId → neuester Eintrag
  const writtenMap = new Map<string, { date: string; rating?: number }>();
  for (const e of writtenEntries) {
    if (!e.klausurId) continue;
    const prev = writtenMap.get(e.klausurId);
    if (!prev || e.date > prev.date) {
      writtenMap.set(e.klausurId, { date: e.date, rating: e.rating });
    }
  }

  // recentByArea: letzte 14 Tage
  const cutoff = format(new Date(Date.now() - 14 * 86_400_000), "yyyy-MM-dd");
  const recentByArea: Record<Area, number> = { zr: 0, oeffr: 0, sr: 0 };
  for (const e of writtenEntries) {
    if (!e.klausurId || e.date < cutoff) continue;
    const area = areaById.get(e.klausurId);
    if (area) recentByArea[area]++;
  }

  return { todayTopicIds, progressMap, writtenMap, recentByArea };
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function scoreKlausur(
  k: Klausur,
  weights: RecommenderWeights,
  ctx: ScoringContext,
): { score: number; breakdown: Partial<Record<keyof RecommenderWeights, number>> } {
  const breakdown: Partial<Record<keyof RecommenderWeights, number>> = {};
  let score = 0;
  const written = ctx.writtenMap.get(k.id);
  const today = new Date();

  // 1. Tagesplan-Overlap: +weight pro überlappendes Thema
  const overlapCount = k.topicIds.filter(tid => ctx.todayTopicIds.has(tid)).length;
  breakdown.tagesplanOverlap = overlapCount * weights.tagesplanOverlap;
  score += breakdown.tagesplanOverlap;

  // 2. Schwache Themen (<40%): +weight pro schwachem Thema
  const weakCount = k.topicIds.filter(tid => (ctx.progressMap[tid] ?? 0) < 40).length;
  breakdown.schwacheThemen = weakCount * weights.schwacheThemen;
  score += breakdown.schwacheThemen;

  // 3. Noch nie geschrieben: Pauschalbonus
  breakdown.nochNieGeschrieben = !written ? weights.nochNieGeschrieben : 0;
  score += breakdown.nochNieGeschrieben;

  // 4. Spaced Repetition: geschrieben vor >14 Tagen → +weight × Anzahl Topics
  if (written) {
    const d = daysDiff(today, new Date(written.date));
    breakdown.spacedRepetition = d > 14 ? k.topicIds.length * weights.spacedRepetition : 0;
  } else {
    breakdown.spacedRepetition = 0;
  }
  score += breakdown.spacedRepetition;

  // 5. Rechtsgebiets-Balance: unterrepräsentiertes Rechtsgebiet bekommt Bonus
  const totalRecent = recentTotal(ctx.recentByArea);
  if (totalRecent > 0) {
    const target: Record<Area, number> = { zr: 3 / 7, oeffr: 2 / 7, sr: 2 / 7 };
    const actual = ctx.recentByArea[k.area] / totalRecent;
    const deficit = Math.max(0, target[k.area] - actual);
    // Skalierung: bei 100% Defizit → weights.rechtsgebietsBalance Punkte
    breakdown.rechtsgebietsBalance = Math.round(deficit * weights.rechtsgebietsBalance * 7);
  } else {
    breakdown.rechtsgebietsBalance = 0;
  }
  score += breakdown.rechtsgebietsBalance;

  // 6. Kürzlich geschrieben (<7 Tage): Malus
  if (written) {
    const d = daysDiff(today, new Date(written.date));
    breakdown.kuerzlichGeschrieben = d < 7 ? weights.kuerzlichGeschrieben : 0;
  } else {
    breakdown.kuerzlichGeschrieben = 0;
  }
  score += breakdown.kuerzlichGeschrieben;

  // 7. Schwierigkeits-Match: Topics im Sweet-Spot 20–70% → verhältnismäßiger Bonus
  if (k.topicIds.length > 0) {
    const midCount = k.topicIds.filter(tid => {
      const p = ctx.progressMap[tid] ?? 0;
      return p >= 20 && p <= 70;
    }).length;
    breakdown.schwierigkeitsMatch = Math.round(
      (midCount / k.topicIds.length) * weights.schwierigkeitsMatch,
    );
  } else {
    breakdown.schwierigkeitsMatch = 0;
  }
  score += breakdown.schwierigkeitsMatch;

  // 8. Neuheits-Bonus: neuere Klausuren bevorzugen
  if (k.date) {
    const age = today.getFullYear() - parseInt(k.date.slice(0, 4), 10);
    if (age <= 3) breakdown.neuheitsBonus = weights.neuheitsBonus;
    else if (age <= 7) breakdown.neuheitsBonus = Math.round(weights.neuheitsBonus * 0.6);
    else if (age <= 12) breakdown.neuheitsBonus = Math.round(weights.neuheitsBonus * 0.25);
    else breakdown.neuheitsBonus = 0;
  } else {
    breakdown.neuheitsBonus = 0;
  }
  score += breakdown.neuheitsBonus!;

  // 9. Wiederholungs-Distanz: geschrieben >21 Tage ago → Bonus
  if (written) {
    const d = daysDiff(today, new Date(written.date));
    breakdown.wiederholungsDistanz = d > 21 ? weights.wiederholungsDistanz : 0;
  } else {
    breakdown.wiederholungsDistanz = 0;
  }
  score += breakdown.wiederholungsDistanz;

  // 10. Anspruchsgrundlagen-Frische: Topics mit 30–80% brauchen Auffrischung
  const freshCount = k.topicIds.filter(tid => {
    const p = ctx.progressMap[tid] ?? 0;
    return p >= 30 && p <= 80;
  }).length;
  breakdown.anspruchsgrundlagenFrische = freshCount * weights.anspruchsgrundlagenFrische;
  score += breakdown.anspruchsgrundlagenFrische;

  return { score: Math.round(score), breakdown };
}

function recentTotal(r: Record<Area, number>) {
  return r.zr + r.oeffr + r.sr;
}

// ─── Top-3 ───────────────────────────────────────────────────────────────────

/**
 * Gibt die Top-3 Klausuren mit Score + Breakdown zurück.
 * Diese werden an die KI geschickt die dann die finale Wahl trifft.
 */
export function getTop3Klausuren(
  allKlausuren: Klausur[],
  today: string,
): ScoredKlausur[] {
  const weights = getRecommenderWeights();
  const ctx = buildScoringContext(allKlausuren, today);

  return allKlausuren
    .map(k => {
      const { score, breakdown } = scoreKlausur(k, weights, ctx);
      return { klausur: k, score, breakdown };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ─── KI-Kontext-String ───────────────────────────────────────────────────────

/**
 * Baut den User-Message-String für die KI-Qualitätsprüfung.
 * Enthält die Top-3 Kandidaten mit ihren Scores und Metadaten.
 */
export function buildKiCandidatesMessage(
  top3: ScoredKlausur[],
  today: string,
): string {
  const lines: string[] = [
    `Heute: ${today}`,
    "",
    "Die folgenden 3 Klausuren wurden deterministisch vorausgewählt (Score = Summe gewichteter Signale).",
    "Bitte prüfe ob #1 die beste Wahl für heute ist oder ob #2/#3 vorzuziehen ist.",
    "",
  ];

  top3.forEach((s, i) => {
    const k = s.klausur;
    const writtenNote = s.breakdown.kuerzlichGeschrieben && s.breakdown.kuerzlichGeschrieben < 0
      ? " ⚠️ kürzlich geschrieben"
      : s.breakdown.nochNieGeschrieben
        ? " (noch nie geschrieben)"
        : " (schon geschrieben)";

    lines.push(`[${i + 1}] ${k.title}`);
    lines.push(`   Gebiet: ${k.area.toUpperCase()} | Typ: ${k.type ?? "–"} | Datum: ${k.date ?? "–"}`);
    lines.push(`   Quelle: ${k.source || "–"}`);
    lines.push(`   Themen (${k.topicIds.length}): ${k.topicIds.slice(0, 5).join(", ")}${k.topicIds.length > 5 ? " …" : ""}`);
    lines.push(`   Gesamt-Score: ${s.score}${writtenNote}`);

    // Relevante Signale mit positivem Beitrag
    const signals = Object.entries(s.breakdown)
      .filter(([, v]) => v && v !== 0)
      .map(([k, v]) => `${k}: ${v! > 0 ? "+" : ""}${v}`)
      .join(" | ");
    if (signals) lines.push(`   Signale: ${signals}`);
    lines.push("");
  });

  lines.push('Antworte ausschließlich mit JSON: {"klausurId":"...","reasoning":["...","..."],"alternatives":[{"klausurId":"...","reason":"..."},{"klausurId":"...","reason":"..."}]}');

  return lines.join("\n");
}
