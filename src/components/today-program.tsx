"use client";
import {AccountDayPanel,type AccountScheduleData} from "./account-schedule";
import { RECALL_LABELS, type RecallRating } from "@/lib/spaced-repetition";
import { KlausurCalendarLink } from "./klausur-calendar-link";
import { completedExamSlots } from "@/lib/klausur-calendar";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2, Pencil, Sparkles, Loader2, X, Scale, Star, ChevronDown, ClipboardCheck, Search } from "lucide-react";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import {
  getAgDaysForWeek,
  getWeekKey,
  getProgress,
  addTrackingEntry,
  getTasks,
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
  PLAUSIBLE_KLAUSUR_TOPICS_MAX,
  markTasksReviewed,
  previewKlausurProgressBoosts,
  getOnboarding,
  getCalendarEvents,
  getKlausurenWritten,
  STORAGE_KEYS,
  type DailyTask,
} from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { prepareLearningDays } from "@/lib/plan-applier";
import { StudySprintInfo } from "@/components/study-sprint-info";
import type { StudyPhaseSettings } from "@/lib/study-phases";
import { computeDayBudget, dailyHours, eventsOnDate, isStudyFreeDay, planningEvents, sketchCountLabel } from "@/lib/day-budget";
import { PdfIpadQr } from "@/components/pdf-ipad-qr";
import { format as formatDate } from "date-fns";
import { de } from "date-fns/locale";
import { localDate, currentDate } from "@/lib/dates";
import { PlanningBacklog } from "@/components/planning-backlog";
import type { Klausur } from "@/lib/types";
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
  return localDate();
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

// pickAutoTopics jetzt zentral in @/lib/auto-picker (Date-stabil + Wochenplaner-fähig)

interface AiProposal {
  taskId?: string;
  topicId: string;
  topicLabel: string;
  deltaPercent: number;
  reasoning: string;
  accepted: boolean;
}

export function TodayProgram({account}:{account?:AccountScheduleData}={}) {return account?<AccountDayPanel data={account}/>:<BrowserTodayProgram/>;}
function BrowserTodayProgram() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [backlog, setBacklog] = useState<DailyTask[]>([]);
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);
  const [maxHours, setMaxHours] = useState(7);
  const [isFree, setIsFree] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [studySettings, setStudySettings] = useState<StudyPhaseSettings | null>(null);
  // Heute geplante Klausuren (Kalender-Events aus dem KI-Plan) — die sind KEINE
  // Tasks und wären sonst im Tagesprogramm unsichtbar, obwohl sie 5h belegen.
  const [klausurEvents, setKlausurEvents] = useState<CalendarEvent[]>([]);
  // Anzahl heute im Modus "Geschrieben" eingetragener Klausuren — daraus leitet
  // sich der Abhak-Status der Klausur-Events ab (kein eigener Speicher-Zustand:
  // nicht eingetragen = nicht geschrieben, Punkt).
  const [completedSlots, setCompletedSlots] = useState<Set<string>>(new Set());
  const [klausurEventHint, setKlausurEventHint] = useState(false);
  const [isAgToday, setIsAgToday] = useState(false);
  const [agDayLabels, setAgDayLabels] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newTopicId, setNewTopicId] = useState<string>("");
  const newTitleMatch = useMemo(() => matchKlausurForTitle(newTitle), [newTitle]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [recallTaskId, setRecallTaskId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AiProposal[]>([]);
  const [localReviewError, setLocalReviewError] = useState<string | null>(null);

  const [klausurTaskId, setKlausurTaskId] = useState<string | undefined>();

  // Klausur-Eintragen-Dialog (wenn ein Klausur-Task abgehakt wird)
  const [klausurEntity, setKlausurEntity] = useState<Klausur | null>(null);
  const [klausurRating, setKlausurRating] = useState(3);
  const [klausurNote, setKlausurNote] = useState("");
  const [klausurMode, setKlausurMode] = useState<"written" | "read">("written");
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
  const { callJson: callJsonSingle, loading: singleLoading, error: aiSingleError, reset: resetSingle } = useAi("progress-review-task");
  const reviewError = localReviewError || aiReviewError || aiSingleError;

  // Single-Task-Review State
  const [reviewMode, setReviewMode] = useState<"batch" | "single">("batch");
  const [singleTaskTitle, setSingleTaskTitle] = useState("");
  const [singleTaskLoading, setSingleTaskLoading] = useState<string | null>(null); // task.id während KI lädt

  // Inline-Edit State für manuelle Tasks
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTopicId, setEditTopicId] = useState("");

  function startEdit(t: DailyTask) {
    setEditingTaskId(t.id);
    setEditTitle(t.title);
    setEditTopicId(t.linkedTopicId || "");
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditTitle("");
    setEditTopicId("");
  }

  function saveEdit() {
    if (!editingTaskId || !editTitle.trim()) return;
    updateTask(editingTaskId, {
      title: editTitle.trim(),
      linkedTopicId: editTopicId || undefined,
      ...(tasks.find(task => task.id === editingTaskId)?.source === "auto" ? { source: "manual" as const } : {}),
    });
    cancelEdit();
    refresh();
  }

  // Termin-Reverse-Flow State (Lerngruppe/AG/Rep/KISS)
  const [lgTask, setLgTask] = useState<DailyTask | null>(null);
  const [lgContent, setLgContent] = useState("");
  const [lgProposals, setLgProposals] = useState<{ summary: string; topicIds: string[]; needsClarification?: boolean } | null>(null);
  const [lgRejected, setLgRejected] = useState<Set<string>>(new Set()); // einzeln aussortierte Topic-IDs
  const { callJson: callJsonLg, loading: lgLoading, reset: resetLg } = useAi("lerngruppe-content-parser");

  const leafs = useMemo(() => getLeafTopics(TOPICS), []);
  const today = todayStr();

  function refresh() {
    try { prepareLearningDays([today]); setPlanningError(null); }
    catch (error) { setPlanningError(error instanceof Error ? error.message : "Plan konnte nicht aktualisiert werden."); }
    const settings = getOnboarding();
    setStudySettings(settings);
    const events = planningEvents(getCalendarEvents(), settings);
    setDayEvents(eventsOnDate(events, today));
    setMaxHours(dailyHours(settings));
    setIsFree(isStudyFreeDay(today, settings, events));
    setBacklog(getTasks().filter(task => task.deferred && !task.done));
    setTasks(getTasksForDate(today));
    setKlausurEvents(eventsOnDate(events, today).filter(e => e.eventType === "klausur" || e.eventType === "probeexamen"));
    setCompletedSlots(completedExamSlots(eventsOnDate(events, today), getKlausurenWritten(), today));
  }

  useEffect(() => {
    try { prepareLearningDays([today]); }
    // Hydrate browser storage after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch (error) { setPlanningError(error instanceof Error ? error.message : "Plan konnte nicht aktualisiert werden."); }
    refresh();

    const now = currentDate();
    const weekKey = getWeekKey(now);
    const agDays = getAgDaysForWeek(weekKey);
    const todayIdx = (now.getDay() + 6) % 7;
    setIsAgToday(agDays.includes(todayIdx));
    setAgDayLabels(agDays.map((d) => WEEKDAY_LABELS[d]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Andere Komponenten (z.B. Klausur des Tages) legen Tasks an — auf deren
  // Signal hin die Liste neu laden, sonst erscheint der Task erst nach Reload.
  useEffect(() => {
    const onTasksChanged = () => refresh();
    window.addEventListener("lerntracker:tasks-changed", onTasksChanged);
    return () => window.removeEventListener("lerntracker:tasks-changed", onTasksChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Abhaken eines geplanten Klausur-Events (Kalender-Event, keine Task).
   * Der Haken selbst ist DERIVED STATE (writtenTodayCount) — hier wird nur der
   * Weg zum Eintragen geöffnet:
   * 1. Existiert heute eine offene Klausur-Task (aus "Klausur des Tages") → deren Dialog
   * 2. Sonst: heutige Klausur-des-Tages-Empfehlung aus dem Cache → Dialog direkt
   * 3. Sonst: Hinweis einblenden, Klausur unten über die Karte zu wählen
   */
  function handleKlausurEventCheck() {
    const openKlausurTask = tasks.find(t => !t.done && t.linkedKlausurId && !/^Skizze/i.test(t.title));
    if (openKlausurTask) {
      handleToggle(openKlausurTask);
      return;
    }
    try {
      const prefix = `${STORAGE_KEYS.klausurRecPrefix}${today}`;
      const cacheKey = Object.keys(localStorage).find(k => k.startsWith(prefix));
      if (cacheKey) {
        const parsed = JSON.parse(localStorage.getItem(cacheKey) || "{}") as { klausurId?: string };
        const k = parsed.klausurId ? getKlausurById(parsed.klausurId) : undefined;
        if (k) {
          setKlausurTaskId(undefined);
          setKlausurEntity(k);
          setKlausurRating(3);
          setKlausurNote("");
          setKlausurMode("written");
          const valid = k.topicIds.filter(id => validTopicIdSet.has(id));
          setKlausurSelectedTopics(new Set(valid.length > PLAUSIBLE_KLAUSUR_TOPICS_MAX ? [] : valid));
          return;
        }
      }
    } catch { /* Cache kaputt → Hinweis */ }
    setKlausurEventHint(true);
  }

  function handleToggle(task: DailyTask) {
    if (!task.done && task.isReview) { setRecallTaskId(task.id); return; }
    // Klausur-Tasks die bereits als geschrieben markiert sind: permanent, nicht rückgängig machbar
    if (task.done && task.linkedKlausurId) return;
    // Klausur-Tasks: nicht direkt abhaken, sondern Eintragen-Dialog öffnen
    if (!task.done && task.linkedKlausurId) {
      const k = getKlausurById(task.linkedKlausurId);
      if (k) {
        setKlausurTaskId(task.id);
        setKlausurEntity(k);
        setKlausurRating(3);
        setKlausurNote("");
        // Skizze-Tasks (aus Klausur des Tages) → Default "Gelesen/Skizziert"
        setKlausurMode(/^Skizze/i.test(task.title) ? "read" : "written");
        // Unplausibel viele Topics (Extraktions-Fehler, z.T. 100+) → nichts
        // vorauswählen, sonst boostet das Eintragen die halbe Taxonomie.
        const valid = k.topicIds.filter(id => validTopicIdSet.has(id));
        setKlausurSelectedTopics(new Set(valid.length > PLAUSIBLE_KLAUSUR_TOPICS_MAX ? [] : valid));
        return;
      }
      // Klausur nicht (mehr) in DB → fallback auf normales Abhaken
    }
    // Termin-Tasks (AG, Lerngruppe, Rep ohne Schedule, KISS, Anki, Sonstiges):
    // bei Abhaken Reverse-Flow-Dialog öffnen, damit User nachträglich Inhalte
    // eintragen kann. Trigger: Task ist ein Termin-Pattern UND hat noch keinen
    // Inhalt (kein contentSummary, keine verlinkten Topics).
    const isTerminTask = /^(Vorb\.|Nachb\.)?\s*(Lerngruppe|AG\s|AG\(|KISS|Rep\s|Rep\(|Repetitorium|Anki|Sonstige)/i.test(task.title);
    const hasContent = !!task.contentSummary || (task.linkedTopicIds && task.linkedTopicIds.length > 0);
    if (!task.done && isTerminTask && !hasContent) {
      setLgTask(task);
      setLgContent("");
      setLgProposals(null);
      return;
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
    // klausurTask kann null sein (Eintragen direkt über das Klausur-Event-Häkchen) —
    // markKlausurWritten legt dann selbst einen erledigten Task an.
    if (!klausurEntity) return;
    try { markKlausurWritten(klausurEntity, {
      rating: klausurRating,
      taskId: klausurTaskId,
      note: klausurNote,
      topicIds: Array.from(klausurSelectedTopics),
      klausurMode,
      validLeafIds: validTopicIdSet,
    }); } catch (error) { setPlanningError(error instanceof Error ? error.message : "Speichern fehlgeschlagen."); return; }

    setKlausurEntity(null);
    setKlausurEventHint(false);
    refresh();
  }

  const klausurBoostPreview = useMemo(() => {
    if (!klausurEntity) return [];
    return previewKlausurProgressBoosts(
      Array.from(klausurSelectedTopics),
      klausurRating,
      klausurMode === "read" ? 0.5 : 1.0,
    );
  }, [klausurEntity, klausurSelectedTopics, klausurRating, klausurMode]);

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
      durationMinutes: matched ? 300 : undefined,
      klausurMode: matched ? "written" : undefined,
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

  /** Termin-Reverse-Flow: User tippt was besprochen wurde,
   *  KI ordnet Topics zu, beim Confirm wird Task abgehakt + Progress gebumpt
   *  (nur für die nicht-ausgesorteten Topics). */
  async function lgAnalyze() {
    if (!lgTask || !lgContent.trim()) return;
    resetLg();
    setLgProposals(null);
    setLgRejected(new Set());
    const parsed = await callJsonLg<{ summary?: string; topicIds?: string[]; needsClarification?: boolean }>({
      userMessage: `Termin (${lgTask.title}) am ${lgTask.date}. Was behandelt wurde:\n\n${lgContent.trim()}`,
      contextFlags: ["topics"],
      tier: "cheap",
    });
    if (!parsed) return;
    // Validate gegen Leaf-Liste
    const valid = (parsed.topicIds || []).filter(id => leafs.some(l => l.id === id));
    setLgProposals({
      summary: parsed.summary || lgContent.slice(0, 120),
      topicIds: valid,
      needsClarification: !!parsed.needsClarification,
    });
  }

  function lgToggleTopic(tid: string) {
    setLgRejected(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  }

  function lgConfirm() {
    if (!lgTask || !lgProposals) return;
    // Task abhaken + Inhalt + nur ACCEPTED Topics speichern.
    // WICHTIG: Titel NICHT ändern, damit der materializeRecurringTermine-
    // Idempotenz-Check via recurringKey weiter greift. Der Inhalt wird über
    // contentSummary in der UI als Untertitel angezeigt.
    const taskId = lgTask.id;
    const summary = lgProposals.summary;
    const acceptedTopicIds = lgProposals.topicIds.filter(id => !lgRejected.has(id));
    updateTask(taskId, {
      contentSummary: summary,
      linkedTopicIds: acceptedTopicIds,
      linkedTopicId: acceptedTopicIds[0],
    });
    // Progress-Bump pro akzeptiertem Topic (kleine Beträge)
    const progress = getProgress();
    acceptedTopicIds.forEach(tid => {
      const cur = progress[tid]?.percent || 0;
      const delta = Math.min(3, 100 - cur);
      if (delta > 0) setTopicProgress(tid, cur + delta, "ai");
    });
    completeTask(taskId);
    setLgTask(null);
    setLgContent("");
    setLgProposals(null);
    setLgRejected(new Set());
    refresh();
  }

  async function runAiReviewSingle(task: DailyTask) {
    setSingleTaskLoading(task.id);
    setLocalReviewError(null);
    resetSingle();
    setProposals([]);
    setReviewMode("single");
    setSingleTaskTitle(task.title);
    // Dialog SOFORT öffnen — damit der User Loading + Fehler sieht.
    setReviewOpen(true);

    const parsed = await callJsonSingle<{ proposals?: { taskId?: string; topicId: string; deltaPercent: number; reasoning: string }[] }>({
      userMessage: `Bewerte folgende einzelne Aufgabe:\nDatum: ${task.date}\nTitel: "${task.title}"\nlinkedTopicId: ${task.linkedTopicId || "—"}\n\nVerwende für ALLE Proposals genau diese taskId: "${task.id}"`,
      contextFlags: ["progress", "topics", "learningNotes", "docs"],
      tier: "cheap", // override — STRONG hat oft kein Credit-Budget
    });

    setSingleTaskLoading(null);
    if (!parsed) {
      // Der echte Error (HTTP-Status, API-Key, Modell-Problem, JSON-Parse)
      // steht im aiSingleError-State des Hooks — der wird via reviewError
      // im Dialog angezeigt. Hier KEIN eigenes Fallback-Setzen, das würde
      // den präziseren Hook-Error überschreiben.
      return;
    }

    // Sofort als reviewed markieren, auch wenn User nichts annimmt.
    markTasksReviewed([task.id]);
    refresh();

    // Validation: Multi-Proposal erlaubt (single-mode), aber topicId-Check bleibt
    const dropped = { invalidTopic: 0 };
    const props: AiProposal[] = (parsed.proposals || [])
      .map((p) => {
        const topic = leafs.find((t) => t.id === p.topicId);
        if (!topic) { dropped.invalidTopic++; return null; }
        return {
          taskId: task.id,
          topicId: p.topicId,
          topicLabel: topic.label,
          deltaPercent: Math.max(0, Math.min(12, Number(p.deltaPercent) || 0)),
          reasoning: p.reasoning || "",
          accepted: true,
        } as AiProposal;
      })
      .filter((p): p is AiProposal => p !== null);

    if (props.length === 0) {
      setLocalReviewError(
        dropped.invalidTopic > 0
          ? `KI schlug ${dropped.invalidTopic} Topics vor, aber keine davon stammt aus der Leaf-Liste.`
          : "KI fand keine eindeutigen Topics für diese Aufgabe — Titel zu vage?",
      );
      return;
    }
    setProposals(props);
  }

  async function runAiReview() {
    setReviewMode("batch");
    setReviewOpen(true);
    setLocalReviewError(null);
    resetReview();
    setProposals([]);

    // Nur erledigte Tasks der letzten 14 Tage, die noch NIE bewertet wurden.
    // Dieselbe Filter-Logik wie buildTasksUnreviewed im Prompt-Context, damit
    // Frontend (Mark-As-Reviewed) und KI-Input synchron sind.
    const recent = getTasksSince(14);
    const unreviewedDone = recent.filter((t) => t.done && !t.reviewedAt);
    if (unreviewedDone.length === 0) {
      setLocalReviewError(
        "Keine neuen Aufgaben zur Bewertung — entweder nichts abgehakt oder alles wurde schon bewertet.",
      );
      return;
    }

    const parsed = await callJson<{ proposals?: { taskId?: string; topicId: string; deltaPercent: number; reasoning: string }[] }>({
      userMessage: "Bewerte ausschließlich die Tasks im ERLEDIGTE TASKS ZUR BEWERTUNG-Block. Schlage Fortschritts-Deltas vor.",
      contextFlags: ["progress", "tasksUnreviewed", "topics", "learningNotes", "docs"],
      tier: "cheap", // override — STRONG hat oft kein Credit-Budget
    });
    if (!parsed) return;

    // Sofort als reviewed markieren — auch wenn der User nichts annimmt.
    // Die Tasks WURDEN bewertet (das Modell hat sie gesehen). Beim nächsten
    // Auslösen sollen sie nicht erneut auftauchen.
    markTasksReviewed(unreviewedDone.map((t) => t.id));
    refresh();

    const validIds = new Set(unreviewedDone.map((t) => t.id));
    const seenTaskIds = new Set<string>();
    const dropped = { invalidTopic: 0, unknownTask: 0, missingTask: 0, duplicateTask: 0 };
    const props: AiProposal[] = (parsed.proposals || [])
      .map((p) => {
        // taskId IST PFLICHT — ohne sie hat KI assoziativ extrapoliert
        // (z.B. Diebstahl-Boost weil "passt thematisch zu Beweisverwertung")
        // statt einen konkreten Task zu bewerten. Solche Vorschläge raus.
        if (!p.taskId) {
          dropped.missingTask++;
          return null;
        }
        // taskId muss zur aktuell gesendeten Charge gehören.
        if (!validIds.has(p.taskId)) {
          dropped.unknownTask++;
          return null;
        }
        // Pro Task max. ein Vorschlag — falls KI mehrfach für dieselbe
        // Task vorschlägt (z.B. "BVV + verwandte Themen"), nur ersten nehmen.
        if (seenTaskIds.has(p.taskId)) {
          dropped.duplicateTask++;
          return null;
        }
        const topic = leafs.find((t) => t.id === p.topicId);
        // Hard validation: topicId muss existieren — KI-Halluzinationen weg.
        if (!topic) {
          dropped.invalidTopic++;
          return null;
        }
        seenTaskIds.add(p.taskId);
        return {
          taskId: p.taskId,
          topicId: p.topicId,
          topicLabel: topic.label,
          // Hard cap 12% pro Task (Prompt sagt's auch, aber doppelt hält besser).
          deltaPercent: Math.max(0, Math.min(12, Number(p.deltaPercent) || 0)),
          reasoning: p.reasoning || "",
          accepted: true,
        } as AiProposal;
      })
      .filter((p): p is AiProposal => p !== null);

    if (props.length === 0) {
      const total = parsed.proposals?.length ?? 0;
      const reasons: string[] = [];
      if (dropped.missingTask) reasons.push(`${dropped.missingTask} ohne Task-Bezug (assoziatives Raten)`);
      if (dropped.unknownTask) reasons.push(`${dropped.unknownTask} mit unbekannter taskId`);
      if (dropped.invalidTopic) reasons.push(`${dropped.invalidTopic} mit ungültiger Topic-ID`);
      if (dropped.duplicateTask) reasons.push(`${dropped.duplicateTask} doppelt zur selben Task`);
      setLocalReviewError(
        total === 0
          ? "KI lieferte keine Vorschläge."
          : `KI lieferte ${total} Vorschläge, alle verworfen: ${reasons.join(", ")}.`,
      );
      return;
    }
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
    // Single-Mode: wenn die zugehörige Task noch nicht abgehakt ist, abhaken —
    // der User hat ja durch das Akzeptieren bestätigt "Aufgabe wurde gemacht".
    if (reviewMode === "single" && accepted > 0) {
      const allTasks = getTasks();
      Object.keys(taskIdsToLink).forEach((taskId) => {
        const t = allTasks.find((x) => x.id === taskId);
        if (t && !t.done) completeTask(t.id);
      });
    }
    setReviewOpen(false);
    setProposals([]);
    refresh();
  }

  // date-fns statt toLocaleDateString: Letzteres nutzt die ICU des jeweiligen
  // Systems — Server (Node) und Browser (Chrome) können minimal abweichen
  // (Whitespace, Locale-Fallback) → Hydration-Mismatch. date-fns ist pures JS
  // und liefert auf beiden Seiten garantiert denselben String.
  const todayLabel = formatDate(currentDate(), "EEEE, d. MMMM", { locale: de });

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
              title="Dein Tagesplan berücksichtigt Lernstand, Ausbildungsabschnitt und verfügbare Zeit. Eigene Aufgaben kannst du ergänzen; erledigte Aufgaben helfen bei der nächsten Plananpassung."
              className="w-4 h-4 rounded-full border border-slate-300 text-slate-400 font-sans text-[9px] font-bold flex items-center justify-center hover:border-slate-500 hover:text-slate-600 shrink-0"
            >i</button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(() => {
            const { totalH: shown } = computeDayBudget(tasks, dayEvents, { maxHours, suppressReserve: isFree });
            if (shown === 0) return null;
            const cls = shown > maxHours
              ? "bg-red-100 text-red-700 border border-red-200"
              : shown >= 5
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200";
            return (
              <span
                className={cn("font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-2 py-1", cls)}
                title="Geplante Aufgaben und Termine. Vorschläge für Skizzen sind optional."
              >
                {shown.toFixed(1)} / {maxHours}h
              </span>
            );
          })()}
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
      {studySettings && <StudySprintInfo date={today} settings={studySettings} />}
      {planningError && <p role="alert" className="px-6 py-3 text-sm text-red-700">{planningError}</p>}
      {isFree && <p className="px-6 py-3 text-sm text-slate-600">Freier Tag. Es werden keine zusätzlichen Lernaufgaben eingeplant. Feste oder selbst eingetragene Aufgaben bleiben sichtbar.</p>}
      {computeDayBudget(tasks, dayEvents, { maxHours, suppressReserve: isFree }).overloadH > 0 && (
        <p role="status" className="px-6 py-3 text-sm text-amber-800 bg-amber-50">Deine festen oder manuell eingetragenen Aufgaben überschreiten die Tagesgrenze. Bitte einen Termin kürzen oder verschieben; zusätzliche Lernaufgaben wurden ausgelagert.</p>
      )}
      <PlanningBacklog tasks={backlog} />
      {/* Heute geplante Klausuren (Kalender-Events aus dem KI-Plan).
          Abhakbar: der Haken ist abgeleiteter Zustand — er erscheint nur, wenn
          heute tatsächlich eine Klausur im Modus "Geschrieben" eingetragen wurde.
          Nicht eingetragen = nicht geschrieben. */}
      {klausurEvents.filter(event => !tasks.some(task => task.calendarEventId === event.id)).map((e) => {
        const isWritten = completedSlots.has(e.id);
        return (
          <div key={e.id} className="px-6 py-3 border-b border-slate-200 bg-rose-50/40">
            <div className="flex items-start gap-3">
              <span className="font-sans text-[10px] shrink-0 mt-0.5 px-1.5 py-0.5 uppercase tracking-wider font-bold bg-rose-600 text-white">
                K
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn(
                  "font-serif text-[14px] leading-snug",
                  isWritten ? "line-through text-slate-400" : "text-slate-900",
                )}>
                  {e.label}
                </div>
                <div className="font-sans text-[10px] text-slate-500 mt-0.5">
                  {isWritten
                    ? "Geschrieben & eingetragen ✓"
                    : '5h unter Realbedingungen — konkrete Klausur über „Klausur des Tages“ wählen'}
                </div>
              </div>
              <button
                onClick={() => { if (!isWritten) handleKlausurEventCheck(); }}
                title={isWritten
                  ? "Heute geschrieben & eingetragen — permanent abgehakt"
                  : "Klausur geschrieben? Hier abhaken und eintragen"}
                className={cn(
                  "w-7 h-7 border flex items-center justify-center shrink-0 transition-colors",
                  isWritten
                    ? "bg-emerald-600 border-emerald-600 text-white cursor-default"
                    : "border-slate-300 text-transparent hover:border-slate-900",
                )}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
            <KlausurCalendarLink event={e} completed={isWritten} onChange={refresh} />
            {klausurEventHint && !isWritten && (
              <div className="mt-2 ml-8 font-sans text-[10px] text-rose-700 bg-rose-100/60 border border-rose-200 px-2 py-1.5">
                Noch keine konkrete Klausur gewählt — nimm unten bei „Klausur des Tages“ eine
                Empfehlung („Schreiben“) oder trage die geschriebene Klausur in der Klausur-Datenbank ein.
              </div>
            )}
          </div>
        );
      })}
      {/* optionale Skizzenzeit-Hinweis (gleiche Formel wie Badge: computeDayBudget) */}
      {(() => {
        const { reserveH, sketchCount } = computeDayBudget(tasks, dayEvents, { maxHours, suppressReserve: isFree });
        if (sketchCount < 1) return null;
        return (
          <div className="px-6 py-2 border-b border-slate-200 bg-sky-50/40">
            <span className="font-sans text-[10px] text-sky-700">
              + {reserveH}h optionale Skizzenzeit ({sketchCountLabel(sketchCount)} skizzieren — Auswahl über „Klausur des Tages“)
            </span>
          </div>
        );
      })()}

      {/* Tasks */}
      <ul className="divide-y divide-slate-200">
        {tasks.map((t, i) => {
          const topic = t.linkedTopicId ? leafs.find((x) => x.id === t.linkedTopicId) : undefined;
          const klausur = t.linkedKlausurId ? getKlausurById(t.linkedKlausurId) : undefined;
          // Edit-Modus: nur manuelle, nicht-reviewte, heutige Tasks
          const isEditing = editingTaskId === t.id;
          const canEdit = t.source === "manual" && !t.reviewedAt && t.date === today;
          if (isEditing) {
            return (
              <li key={t.id} className="bg-accent-50/40 border-l-2 border-accent-500">
                <div className="px-6 py-4 space-y-2">
                  <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-accent-700">
                    Aufgabe bearbeiten
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                    className="w-full border border-slate-300 bg-white font-serif text-[15px] px-3 py-2 focus:outline-none focus:border-slate-900"
                  />
                  <select
                    value={editTopicId}
                    onChange={(e) => setEditTopicId(e.target.value)}
                    className="w-full border border-slate-300 bg-white font-sans text-[12px] px-2 py-2 focus:outline-none focus:border-slate-900"
                  >
                    <option value="">Topic (optional) — ohne Verknüpfung</option>
                    {leafs.map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveEdit}
                      disabled={!editTitle.trim()}
                      className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-accent-600 text-white font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Speichern
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-3 py-2 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Abbrechen
                    </button>
                  </div>
                </div>
              </li>
            );
          }
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
                  {/* Variante B: Inhalts-Summary (aus Rep-Schedule) als zweite Zeile */}
                  {t.contentSummary && (
                    <span className="block font-sans text-[11px] text-slate-600 mt-1 leading-snug">
                      {t.contentSummary}
                    </span>
                  )}
                  {/* Multi-Topic-Badges — wenn mehr als 1 Topic verlinkt */}
                  {t.linkedTopicIds && t.linkedTopicIds.length > 1 && (
                    <span className="flex flex-wrap gap-1 mt-1.5">
                      {t.linkedTopicIds.map(tid => {
                        const tp = leafs.find(x => x.id === tid);
                        if (!tp) return null;
                        return (
                          <span key={tid} className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[9px] uppercase tracking-wider font-bold">
                            {tp.label}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </button>
                {/* Einzelbewertungs-Button: noch nicht reviewed, keine Klausur-Task.
                    Sichtbar auch bei nicht-abgehakten Tasks — beim Akzeptieren der
                    Vorschläge wird die Task automatisch abgehakt. */}
                {!t.reviewedAt && !t.linkedKlausurId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); runAiReviewSingle(t); }}
                    className={`shrink-0 transition-opacity text-accent-600 hover:text-accent-700 ${singleTaskLoading === t.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    title="KI: Topics zuordnen & Fortschritt vorschlagen"
                    disabled={singleTaskLoading !== null}
                  >
                    {singleTaskLoading === t.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5" />
                    }
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(t); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 shrink-0 transition-opacity"
                    title="Bearbeiten"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {t.source === "manual" && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 shrink-0 transition-opacity"
                    title="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {klausur?.source && <PdfIpadQr source={klausur.source} />}
                <button
                  onClick={() => handleToggle(t)}
                  title={t.done && t.linkedKlausurId ? "Geschriebene Klausur — permanent abgehakt" : undefined}
                  className={`w-7 h-7 border flex items-center justify-center shrink-0 transition-colors ${
                    t.done && t.linkedKlausurId
                      ? "bg-emerald-600 border-emerald-600 text-white cursor-default"
                      : t.done
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "border-slate-300 text-transparent hover:border-slate-900"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
              {recallTaskId === t.id && !t.done && <div className="px-6 pb-4 text-sm">
                <p className="text-slate-600 mb-2">Wie gut konntest du den Inhalt ohne Nachlesen abrufen?</p>
                <div className="flex flex-wrap gap-2">{Object.entries(RECALL_LABELS).map(([rating, label]) => <Button key={rating} size="sm" variant="outline" onClick={() => {
                  try { completeTask(t.id, undefined, rating as RecallRating); setRecallTaskId(null); refresh(); }
                  catch (error) { setPlanningError(error instanceof Error ? error.message : "Speichern fehlgeschlagen."); }
                }}>{label}</Button>)}<Button size="sm" variant="ghost" onClick={() => setRecallTaskId(null)}>Abbrechen</Button></div>
              </div>}
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
          Analysiert nur neu abgehakte Aufgaben (max. 14 Tage zurück)
        </span>
        <div className="ml-auto"><PromptGear promptId="progress-review" compact /></div>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-xl rounded-none border border-slate-200 shadow-none p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200">
            <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
              {reviewMode === "single" ? "Einzelaufgabe · Fortschritts-Bewertung" : "Fortschritts-Bewertung"}
            </div>
            <DialogTitle className="font-serif text-xl text-slate-900 font-normal tracking-tight mt-1">
              {reviewMode === "single" && singleTaskTitle
                ? <span title={singleTaskTitle}>{singleTaskTitle.length > 50 ? singleTaskTitle.slice(0, 48) + "…" : singleTaskTitle}</span>
                : "KI-Vorschläge prüfen"}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {(reviewLoading || singleLoading) && (
              <div className="px-6 py-10 flex items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-sans text-sm">
                  {reviewMode === "single" ? "KI analysiert Aufgabe…" : "KI analysiert…"}
                </span>
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

      {/* Termin-Reverse-Dialog (Lerngruppe/AG/Rep/KISS — Inhalte nachträglich eintragen) */}
      <Dialog open={!!lgTask} onOpenChange={(open) => { if (!open) { setLgTask(null); setLgContent(""); setLgProposals(null); } }}>
        <DialogContent className="max-w-xl rounded-none border border-slate-200 shadow-none p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200">
            <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
              Termin — Inhalte nachtragen
            </div>
            <DialogTitle className="font-serif text-xl text-slate-900 font-normal tracking-tight mt-1">
              {lgTask?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 block mb-2">
                Was habt ihr besprochen?
              </label>
              <Textarea
                value={lgContent}
                onChange={(e) => setLgContent(e.target.value)}
                placeholder="z.B. Eigenbedarfskündigung §573, Schönheitsreparaturen, Mietminderung — frei tippen, KI sortiert die Topics zu"
                rows={4}
                className="font-serif text-[14px]"
                disabled={lgLoading || !!lgProposals}
              />
            </div>
            {/* Vorschlags-Liste — pro Topic klickbar, ausgesorterte Topics fließen NICHT in den Progress */}
            {lgProposals && (
              <div className="border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500">
                    KI-Zuordnung — klick zum An-/Abwählen
                  </div>
                  {lgProposals.topicIds.length > 0 && (
                    <div className="font-sans text-[10px] text-slate-500 tabular-nums">
                      {lgProposals.topicIds.length - lgRejected.size}/{lgProposals.topicIds.length} aktiv
                    </div>
                  )}
                </div>
                {lgProposals.needsClarification && (
                  <p className="font-sans text-[11px] text-amber-700">Eintrag zu vage — bitte konkreter formulieren.</p>
                )}
                <p className="font-serif text-[13px] text-slate-700 italic">&ldquo;{lgProposals.summary}&rdquo;</p>
                {lgProposals.topicIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {lgProposals.topicIds.map(tid => {
                      const tp = leafs.find(l => l.id === tid);
                      if (!tp) return null;
                      const rejected = lgRejected.has(tid);
                      return (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => lgToggleTopic(tid)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 border text-[10px] uppercase tracking-wider font-bold transition-colors",
                            rejected
                              ? "bg-white border-slate-200 text-slate-400 line-through"
                              : "bg-accent-50 border-accent-300 text-accent-800 hover:bg-accent-100",
                          )}
                          title={rejected ? "Klicken um wieder zu aktivieren" : "Klicken um auszusortieren"}
                        >
                          {rejected ? <X className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
                          {tp.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="font-sans text-[11px] text-slate-500">Keine Topics erkannt.</p>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
            <button
              onClick={() => { setLgTask(null); setLgContent(""); setLgProposals(null); }}
              className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-4 py-2 transition-colors"
            >
              Abbrechen
            </button>
            {!lgProposals ? (
              <button
                onClick={lgAnalyze}
                disabled={lgLoading || !lgContent.trim()}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-accent-600 text-white font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-4 py-2 transition-colors disabled:opacity-50"
              >
                {lgLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                KI zuordnen
              </button>
            ) : (() => {
              const acceptedCount = lgProposals ? (lgProposals.topicIds.length - lgRejected.size) : 0;
              const hadTopics = (lgProposals?.topicIds.length ?? 0) > 0;
              return (
                <button
                  onClick={lgConfirm}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-accent-600 text-white font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-4 py-2 transition-colors"
                  title={hadTopics && acceptedCount === 0 ? "Task wird ohne Topic-Verlinkung abgehakt (kein Progress)" : ""}
                >
                  <Check className="h-3.5 w-3.5" />
                  {hadTopics
                    ? `Übernehmen & Abhaken${acceptedCount > 0 ? ` (${acceptedCount})` : ""}`
                    : "Ohne Topic abhaken"}
                </button>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Klausur-Eintragen-Dialog (öffnet sich beim Abhaken einer Klausur-Task
          ODER über das Häkchen am geplanten Klausur-Event — dann ohne Task) */}
      <KlausurDialog
        open={!!klausurEntity}
        onOpenChange={(open) => { if (!open) { setKlausurEntity(null); } }}
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
              {/* Modus-Toggle */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
                {([
                  { v: "written", label: "✍ Geschrieben", sub: "100% Boost" },
                  { v: "read",    label: "👁 Gelesen / Skizziert", sub: "50% Boost" },
                ] as const).map(({ v, label, sub }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setKlausurMode(v)}
                    className={cn(
                      "flex-1 py-2.5 px-3 text-left transition-all",
                      klausurMode === v
                        ? v === "written" ? "bg-emerald-600 text-white" : "bg-sky-500 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <div className="font-semibold text-[11px]">{label}</div>
                    <div className={cn("text-[9px] mt-0.5", klausurMode === v ? "text-white/70" : "text-slate-400")}>{sub}</div>
                  </button>
                ))}
              </div>
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
                  onClick={() => { setKlausurEntity(null); }}
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
