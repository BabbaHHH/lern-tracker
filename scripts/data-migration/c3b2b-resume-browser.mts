/** Resume only the two preserved synthetic QA clusters after an interrupted tool session. */
import {readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import EmbeddedPostgres from 'embedded-postgres';
import {Database} from '../../src/lib/server/persistence/database';

const [role,rootArg,copyArg]=process.argv.slice(2);
const known=role==='source'?{root:'/private/tmp/stex-c3b2b-browser-rdSLCG',copy:'/private/tmp/stex-data-c3b2b-app-V2s0Ga',web:52984}:null;
if(!known||resolve(rootArg)!==known.root||resolve(copyArg)!==known.copy)throw Error('Nur die zwei bewahrten eigenen C3b2b-Testziele sind zulässig.');
const root=known.root,copy=known.copy,source='/private/tmp/stex-c3b2b-browser-rdSLCG';
const pid=(await readFile(join(root,'postgres/postmaster.pid'),'utf8')).split('\n'),port=Number(pid[3]);
const password=(await readFile(join(root,'postgres-password'),'utf8')).trim();
const cluster=new EmbeddedPostgres({databaseDir:join(root,'postgres'),port,user:'stex_local',password,persistent:true,authMethod:'scram-sha-256',createPostgresUser:false,postgresFlags:['-h','127.0.0.1','-k',root],onLog:()=>{},onError:()=>{}});
// No initialise/createDatabase/migrate/restore: preserve the already checked actual dataset.
await cluster.start();
const database=new Database({host:'127.0.0.1',port,user:'stex_local',password,database:'stex_local'});
const accounts=(await database.pool.query<{user_id:string}>('SELECT user_id FROM stex.accounts ORDER BY user_id')).rows.map(r=>r.user_id);
if(JSON.stringify(accounts)!==JSON.stringify(['c3b2b-browser-a','c3b2b-browser-b','c3b2b-browser-pending']))throw Error('Bewahrtes Ziel enthält unerwartete Konten.');
const migration=(await database.pool.query("SELECT name FROM stex.schema_migrations WHERE name='011_checkin_commands.sql'")).rowCount;
if(migration!==1)throw Error('Bewahrter eigener Schema-011-Stand fehlt.');
const baseURL=`http://localhost:${known.web}`;
const next=spawn(process.execPath,['--import','tsx','--import',resolve('scripts/data-migration/c3b2b-mock-provider.mts'),join(copy,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(known.web)],{cwd:copy,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',STEX_AUTH_MODE:'local',STEX_LEARNING_MODE:'account',STEX_ISOLATED_DEV:'1',BETTER_AUTH_URL:baseURL,STEX_LOCAL_DATA_DIR:root,STEX_LOCAL_POSTGRES_PORT:String(port),STEX_AI_CREDENTIAL_ENCRYPTION_KEY:(await readFile(join(source,'credential-encryption'),'utf8')).trim(),STEX_AI_CREDENTIAL_FINGERPRINT_KEY:(await readFile(join(source,'credential-fingerprint'),'utf8')).trim()},stdio:['ignore','inherit','inherit']});
console.log(JSON.stringify({role,root,copy,baseURL,preservedDataset:true,noReseed:true}));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;next.kill('SIGTERM');await new Promise<void>(r=>next.once('exit',()=>r()));await database.close();await cluster.stop();await rm(root,{recursive:true,force:true});process.exit(0);}
createInterface({input:process.stdin}).on('line',line=>{if(line==='stop')void stop();});
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
