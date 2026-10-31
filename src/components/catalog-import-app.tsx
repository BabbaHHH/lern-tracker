"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { pdfViewerURL } from "@/lib/pdf-viewer/contract";
import { CATALOG_MAX_FILE_BYTES, CATALOG_MAX_METADATA_BYTES, CATALOG_MAX_REQUEST_BYTES } from "@/lib/catalog/limits";

type Area = "zr" | "oeffr" | "sr";
interface Metadata { id?: string; source: string; date: string; title: string; area: Area; type?: string; topicIds: string[] }
interface Entry { id: string; revision: number; metadata: { source: string; date: string; title: string; area: Area; type?: string; topicIds: string[] }; documents: { documentId: string; documentVersionId: string; role: string; versionNumber: number; sourceFilename: string; byteSize: number; textStatus: string }[] }
interface ImportSummary { importId: string; requestId: string; status: "queued" | "processing" | "committed" | "failed"; duplicateStatus: string; klausurId: string | null; warnings: string[]; errorMessage: string | null }
interface FileDraft { role: "sachverhalt" | "loesung"; name: string; size: number; lastModified: number; sha256: string }
interface PendingDraft { ownerId: string; requestId: string; signature: string; metadata: Metadata; files: FileDraft[] }

const inputStyle = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const buttonStyle = "rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50";
const pendingStorageKey = "stex-katalog-import-v1";

class CatalogRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new CatalogRequestError(body?.error?.message ?? body?.message ?? "Die Anfrage konnte nicht ausgeführt werden.", response.status, body?.error?.code);
  return body as { klausuren?: Entry[]; import?: ImportSummary; account?: { userId?: string } };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function readPendingDraft(): PendingDraft | null {
  try {
    const raw = sessionStorage.getItem(pendingStorageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingDraft>;
    if (typeof value.ownerId !== "string" || typeof value.requestId !== "string" || typeof value.signature !== "string" || !value.metadata || !Array.isArray(value.files)) return null;
    return value as PendingDraft;
  } catch { return null; }
}

function writePendingDraft(value: PendingDraft): void {
  try { sessionStorage.setItem(pendingStorageKey, JSON.stringify(value)); } catch { /* Browser storage is only a resume aid. */ }
}

function clearPendingDraft(): void {
  try { sessionStorage.removeItem(pendingStorageKey); } catch { /* The server-side receipt remains authoritative. */ }
}

async function fileHash(file: File): Promise<string> {
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
    }
  } catch { /* The descriptor fallback still lets the server detect a changed fingerprint. */ }
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function inputSignature(metadata: Metadata, sachverhalt: File, loesung: File): Promise<{ signature: string; files: FileDraft[] }> {
  const files: FileDraft[] = await Promise.all([
    fileHash(sachverhalt).then(sha256 => ({ role: "sachverhalt" as const, name: sachverhalt.name, size: sachverhalt.size, lastModified: sachverhalt.lastModified, sha256 })),
    fileHash(loesung).then(sha256 => ({ role: "loesung" as const, name: loesung.name, size: loesung.size, lastModified: loesung.lastModified, sha256 })),
  ]);
  return { files, signature: JSON.stringify({ metadata, files }) };
}

function metadataFromDraft(value: Metadata): Metadata {
  return { ...value, topicIds: [...value.topicIds] };
}

export function CatalogImportApp({ embedded = false, onImported }: { embedded?: boolean; onImported?: () => void } = {}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [id, setId] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<Area>("zr");
  const [type, setType] = useState("");
  const [topicIds, setTopicIds] = useState("");
  const [sachverhalt, setSachverhalt] = useState<File | null>(null);
  const [loesung, setLoesung] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingDraft | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ImportSummary | null>(null);

  const load = useCallback(async () => {
    const result = await request("/api/catalog/klausuren");
    setEntries(result.klausuren ?? []);
    onImported?.();
  }, [onImported]);

  const clearForm = useCallback(() => {
    setId(""); setSource(""); setDate(""); setTitle(""); setArea("zr"); setType(""); setTopicIds(""); setSachverhalt(null); setLoesung(null);
    document.querySelectorAll<HTMLInputElement>("[data-catalog-upload] input[type=file]").forEach(input => { input.value = ""; });
  }, []);

  const inspectPending = useCallback(async (draft: PendingDraft) => {
    try {
      const result = await request(`/api/catalog/import?requestId=${encodeURIComponent(draft.requestId)}`);
      const summary = result.import;
      if (!summary) return;
      setPendingStatus(summary);
      if (summary.status === "committed") {
        clearPendingDraft(); setPending(null); clearForm();
        const success = `Die Einreichung ${summary.klausurId ?? ""} wurde bereits gemeinsam übernommen (Dublettenstatus: ${summary.duplicateStatus}).`;
        setMessage(success);
        try { await load(); } catch { setMessage(`${success} Der Katalog konnte danach nicht neu geladen werden; bitte später „Neu laden“ wählen.`); }
      } else if (summary.status === "processing" || summary.status === "queued") {
        setMessage(`Die Einreichung ${draft.requestId} ist noch in Verarbeitung. Wähle dieselben PDFs erneut und sende sie zum Fortsetzen.`);
      } else {
        setMessage(`Die gespeicherte Einreichung wurde nicht übernommen: ${summary.errorMessage ?? "technischer Fehler"}`);
      }
    } catch (error) {
      // A 404 means the request may have been interrupted before the durable
      // receipt was created. Keep the draft so the same request can be retried.
      if (error instanceof CatalogRequestError && error.status !== 404) setMessage(error.message);
    }
  }, [clearForm, load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const draft = readPendingDraft();
      if (draft) void (async () => {
        try {
          const account = await request("/api/account");
          if (account.account?.userId !== draft.ownerId) { clearPendingDraft(); return; }
          setPending(draft); setId(draft.metadata.id ?? ""); setSource(draft.metadata.source); setDate(draft.metadata.date); setTitle(draft.metadata.title);
          setArea(draft.metadata.area); setType(draft.metadata.type ?? ""); setTopicIds(draft.metadata.topicIds.join(", "));
        } catch { return; }
        void inspectPending(draft);
      })();
      void load().catch(error => setMessage(error instanceof Error ? error.message : "Katalog konnte nicht geladen werden."));
    }, 0);
    return () => clearTimeout(timer);
  }, [inspectPending, load]);

  const selectedTotal = useMemo(() => (sachverhalt?.size ?? 0) + (loesung?.size ?? 0), [loesung, sachverhalt]);
  const selectedTooLarge = !!sachverhalt && !!loesung && (sachverhalt.size > CATALOG_MAX_FILE_BYTES || loesung.size > CATALOG_MAX_FILE_BYTES || selectedTotal > CATALOG_MAX_REQUEST_BYTES);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    let draft: PendingDraft | null = null;
    try {
      if (!sachverhalt || !loesung) throw new Error("Bitte Sachverhalt und Lösung auswählen.");
      if (sachverhalt.size > CATALOG_MAX_FILE_BYTES || loesung.size > CATALOG_MAX_FILE_BYTES) throw new Error("Jede Klausur-PDF darf höchstens 50 MB groß sein.");
      if (selectedTotal > CATALOG_MAX_REQUEST_BYTES) throw new Error("Beide PDFs dürfen zusammen höchstens 110 MB groß sein.");
      const metadata: Metadata = { ...(id ? { id } : {}), source, date, title, area, ...(type ? { type } : {}), topicIds: topicIds.split(",").map(value => value.trim()).filter(Boolean) };
      const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata)).byteLength;
      if (metadataBytes > CATALOG_MAX_METADATA_BYTES) throw new Error("Die Metadaten sind zu groß.");
      const account = await request("/api/account");
      const ownerId = account.account?.userId;
      if (!ownerId) throw new Error("Das aktive Konto konnte nicht bestimmt werden.");
      const fingerprint = await inputSignature(metadata, sachverhalt, loesung);
      const reuse = pending && pending.signature === fingerprint.signature;
      const requestId = reuse ? pending.requestId : crypto.randomUUID();
      draft = { ownerId, requestId, signature: fingerprint.signature, metadata: metadataFromDraft(metadata), files: fingerprint.files };
      writePendingDraft(draft); setPending(draft); setPendingStatus(null);
      const form = new FormData();
      form.set("requestId", requestId); form.set("metadata", JSON.stringify(metadata)); form.set("sachverhalt", sachverhalt); form.set("loesung", loesung);
      const result = await request("/api/catalog/import", { method: "POST", headers: { Origin: window.location.origin, "X-Stex-Action": "1" }, body: form });
      const summary = result.import;
      if (!summary) throw new Error("Der Importbeleg fehlt.");
      setPendingStatus(summary);
      if (summary.status === "committed") {
        clearPendingDraft(); setPending(null);
        const success = `Klausur ${summary.klausurId ?? ""} wurde direkt gemeinsam übernommen (Dublettenstatus: ${summary.duplicateStatus}).${summary.warnings?.length ? ` ${summary.warnings.join(" ")}` : ""}`;
        setMessage(success); clearForm();
        try { await load(); } catch { setMessage(`${success} Der Katalog konnte danach nicht neu geladen werden; bitte später „Neu laden“ wählen.`); }
      } else {
        setMessage(`Die Einreichung bleibt im Status „${summary.status}“. Wähle dieselben PDFs erneut, um sie fortzusetzen.`);
      }
    } catch (error) {
      if (error instanceof CatalogRequestError) {
        clearPendingDraft(); setPending(null); setPendingStatus(null); setMessage(error.message);
      } else {
        // Network/transport errors leave the durable request key in the
        // session so a retry cannot accidentally create a second receipt.
        if (draft) { setPending(draft); setMessage(`Der Ausgang des Uploads ist unbekannt. Vorgang ${draft.requestId} bleibt gespeichert; unveränderte PDFs erneut auswählen und fortsetzen.`); }
        else setMessage(error instanceof Error ? error.message : "Der Import ist fehlgeschlagen.");
      }
    } finally { setBusy(false); }
  }

  return <div data-catalog-upload className={embedded ? "space-y-4 text-sm" : "mx-auto w-full max-w-4xl px-4 py-10 space-y-6"}>
    {!embedded && <header><p className="text-sm text-indigo-700">Stex Tracker · gemeinsamer Klausurkatalog</p><h1 className="mt-2 text-3xl font-semibold">Klausur einreichen</h1><p className="mt-2 text-sm text-slate-600">Technisch gültige Einreichungen werden ohne zusätzliche Inhaltsbestätigung direkt sichtbar. Persönliche Notizen bleiben getrennt.</p></header>}
    {message && <p role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">{message}</p>}
    {pending && <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm" aria-live="polite"><p className="font-medium">Offener Upload: {pending.requestId}</p><p className="mt-1">Der Browser speichert nur Vorgangskennung und technische Dateifingerabdrücke, keine PDF-Bytes. Status: {pendingStatus?.status ?? "wird geprüft"}. Wähle für die Fortsetzung dieselben Dateien erneut. Geänderte Eingaben erhalten automatisch eine neue Vorgangskennung.</p><button type="button" className="mt-2 underline" disabled={busy} onClick={() => void inspectPending(pending)}>Status erneut prüfen</button></section>}
    <form className="space-y-4 rounded-xl border border-slate-200 p-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">Bestehende Klausur-ID (optional)<input className={inputStyle} maxLength={128} value={id} onChange={event => setId(event.target.value)} placeholder="z. B. kg-zr-16" /></label>
        <label className="block">Quelle / Kennung<input className={inputStyle} required maxLength={255} value={source} onChange={event => setSource(event.target.value)} placeholder="z. B. Eigene Klausur 2026-10" /></label>
        <label className="block">Datum (optional)<input className={inputStyle} type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      </div>
      <label className="block">Titel<input className={inputStyle} required maxLength={300} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">Rechtsgebiet<select className={inputStyle} value={area} onChange={event => setArea(event.target.value as Area)}><option value="zr">Zivilrecht</option><option value="oeffr">Öffentliches Recht</option><option value="sr">Strafrecht</option></select></label>
        <label className="block">Klausurtyp (optional)<input className={inputStyle} value={type} onChange={event => setType(event.target.value)} placeholder="z. B. Urteil" /></label>
        <label className="block">Themen-IDs, Komma getrennt<input className={inputStyle} value={topicIds} onChange={event => setTopicIds(event.target.value)} placeholder="optional" /></label>
      </div>
      <p className="text-sm text-slate-600">Uploadgrenze: höchstens 50 MB je PDF und 110 MB für die gesamte Einreichung. Die Metadaten dürfen höchstens 32 KB umfassen.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">Sachverhalt (PDF)<input className={inputStyle} required type="file" accept="application/pdf,.pdf" onChange={event => setSachverhalt(event.target.files?.[0] ?? null)} />{sachverhalt && <span className="mt-1 block text-xs text-slate-500">{sachverhalt.name} · {formatBytes(sachverhalt.size)}</span>}</label>
        <label className="block">Lösung (PDF)<input className={inputStyle} required type="file" accept="application/pdf,.pdf" onChange={event => setLoesung(event.target.files?.[0] ?? null)} />{loesung && <span className="mt-1 block text-xs text-slate-500">{loesung.name} · {formatBytes(loesung.size)}</span>}</label>
      </div>
      {selectedTotal > 0 && <p className={`text-sm ${selectedTooLarge ? "text-red-700" : "text-slate-600"}`}>Ausgewählt: {formatBytes(selectedTotal)} von {formatBytes(CATALOG_MAX_REQUEST_BYTES)}.</p>}
      <button className={buttonStyle} disabled={busy || selectedTooLarge}>{busy ? "Wird geprüft und gespeichert …" : "Prüfen und gemeinsam übernehmen"}</button>
    </form>
    {!embedded && <section className="space-y-3 rounded-xl border border-slate-200 p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-medium">Gemeinsamer Katalog</h2><Link className="text-sm underline" href="/konto/klausuren/suche">PDF-Inhalte durchsuchen</Link><button type="button" className="text-sm underline" disabled={busy} onClick={() => void load().catch(error => setMessage(error instanceof Error ? error.message : "Katalog konnte nicht geladen werden."))}>Neu laden</button></div>
      {entries.length === 0 ? <p className="text-sm text-slate-600">Noch keine gemeinsamen Klausuren.</p> : <ul className="space-y-3">{entries.map(entry => <li key={entry.id} className="rounded-lg bg-slate-50 p-4"><p className="font-medium">{entry.metadata.title}</p><p className="text-sm text-slate-600">{entry.metadata.source} · {entry.metadata.area} {entry.metadata.date && `· ${entry.metadata.date}`}</p><p className="mt-2 text-xs text-slate-500">{entry.documents.map(document => `${document.role} v${document.versionNumber} (${Math.round(document.byteSize / 1024)} KB)`).join(" · ")}</p><div className="mt-3 flex flex-wrap gap-3">{entry.documents.map(document => <Link key={document.documentVersionId} className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-800" href={pdfViewerURL({ klausurId: entry.id, documentId: document.documentId, documentVersionId: document.documentVersionId })}>{document.role === "loesung" ? "Lösung" : document.role === "sachverhalt" ? "Sachverhalt" : document.role} öffnen · v{document.versionNumber}</Link>)}</div></li>)}</ul>}
    </section>}
  </div>;
}
