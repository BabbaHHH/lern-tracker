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
  Upload, AlertTriangle, Gavel, Zap,
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
  materialSchwerpunkt: string;
  prozessualSchwerpunkt: string;
  klassischeProbleme: string[];
  anspruchsgrundlagen: string[];
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
  materialSchwerpunkt: "",
  prozessualSchwerpunkt: "",
  klassischeProbleme: [],
  anspruchsgrundlagen: [],
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
                          ? "bg-indigo-100 text-indigo-800"
                          : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                        selectedIds.includes(t.id)
                          ? "bg-indigo-500 border-indigo-500"
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
        <p className="text-[11px] text-indigo-600 font-medium">{selectedIds.length} Themen ausgewählt</p>
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
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importResult, setImportResult] = useState<{ ok: number; skipped: number; errors: string[] } | null>(null);

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
      materialSchwerpunkt: k.materialSchwerpunkt || "",
      prozessualSchwerpunkt: k.prozessualSchwerpunkt || "",
      klassischeProbleme: k.klassischeProbleme ? [...k.klassischeProbleme] : [],
      anspruchsgrundlagen: k.anspruchsgrundlagen ? [...k.anspruchsgrundlagen] : [],
    });
    setEditingId(k.id);
    setDialogOpen(true);
  };

  const handleImport = () => {
    setImportResult(null);
    let parsed: unknown;
    try {
      const cleaned = importJson.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(cleaned);
    } catch (e) {
      setImportResult({ ok: 0, skipped: 0, errors: [`Ungültiges JSON: ${(e as Error).message}`] });
      return;
    }
    if (!Array.isArray(parsed)) {
      setImportResult({ ok: 0, skipped: 0, errors: ["JSON muss ein Array sein"] });
      return;
    }

    const validTopicIds = new Set(getLeafTopics(TOPICS).map(t => t.id));
    let ok = 0;
    let skipped = 0;
    const errors: string[] = [];

    parsed.forEach((raw, idx) => {
      const r = raw as Record<string, unknown>;
      if (!r.title || typeof r.title !== "string") {
        errors.push(`#${idx}: title fehlt`);
        skipped++;
        return;
      }
      if (!["zr", "oeffr", "sr"].includes(r.area as string)) {
        errors.push(`#${idx} (${r.title}): area ungültig`);
        skipped++;
        return;
      }
      const topicIds = Array.isArray(r.topicIds)
        ? (r.topicIds as string[]).filter(id => validTopicIds.has(id))
        : [];
      const difficulty: KlausurDifficulty = ["leicht", "mittel", "schwer"].includes(r.difficulty as string)
        ? (r.difficulty as KlausurDifficulty)
        : "mittel";

      addKlausur({
        title: String(r.title).slice(0, 200),
        area: r.area as Area,
        topicIds,
        difficulty,
        source: typeof r.source === "string" ? r.source : "",
        sachverhalt: typeof r.sachverhalt === "string" ? r.sachverhalt : "",
        solution: typeof r.solution === "string" ? r.solution : "",
        durationMinutes: typeof r.durationMinutes === "number" ? r.durationMinutes : 300,
        materialSchwerpunkt: typeof r.materialSchwerpunkt === "string" ? r.materialSchwerpunkt : undefined,
        prozessualSchwerpunkt: typeof r.prozessualSchwerpunkt === "string" ? r.prozessualSchwerpunkt : undefined,
        klassischeProbleme: Array.isArray(r.klassischeProbleme) ? (r.klassischeProbleme as string[]) : undefined,
        anspruchsgrundlagen: Array.isArray(r.anspruchsgrundlagen) ? (r.anspruchsgrundlagen as string[]) : undefined,
        solutionMatched: typeof r.solutionMatched === "boolean" ? r.solutionMatched : undefined,
      });
      ok++;
    });

    setKlausuren(getKlausuren());
    setImportResult({ ok, skipped, errors });
    if (ok > 0 && skipped === 0) {
      setTimeout(() => {
        setImportOpen(false);
        setImportJson("");
        setImportResult(null);
      }, 2000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportJson(text);
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
      <main className="flex-1 pb-24 pt-4 md:pt-20 px-4 max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/60 hover:bg-white border border-slate-200/60 text-slate-600">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Klausur-Datenbank</h1>
            <p className="text-xs text-slate-500 mt-0.5">{klausuren.length} Klausuren gespeichert</p>
          </div>
          <Button
            onClick={() => { setImportOpen(true); setImportResult(null); }}
            size="sm"
            variant="outline"
            className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 bg-white/60 backdrop-blur-sm"
          >
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <Button onClick={openNew} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md shadow-slate-900/10">
            <Plus className="h-4 w-4 mr-1" />
            Neu
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm rounded-xl bg-slate-50 hover:bg-white border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          {(["all", "zr", "oeffr", "sr"] as const).map(area => (
            <button
              key={area}
              onClick={() => setFilter(area)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all",
                filter === area
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                  : "bg-white/70 text-slate-600 hover:bg-white border border-slate-200/60"
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
                <Card key={k.id} className="overflow-hidden rounded-2xl border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgb(0,0,0,0.06)] transition-all">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : k.id)}
                    className="w-full text-left p-3.5 flex items-start gap-3"
                  >
                    <div className={cn(
                      "p-2.5 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset",
                      k.area === "zr" ? "bg-blue-50 ring-blue-200/60" : k.area === "oeffr" ? "bg-amber-50 ring-amber-200/60" : "bg-rose-50 ring-rose-200/60"
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
                      {/* Schwerpunkte */}
                      {(k.materialSchwerpunkt || k.prozessualSchwerpunkt) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {k.materialSchwerpunkt && (
                            <div className="bg-blue-50 rounded-xl p-2.5">
                              <div className="text-[10px] font-semibold text-blue-700 mb-0.5 flex items-center gap-1">
                                <BookOpen className="h-3 w-3" /> Materiell
                              </div>
                              <p className="text-xs text-slate-700">{k.materialSchwerpunkt}</p>
                            </div>
                          )}
                          {k.prozessualSchwerpunkt && (
                            <div className="bg-purple-50 rounded-xl p-2.5">
                              <div className="text-[10px] font-semibold text-purple-700 mb-0.5 flex items-center gap-1">
                                <Gavel className="h-3 w-3" /> Prozessual
                              </div>
                              <p className="text-xs text-slate-700">{k.prozessualSchwerpunkt}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Anspruchsgrundlagen */}
                      {k.anspruchsgrundlagen && k.anspruchsgrundlagen.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Anspruchsgrundlagen
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {k.anspruchsgrundlagen.map((ag, i) => (
                              <Badge key={i} className="text-[10px] bg-amber-100 text-amber-800 font-mono">
                                {ag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Klassische Probleme */}
                      {k.klassischeProbleme && k.klassischeProbleme.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Klassische Probleme
                          </div>
                          <ul className="space-y-0.5">
                            {k.klassischeProbleme.map((p, i) => (
                              <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

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
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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

            {/* Materieller / Prozessualer Schwerpunkt */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Materieller Schwerpunkt</label>
                <Input
                  value={form.materialSchwerpunkt}
                  onChange={e => setForm(prev => ({ ...prev, materialSchwerpunkt: e.target.value }))}
                  placeholder="z.B. Kaufrecht mit Sachmangel und Rücktritt"
                  className="rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Prozessualer Schwerpunkt</label>
                <Input
                  value={form.prozessualSchwerpunkt}
                  onChange={e => setForm(prev => ({ ...prev, prozessualSchwerpunkt: e.target.value }))}
                  placeholder="z.B. Zahlungsklage, Urteil verfassen"
                  className="rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Anspruchsgrundlagen (Komma-getrennt)
                </label>
                <Input
                  value={form.anspruchsgrundlagen.join(", ")}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    anspruchsgrundlagen: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                  }))}
                  placeholder="§ 433 II BGB, § 280 I BGB"
                  className="rounded-xl text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Klassische Probleme (Komma-getrennt)
                </label>
                <Input
                  value={form.klassischeProbleme.join(", ")}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    klassischeProbleme: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                  }))}
                  placeholder="Abgrenzung Sach-/Rechtsmangel, Nacherfüllung"
                  className="rounded-xl text-sm"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={!form.title.trim()}
              className="w-full bg-gradient-to-r from-slate-900 to-indigo-600 rounded-xl h-10"
            >
              {editingId ? "Speichern" : "Klausur anlegen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg mx-auto max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Klausuren importieren (JSON)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-500">
              JSON-Array aus NotebookLM. Datei hochladen oder direkt einfügen.
            </p>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">JSON-Datei</label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Oder JSON einfügen</label>
              <Textarea
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                placeholder='[{"title": "...", "area": "zr", ...}]'
                rows={8}
                className="resize-none rounded-xl text-xs font-mono"
              />
            </div>
            {importResult && (
              <div className={cn(
                "rounded-xl p-3 text-xs",
                importResult.errors.length === 0 ? "bg-indigo-50 text-indigo-800" : "bg-amber-50 text-amber-800"
              )}>
                <div className="font-semibold mb-1">
                  {importResult.ok} importiert, {importResult.skipped} übersprungen
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="space-y-0.5 text-[11px] max-h-24 overflow-y-auto">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <Button
              onClick={handleImport}
              disabled={!importJson.trim()}
              className="w-full bg-gradient-to-r from-slate-900 to-indigo-600 rounded-xl h-10"
            >
              <Upload className="h-4 w-4 mr-1" /> Importieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
