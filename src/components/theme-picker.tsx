"use client";

import { useContext, useEffect, useId, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";
import { THEMES, type ThemeId, getTheme, setTheme } from "@/lib/store";
import { SettingsContext, useAccountSettings } from "@/lib/learning/use-account-settings";
import { settingKey } from "@/lib/learning/settings-contract";
import Link from "next/link";

export function ThemePicker() {
  const account = useContext(SettingsContext);
  return account ? <AccountThemePicker /> : <BrowserThemePicker />;
}

function BrowserThemePicker() {
  const [active, setActive] = useState<ThemeId>("indigo");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(getTheme());
  }, []);
  return <ThemeMenu active={active} onApply={id => { setTheme(id); setActive(id); }} />;
}

function AccountThemePicker() {
  const s = useAccountSettings();
  const row = s.view?.rows.find(r => r.kind === "theme" && r.id === "lerntracker-theme");
  const buffer = row && s.buffers[settingKey(row)];
  const disabled = s.hidden || s.busy || s.uncertain || !row?.editable || !!buffer;
  return <ThemeMenu headerMenu active={s.hidden ? null : row?.payload} disabled={disabled}
    onApply={id => {
      if (disabled || !row) return;
      s.client.edit(row, "value", id);
      void s.client.save(row);
    }}
    status={<>
      <p role="status">{s.message || (s.hidden ? "Kontoeinstellungen werden geprüft …" : "Farbschema wird in deinem Konto gespeichert.")}</p>
      {buffer && !s.busy && !s.uncertain && <p>Offene Themeänderung unter <Link className="underline" href="/konto/einstellungen">Einstellungen</Link> prüfen.</p>}
      {(s.uncertain || s.hidden) && <button className="underline mt-2" disabled={s.busy} onClick={() => void s.client.recover()}>{s.uncertain ? "Vorgangsstatus prüfen" : "Erneut prüfen"}</button>}
      {s.canRetry && <button className="underline mt-2 block" disabled={s.busy || s.hidden} onClick={() => void s.client.retry()}>Denselben Vorgang erneut senden</button>}
    </>} />;
}

function ThemeMenu({ active, onApply, disabled = false, status, headerMenu = false }: { active: unknown; onApply: (id: ThemeId) => void; disabled?: boolean; status?: React.ReactNode; headerMenu?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onClick(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        ref={trigger}
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-none border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-none"
        title="Farbschema"
        aria-label="Farbschema"
        aria-expanded={open}
        aria-controls={id}
      >
        <Palette className="h-4 w-4" />
      </Button>
      {open && (
        <div id={id} className={`${headerMenu ? "fixed right-4 top-20 md:absolute md:right-0 md:top-full" : "absolute right-0 top-full"} mt-2 w-72 max-w-[calc(100vw-2rem)] z-50 border border-slate-200 bg-white shadow-none`}>
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
                  onClick={() => onApply(t.id)}
                  disabled={disabled}
                  aria-pressed={isActive}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
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
        {status && <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600">{status}</div>}
        </div>
      )}
    </div>
  );
}
