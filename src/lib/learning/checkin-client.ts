import {LearningFailure} from './progress-client';
import {sameLearningAccount} from './personal-contract';
import type {CheckinCommand,CheckinView,CheckinResult,CheckinMessage} from './checkin-contract';
export interface CheckinState {status:'loading'|'ready'|'error';view:CheckinView|null;messages:CheckinMessage[];busy:boolean;uncertain:boolean;message:string;result:CheckinResult|null}
export class CheckinClient {
 state:CheckinState={status:'loading',view:null,messages:[],busy:false,uncertain:false,message:'',result:null};
 private listeners=new Set<()=>void>();private epoch=0;private reading:AbortController|null=null;private writing:AbortController|null=null;private pending:CheckinCommand|null=null;
 constructor(private transport:typeof fetch=(...args)=>fetch(...args)){}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};getSnapshot=()=>this.state;
 private update(v:Partial<CheckinState>){this.state={...this.state,...v};this.listeners.forEach(f=>f());}
 private async request(path:string,signal:AbortSignal,command?:CheckinCommand):Promise<CheckinView|CheckinResult>{
  const response=await this.transport(path,{method:command?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,headers:command?{'Content-Type':'application/json','X-Stex-Action':'1'}:{},body:command?JSON.stringify(command):undefined});
  const value=await response.json();if(!response.ok)throw new LearningFailure(value?.error?.code??'unavailable',value?.error?.message??'Check-in nicht verfügbar.',response.status);
  if(value?.contractVersion!==1||typeof value.account?.sessionContext!=='string'||(!Array.isArray(value.recent)&&value.action!=='checkin'))throw new LearningFailure('unavailable','Check-in-Antwort nicht bestätigt.',503);return value;
 }
 hide=()=>{this.epoch++;this.reading?.abort();this.writing?.abort();this.update({status:'loading',busy:false,messages:[],result:null,uncertain:!!this.pending,message:this.pending?'Vorgang nicht bestätigt. Bitte Status prüfen.':''});};
 async load(hide=false){
  if(this.state.busy&&!hide)return;if(hide)this.hide();this.reading?.abort();const controller=new AbortController();this.reading=controller;const epoch=++this.epoch;
  try{const view=await this.request('/api/learning/checkin',controller.signal) as CheckinView;if(epoch!==this.epoch)return;
   const changed=!sameLearningAccount(this.state.view?.account??null,view.account);if(changed){this.pending=null;this.writing?.abort();}
   const old=this.state.result;const current=old?view.recent.find(r=>r.requestId===old.requestId):null;
   this.update({status:'ready',view,busy:false,...(changed?{messages:[],result:null,uncertain:false,message:''}:{result:current??(old?.snapshot===view.snapshot?old:null)})});
  }catch(error){if(epoch!==this.epoch)return;const revoked=error instanceof LearningFailure&&[401,403].includes(error.status);if(revoked)this.pending=null;this.update({status:'error',busy:false,result:null,messages:[],message:error instanceof Error?error.message:'Check-in nicht verfügbar.',...(revoked?{view:null,uncertain:false}:{})});}
 }
 private base(view:CheckinView){if(this.state.status!=='ready'||this.state.busy||this.pending||!sameLearningAccount(view.account,this.state.view?.account??null))return null;return {contractVersion:1 as const,requestId:`c3b2b_${crypto.randomUUID()}`,expectedAccountId:view.account.userId,expectedAccessGeneration:view.account.accessGeneration,expectedSessionContext:view.account.sessionContext};}
 async send(content:string,view:CheckinView){const base=this.base(view);if(!base||!content.trim())return null;const messages=[...this.state.messages,{role:'user' as const,content:content.trim()}];return this.execute({...base,action:'ask',snapshot:view.snapshot,messages});}
 async apply(proposal:CheckinResult,view:CheckinView){const base=this.base(view);if(!base||proposal.state!=='ready'||!sameLearningAccount(proposal.account,view.account))return null;return this.execute({...base,action:'apply',proposalId:proposal.requestId});}
 private async execute(command:CheckinCommand){
  this.pending=command;this.reading?.abort();const controller=new AbortController();this.writing=controller;const epoch=++this.epoch;
  this.update({busy:true,uncertain:false,message:command.action==='ask'?'Antwort wird angefragt …':'Fortschritt wird gespeichert …',...(command.action==='ask'?{messages:command.messages,result:null}:{})});
  try{const result=await this.request('/api/learning/checkin',controller.signal,command) as CheckinResult;if(epoch!==this.epoch)return null;
   if(!sameLearningAccount(this.state.view?.account??null,result.account))throw new LearningFailure('account_changed','Die Anmeldung hat sich geändert.',409);
   this.pending=null;this.update({busy:false,result,uncertain:result.state==='pending',message:result.operation==='apply'?'Fortschritt gespeichert.':result.state==='ready'?'Antwort geprüft. Fortschritt wurde noch nicht geändert.':result.message,...(result.state==='ready'?{messages:[...this.state.messages,{role:'assistant',content:result.message}]}:{})});
   await this.load();return result;
  }catch(error){if(epoch!==this.epoch)return null;const uncertain=!(error instanceof LearningFailure)||error.status>=500;if(!uncertain)this.pending=null;
   const revoked=error instanceof LearningFailure&&[401,403].includes(error.status);
   this.update({status:'error',busy:false,uncertain,result:null,message:uncertain?'Vorgang nicht bestätigt. Bitte zuerst Status prüfen.':error instanceof Error?error.message:'Check-in fehlgeschlagen.',...(revoked?{view:null,messages:[]}:{})});return null;}
 }
 async recover(){
  const command=this.pending,selected=this.state.result;const previousAccount=this.state.view?.account??null;
  const requestId=command?.requestId??(selected?.state==='pending'?selected.requestId:null);
  await this.load(true);if(!requestId||!this.state.view||!sameLearningAccount(previousAccount,this.state.view.account)||(command&&this.pending!==command))return;
  const controller=new AbortController();this.reading=controller;const epoch=++this.epoch;
  try{const result=await this.request(`/api/learning/checkin/commands/${requestId}`,controller.signal) as CheckinResult;if(epoch!==this.epoch)return;
   if(!sameLearningAccount(result.account,this.state.view.account))return;
   this.pending=null;this.update({status:'ready',result,uncertain:result.state==='pending',message:result.state==='pending'?'Noch kein bestätigtes Ergebnis. Es erfolgt kein neuer KI-Aufruf.':result.message});
  }catch(error){if(epoch!==this.epoch)return;
   if(error instanceof LearningFailure&&error.status===404){this.pending=null;this.update({status:'ready',uncertain:false,message:'Kein Vorgang gefunden. Du kannst den Beitrag oder die Bestätigung bewusst erneut senden.'});}
   else this.update({status:'error',uncertain:true,message:'Status konnte noch nicht geprüft werden.'});
  }
 }
 select(result:CheckinResult){if(!this.state.busy&&this.state.view&&sameLearningAccount(result.account,this.state.view.account))this.update({result,uncertain:result.state==='pending'});}
}
