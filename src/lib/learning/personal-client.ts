import type { LearningAccount } from './progress-contract';
import { LearningFailure } from './progress-client';
import { sameLearningAccount,type PersonalPatchCommand,type PersonalResult,type PersonalView,type ProfilePatch,type ProfileRevisions } from './personal-contract';
export interface PersonalState {status:'loading'|'ready'|'error';view:PersonalView|null;busy:boolean;uncertain:boolean;message:string}
/** Mounted memory only; writes require the context of the view the user actually edited. */
export class PersonalClient {
  state:PersonalState={status:'loading',view:null,busy:false,uncertain:false,message:''};
  private listeners=new Set<()=>void>();private epoch=0;private pending:PersonalPatchCommand|null=null;private reading:AbortController|null=null;private writing:AbortController|null=null;
  constructor(private readonly transport:typeof fetch=(...args)=>fetch(...args)){}
  subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
  getSnapshot=()=>this.state;
  private update(v:Partial<PersonalState>){this.state={...this.state,...v};this.listeners.forEach(f=>f());}
  private async request(path:string,signal:AbortSignal,body?:PersonalPatchCommand):Promise<PersonalResult> {
    const response=await this.transport(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,headers:body?{'Content-Type':'application/json','X-Stex-Action':'1'}:{},body:body?JSON.stringify(body):undefined});
    const v=await response.json();if(!response.ok)throw new LearningFailure(v?.error?.code??'unavailable',v?.error?.message??'Lerndaten nicht verfügbar.',response.status);
    if(v?.contractVersion!==1||!v.account||typeof v.account.sessionContext!=='string'||!Array.isArray(v.notes))throw new LearningFailure('unavailable','Antwort nicht bestätigt.',503);
    return v;
  }
  hide=()=>{this.epoch++;this.reading?.abort();this.writing?.abort();this.update({status:'loading',busy:false,...(this.pending?{uncertain:true,message:'Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.'}:{})});};
  async load(hide=false):Promise<void> {
    if(this.state.busy&&!hide)return;if(hide)this.hide();this.reading?.abort();const controller=new AbortController();this.reading=controller;const epoch=++this.epoch;
    try {const view=await this.request('/api/learning/personal',controller.signal);if(epoch!==this.epoch)return;
      const changed=!sameLearningAccount(this.state.view?.account??null,view.account);if(changed){this.pending=null;this.writing?.abort();}
      this.update({status:this.pending?'error':'ready',view,busy:false,...(changed||(!this.pending&&hide)?{uncertain:false,message:''}:{})});
    }catch(error){if(epoch!==this.epoch)return;const revoked=error instanceof LearningFailure&&[401,403].includes(error.status);if(revoked)this.pending=null;this.update({status:'error',busy:false,message:error instanceof Error?error.message:'Lerndaten nicht verfügbar.',...(revoked?{view:null,uncertain:false}:{})});}
  }
  private base(a:LearningAccount){if(this.state.status!=='ready'||this.state.busy||this.pending||!sameLearningAccount(a,this.state.view?.account??null))return null;return {contractVersion:1 as const,requestId:`c2_${crypto.randomUUID()}`,expectedAccountId:a.userId,expectedAccessGeneration:a.accessGeneration,expectedSessionContext:a.sessionContext};}
  async saveProfile(fields:ProfilePatch,expectedRevisions:ProfileRevisions,account:LearningAccount):Promise<PersonalView|null>{const base=this.base(account);return base?this.execute({...base,action:'profile',fields,expectedRevisions}):null;}
  async saveNote(id:string,topicId:string,note:string,expectedRevision:number|null,account:LearningAccount):Promise<PersonalView|null>{const base=this.base(account);return base?this.execute({...base,action:'note',id,topicId,note,expectedRevision}):null;}
  private async execute(command:PersonalPatchCommand):Promise<PersonalView|null> {
    this.pending=command;this.reading?.abort();const controller=new AbortController();this.writing=controller;const epoch=++this.epoch;this.update({busy:true,message:'Wird gespeichert …'});
    try {const result=await this.request('/api/learning/personal',controller.signal,command);if(epoch!==this.epoch)return null;
      if(!sameLearningAccount(this.state.view?.account??null,result.account))throw new LearningFailure('account_changed','Die Anmeldung hat sich geändert. Bitte neu laden.',409);
      this.pending=null;this.update({busy:false,uncertain:false,message:'Gespeichert',status:'ready',...(result.replay?{}:{view:result})});
      if(result.replay)await this.load();return this.state.status==='ready'?this.state.view:null;
    }catch(error){if(epoch!==this.epoch)return null;const uncertain=!(error instanceof LearningFailure)||error.status>=500;if(!uncertain)this.pending=null;
      this.update({status:'error',busy:false,uncertain,message:uncertain?'Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.':error instanceof Error?error.message:'Lerndaten nicht verfügbar.',...(error instanceof LearningFailure&&[401,403].includes(error.status)?{view:null}:{})});return null;}
  }
  async recover(){const command=this.pending;if(!command){await this.load(true);return;}await this.load(true);const a=this.state.view?.account;
    if(this.pending!==command||!a||a.userId!==command.expectedAccountId||a.accessGeneration!==command.expectedAccessGeneration||a.sessionContext!==command.expectedSessionContext)return;
    const controller=new AbortController();this.reading=controller;const epoch=++this.epoch;
    try{const result=await this.request(`/api/learning/personal/commands/${command.requestId}`,controller.signal);if(epoch!==this.epoch)return;
      if(!sameLearningAccount(a,result.account)){this.pending=null;await this.load(true);return;}
      this.pending=null;this.update({uncertain:false,message:'Speichern bestätigt'});await this.load();
    }catch(error){if(epoch!==this.epoch)return;if(error instanceof LearningFailure&&error.status===404)await this.execute(command);else this.update({status:'error',message:'Ergebnis konnte nicht geprüft werden.',uncertain:true});}
  }
}
