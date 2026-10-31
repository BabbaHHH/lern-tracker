"use client";

// Leerer „TextEdit"-Modus: eine ruhige, formatierbare Schreibfläche ohne
// Klausur-Metadaten, KI oder Korrektur. Einfach tippen — wird debounced
// in localStorage gespeichert (ein einziger persistenter Notizblock).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { KlausurEditor } from "@/components/klausur-editor";
import { getFreitext, saveFreitext } from "@/lib/store";
import { ArrowLeft, Check } from "lucide-react";

import type {ReactNode} from "react";

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export interface OriginalNotepadAdapter {html:string;text:string;editorKey:string;status:ReactNode;saved:boolean;onUpdate:(html:string,text:string)=>void}
export function OriginalNotepad({remote}:{remote?:OriginalNotepadAdapter}) {
  const [initial, setInitial] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const pending = useRef<{ html: string; text: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if(remote)return;
    const ft = getFreitext();
    // Browser storage is loaded once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitial(ft.html);
    setText(ft.text);
    const flush = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const value = pending.current;
      if (value && saveFreitext(value.html, value.text)) pending.current = null;
    };
    const hide = () => { if (document.visibilityState === "hidden") flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (pending.current) event.preventDefault();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hide);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [remote]);

  const handleUpdate = useCallback((html: string, plain: string) => {
    if(remote){remote.onUpdate(html,plain);return;}
    setText(plain);
    setSaved(false);
    setSaveError(false);
    pending.current = { html, text: plain };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = saveFreitext(html, plain);
      if (ok) pending.current = null;
      setSaved(ok);
      setSaveError(!ok);
    }, 700);
  }, [remote]);

  return (
    <>
      {!remote && <NavBar />}
      <main className={`flex-1 pb-24 pt-4 ${remote ? "md:pt-6" : "md:pt-20"} px-4 max-w-3xl mx-auto w-full`}>
        <div className="mb-4 flex items-center gap-3">
          <Link href="/schreiben">
            <Button variant="ghost" size="icon" className="h-9 w-9 border border-slate-200 text-slate-600">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-serif text-2xl text-slate-900">Notizblock</h1>
            <p className="text-[12px] text-slate-400">
              Leere Schreibfläche zum freien Tippen — ohne KI, ohne Korrektur.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>{wordCount(remote?.text ?? text)} Wörter</span>
            <span className={(remote?.saved ?? saved) ? "text-emerald-600" : "text-slate-300"}>
              {(remote?.saved ?? saved) ? (
                <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> gespeichert</span>
              ) : saveError ? "Nicht gespeichert – bitte Text sichern" : "speichert …"}
            </span>
          </div>
        </div>

        {remote?.status}
        {(remote || initial !== null) && (
          <div className="min-w-0 [&>div>div:first-child]:flex-wrap [&_.ProseMirror]:break-words"><KlausurEditor key={remote?.editorKey} label="Notiztext" initialContent={remote?.html ?? initial ?? ""} onUpdate={handleUpdate} /></div>
        )}
      </main>
    </>
  );
}
