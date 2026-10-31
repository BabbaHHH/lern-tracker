import {randomBytes} from 'node:crypto';
import type {AccountService} from '../../src/lib/server/auth/service';
import type {SyntheticAccount} from '../pdf-a/fixtures';
import {importSearchFixture} from '../search/catalog-fixture';
import {seedPreparationFixture} from './c3b2a-fixture.mts';
import {WritingService} from '../../src/lib/server/learning/writing-service';
import {recordKey} from '../../src/lib/data-migration/migration';
import {lockState} from '../../src/lib/server/persistence/repository';
import {encryptCredential,credentialFingerprint} from '../../src/lib/server/ai-credentials/crypto';
import {DEFAULT_PROMPTS} from '../../src/lib/prompts';
import {AI_DEFAULTS} from '../../src/lib/ai-config';
export const correctionFakeReply='Synthetisches Feedback: Den Satz kürzer formulieren.\n---MARKER-JSON---\n'+JSON.stringify({markers:[{key:'lange_saetze',label:'Lange Sätze',severity:'mittel'},{key:'praezision',label:'Präzision',severity:'niedrig'}]});
export const correctionDraftFields={title:'C4b eigener synthetischer Entwurf',area:'zr' as const,type:'Urteil' as const,klausurId:'search-synthetic-case',sachverhalt:'Ausschließlich künstlicher Sachverhalt.',contentHtml:'<h2>Tenor</h2><p>Die erste synthetische Formulierung ist lang. Der zweite Satz ist kurz.</p>',contentText:'Tenor\n\nDie erste synthetische Formulierung ist lang. Der zweite Satz ist kurz.'};
export const correctionSecrets=()=>({encryptionKey:randomBytes(32),fingerprintKey:randomBytes(32)});
export async function seedCorrectionAccess(auth:AccountService,owner:SyntheticAccount,secrets:ReturnType<typeof correctionSecrets>){
 if(!owner.name.startsWith('c4b-'))throw Error('Only C4b synthetic users.');const identity={credentialId:'credential-'+owner.name,ownerUserId:owner.name,source:'own' as const},key='sk-or-v1-C4B-SYNTHETIC-'+owner.name;
 await auth.database.transaction(async c=>{await lockState(c);await c.query("INSERT INTO stex.ai_credentials(credential_id,owner_user_id,source,encrypted_key,key_fingerprint,key_suffix,configured,revision) VALUES($1,$2,'own',$3,$4,'0000',true,1)",[identity.credentialId,owner.name,encryptCredential(key,identity,secrets),credentialFingerprint(key,secrets)]);await c.query("INSERT INTO stex.ai_credential_selections(owner_user_id,selected_source,revision) VALUES($1,'own',1)",[owner.name]);});
}
export async function seedCorrectionFixture(auth:AccountService,a:SyntheticAccount){
 if(!a.name.startsWith('c4b-'))throw Error('Only C4b synthetic fixture.');await importSearchFixture(auth,a.headers());await seedPreparationFixture(auth,a,'search-synthetic-case');const writing=new WritingService(auth),v=await writing.read(a.headers());
 await writing.submit(a.headers(),{contractVersion:1,action:'writing',requestId:'c4a_c4b_existing_fixture',expectedAccountId:a.name,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,kind:'draft',id:'c4b-draft',expectedRevision:null,operation:'save',fields:correctionDraftFields});
 const master=DEFAULT_PROMPTS.find(p=>p.id==='korrektur-master')!;
 await auth.database.transaction(async c=>{await lockState(c);
  await c.query("UPDATE stex.personal_records SET payload=payload||$2::jsonb,normalized=normalized||'{\"originalC4b\":true}' WHERE record_key=$1",[recordKey('draft',a.name,'c4b-draft'),JSON.stringify({unknownOriginal:{keep:true},feedback:[{id:'c4b-old-feedback',scope:'gesamt',feedbackText:'Vorhandenes synthetisches Feedback.',markers:[],model:'synthetic/old-model',createdAt:'2026-10-16T08:00:00Z',unknownFeedback:true}]})]);
  const rows=[['correction-settings','lerntracker-korrektur-settings',{model:AI_DEFAULTS.strong.id,granularity:'manuell',unknownSettings:{keep:true}}],['error-profile','lerntracker-fehlerprofil',{markers:{lange_saetze:{label:'Lange Sätze',count:2,trend:'steigend',lastSeen:'2026-10-16T08:00:00Z',byType:{Urteil:1},unknownEntry:true}},updatedAt:'2026-10-16T08:00:00Z',unknownProfile:{keep:true}}],['prompt','korrektur-master',{...master,prompt:master.prompt+'\nC4b eigene gespeicherte Vorlage.'}],['reasoning-settings','lerntracker-ai-reasoning',{[AI_DEFAULTS.strong.id]:'max'}]] as const;
  for(const [kind,id,payload] of rows)await c.query("INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,$3,$4,1,$5,$6::jsonb,'{\"preserveC4b\":true}')",[recordKey(kind,a.name,id),a.name,kind,id,kind==='prompt'?'lerntracker-prompts':id,JSON.stringify(payload)]);
 });
}
