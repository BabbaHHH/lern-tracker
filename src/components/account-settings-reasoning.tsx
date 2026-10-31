"use client";

import {useAccountSettings} from "@/lib/learning/use-account-settings";
import {plain,settingKey,type SettingRow} from "@/lib/learning/settings-contract";
import { AI_DEFAULTS, MODEL_REASONING, type ReasoningPreference, type ReasoningSettings } from "@/lib/ai-config";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LABELS: Record<ReasoningPreference, string> = {
  provider: "Anbietervorgabe", none: "Aus (none)", low: "Niedrig (low)", medium: "Mittel (medium)",
  high: "Hoch (high)", xhigh: "Sehr hoch (xhigh)", max: "Maximum (max)",
};
const TIERS = { premium: "Premium", strong: "Stark", cheap: "Günstig" };

export function AccountSettingsReasoning({row}:{row:SettingRow}) {
 const s=useAccountSettings(),b=s.buffers[settingKey(row)];
 const settings={...(plain(row.payload)?row.payload:{}),...b?.patch} as ReasoningSettings;
 const ready=!s.hidden&&!s.busy&&!s.uncertain&&row.editable;
 const status=b?'Änderungen noch nicht bestätigt.':row.revision===null?'Ungespeicherte Vorgabe':`Bestätigter Stand ${row.revision}`;
 function save(next:ReasoningSettings){for(const [key,value] of Object.entries(next))s.client.edit(row,key,value);}
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-sm">Modelle und Denkaufwand (Reasoning)</CardTitle>
        <p className="text-xs text-gray-500">
          Mehr Denkaufwand kann Antworten verbessern, aber auch länger dauern und mehr kosten.
          Die Auswahl gehört zu deinem Konto und wird erst mit „Denkaufwand speichern“ bestätigt. KI-Aufrufe bleiben gesperrt.
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
              onChange={event => save({ [model.id]: event.target.value as ReasoningPreference })}
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
        <Button variant="outline" size="sm" disabled={!ready} onClick={() => void s.client.save(row,true)}>Standardwerte wiederherstellen</Button>
        <Button size="sm" disabled={!ready||!b||b.revision!==row.revision} onClick={()=>void s.client.save(row)}>Denkaufwand speichern</Button>
        {status && <p role="status" className="text-xs">{status}</p>}
      </CardContent>
    </Card>
  );
}
