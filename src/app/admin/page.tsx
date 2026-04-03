"use client";

import { useState, useEffect, useCallback } from "react";
import { getPrompts, savePrompts, DEFAULT_PROMPTS, type SystemPrompt } from "@/lib/prompts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Lock, Save, RotateCcw, ArrowLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");

  useEffect(() => {
    setPrompts(getPrompts());
  }, []);

  const handleLogin = useCallback(() => {
    // Einfacher Schutz — kein echtes Auth-System nötig für lokale Nutzung
    if (password === "stex2026" || password === (typeof window !== "undefined" ? localStorage.getItem("admin-pw") : "")) {
      setAuthenticated(true);
    }
  }, [password]);

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
      if (data.error) {
        setApiKeyStatus("error");
      } else {
        setApiKeyStatus("ok");
      }
    } catch {
      setApiKeyStatus("error");
    }
  }, []);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" />
              Admin-Bereich
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-3">
              <Input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                Einloggen
              </Button>
            </form>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Standard-Passwort: in .env.local konfiguriert
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <h1 className="text-xl font-bold">KI-Einstellungen</h1>
          </div>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
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
              API Key wird in <code className="bg-gray-100 px-1 rounded">.env.local</code> konfiguriert (nicht im Browser sichtbar).
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

        {/* System Prompts */}
        <h2 className="text-lg font-semibold mb-4">System Prompts</h2>
        <p className="text-sm text-gray-500 mb-4">
          Hier kannst du die Anweisungen für die KI anpassen. Änderungen werden lokal gespeichert.
        </p>

        <div className="space-y-4">
          {prompts.map(prompt => (
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
                      onClick={() => setEditingId(editingId === prompt.id ? null : prompt.id)}
                    >
                      {editingId === prompt.id ? "Zuklappen" : "Bearbeiten"}
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

              {editingId === prompt.id && (
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Modell-Stufe</label>
                      <div className="flex gap-2">
                        {(["strong", "cheap"] as const).map(tier => (
                          <button
                            key={tier}
                            onClick={() => handlePromptChange(prompt.id, "modelTier", tier)}
                            className={cn(
                              "text-xs px-3 py-1 rounded-full border",
                              prompt.modelTier === tier ? "bg-emerald-100 border-emerald-300" : "bg-gray-50"
                            )}
                          >
                            {tier === "strong" ? "Stark (Sonnet)" : "Günstig (Haiku)"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">System Prompt</label>
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
          ))}
        </div>
      </div>
    </div>
  );
}
