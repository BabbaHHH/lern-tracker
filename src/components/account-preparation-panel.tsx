'use client';
import {useState} from 'react';
import Link from 'next/link';
import {addDays,parseISO} from 'date-fns';
import {localDate,isDateOnly} from '@/lib/dates';
import {sameLearningAccount} from '@/lib/learning/personal-contract';
import type {LearningAccount} from '@/lib/learning/progress-contract';
import type {PreparationView} from '@/lib/learning/preparation-contract';
import {useAccountPreparation} from '@/lib/learning/use-account-preparation';
import {preparationKnownMinutes} from '@/lib/learning/preparation-duration';
import {PlanningBacklog} from './planning-backlog';
const button='border rounded px-3 py-2 text-sm disabled:opacity-40';
type Data=ReturnType<typeof useAccountPreparation>;

export function AccountPreparationPanel({account,initialDates,onSaved}:{account:LearningAccount;initialDates:string[];onSaved?:()=>void}){
 const data=useAccountPreparation(),view=data.view;
 const matches=view&&sameLearningAccount(account,view.account);
 return <section className="border rounded p-4 space-y-3" aria-label="Tagesvorbereitung"><h2 className="text-lg font-semibold">Tagesvorbereitung</h2><p className="text-sm">Prüfe Rückstände und freie Lernzeit. Neue Themen- und Wiederholungsvorschläge werden erst nach deiner Bestätigung gespeichert.</p>
 <p role="status">{data.status==='loading'?'Anmeldung und Vorbereitung werden geprüft …':data.message||'Bestätigter Stand geladen'}</p>
 {data.status==='error'&&<div className="flex gap-3"><button className={button} onClick={data.uncertain?data.recover:data.reload}>{data.uncertain?'Ergebnis prüfen':'Neu laden'}</button><Link className="underline" href="/konto/anmelden">Bitte neu anmelden</Link></div>}
 {matches&&<div hidden={data.status!=='ready'} key={`${view.account.userId}:${view.account.accessGeneration}:${view.account.sessionContext}:${initialDates.join(',')}`}><PreparationBody data={data} view={view} initialDates={initialDates} onSaved={onSaved}/></div>}
 {!matches&&data.status==='ready'&&<p>Die Anmeldung hat sich geändert. Bitte den Lernkalender neu öffnen.</p>}</section>;
}
function PreparationBody({data,view,initialDates,onSaved}:{data:Data;view:PreparationView;initialDates:string[];onSaved?:()=>void}){
 const [dates,setDates]=useState(()=>{const selected=initialDates.filter(d=>d>=view.today&&d<=view.end).slice(0,7);return selected.length?selected:[view.today];});
 const preview=data.preview,visiblePreview=preview&&preview.dates.join(',')===[...dates].sort().join(',');
 const backlog=visiblePreview?preview.backlog:view.backlog;
 return <div className="space-y-4"><fieldset disabled={data.busy} className="space-y-2"><legend>Ein bis sieben Tage auswählen</legend><div className="flex flex-wrap gap-3">{dates.map((date,i)=><div key={i}><label className="block text-sm">Tag {i+1}<input aria-label={`Vorbereitungstag ${i+1}`} className="block border rounded p-2" type="date" min={view.today} max={view.end} value={date} onChange={e=>setDates(dates.map((d,n)=>n===i?e.target.value:d))}/></label>{dates.length>1&&<button className="underline text-sm" onClick={()=>setDates(dates.filter((_,n)=>n!==i))}>Tag entfernen</button>}</div>)}</div>
 {dates.length<7&&<button className={button} disabled={!isDateOnly(dates.at(-1)||view.today)} onClick={()=>setDates([...dates,localDate(addDays(parseISO(dates.at(-1)||view.today),1))])}>Tag ergänzen</button>}
 <button className={`${button} ml-2`} onClick={()=>void data.previewDays(dates,view)}>Vorbereitung prüfen</button></fieldset>
 <PlanningBacklog account tasks={backlog.map(b=>b.task)} reasons={Object.fromEntries(backlog.map(b=>[b.task.id,b.reason]))}/>
 {visiblePreview&&<section aria-label="Vorbereitungsvorschau" className="border rounded p-3 space-y-3"><h3 className="font-semibold">Vorschau der Vorbereitung</h3><p className="text-sm">Ausgewählte Tage: {preview.dates.join(', ')}. {preview.created} neu · {preview.moved} verschoben · {preview.deferred} zurückgestellt. Rückstände werden höchstens bis {preview.end} eingeplant.</p>
 {preview.warnings.map((warning,i)=><p key={i} className="text-amber-900">{warning}</p>)}
 <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th className="text-left p-2">Änderung</th><th className="text-left p-2">Aufgabe</th><th className="text-left p-2">Vorher → danach</th></tr></thead><tbody>{preview.changes.map(c=>{const task=c.after as import('@/lib/store').DailyTask;return <tr className="border-t" key={c.id}><td className="p-2">{!c.before?'Neu':task.deferred?'Zurückgestellt':'Verschoben'}</td><td className="p-2">{task.title} · {preparationKnownMinutes(task)??'Dauer offen'} Min.</td><td className="p-2">{c.before?.date??'–'} → {task.date}{task.deferred?' · Rückstand':''}</td></tr>;})}</tbody></table></div>
 {!preview.changes.length&&<p>Keine neuen Änderungen. Vorhandene Arbeit und bewusst entfernte Vorschläge bleiben erhalten.</p>}
 <p className="text-sm">Feste, manuell bearbeitete und erledigte Arbeit bleibt erhalten. Verknüpfte Kalendertermine werden nicht von ihren Aufgaben gelöst. Eine veraltete Vorschau wird vollständig abgewiesen.</p>
 <button className={button} disabled={data.busy||!preview.changes.length} onClick={async()=>{const saved=await data.submit(preview,view);if(saved)onSaved?.();}}>Vorbereitung bewusst übernehmen</button></section>}
 </div>;
}
