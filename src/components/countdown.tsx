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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400 rounded-full blur-[80px]" />
      </div>

      <div className="relative flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Examen in</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tabular-nums tracking-tight">{days}</span>
            <span className="text-lg font-medium text-slate-400">Tagen</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{weeks} Wochen verbleibend</p>
        </div>

        {/* Mini progress ring */}
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
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
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
        <span>Start 06.04.</span>
        <span>Examen 03.09.</span>
      </div>
    </div>
  );
}
