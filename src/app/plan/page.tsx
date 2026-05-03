"use client";

import { useState, useEffect, useCallback } from "react";
import { NavBar } from "@/components/nav-bar";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { getProgress, getExamDate, bumpAiMetric, getOnboarding, getLernstart, type OnboardingData } from "@/lib/store";
import { DocumentManager } from "@/components/document-manager";
import { PromptGear } from "@/components/prompt-gear";
import { getPromptById } from "@/lib/prompts";
import { buildContextFor } from "@/lib/prompt-context";
import { parseStructuredPlan, stripJsonBlock, applyStructuredPlan, undoApply, savePlanToHistory, type StructuredPlan } from "@/lib/plan-applier";
import { AREA_LABELS, type Area } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Brain, Loader2, ArrowLeft, AlertTriangle,
  Clock, Target, Sparkles, RotateCcw, Check, CalendarPlus,
  Eye, EyeOff, Pencil, Save, Database, ChevronDown, ChevronRight
} from "lucide-react";
import { differenceInWeeks, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ProgressSnapshot {
  area: Area;
  areaLabel: string;
  totalTopics: number;
  doneTopics: number;
  avgProgress: number;
  weakest: { label: string; percent: number }[];
  strongest: { label: string; percent: number }[];
}

function buildProgressSnapshot(): ProgressSnapshot[] {
  const progress = getProgress();
  const leafTopics = getLeafTopics(TOPICS);

  return (["zr", "oeffr", "sr"] as Area[]).map(area => {
    const areaLeafs = leafTopics.filter(t => t.area === area);
    const withProgress = areaLeafs.map(t => ({
      label: t.label,
      percent: progress[t.id]?.percent || 0,
    }));

    const sorted = [...withProgress].sort((a, b) => a.percent - b.percent);
    const avgProgress = areaLeafs.length > 0
      ? Math.round(withProgress.reduce((sum, t) => sum + t.percent, 0) / areaLeafs.length)
      : 0;

    return {
      area,
      areaLabel: AREA_LABELS[area],
      totalTopics: areaLeafs.length,
      doneTopics: withProgress.filter(t => t.percent >= 80).length,
      avgProgress,
      weakest: sorted.filter(t => t.percent < 50).slice(0, 5),
      strongest: sorted.filter(t => t.percent >= 80).slice(-3).reverse(),
    };
  });
}


export default function PlanPage() {
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [adjustmentRequest, setAdjustmentRequest] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [structuredPlan, setStructuredPlan] = useState<StructuredPlan | null>(null);
  const [applied, setApplied] = useState<{ tasks: number; klausuren: number; skipped: number; createdTaskIds: string[]; createdEventIds: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [weeksLeft, setWeeksLeft] = useState(0);
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [lernstart, setLernstartState] = useState<string>("");
  const [examDate, setExamDateState] = useState<string>("");
  const [dataPreviewOpen, setDataPreviewOpen] = useState(false);

  // Prompt-Vorschau / -Bearbeitung vor Generierung
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [previewSystem, setPreviewSystem] = useState<string>("");
  const [previewUser, setPreviewUser] = useState<string>("");
  const [editingSystem, setEditingSystem] = useState(false);
  const [editingUser, setEditingUser] = useState(false);
  const [systemDirty, setSystemDirty] = useState(false);
  const [userDirty, setUserDirty] = useState(false);

  useEffect(() => {
    // localStorage-Hydration nach Mount, SSR-safe
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnapshots(buildProgressSnapshot());
    setWeeksLeft(differenceInWeeks(parseISO(getExamDate()), new Date()));
    setOnboarding(getOnboarding());
    setLernstartState(getLernstart());
    setExamDateState(getExamDate());
  }, []);

  const handleApply = useCallback(() => {
    if (!structuredPlan) return;
    const r = applyStructuredPlan(structuredPlan);
    bumpAiMetric("plansApplied");
    setApplied({
      tasks: r.tasksCreated,
      klausuren: r.klausurenCreated,
      skipped: r.klausurenSkipped,
      createdTaskIds: r.createdTaskIds,
      createdEventIds: r.createdEventIds,
    });
  }, [structuredPlan]);

  const handleUndo = useCallback(() => {
    if (!applied) return;
    undoApply({ createdTaskIds: applied.createdTaskIds, createdEventIds: applied.createdEventIds });
    bumpAiMetric("plansUndone");
    setApplied(null);
  }, [applied]);

  // Baut System + User-Message frisch aus aktuellen Daten + Anpassungswunsch
  const buildFullPrompt = useCallback(() => {
    const sys = getPromptById("plan-adjust");
    const context = buildContextFor(sys?.contextFlags || []);
    const userMsg = `${context}\n\n${
      adjustmentRequest
        ? `MEINE FRAGE / ANPASSUNGSWUNSCH:\n${adjustmentRequest}`
        : "Bitte analysiere meinen aktuellen Stand und passe den Lernplan an."
    }`;
    return {
      system: sys?.prompt || "",
      user: userMsg,
      tier: sys?.modelTier || "premium" as const,
    };
  }, [adjustmentRequest]);

  const openPromptPreview = useCallback(() => {
    const fp = buildFullPrompt();
    setPreviewSystem(fp.system);
    setPreviewUser(fp.user);
    setSystemDirty(false);
    setUserDirty(false);
    setPromptPreviewOpen(true);
  }, [buildFullPrompt]);

  const refreshPromptPreview = useCallback(() => {
    const fp = buildFullPrompt();
    setPreviewSystem(fp.system);
    setPreviewUser(fp.user);
    setSystemDirty(false);
    setUserDirty(false);
    setEditingSystem(false);
    setEditingUser(false);
  }, [buildFullPrompt]);

  const handleAdjust = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setStructuredPlan(null);
    setApplied(null);

    // Edits aus Vorschau respektieren — sonst frisch bauen
    let systemContent: string;
    let userContent: string;
    let tier: "premium" | "strong" | "cheap";
    if (promptPreviewOpen && (systemDirty || userDirty)) {
      systemContent = previewSystem;
      userContent = previewUser;
      tier = getPromptById("plan-adjust")?.modelTier || "premium";
    } else {
      const fp = buildFullPrompt();
      systemContent = fp.system;
      userContent = fp.user;
      tier = fp.tier;
    }

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userContent },
          ],
        }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(`Fehler: ${data.error}`);
      } else {
        const reply = data.reply as string;
        const parsed = parseStructuredPlan(reply);
        const display = parsed ? stripJsonBlock(reply) : reply;
        setStructuredPlan(parsed);
        setResult(display);
        savePlanToHistory(display, parsed);
      }
    } catch {
      setResult("Die KI ist gerade nicht erreichbar. Versuch es in einer Minute nochmal.");
    }

    setLoading(false);
  }, [promptPreviewOpen, systemDirty, userDirty, previewSystem, previewUser, buildFullPrompt]);

  return (
    <>
      <NavBar />
      <main className="flex-1 pb-20 pt-3 md:pt-16 px-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Lernplan anpassen</h1>
            <p className="text-xs text-slate-500">Claude Opus 4.6 analysiert deinen Fortschritt</p>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {snapshots.map(snap => {
            const isWeak = snap.avgProgress < 30;
            const isStrong = snap.avgProgress >= 60;
            return (
              <div key={snap.area} className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
                <div className="text-[11px] text-slate-500 font-medium">{snap.areaLabel}</div>
                <div className={cn(
                  "text-2xl font-black tabular-nums mt-0.5",
                  isWeak ? "text-red-500" : isStrong ? "text-accent-600" : "text-amber-500"
                )}>
                  {snap.avgProgress}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {snap.doneTopics}/{snap.totalTopics} fertig
                </div>
              </div>
            );
          })}
        </div>

        {/* Weak spots */}
        {snapshots.some(s => s.weakest.length > 0) && (
          <Card className="mb-5 border-red-200/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Schwachstellen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {snapshots.flatMap(s =>
                  s.weakest.map(w => (
                    <div key={w.label} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-slate-600 truncate flex-1">{w.label}</span>
                      <span className={cn(
                        "text-xs font-bold tabular-nums",
                        w.percent === 0 ? "text-red-500" : "text-amber-500"
                      )}>
                        {w.percent}%
                      </span>
                    </div>
                  ))
                ).slice(0, 8)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Time Warning */}
        {weeksLeft < 10 && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Noch {weeksLeft} Wochen</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {weeksLeft < 4 ? "Tapering-Phase: Fokus auf Wiederholung!" :
                 weeksLeft < 8 ? "Output-Phase: Klausuren schreiben ist jetzt Priorität." :
                 "Letzte Aufbau-Wochen: Kernlücken schließen."}
              </p>
            </div>
          </div>
        )}

        <div className="mb-5">
          <DocumentManager />
        </div>

        <Separator className="my-5" />

        {/* Datenbasis (Onboarding-Zusammenfassung) */}
        {onboarding && (
          <Card className="mb-5">
            <CardHeader className="pb-2">
              <button
                type="button"
                onClick={() => setDataPreviewOpen(v => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-slate-600" />
                  Datenbasis
                  <span className="text-xs font-normal text-slate-400">
                    — was die KI als Kontext nutzt
                  </span>
                </CardTitle>
                {dataPreviewOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>
            </CardHeader>
            {dataPreviewOpen && (
              <CardContent className="pt-0">
                <div className="text-left bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
                  <p><strong>Lernstart:</strong> {lernstart} · <strong>Examen:</strong> {examDate}</p>
                  <p><strong>Freier Tag:</strong> {onboarding.freeDayPerWeek}</p>

                  {onboarding.ags.length > 0 ? (
                    <div>
                      <strong>AGs ({onboarding.ags.length}):</strong>
                      <ul className="ml-4 mt-0.5 space-y-0.5">
                        {onboarding.ags.map(ag => (
                          <li key={ag.id} className="text-[11px]">
                            {ag.label} — {ag.day} ({ag.frequency}) · {ag.durationHours}h + {ag.prepHours}h Vor/{ag.postHours}h Nach
                            {ag.startDate && ` · ab ${ag.startDate}`}
                            {ag.endDate && ` · bis ${ag.endDate}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : <p><strong>AGs:</strong> keine</p>}

                  {onboarding.reps.length > 0 ? (
                    <div>
                      <strong>Repetitorien ({onboarding.reps.length}):</strong>
                      <ul className="ml-4 mt-0.5 space-y-0.5">
                        {onboarding.reps.map(r => (
                          <li key={r.id} className="text-[11px]">
                            {r.label} — {r.day} · {r.durationHours}h
                            {r.prepHours ? ` + ${r.prepHours}h Vor` : ""}
                            {r.postHours ? `/${r.postHours}h Nach` : ""}
                            {r.startDate && ` · ab ${r.startDate}`}
                            {r.endDate && ` · bis ${r.endDate}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : <p><strong>Rep:</strong> keines</p>}

                  {onboarding.lerngruppen.length > 0 && (
                    <div>
                      <strong>Lerngruppen ({onboarding.lerngruppen.length}):</strong>
                      <ul className="ml-4 mt-0.5 space-y-0.5">
                        {onboarding.lerngruppen.map(lg => (
                          <li key={lg.id} className="text-[11px]">
                            {lg.label} — {lg.day} ({lg.frequency}) · {lg.durationHours}h + {lg.prepHours}h Vor/{lg.postHours}h Nach
                            {lg.startDate && ` · ab ${lg.startDate}`}
                            {lg.endDate && ` · bis ${lg.endDate}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {onboarding.sonstiges.length > 0 && (
                    <div>
                      <strong>Sonstige Termine ({onboarding.sonstiges.length}):</strong>
                      <ul className="ml-4 mt-0.5 space-y-0.5">
                        {onboarding.sonstiges.map(s => (
                          <li key={s.id} className="text-[11px]">
                            {s.label || "Sonstiges"} — {s.day} ({s.frequency}) · {s.durationHours}h
                            {s.startDate && ` · ab ${s.startDate}`}
                            {s.endDate && ` · bis ${s.endDate}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p>
                    <strong>Probeexamen:</strong>{" "}
                    {onboarding.probeexamen1Start || "—"} / {onboarding.probeexamen2Start || "—"}
                  </p>

                  {(onboarding.kaiserSeminare?.length ?? 0) > 0 && (
                    <p><strong>Kaiserseminare:</strong> {onboarding.kaiserSeminare!.length} eingetragen</p>
                  )}

                  {(onboarding.vacationDates?.length ?? 0) > 0 && (
                    <p><strong>Urlaub:</strong> {onboarding.vacationDates!.join(", ")}</p>
                  )}

                  <p><strong>Onboarding-Dokumente:</strong> {onboarding.documents.length} hochgeladen</p>
                  <p><strong>Selbsteinschätzung:</strong> {Object.keys(onboarding.selfAssessment).length} Themen bewertet</p>
                </div>

                <div className="flex justify-end mt-2">
                  <Link href="/onboarding">
                    <Button variant="ghost" size="sm" className="h-7 text-[11px]">
                      <Pencil className="h-3 w-3 mr-1" />
                      Im Onboarding bearbeiten
                    </Button>
                  </Link>
                </div>

                <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                  Zusätzlich fließen automatisch ein: aktueller Topic-Fortschritt, Lern-Tracking, Tages-Aufgaben (14 Tage), Lern-Notizen, Kalender-Termine und alle Klausuren. Den vollständigen Prompt siehst du unten beim „Vollständigen Prompt ansehen".
                </p>
              </CardContent>
            )}
          </Card>
        )}

        {/* Adjustment Input */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <h2 className="text-base font-bold">Plan anpassen</h2>
            <Badge className="bg-purple-100 text-purple-700 text-[10px]">Opus 4.6</Badge>
            <div className="ml-auto"><PromptGear promptId="plan-adjust" /></div>
          </div>

          <Textarea
            value={adjustmentRequest}
            onChange={e => setAdjustmentRequest(e.target.value)}
            placeholder="Optional: Was möchtest du anpassen? z.B. 'Ich bin nächste Woche im Urlaub' oder 'Ich möchte mehr Strafrecht machen' — oder lass leer für eine automatische Analyse."
            rows={3}
            className="resize-none rounded-xl text-sm"
          />

          {/* Prompt-Vorschau (kollabierbar) */}
          <div className="rounded-xl border bg-slate-50">
            <button
              type="button"
              onClick={() => promptPreviewOpen ? setPromptPreviewOpen(false) : openPromptPreview()}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              <span className="flex items-center gap-2">
                {promptPreviewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {promptPreviewOpen ? "Prompt verbergen" : "Vollständigen Prompt ansehen / bearbeiten"}
              </span>
              {(systemDirty || userDirty) && (
                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                  bearbeitet
                </Badge>
              )}
            </button>

            {promptPreviewOpen && (
              <div className="border-t px-3 py-3 space-y-3">
                <p className="text-[11px] text-slate-500 leading-snug">
                  Das wird an die KI geschickt. System-Prompt = Instruktionen, User-Nachricht = ausgewertete Onboarding-Daten + dein aktueller Kontext (Fortschritt, Tracking, Klausuren etc.) + dein Anpassungswunsch.
                </p>

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshPromptPreview}
                    className="h-7 text-[11px]"
                    title="Aus aktuellen Daten neu generieren (verwirft Edits)"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Aus Daten neu bauen
                  </Button>
                </div>

                {/* System-Prompt */}
                <div className="rounded-md border bg-white">
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-slate-100/60">
                    <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      System-Prompt {systemDirty && <span className="text-amber-700 normal-case">(bearbeitet)</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingSystem(v => !v)}
                      className="text-slate-500 hover:text-slate-900 p-1 rounded"
                      title={editingSystem ? "Bearbeiten beenden" : "Bearbeiten"}
                    >
                      {editingSystem ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {editingSystem ? (
                    <Textarea
                      value={previewSystem}
                      onChange={e => { setPreviewSystem(e.target.value); setSystemDirty(true); }}
                      rows={14}
                      className="text-[11px] font-mono leading-relaxed border-0 rounded-none focus-visible:ring-0"
                    />
                  ) : (
                    <pre className="text-[11px] font-mono leading-relaxed text-slate-800 whitespace-pre-wrap p-2.5 max-h-64 overflow-auto">
                      {previewSystem}
                    </pre>
                  )}
                </div>

                {/* User-Message (Kontext) */}
                <div className="rounded-md border bg-white">
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-slate-100/60">
                    <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      User-Nachricht (Kontext) {userDirty && <span className="text-amber-700 normal-case">(bearbeitet)</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingUser(v => !v)}
                      className="text-slate-500 hover:text-slate-900 p-1 rounded"
                      title={editingUser ? "Bearbeiten beenden" : "Bearbeiten"}
                    >
                      {editingUser ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {editingUser ? (
                    <Textarea
                      value={previewUser}
                      onChange={e => { setPreviewUser(e.target.value); setUserDirty(true); }}
                      rows={20}
                      className="text-[11px] font-mono leading-relaxed border-0 rounded-none focus-visible:ring-0"
                    />
                  ) : (
                    <pre className="text-[11px] font-mono leading-relaxed text-slate-800 whitespace-pre-wrap p-2.5 max-h-96 overflow-auto">
                      {previewUser}
                    </pre>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 leading-snug">
                  Edits gelten nur für diese Generierung — Default-Prompt unverändert (dauerhaft via /admin).
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={handleAdjust}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-accent-600 hover:from-purple-700 hover:to-accent-700 rounded-xl h-11"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Opus 4.6 analysiert...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Lernplan analysieren & anpassen
              </>
            )}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <Card className="border-purple-200/50 mb-8">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  Analyse & Anpassung
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleAdjust} disabled={loading}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Neu
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {structuredPlan && (
                <div className="border border-accent-300 bg-accent-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <p className="font-semibold text-slate-800">
                        Strukturierter Plan erkannt: {structuredPlan.tasks.length} Tasks · {structuredPlan.klausuren.length} Klausuren
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        In Tagesprogramm + Lernkalender übernehmen?
                      </p>
                    </div>
                    {!applied ? (
                      <Button size="sm" onClick={handleApply} className="shrink-0">
                        <CalendarPlus className="h-4 w-4 mr-1" />
                        Übernehmen
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                          <Check className="h-3 w-3 mr-1" />
                          {applied.tasks} Tasks · {applied.klausuren} Klausuren
                          {applied.skipped > 0 && ` (${applied.skipped} Duplikate)`}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={handleUndo}>
                          Rückgängig
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {result}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
