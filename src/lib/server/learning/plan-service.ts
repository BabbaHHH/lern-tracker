import type {PoolClient} from 'pg';
import {incrementPlanMetric} from './settings-metrics';
import type {AccountService} from '../auth/service';
import {AccountError,exactFields} from '../auth/security';
import {lockState} from '../persistence/repository';
import {digest,recordKey,canonical} from '../../data-migration/migration';
import {localDate} from '../../dates';
import type {Klausur} from '../../types';
import type {LearningAccount} from '../../learning/progress-contract';
import type {PlanCommand,PlanView,PlanPreview,PlanResult,SavedPlan,PreviewCommand} from '../../learning/plan-contract';
import {calculatePlan,storedStructured,planKinds,live,object,invalid,conflict,type PlanRow} from './plan-calculation';
const RESULT_ID='lerntracker-onboarding-airesult',RANGE_ID='lerntracker-plan-applied-range';
const legacy:Record<string,string>={'plan-result':RESULT_ID,'plan-range':RANGE_ID,'plan-history':'lerntracker-plan-history',task:'lerntracker-tasks','calendar-event':'lerntracker-calendar'};
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const revision=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const accountContext=(p:{userId:string;generation:number;sessionId:string}):LearningAccount=>({userId:p.userId,accessGeneration:p.generation,sessionContext:digest(['learning-session',p.sessionId])});
function validateContext(v:Record<string,unknown>){if(v.contractVersion!==1||!id(v.expectedAccountId)||!revision(v.expectedAccessGeneration)||!hash(v.expectedSessionContext))invalid('Ungültiger Anmeldestand.');}
export function validatePlanCommand(value:unknown):PlanCommand{
 if(!object(value))invalid('Ungültiger Planauftrag.');exactFields(value,['contractVersion','action','requestId','expectedAccountId','expectedAccessGeneration','expectedSessionContext','operation']);validateContext(value);
 if(value.action!=='plan'||!id(value.requestId)||!value.requestId.startsWith('c3b1_')||!object(value.operation))invalid('Ungültiger Planauftrag.');
 const op=value.operation;
 if(op.type==='save'){exactFields(op,['type','reply','expectedResultRevision']);if(typeof op.reply!=='string'||!op.reply.trim()||op.reply.length>120000||(op.expectedResultRevision!==null&&!revision(op.expectedResultRevision)))invalid('Bitte einen begrenzten Plantext speichern.');}
 else if(op.type==='apply'){exactFields(op,['type','planId','planRevision','snapshot']);if(!id(op.planId)||!revision(op.planRevision)||!hash(op.snapshot))invalid('Bitte zuerst eine bestätigte Planvorschau öffnen.');}
 else if(op.type==='undo'){exactFields(op,['type','applyRequestId','snapshot']);if(!id(op.applyRequestId)||!hash(op.snapshot))invalid('Bitte einen bestätigten Verlaufseintrag wählen.');}
 else invalid('Nicht unterstützte Planaktion.');return value as unknown as PlanCommand;
}
export interface ReferenceRow {source_key:string;path:string;owner_user_id:string;source_personal_key:string|null;source_catalog_key:string|null;target_personal_key:string|null;target_catalog_key:string|null;target_topic_id:string|null}
export interface PlanningState {rows:PlanRow[];catalog:Klausur[];proof:string;references:ReferenceRow[];protectedTaskIds:Set<string>}
interface ChangeReceipt {before:PlanRow|null;after:PlanRow;beforeReferences:ReferenceRow[];afterReferences:ReferenceRow[]}
export async function readPlanningState(c:PoolClient,owner:string,today:string):Promise<PlanningState>{
  const rows=(await c.query<PlanRow>('SELECT kind,id,revision,payload,normalized,legacy_key AS "legacyKey" FROM stex.personal_records WHERE owner_user_id=$1 AND kind=ANY($2::text[]) ORDER BY kind,id',[owner,planKinds])).rows;
  const catalogRows=(await c.query<{kind:string;id:string;revision:number;payload:Klausur}>("SELECT kind,id,revision,payload FROM stex.catalog_records WHERE kind='klausur' ORDER BY id")).rows;
  const references=(await c.query<ReferenceRow>('SELECT * FROM stex.record_references WHERE owner_user_id=$1 ORDER BY source_key,path',[owner])).rows;
  const manualIds=(await c.query<{id:string}>("SELECT DISTINCT result->'input'->'operation'->>'id' AS id FROM stex.learning_commands WHERE owner_user_id=$1 AND action='schedule' AND result->'input'->'operation'->>'type'='task.save' ORDER BY id",[owner])).rows.map(r=>r.id).filter(v=>typeof v==='string');
  return {rows,catalog:catalogRows.map(r=>r.payload),references,protectedTaskIds:new Set(manualIds),proof:digest(['plan-snapshot-c3b1-v1',owner,today,rows,catalogRows,references,manualIds])};
 }
export class PlanService {
 constructor(readonly auth:AccountService,private faults:{beforeTransaction?:()=>Promise<void>;beforeWrite?:(i:number)=>void;beforeCommit?:()=>void;today?:()=>string}={}){}
 private today(){return this.faults.today?.()??localDate();}
 private async snapshot(c:PoolClient,owner:string):Promise<PlanningState>{return readPlanningState(c,owner,this.today());}
 private view(s:PlanningState,account:LearningAccount):PlanView{
  const histories=s.rows.filter(r=>r.kind==='plan-history'&&live(r));const result=s.rows.find(r=>r.kind==='plan-result'&&r.id===RESULT_ID);
  const history:SavedPlan[]=histories.map(r=>{const p=object(r.payload)?r.payload:{};const reply=typeof p.reply==='string'?p.reply:typeof p.result==='string'?p.result:'';return {id:r.id,revision:r.revision,reply,structured:storedStructured(reply)??(object(p.structured)?p.structured as unknown as SavedPlan['structured']:null),createdAt:typeof p.createdAt==='string'?p.createdAt:'',operation:['draft','apply','undo'].includes(String(p.operation))?p.operation as SavedPlan['operation']:'historical',...(typeof p.requestId==='string'?{requestId:p.requestId}:{}),...(typeof p.undoOf==='string'?{undoOf:p.undoOf}:{}),...(object(p.range)&&typeof p.range.start==='string'&&typeof p.range.end==='string'?{range:{start:p.range.start,end:p.range.end}}:{}),...(Array.isArray(p.warnings)?{warnings:p.warnings.filter((v):v is string=>typeof v==='string')}:{})};}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
  const p=object(result?.payload)?result.payload:{};const currentDraftId=typeof p.currentDraftId==='string'?p.currentDraftId:null;
  // Existing singleton drafts can be opened without manufacturing a persisted history entry.
  if(result&&live(result)&&!currentDraftId)history.unshift({id:result.id,revision:result.revision,reply:typeof p.result==='string'?p.result:typeof p.reply==='string'?p.reply:'',structured:object(p.structured)?p.structured as unknown as SavedPlan['structured']:null,createdAt:typeof p.createdAt==='string'?p.createdAt:'',operation:'historical'});
  return {contractVersion:1,account,resultRevision:result?.revision??null,currentDraftId:currentDraftId??(result&&live(result)?result.id:null),history:history.slice(0,100),historyTruncated:history.length>100,snapshot:s.proof};
 }
 private assertContext(a:LearningAccount,v:{expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string}){if(a.userId!==v.expectedAccountId||a.accessGeneration!==v.expectedAccessGeneration||a.sessionContext!==v.expectedSessionContext)throw new AccountError('account_changed','Die Anmeldung hat sich geändert. Bitte neu laden.',409);}
 async read(headers:Headers):Promise<PlanView>{const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=accountContext(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));return this.view(await this.snapshot(c,a.userId),a);});}
 async preview(headers:Headers,input:unknown):Promise<PlanPreview>{
  if(!object(input))invalid('Ungültige Planvorschau.');exactFields(input,['contractVersion','expectedAccountId','expectedAccessGeneration','expectedSessionContext','planId','planRevision','snapshot']);validateContext(input);if(!id(input.planId)||!revision(input.planRevision)||!hash(input.snapshot))invalid('Bitte einen gespeicherten Entwurf öffnen.');
  const command=input as unknown as PreviewCommand,who=await this.auth.principal(headers);
  return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=accountContext(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.assertContext(a,command);const s=await this.snapshot(c,a.userId);if(command.snapshot!==s.proof)conflict();const draft=this.draft(s,command.planId,command.planRevision);const calculated=calculatePlan(s.rows,s.catalog,draft,a.userId,s.proof,this.today(),s.protectedTaskIds);return {contractVersion:1,account:a,planId:draft.id,planRevision:draft.revision,snapshot:s.proof,range:{start:calculated.result.after.range!.start,end:calculated.result.after.range!.end},changes:calculated.changes,warnings:calculated.result.warnings,moved:calculated.result.moved,deferred:calculated.result.deferred,klausurenSkipped:calculated.result.klausurenSkipped};});
 }
 private draft(s:PlanningState,planId:string,expected:number){const row=s.rows.find(r=>(r.kind==='plan-history'||r.kind==='plan-result')&&r.id===planId&&live(r));if(!row||row.revision!==expected)conflict('Der gespeicherte Entwurf hat sich geändert. Bitte neu öffnen.');const p=object(row.payload)?row.payload:{};if(p.operation&&p.operation!=='draft')invalid('Bitte einen Entwurf aus dem Verlauf öffnen.');return row;}
 async status(headers:Headers,requestId:string):Promise<PlanResult>{if(!id(requestId))invalid('Ungültiger Vorgang.');const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=accountContext(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));const r=(await c.query<{result:PlanResult}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2 AND action='plan'",[a.userId,requestId])).rows[0];if(!r)throw new AccountError('not_found','Planaktion nicht gefunden.',404);return {...r.result,account:a,view:this.view(await this.snapshot(c,a.userId),a),replay:true};});}
 async submit(headers:Headers,input:unknown):Promise<PlanResult>{
  const command=validatePlanCommand(input),who=await this.auth.principal(headers);await this.faults.beforeTransaction?.();
  return this.auth.database.transaction(async c=>{
   await lockState(c);const a=accountContext(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.assertContext(a,command);
   const {expectedAccessGeneration:g,expectedSessionContext:h,...semantic}=command;void g;void h;const fingerprint=digest(semantic);
   const existing=(await c.query<{action:string;fingerprint:string;result:PlanResult}>('SELECT action,fingerprint,result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2',[a.userId,command.requestId])).rows[0];
   if(existing){if(existing.action!=='plan'||existing.fingerprint!==fingerprint)conflict('Diese Vorgangskennung gehört zu einem anderen Planauftrag.');return {...existing.result,account:a,view:this.view(await this.snapshot(c,a.userId),a),replay:true};}
   const s=await this.snapshot(c,a.userId),op=command.operation,stamp=new Date().toISOString(),changes:ChangeReceipt[]=[];let writeIndex=0;
   const refs=(row:PlanRow)=>s.references.filter(r=>r.source_key===recordKey(row.kind,a.userId,row.id));
   const put=async(kind:string,rowId:string,payload:unknown,deleted=false)=>{
    const old=s.rows.find(r=>r.kind===kind&&r.id===rowId)??null;this.faults.beforeWrite?.(writeIndex++);
    const storedPayload=kind==='task'&&!old&&object(payload)?{...payload,createdAt:stamp}:payload;
    const normalized={...old?.normalized,c3aDeleted:deleted},key=recordKey(kind,a.userId,rowId);
    const row=(await c.query<PlanRow>(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,$3,$4,1,$5,$6::jsonb,$7::jsonb) ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,normalized=EXCLUDED.normalized,revision=personal_records.revision+1 WHERE personal_records.revision=$8 RETURNING kind,id,revision,payload,normalized,legacy_key AS "legacyKey"`,[key,a.userId,kind,rowId,old?.legacyKey??legacy[kind],JSON.stringify(storedPayload),JSON.stringify(normalized),old?.revision??null])).rows[0];
    if(!row)conflict();changes.push({before:old,after:row,beforeReferences:old?refs(old):[],afterReferences:[]});return row;
   };
   const historyId=`c3b1_history_${digest([a.userId,command.requestId]).slice(0,40)}`;
   if(op.type==='save'){
    const old=s.rows.find(r=>r.kind==='plan-result'&&r.id===RESULT_ID);if((old?.revision??null)!==op.expectedResultRevision)conflict('Der gespeicherte Entwurf wurde inzwischen geändert. Bitte neu laden.');
    const structured=storedStructured(op.reply),oldPayload=object(old?.payload)?old.payload:{};
    await put('plan-history',historyId,{id:historyId,createdAt:stamp,reply:op.reply,structured,operation:'draft',requestId:command.requestId,...(old?{priorResult:old.payload}:{})});
    await put('plan-result',RESULT_ID,{...oldPayload,result:op.reply,structured,currentDraftId:historyId,createdAt:stamp});
   }else if(op.type==='apply'){
    if(op.snapshot!==s.proof)conflict();const draft=this.draft(s,op.planId,op.planRevision),calculated=calculatePlan(s.rows,s.catalog,draft,a.userId,s.proof,this.today(),s.protectedTaskIds);
    for(const change of calculated.changes){const old=s.rows.find(r=>r.kind===change.kind&&r.id===change.id);if(!change.before&&old)conflict('Eine neue Plankennung ist bereits belegt. Bitte neue Vorschau öffnen.');await put(change.kind,change.id,change.after??change.before,change.after===null);}
    const oldRange=s.rows.find(r=>r.kind==='plan-range'&&r.id===RANGE_ID);await put('plan-range',RANGE_ID,{...(object(oldRange?.payload)?oldRange.payload:{}),...calculated.result.after.range,appliedAt:stamp});
    const p=object(draft.payload)?draft.payload:{};await put('plan-history',historyId,{id:historyId,createdAt:stamp,reply:p.reply??p.result??'',structured:storedStructured(String(p.reply??p.result??''))??p.structured,operation:'apply',requestId:command.requestId,planId:draft.id,range:{...calculated.result.after.range,appliedAt:stamp},warnings:calculated.result.warnings});
   }else{
    if(op.snapshot!==s.proof)conflict();const applied=(await c.query<{result:PlanResult;before_values:ChangeReceipt[]}>("SELECT result,before_values FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2 AND action='plan'",[a.userId,op.applyRequestId])).rows[0];
    if(!applied||applied.result.input.operation.type!=='apply')invalid('Nur eine bestätigte eigene Planübernahme kann zurückgenommen werden.');
    const undone=await c.query("SELECT 1 FROM stex.learning_commands WHERE owner_user_id=$1 AND action='plan' AND result->'input'->'operation'->>'type'='undo' AND result->'input'->'operation'->>'applyRequestId'=$2",[a.userId,op.applyRequestId]);if(undone.rowCount)conflict('Diese Planübernahme wurde bereits zurückgenommen.');
    for(const change of applied.before_values.filter(v=>!['plan-history','ai-metrics'].includes(v.after.kind))){
     const row=s.rows.find(r=>r.kind===change.after.kind&&r.id===change.after.id);if(!row||canonical(row)!==canonical(change.after)||canonical(refs(row))!==canonical(change.afterReferences))conflict('Betroffene Aufgaben oder Termine wurden seit der Übernahme bearbeitet. Eine Rücknahme würde sie überschreiben.');
     await put(row.kind,row.id,change.before?.payload??row.payload,change.before?change.before.normalized.c3aDeleted===true:true);
    }
    await put('plan-history',historyId,{id:historyId,createdAt:stamp,reply:'Planübernahme zurückgenommen',structured:null,operation:'undo',requestId:command.requestId,undoOf:op.applyRequestId});
   }
   if(op.type==='apply'||op.type==='undo'){this.faults.beforeWrite?.(writeIndex++);changes.push(await incrementPlanMetric(c,a.userId,op.type==='apply'?'plansApplied':'plansUndone'));}
   // All target rows exist before references are installed. Preserve unknown source references.
   for(const change of changes){if(live(change.after)&&['task','calendar-event'].includes(change.after.kind))await this.references(c,a.userId,change.after);change.afterReferences=(await c.query<ReferenceRow>('SELECT * FROM stex.record_references WHERE source_key=$1 ORDER BY source_key,path',[recordKey(change.after.kind,a.userId,change.after.id)])).rows;}
   for(const change of changes)if(!live(change.after)){const incoming=await c.query("SELECT 1 FROM stex.record_references r JOIN stex.personal_records p ON p.record_key=r.source_personal_key WHERE r.target_personal_key=$1 AND coalesce(p.normalized->>'c3aDeleted','false')<>'true' LIMIT 1",[recordKey(change.after.kind,a.userId,change.after.id)]);if(incoming.rowCount)conflict('Ein betroffener Termin oder eine Aufgabe wird noch verwendet. Bitte zuerst die Zuordnung klären.');}
   const view=this.view(await this.snapshot(c,a.userId),a),result:PlanResult={contractVersion:1,action:'plan',requestId:command.requestId,account:a,input:command,view,replay:false,changes:changes.map(v=>({kind:v.after.kind,id:v.after.id,revision:v.after.revision}))};
   // The semantic input and exact affected rows are complete; unrelated history texts need no duplicate receipt copy.
   const receipt={...result,view:{...view,history:[]}};
   await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,'plan',$3,$4::jsonb,$5::jsonb)",[a.userId,command.requestId,fingerprint,JSON.stringify(changes),JSON.stringify(receipt)]);await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');this.faults.beforeCommit?.();return result;
  });
 }
 private async references(c:PoolClient,owner:string,row:PlanRow){
  const p=object(row.payload)?row.payload:{},key=recordKey(row.kind,owner,row.id);
  await c.query("DELETE FROM stex.record_references WHERE source_key=$1 AND (path ~ '^value\\.(topicIds|linkedTopicIds)' OR path IN('value.topicId','value.linkedTopicId','value.klausurId','value.linkedKlausurId','value.calendarEventId','value.trackingEntryId'))",[key]);
  for(const field of ['topicId','linkedTopicId','linkedTopicIds','topicIds']){const ids=Array.isArray(p[field])?p[field] as string[]:typeof p[field]==='string'?[p[field] as string]:[];for(const [i,topic] of ids.entries()){await c.query('INSERT INTO stex.topics(id) VALUES($1) ON CONFLICT DO NOTHING',[topic]);await c.query('INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_topic_id) VALUES($1,$2,$3,$1,$4)',[key,`value.${field}${Array.isArray(p[field])?`[${i}]`:''}`,owner,topic]);}}
  for(const field of ['linkedKlausurId','klausurId'])if(typeof p[field]==='string')await c.query('INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_catalog_key) VALUES($1,$2,$3,$1,$4)',[key,`value.${field}`,owner,recordKey('klausur',null,p[field] as string)]);
  for(const [field,kind] of [['calendarEventId','calendar-event'],['trackingEntryId','tracking-entry']])if(typeof p[field]==='string')await c.query('INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_personal_key) VALUES($1,$2,$3,$1,$4)',[key,`value.${field}`,owner,recordKey(kind,owner,p[field] as string)]);
 }
}
