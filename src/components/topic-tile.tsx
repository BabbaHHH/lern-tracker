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

  // Grün-Deckkraft basierend auf Fortschritt (0-100%)
  const greenOpacity = progress / 100;

  return (
    <>
      <button
        onClick={handleOpen}
        className={cn(
          "relative rounded-lg border p-3 text-left text-sm font-medium transition-all",
          "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
          "min-h-[60px] flex items-center"
        )}
        style={{
          backgroundColor: `rgba(34, 197, 94, ${greenOpacity * 0.6})`,
          borderColor: progress > 0 ? `rgba(34, 197, 94, ${Math.max(0.3, greenOpacity)})` : "#e5e7eb",
        }}
      >
        <div className="flex items-center gap-2 w-full">
          <div className={cn("w-2 h-2 rounded-full shrink-0", AREA_COLORS[topic.area])} />
          <span className={cn(
            "truncate",
            progress >= 80 ? "text-green-900" : "text-gray-800"
          )}>
            {topic.label}
          </span>
          {progress > 0 && (
            <span className="ml-auto text-xs font-bold text-green-700 shrink-0">
              {progress}%
            </span>
          )}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full", AREA_COLORS[topic.area])} />
              {topic.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Fortschritt Slider */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Fortschritt</span>
                <span className="font-bold text-emerald-600">{localProgress}%</span>
              </div>
              <Slider
                value={[localProgress]}
                onValueChange={handleSliderChange}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Nicht begonnen</span>
                <span>Sitzt!</span>
              </div>
            </div>

            {/* Notiz hinzufügen */}
            <div>
              <Textarea
                placeholder="Was hast du gelernt? Notizen, Erkenntnisse..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handleAddNote}
                disabled={!note.trim()}
                size="sm"
                className="mt-2 bg-emerald-600 hover:bg-emerald-700"
              >
                Notiz speichern
              </Button>
            </div>

            {/* Lernhistorie */}
            {entries.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">Lernhistorie</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {entries.map((entry) => (
                    <div key={entry.id} className="rounded-md bg-gray-50 p-2 text-sm">
                      <p className="text-gray-800">{entry.note}</p>
                      <p className="text-xs text-gray-400 mt-1">
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
