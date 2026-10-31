import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { testRuntime } from '../scripts/data-migration/postgres-test-runtime';
import { SyntheticAccount,syntheticPassword } from '../scripts/pdf-a/fixtures';
import { importSearchFixture } from '../scripts/search/catalog-fixture';
import { AccountService } from '../src/lib/server/auth/service';
import { PersonalService } from '../src/lib/server/learning/personal-service';
import { PersonalClient } from '../src/lib/learning/personal-client';
import { personalHTTP } from '../src/lib/server/learning/http';
import { profileDraft,profileRevisions,personalPageAllowed,type PersonalView,type PersonalCommand,type ProfileFields } from '../src/lib/learning/personal-contract';
import { ProgressService } from '../src/lib/server/learning/progress-service';
import { getLeafTopics,TOPICS } from '../src/lib/topics';
import { lockState } from '../src/lib/server/persistence/repository';
import { recordKey } from '../src/lib/data-migration/migration';
import { backup,restore } from '../src/lib/server/persistence/backup';
import { CatalogSearchService } from '../src/lib/server/search/service';
import { PostgresSearchStore } from '../src/lib/server/search/store';
import { SearchWorker } from '../src/lib/server/search/worker';
import { LEARNING_BODY_LIMIT } from '../src/lib/learning/progress-contract';
const topic=getLeafTopics(TOPICS)[0].id;
const fields:ProfileFields={bundesland:'Berlin',examDate:'2027-06-01',lernstart:'2026-10-01',refStartDate:'2026-02-01',studyPlanningMode:'station',studyPhasesEnabled:true,studyPhases:[{id:'original-phase',label:'Zivilstation',start:'2026-02-01',end:'2026-05-31',focus:'zr',perspective:'state'}]};
const existingAg={id:'existing-ag',label:'Erhalten',day:'Dienstag',frequency:'wöchentlich',topic:'Zivilrecht',durationHours:2,prepHours:0,postHours:0,startDate:'',endDate:''};
test('DATA-C2: persönliche Profile/Notizen mit echten Sitzungen, Neustart und Vollrestore',{timeout:120000},async t=>{
  const runtime=await testRuntime();let repository=await runtime.repository('personal_source');
  const secret=randomBytes(48).toString('hex'),mailKey=randomBytes(48).toString('hex'),encryptionKey=randomBytes(48).toString('hex');
  let auth:AccountService,service:PersonalService,drop=false;const droppedStatuses:number[]=[];
  const server=createServer(async(req,res)=>{try{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const request=new Request(`${base}${req.url}`,{method:req.method,headers:new Headers(req.headers as Record<string,string>),body:chunks.length?Buffer.concat(chunks):undefined});
    const id=req.url?.startsWith('/api/learning/personal/commands/')?req.url.split('/').at(-1):undefined;
    const response=await personalHTTP(request,service,id);if(drop&&req.method==='POST'){drop=false;droppedStatuses.push(response.status);if(response.ok){res.destroy();return;}}
    res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.statusCode=500;res.end();}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Testport fehlt.');const base=`http://127.0.0.1:${address.port}`;
  auth=new AccountService({database:repository.database,files:repository.files,baseURL:base,secret,mailKey});service=new PersonalService(auth);
  const a=new SyntheticAccount(auth,'personal-a'),b=new SyntheticAccount(auth,'personal-b'),pending=new SyntheticAccount(auth,'personal-pending');await a.initialize();await b.initialize();await pending.initialize(false);
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.close();});
  const baseCommand=(view:PersonalView,requestId:string)=>({contractVersion:1 as const,requestId,expectedAccountId:view.account.userId,expectedAccessGeneration:view.account.accessGeneration,expectedSessionContext:view.account.sessionContext});
  const profile=async(id:string,patch:Partial<ProfileFields>={},owner=a):Promise<PersonalCommand>=>{const v=await service.read(owner.headers());return {...baseCommand(v,id),action:'profile',fields:{...fields,...patch},expectedRevisions:profileRevisions(v)};};
  const note=async(requestId:string,id='existing-note',text='Neue Notiz',owner=a):Promise<PersonalCommand>=>{const v=await service.read(owner.headers());return {...baseCommand(v,requestId),action:'note',id,topicId:topic,note:text,expectedRevision:v.notes.find(n=>n.id===id)?.revision??null};};
  const post=async(command:unknown,owner=a,delegate=false)=>{const headers=owner.headers();headers.set('origin',base);headers.set('x-stex-action','1');headers.set('content-type','application/json');if(delegate)headers.set('x-stex-learning-contract','1');const request=new Request(`${base}${delegate?'/api/account/notes':'/api/learning/personal'}`,{method:'POST',headers,body:JSON.stringify(command)});return delegate?auth.accountHTTP(request):personalHTTP(request,service);};
  await t.test('Hydrieren schreibt weder Defaults noch IDs; vorhandenes AUTH learning-entry wird wiederverwendet',async()=>{
    const generation=(await repository.database.pool.query('SELECT generation FROM stex.state')).rows[0].generation;
    const v=await service.read(a.headers());assert.equal(v.profile,null);assert.deepEqual(v.notes,[]);assert.equal(profileDraft(v).studyPhases.length,0);
    await service.read(a.headers());assert.equal((await repository.database.pool.query('SELECT generation FROM stex.state')).rows[0].generation,generation);
    assert.equal((await repository.database.pool.query('SELECT count(*)::int n FROM stex.personal_records')).rows[0].n,0);
    assert.equal((await post({id:'existing-note',topicId:topic,note:'Vorhandene AUTH-Notiz',expectedRevision:null},a,true)).status,200);
    const saved=await service.read(a.headers());assert.equal(saved.notes[0].id,'existing-note');assert.equal(saved.notes[0].revision,1);
  });
  await t.test('Profil und separate Datumswerte sind atomar; verschachtelte IDs, unbekannte Felder und Referenzen bleiben erhalten',async()=>{
    await repository.database.transaction(async c=>{await lockState(c);const value={...fields,ags:[existingAg],documents:[{id:'document-source',name:'Testquelle'}],custom:{unchanged:true},studyPhases:[{...fields.studyPhases[0],sourceDocument:'Testquelle',extra:'erhalten'}]};
      await c.query("INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,'profile','lerntracker-onboarding',1,'lerntracker-onboarding',$3::jsonb,'{}')",[recordKey('profile',a.name,'lerntracker-onboarding'),a.name,JSON.stringify(value)]);
    });
    const current=await service.read(a.headers());assert.equal((current.profile?.value as Record<string,unknown>).documents,undefined);assert.equal((current.profile?.value.studyPhases?.[0] as unknown as Record<string,unknown>).extra,undefined);
    const command=await profile('c2_profile',{studyPhases:current.profile!.value.studyPhases!,examDate:'2027-07-01'});const result=await service.submit(a.headers(),command);
    assert.equal(result.profile?.revision,2);assert.equal(result.examDate?.value,'2027-07-01');assert.equal(result.lernstart?.value,fields.lernstart);
    const payload=(await repository.database.pool.query("SELECT payload FROM stex.personal_records WHERE kind='profile' AND owner_user_id=$1",[a.name])).rows[0].payload;
    assert.deepEqual(payload.ags,[existingAg]);assert.equal(payload.studyPhases[0].id,'original-phase');assert.equal(payload.studyPhases[0].extra,'erhalten');assert.deepEqual(payload.documents,[{id:'document-source',name:'Testquelle'}]);assert.deepEqual(payload.custom,{unchanged:true});
    assert.equal((await service.read(b.headers())).profile,null);
    assert.equal((await service.submit(a.headers(),command)).replay,true);assert.equal((await service.read(a.headers())).profile?.revision,2);
    await assert.rejects(service.submit(a.headers(),{...command,fields:{...fields,bundesland:'Hessen'}}),/Vorgangskennung/);
  });
  await t.test('Stale Profil-/Datumsrevision, Teilfehler und Fehler vor Commit erzeugen keine Teilergebnisse oder Belege',async()=>{
    const v=await service.read(a.headers()),command=await profile('c2_conflict',{studyPhases:v.profile!.value.studyPhases!});
    if(command.action!=='profile')throw new Error('Profil erwartet.');const before=await service.read(a.headers());
    await assert.rejects(service.submit(a.headers(),{...command,expectedRevisions:{...command.expectedRevisions,examDate:99}}),/inzwischen geändert/);
    await assert.rejects(new PersonalService(auth,{beforeWrite:i=>{if(i===1)throw new Error('synthetic-partial');}}).submit(a.headers(),command),/synthetic-partial/);
    await assert.rejects(new PersonalService(auth,{beforeCommit:()=>{throw new Error('synthetic-commit');}}).submit(a.headers(),command),/synthetic-commit/);
    assert.deepEqual(await service.read(a.headers()),before);await assert.rejects(service.status(a.headers(),command.requestId),/nicht gefunden/);
    const other=await profile('c2_newer',{studyPhases:v.profile!.value.studyPhases!,bundesland:'Hamburg'});await service.submit(a.headers(),other);
    await assert.rejects(service.submit(a.headers(),command),/inzwischen geändert/);
  });
  await t.test('Notiz-Replay, Konflikte und Eigentum; Themenreferenz, ID und Zeitstempel bleiben stabil',async()=>{
    const before=(await service.read(a.headers())).notes[0];const command=await note('c2_note');const result=await service.submit(a.headers(),command);const entry=result.notes.find(n=>n.id===before.id)!;
    assert.equal(entry.revision,2);assert.equal(entry.value.createdAt,before.value.createdAt);assert.equal((await service.submit(a.headers(),command)).replay,true);
    await assert.rejects(service.submit(a.headers(),{...command,requestId:'c2_stale_note'}),/inzwischen geändert/);
    await assert.rejects(service.status(b.headers(),command.requestId),/nicht gefunden/);assert.equal((await post(command,b)).status,409);assert.equal((await service.read(b.headers())).notes.length,0);
    const refs=(await repository.database.pool.query("SELECT target_topic_id FROM stex.record_references WHERE source_key=$1 AND path='value.topicId'",[recordKey('learning-entry',a.name,before.id)])).rows;assert.deepEqual(refs,[{target_topic_id:topic}]);
  });
  await t.test('HTTP prüft Freigabe, Ursprung, Bytegrenze und erlaubte Felder; Altroute im Kontomodus delegiert sicher',async()=>{
    const v=await service.read(a.headers()),command=await profile('c2_validation',{studyPhases:v.profile!.value.studyPhases!});
    assert.equal((await post(command,pending)).status,403);assert.equal((await post({...command,ownerUserId:b.name})).status,400);
    if(command.action!=='profile')throw new Error('Profil erwartet.');assert.equal((await post({...command,fields:{...command.fields,examDate:'2027-02-30'}})).status,400);
    assert.equal((await post({...command,fields:{...command.fields,studyPhases:[{...command.fields.studyPhases[0],sourceDocument:'Fremde Quelle'}]}})).status,400);
    const headers=a.headers();headers.set('origin',base);headers.set('x-stex-action','1');headers.set('content-type','application/json');
    assert.equal((await personalHTTP(new Request(`${base}/api/learning/personal`,{method:'POST',headers,body:' '.repeat(LEARNING_BODY_LIMIT+1)}),service)).status,413);
    headers.set('origin','https://foreign.example');assert.equal((await personalHTTP(new Request(`${base}/api/learning/personal`,{method:'POST',headers,body:JSON.stringify(command)}),service)).status,403);
    const previous=process.env.STEX_LEARNING_MODE;process.env.STEX_LEARNING_MODE='account';try{
      assert.equal((await post({id:'unsafe-legacy',topicId:topic,note:'Altauftrag',expectedRevision:null},a,true)).status,400);
      const safe=await note('c2_delegated','delegated-note');assert.equal((await post(safe,a,true)).status,200);
    }finally{if(previous===undefined)delete process.env.STEX_LEARNING_MODE;else process.env.STEX_LEARNING_MODE=previous;}
  });
  await t.test('Echter HTTP-Verlust nach Commit: beide Fachaktionen werden ohne Doppelrevision aufgeklärt',async()=>{
    const transport:typeof fetch=(path,options)=>fetch(new URL(String(path),base),{...options,headers:{...Object.fromEntries(new Headers(options?.headers)),cookie:a.headers().get('cookie')!,origin:base}});
    const client=new PersonalClient(transport);await client.load();let v=client.state.view!;drop=true;
    await client.saveProfile({...profileDraft(v),bundesland:'Bremen'},profileRevisions(v),v.account);
    assert.equal(droppedStatuses.at(-1),200,'Der Profil-POST muss vor dem simulierten Antwortverlust erfolgreich sein.');
    assert.equal(client.state.uncertain,true);
    const before=await service.read(a.headers());assert.equal(before.profile?.value.bundesland,'Bremen');const profileRevision=before.profile?.revision;
    await client.recover();assert.equal(client.state.status,'ready');assert.equal(client.state.uncertain,false);
    const recoveredProfile=await service.read(a.headers());assert.deepEqual(recoveredProfile,before);assert.equal(recoveredProfile.profile?.revision,profileRevision);
    v=client.state.view!;drop=true;await client.saveNote('response-lost-note',topic,'Antwortverlust-Test',null,v.account);
    assert.equal(droppedStatuses.at(-1),200,'Der Notiz-POST muss vor dem simulierten Antwortverlust erfolgreich sein.');
    assert.equal(client.state.uncertain,true);
    const noteBefore=await service.read(a.headers());assert.equal(noteBefore.notes.find(n=>n.id==='response-lost-note')?.value.note,'Antwortverlust-Test');
    await client.recover();assert.equal(client.state.status,'ready');assert.equal(client.state.uncertain,false);assert.deepEqual(await service.read(a.headers()),noteBefore);client.hide();
  });
  await t.test('Neue Sitzung desselben Kontos sowie A-Auftrag unter B können nichts schreiben',async()=>{
    const old=await note('c2_before_relogin','before-relogin');await a.auth('/sign-out',{});await a.auth('/sign-in/email',{email:`${a.name}@example.test`,password:syntheticPassword});assert.equal((await post(old)).status,409);
    const delayed=await note('c2_old_a','old-a');assert.equal((await post(delayed,b)).status,409);assert.equal((await service.read(b.headers())).notes.length,0);
  });
  await t.test('Prozessneustart und Format-3-Restore erhalten C2, C1, Dateien und Such-Neuaufbau; alte Sitzungen abgewiesen',async()=>{
    let progress=new ProgressService(auth);const p=await progress.read(a.headers());const progressCommand={contractVersion:1,requestId:'c1-preserved',expectedAccountId:p.account.userId,expectedAccessGeneration:p.account.accessGeneration,expectedSessionContext:p.account.sessionContext,action:'set',changes:[{topicId:topic,percent:55,expectedRevision:null}]};await progress.submit(a.headers(),progressCommand);
    await importSearchFixture(auth,a.headers());let store=new PostgresSearchStore(repository.database),worker=new SearchWorker(store,repository.files);for(let n=0;await worker.step();n++)assert.ok(n<30);
    const searchBefore=await new CatalogSearchService(auth).search(a.headers(),{text:'Bestätigungsschreiben'});assert.ok(searchBefore.totalHits>0);
    const before=await service.read(a.headers());repository=await runtime.restart('personal_source',repository.files);auth=new AccountService({database:repository.database,files:repository.files,baseURL:base,secret,mailKey});service=new PersonalService(auth);progress=new ProgressService(auth);
    assert.deepEqual(await service.read(a.headers()),before);assert.equal((await progress.read(a.headers())).progress[0].value.percent,55);
    const directory=join(runtime.root,'c2-backup');const saved=await backup(repository.database,repository.files,directory,{encryptionKey,authSecret:secret});assert.equal(saved.fileCount,2);assert.equal(JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')).version,4);
    const target=await runtime.repository('personal_restore');await restore(target.database,target.files,directory,{encryptionKey,authSecret:secret});const restoredAuth=new AccountService({database:target.database,files:target.files,baseURL:base,secret,mailKey}),restored=new PersonalService(restoredAuth);
    await assert.rejects(restored.read(a.headers()),/anmelden/);const fresh=new SyntheticAccount(restoredAuth,a.name);await fresh.auth('/sign-in/email',{email:`${a.name}@example.test`,password:syntheticPassword});const after=await restored.read(fresh.headers());assert.deepEqual({...after,account:before.account},before);
    assert.equal((await new ProgressService(restoredAuth).read(fresh.headers())).progress[0].value.percent,55);
    assert.equal((await new ProgressService(restoredAuth).status(fresh.headers(),'c1-preserved')).replay,true);assert.equal((await restored.status(fresh.headers(),'c2_note')).replay,true);
    store=new PostgresSearchStore(target.database);worker=new SearchWorker(store,target.files);assert.equal((await target.database.pool.query('SELECT count(*)::int n FROM stex.search_pages')).rows[0].n,0);for(let n=0;await worker.step();n++)assert.ok(n<30);
    const searchAfter=await new CatalogSearchService(restoredAuth).search(fresh.headers(),{text:'Bestätigungsschreiben'});assert.deepEqual(searchAfter.hits,searchBefore.hits);
    await assert.rejects(new ProgressService(restoredAuth).status(fresh.headers(),'c2_note'),/nicht gefunden/);
  });
  await t.test('Sperre zwischen Vorprüfung und Transaktion blockiert neue Notiz und bestehenden Replay',async()=>{
    const command=await note('c2_blocked','blocked-note','B-Notiz',b);const committed=await service.submit(b.headers(),command);const next=await note('c2_blocked_next','next-b','Wird gesperrt',b);
    const blocking=new PersonalService(auth,{beforeTransaction:async()=>{await repository.database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id=$1",[b.name]);await c.query('UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1',[b.name]);});}});
    await assert.rejects(blocking.submit(b.headers(),next),/gesperrt|anmelden/);await assert.rejects(service.submit(b.headers(),command),/gesperrt|anmelden/);
    const rows=(await repository.database.pool.query("SELECT revision FROM stex.personal_records WHERE owner_user_id=$1 AND kind='learning-entry'",[b.name])).rows;assert.deepEqual(rows,[{revision:committed.notes[0].revision}]);
  });
});
const fakeView=(owner:string,session=owner):PersonalView=>({contractVersion:1,account:{userId:owner,accessGeneration:1,sessionContext:session},profile:null,examDate:null,lernstart:null,notes:[]});
test('C2-Client verwirft späte A-Antwort und A-Formularhandler nach B-Fokusprüfung',async()=>{
  const a=fakeView('a'),b=fakeView('b');let release:(value:Response)=>void=()=>{};let count=0,writes=0;
  const client=new PersonalClient(async(_url,options)=>{if(options?.method==='POST'){writes++;return Response.json(b);}count++;return count===1?new Promise<Response>(r=>{release=r;}):Response.json(b);});
  const old=client.load();await client.load(true);release(Response.json(a));await old;assert.equal(client.state.view?.account.userId,'b');
  assert.equal(await client.saveProfile(fields,{profile:null,examDate:null,lernstart:null},a.account),null);assert.equal(await client.saveNote('old-note',topic,'A-Entwurf',null,a.account),null);assert.equal(writes,0);client.hide();
});
test('C2-Client behält Vorgangs-ID nach 404, lädt nach historischem Replay aktuellen Stand',async()=>{
  let view=fakeView('a'),post=0;const requests:string[]=[];const client=new PersonalClient(async(path,options)=>{
    if(options?.method==='POST'){const cmd=JSON.parse(String(options.body));requests.push(cmd.requestId);post++;if(post===1)throw new TypeError('synthetic-network');return Response.json({...view,requestId:cmd.requestId,action:'note',replay:true});}
    if(String(path).includes('/commands/'))return Response.json({error:{code:'not_found',message:'Kein Beleg'}},{status:404});return Response.json(view);
  });await client.load();const a=client.state.view!.account;await client.saveNote('new-note',topic,'Notiz',null,a);assert.equal(client.state.uncertain,true);
  view={...view,notes:[{id:'newer-note',revision:3,value:{id:'newer-note',topicId:topic,note:'Aktueller Stand',createdAt:'2026-10-13T12:00:00Z',source:'manual'}}]};await client.recover();assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);assert.equal(client.state.view?.notes[0].id,'newer-note');client.hide();
});
test('C2-Teilfreigabe öffnet ausschließlich angeschlossene persönliche Bedienwege',()=>{for(const p of ['/','/onboarding','/themen','/konto','/konto/klausuren/suche','/konto/klausuren/pdf','/konto/verwaltung'])assert.equal(personalPageAllowed(p),true);for(const p of ['/kalender','/plan','/wochenplan','/schreiben','/admin','/klausuren'])assert.equal(personalPageAllowed(p),false);});

test('C2-Client lässt eine späte Speicherbestätigung aus alter Sitzung nach Fokus-/Sitzungswechsel unbeachtet',async()=>{
  const a=fakeView('a','first-session'),fresh=fakeView('a','new-session');let view=a,release:(r:Response)=>void=()=>{};
  const client=new PersonalClient(async(_path,options)=>options?.method==='POST'?new Promise<Response>(r=>{release=r;}):Response.json(view));
  await client.load();const writing=client.saveNote('delayed-note',topic,'Alter Entwurf',null,a.account);client.hide();assert.equal(client.state.uncertain,true);
  view=fresh;await client.load(true);release(Response.json({...a,requestId:'c2_old',action:'note',replay:false,notes:[{id:'delayed-note',revision:1,value:{id:'delayed-note',topicId:topic,note:'Alter Entwurf',source:'manual',createdAt:'2026-10-13T12:00:00Z'}}]}));await writing;
  assert.equal(client.state.view?.account.sessionContext,'new-session');assert.deepEqual(client.state.view?.notes,[]);assert.equal(client.state.uncertain,false);assert.equal(client.state.message,'');client.hide();
});
