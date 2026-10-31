'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useAccountCheckin} from '@/lib/learning/use-account-checkin';
import {TOPICS} from '@/lib/topics';
import {sameLearningAccount} from '@/lib/learning/personal-contract';
import type {LearningAccount} from '@/lib/learning/progress-contract';
import {Button} from './ui/button';
type CheckinPanelProps={account:LearningAccount;onApplied:()=>void};
export function AccountCheckinPanel(props:CheckinPanelProps){
 if(process.env.NODE_ENV!=='development'&&process.env.NODE_ENV!=='test')return <section className="rounded-xl border p-4 space-y-3" aria-label="Abend-Check-in"><h2 className="text-lg font-semibold">Abend-Check-in</h2><p role="status">Der KI-Check-in ist im ersten Pilot noch nicht verfügbar. Du kannst deinen Lernfortschritt weiterhin manuell eintragen.</p></section>;
 return <LocalAccountCheckinPanel {...props}/>;
}
function LocalAccountCheckinPanel({account,onApplied}:CheckinPanelProps){
 const checkin=useAccountCheckin(),[input,setInput]=useState('');
 const ready=checkin.status==='ready'&&checkin.view&&sameLearningAccount(account,checkin.view.account);
 const result=ready?checkin.result:null;
 return <section className="rounded-xl border p-4 space-y-3" aria-label="Abend-Check-in"><h2 className="text-lg font-semibold">Abend-Check-in</h2>
  <p className="text-sm text-slate-600">Wie war dein Lerntag? Nur dein bestätigter Kontostand wird verwendet. Persönliche Dokumente sind noch nicht angeschlossen.</p>
  <p className="text-sm">Der Aufruf nutzt deinen ausdrücklich ausgewählten <Link className="underline" href="/konto/ki">KI-Zugang</Link> und kann dessen Guthaben verbrauchen. Vorschläge ändern deinen Fortschritt erst nach deiner Bestätigung.</p>
  {!ready?<p role="status">{checkin.message||'Kontokontext wird geprüft …'}</p>:<>
   <p className="text-xs text-slate-500">Modell: {checkin.view!.settings.model}. Vorlage: {checkin.view!.settings.promptDefault?'vorhandene Voreinstellung (nicht gespeichert)':'persönlich gespeichert'}. Denkaufwand: {checkin.view!.settings.reasoningDefault?'vorhandene Voreinstellung (nicht gespeichert)':'persönlich gespeichert'}.</p>
   <div className="space-y-2" aria-label="Flüchtiges Gespräch">{checkin.messages.map((m,i)=><p key={i} className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-sm"><strong>{m.role==='user'?'Du':'Lern-Coach'}: </strong>{m.content}</p>)}</div>
   <form className="flex gap-2" onSubmit={async e=>{e.preventDefault();const r=await checkin.send(input,checkin.view!);if(r)setInput('');}}><label className="flex-1"><span className="sr-only">Dein Lernbericht</span><textarea aria-label="Dein Lernbericht" className="w-full rounded border p-2" maxLength={4000} rows={2} value={input} onChange={e=>setInput(e.target.value)} disabled={checkin.busy||checkin.uncertain}/></label><Button type="submit" disabled={checkin.busy||checkin.uncertain||!input.trim()}>Check-in senden</Button></form>
   {result&&<div className="rounded border p-3 space-y-2"><p className="whitespace-pre-wrap">{result.message}</p>{result.suggestions.map(s=><p key={s.topicId} className="text-sm">{TOPICS.find(t=>t.id===s.topicId)?.label??s.topicId}: <strong>{s.beforePercent}% → {s.percent}%</strong></p>)}{result.state==='ready'&&result.suggestions.length>0&&<Button disabled={checkin.busy||checkin.uncertain} onClick={async()=>{const r=await checkin.apply(result,checkin.view!);if(r?.state==='applied')onApplied();}}>Alle Vorschläge bewusst übernehmen</Button>}{result.state==='applied'&&<p className="text-sm text-green-800">Übernahme bestätigt · {result.requestId}</p>}</div>}
   <p role="status" className="text-sm">{checkin.message}</p>
   {checkin.view!.recent.length>0&&<details><summary>Private Vorgangsbelege</summary><p className="text-xs">Gespräche bleiben flüchtig. Hier findest du Vorschlags- und Übernahmebelege sowie unklare Aufrufe.</p>{checkin.view!.recent.map(r=><button type="button" className="block text-left underline text-sm my-2" key={r.requestId} disabled={checkin.busy} onClick={()=>checkin.select(r)}>{r.operation==='apply'?'Fortschrittsübernahme':'Check-in'} · {r.state==='applied'?'bestätigt':r.state==='ready'?'Vorschlag':r.state==='stale'?'veraltet':r.state==='failed'?'fehlgeschlagen':'offen'} · {r.requestId}</button>)}</details>}
  </>}
  {checkin.uncertain?<Button variant="outline" onClick={checkin.recover}>Vorgangsstatus prüfen</Button>:!ready&&<Button variant="outline" onClick={checkin.reload}>Kontokontext neu laden</Button>}
 </section>;
}
