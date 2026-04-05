"use client";

import { useState, useEffect, useMemo } from "react";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TOPICS, getLeafTopics, buildTopicTree } from "@/lib/topics";
import { getKlausuren, addKlausur, updateKlausur, removeKlausur } from "@/lib/store";
import { Klausur, KlausurDifficulty, Area, AREA_LABELS } from "@/lib/types";
import {
  Plus, FileText, ArrowLeft, Trash2, Edit3, Search,
  BookOpen, Scale, Tag, Clock, ChevronDown, ChevronRight, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const DIFFICULTY_LABELS: Record<KlausurDifficulty, string> = {
  leicht: "Leicht",
  mittel: "Mittel",
  schwer: "Schwer",
};

const DIFFICULTY_COLORS: Record<KlausurDifficulty, string> = {
  leicht: "bg-green-100 text-green-700",
  mittel: "bg-amber-100 text-amber-700",
  schwer: "bg-red-100 text-red-700",
};

const AREA_BADGE_COLORS: Record<Area, string> = {
  zr: "bg-blue-100 text-blue-700",
  oeffr: "bg-amber-100 text-amber-700",
  sr: "bg-rose-100 text-rose-700",
};

interface KlausurForm {
  title: string;
  area: Area;
  topicIds: string[];
  difficulty: KlausurDifficulty;
  source: string;
  sachverhalt: string;
  solution: string;
  durationMinutes: number;
}

const emptyForm: KlausurForm = {
  title: "",
  area: "zr",
  topicIds: [],
  difficulty: "mittel",
  source: "",
  sachverhalt: "",
  solution: "",
  durationMinutes: 300,
};

function TopicPicker({
  selectedIds,
  onToggle,
  areaFilter,
}: {
  selectedIds: string[];
  onToggle: (id: string) => void;
  areaFilter: Area;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const tree = useMemo(() => buildTopicTree(TOPICS), []);
  const leafTopics = useMemo(() => getLeafTopics(TOPICS), []);

  const filteredTopics = useMemo(() => {
    return leafTopics.filter(t => {
      if (t.area !== areaFilter) return false;
      if (search && !t.label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [leafTopics, areaFilter, search]);

  // Gruppiere nach Parent
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filteredTopics>();
    filteredTopics.forEach(t => {
      const parentId = t.parentId || "root";
      const group = groups.get(parentId) || [];
      group.push(t);
      groups.set(parentId, group);
    });
    return groups;
  }, [filteredTopics]);

  const getParentLabel = (parentId: string) => {
    const parent = TOPICS.find(t => t.id === parentId);
    return parent?.label || parentId;
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          placeholder="Themen suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm rounded-lg"
        />
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1 border rounded-xl p-2 bg-slate-50">
        {Array.from(grouped.entries()).map(([parentId, topics]) => {
          const isExpanded = expandedGroups.has(parentId);
          return (
            <div key={parentId}>
              <button
                type="button"
                onClick={() => {
                  const next = new Set(expandedGroups);
                  if (isExpanded) next.delete(parentId);
                  else next.add(parentId);
                  setExpandedGroups(next);
                }}
                className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-slate-600 py-1 hover:text-slate-900"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {getParentLabel(parentId)}
                <span className="text-slate-400 font-normal ml-auto">
                  {topics.filter(t => selectedIds.includes(t.id)).length}/{topics.length}
                </span>
              </button>
              {isExpanded && (
                <div className="ml-4 space-y-0.5">
                  {topics.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onToggle(t.id)}
                      className={cn(
                        "flex items-center gap-2 w-full text-left text-xs py-1 px-2 rounded-md transition-colors",
                        selectedIds.includes(t.id)
                          ? "bg-emerald-100 text-emerald-800"
                          : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                        selectedIds.includes(t.id)
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-slate-300"
                      )}>
                        {selectedIds.includes(t.id) && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {grouped.size === 0 && (
          <p className="text-xs text-slate-400 text-center py-3">Keine Themen gefunden</p>
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-[11px] text-emerald-600 font-medium">{selectedIds.length} Themen ausgewählt</p>
      )}
    </div>
  );
}

export default function KlausurenPage() {
  const [klausuren, setKlausuren] = useState<Klausur[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KlausurForm>(emptyForm);
  const [filter, setFilter] = useState<Area | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setKlausuren(getKlausuren());
  }, []);

  const filtered = useMemo(() => {
    return klausuren.filter(k => {
      if (filter !== "all" && k.area !== filter) return false;
      if (search && !k.title.toLowerCase().includes(search.toLowerCase()) &&
          !k.source.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [klausuren, filter, search]);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (k: Klausur) => {
    setForm({
      title: k.title,
      area: k.area,
      topicIds: [...k.topicIds],
      difficulty: k.difficulty,
      source: k.source,
      sachverhalt: k.sachverhalt,
      solution: k.solution,
      durationMinutes: k.durationMinutes,
    });
    setEditingId(k.id);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;

    if (editingId) {
      const updated = updateKlausur(editingId, form);
      setKlausuren(updated);
    } else {
      const updated = addKlausur(form);
      setKlausuren(updated);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    const updated = removeKlausur(id);
    setKlausuren(updated);
    if (expandedId === id) setExpandedId(null);
  };

  const toggleTopic = (topicId: string) => {
    setForm(prev => ({
      ...prev,
      topicIds: prev.topicIds.includes(topicId)
        ? prev.topicIds.filter(t => t !== topicId)
        : [...prev.topicIds, topicId],
    }));
  };

  const getTopicLabel = (id: string) => {
    const topic = TOPICS.find(t => t.id === id);
    return topic?.label || id;
  };

  return (
    <>
      <NavBar />
      <main className="flex-1 pb-20 pt-3 md:pt-16 px-4 max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Klausur-Datenbank</h1>
            <p className="text-xs text-slate-500">{klausuren.length} Klausuren gespeichert</p>
          </div>
          <Button onClick={openNew} size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl">
            <Plus className="h-4 w-4 mr-1" />
            Neue Klausur
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm rounded-xl"
            />
          </div>
          {(["all", "zr", "oeffr", "sr"] as const).map(area => (
            <button
              key={area}
              onClick={() => setFilter(area)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors",
                filter === area
                  ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
              )}
            >
              {area === "all" ? "Alle" : AREA_LABELS[area]}
            </button>
          ))}
        </div>

        {/* Klausur List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">
              {klausuren.length === 0 ? "Noch keine Klausuren" : "Keine Treffer"}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {klausuren.length === 0
                ? "Füge deine erste Klausur hinzu"
                : "Passe deine Suche oder Filter an"}
            </p>
            {klausuren.length === 0 && (
              <Button onClick={openNew} variant="outline" className="rounded-xl">
                <Plus className="h-4 w-4 mr-1" />
                Klausur anlegen
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(k => {
              const isExpanded = expandedId === k.id;
              return (
                <Card key={k.id} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : k.id)}
                    className="w-full text-left p-3.5 flex items-start gap-3"
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      k.area === "zr" ? "bg-blue-100" : k.area === "oeffr" ? "bg-amber-100" : "bg-rose-100"
                    )}>
                      <Scale className={cn(
                        "h-4 w-4",
                        k.area === "zr" ? "text-blue-600" : k.area === "oeffr" ? "text-amber-600" : "text-rose-600"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-800 truncate">{k.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={cn("text-[10px]", AREA_BADGE_COLORS[k.area])}>
                          {AREA_LABELS[k.area]}
                        </Badge>
                        <Badge className={cn("text-[10px]", DIFFICULTY_COLORS[k.difficulty])}>
                          {DIFFICULTY_LABELS[k.difficulty]}
                        </Badge>
                        {k.source && (
                          <span className="text-[10px] text-slate-400">{k.source}</span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto">{k.topicIds.length} Themen</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 mt-1" /> : <ChevronRight className="h-4 w-4 text-slate-400 mt-1" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-3.5 space-y-3 bg-slate-50/50">
                      {/* Topics */}
                      {k.topicIds.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                            <Tag className="h-3 w-3" /> Themen
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {k.topicIds.map(tid => (
                              <Badge key={tid} variant="outline" className="text-[10px] bg-white">
                                {getTopicLabel(tid)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sachverhalt */}
                      {k.sachverhalt && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> Sachverhalt
                          </div>
                          <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-6">{k.sachverhalt}</p>
                        </div>
                      )}

                      {/* Lösung */}
                      {k.solution && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Lösungsskizze
                          </div>
                          <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-6">{k.solution}</p>
                        </div>
                      )}

                      {/* Duration */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {k.durationMinutes} min ({Math.round(k.durationMinutes / 60)}h)
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(k)} className="text-xs rounded-lg">
                          <Edit3 className="h-3 w-3 mr-1" /> Bearbeiten
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(k.id)} className="text-xs rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-3 w-3 mr-1" /> Löschen
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg mx-auto max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editingId ? "Klausur bearbeiten" : "Neue Klausur"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Titel *</label>
              <Input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="z.B. ZR-Klausur Kaufrecht mit Mängel"
                className="rounded-xl text-sm"
              />
            </div>

            {/* Area + Difficulty Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Rechtsgebiet</label>
                <select
                  value={form.area}
                  onChange={e => setForm(prev => ({ ...prev, area: e.target.value as Area, topicIds: [] }))}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="zr">Zivilrecht</option>
                  <option value="oeffr">Öffentliches Recht</option>
                  <option value="sr">Strafrecht</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Schwierigkeit</label>
                <select
                  value={form.difficulty}
                  onChange={e => setForm(prev => ({ ...prev, difficulty: e.target.value as KlausurDifficulty }))}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="leicht">Leicht</option>
                  <option value="mittel">Mittel</option>
                  <option value="schwer">Schwer</option>
                </select>
              </div>
            </div>

            {/* Source + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Quelle</label>
                <Input
                  value={form.source}
                  onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))}
                  placeholder="z.B. Kaiser 2024"
                  className="rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Dauer (min)</label>
                <Input
                  type="number"
                  value={form.durationMinutes}
                  onChange={e => setForm(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) || 300 }))}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Topic Picker */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Themen taggen ({form.topicIds.length} ausgewählt)
              </label>
              <TopicPicker
                selectedIds={form.topicIds}
                onToggle={toggleTopic}
                areaFilter={form.area}
              />
            </div>

            {/* Sachverhalt */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Sachverhalt</label>
              <Textarea
                value={form.sachverhalt}
                onChange={e => setForm(prev => ({ ...prev, sachverhalt: e.target.value }))}
                placeholder="Aufgabenstellung / Sachverhalt..."
                rows={4}
                className="resize-none rounded-xl text-sm"
              />
            </div>

            {/* Lösung */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Lösungsskizze</label>
              <Textarea
                value={form.solution}
                onChange={e => setForm(prev => ({ ...prev, solution: e.target.value }))}
                placeholder="Lösungsansatz / Gliederung..."
                rows={4}
                className="resize-none rounded-xl text-sm"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={!form.title.trim()}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl h-10"
            >
              {editingId ? "Speichern" : "Klausur anlegen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
