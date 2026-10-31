/** Resume the exact preserved C5a fixture without initialisation, migration or seeding. */
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import EmbeddedPostgres from 'embedded-postgres';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
const root='/private/tmp/stex-c5a-browser-aV9rqG',snapshot='/private/tmp/stex-data-c5a-app-1DYgfq',port=64213,webPort=64214;
if((await readFile(join(root,'postgres/PG_VERSION'),'utf8')).trim()!=='18')throw Error('Unexpected preserved PostgreSQL version.');
const password=(await readFile(join(root,'postgres-password'),'utf8')).trim();
const cluster=new EmbeddedPostgres({databaseDir:join(root,'postgres'),port,user:'stex_local',password,persistent:true,authMethod:'scram-sha-256',createPostgresUser:false,postgresFlags:['-h','127.0.0.1','-k',root],onLog:()=>{},onError:()=>{}});
await cluster.start();
const database=new Database({host:'127.0.0.1',port,user:'stex_local',password,database:'stex_local'});
let next:ReturnType<typeof spawn>|undefined;
async function stop(){if(next&&next.exitCode===null){next.kill('SIGTERM');await new Promise<void>(r=>next!.once('exit',()=>r()));}await database.close();await cluster.stop();}
try {
 const accounts=(await database.pool.query('SELECT user_id FROM stex.accounts ORDER BY user_id')).rows.map(r=>r.user_id);
 if(JSON.stringify(accounts)!==JSON.stringify(['c5a-browser-a','c5a-browser-b']))throw Error('Unexpected accounts.');
 const migrations=(await database.pool.query('SELECT name,sha256 FROM stex.schema_migrations ORDER BY name')).rows;
 const names=(await readdir('db/migrations')).filter(x=>x.endsWith('.sql')).sort();
 if(JSON.stringify(migrations.map(r=>r.name))!==JSON.stringify(names))throw Error('Schema set differs.');
 for(const m of migrations)if(createHash('sha256').update(await readFile(join('db/migrations',m.name))).digest('hex')!==m.sha256)throw Error('Schema checksum differs.');
 const files=new PrivateFiles(join(root,'files'));
 const versions=(await database.pool.query('SELECT storage_key,sha256,byte_size FROM stex.document_versions UNION ALL SELECT storage_key,sha256,byte_size FROM stex.catalog_document_versions')).rows;
 for(const v of versions)await files.read(v.storage_key,v.sha256,Number(v.byte_size));
 const documents=(await database.pool.query("SELECT record_key,revision FROM stex.personal_records WHERE kind='document' ORDER BY record_key")).rows;
 const report={recordedAt:new Date().toISOString(),root,snapshot,port,webPort,accounts,migrationsVerified:migrations.length,filesVerified:versions.length,documents,noReseed:true};
 await writeFile('docs/entwuerfe/DATA-01/pruefungen/data-c5a-resumed-integrity-latest.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 next=spawn(process.execPath,['--import','tsx','--import',resolve('scripts/data-migration/c5a-network-guard.mts'),join(snapshot,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(webPort)],{cwd:snapshot,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',STEX_AUTH_MODE:'local',STEX_LEARNING_MODE:'account',STEX_ISOLATED_DEV:'1',BETTER_AUTH_URL:`http://localhost:${webPort}`,STEX_LOCAL_DATA_DIR:root,STEX_LOCAL_POSTGRES_PORT:String(port)},stdio:['ignore','inherit','inherit']});
 let stopping=false;const shutdown=async()=>{if(stopping)return;stopping=true;await stop();process.exit(0);};
 createInterface({input:process.stdin}).on('line',line=>{if(line==='stop')void shutdown();});process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());
}catch(error){await stop();throw error;}
