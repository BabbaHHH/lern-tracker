/** Isolated synthetic browser QA. No existing accounts, files or secrets are used. */
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { Database } from '../../src/lib/server/persistence/database';
import { PrivateFiles } from '../../src/lib/server/persistence/files';
import { AccountService } from '../../src/lib/server/auth/service';
import { CatalogImportService, validateCatalogPdf } from '../../src/lib/server/catalog/import-service';
import { SyntheticAccount, syntheticPdf } from './fixtures';
import { pdfViewerURL } from '../../src/lib/pdf-viewer/contract';
import { lockState } from '../../src/lib/server/persistence/repository';

const snapshot = resolve(process.argv[2]);
const root = await mkdtemp(join(tmpdir(),'stex-pdf-a-browser-'));
const port = 55466, webPort = 3046;
const password = randomBytes(24).toString('hex'), secret = randomBytes(48).toString('hex'), mailKey = randomBytes(48).toString('hex');
for(const [name,value] of [['postgres-password',password],['auth-secret',secret],['auth-mail-key',mailKey]])await writeFile(join(root,name),value,{mode:0o600});
const cluster = new EmbeddedPostgres({databaseDir:join(root,'postgres'),port,user:'stex_local',password,persistent:true,authMethod:'scram-sha-256',createPostgresUser:false,initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1','-k',root],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase('stex_local');
const database = new Database({host:'127.0.0.1',port,user:'stex_local',password,database:'stex_local'});
await database.migrate();
const files = new PrivateFiles(join(root,'files'));await files.initialize();
const baseURL = `http://localhost:${webPort}`;
const auth = new AccountService({database,files,baseURL,secret,mailKey});
const a = new SyntheticAccount(auth,'pdf-browser-a'), b = new SyntheticAccount(auth,'pdf-browser-b'), pending = new SyntheticAccount(auth,'pdf-browser-pending');
await a.initialize();await b.initialize();await pending.initialize(false);
const catalog = new CatalogImportService(auth,files);
const urls:Record<string,string> = {};
for(const [id,pages,large] of [['pdf-browser-small',3,0],['pdf-browser-large',120,8*1024*1024]] as const){
  const documents=[];
  for(const role of ['sachverhalt','loesung'] as const){const bytes=syntheticPdf(pages,large,role==='loesung');documents.push(await validateCatalogPdf({name:`${role}.pdf`,type:'application/pdf',size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer},role));}
  const result = await catalog.submit(a.headers(),{requestId:`request-${id}`,metadata:{id,source:'synthetic',title:id==='pdf-browser-small'?'PDF-A Browserprobe':'PDF-A grosse Datei',area:'zr',date:'',topicIds:[]},documents});
  const doc=result.summary.documents.find(doc=>doc.role==='sachverhalt')!;
  const identity={klausurId:id,documentId:doc.documentId,documentVersionId:doc.documentVersionId};
  urls[id]=baseURL+pdfViewerURL(identity,{pageNumber:2,quote:'kaufmaennisches bestaetigungsschreiben',occurrence:1});
}
await writeFile('/tmp/pdf-a-qa-info.json',JSON.stringify({root,port,webPort,urls,processId:process.pid},null,2));
const next=spawn(process.execPath,[join(snapshot,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(webPort)],{cwd:snapshot,env:{...process.env,STEX_AUTH_MODE:'local',BETTER_AUTH_URL:baseURL,STEX_LOCAL_DATA_DIR:root,STEX_LOCAL_POSTGRES_PORT:String(port)},stdio:['ignore','inherit','inherit']});
console.log('Synthetische Browserkonten und zwei PDF-Paare bereit.');
let stopping = false;
async function stop() {
  if(stopping)return; stopping=true; next.kill('SIGTERM');
  await database.close(); await cluster.stop(); await rm(root,{recursive:true,force:true}); process.exit(0);
}
const input=createInterface({input:process.stdin});
input.on('line',async line=>{
  if(line==='block-b') {await database.transaction(async client=>{await lockState(client);await client.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id='pdf-browser-b'");await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id='pdf-browser-b'");});console.log('Synthetisches B-Konto gesperrt.');}
  if(line==='stop')await stop();
});
process.on('SIGTERM',()=>{void stop();});
process.on('SIGINT',()=>{void stop();});
