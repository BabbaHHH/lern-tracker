// Zentraler Context-Builder für System-Prompts.
// Jedes ContextFlag mappt auf einen Textblock — ein Prompt deklariert seine Flags
// und bekommt einen assemblierten String zurück.

import { differenceInWeeks, parseISO, format } from "date-fns";
import { de } from "date-fns/locale";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { AREA_LABELS, ACTIVITY_LABELS, type Area, type ActivityType } from "@/lib/types";
import {
  getProgress, getCalendarEvents, getOnboarding, getLernstart, getExamDate,
  getTrackingEntries, getKlausuren, getDocuments, getLearningEntries,
  getTasksSince, getAgWeekOverrides, getWeekKey, getAgDaysForWeek,
} from "@/lib/store";
import type { ContextFlag } from "@/lib/prompts";

function buildTimeStatus(): string {
  const now = new Date();
  const lernstart = getLernstart();
  const examDate = getExamDate();
  const weeksLeft = differenceInWeeks(parseISO(examDate), now);
  const weeksElapsed = differenceInWeeks(now, parseISO(lernstart));
  return `ZEITSTATUS:
- Heute: ${format(now, "dd.MM.yyyy (EEEE)", { locale: de })}
- Lernstart: ${lernstart}
- Examen: ${examDate}
- Wochen vergangen: ${weeksElapsed}
- Wochen verbleibend: ${weeksLeft}`;
}

function buildProgress(): string {
  const progress = getProgress();
  const leafTopics = getLeafTopics(TOPICS);
  const areas = (["zr", "oeffr", "sr"] as Area[]).map((area) => {
    const areaLeafs = leafTopics.filter((t) => t.area === area);
    const avg = areaLeafs.length > 0
      ? Math.round(areaLeafs.reduce((sum, t) => sum + (progress[t.id]?.percent || 0), 0) / areaLeafs.length)
      : 0;
    const done = areaLeafs.filter((t) => (progress[t.id]?.percent || 0) >= 80).length;
    return `${AREA_LABELS[area]}: ${avg}% Schnitt, ${done}/${areaLeafs.length} Themen ≥80%`;
  }).join("\n");
  const detail = leafTopics
    .map((t) => {
      const p = progress[t.id];
      return `${t.label} (${t.area}): ${p?.percent || 0}%${
        p?.updatedAt ? ` [zuletzt: ${format(new Date(p.updatedAt), "dd.MM.")}]` : ""
      }`;
    })
    .join("\n");
  return `GESAMTÜBERSICHT:
${areas}

ALLE THEMEN MIT FORTSCHRITT:
${detail}`;
}

function buildTracking(): string {
  const tracking = getTrackingEntries();
  const klausuren = getKlausuren();
  if (tracking.length === 0) return "LERN-TRACKING:\nNoch keine Lernaktivitäten eingetragen.";
  const byType: Record<string, { count: number; totalMinutes: number; ratings: number[] }> = {};
  tracking.forEach((t) => {
    if (!byType[t.activityType]) byType[t.activityType] = { count: 0, totalMinutes: 0, ratings: [] };
    byType[t.activityType].count++;
    byType[t.activityType].totalMinutes += t.durationMinutes;
    if (t.rating) byType[t.activityType].ratings.push(t.rating);
  });
  const typeSummary = Object.entries(byType)
    .map(([type, data]) => {
      const avg = data.ratings.length > 0
        ? (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1)
        : "-";
      return `- ${ACTIVITY_LABELS[type as ActivityType] || type}: ${data.count}x, ${Math.round(
        data.totalMinutes / 60,
      )}h gesamt, Ø-Rating: ${avg}/5`;
    })
    .join("\n");
  const now = new Date();
  const last7 = tracking.filter((t) => differenceInWeeks(now, parseISO(t.date)) < 1);
  const last7Summary = last7.length > 0
    ? `${last7.length} Sessions, ${Math.round(last7.reduce((s, t) => s + t.durationMinutes, 0) / 60)}h`
    : "Keine Aktivität";
  const topicFreq = new Map<string, number>();
  tracking.forEach((t) => t.topicIds.forEach((tid) => topicFreq.set(tid, (topicFreq.get(tid) || 0) + 1)));
  const leafTopics = getLeafTopics(TOPICS);
  const neverStudied = leafTopics.filter((t) => !topicFreq.has(t.id)).map((t) => t.label);
  const klausurEntries = tracking.filter((t) => t.activityType === "klausur" && t.klausurId);
  const klausurSummary = klausurEntries.length > 0
    ? klausurEntries
        .map((t) => {
          const k = klausuren.find((kl) => kl.id === t.klausurId);
          return `- ${t.date}: "${k?.title || "?"}" (${k?.area || "?"}) — Rating: ${t.rating || "-"}/5`;
        })
        .join("\n")
    : "Noch keine Klausuren geschrieben.";
  return `LERN-TRACKING (${tracking.length} Einträge):
${typeSummary}

KLAUSUR-HISTORIE:
${klausurSummary}

LETZTE 7 TAGE: ${last7Summary}

NIE BEARBEITETE THEMEN (${neverStudied.length}):
${neverStudied.length > 0 ? neverStudied.slice(0, 20).join(", ") + (neverStudied.length > 20 ? ` ... +${neverStudied.length - 20}` : "") : "Alle Themen mind. 1x bearbeitet"}`;
}

function buildTasks(): string {
  const tasks = getTasksSince(14);
  if (tasks.length === 0) return "TAGES-AUFGABEN (letzte 14 Tage): Keine.";
  const leafs = getLeafTopics(TOPICS);
  const topicLabel = (id?: string) => leafs.find((t) => t.id === id)?.label || "— nicht zugeordnet";
  const done = tasks.filter((t) => t.done);
  const open = tasks.filter((t) => !t.done);
  const doneLines = done
    .map((t) => `- [✓] ${t.date}: "${t.title}" → ${topicLabel(t.linkedTopicId)}${t.source === "manual" ? " (eigene)" : ""} [id=${t.id}, linkedTopicId=${t.linkedTopicId || "—"}]`)
    .join("\n");
  const openLines = open
    .map((t) => `- [ ] ${t.date}: "${t.title}" → ${topicLabel(t.linkedTopicId)} [id=${t.id}, linkedTopicId=${t.linkedTopicId || "—"}]`)
    .join("\n");
  return `TAGES-AUFGABEN (letzte 14 Tage, ${done.length} erledigt / ${open.length} offen):
Erledigt:
${doneLines || "—"}
Offen:
${openLines || "—"}`;
}

function buildLearningNotes(): string {
  const entries = getLearningEntries().slice(0, 40);
  if (entries.length === 0) return "LERN-NOTIZEN: Keine.";
  const leafs = getLeafTopics(TOPICS);
  const topicLabel = (id: string) => leafs.find((t) => t.id === id)?.label || id;
  return `LERN-NOTIZEN (letzte ${entries.length}):
${entries.map((e) => `- ${e.createdAt.slice(0, 10)} · ${topicLabel(e.topicId)}: "${e.note.slice(0, 200)}"`).join("\n")}`;
}

function buildSelfAssessment(): string {
  const sa = getOnboarding().selfAssessment;
  const keys = Object.keys(sa);
  if (keys.length === 0) return "SELBSTEINSCHÄTZUNG: Keine Daten.";
  return `SELBSTEINSCHÄTZUNG (aus Onboarding):
${keys.map((k) => `- ${k}: ${sa[k]}%`).join("\n")}`;
}

function buildCalendar(): string {
  const events = getCalendarEvents();
  const now = new Date();
  // Nur feste Termine — keine plan-generierten Klausuren (die sind Output, nicht Input)
  const upcoming = events
    .filter((e) => {
      if (e.eventType === "klausur") return false;
      const d = parseISO(e.date);
      return d >= now && differenceInWeeks(d, now) <= 4;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => `${e.date}: ${e.label} (${e.eventType})`)
    .join("\n");
  return `FESTE TERMINE NÄCHSTE 4 WOCHEN (ohne KI-generierte Klausurtermine):
${upcoming || "Keine Termine eingetragen"}`;
}

function buildOnboarding(): string {
  const o = getOnboarding();
  const kaiserLines = (o.kaiserSeminare || []).length > 0
    ? (o.kaiserSeminare || []).map((k) => `  · ${k.date} — ${k.topic} (${k.durationDays} Tage)`).join("\n")
    : "  keine geplant";
  const urlaubLines = (o.vacationDates || []).length > 0
    ? (o.vacationDates || []).join(", ")
    : "keiner geplant";
  const agLines = (o.ags || []).length > 0
    ? (o.ags || []).map(ag =>
        `  · ${ag.label} — ${ag.frequency}, ${ag.day}${ag.topic ? ` (${ag.topic})` : ""} — ${ag.durationHours}h/Termin + ${ag.prepHours}h Vorb. + ${ag.postHours}h Nachb.${ag.startDate ? ` — ab ${ag.startDate}` : ""}${ag.endDate ? ` — bis ${ag.endDate}` : " — unbefristet"}`
      ).join("\n")
    : "  keine AG eingetragen";
  const lgLines = (o.lerngruppen || []).length > 0
    ? (o.lerngruppen || []).map(lg =>
        `  · ${lg.label} — ${lg.frequency}, ${lg.day} — ${lg.durationHours}h/Termin + ${lg.prepHours}h Vorb. + ${lg.postHours}h Nachb.${lg.startDate ? ` — ab ${lg.startDate}` : ""}${lg.endDate ? ` — bis ${lg.endDate}` : " — unbefristet"}`
      ).join("\n")
    : "  keine Lerngruppe";
  const repLines = (o.reps || []).length > 0
    ? (o.reps || []).map(r =>
        `  · ${r.label} — ${r.day} — ${r.durationHours}h/Termin${r.prepHours ? ` + ${r.prepHours}h Vorb.` : ""}${r.postHours ? ` + ${r.postHours}h Nachb.` : ""}${r.startDate ? ` — ab ${r.startDate}` : ""}${r.endDate ? ` — bis ${r.endDate}` : ""}`
      ).join("\n")
    : "  keines";
  const sonstigesLines = (o.sonstiges || []).length > 0
    ? (o.sonstiges || []).map(s =>
        `  · ${s.label || "Sonstiges"} — ${s.frequency}, ${s.day} — ${s.durationHours}h${s.startDate ? ` — ab ${s.startDate}` : ""}${s.endDate ? ` — bis ${s.endDate}` : ""}`
      ).join("\n")
    : "  keine";
  const onboardingDocLines = (o.documents || []).length > 0
    ? (o.documents || []).map(d => {
        const tags = d.topicIds?.length ? ` [Leaves: ${d.topicIds.join(", ")}]` : "";
        const summ = d.summary ? `: ${d.summary}` : (d.description ? `: ${d.description}` : "");
        return `  · ${d.name} (${d.type})${summ}${tags}`;
      }).join("\n")
    : "  keine hochgeladen";
  return `ONBOARDING-DATEN:
- AGs:
${agLines}
- Repetitorien:
${repLines}
- Lerngruppen:
${lgLines}
- Sonstige Termine:
${sonstigesLines}
- Freier Tag: ${o.freeDayPerWeek}
- Probeexamen 1: ${o.probeexamen1Start}
- Probeexamen 2: ${o.probeexamen2Start}
- Kaiserseminare:
${kaiserLines}
- Urlaub: ${urlaubLines}
- Onboarding-Dokumente:
${onboardingDocLines}`;
}

function buildKlausuren(): string {
  const klausuren = getKlausuren();
  if (klausuren.length === 0) return "KLAUSUREN: Keine eingetragen.";
  const tracking = getTrackingEntries().filter((t) => t.activityType === "klausur" && t.klausurId);
  const writtenMap = new Map<string, { date: string; rating?: number }>();
  tracking.forEach((t) => {
    const existing = writtenMap.get(t.klausurId!);
    if (!existing || t.date > existing.date) {
      writtenMap.set(t.klausurId!, { date: t.date, rating: t.rating });
    }
  });
  const written = klausuren.filter((k) => writtenMap.has(k.id)).length;
  return `KLAUSUREN (${klausuren.length} gesamt, ${written} geschrieben):
${klausuren
  .slice(0, 30)
  .map((k) => {
    const w = writtenMap.get(k.id);
    const status = w
      ? ` ✓ geschrieben ${w.date}${w.rating ? ` (${w.rating}/5)` : ""}`
      : " ○ noch nicht geschrieben";
    return `- ${k.id}: "${k.title}" [${k.area}${k.type ? "/" + k.type : ""}] (${k.date}) — ${k.source} —${status}`;
  })
  .join("\n")}`;
}

function buildDocs(): string {
  const docs = getDocuments().filter((d) => d.includeInNextPlan);
  if (docs.length === 0) return "PLANUNGSDOKUMENTE: Keine Dokumente ausgewählt.";
  return `PLANUNGSDOKUMENTE (${docs.length} — Lernpläne, Terminübersichten, GJPA-Unterlagen etc.):
${docs.map((d) => `- ${d.name} (${d.type})${d.summary ? `: ${d.summary}` : ""}`).join("\n")}`;
}

function buildTopics(): string {
  const leafs = getLeafTopics(TOPICS);
  return `LEAF-TOPIC-LISTE (id|area|label):
${leafs.map((t) => `${t.id}|${t.area}|${t.label}`).join("\n")}`;
}

function buildAgWeeks(): string {
  const overrides = getAgWeekOverrides();
  const thisWeek = getWeekKey(new Date());
  const current = getAgDaysForWeek(thisWeek);
  const entries = Object.values(overrides);
  return `AG-WOCHEN:
- Aktuelle Woche (${thisWeek}): Tag-Indices ${JSON.stringify(current)} (0=Mo ... 6=So)
${entries.length > 0 ? `- Overrides: ${entries.map((o) => `${o.weekKey}:${JSON.stringify(o.agDays)}[${o.source}]`).join(", ")}` : "- Keine expliziten Overrides"}`;
}

const BUILDERS: Record<ContextFlag, () => string> = {
  timeStatus: buildTimeStatus,
  progress: buildProgress,
  tracking: buildTracking,
  tasks: buildTasks,
  learningNotes: buildLearningNotes,
  selfAssessment: buildSelfAssessment,
  calendar: buildCalendar,
  onboarding: buildOnboarding,
  klausuren: buildKlausuren,
  docs: buildDocs,
  topics: buildTopics,
  agWeeks: buildAgWeeks,
};

export function buildContextFor(flags: ContextFlag[]): string {
  if (flags.length === 0) return "";
  return flags
    .map((f) => {
      try {
        return BUILDERS[f]();
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
