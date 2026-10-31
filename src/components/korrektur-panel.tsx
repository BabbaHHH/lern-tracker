"use client";

// Zeigt den Feedback-Verlauf eines Entwurfs: Prosa-Feedback + Marker-Badges.

import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquareText, AlertCircle } from "lucide-react";
import type { KlausurFeedback } from "@/lib/types";
import { getKorrekturModel } from "@/lib/ai-models";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";

const SCOPE_LABEL: Record<KlausurFeedback["scope"], string> = {
  wort: "Wort",
  satz: "Satz",
  absatz: "Absatz",
  abschnitt: "Abschnitt",
  gesamt: "Gesamt",
};

const SEVERITY_STYLE: Record<NonNullable<KlausurFeedback["markers"][number]["severity"]>, string> = {
  hoch: "bg-rose-100 text-rose-700",
  mittel: "bg-amber-100 text-amber-700",
  niedrig: "bg-slate-100 text-slate-600",
};

interface KorrekturPanelProps {
  feedback: KlausurFeedback[];
  loading?: boolean;
  error?: string | null;
}

export function KorrekturPanel({ feedback, loading, error }: KorrekturPanelProps) {
  // Neueste zuerst: createdAt absteigend (Feedback wird angehängt → ohne Sort
  // landet die frische Korrektur ganz unten und „verschwindet" im Verlauf).
  const sorted = [...feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        <MessageSquareText className="h-3.5 w-3.5" />
        Korrektur
      </div>

      {loading && (
        <div className="flex items-center gap-2 border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> KI prüft …
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {feedback.length === 0 && !loading && !error && (
        <div className="border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-400">
          Noch kein Feedback. Markiere einen Abschnitt und klicke „Abschnitt prüfen“
          oder hol dir ein „Gesamt-Feedback“.
        </div>
      )}

      {sorted.map((fb, idx) => {
        const model = getKorrekturModel(fb.model);
        const isNewest = idx === 0;
        return (
          <div key={fb.id} className="contents">
          {idx === 1 && (
            <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              Ältere Korrekturen
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          )}
          <div
            key={`${fb.id}-card`}
            className={cn(
              "bg-white p-3",
              isNewest
                ? "border-2 border-emerald-300 shadow-sm ring-1 ring-emerald-100"
                : "border border-slate-200",
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">{SCOPE_LABEL[fb.scope]}</Badge>
                {isNewest && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Neueste
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400">
                {model?.label ?? fb.model} · {formatDate(new Date(fb.createdAt), "dd.MM., HH:mm")}
              </span>
            </div>

            {fb.excerpt && (
              <div className="mb-2 border-l-2 border-slate-200 pl-2 font-serif text-[12px] italic text-slate-400 line-clamp-2">
                {fb.excerpt}
              </div>
            )}

            <div
              className={cn(
                "whitespace-pre-wrap leading-relaxed text-slate-700",
                isNewest ? "text-[13px]" : "text-[12px] text-slate-600",
              )}
            >
              {fb.feedbackText}
            </div>

            {fb.markers.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {fb.markers.map((m) => (
                  <span
                    key={m.key}
                    title={m.key}
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      SEVERITY_STYLE[m.severity ?? "niedrig"],
                    )}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          </div>
        );
      })}
    </div>
  );
}
