"use client";

import { useState, useEffect } from "react";
import { NavBar } from "@/components/nav-bar";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import {
  getProgress,
  getExamDate,
  getCalendarEvents,
  getAgDaysForWeek,
  setAgDaysForWeek,
  getWeekKey,
} from "@/lib/store";
import { Area } from "@/lib/types";
import { addWeeks, startOfWeek, format, addDays, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recommendKlausur } from "@/lib/klausur-recommender";
import Link from "next/link";

function getPhase(weeksUntilExam: number): { label: string; description: string } {
  if (weeksUntilExam > 18) return { label: "Aufbau", description: "Wissenslücken schließen, Systemübersichten" };
  if (weeksUntilExam > 12) return { label: "Output", description: "Falllösung, Klausuren schreiben" };
  if (weeksUntilExam > 4) return { label: "Puffer", description: "Verzögerungen auffangen, Lücken schließen" };
  return { label: "Tapering", description: "NUR Wiederholung, keine neuen Inhalte" };
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function LernkalenderPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<ReturnType<typeof getCalendarEvents>>([]);
  const [agDays, setAgDays] = useState<number[]>([]);
  const [tick, setTick] = useState(0);

  const today = new Date();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekKey = getWeekKey(weekStart);

  useEffect(() => {
    const p = getProgress();
    const map: Record<string, number> = {};
    for (const [id, val] of Object.entries(p)) map[id] = val.percent;
    setProgressMap(map);
    setEvents(getCalendarEvents());
  }, []);

  useEffect(() => {
    setAgDays(getAgDaysForWeek(weekKey));
  }, [weekKey, tick]);

  function toggleAg(idx: number) {
    const next = agDays.includes(idx) ? agDays.filter((d) => d !== idx) : [...agDays, idx].sort();
    setAgDaysForWeek(weekKey, next, "manual");
    setTick((t) => t + 1);
  }

  const examDate = parseISO(getExamDate());
  const weeksUntilExam = Math.ceil((examDate.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const phase = getPhase(weeksUntilExam);

  const sprints = [
    { time: "08:45", label: "Sprint 1" },
    { time: "10:35", label: "Sprint 2" },
    { time: "13:30", label: "Sprint 3" },
    { time: "15:20", label: "Sprint 4" },
  ];

  const leafTopics = getLeafTopics(TOPICS);
  const todoTopics = leafTopics
    .filter((t) => (progressMap[t.id] || 0) < 80)
    .sort((a, b) => (progressMap[a.id] || 0) - (progressMap[b.id] || 0));

  const areas: Area[] = ["zr", "oeffr", "sr"];
  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayEvents = events.filter((e) => e.date === dateStr);
    const isFree = dayEvents.some((e) => ["urlaub", "frei"].includes(e.eventType));
    const hasAG = agDays.includes(i);
    const hasRep = dayEvents.some((e) => e.eventType === "rep");
    const mainArea = areas[i % 3];
    const subArea = areas[(i + 1) % 3];
    const mainTopics = todoTopics.filter((t) => t.area === mainArea).slice(0, 2);
    const subTopics = todoTopics.filter((t) => t.area === subArea).slice(0, 1);
    const klausurRec = !isFree ? recommendKlausur(dateStr) : null;
    return { date, dateStr, dayEvents, isFree, hasAG, hasRep, mainArea, subArea, mainTopics, subTopics, klausurRec };
  });

  return (
    <>
      <NavBar />
      <main className="flex-1 pb-24 pt-4 md:pt-24 px-4 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="border border-slate-200 bg-white mb-5">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="h-9 w-9 rounded-none border border-slate-200 bg-white hover:bg-slate-50 shadow-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-0">
              <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
                Lernkalender · {phase.label} · noch {weeksUntilExam} Wochen
              </div>
              <h1 className="font-serif text-xl text-slate-900 mt-1 leading-tight">
                {format(weekStart, "dd. MMM", { locale: de })} – {format(addDays(weekStart, 6), "dd. MMM yyyy", { locale: de })}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="h-9 w-9 rounded-none border border-slate-200 bg-white hover:bg-slate-50 shadow-none"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* AG-Tag-Editor */}
          <div className="px-6 py-4 flex items-center gap-4 flex-wrap">
            <span className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
              AG diese Woche
            </span>
            <div className="flex gap-1">
              {WEEKDAYS.map((d, i) => {
                const active = agDays.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleAg(i)}
                    className={cn(
                      "w-9 h-9 border font-sans text-[11px] font-bold uppercase tracking-wider transition-colors",
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "border-slate-200 text-slate-500 hover:border-slate-900 hover:text-slate-900"
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <span className="font-sans text-[10px] text-slate-400 ml-auto">
              Klick zum Umschalten · Mehrere AG-Tage möglich
            </span>
          </div>
        </div>

        <p className="font-sans text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500 text-center mb-5">
          {phase.description}
        </p>

        {/* Wochenansicht */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border border-slate-200 bg-white divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {weekDays.map((day, i) => {
            const isToday = format(today, "yyyy-MM-dd") === day.dateStr;
            return (
              <div
                key={day.dateStr}
                className={cn(
                  "p-5 border-b border-slate-200 sm:[&:nth-child(-n+3)]:border-b sm:[&:nth-child(n+4)]:border-b-0 lg:[&:nth-child(-n+3)]:border-b lg:[&:nth-child(n+4)]:border-b-0",
                  day.isFree && "bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div
                      className={cn(
                        "font-sans text-[10px] uppercase tracking-[0.18em] font-bold",
                        isToday ? "text-accent-600" : "text-slate-500"
                      )}
                    >
                      {WEEKDAYS[i]} · {format(day.date, "dd.MM.")}
                    </div>
                    {isToday && (
                      <div className="font-serif text-[13px] text-accent-700 mt-0.5">Heute</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {day.isFree && (
                      <span className="font-sans text-[9px] uppercase tracking-wider font-bold text-slate-500 border border-slate-200 px-1.5 py-0.5">
                        Frei
                      </span>
                    )}
                    {day.hasAG && (
                      <span className="font-sans text-[9px] uppercase tracking-wider font-bold text-white bg-slate-900 px-1.5 py-0.5">
                        AG
                      </span>
                    )}
                    {day.hasRep && (
                      <span className="font-sans text-[9px] uppercase tracking-wider font-bold text-slate-700 border border-slate-200 px-1.5 py-0.5">
                        Rep
                      </span>
                    )}
                  </div>
                </div>

                {day.isFree ? (
                  <p className="font-sans text-xs text-slate-400">Kein Jura heute — Erholung</p>
                ) : (
                  <div className="space-y-2">
                    {sprints.map((sprint, si) => {
                      const content =
                        si === 0 ? day.mainTopics[0]?.label :
                        si === 1 ? day.mainTopics[1]?.label :
                        si === 2 ? day.subTopics[0]?.label :
                        "Wiederholung";
                      return (
                        <div key={si} className="flex items-baseline gap-3 text-xs border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                          <span className="font-sans text-[10px] text-slate-400 tabular-nums w-10 shrink-0">
                            {sprint.time}
                          </span>
                          <span className="font-serif text-[13px] text-slate-900 leading-snug flex-1 min-w-0">
                            {content || <span className="text-slate-300">{sprint.label}</span>}
                          </span>
                        </div>
                      );
                    })}

                    {day.klausurRec && day.klausurRec.score > 0 && (
                      <Link
                        href="/klausuren"
                        className="mt-3 block border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 font-sans text-[9px] uppercase tracking-wider font-bold text-accent-700 mb-1">
                          <Scale className="h-3 w-3" /> Klausur-Tipp
                        </div>
                        <div className="font-serif text-[12px] text-slate-900 leading-snug line-clamp-2">
                          {day.klausurRec.klausur.title}
                        </div>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
