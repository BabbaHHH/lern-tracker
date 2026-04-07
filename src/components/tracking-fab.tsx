"use client";

import { useState, useMemo } from "react";
import { addTrackingEntry } from "@/lib/store";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { ActivityType, ACTIVITY_LABELS, Area, AREA_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck, Check, Star, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function TrackingFab() {
  const [open, setOpen] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>("theorie");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [duration, setDuration] = useState(90);
  const [rating, setRating] = useState(3);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [topicSearch, setTopicSearch] = useState("");

  const leafTopics = useMemo(() => getLeafTopics(TOPICS), []);

  const filteredTopics = useMemo(() => {
    if (!topicSearch) return [];
    return leafTopics.filter(t =>
      t.label.toLowerCase().includes(topicSearch.toLowerCase())
    ).slice(0, 10);
  }, [leafTopics, topicSearch]);

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const reset = () => {
    setActivityType("theorie");
    setSelectedTopics([]);
    setDuration(90);
    setRating(3);
    setNote("");
    setTopicSearch("");
    setSaved(false);
  };

  const handleSave = () => {
    addTrackingEntry({
      date: format(new Date(), "yyyy-MM-dd"),
      activityType,
      topicIds: selectedTopics,
      durationMinutes: duration,
      rating,
      note,
    });
    setSaved(true);
    setTimeout(() => {
      setOpen(false);
      reset();
    }, 1500);
  };

  const getTopicLabel = (id: string) => TOPICS.find(t => t.id === id)?.label || id;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[80px] left-4 md:bottom-6 md:left-6 z-40 bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-2xl p-3.5 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.5)] hover:shadow-[0_16px_40px_-8px_rgba(15,23,42,0.6)] hover:-translate-y-0.5 transition-all active:scale-95 ring-1 ring-white/10"
        title="Lernsession eintragen"
      >
        <ClipboardCheck className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-sm mx-auto max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent-500 to-purple-600 flex items-center justify-center">
                <ClipboardCheck className="h-3.5 w-3.5 text-white" />
              </div>
              Lernsession eintragen
            </DialogTitle>
          </DialogHeader>

          {saved ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6 text-accent-600" />
              </div>
              <p className="font-semibold text-slate-800">Eingetragen!</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Activity Type */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Art der Aktivität</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setActivityType(type)}
                      className={cn(
                        "px-2 py-2 rounded-xl text-xs font-medium transition-all",
                        activityType === type
                          ? "bg-accent-100 text-accent-700 ring-1 ring-accent-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      {ACTIVITY_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topics */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Themen ({selectedTopics.length})
                </label>
                {selectedTopics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedTopics.map(id => (
                      <Badge
                        key={id}
                        className="text-[10px] bg-accent-100 text-accent-700 cursor-pointer hover:bg-accent-200"
                        onClick={() => toggleTopic(id)}
                      >
                        {getTopicLabel(id)} <X className="h-2.5 w-2.5 ml-0.5" />
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={topicSearch}
                    onChange={e => setTopicSearch(e.target.value)}
                    placeholder="Thema suchen..."
                    className="pl-8 h-9 text-sm rounded-xl"
                  />
                </div>
                {filteredTopics.length > 0 && (
                  <div className="mt-1 border rounded-xl bg-white max-h-32 overflow-y-auto">
                    {filteredTopics.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { toggleTopic(t.id); setTopicSearch(""); }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-2",
                          selectedTopics.includes(t.id) && "text-accent-600 font-medium"
                        )}
                      >
                        {selectedTopics.includes(t.id) && <Check className="h-3 w-3" />}
                        <span className="truncate">{t.label}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">{AREA_LABELS[t.area]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Dauer (Minuten)</label>
                <div className="flex gap-1.5">
                  {[45, 90, 180, 300].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDuration(m)}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-medium transition-all",
                        duration === m
                          ? "bg-accent-100 text-accent-700 ring-1 ring-accent-200"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {m < 60 ? `${m}m` : `${m / 60}h`}
                    </button>
                  ))}
                  <Input
                    type="number"
                    value={duration}
                    onChange={e => setDuration(parseInt(e.target.value) || 0)}
                    className="w-16 h-auto text-xs text-center rounded-xl"
                  />
                </div>
              </div>

              {/* Rating */}
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
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                        n <= rating ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-300"
                      )}
                    >
                      <Star className="h-4 w-4" fill={n <= rating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notizen (optional)</label>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Was habe ich gelernt? Was war schwierig?"
                  rows={2}
                  className="resize-none rounded-xl text-sm"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={selectedTopics.length === 0}
                className="w-full bg-gradient-to-r from-accent-500 to-purple-600 rounded-xl h-10"
              >
                Eintragen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
