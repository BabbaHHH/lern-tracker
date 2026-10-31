"use client";
import { useEffect, useState } from "react";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { downloadFeedback } from "@/components/feedback-widget";
import { FEEDBACK_CATEGORIES, type AppFeedback } from "@/lib/feedback";

export default function FeedbackPage() {
  const [items, setItems] = useState<AppFeedback[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(true);
  async function load() {
    try { const response = await fetch("/api/feedback", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Feedback konnte nicht geladen werden."); setItems(result.feedback); }
    catch (error) { setError(error instanceof Error ? error.message : "Keine Verbindung."); } finally { setBusy(false); }
  }
  // Fetch the local server inbox after mounting; no browser data is read in render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);
  return <><NavBar /><main className="w-full max-w-3xl mx-auto p-4 pt-8 md:pt-24 pb-28">
    <h1 className="font-serif text-2xl mb-3">Feedbackübersicht</h1>
    <p className="text-sm text-slate-600 mb-4">Lokaler Eingang für Testmeldungen. Daraus können konkrete Änderungen mit Prüfung und Vorschau entstehen. Die Meldungen verändern den Code nicht automatisch.</p>
    <div className="flex gap-2 mb-4"><Button variant="outline" disabled={busy} onClick={() => { setBusy(true); setError(""); void load(); }}>Aktualisieren</Button><Button variant="outline" disabled={!items.length} onClick={() => downloadFeedback(items, "stex-feedback-sammlung.json")}>Alle Meldungen exportieren</Button></div>
    {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}
    {!error && !busy && !items.length && <p className="text-sm text-slate-500">Noch keine Meldungen auf diesem App-Rechner.</p>}
    <ul className="space-y-3">{items.map(item => <li key={item.id} className="border p-4 bg-white"><p className="text-xs text-slate-500">{FEEDBACK_CATEGORIES[item.category]} · {item.page} · {new Date(item.createdAt).toLocaleString("de-DE")}{item.name && ` · ${item.name}`}</p><p className="text-sm mt-2 whitespace-pre-wrap">{item.text}</p></li>)}</ul>
  </main></>;
}
