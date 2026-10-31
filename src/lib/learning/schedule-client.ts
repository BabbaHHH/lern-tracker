import type { LearningAccount } from './progress-contract';
import { LearningFailure } from './progress-client';
import { sameLearningAccount } from './personal-contract';
import { scheduleExpected,type ScheduleCommand,type ScheduleResult,type ScheduleView,type ScheduleOperation } from './schedule-contract';
const READ_TIMEOUT_MS=20_000;
export type InitialScheduleReadEvent = {type:'start'|'cancel';requestId:number};
const initialScheduleReadListeners=new Set<(event:InitialScheduleReadEvent)=>void>();
export function subscribeInitialScheduleRead(listener:(event:InitialScheduleReadEvent)=>void){initialScheduleReadListeners.add(listener);return()=>initialScheduleReadListeners.delete(listener);}
function notifyInitialScheduleRead(event:InitialScheduleReadEvent){for(const listener of [...initialScheduleReadListeners]){try{listener(event);}catch{/* The schedule read must not depend on an optional catalog prefetch. */}}}
export interface ScheduleState {status:'loading'|'ready'|'error';view:ScheduleView|null;busy:boolean;uncertain:boolean;message:string;initialLoadId:number|null}
/** Mounted memory only; writes require the context of the view the user actually edited. */
export class ScheduleClient {
  state:ScheduleState={status:'loading',view:null,busy:false,uncertain:false,message:'',initialLoadId:null};
  private listeners=new Set<()=>void>();private epoch=0;private pending:ScheduleCommand|null=null;private reading:AbortController|null=null;private writing:AbortController|null=null;
  constructor(private readonly transport:typeof fetch=(...args)=>fetch(...args)){}
  subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
  getSnapshot=()=>this.state;
  private update(v:Partial<ScheduleState>){this.state={...this.state,...v};this.listeners.forEach(f=>f());}
  private async request(path:string,signal:AbortSignal,body?:ScheduleCommand):Promise<ScheduleResult|ScheduleView> {
    const response=await this.transport(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,headers:body?{'Content-Type':'application/json','X-Stex-Action':'1'}:{},body:body?JSON.stringify(body):undefined});
    const v=await response.json();if(!response.ok)throw new LearningFailure(v?.error?.code??'unavailable',v?.error?.message??'Lerndaten nicht verfügbar.',response.status);
    if(v?.contractVersion!==1||!v.account||typeof v.account.sessionContext!=='string'||(v.action!=='schedule'&&!Array.isArray(v.records)))throw new LearningFailure('unavailable','Antwort nicht bestätigt.',503);
    return v;
  }
  hide=()=>{if(!this.state.view&&this.state.initialLoadId!==null)notifyInitialScheduleRead({type:'cancel',requestId:this.state.initialLoadId});this.epoch++;this.reading?.abort();this.writing?.abort();this.update({status:'loading',busy:false,...(!this.state.view?{initialLoadId:null}:{}),...(this.pending?{uncertain:true,message:'Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.'}:{})});};
  async load(hide=false,force=false):Promise<void> {
    if(this.state.busy&&!hide&&!force)return;if(hide)this.hide();this.reading?.abort();const controller=new AbortController();this.reading=controller;const epoch=++this.epoch;const initialLoad=!this.state.view;
    let timedOut=false;const timeoutMessage='Lerndaten konnten nicht rechtzeitig geladen werden. Bitte erneut versuchen.';const timeout=setTimeout(()=>{timedOut=true;controller.abort();if(epoch===this.epoch){this.update({status:'error',busy:false,message:timeoutMessage});if(!this.state.view&&this.state.initialLoadId!==null)notifyInitialScheduleRead({type:'cancel',requestId:this.state.initialLoadId});}},READ_TIMEOUT_MS);
    const request=this.request('/api/learning/schedule',controller.signal);
    if(initialLoad){this.update({status:'loading',initialLoadId:epoch});notifyInitialScheduleRead({type:'start',requestId:epoch});}
    try {const view=await request as ScheduleView;if(epoch!==this.epoch||timedOut)return;
      const changed=!sameLearningAccount(this.state.view?.account??null,view.account);if(changed){this.pending=null;this.writing?.abort();}
      this.update({status:this.pending?'error':'ready',view,busy:false,...(changed||(!this.pending&&hide)?{uncertain:false,message:''}:{})});
    }catch(error){if(epoch!==this.epoch)return;const failure=timedOut?new LearningFailure('unavailable',timeoutMessage,503):error;const revoked=failure instanceof LearningFailure&&[401,403].includes(failure.status);if(revoked)this.pending=null;this.update({status:'error',busy:false,message:failure instanceof Error?failure.message:'Lerndaten nicht verfügbar.',...(revoked?{view:null,uncertain:false}:{})});if(!this.state.view&&this.state.initialLoadId!==null)notifyInitialScheduleRead({type:'cancel',requestId:this.state.initialLoadId});}
    finally{clearTimeout(timeout);if(this.reading===controller)this.reading=null;}
  }
  private base(a:LearningAccount){if(this.state.status!=='ready'||this.state.busy||this.pending||!sameLearningAccount(a,this.state.view?.account??null))return null;return {contractVersion:1 as const,requestId:`c3a_${crypto.randomUUID()}`,expectedAccountId:a.userId,expectedAccessGeneration:a.accessGeneration,expectedSessionContext:a.sessionContext};}
  async submit(operation:ScheduleOperation,rendered:ScheduleView):Promise<ScheduleView|null>{const base=this.base(rendered.account);return base?this.execute({...base,action:'schedule',operation,expected:scheduleExpected(rendered,operation)}):null;}
  private async execute(command:ScheduleCommand):Promise<ScheduleView|null> {
    this.pending=command;this.reading?.abort();const controller=new AbortController();this.writing=controller;const epoch=++this.epoch;this.update({busy:true,message:'Wird gespeichert …'});
    try {const result=await this.request('/api/learning/schedule',controller.signal,command) as ScheduleResult;if(epoch!==this.epoch)return null;
      if(!sameLearningAccount(this.state.view?.account??null,result.account))throw new LearningFailure('account_changed','Die Anmeldung hat sich geändert. Bitte neu laden.',409);
      this.pending=null;this.update({busy:true,uncertain:false,message:'Gespeichert – Stand wird aktualisiert …',status:'ready'});
      await this.load(false,true);if(this.state.status==='ready'&&sameLearningAccount(this.state.view?.account??null,result.account))this.update({message:'Gespeichert'});return this.state.status==='ready'?this.state.view:null;
    }catch(error){if(epoch!==this.epoch)return null;const uncertain=!(error instanceof LearningFailure)||error.status>=500;if(!uncertain)this.pending=null;
      this.update({status:'error',busy:false,uncertain,message:uncertain?'Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.':error instanceof Error?error.message:'Lerndaten nicht verfügbar.',...(error instanceof LearningFailure&&[401,403].includes(error.status)?{view:null}:{})});return null;}
  }
  async recover(){const command=this.pending;if(!command){await this.load(true);return;}await this.load(true);const a=this.state.view?.account;
    if(this.pending!==command||!a||a.userId!==command.expectedAccountId||a.accessGeneration!==command.expectedAccessGeneration||a.sessionContext!==command.expectedSessionContext)return;
    const controller=new AbortController();this.reading=controller;const epoch=++this.epoch;
    try{const result=await this.request(`/api/learning/schedule/commands/${command.requestId}`,controller.signal);if(epoch!==this.epoch)return;
      if(!sameLearningAccount(a,result.account)){this.pending=null;await this.load(true);return;}
      this.pending=null;this.update({uncertain:false,message:'Speichern bestätigt'});await this.load();
    }catch(error){if(epoch!==this.epoch)return;if(error instanceof LearningFailure&&error.status===404)await this.execute(command);else this.update({status:'error',message:'Ergebnis konnte nicht geprüft werden.',uncertain:true});}
  }
}
