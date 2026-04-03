"use client";

import { useEffect, useState } from "react";
import { differenceInDays, differenceInWeeks, parseISO } from "date-fns";
import { getExamDate } from "@/lib/store";

export function Countdown() {
  const [days, setDays] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<number | null>(null);

  useEffect(() => {
    const exam = parseISO(getExamDate());
    const now = new Date();
    setDays(differenceInDays(exam, now));
    setWeeks(differenceInWeeks(exam, now));
  }, []);

  if (days === null) return null;

  const isUrgent = days < 60;
  const isClose = days < 120;

  return (
    <div className={`rounded-xl p-4 text-center ${
      isUrgent ? "bg-red-50 border border-red-200" :
      isClose ? "bg-amber-50 border border-amber-200" :
      "bg-emerald-50 border border-emerald-200"
    }`}>
      <div className={`text-3xl font-bold ${
        isUrgent ? "text-red-600" :
        isClose ? "text-amber-600" :
        "text-emerald-600"
      }`}>
        {days} Tage
      </div>
      <div className="text-sm text-gray-600 mt-1">
        ({weeks} Wochen) bis zum Examen
      </div>
    </div>
  );
}
