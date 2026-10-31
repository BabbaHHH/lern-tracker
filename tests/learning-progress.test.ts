import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { join } from "node:path";
import { readFile,writeFile } from "node:fs/promises";
import { test } from "node:test";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import { SyntheticAccount,syntheticPassword } from "../scripts/pdf-a/fixtures";
import { AccountService } from "../src/lib/server/auth/service";
import { lockState } from "../src/lib/server/persistence/repository";
import { ProgressService } from "../src/lib/server/learning/progress-service";
import { progressHTTP,commandHTTP } from "../src/lib/server/learning/http";
import { backup,restore } from "../src/lib/server/persistence/backup";
import { ProgressClient } from "../src/lib/learning/progress-client";
import { learningPageAllowed,LEARNING_BODY_LIMIT,type ProgressCommand } from "../src/lib/learning/progress-contract";
import { getLeafTopics,TOPICS } from "../src/lib/topics";

const topics=getLeafTopics(TOPICS).slice(0,3).map(t=>t.id);
test("DATA-C1: echte Kontositzungen, atomare Lernaktionen und geschützter Restore",{timeout:120000},async t=>{
  const runtime=await testRuntime();let repository=await runtime.repository("learning_source");
  const secret=randomBytes(48).toString("hex"),mailKey=randomBytes(48).toString("hex"),encryptionKey=randomBytes(48).toString("hex");
  let auth:AccountService;
  let progress:ProgressService;
  let dropResponse=false;
  const server=createServer(async(req,res)=>{
    try {
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
      const request=new Request(`${base}${req.url}`,{method:req.method,headers:new Headers(req.headers as Record<string,string>),body:chunks.length?Buffer.concat(chunks):undefined});
      const response=req.url?.startsWith("/api/learning/commands/")?await commandHTTP(request,progress,req.url.split("/").at(-1)!):await progressHTTP(request,progress);
      if (dropResponse && req.method==="POST" && response.ok) {dropResponse=false;res.destroy();return;}
      res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.statusCode=500;res.end();}
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();if(!address||typeof address==="string")throw new Error("HTTP-Testport fehlt.");
  const base=`http://127.0.0.1:${address.port}`;
  auth=new AccountService({database:repository.database,files:repository.files,baseURL:base,secret,mailKey});progress=new ProgressService(auth);
  const a=new SyntheticAccount(auth,"learning-a"),b=new SyntheticAccount(auth,"learning-b"),pending=new SyntheticAccount(auth,"learning-pending");
  await a.initialize();await b.initialize();await pending.initialize(false);
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.close();});
  const body=async(requestId:string,percent:number,ids=topics.slice(0,1),owner=a):Promise<ProgressCommand>=>{
    const view=await progress.read(owner.headers());
    return {contractVersion:1,requestId,expectedAccountId:view.account.userId,expectedAccessGeneration:view.account.accessGeneration,expectedSessionContext:view.account.sessionContext,action:"set",
      changes:ids.map(topicId=>({topicId,percent,expectedRevision:view.progress.find(r=>r.id===topicId)?.revision??null}))};
  };
  const post=async(command:unknown,owner=a,service=progress)=>{
    const headers=owner.headers();headers.set("origin",base);headers.set("x-stex-action","1");headers.set("content-type","application/json");
    return progressHTTP(new Request(`${base}/api/learning/progress`,{method:"POST",headers,body:JSON.stringify(command)}),service);
  };
  await t.test("Erstanlage, private Trennung und Belegwiederholung erhöhen Revision nur einmal",async()=>{
    assert.equal((await progress.read(a.headers())).progress.length,0);
    const command=await body("first",45);const result=await progress.submit(a.headers(),command);
    assert.equal(result.progress[0].revision,1);
    assert.equal((await progress.submit(a.headers(),command)).replay,true);
    assert.equal((await progress.read(b.headers())).progress.length,0);
    assert.equal((await progress.read(a.headers())).progress[0].revision,1);
    await assert.rejects(progress.submit(a.headers(),{...command,changes:[{topicId:topics[0],percent:70,expectedRevision:null}]}),/Vorgangskennung/);
    await assert.rejects(progress.status(b.headers(),"first"),/nicht gefunden/);
    assert.equal((await post(command,b)).status,409);
    assert.equal((await progress.read(b.headers())).progress.length,0);
  });
  await t.test("Gruppenänderung und Undo sind vollständig oder gar nicht; Revisionen bleiben monoton",async()=>{
    const command=await body("group",80,topics);const result=await progress.submit(a.headers(),command);
    const account=result.account;
    const undo={contractVersion:1,requestId:"undo-group",expectedAccountId:account.userId,expectedAccessGeneration:account.accessGeneration,expectedSessionContext:account.sessionContext,action:"undo",undoOfRequestId:"group"};
    const restored=await progress.submit(a.headers(),undo);
    assert.deepEqual(restored.progress.map(r=>r.value.percent),[45,0,0]);
    assert.equal(restored.progress[0].revision,3);
    assert.equal((await progress.submit(a.headers(),undo)).replay,true);
    const stale=await body("stale-group",90,topics);
    await progress.submit(a.headers(),await body("other-device",60));
    const before=await progress.read(a.headers());
    await assert.rejects(progress.submit(a.headers(),stale),/inzwischen geändert/);
    await assert.rejects(progress.submit(a.headers(),{...undo,requestId:"stale-undo"}),/inzwischen geändert/);
    assert.deepEqual((await progress.read(a.headers())).progress,before.progress);
  });
  await t.test("Abbruch nach Teiländerung und direkt vor Commit hinterlassen weder Daten noch Beleg",async()=>{
    const command=await body("write-failure",95,topics);
    const before=await progress.read(a.headers());
    await assert.rejects(new ProgressService(auth,{beforeWrite:index=>{if(index===1)throw new Error("synthetic-failure");}}).submit(a.headers(),command),/synthetic-failure/);
    await assert.rejects(new ProgressService(auth,{beforeCommit:()=>{throw new Error("synthetic-commit-failure");}}).submit(a.headers(),command),/synthetic-commit-failure/);
    assert.deepEqual((await progress.read(a.headers())).progress,before.progress);
    await assert.rejects(progress.status(a.headers(),command.requestId),/nicht gefunden/);
  });
  await t.test("HTTP-Grenze prüft echte Sitzung vor Body; fremde Felder, zu große Bodies und Ursprung blockiert",async()=>{
    const command=await body("validation",35);
    assert.equal((await post(command,pending)).status,403);
    assert.equal((await post({...command,ownerUserId:b.name})).status,400);
    assert.equal((await post({...command,changes:[{topicId:topics[0],percent:101,expectedRevision:4}]})).status,400);
    const headers=a.headers();headers.set("origin",base);headers.set("x-stex-action","1");headers.set("content-type","application/json");
    assert.equal((await progressHTTP(new Request(`${base}/api/learning/progress`,{method:"POST",headers,body:" ".repeat(LEARNING_BODY_LIMIT+1)}),progress)).status,413);
    headers.set("origin","https://foreign.example");
    assert.equal((await progressHTTP(new Request(`${base}/api/learning/progress`,{method:"POST",headers,body:JSON.stringify(command)}),progress)).status,403);
  });
  await t.test("Echter HTTP-Verbindungsabbruch nach Commit wird über Beleg aufgeklärt, ohne neue Revision",async()=>{
    const transport:typeof fetch=(path,options)=>fetch(new URL(String(path),base),{...options,headers:{...Object.fromEntries(new Headers(options?.headers)),cookie:a.headers().get("cookie")!,origin:base}});
    const client=new ProgressClient(transport);await client.load();dropResponse=true;
    await client.change({[topics[0]]:75},true);
    assert.equal(client.state.uncertain,true);
    const before=await progress.read(a.headers());
    await client.recover();assert.equal(client.state.status,"ready");assert.equal(client.state.records.find(r=>r.id===topics[0])!.value.percent,75);
    assert.deepEqual((await progress.read(a.headers())).progress,before.progress);
    client.dispose();
  });
  await t.test("Verspätete A-Antwort nach Kontowechsel ersetzt keine B-Werte",async()=>{
    let release:(value:Response)=>void=()=>{};let delayed=true;
    const accountA=(await progress.read(a.headers()));const accountB=await progress.read(b.headers());
    const client=new ProgressClient(async()=>delayed?new Promise<Response>(resolve=>{release=resolve;}):Response.json(accountB));
    const old=client.load();delayed=false;await client.load(true);release(Response.json(accountA));await old;
    assert.equal(client.state.account?.userId,b.name);assert.deepEqual(client.state.records,[]);client.dispose();
  });
  await t.test("Neue Anmeldung desselben Kontos verwirft alte Aufträge; Sitzungshinweis ersetzt keinen Cookie",async()=>{
    const old=await body("before-relogin",50);
    await a.auth("/sign-out",{});await a.auth("/sign-in/email",{email:`${a.name}@example.test`,password:syntheticPassword});
    const fresh=await progress.read(a.headers());assert.equal(fresh.account.accessGeneration,old.expectedAccessGeneration);
    assert.notEqual(fresh.account.sessionContext,old.expectedSessionContext);
    assert.equal((await post(old)).status,409);
    assert.equal((await progressHTTP(new Request(`${base}/api/learning/progress`,{headers:{cookie:`better-auth.session_token=${fresh.account.sessionContext}`}}),progress)).status,401);
  });
  await t.test("Neustart und verschlüsselter Vollrestore erhalten Fortschritt/Belege; neue Anmeldung ist zwingend",async()=>{
    const before=await progress.read(a.headers());
    repository=await runtime.restart("learning_source",repository.files);
    auth=new AccountService({database:repository.database,files:repository.files,baseURL:base,secret,mailKey});progress=new ProgressService(auth);
    assert.deepEqual((await progress.read(a.headers())).progress,before.progress);
    const directory=join(runtime.root,"learning-backup");
    await backup(repository.database,repository.files,directory,{encryptionKey,authSecret:secret});
    const manifest=JSON.parse(await readFile(join(directory,"manifest.json"),"utf8"));assert.equal(manifest.version,4);assert.equal(manifest.format,"stex-postgres-encrypted");
    const target=await runtime.repository("learning_restore");
    await restore(target.database,target.files,directory,{encryptionKey,authSecret:secret});
    const restoredAuth=new AccountService({database:target.database,files:target.files,baseURL:base,secret,mailKey});const restoredProgress=new ProgressService(restoredAuth);
    await assert.rejects(restoredProgress.read(a.headers()),/anmelden/);
    const fresh=new SyntheticAccount(restoredAuth,a.name);await fresh.auth("/sign-in/email",{email:`${a.name}@example.test`,password:syntheticPassword});
    assert.deepEqual((await restoredProgress.read(fresh.headers())).progress,before.progress);
    assert.equal((await restoredProgress.status(fresh.headers(),"first")).requestId,"first");
    assert.equal((await target.database.pool.query("SELECT count(*) FROM stex.learning_commands")).rows[0].count,(await repository.database.pool.query("SELECT count(*) FROM stex.learning_commands")).rows[0].count);
    manifest.version=2;const old=join(runtime.root,"old-format");await import("node:fs/promises").then(fs=>fs.mkdir(old));await writeFile(join(old,"manifest.json"),JSON.stringify(manifest));
    await assert.rejects(restore(target.database,target.files,old,{encryptionKey,authSecret:secret}),/beschädigt|Schlüssel/);
  });
  await t.test("Sperre zwischen Vorprüfung und Schreibtransaktion blockiert auch Replay",async()=>{
    const firstB=await body("b-before-block",5,topics.slice(0,1),b);await progress.submit(b.headers(),firstB);
    const command=await body("after-block",30,topics.slice(0,1),b);
    const locked=new ProgressService(auth,{beforeTransaction:()=>auth.database.transaction(async client=>{
      await lockState(client);await client.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id=$1",[b.name]);
      await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1",[b.name]);
    })});
    await assert.rejects(locked.submit(b.headers(),command),/anmelden/);
    assert.equal((await repository.database.pool.query("SELECT count(*) FROM stex.personal_records WHERE owner_user_id=$1",[b.name])).rows[0].count,"1");
    await assert.rejects(progress.submit(b.headers(),firstB),/anmelden/);
    await assert.rejects(progress.read(b.headers()),/anmelden/);
    const liveA=new SyntheticAccount(auth,a.name);a.cookies.forEach((value,key)=>liveA.cookies.set(key,value));
    await liveA.auth("/sign-out",{});await assert.rejects(progress.read(a.headers()),/anmelden/);
  });
});
test("Reglerereignisse werden gebündelt; eine zwischenzeitliche Antwort darf die erwartete Revision nicht erneuern",async()=>{
  const account={userId:"client-a",accessGeneration:1,sessionContext:"session-a"};let revision=1;let sent:ProgressCommand|undefined;
  const client=new ProgressClient(async(_url,init)=>{
    if(init?.method==="POST") {sent=JSON.parse(String(init.body));return Response.json({contractVersion:1,error:{code:"conflict",message:"Konflikt"}},{status:409});}
    return Response.json({contractVersion:1,account,topicsVersion:"test",progress:[{id:topics[0],revision,value:{topicId:topics[0],percent:10,source:"manual",updatedAt:"2026-10-12T00:00:00Z"}}]});
  });
  await client.load();client.stage({[topics[0]]:15});client.stage({[topics[0]]:20});revision=2;await client.load();
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(sent?.action,"set");if(sent?.action!=="set")throw new Error("Lernaktion fehlt.");
  assert.equal(sent.changes[0].percent,20);assert.equal(sent.changes[0].expectedRevision,1);assert.equal(client.state.status,"error");client.dispose();
});
test("Verlassen während des Speicherns bleibt unbestätigt und wird mit demselben Beleg aufgeklärt",async()=>{
  const account={userId:"client-a",accessGeneration:1,sessionContext:"session-a"};let resolvePost:(response:Response)=>void=()=>{};let committed=false;
  const record=()=>({id:topics[0],revision:committed?2:1,value:{topicId:topics[0],percent:committed?20:10,source:"manual",updatedAt:"2026-10-12T00:00:00Z"}});
  const client=new ProgressClient(async(url,init)=>{
    if(init?.method==="POST") {committed=true;return new Promise<Response>(resolve=>{resolvePost=resolve;});}
    if(String(url).includes("/commands/"))return Response.json({contractVersion:1,account,requestId:"test",action:"set",replay:true,progress:[record()]});
    return Response.json({contractVersion:1,account,topicsVersion:"test",progress:[record()]});
  });
  await client.load();const sending=client.change({[topics[0]]:20});client.hide();await client.load(true);
  assert.equal(client.state.status,"error");assert.equal(client.state.uncertain,true);
  resolvePost(Response.json({contractVersion:1,account,requestId:"test",action:"set",progress:[record()],replay:false}));await sending;
  assert.equal(client.state.status,"error");await client.recover();assert.equal(client.state.status,"ready");assert.equal(client.state.records[0].value.percent,20);client.dispose();
});
test("Kontomodus erhält Fachseiten und blockiert unverbundene persönliche Altansichten",()=>{
  for(const path of ["/themen","/konto/anmelden","/konto/klausuren","/konto/klausuren/pdf","/konto/verwaltung"])assert.equal(learningPageAllowed(path),true);
  for(const path of ["/","/admin","/kalender","/plan","/wochenplan","/schreiben/a","/onboarding","/klausuren"])assert.equal(learningPageAllowed(path),false);
});
