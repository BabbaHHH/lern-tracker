"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2, Sparkles, Loader2, X } from "lucide-react";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import {
  getAgDaysForWeek,
  getWeekKey,
  getProgress,
  getTasksForDate,
  getTasksSince,
  addTask,
  completeTask,
  uncompleteTask,
  removeTask,
  updateTask,
  setTopicProgress,
  type DailyTask,
} from "@/lib/store";
import type { Topic } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickAutoTopics(): Topic[] {
  const leafs = getLeafTopics(TOPICS);
  const progress = getProgress();
  const ranked = [...leafs].sort((a, b) => {
    const pa = progress[a.id]?.percent ?? 0;
    const pb = progress[b.id]?.percent ?? 0;
    return pa - pb;
  });
  const dayIdx = Math.floor(Date.now() / 86400000);
  const offset = dayIdx % Math.max(1, Math.floor(ranked.length / 3));
  return ranked.slice(offset * 3, offset * 3 + 3);
}

interface AiProposal {
  taskId?: string;
  topicId: string;
  topicLabel: string;
  deltaPercent: number;
  reasoning: string;
  accepted: boolean;
}

export function TodayProgram() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [isAgToday, setIsAgToday] = useState(false);
  const [agDayLabels, setAgDayLabels] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newTopicId, setNewTopicId] = useState<string>("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AiProposal[]>([]);

  const leafs = useMemo(() => getLeafTopics(TOPICS), []);
  const today = todayStr();

  function refresh() {
    setTasks(getTasksForDate(today));
  }

  useEffect(() => {
    // Materialize auto tasks (once per day)
    const existing = getTasksForDate(today);
    const hasAuto = existing.some((t) => t.source === "auto");
    if (!hasAuto) {
      const picks = pickAutoTopics();
      picks.forEach((t) =>
        addTask({
          date: today,
          title: t.label,
          linkedTopicId: t.id,
          source: "auto",
        })
      );
    }
    refresh();

    const now = new Date();
    const weekKey = getWeekKey(now);
    const agDays = getAgDaysForWeek(weekKey);
    const todayIdx = (now.getDay() + 6) % 7;
    setIsAgToday(agDays.includes(todayIdx));
    setAgDayLabels(agDays.map((d) => WEEKDAY_LABELS[d]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggle(task: DailyTask) {
    if (task.done) uncompleteTask(task.id);
    else completeTask(task.id);
    refresh();
  }

  function handleAdd() {
    if (!newTitle.trim()) return;
    addTask({
      date: today,
      title: newTitle.trim(),
      linkedTopicId: newTopicId || undefined,
      source: "manual",
    });
    setNewTitle("");
    setNewTopicId("");
    refresh();
  }

  function handleDelete(id: string) {
    removeTask(id);
    refresh();
  }

  async function runAiReview() {
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError(null);
    setProposals([]);

    try {
      const recent = getTasksSince(14);
      const doneTasks = recent.filter((t) => t.done);
      if (doneTasks.length === 0) {
        setReviewError("Keine abgehakten Aufgaben in den letzten 14 Tagen.");
        setReviewLoading(false);
        return;
      }
      const leafList = leafs
        .map((t) => `${t.id}|${t.area}|${t.label}`)
        .join("\n");
      const taskList = doneTasks
        .map(
          (t) =>
            `- id=${t.id} | date=${t.date} | title="${t.title}" | linkedTopicId=${t.linkedTopicId || "—"} | source=${t.source}`
        )
        .join("\n");
      const progress = getProgress();
      const progressList = leafs
        .map((t) => `${t.id}: ${progress[t.id]?.percent || 0}%`)
        .join("\n");

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "strong",
          messages: [
            {
              role: "system",
              content: `Du bewertest abgehakte Lern-Aufgaben eines Jura-Referendars (2. Staatsexamen) und schlägst Fortschritts-Deltas pro Topic vor.

REGELN:
1. Ordne jede Aufgabe einer topicId aus der LEAF-TOPIC-LISTE zu (bei "linkedTopicId=—" selbst zuordnen).
2. Schlage ein deltaPercent vor: abhängig vom aktuellen Progress des Topics (je niedriger der Stand, desto höherer Zuwachs). Richtwerte:
   - Progress < 20%: +8–12%
   - Progress 20–50%: +4–8%
   - Progress 50–80%: +2–4%
   - Progress > 80%: +1–2%
3. Dauer/Tiefe einschätzen: mehrere Aufgaben zum selben Topic an einem Tag → Bonus. Oberflächliche Titel ("kurz angeschaut") → weniger.
4. Gib KURZE Begründung (max 1 Satz).

Antworte AUSSCHLIESSLICH mit gültigem JSON im Format:
{"proposals":[{"taskId":"...","topicId":"...","deltaPercent":5,"reasoning":"..."}]}`,
            },
            {
              role: "user",
              content: `LEAF-TOPICS (id|area|label):
${leafList}

AKTUELLER PROGRESS:
${progressList}

ABGEHAKTE AUFGABEN (letzte 14 Tage):
${taskList}

Schlage Fortschritts-Deltas vor.`,
            },
          ],
        }),
      });
      const data = await res.json();
      const reply = data.reply || "";
      const match = reply.match(/\{[\s\S]*\}/);
      if (!match) {
        setReviewError("KI-Antwort konnte nicht geparsed werden.");
        setReviewLoading(false);
        return;
      }
      const parsed = JSON.parse(match[0]);
      const props: AiProposal[] = (parsed.proposals || []).map((p: { taskId?: string; topicId: string; deltaPercent: number; reasoning: string }) => {
        const topic = leafs.find((t) => t.id === p.topicId);
        return {
          taskId: p.taskId,
          topicId: p.topicId,
          topicLabel: topic?.label || p.topicId,
          deltaPercent: Math.max(0, Math.min(20, Number(p.deltaPercent) || 0)),
          reasoning: p.reasoning || "",
          accepted: true,
        };
      });
      setProposals(props);
    } catch {
      setReviewError("Fehler beim KI-Call. API-Konfiguration prüfen.");
    }
    setReviewLoading(false);
  }

  function toggleProposal(i: number) {
    setProposals((ps) => ps.map((p, idx) => (idx === i ? { ...p, accepted: !p.accepted } : p)));
  }

  function confirmProposals() {
    // Aggregate deltas per topicId, apply progress
    const deltas: Record<string, number> = {};
    const taskIdsToLink: Record<string, string> = {};
    proposals.forEach((p) => {
      if (!p.accepted) return;
      deltas[p.topicId] = (deltas[p.topicId] || 0) + p.deltaPercent;
      if (p.taskId) taskIdsToLink[p.taskId] = p.topicId;
    });
    const progress = getProgress();
    Object.entries(deltas).forEach(([topicId, delta]) => {
      const cur = progress[topicId]?.percent || 0;
      setTopicProgress(topicId, Math.min(100, cur + delta), "ai");
    });
    // Rückwärts Topic-Zuordnung in Tasks schreiben (für spätere Context-Qualität)
    Object.entries(taskIdsToLink).forEach(([taskId, topicId]) => {
      updateTask(taskId, { linkedTopicId: topicId });
    });
    setReviewOpen(false);
    setProposals([]);
    refresh();
  }

  const todayLabel = new Date().toLocaleDateString("de-DE", {
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
            Heute · {todayLabel}
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
              AG: {agDayLabels.join(", ")}
            </span>
          ) : (
            <span className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400 border border-slate-200 px-2 py-1">
              keine AG
            </span>
          )}
        </div>
      </header>

      {/* Tasks */}
      <ul className="divide-y divide-slate-200">
        {tasks.map((t, i) => {
          const topic = t.linkedTopicId ? leafs.find((x) => x.id === t.linkedTopicId) : undefined;
          return (
            <li key={t.id} className="group">
              <div className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <span className="font-serif text-2xl font-light text-slate-400 w-8 shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <button onClick={() => handleToggle(t)} className="flex-1 min-w-0 text-left">
                  <span
                    className={`block font-serif text-[15px] leading-tight ${
                      t.done ? "text-slate-400 line-through" : "text-slate-900"
                    }`}
                  >
                    {t.title}
                  </span>
                  <span className="block font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mt-1">
                    {topic
                      ? topic.area === "zr"
                        ? "Zivilrecht · " + topic.label
                        : topic.area === "oeffr"
                        ? "Öffentliches Recht · " + topic.label
                        : "Strafrecht · " + topic.label
                      : t.source === "manual"
                      ? "Eigene Aufgabe · ohne Topic"
                      : "—"}
                  </span>
                </button>
                {t.source === "manual" && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 shrink-0 transition-opacity"
                    title="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleToggle(t)}
                  className={`w-7 h-7 border flex items-center justify-center shrink-0 transition-colors ${
                    t.done ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300 text-transparent hover:border-slate-900"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
        {tasks.length === 0 && (
          <li className="px-6 py-6 font-sans text-xs text-slate-400">Keine Aufgaben für heute.</li>
        )}
      </ul>

      {/* Add manual task */}
      <div className="border-t border-slate-200 px-6 py-4 flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Eigene Aufgabe hinzufügen…"
          className="flex-1 min-w-[180px] border border-slate-200 bg-white font-sans text-[13px] px-3 py-2 focus:outline-none focus:border-slate-900"
        />
        <select
          value={newTopicId}
          onChange={(e) => setNewTopicId(e.target.value)}
          className="border border-slate-200 bg-white font-sans text-[12px] px-2 py-2 focus:outline-none focus:border-slate-900 max-w-[180px]"
        >
          <option value="">Topic (optional)</option>
          {leafs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-accent-600 text-white font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-3 py-2 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Hinzufügen
        </button>
      </div>

      {/* KI-Review */}
      <div className="border-t border-slate-200 px-6 py-4 flex items-center gap-3 flex-wrap">
        <button
          onClick={runAiReview}
          className="inline-flex items-center gap-2 border border-slate-900 bg-white hover:bg-slate-900 hover:text-white text-slate-900 font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-4 py-2 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          KI bewerten & Fortschritt vorschlagen
        </button>
        <span className="font-sans text-[10px] text-slate-400">
          Analysiert abgehakte Aufgaben der letzten 14 Tage
        </span>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-xl rounded-none border border-slate-200 shadow-none p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200">
            <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
              Fortschritts-Bewertung
            </div>
            <DialogTitle className="font-serif text-xl text-slate-900 font-normal tracking-tight mt-1">
              KI-Vorschläge prüfen
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {reviewLoading && (
              <div className="px-6 py-10 flex items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-sans text-sm">KI analysiert…</span>
              </div>
            )}
            {reviewError && (
              <div className="px-6 py-8 font-sans text-sm text-slate-600">{reviewError}</div>
            )}
            {!reviewLoading && !reviewError && proposals.length > 0 && (
              <ul className="divide-y divide-slate-200">
                {proposals.map((p, i) => (
                  <li key={i}>
                    <button
                      onClick={() => toggleProposal(i)}
                      className="w-full flex items-start gap-4 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span
                        className={`w-6 h-6 border flex items-center justify-center shrink-0 mt-0.5 ${
                          p.accepted ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300 text-transparent"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-serif text-[15px] text-slate-900 leading-tight">
                          {p.topicLabel}
                        </span>
                        <span className="block font-sans text-[11px] text-slate-500 mt-1 leading-snug">
                          {p.reasoning}
                        </span>
                      </span>
                      <span className="font-serif text-lg font-light text-slate-900 shrink-0 tabular-nums">
                        +{p.deltaPercent}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!reviewLoading && !reviewError && proposals.length === 0 && (
              <div className="px-6 py-8 font-sans text-sm text-slate-500">Keine Vorschläge.</div>
            )}
          </div>

          {!reviewLoading && proposals.length > 0 && (
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
              <span className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500">
                {proposals.filter((p) => p.accepted).length} von {proposals.length} akzeptiert
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setReviewOpen(false)}
                  className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-4 py-2 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Abbrechen
                </button>
                <button
                  onClick={confirmProposals}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-accent-600 text-white font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-4 py-2 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  Übernehmen
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
