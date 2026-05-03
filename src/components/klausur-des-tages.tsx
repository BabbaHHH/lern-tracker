"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PromptGear } from "@/components/prompt-gear";
import { getKlausuren, markKlausurWritten, STORAGE_KEYS, addTask, getTasksForDate } from "@/lib/store";
import { getTop3Klausuren, buildKiCandidatesMessage } from "@/lib/klausur-recommender";
import { getPromptById } from "@/lib/prompts";
import { useAi } from "@/lib/use-ai";
import { Klausur, AREA_LABELS, Area } from "@/lib/types";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Scale, Zap, ChevronRight, Star,
  Check, Clock, ChevronDown, Plus, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";

const AREA_GRADIENT: Record<Area, string> = {
  zr: "from-accent-500 to-blue-600",
  oeffr: "from-amber-500 to-orange-600",
  sr: "from-rose-500 to-pink-600",
};

const CACHE_KEY_PREFIX = STORAGE_KEYS.klausurRecPrefix;

interface AiAlternative {
  klausur: Klausur;
  reason: string;
}

interface AiRecommendation {
  klausur: Klausur;
  reasons: string[];
  alternatives: AiAlternative[];
}

interface CachedRec {
  klausurId: string;
  reasons: string[];
  alternatives?: { klausurId: string; reason: string }[];
}

export function KlausurDesTages() {
  const [recommendation, setRecommendation] = useState<AiRecommendation | null>(null);
  const [hasKlausuren, setHasKlausuren] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [doneDialogOpen, setDoneDialogOpen] = useState(false);
  const [altsOpen, setAltsOpen] = useState(false);
  const [rating, setRating] = useState(3);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [addedToTasks, setAddedToTasks] = useState<string | null>(null); // klausurId der grade hinzugefügt wurde
  const leafIdSet = useMemo(() => new Set(getLeafTopics(TOPICS).map(t => t.id)), []);

  const { callJson, loading, error, reset } = useAi("klausur-select");

  const fetchRecommendation = useCallback(async (force = false) => {
    const all = getKlausuren();
    setHasKlausuren(all.length > 0);
    if (all.length === 0) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const cacheKey = CACHE_KEY_PREFIX + today;

    const buildAlts = (
      raw: { klausurId: string; reason: string }[] | undefined,
    ): AiAlternative[] =>
      (raw ?? [])
        .map(a => {
          const k2 = all.find(x => x.id === a.klausurId);
          return k2 ? { klausur: k2, reason: a.reason } : null;
        })
        .filter((x): x is AiAlternative => x !== null)
        .slice(0, 2);

    // Cache-Check (skip on force-refresh)
    if (!force) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as CachedRec;
          const k = all.find(x => x.id === parsed.klausurId);
          if (k) {
            setRecommendation({
              klausur: k,
              reasons: parsed.reasons,
              alternatives: buildAlts(parsed.alternatives),
            });
            return;
          }
        }
      } catch { /* ignore */ }
    }

    reset();

    // ── Stufe 1: Deterministischer Scorer → Top-3 ────────────────────────────
    const top3 = getTop3Klausuren(all, today);
    if (top3.length === 0) return;

    // Falls nur 1 Klausur → kein KI-Aufruf nötig
    if (top3.length === 1) {
      const k = top3[0].klausur;
      const rec: AiRecommendation = {
        klausur: k,
        reasons: ["Einzige verfügbare Klausur"],
        alternatives: [],
      };
      setRecommendation(rec);
      return;
    }

    // ── Stufe 2: KI-Plausibilitätstest unter den Top-3 ──────────────────────
    const systemPrompt = getPromptById("klausur-select")?.prompt ?? "";
    const userMessage = buildKiCandidatesMessage(top3, today);

    const parsed = await callJson<{
      klausurId: string;
      reasoning?: string[];
      alternatives?: { klausurId: string; title?: string; reason: string }[];
    }>({
      customMessages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    // Fallback auf #1 wenn KI nichts liefert
    const chosen = parsed
      ? (all.find(x => x.id === parsed.klausurId) ?? top3[0].klausur)
      : top3[0].klausur;

    // Alternativen: aus KI-Antwort oder die anderen Top-3
    let alternatives: AiAlternative[];
    if (parsed?.alternatives?.length) {
      alternatives = buildAlts(parsed.alternatives);
    } else {
      // Fallback: die anderen beiden aus Top-3
      alternatives = top3
        .filter(s => s.klausur.id !== chosen.id)
        .slice(0, 2)
        .map(s => ({ klausur: s.klausur, reason: `Score: ${s.score}` }));
    }

    const reasons = parsed?.reasoning?.length
      ? parsed.reasoning
      : [`Score: ${top3[0].score}`];

    const rec: AiRecommendation = { klausur: chosen, reasons, alternatives };
    setRecommendation(rec);

    try {
      const cacheData: CachedRec = {
        klausurId: chosen.id,
        reasons: rec.reasons,
        alternatives: alternatives.map(a => ({ klausurId: a.klausur.id, reason: a.reason })),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch { /* ignore */ }
  }, [callJson, reset]);

  /** Übernimmt eine Klausur als Task in die heutige Tagesliste.
   *  Idempotent: gleiche linkedKlausurId wird nicht doppelt eingefügt. */
  const addKlausurToToday = useCallback((kl: Klausur) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const existing = getTasksForDate(today);
    if (existing.some(t => t.linkedKlausurId === kl.id)) {
      // schon drin → nur visuelles Feedback
      setAddedToTasks(kl.id);
      setTimeout(() => setAddedToTasks(null), 1500);
      return;
    }
    addTask({
      date: today,
      title: kl.title,
      linkedKlausurId: kl.id,
      source: "manual",
    });
    setAddedToTasks(kl.id);
    setAltsOpen(false);
    setTimeout(() => setAddedToTasks(null), 1800);
  }, []);

  useEffect(() => { fetchRecommendation(false); }, [fetchRecommendation]);

  const handleDone = () => {
    if (!recommendation) return;
    markKlausurWritten(recommendation.klausur, {
      rating,
      note,
      validLeafIds: leafIdSet,
    });
    setSaved(true);
    setTimeout(() => {
      setDoneDialogOpen(false);
      setSaved(false);
      setNote("");
      setRating(3);
    }, 1500);
  };

  const getTopicLabel = (id: string) => TOPICS.find(t => t.id === id)?.label || id;

  // Keine Klausuren -> Link zur Datenbank
  if (!hasKlausuren) {
    return (
      <Link href="/klausuren">
        <div className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] p-4 flex items-center gap-3 transition-all cursor-pointer">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200/60 text-slate-700 group-hover:from-accent-50 group-hover:to-accent-100/60 group-hover:text-accent-700 group-hover:ring-accent-200/60 transition-all">
            <Scale className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 tracking-tight">Klausur-Datenbank</div>
            <div className="text-[11px] text-slate-500">Klausuren eintragen & täglich die passende üben</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    );
  }

  if (loading && !recommendation) {
    return (
      <div className="rounded-2xl bg-slate-900 p-5 text-white/70 text-xs">
        KI wählt passende Klausur…
      </div>
    );
  }

  if (error && !recommendation) {
    return (
      <div className="rounded-2xl bg-slate-900 p-5 text-white">
        <div className="text-xs text-rose-300 mb-2">{error}</div>
        <Button size="sm" variant="outline" onClick={() => fetchRecommendation(true)}>Nochmal versuchen</Button>
      </div>
    );
  }

  if (!recommendation) return null;

  const k = recommendation.klausur;

  const justAddedMain = addedToTasks === k.id;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white ring-1 ring-white/5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.45)]">
        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
          <PromptGear promptId="klausur-select" compact />
        </div>
        <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 bg-accent-400/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Haupt-Empfehlung */}
        <div
          onClick={() => setDetailOpen(true)}
          className="group relative p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className={cn(
              "p-1.5 rounded-lg bg-gradient-to-br shadow-md ring-1 ring-white/10",
              AREA_GRADIENT[k.area]
            )}>
              <Scale className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-accent-400 uppercase tracking-[0.16em]">Klausur des Tages</span>
                <Zap className="h-3 w-3 text-amber-400" />
              </div>
            </div>
            <Badge className="bg-white/10 text-white/80 text-[10px] border-0 backdrop-blur-sm">
              {AREA_LABELS[k.area]}
            </Badge>
          </div>

          <h3 className="font-bold text-[15px] mb-2 line-clamp-1 tracking-tight">{k.title}</h3>

          <div className="flex items-center gap-3 text-[11px] text-white/60 mb-3">
            {recommendation.reasons.slice(0, 2).map((r, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-accent-400" />
                {r}
              </span>
            ))}
          </div>

          {/* Action-Row: Hinzufügen + PDF + Alternativen */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => addKlausurToToday(k)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
                justAddedMain
                  ? "bg-accent-500/20 text-accent-300 ring-1 ring-accent-400/30"
                  : "bg-white/10 hover:bg-white/15 text-white ring-1 ring-white/10"
              )}
            >
              {justAddedMain ? (
                <><Check className="h-3 w-3" /> in Tagesliste</>
              ) : (
                <><Plus className="h-3 w-3" /> in Tagesliste</>
              )}
            </button>
            {k.source && (
              <button
                onClick={() => {
                  const filename = k.source!.replace(".pdf", "_komplett.pdf");
                  fetch("/api/pdf-open", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename }),
                  }).catch(console.error);
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-white/70 ring-1 ring-white/10 transition-all"
              >
                <Eye className="h-3 w-3" /> PDF
              </button>
            )}
            {recommendation.alternatives.length > 0 && (
              <button
                onClick={() => setAltsOpen(v => !v)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-white/70 ring-1 ring-white/10 transition-all"
              >
                {recommendation.alternatives.length} Alt.
                <ChevronDown className={cn("h-3 w-3 transition-transform", altsOpen && "rotate-180")} />
              </button>
            )}
          </div>
        </div>

        {/* Alternativen-Dropdown */}
        {altsOpen && recommendation.alternatives.length > 0 && (
          <div className="border-t border-white/5 bg-slate-950/60 px-3 py-2 space-y-1">
            {recommendation.alternatives.map((alt) => {
              const justAdded = addedToTasks === alt.klausur.id;
              return (
                <div
                  key={alt.klausur.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <div className={cn(
                    "p-1 rounded-md bg-gradient-to-br shadow ring-1 ring-white/10 shrink-0",
                    AREA_GRADIENT[alt.klausur.area]
                  )}>
                    <Scale className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-white/90 truncate">{alt.klausur.title}</div>
                    <div className="text-[10px] text-white/50 truncate">{alt.reason}</div>
                  </div>
                  <button
                    onClick={() => addKlausurToToday(alt.klausur)}
                    className={cn(
                      "shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md transition-all",
                      justAdded
                        ? "bg-accent-500/20 text-accent-300 ring-1 ring-accent-400/30"
                        : "bg-white/10 hover:bg-white/15 text-white/80 ring-1 ring-white/10"
                    )}
                    aria-label="In Tagesliste"
                  >
                    {justAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg mx-auto max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <div className={cn(
                "w-6 h-6 rounded-lg bg-gradient-to-br flex items-center justify-center",
                AREA_GRADIENT[k.area]
              )}>
                <Scale className="h-3.5 w-3.5 text-white" />
              </div>
              {k.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Meta */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-blue-100 text-blue-700 text-[10px]">{AREA_LABELS[k.area]}</Badge>
              {k.type && <Badge className="bg-slate-100 text-slate-600 text-[10px]">{k.type}</Badge>}
              {k.date && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {k.date}
                </span>
              )}
              {k.source && <Badge variant="outline" className="text-[10px]">{k.source}</Badge>}
            </div>

            {/* Warum diese Klausur */}
            <div className="bg-accent-50 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-accent-700 mb-1.5 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Warum heute?
              </div>
              <ul className="space-y-1">
                {recommendation.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-accent-600 flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-accent-400 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Themen */}
            {k.topicIds.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Abgedeckte Themen</div>
                <div className="flex flex-wrap gap-1">
                  {k.topicIds.map(tid => (
                    <Badge key={tid} variant="outline" className="text-[10px] bg-white">
                      {getTopicLabel(tid)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Hinweis auf Original-PDF */}
            {k.source && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
                Sachverhalt und Lösung: siehe Original-PDF <span className="font-medium text-slate-700">{k.source}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => { setDetailOpen(false); setDoneDialogOpen(true); }}
                className="flex-1 bg-gradient-to-r from-slate-900 to-accent-600 rounded-xl"
              >
                <Check className="h-4 w-4 mr-1" />
                Geschrieben — Eintragen
              </Button>
              {k.source && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    const filename = k.source!.replace(".pdf", "_komplett.pdf");
                    await fetch("/api/pdf-open", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ filename }),
                    }).catch(console.error);
                  }}
                  className="rounded-xl"
                >
                  <Eye className="h-4 w-4 mr-1" /> PDF
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Done Dialog (Tracking) */}
      <Dialog open={doneDialogOpen} onOpenChange={setDoneDialogOpen}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Klausur eintragen</DialogTitle>
          </DialogHeader>

          {saved ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6 text-accent-600" />
              </div>
              <p className="font-semibold text-slate-800">Eingetragen!</p>
              <p className="text-xs text-slate-500 mt-1">Fortschritt wird getrackt</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">
                  Wie lief es? ({rating}/5)
                </label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        n <= rating
                          ? "bg-amber-100 text-amber-600"
                          : "bg-slate-100 text-slate-300"
                      )}
                    >
                      <Star className="h-5 w-5" fill={n <= rating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notizen (optional)</label>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Was lief gut? Was muss ich wiederholen?"
                  rows={3}
                  className="resize-none rounded-xl text-sm"
                />
              </div>

              <Button onClick={handleDone} className="w-full bg-gradient-to-r from-slate-900 to-accent-600 rounded-xl">
                Eintragen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
