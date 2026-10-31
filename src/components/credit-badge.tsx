"use client";

// Kompakte OpenRouter-Guthaben-Anzeige für den Schreiben-Arbeitsbereich.
// Nutzt die bestehende Route /api/openrouter-credits ({ strong, cheap }).
// Korrekturen laufen über den Strong-Key → der ist hier maßgeblich.

import { useCallback, useEffect, useState } from "react";
import { Coins, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type KeyData = {
  usage?: number;
  limit?: number | null;
  label?: string;
  is_free_tier?: boolean;
  error?: string;
} | null;

interface CreditsResponse {
  strong?: KeyData;
  cheap?: KeyData;
  test?: KeyData;
  error?: string | { message?: string };
  account?: { userId: string; status: string; role: string };
  selection?: { source: "pilot" | "own" | "off"; revision: number };
  providerStatus?: { state: string; source?: "pilot" | "own"; limitRemaining?: number | null; message?: string } | null;
}

function remainingOf(d: KeyData): number | null {
  if (!d || d.error) return null;
  const used = typeof d.usage === "number" ? d.usage : null;
  const limit = typeof d.limit === "number" ? d.limit : null;
  return limit !== null && used !== null ? limit - used : null;
}

function describe(d: KeyData, name: string): string {
  if (!d) return `${name}: —`;
  if (d.error) return `${name}: ${d.error}`;
  const used = typeof d.usage === "number" ? `$${d.usage.toFixed(4)} verbraucht` : "—";
  const rem = remainingOf(d);
  const tail = rem != null
    ? `, $${rem.toFixed(4)} übrig`
    : (d.limit == null ? ", kein Key-Limit gesetzt" : "");
  return `${name}: ${used}${tail}`;
}

export function CreditBadge() {
  const [data, setData] = useState<CreditsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/openrouter-credits", { cache: "no-store" });
      const json = (await res.json()) as CreditsResponse;
      if (json.error) throw new Error(typeof json.error === "object" ? json.error.message : json.error);
      setData(json);
    } catch (e) {
      setError((e as Error).message || "Guthaben nicht abrufbar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [load]);

  // Die Korrektur verbraucht den Test-Key (falls gesetzt), sonst den Strong-Key.
  const test = data?.test ?? null;
  const usesTest = !!(test && !test.error);
  const korr = usesTest ? test : (data?.strong ?? null);
  const remaining = remainingOf(korr);
  const used = korr && typeof korr.usage === "number" ? korr.usage : null;

  if (data?.account) {
    const provider = data.providerStatus;
    const source = data.selection?.source;
    const selected = source === "pilot" ? "Pilot-Startzugang" : source === "own" ? "Eigener OpenRouter-Schlüssel" : "KI aus";
    const detail = provider?.message
      ?? (typeof provider?.limitRemaining === "number" ? `OpenRouter-Limit: $${provider.limitRemaining.toFixed(2)} übrig` : provider?.state === "ready" ? "OpenRouter-Status verfügbar" : "Kein Anbieterstatus verfügbar");
    return <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500" title={`${selected}: ${detail}`}>
      <Coins className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span>{selected}: <span className={cn(provider?.state === "ready" ? "font-semibold text-slate-700" : "text-slate-500")}>{detail}</span></span>
      <Link href="/konto/ki" className="ml-1 underline">KI-Zugang</Link>
    </div>;
  }

  // Farbe nach Restguthaben des Korrektur-Keys.
  const color =
    remaining == null ? "text-slate-500"
    : remaining < 0.5 ? "text-rose-600"
    : remaining < 2 ? "text-amber-600"
    : "text-emerald-600";

  const title = [
    usesTest ? describe(test, "Test (Korrektur)") : null,
    describe(data?.strong ?? null, usesTest ? "Strong" : "Strong (Korrektur)"),
    describe(data?.cheap ?? null, "Cheap"),
  ].filter(Boolean).join("\n");

  return (
    <div
      className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
      title={title}
    >
      <Coins className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      {loading ? (
        <span className="text-slate-400">Guthaben …</span>
      ) : error ? (
        <span className="inline-flex items-center gap-1 text-rose-500">
          <AlertCircle className="h-3 w-3" /> Guthaben?
        </span>
      ) : remaining != null ? (
        <span>Guthaben <span className={cn("font-semibold", color)}>${remaining.toFixed(2)}</span></span>
      ) : used != null ? (
        <span>Verbraucht <span className="font-semibold text-slate-700">${used.toFixed(2)}</span></span>
      ) : (
        <span className="text-slate-400">Guthaben —</span>
      )}
      <button
        type="button"
        onClick={load}
        disabled={loading}
        title="Guthaben aktualisieren"
        className="ml-0.5 text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-50"
      >
        <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
      </button>
    </div>
  );
}
