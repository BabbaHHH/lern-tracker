"use client";

import { useState, useEffect } from "react";
import { NavBar } from "@/components/nav-bar";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { getProgress } from "@/lib/store";
import { Area, AREA_LABELS, AREA_COLORS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addWeeks, startOfWeek, format, addDays, isWithinInterval, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { getExamDate, getCalendarEvents } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recommendKlausur } from "@/lib/klausur-recommender";
import Link from "next/link";

// Phasen-Logik basierend auf Wochen bis Examen
function getPhase(weeksUntilExam: number): { label: string; color: string; description: string } {
  if (weeksUntilExam > 18) return { label: "Aufbau", color: "bg-blue-100 text-blue-800", description: "Wissenslücken schließen, Systemübersichten" };
  if (weeksUntilExam > 12) return { label: "Output", color: "bg-purple-100 text-purple-800", description: "Falllösung, Klausuren schreiben" };
  if (weeksUntilExam > 4) return { label: "Puffer", color: "bg-amber-100 text-amber-800", description: "Verzögerungen auffangen, Lücken schließen" };
  return { label: "Tapering", color: "bg-red-100 text-red-800", description: "NUR Wiederholung, keine neuen Inhalte" };
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function WochenplanPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<ReturnType<typeof getCalendarEvents>>([]);

  useEffect(() => {
    const p = getProgress();
    const map: Record<string, number> = {};
    for (const [id, val] of Object.entries(p)) {
      map[id] = val.percent;
    }
    setProgressMap(map);
    setEvents(getCalendarEvents());
  }, []);

  const today = new Date();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const examDate = parseISO(getExamDate());
  const weeksUntilExam = Math.ceil((examDate.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const phase = getPhase(weeksUntilExam);

  // Tagesstruktur (90-Min-Sprints)
  const sprints = [
    { time: "08:45–10:15", label: "Sprint 1", type: "deep" },
    { time: "10:35–12:05", label: "Sprint 2", type: "deep" },
    { time: "13:30–15:00", label: "Sprint 3", type: "deep" },
    { time: "15:20–16:50", label: "Sprint 4", type: "light" },
  ];

  // Themen die noch Arbeit brauchen (sortiert nach niedrigstem Fortschritt)
  const leafTopics = getLeafTopics(TOPICS);
  const todoTopics = leafTopics
    .filter(t => (progressMap[t.id] || 0) < 80)
    .sort((a, b) => (progressMap[a.id] || 0) - (progressMap[b.id] || 0));

  // Einfache Verteilung: Rotation ZR/ÖffR/SR über die Woche (Interleaving)
  const areas: Area[] = ["zr", "oeffr", "sr"];
  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayEvents = events.filter(e => e.date === dateStr);
    const isFree = dayEvents.some(e => ["urlaub", "frei"].includes(e.eventType));
    const hasAG = dayEvents.some(e => e.eventType === "ag");
    const hasRep = dayEvents.some(e => e.eventType === "rep");

    // Rotation: jeder Tag ein Hauptgebiet + Nebengebiet
    const mainArea = areas[i % 3];
    const subArea = areas[(i + 1) % 3];

    // Themen für diesen Tag vorschlagen
    const mainTopics = todoTopics.filter(t => t.area === mainArea).slice(0, 2);
    const subTopics = todoTopics.filter(t => t.area === subArea).slice(0, 1);

    const klausurRec = !isFree ? recommendKlausur(dateStr) : null;

    return { date, dateStr, dayEvents, isFree, hasAG, hasRep, mainArea, subArea, mainTopics, subTopics, klausurRec };
  });

  return (
    <>
      <NavBar />
      <main className="flex-1 pb-24 pt-4 md:pt-24 px-4 max-w-4xl mx-auto w-full">
        {/* Wochen-Navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekOffset(w => w - 1)}
            className="h-10 w-10 rounded-xl bg-white/60 hover:bg-white border border-slate-200/60 text-slate-600"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              {format(weekStart, "dd. MMM", { locale: de })} – {format(addDays(weekStart, 6), "dd. MMM yyyy", { locale: de })}
            </h1>
            <Badge className={cn("mt-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset border-0", phase.color)}>
              {phase.label} · noch {weeksUntilExam} Wochen
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekOffset(w => w + 1)}
            className="h-10 w-10 rounded-xl bg-white/60 hover:bg-white border border-slate-200/60 text-slate-600"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center mb-6 tracking-tight">{phase.description}</p>

        {/* Wochenansicht */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {weekDays.map((day, i) => {
            const isToday = format(today, "yyyy-MM-dd") === day.dateStr;
            return (
              <Card key={day.dateStr} className={cn(
                "rounded-2xl border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.07)] transition-all",
                isToday && "ring-2 ring-indigo-500/60 shadow-[0_12px_40px_-8px_rgba(99,102,241,0.25)]",
                day.isFree && "opacity-70 bg-slate-50/80"
              )}>
                <CardHeader className="pb-2 pt-3.5 px-3.5">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className={cn(
                      "tracking-tight",
                      isToday ? "text-indigo-700 font-bold" : "text-slate-800 font-semibold"
                    )}>
                      {WEEKDAYS[i]} <span className="text-slate-400 font-normal">{format(day.date, "dd.MM.")}</span>
                    </span>
                    <div className="flex gap-1">
                      {day.isFree && <Badge className="text-[10px] bg-slate-100 text-slate-500 border-0">Frei</Badge>}
                      {day.hasAG && <Badge className="text-[10px] bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 border-0">AG</Badge>}
                      {day.hasRep && <Badge className="text-[10px] bg-purple-50 text-purple-700 ring-1 ring-purple-200/60 border-0">Rep</Badge>}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {day.isFree ? (
                    <p className="text-xs text-gray-400">Kein Jura heute — Erholung!</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Sprints */}
                      {sprints.map((sprint, si) => (
                        <div key={si} className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 w-12 shrink-0 tabular-nums tracking-tight">{sprint.time.split("–")[0]}</span>
                          <div className={cn(
                            "flex-1 rounded-lg px-2.5 py-1.5 ring-1 ring-inset",
                            si < 2 ? "bg-indigo-50/70 ring-indigo-200/40 text-indigo-900" :
                            si === 2 ? "bg-amber-50/70 ring-amber-200/50 text-amber-900" :
                            "bg-slate-50 ring-slate-200/60 text-slate-600"
                          )}>
                            {si === 0 && day.mainTopics[0] && (
                              <span className="font-medium">{day.mainTopics[0].label}</span>
                            )}
                            {si === 1 && day.mainTopics[1] && (
                              <span className="font-medium">{day.mainTopics[1].label}</span>
                            )}
                            {si === 2 && day.subTopics[0] && (
                              <span className="font-medium">{day.subTopics[0].label}</span>
                            )}
                            {si === 3 && (
                              <span className="text-gray-500">Wiederholung</span>
                            )}
                            {((si === 0 && !day.mainTopics[0]) ||
                              (si === 1 && !day.mainTopics[1]) ||
                              (si === 2 && !day.subTopics[0])) && (
                              <span className="text-gray-400">{sprint.label}</span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Sport-Pause */}
                      <div className="text-[10px] text-slate-400 text-center mt-1.5 tracking-tight">
                        12:05 · Mittagspause + Sport
                      </div>

                      {/* Klausur-Empfehlung */}
                      {day.klausurRec && day.klausurRec.score > 0 && (
                        <Link
                          href="/klausuren"
                          className="block mt-2 rounded-lg border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50 p-2 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-700 mb-0.5">
                            <Scale className="h-3 w-3" /> Klausur-Tipp
                          </div>
                          <div className="text-xs font-medium text-slate-800 line-clamp-2">
                            {day.klausurRec.klausur.title}
                          </div>
                          {day.klausurRec.reasons[0] && (
                            <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                              {day.klausurRec.reasons[0]}
                            </div>
                          )}
                        </Link>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </>
  );
}
