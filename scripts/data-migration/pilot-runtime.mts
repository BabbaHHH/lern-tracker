/** One bounded synthetic integration journey on a source-only copy. No real data or AI. */
import {mkdtemp,writeFile,readFile,cp,symlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createWriteStream} from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
import {AccountService} from '../../src/lib/server/auth/service';
import {SyntheticAccount} from '../pdf-a/fixtures';
import {importSearchFixture} from '../search/catalog-fixture';
import {SearchWorker} from '../../src/lib/server/search/worker';
import {PostgresSearchStore} from '../../src/lib/server/search/store';
async function freePort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const a=s.address();if(!a||typeof a==='string')throw Error('port');await new Promise<void>(r=>s.close(()=>r()));return a.port;}
const base=resolve('.'),proof=join(base,'docs/entwuerfe/DATA-01/pruefungen'),root=await mkdtemp('/private/tmp/stex-pilot-data-'),snapshot=await mkdtemp('/private/tmp/stex-pilot-app-');
const accepted=JSON.parse(await readFile(join(proof,'data-c5b-source-final.json'),'utf8')) as {hashes:Record<string,string>};
for(const [p,hash] of Object.entries(accepted.hashes))if(createHash('sha256').update(await readFile(p)).digest('hex')!==hash)throw Error('Product source differs: '+p);
for(const dir of ['src','public','db/migrations'])await cp(join(base,dir),join(snapshot,dir),{recursive:true});
for(const f of ['package.json','package-lock.json','next-env.d.ts','tsconfig.json','next.config.ts','postcss.config.mjs','eslint.config.mjs'])await cp(join(base,f),join(snapshot,f));
await symlink(join(base,'node_modules'),join(snapshot,'node_modules'),'dir');const config=JSON.parse(await readFile(join(snapshot,'tsconfig.json'),'utf8'));config.compilerOptions.incremental=false;config.include=['next-env.d.ts','src/**/*.ts','src/**/*.tsx','.next-qa/dev/types/**/*.ts'];config.exclude=['node_modules'];await writeFile(join(snapshot,'tsconfig.json'),JSON.stringify(config,null,2)+'\n');
const port=await freePort(),webPort=await freePort(),baseURL=`http://localhost:${webPort}`,password=randomBytes(24).toString('hex'),secret=randomBytes(48).toString('hex'),mailKey=randomBytes(48).toString('hex');
const metadata={root,snapshot,port,webPort,baseURL,accounts:['pilot-a','pilot-b'],planningDay:'2026-10-17',scope:'Only synthetic login/profile/manual task/plan/writing/documents/settings/catalog-search-PDF/A-B journey'};await writeFile(join(proof,'pilot-runtime.json'),JSON.stringify(metadata,null,2)+'\n');
for(const [name,value] of [['postgres-password',password],['auth-secret',secret],['auth-mail-key',mailKey]])await writeFile(join(root,name),value,{mode:0o600});
const cluster=new EmbeddedPostgres({databaseDir:join(root,'postgres'),port,user:'stex_local',password,persistent:true,authMethod:'scram-sha-256',createPostgresUser:false,initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1','-k',root],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase('stex_local');const database=new Database({host:'127.0.0.1',port,user:'stex_local',password,database:'stex_local'});await database.migrate();const files=new PrivateFiles(join(root,'files'));await files.initialize();const auth=new AccountService({database,files,baseURL,secret,mailKey}),a=new SyntheticAccount(auth,'pilot-a'),b=new SyntheticAccount(auth,'pilot-b');await a.initialize();await b.initialize();await importSearchFixture(auth,a.headers());const worker=new SearchWorker(new PostgresSearchStore(database),files);let jobs=0;while(await worker.step()){if(++jobs>20)throw Error('Fixture index overflow');}
await writeFile(join(root,'Pilot-Original.txt'),'Nur synthetische lokale Pilotunterlage. Keine echte Lernquelle.\n');
await writeFile(join(proof,'pilot-source-before.json'),JSON.stringify({recordedAt:new Date().toISOString(),hashes:accepted.hashes,sourceFiles:Object.keys(accepted.hashes).length,snapshot,searchJobs:jobs,seed:'Only two synthetic accounts and synthetic indexed catalog. Personal journey records start empty.'},null,2)+'\n');console.log(JSON.stringify(metadata));
const log=createWriteStream(join(proof,'pilot-server.log'),{flags:'a'});const next=spawn(process.execPath,['--import','tsx','--import',resolve('scripts/data-migration/pilot-network-guard.mts'),join(snapshot,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(webPort)],{cwd:snapshot,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',STEX_AUTH_MODE:'local',STEX_LEARNING_MODE:'account',STEX_ISOLATED_DEV:'1',STEX_TEST_DATE:'2026-10-17',BETTER_AUTH_URL:baseURL,STEX_LOCAL_DATA_DIR:root,STEX_LOCAL_POSTGRES_PORT:String(port)},stdio:['ignore','pipe','pipe']});next.stdout!.pipe(log,{end:false});next.stderr!.pipe(log,{end:false});
let stopping=false;async function stop(){if(stopping)return;stopping=true;if(next.exitCode===null){next.kill('SIGTERM');await new Promise<void>(r=>next.once('exit',()=>r()));}await database.close();await cluster.stop();log.end();console.log('Own pilot services stopped; dataset and copy retained for explicit final audit/cleanup.');process.exit(0);}
createInterface({input:process.stdin}).on('line',line=>{if(line==='stop')void stop();});process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
