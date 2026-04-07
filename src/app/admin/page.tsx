"use client";

import { useState, useEffect, useCallback } from "react";
import { getPrompts, savePrompts, DEFAULT_PROMPTS, type SystemPrompt } from "@/lib/prompts";
import {
  getRecommenderWeights, saveRecommenderWeights, resetRecommenderWeights,
  DEFAULT_WEIGHTS, WEIGHT_LABELS, type RecommenderWeights,
} from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, RotateCcw, ArrowLeft, Sparkles, Loader2, Send, Scale, Sliders } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");

  // KI-Prompt-Editor State
  const [aiInstruction, setAiInstruction] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  // Recommender Weights
  const [weights, setWeights] = useState<RecommenderWeights>(DEFAULT_WEIGHTS);
  const [weightsSaved, setWeightsSaved] = useState(false);

  useEffect(() => {
    setPrompts(getPrompts());
    setWeights(getRecommenderWeights());
  }, []);

  const handleSave = useCallback(() => {
    savePrompts(prompts);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [prompts]);

  const handleReset = useCallback((id: string) => {
    const defaultPrompt = DEFAULT_PROMPTS.find(p => p.id === id);
    if (defaultPrompt) {
      setPrompts(prev => prev.map(p => p.id === id ? { ...defaultPrompt } : p));
    }
  }, []);

  const handlePromptChange = useCallback((id: string, field: keyof SystemPrompt, value: string) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }, []);

  const handleTestApi = useCallback(async () => {
    setApiKeyStatus("testing");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Antworte mit genau einem Wort: OK" },
            { role: "user", content: "Test" },
          ],
          tier: "cheap",
        }),
      });
      const data = await res.json();
      setApiKeyStatus(data.error ? "error" : "ok");
    } catch {
      setApiKeyStatus("error");
    }
  }, []);

  // KI-gestützte Prompt-Bearbeitung
  const handleAiEdit = useCallback(async (promptId: string) => {
    const instruction = aiInstruction[promptId]?.trim();
    if (!instruction) return;

    const currentPrompt = prompts.find(p => p.id === promptId);
    if (!currentPrompt) return;

    setAiLoading(promptId);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Du bist ein Experte für System-Prompt-Engineering. Der User hat einen System Prompt für eine Lern-Tracker-App (2. juristisches Staatsexamen).

Deine Aufgabe: Passe den bestehenden System Prompt nach der Anweisung des Users an.

REGELN:
- Gib NUR den neuen, vollständigen System Prompt zurück, NICHTS anderes
- Keine Erklärungen, kein Markdown-Codeblock, nur den reinen Prompt-Text
- Behalte die Grundstruktur bei, es sei denn der User will sie ändern
- Der Prompt soll auf Deutsch sein`,
            },
            {
              role: "user",
              content: `Hier ist der aktuelle System Prompt:

---
${currentPrompt.prompt}
---

Bitte ändere ihn wie folgt: ${instruction}`,
            },
          ],
          tier: "cheap",
        }),
      });

      const data = await res.json();

      if (data.reply && !data.error) {
        // Bereinige mögliche Markdown-Codeblöcke
        let newPrompt = data.reply.trim();
        newPrompt = newPrompt.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();

        setPrompts(prev =>
          prev.map(p => p.id === promptId ? { ...p, prompt: newPrompt } : p)
        );
        setAiInstruction(prev => ({ ...prev, [promptId]: "" }));
      }
    } catch {
      // Fehler still ignorieren — User sieht dass nichts passiert ist
    }

    setAiLoading(null);
  }, [prompts, aiInstruction]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">KI-Einstellungen</h1>
          </div>
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="h-4 w-4 mr-2" />
            {saved ? "Gespeichert!" : "Speichern"}
          </Button>
        </div>

        {/* API Key Test */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">API-Verbindung testen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              API Keys werden in <code className="bg-gray-100 px-1 rounded">.env.local</code> konfiguriert.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleTestApi}
                variant="outline"
                size="sm"
                disabled={apiKeyStatus === "testing"}
              >
                {apiKeyStatus === "testing" ? "Teste..." : "API testen"}
              </Button>
              {apiKeyStatus === "ok" && <Badge className="bg-green-100 text-green-700">Verbunden</Badge>}
              {apiKeyStatus === "error" && <Badge className="bg-red-100 text-red-700">Fehler — Key prüfen</Badge>}
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        {/* Recommender Weights */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sliders className="h-4 w-4 text-orange-500" />
                Klausur-Empfehlung — Gewichtung
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetRecommenderWeights();
                    setWeights(DEFAULT_WEIGHTS);
                  }}
                  title="Auf Standard zurücksetzen"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Steuert wie die tägliche Klausur-Empfehlung berechnet wird. Positive Werte = bevorzugen, negative = bestrafen.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(Object.keys(WEIGHT_LABELS) as (keyof RecommenderWeights)[]).map(key => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-xs text-slate-600 flex-1 min-w-0">
                    {WEIGHT_LABELS[key]}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="range"
                      min={key === "kuerzlichGeschrieben" ? -100 : 0}
                      max={100}
                      value={weights[key]}
                      onChange={e => setWeights(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                      className="w-24 h-1.5 accent-orange-500"
                    />
                    <input
                      type="number"
                      value={weights[key]}
                      onChange={e => setWeights(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                      className="w-14 text-xs text-center border rounded-lg px-1 py-1 bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  saveRecommenderWeights(weights);
                  setWeightsSaved(true);
                  setTimeout(() => setWeightsSaved(false), 2000);
                }}
                className="bg-orange-500 hover:bg-orange-600 text-xs rounded-lg"
              >
                <Save className="h-3 w-3 mr-1" />
                {weightsSaved ? "Gespeichert!" : "Gewichte speichern"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        {/* System Prompts */}
        <h2 className="text-lg font-semibold mb-4">System Prompts</h2>
        <p className="text-sm text-gray-500 mb-4">
          Anweisungen für die KI. Du kannst sie manuell bearbeiten oder per KI anpassen lassen.
        </p>

        <div className="space-y-4">
          {prompts.map(prompt => {
            const isEditing = editingId === prompt.id;
            const isAiLoading = aiLoading === prompt.id;

            return (
              <Card key={prompt.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {prompt.label}
                      <Badge variant="outline" className="text-xs">
                        {prompt.modelTier === "strong" ? "Starkes Modell" : "Günstiges Modell"}
                      </Badge>
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(isEditing ? null : prompt.id)}
                      >
                        {isEditing ? "Zuklappen" : "Bearbeiten"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReset(prompt.id)}
                        title="Auf Standard zurücksetzen"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{prompt.description}</p>
                </CardHeader>

                {isEditing && (
                  <CardContent>
                    <div className="space-y-4">
                      {/* Modell-Stufe */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Modell-Stufe</label>
                        <div className="flex gap-2">
                          {(["strong", "cheap"] as const).map(tier => (
                            <button
                              key={tier}
                              onClick={() => handlePromptChange(prompt.id, "modelTier", tier)}
                              className={cn(
                                "text-xs px-3 py-1 rounded-full border",
                                prompt.modelTier === tier ? "bg-indigo-100 border-indigo-300" : "bg-gray-50"
                              )}
                            >
                              {tier === "strong" ? "Stark (Sonnet)" : "Günstig (Gemini Flash)"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* KI-gestützte Bearbeitung */}
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <label className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          Per KI anpassen
                        </label>
                        <div className="flex gap-2">
                          <Input
                            value={aiInstruction[prompt.id] || ""}
                            onChange={(e) => setAiInstruction(prev => ({ ...prev, [prompt.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleAiEdit(prompt.id)}
                            placeholder="z.B. 'Mach den Ton strenger' oder 'Füge Spaced Repetition Logik hinzu'"
                            disabled={isAiLoading}
                            className="text-sm bg-white"
                          />
                          <Button
                            onClick={() => handleAiEdit(prompt.id)}
                            disabled={isAiLoading || !aiInstruction[prompt.id]?.trim()}
                            size="icon"
                            className="bg-purple-600 hover:bg-purple-700 shrink-0"
                          >
                            {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-[10px] text-purple-500 mt-1.5">
                          Beschreibe in natürlicher Sprache, was du ändern willst. Die KI passt den Prompt an.
                        </p>
                      </div>

                      {/* Manueller Editor */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">System Prompt (manuell)</label>
                        <Textarea
                          value={prompt.prompt}
                          onChange={(e) => handlePromptChange(prompt.id, "prompt", e.target.value)}
                          rows={12}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
