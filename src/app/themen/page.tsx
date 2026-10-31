"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { NavBar } from "@/components/nav-bar";
import { TOPICS, buildTopicTree, getLeafDescendants } from "@/lib/topics";
import { getProgress, setTopicProgress, setManyTopicProgress } from "@/lib/store";
import { AREA_COLORS, Topic } from "@/lib/types";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, ChevronDown, ChevronRight, Undo2, X } from "lucide-react";
import { useAccountLearningMode } from "@/components/account-learning-boundary";
import { useAccountProgress } from "@/lib/learning/use-account-progress";
import Link from "next/link";

function TopicNode({
  topic,
  depth,
  progressMap,
  onProgressChange,
  onBranchChange,
  expanded,
  toggleExpand,
  searchTerm,
  disabled,
}: {
  topic: Topic;
  depth: number;
  progressMap: Record<string, number>;
  onProgressChange: (id: string, val: number) => void;
  onBranchChange: (branchId: string, val: number) => void;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  searchTerm: string;
  disabled?: boolean;
}) {
  const hasChildren = topic.children && topic.children.length > 0;
  const isExpanded = expanded.has(topic.id);
  const progress = progressMap[topic.id] || 0;
  const isLeaf = !hasChildren;

  // Korrekte Aggregation: REKURSIV über ALLE Leaf-Descendants —
  // egal wie tief die Hierarchie geht. Vorher wurden nur direkte Kinder
  // gezählt, was bei mehrstufigen Branches (z.B. Materielles ZR → BGB AT →
  // Leafs) ein 0%-Aggregat erzeugte, weil die Zwischen-Branches keinen
  // eigenen Wert in progressMap haben.
  const childProgress = hasChildren
    ? (() => {
        const leaves = getLeafDescendants(topic.id);
        if (leaves.length === 0) return 0;
        const sum = leaves.reduce((s, l) => s + (progressMap[l.id] || 0), 0);
        return Math.round(sum / leaves.length);
      })()
    : progress;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2.5 py-2 px-3 rounded-xl transition-all hover:bg-slate-50/70",
          depth === 0 && "bg-white/80 backdrop-blur-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-200/60 mt-3 px-3.5 py-3",
          depth === 1 && "ml-4",
          depth >= 2 && "ml-8"
        )}
      >
        {hasChildren ? (
          <button onClick={() => toggleExpand(topic.id)} className="shrink-0">
            {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", AREA_COLORS[topic.area])} />

        <span
          lang="de"
          className={cn(
            "flex-1 min-w-0 text-sm break-words hyphens-auto",
            depth === 0 && "font-bold text-base",
            depth === 1 && "font-semibold",
          )}
          style={{ hyphens: "auto" } as React.CSSProperties}
        >
          {topic.label}
        </span>

        {isLeaf ? (
          <div className="flex items-center gap-2 shrink-0 w-40">
            <Slider
              disabled={disabled}
              value={[progress]}
              onValueChange={(val) => onProgressChange(topic.id, Array.isArray(val) ? val[0] : val)}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className={cn(
              "text-xs font-bold w-8 text-right",
              progress >= 80 ? "text-accent-600" : progress >= 40 ? "text-amber-600" : "text-gray-400"
            )}>
              {progress}%
            </span>
          </div>
        ) : (
          // Branch-Slider: bei Änderung werden ALLE Leaf-Descendants auf den Wert gesetzt.
          // Praktisch um z.B. "Mietrecht auf 40%" schnell zu setzen statt jedes Leaf einzeln.
          <div className="flex items-center gap-2 shrink-0 w-40" title="Setzt alle Unter-Themen auf diesen Wert">
            <Slider
              disabled={disabled}
              value={[childProgress]}
              onValueChange={(val) => onBranchChange(topic.id, Array.isArray(val) ? val[0] : val)}
              max={100}
              step={5}
              className="flex-1 opacity-80"
            />
            <span className={cn(
              "text-xs font-bold w-8 text-right",
              childProgress >= 80 ? "text-accent-600" : childProgress >= 40 ? "text-amber-600" : "text-gray-400"
            )}>
              {childProgress}%
            </span>
          </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {topic.children!.map(child => (
            <TopicNode
              key={child.id}
              topic={child}
              depth={depth + 1}
              progressMap={progressMap}
              onProgressChange={onProgressChange}
              onBranchChange={onBranchChange}
              expanded={expanded}
              toggleExpand={toggleExpand}
              searchTerm={searchTerm}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ThemenPage() {
  return useAccountLearningMode() ? <AccountThemenPage /> : <ThemenView />;
}

function AccountThemenPage() {
  const remote=useAccountProgress();
  if (remote.status!=="ready") return <main className="mx-auto max-w-4xl px-4 py-12">
    <h1 className="text-2xl font-bold">Alle Themen</h1>
    <p role="status" className="my-4">{remote.status==="loading"?"Lernstand wird geladen …":remote.message}</p>
    {remote.status==="error" && <div className="flex gap-4"><button className="underline" onClick={remote.uncertain?remote.recover:remote.reload}>{remote.uncertain?"Ergebnis prüfen":"Neu laden"}</button><Link className="underline" href="/konto/anmelden">Zum Konto</Link></div>}
  </main>;
  return <ThemenView remote={remote}/>;
}

function ThemenView({remote}:{remote?:ReturnType<typeof useAccountProgress>}) {
  const [legacyMap, setProgressMap] = useState<Record<string, number>>({});
  const progressMap=remote?.progressMap ?? legacyMap;
  const accountMode=!!remote;
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["zr", "oeffr", "sr"]));
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (accountMode) return;
    const p = getProgress();
    const map: Record<string, number> = {};
    for (const [id, val] of Object.entries(p)) {
      map[id] = val.percent;
    }
    // localStorage-Hydration nach Mount, SSR-safe
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgressMap(map);
  }, [accountMode]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleProgressChange = useCallback((topicId: string, percent: number) => {
    if (remote) {remote.change({[topicId]:percent});return;}
    setTopicProgress(topicId, percent);
    setProgressMap(prev => ({ ...prev, [topicId]: percent }));
  }, [remote]);

  // Undo-Snapshot: vor jeder Branch-Aktion speichern wir die alten Leaf-Werte,
  // damit der User den Schritt zurückrollen kann. Nur 1 Schritt zurück
  // (kein History-Stack) — pragmatisch und reicht für versehentliche Aktionen.
  const [legacyUndoSnapshot, setUndoSnapshot] = useState<{
    description: string;
    before: Record<string, number>;
  } | null>(null);
  const undoSnapshot=useMemo(()=>remote ? remote.undoId ? {description:"Letzte Gruppenänderung",before:{}} : null : legacyUndoSnapshot,[remote,legacyUndoSnapshot]);

  // Branch-Slider: PROPORTIONALE Skalierung der Sub-Leaves.
  // Faktor = Ziel / aktuelles_Aggregat → jedes Leaf wird mit dem Faktor
  // multipliziert (clamped 0-100). So bleibt das Verhältnis zwischen den
  // Sub-Leaves erhalten: ein starkes Leaf wächst weiter als ein schwaches.
  // Edge-Cases: Aggregat=0 oder Ziel=0 → uniform setzen (sonst Division-Fail).
  const handleBranchChange = useCallback((branchId: string, percent: number) => {
    const leafsUnderBranch = getLeafDescendants(branchId);
    if (leafsUnderBranch.length === 0) return;

    // Snapshot für Undo (nur die betroffenen Leaves)
    const snapshot: Record<string, number> = {};
    for (const leaf of leafsUnderBranch) snapshot[leaf.id] = progressMap[leaf.id] || 0;

    // Aktuelles Aggregat berechnen
    const currentAvg =
      leafsUnderBranch.reduce((s, l) => s + (progressMap[l.id] || 0), 0) /
      leafsUnderBranch.length;

    // Neue Werte: proportional skalieren oder uniform (bei Edge-Cases)
    const updates: Record<string, number> = {};
    if (currentAvg === 0 || percent === 0) {
      // Uniform: kein Skalierungsfaktor möglich oder Reset auf 0
      for (const leaf of leafsUnderBranch) updates[leaf.id] = percent;
    } else {
      const factor = percent / currentAvg;
      for (const leaf of leafsUnderBranch) {
        const cur = progressMap[leaf.id] || 0;
        updates[leaf.id] = Math.max(0, Math.min(100, Math.round(cur * factor)));
      }
    }

    if (remote) {remote.change(updates,true);return;}
    setManyTopicProgress(updates);
    setProgressMap(prev => ({ ...prev, ...updates }));

    const branchLabel = TOPICS.find(t => t.id === branchId)?.label || branchId;
    setUndoSnapshot({
      description: `${branchLabel} → ${percent}% (${leafsUnderBranch.length} Themen)`,
      before: snapshot,
    });
  }, [progressMap,remote]);

  const handleUndo = useCallback(() => {
    if (remote) {remote.undo();return;}
    if (!undoSnapshot) return;
    setManyTopicProgress(undoSnapshot.before);
    setProgressMap(prev => ({ ...prev, ...undoSnapshot.before }));
    setUndoSnapshot(null);
  }, [undoSnapshot,remote]);

  const tree = buildTopicTree(TOPICS);

  // Suche: alle Ebenen expandieren wenn gesucht wird
  const effectiveExpanded = searchTerm
    ? new Set(TOPICS.map(t => t.id))
    : expanded;

  // Filter-Logik
  const filterTree = (nodes: Topic[]): Topic[] => {
    if (!searchTerm) return nodes;
    return nodes
      .map(node => {
        const matchesSelf = node.label.toLowerCase().includes(searchTerm.toLowerCase());
        const filteredChildren = node.children ? filterTree(node.children) : [];
        if (matchesSelf || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children };
        }
        return null;
      })
      .filter(Boolean) as Topic[];
  };

  const displayTree = filterTree(tree);

  return (
    <>
      {!remote && <NavBar />}
      <main className="flex-1 pb-24 pt-4 md:pt-24 px-4 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-1 tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Alle Themen</h1>
        {remote && <p role="status" className="my-3 text-sm">{remote.message || "Kontofortschritt geladen"}</p>}
        <p className="text-xs text-slate-500 mb-5">
          Hierarchischer Themenbaum. Leaf-Slider setzt einzelne Themen,
          Branch-Slider skaliert <strong>proportional</strong> alle Unter-Themen.
        </p>

        {/* Undo-Banner: erscheint nach Branch-Aktion, verschwindet bei Undo oder Klick auf X */}
        {undoSnapshot && (
          <div className="mb-5 flex items-center gap-3 bg-accent-50 border border-accent-200 px-4 py-3 rounded-xl">
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
              onClick={handleUndo}
              disabled={remote?.busy}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-accent-600 text-white font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-3 py-1.5 transition-colors rounded"
            >
              <Undo2 className="h-3 w-3" />
              Rückgängig
            </button>
            <button
              onClick={() => remote ? remote.dismissUndo() : setUndoSnapshot(null)}
              disabled={remote?.busy}
              className="text-slate-400 hover:text-slate-700"
              title="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Suche */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Thema suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-slate-50 hover:bg-white border-slate-200 focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all"
          />
        </div>

        {/* Baum */}
        <div className="space-y-1">
          {displayTree.map(topic => (
            <TopicNode
              key={topic.id}
              topic={topic}
              depth={0}
              progressMap={progressMap}
              onProgressChange={handleProgressChange}
              onBranchChange={handleBranchChange}
              expanded={effectiveExpanded}
              toggleExpand={toggleExpand}
              searchTerm={searchTerm}
              disabled={remote?.busy}
            />
          ))}
        </div>
      </main>
    </>
  );
}
