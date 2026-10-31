import type {PoolClient} from 'pg';
import {digest,recordKey} from '../../data-migration/migration';
import {WRITING_TYPES,NOTEPAD_ID,type WritingCommand,type WritingSelection,type WritingDocument,type WritingView,type WritingResult,type DraftFields,type NotepadFields,type WritingSummary} from '../../learning/writing-contract';
import {writingHtmlValid} from '../../learning/writing-html';
import type {LearningAccount} from '../../learning/progress-contract';
import type {Area,KlausurType} from '../../types';
import type {AccountService} from '../auth/service';
import {AccountError,exactFields} from '../auth/security';
import {lockState} from '../persistence/repository';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
function invalid(message='Ungültige Schreibdaten.'):never{throw new AccountError('invalid_input',message);}
function conflict(message='Dieser Text wurde inzwischen geändert. Dein unbestätigter Text bleibt im Arbeitspuffer.'):never{throw new AccountError('conflict',message,409);}
const account=(p:{userId:string;generation:number;sessionId:string}):LearningAccount=>({userId:p.userId,accessGeneration:p.generation,sessionContext:digest(['learning-session',p.sessionId])});
interface Row {kind:'draft'|'notepad';id:string;revision:number;payload:Record<string,unknown>;normalized:Record<string,unknown>;legacy_key:string}
function selection(v:WritingSelection){if(!['draft','notepad'].includes(v.kind)||!id(v.id)||(v.kind==='notepad'&&v.id!==NOTEPAD_ID))invalid();}
function text(v:unknown,max:number){return typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);}
export function validateWriting(input:unknown):WritingCommand{
 if(!object(input))invalid();exactFields(input,['contractVersion','action','requestId','expectedAccountId','expectedAccessGeneration','expectedSessionContext','kind','id','expectedRevision','operation','fields']);
 if(input.contractVersion!==1||input.action!=='writing'||!id(input.requestId)||!input.requestId.startsWith('c4a_')||!id(input.expectedAccountId)||!Number.isSafeInteger(input.expectedAccessGeneration)||Number(input.expectedAccessGeneration)<1||typeof input.expectedSessionContext!=='string'||!(/^[a-f0-9]{64}$/).test(input.expectedSessionContext)||(input.expectedRevision!==null&&(!Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<1)))invalid();
 selection(input as unknown as WritingSelection);
 if(input.operation==='delete'){if(input.kind!=='draft'||input.fields!==undefined||input.expectedRevision===null)invalid();}
 else if(input.operation==='save'){
  if(!object(input.fields)||!Object.keys(input.fields).length)invalid();const f=input.fields;
  if(input.kind==='notepad'){exactFields(f,['html','text']);if(!text(f.html,300000)||!text(f.text,200000)||!writingHtmlValid(f.html as string))invalid('Der Notiztext ist zu groß oder enthält nicht unterstützte Formatierung.');}
  else{
   exactFields(f,['title','area','type','klausurId','sachverhalt','contentHtml','contentText']);
   if(f.title!==undefined&&(!text(f.title,200)||!(f.title as string).trim()))invalid('Bitte einen Titel mit höchstens 200 Zeichen angeben.');
   if(f.area!==undefined&&f.area!==null&&!Object.hasOwn(WRITING_TYPES,String(f.area)))invalid('Unbekanntes Rechtsgebiet.');
   if(f.type!==undefined&&f.type!==null&&!Object.values(WRITING_TYPES).flat().includes(f.type as KlausurType))invalid('Unbekannter Klausurtyp.');
   if(f.klausurId!==undefined&&f.klausurId!==null&&!id(f.klausurId))invalid('Ungültiger Klausurbezug.');
   if(f.sachverhalt!==undefined&&!text(f.sachverhalt,100000))invalid('Der Sachverhalt ist zu groß.');
   if((f.contentHtml!==undefined||f.contentText!==undefined)&&(!text(f.contentHtml,300000)||!text(f.contentText,200000)||!writingHtmlValid(f.contentHtml as string)))invalid('Der Lösungstext ist zu groß oder enthält nicht unterstützte Formatierung.');
   if(input.expectedRevision===null&&(!f.title||!f.area||!f.type||typeof f.contentHtml!=='string'||typeof f.contentText!=='string'))invalid('Ein neuer Entwurf braucht Titel, Gebiet, Typ und Text.');
  }
 }else invalid();return input as unknown as WritingCommand;
}
function document(r:Row):WritingDocument{
 const p=r.payload;if(!object(p))throw new AccountError('invalid_context','Der gespeicherte Text braucht Klärung.',409);
 const fields=r.kind==='notepad'?{html:typeof p.html==='string'?p.html:'',text:typeof p.text==='string'?p.text:''}:Object.fromEntries(['title','area','type','klausurId','sachverhalt','contentHtml','contentText'].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]));
 if(r.kind==='draft'&&(!text(p.title,200)||typeof p.contentHtml!=='string'||typeof p.contentText!=='string'))throw new AccountError('invalid_context','Der gespeicherte Entwurf braucht Klärung.',409);
 return {kind:r.kind,id:r.id,revision:r.revision,deleted:r.normalized.c4aDeleted===true,fields:fields as unknown as DraftFields|NotepadFields,createdAt:typeof p.createdAt==='string'?p.createdAt:undefined,updatedAt:typeof p.updatedAt==='string'?p.updatedAt:'',feedback:Array.isArray(p.feedback)?p.feedback.filter(object).filter(f=>typeof f.feedbackText==='string').map(f=>({feedbackText:String(f.feedbackText),...(typeof f.createdAt==='string'?{createdAt:f.createdAt}:{})})):[]};
}
export class WritingService{
 constructor(readonly auth:AccountService,private readonly faults:{beforeTransaction?:()=>Promise<void>;beforeWrite?:()=>void;beforeCommit?:()=>void}={}){}
 private async row(c:PoolClient,owner:string,s:WritingSelection){return (await c.query<Row>('SELECT kind,id,revision,payload,normalized,legacy_key FROM stex.personal_records WHERE owner_user_id=$1 AND kind=$2 AND id=$3',[owner,s.kind,s.id])).rows[0];}
 async read(headers:Headers,s?:WritingSelection):Promise<WritingView>{
  if(s)selection(s);const who=await this.auth.principal(headers);
  return this.auth.database.transaction(async c=>{
   await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));
   const rows=(await c.query<WritingSummary>(`SELECT id,revision,payload->>'title' AS title,payload->>'area' AS area,payload->>'type' AS type,payload->>'klausurId' AS "klausurId",payload->>'updatedAt' AS "updatedAt",CASE WHEN trim(coalesce(payload->>'contentText',''))='' THEN 0 ELSE cardinality(regexp_split_to_array(trim(coalesce(payload->>'contentText','')),E'\\\\s+')) END AS words,CASE WHEN jsonb_typeof(payload->'feedback')='array' THEN jsonb_array_length(payload->'feedback') ELSE 0 END AS "feedbackCount" FROM stex.personal_records WHERE owner_user_id=$1 AND kind='draft' AND normalized->>'c4aDeleted' IS DISTINCT FROM 'true' ORDER BY payload->>'updatedAt' DESC,id LIMIT 201`,[a.userId])).rows;
   const r=s?await this.row(c,a.userId,s):null;
   const recent=(await c.query<{result:WritingResult}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND action='writing' ORDER BY created_at DESC,request_id DESC LIMIT 20",[a.userId])).rows.map(({result:v})=>({kind:v.document.kind,id:v.document.id,revision:v.document.revision,operation:v.operation,requestId:v.requestId,createdAt:v.createdAt}));
   return {contractVersion:1,account:a,drafts:rows.slice(0,200),truncated:rows.length>200,document:r?document(r):null,recent};
  });
 }
 async status(headers:Headers,requestId:string):Promise<WritingResult>{
  if(!id(requestId))invalid();const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));const r=(await c.query<{result:WritingResult}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2 AND action='writing'",[a.userId,requestId])).rows[0];if(!r)throw new AccountError('not_found','Schreibvorgang nicht gefunden.',404);return {...r.result,account:a,replay:true};});
 }
 async submit(headers:Headers,input:unknown):Promise<WritingResult>{
  const cmd=validateWriting(input),who=await this.auth.principal(headers);await this.faults.beforeTransaction?.();
  return this.auth.database.transaction(async c=>{
   await lockState(c);const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));
   if(a.userId!==cmd.expectedAccountId||a.accessGeneration!==cmd.expectedAccessGeneration||a.sessionContext!==cmd.expectedSessionContext)throw new AccountError('account_changed','Die Anmeldung hat sich geändert. Alten Text bitte bewusst zuordnen.',409);
   const {expectedAccessGeneration:g,expectedSessionContext:s,...semantic}=cmd;void g;void s;const fingerprint=digest(semantic);
   const prior=(await c.query<{fingerprint:string;result:WritingResult;action:string}>('SELECT fingerprint,result,action FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2',[a.userId,cmd.requestId])).rows[0];
   if(prior){if(prior.action!=='writing'||prior.fingerprint!==fingerprint)conflict('Diese Vorgangskennung gehört zu einer anderen Änderung.');return {...prior.result,account:a,replay:true};}
   const old=await this.row(c,a.userId,cmd),key=recordKey(cmd.kind,a.userId,cmd.id);
   if(old?.normalized.c4aDeleted===true)conflict('Dieser Entwurf wurde gelöscht. Ein alter Schreibauftrag darf ihn nicht wiederherstellen.');
   if((old?.revision??null)!==cmd.expectedRevision)conflict();
   const beforeReferences=(await c.query('SELECT * FROM stex.record_references WHERE source_key=$1 ORDER BY path',[key])).rows;
   const stamp=new Date().toISOString();let payload={...old?.payload};const normalized={...old?.normalized};
   if(cmd.operation==='delete'){
    if((await c.query('SELECT 1 FROM stex.record_references WHERE target_personal_key=$1 LIMIT 1',[key])).rowCount)conflict('Dieser Entwurf wird noch von einem privaten Datensatz referenziert.');
    normalized.c4aDeleted=true;normalized.c4aDeletedAt=stamp;
   }else{
    payload={...payload,...cmd.fields};for(const k of ['area','type','klausurId'])if(payload[k]===null)delete payload[k];
    if(cmd.kind==='draft'){
     if(payload.area&&payload.type&&!WRITING_TYPES[payload.area as Area]?.includes(payload.type as KlausurType))invalid('Klausurtyp und Rechtsgebiet passen nicht zusammen.');
     if(payload.klausurId){const linked=(await c.query('SELECT record_key,payload FROM stex.catalog_records WHERE kind=\'klausur\' AND id=$1',[payload.klausurId])).rows[0];if(!linked||(payload.area&&linked.payload.area!==payload.area))invalid('Die verknüpfte gemeinsame Klausur fehlt oder hat ein anderes Rechtsgebiet.');}
     if(!old){payload.id=cmd.id;payload.feedback=[];payload.createdAt=stamp;}
    }
    payload.updatedAt=stamp;
   }
   this.faults.beforeWrite?.();
   const after=(await c.query<Row>(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,$3,$4,1,$5,$6::jsonb,$7::jsonb) ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,normalized=EXCLUDED.normalized,revision=personal_records.revision+1 WHERE personal_records.revision=$8 RETURNING kind,id,revision,payload,normalized,legacy_key`,[key,a.userId,cmd.kind,cmd.id,cmd.kind==='draft'?'lerntracker-klausur-drafts':'lerntracker-freitext',JSON.stringify(payload),JSON.stringify(normalized),cmd.expectedRevision])).rows[0];if(!after)conflict();
   if(cmd.kind==='draft'&&cmd.operation==='save'&&Object.hasOwn(cmd.fields!,'klausurId')){
    await c.query("DELETE FROM stex.record_references WHERE source_key=$1 AND path='value.klausurId'",[key]);
    if(payload.klausurId)await c.query("INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_catalog_key) VALUES($1,'value.klausurId',$2,$1,$3)",[key,a.userId,recordKey('klausur',null,String(payload.klausurId))]);
   }
   const afterReferences=(await c.query('SELECT * FROM stex.record_references WHERE source_key=$1 ORDER BY path',[key])).rows;
   const result:WritingResult={contractVersion:1,account:a,requestId:cmd.requestId,action:'writing',operation:cmd.operation,document:document(after),createdAt:stamp,replay:false};
   await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,'writing',$3,$4::jsonb,$5::jsonb)",[a.userId,cmd.requestId,fingerprint,JSON.stringify([{before:old??null,after,beforeReferences,afterReferences}]),JSON.stringify(result)]);
   await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');this.faults.beforeCommit?.();return result;
  });
 }
}
