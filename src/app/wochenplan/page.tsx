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
      <main className="flex-1 pb-20 pt-4 md:pt-20 px-4 max-w-4xl mx-auto w-full">
        {/* Wochen-Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-bold">
              {format(weekStart, "dd. MMM", { locale: de })} – {format(addDays(weekStart, 6), "dd. MMM yyyy", { locale: de })}
            </h1>
            <Badge className={cn("mt-1", phase.color)}>{phase.label} — noch {weeksUntilExam} Wochen</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <p className="text-sm text-gray-500 text-center mb-6">{phase.description}</p>

        {/* Wochenansicht */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {weekDays.map((day, i) => {
            const isToday = format(today, "yyyy-MM-dd") === day.dateStr;
            return (
              <Card key={day.dateStr} className={cn(
                "transition-all",
                isToday && "ring-2 ring-emerald-500",
                day.isFree && "opacity-60 bg-gray-50"
              )}>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className={cn(isToday && "text-emerald-600 font-bold")}>
                      {WEEKDAYS[i]} {format(day.date, "dd.MM.")}
                    </span>
                    {day.isFree && <Badge variant="secondary" className="text-xs">Frei</Badge>}
                    {day.hasAG && <Badge className="text-xs bg-blue-100 text-blue-700">AG</Badge>}
                    {day.hasRep && <Badge className="text-xs bg-purple-100 text-purple-700">Rep</Badge>}
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
                          <span className="text-gray-400 w-20 shrink-0">{sprint.time.split("–")[0]}</span>
                          <div className={cn(
                            "flex-1 rounded px-2 py-1",
                            si < 2 ? "bg-emerald-50" : si === 2 ? "bg-blue-50" : "bg-gray-50"
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
                      <div className="text-xs text-gray-400 text-center mt-1">
                        12:05 Mittagspause + Sport
                      </div>

                      {/* Klausur-Empfehlung */}
                      {day.klausurRec && day.klausurRec.score > 0 && (
                        <Link
                          href="/klausuren"
                          className="block mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 p-2 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 mb-0.5">
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
