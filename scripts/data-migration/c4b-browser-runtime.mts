import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import EmbeddedPostgres from 'embedded-postgres';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
import {AccountService} from '../../src/lib/server/auth/service';
import {SyntheticAccount} from '../pdf-a/fixtures';
import {seedCorrectionFixture,seedCorrectionAccess,correctionSecrets} from './c4b-fixture.mts';
async function freePort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const a=s.address();if(!a||typeof a==='string')throw Error('port');await new Promise<void>(r=>s.close(()=>r()));return a.port;}
const snapshot=resolve(process.argv[2]);if(!snapshot.startsWith('/private/tmp/stex-data-c4b-app-'))throw Error('Own QA copy required.');
const root=await mkdtemp('/private/tmp/stex-c4b-browser-'),port=await freePort(),webPort=await freePort();
const password=randomBytes(24).toString('hex'),secret=randomBytes(48).toString('hex'),mailKey=randomBytes(48).toString('hex');
for(const [name,value] of [['postgres-password',password],['auth-secret',secret],['auth-mail-key',mailKey]])await writeFile(join(root,name),value,{mode:0o600});
const cluster=new EmbeddedPostgres({databaseDir:join(root,'postgres'),port,user:'stex_local',password,persistent:true,authMethod:'scram-sha-256',createPostgresUser:false,initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1','-k',root],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase('stex_local');
const database=new Database({host:'127.0.0.1',port,user:'stex_local',password,database:'stex_local'});await database.migrate();const files=new PrivateFiles(join(root,'files'));await files.initialize();const baseURL=`http://localhost:${webPort}`,auth=new AccountService({database,files,baseURL,secret,mailKey});
const a=new SyntheticAccount(auth,'c4b-browser-a'),b=new SyntheticAccount(auth,'c4b-browser-b');await a.initialize();await b.initialize();
await seedCorrectionFixture(auth,a);
const keys=correctionSecrets();await seedCorrectionAccess(auth,a,keys);await seedCorrectionAccess(auth,b,keys);
await writeFile(join(root,'credential-encryption'),keys.encryptionKey.toString('hex'),{mode:0o600});await writeFile(join(root,'credential-fingerprint'),keys.fingerprintKey.toString('hex'),{mode:0o600});
const metadata={root,port,webPort,baseURL,snapshot,accounts:[a.name,b.name]};await writeFile(resolve('docs/entwuerfe/DATA-01/pruefungen/data-c4b-browser-runtime.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata));
const next=spawn(process.execPath,['--import','tsx','--import',resolve('scripts/data-migration/c4b-mock-provider.mts'),join(snapshot,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(webPort)],{cwd:snapshot,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',STEX_AI_CREDENTIAL_ENCRYPTION_KEY:keys.encryptionKey.toString('hex'),STEX_AI_CREDENTIAL_FINGERPRINT_KEY:keys.fingerprintKey.toString('hex'),STEX_AUTH_MODE:'local',STEX_LEARNING_MODE:'account',STEX_ISOLATED_DEV:'1',BETTER_AUTH_URL:baseURL,STEX_LOCAL_DATA_DIR:root,STEX_LOCAL_POSTGRES_PORT:String(port)},detached:true,stdio:['ignore','inherit','inherit']});
let stopping=false;async function stop(){if(stopping)return;stopping=true;if(next.exitCode===null&&next.signalCode===null){process.kill(-next.pid!,'SIGTERM');await new Promise<void>(r=>next.once('exit',()=>r()));}await database.close();await cluster.stop();await rm(root,{recursive:true,force:true});process.exit(0);}
createInterface({input:process.stdin}).on('line',line=>{if(line==='stop')void stop();if(line==='crash-next'&&next.exitCode===null&&next.signalCode===null&&next.pid){const pid=next.pid;process.kill(-pid,'SIGKILL');console.log(JSON.stringify({testOnlyNextProcessGroupKilled:true,port:webPort,root,pendingPreservedWithoutReseed:true}));}});process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
