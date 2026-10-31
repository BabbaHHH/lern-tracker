import {LearningFailure} from './progress-client';
import {sameLearningAccount} from './personal-contract';
import {writingKey,type WritingSelection,type WritingFields,type WritingView,type WritingCommand,type WritingResult,type WritingPatch} from './writing-contract';
import type {LearningAccount} from './progress-contract';
export interface WritingBuffer {selection:WritingSelection;account:LearningAccount;fields:WritingFields;confirmedFields?:WritingFields;baseRevision:number|null;version:number;confirmedVersion:number;conflict:boolean;deleted:boolean;error:string;editorVersion:number}
export interface WritingState {status:'loading'|'ready'|'error';view:WritingView|null;buffers:Record<string,WritingBuffer>;busy:boolean;uncertain:boolean;missingReceipt:boolean;message:string;lastResult:WritingResult|null}
interface Pending {command:WritingCommand;key:string;version:number}
/** Root-mounted memory only. Route navigation keeps text; reload/offline never creates a durable queue. */
export class WritingClient{
 state:WritingState={status:'loading',view:null,buffers:{},busy:false,uncertain:false,missingReceipt:false,message:'',lastResult:null};
 private listeners=new Set<()=>void>();private epoch=0;private readNumber=0;private selection:WritingSelection|undefined;private reading:AbortController|null=null;private writing:AbortController|null=null;private timer:ReturnType<typeof setTimeout>|undefined;private pending:Pending|null=null;private retired:WritingBuffer[]=[];
 active=false;
 constructor(private readonly transport:typeof fetch=(...a)=>fetch(...a),private readonly delay=700){}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};getSnapshot=()=>this.state;
 private update(v:Partial<WritingState>){this.state={...this.state,...v};this.listeners.forEach(f=>f());}
 private buffer(key:string,v:Partial<WritingBuffer>){const b=this.state.buffers[key];if(b)this.update({buffers:{...this.state.buffers,[key]:{...b,...v}}});}
 private async request<T extends WritingView|WritingResult>(path:string,signal:AbortSignal,body?:WritingCommand):Promise<T>{
  const r=await this.transport(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,headers:body?{'Content-Type':'application/json','X-Stex-Action':'1'}:{},body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw new LearningFailure(v?.error?.code??'unavailable',v?.error?.message??'Text nicht verfügbar.',r.status);
  if(v?.contractVersion!==1||!v.account||typeof v.account.sessionContext!=='string'||(body||path.includes('/commands/')?!v.document||v.action!=='writing':!Array.isArray(v.drafts)))throw Error('Antwort nicht bestätigt.');return v;
 }
 private retire(){for(const b of Object.values(this.state.buffers))if(b.version!==b.confirmedVersion||this.pending?.key===writingKey(b.selection))this.retired.push({...b,fields:structuredClone(b.fields)});this.pending=null;clearTimeout(this.timer);this.writing?.abort();this.epoch++;this.update({buffers:{},lastResult:null,busy:false,uncertain:false,missingReceipt:false});}
 hide=()=>{this.epoch++;this.readNumber++;this.reading?.abort();this.writing?.abort();clearTimeout(this.timer);this.update({status:'loading',busy:false,...(this.pending?{uncertain:true,message:'Der Schreibabschluss ist unklar. Bitte zuerst den Vorgangsstatus prüfen.'}:{})});};
 async open(s?:WritingSelection){this.active=true;this.selection=s;await this.load(true);}
 detach=()=>{this.active=false;};
 async load(hide=false):Promise<void>{
  if(hide)this.hide();this.reading?.abort();const ctrl=new AbortController();this.reading=ctrl;const read=++this.readNumber;
  const q=this.selection?`?kind=${this.selection.kind}&id=${encodeURIComponent(this.selection.id)}`:'';
  try{const view=await this.request<WritingView>('/api/learning/writing'+q,ctrl.signal);if(read!==this.readNumber)return;
   const changed=this.state.view&&!sameLearningAccount(this.state.view.account,view.account);if(changed)this.retire();
   let buffers=this.state.buffers;const d=view.document,s=this.selection;
   if(s){const key=writingKey(s),old=buffers[key];
    if(old){
     if(this.pending?.key!==key){const fresh=d?.revision??null;
      if(old.version!==old.confirmedVersion){const unchanged=!!d&&!d.deleted&&!!old.confirmedFields&&JSON.stringify(old.confirmedFields)===JSON.stringify(d.fields);buffers={...buffers,[key]:{...old,...(unchanged?{baseRevision:fresh}:{}),conflict:old.conflict||(!unchanged&&old.baseRevision!==fresh),deleted:d?.deleted??(s.kind==='draft'&&!d)}};}
      else if(d&&!d.deleted){buffers={...buffers,[key]:{...old,fields:structuredClone(d.fields),confirmedFields:structuredClone(d.fields),baseRevision:d.revision,deleted:false,conflict:false,error:'',editorVersion:old.editorVersion+(old.baseRevision!==d.revision?1:0)}};}
      else buffers={...buffers,[key]:{...old,deleted:s.kind==='draft'||!!d?.deleted,conflict:old.baseRevision!==fresh}};
     }
    }else if(d||s.kind==='notepad')buffers={...buffers,[key]:{selection:s,account:view.account,fields:d?structuredClone(d.fields):{html:'',text:''},confirmedFields:d?structuredClone(d.fields):{html:'',text:''},baseRevision:d?.revision??null,version:0,confirmedVersion:0,conflict:false,deleted:d?.deleted??false,error:'',editorVersion:0}};
   }
   this.update({status:'ready',view,buffers,busy:false,...(changed?{message:'Die Anmeldung hat sich geändert. Frühere Textpuffer werden nicht automatisch übertragen.'}:{})});
   this.scheduleNext();
  }catch(e){if(read!==this.readNumber)return;const revoked=e instanceof LearningFailure&&[401,403].includes(e.status);if(revoked)this.retire();this.update({status:'error',busy:false,message:e instanceof Error?e.message:'Text nicht verfügbar.',...(revoked?{view:null}:{})});}
 }
 edit(s:WritingSelection,fields:WritingFields){const key=writingKey(s),b=this.state.buffers[key];if(this.state.status!=='ready'||!b||b.deleted||!sameLearningAccount(b.account,this.state.view?.account??null))return;
  this.buffer(key,{fields:structuredClone(fields),version:b.version+1,error:''});this.schedule(key);
 }
 private scheduleNext(){if(this.pending||this.state.busy||this.state.status!=='ready')return;const next=Object.entries(this.state.buffers).find(([,b])=>b.version!==b.confirmedVersion&&!b.conflict&&!b.deleted&&!b.error&&sameLearningAccount(b.account,this.state.view?.account??null));if(next)this.schedule(next[0]);}
 private schedule(key:string){clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(key),this.delay);}
 async flush(key:string):Promise<WritingResult|null>{
  clearTimeout(this.timer);const b=this.state.buffers[key],v=this.state.view;if(this.state.status!=='ready'||this.state.busy||this.pending||!v||!b||b.conflict||b.deleted||b.error||b.version===b.confirmedVersion||!sameLearningAccount(b.account,v.account))return null;
  return this.execute({command:{...this.base(v.account),...b.selection,operation:'save',expectedRevision:b.baseRevision,fields:{...structuredClone(b.fields),...('contentHtml' in b.fields?{klausurId:b.fields.klausurId??null}:{})}},key,version:b.version});
 }
 private base(a:LearningAccount){return {contractVersion:1 as const,action:'writing' as const,requestId:`c4a_${crypto.randomUUID()}`,expectedAccountId:a.userId,expectedAccessGeneration:a.accessGeneration,expectedSessionContext:a.sessionContext};}
 async create(fields:WritingPatch){const v=this.state.view;if(this.state.status!=='ready'||!v||this.pending||this.state.busy)return null;const id=`c4a_draft_${crypto.randomUUID()}`;return this.execute({command:{...this.base(v.account),kind:'draft',id,operation:'save',expectedRevision:null,fields},key:`draft:${id}`,version:0});}
 async remove(s:WritingSelection,revision:number){const v=this.state.view,b=this.state.buffers[writingKey(s)];if(this.state.status!=='ready'||!v||this.pending||this.state.busy)return null;if(b&&b.version!==b.confirmedVersion){this.update({message:'Dieser Entwurf hat unbestätigten Text. Bitte zuerst im Editor klären.'});return null;}
  return this.execute({command:{...this.base(v.account),...s,operation:'delete',expectedRevision:revision},key:writingKey(s),version:b?.version??0});
 }
 private async accept(p:Pending,r:WritingResult,epoch:number){
  if(epoch!==this.epoch||this.pending!==p)return null;
  if(!sameLearningAccount(this.state.view?.account??null,r.account)||r.requestId!==p.command.requestId||writingKey(r.document)!==p.key)throw new LearningFailure('account_changed','Die Antwort gehört nicht zum bearbeiteten Text.',409);
  this.pending=null;const b=this.state.buffers[p.key];
  if(b)this.buffer(p.key,{baseRevision:r.document.revision,confirmedFields:structuredClone(r.document.fields),confirmedVersion:p.version,deleted:r.document.deleted,conflict:false,error:''});
  this.update({busy:false,uncertain:false,missingReceipt:false,lastResult:r,message:r.operation==='delete'?'Löschung bestätigt.':'Gespeichert und bestätigt.'});
  await this.load();
  this.scheduleNext();return r;
 }
 private async execute(p:Pending):Promise<WritingResult|null>{
  this.pending=p;this.readNumber++;this.reading?.abort();const ctrl=new AbortController();this.writing=ctrl;const epoch=this.epoch;this.update({busy:true,uncertain:false,missingReceipt:false,message:'Speichert – noch nicht bestätigt …'});
  try{return await this.accept(p,await this.request<WritingResult>('/api/learning/writing',ctrl.signal,p.command),epoch);}
  catch(e){if(epoch!==this.epoch||this.pending!==p)return null;const uncertain=!(e instanceof LearningFailure)||e.status>=500;
   if(!uncertain)this.pending=null;
   const revoked=e instanceof LearningFailure&&[401,403].includes(e.status),changed=e instanceof LearningFailure&&e.code==='account_changed';
   if(revoked){this.retire();this.update({status:'error',view:null,message:'Die Anmeldung ist nicht mehr gültig. Textpuffer werden nicht übertragen.'});return null;}
   if(changed){await this.load(true);return null;}
   this.buffer(p.key,{conflict:e instanceof LearningFailure&&e.status===409,error:uncertain?'':e instanceof Error?e.message:'Speichern fehlgeschlagen.'});
   this.update({busy:false,uncertain,message:uncertain?'Speichern ist nicht bestätigt. Bitte den Vorgangsstatus prüfen.':e instanceof Error?e.message:'Speichern fehlgeschlagen.'});if(!uncertain&&e instanceof LearningFailure&&e.status===409)await this.load();return null;
  }
 }
 async recover(){const p=this.pending;if(!p){await this.load(true);return;}await this.load(true);if(this.pending!==p||this.state.status!=='ready')return;
  const a=this.state.view!.account;if(a.userId!==p.command.expectedAccountId||a.sessionContext!==p.command.expectedSessionContext||a.accessGeneration!==p.command.expectedAccessGeneration)return;
  const ctrl=new AbortController();this.reading=ctrl;const epoch=this.epoch;this.update({busy:true});
  try{await this.accept(p,await this.request<WritingResult>(`/api/learning/writing/commands/${p.command.requestId}`,ctrl.signal),epoch);}
  catch(e){if(epoch!==this.epoch||this.pending!==p)return;this.update({busy:false,uncertain:true,missingReceipt:e instanceof LearningFailure&&e.status===404,message:e instanceof LearningFailure&&e.status===404?'Kein Beleg gefunden. Derselbe Auftrag kann bewusst erneut gesendet werden.':'Vorgangsstatus nicht bestätigt. Bitte erneut prüfen.'});}
 }
 async retryPending(){const p=this.pending;if(!p||!this.state.missingReceipt)return;await this.load(true);if(this.pending===p&&this.state.status==='ready')await this.execute(p);}
 async resolve(s:WritingSelection,useBuffer:boolean){
  if(this.pending||this.state.busy)return;await this.load(true);if(this.state.status!=='ready')return;const key=writingKey(s),b=this.state.buffers[key],d=this.state.view?.document;if(!b||!d||writingKey(d)!==key||d.deleted)return;
  if(useBuffer){this.buffer(key,{baseRevision:d.revision,conflict:false,error:''});await this.flush(key);}
  else this.buffer(key,{fields:structuredClone(d.fields),confirmedFields:structuredClone(d.fields),baseRevision:d.revision,version:b.version+1,confirmedVersion:b.version+1,conflict:false,error:'',editorVersion:b.editorVersion+1});
 }
 earlier(s:WritingSelection):WritingBuffer|undefined{return this.retired.findLast(b=>b.account.userId===this.state.view?.account.userId&&writingKey(b.selection)===writingKey(s));}
 adoptEarlier(s:WritingSelection){const old=this.earlier(s),b=this.state.buffers[writingKey(s)];if(!old||!b||b.deleted||this.state.status!=='ready'||this.pending)return;
  this.buffer(writingKey(s),{fields:structuredClone(old.fields),version:b.version+1,conflict:true,error:'Puffer aus früherer Anmeldung übernommen. Bitte mit der aktuellen Serverfassung abgleichen.',editorVersion:b.editorVersion+1});
  this.retired=this.retired.filter(v=>v!==old);
 }
 discardEarlier(s:WritingSelection){const old=this.earlier(s);if(old)this.retired=this.retired.filter(b=>b!==old);this.update({message:'Früherer Puffer bewusst verworfen.'});}
 hasUnconfirmed=()=>!!this.pending||Object.values(this.state.buffers).some(b=>b.version!==b.confirmedVersion)||this.retired.length>0;
 dispose(){clearTimeout(this.timer);this.reading?.abort();this.writing?.abort();this.epoch++;}
}
