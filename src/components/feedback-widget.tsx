"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { FEEDBACK_CATEGORIES, type AppFeedback } from "@/lib/feedback";

export function downloadFeedback(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<AppFeedback["category"]>("bug");
  const [text, setText] = useState(""); const [name, setName] = useState("");
  const [record, setRecord] = useState<AppFeedback | null>(null);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  function currentRecord() {
    // Keep a retry stable; edited messages get a fresh identifier.
    if (record && record.text === text.trim() && record.category === category && record.name === (name.trim() || undefined) && record.page === pathname) return record;
    const next: AppFeedback = { id: crypto.randomUUID(), category, text: text.trim(), page: pathname, name: name.trim() || undefined, createdAt: new Date().toISOString(), version: "0.1.0" }; setRecord(next); return next;
  }
  async function submit() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentRecord()) });
      const result = await response.json();
      if (!response.ok || !result.saved) throw new Error(result.error || "Feedback konnte nicht übermittelt werden.");
      setMessage("Feedback auf dem App-Rechner gespeichert. Du findest es in der Feedbackübersicht."); setText(""); setRecord(null);
    } catch (error) { setMessage(`${error instanceof Error ? error.message : "Keine Verbindung."} Dein Text bleibt im Formular. Du kannst ihn als Datei herunterladen und selbst weitergeben.`); }
    finally { setBusy(false); }
  }
  return <div className="fixed right-4 bottom-20 md:bottom-5 z-40">
    {!open ? <Button variant="outline" className="bg-white shadow-sm" onClick={() => { setOpen(true); setMessage(""); }}>Feedback geben</Button> :
      <section aria-label="Feedback geben" className="border border-slate-200 bg-white shadow-lg p-4 w-[min(24rem,calc(100vw-2rem))] max-h-[75vh] overflow-auto space-y-3">
        <div className="flex justify-between items-center"><h2 className="font-medium">Feedback zur App</h2><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Schließen</Button></div>
        <p className="text-xs text-slate-600">Aktuelle Seite: {pathname}. Übermittelt werden nur deine Angaben, die Seite und die App-Version. Dokumente und Lerntexte werden nicht angehängt.</p>
        <label className="block text-sm">Kategorie<select aria-label="Feedback-Kategorie" className="block border p-2 w-full mt-1" value={category} onChange={event => setCategory(event.target.value as AppFeedback["category"])}>{Object.entries(FEEDBACK_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="block text-sm">Was ist dir aufgefallen?<textarea aria-label="Feedbacktext" className="block border p-2 w-full mt-1" rows={5} maxLength={4000} value={text} onChange={event => setText(event.target.value)} placeholder="Was hast du gemacht, was hast du erwartet und was ist passiert?" /></label>
        <label className="block text-sm">Name (optional)<input aria-label="Feedbackname" className="block border p-2 w-full mt-1" maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
        <p className="text-xs text-slate-500">Im lokalen Betrieb landen Meldungen auf dem App-Rechner. Für einen Online-Testbetrieb wird später ein gemeinsamer Feedbackeingang eingerichtet.</p>
        <div className="flex flex-wrap gap-2"><Button disabled={busy || text.trim().length < 5} onClick={submit}>{busy ? "Wird gespeichert…" : "Feedback senden"}</Button><Button variant="outline" disabled={text.trim().length < 5} onClick={() => downloadFeedback(currentRecord(), "stex-feedback.json")}>Als Datei sichern</Button></div>
        {message && <p role="status" className="text-sm">{message}</p>}
        <Link href="/feedback" className="block text-xs underline">Feedbackübersicht auf diesem Rechner</Link>
      </section>}
  </div>;
}
