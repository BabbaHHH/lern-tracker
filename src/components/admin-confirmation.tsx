"use client";
import { useEffect, useRef } from "react";
export function AdminConfirmation({ title, description, busy, cancel, confirm }: { title: string; description: string; busy: boolean; cancel: () => void; confirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-description" onCancel={event => { if (busy) event.preventDefault(); else cancel(); }} className="m-auto max-w-lg space-y-4 rounded-xl border border-amber-400 p-6 backdrop:bg-slate-900/40">
    <h2 id="admin-confirm-title" className="text-xl font-semibold">{title}</h2><p id="admin-confirm-description">{description}</p>
    <div className="flex gap-3"><button autoFocus disabled={busy} className="rounded-lg border px-4 py-2 disabled:opacity-50" onClick={cancel}>Abbrechen</button><button disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50" onClick={confirm}>Bestätigen</button></div>
  </dialog>;
}
