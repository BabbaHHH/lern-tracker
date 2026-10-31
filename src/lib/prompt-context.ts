// Zentraler Context-Builder für System-Prompts.
// Jedes ContextFlag mappt auf einen Textblock — ein Prompt deklariert seine Flags
// und bekommt einen assemblierten String zurück.

import { differenceInWeeks, differenceInCalendarDays, parseISO, format } from "date-fns";
import { de } from "date-fns/locale";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { AREA_LABELS, ACTIVITY_LABELS, type Area, type ActivityType } from "@/lib/types";
import {
  getProgress, getCalendarEvents, getOnboarding, getLernstart, getExamDate,
  getTrackingEntries, getKlausuren, getDocuments, getLearningEntries,
  getTasksSince, getAgWeekOverrides, getWeekKey, getAgDaysForWeek,
  getFehlerProfil,
} from "@/lib/store";
import { materializeRecurringTermine } from "@/lib/plan-applier";
import { computeDayBudget, dailyHours, eventsOnDate, isFixedTask, isStudyFreeDay, planningEvents } from "./day-budget";
import { localDate, isDateOnly, currentDate } from "./dates";
import { describeStudyPhase, getStudyBlock, studyPhasesContext } from "./study-phases";
import { planningDocumentsContext } from "./planning-documents";
import { buildTopicReviews } from "./spaced-repetition";
import type { ContextFlag } from "@/lib/prompts";

function buildTimeStatus(): string {
  const now = currentDate();
  const lernstart = getLernstart();
  const examDate = getExamDate();
  const weeksLeft = examDate ? differenceInWeeks(parseISO(examDate), now) : "noch nicht festgelegt";
  const weeksElapsed = isDateOnly(lernstart) ? differenceInWeeks(now, parseISO(lernstart)) : "noch nicht festgelegt";
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
  const now = currentDate();
  const last7 = tracking.filter((t) => {
    const age = differenceInCalendarDays(now, parseISO(t.date));
    return age >= 0 && age < 7;
  });
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
          // "read" = nur gelesen/skizziert (50% Lerneffekt einer echten Klausur)
          const mode = t.klausurMode === "read" ? "nur gelesen/skizziert" : "geschrieben";
          const note = t.note ? ` — Notiz: "${t.note.slice(0, 120)}"` : "";
          return `- ${t.date}: "${k?.title || "?"}" (${k?.area || "?"}) — ${mode}, Rating: ${t.rating || "-"}/5${note}`;
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

/**
 * Wie buildTasks, aber NUR erledigte Tasks der letzten 14 Tage,
 * die noch keine KI-Bewertung erhalten haben (reviewedAt ist nicht gesetzt).
 * Wird vom progress-review Prompt benutzt, damit dieselben Tasks nicht
 * mehrfach hochbewertet werden.
 */
function buildTasksUnreviewed(): string {
  const tasks = getTasksSince(14).filter((t) => t.done && !t.reviewedAt);
  if (tasks.length === 0) {
    return "ERLEDIGTE TASKS ZUR BEWERTUNG (unreviewed, letzte 14 Tage): Keine — alle bereits bewertet oder nichts abgehakt.";
  }
  const leafs = getLeafTopics(TOPICS);
  const topicLabel = (id?: string) => leafs.find((t) => t.id === id)?.label || "— nicht zugeordnet";
  const lines = tasks
    .map(
      (t) =>
        `- ${t.date}: "${t.title}" → ${topicLabel(t.linkedTopicId)}${t.source === "manual" ? " (eigene)" : ""} [id=${t.id}, linkedTopicId=${t.linkedTopicId || "—"}]`,
    )
    .join("\n");
  return `ERLEDIGTE TASKS ZUR BEWERTUNG (unreviewed, letzte 14 Tage, ${tasks.length}):
NUR DIESE TASKS bewerten — bereits geprüfte Tasks tauchen hier nicht auf.
${lines}`;
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
  const now = currentDate();
  // Nur feste Termine — keine plan-generierten Klausuren (die sind Output, nicht Input)
  const upcoming = events
    .filter((e) => {
      if (e.eventType === "klausur" && e.source === "plan") return false;
      const d = parseISO(e.date);
      const daysAhead = differenceInCalendarDays(d, now);
      return daysAhead >= 0 && daysAhead < 28;
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
${onboardingDocLines}

${studyPhasesContext(o)}

${planningDocumentsContext(o.documents)}

WIEDERHOLUNGSPLAN (aus tatsächlichen Lernaktivitäten und ausdrücklichen Abrufbewertungen):
${buildTopicReviews(getTrackingEntries()).slice(0, 100).map(review => `- ${review.topicId}: fällig ${review.due}, letzter Abruf/Lernkontakt ${review.lastDate}, Abstand ${review.intervalDays} Tage`).join("\n") || "Noch keine bearbeiteten Themen. Nach dem ersten Lernkontakt wird eine Wiederholung am Folgetag fällig."}
Fällige Wiederholungen in vorhandene Zeitslots einplanen; bei Zeitmangel verschieben und nennen. Ein einziges Review je Thema für die aktuelle Fälligkeit, keine vorweggenommenen Folgeintervalle ohne Abrufbewertung.`;
}

function buildKlausuren(): string {
  const klausuren = getKlausuren();
  if (klausuren.length === 0) return "KLAUSUREN: Keine eingetragen.";
  const tracking = getTrackingEntries().filter((t) => t.activityType === "klausur" && t.klausurId);
  const writtenMap = new Map<string, { date: string; rating?: number; mode: "written" | "read" }>();
  tracking.forEach((t) => {
    const existing = writtenMap.get(t.klausurId!);
    if (!existing || t.date > existing.date) {
      writtenMap.set(t.klausurId!, { date: t.date, rating: t.rating, mode: t.klausurMode ?? "written" });
    }
  });

  // Bearbeitete Klausuren VOLLSTÄNDIG listen (das ist die Historie, die zählt) —
  // offene nur als Statistik pro Rechtsgebiet/Typ (sonst 280 Zeilen Rauschen).
  const done = klausuren.filter((k) => writtenMap.has(k.id));
  const open = klausuren.filter((k) => !writtenMap.has(k.id));
  const writtenCount = done.filter((k) => writtenMap.get(k.id)!.mode === "written").length;
  const readCount = done.length - writtenCount;

  const doneLines = done.length > 0
    ? done
        .sort((a, b) => writtenMap.get(b.id)!.date.localeCompare(writtenMap.get(a.id)!.date))
        .map((k) => {
          const w = writtenMap.get(k.id)!;
          const status = w.mode === "read"
            ? `nur gelesen/skizziert ${w.date}`
            : `✓ geschrieben ${w.date}`;
          return `- ${k.id}: "${k.title}" [${k.area}${k.type ? "/" + k.type : ""}] — ${status}${w.rating ? ` (${w.rating}/5)` : ""}`;
        })
        .join("\n")
    : "—";

  const openByGroup = new Map<string, number>();
  open.forEach((k) => {
    const key = `${AREA_LABELS[k.area]}${k.type ? " / " + k.type : ""}`;
    openByGroup.set(key, (openByGroup.get(key) ?? 0) + 1);
  });
  const openStats = [...openByGroup.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `  ${label}: ${n}`)
    .join("\n");

  return `KLAUSUREN (${klausuren.length} in der Datenbank, ${writtenCount} geschrieben, ${readCount} gelesen/skizziert):
BEARBEITET (geschrieben = volle Klausurpraxis; gelesen/skizziert = nur ~50% Lerneffekt, ersetzt KEINE echte Klausurpraxis):
${doneLines}

NOCH OFFEN (${open.length} Klausuren, verfügbar nach Rechtsgebiet/Typ):
${openStats || "—"}`;
}

function buildDocs(): string {
  const docs = getDocuments().filter((d) => d.includeInNextPlan);
  if (docs.length === 0) return "PLANUNGSDOKUMENTE: Keine Dokumente ausgewählt.";
  return `PLANUNGSDOKUMENTE (${docs.length} — Lernpläne, Terminübersichten, GJPA-Unterlagen etc.):
${docs.map((d) => {
  const summary = d.summary ? `: ${d.summary}` : "";
  const text = d.textContent ? `\n  [Inhalt]: ${d.textContent.slice(0, 3000)}${d.textContent.length > 3000 ? "…" : ""}` : "";
  return `- ${d.name} (${d.type})${summary}${text}`;
}).join("\n")}`;
}

function buildTopics(): string {
  const leafs = getLeafTopics(TOPICS);

  // Coverage-Gap berechnen: welche Leaves waren in den letzten 90 Tagen in KEINEM Task?
  // Quelle: Tasks (geplant + erledigt) + Tracking-Einträge.
  const cutoff = currentDate();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = localDate(cutoff);

  const tasks = getTasksSince(90).filter(task => task.date <= localDate());
  const tracking = getTrackingEntries().filter((t) => t.date >= cutoffStr && t.date <= localDate());
  const coveredIds = new Set<string>();
  tasks.forEach((t) => { if (t.linkedTopicId) coveredIds.add(t.linkedTopicId); });
  tracking.forEach((t) => t.topicIds.forEach((tid) => coveredIds.add(tid)));

  const gaps = leafs.filter((l) => !coveredIds.has(l.id));
  const coveragePct = leafs.length === 0 ? 0 : Math.round(((leafs.length - gaps.length) / leafs.length) * 100);

  // Lücken kompakt: nach Area gruppiert
  const gapsByArea: Record<string, string[]> = { zr: [], oeffr: [], sr: [] };
  gaps.forEach((l) => { gapsByArea[l.area]?.push(`${l.id} (${l.label})`); });

  const gapsBlock = gaps.length === 0
    ? "Keine Lücken — alle Pflicht-Topics wurden in den letzten 90 Tagen mind. 1× geplant oder bearbeitet."
    : (["zr", "oeffr", "sr"] as const)
        .map((a) => {
          const list = gapsByArea[a];
          if (list.length === 0) return null;
          return `${a.toUpperCase()} (${list.length}):\n${list.join("\n")}`;
        })
        .filter(Boolean)
        .join("\n\n");

  return `LEAF-TOPIC-LISTE — VOLLSTÄNDIGE PFLICHTSTOFFLISTE (${leafs.length} Themen, id|area|label):
Diese Liste ist die kanonische Quelle dessen, was bis zum Examen abgedeckt sein muss.
Jede Plan-Task MUSS sich auf eine dieser topicIds beziehen. Themen außerhalb dieser Liste existieren für die Planung nicht.
${leafs.map((t) => `${t.id}|${t.area}|${t.label}`).join("\n")}

⚠️ COVERAGE-LÜCKEN (Stand letzte 90 Tage): ${coveragePct}% Coverage, ${gaps.length} Topics waren in keinem Task und keinem Tracking-Eintrag:
${gapsBlock}

Priorisiere diese Lücken über die verbleibende Ausbildungszeit. Plane in den nächsten vier Wochen nur die innerhalb des Zeitbudgets sinnvollen Themen; nenne weitere Lücken im Ausblick. Künftige Aufgaben belegen noch keine erfolgte Bearbeitung.`;
}

/** Tageszeit-Budget der nächsten 4 Wochen — Termine + bereits geplanter Content zählen, Rest = freie Lernzeit. */
function buildDailyBudget(): string {
  const settings = getOnboarding();
  const maxHours = dailyHours(settings);
  const today = currentDate();
  const future = new Date(today);
  future.setDate(today.getDate() + 28);
  materializeRecurringTermine(localDate(today), localDate(future));
  // An adjustment replaces unfinished AI content, but keeps appointments,
  // manual tasks and completed work. Do not charge both plans to the same day.
  const tasks = getTasksSince(0).filter(task => !task.deferred && (task.done || task.source === "manual" || isFixedTask(task)));
  const retainedEventIds = new Set(tasks.flatMap(task => task.calendarEventId ? [task.calendarEventId] : []));
  const events = planningEvents(getCalendarEvents().filter(event => event.source !== "plan" || retainedEventIds.has(event.id)), settings);
  const lines: string[] = [];
  for (let i = 0; i < 28; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = localDate(date);
    const dayEvents = eventsOnDate(events, dateStr);
    const dayTasks = tasks.filter(task => task.date === dateStr);
    const free = isStudyFreeDay(dateStr, settings, events);
    const budget = computeDayBudget(dayTasks, dayEvents, { maxHours, suppressReserve: free });
    const sprint = getStudyBlock(dateStr, settings);
    const status = free ? "FREIER TAG — keine zusätzlichen Aufgaben" : budget.overloadH > 0
      ? "ÜBERFÜLLT — Terminkonflikt, keine zusätzlichen Aufgaben"
      : `${(budget.remainingMinutes / 60).toFixed(1)}h verfügbar`;
    lines.push(`${dateStr} (${format(date, "EEE", { locale: de })}): ${budget.totalH.toFixed(1)}h belegt · ${status}. ${dayTasks.map(task => task.title).concat(dayEvents.map(event => event.label)).join("; ") || "Keine festen Aufgaben"}${sprint ? ` · ${describeStudyPhase(sprint.phase)} · Lernblock ${sprint.number} (${sprint.start} bis ${sprint.end})` : ""}`);
  }
  return `TÄGLICHES ZEITBUDGET — harte Obergrenze ${maxHours}h einschließlich Termine, Vor- und Nachbereitung:
${lines.join("\n")}
Der neue Plan ersetzt unerledigten bisherigen KI-Content innerhalb seines Zeitraums. Die Tabelle zeigt deshalb die verbleibenden festen Verpflichtungen. Klausur-Slots und konkrete Klausur-Aufgaben werden nur einmal gezählt. Skizzen sind optionale 2h-Blöcke, keine zusätzliche tägliche Pflicht. Plane sie nur, wenn sie in die Restzeit passen. An Klausur-Schreibtagen gibt es keine zusätzliche Skizzenpflicht. Freie Tage und Urlaub bleiben frei. Restzeit darf ungenutzt bleiben. Überlastung offen benennen.`;
}

function buildAgWeeks(): string {
  const overrides = getAgWeekOverrides();
  const thisWeek = getWeekKey(currentDate());
  const current = getAgDaysForWeek(thisWeek);
  const entries = Object.values(overrides);
  return `AG-WOCHEN:
- Aktuelle Woche (${thisWeek}): Tag-Indices ${JSON.stringify(current)} (0=Mo ... 6=So)
${entries.length > 0 ? `- Overrides: ${entries.map((o) => `${o.weekKey}:${JSON.stringify(o.agDays)}[${o.source}]`).join(", ")}` : "- Keine expliziten Overrides"}`;
}

function buildFehlerprofil(): string {
  const profil = getFehlerProfil();
  const entries = Object.entries(profil.markers);
  if (entries.length === 0) {
    return `WIEDERKEHRENDE MUSTER DIESES NUTZERS:
- Noch keine Daten (erste Korrektur). Erkenne Muster sorgfältig, damit das Profil zu wachsen beginnt.`;
  }
  // Nach Häufigkeit, dann Aktualität sortieren; Top 12.
  const top = entries
    .sort((a, b) => b[1].count - a[1].count || b[1].lastSeen.localeCompare(a[1].lastSeen))
    .slice(0, 12)
    .map(([key, e]) => `- ${e.label} (${key}): ${e.count}× [${e.trend}], zuletzt ${e.lastSeen.slice(0, 10)}`)
    .join("\n");
  return `WIEDERKEHRENDE MUSTER DIESES NUTZERS (lernendes Fehlerprofil über bisherige Klausuren):
${top}

NUTZE diese Muster je nach Aufgabe: Bei einer KORREKTUR besonders darauf achten, Rückfälle ausdrücklich benennen und spürbare Besserungen loben. Bei der LERNPLANUNG gezielt Übungen einplanen, die diese Schwächen trainieren (passende Klausurtypen, Stil-/Form-Drills zu den häufigsten Mustern).`;
}

const BUILDERS: Record<ContextFlag, () => string> = {
  timeStatus: buildTimeStatus,
  progress: buildProgress,
  tracking: buildTracking,
  tasks: buildTasks,
  tasksUnreviewed: buildTasksUnreviewed,
  learningNotes: buildLearningNotes,
  selfAssessment: buildSelfAssessment,
  calendar: buildCalendar,
  onboarding: buildOnboarding,
  klausuren: buildKlausuren,
  docs: buildDocs,
  topics: buildTopics,
  agWeeks: buildAgWeeks,
  dailyBudget: buildDailyBudget,
  fehlerprofil: buildFehlerprofil,
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
