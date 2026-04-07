"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getOnboarding, saveOnboarding, resetOnboarding,
  setExamDate, setLernstart,
  type OnboardingData,
} from "@/lib/store";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { Area, AREA_LABELS, AREA_COLORS_LIGHT } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, ArrowRight, RotateCcw, Upload, FileText,
  X, GraduationCap, Calendar, BookOpen, Brain, Sparkles, Loader2, Check
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "basics", label: "Grunddaten", icon: GraduationCap },
  { id: "calendar", label: "Termine", icon: Calendar },
  { id: "assessment", label: "Selbsteinschätzung", icon: Brain },
  { id: "documents", label: "Material", icon: BookOpen },
  { id: "generate", label: "Plan erstellen", icon: Sparkles },
];

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

// Zwischenebene-Themen für Selbsteinschätzung (nicht Blätter, nicht Root)
function getAssessmentTopics() {
  return TOPICS.filter(t =>
    t.parentId !== null &&
    !["zr", "oeffr", "sr"].includes(t.id) &&
    TOPICS.some(child => child.parentId === t.id)
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(getOnboarding());
  }, []);

  const update = useCallback((partial: Partial<OnboardingData>) => {
    setData(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      saveOnboarding(updated);
      return updated;
    });
  }, []);

  const handleReset = useCallback(() => {
    resetOnboarding();
    setData(getOnboarding());
    setStep(0);
    setAiResult(null);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !data) return;

    const newDocs = Array.from(files).map(f => ({
      name: f.name,
      type: f.type || "unknown",
    }));

    update({ documents: [...data.documents, ...newDocs] });
    e.target.value = "";
  }, [data, update]);

  const removeDocument = useCallback((index: number) => {
    if (!data) return;
    const docs = [...data.documents];
    docs.splice(index, 1);
    update({ documents: docs });
  }, [data, update]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || !data) return;

    const newDocs = Array.from(files).map(f => ({
      name: f.name,
      type: f.type || "unknown",
    }));

    update({ documents: [...data.documents, ...newDocs] });
  }, [data, update]);

  const handleGeneratePlan = useCallback(async () => {
    if (!data) return;
    setAiLoading(true);
    setAiResult(null);

    // Selbsteinschätzung formatieren
    const assessmentTopics = getAssessmentTopics();
    const assessmentText = assessmentTopics
      .map(t => `${t.label} (${AREA_LABELS[t.area]}): ${data.selfAssessment[t.id] ?? "nicht bewertet"}%`)
      .join("\n");

    const docsText = data.documents.length > 0
      ? data.documents.map(d => d.name).join(", ")
      : "Keine Dokumente hochgeladen";

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Du bist ein erfahrener Examenscoach für das 2. juristische Staatsexamen in Berlin (GJPA).

Erstelle einen individuellen, realistischen Lernplan. Prüfe KRITISCH die Machbarkeit.

FESTE REGELN:
- Examen: 7 Klausuren (3 ZR, 2 ÖffR, 2 SR) + Aktenvortrag
- MINDESTENS 1 Klausur pro Woche unter Realbedingungen (5h)
- Mindestens 1 freier Tag/Woche (Burnout-Prävention)
- 90-Minuten-Sprints (ultradiane Rhythmen), 4 Sprints/Tag
- Interleaving: Tägliche Rotation ZR/ÖffR/SR
- Spaced Repetition: Wiederholung nach 1, 3, 7, 30 Tagen

PHASEN-LOGIK:
- Aufbau (Wochen 1-10): Wissenslücken schließen, Systemübersichten, 1 Klausur/Woche
- Probeexamen 1 (~Woche 9-10): 6 Klausuren in 2 Wochen
- Output (Wochen 11-16): Falllösung, Klausuren schreiben, 1-2 Klausuren/Woche
- Probeexamen 2 (~Woche 13-14): 6 Klausuren in 2 Wochen
- Puffer (Wochen 17-18): Verzögerungen auffangen
- Tapering (Wochen 19-20): NUR Wiederholung, keine neuen Inhalte

Antworte auf Deutsch. Sei motivierend aber ehrlich wenn der Plan unrealistisch ist.
Strukturiere den Plan nach Wochen mit konkreten Themen und Klausurtagen.`,
            },
            {
              role: "user",
              content: `Hier sind meine Daten:

GRUNDDATEN:
- Bundesland: ${data.bundesland}
- Examenstermin: ${data.examDate}
- Lernstart: ${data.lernstart}
- AG: ${data.agDay}${data.agTopic ? ` (${data.agTopic})` : ""}
- Kiss Rep: ${data.repDay}
- Kaiserseminare: ${data.kaiserDates.length > 0 ? data.kaiserDates.join(", ") : "keine geplant"}
- Probeexamen 1: ${data.probeexamen1Start}
- Probeexamen 2: ${data.probeexamen2Start}
- Freier Tag: ${data.freeDayPerWeek}
- Urlaub: ${data.vacationDates.length > 0 ? data.vacationDates.join(", ") : "keiner geplant"}

SELBSTEINSCHÄTZUNG:
${assessmentText}

MATERIAL:
${docsText}

ZUSÄTZLICHE NOTIZEN:
${data.notes || "keine"}

Bitte erstelle meinen individuellen Lernplan!`,
            },
          ],
          tier: "strong",
        }),
      });

      const result = await res.json();
      if (result.error) {
        setAiResult(`Fehler: ${result.error}`);
      } else {
        setAiResult(result.reply);
        update({ completed: true });
        setExamDate(data.examDate);
        setLernstart(data.lernstart);
      }
    } catch {
      setAiResult("Verbindungsfehler. Bitte prüfe deine API-Konfiguration.");
    }

    setAiLoading(false);
  }, [data, update]);

  if (!data) return null;

  const currentStep = STEPS[step];
  const assessmentTopics = getAssessmentTopics();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Onboarding</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-gray-500">
            <RotateCcw className="h-4 w-4 mr-1" />
            Neustart
          </Button>
        </div>

        {/* Step Indicators */}
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
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
                    <Input value={data.bundesland} onChange={e => update({ bundesland: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Examenstermin</label>
                    <Input type="date" value={data.examDate} onChange={e => update({ examDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Lernstart</label>
                    <Input type="date" value={data.lernstart} onChange={e => update({ lernstart: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Freier Tag / Woche</label>
                    <select
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

            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium">Zusätzliche Notizen</p>
                <Textarea
                  value={data.notes}
                  onChange={e => update({ notes: e.target.value })}
                  placeholder="z.B. besondere Umstände, Schwerpunkte, Wünsche..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 2: Termine */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Wiederkehrende Termine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">AG — Wochentag</label>
                    <select
                      value={data.agDay}
                      onChange={e => update({ agDay: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">AG — Thema (optional)</label>
                    <Input
                      value={data.agTopic}
                      onChange={e => update({ agTopic: e.target.value })}
                      placeholder="z.B. Zivilrecht"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Kiss Rep — Wochentag</label>
                    <select
                      value={data.repDay}
                      onChange={e => update({ repDay: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Probeexamen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Probeexamen 1 — Start</label>
                    <Input type="date" value={data.probeexamen1Start} onChange={e => update({ probeexamen1Start: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Probeexamen 2 — Start</label>
                    <Input type="date" value={data.probeexamen2Start} onChange={e => update({ probeexamen2Start: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Jeweils 2 Wochen, 6 Klausuren unter Realbedingungen</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Kaiserseminare (optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    id="kaiser-date-input"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById("kaiser-date-input") as HTMLInputElement;
                      if (input?.value) {
                        update({ kaiserDates: [...data.kaiserDates, input.value] });
                        input.value = "";
                      }
                    }}
                  >
                    Hinzufügen
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.kaiserDates.map((d, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {d}
                      <button onClick={() => update({ kaiserDates: data.kaiserDates.filter((_, j) => j !== i) })}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
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
          </div>
        )}

        {/* STEP 3: Selbsteinschätzung */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">
              Wie sicher fühlst du dich in jedem Bereich? (0% = keine Ahnung, 100% = sitzt)
            </p>

            {(["zr", "oeffr", "sr"] as Area[]).map(area => {
              const areaTopics = assessmentTopics.filter(t => t.area === area);
              return (
                <Card key={area}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      <Badge className={cn("text-xs", AREA_COLORS_LIGHT[area])}>{AREA_LABELS[area]}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {areaTopics.map(topic => (
                      <div key={topic.id} className="flex items-center gap-3">
                        <span className="text-sm flex-1 min-w-0 truncate">{topic.label}</span>
                        <div className="flex items-center gap-2 w-40 shrink-0">
                          <Slider
                            value={[data.selfAssessment[topic.id] ?? 0]}
                            onValueChange={(val) => {
                              const v = Array.isArray(val) ? val[0] : val;
                              update({
                                selfAssessment: { ...data.selfAssessment, [topic.id]: v },
                              });
                            }}
                            max={100}
                            step={10}
                          />
                          <span className="text-xs font-bold w-8 text-right text-gray-500">
                            {data.selfAssessment[topic.id] ?? 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* STEP 4: Material / Dokumente */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">
              Lade dein Lernmaterial hoch — Skripte, Karteikarten, Übersichten, Klausuren. Die KI berücksichtigt es bei der Planerstellung.
            </p>

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
              <p className="text-xs text-gray-400 mt-1">PDF, Bilder, Word, Text</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.heic"
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
                <CardContent className="space-y-1">
                  {data.documents.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="text-sm flex-1 truncate">{doc.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {doc.type.split("/").pop() || "?"}
                      </Badge>
                      <button onClick={() => removeDocument(i)}>
                        <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* STEP 5: Plan generieren */}
        {step === 4 && (
          <div className="space-y-4">
            {!aiResult && !aiLoading && (
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <Sparkles className="h-12 w-12 text-accent-600 mx-auto" />
                  <div>
                    <h3 className="text-lg font-bold">Bereit für deinen Lernplan!</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Die KI erstellt einen individuellen Plan basierend auf deinen Angaben.
                      Mind. 1 Klausur/Woche ist eingeplant.
                    </p>
                  </div>

                  {/* Zusammenfassung */}
                  <div className="text-left bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                    <p><strong>Bundesland:</strong> {data.bundesland}</p>
                    <p><strong>Lernstart:</strong> {data.lernstart}</p>
                    <p><strong>Examen:</strong> {data.examDate}</p>
                    <p><strong>AG:</strong> {data.agDay} {data.agTopic && `(${data.agTopic})`}</p>
                    <p><strong>Rep:</strong> {data.repDay}</p>
                    <p><strong>Freier Tag:</strong> {data.freeDayPerWeek}</p>
                    <p><strong>Dokumente:</strong> {data.documents.length} hochgeladen</p>
                    <p><strong>Klausurpflicht:</strong> Mind. 1x/Woche</p>
                  </div>

                  <Button
                    onClick={handleGeneratePlan}
                    className="bg-accent-600 hover:bg-accent-700 w-full"
                    size="lg"
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    Lernplan generieren (Claude Sonnet)
                  </Button>
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
                      Claude Sonnet 4 analysiert deine Angaben und erstellt einen realistischen Plan.
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
                  <CardContent>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                      {aiResult}
                    </div>
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
        )}

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
              className="bg-accent-600 hover:bg-accent-700"
            >
              Weiter
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
