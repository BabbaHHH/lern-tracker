"use client";

import { useState, useEffect, useMemo } from "react";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  getKlausuren, addKlausur, updateKlausur, removeKlausur,
  importKlausuren, migrateKlausurTypes,
  getKlausurenWritten,
  previewKlausurProgressBoosts, markKlausurWritten,
} from "@/lib/store";
import { Klausur, KlausurType, Area, AREA_LABELS, Topic } from "@/lib/types";
import { useAi } from "@/lib/use-ai";
import {
  Plus, FileText, ArrowLeft, Trash2, Edit3, Search,
  Scale, Tag, ChevronDown, ChevronRight, Check,
  Upload, AlertTriangle, X, Sparkles, Loader2,
  CheckCircle2, Star, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

const AREA_BADGE_COLORS: Record<Area, string> = {
  zr: "bg-blue-100 text-blue-700",
  oeffr: "bg-amber-100 text-amber-700",
  sr: "bg-rose-100 text-rose-700",
};

const KLAUSUR_TYPES_BY_AREA: Record<Area, KlausurType[]> = {
  zr: ["Urteil", "Beschluss", "Anwaltsklausur", "Kautelarklausur"],
  oeffr: ["Urteil", "Beschluss", "Anwaltsklausur", "Behördenklausur", "Aktenvortrag"],
  sr: ["Anklageklausur", "Revisionsklausur", "Plädoyer", "Haftklausur", "Einspruch Strafbefehl", "Abschlussverfügung"],
};

interface KlausurForm {
  id: string;
  source: string;
  date: string;
  title: string;
  area: Area;
  type: KlausurType | "";
  topicIds: string[];
}

const emptyForm: KlausurForm = {
  id: "",
  source: "",
  date: "",
  title: "",
  area: "zr",
  type: "",
  topicIds: [],
};

// ── Taxonomy Tree Filter ──────────────────────────────────────────────────────

function collectLeafIds(node: Topic): string[] {
  if (!node.children || node.children.length === 0) return [node.id];
  return node.children.flatMap(collectLeafIds);
}

interface TaxonomyTreeNodeProps {
  node: Topic;
  selectedIds: Set<string>;
  klausurCountByTopic: Map<string, number>;
  onToggleLeaf: (id: string) => void;
  onToggleGroup: (leafIds: string[], allSelected: boolean) => void;
  depth?: number;
}

function TaxonomyTreeNode({
  node, selectedIds, klausurCountByTopic, onToggleLeaf, onToggleGroup, depth = 0,
}: TaxonomyTreeNodeProps) {
  const [open, setOpen] = useState(false);
  const isLeaf = !node.children || node.children.length === 0;
  const leafIds = useMemo(() => collectLeafIds(node), [node]);
  const selectedCount = leafIds.filter(id => selectedIds.has(id)).length;
  const allSelected = selectedCount === leafIds.length && leafIds.length > 0;
  const partial = selectedCount > 0 && !allSelected;
  const klausurCount = useMemo(
    () => leafIds.reduce((s, id) => s + (klausurCountByTopic.get(id) ?? 0), 0),
    [leafIds, klausurCountByTopic],
  );

  const indent = { paddingLeft: `${depth * 14}px` };

  if (isLeaf) {
    const isSelected = selectedIds.has(node.id);
    const count = klausurCountByTopic.get(node.id) ?? 0;
    return (
      <button
        type="button"
        style={indent}
        onClick={() => onToggleLeaf(node.id)}
        className={cn(
          "flex items-center gap-2 w-full text-left py-1 px-2 rounded-md text-xs transition-colors",
          isSelected ? "bg-accent-50 text-accent-800" : "text-slate-600 hover:bg-slate-50",
        )}
      >
        <div className={cn(
          "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
          isSelected ? "bg-accent-500 border-accent-500" : "border-slate-300",
        )}>
          {isSelected && <Check className="h-2 w-2 text-white" />}
        </div>
        <span className="flex-1 leading-snug">{node.label}</span>
        {count > 0 && <span className="text-[9px] text-slate-400 shrink-0">{count}</span>}
      </button>
    );
  }

  return (
    <div>
      <div style={indent} className="flex items-center gap-1.5 py-1 px-2">
        {/* Group checkbox — selects/deselects all leaf descendants */}
        <button
          type="button"
          onClick={() => onToggleGroup(leafIds, allSelected)}
          className={cn(
            "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
            allSelected ? "bg-accent-500 border-accent-500" :
            partial ? "bg-accent-100 border-accent-400" :
            "border-slate-300 hover:border-slate-400",
          )}
        >
          {allSelected && <Check className="h-2 w-2 text-white" />}
          {partial && <div className="w-2 h-0.5 rounded bg-accent-600" />}
        </button>
        {/* Expand/collapse row */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 flex-1 text-left min-w-0"
        >
          {open
            ? <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
            : <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />}
          <span className={cn(
            "text-xs font-medium flex-1 truncate",
            partial || allSelected ? "text-accent-700" : "text-slate-700",
          )}>
            {node.label}
          </span>
          <span className="text-[9px] text-slate-400 ml-1 shrink-0">
            {selectedCount > 0 ? `${selectedCount}/` : ""}{leafIds.length}
            {klausurCount > 0 && <span className="ml-1 text-slate-300">· {klausurCount}</span>}
          </span>
        </button>
      </div>
      {open && node.children && (
        <div>
          {node.children.map(child => (
            <TaxonomyTreeNode
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              klausurCountByTopic={klausurCountByTopic}
              onToggleLeaf={onToggleLeaf}
              onToggleGroup={onToggleGroup}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TaxonomyFilterProps {
  selectedIds: Set<string>;
  areaFilter: Area | "all";
  klausurCountByTopic: Map<string, number>;
  onToggleLeaf: (id: string) => void;
  onToggleGroup: (leafIds: string[], allSelected: boolean) => void;
  onClear: () => void;
}

function TaxonomyFilter({
  selectedIds, areaFilter, klausurCountByTopic, onToggleLeaf, onToggleGroup, onClear,
}: TaxonomyFilterProps) {
  const roots = useMemo(() => {
    const tree = buildTopicTree(TOPICS);
    return areaFilter === "all" ? tree : tree.filter(r => r.id === areaFilter);
  }, [areaFilter]);

  return (
    <div className="rounded-xl border border-accent-200/70 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-accent-50/40">
        <span className="text-[11px] font-semibold text-accent-700 flex items-center gap-1.5">
          <Tag className="h-3 w-3" />
          Themen-Filter
        </span>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-accent-600 hover:text-accent-900 font-medium flex items-center gap-0.5"
          >
            <X className="h-3 w-3" /> alle löschen
          </button>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
        {roots.map(root => (
          <div key={root.id}>
            {areaFilter === "all" && (
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 pt-2 pb-0.5">
                {root.label}
              </div>
            )}
            {(root.children ?? []).map(node => (
              <TaxonomyTreeNode
                key={node.id}
                node={node}
                selectedIds={selectedIds}
                klausurCountByTopic={klausurCountByTopic}
                onToggleLeaf={onToggleLeaf}
                onToggleGroup={onToggleGroup}
                depth={0}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
                          ? "bg-accent-100 text-accent-800"
                          : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                        selectedIds.includes(t.id)
                          ? "bg-accent-500 border-accent-500"
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
        <p className="text-[11px] text-accent-600 font-medium">{selectedIds.length} Themen ausgewählt</p>
      )}
    </div>
  );
}

async function openPdf(source: string) {
  const filename = source.replace(".pdf", "_komplett.pdf");
  try {
    await fetch("/api/pdf-open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
  } catch (e) {
    console.error("PDF öffnen fehlgeschlagen:", e);
  }
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
  const [importResult, setImportResult] = useState<{ ok: number; added?: number; updated?: number; skipped: number; invalidIdCount: number; errors: string[] } | null>(null);

  const validTopicIdSet = useMemo(() => new Set(getLeafTopics(TOPICS).map(t => t.id)), []);

  // Extra Filters
  const [filterType, setFilterType] = useState<KlausurType | "">("");
  const [filterWritten, setFilterWritten] = useState<"all" | "written" | "unwritten">("all");
  const [filterMinRating, setFilterMinRating] = useState<number>(0);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTopicIds, setFilterTopicIds] = useState<Set<string>>(new Set());
  const [topicFilterOpen, setTopicFilterOpen] = useState(false);

  // Klausur-count per topicId — zeigt im Tree wie viele Klausuren dieses Thema haben
  const klausurCountByTopic = useMemo(() => {
    const map = new Map<string, number>();
    for (const k of klausuren) {
      for (const tid of k.topicIds) {
        map.set(tid, (map.get(tid) ?? 0) + 1);
      }
    }
    return map;
  }, [klausuren]);

  const toggleLeafFilter = (id: string) => {
    setFilterTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroupFilter = (leafIds: string[], allSelected: boolean) => {
    setFilterTopicIds(prev => {
      const next = new Set(prev);
      if (allSelected) leafIds.forEach(id => next.delete(id));
      else leafIds.forEach(id => next.add(id));
      return next;
    });
  };

  const availableTypes = useMemo((): KlausurType[] => {
    if (filter === "all") {
      const all = new Set<KlausurType>();
      Object.values(KLAUSUR_TYPES_BY_AREA).forEach(arr => arr.forEach(t => all.add(t)));
      return [...all];
    }
    return KLAUSUR_TYPES_BY_AREA[filter];
  }, [filter]);

  const hasExtraFilters = filterType !== "" || filterDateFrom !== "" || filterDateTo !== "" || filterWritten !== "all" || filterMinRating > 0 || filterTopicIds.size > 0;

  const clearAllExtraFilters = () => {
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterWritten("all");
    setFilterMinRating(0);
    setFilterTopicIds(new Set());
  };

  // KI-Suche: Freitext → matchende topicIds + Klausurtypen
  const [aiMatches, setAiMatches] = useState<{ topicIds: string[]; types: KlausurType[] } | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false); // wurde KI automatisch gestartet?
  const { callJson: aiSearchCall, loading: aiSearching, error: aiCallError, reset: resetAiCall } = useAi(null);
  const [aiLocalError, setAiLocalError] = useState<string | null>(null);
  const aiError = aiLocalError || aiCallError;

  // Map: klausurId → letzter Tracking-Eintrag (Datum + Rating) für ✓-Indikator
  const [writtenMap, setWrittenMap] = useState<Map<string, { date: string; rating?: number; count: number }>>(new Map());

  // Eintragen-Dialog State
  const [doneDialogKlausur, setDoneDialogKlausur] = useState<Klausur | null>(null);
  const [doneRating, setDoneRating] = useState(3);
  const [doneNote, setDoneNote] = useState("");
  const [doneDate, setDoneDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [doneSelectedTopicIds, setDoneSelectedTopicIds] = useState<Set<string>>(new Set());
  const [doneSaved, setDoneSaved] = useState(false);

  const refreshWrittenMap = () => {
    const entries = getKlausurenWritten();
    const map = new Map<string, { date: string; rating?: number; count: number }>();
    for (const e of entries) {
      if (!e.klausurId) continue;
      const prev = map.get(e.klausurId);
      if (!prev || e.date > prev.date) {
        map.set(e.klausurId, { date: e.date, rating: e.rating, count: (prev?.count ?? 0) + 1 });
      } else {
        map.set(e.klausurId, { ...prev, count: prev.count + 1 });
      }
    }
    setWrittenMap(map);
  };

  useEffect(() => {
    // Einmalige Migration: KI-Präfix-Typen ("ZR-Urteil" → "Urteil") normalisieren
    migrateKlausurTypes();
    setKlausuren(getKlausuren());
    refreshWrittenMap();
  }, []);

  // Reset type filter when area changes if the selected type isn't valid for the new area
  useEffect(() => {
    if (filterType && filter !== "all" && !KLAUSUR_TYPES_BY_AREA[filter].includes(filterType)) {
      setFilterType("");
    }
  }, [filter, filterType]);

  const openDoneDialog = (k: Klausur) => {
    setDoneDialogKlausur(k);
    setDoneRating(3);
    setDoneNote("");
    setDoneDate(format(new Date(), "yyyy-MM-dd"));
    // Nur gültige topicIds vorauswählen (ungültige IDs raus)
    setDoneSelectedTopicIds(new Set(k.topicIds.filter(t => validTopicIdSet.has(t))));
    setDoneSaved(false);
  };

  const closeDoneDialog = () => {
    setDoneDialogKlausur(null);
  };

  const toggleDoneTopic = (tid: string) => {
    setDoneSelectedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid); else next.add(tid);
      return next;
    });
  };

  const handleConfirmDone = () => {
    if (!doneDialogKlausur) return;
    markKlausurWritten(doneDialogKlausur, {
      rating: doneRating,
      note: doneNote,
      date: doneDate,
      topicIds: Array.from(doneSelectedTopicIds),
      validLeafIds: validTopicIdSet,
    });
    refreshWrittenMap();
    setDoneSaved(true);
    setTimeout(() => closeDoneDialog(), 1200);
  };

  // Vorschau der Boost-Werte (live, basierend auf Auswahl + Rating)
  const donePreview = useMemo(() => {
    if (!doneDialogKlausur) return [];
    return previewKlausurProgressBoosts(Array.from(doneSelectedTopicIds), doneRating);
  }, [doneDialogKlausur, doneSelectedTopicIds, doneRating]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const aiTopicSet = aiMatches ? new Set(aiMatches.topicIds) : null;
    const aiTypeSet = aiMatches ? new Set(aiMatches.types) : null;
    return klausuren.filter(k => {
      // Area filter
      if (filter !== "all" && k.area !== filter) return false;
      // Klausurtyp filter
      if (filterType && k.type !== filterType) return false;
      // Date range filter
      if (filterDateFrom && k.date < filterDateFrom) return false;
      if (filterDateTo && k.date > filterDateTo) return false;
      // Written status filter
      if (filterWritten === "written" && !writtenMap.has(k.id)) return false;
      if (filterWritten === "unwritten" && writtenMap.has(k.id)) return false;
      // Rating filter (only meaningful when showing written)
      if (filterMinRating > 0 && filterWritten === "written") {
        const w = writtenMap.get(k.id);
        if (!w || (w.rating ?? 0) < filterMinRating) return false;
      }
      // Taxonomy tree filter
      if (filterTopicIds.size > 0 && !k.topicIds.some(tid => filterTopicIds.has(tid))) return false;
      // KI / text search filter
      if (aiMatches) {
        const topicHit = aiTopicSet && k.topicIds.some(t => aiTopicSet.has(t));
        const typeHit = aiTypeSet && k.type && aiTypeSet.has(k.type);
        if (!topicHit && !typeHit) return false;
      } else if (q) {
        if (!k.title.toLowerCase().includes(q) &&
            !k.source.toLowerCase().includes(q) &&
            !k.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [klausuren, filter, filterType, filterDateFrom, filterDateTo, filterWritten, filterMinRating, filterTopicIds, search, aiMatches, writtenMap]);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (k: Klausur) => {
    setForm({
      id: k.id,
      source: k.source,
      date: k.date,
      title: k.title,
      area: k.area,
      type: k.type ?? "",
      topicIds: [...k.topicIds],
    });
    setEditingId(k.id);
    setDialogOpen(true);
  };

  const handleImport = () => {
    setImportResult(null);

    // Code-Fences entfernen (ggf. mehrfach, falls KI jeden Block einzeln gefenct hat)
    const cleaned = importJson.replace(/```(?:json)?/gi, "").trim();

    // Toleranter Scanner: findet alle top-level JSON-Objekte via Klammer-Balance,
    // String-Literale werden korrekt übersprungen.
    const items: unknown[] = [];
    const parseErrors: string[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (escape) { escape = false; continue; }
      if (c === "\\" && inString) { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;

      if (c === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0 && start >= 0) {
          const chunk = cleaned.slice(start, i + 1);
          try {
            items.push(JSON.parse(chunk));
          } catch (e) {
            parseErrors.push(`Parse-Fehler: ${(e as Error).message.slice(0, 80)}`);
          }
          start = -1;
        }
      }
    }

    if (items.length === 0) {
      setImportResult({
        ok: 0,
        skipped: 0,
        invalidIdCount: 0,
        errors: parseErrors.length ? parseErrors : ["Kein gültiges JSON-Objekt gefunden"],
      });
      return;
    }

    const validTopicIds = validTopicIdSet;
    let skipped = 0;
    let invalidIdCount = 0;
    const errors: string[] = [...parseErrors];
    const validItems: Array<Parameters<typeof importKlausuren>[0][number]> = [];

    items.forEach((raw, idx) => {
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
      if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
        errors.push(`#${idx} (${r.title}): date fehlt oder nicht YYYY-MM-DD`);
        skipped++;
        return;
      }
      const rawTopicIds = Array.isArray(r.topicIds)
        ? (r.topicIds as unknown[]).filter((v): v is string => typeof v === "string")
        : [];
      const invalidHere = rawTopicIds.filter(id => !validTopicIds.has(id));
      if (invalidHere.length > 0) {
        invalidIdCount += invalidHere.length;
        errors.push(`#${idx} (${r.title}): ${invalidHere.length} ungültige topicId(s) beibehalten — manuell korrigieren: ${invalidHere.slice(0, 3).join(", ")}${invalidHere.length > 3 ? "…" : ""}`);
      }

      validItems.push({
        id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : undefined,
        source: typeof r.source === "string" ? r.source : "",
        date: r.date as string,
        title: String(r.title).slice(0, 200),
        area: r.area as Area,
        type: typeof r.type === "string" ? r.type as KlausurType : undefined,
        topicIds: rawTopicIds,
      });
    });

    const { added, updated } = importKlausuren(validItems);
    const ok = added + updated;

    setKlausuren(getKlausuren());
    setImportResult({ ok, added, updated, skipped, invalidIdCount, errors });
    if (ok > 0 && skipped === 0 && invalidIdCount === 0) {
      setTimeout(() => {
        setImportOpen(false);
        setImportJson("");
        setImportResult(null);
      }, 2000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    // Alle Dateien einlesen und mit Trennzeilen zusammenfügen —
    // der tolerante Scanner in handleImport verkraftet auch mehrere Objekte/Arrays in einem Blob.
    const texts = await Promise.all(
      files.map(async f => `// ── ${f.name} ──\n${await f.text()}`)
    );
    setImportJson(texts.join("\n\n"));
    // Input-Wert zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
    e.target.value = "";
  };

  const handleAiSearch = async (queryOverride?: string) => {
    const query = (queryOverride ?? search).trim();
    if (!query) return;
    setAiLocalError(null);
    resetAiCall();

    const leaves = getLeafTopics(TOPICS);
    const taxonomy = leaves.map(t => `${t.id} — ${t.label}`).join("\n");
    const allTypes: KlausurType[] = [
      "Urteil", "Beschluss", "Anwaltsklausur", "Kautelarklausur",
      "Behördenklausur", "Anklageklausur", "Revisionsklausur", "Plädoyer",
      "Haftklausur", "Einspruch Strafbefehl", "Abschlussverfügung",
    ];
    const system = `Du bist ein juristischer Such-Assistent für die Examensvorbereitung (2. Staatsexamen).
Nutzer gibt einen Freitext ein. Finde aus der Taxonomie die inhaltlich passenden Leaf-IDs (nicht nur Stichwortmatch – semantisch!)
und optional passende Klausurtypen.

Taxonomie (ID — Label):
${taxonomy}

Verfügbare Klausurtypen: ${allTypes.join(", ")}

Antworte AUSSCHLIESSLICH als reines JSON ohne Kommentar, ohne Markdown-Fences:
{"topicIds": ["...", "..."], "types": ["..."]}

Regeln:
- Nur IDs verwenden die exakt in der Taxonomie stehen.
- "types" nur wenn der Freitext einen Klausurtyp nennt/impliziert (z.B. "Anwaltsklausur", "Revision", "Plädoyer").
- Max. 15 topicIds, priorisiere die präzisesten.
- Bei unklarer Anfrage: eher weniger IDs, dafür passender.`;

    const parsed = await aiSearchCall<{ topicIds?: unknown; types?: unknown }>({
      tier: "cheap",
      customMessages: [
        { role: "system", content: system },
        { role: "user", content: query },
      ],
    });
    if (!parsed) return;

    const topicIds = Array.isArray(parsed.topicIds)
      ? (parsed.topicIds as unknown[]).filter((v): v is string => typeof v === "string" && validTopicIdSet.has(v))
      : [];
    const types = Array.isArray(parsed.types)
      ? (parsed.types as unknown[]).filter((v): v is KlausurType => typeof v === "string" && (allTypes as string[]).includes(v))
      : [];
    if (topicIds.length === 0 && types.length === 0) {
      setAiLocalError("Keine passenden Themen/Typen gefunden");
      setAiMatches(null);
    } else {
      setAiMatches({ topicIds, types });
    }
  };

  const clearAiSearch = () => {
    setAiMatches(null);
    setAiLocalError(null);
    setAutoTriggered(false);
    resetAiCall();
  };

  // Auto-Trigger: wenn harte Suche nichts findet, KI nach Debounce automatisch starten
  useEffect(() => {
    if (aiMatches || aiSearching || autoTriggered) return;
    const q = search.trim();
    if (q.length < 3) return;
    // Nur triggern wenn die harte Suche tatsächlich leer ist
    const hardHits = klausuren.filter(k => {
      if (filter !== "all" && k.area !== filter) return false;
      const lq = q.toLowerCase();
      return k.title.toLowerCase().includes(lq)
          || k.source.toLowerCase().includes(lq)
          || k.id.toLowerCase().includes(lq);
    });
    if (hardHits.length > 0) return;
    const timer = setTimeout(() => {
      setAutoTriggered(true);
      handleAiSearch(q);
    }, 600); // genug Zeit zum Weitertippen
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, klausuren, filter, aiMatches, aiSearching, autoTriggered]);

  const handleSave = () => {
    if (!form.title.trim()) return;

    // "" → undefined für optionales KlausurType-Feld
    const payload = { ...form, type: form.type === "" ? undefined : form.type };

    if (editingId) {
      const updated = updateKlausur(editingId, payload);
      setKlausuren(updated);
    } else {
      const updated = addKlausur(payload);
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
            <p className="text-xs text-slate-500 mt-0.5">
              {filtered.length < klausuren.length
                ? <><span className="font-semibold text-slate-700">{filtered.length}</span> von {klausuren.length} Klausuren</>
                : <>{klausuren.length} Klausuren gespeichert</>}
            </p>
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
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Suchen (Titel, ID, Quelle) — oder Freitext + 🪄"
              value={search}
              onChange={e => { setSearch(e.target.value); setAutoTriggered(false); if (aiMatches) clearAiSearch(); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); setAutoTriggered(true); handleAiSearch(); } }}
              className="pl-9 pr-10 h-9 text-sm rounded-xl bg-slate-50 hover:bg-white border-slate-200 focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all"
            />
            <button
              type="button"
              onClick={() => { setAutoTriggered(true); handleAiSearch(); }}
              disabled={!search.trim() || aiSearching}
              title="KI-Suche: Freitext auf Taxonomie mappen (Enter)"
              className={cn(
                "absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                aiMatches
                  ? "bg-accent-500 text-white hover:bg-accent-600"
                  : "text-slate-400 hover:text-accent-600 hover:bg-accent-50 disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {aiSearching
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="h-3.5 w-3.5" />}
            </button>
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

        {/* Extra Filter Row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Klausurtyp Dropdown */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as KlausurType | "")}
            className={cn(
              "h-8 pl-3 pr-6 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-accent-500/20 cursor-pointer",
              filterType
                ? "border-accent-300 bg-accent-50 text-accent-700 font-medium"
                : "border-slate-200 bg-white/70 text-slate-500"
            )}
          >
            <option value="">Alle Typen</option>
            {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Datum von/bis */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              title="Datum von"
              className={cn(
                "h-8 px-2 rounded-xl border text-[11px] focus:outline-none focus:ring-2 focus:ring-accent-500/20",
                filterDateFrom
                  ? "border-accent-300 bg-accent-50 text-accent-700"
                  : "border-slate-200 bg-white/70 text-slate-400"
              )}
            />
            <span className="text-xs text-slate-300 select-none">–</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              title="Datum bis"
              className={cn(
                "h-8 px-2 rounded-xl border text-[11px] focus:outline-none focus:ring-2 focus:ring-accent-500/20",
                filterDateTo
                  ? "border-accent-300 bg-accent-50 text-accent-700"
                  : "border-slate-200 bg-white/70 text-slate-400"
              )}
            />
          </div>

          {/* Written status toggle */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white/70 text-xs shrink-0">
            {([
              { v: "all", label: "Alle" },
              { v: "unwritten", label: "Offen" },
              { v: "written", label: "✓ Fertig" },
            ] as const).map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => { setFilterWritten(v); if (v !== "written") setFilterMinRating(0); }}
                className={cn(
                  "px-3 py-1.5 font-medium transition-colors whitespace-nowrap",
                  filterWritten === v
                    ? v === "written"
                      ? "bg-emerald-700 text-white"
                      : "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Rating filter — only when "written" is active */}
          {filterWritten === "written" && (
            <div className="flex items-center gap-0.5 bg-white/70 border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-[10px] text-slate-400 mr-1 select-none">≥</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFilterMinRating(filterMinRating === n ? 0 : n)}
                  className={cn(
                    "h-6 w-6 flex items-center justify-center transition-colors rounded",
                    n <= filterMinRating ? "text-amber-500" : "text-slate-200 hover:text-amber-300"
                  )}
                >
                  <Star className="h-3.5 w-3.5" fill={n <= filterMinRating ? "currentColor" : "none"} />
                </button>
              ))}
              {filterMinRating > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMinRating(0)}
                  className="ml-1 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Themen-Tree-Filter Button */}
          <button
            type="button"
            onClick={() => setTopicFilterOpen(v => !v)}
            className={cn(
              "h-8 px-3 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 shrink-0",
              topicFilterOpen || filterTopicIds.size > 0
                ? "border-accent-300 bg-accent-50 text-accent-700"
                : "border-slate-200 bg-white/70 text-slate-500 hover:bg-white",
            )}
          >
            <Tag className="h-3 w-3" />
            Themen
            {filterTopicIds.size > 0 && (
              <span className="bg-accent-500 text-white rounded-full h-4 min-w-4 px-1 flex items-center justify-center text-[9px] font-bold">
                {filterTopicIds.size}
              </span>
            )}
            <ChevronDown className={cn("h-3 w-3 transition-transform", topicFilterOpen && "rotate-180")} />
          </button>

          {/* Reset all extra filters */}
          {hasExtraFilters && (
            <button
              type="button"
              onClick={clearAllExtraFilters}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors ml-auto"
            >
              <X className="h-3 w-3" />
              Zurücksetzen
            </button>
          )}
        </div>

        {/* Taxonomy Filter Panel */}
        {topicFilterOpen && (
          <div className="mb-3">
            <TaxonomyFilter
              selectedIds={filterTopicIds}
              areaFilter={filter}
              klausurCountByTopic={klausurCountByTopic}
              onToggleLeaf={toggleLeafFilter}
              onToggleGroup={toggleGroupFilter}
              onClear={() => setFilterTopicIds(new Set())}
            />
          </div>
        )}

        {/* KI-Match Chips */}
        {aiMatches && (aiMatches.topicIds.length > 0 || aiMatches.types.length > 0) && (
          <div className="mb-4 rounded-xl border border-accent-200 bg-accent-50/50 p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3 w-3 text-accent-600" />
              <span className="text-[11px] font-semibold text-accent-700">
                KI-Suche aktiv — {aiMatches.topicIds.length} Themen{aiMatches.types.length > 0 ? `, ${aiMatches.types.length} Typen` : ""}
              </span>
              <button
                onClick={clearAiSearch}
                className="ml-auto text-[11px] text-accent-700 hover:text-accent-900 font-medium flex items-center gap-0.5"
              >
                <X className="h-3 w-3" /> Filter löschen
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {aiMatches.types.map(t => (
                <button
                  key={`type-${t}`}
                  onClick={() => setAiMatches(prev => prev ? { ...prev, types: prev.types.filter(x => x !== t) } : prev)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-accent-300 text-[10px] text-accent-800 hover:bg-accent-100"
                >
                  {t}
                  <X className="h-2.5 w-2.5" />
                </button>
              ))}
              {aiMatches.topicIds.map(id => (
                <button
                  key={`topic-${id}`}
                  onClick={() => setAiMatches(prev => prev ? { ...prev, topicIds: prev.topicIds.filter(x => x !== id) } : prev)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-accent-200 text-[10px] text-accent-700 hover:bg-accent-100"
                  title={id}
                >
                  {getTopicLabel(id)}
                  <X className="h-2.5 w-2.5" />
                </button>
              ))}
            </div>
          </div>
        )}
        {aiError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-700 flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            KI-Suche: {aiError}
            <button onClick={() => { setAiLocalError(null); resetAiCall(); }} className="ml-auto hover:text-rose-900">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Klausur List */}
        {filtered.length === 0 ? (
          aiSearching ? (
            // KI sucht — prominenter Loading-State (statt verwirrendem "Keine Treffer")
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-100 to-accent-200/60 mx-auto mb-3 ring-1 ring-accent-200/60">
                <Sparkles className="h-5 w-5 text-accent-700 animate-pulse" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">KI sucht semantisch …</h3>
              <p className="text-sm text-slate-400 mb-4">
                Keine direkten Treffer — die KI schaut sich deinen Freitext genauer an
              </p>
              <div className="inline-flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                kann ein paar Sekunden dauern
              </div>
            </div>
          ) : (
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
          )
        ) : (
          <div className="space-y-2">
            {filtered.map(k => {
              const isExpanded = expandedId === k.id;
              const invalidIds = k.topicIds.filter(id => !validTopicIdSet.has(id));
              const hasInvalidIds = invalidIds.length > 0;
              const written = writtenMap.get(k.id);
              return (
                <Card key={k.id} className={cn(
                  "overflow-hidden rounded-2xl border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgb(0,0,0,0.06)] transition-all",
                  written && "ring-1 ring-emerald-200/60"
                )}>
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
                        {written && (
                          <span
                            title={`Geschrieben am ${written.date}${written.rating ? ` · ${written.rating}/5` : ""}${written.count > 1 ? ` · ${written.count}× insgesamt` : ""}`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-semibold shrink-0"
                          >
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {written.rating ? `${written.rating}/5` : "✓"}
                          </span>
                        )}
                        {hasInvalidIds && (
                          <span
                            title={`${invalidIds.length} ungültige topicId(s): ${invalidIds.join(", ")}`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[9px] font-semibold shrink-0"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {invalidIds.length}
                          </span>
                        )}
                      </div>
                      {/* Permanent sichtbare Mini-Meta: ID + Quelle */}
                      <div className="flex items-center gap-1.5 mb-1 text-[9px] text-slate-400 font-mono leading-tight truncate">
                        <span className="truncate">{k.id}</span>
                        {k.source && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="truncate">{k.source}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={cn("text-[10px]", AREA_BADGE_COLORS[k.area])}>
                          {AREA_LABELS[k.area]}
                        </Badge>
                        {k.type && (
                          <Badge className="text-[10px] bg-slate-100 text-slate-600">{k.type}</Badge>
                        )}
                        {k.date && (
                          <span className="text-[10px] text-slate-400">{k.date}</span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto">{k.topicIds.length} Themen</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 mt-1" /> : <ChevronRight className="h-4 w-4 text-slate-400 mt-1" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-3.5 space-y-3 bg-slate-50/50">
                      {/* Meta */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <div className="text-slate-400 uppercase tracking-wider text-[9px] font-semibold mb-0.5">ID</div>
                          <div className="font-mono text-slate-700">{k.id}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 uppercase tracking-wider text-[9px] font-semibold mb-0.5">Datum</div>
                          <div className="text-slate-700">{k.date}</div>
                        </div>
                      </div>

                      {/* Topics */}
                      {k.topicIds.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                            <Tag className="h-3 w-3" /> Themen ({k.topicIds.length})
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {k.topicIds.map(tid => {
                              const isInvalid = !validTopicIdSet.has(tid);
                              return (
                                <Badge
                                  key={tid}
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    isInvalid
                                      ? "bg-rose-50 border-rose-200 text-rose-700 font-mono"
                                      : "bg-white"
                                  )}
                                  title={isInvalid ? `Ungültig: ${tid}` : undefined}
                                >
                                  {isInvalid && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                                  {isInvalid ? tid : getTopicLabel(tid)}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Quelle */}
                      {k.source && (
                        <div className="text-[11px] text-slate-500">
                          Sachverhalt und Lösung: siehe <span className="font-medium text-slate-700">{k.source}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => openDoneDialog(k)}
                          className={cn(
                            "text-xs rounded-lg",
                            written
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-gradient-to-r from-slate-900 to-accent-600 text-white hover:opacity-90"
                          )}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {written ? "Nochmal eintragen" : "Geschrieben eintragen"}
                        </Button>
                        {k.source && (
                          <Button size="sm" variant="outline" onClick={() => openPdf(k.source!)} className="text-xs rounded-lg">
                            <Eye className="h-3 w-3 mr-1" /> PDF öffnen
                          </Button>
                        )}
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

            {/* ID + Date Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  ID {editingId ? "" : "(optional, z.B. kg-oeffr-16)"}
                </label>
                <Input
                  value={form.id}
                  onChange={e => setForm(prev => ({ ...prev, id: e.target.value }))}
                  placeholder={editingId ? "" : "auto-UUID wenn leer"}
                  disabled={!!editingId}
                  className="rounded-xl text-sm font-mono disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Datum</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Area + Type Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Rechtsgebiet</label>
                <select
                  value={form.area}
                  onChange={e => setForm(prev => ({ ...prev, area: e.target.value as Area, type: "", topicIds: [] }))}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                >
                  <option value="zr">Zivilrecht</option>
                  <option value="oeffr">Öffentliches Recht</option>
                  <option value="sr">Strafrecht</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Klausurtyp</label>
                <select
                  value={form.type}
                  onChange={e => setForm(prev => ({ ...prev, type: e.target.value as KlausurType }))}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                >
                  <option value="">— Typ wählen —</option>
                  {KLAUSUR_TYPES_BY_AREA[form.area].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Quelle (Dateiname)</label>
              <Input
                value={form.source}
                onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))}
                placeholder="z.B. VA 16 RA Olbert - Komplett.pdf"
                className="rounded-xl text-sm"
              />
            </div>

            {/* Invalid Topic IDs (nicht in Taxonomie) */}
            {form.topicIds.some(id => !validTopicIdSet.has(id)) && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 mb-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Ungültige topicIds (nicht in der Taxonomie)
                </div>
                <p className="text-[10px] text-rose-600 mb-2">
                  Diese IDs existieren nicht mehr — entfernen und unten im Picker korrekt neu zuweisen.
                </p>
                <div className="flex flex-wrap gap-1">
                  {form.topicIds.filter(id => !validTopicIdSet.has(id)).map(id => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, topicIds: prev.topicIds.filter(t => t !== id) }))}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-rose-200 text-[10px] font-mono text-rose-700 hover:bg-rose-100 transition-colors"
                      title="Entfernen"
                    >
                      {id}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Topic Picker */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Themen taggen ({form.topicIds.filter(id => validTopicIdSet.has(id)).length} gültig ausgewählt)
              </label>
              <TopicPicker
                selectedIds={form.topicIds}
                onToggle={toggleTopic}
                areaFilter={form.area}
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={!form.title.trim()}
              className="w-full bg-gradient-to-r from-slate-900 to-accent-600 rounded-xl h-10"
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
              Beliebig viele Klausuren als JSON — einzeln, als Array oder mehrere Objekte hintereinander gepastet.
              Code-Fences (```json) werden automatisch entfernt.
            </p>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                JSON-Datei(en) — Mehrfachauswahl möglich
              </label>
              <input
                type="file"
                accept=".json,application/json"
                multiple
                onChange={handleFileUpload}
                className="block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-accent-50 file:text-accent-700 file:font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Oder JSON einfügen</label>
              <Textarea
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                placeholder={`{"id": "kg-oeffr-16", "date": "2012-06-06", "title": "...", "area": "oeffr", ...}\n\n{"id": "kg-zr-03", "date": "2020-05-12", ...}`}
                rows={10}
                className="resize-none rounded-xl text-xs font-mono"
              />
            </div>
            {importResult && (
              <div className={cn(
                "rounded-xl p-3 text-xs",
                importResult.errors.length === 0 ? "bg-accent-50 text-accent-800" : "bg-amber-50 text-amber-800"
              )}>
                <div className="font-semibold mb-1">
                  {importResult.ok} verarbeitet
                  {importResult.added != null && importResult.updated != null && (
                    <span className="font-normal ml-1">({importResult.added} neu, {importResult.updated} aktualisiert)</span>
                  )}
                  {importResult.skipped > 0 && <span className="ml-1">, {importResult.skipped} übersprungen</span>}
                  {importResult.invalidIdCount > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-rose-700">
                      <AlertTriangle className="h-3 w-3" />
                      {importResult.invalidIdCount} ungültige topicId(s) — bitte manuell prüfen
                    </span>
                  )}
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
              className="w-full bg-gradient-to-r from-slate-900 to-accent-600 rounded-xl h-10"
            >
              <Upload className="h-4 w-4 mr-1" /> Importieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* "Geschrieben"-Dialog: Rating + Topic-Auswahl + Boost-Vorschau */}
      <Dialog open={!!doneDialogKlausur} onOpenChange={open => { if (!open) closeDoneDialog(); }}>
        <DialogContent className="max-w-md mx-auto max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Klausur eintragen
            </DialogTitle>
          </DialogHeader>

          {doneSaved ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="font-semibold text-slate-800">Eingetragen!</p>
              <p className="text-xs text-slate-500 mt-1">Fortschritt aktualisiert</p>
            </div>
          ) : doneDialogKlausur && (
            <div className="space-y-4 pt-2">
              {/* Klausur-Header */}
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-sm font-semibold text-slate-800">{doneDialogKlausur.title}</div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge className={cn("text-[10px]", AREA_BADGE_COLORS[doneDialogKlausur.area])}>
                    {AREA_LABELS[doneDialogKlausur.area]}
                  </Badge>
                  {doneDialogKlausur.type && (
                    <Badge className="text-[10px] bg-slate-100 text-slate-600">{doneDialogKlausur.type}</Badge>
                  )}
                </div>
              </div>

              {/* Datum */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Wann geschrieben?</label>
                <Input
                  type="date"
                  value={doneDate}
                  onChange={e => setDoneDate(e.target.value)}
                  className="rounded-xl text-sm"
                />
              </div>

              {/* Rating — wie gut bist du klargekommen */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">
                  Wie gut bist du klargekommen? ({doneRating}/5)
                </label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setDoneRating(n)}
                      className={cn(
                        "flex-1 h-10 rounded-xl flex items-center justify-center transition-all",
                        n <= doneRating ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-300"
                      )}
                    >
                      <Star className="h-5 w-5" fill={n <= doneRating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  1 = gar nicht verstanden · 3 = solide · 5 = locker durchgespielt
                </p>
              </div>

              {/* Topic-Auswahl mit Boost-Vorschau */}
              {doneDialogKlausur.topicIds.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1.5">
                    <Tag className="h-3 w-3" />
                    Themen — welche wurden wirklich behandelt?
                  </label>
                  <p className="text-[10px] text-slate-400 mb-2 leading-snug">
                    Vorausgewählt: alle gültigen Topics dieser Klausur. Topics, die du nicht zentral bearbeitet hast, kannst du abwählen.
                  </p>
                  <div className="space-y-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                    {doneDialogKlausur.topicIds.map(tid => {
                      const isInvalid = !validTopicIdSet.has(tid);
                      const isSelected = doneSelectedTopicIds.has(tid);
                      const preview = donePreview.find(p => p.topicId === tid);
                      return (
                        <label
                          key={tid}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 text-[11px] cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0",
                            isInvalid && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isInvalid}
                            onChange={() => !isInvalid && toggleDoneTopic(tid)}
                            className="rounded"
                          />
                          <span className="flex-1 truncate text-slate-700">
                            {isInvalid && <AlertTriangle className="h-2.5 w-2.5 inline mr-1 text-rose-500" />}
                            {isInvalid ? <span className="font-mono text-rose-600">{tid}</span> : getTopicLabel(tid)}
                          </span>
                          {isSelected && preview && (
                            <span className={cn(
                              "text-[10px] tabular-nums shrink-0 font-mono",
                              preview.delta > 0 ? "text-emerald-600" : "text-slate-400"
                            )}>
                              {preview.before}% → {preview.after}%
                              {preview.delta > 0 && <span className="ml-1 font-semibold">+{preview.delta}</span>}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {doneSelectedTopicIds.size} von {doneDialogKlausur.topicIds.length} ausgewählt · Boost gecapped bei 95%
                  </p>
                </div>
              )}

              {/* Notizen */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notizen (optional)</label>
                <Textarea
                  value={doneNote}
                  onChange={e => setDoneNote(e.target.value)}
                  placeholder="Was lief gut? Was muss ich wiederholen?"
                  rows={3}
                  className="resize-none rounded-xl text-sm"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={closeDoneDialog} className="flex-1 rounded-xl">
                  Abbrechen
                </Button>
                <Button
                  onClick={handleConfirmDone}
                  className="flex-1 bg-gradient-to-r from-slate-900 to-accent-600 rounded-xl"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Eintragen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
