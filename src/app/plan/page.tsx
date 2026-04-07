"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav-bar";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { getProgress, getCalendarEvents, getOnboarding, getLernstart, getExamDate, getTrackingEntries, getKlausuren, getDocuments } from "@/lib/store";
import { DocumentManager } from "@/components/document-manager";
import { AREA_LABELS, ACTIVITY_LABELS, type Area, type ActivityType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Brain, Loader2, ArrowLeft, AlertTriangle, TrendingUp,
  TrendingDown, Clock, Target, Sparkles, RotateCcw
} from "lucide-react";
import { differenceInWeeks, parseISO, format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ProgressSnapshot {
  area: Area;
  areaLabel: string;
  totalTopics: number;
  doneTopics: number;
  avgProgress: number;
  weakest: { label: string; percent: number }[];
  strongest: { label: string; percent: number }[];
}

function buildProgressSnapshot(): ProgressSnapshot[] {
  const progress = getProgress();
  const leafTopics = getLeafTopics(TOPICS);

  return (["zr", "oeffr", "sr"] as Area[]).map(area => {
    const areaLeafs = leafTopics.filter(t => t.area === area);
    const withProgress = areaLeafs.map(t => ({
      label: t.label,
      percent: progress[t.id]?.percent || 0,
    }));

    const sorted = [...withProgress].sort((a, b) => a.percent - b.percent);
    const avgProgress = areaLeafs.length > 0
      ? Math.round(withProgress.reduce((sum, t) => sum + t.percent, 0) / areaLeafs.length)
      : 0;

    return {
      area,
      areaLabel: AREA_LABELS[area],
      totalTopics: areaLeafs.length,
      doneTopics: withProgress.filter(t => t.percent >= 80).length,
      avgProgress,
      weakest: sorted.filter(t => t.percent < 50).slice(0, 5),
      strongest: sorted.filter(t => t.percent >= 80).slice(-3).reverse(),
    };
  });
}

function buildTrackingContext(): string {
  const tracking = getTrackingEntries();
  const klausuren = getKlausuren();

  if (tracking.length === 0) return "LERN-TRACKING:\nNoch keine Lernaktivitäten eingetragen.";

  // Zusammenfassung nach Aktivitätstyp
  const byType: Record<string, { count: number; totalMinutes: number; avgRating: number; ratings: number[] }> = {};
  tracking.forEach(t => {
    if (!byType[t.activityType]) {
      byType[t.activityType] = { count: 0, totalMinutes: 0, avgRating: 0, ratings: [] };
    }
    byType[t.activityType].count++;
    byType[t.activityType].totalMinutes += t.durationMinutes;
    if (t.rating) byType[t.activityType].ratings.push(t.rating);
  });

  const typeSummary = Object.entries(byType).map(([type, data]) => {
    const avg = data.ratings.length > 0
      ? (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1)
      : "-";
    return `- ${ACTIVITY_LABELS[type as ActivityType] || type}: ${data.count}x, ${Math.round(data.totalMinutes / 60)}h gesamt, Ø-Rating: ${avg}/5`;
  }).join("\n");

  // Klausuren-History
  const klausurEntries = tracking.filter(t => t.activityType === "klausur" && t.klausurId);
  const klausurSummary = klausurEntries.length > 0
    ? klausurEntries.map(t => {
        const k = klausuren.find(kl => kl.id === t.klausurId);
        return `- ${t.date}: "${k?.title || "Unbekannt"}" (${k?.area || "?"}) — Rating: ${t.rating || "-"}/5${t.note ? ` — "${t.note}"` : ""}`;
      }).join("\n")
    : "Noch keine Klausuren geschrieben.";

  // Letzte 7 Tage Aktivität
  const now = new Date();
  const last7 = tracking.filter(t => {
    const d = parseISO(t.date);
    return differenceInWeeks(now, d) < 1;
  });
  const last7Summary = last7.length > 0
    ? `${last7.length} Sessions, ${Math.round(last7.reduce((s, t) => s + t.durationMinutes, 0) / 60)}h`
    : "Keine Aktivität";

  // Themen-Frequenz (wie oft wurde jedes Thema bearbeitet)
  const topicFreq = new Map<string, number>();
  tracking.forEach(t => t.topicIds.forEach(tid => {
    topicFreq.set(tid, (topicFreq.get(tid) || 0) + 1);
  }));
  const leafTopics = getLeafTopics(TOPICS);
  const neverStudied = leafTopics.filter(t => !topicFreq.has(t.id)).map(t => t.label);

  return `LERN-TRACKING (${tracking.length} Einträge gesamt):
${typeSummary}

GESCHRIEBENE KLAUSUREN:
${klausurSummary}

LETZTE 7 TAGE: ${last7Summary}

NIE BEARBEITETE THEMEN (${neverStudied.length}):
${neverStudied.length > 0 ? neverStudied.slice(0, 20).join(", ") + (neverStudied.length > 20 ? ` ... und ${neverStudied.length - 20} weitere` : "") : "Alle Themen mindestens 1x bearbeitet!"}`;
}

function buildFullContext(): string {
  const progress = getProgress();
  const leafTopics = getLeafTopics(TOPICS);
  const events = getCalendarEvents();
  const onboarding = getOnboarding();
  const lernstart = getLernstart();
  const examDate = getExamDate();
  const now = new Date();
  const weeksLeft = differenceInWeeks(parseISO(examDate), now);
  const weeksElapsed = differenceInWeeks(now, parseISO(lernstart));

  // Vollständiger Fortschritt pro Thema
  const progressDetail = leafTopics.map(t => {
    const p = progress[t.id];
    return `${t.label} (${t.area}): ${p?.percent || 0}%${p?.updatedAt ? ` [zuletzt: ${format(new Date(p.updatedAt), "dd.MM.")}]` : ""}`;
  }).join("\n");

  // Kalender-Termine der nächsten 4 Wochen
  const upcomingEvents = events
    .filter(e => {
      const d = parseISO(e.date);
      return d >= now && differenceInWeeks(d, now) <= 4;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => `${e.date}: ${e.label} (${e.eventType})`)
    .join("\n");

  // Statistiken
  const areas = (["zr", "oeffr", "sr"] as Area[]).map(area => {
    const areaLeafs = leafTopics.filter(t => t.area === area);
    const avg = areaLeafs.length > 0
      ? Math.round(areaLeafs.reduce((sum, t) => sum + (progress[t.id]?.percent || 0), 0) / areaLeafs.length)
      : 0;
    const done = areaLeafs.filter(t => (progress[t.id]?.percent || 0) >= 80).length;
    return `${AREA_LABELS[area]}: ${avg}% Schnitt, ${done}/${areaLeafs.length} Themen ≥80%`;
  }).join("\n");

  return `ZEITSTATUS:
- Heute: ${format(now, "dd.MM.yyyy (EEEE)", { locale: de })}
- Lernstart: ${lernstart}
- Examen: ${examDate}
- Wochen vergangen: ${weeksElapsed}
- Wochen verbleibend: ${weeksLeft}

GESAMTÜBERSICHT:
${areas}

ALLE THEMEN MIT FORTSCHRITT:
${progressDetail}

TERMINE NÄCHSTE 4 WOCHEN:
${upcomingEvents || "Keine Termine eingetragen"}

ONBOARDING-DATEN:
- AG: ${onboarding.agDay} ${onboarding.agTopic ? `(${onboarding.agTopic})` : ""}
- Rep: ${onboarding.repDay}
- Freier Tag: ${onboarding.freeDayPerWeek}
- Probeexamen 1: ${onboarding.probeexamen1Start}
- Probeexamen 2: ${onboarding.probeexamen2Start}

${buildTrackingContext()}

${buildDocumentContext()}`;
}

function buildDocumentContext(): string {
  const docs = getDocuments().filter((d) => d.includeInNextPlan);
  if (docs.length === 0) return "MATERIALIEN: Keine Dokumente für Planung ausgewählt.";
  return `MATERIALIEN (${docs.length} Dokumente für Plan einbezogen):\n${docs
    .map((d) => `- ${d.name} (${d.type})${d.summary ? `: ${d.summary}` : ""}`)
    .join("\n")}`;
}

export default function PlanPage() {
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [adjustmentRequest, setAdjustmentRequest] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [weeksLeft, setWeeksLeft] = useState(0);

  useEffect(() => {
    setSnapshots(buildProgressSnapshot());
    setWeeksLeft(differenceInWeeks(parseISO(getExamDate()), new Date()));
  }, []);

  const totalAvg = snapshots.length > 0
    ? Math.round(snapshots.reduce((s, a) => s + a.avgProgress, 0) / snapshots.length)
    : 0;

  const handleAdjust = useCallback(async () => {
    setLoading(true);
    setResult(null);

    const context = buildFullContext();

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Du bist der beste Examens-Strategieberater für das 2. juristische Staatsexamen in Berlin.

Du bekommst den VOLLSTÄNDIGEN aktuellen Lernstand eines Kandidaten — jedes Thema mit Prozent und letztem Lerndatum. Du siehst die verbleibende Zeit, die Kalender-Termine und die bisherige Planung.

Deine Aufgabe: Analysiere den Lernstand KRITISCH und erstelle eine KONKRETE Anpassung des Lernplans.

ANALYSE-FRAMEWORK:
1. ZEITBUDGET: Wie viele effektive Lerntage bleiben? (abzgl. AG, Rep, Probeexamen, freie Tage)
2. GAPS: Welche examensrelevanten Themen haben < 50% und brauchen dringend Aufmerksamkeit?
3. BALANCE: Stimmt die 3:2:2-Balance (ZR:ÖffR:SR) mit dem Klausurengewicht überein?
4. SPACED REPETITION: Welche Themen wurden vor >14 Tagen gelernt und brauchen Wiederholung?
5. PHASE: In welcher Phase sollte der Kandidat jetzt sein (Aufbau/Output/Puffer/Tapering)?
6. KLAUSUREN: Wird mind. 1 Klausur/Woche geschrieben? Wenn nicht: einplanen!
7. TRACKING-ANALYSE: Nutze die Lern-Tracking-Daten um zu verstehen: Wie viel wird TATSÄCHLICH gelernt vs. geplant? Welche Themen werden NIE bearbeitet? Wie sind die Selbstbewertungen — gibt es ein Muster (z.B. Strafrecht immer schlecht)?
8. KLAUSUR-EMPFEHLUNG: Basierend auf den geschriebenen Klausuren und deren Ratings: Welche Rechtsgebiete brauchen mehr Klausurpraxis?

FESTE REGELN:
- 90-Minuten-Sprints, 4 pro Tag
- Mind. 1 freier Tag/Woche
- Mind. 1 Klausur/Woche unter Realbedingungen (5h)
- Interleaving: Nicht 2x gleiches Rechtsgebiet hintereinander
- In den letzten 2 Wochen vor Examen: NUR Wiederholung
- Examensrelevanz > Vollständigkeit: Lieber 80% der Kernthemen als 40% von allem

OUTPUT-FORMAT:
1. **Diagnose** (3-4 Sätze: Wo steht der Kandidat wirklich?)
2. **Kritische Lücken** (Top-5 Themen die sofort bearbeitet werden müssen, mit Begründung)
3. **Angepasster Wochenplan** (nächste 4 Wochen, Tag für Tag mit konkreten Themen)
4. **Klausurplan** (welche Klausur wann, welches Rechtsgebiet)
5. **Strategische Empfehlung** (1-2 Sätze was JETZT am wichtigsten ist)

Sei EHRLICH. Wenn der Plan nicht aufgeht, sag es. Motivierend aber realistisch.
Antworte auf Deutsch.`,
            },
            {
              role: "user",
              content: `${context}

${adjustmentRequest ? `\nMEINE FRAGE / ANPASSUNGSWUNSCH:\n${adjustmentRequest}` : "\nBitte analysiere meinen aktuellen Stand und passe den Lernplan an."}`,
            },
          ],
          tier: "premium",
        }),
      });

      const data = await res.json();
      setResult(data.error ? `Fehler: ${data.error}` : data.reply);
    } catch {
      setResult("Verbindungsfehler. Bitte prüfe die API-Konfiguration.");
    }

    setLoading(false);
  }, [adjustmentRequest]);

  return (
    <>
      <NavBar />
      <main className="flex-1 pb-20 pt-3 md:pt-16 px-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Lernplan anpassen</h1>
            <p className="text-xs text-slate-500">Claude Opus 4.6 analysiert deinen Fortschritt</p>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {snapshots.map(snap => {
            const isWeak = snap.avgProgress < 30;
            const isStrong = snap.avgProgress >= 60;
            return (
              <div key={snap.area} className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
                <div className="text-[11px] text-slate-500 font-medium">{snap.areaLabel}</div>
                <div className={cn(
                  "text-2xl font-black tabular-nums mt-0.5",
                  isWeak ? "text-red-500" : isStrong ? "text-accent-600" : "text-amber-500"
                )}>
                  {snap.avgProgress}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {snap.doneTopics}/{snap.totalTopics} fertig
                </div>
              </div>
            );
          })}
        </div>

        {/* Weak spots */}
        {snapshots.some(s => s.weakest.length > 0) && (
          <Card className="mb-5 border-red-200/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Schwachstellen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {snapshots.flatMap(s =>
                  s.weakest.map(w => (
                    <div key={w.label} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-slate-600 truncate flex-1">{w.label}</span>
                      <span className={cn(
                        "text-xs font-bold tabular-nums",
                        w.percent === 0 ? "text-red-500" : "text-amber-500"
                      )}>
                        {w.percent}%
                      </span>
                    </div>
                  ))
                ).slice(0, 8)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Time Warning */}
        {weeksLeft < 10 && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Noch {weeksLeft} Wochen</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {weeksLeft < 4 ? "Tapering-Phase: Fokus auf Wiederholung!" :
                 weeksLeft < 8 ? "Output-Phase: Klausuren schreiben ist jetzt Priorität." :
                 "Letzte Aufbau-Wochen: Kernlücken schließen."}
              </p>
            </div>
          </div>
        )}

        <div className="mb-5">
          <DocumentManager />
        </div>

        <Separator className="my-5" />

        {/* Adjustment Input */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <h2 className="text-base font-bold">Plan anpassen</h2>
            <Badge className="bg-purple-100 text-purple-700 text-[10px]">Opus 4.6</Badge>
          </div>

          <Textarea
            value={adjustmentRequest}
            onChange={e => setAdjustmentRequest(e.target.value)}
            placeholder="Optional: Was möchtest du anpassen? z.B. 'Ich bin nächste Woche im Urlaub' oder 'Ich möchte mehr Strafrecht machen' — oder lass leer für eine automatische Analyse."
            rows={3}
            className="resize-none rounded-xl text-sm"
          />

          <Button
            onClick={handleAdjust}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-accent-600 hover:from-purple-700 hover:to-accent-700 rounded-xl h-11"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Opus 4.6 analysiert...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Lernplan analysieren & anpassen
              </>
            )}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <Card className="border-purple-200/50 mb-8">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  Analyse & Anpassung
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleAdjust} disabled={loading}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Neu
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {result}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
