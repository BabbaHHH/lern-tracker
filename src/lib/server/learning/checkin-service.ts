import type {PoolClient} from 'pg';
import {AiProviderError,chatCompletion,type AiMessage,type ChatCompletionOptions} from '../../ai';
import {digest,recordKey} from '../../data-migration/migration';
import {localDate} from '../../dates';
import {AccountError,exactFields} from '../auth/security';
import type {AccountService} from '../auth/service';
import type {AiCredentialService,AiCredentialAccess} from '../ai-credentials/service';
import {lockState} from '../persistence/repository';
import type {CheckinCommand,CheckinAsk,CheckinApply,CheckinResult,CheckinView,CheckinSuggestion} from '../../learning/checkin-contract';
import type {LearningAccount,ProgressRecord} from '../../learning/progress-contract';
import type {Progress} from '../../types';
import {object,live,type PlanRow} from './plan-calculation';
import {checkinLeaves,readCheckinContext} from './checkin-context';
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const context=(p:{userId:string;generation:number;sessionId:string}):LearningAccount=>({userId:p.userId,accessGeneration:p.generation,sessionContext:digest(['learning-session',p.sessionId])});
function conflict(message='Dein Lernkontext hat sich geändert. Bitte einen neuen Check-in senden.'):never{throw new AccountError('conflict',message,409);}
function invalid(message='Ungültiger Check-in.'):never{throw new AccountError('invalid_input',message);}
interface Stored extends CheckinResult {accessProof?:string}
interface Receipt {fingerprint:string;result:Stored}
export function validateCheckin(value:unknown):CheckinCommand{
 if(!object(value))invalid();
 exactFields(value,['contractVersion','expectedAccountId','expectedAccessGeneration','expectedSessionContext','action','requestId',...(value.action==='ask'?['snapshot','messages']:['proposalId'])]);
 if(value.contractVersion!==1||!id(value.expectedAccountId)||!Number.isSafeInteger(value.expectedAccessGeneration)||Number(value.expectedAccessGeneration)<1||!hash(value.expectedSessionContext)||!id(value.requestId)||!value.requestId.startsWith('c3b2b_'))invalid();
 if(value.action==='ask'){
  if(!hash(value.snapshot)||!Array.isArray(value.messages)||!value.messages.length||value.messages.length>20)invalid('Bitte einen kurzen Gesprächsverlauf senden.');
  let length=0;
  for(const m of value.messages){if(!object(m))invalid();exactFields(m,['role','content']);if(!['user','assistant'].includes(String(m.role))||typeof m.content!=='string'||!m.content.trim()||m.content.length>4000)invalid();length+=m.content.length;}
  if(length>20000||value.messages.at(-1).role!=='user')invalid('Das Gespräch ist zu lang oder endet nicht mit deiner Nachricht.');
 }else if(value.action==='apply'){if(!id(value.proposalId)||value.proposalId===value.requestId)invalid();}
 else invalid();return value as unknown as CheckinCommand;
}
export function parseCheckinReply(reply:string,rows:PlanRow[]):{message:string;suggestions:CheckinSuggestion[]}{
 let v:unknown;try{v=JSON.parse(reply);}catch{invalid('Die KI-Antwort entspricht nicht dem vereinbarten JSON-Format. Es wurde nichts übernommen.');}
 if(!object(v))invalid('Ungültige KI-Antwort.');exactFields(v,['message','progressSuggestions']);
 if(typeof v.message!=='string'||!v.message.trim()||v.message.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v.message))invalid('Die KI-Antwort enthält keinen gültigen Nachrichtentext.');
 if(v.progressSuggestions!==undefined&&!Array.isArray(v.progressSuggestions))invalid('Ungültige Fortschrittsvorschläge.');
 const suggestions:CheckinSuggestion[]=[],seen=new Set<string>();
 for(const s of (v.progressSuggestions??[]) as unknown[]){
  if(!object(s))invalid();exactFields(s,['topicId','percent']);
  if(typeof s.topicId!=='string'||!checkinLeaves.some(t=>t.id===s.topicId)||seen.has(s.topicId)||!Number.isInteger(s.percent)||Number(s.percent)<0||Number(s.percent)>100)invalid('Unbekanntes Blatt-Thema, doppelter Vorschlag oder ungültiger Prozentwert. Es wurde nichts übernommen.');
  const old=rows.find(r=>r.kind==='progress'&&r.id===s.topicId&&live(r));
  suggestions.push({topicId:s.topicId,percent:Number(s.percent),beforePercent:old&&object(old.payload)?Number(old.payload.percent):0,expectedRevision:old?.revision??null});seen.add(s.topicId);
 }
 if(suggestions.length>20)invalid('Zu viele Fortschrittsvorschläge für einen kurzen Check-in.');
 return {message:v.message,suggestions};
}
export class CheckinService {
 constructor(readonly auth:AccountService,readonly credentials:AiCredentialService,private readonly options:{today?:()=>string;complete?:(messages:AiMessage[],options:ChatCompletionOptions)=>Promise<string>;beforeWrite?:(i:number)=>void;beforeCommit?:()=>void}={}){}
 private today(){return this.options.today?.()??localDate();}
 private check(account:LearningAccount,input:{expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string}){
  if(account.userId!==input.expectedAccountId||account.accessGeneration!==input.expectedAccessGeneration||account.sessionContext!==input.expectedSessionContext)throw new AccountError('account_changed','Die Anmeldung hat sich geändert. Bitte neu laden.',409);
 }
 private async receipt(c:PoolClient,owner:string,requestId:string):Promise<Receipt|undefined>{return (await c.query<Receipt>("SELECT fingerprint,result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2 AND action='checkin'",[owner,requestId])).rows[0];}
 private async accessProof(c:PoolClient,owner:string){
  const rows=(await c.query(`SELECT s.selected_source,s.revision AS selection_revision,k.credential_id,k.revision AS credential_revision,k.configured FROM stex.ai_credential_selections s LEFT JOIN stex.ai_credentials k ON k.owner_user_id=s.owner_user_id AND k.source=s.selected_source WHERE s.owner_user_id=$1`,[owner])).rows;
  return digest(rows);
 }
 private expectedAccess(access:AiCredentialAccess){return digest([{selected_source:access.source,selection_revision:access.selectionRevision,credential_id:access.credentialId,credential_revision:access.credentialRevision,configured:true}]);}
 private publicResult(stored:Stored,account:LearningAccount,snapshot:string,accessProof:string):CheckinResult{
  const {accessProof:proof,...value}=stored;
  if(value.operation==='ask'&&(value.snapshot!==snapshot||value.account.sessionContext!==account.sessionContext||value.account.accessGeneration!==account.accessGeneration||proof!==accessProof))return {...value,account,state:'stale',message:'Dieser Vorschlag ist nicht mehr aktuell. Bitte einen neuen Check-in senden.',suggestions:[],progress:[],replay:true};
  return {...value,account,replay:true};
 }
 async read(headers:Headers):Promise<CheckinView>{
  const who=await this.auth.principal(headers);
  return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const account=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));const s=await readCheckinContext(c,account,this.today()),proof=await this.accessProof(c,account.userId);
   const recent=(await c.query<{result:Stored}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND action='checkin' ORDER BY created_at DESC,request_id DESC LIMIT 20",[account.userId])).rows.map(r=>this.publicResult(r.result,account,s.snapshot,proof));
   return {contractVersion:1,account,snapshot:s.snapshot,today:this.today(),settings:{model:s.settings.model,promptDefault:s.settings.promptDefault,reasoningDefault:s.settings.reasoningDefault},recent};
  });
 }
 async status(headers:Headers,requestId:string):Promise<CheckinResult>{
  if(!id(requestId))invalid();const who=await this.auth.principal(headers);
  return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true)),r=await this.receipt(c,a.userId,requestId);if(!r)throw new AccountError('not_found','Check-in-Vorgang nicht gefunden.',404);const s=await readCheckinContext(c,a,this.today());return this.publicResult(r.result,a,s.snapshot,await this.accessProof(c,a.userId));});
 }
 async submit(headers:Headers,input:unknown,signal?:AbortSignal):Promise<CheckinResult>{
  const command=validateCheckin(input);return command.action==='ask'?this.ask(headers,command,signal):this.apply(headers,command);
 }
 private async ask(headers:Headers,command:CheckinAsk,signal?:AbortSignal):Promise<CheckinResult>{
  const who=await this.auth.principal(headers),account=context(who);this.check(account,command);
  const fingerprint=digest({...command,expectedAccessGeneration:undefined,expectedSessionContext:undefined});
  // Resolve only the explicitly selected personal access. No provider call is made by this method.
  const access=await this.credentials.resolveSelected(headers);this.check(context(access),command);
  const prepared=await this.auth.database.transaction(async c=>{
   await lockState(c);const a=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.check(a,command);
   const s=await readCheckinContext(c,a,this.today()),proof=await this.accessProof(c,a.userId),existing=await this.receipt(c,a.userId,command.requestId);
   if(existing){if(existing.fingerprint!==fingerprint)conflict('Diese Vorgangskennung gehört zu einem anderen Gesprächsbeitrag.');return {replay:this.publicResult(existing.result,a,s.snapshot,proof)};}
   if(s.snapshot!==command.snapshot)conflict();if(proof!==this.expectedAccess(access))conflict('Der KI-Zugang hat sich geändert.');
   const pending:Stored={contractVersion:1,account:a,requestId:command.requestId,action:'checkin',operation:'ask',state:'pending',snapshot:s.snapshot,createdAt:new Date().toISOString(),message:'Antwort noch nicht bestätigt. Status prüfen; keine automatische erneute KI-Anfrage.',suggestions:[],progress:[],replay:false,accessProof:proof};
   await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,'checkin',$3,'[]',$4::jsonb)",[a.userId,command.requestId,fingerprint,JSON.stringify(pending)]);
   return {pending,s};
  });
  if('replay' in prepared)return prepared.replay!;
  const {pending,s}=prepared;
  try{
   await this.credentials.assertAccessCurrent(access);
   const messages:AiMessage[]=[{role:'system',content:s.system},...command.messages];
   const options:ChatCompletionOptions={apiKey:access.apiKey,credentialSource:access.source,model:s.settings.model,reasoningPreference:s.settings.reasoning,purpose:'general',signal:AbortSignal.any([AbortSignal.timeout(115000),...(signal?[signal]:[])])};
   const reply=await (this.options.complete?this.options.complete(messages,options):chatCompletion(messages,'cheap',options));
   const parsed=parseCheckinReply(reply,s.rows);
   await this.credentials.assertAccessCurrent(access);
   return await this.auth.database.transaction(async c=>{
    await lockState(c);const a=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.check(a,command);
    const fresh=await readCheckinContext(c,a,this.today());if(fresh.snapshot!==s.snapshot)conflict();if(await this.accessProof(c,a.userId)!==pending.accessProof)conflict('Der KI-Zugang hat sich geändert.');
    const result:Stored={...pending,...parsed,state:'ready'};
    await c.query("UPDATE stex.learning_commands SET result=$3::jsonb WHERE owner_user_id=$1 AND request_id=$2 AND action='checkin'",[a.userId,command.requestId,JSON.stringify(result)]);
    return {...this.publicResult(result,a,s.snapshot,pending.accessProof!),replay:false};
   });
  }catch(error){
   const known=error instanceof AccountError||error instanceof AiProviderError;
   const code=known?error.code:'provider_uncertain';
   const message=known?error.message:'Die KI-Antwort ist nicht bestätigt. Kein automatischer neuer Aufruf. Bitte den Status prüfen, bevor du bewusst erneut sendest.';
   // No conversation, provider body, key or access token is retained on failure.
   await this.auth.database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.learning_commands SET result=$3::jsonb WHERE owner_user_id=$1 AND request_id=$2 AND action='checkin' AND result->>'state'='pending'",[account.userId,command.requestId,JSON.stringify({...pending,state:'failed',errorCode:code,message})]);});
   if(error instanceof AccountError)throw error;throw new AccountError(code,message,error instanceof AiProviderError?error.status:502);
  }
 }
 private async apply(headers:Headers,command:CheckinApply):Promise<CheckinResult>{
  const who=await this.auth.principal(headers);
  return this.auth.database.transaction(async c=>{
   await lockState(c);const a=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.check(a,command);
   const fingerprint=digest({...command,expectedAccessGeneration:undefined,expectedSessionContext:undefined});
   const replay=await this.receipt(c,a.userId,command.requestId);
   if(replay){if(replay.fingerprint!==fingerprint)conflict('Diese Vorgangskennung gehört zu einer anderen Bestätigung.');return {...replay.result,account:a,replay:true};}
   const proposal=await this.receipt(c,a.userId,command.proposalId),s=await readCheckinContext(c,a,this.today());
   if(!proposal||proposal.result.operation!=='ask'||proposal.result.state!=='ready'||!proposal.result.suggestions.length)conflict('Kein bestätigbarer eigener Fortschrittsvorschlag.');
   const p=proposal.result;
   if(p.snapshot!==s.snapshot||p.account.sessionContext!==a.sessionContext||p.account.accessGeneration!==a.accessGeneration||p.accessProof!==await this.accessProof(c,a.userId))conflict();
   if((await c.query("SELECT 1 FROM stex.learning_commands WHERE owner_user_id=$1 AND action='checkin' AND result->>'operation'='apply' AND result->>'proposalId'=$2",[a.userId,command.proposalId])).rowCount)conflict('Dieser Vorschlag wurde bereits übernommen.');
   const progress:ProgressRecord[]=[],receipts:unknown[]=[],stamp=new Date().toISOString();
   for(const [i,change] of p.suggestions.entries()){
    this.options.beforeWrite?.(i);
    const old=s.rows.find(r=>r.kind==='progress'&&r.id===change.topicId)??null;if((old?.revision??null)!==change.expectedRevision)conflict();
    const key=recordKey('progress',a.userId,change.topicId),value={...(old&&object(old.payload)?old.payload:{}),topicId:change.topicId,percent:change.percent,source:'ai',updatedAt:stamp} as Progress;
    await c.query('INSERT INTO stex.topics(id) VALUES($1) ON CONFLICT DO NOTHING',[change.topicId]);
    const after=(await c.query<PlanRow>(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,'progress',$3,1,'lerntracker-progress',$4::jsonb,'{}') ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,revision=personal_records.revision+1 WHERE personal_records.revision=$5 RETURNING kind,id,revision,payload,normalized,legacy_key AS "legacyKey"`,[key,a.userId,change.topicId,JSON.stringify(value),change.expectedRevision])).rows[0];if(!after)conflict();
    const beforeReferences=s.references.filter(r=>r.source_key===key);
    await c.query("INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_topic_id) VALUES($1,'value.topicId',$2,$1,$3) ON CONFLICT(source_key,path) DO NOTHING",[key,a.userId,change.topicId]);
    const afterReferences=(await c.query('SELECT * FROM stex.record_references WHERE source_key=$1 ORDER BY source_key,path',[key])).rows;
    receipts.push({before:old,after,beforeReferences,afterReferences});progress.push({id:change.topicId,value,revision:after.revision});
   }
   const result:CheckinResult={contractVersion:1,account:a,requestId:command.requestId,proposalId:command.proposalId,action:'checkin',operation:'apply',state:'applied',snapshot:p.snapshot,createdAt:stamp,message:'Fortschritt bewusst übernommen.',suggestions:p.suggestions,progress,replay:false};
   await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,'checkin',$3,$4::jsonb,$5::jsonb)",[a.userId,command.requestId,fingerprint,JSON.stringify(receipts),JSON.stringify(result)]);
   await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');this.options.beforeCommit?.();return result;
  });
 }
}
