import type {PoolClient} from 'pg';
import type {AccountService} from '../auth/service';
import {AccountError,exactFields} from '../auth/security';
import {lockState} from '../persistence/repository';
import {digest,recordKey} from '../../data-migration/migration';
import {SETTINGS_KEYS,DEFAULT_PROMPTS,knownSetting,settingDefault,plain,type SettingKind,type SettingRow,type SettingsCommand,type SettingsView,type SettingsResult} from '../../learning/settings-contract';
import type {LearningAccount} from '../../learning/progress-contract';
import {validateSettingPatch,mergeSetting,settingIssues} from './settings-values';
interface Row {kind:SettingKind;id:string;revision:number;payload:unknown;normalized:Record<string,unknown>;legacy_key:string}
const account=(p:{userId:string;generation:number;sessionId:string}):LearningAccount=>({userId:p.userId,accessGeneration:p.generation,sessionContext:digest(['learning-session',p.sessionId])});
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(v);
function invalid():never{throw new AccountError('invalid_input','Ungültiger Einstellungsauftrag.',400);}
export function validateSettings(value:unknown):SettingsCommand{
 if(!plain(value))invalid();exactFields(value,['contractVersion','action','requestId','expectedAccountId','expectedAccessGeneration','expectedSessionContext','kind','id','expectedRevision','operation','patch']);
 if(value.contractVersion!==1||value.action!=='settings'||!id(value.requestId)||!value.requestId.startsWith('c5b_')||!id(value.expectedAccountId)||!Number.isSafeInteger(value.expectedAccessGeneration)||Number(value.expectedAccessGeneration)<1||typeof value.expectedSessionContext!=='string'||!/^[a-f0-9]{64}$/.test(value.expectedSessionContext)||typeof value.kind!=='string'||!Object.hasOwn(SETTINGS_KEYS,value.kind)||value.kind==='ai-metrics'||!id(value.id)||!knownSetting(value.kind as SettingKind,value.id)||(value.expectedRevision!==null&&(!Number.isSafeInteger(value.expectedRevision)||Number(value.expectedRevision)<1))||!['patch','reset'].includes(String(value.operation)))invalid();
 if(value.operation==='patch')validateSettingPatch(value.kind as SettingKind,value.patch);else if(Object.hasOwn(value,'patch'))invalid();
 return value as unknown as SettingsCommand;
}
export class SettingsService {
 constructor(readonly auth:AccountService,private faults:{beforeTransaction?:()=>Promise<void>;beforeWrite?:()=>void;beforeCommit?:()=>void}={}){}
 private async rows(c:PoolClient,owner:string){return(await c.query<Row>('SELECT kind,id,revision,payload,normalized,legacy_key FROM stex.personal_records WHERE owner_user_id=$1 AND kind=ANY($2::text[]) ORDER BY kind,id',[owner,Object.keys(SETTINGS_KEYS)])).rows;}
 private async view(c:PoolClient,a:LearningAccount):Promise<SettingsView>{
  const raw=await this.rows(c,a.userId);if(raw.length>500)throw new AccountError('too_large','Zu viele vorhandene Einstellungszeilen; bitte zuerst klären.',409);
  const wanted=Object.entries(SETTINGS_KEYS).flatMap(([kind,key])=>kind==='prompt'?DEFAULT_PROMPTS.map(p=>({kind:kind as SettingKind,id:p.id})):[{kind:kind as SettingKind,id:key}]);
  const describe=(r:Row):SettingRow=>({kind:r.kind,id:r.id,revision:r.revision,payload:r.payload,editable:r.kind!=='ai-metrics'&&knownSetting(r.kind,r.id)&&!r.normalized.c3aDeleted&&(['theme','plan-model'].includes(r.kind)||plain(r.payload)),issues:[...(!knownSetting(r.kind,r.id)?['Unbekannte ID bleibt erhalten; keine automatische Zuordnung.']:[]),...settingIssues(r.kind,r.id,r.payload)]});
  const rows=wanted.map(w=>{const r=raw.find(r=>r.kind===w.kind&&r.id===w.id);return r?describe(r):{...w,revision:null,payload:settingDefault(w.kind,w.id),editable:w.kind!=='ai-metrics',issues:w.kind==='prompt'?settingIssues(w.kind,w.id,settingDefault(w.kind,w.id)):[]};});
  rows.push(...raw.filter(r=>!wanted.some(w=>w.kind===r.kind&&w.id===r.id)).map(describe));
  const recent=(await c.query<{request_id:string;created_at:Date}>("SELECT request_id,created_at FROM stex.learning_commands WHERE owner_user_id=$1 AND action='settings' ORDER BY created_at DESC,request_id DESC LIMIT 20",[a.userId])).rows.map(r=>({requestId:r.request_id,createdAt:new Date(r.created_at).toISOString()}));return {contractVersion:1,account:a,rows,recent};
 }
 async read(headers:Headers):Promise<SettingsView>{const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));return this.view(c,a);});}
 async status(headers:Headers,requestId:string):Promise<SettingsResult>{if(!id(requestId))invalid();const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));const r=(await c.query<{result:SettingsResult}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2 AND action='settings'",[a.userId,requestId])).rows[0];if(!r)throw new AccountError('not_found','Noch kein Beleg. Bitte Status prüfen, bevor du denselben Auftrag bewusst wiederholst.',404);return {...r.result,account:a,view:await this.view(c,a),replay:true};});}
 async submit(headers:Headers,value:unknown):Promise<SettingsResult>{const cmd=validateSettings(value),who=await this.auth.principal(headers);await this.faults.beforeTransaction?.();return this.auth.database.transaction(async c=>{
  await lockState(c);const a=account(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));if(cmd.expectedAccountId!==a.userId||cmd.expectedAccessGeneration!==a.accessGeneration||cmd.expectedSessionContext!==a.sessionContext)throw new AccountError('account_changed','Anmeldung geändert. Bitte neu laden.',409);
  const {expectedAccessGeneration:g,expectedSessionContext:s,...semantic}=cmd;void g;void s;const fingerprint=digest(semantic);
  const prior=(await c.query<{action:string;fingerprint:string;result:SettingsResult}>('SELECT action,fingerprint,result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2',[a.userId,cmd.requestId])).rows[0];if(prior){if(prior.action!=='settings'||prior.fingerprint!==fingerprint)throw new AccountError('conflict','Vorgangskennung gehört zu einem anderen Auftrag.',409);return {...prior.result,account:a,view:await this.view(c,a),replay:true};}
  const before=(await this.rows(c,a.userId)).find(r=>r.kind===cmd.kind&&r.id===cmd.id)??null;if((before?.revision??null)!==cmd.expectedRevision||before?.normalized.c3aDeleted)throw new AccountError('conflict','Gespeicherter Stand hat sich geändert. Eingaben vergleichen und bewusst neu laden.',409);
  const payload=mergeSetting(cmd.kind,cmd.id,before?.payload,!!before,cmd.operation,cmd.patch);this.faults.beforeWrite?.();
  const after=(await c.query<Row>(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,$3,$4,1,$5,$6::jsonb,$7::jsonb) ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,revision=personal_records.revision+1 WHERE personal_records.revision=$8 RETURNING kind,id,revision,payload,normalized,legacy_key`,[recordKey(cmd.kind,a.userId,cmd.id),a.userId,cmd.kind,cmd.id,before?.legacy_key??SETTINGS_KEYS[cmd.kind],JSON.stringify(payload),JSON.stringify(before?.normalized??{}),cmd.expectedRevision])).rows[0];if(!after)throw new AccountError('conflict','Revision hat sich geändert.',409);
  const result:SettingsResult={contractVersion:1,requestId:cmd.requestId,account:a,view:await this.view(c,a),replay:false};
  await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,'settings',$3,$4::jsonb,$5::jsonb)",[a.userId,cmd.requestId,fingerprint,JSON.stringify([{before,after}]),JSON.stringify({...result,view:{...result.view,rows:[],recent:[]},input:cmd})]);await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');this.faults.beforeCommit?.();return {...result,view:await this.view(c,a)};
 });}
}
