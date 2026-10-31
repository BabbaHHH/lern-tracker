import type {PoolClient} from 'pg';
import {chatCompletion,AiProviderError,type AiMessage,type ChatCompletionOptions} from '../../ai';
import {digest,recordKey} from '../../data-migration/migration';
import {getKorrekturModel} from '../../ai-models';
import type {LearningAccount} from '../../learning/progress-contract';
import {CORRECTION_SETTINGS_ID,ERROR_PROFILE_ID,type CorrectionCommand,type CorrectionResult,type CorrectionView} from '../../learning/correction-contract';
import {parseCorrectionReply,mergeCorrectionMarkers} from '../../learning/correction-core';
import {AccountError,exactFields} from '../auth/security';
import type {AccountService} from '../auth/service';
import type {AiCredentialService,AiCredentialAccess} from '../ai-credentials/service';
import {lockState} from '../persistence/repository';
import {object,settingsValue,correctionRows,resolveCorrection,correctionSnapshot,correctionMessages,type CorrectionRow} from './correction-context';
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const revision=(v:unknown)=>v===null||(Number.isSafeInteger(v)&&Number(v)>0);
function invalid(message='Ungültiger Korrekturauftrag.'):never{throw new AccountError('invalid_input',message);}
function conflict(message='Die bestätigte Korrekturgrundlage hat sich geändert. Es wurde kein Feedback übernommen.'):never{throw new AccountError('conflict',message,409);}
const account=(p:{userId:string;generation:number;sessionId:string}):LearningAccount=>({userId:p.userId,accessGeneration:p.generation,sessionContext:digest(['learning-session',p.sessionId])});
interface Stored extends CorrectionResult {sourceProof?:{snapshot:string;focusHash:string;accessProof:string;draftRevision:number;settingsRevision:number|null;profileRevision:number|null}}
interface Receipt {action:string;fingerprint:string;result:Stored;before_values:unknown[]}
export function validateCorrection(v:unknown):CorrectionCommand{
 if(!object(v))invalid();const extra=v.operation==='settings'?['expectedRevision','fields']:v.operation==='reset'?['expectedRevision']:v.operation==='abandon'?['targetRequestId']:['draftId','expectedDraftRevision','snapshot','focus'];
 exactFields(v,['contractVersion','action','requestId','expectedAccountId','expectedAccessGeneration','expectedSessionContext','operation',...extra]);
 if(v.contractVersion!==1||v.action!=='correction'||!id(v.requestId)||!v.requestId.startsWith('c4b_')||!id(v.expectedAccountId)||!Number.isSafeInteger(v.expectedAccessGeneration)||Number(v.expectedAccessGeneration)<1||typeof v.expectedSessionContext!=='string'||!(/^[a-f0-9]{64}$/).test(v.expectedSessionContext))invalid();
 if(v.operation==='settings'){if(!revision(v.expectedRevision)||!object(v.fields)||!settingsValue(v.fields))invalid('Bitte Modellkennung und Granularität prüfen.');exactFields(v.fields,['model','granularity']);}
 else if(v.operation==='reset'){if(!revision(v.expectedRevision))invalid();}
 else if(v.operation==='abandon'){if(!id(v.targetRequestId)||v.targetRequestId===v.requestId)invalid();}
 else if(v.operation==='run'){
  if(!id(v.draftId)||!Number.isSafeInteger(v.expectedDraftRevision)||Number(v.expectedDraftRevision)<1||typeof v.snapshot!=='string'||!(/^[a-f0-9]{64}$/).test(v.snapshot)||!object(v.focus))invalid();const f=v.focus;
  const n=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0;
  if(f.mode==='gesamt')exactFields(f,['mode']);else if(f.mode==='manuell'){exactFields(f,['mode','start','end']);if(!n(f.start)||!n(f.end)||Number(f.start)>=Number(f.end))invalid();}else if(['wort','satz','absatz'].includes(String(f.mode))){exactFields(f,['mode','caret']);if(!n(f.caret))invalid();}else invalid();
 }else invalid();return v as unknown as CorrectionCommand;
}
export class CorrectionService{
 constructor(readonly auth:AccountService,readonly credentials:AiCredentialService,private readonly faults:{complete?:(m:AiMessage[],o:ChatCompletionOptions)=>Promise<string>;beforeWrite?:(index:number)=>void;beforeCommit?:()=>void}={}){}
 private check(a:LearningAccount,cmd:CorrectionCommand){if(a.userId!==cmd.expectedAccountId||a.sessionContext!==cmd.expectedSessionContext||a.accessGeneration!==cmd.expectedAccessGeneration)throw new AccountError('account_changed','Die Anmeldung hat sich geändert. Bitte neu prüfen.',409);}
 private async receipt(c:PoolClient,owner:string,requestId:string,forStatus=false){const row=(await c.query<Receipt>('SELECT action,fingerprint,result,before_values FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2',[owner,requestId])).rows[0];if(row&&row.action!=='correction'){if(forStatus)throw new AccountError('not_found','Korrekturvorgang nicht gefunden.',404);conflict('Diese Vorgangskennung gehört zu einer anderen Lernaktion.');}return row;}
 private publicResult(r:Stored,a:LearningAccount):CorrectionResult{const {sourceProof,...v}=r;return {...v,account:a,...(sourceProof?{sourceDraftRevision:sourceProof.draftRevision}:{}),sessionCurrent:r.account.sessionContext===a.sessionContext&&r.account.accessGeneration===a.accessGeneration,replay:true};}
 private async accessProof(c:PoolClient,owner:string){return digest((await c.query('SELECT s.selected_source,s.revision AS selection_revision,k.credential_id,k.revision AS credential_revision,k.configured FROM stex.ai_credential_selections s LEFT JOIN stex.ai_credentials k ON k.owner_user_id=s.owner_user_id AND k.source=s.selected_source WHERE s.owner_user_id=$1',[owner])).rows);}
 private expectedAccess(v:AiCredentialAccess){return digest([{selected_source:v.source,selection_revision:v.selectionRevision,credential_id:v.credentialId,credential_revision:v.credentialRevision,configured:true}]);}
 async read(headers:Headers,draftId?:string):Promise<CorrectionView>{
  if(draftId!==undefined&&!id(draftId))invalid();const who=await this.auth.principal(headers);
  return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));const s=await correctionRows(c,a.userId,draftId),v=resolveCorrection(s);
   const recent=(await c.query<{result:Stored}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND action='correction' ORDER BY created_at DESC,request_id DESC LIMIT 20",[a.userId])).rows.map(r=>this.publicResult(r.result,a));
   const deleted=s.draft?.normalized.c4aDeleted===true;
   return {contractVersion:1,account:a,settings:v.settings,settingsRevision:s.settings?.revision??null,settingsDefault:v.settingsDefault,legacyModelUpgraded:v.legacyModelUpgraded,profile:v.profile,profileRevision:s.profile?.revision??null,promptDefaults:v.prompts.every(p=>p.default),reasoningDefault:v.reasoningDefault,issues:v.issues,snapshot:v.issues.length||!s.draft||deleted?null:correctionSnapshot(s,a,v),draftId:s.draft?.id??null,draftRevision:s.draft?.revision??null,deleted,recent};
  });
 }
 async status(headers:Headers,requestId:string):Promise<CorrectionResult>{if(!id(requestId))invalid();const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true)),r=await this.receipt(c,a.userId,requestId,true);if(!r)throw new AccountError('not_found','Korrekturvorgang nicht gefunden.',404);return this.publicResult(r.result,a);});}
 private async refs(c:PoolClient,key:string){return (await c.query('SELECT * FROM stex.record_references WHERE source_key=$1 ORDER BY path',[key])).rows;}
 private async write(c:PoolClient,a:LearningAccount,kind:string,key:string,payload:Record<string,unknown>,old:CorrectionRow|undefined,index:number){
  this.faults.beforeWrite?.(index);const record=recordKey(kind,a.userId,key),references=await this.refs(c,record);
  const after=(await c.query<CorrectionRow>(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,$3,$4,1,$5,$6::jsonb,$7::jsonb) ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,revision=personal_records.revision+1 WHERE personal_records.revision=$8 RETURNING kind,id,revision,payload,normalized,legacy_key`,[record,a.userId,kind,key,old?.legacy_key??(kind==='draft'?'lerntracker-klausur-drafts':key),JSON.stringify(payload),JSON.stringify(old?.normalized??{}),old?.revision??null])).rows[0];if(!after)conflict();
  return {before:old??null,after,beforeReferences:references,afterReferences:references};
 }
 private async insert(c:PoolClient,a:LearningAccount,cmd:CorrectionCommand,fingerprint:string,result:Stored,before:unknown[]){await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,'correction',$3,$4::jsonb,$5::jsonb)",[a.userId,cmd.requestId,fingerprint,JSON.stringify(before),JSON.stringify(result)]);}
 async submit(headers:Headers,input:unknown,signal?:AbortSignal):Promise<CorrectionResult>{
  const cmd=validateCorrection(input),who=await this.auth.principal(headers),fingerprint=digest({...cmd,expectedSessionContext:undefined,expectedAccessGeneration:undefined});this.check(account(who),cmd);
  const initial=await this.auth.database.transaction(async c=>{await lockState(c);const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.check(a,cmd);const prior=await this.receipt(c,a.userId,cmd.requestId);if(prior){if(prior.fingerprint!==fingerprint)conflict('Diese Vorgangskennung gehört zu einem anderen Auftrag.');return this.publicResult(prior.result,a);}
   const stamp=new Date().toISOString(),result:Stored={contractVersion:1,action:'correction',account:a,requestId:cmd.requestId,operation:cmd.operation,state:'applied',createdAt:stamp,message:'Änderung bestätigt.',replay:false};const before:unknown[]=[];
   if(cmd.operation==='settings'||cmd.operation==='reset'){
    const s=await correctionRows(c,a.userId);const old=cmd.operation==='settings'?s.settings:s.profile;if((old?.revision??null)!==cmd.expectedRevision)conflict('Einstellungen oder Fehlerprofil wurden inzwischen geändert.');if(old&&!object(old.payload))conflict('Der vorhandene Originaldatensatz braucht zuerst Klärung.');
    const kind=cmd.operation==='settings'?'correction-settings':'error-profile',key=cmd.operation==='settings'?CORRECTION_SETTINGS_ID:ERROR_PROFILE_ID;
    const payload={...old?.payload,...(cmd.operation==='settings'?cmd.fields:{markers:{},updatedAt:stamp})};const change=await this.write(c,a,kind,key,payload,old,0);before.push(change);if(cmd.operation==='settings')result.settingsRevision=change.after.revision;else result.profileRevision=change.after.revision;result.message=cmd.operation==='settings'?'Korrektureinstellungen bestätigt.':'Fehlerprofil ausdrücklich zurückgesetzt. Feedback bleibt erhalten.';
   }else if(cmd.operation==='abandon'){
    const target=await this.receipt(c,a.userId,cmd.targetRequestId);if(!target||target.result.operation!=='run')throw new AccountError('not_found','Offene Korrektur nicht gefunden.',404);
    if(target.result.state==='pending'){const after={...target.result,state:'failed',errorCode:'abandoned',message:'Offener Vorgang ausdrücklich beendet. Ein neuer kostenrelevanter Versuch muss gesondert gestartet werden.'};await c.query("UPDATE stex.learning_commands SET result=$3::jsonb WHERE owner_user_id=$1 AND request_id=$2 AND action='correction'",[a.userId,cmd.targetRequestId,JSON.stringify(after)]);before.push({before:target.result,after});}
    result.targetRequestId=cmd.targetRequestId;result.message='Vorgangsabschluss geprüft. Keine weitere Anbieteranfrage ausgelöst.';
   }else return null;
   await this.insert(c,a,cmd,fingerprint,result,before);await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');this.faults.beforeCommit?.();return {...result,replay:false};
  });
  if(initial)return initial;if(cmd.operation!=='run')throw Error('unreachable');
  const access=await this.credentials.resolveSelected(headers);this.check(account(access),cmd);
  const prepared=await this.auth.database.transaction(async c=>{
   await lockState(c);const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.check(a,cmd);const prior=await this.receipt(c,a.userId,cmd.requestId);if(prior){if(prior.fingerprint!==fingerprint)conflict('Diese Vorgangskennung gehört zu einem anderen Auftrag.');return {replay:this.publicResult(prior.result,a)};}
   if((await c.query("SELECT 1 FROM stex.learning_commands WHERE owner_user_id=$1 AND action='correction' AND result->>'state'='pending' LIMIT 1",[a.userId])).rowCount)conflict('Eine Korrektur ist noch offen. Bitte deren Status prüfen oder den Vorgang ausdrücklich beenden.');
   const s=await correctionRows(c,a.userId,cmd.draftId),v=resolveCorrection(s);if(s.draft?.revision!==cmd.expectedDraftRevision||correctionSnapshot(s,a,v)!==cmd.snapshot)conflict();const built=correctionMessages(s,v,cmd.focus),proof=await this.accessProof(c,a.userId);if(proof!==this.expectedAccess(access))conflict('Der ausgewählte KI-Zugang hat sich geändert.');
   const pending:Stored={contractVersion:1,action:'correction',account:a,requestId:cmd.requestId,operation:'run',state:'pending',createdAt:new Date().toISOString(),message:'Korrektur noch nicht bestätigt. Status prüfen; kein automatischer Neuaufruf.',draftId:cmd.draftId,draftRevision:s.draft.revision,replay:false,sourceProof:{snapshot:cmd.snapshot,focusHash:digest([cmd.focus,built.focus]),accessProof:proof,draftRevision:s.draft.revision,settingsRevision:s.settings?.revision??null,profileRevision:s.profile?.revision??null}};
   await this.insert(c,a,cmd,fingerprint,pending,[]);return {s,v,built,pending};
  });
  if('replay' in prepared)return prepared.replay!;
  const {v,built,pending}=prepared;
  try{
   await this.credentials.assertAccessCurrent(access);
   const modelInfo=getKorrekturModel(v.settings.model),opts:ChatCompletionOptions={apiKey:access.apiKey,credentialSource:access.source,model:v.settings.model,reasoningPreference:v.reasoning,maxTokens:modelInfo?.maxTokens??(built.focus.scope==='gesamt'?8192:4096),temperature:0.3,purpose:'general',signal:AbortSignal.any([AbortSignal.timeout(115000),...(signal?[signal]:[])])};
   const reply=await (this.faults.complete?this.faults.complete(built.messages,opts):chatCompletion(built.messages,'strong',opts));let parsed:ReturnType<typeof parseCorrectionReply>;try{parsed=parseCorrectionReply(reply);}catch(e){invalid(e instanceof Error?e.message:'Ungültige Korrekturantwort.');}
   await this.credentials.assertAccessCurrent(access);
   return await this.auth.database.transaction(async c=>{
    await lockState(c);const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.check(a,cmd);const receipt=await this.receipt(c,a.userId,cmd.requestId);if(receipt?.result.state!=='pending')conflict('Der offene Korrekturvorgang wurde inzwischen beendet.');
    const fresh=await correctionRows(c,a.userId,cmd.draftId),resolved=resolveCorrection(fresh);if(correctionSnapshot(fresh,a,resolved)!==cmd.snapshot||await this.accessProof(c,a.userId)!==pending.sourceProof!.accessProof)conflict();
    const stamp=new Date().toISOString(),feedback={id:`c4b_fb_${digest([a.userId,cmd.requestId]).slice(0,48)}`,scope:built.focus.scope,excerpt:built.focus.focus.slice(0,280),feedbackText:parsed.prosa,markers:parsed.markers,model:v.settings.model,createdAt:stamp};
    const p=fresh.draft!.payload;if(!Array.isArray(p.feedback)||p.feedback.length>=500)conflict('Der vorhandene Feedbackverlauf braucht Klärung oder ist zu groß.');
    let profile;try{profile=mergeCorrectionMarkers(resolved.profile,parsed.markers,typeof p.type==='string'?p.type:undefined,stamp);}catch(e){invalid(e instanceof Error?e.message:'Ungültiges Fehlerprofil.');}
    const changes=[await this.write(c,a,'draft',cmd.draftId,{...p,feedback:[feedback,...p.feedback],updatedAt:stamp},fresh.draft,0),await this.write(c,a,'error-profile',ERROR_PROFILE_ID,profile as unknown as Record<string,unknown>,fresh.profile,1)];
    const result:Stored={...pending,state:'applied',message:'Feedback und Fehlerprofil gemeinsam bestätigt.',feedback,draftRevision:changes[0].after.revision,profileRevision:changes[1].after.revision};
    await c.query("UPDATE stex.learning_commands SET result=$3::jsonb,before_values=$4::jsonb WHERE owner_user_id=$1 AND request_id=$2 AND action='correction'",[a.userId,cmd.requestId,JSON.stringify(result),JSON.stringify(changes)]);await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');this.faults.beforeCommit?.();return {...this.publicResult(result,a),replay:false};
   });
  }catch(error){
   const code=error instanceof AccountError||error instanceof AiProviderError?error.code:'provider_uncertain',message=error instanceof AccountError||error instanceof AiProviderError?error.message:'Die Korrektur ist nicht bestätigt. Bitte zuerst Status prüfen; kein automatischer Neuaufruf.';
   await this.auth.database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.learning_commands SET result=$3::jsonb WHERE owner_user_id=$1 AND request_id=$2 AND action='correction' AND result->>'state'='pending'",[who.userId,cmd.requestId,JSON.stringify({...pending,state:'failed',errorCode:code,message})]);});
   if(error instanceof AccountError)throw error;throw new AccountError(code,message,error instanceof AiProviderError?error.status:502);
  }
 }
}
