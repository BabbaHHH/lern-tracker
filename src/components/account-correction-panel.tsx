'use client';
import {useState,useEffect,useRef,type RefObject} from 'react';
import {getTextBetween,getTextSerializersFromSchema,type Editor} from '@tiptap/react';
import {confirmedSelectionRange} from '@/lib/learning/correction-core';
import Link from 'next/link';
import {KORREKTUR_MODELS} from '@/lib/ai-models';
import type {KorrekturSettings,KorrekturGranularity} from '@/lib/types';
import type {LearningAccount} from '@/lib/learning/progress-contract';
import type {CorrectionFocus,CorrectionView} from '@/lib/learning/correction-contract';
import {sameLearningAccount} from '@/lib/learning/personal-contract';
import {useAccountCorrection} from '@/lib/learning/use-account-correction';
import type {CorrectionClient} from '@/lib/learning/correction-client';
const input='w-full rounded border border-slate-300 p-2';
function SettingsForm({view,client,busy}:{view:CorrectionView;client:CorrectionClient;busy:boolean}){
 const [fields,setFields]=useState<KorrekturSettings>(view.settings),[revision,setRevision]=useState(view.settingsRevision);
 return <form className="space-y-3 rounded border p-3" onSubmit={async e=>{e.preventDefault();const r=await client.saveSettings(fields,revision);if(r?.state==='applied'&&r.settingsRevision)setRevision(r.settingsRevision);}}><h3 className="font-semibold">Private Korrektureinstellungen</h3><label className="block">Korrekturmodell<input aria-label="Korrekturmodell" list="account-correction-models" className={input} maxLength={160} value={fields.model} onChange={e=>setFields({...fields,model:e.target.value})}/><datalist id="account-correction-models">{KORREKTUR_MODELS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</datalist></label><label className="block">Granularität<select className={input} value={fields.granularity} onChange={e=>setFields({...fields,granularity:e.target.value as KorrekturGranularity})}><option value="manuell">Manuell / Auswahl</option><option value="wort">Wort</option><option value="satz">Satz</option><option value="absatz">Absatz</option></select></label><p className="text-xs">Auch Wort-, Satz- und Absatzkorrekturen starten hier ausschließlich durch deinen Klick. Gespeicherte Werte aktivieren keine automatische Korrektur.</p>{revision!==view.settingsRevision&&<p>Der bestätigte Einstellungsstand wurde inzwischen geändert. Deine Eingabe bleibt erhalten; bitte aktuelle Werte abgleichen.</p>}<button className="underline" disabled={busy}>Einstellungen bewusst speichern</button><p className="text-xs">{view.settingsDefault?'Vorhandene Voreinstellung · nicht gespeichert':`Bestätigte Einstellungen · Revision ${view.settingsRevision}`}{view.legacyModelUpgraded?' · Bekannte Altmodellkennung wird wie in der Browserfassung nur in der Ansicht auf die bestehende Nachfolgevorgabe aufgelöst.':''}</p></form>;
}
type CorrectionPanelProps={account:LearningAccount;draftId?:string;confirmedText?:string;confirmed?:boolean;confirmedRevision?:number;editor?:RefObject<Editor|null>};
export function AccountCorrectionPanel(props:CorrectionPanelProps){
 if(process.env.NODE_ENV!=='development'&&process.env.NODE_ENV!=='test')return <section className="space-y-3 rounded border p-4" aria-label="Private Korrektur"><h2 className="font-serif text-xl">KI-Korrektur</h2><p role="status">Die KI-Korrektur ist im ersten Pilot noch nicht verfügbar. Du kannst deine Texte weiterhin manuell schreiben und speichern.</p></section>;
 return <LocalAccountCorrectionPanel {...props}/>;
}
function LocalAccountCorrectionPanel({account,draftId,confirmedText='',confirmed=false,confirmedRevision,editor}:CorrectionPanelProps){
 const state=useAccountCorrection(draftId),[local,setLocal]=useState(''),[resetRevision,setResetRevision]=useState<number|null|undefined>(),{client}=state;
 const ready=state.status==='ready'&&state.view&&sameLearningAccount(account,state.view.account)&&state.view.draftId===(draftId??null);
 const view=ready?state.view!:null,result=ready?state.result:null;
 const previousRevision=useRef(confirmedRevision);useEffect(()=>{if(previousRevision.current!==confirmedRevision){previousRevision.current=confirmedRevision;if(client.active&&!client.state.busy)void client.load();}},[client,confirmedRevision]);
 const pending=view?.recent.some(r=>r.state==='pending'),busy=state.busy||state.uncertain||!!pending;
 const textConfirmed=confirmed&&confirmedRevision===view?.draftRevision;const canRun=!!view?.snapshot&&textConfirmed&&!busy;
 async function run(mode:'gesamt'|'manuell'|'granularity'){
  if(!canRun||!view)return;setLocal('');let focus:CorrectionFocus;
  if(mode==='gesamt')focus={mode:'gesamt'};
  else{
   const e=editor?.current;if(!e||e.isDestroyed){setLocal('Bitte zuerst eine bestätigte Textstelle im Editor auswählen.');return;}
   const {from,to}=e.state.selection,options={textSerializers:getTextSerializersFromSchema(e.schema)};
   const range=confirmedSelectionRange(confirmedText,{
    full:e.getText(),prefix:getTextBetween(e.state.doc,{from:0,to:from},options),
    through:getTextBetween(e.state.doc,{from:0,to},options),selected:getTextBetween(e.state.doc,{from,to},options),
   });
   if(!range){setLocal('Die Auswahl lässt sich nicht eindeutig dem bestätigten Text zuordnen. Bitte zuerst speichern und neu auswählen.');return;}
   if(mode==='manuell'){
    if(!confirmedText.slice(range.start,range.end).trim()){setLocal('Bitte eine nicht leere Textstelle auswählen.');return;}
    focus={mode:'manuell',...range};
   }else{const granularity=view.settings.granularity;if(granularity==='manuell')return;focus={mode:granularity,caret:range.start};}
  }
  await client.run(focus);
 }
 return <section className="space-y-3 rounded border p-4" aria-label="Private Korrektur"><h2 className="font-serif text-xl">Korrektur und Fehlerprofil</h2><p className="text-sm">Ein bewusst gestarteter Aufruf nutzt deinen ausgewählten <Link href="/konto/ki" className="underline">persönlichen KI-Zugang</Link> und kann dessen Guthaben verbrauchen. Nur die bestätigte eigene Textfassung wird bewertet.</p>
  <p role="status">{ready?state.message:state.status==='error'?state.message:'Korrekturgrundlage wird geprüft …'}</p>
  {!ready?<button className="underline" onClick={()=>void client.load(true)}>Korrekturgrundlage erneut prüfen</button>:<>
   <SettingsForm key={account.sessionContext} view={view!} client={client} busy={busy}/>
   {view!.issues.map(issue=><p className="text-sm text-amber-900" key={issue}>{issue}</p>)}
   <p className="text-xs">Vorlagen: {view!.promptDefaults?'bestehende Voreinstellungen (nicht gespeichert)':'eigene gespeicherte Vorlage'}. Denkaufwand: {view!.reasoningDefault?'bestehende Voreinstellung (nicht gespeichert)':'eigene gespeicherte Einstellung'}. Persönliche Dokumente und gemeinsame PDF-Inhalte werden nicht nachgeladen.</p>
   {draftId&&<div className="space-y-2"><p>{textConfirmed?'Eigene Textfassung bestätigt.':'Korrektur zurückgestellt: Text oder Speicherabschluss ist noch nicht bestätigt. Bitte zuerst den Schreibstatus klären.'}</p><div className="flex flex-wrap gap-3"><button className="rounded border px-3 py-2" disabled={!canRun} onClick={()=>void run('gesamt')}>Gesamten bestätigten Entwurf korrigieren</button><button className="rounded border px-3 py-2" disabled={!canRun} onClick={()=>void run('manuell')}>Markierten Abschnitt korrigieren</button>{view!.settings.granularity!=='manuell'&&<button className="rounded border px-3 py-2" disabled={!canRun} onClick={()=>void run('granularity')}>Fokus nach Granularität jetzt korrigieren</button>}</div>{local&&<p role="status">{local}</p>}</div>}
   {pending&&!state.uncertain&&<p>Eine Korrektur ist noch offen. Bitte im privaten Vorgangsverlauf auswählen und ihren Status prüfen.</p>}
   {state.uncertain&&<div className="flex gap-3"><button className="underline" disabled={state.busy} onClick={()=>void client.recover()}>Korrekturstatus prüfen</button><button className="underline" disabled={state.busy} onClick={()=>void client.abandon()}>Offenen Versuch ausdrücklich beenden</button></div>}
   {result&&<div className="space-y-2 rounded border p-3"><p>{result.message}</p><p className="text-xs">Privater Korrekturbeleg: {result.requestId} · {result.state}</p>{result.feedback&&<><p className="text-xs">Feedback-ID: {result.feedback.id} · {result.feedback.scope} · {result.feedback.model}</p><p className="text-xs">Bewertete bestätigte Entwurfsrevision: {result.sourceDraftRevision??'historisch'} · Feedback gespeichert: {result.feedback.createdAt}</p>{result.feedback.excerpt&&<blockquote className="whitespace-pre-wrap border-l-2 pl-3 text-sm">{result.feedback.excerpt}</blockquote>}<p className="whitespace-pre-wrap">{result.feedback.feedbackText}</p>{result.feedback.markers.map(m=><p key={m.key}>{m.label} · {m.severity??'ohne Schweregrad'} · {m.key}</p>)}</>}</div>}
   <details><summary>Private Korrekturvorgänge</summary>{view!.recent.map(r=><button type="button" key={r.requestId} className="block underline text-sm my-2 text-left" disabled={state.busy} onClick={()=>client.select(r)}>{r.operation} · {r.state} · {r.requestId}</button>)}</details>
   <div className="space-y-2"><h3 className="font-semibold">Dein bestätigtes Fehlerprofil</h3>{!view!.profile?<p>{view!.profileRevision?'Profil enthält ungültige Daten.':'Noch keine gespeicherten Muster.'}</p>:<><p className="text-xs">Revision {view!.profileRevision} · {Object.keys(view!.profile.markers).length} Muster</p>{Object.entries(view!.profile.markers).slice(0,50).map(([key,m])=><p className="text-sm" key={key}>{m.label}: {m.count}× · {m.trend} · {key}{m.byType&&Object.entries(m.byType).map(([type,n])=>` · ${type}: ${n}×`).join('')}</p>)}{Object.keys(view!.profile.markers).length>50&&<p>Die ersten 50 Muster werden angezeigt.</p>}</>}
    <button className="underline" disabled={busy} onClick={()=>setResetRevision(view!.profileRevision)}>Fehlerprofil zurücksetzen</button>{resetRevision!==undefined&&<div className="rounded border p-3"><p>Nur deine gespeicherten Musterzähler zurücksetzen? Vorhandenes Feedback bleibt erhalten.</p><button className="underline mr-3" disabled={busy} onClick={async()=>{await client.reset(resetRevision);setResetRevision(undefined);}}>Zurücksetzen bewusst bestätigen</button><button className="underline" onClick={()=>setResetRevision(undefined)}>Abbrechen</button></div>}
   </div>
  </>}
 </section>;
}
