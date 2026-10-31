import {DOCUMENT_LIMIT,documentsAccountKey,type DocumentFields,type DocumentsCommand,type DocumentsResult,type DocumentsView,type PersonalDocument} from './documents-contract';
import {LearningFailure} from './progress-client';
export interface DocumentBuffer {fields:DocumentFields;revision:number|null;file:File|null;dirty:boolean}
export interface DocumentsState {view:DocumentsView|null;hidden:boolean;busy:boolean;message:string;uncertain:boolean;canRetry:boolean;buffers:Record<string,DocumentBuffer>}
export class DocumentsClient {
 state:DocumentsState={view:null,hidden:true,busy:false,message:'',uncertain:false,canRetry:false,buffers:{}};
 private listeners=new Set<()=>void>();private epoch=0;private reading:AbortController|null=null;private writing:AbortController|null=null;
 private pending:{command:DocumentsCommand;file:File|null}|null=null;
 constructor(private transport:typeof fetch=(...a)=>fetch(...a)){}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};getSnapshot=()=>this.state;
 private update(p:Partial<DocumentsState>){this.state={...this.state,...p};this.listeners.forEach(f=>f());}
 private async request(path:string,init:RequestInit={}):Promise<DocumentsView|DocumentsResult>{const r=await this.transport(path,{credentials:'same-origin',cache:'no-store',...init});const value=await r.json();if(!r.ok)throw new LearningFailure(value?.error?.code??'unavailable',value?.error?.message??'Dokumente nicht verfügbar.',r.status);if(value?.contractVersion!==1||!value.account||typeof value.account.sessionContext!=='string')throw Error('Unbestätigte Antwort');return value;}
 hide=()=>{this.epoch++;this.reading?.abort();this.writing?.abort();this.update({hidden:true,busy:false,...(this.pending?{uncertain:true,message:'Abschluss unklar. Bitte Vorgangsstatus prüfen.'}:{})});};
 async load(hide=false){if(this.state.busy&&!hide)return;if(hide)this.hide();this.reading?.abort();const c=new AbortController();this.reading=c;const epoch=++this.epoch;
  try{const view=await this.request('/api/learning/documents',{signal:c.signal}) as DocumentsView;if(epoch!==this.epoch)return;if(!Array.isArray(view.documents))throw Error('Unbestätigte Dokumentliste');const changed=!this.state.view||documentsAccountKey(this.state.view.account)!==documentsAccountKey(view.account);if(changed){this.pending=null;this.writing?.abort();}this.update({view,hidden:false,busy:false,...(changed?{buffers:{},uncertain:false,canRetry:false,message:''}:{})});}
  catch(e){if(epoch!==this.epoch)return;const revoked=e instanceof LearningFailure&&[401,403].includes(e.status);if(revoked)this.pending=null;this.update({hidden:true,busy:false,message:e instanceof Error?e.message:'Dokumente nicht verfügbar.',...(revoked?{view:null,buffers:{},uncertain:false,canRetry:false}:{})});}
 }
 edit(id:string,patch:Partial<DocumentBuffer>){if(this.state.hidden||this.state.busy||this.pending)return;const doc=this.state.view?.documents.find(d=>d.id===id);const old=this.state.buffers[id]??{fields:doc?{name:doc.name,tags:doc.tags,includeInNextPlan:doc.includeInNextPlan}:{name:'',tags:[],includeInNextPlan:true},revision:doc?.revision??null,file:null,dirty:false};this.update({buffers:{...this.state.buffers,[id]:{...old,...patch,dirty:true}},message:''});}
 reset(id:string){if(this.state.busy||this.pending)return;const buffers={...this.state.buffers};delete buffers[id];this.update({buffers,message:'Gespeicherter Stand bewusst geladen.'});}
 async save(id:string,operation:DocumentsCommand['operation']){
  const a=this.state.view?.account,b=this.state.buffers[id],doc=this.state.view?.documents.find(d=>d.id===id);if(!a||this.state.hidden||this.state.busy||this.pending||(!b&&operation!=='remove'))return;
  const epoch=++this.epoch;this.update({busy:true,message:'Datei und Auftrag werden vorbereitet …'});const file=operation==='upload'?b?.file??null:null;
  try{if(operation==='upload'&&(!file||!file.size||file.size>DOCUMENT_LIMIT))throw Error('Bitte eine Datei bis 4 MiB auswählen.');const hash=file?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join(''):null;if(epoch!==this.epoch)return;
   const command:DocumentsCommand={contractVersion:1,action:'documents',requestId:`c5a_${crypto.randomUUID()}`,expectedAccountId:a.userId,expectedAccessGeneration:a.accessGeneration,expectedSessionContext:a.sessionContext,id,expectedRevision:operation==='remove'?b?.revision??doc?.revision??null:b!.revision,operation,...(operation!=='remove'?{fields:b!.fields}:{}),...(file?{file:{name:file.name,size:file.size,type:file.type,sha256:hash!}}:{})};this.pending={command,file};await this.execute();
  }catch(e){if(epoch===this.epoch)this.update({busy:false,message:e instanceof Error?e.message:'Vorbereitung fehlgeschlagen.'});}
 }
 private async execute(){const p=this.pending;if(!p||!this.state.view||this.state.hidden)return;const c=new AbortController();this.writing=c;this.reading?.abort();const epoch=++this.epoch;this.update({busy:true,uncertain:false,canRetry:false,message:'Wird gespeichert …'});
  const form=p.file?new FormData():null;if(form){form.append('command',JSON.stringify(p.command));form.append('file',p.file!);}
  try{const result=await this.request('/api/learning/documents',{method:'POST',signal:c.signal,headers:form?{'X-Stex-Action':'1'}:{'X-Stex-Action':'1','Content-Type':'application/json'},body:form??JSON.stringify(p.command)}) as DocumentsResult;if(epoch!==this.epoch)return;await this.confirm(result,p);}
  catch(e){if(epoch!==this.epoch)return;const uncertain=!(e instanceof LearningFailure)||e.status>=500;if(!uncertain)this.pending=null;const revoked=e instanceof LearningFailure&&([401,403].includes(e.status)||e.code==='account_changed');this.update({busy:false,uncertain,message:uncertain?'Speichern ist nicht bestätigt. Zuerst Vorgangsstatus prüfen.':e instanceof Error?e.message:'Speichern fehlgeschlagen.',...(revoked?{hidden:true,view:null,buffers:{}}:{})});}
 }
 private async confirm(r:DocumentsResult,p:NonNullable<DocumentsClient['pending']>){if(!this.state.view||documentsAccountKey(r.account)!==documentsAccountKey(this.state.view.account)||r.requestId!==p.command.requestId){this.pending=null;this.update({hidden:true,view:null,buffers:{},busy:false,uncertain:false,message:'Anmeldung geändert. Bitte neu laden.'});return;}
  if(r.status!=='committed'||!r.document){this.update({busy:false,uncertain:true,canRetry:true,message:'Vorgang noch nicht abgeschlossen. Status erneut prüfen oder denselben Auftrag bewusst wiederholen.'});return;}
  this.pending=null;const buffers={...this.state.buffers};delete buffers[p.command.id];this.update({busy:false,uncertain:false,canRetry:false,buffers,message:'Gespeichert und bestätigt.'});await this.load();
 }
 async recover(){const p=this.pending;if(!p){await this.load(true);return;}await this.load(true);if(this.pending!==p||this.state.hidden)return;const epoch=++this.epoch;this.update({busy:true,message:'Vorgangsstatus wird geprüft …'});
  try{const r=await this.request(`/api/learning/documents/commands/${encodeURIComponent(p.command.requestId)}`) as DocumentsResult;if(epoch===this.epoch)await this.confirm(r,p);}
  catch(e){if(epoch!==this.epoch)return;this.update({busy:false,uncertain:true,canRetry:e instanceof LearningFailure&&e.status===404,message:e instanceof LearningFailure&&e.status===404?'Noch kein Beleg. Kein automatischer Neuversuch; Status erneut prüfen oder denselben Auftrag bewusst wiederholen.':'Status nicht verfügbar. Bitte später erneut prüfen.'});}
 }
 async inspect(requestId:string){if(this.state.hidden||this.state.busy||this.pending||!this.state.view?.recent.some(r=>r.requestId===requestId))return;const a=this.state.view.account,epoch=++this.epoch;this.update({busy:true,message:'Vorgangsstatus wird geprüft …'});
  try{const r=await this.request(`/api/learning/documents/commands/${encodeURIComponent(requestId)}`) as DocumentsResult;if(epoch!==this.epoch)return;if(documentsAccountKey(a)!==documentsAccountKey(r.account))throw new LearningFailure('account_changed','Anmeldung geändert. Bitte neu laden.',409);this.update({busy:false,message:r.status==='committed'?'Dieser Vorgang wurde bestätigt gespeichert.':'Dieser Vorgang ist nicht als abgeschlossen bestätigt. Es wird nichts erneut gesendet.'});await this.load();}
  catch(e){if(epoch!==this.epoch)return;this.update({busy:false,message:e instanceof Error?e.message:'Status nicht verfügbar.'});if(e instanceof LearningFailure&&[401,403,409].includes(e.status)){this.hide();await this.load(true);}}
 }
 retry=async()=>{if(this.state.canRetry&&!this.state.hidden&&!this.state.busy)await this.execute();};
 buffer(d:PersonalDocument){return this.state.buffers[d.id]??{fields:{name:d.name,tags:d.tags,includeInNextPlan:d.includeInNextPlan},revision:d.revision,file:null,dirty:false};}
}
