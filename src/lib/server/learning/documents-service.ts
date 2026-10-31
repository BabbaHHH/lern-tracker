import type {PoolClient} from 'pg';
import {digest,recordKey} from '../../data-migration/migration';
import type {LearningAccount} from '../../learning/progress-contract';
import type {DocumentsCommand,DocumentsResult,DocumentsView,PersonalDocument} from '../../learning/documents-contract';
import type {AccountService} from '../auth/service';
import {AccountError} from '../auth/security';
import {lockState,type VersionRow} from '../persistence/repository';
import {storageKey} from '../persistence/files';
import {conflict,identifier,invalid,object,validateDocuments,validateOriginal} from './documents-validation';
interface Row {record_key:string;id:string;revision:number;payload:Record<string,unknown>;normalized:Record<string,unknown>}
const account=(p:{userId:string;generation:number;sessionId:string}):LearningAccount=>({userId:p.userId,accessGeneration:p.generation,sessionContext:digest(['learning-session',p.sessionId])});
interface Receipt {fingerprint:string;action:string;result:DocumentsResult}
function checkAccount(a:LearningAccount,cmd:DocumentsCommand){if(a.userId!==cmd.expectedAccountId||a.accessGeneration!==cmd.expectedAccessGeneration||a.sessionContext!==cmd.expectedSessionContext)throw new AccountError('account_changed','Die Anmeldung hat sich geändert. Bitte Dokumente neu öffnen.',409);}
export class DocumentsService {
 constructor(readonly auth:AccountService,private readonly faults:{beforeFileWrite?:()=>Promise<void>;beforeFileRead?:()=>Promise<void>;beforeWrite?:()=>void;beforeCommit?:()=>void}={}){if(!auth.files)throw new AccountError('unavailable','Privater Dateispeicher fehlt.',503);}
 private get files(){return this.auth.files!;}
 private async row(c:PoolClient,owner:string,id:string){return(await c.query<Row>("SELECT record_key,id,revision,payload,normalized FROM stex.personal_records WHERE owner_user_id=$1 AND kind='document' AND id=$2",[owner,id])).rows[0];}
 private async versions(c:PoolClient,owner:string,id:string){return(await c.query<VersionRow>('SELECT * FROM stex.document_versions WHERE owner_user_id=$1 AND document_id=$2 ORDER BY document_version_id',[owner,id])).rows;}
 private async describe(c:PoolClient,owner:string,r:Row):Promise<PersonalDocument>{
  if(!object(r.payload))throw new AccountError('invalid_context','Dokumentdaten brauchen Klärung.',409);
  const vs=await this.versions(c,owner,r.id),p=r.payload,n=r.normalized,current=typeof n.documentVersionId==='string'&&vs.some(v=>v.document_version_id===n.documentVersionId)?n.documentVersionId:null;
  const hasLegacyText=['textContent','summary','text'].some(k=>typeof p[k]==='string'&&!!p[k]);
  const source=Object.hasOwn(n,'c5aSourceVersionId')?n.c5aSourceVersionId:hasLegacyText?current:null;
  const names=object(n.c5aVersionNames)?n.c5aVersionNames:{};
  return {id:r.id,revision:r.revision,name:typeof p.name==='string'?p.name:r.id,tags:Array.isArray(p.tags)?p.tags.filter((t):t is string=>typeof t==='string'):[],includeInNextPlan:p.includeInNextPlan===true&&n.c5aDeleted!==true,deleted:n.c5aDeleted===true,currentVersionId:current,sourceVersionId:typeof source==='string'?source:null,hasLegacyText,updatedAt:typeof p.updatedAt==='string'?p.updatedAt:'',versions:vs.map(v=>({id:v.document_version_id,sha256:v.sha256,size:Number(v.byte_size),type:v.media_type,name:typeof names[v.document_version_id]==='string'?String(names[v.document_version_id]):typeof p.name==='string'?p.name:'Originaldatei',current:v.document_version_id===current}))};
 }
 async read(headers:Headers):Promise<DocumentsView>{
  const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{
   await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));
   const rows=(await c.query<Row>("SELECT record_key,id,revision,payload,normalized FROM stex.personal_records WHERE owner_user_id=$1 AND kind='document' ORDER BY normalized->>'c5aDeleted' NULLS FIRST,payload->>'updatedAt' DESC,id LIMIT 201",[a.userId])).rows;
   const documents:PersonalDocument[]=[];for(const r of rows.slice(0,200))documents.push(await this.describe(c,a.userId,r));
   const recent=(await c.query<{result:DocumentsResult}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND action='documents' ORDER BY created_at DESC,request_id DESC LIMIT 20",[a.userId])).rows.map(({result:r})=>({requestId:r.requestId,status:r.status,createdAt:r.createdAt}));
   return {contractVersion:1,account:a,documents,truncated:rows.length>200,recent};
  });
 }
 async status(headers:Headers,id:string):Promise<DocumentsResult>{
  if(!identifier(id))invalid();const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));const r=(await c.query<Receipt>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2 AND action='documents'",[a.userId,id])).rows[0];if(!r)throw new AccountError('not_found','Noch kein Beleg vorhanden. Das ist keine Bestätigung eines fehlgeschlagenen Uploads.',404);return {...r.result,account:a,replay:true};});
 }
 private async prior(c:PoolClient,a:LearningAccount,cmd:DocumentsCommand,fingerprint:string){const r=(await c.query<Receipt>('SELECT fingerprint,action,result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2',[a.userId,cmd.requestId])).rows[0];if(r&&(r.action!=='documents'||r.fingerprint!==fingerprint))conflict('Diese Vorgangskennung gehört zu einem anderen Auftrag.');return r;}
 private checkRow(r:Row|undefined,cmd:DocumentsCommand){if(r?.normalized.c5aDeleted===true)conflict('Dieses Dokument wurde entfernt; alte Aufträge dürfen es nicht reaktivieren.');if((r?.revision??null)!==cmd.expectedRevision)conflict();}
 async submit(headers:Headers,input:unknown,bytes?:Buffer):Promise<DocumentsResult>{
  const cmd=validateDocuments(input),who=await this.auth.principal(headers);
  if((cmd.operation==='upload')!==!!bytes)invalid('Originaldatei und Auftrag passen nicht zusammen.');
  const media=cmd.file&&bytes?validateOriginal(cmd.file,bytes):null;
  const {expectedSessionContext:s,expectedAccessGeneration:g,...semantic}=cmd;void s;void g;
  const fingerprint=digest(semantic),versionId=`dv:${digest([who.userId,cmd.requestId,fingerprint])}`,fileKey=storageKey(who.userId,versionId);
  // Reserve the id before slow I/O. Pending is not a successful document mutation.
  const prepared=await this.auth.database.transaction(async c=>{
   await lockState(c);const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));checkAccount(a,cmd);
   const prior=await this.prior(c,a,cmd,fingerprint);if(prior?.result.status==='committed')return {result:{...prior.result,account:a,replay:true},before:null};
   const before=await this.row(c,a.userId,cmd.id);this.checkRow(before,cmd);
   const pending:DocumentsResult={contractVersion:1,account:a,requestId:cmd.requestId,status:'pending',document:null,createdAt:new Date().toISOString(),replay:false};
   if(!prior)await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,'documents',$3,'[]',$4::jsonb)",[a.userId,cmd.requestId,fingerprint,JSON.stringify(pending)]);
   return {result:null,before:before??null};
  });
  if(prepared.result)return prepared.result;
  if(bytes&&cmd.file){await this.faults.beforeFileWrite?.();await this.files.put(fileKey,bytes,cmd.file.sha256);}
  return this.auth.database.transaction(async c=>{
   await lockState(c);const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));checkAccount(a,cmd);
   const prior=await this.prior(c,a,cmd,fingerprint);if(prior?.result.status==='committed')return {...prior.result,account:a,replay:true};
   const old=await this.row(c,a.userId,cmd.id);this.checkRow(old,cmd);if(digest(old??null)!==digest(prepared.before))conflict();
   const key=recordKey('document',a.userId,cmd.id),stamp=new Date().toISOString();
   const beforeVersions=await this.versions(c,a.userId,cmd.id),beforeReferences=(await c.query('SELECT * FROM stex.record_references WHERE source_key=$1 OR target_personal_key=$1 ORDER BY source_key,path',[key])).rows;
   const payload={...old?.payload},normalized={...old?.normalized};
   if(!Object.hasOwn(normalized,'c5aSourceVersionId'))normalized.c5aSourceVersionId=old&&['textContent','summary','text'].some(k=>typeof payload[k]==='string'&&!!payload[k])?normalized.documentVersionId??null:null;
   if(cmd.operation==='remove'){normalized.c5aDeleted=true;normalized.c5aDeletedAt=stamp;payload.includeInNextPlan=false;}
   else Object.assign(payload,cmd.fields);
   if(cmd.file){
    const names={...(object(normalized.c5aVersionNames)?normalized.c5aVersionNames:{})};
    if(typeof normalized.documentVersionId==='string'&&!names[normalized.documentVersionId])names[normalized.documentVersionId]=old?.payload.name??'Originaldatei';
    names[versionId]=cmd.file.name;normalized.c5aVersionNames=names;normalized.documentId=cmd.id;normalized.documentVersionId=versionId;
    payload.type=media;payload.size=cmd.file.size;if(!old){payload.id=cmd.id;payload.uploadedAt=stamp;}
   }
   payload.updatedAt=stamp;this.faults.beforeWrite?.();
   const after=(await c.query<Row>(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,'document',$3,1,'lerntracker-documents',$4::jsonb,$5::jsonb) ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,normalized=EXCLUDED.normalized,revision=personal_records.revision+1 WHERE personal_records.revision=$6 RETURNING record_key,id,revision,payload,normalized`,[key,a.userId,cmd.id,JSON.stringify(payload),JSON.stringify(normalized),cmd.expectedRevision])).rows[0];if(!after)conflict();
   if(cmd.file)await c.query('INSERT INTO stex.document_versions VALUES($1,$2,$3,$4,$5,$6,$7,NULL,\'pending\',NULL,$8,$9)',[versionId,cmd.id,a.userId,key,cmd.file.sha256,cmd.file.size,media,fileKey,`data:${media};base64,`]);
   const afterVersions=await this.versions(c,a.userId,cmd.id),afterReferences=(await c.query('SELECT * FROM stex.record_references WHERE source_key=$1 OR target_personal_key=$1 ORDER BY source_key,path',[key])).rows;
   const result:DocumentsResult={contractVersion:1,account:a,requestId:cmd.requestId,status:'committed',document:await this.describe(c,a.userId,after),createdAt:stamp,replay:false};
   await c.query("UPDATE stex.learning_commands SET before_values=$3::jsonb,result=$4::jsonb WHERE owner_user_id=$1 AND request_id=$2",[a.userId,cmd.requestId,JSON.stringify([{before:old??null,after,beforeVersions,afterVersions,beforeReferences,afterReferences}]),JSON.stringify(result)]);
   await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');this.faults.beforeCommit?.();return result;
  });
 }
 async file(headers:Headers,id:string,versionId:string,revision:number){
  if(!identifier(id)||!identifier(versionId)||!Number.isSafeInteger(revision)||revision<1)invalid();const who=await this.auth.principal(headers);
  const select=async(c:PoolClient)=>{const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));const r=await this.row(c,a.userId,id);if(!r||r.normalized.c5aDeleted===true)throw new AccountError('not_found','Dokument nicht verfügbar.',404);if(r.revision!==revision)conflict();const v=(await this.versions(c,a.userId,id)).find(v=>v.document_version_id===versionId);if(!v)throw new AccountError('not_found','Originalversion nicht verfügbar.',404);return {a,r,v};};
  const initial=await this.auth.database.transaction(select);
  await this.faults.beforeFileRead?.();const bytes=await this.files.read(initial.v.storage_key,initial.v.sha256,Number(initial.v.byte_size));
  return this.auth.database.transaction(async c=>{await lockState(c);const final=await select(c);if(digest(initial)!==digest(final))conflict('Dokumentzugriff hat sich während des Abrufs geändert.');const names=initial.r.normalized.c5aVersionNames;const name=object(names)&&typeof names[versionId]==='string'?String(names[versionId]):String(initial.r.payload.name??'Originaldatei');return {bytes,type:initial.v.media_type,name,sha256:initial.v.sha256};});
 }
}
