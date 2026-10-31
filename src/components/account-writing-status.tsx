'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {WritingClient,WritingState,WritingBuffer} from '@/lib/learning/writing-client';
import type {WritingSelection,WritingDocument,NotepadFields,DraftFields} from '@/lib/learning/writing-contract';
const plain=(b:{fields:WritingBuffer['fields']})=>'text' in b.fields?(b.fields as NotepadFields).text:(b.fields as DraftFields).contentText;
export function AccountWritingStatus({state,buffer,selection}:{state:WritingState&{client:WritingClient};buffer?:WritingBuffer;selection?:WritingSelection}){
 const [showEarlier,setShowEarlier]=useState(false),{client}=state;
 const earlier=selection?client.earlier(selection):undefined;
 const current=selection&&state.view?.document&&state.view.document.id===selection.id?state.view.document:null;
 const dirty=buffer&&buffer.version!==buffer.confirmedVersion;
 return <div className="space-y-2 rounded border p-3 text-sm [overflow-wrap:anywhere]" aria-label="Speicherstatus">
  <p role="status">{state.status==='loading'?'Anmeldung und Text werden geprüft …':state.status==='error'?state.message:state.uncertain?'Schreibabschluss unklar – noch nicht als gespeichert bestätigt.':state.busy?'Speichert – noch nicht bestätigt …':buffer?.deleted?'Dieser Entwurf wurde gelöscht. Dein Puffer wird nicht zurückgeschrieben.':buffer?.conflict?'Konflikt: Dein Textpuffer bleibt erhalten.':buffer?.error|| (!buffer&&!selection?'Eigene Entwürfe und private Belege geladen.':dirty?'Änderungen noch nicht bestätigt.':buffer?.baseRevision?'Gespeichert und bestätigt · Revision '+buffer.baseRevision:'Noch kein Text gespeichert.')}</p>
  {state.status==='error'&&<button className="underline" onClick={()=>void client.load(true)}>Anmeldung und Stand erneut prüfen</button>}
  {state.status==='ready'&&<>
   {state.uncertain?<><button className="underline mr-3" disabled={state.busy} onClick={()=>void client.recover()}>Vorgangsstatus prüfen</button>{state.missingReceipt&&<button className="underline" disabled={state.busy} onClick={()=>void client.retryPending()}>Denselben Auftrag erneut senden</button>}</>:dirty&&selection&&!buffer?.conflict&&!buffer?.deleted&&<button className="underline" disabled={state.busy} onClick={()=>void client.flush(`${selection.kind}:${selection.id}`)}>Jetzt speichern</button>}
   {buffer?.error&&<p>{buffer.error}</p>}
   {state.message&&!buffer&&<p>{state.message}</p>}
   {buffer?.conflict&&current&&!current.deleted&&!state.uncertain&&<div className="space-y-2"><label className="block">Aktuelle bestätigte Serverfassung<textarea aria-label="Aktuelle bestätigte Serverfassung" readOnly className="mt-1 w-full rounded border p-2" rows={5} value={plain(current)}/></label><button className="underline mr-3" disabled={state.busy} onClick={()=>void client.resolve(selection!,true)}>Meinen Text ausdrücklich über diese Fassung speichern</button><button className="underline" disabled={state.busy} onClick={()=>void client.resolve(selection!,false)}>Serverfassung laden und meinen Puffer verwerfen</button></div>}
   {buffer&&(dirty||buffer.conflict||buffer.deleted)&&<details><summary>Meinen unbestätigten Text sichern</summary><textarea aria-label="Mein Textpuffer zum Kopieren" readOnly rows={6} className="w-full rounded border p-2" value={plain(buffer)}/><p>Der Puffer bleibt nur in dieser geöffneten Anwendung. Vor Neuladen oder Abmeldung bitte kopieren.</p></details>}
   {earlier&&selection&&<div><p>Für dieses Konto liegt ein unbestätigter Text aus einer früheren Anmeldung vor. Er wird nicht automatisch übertragen.</p><button className="underline" onClick={()=>setShowEarlier(true)}>Früheren eigenen Text bewusst anzeigen</button><button className="ml-3 underline" onClick={()=>client.discardEarlier(selection)}>Früheren Puffer verwerfen</button>{showEarlier&&<><textarea aria-label="Eigener Text aus früherer Anmeldung" readOnly rows={5} className="w-full rounded border p-2" value={plain(earlier)}/>{!buffer?.deleted&&buffer&&<button className="underline" onClick={()=>{client.adoptEarlier(selection);setShowEarlier(false);}}>In den Arbeitspuffer übernehmen und abgleichen</button>}</>}</div>}
   {state.lastResult&&(!selection||state.lastResult.document.id===selection.id)&&<p>Letzter bestätigter privater Beleg: {state.lastResult.requestId} · Revision {state.lastResult.document.revision}{state.lastResult.document.kind==='draft'&&!state.lastResult.document.deleted&&<> · <Link className="underline" href={`/schreiben/${state.lastResult.document.id}`}>Entwurf öffnen</Link></>}</p>}
   {!selection&&state.view?.recent.length!==0&&<details><summary>Private Schreibbelege</summary>{state.view?.recent.map(r=><p key={r.requestId}>{r.kind==='notepad'?'Notizblock':'Entwurf'} · {r.operation==='delete'?'Löschung':'Speicherung'} · Revision {r.revision} · {r.requestId}</p>)}</details>}
  </>}
 </div>;
}
export function WritingFeedback({document}:{document:WritingDocument|null}){return document?.feedback.length?<details className="rounded border p-3"><summary>Vorhandenes Feedback lesen ({document.feedback.length})</summary>{document.feedback.map((f,i)=><p className="whitespace-pre-wrap text-sm mt-3" key={i}>{f.feedbackText}</p>)}</details>:null;}
