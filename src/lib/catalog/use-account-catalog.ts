'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAccountSchedule } from '../learning/use-account-schedule';
import { subscribeInitialScheduleRead } from '../learning/schedule-client';
import { useAccountWriting } from '../learning/use-account-writing';
import type { LearningAccount } from '../learning/progress-contract';
import { scheduleValues, type ScheduleView } from '../learning/schedule-contract';
import { localDate } from '../dates';
import { calculateKlausurDelta, type DailyTask } from '../store';
import { isCoreArea, type Area, type Klausur, type CatalogKlausur, type Progress, type TrackingEntry } from '../types';
import { CatalogMetadataClient } from './metadata-client';
import { METADATA_MAX_BATCH, METADATA_MAX_BYTES, type MetadataEntry, type MetadataFields, type MetadataReadFields } from './metadata-contract';
import { pdfViewerURL } from '../pdf-viewer/contract';
import { WRITING_TYPES } from '../learning/writing-contract';
import type { KlausurType } from '../types';

const READ_TIMEOUT_MS = 20_000;
export interface AccountCatalogDocument { documentId: string; documentVersionId: string; role: string; versionNumber: number }
export interface AccountCatalogEntry { id: string; revision: number; metadata: MetadataReadFields; documents: AccountCatalogDocument[] }
export const accountCatalogKey=(account:LearningAccount|null)=>account?`${account.userId}:${account.accessGeneration}:${account.sessionContext}`:'';
export interface AccountCatalogRead { account: { userId: string; status: string; role: string; revision: number; bootstrap: boolean }; entries: AccountCatalogEntry[] }
export type CatalogReadSource = '/api/account' | '/api/catalog/klausuren';
export type CatalogReadErrorKind = 'http' | 'timeout' | 'network' | 'response';
export class CatalogReadFailure extends Error {
  readonly sources: CatalogReadSource[];
  constructor(readonly kind:CatalogReadErrorKind,readonly status:number|null,sources:CatalogReadSource[]){super('Kontozugriff oder Katalog konnte nicht bestätigt werden.');this.name='CatalogReadFailure';this.sources=[...new Set(sources)];}
}
type CatalogReadOutcome = {kind:'ready';value:AccountCatalogRead}|{kind:'error';error:CatalogReadFailure}|{kind:'cancelled'};
type CatalogReadActivity = (source:CatalogReadSource,pending:boolean)=>void;
type CatalogReadLoader = (signal:AbortSignal,activity:CatalogReadActivity)=>Promise<AccountCatalogRead>;
type PendingCatalogRead = {requestId:number;controller:AbortController;timeout:ReturnType<typeof setTimeout>;promise:Promise<CatalogReadOutcome>;boundKey:string|null};
type ActiveCatalogRead = {controller:AbortController;timeout:ReturnType<typeof setTimeout>};
type CatalogDataState = {key:string;refresh:number;status:'loading'|'ready'|'error';hasSnapshot:boolean;role:string;entries:AccountCatalogEntry[];error:CatalogReadFailure|null};
export function catalogReadPresentation(error:CatalogReadFailure|null):{message:string;href?:string;actionLabel?:string}|null {
  if(!error)return null;
  if(error.status===401)return {message:'Bitte melde dich an, um den Klausurkatalog zu öffnen.',href:'/konto/anmelden',actionLabel:'Anmelden'};
  if(error.status===403)return {message:'Dieses Konto ist für den Klausurkatalog derzeit eingeschränkt.',href:'/konto',actionLabel:'Zum Kontobereich'};
  const source=error.sources.length===1?(error.sources[0]==='/api/account'?'Der Kontozugriff':'Der gemeinsame Katalog'):'Der Kontozugriff oder gemeinsame Katalog';
  return {message:`${source} ist vorübergehend nicht verfügbar. Bitte erneut versuchen.`};
}
export function accountCatalogStatus(scheduleStatus:'loading'|'ready'|'error',key:string,data:Pick<CatalogDataState,'key'|'refresh'|'status'>,refresh:number):'loading'|'ready'|'error' {
  if(scheduleStatus==='error')return 'error';
  if(scheduleStatus==='loading')return 'loading';
  if(key&&data.key===key&&data.refresh!==refresh)return 'loading';
  if(key&&data.key===key&&data.status==='error')return 'error';
  return key&&data.key===key&&data.status==='ready'?'ready':'loading';
}
export function accountCatalogHasSnapshot(key:string,data:Pick<CatalogDataState,'key'|'hasSnapshot'>):boolean {
  return !!key&&data.key===key&&data.hasSnapshot;
}
function transientCatalogReadError(error:CatalogReadFailure):boolean {
  return error.kind==='timeout'||error.kind==='network'||error.kind==='response'||(error.kind==='http'&&error.status!==null&&error.status>=500&&error.status<600);
}
export function catalogDataAfterReadError(current:CatalogDataState,key:string,refresh:number,error:CatalogReadFailure):CatalogDataState {
  if(transientCatalogReadError(error)&&accountCatalogHasSnapshot(key,current))return {...current,refresh,status:'error',error};
  return {key,refresh,status:'error',hasSnapshot:false,role:'',entries:[],error};
}
export async function readAccountCatalog(signal:AbortSignal,transport:typeof fetch=fetch,activity:CatalogReadActivity=()=>{}):Promise<AccountCatalogRead> {
  const get=async(source:CatalogReadSource)=>{
    activity(source,true);
    try{
      let response:Response;
      try{response=await transport(source,{credentials:'same-origin',cache:'no-store',signal});}
      catch(error){if(signal.aborted)throw error;throw new CatalogReadFailure('network',null,[source]);}
      if(!response.ok)throw new CatalogReadFailure('http',response.status,[source]);
      try{return await response.json();}
      catch(error){if(signal.aborted)throw error;throw new CatalogReadFailure('response',response.status,[source]);}
    }finally{activity(source,false);}
  };
  const [identity,list]=await Promise.all([get('/api/account'),get('/api/catalog/klausuren')]);
  const account=identity?.account;
  if(identity?.contractVersion!==1||typeof account?.userId!=='string'||account.status!=='active'||!['admin','member'].includes(account.role)||!Number.isSafeInteger(account.revision)||account.bootstrap!==false)throw new CatalogReadFailure('response',200,['/api/account']);
  if(list?.contractVersion!==1||!Array.isArray(list.klausuren))throw new CatalogReadFailure('response',200,['/api/catalog/klausuren']);
  let entries:AccountCatalogEntry[];
  try{entries=list.klausuren.map((r:AccountCatalogEntry)=>{
    if(!r||typeof r.id!=='string'||!Number.isSafeInteger(r.revision)||!r.metadata||typeof r.metadata!=='object'||!Array.isArray(r.metadata.topicIds)||!Array.isArray(r.documents))throw Error('invalid catalog entry');
    return {id:r.id,revision:r.revision,metadata:{id:r.id,source:r.metadata.source,title:r.metadata.title,area:r.metadata.area,date:r.metadata.date??'',...(r.metadata.type?{type:r.metadata.type}:{}),topicIds:[...r.metadata.topicIds],...('legacy' in r.metadata?{legacy:r.metadata.legacy}:{})},documents:r.documents};
  });}catch{throw new CatalogReadFailure('response',200,['/api/catalog/klausuren']);}
  return {account:{userId:account.userId,status:account.status,role:account.role,revision:account.revision,bootstrap:account.bootstrap},entries};
}
export class CatalogReadCoordinator {
  private pending:PendingCatalogRead|null=null;
  constructor(private readonly load:CatalogReadLoader=(signal,activity)=>readAccountCatalog(signal,fetch,activity),private readonly timeoutMs=READ_TIMEOUT_MS){}
  start(requestId:number){
    if(this.pending?.requestId===requestId)return;
    this.cancel();const controller=new AbortController();let timedOut=false;let timeoutSources:CatalogReadSource[]=[];const pendingSources=new Set<CatalogReadSource>();
    const timeoutError=()=>new CatalogReadFailure('timeout',null,timeoutSources);
    const timeout=setTimeout(()=>{timedOut=true;timeoutSources=[...pendingSources];controller.abort();},this.timeoutMs);
    const activity:CatalogReadActivity=(source,pending)=>{if(pending)pendingSources.add(source);else pendingSources.delete(source);};
    const promise:Promise<CatalogReadOutcome>=this.load(controller.signal,activity).then(value=>timedOut?{kind:'error' as const,error:timeoutError()}:controller.signal.aborted?{kind:'cancelled' as const}:{kind:'ready' as const,value}).catch(error=>{
      if(timedOut)return {kind:'error' as const,error:timeoutError()};
      if(controller.signal.aborted)return {kind:'cancelled' as const};
      controller.abort();return {kind:'error' as const,error:error instanceof CatalogReadFailure?error:new CatalogReadFailure('network',null,[...pendingSources])};
    }).finally(()=>clearTimeout(timeout));
    this.pending={requestId,controller,timeout,promise,boundKey:null};
  }
  cancel(requestId?:number){const pending=this.pending;if(!pending||(requestId!==undefined&&pending.requestId!==requestId))return;clearTimeout(pending.timeout);pending.controller.abort();this.pending=null;}
  bind(requestId:number|null,key:string):PendingCatalogRead|null {
    const pending=this.pending;if(!pending)return null;
    if(requestId===null||pending.requestId!==requestId){this.cancel();return null;}
    if(pending.boundKey!==null&&pending.boundKey!==key){this.cancel(requestId);return null;}
    pending.boundKey=key;return pending;
  }
  finish(requestId:number){if(this.pending?.requestId===requestId){clearTimeout(this.pending.timeout);this.pending=null;}}
}
export function subscribeAccountSignout(target:EventTarget,onSignedOut:()=>void){const listener=()=>onSignedOut();target.addEventListener('stex:account-signed-out',listener);return()=>target.removeEventListener('stex:account-signed-out',listener);}
export function parsePublicCatalogJSON(text: string): MetadataFields[] {
  if (new TextEncoder().encode(text).byteLength > METADATA_MAX_BYTES) throw Error('Bitte höchstens 256 KiB Metadaten pro Batch einfügen.');
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  let values: unknown[];
  try { const v: unknown = JSON.parse(cleaned); values = Array.isArray(v) ? v : [v]; }
  catch {
    values = []; let depth = 0, start = -1, string = false, escape = false;
    // The original dialog accepts successive objects and multiple JSON files.
    for (let i = 0; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (escape) { escape = false; continue; }
      if (c === '\\' && string) { escape = true; continue; }
      if (c === '"') { string = !string; continue; }
      if (string) continue;
      if (c === '{') { if (depth === 0) start = i; depth++; }
      else if (c === '}') { if (--depth < 0) throw Error('Ungültiges JSON.'); if (depth === 0 && start >= 0) { values.push(JSON.parse(cleaned.slice(start, i + 1))); start = -1; } }
      else if (depth === 0 && !/[\s,\[\]]/.test(c)) throw Error('Bitte ausschließlich JSON-Objekte oder Arrays einfügen.');
    }
    if (depth || string) throw Error('Das JSON ist unvollständig.');
  }
  if (!values.length || values.length > METADATA_MAX_BATCH) throw Error('Bitte 1 bis 100 Klausuren pro Vorschau auswählen.');
  const allowed = ['id', 'source', 'date', 'title', 'area', 'type', 'topicIds'];
  return values.map((v, i) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error(`Eintrag ${i + 1} ist kein Metadatenobjekt.`);
    const r = v as Record<string, unknown>;
    if (Object.keys(r).some(k => !allowed.includes(k))) throw Error(`Eintrag ${i + 1} enthält zusätzliche Felder. Nur id/source/date/title/area/type/topicIds sind öffentlich; persönliche Erweiterungen bleiben privat.`);
    if (typeof r.id !== 'string' || !r.id.trim() || typeof r.source !== 'string' || typeof r.title !== 'string' || !['zr', 'oeffr', 'sr'].includes(String(r.area)) || (r.date != null && typeof r.date !== 'string') || !Array.isArray(r.topicIds) || r.topicIds.some(t => typeof t !== 'string') || (r.type != null && typeof r.type !== 'string')) throw Error(`Öffentliche Pflichtfelder in Eintrag ${i + 1} fehlen oder sind ungültig.`);
    return { id: r.id, source: r.source, title: r.title, area: r.area as Area, date: typeof r.date === 'string' ? r.date : '', ...(r.type ? { type: r.type as MetadataFields['type'] } : {}), topicIds: [...r.topicIds] };
  });
}
export function catalogTask(view: ScheduleView, klausurId: string, date: string, mode?: 'written' | 'read'): DailyTask | undefined {
  return scheduleValues<DailyTask>(view, 'task').find(t => !t.deferred && t.linkedKlausurId === klausurId && t.date === date && (!mode || (t.klausurMode ?? (/^Skizze:/i.test(t.title) ? 'read' : 'written')) === mode));
}
export function useAccountCatalog() {
  const schedule = useAccountSchedule(), writing = useAccountWriting(), router = useRouter();
  const [metadata] = useState(() => new CatalogMetadataClient());
  const meta = useSyncExternalStore(metadata.subscribe, metadata.getSnapshot, metadata.getSnapshot);
  const a = schedule.view?.account;
  const key = accountCatalogKey(a??null);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<CatalogDataState>({ key: '', refresh: -1, status: 'loading', hasSnapshot:false, role: '', entries: [], error: null });
  const [work, setWork] = useState(false), [message, setMessage] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [writingChoice, setWritingChoice] = useState<{ key: string; exam: Klausur } | null>(null);
  const editing = useRef<MetadataEntry | null>(null);
  const active = useRef(key);
  const activeRead = useRef<ActiveCatalogRead|null>(null);
  const coordinator = useRef<CatalogReadCoordinator|null>(null);
  if(coordinator.current===null)coordinator.current=new CatalogReadCoordinator();
  useLayoutEffect(() => { active.current = key; }, [key]);
  useLayoutEffect(() => {
    const unsubscribe=subscribeInitialScheduleRead(event=>{if(event.type==='start')coordinator.current?.start(event.requestId);else coordinator.current?.cancel(event.requestId);});
    const signedOut=()=>{
      active.current='';
      coordinator.current?.cancel();
      if(activeRead.current){clearTimeout(activeRead.current.timeout);activeRead.current.controller.abort();activeRead.current=null;}
      editing.current=null;metadata.hide();setPreviewVisible(false);setWritingChoice(null);setMessage('');
      setData({key:'',refresh:-1,status:'loading',hasSnapshot:false,role:'',entries:[],error:null});
    };
    const unsubscribeSignout=subscribeAccountSignout(window,signedOut);
    return()=>{unsubscribe();unsubscribeSignout();coordinator.current?.cancel();};
  }, [metadata]);
  useEffect(() => {
    if(schedule.status==='error'){
      coordinator.current?.cancel();
      if(activeRead.current){clearTimeout(activeRead.current.timeout);activeRead.current.controller.abort();activeRead.current=null;}
    }
  }, [schedule.status, schedule.initialLoadId]);
  useEffect(() => {
    if (!key || !a) return;
    let live=true;
    const pending=coordinator.current?.bind(schedule.initialLoadId,key)??null;
    if(pending){
      void pending.promise.then(result=>{
        if(!live||active.current!==key||result.kind==='cancelled')return;
        coordinator.current?.finish(pending.requestId);
        if(result.kind==='error'){setData(current=>catalogDataAfterReadError(current,key,refresh,result.error));return;}
        if(result.value.account.userId!==a.userId){setData(current=>catalogDataAfterReadError(current,key,refresh,new CatalogReadFailure('response',200,['/api/account'])));return;}
        setData({key,refresh,status:'ready',hasSnapshot:true,role:result.value.account.role,entries:result.value.entries,error:null});
      });
      return()=>{live=false;};
    }
    const ctrl=new AbortController();const activeSources=new Set<CatalogReadSource>();
    const timeout=setTimeout(()=>{const error=new CatalogReadFailure('timeout',null,[...activeSources]);ctrl.abort();if(active.current===key)setData(current=>catalogDataAfterReadError(current,key,refresh,error));},READ_TIMEOUT_MS);
    activeRead.current={controller:ctrl,timeout};
    void readAccountCatalog(ctrl.signal,fetch,(source,pending)=>{if(pending)activeSources.add(source);else activeSources.delete(source);}).then(result=>{
      if(ctrl.signal.aborted||active.current!==key)return;
      if(result.account.userId!==a.userId)throw new CatalogReadFailure('response',200,['/api/account']);
      setData({key,refresh,status:'ready',hasSnapshot:true,role:result.account.role,entries:result.entries,error:null});
    }).catch(error=>{
      if(!ctrl.signal.aborted&&active.current===key){ctrl.abort();const failure=error instanceof CatalogReadFailure?error:new CatalogReadFailure('network',null,[...activeSources]);setData(current=>catalogDataAfterReadError(current,key,refresh,failure));}
    }).finally(()=>{clearTimeout(timeout);if(activeRead.current?.controller===ctrl)activeRead.current=null;});
    return()=>{live=false;clearTimeout(timeout);ctrl.abort();if(activeRead.current?.controller===ctrl)activeRead.current=null;};
    // a belongs to exactly the rendered session key, not to subsequent polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refresh, schedule.initialLoadId]);
  const status=accountCatalogStatus(schedule.status,key,data,refresh);
  const ready = accountCatalogHasSnapshot(key,data);
  const admin = ready && data.role === 'admin';
  useEffect(() => {
    editing.current = null;
    if (admin) void metadata.load(); else metadata.hide();
    return metadata.hide;
  }, [admin, key, metadata]);
  const entries = useMemo(() => ready ? data.entries : [], [ready, data.entries]);
  const klausuren = useMemo<CatalogKlausur[]>(() => entries.map(r => ({ ...r.metadata, createdAt: '', updatedAt: '' })), [entries]);
  const trackingEntries = useMemo(() => schedule.view ? scheduleValues<TrackingEntry>(schedule.view, 'tracking-entry').filter(e => e.activityType === 'klausur') : [], [schedule.view]);
  const refreshing=ready&&status==='loading';
  const catalogUnavailable=ready&&status==='error';
  const busy = work || schedule.busy || writing.busy || meta.busy || meta.uncertain || schedule.uncertain || writing.uncertain || refreshing || catalogUnavailable;
  const reload = useCallback(() => {
    coordinator.current?.cancel();
    if(activeRead.current){clearTimeout(activeRead.current.timeout);activeRead.current.controller.abort();activeRead.current=null;}
    setRefresh(v => v + 1);
  }, []);
  const run = async <T,>(job: () => Promise<T>, fallback: T): Promise<T> => {
    if (!ready || busy) return fallback;
    const session = key; setWork(true); setMessage('');
    try { const result = await job(); return active.current === session ? result : fallback; }
    catch (e) { if (active.current === session) setMessage(e instanceof Error ? e.message : 'Die Aktion konnte nicht bestätigt werden.'); return fallback; }
    finally { setWork(false); }
  };
  const importPreview = async () => {
    const preview = metadata.state.preview;
    if (!admin || !previewVisible || !preview || busy) return;
    const result = await metadata.import(preview);
    if (result?.status === 'committed') { setPreviewVisible(false); reload(); }
  };
  return { ready, admin, busy, meta, schedule, writing, klausuren, trackingEntries, entries, metadata,
    writingChoice: ready && writingChoice?.key === key ? writingChoice.exam : null,
    cancelWritingChoice: () => setWritingChoice(null),
    createWithType: (type: KlausurType) => run(async () => {
      const choice = writingChoice, view = writing.view;
      if (!choice || choice.key !== key || !a || writing.status !== 'ready' || !view || view.account.userId !== a.userId || view.account.accessGeneration !== a.accessGeneration || view.account.sessionContext !== a.sessionContext) throw Error('Bitte den Schreibshortcut nach bestätigter Anmeldung erneut öffnen.');
      const existing = view.drafts.find(d => d.klausurId === choice.exam.id);
      if (existing) { setWritingChoice(null); router.push(`/schreiben/${existing.id}`); return; }
      if (view.truncated) throw Error('Bitte den vorhandenen Entwurf im Schreibbereich auswählen; die Entwurfsliste ist unvollständig.');
      if (!WRITING_TYPES[choice.exam.area].includes(type)) throw Error('Bitte einen Klausurtyp für den eigenen Entwurf auswählen.');
      const result = await writing.client.create({ title: choice.exam.title, area: choice.exam.area, type, klausurId: choice.exam.id, contentHtml: '', contentText: '' });
      if (result && active.current === key) { setWritingChoice(null); router.push(`/schreiben/${result.document.id}`); }
    }, undefined),
    status,
    refreshing,
    catalogError: data.key===key&&data.refresh===refresh?data.error:null,
    catalogErrorPresentation: data.key===key&&data.refresh===refresh?catalogReadPresentation(data.error):null,
    message: message || meta.message || schedule.message || writing.message,
    preview: previewVisible && meta.preview && meta.preview.account.userId === a?.userId ? meta.preview : null,
    confirmedRequestId: meta.result?.status === 'committed' ? meta.result.requestId : undefined,
    reload, importPreview,
    jsonChanged: () => setPreviewVisible(false),
    recover: async () => { if (meta.uncertain) { await metadata.recover(); reload(); } else if (schedule.uncertain) await schedule.recover(); else if (writing.uncertain) await writing.client.recover(); else { schedule.reload(); reload(); } },
    edit: (id: string) => run(async () => { if (!admin) return null; await metadata.load(id); const entry = metadata.state.view?.entry; if (!entry || metadata.state.status !== 'ready') return null; if ('legacy' in entry.metadata) throw Error('Dieser Alteintrag bleibt mit seinen ursprünglichen Angaben erhalten.'); editing.current = entry; return entry.metadata; }, null),
    save: (form: MetadataFields, editingId: string | null) => run(async () => {
      if (!admin || metadata.state.status !== 'ready' || !metadata.state.view) return false;
      if (!editingId) { const p = await metadata.preview([form], metadata.state.view.account); setPreviewVisible(!!p); return false; }
      const row = editing.current;
      if (!row || row.id !== editingId) throw Error('Bitte die Klausur erneut zum Bearbeiten öffnen.');
      const fields = { source: form.source, date: form.date, title: form.title, area: form.area, type: form.type ?? null, topicIds: [...form.topicIds] };
      const result = await metadata.patch(row, fields, metadata.state.view.account);
      if (result?.status === 'committed') { reload(); return true; } return false;
    }, false),
    remove: (id: string) => run(async () => {
      if (!admin) return false; const shown = entries.find(e => e.id === id); await metadata.load(id); const v = metadata.state.view;
      if (!v?.entry || metadata.state.status !== 'ready') return false;
      const signature = (m: MetadataReadFields) => JSON.stringify([m.id, m.source, m.date, m.title, m.area, m.type ?? null, m.topicIds]);
      if (!shown || v.entry.revision !== shown.revision || signature(v.entry.metadata) !== signature(shown.metadata)) { reload(); throw Error('Die Klausur wurde inzwischen geändert. Bitte den aktuellen Eintrag prüfen und erneut löschen.'); }
      const result = await metadata.delete(v.entry, v.account); if (result?.status === 'committed') { reload(); return true; } return false;
    }, false),
    previewImport: (json: string) => run(async () => { if (!admin) return; const records = parsePublicCatalogJSON(json); if (metadata.state.status !== 'ready') await metadata.load(); const v = metadata.state.view; if (metadata.state.status === 'ready' && v) { const p = await metadata.preview(records, v.account); setPreviewVisible(!!p); } }, undefined),
    plan: (k: CatalogKlausur, kind: 'schreiben' | 'skizze') => run(async () => {
      const view = schedule.view; if (!view || schedule.status !== 'ready') return false;
      const today = localDate(); if (catalogTask(view, k.id, today)) { setMessage('Diese Klausur steht bereits im heutigen Tagesplan.'); return true; }
      return !!await schedule.submit({ type: 'task.save', id: `catalog_task_${crypto.randomUUID()}`, date: today, title: kind === 'skizze' ? `Skizze: ${k.title}` : k.title, klausurId: k.id, durationMinutes: kind === 'skizze' ? 120 : 300, topicIds: [], isReview: false }, view);
    }, false),
    done: (k: CatalogKlausur, options: { date: string; rating: number; note: string; topicIds: string[]; mode: 'written' | 'read' }) => run(async () => {
      const view = schedule.view; if (!view || schedule.status !== 'ready') return false;
      const existing = catalogTask(view, k.id, options.date, options.mode);
      if (existing?.done) throw Error('Diese Bearbeitung ist für Datum und Modus bereits eingetragen.');
      return !!await schedule.submit({ type: 'exam.record', taskId: existing?.id ?? `catalog_exam_${crypto.randomUUID()}`, trackingId: `catalog_tracking_${crypto.randomUUID()}`, date: options.date, klausurId: k.id, klausurMode: options.mode, topicIds: [...options.topicIds], durationMinutes: existing?.durationMinutes ?? (options.mode === 'read' ? 120 : 300), rating: options.rating, note: options.note }, view);
    }, false),
    write: (k: CatalogKlausur) => run(async () => {
      const view = writing.view; if (writing.status !== 'ready' || !view || !a || view.account.userId !== a?.userId || view.account.sessionContext !== a.sessionContext) throw Error('Schreibbereich wird noch geprüft. Bitte erneut versuchen.');
      const existing = view.drafts.find(d => d.klausurId === k.id);
      if (existing) { router.push(`/schreiben/${existing.id}`); return; }
      if (view.truncated) throw Error('Bitte den vorhandenen Entwurf im Schreibbereich auswählen; die Entwurfsliste ist unvollständig.');
      const area = k.area;
      if (!isCoreArea(area)) throw Error('Für dieses alte Gebiet ist die Erstellung eines Schreibentwurfs noch nicht verfügbar.');
      if (!k.type) { setWritingChoice({ key, exam: { ...k, area } }); return; }
      const result = await writing.client.create({ title: k.title, area, ...(k.type ? { type: k.type } : {}), klausurId: k.id, contentHtml: '', contentText: '' });
      if (result && active.current === key) router.push(`/schreiben/${result.document.id}`);
    }, undefined),
    pdfLinks: (id: string) => entries.find(e => e.id === id)?.documents.map(d => ({ ...d, href: pdfViewerURL({ klausurId: id, documentId: d.documentId, documentVersionId: d.documentVersionId }) })) ?? [],
    boosts: (ids: string[], rating: number, mode: 'written' | 'read') => ids.map(topicId => { const p = schedule.view ? scheduleValues<Progress>(schedule.view, 'progress').find(p => p.topicId === topicId) : null; const before = p?.percent ?? 0, after = Math.min(95, before + Math.round(calculateKlausurDelta(before, rating) * (mode === 'read' ? 0.5 : 1))); return { topicId, before, after, delta: after - before }; }),
  };
}
