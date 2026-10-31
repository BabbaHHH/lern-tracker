"use client";
import { withAiPreferences } from "@/lib/ai-settings";
import { fetchAi } from "@/lib/ai-settings";
import { PlanningSourcePreview } from "@/components/planning-source-preview";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getOnboarding, saveOnboarding, resetOnboarding,
  setExamDate, setLernstart, STORAGE_KEYS, wipePlanData,
  type OnboardingData, type AgEntry, type LerngruppeEntry, type RepEntry, type SonstigesEntry,
} from "@/lib/store";
import {
  Dialog as ResetDialog,
  DialogContent as ResetDialogContent,
  DialogHeader as ResetDialogHeader,
  DialogTitle as ResetDialogTitle,
} from "@/components/ui/dialog";
import { getPromptById } from "@/lib/prompts";
import { composePlanningPrompt, planningDocumentsContext } from "@/lib/planning-documents";
import { buildContextFor } from "@/lib/prompt-context";
import { parseStructuredPlan, stripJsonBlock, applyStructuredPlan, materializeRecurringTermine, clearRepTasksForRelabel, type StructuredPlan, type ApplyResult } from "@/lib/plan-applier";
import { TOPICS } from "@/lib/topics";
import { Area, AREA_LABELS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { StudyPhaseEditor } from "@/components/study-phase-editor";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, ArrowRight, RotateCcw, Upload, FileText,
  X, GraduationCap, Calendar, BookOpen, Brain, Sparkles, Loader2, Check,
  Eye, EyeOff, Pencil, Save, MessageSquarePlus,
} from "lucide-react";
import { currentDate, localDate } from "@/lib/dates";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import {profileRevisions,type PersonalView,type ProfilePatch,type ProfileRevisions} from '@/lib/learning/personal-contract';
import {profilePatchError,projectProfile} from '@/lib/learning/profile-fields';
import {accountOnboardingData,editedProfilePatch} from './account-onboarding-model';
import {AccountOnboardingStations} from './account-onboarding-stations';

const STEPS = [
  { id: "basics", label: "Grunddaten", icon: GraduationCap },
  { id: "calendar", label: "Termine", icon: Calendar },
  { id: "assessment", label: "Selbsteinschätzung", icon: Brain },
  { id: "documents", label: "Material", icon: BookOpen },
  { id: "generate", label: "Plan erstellen", icon: Sparkles },
];

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

// Zwischenebene-Themen für Selbsteinschätzung: Level-2 Nodes — die direkten
// Kinder von zr/oeffr/sr (also z.B. "Materielles Recht", "Prozessrecht").
function getAssessmentTopics() {
  return TOPICS.filter(
    t => t.parentId !== null && ["zr", "oeffr", "sr"].includes(t.parentId)
  );
}

export interface AccountOnboardingAdapter {view:PersonalView;busy:boolean;save:(patch:ProfilePatch,revisions:ProfileRevisions)=>Promise<PersonalView|null>}
export function OriginalOnboardingView({account}:{account?:AccountOnboardingAdapter}={}) {
  const accountMode=!!account;
  const [profilePatch,setProfilePatch]=useState<ProfilePatch>({});
  const [profileBase,setProfileBase]=useState(()=>account?profileRevisions(account.view):null);
  const [profileMessage,setProfileMessage]=useState('');
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData | null>(()=>account?accountOnboardingData(account.view):null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiStructured, setAiStructured] = useState<StructuredPlan | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [aiApplied, setAiApplied] = useState<ApplyResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedAssessmentGroups, setExpandedAssessmentGroups] = useState<Set<string>>(new Set());
  const [taggingDocIndex, setTaggingDocIndex] = useState<number | null>(null);

  // Refinement-Feedback (nach erster Generierung)
  const [refinementFeedback, setRefinementFeedback] = useState("");

  // Kaiser-Seminar Eingabe-State
  const [kaiserDate, setKaiserDate] = useState("");
  const [kaiserTopic, setKaiserTopic] = useState("Zivilrecht");
  const [kaiserDays, setKaiserDays] = useState(3);

  // Dokument-Datums-Extraktion (Step 2)
  const [dateExtractLoading, setDateExtractLoading] = useState(false);
  const [dateExtractPreview, setDateExtractPreview] = useState<{
    probeexamen?: { startDate: string }[];
    vacationDates?: string[];
    kaiserSeminare?: { date: string; topic: string; durationDays: number }[];
    hinweis?: string;
  } | null>(null);
  const [dateExtractApplied, setDateExtractApplied] = useState(false);

  // Rep-Schedule-Parse pro Doc
  const [repParseIndex, setRepParseIndex] = useState<number | null>(null);
  const [repParsePreview, setRepParsePreview] = useState<{
    docIndex: number;
    repIndex: number;
    schedule: import("@/lib/store").RepScheduleEntry[];
  } | null>(null);

  // Prompt-Vorschau / -Bearbeitung vor Generierung
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [previewSystem, setPreviewSystem] = useState<string>("");
  const [previewUser, setPreviewUser] = useState<string>("");
  const [editingSystem, setEditingSystem] = useState(false);
  const [editingUser, setEditingUser] = useState(false);
  const [systemDirty, setSystemDirty] = useState(false);
  const [userDirty, setUserDirty] = useState(false);

  // Persist aiResult across reloads
  useEffect(() => {
    if(accountMode)return;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.onboardingAiResult);
      if (raw) {
        const parsed = JSON.parse(raw);
        // localStorage-Hydration nach Mount, SSR-safe
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.result) setAiResult(parsed.result);
        if (parsed.structured) setAiStructured(parsed.structured);
      }
    } catch { /* ignore */ }
  }, [accountMode]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if(accountMode)return;
    const stored = getOnboarding();
    const documents = stored.documents.map(document => ({
      ...document,
      id: document.id || crypto.randomUUID(),
      ...(document.parseStatus === "pending" ? { parseStatus: "error" as const, parseError: "Das Einlesen wurde unterbrochen. Bitte die Datei erneut hochladen." } : {}),
    }));
    const hydrated = { ...stored, documents };
    if (documents.some((document, index) => document.id !== stored.documents[index].id || document.parseStatus !== stored.documents[index].parseStatus)) saveOnboarding(hydrated);
    // localStorage-Hydration nach Mount, SSR-safe
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(hydrated);
  }, [accountMode]);

  const update = useCallback((partial: Partial<OnboardingData>) => {
    if(accountMode){
      setData(previous=>previous?{...previous,...partial}:previous);
      setProfilePatch(previous=>({...previous,...projectProfile(partial as Record<string,unknown>)}));
      setProfileMessage('Noch nicht gespeichert.');return;
    }
    const updated = { ...getOnboarding(), ...partial };
    if (!saveOnboarding(updated)) throw new Error("Die Angaben konnten nicht gespeichert werden. Bitte ein Backup sichern und den Browserspeicher prüfen.");
    setData(updated);
  }, [accountMode]);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetWipePlan, setResetWipePlan] = useState(true);

  const handleReset = useCallback(() => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    resetOnboarding();
    if (resetWipePlan) {
      wipePlanData({ keepManualTasks: true });
    }
    setData(getOnboarding());
    setStep(0);
    setAiResult(null);
    setResetDialogOpen(false);
    // refresh: damit alle Komponenten ihre localStorage-Hydration neu machen
    window.location.reload();
  }, [accountMode, resetWipePlan]);

  /** Extracts readable text; unsupported or empty files produce a visible error. */
  const extractFullText = useCallback(async (file: File): Promise<{ text: string; truncated: boolean }> => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
      if (file.size > 4 * 1024 * 1024) throw new Error("Die Datei darf höchstens 4 MB groß sein.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/docs/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, filename: file.name }),
      });
      const j = await res.json();
      if (!res.ok || j.error || !j.text) throw new Error(j.error || "Kein lesbarer Text gefunden.");
      return { text: j.text as string, truncated: j.truncated === true };
  }, [accountMode, ]);

  /** Liest Dateien ein, extrahiert ggf. Volltext und fügt sie an die documents-Liste an. */
  const ingestFiles = useCallback(async (files: FileList) => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data) return;
    // Erst Stubs anlegen (sofort sichtbar), Volltext im Hintergrund nachreichen.
    const stubs = Array.from(files).map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      type: f.type || "unknown",
      parseStatus: "pending" as const,
    }));
    update({ documents: [...getOnboarding().documents, ...stubs] });

    // Volltext-Extraktion läuft asynchron, danach wird der State patch'd.
    const fileArr = Array.from(files);
    for (let i = 0; i < fileArr.length; i++) {
      const f = fileArr[i];
      let result: Partial<import("@/lib/store").OnboardingDocument>;
      try {
        const parsed = await extractFullText(f);
        result = { fullText: parsed.text, textTruncated: parsed.truncated, parseStatus: "ready", parseError: undefined };
      } catch (error) {
        result = { parseStatus: "error", parseError: error instanceof Error ? error.message : "Die Datei konnte nicht gelesen werden." };
      }
      // Aktueller Stand könnte zwischenzeitlich verändert sein → frisch via getOnboarding
      const cur = getOnboarding();
      const targetIdx = cur.documents.findIndex(d => d.id === stubs[i].id);
      if (targetIdx < 0) continue;
      const docs = [...cur.documents];
      docs[targetIdx] = { ...docs[targetIdx], ...result };
      update({ documents: docs });
    }
  }, [accountMode, data, update, extractFullText]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !data) return;
    setUploadError(null);
    void ingestFiles(files).catch(error => setUploadError(error instanceof Error ? error.message : "Die Dokumente konnten nicht gespeichert werden."));
    e.target.value = "";
  }, [data, ingestFiles]);

  const removeDocument = useCallback((index: number) => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data) return;
    const docs = [...data.documents];
    docs.splice(index, 1);
    update({ documents: docs });
  }, [accountMode, data, update]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || !data) return;
    setUploadError(null);
    void ingestFiles(files).catch(error => setUploadError(error instanceof Error ? error.message : "Die Dokumente konnten nicht gespeichert werden."));
  }, [data, ingestFiles]);

  const handleApplyPlan = useCallback(() => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!aiStructured) return;
    try { setAiApplied(applyStructuredPlan(aiStructured)); setApplyError(null); }
    catch (error) { setApplyError(error instanceof Error ? error.message : "Plan konnte nicht gespeichert werden."); }
  }, [accountMode, aiStructured]);

  // Baut das vollständige Prompt-Paar (System + User) frisch aus Onboarding-Daten + Context-Buildern.
  // Wird von der Vorschau und (sofern keine Edits aktiv sind) vom Generate-Handler verwendet.
  const buildFullPrompt = useCallback(() => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    const sys = getPromptById("plan-adjust");
    const context = buildContextFor(sys?.contextFlags || []);
    const userMsg = `${context}\n\nDies ist der allererste Plan im Onboarding. Erstelle einen konkreten Plan für die nächsten vier Wochen ab heute sowie einen groben Ausblick bis zum Examen. Berücksichtige alle Angaben und das Zeitbudget.${data?.notes ? `\n\nZUSÄTZLICHE NOTIZEN DES KANDIDATEN:\n${data.notes}` : ""}`;
    return {
      system: composePlanningPrompt(sys?.prompt || ""),
      user: userMsg,
      tier: sys?.modelTier || "premium" as const,
    };
  }, [accountMode, data]);

  const openPromptPreview = useCallback(() => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data) return;
    // Examensdatum/Lernstart kurz vorher sichern, damit der Context-Builder sie sieht
    setExamDate(data.examDate);
    setLernstart(data.lernstart);
    const fp = buildFullPrompt();
    setPreviewSystem(fp.system);
    setPreviewUser(fp.user);
    setSystemDirty(false);
    setUserDirty(false);
    setPromptPreviewOpen(true);
  }, [accountMode, data, buildFullPrompt]);

  const refreshPromptPreview = useCallback(() => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data) return;
    setExamDate(data.examDate);
    setLernstart(data.lernstart);
    const fp = buildFullPrompt();
    setPreviewSystem(fp.system);
    setPreviewUser(fp.user);
    setSystemDirty(false);
    setUserDirty(false);
    setEditingSystem(false);
    setEditingUser(false);
  }, [accountMode, data, buildFullPrompt]);

  const handleGeneratePlan = useCallback(async () => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data) return;
    if (data.documents.some(document => document.parseStatus === "pending")) { setApplyError("Bitte warten, bis alle Dokumente eingelesen sind."); return; }
    setAiLoading(true);
    setAiResult(null);
    setAiStructured(null);
    setAiApplied(null);

    // Examensdatum/Lernstart sofort sichern, damit der Context-Builder sie sieht
    setExamDate(data.examDate);
    setLernstart(data.lernstart);

    // Falls Vorschau geöffnet wurde und User editiert hat → editierte Versionen nehmen.
    // Sonst: frisch bauen (so wird der aktuellste localStorage-Zustand verwendet).
    let systemContent: string;
    let userContent: string;
    let tier: "premium" | "strong" | "cheap";
    if (promptPreviewOpen && (systemDirty || userDirty)) {
      systemContent = previewSystem;
      userContent = previewUser;
      tier = getPromptById("plan-adjust")?.modelTier || "premium";
    } else {
      const fp = buildFullPrompt();
      systemContent = fp.system;
      userContent = fp.user;
      tier = fp.tier;
    }

    try {
      const res = await fetchAi({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          purpose: "planning",
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userContent },
          ],
        }),
      });

      const result = await res.json();
      if (result.error) {
        setAiResult(`Fehler: ${result.error}`);
      } else {
        const reply = result.reply as string;
        const parsed = parseStructuredPlan(reply);
        const display = parsed ? stripJsonBlock(reply) : reply;
        setAiStructured(parsed);
        setAiResult(display);
        try {
          localStorage.setItem(
            STORAGE_KEYS.onboardingAiResult,
            JSON.stringify({ result: display, structured: parsed }),
          );
        } catch { /* ignore */ }
        update({ completed: true });
      }
    } catch {
      setAiResult("Die KI ist gerade nicht erreichbar. Versuch es in einer Minute nochmal.");
    }

    setAiLoading(false);
  }, [accountMode, data, update, promptPreviewOpen, systemDirty, userDirty, previewSystem, previewUser, buildFullPrompt]);

  const handleExtractDates = useCallback(async () => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data || data.documents.length === 0) return;
    setDateExtractLoading(true);
    setDateExtractPreview(null);
    setDateExtractApplied(false);

    const sys = getPromptById("doc-date-parser");
    const docsText = planningDocumentsContext(data.documents);
    const userMsg = `Dokumente:\n${docsText}\n\nHeute: ${format(currentDate(), "yyyy-MM-dd")}, Lernstart: ${data.lernstart || "unbekannt"}, Examen: ${data.examDate || "unbekannt"}`;

    try {
      const res = await fetchAi({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: sys?.modelTier || "cheap",
          messages: [
            { role: "system", content: sys?.prompt || "" },
            { role: "user", content: userMsg },
          ],
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      const raw = (result.reply as string).match(/\{[\s\S]*\}/)?.[0];
      if (!raw) throw new Error("Kein JSON in Antwort");
      setDateExtractPreview(JSON.parse(raw));
    } catch (e) {
      alert("Extraktion fehlgeschlagen: " + (e as Error).message);
    }
    setDateExtractLoading(false);
  }, [accountMode, data]);

  const applyExtractedDates = useCallback(() => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data || !dateExtractPreview) return;
    const patch: Partial<typeof data> = {};
    const p = dateExtractPreview;

    if (p.probeexamen?.length) {
      if (p.probeexamen[0]?.startDate) patch.probeexamen1Start = p.probeexamen[0].startDate;
      if (p.probeexamen[1]?.startDate) patch.probeexamen2Start = p.probeexamen[1].startDate;
    }
    if (p.vacationDates?.length) {
      const existing = new Set(data.vacationDates);
      patch.vacationDates = [...data.vacationDates, ...p.vacationDates.filter(d => !existing.has(d))];
    }
    if (p.kaiserSeminare?.length) {
      const existing = new Set((data.kaiserSeminare || []).map(k => k.date));
      patch.kaiserSeminare = [
        ...(data.kaiserSeminare || []),
        ...p.kaiserSeminare.filter(k => !existing.has(k.date)),
      ];
    }
    update(patch);
    setDateExtractApplied(true);
  }, [accountMode, data, dateExtractPreview, update]);

  /** Parst aus einem hochgeladenen Doc den Rep-Plan (Termine + Themen)
   *  und weist ihn einem Rep zu. Welcher Rep: per Default Index 0; falls
   *  mehrere existieren, könnte man später ein Picker-Dialog bauen. */
  const handleParseRepSchedule = useCallback(async (docIndex: number) => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data) return;
    const doc = data.documents[docIndex];
    if (!doc?.fullText) {
      alert("Kein Volltext für dieses Doc vorhanden — bitte erneut hochladen.");
      return;
    }
    if (!data.reps || data.reps.length === 0) {
      alert("Kein Repetitorium im Onboarding eingetragen. Bitte zuerst ein Rep anlegen.");
      return;
    }
    setRepParseIndex(docIndex);
    setRepParsePreview(null);

    const sys = getPromptById("rep-schedule-parser");
    const { buildContextFor } = await import("@/lib/prompt-context");
    const context = buildContextFor(sys?.contextFlags || ["topics"]);
    const userMsg = `Hier der Inhalt des Repetitorium-Plans:\n\n${doc.fullText}`;

    try {
      const res = await fetchAi({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: sys?.modelTier || "cheap",
          messages: [
            { role: "system", content: sys?.prompt || "" },
            { role: "user", content: context ? `${context}\n\n${userMsg}` : userMsg },
          ],
        }),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      const raw = (j.reply as string).match(/\{[\s\S]*\}/)?.[0];
      if (!raw) throw new Error("Kein JSON in Antwort");
      const parsed = JSON.parse(raw) as { schedule: import("@/lib/store").RepScheduleEntry[] };
      if (!Array.isArray(parsed.schedule)) throw new Error("schedule-Array fehlt in Antwort");
      // Topic-IDs gegen Leaf-Liste validieren
      const validLeafIds = new Set(TOPICS.filter(t => !TOPICS.some(c => c.parentId === t.id)).map(t => t.id));
      const cleaned = parsed.schedule.map(e => ({
        ...e,
        topicIds: (e.topicIds || []).filter(id => validLeafIds.has(id)),
      }));
      setRepParsePreview({ docIndex, repIndex: 0, schedule: cleaned });
    } catch (e) {
      alert("Rep-Plan-Parsing fehlgeschlagen: " + (e as Error).message);
    } finally {
      setRepParseIndex(null);
    }
  }, [accountMode, data]);

  /** Übernimmt den geparsten Schedule in das gewählte Rep, löscht alte
   *  plan-Tasks mit dem Rep-Label im Range (Option a), und materialisiert
   *  neue Tasks für die nächsten 90 Tage mit den erweiterten Titeln. */
  const applyRepSchedule = useCallback(() => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data || !repParsePreview) return;
    const reps = [...(data.reps || [])];
    const rep = reps[repParsePreview.repIndex];
    if (!rep) return;
    reps[repParsePreview.repIndex] = {
      ...rep,
      scheduleDocIndex: repParsePreview.docIndex,
      schedule: repParsePreview.schedule,
    };
    update({ reps });
    // Alte generische Rep-Tasks (offen, plan-source) im Range wegräumen
    const today = format(currentDate(), "yyyy-MM-dd");
    const future = currentDate();
    future.setDate(future.getDate() + 90);
    const futureStr = localDate(future);
    clearRepTasksForRelabel(rep.label, today, futureStr);
    // Frisch materialisieren — die Schedule-Erweiterung greift jetzt automatisch
    materializeRecurringTermine(today, futureStr);
    setRepParsePreview(null);
  }, [accountMode, data, repParsePreview, update]);
  const handleRefinePlan = useCallback(async () => {
    if(accountMode)throw new Error('Automatische Browseraktion ist im Kontobetrieb geschlossen.');
    if (!data || !aiResult || !refinementFeedback.trim()) return;
    setAiLoading(true);
    setAiApplied(null);

    setExamDate(data.examDate);
    setLernstart(data.lernstart);
    const fp = buildFullPrompt();

    try {
      const res = await fetchAi({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: fp.tier,
          purpose: "planning",
          messages: [
            { role: "system", content: fp.system },
            { role: "user", content: fp.user },
            { role: "assistant", content: aiResult },
            {
              role: "user",
              content: `Bitte passe den Lernplan basierend auf folgendem Feedback an:\n\n${refinementFeedback}\n\nGib den vollständigen überarbeiteten Plan inkl. JSON-Block aus.`,
            },
          ],
        }),
      });

      const result = await res.json();
      if (result.error) {
        setAiResult(`Fehler: ${result.error}`);
      } else {
        const reply = result.reply as string;
        const parsed = parseStructuredPlan(reply);
        const display = parsed ? stripJsonBlock(reply) : reply;
        setAiStructured(parsed);
        setAiResult(display);
        setRefinementFeedback("");
        try {
          localStorage.setItem(
            STORAGE_KEYS.onboardingAiResult,
            JSON.stringify({ result: display, structured: parsed }),
          );
        } catch { /* ignore */ }
      }
    } catch {
      setAiResult("Die KI ist gerade nicht erreichbar. Versuch es in einer Minute nochmal.");
    }

    setAiLoading(false);
  }, [accountMode, data, aiResult, refinementFeedback, buildFullPrompt]);

  const profileConflict=!!account&&JSON.stringify(profileBase)!==JSON.stringify(profileRevisions(account.view));
  async function saveAccount(patch:ProfilePatch){
    if(!account||!profileBase||profileConflict||account.busy)return false;
    if(!Object.keys(patch).length){setProfileMessage('Keine geänderten Angaben.');return true;}
    const error=profilePatchError(patch);if(error){setProfileMessage(error);return false;}
    const confirmed=await account.save(patch,profileBase);
    if(confirmed){setData(accountOnboardingData(confirmed));setProfileBase(profileRevisions(confirmed));setProfilePatch({});setProfileMessage('Profil gespeichert und bestätigt.');}
    else setProfileMessage('Speichern nicht bestätigt. Bitte die Kontomeldung beachten.');
    return !!confirmed;
  }
  if (!data) return null;

  const currentStep = STEPS[step];
  const assessmentTopics = getAssessmentTopics();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={cn("bg-white border-b sticky top-0 z-10",account&&"md:top-14")}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Onboarding</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => account?setStep(0):setResetDialogOpen(true)} className="text-gray-500">
            <RotateCcw className="h-4 w-4 mr-1" />
            {account?'Grunddaten':'Neustart'}
          </Button>
        </div>

        {/* Step Indicators */}
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Schritt ${i + 1}: ${s.label}`}
              aria-current={i === step ? "step" : undefined}
              onClick={() => setStep(i)}
              className={cn(
                "flex-1 h-1.5 rounded-full transition-all",
                i <= step ? "bg-accent-500" : "bg-gray-200",
                i < step && "bg-accent-300",
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {account&&<div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 space-y-3"><p role="status" className="text-sm">{profileConflict?'Der gespeicherte Stand hat sich geändert. Deine Eingaben bleiben erhalten; lade vor dem Speichern den aktuellen Stand.':profileMessage||'Angaben gehören zu deinem Konto. Gespeichert wird erst nach deiner Bestätigung.'}</p><div className="flex flex-wrap gap-3"><Button disabled={account.busy||profileConflict||!Object.keys(profilePatch).length} onClick={()=>void saveAccount(profilePatch)}>Profil speichern</Button><Button variant="outline" disabled={account.busy} onClick={()=>{setData(accountOnboardingData(account.view));setProfileBase(profileRevisions(account.view));setProfilePatch({});setProfileMessage('Gespeicherten Stand geladen.');}}>Gespeicherte Angaben laden</Button></div></div>}
        <fieldset disabled={account?.busy||profileConflict} className="min-w-0">
        <div className="flex items-center gap-2 mb-6">
          {(() => {
            const Icon = currentStep.icon;
            return <Icon className="h-6 w-6 text-accent-600" />;
          })()}
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{currentStep.label}</h2>
          <Badge variant="outline" className="ml-auto text-xs">
            Schritt {step + 1} / {STEPS.length}
          </Badge>
        </div>

        {/* STEP 1: Grunddaten */}
        {step === 0 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Bundesland</label>
                    <Input aria-label="Bundesland" value={data.bundesland} onChange={e => update({ bundesland: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Examenstermin</label>
                    <Input aria-label="Examenstermin" type="date" value={data.examDate} onChange={e => update({ examDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Lernstart</label>
                    <Input aria-label="Lernstart" type="date" value={data.lernstart} onChange={e => update({ lernstart: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="daily-hours" className="text-sm font-medium mb-1 block">Maximale Stunden pro Lerntag</label>
                    <Input id="daily-hours" type="number" min={1} max={10} step={0.5} value={data.maxDailyHours ?? 7}
                      onChange={event => { const hours = Number(event.target.value); if (Number.isFinite(hours) && hours >= 1 && hours <= 10) update({ maxDailyHours: hours }); }} />
                    <p className="text-xs text-slate-500 mt-1">Inklusive AG, Rep, Vor- und Nachbereitung. Freie Tage bleiben frei.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Freier Tag / Woche</label>
                    <select
                      aria-label="Freier Tag pro Woche"
                      value={data.freeDayPerWeek}
                      onChange={e => update({ freeDayPerWeek: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {account ? <AccountOnboardingStations key={JSON.stringify(profileBase)} settings={data} disabled={account.busy} onSave={async values=>{if(!await saveAccount({...profilePatch,...editedProfilePatch(data,values)}))throw new Error("Stationsplan nicht bestätigt. Bitte Kontomeldung beachten.");}} /> : <StudyPhaseEditor settings={data} onSave={patch => {
              const next = { ...data, ...patch };
              if (!saveOnboarding(next)) throw new Error("Stationsplan konnte nicht gespeichert werden. Bitte Browserspeicher prüfen.");
              setData(next);
            }} /> }
          </div>
        )}

        {/* STEP 2: Termine */}
        {step === 1 && (
          <div className="space-y-4">

            {/* Dokument-Extraktion Banner */}
            {data.documents.length > 0 && (
              <Card className="border-accent-200 bg-accent-50/40">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-accent-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {data.documents.length} Dokument{data.documents.length > 1 ? "e" : ""} hochgeladen
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        KI kann Probeexamen-Daten, Urlaub und Kaiser-Seminare aus den Beschreibungen/Summaries extrahieren. Funktioniert am besten wenn du bei den Dokumenten eine Beschreibung eingetragen hast.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExtractDates}
                      disabled={dateExtractLoading}
                      className="shrink-0 text-xs"
                    >
                      {dateExtractLoading
                        ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Extrahiere…</>
                        : <><Sparkles className="h-3 w-3 mr-1" />Termine extrahieren</>
                      }
                    </Button>
                  </div>

                  {/* Vorschau der extrahierten Daten */}
                  {dateExtractPreview && !dateExtractApplied && (() => {
                    const p = dateExtractPreview;
                    const hasData = (p.probeexamen?.length ?? 0) > 0 || (p.vacationDates?.length ?? 0) > 0 || (p.kaiserSeminare?.length ?? 0) > 0;
                    return (
                      <div className="border border-accent-200 rounded-lg bg-white p-3 space-y-2">
                        {!hasData ? (
                          <p className="text-xs text-slate-500 italic">Keine Termindaten erkannt. Füge bei den Dokumenten eine genauere Beschreibung hinzu.</p>
                        ) : (
                          <>
                            {(p.probeexamen?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Probeexamen</p>
                                {p.probeexamen!.map((pe, i) => (
                                  <p key={i} className="text-xs text-slate-700">Probeexamen {i + 1}: Start <span className="font-medium">{pe.startDate}</span></p>
                                ))}
                              </div>
                            )}
                            {(p.vacationDates?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Urlaubstage ({p.vacationDates!.length})</p>
                                <p className="text-xs text-slate-700">{p.vacationDates!.slice(0, 5).join(", ")}{p.vacationDates!.length > 5 ? ` +${p.vacationDates!.length - 5} weitere` : ""}</p>
                              </div>
                            )}
                            {(p.kaiserSeminare?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Kaiser-Seminare</p>
                                {p.kaiserSeminare!.map((k, i) => (
                                  <p key={i} className="text-xs text-slate-700">{k.date} · {k.topic} · {k.durationDays} Tage</p>
                                ))}
                              </div>
                            )}
                            {p.hinweis && (
                              <p className="text-[10px] text-slate-400 italic">{p.hinweis}</p>
                            )}
                            <Button size="sm" onClick={applyExtractedDates} className="mt-1 text-xs bg-accent-600 hover:bg-accent-700">
                              <Check className="h-3 w-3 mr-1" />
                              In Formular übernehmen
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {dateExtractApplied && (
                    <div className="flex items-center gap-2 text-xs text-accent-700 font-medium">
                      <Check className="h-3.5 w-3.5" /> Übernommen — prüfe die Felder unten.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Wiederkehrende Termine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AGs (mehrere möglich) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Arbeitsgemeinschaften (AGs)</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newAg: AgEntry = {
                          id: (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `ag-${Date.now()}`,
                          label: `AG ${data.ags.length + 1}`,
                          day: "Montag",
                          frequency: "wöchentlich",
                          topic: "",
                          durationHours: 5,
                          prepHours: 2,
                          postHours: 1,
                          startDate: "",
                          endDate: "",
                        };
                        update({ ags: [...data.ags, newAg] });
                      }}
                    >
                      + AG hinzufügen
                    </Button>
                  </div>

                  {data.ags.length === 0 && (
                    <p className="text-[11px] text-slate-500 italic">Noch keine AG eingetragen — über den Button hinzufügen.</p>
                  )}

                  {data.ags.map((ag, idx) => {
                    const updateAg = (partial: Partial<AgEntry>) => {
                      const next = [...data.ags];
                      next[idx] = { ...next[idx], ...partial };
                      update({ ags: next });
                    };
                    return (
                      <div key={ag.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={ag.label}
                            onChange={e => updateAg({ label: e.target.value })}
                            placeholder="Bezeichnung (z.B. ZR-AG Prof. Meier)"
                            className="flex-1 text-sm font-medium"
                          />
                          <button
                            onClick={() => update({ ags: data.ags.filter((_, i) => i !== idx) })}
                            className="text-slate-400 hover:text-red-500 p-1"
                            title="AG entfernen"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Frequenz</label>
                            <select
                              value={ag.frequency}
                              onChange={e => updateAg({ frequency: e.target.value })}
                              className="w-full rounded-md border px-3 py-2 text-sm"
                            >
                              <option value="wöchentlich">wöchentlich</option>
                              <option value="2x/Woche">2x pro Woche</option>
                              <option value="14-tägig">14-tägig</option>
                              <option value="unregelmäßig">unregelmäßig</option>
                              <option value="selten">selten / Blöcke</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Wochentag</label>
                            <select
                              value={ag.day}
                              onChange={e => updateAg({ day: e.target.value })}
                              className="w-full rounded-md border px-3 py-2 text-sm"
                            >
                              {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Thema (optional)</label>
                            <Input
                              value={ag.topic}
                              onChange={e => updateAg({ topic: e.target.value })}
                              placeholder="z.B. Zivilrecht"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Termin-Stunden</label>
                            <Input
                              type="number"
                              min={0}
                              max={12}
                              step={0.5}
                              value={ag.durationHours}
                              onChange={e => updateAg({ durationHours: Number(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Start (optional)</label>
                            <Input
                              type="date"
                              value={ag.startDate}
                              onChange={e => updateAg({ startDate: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Ende (optional)</label>
                            <Input
                              type="date"
                              value={ag.endDate}
                              onChange={e => updateAg({ endDate: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Vorbereitung (h)</label>
                            <Input
                              type="number"
                              min={0}
                              max={12}
                              step={0.5}
                              value={ag.prepHours}
                              onChange={e => updateAg({ prepHours: Number(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Nachbereitung (h)</label>
                            <Input
                              type="number"
                              min={0}
                              max={12}
                              step={0.5}
                              value={ag.postHours}
                              onChange={e => updateAg({ postHours: Number(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-slate-500">
                    Vor-/Nachbereitung wird möglichst nah an den Termin gelegt (Vortag / Termintag / Folgetag). Nach dem Ende-Datum werden keine Termine mehr eingeplant.
                  </p>
                </div>

                <Separator />

                {/* Repetitorien (mehrere / löschbar) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Repetitorium</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newRep: RepEntry = {
                          id: (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `rep-${Date.now()}`,
                          label: `Repetitorium ${data.reps.length + 1}`,
                          day: "Mittwoch",
                          durationHours: 4,
                          prepHours: 0,
                          postHours: 0,
                          startDate: "",
                          endDate: "",
                        };
                        update({ reps: [...data.reps, newRep] });
                      }}
                    >
                      + Rep hinzufügen
                    </Button>
                  </div>
                  {data.reps.length === 0 && (
                    <p className="text-[11px] text-slate-500 italic">Kein Repetitorium — über den Button hinzufügen.</p>
                  )}
                  {data.reps.map((rep, idx) => {
                    const updateRep = (partial: Partial<RepEntry>) => {
                      const next = [...data.reps];
                      next[idx] = { ...next[idx], ...partial };
                      update({ reps: next });
                    };
                    return (
                      <div key={rep.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={rep.label}
                            onChange={e => updateRep({ label: e.target.value })}
                            placeholder="Bezeichnung (z.B. Repetitorium ZR)"
                            className="flex-1 text-sm font-medium"
                          />
                          <button
                            onClick={() => update({ reps: data.reps.filter((_, i) => i !== idx) })}
                            className="text-slate-400 hover:text-red-500 p-1"
                            title="Entfernen"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Wochentag</label>
                            <select
                              value={rep.day}
                              onChange={e => updateRep({ day: e.target.value })}
                              className="w-full rounded-md border px-3 py-2 text-sm"
                            >
                              {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Termin-Stunden</label>
                            <Input type="number" min={0} max={12} step={0.5} value={rep.durationHours} onChange={e => updateRep({ durationHours: Number(e.target.value) || 0 })} />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Start (optional)</label>
                            <Input type="date" value={rep.startDate} onChange={e => updateRep({ startDate: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Ende (optional)</label>
                            <Input type="date" value={rep.endDate} onChange={e => updateRep({ endDate: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Vorbereitung (h)</label>
                            <Input type="number" min={0} max={12} step={0.5} value={rep.prepHours} onChange={e => updateRep({ prepHours: Number(e.target.value) || 0 })} />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Nachbereitung (h)</label>
                            <Input type="number" min={0} max={12} step={0.5} value={rep.postHours} onChange={e => updateRep({ postHours: Number(e.target.value) || 0 })} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Separator />

                {/* Lerngruppen (mehrere möglich) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Lerngruppen (optional)</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newLg: LerngruppeEntry = {
                          id: (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `lg-${Date.now()}`,
                          label: `Lerngruppe ${data.lerngruppen.length + 1}`,
                          day: "Donnerstag",
                          frequency: "wöchentlich",
                          durationHours: 2,
                          prepHours: 1,
                          postHours: 0.5,
                          startDate: "",
                          endDate: "",
                        };
                        update({ lerngruppen: [...data.lerngruppen, newLg] });
                      }}
                    >
                      + Lerngruppe hinzufügen
                    </Button>
                  </div>

                  {data.lerngruppen.length === 0 && (
                    <p className="text-[11px] text-slate-500 italic">Keine Lerngruppe — über den Button hinzufügen.</p>
                  )}

                  {data.lerngruppen.map((lg, idx) => {
                    const updateLg = (partial: Partial<LerngruppeEntry>) => {
                      const next = [...data.lerngruppen];
                      next[idx] = { ...next[idx], ...partial };
                      update({ lerngruppen: next });
                    };
                    return (
                      <div key={lg.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={lg.label}
                            onChange={e => updateLg({ label: e.target.value })}
                            placeholder="Bezeichnung"
                            className="flex-1 text-sm font-medium"
                          />
                          <button
                            onClick={() => update({ lerngruppen: data.lerngruppen.filter((_, i) => i !== idx) })}
                            className="text-slate-400 hover:text-red-500 p-1"
                            title="Lerngruppe entfernen"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Frequenz</label>
                            <select
                              value={lg.frequency}
                              onChange={e => updateLg({ frequency: e.target.value })}
                              className="w-full rounded-md border px-3 py-2 text-sm"
                            >
                              <option value="wöchentlich">wöchentlich</option>
                              <option value="14-tägig">14-tägig</option>
                              <option value="unregelmäßig">unregelmäßig</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Wochentag</label>
                            <select
                              value={lg.day}
                              onChange={e => updateLg({ day: e.target.value })}
                              className="w-full rounded-md border px-3 py-2 text-sm"
                            >
                              {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Termin-Stunden</label>
                            <Input
                              type="number"
                              min={0}
                              max={12}
                              step={0.5}
                              value={lg.durationHours}
                              onChange={e => updateLg({ durationHours: Number(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Start (optional)</label>
                            <Input type="date" value={lg.startDate} onChange={e => updateLg({ startDate: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Ende (optional)</label>
                            <Input type="date" value={lg.endDate} onChange={e => updateLg({ endDate: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-medium mb-1 block text-slate-600">Vorbereitung (h)</label>
                              <Input type="number" min={0} max={12} step={0.5} value={lg.prepHours} onChange={e => updateLg({ prepHours: Number(e.target.value) || 0 })} />
                            </div>
                            <div>
                              <label className="text-xs font-medium mb-1 block text-slate-600">Nachbereitung (h)</label>
                              <Input type="number" min={0} max={12} step={0.5} value={lg.postHours} onChange={e => updateLg({ postHours: Number(e.target.value) || 0 })} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {data.lerngruppen.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Vor-/Nachbereitung wird möglichst nah an den Termin gelegt.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Probeexamen (optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Probeexamen 1 — Start</label>
                    <div className="flex gap-2 items-center">
                      <Input type="date" value={data.probeexamen1Start} onChange={e => update({ probeexamen1Start: e.target.value })} className="flex-1" />
                      {data.probeexamen1Start && (
                        <button onClick={() => update({ probeexamen1Start: "" })} className="text-slate-400 hover:text-red-500" title="Löschen">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Probeexamen 2 — Start</label>
                    <div className="flex gap-2 items-center">
                      <Input type="date" value={data.probeexamen2Start} onChange={e => update({ probeexamen2Start: e.target.value })} className="flex-1" />
                      {data.probeexamen2Start && (
                        <button onClick={() => update({ probeexamen2Start: "" })} className="text-slate-400 hover:text-red-500" title="Löschen">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{account?"Die Startdaten werden gespeichert. Eine konkrete Klausurfolge wird daraus im Kontobetrieb noch nicht automatisch angelegt.":"Jeweils 2 Wochen, 6 Klausuren unter Realbedingungen"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Kaiserseminare (optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={cn("grid gap-2 items-end",account?"grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto]":"grid-cols-[1fr_auto_auto_auto]")}>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Startdatum</label>
                    <Input
                      type="date"
                      value={kaiserDate}
                      onChange={e => setKaiserDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Rechtsgebiet</label>
                    <select
                      value={kaiserTopic}
                      onChange={e => setKaiserTopic(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="Zivilrecht">Zivilrecht</option>
                      <option value="Öffentliches Recht">Öffentliches Recht</option>
                      <option value="Strafrecht">Strafrecht</option>
                      <option value="Gemischt">Gemischt</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Tage</label>
                    <Input
                      type="number"
                      value={kaiserDays}
                      onChange={e => setKaiserDays(Number(e.target.value) || 3)}
                      min={1}
                      max={14}
                      className="w-16"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mb-0.5"
                    disabled={!kaiserDate}
                    onClick={() => {
                      update({
                        kaiserSeminare: [
                          ...(data.kaiserSeminare || []),
                          { date: kaiserDate, topic: kaiserTopic, durationDays: kaiserDays },
                        ],
                      });
                      setKaiserDate("");
                    }}
                  >
                    +
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(data.kaiserSeminare || []).map((k, i) => (
                    <div key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 text-xs px-2.5 py-1">
                      {k.date} · {k.topic} ({k.durationDays}d)
                      <button
                        type="button"
                        onClick={() => update({ kaiserSeminare: (data.kaiserSeminare || []).filter((_, j) => j !== i) })}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  An diesen Tagen wird kein selbstständiges Lernen eingeplant.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Urlaub / Abwesenheiten (optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    id="vacation-date-input"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById("vacation-date-input") as HTMLInputElement;
                      if (input?.value) {
                        update({ vacationDates: [...data.vacationDates, input.value] });
                        input.value = "";
                      }
                    }}
                  >
                    Hinzufügen
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.vacationDates.map((d, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {d}
                      <button onClick={() => update({ vacationDates: data.vacationDates.filter((_, j) => j !== i) })}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sonstiges */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Sonstiges (optional)</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newEntry: SonstigesEntry = {
                        id: (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `s-${Date.now()}`,
                        label: "",
                        day: "Montag",
                        frequency: "wöchentlich",
                        durationHours: 1,
                        startDate: "",
                        endDate: "",
                      };
                      update({ sonstiges: [...(data.sonstiges || []), newEntry] });
                    }}
                  >
                    + Termin hinzufügen
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.sonstiges || []).length === 0 && (
                  <p className="text-[11px] text-slate-500 italic">Eigene wiederkehrende Termine — z.B. Sport, Nebenjob, feste Verpflichtungen.</p>
                )}
                {(data.sonstiges || []).map((s, idx) => {
                  const updateS = (partial: Partial<SonstigesEntry>) => {
                    const next = [...(data.sonstiges || [])];
                    next[idx] = { ...next[idx], ...partial };
                    update({ sonstiges: next });
                  };
                  return (
                    <div key={s.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={s.label}
                          onChange={e => updateS({ label: e.target.value })}
                          placeholder="Bezeichnung (z.B. Sport, Nebenjob...)"
                          className="flex-1 text-sm"
                        />
                        <button onClick={() => update({ sonstiges: (data.sonstiges || []).filter((_, i) => i !== idx) })} className="text-slate-400 hover:text-red-500 p-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs font-medium mb-1 block text-slate-600">Tag</label>
                          <select value={s.day} onChange={e => updateS({ day: e.target.value })} className="w-full rounded-md border px-2 py-1.5 text-sm">
                            {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block text-slate-600">Frequenz</label>
                          <select value={s.frequency} onChange={e => updateS({ frequency: e.target.value })} className="w-full rounded-md border px-2 py-1.5 text-sm">
                            <option value="täglich">täglich (z.B. Anki)</option>
                            <option value="wöchentlich">wöchentlich</option>
                            <option value="14-tägig">14-tägig</option>
                            <option value="unregelmäßig">unregelmäßig</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block text-slate-600">Stunden</label>
                          <Input type="number" min={0} max={24} step={0.5} value={s.durationHours} onChange={e => updateS({ durationHours: Number(e.target.value) || 0 })} />
                        </div>
                        <div className="grid grid-cols-2 gap-1 col-span-2 sm:col-span-1">
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Ab</label>
                            <Input type="date" value={s.startDate} onChange={e => updateS({ startDate: e.target.value })} className="text-xs" />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block text-slate-600">Bis</label>
                            <Input type="date" value={s.endDate} onChange={e => updateS({ endDate: e.target.value })} className="text-xs" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 3: Selbsteinschätzung */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">
              Wie sicher fühlst du dich? (0% = keine Ahnung, 100% = sitzt) —
              <span className="text-slate-400"> Level-2 reicht; Feingranular aufklappen nur wenn du willst.</span>
            </p>

            {(["zr", "oeffr", "sr"] as Area[]).map(area => {
              const areaL2 = assessmentTopics.filter(t => t.area === area);
              return (
                <Card key={area} className="overflow-hidden">
                  <CardHeader className="pb-2 pt-3 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                    <CardTitle className="text-sm font-bold text-white tracking-wide">
                      {AREA_LABELS[area]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {areaL2.map(l2 => {
                      const l3Children = TOPICS.filter(t => t.parentId === l2.id);
                      const isExpanded = expandedAssessmentGroups.has(l2.id);
                      return (
                        <div key={l2.id} className="space-y-1">
                          <div className="flex items-center gap-3">
                            {l3Children.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = new Set(expandedAssessmentGroups);
                                  if (isExpanded) next.delete(l2.id); else next.add(l2.id);
                                  setExpandedAssessmentGroups(next);
                                }}
                                className="text-slate-500 hover:text-slate-800 p-0.5"
                                title={isExpanded ? "Feingranular einklappen" : "Feingranular aufklappen"}
                              >
                                {isExpanded ? <ArrowLeft className="h-3 w-3 rotate-[-90deg]" /> : <ArrowRight className="h-3 w-3 rotate-90" />}
                              </button>
                            ) : (
                              <span className="w-4" />
                            )}
                            <span className="text-sm flex-1 min-w-0 truncate font-medium">{l2.label}</span>
                            <div className="flex items-center gap-2 w-40 shrink-0">
                              <Slider
                                value={[data.selfAssessment[l2.id] ?? 0]}
                                onValueChange={(val) => {
                                  const v = Array.isArray(val) ? val[0] : val;
                                  update({ selfAssessment: { ...data.selfAssessment, [l2.id]: v } });
                                }}
                                max={100}
                                step={10}
                              />
                              <span className="text-xs font-bold w-8 text-right text-gray-500">
                                {data.selfAssessment[l2.id] ?? 0}%
                              </span>
                            </div>
                          </div>
                          {isExpanded && l3Children.length > 0 && (
                            <div className="ml-6 space-y-1.5 pt-1 pb-2 border-l border-slate-200 pl-3">
                              {l3Children.map(l3 => (
                                <div key={l3.id} className="flex items-center gap-3">
                                  <span className="text-xs flex-1 min-w-0 truncate text-slate-600">{l3.label}</span>
                                  <div className="flex items-center gap-2 w-36 shrink-0">
                                    <Slider
                                      value={[data.selfAssessment[l3.id] ?? 0]}
                                      onValueChange={(val) => {
                                        const v = Array.isArray(val) ? val[0] : val;
                                        update({ selfAssessment: { ...data.selfAssessment, [l3.id]: v } });
                                      }}
                                      max={100}
                                      step={10}
                                    />
                                    <span className="text-[11px] font-semibold w-8 text-right text-gray-400">
                                      {data.selfAssessment[l3.id] ?? 0}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* STEP 4: Material / Dokumente */}
        {step === 3 && (account ? <Card><CardContent className="pt-6 space-y-4"><BookOpen className="h-10 w-10 text-accent-600"/><h3 className="text-lg font-bold">Deine Planungsunterlagen</h3><p className="text-sm text-slate-600">Persönliche Originale kannst du bereits in deiner Dokumentablage hochladen und verwalten. Automatische Dokumentauswertung und die Erstellung neuer KI-Pläne sind im Pilot noch nicht verfügbar. Bestehende Quellenzuordnungen bleiben erhalten.</p><Link href="/konto/dokumente" className="underline">Meine Dokumente öffnen</Link><label className="block text-sm font-medium">Zusätzliche Notizen<Textarea aria-label="Zusätzliche Notizen" value={data.notes} maxLength={10000} onChange={e=>update({notes:e.target.value})} className="mt-2"/></label></CardContent></Card> : (
          <div className="space-y-4">
            {uploadError && <p role="alert" className="text-sm text-red-700">{uploadError}</p>}
            <p className="text-sm text-gray-500 mb-2">
              Lade Planungs-Dokumente hoch — z.B. GJPA-Terminpläne, Lernpläne anderer Referendare, AG-Übersichten oder PDFs mit Terminen. Die KI extrahiert Termine und berücksichtigt die Informationen bei der Lernplan-Erstellung.
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 leading-relaxed">
              Lade hier deinen persönlichen Stationsplan und die datierten AG-, Rep- und Klausurenkurspläne hoch. Ihr ausgelesener Text bildet die Grundlage des Lernplans. Die Pflichtstoffliste ist zusätzlich bereits hinterlegt. Prüfe den erkannten Dokumenttext, besonders bei gescannten PDFs.
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-accent-400 hover:bg-accent-50/50 transition-colors"
            >
              <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">Dateien hierher ziehen</p>
              <p className="text-xs text-gray-400 mt-1">oder klicken zum Auswählen</p>
              <p className="text-xs text-gray-400 mt-1">PDF mit lesbarem Text, DOCX, TXT, CSV oder Excel</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Hochgeladene Dateien */}
            {data.documents.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Hochgeladene Dateien ({data.documents.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.documents.map((doc, i) => {
                    const updateDoc = (partial: Partial<typeof doc>) => {
                      const docs = [...getOnboarding().documents];
                      const index = docs.findIndex(current => current.id === doc.id);
                      if (index < 0) return;
                      docs[index] = { ...docs[index], ...partial };
                      update({ documents: docs });
                    };
                    const tags = doc.topicIds || [];
                    const tagging = taggingDocIndex === i;
                    return (
                      <div key={doc.id || i} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="text-sm font-medium flex-1 truncate">{doc.name}</span>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {doc.type.split("/").pop() || "?"}
                          </Badge>
                          <button onClick={() => removeDocument(i)}>
                            <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                        <Textarea
                          value={doc.description || ""}
                          onChange={e => updateDoc({ description: e.target.value })}
                          placeholder="Was ist drin? (1-2 Sätze — hilft der KI die Themen zu erkennen)"
                          rows={2}
                          className="text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={tagging}
                            onClick={async () => {
                              setTaggingDocIndex(i);
                              try {
                                const res = await fetch("/api/docs/tag", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(withAiPreferences({ tier: "cheap" as const, name: doc.name, type: doc.type, description: doc.description || "" })),
                                });
                                const j = await res.json();
                                if (j.error) throw new Error(j.error);
                                updateDoc({ summary: j.summary, topicIds: j.topicIds });
                              } catch (err) {
                                alert("Themen-Erkennung fehlgeschlagen: " + (err as Error).message);
                              } finally {
                                setTaggingDocIndex(null);
                              }
                            }}
                            className="text-xs"
                          >
                            {tagging ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                            {tags.length > 0 ? "Neu erkennen" : "🪄 Themen erkennen"}
                          </Button>
                          {tags.length > 0 && (
                            <span className="text-[11px] text-slate-500">{tags.length} Leaves erkannt</span>
                          )}
                          {/* Rep-Plan-Parser: nur sichtbar wenn Volltext extrahiert UND mindestens 1 Rep angelegt */}
                          {doc.fullText && (data.reps || []).length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={repParseIndex === i}
                              onClick={() => handleParseRepSchedule(i)}
                              className="text-xs"
                              title="Erkennt Termin-Themen-Liste im Doc und befüllt damit den Rep-Plan"
                            >
                              {repParseIndex === i ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3 mr-1" />
                              )}
                              {(data.reps || []).some(r => r.scheduleDocIndex === i) ? "Rep-Plan: neu parsen" : "Als Rep-Plan parsen"}
                            </Button>
                          )}
                          {doc.parseStatus === "pending" && (
                            <span className="text-[11px] text-amber-600 italic">Volltext wird extrahiert…</span>
                          )}
                          {doc.fullText && <span className="text-[11px] text-emerald-700">Text eingelesen{doc.textTruncated ? " (Ausschnitt)" : ""}</span>}
                          {(doc.parseStatus === "error" || (!doc.fullText && doc.parseStatus !== "pending")) && <span className="text-[11px] text-red-700">{doc.parseError || "Kein lesbarer Text gespeichert. Datei erneut hochladen oder Text unten ergänzen."}</span>}
                        </div>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-slate-600">Dokumenttext prüfen oder ergänzen</summary>
                          <Textarea aria-label={`Dokumenttext: ${doc.name}`} className="mt-2 text-xs" rows={6} maxLength={15000} value={doc.fullText || ""} onChange={event => updateDoc({ fullText: event.target.value, parseStatus: event.target.value.trim() ? "ready" : "error", parseError: undefined, textTruncated: false })} />
                        </details>
                        {doc.summary && (
                          <p className="text-[11px] italic text-slate-600 bg-white rounded-md p-2 border border-slate-200">{doc.summary}</p>
                        )}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tags.map(tid => {
                              const topic = TOPICS.find(t => t.id === tid);
                              return (
                                <button
                                  key={tid}
                                  type="button"
                                  onClick={() => updateDoc({ topicIds: tags.filter(x => x !== tid) })}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-50 border border-accent-200 text-[10px] text-accent-800 hover:bg-accent-100"
                                  title={tid}
                                >
                                  {topic?.label || tid}
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        ))}

        {/* STEP 5: Plan generieren */}
        {step === 4 && (account ? <Card><CardContent className="pt-6 text-center space-y-4"><Sparkles className="h-12 w-12 text-accent-600 mx-auto"/><h3 className="text-lg font-bold">Deinen manuellen Einstieg abschließen</h3><p className="text-sm text-gray-500">Neue KI-Planerstellung ist im Pilot noch nicht verfügbar. Deine bewusst gespeicherten Angaben kannst du für manuelle Planung und die bestätigte Tagesvorbereitung verwenden.</p><div className="text-left bg-gray-50 rounded-lg p-4 text-sm space-y-1"><p><strong>Bundesland:</strong> {data.bundesland||'offen'}</p><p><strong>Lernstart:</strong> {data.lernstart||'offen'}</p><p><strong>Examen:</strong> {data.examDate||'offen'}</p><p><strong>Tagesgrenze:</strong> {data.maxDailyHours} Stunden · {data.freeDayPerWeek} frei</p><p>{data.ags.length} AGs · {data.reps.length} Reps · {data.lerngruppen.length} Lerngruppen · {data.sonstiges.length} weitere Termine</p></div><Button disabled={account.busy||profileConflict} onClick={()=>void saveAccount({...profilePatch,completed:true})} className="w-full bg-accent-600 hover:bg-accent-700" size="lg">Manuellen Einstieg abschließen</Button><div className="flex flex-wrap justify-center gap-4"><Link className="underline" href="/wochenplan">Zum Lernkalender</Link><Link className="underline" href="/plan">Vorhandenen Plan prüfen</Link></div></CardContent></Card> : (
          <div className="space-y-4">
            {!aiResult && !aiLoading && (
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <Sparkles className="h-12 w-12 text-accent-600 mx-auto" />
                  <div>
                    <h3 className="text-lg font-bold">Bereit für deinen Lernplan!</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Die KI erstellt einen individuellen Plan basierend auf deinen Angaben.
                      Stationsplan und Termine aus deinen Dokumenten werden standardmäßig berücksichtigt. Der fortlaufende Klausurenkurs und fällige Wiederholungen teilen sich die verfügbare Zeit.
                    </p>
                  </div>

                  {/* Zusammenfassung */}
                  <div className="text-left bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                    <p><strong>Bundesland:</strong> {data.bundesland}</p>
                    <p><strong>Lernstart:</strong> {data.lernstart}</p>
                    <p><strong>Examen:</strong> {data.examDate}</p>
                    {data.ags.length === 0 ? (
                      <p><strong>AGs:</strong> keine eingetragen</p>
                    ) : (
                      <div>
                        <strong>AGs ({data.ags.length}):</strong>
                        <ul className="ml-4 mt-1 space-y-0.5">
                          {data.ags.map(ag => (
                            <li key={ag.id} className="text-xs">
                              {ag.label} — {ag.day} ({ag.frequency}) · {ag.durationHours}h + {ag.prepHours}h Vor/{ag.postHours}h Nach
                              {ag.startDate && ` · ab ${ag.startDate}`}
                              {ag.endDate && ` · bis ${ag.endDate}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.reps.length === 0 ? (
                      <p><strong>Rep:</strong> keines eingetragen</p>
                    ) : (
                      <div>
                        <strong>Repetitorien ({data.reps.length}):</strong>
                        <ul className="ml-4 mt-1 space-y-0.5">
                          {data.reps.map(r => (
                            <li key={r.id} className="text-xs">
                              {r.label} — {r.day} · {r.durationHours}h{r.prepHours ? ` + ${r.prepHours}h Vor` : ""}{r.postHours ? `/${r.postHours}h Nach` : ""}
                              {r.startDate && ` · ab ${r.startDate}`}{r.endDate && ` · bis ${r.endDate}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.lerngruppen.length > 0 && (
                      <div>
                        <strong>Lerngruppen ({data.lerngruppen.length}):</strong>
                        <ul className="ml-4 mt-1 space-y-0.5">
                          {data.lerngruppen.map(lg => (
                            <li key={lg.id} className="text-xs">
                              {lg.label} — {lg.day} ({lg.frequency}) · {lg.durationHours}h + {lg.prepHours}h Vor/{lg.postHours}h Nach
                              {lg.startDate && ` · ab ${lg.startDate}`}
                              {lg.endDate && ` · bis ${lg.endDate}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p><strong>Freier Tag:</strong> {data.freeDayPerWeek}</p>
                    <p><strong>Dokumente:</strong> {data.documents.length} hochgeladen</p>
                    <p><strong>Klausurenkurs:</strong> Durchgehend, Termine aus deinen Unterlagen</p>
                  </div>

                  {/* Zusätzliche Notizen / Wünsche an die KI */}
                  <div className="text-left">
                    <label className="text-sm font-medium mb-1 block">Zusätzliche Notizen / Wünsche (optional)</label>
                    <Textarea
                      value={data.notes}
                      onChange={e => update({ notes: e.target.value })}
                      placeholder="z.B. besondere Umstände, Schwerpunkte, die du setzen willst, Themen die dir schwerfallen..."
                      rows={3}
                    />
                  </div>

                  {(() => {
                    const errs: string[] = [];
                    if (!data.examDate) errs.push("Examensdatum fehlt.");
                    if (!data.lernstart) errs.push("Lernstart fehlt.");
                    if (data.examDate && data.lernstart && data.examDate <= data.lernstart) {
                      errs.push("Examen muss nach dem Lernstart liegen.");
                    }
                    data.ags.forEach((ag, i) => {
                      if (ag.durationHours <= 0) errs.push(`AG ${i + 1} (${ag.label}): Termin-Stunden müssen > 0 sein.`);
                      if (ag.startDate && ag.endDate && ag.endDate < ag.startDate) errs.push(`AG ${i + 1}: Ende-Datum liegt vor Start.`);
                    });
                    data.reps.forEach((r, i) => {
                      if (r.durationHours <= 0) errs.push(`Rep ${i + 1} (${r.label}): Termin-Stunden müssen > 0 sein.`);
                    });
                    data.lerngruppen.forEach((lg, i) => {
                      if (lg.durationHours <= 0) errs.push(`Lerngruppe ${i + 1} (${lg.label}): Termin-Stunden müssen > 0 sein.`);
                      if (lg.startDate && lg.endDate && lg.endDate < lg.startDate) errs.push(`Lerngruppe ${i + 1}: Ende-Datum liegt vor Start.`);
                    });
                    return (
                      <>
                        {errs.length > 0 && (
                          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
                            {errs.map((e) => <p key={e}>• {e}</p>)}
                          </div>
                        )}

                        {/* Prompt-Vorschau (kollabierbar) */}
                        <div className="text-left mb-3 rounded-lg border bg-slate-50">
                          <button
                            type="button"
                            onClick={() => promptPreviewOpen ? setPromptPreviewOpen(false) : openPromptPreview()}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                          >
                            <span className="flex items-center gap-2">
                              {promptPreviewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {promptPreviewOpen ? "Prompt verbergen" : "Vollständigen Prompt ansehen / bearbeiten"}
                            </span>
                            {(systemDirty || userDirty) && (
                              <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                                bearbeitet
                              </Badge>
                            )}
                          </button>

                          {promptPreviewOpen && (
                            <div className="border-t px-3 py-3 space-y-3">
                              <p className="text-[11px] text-slate-500 leading-snug">
                                Das wird an die KI geschickt. Der System-Prompt enthält die Instruktionen, die User-Nachricht enthält die ausgewerteten Onboarding-Daten + dein Kontext (Fortschritt, Kalender etc.). Du kannst beides per Stift-Symbol bearbeiten.
                              </p>

                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={refreshPromptPreview}
                                  className="h-7 text-[11px]"
                                  title="Aus aktuellen Onboarding-Daten neu generieren (verwirft Edits)"
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Aus Daten neu bauen
                                </Button>
                              </div>

                              {/* System-Prompt */}
                              <div className="rounded-md border bg-white">
                                <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-slate-100/60">
                                  <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                                    System-Prompt {systemDirty && <span className="text-amber-700 normal-case">(bearbeitet)</span>}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSystem(v => !v)}
                                    className="text-slate-500 hover:text-slate-900 p-1 rounded"
                                    title={editingSystem ? "Bearbeiten beenden" : "Bearbeiten"}
                                  >
                                    {editingSystem ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                                {editingSystem ? (
                                  <Textarea
                                    value={previewSystem}
                                    onChange={e => { setPreviewSystem(e.target.value); setSystemDirty(true); }}
                                    rows={14}
                                    className="text-[11px] font-mono leading-relaxed border-0 rounded-none focus-visible:ring-0"
                                  />
                                ) : (
                                  <pre className="text-[11px] font-mono leading-relaxed text-slate-800 whitespace-pre-wrap p-2.5 max-h-64 overflow-auto">
                                    {previewSystem}
                                  </pre>
                                )}
                              </div>

                              {/* User-Message (Kontext) */}
                              <div className="rounded-md border bg-white">
                                <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-slate-100/60">
                                  <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                                    User-Nachricht (Kontext) {userDirty && <span className="text-amber-700 normal-case">(bearbeitet)</span>}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingUser(v => !v)}
                                    className="text-slate-500 hover:text-slate-900 p-1 rounded"
                                    title={editingUser ? "Bearbeiten beenden" : "Bearbeiten"}
                                  >
                                    {editingUser ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                                {editingUser ? (
                                  <Textarea
                                    value={previewUser}
                                    onChange={e => { setPreviewUser(e.target.value); setUserDirty(true); }}
                                    rows={20}
                                    className="text-[11px] font-mono leading-relaxed border-0 rounded-none focus-visible:ring-0"
                                  />
                                ) : (
                                  <pre className="text-[11px] font-mono leading-relaxed text-slate-800 whitespace-pre-wrap p-2.5 max-h-96 overflow-auto">
                                    {previewUser}
                                  </pre>
                                )}
                              </div>

                              <p className="text-[10px] text-slate-400 leading-snug">
                                Hinweis: Edits werden nur für diese eine Generierung verwendet — der Default-Prompt im System bleibt unangetastet (dauerhaft änderbar via /admin).
                              </p>
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={handleGeneratePlan}
                          disabled={errs.length > 0 || data.documents.some(document => document.parseStatus === "pending")}
                          className="bg-accent-600 hover:bg-accent-700 w-full"
                          size="lg"
                        >
                          <Sparkles className="h-5 w-5 mr-2" />
                          Lernplan generieren (Opus 5.5)
                        </Button>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {aiLoading && (
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <Loader2 className="h-12 w-12 text-accent-600 mx-auto animate-spin" />
                  <div>
                    <h3 className="text-lg font-bold">Plan wird erstellt...</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Claude Opus 5.5 analysiert deine Angaben und erstellt einen realistischen Plan.
                    </p>
                    <p className="text-sm text-gray-500 mt-1" role="status">
                      Das kann mehrere Minuten dauern. Bitte lass diese Seite geöffnet.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {aiResult && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Check className="h-4 w-4 text-accent-600" />
                        Dein Lernplan
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={handleGeneratePlan} disabled={aiLoading}>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Neu generieren
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {applyError && <p role="alert" className="text-sm text-red-700">{applyError}</p>}
                    {aiStructured && (
                      <div className="border border-accent-300 bg-accent-50 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="text-sm">
                          <p className="font-semibold text-slate-800">
                            {aiStructured.tasks.length} Tasks · {aiStructured.klausuren.length} Klausuren erkannt
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            In Tagesprogramm + Lernkalender übernehmen
                          </p>
                        </div>
                        {!aiApplied ? (
                          <Button size="sm" onClick={handleApplyPlan} className="shrink-0">
                            <Check className="h-4 w-4 mr-1" />
                            Übernehmen
                          </Button>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 shrink-0">
                            <Check className="h-3 w-3 mr-1" />
                            {aiApplied.tasksCreated} Tasks · {aiApplied.klausurenCreated} Klausuren
                          </Badge>
                        )}
                      </div>
                    )}
                    {aiStructured && <PlanningSourcePreview plan={aiStructured} />}
                    {aiApplied && <div role="status" className="text-sm text-slate-700">
                      <p>{aiApplied.moved} Aufgaben/Termine verschoben · {aiApplied.deferred} noch einzuplanen. Die übernommenen Daten stehen im <a href="/wochenplan" className="underline">Lernkalender</a>; der Text unten ist der ursprüngliche Vorschlag.</p>
                      {aiApplied.warnings.map(warning => <p key={warning} className="text-amber-800">{warning}</p>)}
                    </div>}
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                      {aiResult}
                    </div>
                  </CardContent>
                </Card>

                {/* Refinement-Feedback */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquarePlus className="h-4 w-4 text-accent-600" />
                      Plan anpassen
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-slate-500">
                      Nicht zufrieden? Schreib was stört — die KI überarbeitet den Plan mit deinem Feedback. Wiederholbar.
                    </p>
                    <Textarea
                      value={refinementFeedback}
                      onChange={e => setRefinementFeedback(e.target.value)}
                      placeholder="z.B. ÖR ist zu knapp, ich möchte mehr SR-Klausuren einplanen, die ersten 2 Wochen sind zu voll..."
                      rows={3}
                      className="text-sm"
                    />
                    <Button
                      onClick={handleRefinePlan}
                      disabled={!refinementFeedback.trim() || aiLoading}
                      className="w-full"
                      variant="outline"
                    >
                      {aiLoading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wird überarbeitet…</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> Verfeinern</>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Button
                  onClick={() => router.push("/")}
                  className="w-full bg-accent-600 hover:bg-accent-700"
                  size="lg"
                >
                  Zum Dashboard
                </Button>
              </div>
            )}
          </div>
        ))}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pb-8">
          <Button
            variant="outline"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zurück
          </Button>

          {step < STEPS.length - 1 && (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={data.documents.some(document => document.parseStatus === "pending")}
              className="bg-accent-600 hover:bg-accent-700"
            >
              Weiter
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
        </fieldset>
      </div>

      {/* Rep-Schedule-Preview-Dialog */}
      <ResetDialog open={!accountMode&&!!repParsePreview} onOpenChange={(open) => { if (!open) setRepParsePreview(null); }}>
        <ResetDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <ResetDialogHeader>
            <ResetDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-600" />
              Rep-Plan: Vorschau der erkannten Termine
            </ResetDialogTitle>
          </ResetDialogHeader>
          {repParsePreview && (
            <div className="space-y-3 px-1">
              <p className="text-xs text-slate-600">
                Die KI hat {repParsePreview.schedule.length} Termine im Doc gefunden. Pro Termin werden die erkannten Topics auf deine Tasks gemapped.
              </p>
              {(data?.reps || []).length > 1 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Du hast mehrere Reps. Der Plan wird dem ersten Rep zugewiesen.
                </div>
              )}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {repParsePreview.schedule.map((entry, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums">{entry.date}</span>
                      <span className="text-xs font-semibold text-slate-900">{entry.title}</span>
                      {entry.weekNumber && (
                        <span className="text-[10px] text-slate-400">W{entry.weekNumber}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{entry.content}</p>
                    <div className="flex flex-wrap gap-1">
                      {entry.topicIds.length > 0 ? entry.topicIds.map(tid => {
                        const topic = TOPICS.find(t => t.id === tid);
                        return (
                          <span key={tid} className="inline-block px-1.5 py-0.5 rounded bg-accent-50 border border-accent-200 text-[9px] text-accent-800">
                            {topic?.label || tid}
                          </span>
                        );
                      }) : (
                        <span className="text-[10px] italic text-slate-400">keine Topics zugeordnet</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white border-t border-slate-200 pt-3">
                <Button variant="outline" size="sm" onClick={() => setRepParsePreview(null)}>Abbrechen</Button>
                <Button size="sm" onClick={applyRepSchedule} className="bg-accent-600 hover:bg-accent-700 text-white">
                  Übernehmen ({repParsePreview.schedule.length} Termine)
                </Button>
              </div>
            </div>
          )}
        </ResetDialogContent>
      </ResetDialog>

      {/* Reset-Dialog */}
      <ResetDialog open={!accountMode&&resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <ResetDialogContent className="max-w-md">
          <ResetDialogHeader>
            <ResetDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Onboarding neu starten
            </ResetDialogTitle>
          </ResetDialogHeader>
          <div className="space-y-4 px-1">
            <p className="text-sm text-slate-600">
              Du kannst den Onboarding-Prozess auch mit existierendem Lernplan komplett neu starten. Wähle was zurückgesetzt werden soll:
            </p>
            <div className="space-y-3 rounded-xl border border-slate-200 p-3 bg-slate-50">
              <label className="flex items-start gap-2 text-sm cursor-not-allowed opacity-60">
                <input type="checkbox" checked disabled className="mt-1" />
                <div>
                  <div className="font-medium text-slate-900">Onboarding-Daten</div>
                  <div className="text-xs text-slate-500">Grunddaten, Termine, Selbsteinschätzung, Material — werden immer zurückgesetzt.</div>
                </div>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetWipePlan}
                  onChange={e => setResetWipePlan(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-slate-900">Existierender Lernplan + Plan-Tasks</div>
                  <div className="text-xs text-slate-500">Geplante Tasks, KI-generierte Klausurtermine, letzter KI-Plan, Plan-Historie. <strong>Manuelle Tasks bleiben erhalten.</strong> Klausuren-DB, Fortschritt &amp; Tracking-Historie ebenfalls.</div>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(false)}>Abbrechen</Button>
              <Button size="sm" onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white">
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Neustart bestätigen
              </Button>
            </div>
          </div>
        </ResetDialogContent>
      </ResetDialog>
    </div>
  );
}
