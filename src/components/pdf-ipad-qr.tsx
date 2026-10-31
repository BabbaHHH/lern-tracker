"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Tablet, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * "iPad"-Button neben dem PDF-Button: zeigt einen QR-Code, dessen URL das
 * Klausur-PDF direkt vom Dev-Server streamt (/api/pdf-file). iPad-Kamera
 * drauf halten → Safari öffnet das PDF — nichts wird auf dem iPad gespeichert.
 * Voraussetzung: iPad im selben WLAN, Mac + Dev-Server laufen.
 */
export function PdfIpadQr({ source, dark = false }: { source: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        setQrDataUrl(null);
        // LAN-Adressen bei jedem Öffnen frisch holen — IP kann sich per DHCP ändern
        const res = await fetch("/api/lan-url");
        if (!res.ok) throw new Error(`lan-url ${res.status}`);
        const { urls: bases } = (await res.json()) as { urls: string[] };
        if (!bases?.length) throw new Error("Keine Netzwerk-Adresse gefunden");
        const pdfUrls = bases.map(
          b => `${b}/api/pdf-file?name=${encodeURIComponent(source)}`,
        );
        // QR auf die IP-URL (erste) — löst beim Jetzt-Scannen am verlässlichsten auf
        const dataUrl = await QRCode.toDataURL(pdfUrls[0], { width: 260, margin: 1 });
        if (cancelled) return;
        setUrls(pdfUrls);
        setQrDataUrl(dataUrl);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [open, source]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Auf dem iPad öffnen (QR-Code scannen — gleiches WLAN nötig)"
        aria-label="Auf dem iPad öffnen"
        className={cn(
          "shrink-0 inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md text-[10px] font-medium transition-all",
          dark
            ? "bg-white/10 hover:bg-white/15 text-white/80 ring-1 ring-white/10"
            : "border border-slate-200 bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900",
        )}
      >
        <Tablet className="h-3 w-3" /> iPad
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">PDF auf dem iPad öffnen</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 pt-1 pb-2">
            {error ? (
              <p className="text-xs text-red-600 text-center px-2">{error}</p>
            ) : qrDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR-Code zum PDF" className="w-[220px] h-[220px] rounded-lg border border-slate-200" />
                <p className="text-[11px] text-slate-500 text-center leading-snug px-2">
                  Mit der iPad-Kamera scannen → Safari streamt das PDF.
                  Nichts wird gespeichert. iPad muss im selben WLAN sein,
                  der Mac an bleiben.
                </p>
                <div className="w-full space-y-1">
                  {urls.map(u => (
                    <div key={u} className="font-mono text-[9px] text-slate-400 break-all text-center select-all">
                      {u}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-slate-400 my-8" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
