"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogSearchResponse } from "@/lib/search/catalog-contract";
import { SearchBoundary } from "@/lib/search/client-boundary";

const roles: Record<string, string> = { sachverhalt: "Sachverhalt", loesung: "Lösung", kombiniert: "Sachverhalt und Lösung", unbekannt: "Dokument" };
const statuses: Record<string, string> = { pending: "Indexierung ausstehend", ready: "Vollständig durchsuchbar", needs_ocr: "Textlücken – OCR wäre erforderlich", failed: "Indexierung teilweise oder vollständig fehlgeschlagen" };
const failureReasons: Record<string, string> = {
  document_byte_limit: "PDF überschreitet die Suchgrenze von 50 MiB.",
  file_unavailable: "Die Original-PDF fehlt oder stimmt nicht mit der gespeicherten Dateifassung überein.",
  invalid_pdf: "Die PDF konnte technisch nicht gelesen werden. Es wurde kein durchsuchbarer Text übernommen.",
  processing_failed: "Dokument konnte nicht verarbeitet werden. Ein erneuter Indexaufbau ist erforderlich.",
};
export function CatalogSearchApp() {
  const boundary = useRef(new SearchBoundary()), controller = useRef<AbortController | null>(null);
  const activeQuery = useRef<{ text: string; law: string; paragraph: string } | null>(null);
  const loading = useRef(false);
  const [text, setText] = useState(""), [law, setLaw] = useState("ZPO"), [paragraph, setParagraph] = useState("");
  const [mode, setMode] = useState("text"), [result, setResult] = useState<CatalogSearchResponse | null>(null);
  const [verified, setVerified] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [showResults, setShowResults] = useState(false);
  const clear = useCallback(() => { controller.current?.abort(); boundary.current.invalidate(); loading.current = false; setBusy(false); setResult(null); setVerified(false); }, []);
  const load = useCallback(async () => {
    controller.current?.abort(); const cancellation = new AbortController(); controller.current = cancellation;
    loading.current = true;
    const sequence = boundary.current.invalidate();
    const params = new URLSearchParams();
    if (activeQuery.current) {
      const query = activeQuery.current;
      if (query.text) params.set("q", query.text);
      if (query.law && query.paragraph) { params.set("law", query.law); params.set("paragraph", query.paragraph); }
    }
    const expected = boundary.current.context;
    if (expected) for (const [key, value] of Object.entries(expected)) params.set(key === "accountId" ? "accountId" : key, String(value));
    try {
      const response = await fetch("/api/catalog/search", { method: "POST", headers: { "Content-Type": "application/json", "X-Stex-Action": "1" },
        body: JSON.stringify(Object.fromEntries(params)), credentials: "same-origin", cache: "no-store", signal: cancellation.signal });
      const value = await response.json();
      if (sequence !== boundary.current.sequence) return;
      if (!response.ok) throw new Error(value.error?.message ?? "Die Suche ist gerade nicht verfügbar.");
      // Check the current cookie session once more before showing any hits.
      const check = new URLSearchParams(Object.entries(value.context).map(([key, val]) => [key, String(val)]));
      const confirmed = await fetch("/api/catalog/search", { method: "POST", headers: { "Content-Type": "application/json", "X-Stex-Action": "1" },
        body: JSON.stringify(Object.fromEntries(check)), credentials: "same-origin", cache: "no-store", signal: cancellation.signal });
      if (!confirmed.ok) throw new Error("Die Anmeldung hat sich geändert. Bitte neu anmelden oder neu laden.");
      const disposition = boundary.current.accept(sequence, value.context);
      if (disposition === "stale") return;
      if (disposition === "changed") {
        activeQuery.current = null; setShowResults(false); setResult(null); setVerified(false); setText(""); setParagraph("");
        setMessage("Die Anmeldung hat sich geändert. Bitte neu laden."); return;
      }
      setResult(value); setVerified(true); setMessage("");
    } catch (error) {
      if (cancellation.signal.aborted || sequence !== boundary.current.sequence) return;
      boundary.current.reset(); activeQuery.current = null; setShowResults(false); setResult(null); setVerified(false); setText(""); setParagraph("");
      setMessage(error instanceof Error ? error.message : "Bitte neu anmelden.");
    } finally { if (!cancellation.signal.aborted) { loading.current = false; setBusy(false); } }
  }, []);
  useEffect(() => {
    const sessionBoundary = boundary.current;
    const initial = setTimeout(() => void load(), 0);
    const leave = () => clear();
    const refresh = () => { if (document.visibilityState === "visible") void load(); else clear(); };
    const poll = setInterval(() => { if (document.visibilityState === "visible" && !loading.current) void load(); }, 5000);
    window.addEventListener("blur", leave); window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearTimeout(initial); clearInterval(poll); window.removeEventListener("blur", leave); window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", refresh); controller.current?.abort(); sessionBoundary.invalidate(); };
  }, [load, clear]);
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
    <header><Link href="/konto/klausuren" className="text-sm underline">Zum gemeinsamen Katalog</Link><h1 className="mt-3 text-3xl font-semibold">Klausuren durchsuchen</h1>
      <p className="mt-2 text-slate-600">Text oder Norm in den aktuellen PDFs finden und direkt zur Fundstelle springen.</p></header>
    {message && <p role="alert" className="rounded-lg border bg-amber-50 p-4">{message} <Link href="/konto/anmelden" className="underline">Zur Anmeldung</Link> · <button className="underline" onClick={() => void load()}>Neu laden</button></p>}
    <form className="space-y-4 rounded-xl border p-5" onSubmit={event => { event.preventDefault(); activeQuery.current = mode === "text" ? { text, law: "", paragraph: "" } : { text: "", law, paragraph }; setShowResults(true); setBusy(true); setResult(null); void load(); }}>
      <div className="flex gap-5"><label><input type="radio" checked={mode === "text"} onChange={() => setMode("text")} /> Text</label><label><input type="radio" checked={mode === "norm"} onChange={() => setMode("norm")} /> Norm</label></div>
      {mode === "text" ? <label className="block">Suchtext<input className="mt-1 w-full rounded-lg border p-3" value={text} required maxLength={2000} placeholder="kaufmännisches Bestätigungsschreiben" onChange={event => setText(event.target.value)} /></label>
        : <div className="flex flex-wrap gap-4"><label>Gesetz<input className="mt-1 block rounded-lg border p-3" value={law} required maxLength={96} onChange={event => setLaw(event.target.value)} /></label><label>Paragraph<input className="mt-1 block rounded-lg border p-3" value={paragraph} required maxLength={16} placeholder="172" onChange={event => setParagraph(event.target.value)} /></label></div>}
      <button className="rounded-lg bg-indigo-700 px-5 py-3 text-white disabled:opacity-50" disabled={!verified || busy}>{busy ? "Suche läuft …" : "Suchen"}</button>
    </form>
    {!verified && !message && <p role="status">Anmeldung wird geprüft …</p>}
    {verified && result && <>
      {showResults && <section aria-label="Suchergebnisse" className="space-y-3"><h2 className="text-xl font-medium">{result.totalHits} Treffer{result.limited ? " · erste 100 angezeigt" : ""}</h2>
        <p className="text-sm text-slate-600">Ein Treffer belegt eine Erwähnung; er sagt noch nichts über den Klausurschwerpunkt aus.</p>
        {result.hits.map(hit => <article key={`${hit.documentVersionId}:${hit.pageNumber}:${hit.start}:${hit.end}`} className="rounded-lg border p-4">
          <h3 className="font-medium">{result.documents.find(doc => doc.documentVersionId === hit.documentVersionId)?.title ?? hit.klausurId}</h3>
          <p className="text-sm text-slate-600">{roles[hit.role]} · PDF-Seite {hit.pageNumber} · Fundstelle {hit.occurrence + 1}</p>
          <p className="my-3 whitespace-pre-wrap">{hit.excerpt.text.slice(0, hit.start - hit.excerpt.start)}<mark className="bg-indigo-100">{hit.evidence}</mark>{hit.excerpt.text.slice(hit.end - hit.excerpt.start)}</p>
          <Link prefetch={false} href={hit.viewerURL} className="text-indigo-800 underline">Fundstelle im PDF öffnen</Link>
        </article>)}
      </section>}
      <section className="space-y-3 rounded-xl border p-5"><h2 className="text-xl font-medium">Stand der Volltextsuche</h2>
        {!result.documents.length && <p>Noch keine gemeinsamen PDFs vorhanden.</p>}
        {result.documents.map(doc => <div key={doc.documentVersionId} className="border-t pt-3"><p className="font-medium">{doc.title} · {roles[doc.role]}</p><p className="text-sm">{statuses[doc.status]} · {doc.readyPages} von {doc.pageCount ?? "?"} Seiten mit Text{doc.pendingPages ? ` · ${doc.pendingPages} ausstehend` : ""}{doc.missingTextPages ? ` · ${doc.missingTextPages} ohne Text` : ""}{doc.failedPages ? ` · ${doc.failedPages} fehlerhaft` : ""}</p>
          {doc.reason && <p className="text-sm text-amber-800">{failureReasons[doc.reason] ?? "Einige Seiten konnten nicht vollständig ausgelesen werden. Der Suchtext wurde nicht abgeschnitten."}</p>}</div>)}
      </section>
    </>}
  </main>;
}
