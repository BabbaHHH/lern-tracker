import { profileBudgetProjection } from '../../learning/profile-fields';
import type { PoolClient } from 'pg';
import { pdfViewerURL } from '../../pdf-viewer/contract';
import { TOPICS,getLeafTopics } from '../../topics';
import { isDateOnly,localDate } from '../../dates';
import { isFixedTask,isSketchTask } from '../../day-budget';
import { calculateKlausurDelta,type DailyTask } from '../../store';
import type { CalendarEvent,TrackingEntry,Klausur } from '../../types';
import { digest,recordKey } from '../../data-migration/migration';
import type { ScheduleCommand,ScheduleView,ScheduleRecord,ScheduleKind,ScheduleResult,ScheduleOperation } from '../../learning/schedule-contract';
import type { LearningAccount } from '../../learning/progress-contract';
import { PersonalService } from './personal-service';
import type { AccountService } from '../auth/service';
import { AccountError,exactFields } from '../auth/security';
import { lockState } from '../persistence/repository';
const kinds:ScheduleKind[]=['task','calendar-event','tracking-entry','ag-week','progress'];
const legacy:Record<ScheduleKind,string>={task:'lerntracker-tasks','calendar-event':'lerntracker-calendar','tracking-entry':'lerntracker-tracking','ag-week':'lerntracker-ag-weeks',progress:'lerntracker-progress'};
const leaves=new Set(getLeafTopics(TOPICS).map(t=>t.id));
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const context=(p:{userId:string;generation:number;sessionId:string}):LearningAccount=>({userId:p.userId,accessGeneration:p.generation,sessionContext:digest(['learning-session',p.sessionId])});
function invalid(message='Ungültige Lernaktion.'):never{throw new AccountError('invalid_input',message);}
function conflict(message='Der gespeicherte Stand wurde inzwischen geändert. Bitte neu laden.'):never{throw new AccountError('conflict',message,409);}
const opFields:Record<ScheduleOperation['type'],string[]>={
 'task.save':['id','date','title','durationMinutes','topicIds','klausurId','isReview'],'task.complete':['id','trackingId','durationMinutes','recallRating'],'task.uncomplete':['id'],'task.delete':['id'],
 'event.save':['id','date','label','eventType','recurring','recurringDay','durationMinutes'],'event.delete':['id'],'event.link':['id','klausurId','taskId'],
 'tracking.save':['id','date','activityType','topicIds','durationMinutes','rating','recallRating','note'],'tracking.delete':['id'],
 'ag.save':['id','agDays'],'ag.clear':['id'],'exam.record':['taskId','trackingId','date','klausurId','klausurMode','topicIds','durationMinutes','rating','note']};
export function validateScheduleCommand(v:unknown):ScheduleCommand{
 if(!object(v))invalid();exactFields(v,['contractVersion','action','requestId','expectedAccountId','expectedAccessGeneration','expectedSessionContext','operation','expected']);
 if(v.contractVersion!==1||v.action!=='schedule'||!validId(v.requestId)||!v.requestId.startsWith('c3a_')||typeof v.expectedAccountId!=='string'||!v.expectedAccountId||!Number.isSafeInteger(v.expectedAccessGeneration)||Number(v.expectedAccessGeneration)<1||typeof v.expectedSessionContext!=='string'||!/^[a-f0-9]{64}$/.test(v.expectedSessionContext))invalid('Konto- und Vorgangsstand fehlen.');
 if(!object(v.operation)||!Object.hasOwn(opFields,String(v.operation.type)))invalid();const op=v.operation;exactFields(op,['type',...opFields[op.type as ScheduleOperation['type']]]);
 for(const name of ['id','taskId','trackingId','klausurId'])if(op[name]!==undefined&&!validId(op[name]))invalid('Ungültige Kennung.');
 if(op.type!=='exam.record'&&!validId(op.id))invalid('Kennung fehlt.');if(op.type==='exam.record'&&(!validId(op.taskId)||!validId(op.trackingId)||!validId(op.klausurId)))invalid('Klausurbezug fehlt.');
 if(op.type==='task.complete'&&!validId(op.trackingId))invalid('Trackingkennung fehlt.');if(op.type==='event.link'&&(!validId(op.klausurId)||!validId(op.taskId)))invalid('Klausurbezug fehlt.');
 if(['task.save','event.save','tracking.save','exam.record'].includes(String(op.type))&&(!isDateOnly(String(op.date))||((op.type==='tracking.save'||op.type==='exam.record')&&String(op.date)>localDate())))invalid('Bitte ein gültiges Datum angeben; Bearbeitung höchstens bis heute.');
 for(const name of ['title','label'])if((op.type==='task.save'&&name==='title')||(op.type==='event.save'&&name==='label')){if(typeof op[name]!=='string'||!String(op[name]).trim()||String(op[name]).length>300)invalid('Bezeichnung fehlt oder ist zu lang.');}
 if(op.durationMinutes!==undefined&&(!Number.isInteger(op.durationMinutes)||Number(op.durationMinutes)<1||Number(op.durationMinutes)>1440))invalid('Dauer muss zwischen 1 und 1440 Minuten liegen.');
 if(['task.complete','tracking.save','exam.record'].includes(String(op.type))&&op.durationMinutes===undefined)invalid('Tatsächliche Dauer fehlt.');
 if(op.rating!==undefined&&(!Number.isInteger(op.rating)||Number(op.rating)<1||Number(op.rating)>5))invalid('Bewertung muss zwischen 1 und 5 liegen.');
 if(op.type==='exam.record'&&(op.rating===undefined||!['written','read'].includes(String(op.klausurMode))))invalid('Bearbeitungsmodus und Bewertung fehlen.');
 if(op.recallRating!==undefined&&!['again','hard','good','easy'].includes(String(op.recallRating)))invalid('Ungültige Abrufbewertung.');
 if(['tracking.save','exam.record'].includes(String(op.type))&&(typeof op.note!=='string'||op.note.length>10000))invalid('Ungültige Lernnotiz.');
 if(['task.save','tracking.save','exam.record'].includes(String(op.type))&&(!Array.isArray(op.topicIds)||op.topicIds.length>leaves.size||op.topicIds.some(t=>typeof t!=='string'||!leaves.has(t))||new Set(op.topicIds).size!==op.topicIds.length))invalid('Ungültige Themenauswahl.');
 if(op.type==='task.save'&&typeof op.isReview!=='boolean')invalid();
 if(op.type==='tracking.save'&&!['theorie','wiederholung','karteikarten','ag','rep'].includes(String(op.activityType)))invalid('Klausuren bitte als geschrieben/gelesen eintragen.');
 if(op.type==='event.save'&&(!['ag','rep','kaiser','probeexamen','urlaub','frei','sport','klausur'].includes(String(op.eventType))||typeof op.recurring!=='boolean'||(op.recurring&&(!Number.isInteger(op.recurringDay)||Number(op.recurringDay)<0||Number(op.recurringDay)>6))||(!op.recurring&&op.recurringDay!==undefined)))invalid('Ungültiger Termin oder Wochentag.');
 if(String(op.type).startsWith('ag.')){if(!/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(String(op.id)))invalid('Ungültige Kalenderwoche.');const [year,week]=String(op.id).split('-W');const jan4=new Date(Date.UTC(Number(year),0,4)),monday=new Date(jan4);monday.setUTCDate(jan4.getUTCDate()-(jan4.getUTCDay()||7)+1+(Number(week)-1)*7);const thursday=new Date(monday);thursday.setUTCDate(monday.getUTCDate()+3);if(thursday.getUTCFullYear()!==Number(year))invalid('Diese Kalenderwoche existiert nicht.');if(op.type==='ag.save'&&(!Array.isArray(op.agDays)||op.agDays.some(d=>!Number.isInteger(d)||Number(d)<0||Number(d)>6)||new Set(op.agDays).size!==op.agDays.length))invalid('Ungültige AG-Tage.');}
 if(!Array.isArray(v.expected)||!v.expected.length||v.expected.length>leaves.size+10)invalid('Erwartete Revisionen fehlen.');const seen=new Set<string>();
 for(const r of v.expected){if(!object(r))invalid();exactFields(r,['kind','id','revision']);if(!kinds.includes(r.kind as ScheduleKind)||!validId(r.id)||(r.revision!==null&&(!Number.isSafeInteger(r.revision)||Number(r.revision)<1))||seen.has(`${r.kind}|${r.id}`))invalid('Ungültige Revisionsauswahl.');seen.add(`${r.kind}|${r.id}`);}
 return v as unknown as ScheduleCommand;
}
interface Row {kind:ScheduleKind;id:string;revision:number;payload:Record<string,unknown>;normalized:Record<string,unknown>}
export class ScheduleService{
 constructor(readonly auth:AccountService,private readonly faults:{beforeTransaction?:()=>Promise<void>;beforeWrite?:(index:number)=>void;beforeCommit?:()=>void}={}){}
 private async view(c:PoolClient,account:LearningAccount):Promise<ScheduleView>{
  const rows=(await c.query<Row>('SELECT kind,id,revision,payload,normalized FROM stex.personal_records WHERE owner_user_id=$1 AND kind=ANY($2::text[]) ORDER BY kind,id',[account.userId,kinds])).rows;
  const profile=(await c.query<{payload:Record<string,unknown>}>("SELECT payload FROM stex.personal_records WHERE owner_user_id=$1 AND kind='profile' AND id='lerntracker-onboarding'",[account.userId])).rows[0]?.payload??{};
  const settings=profileBudgetProjection(profile);
  const docs=(await c.query<{klausur_id:string;document_id:string;document_version_id:string}>(`SELECT DISTINCT ON(d.klausur_id) d.klausur_id,d.document_id,v.document_version_id FROM stex.catalog_documents d JOIN stex.catalog_document_versions v USING(document_id) ORDER BY d.klausur_id,CASE WHEN d.role IN('sachverhalt','kombiniert') THEN 0 ELSE 1 END,v.version_number DESC`)).rows;
  const klausuren=(await c.query<{payload:Klausur}>("SELECT payload FROM stex.catalog_records WHERE kind='klausur' ORDER BY id")).rows.map(r=>{const d=docs.find(d=>d.klausur_id===r.payload.id);return {...r.payload,...(d?{viewerURL:pdfViewerURL({klausurId:d.klausur_id,documentId:d.document_id,documentVersionId:d.document_version_id})}:{})};});
  return {contractVersion:1,account,records:rows.filter(r=>r.normalized.c3aDeleted!==true).map(r=>({kind:r.kind,id:r.id,revision:r.revision,value:r.payload as unknown as ScheduleRecord['value']})),retired:rows.filter(r=>r.normalized.c3aDeleted===true).map(r=>({kind:r.kind,id:r.id,revision:r.revision})),klausuren,settings,personal:await new PersonalService(this.auth).readInTransaction(c,account)};
 }
 async read(headers:Headers):Promise<ScheduleView>{const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');return this.view(c,context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true)));});}
 async status(headers:Headers,id:string):Promise<ScheduleResult>{if(!validId(id))invalid();const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{const account=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));const r=(await c.query<{result:ScheduleResult}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2 AND action='schedule'",[account.userId,id])).rows[0];if(!r)throw new AccountError('not_found','Lernaktion nicht gefunden.',404);return {...r.result,account,replay:true};});}
 async submit(headers:Headers,input:unknown):Promise<ScheduleResult>{
  const command=validateScheduleCommand(input),who=await this.auth.principal(headers);await this.faults.beforeTransaction?.();
  return this.auth.database.transaction(async c=>{
   await lockState(c);const account=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));
   if(account.userId!==command.expectedAccountId||account.accessGeneration!==command.expectedAccessGeneration||account.sessionContext!==command.expectedSessionContext)throw new AccountError('account_changed','Die Anmeldung hat sich geändert. Bitte neu laden.',409);
   const {expectedAccessGeneration:g,expectedSessionContext:s,...semantic}=command;void g;void s;const fingerprint=digest(semantic);
   const previous=(await c.query<{fingerprint:string;action:string;result:ScheduleResult}>('SELECT fingerprint,action,result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2',[account.userId,command.requestId])).rows[0];
   if(previous){if(previous.action!=='schedule'||previous.fingerprint!==fingerprint)conflict('Diese Vorgangskennung gehört zu einer anderen Änderung.');return {...previous.result,account,replay:true};}
   const tx=new ScheduleTransaction(c,account.userId,command,this.faults.beforeWrite);await tx.apply();
   const result:ScheduleResult={contractVersion:1,action:'schedule',requestId:command.requestId,account,input:command,changes:tx.changes,replay:false};
   await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,'schedule',$3,$4::jsonb,$5::jsonb)",[account.userId,command.requestId,fingerprint,JSON.stringify(tx.before),JSON.stringify(result)]);
   await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');this.faults.beforeCommit?.();return result;
  });
 }
}
class ScheduleTransaction{
 readonly changes:ScheduleRecord[]=[];readonly before:Row[]=[];private consumed=new Set<string>();private index=0;
 constructor(private c:PoolClient,private owner:string,private command:ScheduleCommand,private beforeWrite?:((i:number)=>void)){}
 private key(kind:ScheduleKind,id:string){return recordKey(kind,this.owner,id);}
 private async row(kind:ScheduleKind,id:string):Promise<Row|undefined>{return (await this.c.query<Row>('SELECT kind,id,revision,payload,normalized FROM stex.personal_records WHERE record_key=$1',[this.key(kind,id)])).rows[0];}
 private async existing<T>(kind:ScheduleKind,id:string):Promise<T>{const row=await this.row(kind,id);if(!row||row.normalized.c3aDeleted===true)throw new AccountError('not_found','Persönlicher Datensatz nicht gefunden.',404);return row.payload as T;}
 private async write(kind:ScheduleKind,id:string,payload:unknown,deleted=false){
  const key=`${kind}|${id}`;if(this.consumed.has(key))throw new Error('Doppelte interne Fachänderung.');const expected=this.command.expected.find(r=>r.kind===kind&&r.id===id);if(!expected)conflict('Eine betroffene Revision fehlt. Bitte neu laden.');const old=await this.row(kind,id);if((old?.revision??null)!==expected.revision)conflict();this.consumed.add(key);if(old)this.before.push(old);
  this.beforeWrite?.(this.index++);const normalized={...old?.normalized,c3aDeleted:deleted};
  await this.c.query(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,$3,$4,1,$5,$6::jsonb,$7::jsonb) ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,normalized=EXCLUDED.normalized,revision=personal_records.revision+1`,[this.key(kind,id),this.owner,kind,id,legacy[kind],JSON.stringify(payload),JSON.stringify(normalized)]);
  if(!deleted)await this.references(kind,id,payload as Record<string,unknown>);
  this.changes.push({kind,id,revision:(old?.revision??0)+1,value:payload as ScheduleRecord['value'],deleted});
 }
 private async references(kind:ScheduleKind,id:string,value:Record<string,unknown>){
  const key=this.key(kind,id);await this.c.query("DELETE FROM stex.record_references WHERE source_key=$1 AND (path ~ '^value\\.(topicIds|linkedTopicIds)' OR path IN('value.topicId','value.linkedTopicId','value.klausurId','value.linkedKlausurId','value.calendarEventId','value.trackingEntryId'))",[key]);
  const topic=async(t:string,path:string)=>{await this.c.query('INSERT INTO stex.topics(id) VALUES($1) ON CONFLICT DO NOTHING',[t]);await this.c.query('INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_topic_id) VALUES($1,$2,$3,$1,$4)',[key,path,this.owner,t]);};
  for(const field of ['topicIds','linkedTopicIds'])if(Array.isArray(value[field]))for(const [i,t] of (value[field] as string[]).entries())await topic(t,`value.${field}[${i}]`);
  for(const field of ['topicId','linkedTopicId'])if(typeof value[field]==='string')await topic(String(value[field]),`value.${field}`);
  for(const field of ['klausurId','linkedKlausurId'])if(typeof value[field]==='string'){await this.exam(String(value[field]));await this.c.query('INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_catalog_key) VALUES($1,$2,$3,$1,$4)',[key,`value.${field}`,this.owner,recordKey('klausur',null,String(value[field]))]);}
  for(const [field,target] of [['calendarEventId','calendar-event'],['trackingEntryId','tracking-entry']] as const)if(typeof value[field]==='string'){await this.existing(target,String(value[field]));await this.c.query('INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_personal_key) VALUES($1,$2,$3,$1,$4)',[key,`value.${field}`,this.owner,this.key(target,String(value[field]))]);}
 }
 private async exam(id:string):Promise<Klausur>{const r=(await this.c.query<{payload:Klausur}>("SELECT payload FROM stex.catalog_records WHERE kind='klausur' AND id=$1",[id])).rows[0];if(!r)throw new AccountError('not_found','Gemeinsame Klausur nicht gefunden.',404);return r.payload;}
 private async tasks():Promise<DailyTask[]>{return (await this.c.query<{payload:DailyTask}>("SELECT payload FROM stex.personal_records WHERE owner_user_id=$1 AND kind='task' AND coalesce(normalized->>'c3aDeleted','false')<>'true'",[this.owner])).rows.map(r=>r.payload);}
 private async incoming(kind:ScheduleKind,id:string,excluded:string[]=[]){const r=await this.c.query("SELECT 1 FROM stex.record_references r JOIN stex.personal_records p ON p.record_key=r.source_personal_key WHERE r.target_personal_key=$1 AND coalesce(p.normalized->>'c3aDeleted','false')<>'true' AND NOT(p.record_key=ANY($2::text[])) LIMIT 1",[this.key(kind,id),excluded]);if(r.rowCount)conflict('Dieser Datensatz wird noch verwendet. Bitte zuerst die zugehörige Aufgabe bearbeiten.');}
 async apply(){const op=this.command.operation,stamp=new Date().toISOString();
  if(op.type==='task.save'){
   const oldRow=await this.row('task',op.id),old=oldRow&&oldRow.normalized.c3aDeleted!==true?oldRow.payload as unknown as DailyTask:undefined;
   if(old?.done)conflict('Bitte die Bearbeitung zuerst zurücknehmen.');if(old&&old.source!=='manual'&&isFixedTask(old)&&(old.date!==op.date||old.title!==op.title))conflict('Feste Quelltermine werden hier nicht verschoben oder umbenannt.');
   if(old?.calendarEventId&&(old.linkedKlausurId!==op.klausurId||old.date!==op.date))conflict('Bitte die Klausurzuordnung am Kalendertermin ändern.');
   if(op.klausurId)await this.exam(op.klausurId);const value:DailyTask={...old,id:op.id,date:op.date,title:op.title.trim(),durationMinutes:op.durationMinutes,linkedTopicIds:op.topicIds,linkedKlausurId:op.klausurId,isReview:op.isReview,source:old?.source??'manual',done:false,createdAt:old?.createdAt??stamp};delete value.linkedTopicId;
   await this.write('task',op.id,value);
  }else if(op.type==='task.complete'){
   const task=await this.existing<DailyTask>('task',op.id);if(task.done)conflict('Die Aufgabe ist bereits erledigt.');if(task.linkedKlausurId)invalid('Klausur bitte als geschrieben oder gelesen eintragen.');if(task.date>localDate())invalid('Eine Bearbeitung kann nicht in der Zukunft liegen.');
   await this.write('tracking-entry',op.trackingId,{id:op.trackingId,date:task.date,activityType:task.isReview?'wiederholung':'theorie',topicIds:[...new Set([...(task.linkedTopicIds??[]),...(task.linkedTopicId?[task.linkedTopicId]:[])])],durationMinutes:op.durationMinutes,recallRating:op.recallRating,note:`[Task] ${task.title}`,createdAt:stamp});
   await this.write('task',op.id,{...task,done:true,doneAt:stamp,trackingEntryId:op.trackingId});
  }else if(op.type==='task.uncomplete'||op.type==='task.delete'){
   const task=await this.existing<DailyTask>('task',op.id);if(op.type==='task.uncomplete'&&!task.done)conflict('Die Aufgabe ist bereits offen.');if(op.type==='task.delete'&&isFixedTask(task)&&task.source!=='manual')conflict('Ein fester Quelltermin wird hier nicht gelöscht.');
   if(task.trackingEntryId){await this.incoming('tracking-entry',task.trackingEntryId,[this.key('task',op.id)]);const entry=await this.existing<TrackingEntry>('tracking-entry',task.trackingEntryId);await this.write('tracking-entry',entry.id,entry,true);}
   const value={...task,done:false};delete value.doneAt;delete value.trackingEntryId;delete value.reviewedAt;
   if(op.type==='task.delete')await this.incoming('task',op.id);await this.write('task',op.id,value,op.type==='task.delete');
  }else if(op.type==='event.save'){
   const oldRow=await this.row('calendar-event',op.id),old=oldRow&&oldRow.normalized.c3aDeleted!==true?oldRow.payload as unknown as CalendarEvent:undefined;
   if(old&&old.source&&old.source!=='manual')conflict('Feste Quelltermine werden hier nicht geändert.');
   const related=(await this.tasks()).filter(t=>t.calendarEventId===op.id);if(related.some(t=>t.done&&(t.date!==op.date||op.recurring)))conflict('Bearbeitete Klausurtermine werden nicht verschoben.');if(related.length&&(op.recurring||!['klausur','probeexamen'].includes(op.eventType)))invalid('Zugeordnete Klausurtermine bleiben einzelne Klausurtage.');
   const {type,...eventFields}=op;void type;await this.write('calendar-event',op.id,{...old,...eventFields,id:op.id,durationMinutes:op.durationMinutes,recurringDay:op.recurring?op.recurringDay:undefined,source:old?.source??'manual'});
   for(const task of related)await this.write('task',task.id,{...task,date:op.date});
  }else if(op.type==='event.delete'){
   const event=await this.existing<CalendarEvent>('calendar-event',op.id);if(event.source&&event.source!=='manual')conflict('Ein fester Quelltermin wird hier nicht gelöscht.');await this.incoming('calendar-event',op.id);await this.write('calendar-event',op.id,event,true);
  }else if(op.type==='event.link'){
   const event=await this.existing<CalendarEvent>('calendar-event',op.id),exam=await this.exam(op.klausurId);if(event.recurring||!['klausur','probeexamen'].includes(event.eventType))invalid('Bitte einen einzelnen Klausurtermin auswählen.');
   const all=await this.tasks(),related=all.filter(t=>t.calendarEventId===event.id),candidate=related[0]??all.find(t=>t.date===event.date&&t.linkedKlausurId===exam.id&&(t.klausurMode??(isSketchTask(t)?'read':'written'))==='written'&&!t.deferred);if((candidate&&candidate.id!==op.taskId)||related.length>1||related.some(t=>t.id!==op.taskId))conflict('Die Klausurzuordnung hat sich geändert.');
   const oldRow=await this.row('task',op.taskId),old=oldRow&&oldRow.normalized.c3aDeleted!==true?oldRow.payload as unknown as DailyTask:undefined;if(old&&(old.date!==event.date||old.linkedKlausurId!==exam.id||(old.calendarEventId&&old.calendarEventId!==event.id)))conflict('Diese Aufgabe gehört zu einem anderen Termin.');
   await this.write('calendar-event',op.id,{...event,linkedKlausurId:exam.id});await this.write('task',op.taskId,{...old,id:op.taskId,date:event.date,title:exam.title,done:old?.done??false,linkedKlausurId:exam.id,linkedTopicIds:old?.done?old.linkedTopicIds:exam.topicIds.filter(id=>leaves.has(id)),calendarEventId:event.id,klausurMode:'written',durationMinutes:300,recurringKey:old?.recurringKey??`calendar-klausur|${event.id}`,source:old?.source??'manual',createdAt:old?.createdAt??stamp});
  }else if(op.type==='tracking.save'||op.type==='tracking.delete'){
   if((await this.tasks()).some(t=>t.trackingEntryId===op.id))conflict('Diese Lerneinheit gehört zu einer Aufgabe. Bitte dort zurücknehmen.');
   if(op.type==='tracking.delete'){const old=await this.existing<TrackingEntry>('tracking-entry',op.id);await this.incoming('tracking-entry',op.id);await this.write('tracking-entry',op.id,old,true);}
   else{const oldRow=await this.row('tracking-entry',op.id),old=oldRow&&oldRow.normalized.c3aDeleted!==true?oldRow.payload as unknown as TrackingEntry:undefined;if(old?.klausurId||old?.activityType==='klausur')invalid('Klausurbearbeitung bitte über die zugehörige Aufgabe zurücknehmen.');const {type,...trackingFields}=op;void type;await this.write('tracking-entry',op.id,{...old,...trackingFields,id:op.id,createdAt:old?.createdAt??stamp});}
  }else if(op.type==='ag.save')await this.write('ag-week',op.id,{weekKey:op.id,agDays:[...op.agDays].sort(),source:'manual'});
  else if(op.type==='ag.clear'){const old=await this.existing('ag-week',op.id);await this.write('ag-week',op.id,old,true);}
  else if(op.type==='exam.record'){
   const exam=await this.exam(op.klausurId),oldRow=await this.row('task',op.taskId),old=oldRow&&oldRow.normalized.c3aDeleted!==true?oldRow.payload as unknown as DailyTask:undefined;
   const same=(await this.tasks()).find(t=>t.linkedKlausurId===exam.id&&t.date===op.date&&(t.klausurMode??(isSketchTask(t)?'read':'written'))===op.klausurMode);
   if(same&&same.id!==op.taskId)conflict('Für diesen Tag und Modus besteht bereits eine Klausuraufgabe.');if(old?.done)conflict('Die Klausur ist bereits eingetragen.');if(old&&(old.date!==op.date||old.linkedKlausurId!==exam.id))conflict('Der Klausurauftrag passt nicht mehr zur Aufgabe.');
   await this.write('tracking-entry',op.trackingId,{id:op.trackingId,date:op.date,activityType:'klausur',topicIds:op.topicIds,klausurId:exam.id,klausurMode:op.klausurMode,durationMinutes:op.durationMinutes,rating:op.rating,note:op.note,createdAt:stamp});
   for(const tid of op.topicIds){const r=await this.row('progress',tid),before=Number(r?.payload.percent??0),delta=Math.round(calculateKlausurDelta(before,op.rating)*(op.klausurMode==='read'?0.5:1)),after=Math.min(95,before+delta);
    // CAS even if the cap means no write; the displayed progress is still a precondition.
    if(after>before)await this.write('progress',tid,{topicId:tid,percent:after,source:'klausur',updatedAt:stamp});else{const expected=this.command.expected.find(x=>x.kind==='progress'&&x.id===tid);if(!expected||(r?.revision??null)!==expected.revision)conflict();this.consumed.add(`progress|${tid}`);}
   }
   await this.write('task',op.taskId,{...old,id:op.taskId,date:op.date,title:op.klausurMode==='read'?`Skizze: ${exam.title}`:exam.title,done:true,doneAt:stamp,linkedKlausurId:exam.id,linkedTopicIds:op.topicIds,durationMinutes:op.durationMinutes,klausurMode:op.klausurMode,trackingEntryId:op.trackingId,recurringKey:old?.recurringKey??`klausur-written|${exam.id}|${op.date}|${op.klausurMode}`,source:old?.source??'manual',createdAt:old?.createdAt??stamp});
  }
  if(this.consumed.size!==this.command.expected.length||this.command.expected.some(r=>!this.consumed.has(`${r.kind}|${r.id}`)))conflict('Die betroffene Revisionsauswahl passt nicht zur Aktion.');
 }
}
