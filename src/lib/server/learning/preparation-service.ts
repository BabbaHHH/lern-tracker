import type {PoolClient} from 'pg';
import type {AccountService} from '../auth/service';
import {AccountError,exactFields} from '../auth/security';
import {lockState} from '../persistence/repository';
import {digest,recordKey,canonical} from '../../data-migration/migration';
import {localDate,isDateOnly} from '../../dates';
import {planningEnd} from '../../learning-planner';
import {readPlanningState,type ReferenceRow} from './plan-service';
import {live,object,invalid,conflict,planSettings,type PlanRow} from './plan-calculation';
import {calculatePreparation,preparationBacklog,type PreparationState} from './preparation-calculation';
import type {DailyTask} from '../../store';
import type {LearningAccount} from '../../learning/progress-contract';
import type {PreparationInput,PreparationCommand,PreparationView,PreparationPreview,PreparationResult} from '../../learning/preparation-contract';

const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const context=(p:{userId:string;generation:number;sessionId:string}):LearningAccount=>({userId:p.userId,accessGeneration:p.generation,sessionContext:digest(['learning-session',p.sessionId])});
export function validatePreparation(value:unknown,write=false):PreparationInput|PreparationCommand{
 if(!object(value))invalid('Ungültige Tagesvorbereitung.');
 exactFields(value,['contractVersion','expectedAccountId','expectedAccessGeneration','expectedSessionContext','dates','snapshot',...(write?['action','requestId']:[])]);
 if(value.contractVersion!==1||!id(value.expectedAccountId)||!Number.isSafeInteger(value.expectedAccessGeneration)||Number(value.expectedAccessGeneration)<1||typeof value.expectedSessionContext!=='string'||!/^[a-f0-9]{64}$/.test(value.expectedSessionContext)||typeof value.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(value.snapshot))invalid('Bitte den bestätigten Kontostand erneut öffnen.');
 if(!Array.isArray(value.dates)||!value.dates.length||value.dates.length>7||value.dates.some(d=>typeof d!=='string'||!isDateOnly(d))||new Set(value.dates).size!==value.dates.length)invalid('Bitte ein bis sieben unterschiedliche gültige Tage auswählen.');
 if(write&&(value.action!=='preparation'||!id(value.requestId)||!value.requestId.startsWith('c3b2a_')))invalid('Ungültiger Vorbereitungsvorgang.');
 return {...value,dates:[...value.dates].sort()} as unknown as PreparationInput|PreparationCommand;
}
interface Receipt {before:PlanRow|null;after:PlanRow;beforeReferences:ReferenceRow[];afterReferences:ReferenceRow[]}
export class PreparationService {
 constructor(readonly auth:AccountService,private faults:{today?:()=>string;beforeTransaction?:()=>Promise<void>;beforeWrite?:(i:number)=>void;beforeCommit?:()=>void}={}){}
 private today(){return this.faults.today?.()??localDate();}
 private async state(c:PoolClient,owner:string):Promise<PreparationState>{
  const s=await readPlanningState(c,owner,this.today());
  const learningStart=(await c.query<PlanRow>(`SELECT kind,id,revision,payload,normalized,legacy_key AS "legacyKey" FROM stex.personal_records WHERE owner_user_id=$1 AND kind='learning-start' ORDER BY id`,[owner])).rows;
  s.rows=[...s.rows,...learningStart];
  const derivedRows=(await c.query<{row:PlanRow}>(`SELECT DISTINCT ON(value->'after'->>'id') value->'after' AS row FROM stex.learning_commands cmd CROSS JOIN LATERAL jsonb_array_elements(cmd.before_values) item(value) WHERE cmd.owner_user_id=$1 AND cmd.action IN('plan','preparation') AND (cmd.action='preparation' OR cmd.result->'input'->'operation'->>'type'='apply') AND value->'after'->>'kind'='task' ORDER BY value->'after'->>'id',cmd.created_at DESC,cmd.request_id DESC`,[owner])).rows.map(r=>r.row);
  const created=derivedRows.filter(row=>s.rows.some(current=>current.kind==='task'&&current.id===row.id&&canonical(current)===canonical(row))).map(r=>r.id).sort();
  const touched=(await c.query<{id:string}>(`SELECT DISTINCT value->>'id' AS id FROM stex.learning_commands cmd CROSS JOIN LATERAL jsonb_array_elements(cmd.result->'changes') item(value) WHERE cmd.owner_user_id=$1 AND cmd.action='schedule' AND value->>'kind'='task' ORDER BY id`,[owner])).rows.map(r=>r.id);
  return {...s,protectedTaskIds:new Set([...s.protectedTaskIds,...touched]),derivedIds:new Set(created),proof:digest(['preparation-snapshot-c3b2a-v1',s.proof,learningStart,created,touched])};
 }
 private view(s:PreparationState,account:LearningAccount):PreparationView{
  const today=this.today();return {contractVersion:1,account,snapshot:s.proof,today,end:planningEnd(today,planSettings(s.rows)),backlog:preparationBacklog(s.rows.filter(r=>r.kind==='task'&&live(r)).map(r=>r.payload as DailyTask),s,account.userId,today)};
 }
 private check(a:LearningAccount,input:PreparationInput){if(a.userId!==input.expectedAccountId||a.accessGeneration!==input.expectedAccessGeneration||a.sessionContext!==input.expectedSessionContext)throw new AccountError('account_changed','Die Anmeldung hat sich geändert. Bitte neu laden.',409);}
 async read(headers:Headers):Promise<PreparationView>{
  const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));return this.view(await this.state(c,a.userId),a);});
 }
 async preview(headers:Headers,value:unknown):Promise<PreparationPreview>{
  const input=validatePreparation(value),who=await this.auth.principal(headers);
  return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.check(a,input);const s=await this.state(c,a.userId);if(input.snapshot!==s.proof)conflict();return {contractVersion:1,account:a,snapshot:s.proof,dates:input.dates,...calculatePreparation(s,a.userId,input.dates,this.today())};});
 }
 async status(headers:Headers,requestId:string):Promise<PreparationResult>{
  if(!id(requestId))invalid('Ungültiger Vorbereitungsvorgang.');const who=await this.auth.principal(headers);
  return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));const r=(await c.query<{result:PreparationResult}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2 AND action='preparation'",[a.userId,requestId])).rows[0];if(!r)throw new AccountError('not_found','Vorbereitung nicht gefunden.',404);return {...r.result,account:a,view:this.view(await this.state(c,a.userId),a),replay:true};});
 }
 async submit(headers:Headers,value:unknown):Promise<PreparationResult>{
  const input=validatePreparation(value,true) as PreparationCommand,who=await this.auth.principal(headers);await this.faults.beforeTransaction?.();
  return this.auth.database.transaction(async c=>{
   await lockState(c);const a=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));this.check(a,input);
   const {expectedAccessGeneration:g,expectedSessionContext:h,...semantic}=input;void g;void h;
   const fingerprint=digest(semantic),existing=(await c.query<{action:string;fingerprint:string;result:PreparationResult}>('SELECT action,fingerprint,result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2',[a.userId,input.requestId])).rows[0];
   if(existing){if(existing.action!=='preparation'||existing.fingerprint!==fingerprint)conflict('Diese Vorgangskennung gehört zu einer anderen Vorbereitung.');return {...existing.result,account:a,view:this.view(await this.state(c,a.userId),a),replay:true};}
   const s=await this.state(c,a.userId);if(input.snapshot!==s.proof)conflict();
   const calculation=calculatePreparation(s,a.userId,input.dates,this.today()),stamp=new Date().toISOString(),receipts:Receipt[]=[];
   for(const [i,change] of calculation.changes.entries()){
    this.faults.beforeWrite?.(i);
    if(!change.after||change.kind!=='task')throw Error('Preparation may only preserve/update task rows');
    const old=s.rows.find(r=>r.kind===change.kind&&r.id===change.id)??null;
    if(!change.before&&old)conflict('Eine abgeleitete Kennung ist bereits belegt. Bitte eine neue Vorschau öffnen.');
    const key=recordKey('task',a.userId,change.id),payload=old?change.after:{...change.after,createdAt:stamp};
    const row=(await c.query<PlanRow>(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,'task',$3,1,$4,$5::jsonb,$6::jsonb) ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,normalized=EXCLUDED.normalized,revision=personal_records.revision+1 WHERE personal_records.revision=$7 RETURNING kind,id,revision,payload,normalized,legacy_key AS "legacyKey"`,[key,a.userId,change.id,old?.legacyKey??'lerntracker-tasks',JSON.stringify(payload),JSON.stringify({...old?.normalized,c3aDeleted:false}),old?.revision??null])).rows[0];if(!row)conflict();
    const beforeReferences=s.references.filter(r=>r.source_key===key);
    // Existing reference rows are retained exactly; only new derived tasks need their known topics.
    if(!old){const task=payload as DailyTask;for(const field of ['linkedTopicId','linkedTopicIds'] as const){const value=task[field],ids=Array.isArray(value)?value:typeof value==='string'?[value]:[];for(const [n,topic] of ids.entries()){await c.query('INSERT INTO stex.topics(id) VALUES($1) ON CONFLICT DO NOTHING',[topic]);await c.query('INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_topic_id) VALUES($1,$2,$3,$1,$4)',[key,`value.${field}${Array.isArray(value)?`[${n}]`:''}`,a.userId,topic]);}}}
    const afterReferences=(await c.query<ReferenceRow>('SELECT * FROM stex.record_references WHERE source_key=$1 ORDER BY source_key,path',[key])).rows;
    receipts.push({before:old,after:row,beforeReferences,afterReferences});
   }
   const view=this.view(await this.state(c,a.userId),a),result:PreparationResult={contractVersion:1,action:'preparation',requestId:input.requestId,account:a,input,changes:receipts.map(r=>({kind:r.after.kind,id:r.after.id,revision:r.after.revision})),replay:false,view};
   await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,'preparation',$3,$4::jsonb,$5::jsonb)",[a.userId,input.requestId,fingerprint,JSON.stringify(receipts),JSON.stringify({...result,view:{...view,backlog:[]}})]);
   if(receipts.length)await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');
   this.faults.beforeCommit?.();return {...result,view:this.view(await this.state(c,a.userId),a)};
  });
 }
}
