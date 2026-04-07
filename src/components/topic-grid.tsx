"use client";

import { useState, useEffect, useCallback } from "react";
import { TOPICS, buildTopicTree, getLeafTopics } from "@/lib/topics";
import { getProgress } from "@/lib/store";
import { Topic, Area, AREA_LABELS, AREA_COLORS_LIGHT } from "@/lib/types";
import { TopicTile } from "./topic-tile";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function TopicGrid() {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filterArea, setFilterArea] = useState<Area | "all">("all");

  useEffect(() => {
    const p = getProgress();
    const map: Record<string, number> = {};
    for (const [id, val] of Object.entries(p)) {
      map[id] = val.percent;
    }
    setProgressMap(map);
  }, []);

  const handleProgressChange = useCallback((topicId: string, percent: number) => {
    setProgressMap(prev => ({ ...prev, [topicId]: percent }));
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const tree = buildTopicTree(TOPICS);
  const leafTopics = getLeafTopics(TOPICS);

  const totalProgress = leafTopics.length > 0
    ? Math.round(leafTopics.reduce((sum, t) => sum + (progressMap[t.id] || 0), 0) / leafTopics.length)
    : 0;

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

  const filteredTree = filterArea === "all"
    ? tree
    : tree.filter(t => t.area === filterArea);

  const areaConfig: { area: Area; gradient: string; ring: string }[] = [
    { area: "zr", gradient: "from-blue-500 to-indigo-500", ring: "ring-blue-500/30" },
    { area: "oeffr", gradient: "from-amber-500 to-orange-500", ring: "ring-amber-500/30" },
    { area: "sr", gradient: "from-rose-500 to-red-500", ring: "ring-rose-500/30" },
  ];

  return (
    <div className="space-y-6">
      {/* Area Filter Chips */}
      <div className="flex gap-2">
        {areaConfig.map(({ area, gradient, ring }) => {
          const p = areaProgress(area);
          const isActive = filterArea === area;
          return (
            <button
              key={area}
              onClick={() => setFilterArea(filterArea === area ? "all" : area)}
              className={cn(
                "flex-1 relative overflow-hidden rounded-2xl p-3 text-center transition-all card-hover border",
                isActive ? `ring-2 ${ring} border-transparent` : "border-slate-200 bg-white"
              )}
            >
              {/* Background gradient when active */}
              {isActive && (
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-10", gradient)} />
              )}
              <div className="relative">
                <div className="text-[11px] font-medium text-slate-500 mb-0.5">{AREA_LABELS[area]}</div>
                <div className="text-xl font-black tabular-nums text-slate-900">{p}%</div>
                {/* Mini bar */}
                <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full bg-gradient-to-r", gradient)} style={{ width: `${p}%` }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Topic Groups */}
      {filteredTree.map(rootTopic => (
        <div key={rootTopic.id} className="space-y-2">
          {rootTopic.children?.map(group => {
            const isExpanded = expandedGroups.has(group.id);
            const gProgress = groupProgress(group.id);
            const hasChildren = group.children && group.children.length > 0;

            return (
              <div key={group.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden card-hover">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors"
                >
                  {hasChildren ? (
                    isExpanded
                      ? <ChevronDown className="h-4 w-4 text-slate-400" />
                      : <ChevronRight className="h-4 w-4 text-slate-400" />
                  ) : <div className="w-4" />}

                  <span className="font-semibold text-sm flex-1 text-left text-slate-800">{group.label}</span>

                  <div className="flex items-center gap-2.5">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${gProgress}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-xs font-bold tabular-nums w-8 text-right",
                      gProgress >= 80 ? "text-indigo-600" : gProgress > 0 ? "text-slate-500" : "text-slate-300"
                    )}>
                      {gProgress}%
                    </span>
                  </div>
                </button>

                {isExpanded && hasChildren && (
                  <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {group.children!.map(child => (
                      <TopicTile
                        key={child.id}
                        topic={child}
                        progress={progressMap[child.id] || 0}
                        onProgressChange={handleProgressChange}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
