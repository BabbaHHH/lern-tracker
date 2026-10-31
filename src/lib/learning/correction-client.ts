import type {KorrekturSettings} from '../types';
import {sameLearningAccount} from './personal-contract';
import {LearningFailure} from './progress-client';
import type {CorrectionCommand,CorrectionView,CorrectionResult,CorrectionFocus} from './correction-contract';
export interface CorrectionState {status:'loading'|'ready'|'error';view:CorrectionView|null;busy:boolean;uncertain:boolean;missing:boolean;message:string;result:CorrectionResult|null}
export class CorrectionClient{
 state:CorrectionState={status:'loading',view:null,busy:false,uncertain:false,missing:false,message:'',result:null};active=false;
 private listeners=new Set<()=>void>();private epoch=0;private reads=0;private controller:AbortController|null=null;private writer:AbortController|null=null;private draftId:string|undefined;private pending:{requestId:string;operation:CorrectionCommand['operation']}|null=null;
 constructor(private readonly transport:typeof fetch=(...a)=>fetch(...a),private readonly changed?:()=>Promise<void>|void){}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};getSnapshot=()=>this.state;
 private update(v:Partial<CorrectionState>){this.state={...this.state,...v};this.listeners.forEach(f=>f());}
 private async request<T extends CorrectionView|CorrectionResult>(path:string,signal:AbortSignal,body?:CorrectionCommand):Promise<T>{const r=await this.transport(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,headers:body?{'Content-Type':'application/json','X-Stex-Action':'1'}:{},body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw new LearningFailure(v?.error?.code??'unavailable',v?.error?.message??'Korrektur nicht verfügbar.',r.status);if(v?.contractVersion!==1||!v.account||typeof v.account.sessionContext!=='string'||(body||path.includes('/commands/')?v.action!=='correction'||!['applied','pending','failed'].includes(v.state):!Array.isArray(v.recent)))throw Error('Korrekturantwort nicht bestätigt.');return v;}
 hide=()=>{this.epoch++;this.reads++;this.controller?.abort();this.writer?.abort();this.update({status:'loading',busy:false,...(this.pending?{uncertain:true,message:'Aufruf unbestätigt. Bitte zuerst Vorgangsstatus prüfen.'}:{})});};
 async open(draftId?:string){this.active=true;this.draftId=draftId;await this.load(true);}
 detach=()=>{this.active=false;};
 async load(hide=false){if(hide)this.hide();this.controller?.abort();const ctrl=new AbortController();this.controller=ctrl;const read=++this.reads;
  try{const view=await this.request<CorrectionView>('/api/learning/correction'+(this.draftId?`?draftId=${encodeURIComponent(this.draftId)}`:''),ctrl.signal);if(read!==this.reads)return;const changed=this.state.view&&!sameLearningAccount(view.account,this.state.view.account);
   if(changed){this.pending=null;this.writer?.abort();this.epoch++;}
   this.update({status:'ready',view,...(changed?{busy:false,uncertain:false,missing:false,result:null,message:'Anmeldung gewechselt. Keine alte Korrektur wird übertragen.'}:{})});
  }catch(e){if(read!==this.reads)return;const revoked=e instanceof LearningFailure&&[401,403].includes(e.status);if(revoked){this.pending=null;this.writer?.abort();this.epoch++;}this.update({status:'error',busy:false,message:e instanceof Error?e.message:'Korrektur nicht verfügbar.',...(revoked?{view:null,result:null,uncertain:false}:{})});}
 }
 private base(){const v=this.state.view;if(this.state.status!=='ready'||!v||this.state.busy||this.pending)return null;return {contractVersion:1 as const,action:'correction' as const,requestId:`c4b_${crypto.randomUUID()}`,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext};}
 async saveSettings(fields:KorrekturSettings,expectedRevision=this.state.view?.settingsRevision??null){const b=this.base();if(b)return await this.execute({...b,operation:'settings',expectedRevision,fields});}
 async reset(expectedRevision=this.state.view?.profileRevision??null){const b=this.base();if(b)await this.execute({...b,operation:'reset',expectedRevision});}
 async run(focus:CorrectionFocus){const b=this.base(),v=this.state.view;if(!b||!v?.snapshot||!v.draftId||!v.draftRevision)return;await this.execute({...b,operation:'run',draftId:v.draftId,expectedDraftRevision:v.draftRevision,snapshot:v.snapshot,focus});}
 private async accept(v:CorrectionResult,requestId:string,epoch:number){if(epoch!==this.epoch||this.pending?.requestId!==requestId)return;if(!sameLearningAccount(v.account,this.state.view?.account??null)||v.requestId!==requestId)throw new LearningFailure('account_changed','Die Korrekturantwort gehört zu einer anderen Sitzung.',409);
  if(v.state==='pending'){this.update({busy:false,uncertain:true,missing:false,result:v,message:v.message});return;}
  this.pending=null;this.update({busy:false,uncertain:false,missing:false,result:v,message:v.message});await this.load();if(v.state==='applied')await this.changed?.();return v;
 }
 private async execute(cmd:CorrectionCommand){this.pending={requestId:cmd.requestId,operation:cmd.operation};this.reads++;this.controller?.abort();const ctrl=new AbortController();this.writer=ctrl;const epoch=this.epoch;this.update({busy:true,uncertain:false,missing:false,result:null,message:cmd.operation==='run'?'Korrektur läuft – noch nicht bestätigt.':'Änderung noch nicht bestätigt.'});
  try{return await this.accept(await this.request<CorrectionResult>('/api/learning/correction',ctrl.signal,cmd),cmd.requestId,epoch);}
  catch(e){if(epoch!==this.epoch||this.pending?.requestId!==cmd.requestId)return;const uncertain=!(e instanceof LearningFailure)||e.status>=500;if(!uncertain)this.pending=null;
   this.update({busy:false,uncertain,message:e instanceof Error?e.message:'Ergebnis unklar. Bitte Status prüfen.'});if(e instanceof LearningFailure&&[401,403,409].includes(e.status))await this.load(true);else if(!uncertain)await this.load();
  }
 }
 select(result:CorrectionResult){if(this.state.busy||!sameLearningAccount(result.account,this.state.view?.account??null))return;this.pending=result.state==='pending'?{requestId:result.requestId,operation:result.operation}:null;this.update({result,uncertain:result.state==='pending',missing:false,message:result.message});}
 async recover(){const p=this.pending;if(!p){await this.load(true);return;}await this.load(true);if(this.pending!==p||this.state.status!=='ready')return;const epoch=this.epoch,ctrl=new AbortController();this.controller=ctrl;this.update({busy:true});
  try{await this.accept(await this.request<CorrectionResult>(`/api/learning/correction/commands/${p.requestId}`,ctrl.signal),p.requestId,epoch);}catch(e){if(epoch!==this.epoch||this.pending!==p)return;this.update({busy:false,uncertain:true,missing:e instanceof LearningFailure&&e.status===404,message:e instanceof LearningFailure&&e.status===404?'Kein Beleg gefunden. Kein automatischer neuer Aufruf.':'Status unbestätigt. Bitte erneut prüfen.'});}
 }
 async abandon(){const p=this.pending;if(!p||this.state.busy)return;await this.load(true);if(this.pending!==p||this.state.status!=='ready')return;if(this.state.missing){this.pending=null;this.update({uncertain:false,missing:false,message:'Unbestätigten Versuch bewusst verlassen. Ein neuer Aufruf ist ein eigener kostenrelevanter Vorgang.'});return;}
  this.pending=null;const b=this.base();if(b)await this.execute({...b,operation:'abandon',targetRequestId:p.requestId});
 }
 dispose(){this.epoch++;this.controller?.abort();this.writer?.abort();}
}
