import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {testRuntime} from '../scripts/data-migration/postgres-test-runtime';
import {SyntheticAccount,syntheticPassword} from '../scripts/pdf-a/fixtures';
import {importSearchFixture} from '../scripts/search/catalog-fixture';
import {seedPreparationFixture} from '../scripts/data-migration/c3b2a-fixture.mts';
import {AccountService} from '../src/lib/server/auth/service';
import {AiCredentialService} from '../src/lib/server/ai-credentials/service';
import {encryptCredential,credentialFingerprint} from '../src/lib/server/ai-credentials/crypto';
import {CheckinService,parseCheckinReply,validateCheckin} from '../src/lib/server/learning/checkin-service';
import {checkinSettings} from '../src/lib/server/learning/checkin-context';
import {checkinHTTP} from '../src/lib/server/learning/checkin-http';
import {ProgressService} from '../src/lib/server/learning/progress-service';
import {PreparationService} from '../src/lib/server/learning/preparation-service';
import {CheckinClient} from '../src/lib/learning/checkin-client';
import type {CheckinAsk,CheckinApply,CheckinView,CheckinResult} from '../src/lib/learning/checkin-contract';
import {TOPICS,getLeafTopics} from '../src/lib/topics';
import {lockState} from '../src/lib/server/persistence/repository';
import {backup,restore} from '../src/lib/server/persistence/backup';
import {recordKey,canonical} from '../src/lib/data-migration/migration';
import {DEFAULT_PROMPTS} from '../src/lib/prompts';
import {AI_DEFAULTS} from '../src/lib/ai-config';
import type {AiMessage,ChatCompletionOptions} from '../src/lib/ai';
const leaves=getLeafTopics(TOPICS),topic=leaves[0].id,second=leaves[1].id;
const response=JSON.stringify({message:'Du hast aktiv gelernt. Möchtest du den Fortschritt bestätigen?',progressSuggestions:[{topicId:topic,percent:60},{topicId:second,percent:30}]});
const base=(view:CheckinView)=>({contractVersion:1 as const,expectedAccountId:view.account.userId,expectedAccessGeneration:view.account.accessGeneration,expectedSessionContext:view.account.sessionContext});
test('C3b2b: Antworten strikt, nur bekannte Blatt-Themen und ganze Prozente',()=>{
 assert.equal(parseCheckinReply(response,[]).suggestions.length,2);
 for(const v of ['text','{}','{"message":""}',JSON.stringify({message:'ok',progressSuggestions:[{topicId:'unknown',percent:30}]}),JSON.stringify({message:'ok',progressSuggestions:[{topicId:TOPICS.find(t=>!leaves.some(l=>l.id===t.id))!.id,percent:30}]}),...[-1,101,1.5,null,'60'].map(percent=>JSON.stringify({message:'ok',progressSuggestions:[{topicId:topic,percent}]})),JSON.stringify({message:'ok',progressSuggestions:[{topicId:topic,percent:1},{topicId:topic,percent:2}]}),JSON.stringify({message:'ok',progressSuggestions:[],source:'manual'})])assert.throws(()=>parseCheckinReply(v,[]));
});
test('C3b2b: reine Voreinstellung und Ablehnung unbekannter gespeicherter Einstellungen',()=>{
 const defaultSettings=checkinSettings([]);assert.equal(defaultSettings.prompt,DEFAULT_PROMPTS.find(p=>p.id==='checkin')!.prompt);assert.equal(defaultSettings.promptDefault,true);
 const row={kind:'prompt',id:'checkin',revision:1,normalized:{},legacyKey:'lerntracker-prompts',payload:{...DEFAULT_PROMPTS.find(p=>p.id==='checkin')!,prompt:'Eigene bestätigte Vorlage'}};
 assert.equal(checkinSettings([row]).prompt,'Eigene bestätigte Vorlage');
 assert.throws(()=>checkinSettings([{...row,id:'unknown'}]));assert.throws(()=>checkinSettings([{...row,payload:{...row.payload,modelTier:'premium'}}]));
 assert.throws(()=>checkinSettings([{...row,kind:'reasoning-settings',id:'lerntracker-ai-reasoning',payload:{'unknown/model':'high'}}]));
 assert.throws(()=>checkinSettings([{...row,kind:'reasoning-settings',id:'lerntracker-ai-reasoning',payload:{[AI_DEFAULTS.cheap.id]:'low'}}]));
});
test('C3b2b: isoliertes PostgreSQL/AUTH/HTTP, lokaler Provider und Vollrestore',{timeout:240000},async t=>{
 const runtime=await testRuntime();let repository=await runtime.repository('checkin_source');
 const secret=randomBytes(48).toString('hex'),mailKey=randomBytes(48).toString('hex'),encryptionKey=randomBytes(48).toString('hex');
 const secrets={encryptionKey:randomBytes(32),fingerprintKey:randomBytes(32)};
 let calls=0,reply=response,captured:AiMessage[]=[];let gate:(()=>Promise<void>)|undefined;let drop=false;
 const provider=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const p of req)chunks.push(Buffer.from(p));captured=JSON.parse(Buffer.concat(chunks).toString()).messages;calls++;await gate?.();res.setHeader('content-type','application/json');res.end(JSON.stringify({reply}));});await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));const pa=provider.address();if(!pa||typeof pa==='string')throw Error('port');const providerURL=`http://127.0.0.1:${pa.port}`;
 const complete=async(messages:AiMessage[],options:ChatCompletionOptions)=>{assert.ok(options.apiKey?.startsWith('sk-or-v1-C3B2B-SYNTHETIC'));assert.equal(options.credentialSource,'own');const r=await fetch(providerURL,{method:'POST',body:JSON.stringify({messages}),signal:options.signal});return (await r.json()).reply as string;};
 let service:CheckinService;
 const server=createServer(async(req,res)=>{try{const chunks:Buffer[]=[];for await(const p of req)chunks.push(Buffer.from(p));const r=new Request(`${url}${req.url}`,{method:req.method,headers:new Headers(req.headers as Record<string,string>),body:chunks.length?Buffer.concat(chunks):undefined});const response=await checkinHTTP(r,service,req.url?.includes('/commands/')?req.url.split('/').at(-1):undefined);if(drop&&req.method==='POST'&&response.ok){drop=false;res.destroy();return;}res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.statusCode=500;res.end();}});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const sa=server.address();if(!sa||typeof sa==='string')throw Error('port');const url=`http://127.0.0.1:${sa.port}`;
 let auth=new AccountService({database:repository.database,files:repository.files,baseURL:url,secret,mailKey});let credentials=new AiCredentialService(auth,secrets,async()=>{throw Error('No real provider status');});service=new CheckinService(auth,credentials,{complete});
 let a=new SyntheticAccount(auth,'checkin-a');const b=new SyntheticAccount(auth,'checkin-b');await a.initialize();await b.initialize();
 t.after(async()=>{provider.closeAllConnections();server.closeAllConnections();await Promise.all([new Promise<void>(r=>provider.close(()=>r())),new Promise<void>(r=>server.close(()=>r()))]);await runtime.close();});
 let n=0;const ask=async(owner=a):Promise<CheckinAsk>=>{const v=await service.read(owner.headers());return {...base(v),action:'ask',requestId:`c3b2b_ask_${++n}`,snapshot:v.snapshot,messages:[{role:'user',content:'Ich habe Vertragsschluss und das zweite Thema mit Fällen gelernt.'}]};};
 const apply=async(proposalId:string):Promise<CheckinApply>=>({...base(await service.read(a.headers())),action:'apply',requestId:`c3b2b_apply_${++n}`,proposalId});
 const rows=async()=> (await repository.database.pool.query('SELECT * FROM stex.personal_records WHERE owner_user_id=$1 ORDER BY record_key',[a.name])).rows;
 const mutation=async(sql:string,args:unknown[]=[])=>repository.database.transaction(async c=>{await lockState(c);await c.query(sql,args);});
 const configure=async(owner:SyntheticAccount)=>{const identity={credentialId:`credential-${owner.name}`,ownerUserId:owner.name,source:'own' as const},key=`sk-or-v1-C3B2B-SYNTHETIC-${owner.name}`;await mutation("INSERT INTO stex.ai_credentials(credential_id,owner_user_id,source,encrypted_key,key_fingerprint,key_suffix,configured,revision) VALUES($1,$2,'own',$3,$4,'0000',true,1)",[identity.credentialId,owner.name,encryptCredential(key,identity,secrets),credentialFingerprint(key,secrets)]);await mutation("INSERT INTO stex.ai_credential_selections(owner_user_id,selected_source,revision) VALUES($1,'own',1)",[owner.name]);};
 const post=async(body:unknown,owner=a,svc=service)=>{const headers=owner.headers();headers.set('origin',url);headers.set('content-type','application/json');headers.set('x-stex-action','1');return checkinHTTP(new Request(url+'/api/learning/checkin',{method:'POST',headers,body:JSON.stringify(body)}),svc);};
 await t.test('Lesen schreibt keine persönlichen Daten, Defaults oder Provideraufrufe; fehlender Zugang stoppt',async()=>{
  const before=await rows();await service.read(a.headers());assert.deepEqual(await rows(),before);assert.equal(calls,0);await assert.rejects(service.submit(a.headers(),await ask()),/ausgeschaltet/);assert.equal(calls,0);await configure(a);await configure(b);
  await importSearchFixture(auth,a.headers());await seedPreparationFixture(auth,a,'search-synthetic-case');const prep=new PreparationService(auth),v=await prep.read(a.headers());await prep.submit(a.headers(),{...base(v as unknown as CheckinView),action:'preparation',requestId:'c3b2a_checkin_fixture',dates:[v.today],snapshot:v.snapshot});
  await mutation("UPDATE stex.personal_records SET payload=payload||'{\"opaqueExtra\":{\"keep\":true}}'::jsonb WHERE owner_user_id=$1 AND kind='progress'",[a.name]);
 });
 await t.test('Authentifizierung vor Body, Origin/Host, Bodylimit und unerlaubte Felder',async()=>{
  const noauth=new Request(url+'/api/learning/checkin',{method:'POST',headers:{origin:url,'x-stex-action':'1','content-type':'application/json'},body:'not-json'});assert.equal((await checkinHTTP(noauth,service)).status,401);
  const c=await ask();assert.equal((await post({...c,source:'ai'})).status,400);assert.throws(()=>validateCheckin({...c,messages:[{role:'system',content:'x'}]}));assert.throws(()=>validateCheckin({...c,messages:[{role:'user',content:'x'.repeat(4001)}]}));
  const h=a.headers();h.set('origin','https://foreign.invalid');h.set('x-stex-action','1');h.set('content-type','application/json');assert.equal((await checkinHTTP(new Request(url,{method:'POST',headers:h,body:JSON.stringify(c)}),service)).status,403);h.set('origin',url);h.set('host','foreign.invalid');assert.equal((await checkinHTTP(new Request(url,{method:'POST',headers:h,body:'{}'}),service)).status,403);h.delete('host');assert.equal((await checkinHTTP(new Request(url,{method:'POST',headers:h,body:' '.repeat(96001)}),service)).status,413);
 });
 let proposal:CheckinResult,command:CheckinApply;
 await t.test('Eigener bestätigter Kontext, private Vorschläge, kein Fortschritt vor Bestätigung',async()=>{
  const before=await rows(),c=await ask();proposal=await service.submit(a.headers(),c);assert.equal(proposal.state,'ready');assert.deepEqual(await rows(),before);assert.match(captured[0].content,/C3b2a manuell belegter Tag/);assert.match(captured[0].content,/Persönliche Dokumente und Quelltexte/);assert.doesNotMatch(captured[0].content,/checkin-b|sk-or-v1/);assert.equal(proposal.suggestions[0].beforePercent,18);
  const count=calls;assert.equal((await service.submit(a.headers(),c)).replay,true);assert.equal(calls,count);await assert.rejects(service.submit(a.headers(),{...c,messages:[{role:'user',content:'anderer Beitrag'}]}),/anderen Gesprächsbeitrag/);await assert.rejects(service.status(b.headers(),c.requestId),/nicht gefunden/);command=await apply(proposal.requestId);
 });
 await t.test('Vollständige atomare Bestätigung, Fehler-Rollback, source ai, unbekannte Felder und Referenzen',async()=>{
  const before=await rows();await assert.rejects(new CheckinService(auth,credentials,{complete,beforeWrite:i=>{if(i===1)throw Error('synthetic failure');}}).submit(a.headers(),command),/synthetic failure/);assert.deepEqual(await rows(),before);
  const prep=new PreparationService(auth),old=await prep.read(a.headers());const result=await service.submit(a.headers(),command);assert.equal(result.progress[0].value.source,'ai');assert.equal(result.progress[0].value.percent,60);assert.deepEqual((result.progress[0].value as unknown as {opaqueExtra:unknown}).opaqueExtra,{keep:true});assert.equal((await service.submit(a.headers(),command)).replay,true);
  await assert.rejects(service.submit(a.headers(),{...command,proposalId:'different'}),/anderen Bestätigung/);await assert.rejects(service.submit(a.headers(),await apply(proposal.requestId)),/geändert|bereits/);await assert.rejects(prep.preview(a.headers(),{...base(old as unknown as CheckinView),dates:[old.today],snapshot:old.snapshot}),/geändert/);
  const stored=(await repository.database.pool.query('SELECT before_values FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2',[a.name,command.requestId])).rows[0].before_values;assert.equal(stored.length,2);assert.ok(stored[0].before.payload.opaqueExtra);assert.deepEqual(stored[0].beforeReferences,stored[0].afterReferences);
 });
 await t.test('C1-Regler/Gruppen/Undo bleiben manuell; öffentliche source-Option abgewiesen',async()=>{
  const p=new ProgressService(auth),v=await p.read(a.headers());const c={...base(v as unknown as CheckinView),action:'set',requestId:'checkin-manual-c1',changes:[{topicId:topic,percent:45,expectedRevision:v.progress.find(r=>r.id===topic)!.revision}]};assert.equal((await p.submit(a.headers(),c)).progress[0].value.source,'manual');await assert.rejects(p.submit(a.headers(),{...c,source:'ai'}),/Unbekanntes/);await p.submit(a.headers(),{...base(v as unknown as CheckinView),action:'undo',requestId:'checkin-manual-undo',undoOfRequestId:c.requestId});assert.equal((await p.read(a.headers())).progress.find(r=>r.id===topic)!.value.percent,60);
 });
 await t.test('Eigene Revision und Neuanlage veralten Vorschlag; fremde Änderung nicht',async()=>{
  const p=await service.submit(a.headers(),await ask());await mutation("UPDATE stex.personal_records SET revision=revision+1 WHERE owner_user_id=$1 AND kind='task' AND id='prep-existing-manual'",[a.name]);await assert.rejects(service.submit(a.headers(),await apply(p.requestId)),/geändert/);
  const next=await service.submit(a.headers(),await ask());await mutation("INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,'task','new-task',1,'lerntracker-tasks',$3,'{}')",[recordKey('task',a.name,'new-task'),a.name,JSON.stringify({id:'new-task',date:(await service.read(a.headers())).today,title:'Konkurrenz',done:false})]);await assert.rejects(service.submit(a.headers(),await apply(next.requestId)),/geändert/);
  const stable=await service.submit(a.headers(),await ask());await mutation("UPDATE stex.accounts SET revision=revision+1 WHERE user_id=$1",[b.name]);assert.equal((await service.submit(a.headers(),await apply(stable.requestId))).state,'applied');
 });
 await t.test('Ungültige Providerantwort und abgebrochener Aufruf ändern keinen Fortschritt; kein automatischer Retry',async()=>{
  const before=await rows();reply=JSON.stringify({message:'ok',progressSuggestions:[{topicId:topic,percent:120}]});const c=await ask();await assert.rejects(service.submit(a.headers(),c),/Prozentwert/);const count=calls;assert.equal((await service.submit(a.headers(),c)).state,'failed');assert.equal(calls,count);assert.deepEqual(await rows(),before);reply=response;
  const broken=new CheckinService(auth,credentials,{complete:async()=>{calls++;throw Error('synthetic disconnect');}}),q=await ask();await assert.rejects(broken.submit(a.headers(),q),/nicht bestätigt/);const count2=calls;assert.equal((await broken.submit(a.headers(),q)).state,'failed');assert.equal(calls,count2);
 });
 await t.test('Späte Antwort nach Credentialwechsel und nach Kontextänderung verworfen',async()=>{
  for(const mode of ['credential','context']){let release!:()=>void,entered!:()=>void;const arrival=new Promise<void>(r=>entered=r);gate=()=>{entered();return new Promise<void>(r=>release=r);};const c=await ask(),pending=service.submit(a.headers(),c);await arrival;
   if(mode==='credential')await mutation("UPDATE stex.ai_credential_selections SET revision=revision+1 WHERE owner_user_id=$1",[a.name]);else await mutation("UPDATE stex.personal_records SET revision=revision+1 WHERE owner_user_id=$1 AND kind='progress'",[a.name]);release();await assert.rejects(pending,/geändert/);gate=undefined;
  }
 });
 await t.test('A/B und neue Anmeldung verwerfen alte Formulare und private Antworten',async()=>{
  const c=await ask();await assert.rejects(service.submit(b.headers(),c),/Anmeldung/);const p=await service.submit(a.headers(),c),old=await apply(p.requestId);await a.auth('/sign-out',{});await a.auth('/sign-in/email',{email:`${a.name}@example.test`,password:syntheticPassword});await assert.rejects(service.submit(a.headers(),old),/Anmeldung/);const status=await service.status(a.headers(),p.requestId);assert.equal(status.state,'stale');assert.equal(status.suggestions.length,0);
 });
 await t.test('Backend-Zugriffsentzug während Antwort stoppt Ausgabe und Fortschritt',async()=>{
  let release!:()=>void,entered!:()=>void;const arrival=new Promise<void>(r=>entered=r);gate=()=>{entered();return new Promise<void>(r=>release=r);};const c=await ask(b),pending=service.submit(b.headers(),c);await arrival;await mutation("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id=$1",[b.name]);release();await assert.rejects(pending);gate=undefined;await assert.rejects(service.read(b.headers()));
 });
 await t.test('Echter TCP-Antwortverlust nach Commit, eigene Statusabfrage und Replay',async()=>{
  const p=await service.submit(a.headers(),await ask()),c=await apply(p.requestId);const headers=a.headers();headers.set('origin',url);headers.set('content-type','application/json');headers.set('x-stex-action','1');drop=true;await assert.rejects(fetch(url+'/api/learning/checkin',{method:'POST',headers,body:JSON.stringify(c)}));assert.equal((await service.status(a.headers(),c.requestId)).state,'applied');assert.equal((await service.submit(a.headers(),c)).replay,true);
 });
 await t.test('Neustart und Format-4-Vollrestore desselben bearbeiteten Bestands',async()=>{
  const before=await rows();repository=await runtime.restart('checkin_source',repository.files);auth=new AccountService({database:repository.database,files:repository.files,baseURL:url,secret,mailKey});credentials=new AiCredentialService(auth,secrets);service=new CheckinService(auth,credentials,{complete});a=new SyntheticAccount(auth,'checkin-a');await a.auth('/sign-in/email',{email:'checkin-a@example.test',password:syntheticPassword});assert.deepEqual(await rows(),before);
  const env={enc:process.env.STEX_AI_CREDENTIAL_ENCRYPTION_KEY,fp:process.env.STEX_AI_CREDENTIAL_FINGERPRINT_KEY};process.env.STEX_AI_CREDENTIAL_ENCRYPTION_KEY=secrets.encryptionKey.toString('hex');process.env.STEX_AI_CREDENTIAL_FINGERPRINT_KEY=secrets.fingerprintKey.toString('hex');
  try{const target=await runtime.repository('checkin_restore');await backup(repository.database,repository.files,join(runtime.root,'backup'),{encryptionKey,authSecret:secret});await restore(target.database,target.files,join(runtime.root,'backup'),{encryptionKey,authSecret:secret});
   for(const table of ['personal_records','learning_commands','record_references','catalog_records','catalog_document_versions','ai_credentials']){const source=(await repository.database.pool.query(`SELECT to_jsonb(t) AS row FROM stex.${table} t`)).rows.map(r=>canonical(r.row)).sort(),restored=(await target.database.pool.query(`SELECT to_jsonb(t) AS row FROM stex.${table} t`)).rows.map(r=>canonical(r.row)).sort();assert.deepEqual(restored,source,table);}
   const restoredAuth=new AccountService({database:target.database,files:target.files,baseURL:url,secret,mailKey}),user=new SyntheticAccount(restoredAuth,'checkin-a');await user.auth('/sign-in/email',{email:'checkin-a@example.test',password:syntheticPassword});assert.equal((await new ProgressService(restoredAuth).read(user.headers())).progress.find(r=>r.id===topic)!.value.percent,60);assert.ok((await new CheckinService(restoredAuth,new AiCredentialService(restoredAuth,secrets),{complete}).read(user.headers())).recent.some(r=>r.state==='applied'));
  }finally{for(const [key,value] of [['STEX_AI_CREDENTIAL_ENCRYPTION_KEY',env.enc],['STEX_AI_CREDENTIAL_FINGERPRINT_KEY',env.fp]])if(value===undefined)delete process.env[key!];else process.env[key!]=value;}
 });
});
const clientView=(owner='a',session='a'.repeat(64)):CheckinView=>({contractVersion:1,account:{userId:owner,accessGeneration:1,sessionContext:session},snapshot:'b'.repeat(64),today:'2026-10-14',settings:{model:'synthetic/model',promptDefault:true,reasoningDefault:true},recent:[]});
const clientResult=(view:CheckinView):CheckinResult=>({contractVersion:1,account:view.account,requestId:'c3b2b_client',operation:'ask',action:'checkin',snapshot:view.snapshot,state:'ready',message:'Private Antwort',suggestions:[],progress:[],createdAt:'2026-10-14T12:00:00Z',replay:false});
test('C3b2b Client: Mount/Fokus nur Lesen, alte Antwort nach A/B verworfen',async()=>{
 let view=clientView(),posts=0,release!:(r:Response)=>void;const original=view;
 const transport:typeof fetch=async(_url,init)=>{if(init?.method==='POST'){posts++;return new Promise<Response>(r=>release=r);}return Response.json(view);};
 const client=new CheckinClient(transport);await client.load();await client.load(true);assert.equal(posts,0);const sending=client.send('Eigener Beitrag',view);client.hide();view=clientView('b','c'.repeat(64));await client.load();release(Response.json(clientResult(original)));await sending;assert.equal(client.state.result,null);assert.deepEqual(client.state.messages,[]);assert.equal(client.state.view?.account.userId,'b');
});
test('C3b2b Client: unklare Antwort zunächst Status lesen, nie automatisch KI erneut senden',async()=>{
 const view=clientView();let posts=0,statusReads=0;const transport:typeof fetch=async(url,init)=>{if(init?.method==='POST'){posts++;throw Error('TCP lost');}if(String(url).includes('/commands/')){statusReads++;return Response.json(clientResult(view));}return Response.json(view);};
 const client=new CheckinClient(transport);await client.load();await client.send('Eigener Beitrag',view);assert.equal(client.state.uncertain,true);await client.recover();assert.equal(statusReads,1);assert.equal(posts,1);assert.equal(client.state.uncertain,false);assert.equal(client.state.result?.message,'Private Antwort');
});
test('C3b2b Client: offener Beleg bleibt prüfbar, neue Anmeldung verwirft Gespräch',async()=>{
 let view=clientView();const pending={...clientResult(view),state:'pending' as const};let statusReads=0;
 const transport:typeof fetch=async(url)=>String(url).includes('/commands/')?(statusReads++,Response.json(clientResult(view))):Response.json(view);
 const client=new CheckinClient(transport);await client.load();client.select(pending);assert.equal(client.state.uncertain,true);await client.recover();assert.equal(statusReads,1);assert.equal(client.state.uncertain,false);view=clientView('a','d'.repeat(64));await client.load(true);assert.equal(client.state.result,null);assert.deepEqual(client.state.messages,[]);
});
