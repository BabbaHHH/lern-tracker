import type { PoolClient } from 'pg';
import { TOPICS } from '../../topics';
import { PROFILE_FIELDS,profilePatchError,projectProfile,mergeProfilePatch } from '../../learning/profile-fields';
import { digest,recordKey } from '../../data-migration/migration';
import type { LearningAccount } from '../../learning/progress-contract';
import type { PersonalPatchCommand,PersonalResult,PersonalView,ProfileFields,PersonalRecord } from '../../learning/personal-contract';
import type { AccountService } from '../auth/service';
import { AccountError,exactFields } from '../auth/security';
import { lockState } from '../persistence/repository';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const revision=(v:unknown)=>v===null||(Number.isSafeInteger(v)&&Number(v)>0);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const context=(who:{userId:string;generation:number;sessionId:string}):LearningAccount=>({userId:who.userId,accessGeneration:who.generation,sessionContext:digest(['learning-session',who.sessionId])});
function invalid(message:string):never {throw new AccountError('invalid_input',message);}
export function validatePersonalCommand(v:unknown):PersonalPatchCommand {
  if(!object(v))invalid('Ungültige persönliche Lernaktion.');
  exactFields(v,['contractVersion','requestId','expectedAccountId','expectedAccessGeneration','expectedSessionContext','action',...(v.action==='profile'?['fields','expectedRevisions']:['id','topicId','note','expectedRevision'])]);
  if(v.contractVersion!==1||!id(v.requestId)||!v.requestId.startsWith('c2_')||typeof v.expectedAccountId!=='string'||!v.expectedAccountId||!Number.isSafeInteger(v.expectedAccessGeneration)||Number(v.expectedAccessGeneration)<1||typeof v.expectedSessionContext!=='string'||!/^[0-9a-f]{64}$/.test(v.expectedSessionContext))invalid('Konto- oder Vorgangsstand fehlt.');
  if(v.action==='profile') {
    if(!object(v.fields)||!object(v.expectedRevisions))invalid('Profilstand fehlt.');
    exactFields(v.fields,[...PROFILE_FIELDS]);exactFields(v.expectedRevisions,['profile','examDate','lernstart']);
    if(!['profile','examDate','lernstart'].every(k=>Object.hasOwn(v.expectedRevisions as object,k)&&revision((v.expectedRevisions as Record<string,unknown>)[k])))invalid('Ungültige Profilrevisionen.');
    const error=profilePatchError(v.fields);if(error)invalid(error);
  }else if(v.action==='note') {
    if(!id(v.id)||typeof v.topicId!=='string'||!TOPICS.some(t=>t.id===v.topicId)||typeof v.note!=='string'||!v.note.trim()||v.note.length>10000||!revision(v.expectedRevision))invalid('Bitte Thema, Notiz und gültige Revision angeben.');
  }else invalid('Unbekannte persönliche Lernaktion.');
  return v as unknown as PersonalPatchCommand;
}
export class PersonalService {
  constructor(readonly auth:AccountService,private readonly faults:{beforeTransaction?:()=>Promise<void>;beforeWrite?:(index:number)=>void;beforeCommit?:()=>void}={}){}
  async readInTransaction(client:PoolClient,account:LearningAccount):Promise<PersonalView> {
    const rows=(await client.query<{kind:string;id:string;revision:number;value:unknown}>("SELECT kind,id,revision,payload AS value FROM stex.personal_records WHERE owner_user_id=$1 AND kind IN('profile','exam-date','learning-start','learning-entry') ORDER BY id",[account.userId])).rows;
    const one=<T,>(kind:string,key:string):PersonalRecord<T>|null=>{const r=rows.find(r=>r.kind===kind&&r.id===key);return r?{id:r.id,revision:r.revision,value:r.value as T}:null;};
    const raw=one<Record<string,unknown>>('profile','lerntracker-onboarding');
    // Editable fields only; document payloads and parser results stay server-side.
    const profile=raw?{...raw,value:projectProfile(raw.value) as Partial<ProfileFields>}:null;
    return {contractVersion:1,account,profile,examDate:one('exam-date','lerntracker-exam-date'),lernstart:one('learning-start','lerntracker-lernstart'),notes:rows.filter(r=>r.kind==='learning-entry').map(r=>({id:r.id,revision:r.revision,value:r.value as PersonalView['notes'][number]['value']}))};
  }
  async read(headers:Headers):Promise<PersonalView> {const who=await this.auth.principal(headers);return this.auth.database.transaction(async c=>this.readInTransaction(c,context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true))));}
  async status(headers:Headers,requestId:string):Promise<PersonalResult> {
    if(!id(requestId))invalid('Ungültige Vorgangskennung.');const who=await this.auth.principal(headers);
    return this.auth.database.transaction(async c=>{
      const account=context(await this.auth.checkPrincipal(c,who.sessionId,'active',false,true));
      const row=(await c.query<{result:PersonalResult}>("SELECT result FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2 AND action IN('profile','note')",[account.userId,requestId])).rows[0];
      if(!row)throw new AccountError('not_found','Persönliche Lernaktion nicht gefunden.',404);
      return {...row.result,account,replay:true};
    });
  }
  async submit(headers:Headers,input:unknown):Promise<PersonalResult> {
    const command=validatePersonalCommand(input);const who=await this.auth.principal(headers);await this.faults.beforeTransaction?.();
    return this.auth.database.transaction(async c=>{
      await lockState(c);const current=await this.auth.checkPrincipal(c,who.sessionId,'active',false,true),account=context(current);
      if(account.userId!==command.expectedAccountId||account.accessGeneration!==command.expectedAccessGeneration||account.sessionContext!==command.expectedSessionContext)throw new AccountError('account_changed','Das Konto oder die Anmeldung hat sich geändert. Bitte neu laden.',409);
      const {expectedAccessGeneration:gen,expectedSessionContext:session,...semantic}=command;void gen;void session;
      const fingerprint=digest(semantic);
      const previous=(await c.query<{fingerprint:string;result:PersonalResult;action:string}>('SELECT fingerprint,result,action FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2',[account.userId,command.requestId])).rows[0];
      if(previous){if(previous.fingerprint!==fingerprint||previous.action!==command.action)throw new AccountError('conflict','Diese Vorgangskennung gehört zu einer anderen Änderung.',409);return {...previous.result,account,replay:true};}
      const write=async(kind:string,key:string,legacyKey:string,value:unknown,expected:number|null,index:number,merge=false)=>{
        this.faults.beforeWrite?.(index);const rkey=recordKey(kind,account.userId,key);
        const old=(await c.query<{revision:number;payload:Record<string,unknown>}>('SELECT revision,payload FROM stex.personal_records WHERE record_key=$1',[rkey])).rows[0];
        if((old?.revision??null)!==expected)throw new AccountError('conflict','Profil oder Notiz wurde inzwischen geändert. Bitte neu laden.',409);
        const payload=merge?{...old?.payload,...value as object}:value;
        await c.query(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,$3,$4,1,$5,$6::jsonb,'{}') ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,revision=personal_records.revision+1`,[rkey,account.userId,kind,key,legacyKey,JSON.stringify(payload)]);
        return rkey;
      };
      if(command.action==='profile') {
        const stored=(await c.query<{kind:string;revision:number;payload:unknown}>("SELECT kind,revision,payload FROM stex.personal_records WHERE owner_user_id=$1 AND ((kind='profile' AND id='lerntracker-onboarding') OR (kind='exam-date' AND id='lerntracker-exam-date') OR (kind='learning-start' AND id='lerntracker-lernstart'))",[account.userId])).rows;
        for(const [name,kind] of [['profile','profile'],['examDate','exam-date'],['lernstart','learning-start']] as const) {
          if((stored.find(r=>r.kind===kind)?.revision??null)!==command.expectedRevisions[name])throw new AccountError('conflict','Profil oder Termin wurde inzwischen geändert. Bitte neu laden.',409);
        }
        const payload=stored.find(r=>r.kind==='profile')?.payload;
        const old=object(payload)?payload:{};
        const phases=Array.isArray(old.studyPhases)?old.studyPhases as Record<string,unknown>[]:[];
        // Source identity may be omitted or echoed, never attached/changed by a manual patch.
        for(const p of command.fields.studyPhases??[]){const source=phases.find(q=>q.id===p.id)?.sourceDocument;if(p.sourceDocument!==undefined&&p.sourceDocument!==source)invalid('Dokumentbezüge können hier nicht geändert werden.');}
        const merged=mergeProfilePatch(old,command.fields);
        const exam=command.fields.examDate??stored.find(r=>r.kind==='exam-date')?.payload??old.examDate??'';
        const start=command.fields.lernstart??stored.find(r=>r.kind==='learning-start')?.payload??old.lernstart??'';
        if((Object.hasOwn(command.fields,'examDate')||Object.hasOwn(command.fields,'lernstart'))&&exam&&start&&String(start)>String(exam))invalid('Der Lernstart liegt nach dem Examen.');
        if((Object.hasOwn(command.fields,'studyPlanningMode')||Object.hasOwn(command.fields,'studyPhasesEnabled'))&&(merged.studyPhasesEnabled??true)!==((merged.studyPlanningMode??'station')==='station'))invalid('Planungsart und Stationsplanung müssen übereinstimmen.');
        await write('profile','lerntracker-onboarding','lerntracker-onboarding',merged,command.expectedRevisions.profile,0);
        if(Object.hasOwn(command.fields,'examDate'))await write('exam-date','lerntracker-exam-date','lerntracker-exam-date',command.fields.examDate,command.expectedRevisions.examDate,1);
        if(Object.hasOwn(command.fields,'lernstart'))await write('learning-start','lerntracker-lernstart','lerntracker-lernstart',command.fields.lernstart,command.expectedRevisions.lernstart,2);
      }else {
        const old=(await c.query<{payload:PersonalView['notes'][number]['value']}>('SELECT payload FROM stex.personal_records WHERE record_key=$1',[recordKey('learning-entry',account.userId,command.id)])).rows[0]?.payload;
        // Preserve timestamps, source and any existing optional fields when editing a known entry.
        const value={...old,id:command.id,topicId:command.topicId,note:command.note.trim(),source:old?.source??'manual',createdAt:old?.createdAt??new Date().toISOString()};
        const key=await write('learning-entry',command.id,'lerntracker-entries',value,command.expectedRevision,0);
        await c.query('INSERT INTO stex.topics(id) VALUES($1) ON CONFLICT DO NOTHING',[command.topicId]);
        await c.query("DELETE FROM stex.record_references WHERE source_key=$1 AND path='value.topicId'",[key]);
        await c.query("INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_topic_id) VALUES($1,'value.topicId',$2,$1,$3)",[key,account.userId,command.topicId]);
      }
      const result:PersonalResult={...await this.readInTransaction(c,account),requestId:command.requestId,action:command.action,replay:false};
      await c.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,$3,$4,'[]',$5::jsonb)",[account.userId,command.requestId,command.action,fingerprint,JSON.stringify(result)]);
      await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');this.faults.beforeCommit?.();return result;
    });
  }
}
