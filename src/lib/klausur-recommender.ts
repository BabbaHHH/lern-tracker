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

import { currentDate } from "@/lib/dates";
import { Klausur, Area } from "./types";
import {
  getProgress,
  getKlausurenWritten,
  getTasksForDate,
  getRecommenderWeights,
  getCalendarEvents,
  getOnboarding,
  RecommenderWeights,
  WEIGHT_LABELS,
} from "./store";
import { getLeafTopics, TOPICS } from "./topics";
import { format } from "date-fns";
import { describeStudyPhase, getStudyPhase, klausurPerspective } from "./study-phases";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScoringContext {
  /** topicIds, die heute im Tagesplan stehen */
  todayTopicIds: Set<string>;
  /** Dominantes Rechtsgebiet heute (>=60% der Topic-Tasks) — null wenn gemischt/leer */
  todayDominantArea: Area | null;
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

/**
 * Leitet das Rechtsgebiet aus dem Freitext-Label eines Klausur-Events ab.
 * Die Plan-KI erzeugt Labels im Format "ZR-Klausur (…)" / "ÖffR-Klausur (…)" /
 * "SR-Klausur (…)" (siehe prompts.ts). Tolerant ggü. Schreibweisen; null wenn
 * nichts erkennbar (→ kein Pin, normales Verhalten).
 */
export function parseAreaFromLabel(label: string): Area | null {
  const s = label.trim().toLowerCase();
  // 1) Area-Präfix am Anfang — so erzeugt die Plan-KI die Labels ("ÖffR-Klausur (…)").
  if (s.startsWith("öffr") || s.startsWith("oeffr") || s.startsWith("öff") || s.startsWith("ör")) return "oeffr";
  if (s.startsWith("zr") || s.startsWith("zivil")) return "zr";
  if (s.startsWith("sr") || s.startsWith("str") || s.startsWith("straf")) return "sr";
  // 2) Fallback für abweichende/manuelle Labels — eng gefasst gegen Fehltreffer.
  if (/öffentlich|verwaltungs|polizeirecht|baurecht|kommunal|verfassungs/.test(s)) return "oeffr";
  if (/anklage|revision|plädoyer|haftbefehl|strafbefehl|abschlussverfügung/.test(s)) return "sr";
  if (/zivilrecht|mietrecht|kaufrecht|werkvertrag/.test(s)) return "zr";
  return null;
}

/**
 * Rechtsgebiet der heute zu schreibenden Klausur (aus dem Klausur-Kalender-Event),
 * oder null wenn heute kein Klausur-Event existiert / die Area nicht erkennbar ist.
 * Erstes Event mit erkennbarer Area gewinnt.
 */
export function getTodayKlausurArea(today: string): Area | null {
  const events = getCalendarEvents().filter(e => e.eventType === "klausur" && e.date === today);
  for (const e of events) {
    const a = parseAreaFromLabel(e.label);
    if (a) return a;
  }
  return null;
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
    todayTasks.flatMap(t => t.linkedTopicIds?.length ? t.linkedTopicIds : t.linkedTopicId ? [t.linkedTopicId] : []),
  );

  // Dominantes Rechtsgebiet heute: zähle Tasks mit Topic je Area, Schwellenwert 60%.
  const leafs = getLeafTopics(TOPICS);
  const areaById = new Map<string, Area>(leafs.map(l => [l.id, l.area]));
  const areaCounts: Record<Area, number> = { zr: 0, oeffr: 0, sr: 0 };
  let totalLinked = 0;
  for (const t of todayTasks) {
    if (!t.linkedTopicId) continue;
    const a = areaById.get(t.linkedTopicId);
    if (a) { areaCounts[a]++; totalLinked++; }
  }
  // Dominantes Rechtsgebiet: zwei Wege qualifizieren sich
  //   (a) Klare Mehrheit: ≥60% aller verlinkten Tasks
  //   (b) Klare Führung: Top-Area hat strikt mehr Tasks als die zweitstärkste,
  //       UND mindestens 2 Tasks
  // Beispiel (b): bei 2 ZR / 1 ÖffR / 1 SR → ZR dominant. Bei 1/1/1 → keiner.
  let todayDominantArea: Area | null = null;
  if (totalLinked > 0) {
    const ranked = (Object.entries(areaCounts) as [Area, number][])
      .sort((a, b) => b[1] - a[1]);
    const [top, second] = ranked;
    const majority = top[1] / totalLinked >= 0.6;
    const clearLead = top[1] >= 2 && top[1] > (second?.[1] ?? 0);
    if (majority || clearLead) todayDominantArea = top[0];
  }

  // Area-Lookup für die Klausuren-DB
  const klausurAreaById = new Map<string, Area>(allKlausuren.map(k => [k.id, k.area]));

  // Tracking-Einträge
  const writtenEntries = getKlausurenWritten().filter(entry => entry.date <= today);

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
  const reference = new Date(`${today}T12:00:00`);
  reference.setDate(reference.getDate() - 14);
  const cutoff = format(reference, "yyyy-MM-dd");
  const recentByArea: Record<Area, number> = { zr: 0, oeffr: 0, sr: 0 };
  for (const e of writtenEntries) {
    if (!e.klausurId || e.date < cutoff) continue;
    const area = klausurAreaById.get(e.klausurId);
    if (area) recentByArea[area]++;
  }

  return { todayTopicIds, todayDominantArea, progressMap, writtenMap, recentByArea };
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
  const today = currentDate();

  // Schutz gegen kaputte Extraktions-Daten: manche Klausuren haben 50-115
  // topicIds (ganze Taxonomie ausgekippt). Topic-basierte Signale werden
  // gekappt, sonst dominieren diese Klausuren jedes Scoring.
  const CAP = 10;

  // 1. Tagesplan-Overlap: +weight pro überlappendes Thema (gekappt)
  const overlapCount = Math.min(CAP, k.topicIds.filter(tid => ctx.todayTopicIds.has(tid)).length);
  breakdown.tagesplanOverlap = overlapCount * weights.tagesplanOverlap;
  score += breakdown.tagesplanOverlap;

  // 1b. Tages-Area-Match: wenn heute klar ein Rechtsgebiet dominiert,
  // dann +weight für Klausuren im selben Gebiet, –weight für andere.
  // Verhindert dass eine SR-Klausur empfohlen wird, wenn der Tag nur ZR-Themen hat.
  if (ctx.todayDominantArea) {
    if (k.area === ctx.todayDominantArea) {
      breakdown.tagesAreaMatch = weights.tagesAreaMatch;
    } else {
      breakdown.tagesAreaMatch = -weights.tagesAreaMatch;
    }
  } else {
    breakdown.tagesAreaMatch = 0;
  }
  score += breakdown.tagesAreaMatch;

  // 2. Schwache Themen (<40%): +weight pro schwachem Thema (gekappt)
  const weakCount = Math.min(CAP, k.topicIds.filter(tid => (ctx.progressMap[tid] ?? 0) < 40).length);
  breakdown.schwacheThemen = weakCount * weights.schwacheThemen;
  score += breakdown.schwacheThemen;

  // 3. Noch nie geschrieben: Pauschalbonus
  breakdown.nochNieGeschrieben = !written ? weights.nochNieGeschrieben : 0;
  score += breakdown.nochNieGeschrieben;

  // 4. Spaced Repetition: geschrieben vor >14 Tagen → +weight × Anzahl Topics (gekappt)
  if (written) {
    const d = daysDiff(today, new Date(written.date));
    breakdown.spacedRepetition = d > 14 ? Math.min(CAP, k.topicIds.length) * weights.spacedRepetition : 0;
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

  // 10. Anspruchsgrundlagen-Frische: Topics mit 30–80% brauchen Auffrischung (gekappt)
  const freshCount = Math.min(CAP, k.topicIds.filter(tid => {
    const p = ctx.progressMap[tid] ?? 0;
    return p >= 30 && p <= 80;
  }).length);
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
 *
 * Priorisierung: erst aus noch-nie-geschriebenen Klausuren auswählen.
 * Nur wenn alle Klausuren bereits geschrieben wurden (Fallback) kommen
 * auch schon geschriebene in die Auswahl — das verhindert endlose Wiederholungen.
 */
export function getTop3Klausuren(
  allKlausuren: Klausur[],
  today: string,
): ScoredKlausur[] {
  const weights = getRecommenderWeights();
  const ctx = buildScoringContext(allKlausuren, today);

  // Pool: nur ungeschriebene Klausuren; Fallback auf alle wenn keine mehr offen
  const unwritten = allKlausuren.filter(k => !ctx.writtenMap.has(k.id));
  const pool = unwritten.length > 0 ? unwritten : allKlausuren;

  const scored = pool
    .map(k => {
      const { score, breakdown } = scoreKlausur(k, weights, ctx);
      return { klausur: k, score, breakdown };
    })
    .sort((a, b) => b.score - a.score);

  // Klausur-Schreibtag: Die HAUPTEMPFEHLUNG (#1) muss zum Rechtsgebiet der heute
  // zu schreibenden Klausur passen (aus dem Kalender-Event geparst). Wir ziehen die
  // höchstgescorte Klausur dieses Gebiets nach vorn — die Skizzen-Plätze (#2/#3)
  // bleiben score-basiert und dürfen über Gebiete streuen.
  const phase = getStudyPhase(today, getOnboarding());
  const eventArea = getTodayKlausurArea(today);
  const focusArea = eventArea ?? (phase?.focus !== "mixed" ? phase?.focus : null);
  if (focusArea || (phase && phase.perspective !== "mixed")) {
    // The main recommendation follows the station. Alternatives keep the
    // usual score ordering so repetition across areas remains available.
    const fit = (k: Klausur) => (focusArea && k.area === focusArea ? 3 : 0)
      + (phase && phase.perspective !== "mixed" ? klausurPerspective(k.type) === phase.perspective ? 1 : klausurPerspective(k.type) === "mixed" ? 0 : -1 : 0);
    const best = Math.max(...scored.map(item => fit(item.klausur)));
    const idx = scored.findIndex(s => fit(s.klausur) === best);
    if (idx > 0) {
      const [primary] = scored.splice(idx, 1);
      scored.unshift(primary);
    }
    // idx === 0: passt schon; idx === -1: keine offene Klausur dieses Gebiets → unverändert
  }

  return scored.slice(0, 3);
}

// ─── KI-Kontext-String ───────────────────────────────────────────────────────

/**
 * Baut den User-Message-String für die KI-Qualitätsprüfung.
 * Enthält die Top-3 Kandidaten mit ihren Scores und Metadaten.
 */
export function buildKiCandidatesMessage(
  top3: ScoredKlausur[],
  today: string,
  eventArea?: Area | null,
): string {
  const AREA_NAME: Record<Area, string> = { zr: "Zivilrecht", oeffr: "Öffentliches Recht", sr: "Strafrecht" };
  const lines: string[] = [
    `Heute: ${today}`,
    "",
    "Die folgenden 3 Klausuren wurden deterministisch vorausgewählt (Score = Summe gewichteter Signale).",
  ];
  const phase = getStudyPhase(today, getOnboarding());
  if (phase) lines.push(`Ausbildungsabschnitt: ${describeStudyPhase(phase)}. Begründe die tatsächliche Passung; bei fehlendem passenden Klausurtyp benenne die Abweichung.`);
  if (eventArea) {
    lines.push(
      `WICHTIG: Heute ist ein ${AREA_NAME[eventArea]}-Klausur-Schreibtag. Kandidat #1 ist bereits auf dieses`,
      `Rechtsgebiet fixiert und WIRD als Haupt-Klausur geschrieben — übernimm #1 als klausurId und begründe,`,
      `warum sie für den ${AREA_NAME[eventArea]}-Schreibtag passt. #2/#3 sind die Skizzier-Empfehlungen (dürfen anderes Gebiet sein).`,
    );
  } else if (phase && (phase.focus !== "mixed" || phase.perspective !== "mixed")) {
    lines.push("Kandidat #1 wurde nach Schwerpunkt und Perspektive des Ausbildungsabschnitts vorausgewählt. Übernimm #1 als klausurId; die Alternativen dürfen andere Gebiete wiederholen.");
  } else {
    lines.push("Bitte prüfe ob #1 die beste Wahl für heute ist oder ob #2/#3 vorzuziehen ist.");
  }
  lines.push("");

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

    // Relevante Signale mit Beitrag — als lesbare Labels (nicht die internen Keys),
    // damit die KI fachlich korrekte Begriffe in die Begründung übernimmt.
    const signals = Object.entries(s.breakdown)
      .filter(([, v]) => v && v !== 0)
      .map(([k, v]) => `${WEIGHT_LABELS[k as keyof RecommenderWeights] ?? k}: ${v! > 0 ? "+" : ""}${v}`)
      .join(" | ");
    if (signals) lines.push(`   Signale: ${signals}`);
    lines.push("");
  });

  lines.push('Antworte ausschließlich mit JSON: {"klausurId":"...","reasoning":["...","..."],"alternatives":[{"klausurId":"...","reason":"..."},{"klausurId":"...","reason":"..."}]}');

  return lines.join("\n");
}
