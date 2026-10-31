"use client";

// Arbeitsbereich für eine Klausur-Schreibsession: TipTap-Editor + Sachverhalt +
// KI-Korrektur (3-Ebenen-Prompt). Modell- und Granularitätswahl, Live-/On-Demand-Feedback.

import type {ReactNode} from "react";
import type {Klausur} from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import { ArrowLeft, Loader2, Check, Sparkles, ScanText, CheckCircle2, Star, Tag, AlertTriangle, Info } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KlausurEditor } from "@/components/klausur-editor";
import { SachverhaltPanel } from "@/components/sachverhalt-panel";
import { KorrekturPanel } from "@/components/korrektur-panel";
import { KorrekturSetupDialog } from "@/components/korrektur-setup-dialog";
import { CreditBadge } from "@/components/credit-badge";
import { cn } from "@/lib/utils";
import {
  getKlausurDraftById, saveKlausurDraft,
  getKorrekturSettings, saveKorrekturSettings,
  getKlausuren, markKlausurWritten, previewKlausurProgressBoosts,
} from "@/lib/store";
import { useAi } from "@/lib/use-ai";
import {
  buildKorrekturMessages, applyKorrekturResult, extractFocus, gesamtFocus,
} from "@/lib/klausur-korrektur";
import { KORREKTUR_MODELS, getKorrekturModel } from "@/lib/ai-models";
import { loadFreeModels, getCachedFreeModels, type FreeModel } from "@/lib/free-models";
import { rankFreeModels, analyzeModel } from "@/lib/model-info";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { AREA_LABELS, type KlausurDraft, type KorrekturGranularity, type KorrekturSettings } from "@/lib/types";

const GRANULARITY_LABELS: Record<KorrekturGranularity, string> = {
  manuell: "Manuell (nur auf Knopfdruck)",
  wort: "Nach jedem Wort",
  satz: "Nach jedem Satz",
  absatz: "Nach jedem Absatz",
};

// Mindestlänge des Fokus, damit Auto-Trigger feuert (Kostenbremse).
const MIN_FOCUS_LEN: Record<Exclude<KorrekturGranularity, "manuell">, number> = {
  wort: 3,
  satz: 15,
  absatz: 40,
};

const MODEL_CLASS_LABELS: Record<string, string> = {
  premium: "Premium",
  stark: "Stark",
  mittel: "Mittel",
  günstig: "Günstig",
};

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function ctxLabel(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function topicLabel(id: string): string {
  return TOPICS.find((t) => t.id === id)?.label ?? id;
}

export interface OriginalWorkspaceAdapter {
 draft: KlausurDraft; editorKey:string; saved:boolean; status:ReactNode; links:ReactNode; feedback:ReactNode;
 klausuren:Klausur[]; disabled:boolean; preview:(ids:string[],rating:number,mode:"written"|"read")=>{topicId:string;before:number;after:number;delta:number}[];
 onUpdate:(html:string,text:string)=>void; onSachverhalt:(text:string)=>void;
 onDone:(klausur:Klausur,mode:"written"|"read",rating:number,topicIds:string[])=>Promise<boolean>;
}
export function OriginalSchreibenWorkspace({draftId,remote}:{draftId:string;remote?:OriginalWorkspaceAdapter}) {
  const [browserDraft, setDraft] = useState<KlausurDraft | null | undefined>(undefined);
  const draft = remote?.draft ?? browserDraft;
  const [settings, setSettings] = useState<KorrekturSettings | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [markedWritten, setMarkedWritten] = useState(false);
  const [freeModels, setFreeModels] = useState<FreeModel[]>(() => remote ? [] : getCachedFreeModels() ?? []);
  // Eintrag-Dialog (Fortschritt): Modus geschrieben/skizziert + Sterne + Themen-Auswahl.
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneMode, setDoneMode] = useState<"written" | "read">("written");
  const [doneRating, setDoneRating] = useState(3);
  const [doneTopics, setDoneTopics] = useState<string[]>([]);
  const [doneSelectedTopicIds, setDoneSelectedTopicIds] = useState<Set<string>>(new Set());

  const editorRef = useRef<Editor | null>(null);
  const textRef = useRef<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentFocus = useRef<string>("");
  const draftRef = useRef<KlausurDraft | null>(null);
  const pendingSave = useRef(false);
  // Settings als Ref, damit der (einmalig gebundene) Editor-onUpdate immer die
  // aktuelle Granularität/Modellwahl sieht; runAutoRef löst die Stale-Closure auf.
  const settingsRef = useRef<KorrekturSettings | null>(null);
  const runAutoRef = useRef<(gran: Exclude<KorrekturGranularity, "manuell">) => void>(() => {});

  const ai = useAi(null);

  // Initial laden (client-only / localStorage)
  useEffect(() => {
    if(remote)return;
    const d = getKlausurDraftById(draftId) ?? null;
    // Browser storage is only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(d);
    draftRef.current = d;
    if (d) {
      textRef.current = d.contentText ?? "";
      setCounts({ words: wordCount(d.contentText ?? ""), chars: (d.contentText ?? "").length });
    }
    const s = getKorrekturSettings();
    setSettings(s);
    settingsRef.current = s;
  }, [draftId, remote]);

  // Kostenlose Modelle laden (Tages-Cache; "jeden Morgen" frisch beim ersten Öffnen).
  useEffect(() => {
    if(remote)return;
    loadFreeModels().then(setFreeModels).catch(() => {/* offline/Fehler → kein Free-Group */});
  }, [remote]);

  const persist = useCallback((next: KlausurDraft) => {
    if(remote)return null;
    draftRef.current = next;
    pendingSave.current = true;
    try {
      const saved = saveKlausurDraft(next);
      draftRef.current = saved;
      pendingSave.current = false;
      setDraft(saved);
      setSaveState("saved");
      return saved;
    } catch {
      setSaveState("error");
      return null;
    }
  }, [remote]);

  const runKorrektur = useCallback(async (focus: ReturnType<typeof gesamtFocus> | null) => {
    if(remote)return;
    const cur = draftRef.current;
    const s = settingsRef.current;
    if (!cur || !focus || !focus.focus.trim() || !s) return;
    const modelInfo = getKorrekturModel(s.model);
    const messages = buildKorrekturMessages(cur, focus);
    const res = await ai.call({
      customMessages: messages,
      tier: "strong",
      model: s.model,
      maxTokens: modelInfo?.maxTokens ?? (focus.scope === "gesamt" ? 8192 : 4096),
      temperature: modelInfo?.reasoning ? undefined : 0.3,
      reasoning: modelInfo?.reasoning,
      timeoutMs: 120_000,
    });
    if (!res) return;
    lastSentFocus.current = focus.focus;
    // Typing may have continued while the request was in flight.
    const latest = draftRef.current;
    if (!latest || latest.id !== cur.id) return;
    try {
      const { draft: updated } = applyKorrekturResult(latest, focus, res.reply, s.model);
      draftRef.current = updated;
      pendingSave.current = false;
      setDraft(updated);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [ai,remote]);

  const runAutoKorrektur = useCallback((gran: Exclude<KorrekturGranularity, "manuell">) => {
    const focus = extractFocus(textRef.current, null, gran);
    if (!focus) return;
    if (focus.focus.trim().length < MIN_FOCUS_LEN[gran]) return;
    if (focus.focus === lastSentFocus.current) return; // Dedupe
    runKorrektur(focus);
  }, [runKorrektur]);

  // runAutoRef immer auf den neuesten Handler zeigen lassen (gegen Stale-Closure
  // im einmalig gebundenen Editor-onUpdate).
  useEffect(() => { runAutoRef.current = runAutoKorrektur; }, [runAutoKorrektur]);

  // Debounced Autosave + optionale Live-Korrektur bei Editor-Änderungen
  const handleEditorUpdate = useCallback((html: string, text: string) => {
    if(remote){remote.onUpdate(html,text);return;}
    textRef.current = text;
    if (draftRef.current) draftRef.current = { ...draftRef.current, contentHtml: html, contentText: text };
    pendingSave.current = true;
    setCounts({ words: wordCount(text), chars: text.length });
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const cur = draftRef.current;
      if (!cur) return;
      persist(cur);
    }, 600);

    const gran = settingsRef.current?.granularity ?? "manuell";
    if (gran !== "manuell") {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      autoTimer.current = setTimeout(() => runAutoRef.current(gran), 1800);
    }
  }, [persist,remote]);

  const handleAbschnittPruefen = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selection = editor.state.doc.textBetween(from, to, "\n").trim();
    if (!selection) {
      alert("Bitte zuerst einen Abschnitt im Text markieren.");
      return;
    }
    const focus = extractFocus(textRef.current, null, "manuell", selection);
    runKorrektur(focus);
  }, [runKorrektur]);

  const handleGesamtFeedback = useCallback(() => {
    runKorrektur(gesamtFocus(textRef.current));
  }, [runKorrektur]);

  const updateSettings = useCallback((patch: Partial<KorrekturSettings>) => {
    if(remote)return;
    setSettings((prev) => {
      const next = { ...(prev ?? getKorrekturSettings()), ...patch };
      saveKorrekturSettings(next);
      settingsRef.current = next;
      return next;
    });
  }, [remote]);

  const handleSachverhalt = useCallback((text: string) => {
    if(remote){remote.onSachverhalt(text);return;}
    const cur = draftRef.current;
    if (!cur) return;
    persist({ ...cur, sachverhalt: text });
  }, [persist,remote]);

  const validLeafIds = useMemo(() => new Set(getLeafTopics(TOPICS).map((t) => t.id)), []);

  // Dialog öffnen: Themen der verknüpften Klausur laden + gültige vorauswählen.
  const openDoneDialog = useCallback(() => {
    const cur = remote?.draft ?? draftRef.current;
    if (!cur?.klausurId) return;
    const klausur = (remote?.klausuren ?? getKlausuren()).find((k) => k.id === cur.klausurId);
    if (!klausur) return;
    setDoneTopics(klausur.topicIds);
    setDoneSelectedTopicIds(new Set(klausur.topicIds.filter((t) => validLeafIds.has(t)).length > 15 ? [] : klausur.topicIds.filter((t) => validLeafIds.has(t))));
    setDoneMode("written");
    setDoneRating(3);
    setDoneOpen(true);
  }, [validLeafIds,remote]);

  const toggleDoneTopic = useCallback((tid: string) => {
    setDoneSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid); else next.add(tid);
      return next;
    });
  }, []);

  // Live-Vorschau der Boost-Werte (abhängig von Auswahl, Rating, Modus).
  const donePreview = useMemo(
    () => remote ? remote.preview(Array.from(doneSelectedTopicIds),doneRating,doneMode) : previewKlausurProgressBoosts(
      Array.from(doneSelectedTopicIds),
      doneRating,
      doneMode === "read" ? 0.5 : 1.0,
    ),
    [doneSelectedTopicIds, doneRating, doneMode,remote],
  );

  const handleConfirmDone = useCallback(async () => {
    const cur = remote?.draft ?? draftRef.current;
    if (!cur?.klausurId) return;
    const klausur = (remote?.klausuren ?? getKlausuren()).find((k) => k.id === cur.klausurId);
    if (!klausur) return;
    if(remote){if(await remote.onDone(klausur,doneMode,doneRating,Array.from(doneSelectedTopicIds))){setMarkedWritten(true);setDoneOpen(false);}return;}
    markKlausurWritten(klausur, {
      rating: doneRating,
      validLeafIds,
      klausurMode: doneMode,
      topicIds: Array.from(doneSelectedTopicIds),
    });
    setMarkedWritten(true);
    setDoneOpen(false);
  }, [doneRating, doneMode, doneSelectedTopicIds, validLeafIds,remote]);

  // Free-Modelle nach Eignung für die Korrektur ranken (best zuerst).
  const rankedFree = useMemo(() => rankFreeModels(freeModels), [freeModels]);
  // Beschreibung + Eignung des aktuell gewählten Modells (Free oder kuratiert).
  const selectedInfo = useMemo(() => {
    const ctx = freeModels.find((m) => m.id === settings?.model)?.contextLength ?? 0;
    return settings?.model ? analyzeModel(settings.model, ctx) : null;
  }, [settings, freeModels]);

  // Flush immediately on navigation, tab close and mobile backgrounding.
  useEffect(() => {
    if(remote)return;
    const flush = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!pendingSave.current || !draftRef.current) return;
      try {
        draftRef.current = saveKlausurDraft(draftRef.current);
        pendingSave.current = false;
      } catch { /* The storage banner explains the failure; keep the pending text. */ }
    };
    const hide = () => { if (document.visibilityState === "hidden") flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (pendingSave.current) event.preventDefault();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hide);
    return () => {
      flush();
      if (autoTimer.current) clearTimeout(autoTimer.current);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [remote]);

  if (draft === undefined || (!remote && !settings)) {
    return (
      <>
        {!remote && <NavBar />}
        <main className="flex-1 pt-4 md:pt-20 px-4 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2 py-20 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Lädt …
          </div>
        </main>
      </>
    );
  }

  if (draft === null) {
    return (
      <>
        {!remote && <NavBar />}
        <main className="flex-1 pt-4 md:pt-20 px-4 max-w-5xl mx-auto w-full">
          <div className="py-20 text-center text-slate-500">
            Entwurf nicht gefunden.
            <div className="mt-3">
              <Link href="/schreiben"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Zur Übersicht</Button></Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {!remote && <NavBar />}
      <main className={`flex-1 pb-24 pt-4 ${remote ? "md:pt-6" : "md:pt-20"} px-4 max-w-6xl mx-auto w-full`}>
        {/* Topbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href="/schreiben">
            <Button variant="ghost" size="icon" className="h-9 w-9 border border-slate-200 text-slate-600">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-lg text-slate-900">{draft.title}</h1>
            <div className="text-[11px] text-slate-400">
              {draft.area ? AREA_LABELS[draft.area] : "—"}{draft.type ? ` · ${draft.type}` : ""} · {remote ? wordCount(draft.contentText) : counts.words} Wörter · {remote ? draft.contentText.length : counts.chars} Zeichen
              {" · "}
              {remote ? <span>{remote.saved ? "gespeichert und bestätigt" : "noch nicht bestätigt"}</span> : <span className={saveState === "error" ? "text-rose-700" : saveState === "saving" ? "text-amber-500" : "text-emerald-600"}>
                {saveState === "error" ? "Nicht gespeichert – bitte Text sichern" : saveState === "saving" ? "speichert …" : "gespeichert"}
              </span>}
            </div>
          </div>
          {!remote && <KorrekturSetupDialog type={draft.type} />}
          {draft.klausurId && (
            <Button variant="outline" size="sm" onClick={openDoneDialog} disabled={markedWritten || remote?.disabled}>
              {markedWritten ? <><CheckCircle2 className="h-4 w-4" /> Eingetragen</> : <><Check className="h-4 w-4" /> Fortschritt eintragen</>}
            </Button>
          )}
        </div>

        {remote?.status}
        {remote?.links}
        {/* Settings-Leiste */}
        {remote ? <div className="mb-4 flex flex-wrap items-center gap-3 border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-500"><span>KI-Korrektur bleibt im Pilot geschlossen.</span><Button size="sm" disabled><ScanText className="h-4 w-4"/> Abschnitt prüfen</Button><Button size="sm" disabled><Sparkles className="h-4 w-4"/> Gesamt-Feedback</Button></div> : <>
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-slate-200 bg-slate-50/60 px-3 py-2">
          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
            Modell
            <select
              value={settings!.model}
              onChange={(e) => updateSettings({ model: e.target.value })}
              className="h-8 border border-slate-200 bg-white px-2 text-xs text-slate-800"
            >
              {(["premium", "stark", "mittel", "günstig"] as const).map((klasse) => (
                <optgroup key={klasse} label={MODEL_CLASS_LABELS[klasse]}>
                  {KORREKTUR_MODELS.filter((m) => m.klasse === klasse).map((m) => (
                    <option key={m.id} value={m.id}>{m.label} ({m.vendor})</option>
                  ))}
                </optgroup>
              ))}
              {rankedFree.length > 0 && (
                <optgroup label={`Kostenlos · heute (${rankedFree.length}) — nach Eignung sortiert`}>
                  {rankedFree.map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.rank}{m.rank === 1 ? " ⭐" : ""} · {m.name} · {ctxLabel(m.contextLength)} · Eignung {m.fit}
                    </option>
                  ))}
                </optgroup>
              )}
              {/* Fallback: aktuell gewähltes Modell ist weder kuratiert noch (mehr) in der Free-Liste */}
              {settings!.model
                && !KORREKTUR_MODELS.some((m) => m.id === settings!.model)
                && !freeModels.some((m) => m.id === settings!.model) && (
                <optgroup label="Aktuelle Auswahl">
                  <option value={settings!.model}>{settings!.model}</option>
                </optgroup>
              )}
            </select>
          </label>

          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
            Korrektur
            <select
              value={settings!.granularity}
              onChange={(e) => updateSettings({ granularity: e.target.value as KorrekturGranularity })}
              className="h-8 border border-slate-200 bg-white px-2 text-xs text-slate-800"
            >
              {(Object.keys(GRANULARITY_LABELS) as KorrekturGranularity[]).map((g) => (
                <option key={g} value={g}>{GRANULARITY_LABELS[g]}</option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-3">
            <CreditBadge />
            <Button variant="outline" size="sm" onClick={handleAbschnittPruefen} disabled={ai.loading}>
              <ScanText className="h-4 w-4" /> Abschnitt prüfen
            </Button>
            <Button size="sm" onClick={handleGesamtFeedback} disabled={ai.loading}>
              {ai.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gesamt-Feedback
            </Button>
          </div>
        </div>

        {/* Modell-Steckbrief: was kann das gewählte Modell, wie gut passt es? */}
        {selectedInfo && (
          <div className="mb-4 -mt-1 flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-slate-700">{selectedInfo.vendor}</span>
              {selectedInfo.curated
                ? <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-500">kostenpflichtig</span>
                : <span className="ml-1.5 rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-bold text-emerald-600">kostenlos</span>}
              <span className="ml-1"> — {selectedInfo.blurb}</span>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Eignung für Korrektur (Heuristik):</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      selectedInfo.fit >= 75 ? "bg-emerald-400" : selectedInfo.fit >= 60 ? "bg-amber-400" : "bg-rose-300",
                    )}
                    style={{ width: `${selectedInfo.fit}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-600 tabular-nums">{selectedInfo.fit}/100</span>
              </div>
            </div>
          </div>
        )}

        </>}
        {/* Arbeitsfläche: Sachverhalt + Editor | Korrektur */}
        <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="min-w-0 space-y-4">
            <SachverhaltPanel key={remote ? remote.editorKey+":sachverhalt" : undefined} value={draft.sachverhalt ?? ""} onChange={handleSachverhalt} />
            <div className="min-w-0 [&>div>div:first-child]:flex-wrap [&_.ProseMirror]:break-words">
            <KlausurEditor
              key={remote ? remote.editorKey+":solution" : undefined}
              label="Lösungstext"
              initialContent={draft.contentHtml}
              onUpdate={handleEditorUpdate}
              onReady={(e) => { editorRef.current = e; }}
            />
            </div>
          </div>
          <div className="min-w-0 lg:sticky lg:top-20">
            {remote ? <><KorrekturPanel feedback={[]} loading={false} error="KI-Korrektur ist im Pilot geschlossen."/>{remote.feedback}</> : <KorrekturPanel feedback={draft.feedback} loading={ai.loading} error={ai.error} />}
          </div>
        </div>
      </main>

      {/* Fortschritt-Dialog: geschrieben vs. skizziert + Sterne (boosten unterschiedlich) */}
      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="max-w-md mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Fortschritt eintragen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Modus-Toggle */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200 text-xs font-medium">
              {([
                { v: "written", label: "✍ Geschrieben", sub: "100% Boost" },
                { v: "read", label: "👁 Gelesen / Skizziert", sub: "50% Boost" },
              ] as const).map(({ v, label, sub }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDoneMode(v)}
                  className={cn(
                    "flex-1 px-3 py-2.5 text-left transition-all",
                    doneMode === v
                      ? v === "written" ? "bg-emerald-600 text-white" : "bg-sky-500 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50",
                  )}
                >
                  <div className="text-[11px] font-semibold">{label}</div>
                  <div className={cn("mt-0.5 text-[9px]", doneMode === v ? "text-white/70" : "text-slate-400")}>{sub}</div>
                </button>
              ))}
            </div>

            {/* Sterne-Bewertung */}
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Wie gut bist du klargekommen? ({doneRating}/5)
              </label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDoneRating(n)}
                    className={cn(
                      "flex h-10 flex-1 items-center justify-center rounded-xl transition-all",
                      n <= doneRating ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-300",
                    )}
                  >
                    <Star className="h-5 w-5" fill={n <= doneRating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                1 = gar nicht verstanden · 3 = solide · 5 = locker durchgespielt. Höhere Bewertung → stärkerer Boost.
              </p>
            </div>

            {/* Themen-Auswahl mit Boost-Vorschau */}
            {doneTopics.length > 0 && (
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <Tag className="h-3 w-3" />
                  Themen — welche wurden wirklich behandelt?
                </label>
                <p className="mb-2 text-[10px] leading-snug text-slate-400">
                  Vorausgewählt: alle gültigen Themen dieser Klausur. Nicht zentral bearbeitete kannst du abwählen.
                </p>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {doneTopics.map((tid) => {
                    const isInvalid = !validLeafIds.has(tid);
                    const isSelected = doneSelectedTopicIds.has(tid);
                    const preview = donePreview.find((p) => p.topicId === tid);
                    return (
                      <label
                        key={tid}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2.5 py-1.5 text-[11px] last:border-b-0 hover:bg-slate-50",
                          isInvalid && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isInvalid}
                          onChange={() => !isInvalid && toggleDoneTopic(tid)}
                          className="rounded"
                        />
                        <span className="flex-1 truncate text-slate-700">
                          {isInvalid && <AlertTriangle className="mr-1 inline h-2.5 w-2.5 text-rose-500" />}
                          {isInvalid ? <span className="font-mono text-rose-600">{tid}</span> : topicLabel(tid)}
                        </span>
                        {isSelected && preview && (
                          <span className={cn(
                            "shrink-0 font-mono text-[10px] tabular-nums",
                            preview.delta > 0 ? "text-emerald-600" : "text-slate-400",
                          )}>
                            {preview.before}% → {preview.after}%
                            {preview.delta > 0 && <span className="ml-1 font-semibold">+{preview.delta}</span>}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  {doneSelectedTopicIds.size} von {doneTopics.length} ausgewählt · höchstens 15 Themen pro Eintrag · Boost gecapped bei 95%
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDoneOpen(false)}>Abbrechen</Button>
              <Button disabled={remote?.disabled || doneSelectedTopicIds.size > 15} onClick={handleConfirmDone}>
                <Check className="h-4 w-4" /> Eintragen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
