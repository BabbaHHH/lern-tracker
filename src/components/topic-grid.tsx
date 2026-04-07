"use client";

import { useState, useEffect, useCallback } from "react";
import { TOPICS, buildTopicTree, getLeafTopics } from "@/lib/topics";
import { getProgress, getTopicProgress, setTopicProgress, addLearningEntry, getEntriesForTopic } from "@/lib/store";
import { Topic, Area, AREA_LABELS } from "@/lib/types";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function TopicGrid() {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [filterArea, setFilterArea] = useState<Area | "all">("all");

  // Inline-Detail-Dialog für ultra-flache Listen-Items
  const [openTopic, setOpenTopic] = useState<Topic | null>(null);
  const [dialogProgress, setDialogProgress] = useState(0);
  const [dialogNote, setDialogNote] = useState("");
  const [dialogEntries, setDialogEntries] = useState<ReturnType<typeof getEntriesForTopic>>([]);

  useEffect(() => {
    const p = getProgress();
    const map: Record<string, number> = {};
    for (const [id, val] of Object.entries(p)) {
      map[id] = val.percent;
    }
    setProgressMap(map);
  }, []);

  const handleProgressChange = useCallback((topicId: string, percent: number) => {
    setTopicProgress(topicId, percent);
    setProgressMap(prev => ({ ...prev, [topicId]: percent }));
  }, []);

  const openLeaf = useCallback((topic: Topic) => {
    setOpenTopic(topic);
    setDialogProgress(getTopicProgress(topic.id));
    setDialogEntries(getEntriesForTopic(topic.id));
    setDialogNote("");
  }, []);

  const handleDialogSlider = useCallback((value: number | readonly number[]) => {
    if (!openTopic) return;
    const v = Array.isArray(value) ? value[0] : value;
    setDialogProgress(v);
    handleProgressChange(openTopic.id, v);
  }, [openTopic, handleProgressChange]);

  const handleAddNote = useCallback(() => {
    if (!openTopic || !dialogNote.trim()) return;
    const updated = addLearningEntry({
      topicId: openTopic.id,
      note: dialogNote.trim(),
      source: "manual",
    });
    setDialogEntries(updated.filter(e => e.topicId === openTopic.id));
    setDialogNote("");
  }, [dialogNote, openTopic]);

  const tree = buildTopicTree(TOPICS);
  const leafTopics = getLeafTopics(TOPICS);

  const areaProgress = (area: Area) => {
    const areaLeafs = leafTopics.filter(t => t.area === area);
    if (areaLeafs.length === 0) return 0;
    return Math.round(areaLeafs.reduce((sum, t) => sum + (progressMap[t.id] || 0), 0) / areaLeafs.length);
  };

  const groupProgress = (groupId: string) => {
    const deepLeafs = leafTopics.filter(t => {
      let current = TOPICS.find(x => x.id === t.id);
      while (current) {
        if (current.parentId === groupId) return true;
        current = TOPICS.find(x => x.id === current!.parentId);
      }
      return false;
    });
    if (deepLeafs.length === 0) return 0;
    return Math.round(deepLeafs.reduce((sum, t) => sum + (progressMap[t.id] || 0), 0) / deepLeafs.length);
  };

  const filteredTree = filterArea === "all" ? tree : tree.filter(t => t.area === filterArea);
  const areas: Area[] = ["zr", "oeffr", "sr"];

  return (
    <div className="space-y-10">
      {/* ─── EBENE 1 — Top-Level Rechtsgebiete ───────────────────────── */}
      <div className="grid grid-cols-3 gap-px bg-slate-200">
        {areas.map(area => {
          const p = areaProgress(area);
          const isActive = filterArea === area;
          return (
            <button
              key={area}
              onClick={() => setFilterArea(filterArea === area ? "all" : area)}
              className={cn(
                "group/area relative bg-white px-4 py-5 text-left transition-colors",
                isActive ? "bg-slate-50" : "hover:bg-slate-50/70"
              )}
            >
              <div className="text-[10px] font-sans uppercase tracking-[0.18em] text-slate-500 mb-2">
                {AREA_LABELS[area]}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-3xl font-normal text-slate-900 tabular-nums tracking-tight">
                  {p}
                  <span className="text-base text-slate-400 ml-0.5">%</span>
                </span>
                {isActive && (
                  <span className="font-sans text-[10px] uppercase tracking-wider text-indigo-600">
                    aktiv
                  </span>
                )}
              </div>
              <div className="mt-3 h-px bg-slate-200 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-slate-900 transition-all"
                  style={{ width: `${p}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── EBENE 2 — Themengruppen mit Flyout für Unterthemen ─────── */}
      <div className="border-t border-slate-200">
        {filteredTree.flatMap(rootTopic =>
          (rootTopic.children || []).map(group => {
            const gProgress = groupProgress(group.id);
            const hasChildren = group.children && group.children.length > 0;

            return (
              <div
                key={group.id}
                className="group/grp relative border-b border-slate-200"
                tabIndex={hasChildren ? 0 : -1}
              >
                {/* Header-Zeile (immer sichtbar) */}
                <div className="flex items-center gap-4 px-1 py-4 cursor-default">
                  {/* Area-Marker (1px-Strich statt Punkt) */}
                  <div className="w-3 h-px bg-slate-900 shrink-0" />

                  {/* Themen-Label — Serif */}
                  <h3 className="font-serif text-[17px] font-normal text-slate-900 flex-1 tracking-tight leading-tight group-hover/grp:text-indigo-600 group-focus-within/grp:text-indigo-600 transition-colors">
                    {group.label}
                  </h3>

                  {/* Sub-Count + Progress (Sans) */}
                  <div className="flex items-center gap-4">
                    <span className="font-sans text-[10px] uppercase tracking-wider text-slate-400 tabular-nums">
                      {group.children?.length || 0} Unterthemen
                    </span>
                    <div className="hidden sm:flex items-center gap-3">
                      <div className="w-24 h-px bg-slate-200 relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-slate-900"
                          style={{ width: `${gProgress}%` }}
                        />
                      </div>
                      <span className="font-serif text-sm text-slate-900 tabular-nums w-10 text-right">
                        {gProgress}<span className="text-slate-400">%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* ─── EBENE 3 — Flyout (absolute, schiebt nichts) ─── */}
                {hasChildren && (
                  <div
                    className={cn(
                      "absolute left-0 right-0 top-full z-50 mt-px",
                      "opacity-0 invisible pointer-events-none",
                      "group-hover/grp:opacity-100 group-hover/grp:visible group-hover/grp:pointer-events-auto",
                      "group-focus-within/grp:opacity-100 group-focus-within/grp:visible group-focus-within/grp:pointer-events-auto",
                      "transition-none"
                    )}
                  >
                    <div className="bg-white border border-slate-200 rounded-none shadow-none p-5">
                      {/* Flyout-Header */}
                      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-slate-200">
                        <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-slate-500">
                          {group.label}
                        </span>
                        <span className="font-serif text-xs italic text-slate-400">
                          {group.children!.length} Einträge
                        </span>
                      </div>

                      {/* Ultra-flache Liste */}
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-100">
                        {group.children!.map(leaf => {
                          const lp = progressMap[leaf.id] || 0;
                          return (
                            <li key={leaf.id}>
                              <button
                                type="button"
                                onClick={() => openLeaf(leaf)}
                                className="group/leaf w-full bg-white px-3 py-2.5 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                              >
                                <span className="font-sans text-[13px] text-slate-700 group-hover/leaf:text-indigo-600 flex-1 leading-tight transition-colors">
                                  {leaf.label}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="w-12 h-px bg-slate-200 relative overflow-hidden">
                                    <div
                                      className="absolute inset-y-0 left-0 bg-slate-900"
                                      style={{ width: `${lp}%` }}
                                    />
                                  </div>
                                  <span className="font-sans text-[10px] tabular-nums text-slate-500 w-7 text-right">
                                    {lp}%
                                  </span>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Inline-Detail-Dialog (gleiche Logik wie TopicTile) ─── */}
      <Dialog open={openTopic !== null} onOpenChange={(v) => !v && setOpenTopic(null)}>
        <DialogContent className="max-w-md mx-auto max-h-[85vh] overflow-y-auto rounded-none border border-slate-200 shadow-none p-0">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="font-sans text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">
              {openTopic && AREA_LABELS[openTopic.area]}
            </div>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-normal text-slate-900 tracking-tight leading-tight">
                {openTopic?.label}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-5 py-5 space-y-6">
            {/* Fortschritt */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Fortschritt
                </span>
                <span className="font-serif text-2xl text-slate-900 tabular-nums">
                  {dialogProgress}<span className="text-slate-400 text-base">%</span>
                </span>
              </div>
              <Slider
                value={[dialogProgress]}
                onValueChange={handleDialogSlider}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between mt-2 font-sans text-[10px] uppercase tracking-wider text-slate-400">
                <span>Offen</span>
                <span>Sitzt</span>
              </div>
            </div>

            {/* Notiz */}
            <div className="border-t border-slate-200 pt-5">
              <div className="font-sans text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">
                Notiz hinzufügen
              </div>
              <Textarea
                placeholder="Was hast du gelernt?"
                value={dialogNote}
                onChange={(e) => setDialogNote(e.target.value)}
                rows={2}
                className="resize-none rounded-none border-slate-200 text-sm font-sans focus:ring-0 focus:border-slate-900 shadow-none"
              />
              <Button
                onClick={handleAddNote}
                disabled={!dialogNote.trim()}
                size="sm"
                className="mt-2 bg-slate-900 hover:bg-slate-800 rounded-none text-xs font-sans shadow-none"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Speichern
              </Button>
            </div>

            {/* Lernhistorie */}
            {dialogEntries.length > 0 && (
              <div className="border-t border-slate-200 pt-5">
                <div className="font-sans text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-3">
                  Lernhistorie
                </div>
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {dialogEntries.map((entry) => (
                    <div key={entry.id} className="border-l border-slate-200 pl-3">
                      <p className="font-sans text-sm text-slate-700 leading-relaxed">{entry.note}</p>
                      <p className="font-serif text-[11px] italic text-slate-400 mt-1">
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
    </div>
  );
}
