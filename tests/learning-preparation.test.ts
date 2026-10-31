import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {addDays,parseISO} from 'date-fns';
import {testRuntime} from '../scripts/data-migration/postgres-test-runtime';
import {SyntheticAccount,syntheticPassword} from '../scripts/pdf-a/fixtures';
import {importSearchFixture} from '../scripts/search/catalog-fixture';
import {seedPreparationFixture} from '../scripts/data-migration/c3b2a-fixture.mts';
import {AccountService} from '../src/lib/server/auth/service';
import {PreparationService} from '../src/lib/server/learning/preparation-service';
import {preparationHTTP} from '../src/lib/server/learning/http';
import {PreparationClient} from '../src/lib/learning/preparation-client';
import {calculatePreparation,type PreparationState} from '../src/lib/server/learning/preparation-calculation';
import type {PreparationView,PreparationPreview,PreparationInput,PreparationCommand} from '../src/lib/learning/preparation-contract';
import type {PlanRow} from '../src/lib/server/learning/plan-calculation';
import type {DailyTask} from '../src/lib/store';
import {TOPICS,getLeafTopics} from '../src/lib/topics';
import {localDate} from '../src/lib/dates';
import {canonical} from '../src/lib/data-migration/migration';
import {ScheduleService} from '../src/lib/server/learning/schedule-service';
import {scheduleExpected,type ScheduleOperation} from '../src/lib/learning/schedule-contract';
import {PersonalService} from '../src/lib/server/learning/personal-service';
import {profileDraft,profileRevisions} from '../src/lib/learning/personal-contract';
import {PlanService} from '../src/lib/server/learning/plan-service';
import {lockState} from '../src/lib/server/persistence/repository';
import {backup,restore} from '../src/lib/server/persistence/backup';
import {encryptCredential,credentialFingerprint,type CredentialSecrets} from '../src/lib/server/ai-credentials/crypto';
import {AiCredentialService} from '../src/lib/server/ai-credentials/service';
import {PostgresSearchStore} from '../src/lib/server/search/store';
import {SearchWorker} from '../src/lib/server/search/worker';
import {CatalogSearchService} from '../src/lib/server/search/service';
import {ProgressService} from '../src/lib/server/learning/progress-service';

const fixed='2026-10-14',today=localDate(),leaves=getLeafTopics(TOPICS),topic=leaves[0].id;
const day=(date:string,n:number)=>localDate(addDays(parseISO(date),n));
const row=(kind:string,id:string,payload:unknown,deleted=false):PlanRow=>({kind,id,revision:deleted?3:1,payload,normalized:{c3aDeleted:deleted}});
const task=(id:string,fields:Partial<DailyTask>={}):DailyTask=>({id,date:fixed,title:id,durationMinutes:90,source:'plan',done:false,createdAt:`${fixed}T00:00:00Z`,...fields});
function pure(rows:PlanRow[]=[],fields:Record<string,unknown>={}):PreparationState{return {rows:[row('profile','lerntracker-onboarding',{examDate:day(fixed,30),...fields}),...rows],catalog:[],references:[],protectedTaskIds:new Set(),derivedIds:new Set(rows.filter(r=>r.kind==='task').map(r=>r.id)),proof:'a'.repeat(64)};}
test('C3b2a: reine Vorbereitung bleibt schreibfrei und liefert dieselben 90-Minuten-Slots',()=>{
 const state=pure(),before=canonical(state.rows),a=calculatePreparation(state,'owner',[fixed],fixed),b=calculatePreparation(state,'owner',[fixed],fixed);
 assert.equal(canonical(state.rows),before);assert.deepEqual(a,b);assert.equal(a.created,2);assert.ok(a.changes.every(c=>(c.after as DailyTask).durationMinutes===90));
});
test('C3b2a: fällige Wiederholung aus bestätigter Historie bevorzugt; keine Browserdaten',()=>{
 const state=pure([row('tracking-entry','review-start',{id:'review-start',date:day(fixed,-2),activityType:'theorie',topicIds:[topic],durationMinutes:45,createdAt:`${fixed}T00:00:00Z`})]);
 const result=calculatePreparation(state,'owner',[fixed],fixed);assert.equal((result.changes[0].after as DailyTask).isReview,true);assert.equal((result.changes[0].after as DailyTask).linkedTopicId,topic);
});
test('C3b2a: Nachholung vor Füllung, freie/Urlaubs-/Examens-/Planzeitraumgrenzen',()=>{
 const state=pure([row('task','overdue',task('overdue',{date:day(fixed,-1)}))],{vacationDates:[fixed]});const r=calculatePreparation(state,'owner',[fixed,day(fixed,1)],fixed);const moved=r.changes.find(c=>c.id==='overdue')!.after as DailyTask;assert.equal(moved.date,day(fixed,1));assert.equal(moved.rescheduledFrom,day(fixed,-1));assert.equal(r.created,0);
 assert.equal(calculatePreparation(pure([],{}),'owner',['2026-10-18'],fixed).created,0);
 const range=pure([row('plan-range','lerntracker-plan-applied-range',{start:fixed,end:day(fixed,1)})]);assert.equal(calculatePreparation(range,'owner',[fixed],fixed).created,0);
 for(const date of [day(fixed,-1),day(fixed,30),day(fixed,91)])assert.throws(()=>calculatePreparation(pure(),'owner',[date],fixed),/90 Tage|Examen/);
});
test('C3b2a: manuell/fest/erledigt/später bearbeitet und gekoppelte Klausur bleiben unverändert',()=>{
 const rows=[row('task','manual',task('manual',{source:'manual',date:day(fixed,-1)})),row('task','done',task('done',{done:true})),row('task','fixed',task('fixed',{recurringKey:`ag|id:known|${fixed}|main`})),row('task','edited',task('edited')),row('task','case',task('case',{date:day(fixed,-1),calendarEventId:'slot',linkedKlausurId:'known',durationMinutes:300}))];const state=pure(rows);state.protectedTaskIds=new Set(['edited']);const original=canonical(state.rows),r=calculatePreparation(state,'owner',[fixed],fixed);assert.equal(canonical(state.rows),original);assert.ok(rows.every(row=>!r.changes.some(c=>c.id===row.id)));assert.ok(r.backlog.some(b=>b.task.id==='case'&&b.reason.includes('Kalendertermin')));
});
test('C3b2a: Überlast erhält alle IDs als Rückstand; bestehende Autos weichen Planarbeit ohne Löschung',()=>{
 const rows=[row('task','planned',task('planned',{date:day(fixed,-1),durationMinutes:300})),row('task','auto1',task('auto1',{source:'auto'})),row('task','auto2',task('auto2',{source:'auto'}))];const result=calculatePreparation(pure(rows),'owner',[fixed],fixed);assert.equal((result.changes.find(c=>c.id==='planned')!.after as DailyTask).date,fixed);assert.ok(result.changes.some(c=>c.id==='auto2'&&(c.after as DailyTask).date>fixed));assert.ok(result.changes.every(c=>c.after!==null));
 const impossible=calculatePreparation(pure([row('task','too-long',task('too-long',{durationMinutes:600,date:day(fixed,-1)}))],{maxDailyHours:1,examDate:day(fixed,1)}),'owner',[fixed],fixed);assert.equal((impossible.changes[0].after as DailyTask).deferred,true);assert.ok(impossible.backlog.some(b=>b.task.id==='too-long'));
});
test('C3b2a: gelöschte Auto-Slots und wiederkehrende Aufgaben/Termine werden nicht ersetzt',()=>{
 const retired=leaves.slice(0,2).map((t,i)=>row('task',`gone${i}`,task(`gone${i}`,{source:'auto',linkedTopicId:t.id}),true));assert.equal(calculatePreparation(pure(retired),'owner',[fixed],fixed).created,0);
 const entry={id:'known',label:'AG Quelle',day:'Mittwoch',durationHours:2,prepHours:0,postHours:0,startDate:fixed,endDate:fixed};
 const deleted=row('task','gone-ag',task('gone-ag',{title:'AG Quelle (2h)',recurringKey:`ag|id:known|${fixed}|main`,durationMinutes:120}),true);assert.equal(calculatePreparation(pure([deleted],{ags:[entry]}),'owner',[fixed],fixed).changes.some(c=>(c.after as DailyTask).recurringKey?.startsWith('ag|')),false);
 const calendar=row('calendar-event','gone-event',{id:'gone-event',date:fixed,label:'AG Quelle',eventType:'ag',recurring:false,durationMinutes:120},true);assert.equal(calculatePreparation(pure([calendar],{ags:[entry]}),'owner',[fixed],fixed).changes.some(c=>(c.after as DailyTask).recurringKey?.startsWith('ag|')),false);
});
test('C3b2a: bereits verschobene Autos verbrauchen ihren ursprünglichen semantischen Slot',()=>{
 const rows=leaves.slice(0,2).map((topic,i)=>row('task',`moved-auto${i}`,task(`moved-auto${i}`,{source:'auto',date:day(fixed,1),rescheduledFrom:fixed,deferred:false,linkedTopicId:topic.id})));
 const result=calculatePreparation(pure(rows),'owner',[fixed],fixed);assert.equal(result.created,0);assert.equal(result.changes.length,0);
});
test('C3b2a: AG-Korrektur und Vor-/Nachbereitung erst in bestätigter Änderungsliste',()=>{
 const state=pure([row('ag-week','2026-W42',{weekKey:'2026-W42',agDays:[2]})],{ags:[{id:'known',label:'AG Quelle',day:'Montag',durationHours:3,prepHours:1,postHours:0.5,startDate:fixed,endDate:fixed}]});const r=calculatePreparation(state,'owner',[fixed],fixed);assert.ok(r.changes.some(c=>(c.after as DailyTask).title==='AG Quelle (3h)'));assert.ok(r.changes.some(c=>(c.after as DailyTask).title==='Nachb. AG Quelle (0.5h)'));assert.equal(r.changes.filter(c=>(c.after as DailyTask).source==='auto').length,2);
});
test('C3b2a: offene Dauer/ungültige Quelle/Profil schließen gesamte Vorbereitung',()=>{
 for(const state of [pure([row('task','unknown',task('unknown',{durationMinutes:undefined}))]),pure([row('task','done-unknown',task('done-unknown',{durationMinutes:undefined,done:true}))]),pure([row('calendar-event','unknown',{id:'unknown',date:fixed,label:'Quelltermin',eventType:'ag',recurring:false})]),pure([],{maxDailyHours:0}),pure([],{vacationDates:['falsch']}),pure([],{ags:[{id:'x',label:'Quelle',day:'Falsch',durationHours:2}]}),pure([],{ags:[{id:'same',label:'A',day:'Montag',durationHours:2},{id:'same',label:'B',day:'Dienstag',durationHours:2}]}),pure([],{studyPhases:[{id:'invalid'}]})]){const before=canonical(state.rows);assert.throws(()=>calculatePreparation(state,'owner',[fixed],fixed));assert.equal(canonical(state.rows),before);}
});
test('DATA-C3b2a: echte PostgreSQL-/AUTH-/HTTP-Vorbereitung und vollständiger Restore',{timeout:180000},async t=>{
 const runtime=await testRuntime();let repository=await runtime.repository('preparation_source');
 const secret=randomBytes(48).toString('hex'),mailKey=randomBytes(48).toString('hex'),backupKey=randomBytes(48).toString('hex');
 let auth:AccountService,service:PreparationService,drop=false;
 const server=createServer(async(req,res)=>{try{const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));const request=new Request(`${base}${req.url}`,{method:req.method,headers:new Headers(req.headers as Record<string,string>),body:chunks.length?Buffer.concat(chunks):undefined});const kind=req.url?.includes('/commands/')?'status':req.url?.endsWith('/preview')?'preview':'main';const response=await preparationHTTP(request,service,kind,kind==='status'?req.url!.split('/').at(-1):undefined);if(drop&&req.method==='POST'&&response.ok){drop=false;res.destroy();return;}res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.statusCode=500;res.end();}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();if(!address||typeof address==='string')throw Error('Testport fehlt');const base=`http://127.0.0.1:${address.port}`;
 auth=new AccountService({database:repository.database,files:repository.files,baseURL:base,secret,mailKey});service=new PreparationService(auth);
 const a=new SyntheticAccount(auth,'prep-a'),b=new SyntheticAccount(auth,'prep-b'),pending=new SyntheticAccount(auth,'prep-pending');await a.initialize();await b.initialize();await pending.initialize(false);
 t.after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await runtime.close();});
 const input=async(dates=[day(today,1)],owner=a):Promise<PreparationInput>=>{const v=await service.read(owner.headers());return {contractVersion:1,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,dates,snapshot:v.snapshot};};
 const command=async(requestId:string,dates=[day(today,1)],owner=a):Promise<PreparationCommand>=>({...await input(dates,owner),action:'preparation',requestId});
 const rows=async()=> (await repository.database.pool.query('SELECT kind,id,revision,payload,normalized FROM stex.personal_records WHERE owner_user_id=$1 ORDER BY kind,id',[a.name])).rows;
 const write=async(id:string,op:ScheduleOperation,owner=a)=>{const schedule=new ScheduleService(auth),v=await schedule.read(owner.headers());return schedule.submit(owner.headers(),{contractVersion:1,action:'schedule',requestId:id,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,operation:op,expected:scheduleExpected(v,op)});};
 const forPreview=(c:PreparationCommand):PreparationInput=>{const {action,requestId,...input}=c;void action;void requestId;return input;};
 const post=async(body:unknown,owner=a,path='')=>{const headers=owner.headers();headers.set('origin',base);headers.set('content-type','application/json');headers.set('x-stex-action','1');return preparationHTTP(new Request(`${base}/api/learning/preparation${path}`,{method:'POST',headers,body:JSON.stringify(body)}),service,path==='/preview'?'preview':'main');};
 await t.test('Lesen und Vorschau ohne persönliche/Defaultschreibvorgänge; aktive AUTH und private Besitzer',async()=>{
  const initial=await rows();assert.deepEqual((await service.read(a.headers())).backlog,[]);const p=await service.preview(a.headers(),await input());assert.ok(p.changes.length);assert.deepEqual(await rows(),initial);assert.equal((await post({...await command('c3b2a_pending')},pending)).status,403);assert.equal((await post({...await command('c3b2a_foreign')},b)).status,409);
  await importSearchFixture(auth,a.headers());await seedPreparationFixture(auth,a,'search-synthetic-case');
 });
 let applied:PreparationCommand;
 await t.test('Übernahme berechnet dieselben IDs, erhält C1/C2/C3a/C3b1/Quellen, schreibt vollständig atomar',async()=>{
  const before=await rows(),c=await command('c3b2a_apply',[day(today,1),day(today,2)]),p=await service.preview(a.headers(),forPreview(c));assert.deepEqual(await rows(),before);
  const result=await service.submit(a.headers(),c);applied=c;assert.deepEqual(result.changes.map(c=>c.id).sort(),p.changes.map(c=>c.id).sort());
  const after=await rows();for(const r of before.filter(r=>r.kind!=='task'||['prep-existing-manual','prep-existing-done','prep-existing-deleted'].includes(r.id)))assert.deepEqual(after.find(x=>x.kind===r.kind&&x.id===r.id),r);
  assert.ok(after.some(r=>r.kind==='task'&&(r.payload as DailyTask).source==='auto'),'Current exact derived receipts remain eligible and new auto slots persist');
  const receipt=(await repository.database.pool.query('SELECT before_values,result FROM stex.learning_commands WHERE request_id=$1',[c.requestId])).rows[0];assert.deepEqual(receipt.result.input,c);assert.equal(receipt.before_values.length,p.changes.length);assert.ok(receipt.before_values.some((v:{afterReferences:unknown[]})=>v.afterReferences.length));assert.equal((await service.read(b.headers())).backlog.length,0);
  const repeat=await service.preview(a.headers(),await input([day(today,1),day(today,2)]));assert.equal(repeat.changes.length,0,'A new preview does not normalize already confirmed auto slots or create duplicates');
 });
 await t.test('Gleicher/widersprüchlicher Replay; keine neuen IDs, private Vorgangsabfrage',async()=>{
  const before=await rows();assert.equal((await service.submit(a.headers(),applied)).replay,true);assert.deepEqual(await rows(),before);await assert.rejects(service.submit(a.headers(),{...applied,dates:[day(today,3)]}),/Vorgangskennung/);await assert.rejects(service.status(b.headers(),applied.requestId),/nicht gefunden/);assert.equal((await service.status(a.headers(),applied.requestId)).view.snapshot,(await service.read(a.headers())).snapshot);
 });
 await t.test('Konkurrierende neue private Aufgabe invalidiert Vorschau; fremder Besitzer nicht',async()=>{
  const old=await command('c3b2a_concurrent',[day(today,3)]);await write('c3a_prep_foreign',{type:'task.save',id:'foreign',date:today,title:'Nur B',durationMinutes:30,topicIds:[],isReview:false},b);assert.equal((await service.read(a.headers())).snapshot,old.snapshot);
  await write('c3a_prep_new',{type:'task.save',id:'new-after-preview',date:day(today,3),title:'Neue manuelle Verpflichtung',durationMinutes:420,topicIds:[],isReview:false});const before=await rows();await assert.rejects(service.submit(a.headers(),old),/Planungsgrundlage/);assert.deepEqual(await rows(),before);
 });
 await t.test('Profil, AG, Katalog und neue Referenzen invalidieren eingefrorene Grundlage',async()=>{
  const c=await command('c3b2a_profile',[day(today,4)]),personal=new PersonalService(auth),v=await personal.read(a.headers());await personal.submit(a.headers(),{contractVersion:1,action:'profile',requestId:'c2_prep_concurrent',expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,expectedRevisions:profileRevisions(v),fields:{...profileDraft(v),bundesland:'Hamburg'}});await assert.rejects(service.submit(a.headers(),c),/Planungsgrundlage/);
  const ag=await command('c3b2a_ag');await write('c3a_prep_ag',{type:'ag.save',id:'2026-W42',agDays:[2]});await assert.rejects(service.submit(a.headers(),ag),/Planungsgrundlage/);
  const catalog=await command('c3b2a_catalog');await repository.database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.catalog_records SET revision=revision+1 WHERE kind='klausur' AND id='search-synthetic-case'");});await assert.rejects(service.submit(a.headers(),catalog),/Planungsgrundlage/);
  const ref=await command('c3b2a_new_reference'),note=await personal.read(a.headers());await personal.submit(a.headers(),{contractVersion:1,action:'note',requestId:'c2_prep_reference',expectedAccountId:note.account.userId,expectedAccessGeneration:note.account.accessGeneration,expectedSessionContext:note.account.sessionContext,id:'new-own-note-reference',topicId:topic,note:'Neue private Referenz',expectedRevision:null});await assert.rejects(service.submit(a.headers(),ref),/Planungsgrundlage/);
 });
 await t.test('Mehrzeilen-/Commitfehler lassen keine Teilaufgaben/Referenzen/Belege zurück',async()=>{
  const c=await command('c3b2a_fault',[day(today,5),day(today,7)]),before=await rows(),references=(await repository.database.pool.query('SELECT * FROM stex.record_references WHERE owner_user_id=$1 ORDER BY source_key,path',[a.name])).rows;assert.ok((await service.preview(a.headers(),forPreview(c))).changes.length>=2);
  for(const faults of [{beforeWrite:(n:number)=>{if(n===1)throw Error('partial');}},{beforeCommit:()=>{throw Error('commit');}}]){await assert.rejects(new PreparationService(auth,faults).submit(a.headers(),c),/partial|commit/);assert.deepEqual(await rows(),before);assert.deepEqual((await repository.database.pool.query('SELECT * FROM stex.record_references WHERE owner_user_id=$1 ORDER BY source_key,path',[a.name])).rows,references);await assert.rejects(service.status(a.headers(),c.requestId),/nicht gefunden/);}
 });
 await t.test('Ableitung mit späterer unbelegter Revision wird gehalten, auch ohne task.save',async()=>{
  const current=await rows(),candidate=current.find(r=>r.kind==='task'&&(r.payload as DailyTask).source==='auto')!;assert.ok(candidate);
  await repository.database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.personal_records SET revision=revision+1 WHERE owner_user_id=$1 AND kind='task' AND id=$2",[a.name,candidate.id]);});
  const changed=(await rows()).find(r=>r.id===candidate.id)!;const result=await service.preview(a.headers(),await input([(candidate.payload as DailyTask).date]));assert.ok(!result.changes.some(c=>c.id===candidate.id));await service.submit(a.headers(),await command('c3b2a_unproved_revision',[(candidate.payload as DailyTask).date]));assert.deepEqual((await rows()).find(r=>r.id===candidate.id),changed);
 });
 await t.test('Separate Lernstartrevision gehört zur Vorbereitung und invalidiert Vorschau',async()=>{
  const c=await command('c3b2a_start_changed');await repository.database.transaction(async client=>{await lockState(client);await client.query("UPDATE stex.personal_records SET revision=revision+1 WHERE owner_user_id=$1 AND kind='learning-start'",[a.name]);});await assert.rejects(service.submit(a.headers(),c),/Planungsgrundlage/);
 });
 await t.test('Tombstone-Slots und später manuell bearbeitete Autoaufgabe bleiben geschützt',async()=>{
  const s=new ScheduleService(auth),v=await s.read(a.headers()),autos=v.records.filter(r=>r.kind==='task'&&(r.value as DailyTask).source==='auto');assert.ok(autos.length>=2);
  const first=autos[0].value as DailyTask;await write('c3a_prep_edit_auto',{type:'task.save',id:first.id,date:first.date,title:'Bewusst bearbeiteter Autoauftrag',durationMinutes:60,topicIds:[first.linkedTopicId!],isReview:!!first.isReview});
  const edited=(await rows()).find(r=>r.id===first.id);const target=autos.at(-1)!.value as DailyTask;await write('c3a_prep_delete_auto',{type:'task.delete',id:target.id});const before=await rows(),c=await command('c3b2a_protected',[first.date,target.date].filter((d,i,all)=>all.indexOf(d)===i));await service.submit(a.headers(),c);const after=await rows();assert.deepEqual(after.find(r=>r.id===first.id),edited);assert.deepEqual(after.find(r=>r.id===target.id),before.find(r=>r.id===target.id));assert.equal(after.some(r=>r.kind==='task'&&r.id!==target.id&&(r.payload as {recurringKey?:string}).recurringKey===target.recurringKey),false);
 });
 await t.test('Offene Dauer und übergroße/falsche Eingaben schließen Gesamtaktion',async()=>{
  const c=await command('c3b2a_limits');assert.equal((await post({...c,dates:[]})).status,400);assert.equal((await post({...c,dates:Array.from({length:8},(_,n)=>day(today,n))})).status,400);assert.equal((await post({...c,dates:[today,today]})).status,400);assert.equal((await post({...c,changes:[]})).status,400);assert.equal((await post({...c,extra:'x'.repeat(300000)})).status,413);assert.equal((await post({...c,dates:[day(today,-1)]})).status,400);
  await write('c3a_prep_unknown',{type:'event.save',id:'unknown',date:today,label:'Offene Quellzeit',eventType:'ag',recurring:false});const before=await rows();await assert.rejects(service.submit(a.headers(),await command('c3b2a_unknown')),/Dauer.*offen/);assert.deepEqual(await rows(),before);await write('c3a_prep_unknown_fix',{type:'event.save',id:'unknown',date:today,label:'Offene Quellzeit',eventType:'ag',recurring:false,durationMinutes:60});
 });
 await t.test('Echter lokaler HTTP-Antwortverlust nach Commit: Belegprüfung und frischer Stand ohne Duplikate',async()=>{
  const transport:typeof fetch=async(path,init)=>{const headers=new Headers(init?.headers);for(const [k,v] of a.headers())headers.set(k,v);headers.set('origin',base);return fetch(`${base}${path}`,{...init,headers});};const client=new PreparationClient(transport);await client.load();const view=client.state.view!,p=await client.preview([day(today,8)],view);assert.ok(p);drop=true;await client.submit(p,view);assert.equal(client.state.uncertain,true);const before=await rows();await client.recover();assert.equal(client.state.status,'ready');assert.equal(client.state.uncertain,false);assert.deepEqual(await rows(),before);assert.equal(client.state.view!.snapshot,(await service.read(a.headers())).snapshot);
 });
 await t.test('Abmeldung/neue Anmeldung verwirft alte Formulare und historischen Replay-Kontext',async()=>{
  const old=await command('c3b2a_old_session');await a.auth('/sign-out',{});await assert.rejects(service.submit(a.headers(),old));await a.auth('/sign-in/email',{email:`${a.name}@example.test`,password:syntheticPassword});await assert.rejects(service.submit(a.headers(),old),/Anmeldung/);await assert.rejects(service.submit(a.headers(),applied),/Anmeldung/);
 });
 await t.test('Sperre innerhalb der Transaktionsgrenze verhindert neue Aktion und Beleg-Replay',async()=>{
  const c=await command('c3b2a_b_saved',[day(today,1)],b);await service.submit(b.headers(),c);const next=await command('c3b2a_b_block',[day(today,2)],b);await assert.rejects(new PreparationService(auth,{beforeTransaction:async()=>{await repository.database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id=$1",[b.name]);await c.query('UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1',[b.name]);});}}).submit(b.headers(),next));await assert.rejects(service.status(b.headers(),c.requestId));
 });
 await t.test('Tatsächlicher Prozessneustart und Format-4-Vollrestore derselben bearbeiteten Fixture',async()=>{
  const secrets:CredentialSecrets={encryptionKey:randomBytes(32),fingerprintKey:randomBytes(32)},fakeKey='sk-or-v1-PREPARATION-SYNTHETIC-0000';
  process.env.STEX_AI_CREDENTIAL_ENCRYPTION_KEY=secrets.encryptionKey.toString('hex');process.env.STEX_AI_CREDENTIAL_FINGERPRINT_KEY=secrets.fingerprintKey.toString('hex');
  const identity={credentialId:'prep-key',ownerUserId:a.name,source:'own' as const};await repository.database.transaction(async c=>{await lockState(c);await c.query("INSERT INTO stex.ai_credentials(credential_id,owner_user_id,source,encrypted_key,key_fingerprint,key_suffix,configured,revision) VALUES($1,$2,'own',$3,$4,'0000',true,1)",[identity.credentialId,a.name,encryptCredential(fakeKey,identity,secrets),credentialFingerprint(fakeKey,secrets)]);await c.query("INSERT INTO stex.ai_credential_selections(owner_user_id,selected_source,revision) VALUES($1,'off',1)",[a.name]);});
  const before=await rows(),priorPlan=(await new PlanService(auth).read(a.headers())).history,priorView=await service.read(a.headers());const backupDirectory=join(runtime.root,'preparation-full-backup');await backup(repository.database,repository.files,backupDirectory,{encryptionKey:backupKey,authSecret:secret});
  repository=await runtime.restart('preparation_source',repository.files);auth=new AccountService({database:repository.database,files:repository.files,baseURL:base,secret,mailKey});service=new PreparationService(auth);assert.deepEqual(await rows(),before);const restarted=new SyntheticAccount(auth,a.name);await restarted.auth('/sign-in/email',{email:`${a.name}@example.test`,password:syntheticPassword});assert.deepEqual((await service.read(restarted.headers())).backlog,priorView.backlog);
  const target=await runtime.repository('preparation_restore');await restore(target.database,target.files,backupDirectory,{encryptionKey:backupKey,authSecret:secret});const restoredAuth=new AccountService({database:target.database,files:target.files,baseURL:base,secret,mailKey}),newA=new SyntheticAccount(restoredAuth,a.name);await assert.rejects(new PreparationService(restoredAuth).read(restarted.headers()));await newA.auth('/sign-in/email',{email:`${a.name}@example.test`,password:syntheticPassword});const restored=new PreparationService(restoredAuth);assert.deepEqual((await restored.read(newA.headers())).backlog,priorView.backlog);assert.deepEqual((await new PlanService(restoredAuth).read(newA.headers())).history,priorPlan);assert.equal((await new ProgressService(restoredAuth).read(newA.headers())).progress.find(r=>r.id===topic)?.value.percent,18);assert.ok((await new PersonalService(restoredAuth).read(newA.headers())).notes.some(n=>(n.value as {note?:string}).note==='C3b2a erhält persönliche Lernnotiz'));assert.equal(((await new AiCredentialService(restoredAuth,secrets).ownerStatus(newA.headers())) as {selection:{source:string}}).selection.source,'off');const worker=new SearchWorker(new PostgresSearchStore(target.database),target.files);for(let n=0;await worker.step();n++)assert.ok(n<30);assert.equal((await new CatalogSearchService(restoredAuth).search(newA.headers(),{text:'Bestätigungsschreiben'})).hits.length,2);
 });
});
const fakeView=(owner:string,session=owner):PreparationView=>({contractVersion:1,account:{userId:owner,accessGeneration:1,sessionContext:session},snapshot:'a'.repeat(64),today:fixed,end:day(fixed,90),backlog:[]});
const fakePreview=(view:PreparationView):PreparationPreview=>({...view,dates:[fixed],changes:[],created:0,moved:0,deferred:0,warnings:[]});
test('C3b2a-Client: alte Formulare und späte Bestätigung/Vorschau bei A/B/neuer Sitzung verworfen',async()=>{
 let current=fakeView('a'),finish:((r:Response)=>void)|null=null,posts=0;const transport:typeof fetch=async(_path,init)=>{if(init?.method==='POST'){posts++;return new Promise<Response>(r=>{finish=r;});}return Response.json(current);};const client=new PreparationClient(transport);await client.load();const old=client.state.view!,saving=client.submit(fakePreview(old),old);client.hide();current=fakeView('b');await client.load();(finish as unknown as (r:Response)=>void)(Response.json({contractVersion:1,action:'preparation',account:old.account}));await saving;assert.equal(client.state.view?.account.userId,'b');assert.equal(await client.submit(fakePreview(old),old),null);assert.equal(posts,1);
 const b=client.state.view!,preview=client.preview([fixed],b);client.hide();current=fakeView('b','new-login');await client.load();(finish as unknown as (r:Response)=>void)(Response.json(fakePreview(b)));await preview;assert.equal(client.state.preview,null);assert.equal(client.state.view?.account.sessionContext,'new-login');
});
