'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAccountCatalog } from '@/lib/catalog/use-account-catalog';
import { KlausurenView, type KlausurenAccountAdapter } from './klausuren-view';
import { CatalogImportApp } from './catalog-import-app';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { WRITING_TYPES } from '@/lib/learning/writing-contract';
import { AREA_LABELS, type Klausur, type KlausurType } from '@/lib/types';

/** Same dialog primitives as the original creation flow; no default classification. */
export function CatalogWritingTypeDialog({exam,busy,status,onCancel,onCreate}:{exam:Klausur;busy:boolean;status:React.ReactNode;onCancel:()=>void;onCreate:(type:KlausurType)=>Promise<void>}) {
  const [type,setType] = useState<KlausurType | ''>('');
  return <Dialog open onOpenChange={open => { if (!open) onCancel(); }}><DialogContent className="max-w-md mx-auto rounded-2xl"><DialogHeader><DialogTitle>Neue Klausur schreiben</DialogTitle></DialogHeader>
    <form className="space-y-4 pt-2" onSubmit={e => { e.preventDefault(); if (type && !busy) void onCreate(type); }}>
      <p className="text-sm">Für diesen Katalogfall ist kein Typ hinterlegt. Wähle den Typ für deinen privaten Entwurf.</p>
      <p className="font-medium break-words">{exam.title}</p><p className="text-xs text-slate-500">{AREA_LABELS[exam.area]} · {exam.id}</p>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Klausurtyp<select required value={type} onChange={e => setType(e.target.value as KlausurType | '')} className="mt-1 h-9 w-full border border-slate-200 bg-white px-2 text-sm"><option value="" disabled>Bitte Typ wählen</option>{WRITING_TYPES[exam.area].map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      {status}<div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button><Button type="submit" disabled={!type || busy}>Schreiben</Button></div>
    </form>
  </DialogContent></Dialog>;
}

export function AccountKlausurenPage() {
  const state = useAccountCatalog();
  const [uploadOpen, setUploadOpen] = useState(false);
  const session = state.schedule.view?.account.sessionContext ?? '';
  const status = <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-600" role={state.status === 'error' || state.meta.status === 'error' ? 'alert' : 'status'}>
    <p className="flex-1 min-w-0 break-words">{state.status === 'loading' ? 'Die Klausurdatenbank wird geladen. Das kann einen Moment dauern. Falls die Anzeige hängen bleibt, lade die Seite neu.' : state.catalogErrorPresentation?.message || state.message || 'Gemeinsamer Katalog · persönliche Bearbeitungen bleiben privat.'}</p>
    <button type="button" className="underline" disabled={state.busy && state.status !== 'error' && !state.meta.uncertain && !state.schedule.uncertain && !state.writing.uncertain} onClick={() => void state.recover()}>{state.meta.uncertain || state.schedule.uncertain || state.writing.uncertain ? 'Ergebnis prüfen' : 'Neu laden'}</button>
    {state.catalogErrorPresentation?.href && <Link className="underline" href={state.catalogErrorPresentation.href}>{state.catalogErrorPresentation.actionLabel}</Link>}
  </div>;
  if (!state.ready || !state.schedule.view) return <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full"><h1 className="text-xl font-bold">Klausur-Datenbank</h1>{status}</main>;
  const adapter: KlausurenAccountAdapter = {
    klausuren: state.klausuren, trackingEntries: state.trackingEntries, admin: state.admin, busy: state.busy,
    confirmedRequestId: state.confirmedRequestId,
    statusPanel: status,
    uploadPanel: <div className="mb-4 flex flex-wrap items-center gap-3 text-xs"><Button size="sm" variant="outline" className="rounded-xl" disabled={state.busy} onClick={() => setUploadOpen(true)}>Sachverhalt und Lösung einreichen</Button><Link className="text-slate-600 underline" href="/konto/klausuren/suche">PDF-Inhalte durchsuchen</Link>{!state.admin && <span className="text-slate-500">Gemeinsame Metadaten verwaltet Niklas.</span>}</div>,
    importPanel: <>{status}{state.preview && <section className="rounded-xl border border-slate-200 p-3 space-y-3 text-xs" aria-label="Importvorschau"><p className="font-semibold">Vorschau · {state.preview.rows.length} Klausuren</p><ul className="max-h-40 overflow-y-auto space-y-1">{state.preview.rows.map(r => <li key={r.id} className={r.disposition === 'conflict' ? 'text-red-700' : ''}>{r.id} · {r.disposition === 'create' ? 'neu' : r.disposition === 'identical' ? 'bereits identisch' : 'ID-Konflikt – nicht überschrieben'}</li>)}</ul>{state.preview.rows.some(r => r.disposition === 'conflict') && <p>Der gesamte Batch bleibt unverändert. Bitte Konflikte in der Eingabe klären und erneut prüfen.</p>}<Button className="w-full rounded-xl" disabled={state.busy || state.preview.rows.some(r => r.disposition === 'conflict')} onClick={() => void state.importPreview()}>Diese Vorschau übernehmen</Button></section>}</>,
    pdfLinks: k => {
      const links = state.pdfLinks(k.id);
      return links.length ? <>{links.map(d => {
        const roleLabel = d.role === 'loesung' ? 'Lösung' : d.role === 'sachverhalt' ? 'Sachverhalt' : d.role === 'kombiniert' ? 'Kombiniertes PDF' : d.role;
        const accessibleLabel = `${roleLabel} öffnen · Version ${d.versionNumber}`;
        return <Link
          key={d.documentVersionId}
          className="inline-flex items-center border border-slate-200 px-2.5 py-1 rounded-lg text-xs hover:bg-slate-50"
          href={d.href}
          title={accessibleLabel}
          aria-label={accessibleLabel}
        >
          {d.role === 'kombiniert' ? 'Öffnen' : `${roleLabel} öffnen · v${d.versionNumber}`}
        </Link>;
      })}</> : <span className="self-center text-xs text-slate-500">Noch kein PDF zugeordnet</span>;
    },
    edit: state.edit, save: state.save, remove: state.remove, previewImport: state.previewImport, jsonChanged: state.jsonChanged,
    done: state.done, plan: state.plan, write: state.write, boosts: state.boosts,
  };
  return <><KlausurenView key={session} account={adapter} />{state.writingChoice && <CatalogWritingTypeDialog key={`${session}:${state.writingChoice.id}`} exam={state.writingChoice} busy={state.busy} status={status} onCancel={state.cancelWritingChoice} onCreate={state.createWithType} />}<Dialog open={uploadOpen} onOpenChange={setUploadOpen}><DialogContent className="max-w-2xl mx-auto max-h-[85vh] overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>Sachverhalt und Lösung einreichen</DialogTitle></DialogHeader><CatalogImportApp key={session} embedded onImported={state.reload} /></DialogContent></Dialog></>;
}
