"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, Sparkles, RotateCcw, Save } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getPromptById, updatePrompt, resetPrompt, type SystemPrompt,
} from "@/lib/prompts";

interface PromptGearProps {
  promptId: string;
  /** Optional: kleine Variante (nur Icon ohne Border) */
  compact?: boolean;
}

export function PromptGear({ promptId, compact }: PromptGearProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<SystemPrompt | null>(null);
  const [draft, setDraft] = useState("");
  const [instruction, setInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewritten, setRewritten] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const p = getPromptById(promptId);
    if (p) {
      // Prompt-Daten aus localStorage laden wenn Dialog öffnet — SSR-safe Pattern
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrompt(p);
      setDraft(p.prompt);
      setRewritten(null);
      setInstruction("");
    }
  }, [open, promptId]);

  if (!prompt && !open) {
    // Render trigger only
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              variant={compact ? "ghost" : "outline"}
              size="icon-sm"
              title="Prompt bearbeiten"
            />
          }
        >
          <Settings className="h-3.5 w-3.5" />
        </DialogTrigger>
      </Dialog>
    );
  }

  const handleSave = () => {
    updatePrompt(promptId, draft);
    setOpen(false);
  };

  const handleReset = () => {
    resetPrompt(promptId);
    const p = getPromptById(promptId);
    if (p) {
      setPrompt(p);
      setDraft(p.prompt);
      setRewritten(null);
    }
  };

  const handleRewrite = async () => {
    if (!instruction.trim() || !prompt) return;
    setRewriting(true);
    setRewritten(null);
    try {
      const rewriter = getPromptById("prompt-rewriter");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: rewriter?.prompt || "" },
            {
              role: "user",
              content: `BESTEHENDER PROMPT:\n${draft}\n\nÄNDERUNGSWUNSCH:\n${instruction}`,
            },
          ],
          tier: rewriter?.modelTier || "strong",
        }),
      });
      const data = await res.json();
      if (data.reply) setRewritten(data.reply);
      else setRewritten(`Fehler: ${data.error || "unbekannt"}`);
    } catch {
      setRewritten("KI gerade nicht erreichbar.");
    }
    setRewriting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={compact ? "ghost" : "outline"}
            size="icon-sm"
            title="Prompt bearbeiten"
          />
        }
      >
        <Settings className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {prompt?.label || "Prompt"}
            {prompt && (
              <Badge variant="outline" className="text-[10px]">
                {prompt.modelTier}
              </Badge>
            )}
          </DialogTitle>
          {prompt?.description && (
            <p className="text-xs text-slate-500">{prompt.description}</p>
          )}
        </DialogHeader>

        {prompt && prompt.contextFlags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {prompt.contextFlags.map((f) => (
              <Badge key={f} variant="secondary" className="text-[10px]">
                {f}
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">System-Prompt</label>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            className="font-mono text-xs resize-y"
          />
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-3">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> KI verbessern
          </label>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            placeholder="Was soll geändert werden? z.B. 'Fokussiere mehr auf Klausurpraxis'"
            className="text-xs resize-none"
          />
          <Button
            onClick={handleRewrite}
            disabled={rewriting || !instruction.trim()}
            size="sm"
            variant="outline"
            className="w-full"
          >
            {rewriting ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Schreibe um...</>
            ) : (
              <><Sparkles className="h-3 w-3 mr-1" /> Vorschlag generieren</>
            )}
          </Button>

          {rewritten && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Neuer Vorschlag (editierbar)</label>
              <Textarea
                value={rewritten}
                onChange={(e) => setRewritten(e.target.value)}
                rows={12}
                className="font-mono text-xs resize-y border-purple-300"
              />
              <Button
                onClick={() => {
                  setDraft(rewritten);
                  setRewritten(null);
                  setInstruction("");
                }}
                size="sm"
                className="w-full"
              >
                Übernehmen (in Editor oben)
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" /> Zurücksetzen
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-3 w-3 mr-1" /> Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
