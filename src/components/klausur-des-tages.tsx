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
  zr: "from-blue-500 to-indigo-600",
  oeffr: "from-amber-500 to-orange-600",
  sr: "from-rose-500 to-red-600",
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
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex items-center gap-3 card-hover cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
            <Scale className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800">Klausur-Datenbank</div>
            <div className="text-[11px] text-slate-400">Klausuren eintragen & täglich die passende üben</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300" />
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
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white cursor-pointer card-hover"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl -translate-y-6 translate-x-6" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center",
              AREA_GRADIENT[k.area]
            )}>
              <Scale className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Klausur des Tages</span>
                <Zap className="h-3 w-3 text-amber-400" />
              </div>
            </div>
            <Badge className="bg-white/10 text-white/80 text-[10px] border-0">
              {AREA_LABELS[k.area]}
            </Badge>
          </div>

          <h3 className="font-bold text-sm mb-1.5 line-clamp-1">{k.title}</h3>

          <div className="flex items-center gap-3 text-[11px] text-white/60">
            {recommendation.reasons.slice(0, 2).map((r, i) => (
              <span key={i} className="flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-emerald-400" />
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
            <div className="bg-emerald-50 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Warum heute?
              </div>
              <ul className="space-y-1">
                {recommendation.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-emerald-600 flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
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
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl"
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
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6 text-emerald-600" />
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

              <Button onClick={handleDone} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl">
                Eintragen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
