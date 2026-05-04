"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2, Sparkles, Loader2, X, Scale, Star, ChevronDown, ClipboardCheck, Search } from "lucide-react";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import {
  getAgDaysForWeek,
  getWeekKey,
  getProgress,
  addTrackingEntry,
  getTasksForDate,
  getTasksSince,
  getKlausurById,
  getKlausuren,
  addTask,
  completeTask,
  uncompleteTask,
  removeTask,
  updateTask,
  setTopicProgress,
  bumpAiMetric,
  markKlausurWritten,
  previewKlausurProgressBoosts,
  isTodayInPlanRange,
  type DailyTask,
} from "@/lib/store";
import { materializeRecurringTermine } from "@/lib/plan-applier";
import type { Topic, Klausur } from "@/lib/types";
import { ActivityType, ACTIVITY_LABELS } from "@/lib/types";
import { Dialog as KlausurDialog, DialogContent as KlausurDialogContent, DialogHeader as KlausurDialogHeader, DialogTitle as KlausurDialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PromptGear } from "@/components/prompt-gear";
import { useAi } from "@/lib/use-ai";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sucht die beste Klausur für einen User-Eingabetext.
 * Match-Strategie:
 *  1. Exakter ID-Match (z.B. "kg-sr-102")
 *  2. Source-Filename enthält Query (z.B. "SR 102 ...")
 *  3. Title enthält Query (mind. 4 Zeichen, sonst zu unscharf)
 * Liefert nur einen Treffer wenn er eindeutig ist (kein zweiter Klausur-Match).
 */
function matchKlausurForTitle(input: string): Klausur | null {
  const q = input.trim().toLowerCase();
  if (q.length < 3) return null;
  const all = getKlausuren();
  if (all.length === 0) return null;

  const idMatch = all.find(k => k.id.toLowerCase() === q);
  if (idMatch) return idMatch;

  const sourceMatches = all.filter(k => k.source && k.source.toLowerCase().includes(q));
  if (sourceMatches.length === 1) return sourceMatches[0];

  if (q.length >= 4) {
    const titleMatches = all.filter(k => k.title.toLowerCase().includes(q));
    if (titleMatches.length === 1) return titleMatches[0];
  }
  return null;
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
  const newTitleMatch = useMemo(() => matchKlausurForTitle(newTitle), [newTitle]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [proposals, setProposals] = useState<AiProposal[]>([]);
  const [localReviewError, setLocalReviewError] = useState<string | null>(null);

  // Klausur-Eintragen-Dialog (wenn ein Klausur-Task abgehakt wird)
  const [klausurTask, setKlausurTask] = useState<DailyTask | null>(null);
  const [klausurEntity, setKlausurEntity] = useState<Klausur | null>(null);
  const [klausurRating, setKlausurRating] = useState(3);
  const [klausurNote, setKlausurNote] = useState("");
  const [klausurSelectedTopics, setKlausurSelectedTopics] = useState<Set<string>>(new Set());
  const validTopicIdSet = useMemo(() => new Set(getLeafTopics(TOPICS).map(t => t.id)), []);

  // Session eintragen (inline, ersetzt den FAB)
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionActivity, setSessionActivity] = useState<ActivityType>("theorie");
  const [sessionTopics, setSessionTopics] = useState<string[]>([]);
  const [sessionDuration, setSessionDuration] = useState(90);
  const [sessionRating, setSessionRating] = useState(3);
  const [sessionNote, setSessionNote] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionSaved, setSessionSaved] = useState(false);

  const { callJson, loading: reviewLoading, error: aiReviewError, reset: resetReview } = useAi("progress-review");
  const reviewError = localReviewError || aiReviewError;

  const leafs = useMemo(() => getLeafTopics(TOPICS), []);
  const today = todayStr();

  function refresh() {
    setTasks(getTasksForDate(today));
  }

  useEffect(() => {
    // Wiederkehrende Termine (AG, Rep, Lerngruppe, Sonstiges) aus dem Onboarding
    // automatisch für die nächsten 60 Tage materialisieren — unabhängig vom KI-Plan.
    // Idempotent dank Dedup auf (date, title), läuft also problemlos bei jedem Mount.
    const future = new Date();
    future.setDate(future.getDate() + 60);
    materializeRecurringTermine(today, future.toISOString().slice(0, 10));

    // Materialize auto tasks (once per day) — ABER NICHT wenn ein KI-Plan existiert,
    // der heute abdeckt (auch als Freier Tag). Dann soll der Plan sprechen, nicht pickAutoTopics.
    const existing = getTasksForDate(today);
    const hasPlanOrAuto = existing.some((t) => t.source === "auto" || t.source === "plan");
    const todayInPlanRange = isTodayInPlanRange(today);
    if (!hasPlanOrAuto && !todayInPlanRange) {
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
    // Klausur-Tasks: nicht direkt abhaken, sondern Eintragen-Dialog öffnen
    if (!task.done && task.linkedKlausurId) {
      const k = getKlausurById(task.linkedKlausurId);
      if (k) {
        setKlausurTask(task);
        setKlausurEntity(k);
        setKlausurRating(3);
        setKlausurNote("");
        setKlausurSelectedTopics(new Set(k.topicIds.filter(id => validTopicIdSet.has(id))));
        return;
      }
      // Klausur nicht (mehr) in DB → fallback auf normales Abhaken
    }
    if (task.done) uncompleteTask(task.id);
    else completeTask(task.id);
    refresh();
  }

  function toggleKlausurTopic(tid: string) {
    setKlausurSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid); else next.add(tid);
      return next;
    });
  }

  function handleConfirmKlausur() {
    if (!klausurTask || !klausurEntity) return;
    markKlausurWritten(klausurEntity, {
      rating: klausurRating,
      note: klausurNote,
      topicIds: Array.from(klausurSelectedTopics),
      validLeafIds: validTopicIdSet,
    });
    completeTask(klausurTask.id);
    setKlausurTask(null);
    setKlausurEntity(null);
    refresh();
  }

  const klausurBoostPreview = useMemo(() => {
    if (!klausurEntity) return [];
    return previewKlausurProgressBoosts(Array.from(klausurSelectedTopics), klausurRating);
  }, [klausurEntity, klausurSelectedTopics, klausurRating]);

  function handleAdd() {
    if (!newTitle.trim()) return;
    const trimmed = newTitle.trim();
    // Auto-Match gegen Klausur-DB: wenn der Titel eine Klausur erkennt → linkedKlausurId
    const matched = matchKlausurForTitle(trimmed);
    addTask({
      date: today,
      title: matched ? matched.title : trimmed,
      linkedTopicId: newTopicId || undefined,
      linkedKlausurId: matched?.id,
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

  const sessionFilteredTopics = useMemo(() => {
    if (!sessionSearch.trim()) return [];
    return leafs.filter(t => t.label.toLowerCase().includes(sessionSearch.toLowerCase())).slice(0, 8);
  }, [leafs, sessionSearch]);

  function handleSaveSession() {
    addTrackingEntry({
      date: today,
      activityType: sessionActivity,
      topicIds: sessionTopics,
      durationMinutes: sessionDuration,
      rating: sessionRating,
      note: sessionNote,
    });
    setSessionSaved(true);
    setTimeout(() => {
      setSessionSaved(false);
      setSessionOpen(false);
      setSessionActivity("theorie");
      setSessionTopics([]);
      setSessionDuration(90);
      setSessionRating(3);
      setSessionNote("");
      setSessionSearch("");
    }, 1400);
  }

  async function runAiReview() {
    setReviewOpen(true);
    setLocalReviewError(null);
    resetReview();
    setProposals([]);

    const recent = getTasksSince(14);
    const doneTasks = recent.filter((t) => t.done);
    if (doneTasks.length === 0) {
      setLocalReviewError("Keine abgehakten Aufgaben in den letzten 14 Tagen.");
      return;
    }

    const parsed = await callJson<{ proposals?: { taskId?: string; topicId: string; deltaPercent: number; reasoning: string }[] }>({
      userMessage: "Schlage Fortschritts-Deltas vor.",
      contextFlags: ["progress", "tasks", "topics", "learningNotes", "docs"],
    });
    if (!parsed) return;

    const props: AiProposal[] = (parsed.proposals || []).map((p) => {
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
  }

  function toggleProposal(i: number) {
    setProposals((ps) => ps.map((p, idx) => (idx === i ? { ...p, accepted: !p.accepted } : p)));
  }

  function confirmProposals() {
    // Aggregate deltas per topicId, apply progress
    const deltas: Record<string, number> = {};
    const taskIdsToLink: Record<string, string> = {};
    let accepted = 0;
    let rejected = 0;
    proposals.forEach((p) => {
      if (!p.accepted) { rejected++; return; }
      accepted++;
      deltas[p.topicId] = (deltas[p.topicId] || 0) + p.deltaPercent;
      if (p.taskId) taskIdsToLink[p.taskId] = p.topicId;
    });
    bumpAiMetric("proposalsAccepted", accepted);
    bumpAiMetric("proposalsRejected", rejected);
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
          <div className="flex items-center gap-2 mt-1">
            <h2 className="font-serif text-xl text-slate-900 leading-tight">Tagesprogramm</h2>
            <button
              title="Deine To-Do-Liste für heute. Auto-Tasks werden täglich aus schwachen Themen generiert (source: auto). Manuelle Aufgaben fügst du selbst hinzu. Abgehakte Tasks fließen als Kontext in die KI-Analyse auf /plan."
              className="w-4 h-4 rounded-full border border-slate-300 text-slate-400 font-sans text-[9px] font-bold flex items-center justify-center hover:border-slate-500 hover:text-slate-600 shrink-0"
            >i</button>
          </div>
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
            <span
              title="Diese Woche ist keine AG eingeplant. Im Lernkalender oder via Doc-Parser anpassen, falls doch."
              className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400 border border-slate-200 px-2 py-1 cursor-help"
            >
              keine AG
            </span>
          )}
        </div>
      </header>

      {/* Tasks */}
      <ul className="divide-y divide-slate-200">
        {tasks.map((t, i) => {
          const topic = t.linkedTopicId ? leafs.find((x) => x.id === t.linkedTopicId) : undefined;
          const klausur = t.linkedKlausurId ? getKlausurById(t.linkedKlausurId) : undefined;
          return (
            <li key={t.id} className="group">
              <div className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <span className="font-serif text-2xl font-light text-slate-400 w-8 shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <button onClick={() => handleToggle(t)} className="flex-1 min-w-0 text-left">
                  <span className="flex items-center gap-2 mb-1">
                    {klausur && (
                      <span className="inline-flex items-center gap-1 bg-accent-100 text-accent-700 font-sans text-[9px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded">
                        <Scale className="h-2.5 w-2.5" />
                        Klausur
                      </span>
                    )}
                    <span
                      className={`block font-serif text-[15px] leading-tight ${
                        t.done ? "text-slate-400 line-through" : "text-slate-900"
                      }`}
                    >
                      {t.title}
                    </span>
                  </span>
                  <span className="block font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500">
                    {klausur
                      ? `${klausur.area === "zr" ? "Zivilrecht" : klausur.area === "oeffr" ? "Öffentliches Recht" : "Strafrecht"} · ${klausur.topicIds.length} Themen`
                      : topic
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
      <div className="border-t border-slate-200 px-6 py-4">
        <div className="flex items-center gap-2 flex-wrap">
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
            disabled={!!newTitleMatch}
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
        {/* Klausur-Match-Hint */}
        {newTitleMatch && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-accent-50 text-accent-800 font-sans text-[11px] px-2 py-1 rounded">
            <Scale className="h-3 w-3" />
            Klausur erkannt: <span className="font-semibold">{newTitleMatch.title}</span>
            <span className="text-accent-600 text-[10px] ml-1">({newTitleMatch.id})</span>
          </div>
        )}
      </div>

      {/* Session eintragen (inline, ersetzt FAB) */}
      <div className="border-t border-slate-200">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSessionOpen(v => !v)}
          onKeyDown={e => e.key === "Enter" && setSessionOpen(v => !v)}
          className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ClipboardCheck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span className="font-sans text-[10px] uppercase tracking-[0.16em] font-bold text-slate-700 flex-1">
            Session eintragen
          </span>
          <span
            title="Hier trägst du nach einer Lernsession ein, was du tatsächlich gemacht hast — unabhängig vom Tagesprogramm. Wähle Aktivitätsart, suche Themen aus der Taxonomie, gib Dauer + Einschätzung an. Wird als Tracking gespeichert und fließt als Kontext in den nächsten KI-Lernplan-Update. Unterschied: Tasks = geplant · Sessions = wirklich passiert."
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 rounded-full border border-slate-300 text-slate-400 font-sans text-[9px] font-bold flex items-center justify-center hover:border-slate-500 hover:text-slate-600 shrink-0 cursor-help"
          >i</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform shrink-0", sessionOpen && "rotate-180")} />
        </div>

        {sessionOpen && (
          <div className="border-t border-slate-100 px-6 py-5 space-y-4 bg-slate-50/50">
            {sessionSaved ? (
              <div className="py-4 flex items-center justify-center gap-2 text-slate-700">
                <Check className="h-4 w-4" />
                <span className="font-sans text-sm font-medium">Eingetragen</span>
              </div>
            ) : (
              <>
                {/* Aktivitätstyp */}
                <div>
                  <label className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mb-2 block">Art</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSessionActivity(type)}
                        className={cn(
                          "font-sans text-[10px] uppercase tracking-[0.12em] font-bold px-3 py-1.5 border transition-colors",
                          sessionActivity === type
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "border-slate-200 text-slate-500 hover:border-slate-400"
                        )}
                      >{ACTIVITY_LABELS[type]}</button>
                    ))}
                  </div>
                </div>

                {/* Themen-Suche */}
                <div>
                  <label className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mb-2 block">
                    Themen ({sessionTopics.length})
                  </label>
                  {sessionTopics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {sessionTopics.map(id => {
                        const t = leafs.find(x => x.id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 border border-slate-300 bg-white font-sans text-[10px] px-2 py-0.5">
                            {t?.label || id}
                            <button onClick={() => setSessionTopics(prev => prev.filter(x => x !== id))}>
                              <X className="h-2.5 w-2.5 text-slate-400 hover:text-slate-700" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
                    <input
                      value={sessionSearch}
                      onChange={e => setSessionSearch(e.target.value)}
                      placeholder="Thema suchen…"
                      className="w-full border border-slate-200 bg-white font-sans text-[12px] pl-7 pr-3 py-2 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  {sessionFilteredTopics.length > 0 && (
                    <div className="border border-slate-200 border-t-0 bg-white max-h-28 overflow-y-auto">
                      {sessionFilteredTopics.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setSessionTopics(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]); setSessionSearch(""); }}
                          className="w-full text-left px-3 py-1.5 font-sans text-[11px] hover:bg-slate-50 flex items-center gap-2"
                        >
                          {sessionTopics.includes(t.id) && <Check className="h-2.5 w-2.5 text-slate-700 shrink-0" />}
                          <span className="truncate">{t.label}</span>
                          <span className="text-[10px] text-slate-400 ml-auto shrink-0">{t.area === "zr" ? "ZR" : t.area === "oeffr" ? "ÖR" : "SR"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dauer */}
                <div>
                  <label className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mb-2 block">Dauer</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[45, 90, 180, 300].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSessionDuration(m)}
                        className={cn(
                          "font-sans text-[10px] uppercase tracking-[0.12em] font-bold px-3 py-1.5 border transition-colors",
                          sessionDuration === m ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-500 hover:border-slate-400"
                        )}
                      >{m < 60 ? `${m} min` : `${m / 60} h`}</button>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <label className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mb-2 block">Wie lief es?</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSessionRating(n)}
                        className={cn(
                          "w-9 h-9 border flex items-center justify-center transition-colors",
                          n <= sessionRating ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-300 hover:border-slate-400"
                        )}
                      >
                        <Star className="h-3.5 w-3.5" fill={n <= sessionRating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notiz */}
                <div>
                  <label className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mb-2 block">Notiz (optional)</label>
                  <textarea
                    value={sessionNote}
                    onChange={e => setSessionNote(e.target.value)}
                    placeholder="Was habe ich gelernt? Was war schwierig?"
                    rows={2}
                    className="w-full border border-slate-200 bg-white font-sans text-[12px] px-3 py-2 focus:outline-none focus:border-slate-900 resize-none"
                  />
                </div>

                <button
                  onClick={handleSaveSession}
                  disabled={sessionTopics.length === 0}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-accent-600 disabled:opacity-40 text-white font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-4 py-2 transition-colors"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Eintragen
                </button>
              </>
            )}
          </div>
        )}
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
        <div className="ml-auto"><PromptGear promptId="progress-review" compact /></div>
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

      {/* Klausur-Eintragen-Dialog (öffnet sich beim Abhaken einer Klausur-Task) */}
      <KlausurDialog
        open={!!klausurTask}
        onOpenChange={(open) => { if (!open) { setKlausurTask(null); setKlausurEntity(null); } }}
      >
        <KlausurDialogContent className="max-w-lg mx-auto max-h-[85vh] overflow-y-auto rounded-2xl">
          <KlausurDialogHeader>
            <KlausurDialogTitle className="flex items-center gap-2 text-sm">
              <Scale className="h-4 w-4 text-accent-600" />
              Klausur eintragen: {klausurEntity?.title}
            </KlausurDialogTitle>
          </KlausurDialogHeader>

          {klausurEntity && (
            <div className="space-y-4 pt-2">
              {/* Rating */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">
                  Wie gut bist du klargekommen? ({klausurRating}/5)
                </label>
                <div className="text-[10px] text-slate-400 mb-2">
                  1 = gar nicht verstanden · 3 = solide · 5 = locker durchgespielt
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setKlausurRating(n)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        n <= klausurRating
                          ? "bg-amber-100 text-amber-600"
                          : "bg-slate-100 text-slate-300"
                      )}
                    >
                      <Star className="h-5 w-5" fill={n <= klausurRating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Topics mit Boost-Preview */}
              {klausurEntity.topicIds.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">
                    Welche Themen wurden abgedeckt?
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
                    {klausurEntity.topicIds
                      .filter(tid => validTopicIdSet.has(tid))
                      .map(tid => {
                        const t = TOPICS.find(x => x.id === tid);
                        const checked = klausurSelectedTopics.has(tid);
                        const boost = klausurBoostPreview.find(b => b.topicId === tid);
                        return (
                          <label
                            key={tid}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs",
                              checked ? "bg-accent-50" : "hover:bg-slate-50"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleKlausurTopic(tid)}
                              className="h-3.5 w-3.5 accent-accent-600"
                            />
                            <span className="flex-1 truncate">{t?.label || tid}</span>
                            {checked && boost && boost.delta > 0 && (
                              <span className="text-[10px] text-accent-600 font-medium tabular-nums">
                                {boost.before}% → {boost.after}% +{boost.delta}
                              </span>
                            )}
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notizen (optional)</label>
                <Textarea
                  value={klausurNote}
                  onChange={e => setKlausurNote(e.target.value)}
                  placeholder="Was lief gut? Was muss ich wiederholen?"
                  rows={2}
                  className="resize-none rounded-xl text-sm"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => { setKlausurTask(null); setKlausurEntity(null); }}
                  variant="outline"
                  className="flex-1 rounded-xl"
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleConfirmKlausur}
                  className="flex-1 bg-gradient-to-r from-slate-900 to-accent-600 rounded-xl"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Eintragen
                </Button>
              </div>
            </div>
          )}
        </KlausurDialogContent>
      </KlausurDialog>
    </section>
  );
}
