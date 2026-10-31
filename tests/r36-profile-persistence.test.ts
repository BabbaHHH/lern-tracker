import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { testRuntime } from '../scripts/data-migration/postgres-test-runtime';
import { SyntheticAccount, syntheticPassword } from '../scripts/pdf-a/fixtures';
import { AccountService } from '../src/lib/server/auth/service';
import { PersonalService } from '../src/lib/server/learning/personal-service';
import { ScheduleService } from '../src/lib/server/learning/schedule-service';
import { PlanService } from '../src/lib/server/learning/plan-service';
import { personalHTTP } from '../src/lib/server/learning/http';
import { PersonalClient } from '../src/lib/learning/personal-client';
import { profileDraft,manualProfileDraft,profileRevisions,type ProfilePatch,type ProfileFields,type ProfileCommand } from '../src/lib/learning/personal-contract';
import { profileBudgetProjection } from '../src/lib/learning/profile-fields';
import { LEARNING_BODY_LIMIT } from '../src/lib/learning/progress-contract';
import { calculatePlan,planSettings,type PlanRow } from '../src/lib/server/learning/plan-calculation';
import { computeDayBudget,dailyHours,isStudyFreeDay,planningEvents,eventsOnDate } from '../src/lib/day-budget';
import { TOPICS,getLeafTopics } from '../src/lib/topics';
import { recordKey } from '../src/lib/data-migration/migration';
import { lockState } from '../src/lib/server/persistence/repository';

const topic=getLeafTopics(TOPICS)[0].id;
const legacy:ProfileFields={bundesland:'Berlin',examDate:'2027-06-01',lernstart:'2026-10-01',refStartDate:'2026-02-01',studyPlanningMode:'station',studyPhasesEnabled:true,studyPhases:[{id:'phase-a',label:'Zivilstation',start:'2026-10-01',end:'2026-12-31',focus:'zr',perspective:'state'}]};
const common={label:'Manueller Termin',day:'Montag',durationHours:2,prepHours:0.5,postHours:0.5,startDate:'2026-10-01',endDate:'2027-02-01'};
const full:ProfileFields={...legacy,completed:true,maxDailyHours:5,freeDayPerWeek:'Sonntag',vacationDates:['2026-10-28'],
  ags:[{...common,id:'ag-a',label:'AG Zivilrecht',frequency:'wöchentlich',topic:'Zivilrecht'}],
  reps:[{...common,id:'rep-a',label:'Rep',day:'Dienstag'}],
  lerngruppen:[{...common,id:'group-a',label:'Lerngruppe',day:'Donnerstag',frequency:'14-tägig'}],
  sonstiges:[{id:'other-a',label:'Sport',day:'Freitag',frequency:'wöchentlich',durationHours:1,startDate:'',endDate:''}],
  kaiserSeminare:[{date:'2026-10-29',topic:'Zivilrecht',durationDays:2}],probeexamen1Start:'2026-11-02',probeexamen2Start:'2027-02-01',selfAssessment:{[topic]:60,[TOPICS[0].id]:40},notes:'Eigene Profilnotiz — äöü'};

test('R36-B1: vollständiges Profil über echte isolierte PostgreSQL-Datenbank und reguläre Sitzungen',{timeout:120000},async t=>{
  const runtime=await testRuntime();t.after(async()=>{await runtime.close();await assert.rejects(access(runtime.root));});
  let repository=await runtime.repository('r36_profile');
  const base='http://localhost:32187',secret=randomBytes(48).toString('hex'),mailKey=randomBytes(48).toString('hex');
  let auth=new AccountService({database:repository.database,files:repository.files,baseURL:base,secret,mailKey}),service=new PersonalService(auth);
  const a=new SyntheticAccount(auth,'r36-profile-a'),b=new SyntheticAccount(auth,'r36-profile-b');await a.initialize();await b.initialize();
  const rows=async()=> (await repository.database.pool.query<PlanRow>('SELECT kind,id,revision,payload,normalized FROM stex.personal_records WHERE owner_user_id=$1 ORDER BY kind,id',[a.name])).rows;
  const raw=async()=> (await rows()).find(r=>r.kind==='profile')!.payload as Record<string,unknown>;
  let sequence=0;
  const command=async(fields:ProfilePatch,owner=a):Promise<ProfileCommand<ProfilePatch>>=>{
    const v=await service.read(owner.headers());return {contractVersion:1,action:'profile',requestId:`c2_r36_${++sequence}`,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,fields,expectedRevisions:profileRevisions(v)};
  };
  const post=async(input:unknown,owner=a)=>{
    const headers=owner.headers();headers.set('origin',base);headers.set('x-stex-action','1');headers.set('content-type','application/json');
    return personalHTTP(new Request(`${base}/api/learning/personal`,{method:'POST',headers,body:JSON.stringify(input)}),service);
  };
  await t.test('Lesen und Entwurfsdefaults erzeugen keine Profil-/Termin-/IDdaten',async()=>{
    const before=await rows(),generation=(await repository.database.pool.query('SELECT generation FROM stex.state')).rows;
    for(let i=0;i<2;i++){const v=await service.read(a.headers());assert.equal(v.profile,null);assert.equal(profileDraft(v).studyPhases.length,0);assert.equal(manualProfileDraft(v).maxDailyHours,7);assert.deepEqual(manualProfileDraft(v).reps,[]);assert.deepEqual((await new ScheduleService(auth).read(a.headers())).settings,{});}
    assert.deepEqual(await rows(),before);assert.deepEqual((await repository.database.pool.query('SELECT generation FROM stex.state')).rows,generation);
  });
  await t.test('Vollständiger HTTP-/Client-Roundtrip; alte Extras und Quellen bleiben exakt erhalten',async()=>{
    const seed={...legacy,documents:[{id:'private-doc',name:'Quellplan',fullText:'Geschützter Parsertext'}],extra:{keep:true},studyPhases:[{...legacy.studyPhases[0],sourceDocument:'Quellplan',extra:'phase-extra'}],
      kaiserSeminare:[{...full.kaiserSeminare![0],extra:'seminar-extra'}],
      reps:[{...full.reps![0],scheduleDocIndex:0,schedule:[{date:'2026-10-27',title:'Parsertermin',content:'Geschützter Text',topicIds:[topic]}],extra:'rep-extra'}]};
    await repository.database.transaction(async c=>{await lockState(c);await c.query("INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,'profile','lerntracker-onboarding',1,'lerntracker-onboarding',$3::jsonb,'{}')",[recordKey('profile',a.name,'lerntracker-onboarding'),a.name,JSON.stringify(seed)]);});
    const transport:typeof fetch=async(path,options)=>{const headers=a.headers();new Headers(options?.headers).forEach((v,k)=>headers.set(k,v));headers.set('origin',base);return personalHTTP(new Request(`${base}${path}`,{...options,headers}),service);};
    const client=new PersonalClient(transport);await client.load();const view=client.state.view!;
    assert.equal((view.profile!.value as Record<string,unknown>).documents,undefined);assert.equal((view.profile!.value.reps![0] as unknown as Record<string,unknown>).schedule,undefined);
    const saved=await client.saveProfile(full,profileRevisions(view),view.account);assert.ok(saved);assert.equal(client.state.message,'Gespeichert');client.hide();
    const expected={...full,studyPhases:[{...legacy.studyPhases[0],sourceDocument:'Quellplan'}]};assert.deepEqual(saved.profile!.value,expected);
    const stored=await raw();assert.deepEqual(stored.documents,seed.documents);assert.deepEqual(stored.extra,seed.extra);
    assert.equal((stored.studyPhases as Record<string,unknown>[])[0].extra,'phase-extra');assert.equal((stored.kaiserSeminare as Record<string,unknown>[])[0].extra,'seminar-extra');assert.deepEqual((stored.reps as Record<string,unknown>[])[0].schedule,seed.reps[0].schedule);assert.equal((stored.reps as Record<string,unknown>[])[0].scheduleDocIndex,0);
    assert.equal((await rows()).filter(r=>['task','calendar-event'].includes(r.kind)).length,0);
  });
  await t.test('Antwortverlust nach echtem Commit wird per Status ohne erneute Teilprofilspeicherung aufgeklärt',async()=>{
    let drop=true,writes=0;
    const client=new PersonalClient(async(path,options)=>{
      const headers=a.headers();new Headers(options?.headers).forEach((v,k)=>headers.set(k,v));headers.set('origin',base);
      const response=await personalHTTP(new Request(`${base}${path}`,{...options,headers}),service,String(path).includes('/commands/')?String(path).split('/').at(-1):undefined);
      if(options?.method==='POST'){writes++;if(drop&&response.ok){drop=false;throw new TypeError('synthetic-response-loss');}}
      return response;
    });
    await client.load();const v=client.state.view!;await client.saveProfile({maxDailyHours:5},profileRevisions(v),v.account);assert.equal(client.state.uncertain,true);
    const committed=await rows();await client.recover();assert.equal(client.state.status,'ready');assert.equal(client.state.uncertain,false);assert.equal(writes,1);assert.deepEqual(await rows(),committed);client.hide();
  });
  await t.test('Sieben-Feld-Altclient und kleines Patch löschen keine neuen Daten; separater Lernstart bleibt maßgeblich',async()=>{
    const before=await raw(),v=await service.read(a.headers());await service.submit(a.headers(),await command({...legacy,studyPhases:v.profile!.value.studyPhases!,bundesland:'Hamburg'}));
    const after=await raw();for(const k of Object.keys(full).filter(k=>!Object.hasOwn(legacy,k)))assert.deepEqual(after[k],before[k]);
    const beforeDates=(await rows()).filter(r=>r.kind==='exam-date'||r.kind==='learning-start');
    await service.submit(a.headers(),await command({notes:'Geänderte Notiz'}));assert.deepEqual((await rows()).filter(r=>r.kind==='exam-date'||r.kind==='learning-start'),beforeDates);
    const datePatch=await command({lernstart:'2026-10-03'});await service.submit(a.headers(),datePatch);assert.equal(planSettings(await rows()).lernstart,'2026-10-03');
    const plan=new PlanService(auth,{today:()=> '2026-10-26'});assert.ok((await plan.read(a.headers())).snapshot);
  });
  await t.test('Budget- und Planvorschau nutzen dieselben Listen, freien Tage, Urlaub, Seminare und Tagesgrenze',async()=>{
    const stored=await raw(),schedule=await new ScheduleService(auth).read(a.headers()),settings=planSettings(await rows());
    assert.deepEqual(schedule.settings,profileBudgetProjection(stored));assert.equal(dailyHours(settings),5);assert.equal(schedule.settings.maxDailyHours,5);
    assert.equal(isStudyFreeDay('2026-11-01',settings,[]),true);assert.equal(isStudyFreeDay('2026-10-28',settings,[]),true);
    assert.equal(computeDayBudget([],eventsOnDate(planningEvents([],settings),'2026-10-29'),{maxHours:dailyHours(settings),suppressReserve:true}).remainingMinutes,0);
    assert.deepEqual(profileBudgetProjection(settings as unknown as Record<string,unknown>),schedule.settings);
    assert.equal(settings.reps[0].scheduleDocIndex,0);assert.equal((schedule.settings.reps![0] as unknown as Record<string,unknown>).scheduleDocIndex,undefined);
    const before=await rows(),draft:PlanRow={kind:'plan-history',id:'r36-plan',revision:1,normalized:{},payload:{structured:{tasks:[{date:'2026-10-26',title:'Lernblock A',minutes:180,topicId:topic},{date:'2026-10-26',title:'Lernblock B',minutes:180,topicId:topic}],klausuren:[]}}};
    const calculated=calculatePlan(before,[],draft,a.name,'proof','2026-10-26');assert.deepEqual(await rows(),before);
    assert.ok(calculated.result.after.tasks.some(task=>task.recurringKey?.startsWith('ag|')));
    const blocks=calculated.result.after.tasks.filter(task=>task.title.startsWith('Lernblock'));assert.equal(blocks.length,2);assert.ok(blocks.some(task=>task.date>'2026-10-26'||task.deferred));
    for(const task of blocks.filter(t=>!t.deferred)){assert.notEqual(task.date,'2026-10-28');assert.notEqual(task.date,'2026-10-29');assert.notEqual(task.date,'2026-10-30');}
    const planTasks=calculated.result.after.tasks,events=planningEvents(calculated.result.after.events,settings);
    for(const date of new Set(blocks.filter(t=>!t.deferred).map(t=>t.date)))assert.equal(computeDayBudget(planTasks.filter(t=>t.date===date),eventsOnDate(events,date),{maxHours:5,suppressReserve:true}).overloadH,0);
  });
  await t.test('Replay idempotent; veraltete Profil-/Datumsrevision und Commitfehler hinterlassen keine Teilwerte',async()=>{
    const cmd=await command({notes:'Idempotent'});const first=await service.submit(a.headers(),cmd),before=await rows();assert.equal((await service.submit(a.headers(),cmd)).replay,true);assert.deepEqual(await rows(),before);
    assert.equal((await post({...cmd,fields:{notes:'Andere Semantik'}})).status,409);
    const stale=await command({completed:false});await service.submit(a.headers(),await command({notes:'Neuere Fassung'}));assert.equal((await post(stale)).status,409);
    const current=await command({notes:'Nicht speichern',examDate:'2027-07-01',lernstart:'2026-10-04'}),snapshot=await rows();
    for(const field of ['profile','examDate','lernstart'] as const)assert.equal((await post({...current,expectedRevisions:{...current.expectedRevisions,[field]:999}})).status,409);
    for(const faults of [{beforeWrite:(i:number)=>{if(i===1)throw Error('synthetic-write');}},{beforeCommit:()=>{throw Error('synthetic-commit');}}])await assert.rejects(new PersonalService(auth,faults).submit(a.headers(),current),/synthetic/);
    assert.deepEqual(await rows(),snapshot);await assert.rejects(service.status(a.headers(),current.requestId),/nicht gefunden/);assert.ok(first.profile);
  });
  await t.test('Reguläre private Planvorschau bleibt schreibfrei; neue Budget- und Lernstartrevisionen machen sie ungültig',async()=>{
    const plans=new PlanService(auth,{today:()=> '2026-10-26'}),v=await plans.read(a.headers());
    const context={contractVersion:1,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext};
    await plans.submit(a.headers(),{...context,action:'plan',requestId:'c3b1_r36_draft',operation:{type:'save',expectedResultRevision:v.resultRevision,reply:JSON.stringify({tasks:[{date:'2026-10-26',title:'Reguläre manuelle Planvorschau',minutes:180,topicId:topic}],klausuren:[]})}});
    const current=await plans.read(a.headers()),draft=current.history.find(h=>h.id===current.currentDraftId)!;
    const input={...context,planId:draft.id,planRevision:draft.revision,snapshot:current.snapshot},before=await rows();
    const preview=await plans.preview(a.headers(),input);assert.ok(preview.changes.some(c=>c.kind==='task'));assert.deepEqual(await rows(),before);
    await service.submit(a.headers(),await command({maxDailyHours:4}));await assert.rejects(plans.preview(a.headers(),input),{code:'conflict',status:409});
    const newView=await plans.read(a.headers()),withBudget={...input,snapshot:newView.snapshot};await plans.preview(a.headers(),withBudget);
    await service.submit(a.headers(),await command({lernstart:'2026-10-04'}));await assert.rejects(plans.preview(a.headers(),withBudget),{code:'conflict',status:409});
    await service.submit(a.headers(),await command({maxDailyHours:5}));
  });
  await t.test('Fehlerhafte HTTP-Eingaben und neue Quellenwerte werden begrenzt und ohne Änderung abgewiesen',async()=>{
    const before=await rows();
    for(const fields of [{documents:[]},{notes:'x'.repeat(10001)},{ags:[{...full.ags![0],durationHours:-1}]},{reps:[{...full.reps![0],scheduleDocIndex:1}]},{studyPhases:[{...legacy.studyPhases[0],sourceDocument:'Gefälscht'}]},{lernstart:'2028-01-01'},{studyPlanningMode:'custom'}])assert.equal((await post(await command(fields as ProfilePatch))).status,400);
    const headers=a.headers();headers.set('origin',base);headers.set('x-stex-action','1');headers.set('content-type','application/json');
    assert.equal((await personalHTTP(new Request(`${base}/api/learning/personal`,{method:'POST',headers,body:'x'.repeat(LEARNING_BODY_LIMIT+1)}),service)).status,413);
    assert.deepEqual(await rows(),before);
  });
  await t.test('Neuanmeldung und echter DB-Neustart erhalten alle eigenen Werte; alte Sitzung und B-Auftrag abgewiesen',async()=>{
    const old=await command({notes:'Alte Sitzung'}),before=(await service.read(a.headers())).profile;
    await a.auth('/sign-out',{});await a.auth('/sign-in/email',{email:`${a.name}@example.test`,password:syntheticPassword});assert.equal((await post(old)).status,409);
    const cross=await command({notes:'Falsches Konto'});assert.equal((await post({...cross,expectedAccessGeneration:cross.expectedAccessGeneration+1})).status,409);assert.equal((await post(cross,b)).status,409);assert.equal((await service.read(b.headers())).profile,null);
    assert.deepEqual((await service.read(a.headers())).profile,before);
    repository=await runtime.restart('r36_profile',repository.files);auth=new AccountService({database:repository.database,files:repository.files,baseURL:base,secret,mailKey});service=new PersonalService(auth);
    assert.deepEqual((await service.read(a.headers())).profile,before);
    const fresh=new SyntheticAccount(auth,a.name);await fresh.auth('/sign-in/email',{email:`${a.name}@example.test`,password:syntheticPassword});assert.deepEqual((await service.read(fresh.headers())).profile,before);
  });
  await t.test('Widerruf und Generationswechsel blockieren neue Patches und bestehende Replays',async()=>{
    const replay=await command({notes:'Vor Widerruf'},b);await service.submit(b.headers(),replay);const next=await command({notes:'Nach Widerruf'},b);
    const generation=await command({notes:'Alte Generation'});await repository.database.transaction(async c=>{await lockState(c);await c.query('UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1',[a.name]);});assert.equal((await post(generation)).status,401);
    const blocking=new PersonalService(auth,{beforeTransaction:async()=>{await repository.database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id=$1",[b.name]);await c.query('UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1',[b.name]);});}});
    await assert.rejects(blocking.submit(b.headers(),next),/gesperrt|anmelden/);await assert.rejects(service.submit(b.headers(),replay),/gesperrt|anmelden/);
    assert.equal((await repository.database.pool.query("SELECT payload->>'notes' note FROM stex.personal_records WHERE owner_user_id=$1 AND kind='profile'",[b.name])).rows[0].note,'Vor Widerruf');
  });
});
