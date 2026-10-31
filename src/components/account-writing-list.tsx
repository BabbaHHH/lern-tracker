'use client';
import {OriginalWritingList} from "./account-writing-list-view";
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {settingsAccountKey} from '@/lib/learning/settings-contract';
import {useAccountWriting} from '@/lib/learning/use-account-writing';
import {WRITING_TYPES,type DraftFields} from '@/lib/learning/writing-contract';
import {AREA_LABELS,type Area,type KlausurType} from '@/lib/types';
import {pdfViewerURL} from '@/lib/pdf-viewer/contract';
import {AccountWritingStatus} from './account-writing-status';
export interface WritingCatalogEntry {id:string;metadata:{title:string;area:Area};documents:{documentId:string;documentVersionId:string;role:string;versionNumber:number}[]}
export function useWritingCatalog(accountKey:string){
 const [result,setResult]=useState<{key:string;entries:WritingCatalogEntry[];message:string}>({key:'',entries:[],message:''});
 useEffect(()=>{if(!accountKey)return;const ctrl=new AbortController();void fetch('/api/catalog/klausuren',{credentials:'same-origin',cache:'no-store',signal:ctrl.signal}).then(async r=>{const v=await r.json();if(!r.ok||!Array.isArray(v.klausuren))throw Error('Katalog nicht verfügbar.');if(!ctrl.signal.aborted){setResult({key:accountKey,entries:v.klausuren,message:''});}}).catch(()=>{if(!ctrl.signal.aborted){setResult({key:accountKey,entries:[],message:'Katalog nicht verfügbar. Bestehende Verknüpfung bleibt erhalten.'});}});return()=>ctrl.abort();},[accountKey]);
 return result.key===accountKey?result:{entries:[],message:accountKey?'Katalog wird geprüft …':''};
}
export const writingInput='w-full rounded border border-slate-300 p-2';
export function WritingMetadata({fields,onChange,entries}:{fields:DraftFields;onChange:(v:DraftFields)=>void;entries:WritingCatalogEntry[]}){
 return <div className="grid gap-3 md:grid-cols-2"><label className="md:col-span-2">Titel<input className={writingInput} maxLength={200} value={fields.title} onChange={e=>onChange({...fields,title:e.target.value})}/></label><label>Rechtsgebiet<select className={writingInput} value={fields.area??''} onChange={e=>{const area=e.target.value as Area;onChange({...fields,area,type:WRITING_TYPES[area][0],klausurId:undefined});}}><option value="" disabled>Bitte wählen</option>{Object.entries(AREA_LABELS).map(([a,label])=><option key={a} value={a}>{label}</option>)}</select></label><label>Klausurtyp<select className={writingInput} value={fields.type??''} onChange={e=>onChange({...fields,type:e.target.value as KlausurType})}><option value="" disabled>Bitte wählen</option>{(fields.area?WRITING_TYPES[fields.area]:Object.values(WRITING_TYPES).flat()).map(t=><option key={t}>{t}</option>)}</select></label><label className="md:col-span-2">Gemeinsame Klausur (optional)<select className={writingInput} value={fields.klausurId??''} onChange={e=>onChange({...fields,klausurId:e.target.value||undefined})}><option value="">Keine Verknüpfung</option>{fields.klausurId&&!entries.some(k=>k.id===fields.klausurId)&&<option value={fields.klausurId}>Bestehender Bezug: {fields.klausurId}</option>}{entries.filter(k=>k.metadata.area===fields.area).map(k=><option value={k.id} key={k.id}>{k.metadata.title}</option>)}</select></label></div>;
}
export function WritingPdfLinks({klausurId,entries}:{klausurId?:string;entries:WritingCatalogEntry[]}){const entry=entries.find(k=>k.id===klausurId);return entry?<div className="flex flex-wrap gap-3">{entry.documents.map(d=><Link className="underline text-sm" key={d.documentVersionId} href={pdfViewerURL({klausurId:entry.id,documentId:d.documentId,documentVersionId:d.documentVersionId})}>{d.role==='sachverhalt'?'Sachverhalt':d.role==='loesung'?'Lösung':d.role} öffnen · v{d.versionNumber}</Link>)}</div>:null;}
export function AccountWritingList(){
 const state=useAccountWriting(),router=useRouter();
 const ready=state.status==='ready'&&state.view;
 const catalog=useWritingCatalog(ready?settingsAccountKey(state.view!.account):'');
 return <OriginalWritingList key={ready?settingsAccountKey(state.view!.account):'closed'} remote={{
 drafts:ready?state.view!.drafts:[],klausuren:catalog.entries.map(k=>({id:k.id,title:k.metadata.title,area:k.metadata.area})),
 disabled:!ready||state.busy||state.uncertain,
 status:<><AccountWritingStatus state={state}/>{catalog.message&&<p className="text-sm my-2">{catalog.message}</p>}{ready&&state.view!.truncated&&<p>Die 200 neuesten Entwürfe werden angezeigt. Ältere bleiben über ihre Adresse erreichbar.</p>}</>,
 create:async fields=>{const r=await state.client.create({...fields,klausurId:fields.klausurId??null});if(r)router.push(`/schreiben/${r.document.id}`);return !!r;},
 remove:async d=>{await state.client.remove({kind:'draft',id:d.id},d.revision);}
 }}/>;
}
