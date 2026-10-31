import type { LearningAccount, ProgressCommand, ProgressRecord, ProgressResult, ProgressView } from "./progress-contract";

export class LearningFailure extends Error {
  constructor(readonly code:string,message:string,readonly status:number) {super(message);}
}
export interface LearningState { status:"loading"|"ready"|"error"; account:LearningAccount|null; records:ProgressRecord[]; busy:boolean; message:string; undoId:string|null; uncertain:boolean; draft:Record<string,number> }
const initial = ():LearningState => ({status:"loading",account:null,records:[],busy:false,message:"",undoId:null,uncertain:false,draft:{}});
const same = (a:LearningAccount|null,b:LearningAccount|null) => !!a && !!b && a.userId===b.userId && a.accessGeneration===b.accessGeneration && a.sessionContext===b.sessionContext;
/** Per-mounted-view memory only. No browser storage and no offline queue. */
export class ProgressClient {
  state = initial();
  private listeners = new Set<()=>void>();
  private epoch = 0;
  private pending:ProgressCommand|null = null;
  private reading:AbortController|null = null;
  private writing:AbortController|null = null;
  private closed = false;
  private debounce:ReturnType<typeof setTimeout>|undefined;
  private pendingBulk = false;
  private draftRevisions:Record<string,number|null> = {};
  stage(updates:Record<string,number>,bulk=false,renderedRevisions?:Record<string,number|null>):void {
    if (this.state.status!=="ready" || this.state.busy || this.pending) return;
    clearTimeout(this.debounce);
    if (!Object.keys(this.state.draft).length) this.pendingBulk=false;
    for (const id of Object.keys(updates)) if (!Object.hasOwn(this.draftRevisions,id)) this.draftRevisions[id]=renderedRevisions ? renderedRevisions[id]??null : this.state.records.find(r=>r.id===id)?.revision??null;
    this.pendingBulk ||= bulk;
    this.update({draft:{...this.state.draft,...updates},message:"Noch nicht gespeichert"});
    this.debounce=setTimeout(()=>{const draft=this.state.draft;const group=this.pendingBulk;void this.change(draft,group,this.draftRevisions);},300);
  }
  dismissUndo = () => this.update({undoId:null});
  constructor(private readonly transport:typeof fetch = (...args)=>fetch(...args)) {}
  subscribe = (listener:()=>void) => {this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  getSnapshot = () => this.state;
  private update(value:Partial<LearningState>) {this.state={...this.state,...value};this.listeners.forEach(listener=>listener());}
  private async request<T>(path:string,signal:AbortSignal,body?:unknown):Promise<T> {
    const response = await this.transport(path,{method:body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",signal,
      headers:body===undefined?{}:{"Content-Type":"application/json","X-Stex-Action":"1"},body:body===undefined?undefined:JSON.stringify(body)});
    const value = await response.json();
    if (!response.ok) throw new LearningFailure(value?.error?.code||"unavailable",value?.error?.message||"Speichern ist gerade nicht verfügbar.",response.status);
    if (!value || value.contractVersion!==1 || !value.account || typeof value.account.userId!=="string" || !Number.isInteger(value.account.accessGeneration) || typeof value.account.sessionContext!=="string" || !Array.isArray(value.progress)) throw new LearningFailure("unavailable","Die Antwort konnte nicht bestätigt werden.",503);
    return value as T;
  }
  hide = () => {
    clearTimeout(this.debounce);
    this.draftRevisions={};
    this.epoch++;this.reading?.abort();this.writing?.abort();
    this.update({status:"loading",records:[],busy:false,draft:{},...(this.pending?{uncertain:true,message:"Speichern ist nicht bestätigt. Bitte Ergebnis prüfen."}:{})});
  };
  dispose = () => {clearTimeout(this.debounce);this.closed=true;this.epoch++;this.reading?.abort();this.writing?.abort();this.pending=null;this.listeners.clear();};
  async load(hide = false):Promise<void> {
    if (this.closed) return;
    if (this.state.busy && !hide) return;
    if (hide) this.hide();
    this.reading?.abort();
    const controller = new AbortController();this.reading=controller;
    const epoch = ++this.epoch;
    try {
      const view = await this.request<ProgressView>("/api/learning/progress",controller.signal);
      if (epoch!==this.epoch || this.closed) return;
      const changed = !same(this.state.account,view.account);
      if (changed) {this.pending=null;this.writing?.abort();this.draftRevisions={};}
      this.update({status:this.pending?"error":"ready",records:view.progress,account:view.account,busy:false,
        ...(changed?{undoId:null,uncertain:false,message:"",draft:{}}:{} )});
    } catch(error) {
      if (epoch!==this.epoch || this.closed) return;
      const revoked = error instanceof LearningFailure && [401,403].includes(error.status);
      if (revoked) this.pending=null;
      this.update({status:"error",records:[],busy:false,message:error instanceof Error?error.message:"Lernstand nicht verfügbar.",
        ...(revoked?{account:null,undoId:null,uncertain:false}:{})});
    }
  }
  async change(updates:Record<string,number>,bulk=false,expectedRevisions?:Record<string,number|null>):Promise<void> {
    if (this.state.status!=="ready" || this.state.busy || this.pending || !this.state.account) return;
    const account=this.state.account;
    const command:ProgressCommand = {contractVersion:1,requestId:crypto.randomUUID(),expectedAccountId:account.userId,expectedAccessGeneration:account.accessGeneration,expectedSessionContext:account.sessionContext,action:"set",
      changes:Object.entries(updates).map(([topicId,percent])=>({topicId,percent,expectedRevision:expectedRevisions && Object.hasOwn(expectedRevisions,topicId)?expectedRevisions[topicId]:this.state.records.find(r=>r.id===topicId)?.revision??null}))};
    this.draftRevisions={};
    await this.execute(command,bulk);
  }
  async undo():Promise<void> {
    const account=this.state.account;
    if (this.state.status!=="ready" || this.state.busy || this.pending || !account || !this.state.undoId) return;
    await this.execute({contractVersion:1,requestId:crypto.randomUUID(),expectedAccountId:account.userId,expectedAccessGeneration:account.accessGeneration,expectedSessionContext:account.sessionContext,action:"undo",undoOfRequestId:this.state.undoId},false);
  }
  private async execute(command:ProgressCommand,bulk:boolean):Promise<void> {
    clearTimeout(this.debounce);this.pendingBulk=bulk;this.draftRevisions={};
    this.pending=command;
    this.update({busy:true,message:"Wird gespeichert …"});
    const controller=new AbortController();this.writing=controller;
    const epoch=++this.epoch;this.reading?.abort();
    try {
      const result=await this.request<ProgressResult>("/api/learning/progress",controller.signal,command);
      if (epoch!==this.epoch || this.closed) return;
      if (!same(this.state.account,result.account)) throw new LearningFailure("account_changed","Das Konto hat sich geändert. Bitte neu laden.",409);
      this.pending=null;
      if (!result.replay) {
        const records=new Map(this.state.records.map(r=>[r.id,r]));result.progress.forEach(r=>records.set(r.id,r));
        this.update({records:[...records.values()],busy:false,status:"ready",message:"Gespeichert",uncertain:false,draft:{},undoId:bulk?result.requestId:command.action==="undo"?null:this.state.undoId});
      } else {this.update({busy:false,uncertain:false,message:"Gespeichert",draft:{}});await this.load();}
    } catch(error) {
      if (epoch!==this.epoch || this.closed) return;
      const uncertain=!(error instanceof LearningFailure) || error.status>=500;
      if (!uncertain) this.pending=null;
      this.update({status:"error",records:[],busy:false,uncertain,draft:{},message:uncertain?"Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.":error instanceof Error?error.message:"Lernstand nicht verfügbar."});
      if (error instanceof LearningFailure && [401,403].includes(error.status)) this.update({account:null,undoId:null});
    }
  }
  async recover():Promise<void> {
    const command=this.pending;
    if (!command) {await this.load(true);return;}
    await this.load(true);
    if (this.pending!==command || !this.state.account || this.state.account.userId!==command.expectedAccountId || this.state.account.accessGeneration!==command.expectedAccessGeneration || this.state.account.sessionContext!==command.expectedSessionContext) return;
    const controller=new AbortController();this.reading=controller;const epoch=++this.epoch;
    try {
      const receipt=await this.request<ProgressResult>(`/api/learning/commands/${encodeURIComponent(command.requestId)}`,controller.signal);
      if (epoch!==this.epoch || this.closed) return;
      if (!same(receipt.account,this.state.account)) {this.pending=null;await this.load(true);return;}
      this.pending=null;this.update({uncertain:false,message:"Speichern bestätigt",undoId:this.pendingBulk?command.requestId:null});
      await this.load(); // receipt values may be older than the current progress
    } catch(error) {
      if (epoch!==this.epoch || this.closed) return;
      if (error instanceof LearningFailure && error.status===404) await this.execute(command,this.pendingBulk);
      else this.update({status:"error",records:[],message:"Ergebnis konnte nicht geprüft werden.",uncertain:true});
    }
  }
}
