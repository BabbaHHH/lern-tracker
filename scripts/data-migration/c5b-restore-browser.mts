/** Restore the disposable C5b browser fixture into another real cluster for UI acceptance. */
import { randomBytes } from "node:crypto";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { join,resolve } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import EmbeddedPostgres from "embedded-postgres";
import { Database } from "../../src/lib/server/persistence/database";
import { PrivateFiles } from "../../src/lib/server/persistence/files";
import { PostgresSearchStore } from "../../src/lib/server/search/store";
import { SearchWorker } from "../../src/lib/server/search/worker";
import { backup,restore } from "../../src/lib/server/persistence/backup";

const sourceRoot=resolve(process.argv[2]),snapshot=resolve(process.argv[3]);
if(!/^\/private\/tmp\/stex-c5b-browser-[a-zA-Z0-9]+$/.test(sourceRoot))throw new Error("Nur die eigene wegwerfbare C5b-Browserfixture ist zugelassen.");
async function freePort(){const server=createServer();await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw new Error("Port fehlt.");await new Promise<void>(resolve=>server.close(()=>resolve()));return address.port;}
const root=await mkdtemp(join("/private/tmp","stex-c5b-restore-"));
const sourcePort=Number((await readFile(join(sourceRoot,"postgres","postmaster.pid"),"utf8")).split("\n")[3]);
const secret=(await readFile(join(sourceRoot,"auth-secret"),"utf8")).trim(),mailKey=(await readFile(join(sourceRoot,"auth-mail-key"),"utf8")).trim();
const source=new Database({host:"127.0.0.1",port:sourcePort,user:"stex_local",password:(await readFile(join(sourceRoot,"postgres-password"),"utf8")).trim(),database:"stex_local"});
const encryptionKey=randomBytes(48).toString("hex");
if(JSON.stringify((await source.pool.query('SELECT user_id FROM stex.accounts ORDER BY user_id')).rows.map(r=>r.user_id))!==JSON.stringify(['c5b-browser-a','c5b-browser-b']))throw Error('Unexpected non-synthetic accounts.');
await backup(source,new PrivateFiles(join(sourceRoot,"files")),join(root,"backup"),{encryptionKey,authSecret:secret});await source.close();
const port=await freePort(),webPort=await freePort(),password=randomBytes(24).toString("hex");
for(const [name,value] of [["postgres-password",password],["auth-secret",secret],["auth-mail-key",mailKey]])await writeFile(join(root,name),value,{mode:0o600});
const cluster=new EmbeddedPostgres({databaseDir:join(root,"postgres"),port,user:"stex_local",password,persistent:true,authMethod:"scram-sha-256",createPostgresUser:false,initdbFlags:["--encoding=UTF8","--locale=C"],postgresFlags:["-h","127.0.0.1","-k",root],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase("stex_local");
const database=new Database({host:"127.0.0.1",port,user:"stex_local",password,database:"stex_local"});await database.migrate();
await restore(database,new PrivateFiles(join(root,"files")),join(root,"backup"),{encryptionKey,authSecret:secret});
const worker=new SearchWorker(new PostgresSearchStore(database),new PrivateFiles(join(root,"files")));for(let n=0;await worker.step();n++){if(n>30)throw new Error("Synthetischer Suchlauf überschritten.");}
const baseURL=`http://localhost:${webPort}`;
await writeFile(resolve('docs/entwuerfe/DATA-01/pruefungen/data-c5b-restore-runtime.json'),JSON.stringify({root,port,webPort,baseURL,snapshot,sourceRoot},null,2)+'\n');
console.log(JSON.stringify({root,baseURL,restored:true,accounts:"Nur synthetische C5b-Konten; neue Anmeldung erforderlich"}));
const next=spawn(process.execPath,["--import","tsx","--import",resolve("scripts/data-migration/c5b-network-guard.mts"),join(snapshot,"node_modules/next/dist/bin/next"),"dev","--webpack","--hostname","127.0.0.1","--port",String(webPort)],{cwd:snapshot,env:{...process.env,NEXT_TELEMETRY_DISABLED:"1",STEX_AUTH_MODE:"local",STEX_LEARNING_MODE:"account",STEX_ISOLATED_DEV:"1",BETTER_AUTH_URL:baseURL,STEX_LOCAL_DATA_DIR:root,STEX_LOCAL_POSTGRES_PORT:String(port)},stdio:["ignore","inherit","inherit"]});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;if(next.exitCode===null){next.kill("SIGTERM");await new Promise<void>(resolve=>next.once("exit",()=>resolve()));}await database.close();await cluster.stop();await rm(root,{recursive:true,force:true});process.exit(0);}
const input=createInterface({input:process.stdin});input.on("line",line=>{if(line==="stop")void stop();});process.on("SIGTERM",()=>void stop());process.on("SIGINT",()=>void stop());
