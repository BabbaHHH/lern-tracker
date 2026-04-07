"use client";

import { useState, useEffect, useCallback } from "react";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import {
  getProgress,
  getTopicProgress,
  setTopicProgress,
  addLearningEntry,
  getEntriesForTopic,
} from "@/lib/store";
import { Topic } from "@/lib/types";
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
import { Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Säulen-Definition (Mapping ohne Datenstruktur-Änderung) ─────────
type Pillar = {
  index: string;
  label: string;
  groupIds: string[];
};

const PILLARS: Pillar[] = [
  {
    index: "01",
    label: "Materielles Zivilrecht",
    groupIds: [
      "zr-bgb-at",
      "zr-schuld-at",
      "zr-schuld-bt",
      "zr-sachen",
      "zr-familie",
      "zr-erb",
      "zr-hr",
      "zr-gesell",
      "zr-arbeit",
    ],
  },
  {
    index: "02",
    label: "Materielles Öffentliches Recht",
    groupIds: [
      "oeffr-vwat",
      "oeffr-polr",
      "oeffr-bau",
      "oeffr-komm",
      "oeffr-sthr",
      "oeffr-verfr",
      "oeffr-eu",
    ],
  },
  {
    index: "03",
    label: "Materielles Strafrecht",
    groupIds: ["sr-at", "sr-bt"],
  },
  {
    index: "04",
    label: "Zivilprozessrecht",
    groupIds: ["zr-zpo"],
  },
  {
    index: "05",
    label: "Verwaltungsprozessrecht",
    groupIds: ["oeffr-vwgo"],
  },
  {
    index: "06",
    label: "Strafprozessrecht",
    groupIds: ["sr-stpo", "sr-aktenvortrag"],
  },
];

export function TopicGrid() {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  // Inline-Akkordeon: pro Säule maximal eine Gruppe geöffnet
  const [openGroupByPillar, setOpenGroupByPillar] = useState<Record<string, string | null>>({});

  // Detail-Dialog für Leaf-Topics
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

  const toggleGroup = useCallback((pillarIndex: string, groupId: string) => {
    setOpenGroupByPillar(prev => ({
      ...prev,
      [pillarIndex]: prev[pillarIndex] === groupId ? null : groupId,
    }));
  }, []);

  const openLeaf = useCallback((topic: Topic) => {
    setOpenTopic(topic);
    setDialogProgress(getTopicProgress(topic.id));
    setDialogEntries(getEntriesForTopic(topic.id));
    setDialogNote("");
  }, []);

  const handleDialogSlider = useCallback(
    (value: number | readonly number[]) => {
      if (!openTopic) return;
      const v = Array.isArray(value) ? value[0] : value;
      setDialogProgress(v);
      handleProgressChange(openTopic.id, v);
    },
    [openTopic, handleProgressChange]
  );

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

  const leafTopics = getLeafTopics(TOPICS);

  // Aggregations-Helpers
  const groupChildren = (groupId: string): Topic[] =>
    TOPICS.filter(t => t.parentId === groupId).sort((a, b) => a.sortOrder - b.sortOrder);

  const groupProgress = (groupId: string): number => {
    const children = groupChildren(groupId);
    if (children.length === 0) return 0;
    const sum = children.reduce((s, c) => s + (progressMap[c.id] || 0), 0);
    return Math.round(sum / children.length);
  };

  const pillarProgress = (pillar: Pillar): number => {
    const allLeafs: Topic[] = [];
    pillar.groupIds.forEach(gid => {
      const children = groupChildren(gid);
      children.forEach(c => {
        // Wenn child noch tiefere Kinder hätte (hier nicht der Fall, aber sicherheitshalber)
        const grand = TOPICS.filter(t => t.parentId === c.id);
        if (grand.length > 0) allLeafs.push(...grand);
        else allLeafs.push(c);
      });
    });
    if (allLeafs.length === 0) return 0;
    const sum = allLeafs.reduce((s, t) => s + (progressMap[t.id] || 0), 0);
    return Math.round(sum / allLeafs.length);
  };

  const pillarLeafCount = (pillar: Pillar): number => {
    let count = 0;
    pillar.groupIds.forEach(gid => {
      const children = groupChildren(gid);
      children.forEach(c => {
        const grand = TOPICS.filter(t => t.parentId === c.id);
        count += grand.length > 0 ? grand.length : 1;
      });
    });
    return count;
  };

  return (
    <section className="border border-slate-200">
      {/* Section-Header */}
      <div className="border-b border-slate-200 px-6 py-5 flex items-baseline justify-between">
        <h2 className="font-serif text-2xl font-normal text-slate-900 tracking-tight">
          Rechtsgebiete
        </h2>
        <span className="font-sans text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
          {PILLARS.length} Säulen · {leafTopics.length} Themen
        </span>
      </div>

      {/* 3×2 Säulen-Raster */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        {PILLARS.map((pillar, idx) => {
          const p = pillarProgress(pillar);
          const leafCount = pillarLeafCount(pillar);
          const groupCount = pillar.groupIds.reduce(
            (s, gid) => s + groupChildren(gid).length,
            0
          );
          const isBottomRow = idx >= 3;

          return (
            <article
              key={pillar.index}
              className={cn(
                "bg-white",
                // 2-Reihen-Trenner für md+
                idx === 3 && "md:border-t md:border-slate-200",
                idx === 4 && "md:border-t md:border-slate-200",
                idx === 5 && "md:border-t md:border-slate-200 xl:border-t",
                // Spalten-Trenner für 2-col → 3-col
                idx % 2 === 1 && "md:border-l md:border-slate-200 xl:border-l-0",
                isBottomRow && "xl:border-t"
              )}
            >
              {/* Säulen-Header */}
              <header className="px-6 pt-6 pb-5 border-b border-slate-200">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 border border-slate-200 flex items-center justify-center font-sans text-[11px] font-bold text-slate-900 shrink-0">
                      {pillar.index}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h3 className="font-serif text-[19px] font-normal text-slate-900 leading-tight tracking-tight">
                        {pillar.label}
                      </h3>
                      <p className="font-sans text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 mt-1.5">
                        {groupCount} Themen · {leafCount} Einträge
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-serif text-3xl font-light text-slate-900 tabular-nums leading-none">
                      {p}
                      <span className="text-base text-slate-400 ml-0.5">%</span>
                    </div>
                  </div>
                </div>
                {/* 1px Progress-Linie */}
                <div className="h-px w-full bg-slate-200 relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-slate-900"
                    style={{ width: `${p}%` }}
                  />
                </div>
              </header>

              {/* Ebene 2 — Themen-Liste */}
              <div className="divide-y divide-slate-200">
                {pillar.groupIds.flatMap(gid => {
                  const group = TOPICS.find(t => t.id === gid);
                  if (!group) return [];
                  const isOpen = openGroupByPillar[pillar.index] === gid;
                  const gp = groupProgress(gid);
                  const children = groupChildren(gid);

                  return (
                    <div key={gid}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(pillar.index, gid)}
                        className="group/grp w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
                      >
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 text-slate-400 shrink-0 transition-transform",
                            isOpen && "rotate-90 text-slate-900"
                          )}
                          strokeWidth={2.5}
                        />
                        <span
                          className={cn(
                            "font-serif text-[15px] font-normal text-slate-900 flex-1 leading-tight tracking-tight transition-colors",
                            "group-hover/grp:text-accent-600",
                            isOpen && "text-accent-600"
                          )}
                        >
                          {group.label}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="hidden sm:block w-16 h-px bg-slate-200 relative overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-slate-900"
                              style={{ width: `${gp}%` }}
                            />
                          </div>
                          <span className="font-sans text-[11px] font-bold tabular-nums text-slate-500 w-8 text-right">
                            {gp}%
                          </span>
                        </div>
                      </button>

                      {/* Ebene 3 — flache Liste */}
                      {isOpen && children.length > 0 && (
                        <ul className="bg-slate-50 border-t border-slate-200 px-6 py-3">
                          {children.map(leaf => {
                            const lp = progressMap[leaf.id] || 0;
                            return (
                              <li key={leaf.id}>
                                <button
                                  type="button"
                                  onClick={() => openLeaf(leaf)}
                                  className="group/leaf w-full py-2 flex items-center gap-3 text-left"
                                >
                                  <span className="font-sans text-[10px] text-slate-400 tabular-nums w-4 shrink-0">
                                    ·
                                  </span>
                                  <span className="font-sans text-[13px] text-slate-700 flex-1 leading-tight group-hover/leaf:text-accent-600 transition-colors">
                                    {leaf.label}
                                  </span>
                                  <span className="font-sans text-[10px] font-bold tabular-nums text-slate-500 group-hover/leaf:text-accent-600 transition-colors">
                                    {lp}%
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {/* ─── Detail-Dialog (Logik wie TopicTile, eckig) ─── */}
      <Dialog open={openTopic !== null} onOpenChange={(v) => !v && setOpenTopic(null)}>
        <DialogContent className="max-w-md mx-auto max-h-[85vh] overflow-y-auto rounded-none border border-slate-200 shadow-none p-0">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500 mb-2">
              Thema
            </div>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-normal text-slate-900 tracking-tight leading-tight">
                {openTopic?.label}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Fortschritt */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <span className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
                  Fortschritt
                </span>
                <span className="font-serif text-3xl font-light text-slate-900 tabular-nums leading-none">
                  {dialogProgress}
                  <span className="text-base text-slate-400 ml-0.5">%</span>
                </span>
              </div>
              <Slider
                value={[dialogProgress]}
                onValueChange={handleDialogSlider}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between mt-3 font-sans text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <span>Offen</span>
                <span>Sitzt</span>
              </div>
            </div>

            {/* Notiz */}
            <div className="border-t border-slate-200 pt-5">
              <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500 mb-2">
                Notiz hinzufügen
              </div>
              <Textarea
                placeholder="Was hast du gelernt?"
                value={dialogNote}
                onChange={(e) => setDialogNote(e.target.value)}
                rows={2}
                className="resize-none rounded-none border border-slate-200 text-sm font-sans focus:ring-0 focus:border-slate-900 shadow-none"
              />
              <Button
                onClick={handleAddNote}
                disabled={!dialogNote.trim()}
                size="sm"
                className="mt-3 bg-slate-900 hover:bg-accent-600 rounded-none text-[10px] uppercase tracking-widest font-bold font-sans shadow-none px-4 py-2 h-auto"
              >
                <Plus className="h-3 w-3 mr-1.5" />
                Speichern
              </Button>
            </div>

            {/* Lernhistorie */}
            {dialogEntries.length > 0 && (
              <div className="border-t border-slate-200 pt-5">
                <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500 mb-3">
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
    </section>
  );
}
