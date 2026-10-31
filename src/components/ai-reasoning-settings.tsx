"use client";

import { useEffect, useState } from "react";
import { AI_DEFAULTS, MODEL_REASONING, type ReasoningPreference, type ReasoningSettings } from "@/lib/ai-config";
import { getAiReasoningSettings, saveAiReasoningSettings } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LABELS: Record<ReasoningPreference, string> = {
  provider: "Anbietervorgabe", none: "Aus (none)", low: "Niedrig (low)", medium: "Mittel (medium)",
  high: "Hoch (high)", xhigh: "Sehr hoch (xhigh)", max: "Maximum (max)",
};
const TIERS = { premium: "Premium", strong: "Stark", cheap: "Günstig" };

export function AiReasoningSettings() {
  const [settings, setSettings] = useState<ReasoningSettings>({});
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    // Browser preferences are loaded only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(getAiReasoningSettings());
    setReady(true);
  }, []);

  function save(next: ReasoningSettings) {
    if (saveAiReasoningSettings(next)) {
      setSettings(next);
      setStatus("Gespeichert. Gilt für die nächsten KI-Anfragen.");
    } else {
      setStatus("Speichern fehlgeschlagen. Bitte den Browserspeicher prüfen.");
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-sm">Modelle und Denkaufwand (Reasoning)</CardTitle>
        <p className="text-xs text-gray-500">
          Mehr Denkaufwand kann Antworten verbessern, aber auch länger dauern und mehr kosten.
          Die Auswahl wird automatisch in diesem Browser gespeichert und gilt auch beim Lernplan und bei der Klausurkorrektur.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(AI_DEFAULTS).map(([tier, model]) => (
          <div key={model.id} className="grid gap-2 sm:grid-cols-2 sm:items-center">
            <label htmlFor={`reasoning-${tier}`} className="text-sm">
              <span className="block font-medium">{TIERS[tier as keyof typeof TIERS]}</span>
              <span className="text-xs text-gray-500">{model.label}</span>
            </label>
            <select
              id={`reasoning-${tier}`}
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              disabled={!ready}
              value={settings[model.id] ?? model.effort}
              onChange={event => save({ ...getAiReasoningSettings(), [model.id]: event.target.value as ReasoningPreference })}
            >
              <option value="provider">{LABELS.provider}</option>
              {MODEL_REASONING[model.id].map(effort => <option key={effort} value={effort}>{LABELS[effort]}</option>)}
            </select>
          </div>
        ))}
        <p className="text-xs text-gray-500">
          Bei DeepSeek entspricht „xhigh“ dem maximalen Denkaufwand. Anbietervorgabe überlässt den Denkaufwand dem Anbieter.
          Andere ausdrücklich ausgewählte Modelle behalten ihre eigenen Vorgaben.
        </p>
        <Button variant="outline" size="sm" disabled={!ready} onClick={() => save({})}>Standardwerte wiederherstellen</Button>
        {status && <p role="status" className="text-xs">{status}</p>}
      </CardContent>
    </Card>
  );
}
