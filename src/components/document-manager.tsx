"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, FileText, CheckSquare, Square, Loader2, CalendarRange } from "lucide-react";
import {
  getDocuments,
  addDocument,
  removeDocument,
  toggleDocumentInclude,
  fileToDataUrl,
  setAgDaysForWeek,
  updateDocument,
  type StoredDocument,
} from "@/lib/store";
import { PromptGear } from "@/components/prompt-gear";
import { getPromptById } from "@/lib/prompts";
import { buildContextFor } from "@/lib/prompt-context";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentManager() {
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDocs(getDocuments());
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 4 * 1024 * 1024) {
          alert(`"${file.name}" ist zu groß (>4 MB, localStorage-Limit).`);
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        const created = addDocument({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
          tags: [],
          includeInNextPlan: true,
        });
        // Fire-and-forget Auto-Summary (cheap tier) — blockiert den Upload nicht
        void summarizeDoc(created);
      }
      setDocs(getDocuments());
    } finally {
      setUploading(false);
    }
  }

  async function summarizeDoc(doc: StoredDocument) {
    // Nur für Text-artige Dateien sinnvoll
    const isText = doc.type.startsWith("text/") || /\.(md|txt|json|csv)$/i.test(doc.name);
    let textSnippet = "";
    if (isText) {
      try {
        const base64 = doc.dataUrl.split(",")[1] || "";
        textSnippet = atob(base64).slice(0, 6000);
      } catch { /* ignore */ }
    }
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "cheap",
          messages: [
            { role: "system", content: "Du bekommst ein Lern-Material (Jura, 2. Staatsexamen). Antworte mit EINEM Satz (max 25 Wörter): Was deckt das Material ab?" },
            { role: "user", content: `Dateiname: ${doc.name}\nTyp: ${doc.type}${textSnippet ? `\n\nAuszug:\n${textSnippet}` : "\n(Binärdatei — schätze rein anhand des Namens)"}` },
          ],
        }),
      });
      const data = await res.json();
      if (data.reply) {
        updateDocument(doc.id, { summary: (data.reply as string).trim().slice(0, 200) });
        setDocs(getDocuments());
      }
    } catch { /* silent */ }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
  }

  function toggle(id: string) {
    toggleDocumentInclude(id);
    setDocs(getDocuments());
  }

  function remove(id: string) {
    if (!confirm("Dokument wirklich löschen?")) return;
    removeDocument(id);
    setDocs(getDocuments());
  }

  async function parseAgDays() {
    const included = docs.filter((d) => d.includeInNextPlan);
    if (included.length === 0) {
      setParseMsg("Keine Dokumente ausgewählt.");
      return;
    }
    setParsing(true);
    setParseMsg(null);
    try {
      const sys = getPromptById("ag-parser");
      const context = buildContextFor(sys?.contextFlags || ["docs", "timeStatus"]);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: sys?.modelTier || "cheap",
          messages: [
            { role: "system", content: sys?.prompt || "" },
            { role: "user", content: `${context}\n\nExtrahiere die AG-Tage pro Kalenderwoche.` },
          ],
        }),
      });
      const data = await res.json();
      const reply = data.reply || "";
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        setParseMsg("Keine AG-Termine erkannt.");
        setParsing(false);
        return;
      }
      const parsed = JSON.parse(jsonMatch[0]);
      const weeks = parsed.weeks || [];
      for (const w of weeks) {
        if (w.weekKey && Array.isArray(w.agDays)) {
          setAgDaysForWeek(w.weekKey, w.agDays, "ai");
        }
      }
      setParseMsg(
        weeks.length > 0
          ? `${weeks.length} Woche(n) aktualisiert. Siehe Lernkalender.`
          : "Keine AG-Termine gefunden."
      );
    } catch {
      setParseMsg("Fehler beim Parsen. API-Config prüfen.");
    }
    setParsing(false);
  }

  return (
    <section className="border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-6 py-4">
        <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
          Planungsdokumente · Lokal gespeichert
        </div>
        <h2 className="font-serif text-xl text-slate-900 mt-1 leading-tight">Dokumente</h2>
      </header>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`m-6 border border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
          dragOver ? "border-slate-900 bg-slate-50" : "border-slate-300 hover:border-slate-900 hover:bg-slate-50"
        }`}
      >
        <Upload className="h-5 w-5 text-slate-400 mx-auto mb-2" />
        <div className="font-serif text-[15px] text-slate-900">
          {uploading ? "Lädt..." : "Terminpläne, Lernpläne, GJPA-Dokumente hier ablegen"}
        </div>
        <div className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mt-1">
          PDF, DOCX, TXT · max 4 MB · KI extrahiert Termine & Infos automatisch
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Doc list */}
      {docs.length > 0 && (
        <ul className="divide-y divide-slate-200 border-t border-slate-200">
          {docs.map((d) => (
            <li key={d.id} className="px-6 py-3 flex items-center gap-3">
              <button
                onClick={() => toggle(d.id)}
                className="text-slate-700 shrink-0"
                title={d.includeInNextPlan ? "Aus Plan ausschließen" : "In Plan einbeziehen"}
              >
                {d.includeInNextPlan ? (
                  <CheckSquare className="h-4 w-4 text-slate-900" />
                ) : (
                  <Square className="h-4 w-4 text-slate-300" />
                )}
              </button>
              <FileText className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[14px] text-slate-900 truncate leading-tight">{d.name}</div>
                <div className="font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mt-0.5">
                  {formatSize(d.size)} · {new Date(d.uploadedAt).toLocaleDateString("de-DE")}
                </div>
              </div>
              <button
                onClick={() => remove(d.id)}
                className="text-slate-400 hover:text-slate-900 shrink-0"
                title="Löschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="border-t border-slate-200 px-6 py-4 flex items-center gap-3 flex-wrap">
        <button
          onClick={parseAgDays}
          disabled={parsing || docs.length === 0}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-accent-600 disabled:bg-slate-300 text-white font-sans text-[10px] uppercase tracking-[0.16em] font-bold px-4 py-2 transition-colors"
        >
          {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="h-3.5 w-3.5" />}
          AG-Tage aus Docs parsen
        </button>
        {parseMsg && (
          <span className="font-sans text-[11px] text-slate-500">{parseMsg}</span>
        )}
        <div className="ml-auto"><PromptGear promptId="ag-parser" compact /></div>
      </div>
    </section>
  );
}
