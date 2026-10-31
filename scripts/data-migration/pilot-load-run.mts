/** Finite, disposable load measurement. Source copy only; never ordinary data/configuration. */
import {mkdtemp,readFile,writeFile,readdir,cp,symlink,rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn,execFileSync,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes,createHash} from 'node:crypto';
import {totalmem,freemem,cpus,platform,release} from 'node:os';
import EmbeddedPostgres from 'embedded-postgres';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
import {AccountService} from '../../src/lib/server/auth/service';
import {SyntheticAccount} from '../pdf-a/fixtures';
import {syntheticSearchPdf} from '../search/fixtures';
import {CatalogImportService,validateCatalogPdf} from '../../src/lib/server/catalog/import-service';
import {SearchWorker} from '../../src/lib/server/search/worker';
import {PostgresSearchStore} from '../../src/lib/server/search/store';
import {backup} from '../../src/lib/server/persistence/backup';
import {SettingsService} from '../../src/lib/server/learning/settings-service';
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
async function manifest(base:string,dirs:string[]){const out:Record<string,string>={};async function walk(p:string){for(const x of await readdir(join(base,p),{withFileTypes:true})){const f=join(p,x.name);if(x.isDirectory())await walk(f);else if(x.isFile())out[f]=hash(await readFile(join(base,f)));}}for(const d of dirs)await walk(d);for(const f of ['package.json','package-lock.json','tsconfig.json','next.config.ts','postcss.config.mjs','eslint.config.mjs','next-env.d.ts'])out[f]=hash(await readFile(join(base,f)));return out;}
if(process.argv[2]!=='--copy-run'){
 const base=resolve('.'),proof=join(base,'docs/entwuerfe/DATA-01/pruefungen/pilot-load');
 const snapshot=await mkdtemp('/private/tmp/stex-pilot-load-app-');
 const dirs=['src','public','db/migrations','scripts','tests'];const hashes=await manifest(base,dirs);
 for(const d of dirs)await cp(join(base,d),join(snapshot,d),{recursive:true});
 for(const f of ['package.json','package-lock.json','tsconfig.json','next.config.ts','postcss.config.mjs','eslint.config.mjs','next-env.d.ts'])await cp(join(base,f),join(snapshot,f));
 await symlink(join(base,'node_modules'),join(snapshot,'node_modules'),'dir');
 const copied=await manifest(snapshot,dirs);if(JSON.stringify(hashes)!==JSON.stringify(copied))throw Error('Copy differs');
 await writeFile(join(proof,'source-before.json'),JSON.stringify({snapshot,hashes,count:Object.keys(hashes).length,dirs,nodeModules:'shared read-only symlink; no install'},null,2));
 const config=JSON.parse(await readFile(join(snapshot,'tsconfig.json'),'utf8'));config.compilerOptions.incremental=false;config.include=['next-env.d.ts','src/**/*.ts','src/**/*.tsx','.next-qa/dev/types/**/*.ts'];config.exclude=['node_modules'];await writeFile(join(snapshot,'tsconfig.json'),JSON.stringify(config,null,2));
 const child=spawn(process.execPath,['--import','tsx','--import',join(snapshot,'scripts/data-migration/pilot-load-guard.mts'),join(snapshot,'scripts/data-migration/pilot-load-run.mts'),'--copy-run'],{cwd:snapshot,env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,NEXT_TELEMETRY_DISABLED:'1',PILOT_LOAD_PROOF:proof},stdio:'inherit'});
 const exit=await new Promise<number>(r=>child.once('exit',c=>r(c??1)));
 const after=await manifest(base,dirs);const drift=Object.keys(hashes).filter(p=>hashes[p]!==after[p]);await writeFile(join(proof,'source-after.json'),JSON.stringify({mainDifferences:drift},null,2));
 await rm(snapshot,{recursive:true,force:true});await writeFile(join(proof,'copy-cleanup.json'),JSON.stringify({snapshot,removed:true,childExit:exit},null,2));process.exit(exit);
}
const proof=process.env.PILOT_LOAD_PROOF!;if(!proof||!process.cwd().startsWith('/private/tmp/stex-pilot-load-app-'))throw Error('Own copy required');
const root=await mkdtemp('/private/tmp/stex-pilot-load-data-');
async function freePort(){const s=createServer();await new Promise<void>((r,j)=>{s.on('error',j);s.listen(0,'127.0.0.1',r);});const a=s.address();if(!a||typeof a==='string')throw Error('port');await new Promise<void>(r=>s.close(()=>r()));return a.port;}
const port=await freePort(),webPort=await freePort(),baseURL=`http://localhost:${webPort}`,password=randomBytes(24).toString('hex'),secret=randomBytes(48).toString('hex'),mailKey=randomBytes(48).toString('hex'),backupKey=randomBytes(48).toString('hex');
await writeFile(join(proof,'runtime.json'),JSON.stringify({root,snapshot:process.cwd(),port,webPort,parentPid:process.pid,scope:'Only new synthetic loopback load; no old dataset'},null,2));
const cluster=new EmbeddedPostgres({databaseDir:join(root,'postgres'),port,user:'stex_local',password,persistent:true,authMethod:'scram-sha-256',createPostgresUser:false,initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1','-k',root],onLog:()=>{},onError:()=>{}});
let db:Database|undefined,bdb:Database|undefined,next:ChildProcess|undefined,timer:ReturnType<typeof setInterval>|undefined,phase='setup',fatal='',monitorBusy=false,failed=false;const samples:unknown[]=[],requests:{phase:string;reader:number;kind:string;ms:number;status:number;bytes:number;error?:string}[]=[];const start=performance.now();
const log=createWriteStream(join(proof,'next.log'));
async function stopNext(){if(next&&next.exitCode===null){next.kill('SIGTERM');await Promise.race([new Promise<void>(r=>next!.once('exit',()=>r())),sleep(8000)]);if(next.exitCode===null)next.kill('SIGKILL');}}
const deadline=setTimeout(()=>{fatal='Hard wall-clock stop 8min';void stopNext();},480000);
try{
 timer=setInterval(sample,250);sample();
 await cluster.initialise();await cluster.start();await cluster.createDatabase('stex_local');
 const cfg={host:'127.0.0.1',port,user:'stex_local',password,database:'stex_local',connectionTimeoutMillis:5000,statement_timeout:20000};db=new Database({...cfg,application_name:'pilot-load-driver'});bdb=new Database({...cfg,application_name:'pilot-load-backup'});await db.migrate();
 const files=new PrivateFiles(join(root,'files'));await files.initialize();const auth=new AccountService({database:db,files,baseURL,secret,mailKey});
 const accounts:SyntheticAccount[]=[];for(let i=0;i<5;i++){const a=new SyntheticAccount(auth,`pilot-load-${i}`);await a.initialize();accounts.push(a);}
 for(const [name,value]of [['postgres-password',password],['auth-secret',secret],['auth-mail-key',mailKey]])await writeFile(join(root,name),value,{mode:0o600});
 const importer=new CatalogImportService(auth,files);async function importCase(n:number,padding:number){if(fatal)throw Error(fatal);const docs=[];for(const role of ['sachverhalt','loesung']as const){const bytes=syntheticSearchPdf(Array.from({length:10},(_,i)=>[`Pilot load case ${n} ${role} page ${i+1}`,'Kaufmaennisches Bestaetigungsschreiben. Paragraph 172 ZPO.']),padding);docs.push(await validateCatalogPdf({name:`load-${n}-${role}.pdf`,size:bytes.length,type:'application/pdf',arrayBuffer:async()=>Uint8Array.from(bytes).buffer},role));}return importer.submit(accounts[0].headers(),{requestId:`pilot-load-import-${n}`,metadata:{id:`pilot-load-${n}`,source:'synthetic-pilot-load',title:`Synthetic load ${n}`,area:'zr',date:'',topicIds:[]},documents:docs});}
 for(let i=0;i<12;i++)await importCase(i,2*1024*1024);
 const store=new PostgresSearchStore(db),worker=new SearchWorker(store,files);await store.discover();let initialJobs=0;while(await worker.step()){if(fatal)throw Error(fatal);if(++initialJobs>30)throw Error('Initial worker bound');}
 next=spawn(process.execPath,['--import','tsx','--import',resolve('scripts/data-migration/pilot-load-guard.mts'),resolve('node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(webPort)],{cwd:process.cwd(),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,NEXT_TELEMETRY_DISABLED:'1',PILOT_LOAD_PROOF:proof,STEX_AUTH_MODE:'local',STEX_LEARNING_MODE:'account',STEX_ISOLATED_DEV:'1',BETTER_AUTH_URL:baseURL,STEX_LOCAL_DATA_DIR:root,STEX_LOCAL_POSTGRES_PORT:String(port)},stdio:['ignore','pipe','pipe']});next.stdout!.pipe(log,{end:false});next.stderr!.pipe(log,{end:false});
 const versions=(await db.pool.query('SELECT d.klausur_id,d.document_id,v.document_version_id,v.byte_size FROM stex.catalog_documents d JOIN stex.catalog_document_versions v USING(document_id) ORDER BY d.document_id')).rows;
 const urls=versions.map(v=>'/api/catalog/pdf?'+new URLSearchParams({klausurId:v.klausur_id,documentId:v.document_id,documentVersionId:v.document_version_id}));
 async function request(reader:number,kind:string,path:string,range=false){const at=performance.now();let status=0,bytes=0,error:undefined|string;try{const h=accounts[reader].headers();if(range)h.set('range','bytes=0-65535');const r=await fetch(baseURL+path,{headers:h,signal:AbortSignal.timeout(10000)});status=r.status;bytes=(await r.arrayBuffer()).byteLength;if(!r.ok)error=`HTTP ${r.status}`;}catch(e){error=e instanceof Error?e.name:'request_error';}requests.push({phase,reader,kind,ms:performance.now()-at,status,bytes,...(error?{error}:{})});}
 let ready=false;for(let i=0;i<60;i++){try{const r=await fetch(baseURL+'/api/account',{headers:accounts[0].headers(),signal:AbortSignal.timeout(5000)});await r.arrayBuffer();if(r.ok){ready=true;break;}}catch{}await sleep(500);}if(!ready)throw Error('App start bound');
 phase='warmup';await request(0,'search','/api/catalog/search?q=Kaufmaennisches');await request(0,'pdf-full',urls[0]);
 function sample(){if(monitorBusy)return;monitorBusy=true;try{const rows=execFileSync('ps',['-axo','pid=,ppid=,rss=,pcpu=,comm='],{encoding:'utf8'}).trim().split('\n').map(s=>{const m=s.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/);return m?{pid:+m[1],ppid:+m[2],rssKiB:+m[3],cpuPercent:+m[4],command:m[5]}:null;}).filter((x):x is NonNullable<typeof x>=>!!x);const ids=new Set([process.pid]);for(let i=0;i<8;i++)for(const r of rows)if(ids.has(r.ppid))ids.add(r.pid);const own=rows.filter(r=>ids.has(r.pid)&&!r.command.endsWith('/ps'));const rss=own.reduce((n,r)=>n+r.rssKiB,0);samples.push({tMs:performance.now()-start,phase,rssKiB:rss,freeBytes:freemem(),processes:own});const free=freemem();if(rss>2.5*1024*1024||free<256*1024*1024){fatal=JSON.stringify({reason:'resource-hard-stop',rssKiB:rss,freeBytes:free,rssLimitKiB:2.5*1024*1024,freeFloorBytes:256*1024*1024});void stopNext();}}finally{monitorBusy=false;}}
 sample();
 async function statDB(){return(await db!.pool.query("SELECT pg_database_size(current_database())::text AS database_bytes,pg_current_wal_lsn()::text AS wal_lsn,blks_read,blks_hit,tup_returned,tup_fetched,temp_bytes FROM pg_stat_database WHERE datname=current_database()")).rows[0];}
 const before=await statDB();
 async function reader(n:number,iterations:number){for(let i=0;i<iterations;i++){if(fatal)throw Error(fatal);await request(n,'search','/api/catalog/search?q=Kaufmaennisches');await request(n,'pdf-full',urls[(n+i)%urls.length]);await request(n,'pdf-range',urls[(n+i+1)%urls.length],true);await sleep(400);}}
 phase='one-reader';await reader(0,6);
 phase='five-readers-worker-import';const readWork=Promise.all(Array.from({length:5},(_,i)=>reader(i,30)));let workerDone=false,workerJobs=0;const workerWork=(async()=>{while(!workerDone){if(fatal)throw Error(fatal);if(await worker.step())workerJobs++;else await sleep(100);if(workerJobs>4)throw Error('Worker job bound');}})();
 const importAt=performance.now();await importCase(12,4*1024*1024);const importMs=performance.now()-importAt;await store.discover();await readWork;workerDone=true;await workerWork;
 phase='backup-window';const settings=new SettingsService(auth),sv=await settings.read(accounts[0].headers()),theme=sv.rows.find(r=>r.kind==='theme')!;const a=sv.account;let writeAt=0,writeMs=0,writePromise:Promise<unknown>|undefined,backupReadCount=0;
 class MeasuredFiles extends PrivateFiles{override async read(key:string,sha:string,size:number){backupReadCount++;if(!writePromise){writeAt=performance.now();writePromise=settings.submit(accounts[0].headers(),{contractVersion:1,action:'settings',requestId:'pilot-load-writer',expectedAccountId:a.userId,expectedAccessGeneration:a.accessGeneration,expectedSessionContext:a.sessionContext,kind:'theme',id:theme.id,expectedRevision:theme.revision,operation:'patch',patch:{value:'azure'}}).then(v=>{writeMs=performance.now()-writeAt;return v;});}return super.read(key,sha,size);}}
 const waits:unknown[]=[];const poll=setInterval(()=>{void db!.pool.query("SELECT application_name,wait_event_type,wait_event FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'").then(r=>{if(r.rows.length)waits.push({atMs:performance.now()-start,rows:r.rows});});},5);
 const backupAt=performance.now();let backupResult;try{backupResult=await backup(bdb,new MeasuredFiles(files.root),join(root,'backup'),{encryptionKey:backupKey,authSecret:secret});await writePromise;}finally{clearInterval(poll);}const backupMs=performance.now()-backupAt;
 const after=await statDB(),walBytes=(await db.pool.query('SELECT pg_wal_lsn_diff($1,$2)::text AS bytes',[after.wal_lsn,before.wal_lsn])).rows[0].bytes;
 const sizes=(await db.pool.query('SELECT count(*)::int AS files,sum(byte_size)::text AS bytes FROM stex.catalog_document_versions')).rows[0];
 phase='idle-after';await sleep(1000);sample();
 await writeFile(join(proof,'measurement.json'),JSON.stringify({host:{platform:platform(),release:release(),cpus:cpus().length,totalMemoryBytes:totalmem()},method:{mode:'Next development webpack; warmed routes, no browser rendering',rssIntervalMs:250,rssSummed:'parent driver + descendants, shared memory may be counted repeatedly',hardRssKiB:2.5*1024*1024,hardWallMs:480000,readers:5,iterations:30,pausePerIterationMs:400,requestTimeoutMs:10000},dataset:{seedCases:12,incrementalCases:1,pagesPerFile:10,initialJobs,workerJobs,...sizes,padding:'unused PDF stream: large bytes but small text/graphics; no scans/images'},importMs,backup:{ms:backupMs,result:backupResult,readCount:backupReadCount,writerMs:writeMs,lockWaitSamples:waits},dbBefore:before,dbAfter:after,walBytes,requests,samples,fatal},null,2));
 console.log(JSON.stringify({done:true,requests:requests.length,errors:requests.filter(x=>x.error).length,files:sizes.files,bytes:sizes.bytes,backupMs,writerMs:writeMs,peakRssKiB:Math.max(...(samples as {rssKiB:number}[]).map(x=>x.rssKiB))}));
}catch(e){failed=true;await writeFile(join(proof,'failure.json'),JSON.stringify({name:e instanceof Error?e.name:'unknown',message:e instanceof Error?e.message:'failed',phase,fatal,requests,samples},null,2));process.exitCode=1;}
finally{clearTimeout(deadline);if(timer)clearInterval(timer);await stopNext();await bdb?.close();await db?.close();await cluster.stop().catch(()=>{});log.end();await rm(root,{recursive:true,force:true});await writeFile(join(proof,'cleanup.json'),JSON.stringify({root,removed:true,port,webPort,stoppedNext:true,stoppedCluster:true},null,2));if(failed)process.exitCode=1;}
