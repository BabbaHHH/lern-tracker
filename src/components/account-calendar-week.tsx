"use client";
import { currentDate } from "@/lib/dates";
import { CalendarExport } from "@/components/calendar-export";
import { KlausurCalendarLink } from "@/components/klausur-calendar-link";
import { DayLearningHistory } from "@/components/day-learning-history";
import { completedExamSlots } from "@/lib/klausur-calendar";
import type { Klausur, TrackingEntry } from "@/lib/types";

import { useState, useEffect } from "react";
import { NavBar } from "@/components/nav-bar";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import {
  getExamDate,
  getCalendarEvents,
  getAgDaysForWeek,
  setAgDaysForWeek,
  getWeekKey,
  getTasksForDate,
  getTasks,
  getOnboarding,
  getTrackingEntries, getKlausuren,
  type OnboardingData,
  type DailyTask,
} from "@/lib/store";
import { prepareLearningDays, isTerminTitle } from "@/lib/plan-applier";
import { computeDayBudget, dailyHours, eventsOnDate, isStudyFreeDay, planningEvents, sketchCountLabel } from "@/lib/day-budget";
import { PlanningBacklog } from "@/components/planning-backlog";
import { StudySprintInfo } from "@/components/study-sprint-info";
import { getStudyPhase, getStudyBlock, PERSPECTIVE_LABELS } from "@/lib/study-phases";
import { addWeeks, startOfWeek, format, addDays, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import {AccountPreparationPanel} from './account-preparation-panel';
import type {AccountCalendarAdapter} from './account-calendar-adapter';
import {accountCalendarData,accountWeekAgDays,accountDayTasks} from './account-calendar-model';

function getPhase(weeksUntilExam: number): { label: string; description: string } {
  if (weeksUntilExam > 18) return { label: "Aufbau", description: "Wissenslücken schließen, Systemübersichten" };
  if (weeksUntilExam > 12) return { label: "Output", description: "Falllösung, Klausuren schreiben" };
  if (weeksUntilExam > 4) return { label: "Puffer", description: "Verzögerungen auffangen, Lücken schließen" };
  return { label: "Tapering", description: "NUR Wiederholung, keine neuen Inhalte" };
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function OriginalWeekView({account}:{account?:AccountCalendarAdapter}={}) {
  const accountMode=!!account;
  const [weekOffset, setWeekOffset] = useState(0);
  const [browserExamDateStr, setExamDateStr] = useState("");
  const [browserEvents, setEvents] = useState<ReturnType<typeof getCalendarEvents>>([]);
  const [browserAgDays, setAgDays] = useState<number[]>([]);
  const [tick, setTick] = useState(0);
  const [browserSettings, setSettings] = useState<OnboardingData | null>(null);
  const [browserBacklog, setBacklog] = useState<DailyTask[]>([]);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [browserTracking, setTracking] = useState<TrackingEntry[]>([]);
  const [browserKlausuren, setKlausuren] = useState<Klausur[]>([]);

  const today = currentDate();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekKey = getWeekKey(weekStart);
  const weekStartDate = format(weekStart, "yyyy-MM-dd");


  useEffect(() => {
    if(accountMode)return;
    // Hydrate browser-owned settings after the initial render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExamDateStr(getExamDate());
    setSettings(getOnboarding());
  }, [accountMode]);

  useEffect(() => {
    if(accountMode)return;
    // localStorage-Hydration, reagiert auf weekKey/tick
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgDays(getAgDaysForWeek(weekKey));
  }, [accountMode, weekKey, tick]);

  const [browserTasksByDate, setTasksByDate] = useState<Record<string, DailyTask[]>>({});
  const remote=account?accountCalendarData(account.view):null;
  const examDateStr=account?account.view.personal.examDate?.value??account.view.personal.profile?.value.examDate??'':browserExamDateStr;
  const events=remote?.events??browserEvents,settings=remote?.settings??browserSettings,backlog=remote?.backlog??browserBacklog,tracking=remote?.tracking??browserTracking,klausuren=remote?.klausuren??browserKlausuren;
  const agDays=account?accountWeekAgDays(account.view,weekStart):browserAgDays;
  const tasksByDate=account?Object.fromEntries(Array.from({length:7},(_,i)=>{const date=format(addDays(weekStart,i),'yyyy-MM-dd');return [date,accountDayTasks(account.view,date)];})):browserTasksByDate;
  const overlappingAgs = (settings?.ags ?? []).filter(ag => (!ag.startDate || ag.startDate <= format(addDays(weekStart, 6), "yyyy-MM-dd")) && (!ag.endDate || ag.endDate >= weekStartDate)).length > 1;

  function toggleAg(idx: number) {
    const next = agDays.includes(idx) ? agDays.filter((d) => d !== idx) : [...agDays, idx].sort();
    if(account){void account.submit({type:'ag.save',id:weekKey,agDays:next},account.view);return;}
    setAgDaysForWeek(weekKey, next, "manual");
    setTick((t) => t + 1);
  }

  const examDate = examDateStr ? parseISO(examDateStr) : null;
  const weeksUntilExam = examDate ? Math.ceil((examDate.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0;
  const phase = examDate ? getPhase(weeksUntilExam) : { label: "Termin offen", description: "Bitte zuerst deinen Prüfungstermin eintragen." };

  const leafTopics = getLeafTopics(TOPICS);
  const leafById = new Map(leafTopics.map((t) => [t.id, t]));

  const maxHours = settings ? dailyHours(settings) : 7;
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayEvents = eventsOnDate(events, dateStr);
    const isFree = settings ? isStudyFreeDay(dateStr, settings, events) : false;
    const hasAG = agDays.includes(i);
    // Echte Tasks pro Tag — NUR aus dem tasksByDate-Cache (Effect befüllt ihn nach
    // Mount). Direktes getTasksForDate() im Render wäre ein Hydration-Mismatch:
    // Server sieht leeren localStorage, Client nicht.
    const dayTasks = tasksByDate[dateStr] ?? [];
    const hasRep = dayEvents.some((e) => e.eventType === "rep") ||
      dayTasks.some((t) => /\bRep\b/i.test(t.title) || /\bKISS\b/i.test(t.title));
    // Sortierung: Termine (AG/Rep/LG/Anki/Vorb./Nachb.) zuerst, dann Lern-Tasks
    const sorted = [...dayTasks].sort((a, b) => {
      const ta = isTerminTitle(a.title) ? 0 : 1;
      const tb = isTerminTitle(b.title) ? 0 : 1;
      return ta - tb || a.title.localeCompare(b.title);
    });
    // Tages-Stundenbudget (Tasks echte Dauer + geplante Klausuren 5h + Skizzen-Reserve) —
    // gemeinsame Logik mit dem Tagesprogramm via computeDayBudget. Die Skizzen-Reserve
    // ist im KI-Budget fest eingeplant, existiert aber erst als Task, sobald sie über
    // "Klausur des Tages" geholt wird. Freie/vergangene Tage: keine Reserve.
    const isPastDay = dateStr < format(today, "yyyy-MM-dd");
    const budget = computeDayBudget(sorted, dayEvents, { maxHours, suppressReserve: isFree || isPastDay });
    return {
      date, dateStr, dayEvents, isFree, hasAG, hasRep, dayTasks: sorted,
      completedSlots: completedExamSlots(dayEvents, tracking, dateStr),
      studyPhase: settings ? getStudyPhase(dateStr, settings) : null,
      sprint: settings ? getStudyBlock(dateStr, settings) : null,
      totalHours: budget.totalH, reserveH: budget.reserveH, sketchCount: budget.sketchCount,
    };
  });
  const weekPhases = [...new Set(weekDays.flatMap(day => day.studyPhase ? [day.studyPhase.label] : []))];

  useEffect(() => {
    if(accountMode)return;
    const dates = Array.from({ length: 7 }, (_, index) => format(addDays(parseISO(weekStartDate), index), "yyyy-MM-dd"));
    // Hydrate and reconcile browser storage after navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { prepareLearningDays(dates); setPlanningError(null); }
    catch (error) { setPlanningError(error instanceof Error ? error.message : "Plan konnte nicht aktualisiert werden."); }
    const currentSettings = getOnboarding();
    setSettings(currentSettings);
    setEvents(planningEvents(getCalendarEvents(), currentSettings));
    setBacklog(getTasks().filter(task => task.deferred && !task.done));
    setTasksByDate(Object.fromEntries(dates.map(date => [date, getTasksForDate(date)])));
    setTracking(getTrackingEntries()); setKlausuren(getKlausuren());
  }, [accountMode, weekStartDate, tick]);

  return (
    <>
      {!account&&<NavBar />}
      <main className={cn("flex-1 pb-24 pt-4 px-4 max-w-5xl mx-auto w-full",account?"md:pt-10":"md:pt-24")}>
        {planningError && <p role="alert" className="mb-3 text-sm text-red-700">{planningError}</p>}
        <PlanningBacklog account={accountMode} tasks={backlog} />
        {account?<CalendarExport accountContext={account.view.account} accountInput={{tasks:remote!.tasks,events:remote!.events,tracking,klausuren}}/>:<CalendarExport/>}
        {account&&<div className="flex flex-wrap justify-between gap-3 mb-4 text-sm"><Link className="underline" href="/kalender">Monatskalender</Link><Link className="underline" href="/onboarding">Profil & Termine</Link><span>Tagesgrenze {maxHours}h · {settings?.freeDayPerWeek} frei</span></div>}
        {account&&<details className="mb-5 border border-slate-200 bg-white"><summary className="px-6 py-3 text-sm cursor-pointer">Woche vorbereiten · Profilzeiten und Rückstände prüfen</summary><AccountPreparationPanel account={account.view.account} initialDates={Array.from({length:7},(_,i)=>format(addDays(weekStart,i),'yyyy-MM-dd')).filter(d=>d>=format(today,'yyyy-MM-dd'))} onSaved={account.refresh}/></details>}
        {/* Header */}
        <div className="border border-slate-200 bg-white mb-5">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((w) => w - 1)}
              aria-label="Vorherige Woche"
              className="h-9 w-9 rounded-none border border-slate-200 bg-white hover:bg-slate-50 shadow-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-0">
              <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
                Lernkalender · {weekPhases.length > 1 ? "Abschnittswechsel" : weekPhases[0] ?? phase.label}{examDate && ` · noch ${Math.max(0, weeksUntilExam)} Wochen`}
              </div>
              <h1 className="font-serif text-xl text-slate-900 mt-1 leading-tight">
                {format(weekStart, "dd. MMM", { locale: de })} – {format(addDays(weekStart, 6), "dd. MMM yyyy", { locale: de })}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((w) => w + 1)}
              aria-label="Nächste Woche"
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
                    disabled={overlappingAgs}
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
              {overlappingAgs ? "Mehrere AGs aktiv: Tage bitte im Profil ändern." : "Klick zum Umschalten · Mehrere AG-Tage möglich"}
            </span>
          </div>
        </div>

        <p className="font-sans text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500 text-center mb-5">
          {weekPhases.length ? weekPhases.join(" → ") : phase.description}
        </p>
        {settings && (account&&!getStudyPhase(weekStartDate,settings)?<div className="border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">Für diesen Zeitraum ist noch kein Stationsabschnitt eingetragen. Du kannst ihn im <Link className="underline" href="/onboarding">manuellen Einstieg</Link> ergänzen.</div>:<StudySprintInfo date={weekStartDate} settings={settings}/>)}

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
                    {day.totalHours > 0 && (
                      <span
                        className={cn(
                          "font-sans text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5",
                          day.totalHours > maxHours ? "bg-red-100 text-red-700 border border-red-200"
                          : day.totalHours >= 5 ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        )}
                        title="Geplante Aufgaben und Termine. Skizzenvorschläge sind optional."
                      >
                        {day.totalHours.toFixed(1)} / {maxHours}h
                      </span>
                    )}
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

                {day.studyPhase && <p className="text-xs text-slate-600 mb-2">{day.studyPhase.label} · {PERSPECTIVE_LABELS[day.studyPhase.perspective]}{day.sprint && ` · Lernblock ${day.sprint.number}`}</p>}
                {/* Optional sketches share the remaining capacity. */}
                {day.reserveH > 0 && (
                  <p className="font-sans text-[10px] text-sky-600 mb-2 leading-snug">
                    Optional: {day.reserveH}h Skizzen ({sketchCountLabel(day.sketchCount)} skizzieren — Auswahl über „Klausur des Tages“)
                  </p>
                )}
                {/* Geplante Klausuren (Kalender-Events) — zählen 5h, sichtbar machen */}
                {day.dayEvents.filter(event => !["klausur", "probeexamen"].includes(event.eventType) && !day.dayTasks.some(task => !/^(Vorb\.|Nachb\.)/.test(task.title) && (task.title.startsWith(event.label) || task.recurringKey?.startsWith(`${event.eventType}|`)))).map(event => <p key={event.id} className="text-xs text-slate-700 mb-2">{event.label}{event.durationMinutes ? ` · ${event.durationMinutes} Min.` : ""}{event.sourceDocument && <span className="block text-[10px] text-slate-500">Quelle: {event.sourceDocument}</span>}</p>)}
                {day.dayEvents.filter((e) => e.eventType === "klausur" || e.eventType === "probeexamen").map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-2 text-xs mb-1.5 pb-1.5 border-b border-slate-100"
                  >
                    <span className="font-sans text-[10px] shrink-0 mt-0.5 px-1 py-0.5 uppercase tracking-wider font-bold bg-rose-600 text-white">
                      K
                    </span>
                    <div className="min-w-0 flex-1"><span className="font-serif text-[12px] leading-snug text-slate-900">
                      {day.completedSlots.has(e.id) ? "✓ " : ""}{e.label} <span className="font-sans text-[10px] text-slate-400">{day.completedSlots.has(e.id) ? "(geschrieben)" : "(5h Realbedingungen)"}</span>
                    </span>{account?<div className="mt-1"><button className="text-xs underline" disabled={account.busy} onClick={()=>account.openDay(day.dateStr)}>{e.linkedKlausurId?'Klausur öffnen / Zuordnung prüfen':'Klausur zuordnen'}</button></div>:<KlausurCalendarLink event={e} completed={day.completedSlots.has(e.id)} onChange={() => setTick(tick => tick + 1)} />}</div>
                  </div>
                ))}
                {day.totalHours > maxHours && <p className="text-xs text-amber-800 mb-2">Terminkonflikt: feste/manuelle Aufgaben prüfen.</p>}
                {day.isFree && <p className="text-xs text-slate-500 mb-2">Freier Tag · keine zusätzlichen Lernaufgaben</p>}
                {day.dayTasks.length === 0 ? (
                  day.dayEvents.some((e) => e.eventType === "klausur") ? null : (
                    <p className="font-sans text-[11px] text-slate-300 italic">Keine Tasks geplant.</p>
                  )
                ) : (
                  <ul className="space-y-1.5">
                    {day.dayTasks.filter(task => !task.calendarEventId || !day.dayEvents.some(event => event.id === task.calendarEventId)).map((t) => {
                      const leaf = t.linkedTopicId ? leafById.get(t.linkedTopicId) : null;
                      const termin = isTerminTitle(t.title);
                      return (
                        <li
                          key={t.id}
                          className={cn(
                            "flex items-start gap-2 text-xs border-t border-slate-100 pt-1.5 first:border-t-0 first:pt-0",
                            t.done && "opacity-50",
                          )}
                        >
                          <span
                            className={cn(
                              "font-sans text-[10px] tabular-nums shrink-0 mt-0.5 px-1 py-0.5 uppercase tracking-wider font-bold",
                              termin ? "bg-slate-900 text-white" : "text-slate-400 border border-slate-200",
                            )}
                          >
                            {termin ? "T" : leaf?.area?.toUpperCase() ?? "·"}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span
                              className={cn(
                                "font-serif text-[12px] leading-snug block",
                                t.done ? "line-through text-slate-400" : "text-slate-900",
                              )}
                            >
                              {t.title}
                            </span>
                            {t.rescheduledFrom && <span className="text-[10px] text-amber-700">Verschoben von {t.rescheduledFrom}</span>}
                            {/* Inhalts-Summary aus Rep-Schedule */}
                            {t.contentSummary && (
                              <span className="block font-sans text-[10px] text-slate-500 mt-0.5 leading-snug">
                                {t.contentSummary}
                              </span>
                            )}
                            {/* Multi-Topic-Badges */}
                            {t.linkedTopicIds && t.linkedTopicIds.length > 1 && (
                              <span className="flex flex-wrap gap-0.5 mt-1">
                                {t.linkedTopicIds.map(tid => {
                                  const tp = leafById.get(tid);
                                  if (!tp) return null;
                                  return (
                                    <span key={tid} className="inline-block px-1 py-0.5 bg-slate-100 text-slate-700 text-[8px] uppercase tracking-wider font-bold">
                                      {tp.label}
                                    </span>
                                  );
                                })}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <DayLearningHistory accountMode={accountMode} entries={tracking.filter(entry => entry.date === day.dateStr)} klausuren={klausuren} />
                {account&&<Button variant="outline" size="sm" className="mt-3 w-full" disabled={account.busy} onClick={()=>account.openDay(day.dateStr)} aria-label={`Tag bearbeiten ${day.dateStr}`}>Tag bearbeiten</Button>}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
