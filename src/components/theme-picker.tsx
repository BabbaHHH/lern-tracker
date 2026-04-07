"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";
import { THEMES, type ThemeId, getTheme, setTheme } from "@/lib/store";

export function ThemePicker() {
  const [active, setActive] = useState<ThemeId>("indigo");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive(getTheme());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function apply(id: ThemeId) {
    setTheme(id);
    setActive(id);
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-none border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-none"
        title="Farbschema"
      >
        <Palette className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 z-50 border border-slate-200 bg-white shadow-none">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
            Farbschema
          </div>
          <div className="font-serif text-base text-slate-900 mt-0.5">Theme wählen</div>
        </div>
        <ul className="divide-y divide-slate-200">
          {THEMES.map((t) => {
            const isActive = active === t.id;
            return (
              <li key={t.id}>
                <button
                  onClick={() => apply(t.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <span
                    className="w-6 h-6 border border-slate-200 shrink-0"
                    style={{ backgroundColor: t.hue }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-serif text-[15px] text-slate-900 leading-tight">
                      {t.label}
                    </span>
                    <span className="block font-sans text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 mt-0.5">
                      {t.description}
                    </span>
                  </span>
                  {isActive && <Check className="h-4 w-4 text-slate-900 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
        </div>
      )}
    </div>
  );
}
