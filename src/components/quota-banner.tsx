"use client";

// Hört auf das Quota-Event aus store.save() und zeigt einen Warn-Banner.
// Wird in app/layout.tsx gemountet, damit es überall sichtbar ist.

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface QuotaEvent {
  key: string;
}

export function QuotaBanner() {
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<QuotaEvent>).detail;
      setLastKey(detail?.key ?? "unbekannt");
      setDismissed(false);
    };
    window.addEventListener("lerntracker:quota-exceeded", handler);
    return () => window.removeEventListener("lerntracker:quota-exceeded", handler);
  }, []);

  if (!lastKey || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-2rem)]">
      <div className="bg-rose-50 border border-rose-200 rounded-2xl shadow-lg p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-rose-900">
            Speicher voll — neueste Änderung wurde nicht gespeichert
          </div>
          <div className="text-xs text-rose-700 mt-1">
            localStorage hat sein Limit (~5 MB) erreicht. Lösche alte Daten oder
            mache ein Backup und resette die App.
            <span className="block mt-1 opacity-75 font-mono text-[10px]">
              Betroffen: {lastKey}
            </span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-rose-600 hover:text-rose-900 transition-colors"
          aria-label="Banner schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
