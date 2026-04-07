"use client";

import { useEffect, useState } from "react";
import { differenceInDays, differenceInWeeks, parseISO } from "date-fns";
import { getExamDate, getLernstart } from "@/lib/store";

export function Countdown() {
  const [days, setDays] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<number | null>(null);
  const [totalWeeks, setTotalWeeks] = useState<number>(0);
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    const exam = parseISO(getExamDate());
    const start = parseISO(getLernstart());
    const now = new Date();
    const d = differenceInDays(exam, now);
    setDays(d);
    setWeeks(differenceInWeeks(exam, now));
    setTotalWeeks(differenceInWeeks(exam, start));
    setElapsed(Math.max(0, differenceInDays(now, start)));
  }, []);

  if (days === null) return null;

  const totalDays = totalWeeks * 7;
  const progress = totalDays > 0 ? Math.min(100, Math.round((elapsed / totalDays) * 100)) : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.45)] ring-1 ring-white/5">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.18]">
        <div className="absolute -top-10 -right-10 w-72 h-72 bg-indigo-400 rounded-full blur-[110px]" />
        <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-indigo-500 rounded-full blur-[90px]" />
      </div>
      {/* fine grain top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.18em] mb-2">Examen in</p>
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
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-amber-300 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-slate-500 tracking-tight">
        <span>Start 06.04.</span>
        <span>Examen 03.09.</span>
      </div>
    </div>
  );
}
