import type { LearningAccount } from './progress-contract';
import { LearningFailure } from './progress-client';
import { sameLearningAccount } from './personal-contract';
import type {PlanCommand,PlanResult,PlanView,PlanOperation,PlanPreview,PreviewCommand} from './plan-contract';
export interface PlanState {status:'loading'|'ready'|'error';view:PlanView|null;busy:boolean;uncertain:boolean;message:string;preview:PlanPreview|null}
/** Mounted memory only; writes require the context of the view the user actually edited. */
export class PlanClient {
  state:PlanState={status:'loading',view:null,busy:false,uncertain:false,message:'',preview:null};
  private listeners=new Set<()=>void>();private epoch=0;private pending:PlanCommand|null=null;private reading:AbortController|null=null;private writing:AbortController|null=null;
  constructor(private readonly transport:typeof fetch=(...args)=>fetch(...args)){}
  subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
  getSnapshot=()=>this.state;
  private update(v:Partial<PlanState>){this.state={...this.state,...v};this.listeners.forEach(f=>f());}
  private async request(path:string,signal:AbortSignal,body?:PlanCommand|PreviewCommand):Promise<PlanResult|PlanView|PlanPreview> {
    const response=await this.transport(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,headers:body?{'Content-Type':'application/json','X-Stex-Action':'1'}:{},body:body?JSON.stringify(body):undefined});
    const v=await response.json();if(!response.ok)throw new LearningFailure(v?.error?.code??'unavailable',v?.error?.message??'Lerndaten nicht verfügbar.',response.status);
    if(v?.contractVersion!==1||!v.account||typeof v.account.sessionContext!=='string'||(v.action!=='plan'&&!Array.isArray(v.history)&&!Array.isArray(v.changes)))throw new LearningFailure('unavailable','Antwort nicht bestätigt.',503);
    return v;
  }
  hide=()=>{this.epoch++;this.reading?.abort();this.writing?.abort();this.update({status:'loading',busy:false,preview:null,...(this.pending?{uncertain:true,message:'Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.'}:{})});};
  async load(hide=false,force=false):Promise<void> {
    if(this.state.busy&&!hide&&!force)return;if(hide)this.hide();this.reading?.abort();const controller=new AbortController();this.reading=controller;const epoch=++this.epoch;
    try {const view=await this.request('/api/learning/plans',controller.signal) as PlanView;if(epoch!==this.epoch)return;
      const changed=!sameLearningAccount(this.state.view?.account??null,view.account);if(changed){this.pending=null;this.writing?.abort();}
      this.update({status:this.pending?'error':'ready',view,busy:false,...(changed?{preview:null}:{}),...(changed||(!this.pending&&hide)?{uncertain:false,message:''}:{})});
    }catch(error){if(epoch!==this.epoch)return;const revoked=error instanceof LearningFailure&&[401,403].includes(error.status);if(revoked)this.pending=null;this.update({status:'error',busy:false,message:error instanceof Error?error.message:'Lerndaten nicht verfügbar.',...(revoked?{view:null,uncertain:false}:{})});}
  }
  private base(a:LearningAccount){if(this.state.status!=='ready'||this.state.busy||this.pending||!sameLearningAccount(a,this.state.view?.account??null))return null;return {contractVersion:1 as const,requestId:`c3b1_${crypto.randomUUID()}`,expectedAccountId:a.userId,expectedAccessGeneration:a.accessGeneration,expectedSessionContext:a.sessionContext};}
  async submit(operation:PlanOperation,rendered:PlanView):Promise<PlanView|null>{const base=this.base(rendered.account);return base?this.execute({...base,action:'plan',operation}):null;}
  async preview(planId:string,planRevision:number,rendered:PlanView):Promise<PlanPreview|null>{
    const base=this.base(rendered.account);if(!base)return null;
    const controller=new AbortController();this.reading?.abort();this.writing=controller;const epoch=++this.epoch;this.update({busy:true,preview:null,message:'Vorschau wird berechnet …'});
    const input:PreviewCommand={contractVersion:1,expectedAccountId:base.expectedAccountId,expectedAccessGeneration:base.expectedAccessGeneration,expectedSessionContext:base.expectedSessionContext,planId,planRevision,snapshot:rendered.snapshot};
    try{const preview=await this.request('/api/learning/plans/preview',controller.signal,input) as PlanPreview;if(epoch!==this.epoch)return null;if(!sameLearningAccount(this.state.view?.account??null,preview.account))throw new LearningFailure('account_changed','Die Anmeldung hat sich geändert. Bitte neu laden.',409);this.update({busy:false,preview,message:'Vorschau bereit. Es wurde noch nichts übernommen.'});return preview;}
    catch(error){if(epoch!==this.epoch)return null;const revoked=error instanceof LearningFailure&&[401,403].includes(error.status);this.update({status:'error',busy:false,preview:null,message:error instanceof Error?error.message:'Vorschau nicht verfügbar.',...(revoked?{view:null}:{})});return null;}
  }
  private async execute(command:PlanCommand):Promise<PlanView|null> {
    this.pending=command;this.reading?.abort();const controller=new AbortController();this.writing=controller;const epoch=++this.epoch;this.update({busy:true,preview:null,message:'Wird gespeichert …'});
    try {const result=await this.request('/api/learning/plans',controller.signal,command) as PlanResult;if(epoch!==this.epoch)return null;
      if(!sameLearningAccount(this.state.view?.account??null,result.account))throw new LearningFailure('account_changed','Die Anmeldung hat sich geändert. Bitte neu laden.',409);
      this.pending=null;this.update({busy:true,uncertain:false,message:'Gespeichert – Stand wird aktualisiert …',status:'ready'});
      await this.load(false,true);if(this.state.status==='ready'&&sameLearningAccount(this.state.view?.account??null,result.account))this.update({message:'Gespeichert'});return this.state.status==='ready'?this.state.view:null;
    }catch(error){if(epoch!==this.epoch)return null;const uncertain=!(error instanceof LearningFailure)||error.status>=500;if(!uncertain)this.pending=null;
      this.update({status:'error',busy:false,uncertain,message:uncertain?'Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.':error instanceof Error?error.message:'Lerndaten nicht verfügbar.',...(error instanceof LearningFailure&&[401,403].includes(error.status)?{view:null}:{})});return null;}
  }
  async recover(){const command=this.pending;if(!command){await this.load(true);return;}await this.load(true);const a=this.state.view?.account;
    if(this.pending!==command||!a||a.userId!==command.expectedAccountId||a.accessGeneration!==command.expectedAccessGeneration||a.sessionContext!==command.expectedSessionContext)return;
    const controller=new AbortController();this.reading=controller;const epoch=++this.epoch;
    try{const result=await this.request(`/api/learning/plans/commands/${command.requestId}`,controller.signal);if(epoch!==this.epoch)return;
      if(!sameLearningAccount(a,result.account)){this.pending=null;await this.load(true);return;}
      this.pending=null;this.update({uncertain:false,message:'Speichern bestätigt'});await this.load();
    }catch(error){if(epoch!==this.epoch)return;if(error instanceof LearningFailure&&error.status===404)await this.execute(command);else this.update({status:'error',message:'Ergebnis konnte nicht geprüft werden.',uncertain:true});}
  }
}
