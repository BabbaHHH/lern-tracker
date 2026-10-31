"use client";

import { currentDate } from "@/lib/dates";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { examCountdown, isDateOnly } from "@/lib/dates";
import { getExamDate, getLernstart } from "@/lib/store";

export function Countdown({accountDates}:{accountDates?:{exam:string;start:string}}={}) {
  return accountDates?<AccountCountdown dates={accountDates}/>:<BrowserCountdown/>;
}
function AccountCountdown({dates}:{dates:{exam:string;start:string}}){
  const [now,setNow]=useState(()=>currentDate());
  useEffect(()=>{const timer=setInterval(()=>setNow(currentDate()),60000);return()=>clearInterval(timer);},[]);
  return <CountdownView dates={{...dates,now}}/>;
}
function BrowserCountdown() {
  const [dates, setDates] = useState<{ exam: string; start: string; now: Date } | null>(null);
  useEffect(() => {
    const refresh = () => setDates({ exam: getExamDate(), start: getLernstart(), now: currentDate() });
    // Hydrate browser-owned settings, then update across midnight and tab changes.
    refresh();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  if (!dates) return null;
  return <CountdownView dates={dates}/>;
}
function CountdownView({dates}:{dates:{exam:string;start:string;now:Date}}){
  const countdown = examCountdown(dates.exam, dates.start, dates.now);
  if (!countdown) return <Link href="/onboarding" className="block border border-slate-200 p-5 text-sm text-slate-600">Prüfungstermin eintragen und Countdown starten →</Link>;
  const { days, weeks, progress, passed } = countdown;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.45)] ring-1 ring-white/5">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.18]">
        <div className="absolute -top-10 -right-10 w-72 h-72 bg-accent-400 rounded-full blur-[110px]" />
        <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-accent-500 rounded-full blur-[90px]" />
      </div>
      {/* fine grain top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.18em] mb-2">{passed ? "Prüfungstermin vergangen" : days === 0 ? "Heute ist dein Prüfungstermin" : "Examen in"}</p>
          <div className="flex items-baseline gap-2.5">
            <span className="text-5xl font-black tabular-nums tracking-tight bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">{days}</span>
            <span className="text-base font-medium text-slate-400">Tagen</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 tracking-tight">{weeks} Wochen verbleibend</p>
        </div>

        {/* Mini progress ring */}
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke="url(#progress-gradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 1.76} 176`}
            />
            <defs>
              <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-bold tabular-nums text-white/90">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mt-5 h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-400 via-accent-300 to-amber-300 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-slate-500 tracking-tight">
        <span>Start {isDateOnly(dates.start) ? format(parseISO(dates.start), "dd.MM.yyyy") : "offen"}</span>
        <span>Examen {format(parseISO(dates.exam), "dd.MM.yyyy")}</span>
      </div>
    </div>
  );
}
