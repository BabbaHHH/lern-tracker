"use client";

import { useState, useEffect } from "react";
import { recommendKlausur } from "@/lib/klausur-recommender";
import { getKlausuren, addTrackingEntry } from "@/lib/store";
import { Klausur, AREA_LABELS, Area } from "@/lib/types";
import { TOPICS } from "@/lib/topics";
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
  Scale, Zap, BookOpen, FileText, ChevronRight, Star,
  Check, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";

const AREA_GRADIENT: Record<Area, string> = {
  zr: "from-indigo-500 to-blue-600",
  oeffr: "from-amber-500 to-orange-600",
  sr: "from-rose-500 to-pink-600",
};

export function KlausurDesTages() {
  const [recommendation, setRecommendation] = useState<{
    klausur: Klausur;
    score: number;
    reasons: string[];
  } | null>(null);
  const [hasKlausuren, setHasKlausuren] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [doneDialogOpen, setDoneDialogOpen] = useState(false);
  const [rating, setRating] = useState(3);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const all = getKlausuren();
    setHasKlausuren(all.length > 0);
    if (all.length > 0) {
      const rec = recommendKlausur();
      setRecommendation(rec);
    }
  }, []);

  const handleDone = () => {
    if (!recommendation) return;
    const k = recommendation.klausur;
    addTrackingEntry({
      date: format(new Date(), "yyyy-MM-dd"),
      activityType: "klausur",
      topicIds: k.topicIds,
      klausurId: k.id,
      durationMinutes: k.durationMinutes,
      rating,
      note,
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200/60 text-slate-700 group-hover:from-indigo-50 group-hover:to-indigo-100/60 group-hover:text-indigo-700 group-hover:ring-indigo-200/60 transition-all">
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

  if (!recommendation) return null;

  const k = recommendation.klausur;

  return (
    <>
      <div
        onClick={() => setDetailOpen(true)}
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 text-white cursor-pointer ring-1 ring-white/5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.45)] hover:shadow-[0_16px_50px_-12px_rgba(15,23,42,0.6)] transition-all"
      >
        <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 bg-indigo-400/20 rounded-full blur-3xl group-hover:bg-indigo-400/30 transition-colors" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative">
          <div className="flex items-center gap-2.5 mb-3">
            <div className={cn(
              "p-1.5 rounded-lg bg-gradient-to-br shadow-md ring-1 ring-white/10",
              AREA_GRADIENT[k.area]
            )}>
              <Scale className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-[0.16em]">Klausur des Tages</span>
                <Zap className="h-3 w-3 text-amber-400" />
              </div>
            </div>
            <Badge className="bg-white/10 text-white/80 text-[10px] border-0 backdrop-blur-sm">
              {AREA_LABELS[k.area]}
            </Badge>
          </div>

          <h3 className="font-bold text-[15px] mb-2 line-clamp-1 tracking-tight">{k.title}</h3>

          <div className="flex items-center gap-3 text-[11px] text-white/60">
            {recommendation.reasons.slice(0, 2).map((r, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-indigo-400" />
                {r}
              </span>
            ))}
          </div>
        </div>
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
              <Badge className="bg-slate-100 text-slate-600 text-[10px]">{k.difficulty}</Badge>
              {k.source && <Badge variant="outline" className="text-[10px]">{k.source}</Badge>}
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {k.durationMinutes} min
              </span>
            </div>

            {/* Warum diese Klausur */}
            <div className="bg-indigo-50 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-indigo-700 mb-1.5 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Warum heute?
              </div>
              <ul className="space-y-1">
                {recommendation.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-indigo-600 flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
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

            {/* Sachverhalt */}
            {k.sachverhalt && (
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> Sachverhalt
                </div>
                <div className="bg-white border rounded-xl p-3 text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {k.sachverhalt}
                </div>
              </div>
            )}

            {/* Lösung (collapsible) */}
            {k.solution && (
              <details>
                <summary className="text-[11px] font-semibold text-slate-500 cursor-pointer flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Lösungsskizze aufdecken
                </summary>
                <div className="mt-1.5 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {k.solution}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => { setDetailOpen(false); setDoneDialogOpen(true); }}
                className="flex-1 bg-gradient-to-r from-slate-900 to-indigo-600 rounded-xl"
              >
                <Check className="h-4 w-4 mr-1" />
                Geschrieben — Eintragen
              </Button>
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
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6 text-indigo-600" />
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

              <Button onClick={handleDone} className="w-full bg-gradient-to-r from-slate-900 to-indigo-600 rounded-xl">
                Eintragen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
