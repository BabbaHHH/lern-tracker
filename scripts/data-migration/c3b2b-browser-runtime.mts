/** Disposable local browser acceptance. No existing configuration or browser data is loaded. */
import { randomBytes } from "node:crypto";
import { mkdtemp,writeFile,rm } from "node:fs/promises";
import { join,resolve } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import EmbeddedPostgres from "embedded-postgres";
import { Database } from "../../src/lib/server/persistence/database";
import { PrivateFiles } from "../../src/lib/server/persistence/files";
import { AccountService } from "../../src/lib/server/auth/service";
import { SyntheticAccount,syntheticPdf } from "../pdf-a/fixtures";
import { CatalogImportService,validateCatalogPdf } from "../../src/lib/server/catalog/import-service";
import { pdfViewerURL } from "../../src/lib/pdf-viewer/contract";
import { PostgresSearchStore } from "../../src/lib/server/search/store";
import { SearchWorker } from "../../src/lib/server/search/worker";
import {TOPICS,getLeafTopics} from "../../src/lib/topics";
import {encryptCredential,credentialFingerprint} from "../../src/lib/server/ai-credentials/crypto";
import {seedPreparationFixture} from './c3b2a-fixture.mts';
import {PreparationService} from '../../src/lib/server/learning/preparation-service';
import { lockState } from "../../src/lib/server/persistence/repository";

async function freePort() {const server=createServer();await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw new Error("Port fehlt.");await new Promise<void>(resolve=>server.close(()=>resolve()));return address.port;}
const snapshot=resolve(process.argv[2]);
const root=await mkdtemp(join("/private/tmp","stex-c3b2b-browser-"));
const port=await freePort(),webPort=await freePort();
const password=randomBytes(24).toString("hex"),secret=randomBytes(48).toString("hex"),mailKey=randomBytes(48).toString("hex");
for(const [name,value] of [["postgres-password",password],["auth-secret",secret],["auth-mail-key",mailKey]])await writeFile(join(root,name),value,{mode:0o600});
const cluster=new EmbeddedPostgres({databaseDir:join(root,"postgres"),port,user:"stex_local",password,persistent:true,authMethod:"scram-sha-256",createPostgresUser:false,
  initdbFlags:["--encoding=UTF8","--locale=C"],postgresFlags:["-h","127.0.0.1","-k",root],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase("stex_local");
const database=new Database({host:"127.0.0.1",port,user:"stex_local",password,database:"stex_local"});await database.migrate();
const files=new PrivateFiles(join(root,"files"));await files.initialize();
const baseURL=`http://localhost:${webPort}`;
const auth=new AccountService({database,files,baseURL,secret,mailKey});
const a=new SyntheticAccount(auth,"c3b2b-browser-a"),b=new SyntheticAccount(auth,"c3b2b-browser-b"),pending=new SyntheticAccount(auth,"c3b2b-browser-pending");
await a.initialize();await b.initialize();await pending.initialize(false);
const credentialSecrets={encryptionKey:randomBytes(32),fingerprintKey:randomBytes(32)};
await writeFile(join(root,'credential-encryption'),credentialSecrets.encryptionKey.toString('hex'),{mode:0o600});await writeFile(join(root,'credential-fingerprint'),credentialSecrets.fingerprintKey.toString('hex'),{mode:0o600});
const identity={credentialId:'c3b2b-browser-credential',ownerUserId:a.name,source:'own' as const},syntheticKey='sk-or-v1-C3B2B-BROWSER-SYNTHETIC-0000';
await database.transaction(async c=>{await lockState(c);await c.query("INSERT INTO stex.ai_credentials(credential_id,owner_user_id,source,encrypted_key,key_fingerprint,key_suffix,configured,revision) VALUES($1,$2,'own',$3,$4,'0000',true,1)",[identity.credentialId,a.name,encryptCredential(syntheticKey,identity,credentialSecrets),credentialFingerprint(syntheticKey,credentialSecrets)]);await c.query("INSERT INTO stex.ai_credential_selections(owner_user_id,selected_source,revision) VALUES($1,'own',1)",[a.name]);});
const documents=[];
for(const role of ["sachverhalt","loesung"] as const) {const bytes=syntheticPdf();documents.push(await validateCatalogPdf({name:`${role}.pdf`,type:"application/pdf",size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer},role));}
const imported=await new CatalogImportService(auth,files).submit(a.headers(),{requestId:"c3b2b-browser-catalog",metadata:{id:"c3b2b-browser-case",source:"synthetic",title:"C3b2b synthetischer Katalogfall",area:"zr",date:"",topicIds:[getLeafTopics(TOPICS)[0].id]},documents});
const doc=imported.summary.documents[0];
const worker=new SearchWorker(new PostgresSearchStore(database),files);for(let n=0;await worker.step();n++){if(n>30)throw new Error("Synthetischer Suchlauf überschritten.");}
const seeded=await seedPreparationFixture(auth,a,'c3b2b-browser-case');
const prep=new PreparationService(auth),v=await prep.read(a.headers());await prep.submit(a.headers(),{contractVersion:1,action:'preparation',requestId:'c3b2a_checkin_browser_seed',expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,snapshot:v.snapshot,dates:seeded.selectedDays});
console.log(JSON.stringify({root,baseURL,seeded,pdfURL:baseURL+pdfViewerURL({klausurId:"c3b2b-browser-case",documentId:doc.documentId,documentVersionId:doc.documentVersionId}),accounts:[a.name,b.name,pending.name]}));
const next=spawn(process.execPath,["--import","tsx","--import",resolve("scripts/data-migration/c3b2b-mock-provider.mts"),join(snapshot,"node_modules/next/dist/bin/next"),"dev","--webpack","--hostname","127.0.0.1","--port",String(webPort)],
  {cwd:snapshot,env:{...process.env,NEXT_TELEMETRY_DISABLED:"1",STEX_AI_CREDENTIAL_ENCRYPTION_KEY:credentialSecrets.encryptionKey.toString("hex"),STEX_AI_CREDENTIAL_FINGERPRINT_KEY:credentialSecrets.fingerprintKey.toString("hex"),STEX_AUTH_MODE:"local",STEX_LEARNING_MODE:"account",STEX_ISOLATED_DEV:"1",BETTER_AUTH_URL:baseURL,STEX_LOCAL_DATA_DIR:root,STEX_LOCAL_POSTGRES_PORT:String(port)},stdio:["ignore","inherit","inherit"]});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;next.kill("SIGTERM");await new Promise<void>(resolve=>next.once("exit",()=>resolve()));await database.close();await cluster.stop();await rm(root,{recursive:true,force:true});process.exit(0);}
const input=createInterface({input:process.stdin});
input.on("line",async line=>{
  if(line==="stop")await stop();
  if(line==="status")console.log(JSON.stringify((await database.pool.query("SELECT owner_user_id,id,revision,payload->>'percent' AS percent FROM stex.personal_records WHERE kind='progress' ORDER BY owner_user_id,id")).rows));

});
process.on("SIGTERM",()=>void stop());process.on("SIGINT",()=>void stop());
