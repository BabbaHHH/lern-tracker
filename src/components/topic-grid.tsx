"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { useAccountProgress } from "@/lib/learning/use-account-progress";
import type { useAccountPersonal } from "@/lib/learning/use-account-personal";
import { TOPICS, getLeafTopics, getLeafDescendants } from "@/lib/topics";
import {
  getProgress,
  getTopicProgress,
  setTopicProgress,
  setManyTopicProgress,
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
import { Plus, ChevronRight, Undo2, X } from "lucide-react";
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
      "zr-mat-at",
      "zr-mat-schuld-at",
      "zr-mat-schuld-bt",
      "zr-mat-sach",
      "zr-mat-hgb",
      "zr-mat-ges",
      "zr-mat-fam",
      "zr-mat-erb",
      "zr-mat-sonst",
    ],
  },
  {
    index: "02",
    label: "Materielles Öffentliches Recht",
    groupIds: [
      "or-mat-verw",
      "or-mat-staatshaft",
      "or-mat-vollstr",
      "or-mat-pol",
      "or-mat-waffen",
      "or-mat-versamml",
      "or-mat-bau",
      "or-mat-umwelt",
      "or-mat-gewerbe",
      "or-mat-komm",
      "or-mat-beamten",
      "or-mat-schul",
      "or-mat-verkehr",
      "or-mat-ausl",
      "or-mat-subv",
      "or-mat-ifg",
      "or-mat-verf",
    ],
  },
  {
    index: "03",
    label: "Materielles Strafrecht",
    groupIds: ["sr-mat-at", "sr-mat-bt"],
  },
  {
    index: "04",
    label: "Zivilprozessrecht",
    groupIds: [
      "zr-proz-urteil",
      "zr-proz-zust",
      "zr-proz-parteien",
      "zr-proz-klagearten",
      "zr-proz-erledigung",
      "zr-proz-aufr",
      "zr-proz-vu",
      "zr-proz-eil",
      "zr-proz-zv",
      "zr-proz-beweis",
      "zr-proz-sonst",
      "zr-proz-klausurtyp",
    ],
  },
  {
    index: "05",
    label: "Verwaltungsprozessrecht",
    groupIds: [
      "or-proz-urteil",
      "or-proz-klage",
      "or-proz-eil",
      "or-proz-bescheid",
      "or-proz-klausurtyp",
    ],
  },
  {
    index: "06",
    label: "Strafprozessrecht",
    groupIds: [
      "sr-proz-vh",
      "sr-proz-zust",
      "sr-proz-wahl",
      "sr-proz-bvv",
      "sr-proz-erm",
      "sr-proz-haft",
      "sr-proz-einz",
      "sr-proz-sta",
      "sr-proz-rev-form",
      "sr-proz-rev-abs",
      "sr-proz-rev-rel",
      "sr-proz-rev-sach",
    ],
  },
];

export function TopicGrid({remote}:{remote?:{progress:ReturnType<typeof useAccountProgress>;personal:ReturnType<typeof useAccountPersonal>}}={}) {
  const [browserProgressMap, setProgressMap] = useState<Record<string, number>>({});

  const progressMap=remote?.progress.progressMap??browserProgressMap;
  const disabled=!!remote&&(remote.progress.busy||remote.personal.busy);
  const [editing,setEditing]=useState<{id:string;revision:number}|null>(null);

  // Inline-Akkordeon: pro Säule maximal eine Gruppe geöffnet
  const [openGroupByPillar, setOpenGroupByPillar] = useState<Record<string, string | null>>({});

  // Detail-Dialog für Leaf-Topics
  const [openTopic, setOpenTopic] = useState<Topic | null>(null);
  const [dialogProgress, setDialogProgress] = useState(0);
  const [dialogNote, setDialogNote] = useState("");
  const [dialogEntries, setDialogEntries] = useState<ReturnType<typeof getEntriesForTopic>>([]);

  useEffect(() => {
    if(remote)return;
    const p = getProgress();
    const map: Record<string, number> = {};
    for (const [id, val] of Object.entries(p)) {
      map[id] = val.percent;
    }
    // localStorage-Hydration nach Mount, SSR-safe
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgressMap(map);
  }, [remote]);

  const handleProgressChange = useCallback((topicId: string, percent: number) => {
    if(remote){remote.progress.change({[topicId]:percent});return;}
    setTopicProgress(topicId, percent);
    setProgressMap(prev => ({ ...prev, [topicId]: percent }));
  }, [remote]);

  // Undo-Snapshot für Branch-Aktionen (Säulen, Gruppen)
  const [browserUndoSnapshot, setUndoSnapshot] = useState<{
    description: string;
    before: Record<string, number>;
  } | null>(null);

  const undoSnapshot=useMemo(()=>remote?(remote.progress.undoId?{description:"Letzte Gruppenaktion",before:{}}:null):browserUndoSnapshot,[remote,browserUndoSnapshot]);

  // Multi-Branch-Slider: proportionale Skalierung aller Sub-Leaves über
  // MEHRERE Branch-Wurzeln hinweg. Für Säulen (mehrere Gruppen) und einzelne
  // Gruppen gleichermaßen — Säule passt einfach mehrere groupIds rein.
  const handleMultiBranchChange = useCallback((branchIds: string[], label: string, percent: number) => {
    const leafSet = new Set<string>();
    const leaves: Topic[] = [];
    for (const bid of branchIds) {
      for (const l of getLeafDescendants(bid)) {
        if (!leafSet.has(l.id)) {
          leafSet.add(l.id);
          leaves.push(l);
        }
      }
    }
    if (leaves.length === 0) return;

    const snapshot: Record<string, number> = {};
    for (const l of leaves) snapshot[l.id] = progressMap[l.id] || 0;

    const currentAvg =
      leaves.reduce((s, l) => s + (progressMap[l.id] || 0), 0) / leaves.length;

    const updates: Record<string, number> = {};
    if (currentAvg === 0 || percent === 0) {
      for (const l of leaves) updates[l.id] = percent;
    } else {
      const factor = percent / currentAvg;
      for (const l of leaves) {
        const cur = progressMap[l.id] || 0;
        updates[l.id] = Math.max(0, Math.min(100, Math.round(cur * factor)));
      }
    }

    if(remote){remote.progress.change(updates,true);return;}
    setManyTopicProgress(updates);
    setProgressMap(prev => ({ ...prev, ...updates }));
    setUndoSnapshot({
      description: `${label} → ${percent}% (${leaves.length} Themen)`,
      before: snapshot,
    });
  }, [progressMap,remote]);

  // Single-Branch convenience-Wrapper
  const handleBranchChange = useCallback((branchId: string, branchLabel: string, percent: number) => {
    handleMultiBranchChange([branchId], branchLabel, percent);
  }, [handleMultiBranchChange]);

  const handleUndo = useCallback(() => {
    if(remote){remote.progress.undo();return;}
    if (!undoSnapshot) return;
    setManyTopicProgress(undoSnapshot.before);
    setProgressMap(prev => ({ ...prev, ...undoSnapshot.before }));
    setUndoSnapshot(null);
  }, [undoSnapshot,remote]);

  const toggleGroup = useCallback((pillarIndex: string, groupId: string) => {
    setOpenGroupByPillar(prev => ({
      ...prev,
      [pillarIndex]: prev[pillarIndex] === groupId ? null : groupId,
    }));
  }, []);

  const openLeaf = useCallback((topic: Topic) => {
    setOpenTopic(topic);
    if(!remote){setDialogProgress(getTopicProgress(topic.id));
    setDialogEntries(getEntriesForTopic(topic.id));}
    setEditing(null);
    setDialogNote("");
  }, [remote]);

  const handleDialogSlider = useCallback(
    (value: number | readonly number[]) => {
      if (!openTopic) return;
      const v = Array.isArray(value) ? value[0] : value;
      setDialogProgress(v);
      handleProgressChange(openTopic.id, v);
    },
    [openTopic, handleProgressChange]
  );

  const handleAddNote = useCallback(async () => {
    if (!openTopic || !dialogNote.trim()) return;
    if(remote){const result=await remote.personal.saveNote(editing?.id??crypto.randomUUID(),openTopic.id,dialogNote.trim(),editing?.revision??null);if(result){setDialogNote("");setEditing(null);}return;}
    const updated = addLearningEntry({
      topicId: openTopic.id,
      note: dialogNote.trim(),
      source: "manual",
    });
    setDialogEntries(updated.filter(e => e.topicId === openTopic.id));
    setDialogNote("");
  }, [dialogNote, openTopic,remote,editing]);
  const entries=remote?(remote.personal.view?.notes.filter(e=>e.value.topicId===openTopic?.id).map(e=>e.value)??[]):dialogEntries;
  const shownDialogProgress=remote&&openTopic?(progressMap[openTopic.id]??0):dialogProgress;

  const leafTopics = getLeafTopics(TOPICS);

  // Aggregations-Helpers — REKURSIV über alle Leaf-Descendants.
  // Vorher wurden nur direkte Kinder gezählt → Aggregat fiel auf 0 sobald die
  // Hierarchie tiefer ging als 1 Stufe (z.B. Group → Subgroup → Leaf).
  const groupChildren = (groupId: string): Topic[] =>
    TOPICS.filter(t => t.parentId === groupId).sort((a, b) => a.sortOrder - b.sortOrder);

  const groupProgress = (groupId: string): number => {
    const leaves = getLeafDescendants(groupId);
    if (leaves.length === 0) return 0;
    const sum = leaves.reduce((s, l) => s + (progressMap[l.id] || 0), 0);
    return Math.round(sum / leaves.length);
  };

  const pillarProgress = (pillar: Pillar): number => {
    const allLeafs: Topic[] = [];
    pillar.groupIds.forEach(gid => allLeafs.push(...getLeafDescendants(gid)));
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

      {/* Undo-Banner für Branch-Aktionen (Säulen-/Gruppen-Slider) */}
      {undoSnapshot && (
        <div className="border-b border-accent-200 bg-accent-50 px-6 py-3 flex items-center gap-3">
          <Undo2 className="h-4 w-4 text-accent-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-sans text-[10px] uppercase tracking-[0.16em] font-bold text-accent-700">
              Letzte Bulk-Aktion
            </div>
            <div className="font-sans text-[12px] text-slate-700 truncate">
              {undoSnapshot.description}
            </div>
          </div>
          <button
            disabled={disabled}
            onClick={handleUndo}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-accent-600 text-white font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-3 py-1.5 transition-colors"
          >
            <Undo2 className="h-3 w-3" />
            Rückgängig
          </button>
          <button
            onClick={() => remote?remote.progress.dismissUndo():setUndoSnapshot(null)}
            className="text-slate-400 hover:text-slate-700"
            title="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 border border-slate-200 flex items-center justify-center font-sans text-[11px] font-bold text-slate-900 shrink-0">
                      {pillar.index}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h3
                        lang="de"
                        className="font-serif text-[17px] sm:text-[18px] font-normal text-slate-900 leading-tight tracking-tight break-words hyphens-auto"
                        style={{ hyphens: "auto" } as React.CSSProperties}
                      >
                        {pillar.label}
                      </h3>
                      <p className="font-sans text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 mt-1.5 whitespace-nowrap">
                        {groupCount} Themen · {leafCount} Einträge
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pt-1">
                    <div className="font-serif text-2xl font-light text-slate-900 tabular-nums leading-none">
                      {p}
                      <span className="text-sm text-slate-400 ml-0.5">%</span>
                    </div>
                  </div>
                </div>
                {/* Säulen-Slider: zieht ALLE Leaves der Säule proportional.
                    handleMultiBranchChange sammelt Leaves aus allen groupIds
                    der Säule und skaliert das gemeinsame Aggregat auf den Zielwert. */}
                <div
                  className="w-full"
                  title={`${pillar.label} insgesamt skalieren (proportional, alle Themen der Säule)`}
                >
                  <Slider
                    disabled={disabled}
                    value={[p]}
                    onValueChange={(val) =>
                      handleMultiBranchChange(
                        pillar.groupIds,
                        pillar.label,
                        Array.isArray(val) ? val[0] : val,
                      )
                    }
                    max={100}
                    step={5}
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
                      <div className="group/grp w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                        <button
                          type="button"
                          onClick={() => toggleGroup(pillar.index, gid)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 text-slate-400 shrink-0 transition-transform",
                              isOpen && "rotate-90 text-slate-900"
                            )}
                            strokeWidth={2.5}
                          />
                          <span
                            lang="de"
                            className={cn(
                              "font-serif text-[15px] font-normal text-slate-900 flex-1 min-w-0 leading-tight tracking-tight transition-colors break-words hyphens-auto",
                              "group-hover/grp:text-accent-600",
                              isOpen && "text-accent-600"
                            )}
                            style={{ hyphens: "auto" } as React.CSSProperties}
                          >
                            {group.label}
                          </span>
                        </button>
                        {/* Gruppen-Slider: proportional alle Sub-Leaves skalieren */}
                        <div
                          className="flex items-center gap-2 shrink-0"
                          title={`${group.label} skalieren (proportional)`}
                        >
                          <div className="hidden sm:block w-20">
                            <Slider
                    disabled={disabled}
                              value={[gp]}
                              onValueChange={(val) =>
                                handleBranchChange(
                                  gid,
                                  group.label,
                                  Array.isArray(val) ? val[0] : val,
                                )
                              }
                              max={100}
                              step={5}
                            />
                          </div>
                          <span className="font-sans text-[11px] font-bold tabular-nums text-slate-500 w-8 text-right">
                            {gp}%
                          </span>
                        </div>
                      </div>

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
                                  <span className="font-sans text-[13px] text-slate-700 flex-1 min-w-0 leading-tight group-hover/leaf:text-accent-600 transition-colors break-words">
                                    {leaf.label}
                                  </span>
                                  <span className="font-sans text-[10px] font-bold tabular-nums text-slate-500 group-hover/leaf:text-accent-600 transition-colors shrink-0">
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
                  {shownDialogProgress}
                  <span className="text-base text-slate-400 ml-0.5">%</span>
                </span>
              </div>
              <Slider
                    disabled={disabled}
                value={[shownDialogProgress]}
                onValueChange={handleDialogSlider}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between mt-3 font-sans text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <span>Offen</span>
                <span>Sitzt</span>
              </div>
              <p className="font-sans text-[10px] text-slate-400 mt-2 text-center">{remote?remote.progress.message||"Kontofortschritt geladen":"Fortschritt wird automatisch gespeichert"}</p>
            </div>

            {/* Notiz */}
            <div className="border-t border-slate-200 pt-5">
              <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500 mb-2">
                Notiz hinzufügen
              </div>
              <Textarea
                placeholder="Was hast du gelernt?"
                value={dialogNote}
                disabled={disabled}
                onChange={(e) => setDialogNote(e.target.value)}
                rows={2}
                className="resize-none rounded-none border border-slate-200 text-sm font-sans focus:ring-0 focus:border-slate-900 shadow-none"
              />
              <Button
                onClick={handleAddNote}
                disabled={disabled||!dialogNote.trim()}
                size="sm"
                className="mt-3 bg-slate-900 hover:bg-accent-600 rounded-none text-[10px] uppercase tracking-widest font-bold font-sans shadow-none px-4 py-2 h-auto"
              >
                <Plus className="h-3 w-3 mr-1.5" />
                {editing?"Änderung speichern":"Speichern"}
              </Button>
            </div>

            {/* Lernhistorie */}
            {entries.length > 0 && (
              <div className="border-t border-slate-200 pt-5">
                <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500 mb-3">
                  Lernhistorie
                </div>
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {entries.map((entry) => (
                    <div key={entry.id} className="border-l border-slate-200 pl-3">
                      <p className="font-sans text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{entry.note}</p>
                      {remote&&<button className="text-sm underline" disabled={disabled} onClick={()=>{const record=remote.personal.view?.notes.find(n=>n.id===entry.id);if(record){setEditing({id:record.id,revision:record.revision});setDialogNote(entry.note);}}}>Bearbeiten</button>}
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
