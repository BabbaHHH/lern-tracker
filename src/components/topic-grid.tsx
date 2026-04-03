"use client";

import { useState, useEffect, useCallback } from "react";
import { TOPICS, buildTopicTree, getLeafTopics } from "@/lib/topics";
import { getProgress } from "@/lib/store";
import { Topic, Area, AREA_LABELS, AREA_COLORS_LIGHT } from "@/lib/types";
import { TopicTile } from "./topic-tile";
import { Badge } from "@/components/ui/badge";
import { Progress as ProgressBar } from "@/components/ui/progress";
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
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const tree = buildTopicTree(TOPICS);
  const leafTopics = getLeafTopics(TOPICS);

  // Gesamtfortschritt berechnen
  const totalProgress = leafTopics.length > 0
    ? Math.round(leafTopics.reduce((sum, t) => sum + (progressMap[t.id] || 0), 0) / leafTopics.length)
    : 0;

  // Fortschritt pro Rechtsgebiet
  const areaProgress = (area: Area) => {
    const areaLeafs = leafTopics.filter(t => t.area === area);
    if (areaLeafs.length === 0) return 0;
    return Math.round(areaLeafs.reduce((sum, t) => sum + (progressMap[t.id] || 0), 0) / areaLeafs.length);
  };

  // Fortschritt für eine Gruppe (Zwischenebene)
  const groupProgress = (groupId: string) => {
    const children = TOPICS.filter(t => t.parentId === groupId);
    const groupLeafs = children.filter(t => !TOPICS.some(other => other.parentId === t.id));
    if (groupLeafs.length === 0) {
      // Check deeper
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
    }
    return Math.round(groupLeafs.reduce((sum, t) => sum + (progressMap[t.id] || 0), 0) / groupLeafs.length);
  };

  const filteredTree = filterArea === "all"
    ? tree
    : tree.filter(t => t.area === filterArea);

  return (
    <div className="space-y-6">
      {/* Gesamtfortschritt */}
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">Gesamtfortschritt</span>
          <span className="text-lg font-bold text-emerald-600">{totalProgress}%</span>
        </div>
        <ProgressBar value={totalProgress} className="h-3" />

        {/* Pro Rechtsgebiet */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {(["zr", "oeffr", "sr"] as Area[]).map(area => (
            <button
              key={area}
              onClick={() => setFilterArea(filterArea === area ? "all" : area)}
              className={cn(
                "rounded-lg p-2 text-center transition-all",
                filterArea === area ? "ring-2 ring-emerald-500" : "",
                AREA_COLORS_LIGHT[area]
              )}
            >
              <div className="text-xs font-medium text-gray-600">{AREA_LABELS[area]}</div>
              <div className="text-lg font-bold">{areaProgress(area)}%</div>
            </button>
          ))}
        </div>
      </div>

      {/* Themen-Kacheln nach Rechtsgebiet */}
      {filteredTree.map(rootTopic => (
        <div key={rootTopic.id} className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs", AREA_COLORS_LIGHT[rootTopic.area])}>
              {AREA_LABELS[rootTopic.area]}
            </Badge>
          </h2>

          {rootTopic.children?.map(group => {
            const isExpanded = expandedGroups.has(group.id);
            const gProgress = groupProgress(group.id);
            const hasChildren = group.children && group.children.length > 0;

            return (
              <div key={group.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                >
                  {hasChildren ? (
                    isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />
                  ) : <div className="w-4" />}
                  <span className="font-medium text-sm flex-1 text-left">{group.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${gProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-500 w-8 text-right">{gProgress}%</span>
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
