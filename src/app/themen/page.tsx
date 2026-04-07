"use client";

import { useState, useEffect, useCallback } from "react";
import { NavBar } from "@/components/nav-bar";
import { TOPICS, buildTopicTree } from "@/lib/topics";
import { getProgress, setTopicProgress } from "@/lib/store";
import { Area, AREA_LABELS, AREA_COLORS, Topic } from "@/lib/types";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

function TopicNode({
  topic,
  depth,
  progressMap,
  onProgressChange,
  expanded,
  toggleExpand,
  searchTerm,
}: {
  topic: Topic;
  depth: number;
  progressMap: Record<string, number>;
  onProgressChange: (id: string, val: number) => void;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  searchTerm: string;
}) {
  const hasChildren = topic.children && topic.children.length > 0;
  const isExpanded = expanded.has(topic.id);
  const progress = progressMap[topic.id] || 0;
  const isLeaf = !hasChildren;

  // Kinder-Fortschritt berechnen
  const childProgress = hasChildren
    ? Math.round(
        topic.children!.reduce((sum, c) => sum + (progressMap[c.id] || 0), 0) / topic.children!.length
      )
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

        <span className={cn(
          "flex-1 text-sm",
          depth === 0 && "font-bold text-base",
          depth === 1 && "font-semibold",
        )}>
          {topic.label}
        </span>

        {isLeaf ? (
          <div className="flex items-center gap-2 shrink-0 w-40">
            <Slider
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
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${childProgress}%` }} />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{childProgress}%</span>
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
              expanded={expanded}
              toggleExpand={toggleExpand}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ThemenPage() {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["zr", "oeffr", "sr"]));
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const p = getProgress();
    const map: Record<string, number> = {};
    for (const [id, val] of Object.entries(p)) {
      map[id] = val.percent;
    }
    setProgressMap(map);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleProgressChange = useCallback((topicId: string, percent: number) => {
    setTopicProgress(topicId, percent);
    setProgressMap(prev => ({ ...prev, [topicId]: percent }));
  }, []);

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
      <NavBar />
      <main className="flex-1 pb-24 pt-4 md:pt-24 px-4 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-1 tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Alle Themen</h1>
        <p className="text-xs text-slate-500 mb-5">Hierarchischer Themenbaum mit Fortschrittssteuerung</p>

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
              expanded={effectiveExpanded}
              toggleExpand={toggleExpand}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      </main>
    </>
  );
}
