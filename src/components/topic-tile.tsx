"use client";

import { useState, useCallback } from "react";
import { Topic, AREA_COLORS } from "@/lib/types";
import { getTopicProgress, setTopicProgress } from "@/lib/store";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addLearningEntry, getEntriesForTopic } from "@/lib/store";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Plus } from "lucide-react";

interface TopicTileProps {
  topic: Topic;
  progress: number;
  onProgressChange: (topicId: string, percent: number) => void;
}

export function TopicTile({ topic, progress, onProgressChange }: TopicTileProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<ReturnType<typeof getEntriesForTopic>>([]);
  const [localProgress, setLocalProgress] = useState(progress);

  const handleOpen = useCallback(() => {
    setEntries(getEntriesForTopic(topic.id));
    setLocalProgress(getTopicProgress(topic.id));
    setOpen(true);
  }, [topic.id]);

  const handleSliderChange = useCallback((value: number | readonly number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    setLocalProgress(v);
    setTopicProgress(topic.id, v);
    onProgressChange(topic.id, v);
  }, [topic.id, onProgressChange]);

  const handleAddNote = useCallback(() => {
    if (!note.trim()) return;
    const updated = addLearningEntry({
      topicId: topic.id,
      note: note.trim(),
      source: "manual",
    });
    setEntries(updated.filter(e => e.topicId === topic.id));
    setNote("");
  }, [note, topic.id]);

  // Dynamische Farbe basierend auf Fortschritt
  const getBg = () => {
    if (progress === 0) return "bg-white border-slate-200";
    if (progress < 30) return "bg-emerald-50/60 border-emerald-200/60";
    if (progress < 60) return "bg-emerald-100/70 border-emerald-300/60";
    if (progress < 90) return "bg-emerald-200/70 border-emerald-400/50";
    return "bg-emerald-300/70 border-emerald-500/50";
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={cn(
          "relative rounded-xl border p-3 text-left text-[13px] font-medium transition-all card-hover",
          "min-h-[56px] flex items-center gap-2",
          getBg(),
        )}
      >
        <div className={cn("w-1.5 h-8 rounded-full shrink-0", AREA_COLORS[topic.area])} />
        <span className={cn(
          "flex-1 leading-tight",
          progress >= 80 ? "text-emerald-900" : "text-slate-700"
        )}>
          {topic.label}
        </span>
        {progress > 0 && (
          <span className={cn(
            "text-[11px] font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded-md",
            progress >= 80 ? "bg-emerald-500/20 text-emerald-800" : "bg-slate-100 text-slate-500"
          )}>
            {progress}%
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md mx-auto max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className={cn("w-1.5 h-6 rounded-full", AREA_COLORS[topic.area])} />
              {topic.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Fortschritt */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-slate-500 font-medium">Fortschritt</span>
                <span className="font-bold text-emerald-600 text-lg tabular-nums">{localProgress}%</span>
              </div>
              <Slider
                value={[localProgress]}
                onValueChange={handleSliderChange}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-0.5">
                <span>Noch offen</span>
                <span>Sitzt!</span>
              </div>
            </div>

            {/* Notiz */}
            <div>
              <Textarea
                placeholder="Was hast du gelernt? Notizen, Erkenntnisse..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="resize-none rounded-xl text-sm"
              />
              <Button
                onClick={handleAddNote}
                disabled={!note.trim()}
                size="sm"
                className="mt-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Notiz speichern
              </Button>
            </div>

            {/* Lernhistorie */}
            {entries.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Lernhistorie</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {entries.map((entry) => (
                    <div key={entry.id} className="rounded-lg bg-slate-50 p-2.5">
                      <p className="text-sm text-slate-700 leading-relaxed">{entry.note}</p>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {format(new Date(entry.createdAt), "dd. MMM yyyy, HH:mm", { locale: de })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
