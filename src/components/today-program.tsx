"use client";

import { useEffect, useState } from "react";
import { Check, BookMarked } from "lucide-react";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import {
  getOnboarding,
  getAgDaysForWeek,
  getWeekKey,
  getProgress,
  setTopicProgress,
} from "@/lib/store";
import { Topic } from "@/lib/types";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function pickTodaysTopics(): Topic[] {
  // Deterministisch: leafs sortiert nach niedrigstem Progress, top 3
  const leafs = getLeafTopics(TOPICS);
  const progress = getProgress();
  const ranked = [...leafs].sort((a, b) => {
    const pa = progress[a.id]?.percent ?? 0;
    const pb = progress[b.id]?.percent ?? 0;
    return pa - pb;
  });
  // Pseudo-rotation per Tag, damit jeden Tag andere Top-3
  const dayIdx = Math.floor(Date.now() / 86400000);
  const offset = dayIdx % Math.max(1, Math.floor(ranked.length / 3));
  return ranked.slice(offset * 3, offset * 3 + 3);
}

export function TodayProgram() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [isAgToday, setIsAgToday] = useState(false);
  const [agDayLabels, setAgDayLabels] = useState<string[]>([]);

  useEffect(() => {
    setTopics(pickTodaysTopics());
    const today = new Date();
    const weekKey = getWeekKey(today);
    const agDays = getAgDaysForWeek(weekKey);
    // JS Sunday=0, Monday=1 — unsere Indices 0=Mo
    const todayIdx = (today.getDay() + 6) % 7;
    setIsAgToday(agDays.includes(todayIdx));
    setAgDayLabels(agDays.map((d) => WEEKDAY_LABELS[d]));
    void getOnboarding();
  }, []);

  function toggle(id: string) {
    const next = !done[id];
    setDone({ ...done, [id]: next });
    if (next) {
      const cur = getProgress()[id]?.percent ?? 0;
      setTopicProgress(id, Math.min(100, cur + 5), "manual");
    }
  }

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="border border-slate-200 bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
            Heute · {today}
          </div>
          <h2 className="font-serif text-xl text-slate-900 leading-tight mt-1">Tagesprogramm</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAgToday ? (
            <span className="font-sans text-[10px] uppercase tracking-[0.16em] font-bold text-white bg-slate-900 px-2 py-1">
              AG-Tag
            </span>
          ) : agDayLabels.length > 0 ? (
            <span className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 border border-slate-200 px-2 py-1">
              AG diese Woche: {agDayLabels.join(", ")}
            </span>
          ) : (
            <span className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400 border border-slate-200 px-2 py-1">
              keine AG
            </span>
          )}
        </div>
      </header>

      {/* Topics */}
      <ul className="divide-y divide-slate-200">
        {topics.map((t, i) => {
          const isDone = done[t.id];
          return (
            <li key={t.id}>
              <button
                onClick={() => toggle(t.id)}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-serif text-2xl font-light text-slate-400 w-8 shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={`block font-serif text-[15px] leading-tight ${
                      isDone ? "text-slate-400 line-through" : "text-slate-900"
                    }`}
                  >
                    {t.label}
                  </span>
                  <span className="block font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mt-1">
                    {t.area === "zr" ? "Zivilrecht" : t.area === "oeffr" ? "Öffentliches Recht" : "Strafrecht"}
                  </span>
                </span>
                <span
                  className={`w-7 h-7 border flex items-center justify-center shrink-0 transition-colors ${
                    isDone ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300 text-transparent"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </span>
              </button>
            </li>
          );
        })}
        {topics.length === 0 && (
          <li className="px-6 py-8 flex items-center gap-3 text-slate-400">
            <BookMarked className="h-4 w-4" />
            <span className="font-sans text-xs">Keine Themen für heute</span>
          </li>
        )}
      </ul>
    </section>
  );
}
