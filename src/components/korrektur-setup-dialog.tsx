"use client";

// Korrektur-Setup: macht die 3-Ebenen-Prompt-Hierarchie im Schreibtool sichtbar
// und editierbar.
//   Ebene 1 (Master)      — gilt für alle Klausuren, via PromptGear editierbar.
//   Ebene 2 (Klausurtyp)  — formspezifisch (Urteil/Anwaltsklausur/…), via PromptGear.
//   Ebene 3 (Fehlerprofil)— die lernende Schicht: read-only Einsicht + Reset.
// So sieht der Nutzer, *was* die KI als System-Prompt bekommt, und kann die Ebene 3
// (sein wachsendes Fehlerprofil) einsehen — bislang lag die nur unsichtbar im localStorage.

import { useState } from "react";
import { format as formatDate } from "date-fns";
import { SlidersHorizontal, Layers, Scale, Brain, RotateCcw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PromptGear } from "@/components/prompt-gear";
import {
  getPromptById,
  KORREKTUR_MASTER_PROMPT_ID,
  KORREKTUR_GENERISCH_PROMPT_ID,
  resolveKlausurtypPromptId,
} from "@/lib/prompts";
import { getFehlerProfil, resetFehlerProfil } from "@/lib/store";
import type { KlausurType, FehlerProfil, TrendDir } from "@/lib/types";

interface Props {
  /** Klausurtyp des Entwurfs → bestimmt die Ebene-2-Prompt-Auswahl. */
  type?: KlausurType;
}

const TREND_META: Record<TrendDir, { label: string; cls: string }> = {
  neu: { label: "neu", cls: "bg-sky-50 text-sky-600 border-sky-200" },
  steigend: { label: "↑ häufiger", cls: "bg-rose-50 text-rose-600 border-rose-200" },
  konstant: { label: "konstant", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  fallend: { label: "↓ seltener", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d.getTime() === 0) return "—";
  // date-fns statt toLocaleDateString — ICU-unabhängig, kein Hydration-Risiko
  return formatDate(d, "dd.MM.yy");
}

export function KorrekturSetupDialog({ type }: Props) {
  const [open, setOpen] = useState(false);
  const [profil, setProfil] = useState<FehlerProfil | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const reload = () => setProfil(getFehlerProfil());

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      reload();
      setConfirmReset(false);
    }
  };

  // Ebene-2-Prompt für diesen Klausurtyp auflösen (Fallback = generisch).
  const ebene2Id = resolveKlausurtypPromptId(type);
  const ebene2IsFallback = ebene2Id === KORREKTUR_GENERISCH_PROMPT_ID;
  const masterLabel = getPromptById(KORREKTUR_MASTER_PROMPT_ID)?.label ?? "Master-Prompt";
  const ebene2Label = getPromptById(ebene2Id)?.label ?? "Ebene-2-Prompt";

  const markers = profil
    ? Object.entries(profil.markers).sort(
        (a, b) => b[1].count - a[1].count || b[1].lastSeen.localeCompare(a[1].lastSeen),
      )
    : [];

  const handleReset = () => {
    resetFehlerProfil();
    reload();
    setConfirmReset(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" title="Korrektur-Prompts & Fehlerprofil ansehen" />}
      >
        <SlidersHorizontal className="h-4 w-4" /> Korrektur-Setup
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Korrektur-Setup — 3-Ebenen-Prompt</DialogTitle>
          <p className="text-xs leading-relaxed text-slate-500">
            Der System-Prompt der KI wird aus drei Schichten zusammengesetzt. Ebene&nbsp;1 und&nbsp;2 sind
            der feste Kern (von dir editierbar) — die KI-Lernschleife schreibt nie hinein. Ebene&nbsp;3 ist
            die <span className="font-medium text-slate-600">einzige</span> Schicht, die sich automatisch
            verändert: dein wachsendes Fehlerprofil.
          </p>
        </DialogHeader>

        {/* Ebene 1 */}
        <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">Ebene 1</Badge>
              <span className="text-xs font-semibold text-slate-700">{masterLabel}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Globale Korrekturdoktrin für <span className="font-medium">alle</span> Klausuren: strenger
              Zweitkorrektor, Richterstil, Sorgfaltsmaßstäbe — und das Antwortformat (Prosa + Marker-JSON).
            </p>
          </div>
          <PromptGear promptId={KORREKTUR_MASTER_PROMPT_ID} />
        </div>

        {/* Ebene 2 */}
        <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">Ebene 2</Badge>
              <span className="text-xs font-semibold text-slate-700">{ebene2Label}</span>
              {ebene2IsFallback && (
                <Badge variant="outline" className="text-[9px] text-amber-600">Fallback</Badge>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {type
                ? ebene2IsFallback
                  ? <>Für den Typ <span className="font-medium">{type}</span> gibt es noch keinen eigenen Prompt → es greift der generische Aufbau-/Formhinweis.</>
                  : <>Formspezifisch für <span className="font-medium">{type}</span> (Aufbau, Stil, typische Sorgfaltsfehler dieser Klausurform).</>
                : <>Kein Klausurtyp gesetzt → generischer Aufbau-/Formhinweis.</>}
            </p>
          </div>
          <PromptGear promptId={ebene2Id} />
        </div>

        {/* Ebene 3 — Fehlerprofil */}
        <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <div className="flex items-start gap-3">
            <Brain className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">Ebene 3</Badge>
                <span className="text-xs font-semibold text-slate-700">Lernendes Fehlerprofil</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Nach jeder Korrektur extrahiert die KI <span className="font-medium">Marker</span> (wiederkehrende
                Stil-/Sorgfaltsmuster) und zählt sie hier hoch. Bei der nächsten Korrektur werden die häufigsten
                Marker als Kontext mitgegeben — die KI achtet gezielt auf <span className="font-medium">deine</span>
                {" "}Muster und benennt Rückfälle. So wird das Feedback über mehrere Klausuren persönlicher.
              </p>
            </div>
          </div>

          {/* Marker-Liste */}
          {markers.length === 0 ? (
            <p className="mt-3 rounded border border-dashed border-slate-300 bg-white px-3 py-3 text-center text-[11px] text-slate-400">
              Noch keine Muster erfasst. Nach deiner ersten Korrektur tauchen hier deine wiederkehrenden
              Stil- und Sorgfaltsmuster auf.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {markers.map(([key, e]) => {
                const tm = TREND_META[e.trend] ?? TREND_META.konstant;
                const byType = Object.entries(e.byType ?? {});
                return (
                  <li key={key} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2.5 py-1.5">
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 px-1.5 text-[10px] font-bold text-white tabular-nums">
                      {e.count}×
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-700">{e.label}</div>
                      <div className="text-[10px] text-slate-400">
                        zuletzt {fmtDate(e.lastSeen)}
                        {byType.length > 0 && <> · {byType.map(([t, n]) => `${t} ${n}`).join(" · ")}</>}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${tm.cls}`}>
                      {tm.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Reset */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-2.5">
            <span className="text-[10px] text-slate-400">
              {profil && markers.length > 0 ? `Aktualisiert ${fmtDate(profil.updatedAt)}` : ""}
            </span>
            {confirmReset ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-rose-600">Profil wirklich löschen?</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmReset(false)}>
                  Abbrechen
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs text-rose-600" onClick={handleReset}>
                  Löschen
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-500"
                onClick={() => setConfirmReset(true)}
                disabled={markers.length === 0}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Profil zurücksetzen
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
