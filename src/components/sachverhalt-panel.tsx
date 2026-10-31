"use client";

// Ein-/ausklappbares Sachverhalts-Panel. Sachverhalt kann eingefügt werden
// (Textarea) oder extern als PDF gelesen werden — hier nur der eingefügte Text.

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Pencil, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SachverhaltPanelProps {
  value: string;
  onChange: (text: string) => void;
}

export function SachverhaltPanel({ value, onChange }: SachverhaltPanelProps) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(!value);
  const [draft, setDraft] = useState(value);

  return (
    <div className="border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-800"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <FileText className="h-3.5 w-3.5" />
        Sachverhalt
      </button>

      {open && (
        <div className="px-3 pb-3">
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Sachverhalt hier einfügen (oder leer lassen und das Original-PDF extern lesen) …"
                className="min-h-[180px] font-serif text-[13px] leading-relaxed"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => { onChange(draft); setEditing(false); }}
                >
                  <Check className="h-3.5 w-3.5" /> Speichern
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                className={cn(
                  "whitespace-pre-wrap font-serif text-[13px] leading-relaxed text-slate-700",
                  !value && "italic text-slate-400",
                )}
              >
                {value || "Kein Sachverhalt eingefügt — Original-PDF extern lesen."}
              </div>
              <button
                type="button"
                onClick={() => { setDraft(value); setEditing(true); }}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700"
              >
                <Pencil className="h-3 w-3" /> Bearbeiten
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
