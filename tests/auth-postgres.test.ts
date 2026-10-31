import assert from "node:assert/strict";
import { createHmac,randomBytes } from "node:crypto";
import { fork } from "node:child_process";
import { createServer,request as httpRequest } from "node:http";
import { readFile,writeFile,mkdir,cp } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { getMigrations } from "better-auth/db/migration";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import { AccountService } from "../src/lib/server/auth/service";
import { AccountError } from "../src/lib/server/auth/security";
import { backup,restore } from "../src/lib/server/persistence/backup";
import { fixtureBackup,fixtureContext } from "../scripts/data-migration/fixture";

const password="Synthetisches Passwort 2026!";
const newPassword="Neues synthetisches Passwort 2026!";
const topic="zr-mat-at-vertragsschluss-145ff";
function totp(uri:string):string {
  const secret=new URL(uri).searchParams.get("secret")!;
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";
  for(const c of secret.toUpperCase().replace(/=+$/,""))bits+=alphabet.indexOf(c).toString(2).padStart(5,"0");
  const key=Buffer.from((bits.match(/.{8}/g)??[]).map(v=>parseInt(v,2)));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const mac=createHmac("sha1",key).update(counter).digest(),offset=mac[mac.length-1]&15;
  return ((mac.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,"0");
}
async function mailNavigation(url:URL,headers:Headers):Promise<Response> {
  // Undici fetch replaces Sec-Fetch-Mode with "cors". Use a real HTTP navigation
  // transport so the server receives the browser's actual mail-link metadata.
  return new Promise((resolve,reject)=>{
    const request=httpRequest(url,{method:"GET",headers:Object.fromEntries(headers)},incoming=>{
      const chunks:Buffer[]=[];incoming.on("data",part=>chunks.push(Buffer.from(part)));incoming.on("end",()=>{
        const responseHeaders=new Headers();for(let i=0;i<incoming.rawHeaders.length;i+=2)responseHeaders.append(incoming.rawHeaders[i],incoming.rawHeaders[i+1]);
        resolve(new Response(Buffer.concat(chunks),{status:incoming.statusCode,headers:responseHeaders}));
      });incoming.on("error",reject);
    });request.on("error",reject);request.end();
  });
}
class Browser {
  cookies=new Map<string,string>();
  constructor(readonly base:string){}
  headers():Headers {return new Headers({cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; ")});}
  async call(path:string,body?:unknown,extra:Record<string,string>={}) {
    const headers=this.headers();Object.entries(extra).forEach(([k,v])=>headers.set(k,v));
    if(body!==undefined){headers.set("content-type","application/json");if(!headers.has("origin"))headers.set("origin",this.base);headers.set("x-stex-action","1");}
    const response=extra["sec-fetch-mode"]==="navigate"?await mailNavigation(new URL(path,this.base),headers):await fetch(new URL(path,this.base),{method:body===undefined?"GET":"POST",headers,body:body===undefined?undefined:JSON.stringify(body),redirect:"manual"});
    for(const header of response.headers.getSetCookie()){const pair=header.split(";")[0],index=pair.indexOf("=");if(index<1)continue;const k=pair.slice(0,index),v=pair.slice(index+1);if(!v || /max-age=0/i.test(header))this.cookies.delete(k);else this.cookies.set(k,v);}
    const responseText=await response.text();
    const data=responseText && response.headers.get("content-type")?.includes("application/json")?JSON.parse(responseText):null;
    return {status:response.status,data,headers:response.headers};
  }
}
test("AUTH-A: echte HTTP-Sitzungen, PostgreSQL und lokale Bibliotheksmails",{timeout:180000},async t=>{
  const runtime=await testRuntime();let repository=await runtime.repository("auth_a_source");
  const secret=randomBytes(48).toString("base64url"),mailKey=randomBytes(48).toString("base64url"),backupKey=randomBytes(48).toString("base64url");
  let service:AccountService;
  const server=createServer(async(req,res)=>{
    try {
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
      const request=new Request(`${base}${req.url}`,{method:req.method,headers:new Headers(req.headers as Record<string,string>),body:chunks.length?Buffer.concat(chunks):undefined});
      const response=req.url?.startsWith("/api/auth/")?await service.authHTTP(request):await service.accountHTTP(request);
      res.statusCode=response.status;for(const [k,v]of response.headers)if(k!=="set-cookie")res.setHeader(k,v);
      if(response.headers.getSetCookie().length)res.setHeader("set-cookie",response.headers.getSetCookie());
      res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.statusCode=500;res.end("Testtransport fehlgeschlagen.");}
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();if(!address || typeof address==="string")throw new Error("Testserver fehlt.");
  const base=`http://127.0.0.1:${address.port}`;
  service=new AccountService({database:repository.database,baseURL:base,secret,mailKey});
  t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.close();});
  const workerConfig=join(runtime.root,"auth-worker-private.json");
  await writeFile(workerConfig,JSON.stringify({database:{...repository.database.pool.options,password:repository.database.pool.options.password},secret,mailKey}),{mode:0o600});
  const worker=fork(join(process.cwd(),"scripts/auth/test-worker.mts"),[workerConfig],{execArgv:["--import","tsx"],stdio:["ignore","ignore","ignore","ipc"]});
  let workerStopped=false;
  const stopWorker=async()=>{if(workerStopped)return;workerStopped=true;await new Promise<void>(resolve=>{worker.once("exit",()=>resolve());worker.send("stop");});};
  t.after(stopWorker);
  const workerBase=await new Promise<string>((resolve,reject)=>{worker.once("message",m=>resolve((m as {base:string}).base));worker.once("error",reject);worker.once("exit",()=>reject(new Error("Zweiter Testprozess nicht verfügbar.")));});
  const n=new Browser(base),a=new Browser(base),b=new Browser(base),anonymous=new Browser(base);
  const adminEmail="admin@example.test",aEmail="a@example.test",bEmail="b@example.test";
  const resetLimits=async()=>repository.database.pool.query("DELETE FROM stex.auth_limits");
  const signup=async(browser:Browser,email:string)=>{
    const invite=(await service.localMails(email)).filter(m=>m.purpose==="invitation").at(-1)!;
    const token=new URL(invite.url).searchParams.get("token");
    const result=await browser.call("/api/auth/sign-up/email",{email,password,invitationToken:token});assert.equal(result.status,200,"Eingeladene Kontoanlage");
  };
  const confirm=async(browser:Browser,email:string)=>{
    const mail=(await service.localMails(email)).filter(m=>m.purpose==="verification").at(-1)!;
    const result=await browser.call(mail.url,undefined,{"sec-fetch-site":"cross-site","sec-fetch-mode":"navigate"});assert.equal(result.status,302,"Echte Bibliotheksbestätigung aus Mailnavigation");
  };
  const login=async(browser:Browser,email:string,pass=password)=>{
    const result=await browser.call("/api/auth/sign-in/email",{email,password:pass});assert.equal(result.status,200,"Echte Bibliotheksanmeldung");assert.equal(result.data.token,undefined);assert.equal(result.data.session,undefined);return result.data;
  };
  let adminId="",aId="",bId="",adminURI="",codes:string[]=[],oldInvitation="";
  await t.test("N-01/I-01: expliziter Bootstrap, keine öffentliche Kontoanlage",async()=>{
    assert.equal((await anonymous.call("/api/auth/sign-up/email",{email:aEmail,password,name:"A"})).status,403);
    const prepared=await service.prepareAdmin(adminEmail,"Admin Test") as {userId:string};adminId=prepared.userId;
    await assert.rejects(service.prepareAdmin("second@example.test","Zweiter Admin"),AccountError);
    const row=(await repository.database.pool.query("SELECT status,role FROM stex.accounts WHERE user_id=$1",[adminId])).rows[0];
    assert.equal(row.status,"pending");assert.equal(row.role,"member");
  });
  await t.test("Schema entspricht der festgelegten Bibliothek und erhält alte Konten",async()=>{
    const plan=await getMigrations(service.auth.options);
    assert.equal(plan.toBeCreated.length,0);assert.equal(plan.toBeAdded.length,0);assert.equal(plan.schemaProblems.length,0);
    await repository.createAccount({userId:"legacy-owner",status:"active",role:"member",revision:1});
    assert.equal((await repository.database.pool.query("SELECT generation FROM stex.account_access WHERE user_id='legacy-owner'")).rows[0].generation,1);
  });
  await t.test("A-01/N-02: Adresse, Wartestatus und verifizierte Admin-TOTP-Einrichtung",async()=>{
    await signup(n,adminEmail);
    assert.equal((await n.call("/api/auth/sign-in/email",{email:adminEmail,password})).status,403);
    await confirm(n,adminEmail);await login(n,adminEmail);
    const who=await n.call("/api/account");assert.equal(who.data.account.status,"pending");assert.equal(who.data.account.bootstrap,true);
    assert.equal((await n.call("/api/account/notes")).status,403);
    await assert.rejects(service.finishAdmin(adminId),AccountError);
    const enable=await n.call("/api/auth/two-factor/enable",{password,method:"totp"});assert.equal(enable.status,200);adminURI=enable.data.totpURI;codes=enable.data.backupCodes;
    await assert.rejects(service.finishAdmin(adminId),AccountError);
    assert.equal((await n.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI),trustDevice:false})).status,200);
    await service.finishAdmin(adminId);assert.equal((await n.call("/api/account")).status,401);
    assert.equal((await login(n,adminEmail)).twoFactorRedirect,true);
    assert.equal((await n.call("/api/account/admin/accounts")).status,401);
    assert.equal((await n.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI),trustDevice:false})).status,200);
    assert.equal((await n.call("/api/account/admin/accounts")).status,200);
  });
  await t.test("N-03/N-05: Vertrauensgerät und alternative Authwege sind geschlossen",async()=>{
    assert.equal((await n.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI),trustDevice:true})).status,403);
    assert.equal((await n.call("/api/auth/two-factor/disable",{password})).status,404);
    assert.equal((await n.call("/api/auth/change-email",{newEmail:"other@example.test"})).status,404);
    assert.equal((await n.call("/api/auth/update-session",{stexGeneration:99})).status,404);
    assert.equal((await anonymous.call("/api/auth/sign-in/social",{provider:"google"})).status,404);
  });
  await t.test("I-01/I-08: zwei Mitglieder einladen, Wiederholung und keine zweite Identität",async()=>{
    for(const [email,name]of [[aEmail,"Mitglied A"],[bEmail,"Mitglied B"]]) {
      const body={email,name,requestId:`invite-${name}`};const result=await n.call("/api/account/admin/invitations",body);assert.equal(result.status,201);
      const repeat=await n.call("/api/account/admin/invitations",body);assert.equal(repeat.status,200);assert.equal(repeat.data.userId,result.data.userId);
      if(email===aEmail)aId=result.data.userId;else bId=result.data.userId;
    }
    assert.equal((await n.call("/api/account/admin/invitations",{email:aEmail,name:"A",requestId:"new-a"})).status,409);
    oldInvitation=(await service.localMails(bEmail)).filter(m=>m.purpose==="invitation").at(-1)!.url;
    assert.equal((await n.call("/api/account/admin/account-action",{userId:bId,action:"resend",expectedRevision:1,requestId:"resend-b"})).status,200);
    const token=new URL(oldInvitation).searchParams.get("token");
    assert.equal((await b.call("/api/auth/sign-up/email",{email:bEmail,password,invitationToken:token})).status,403);
  });
  await t.test("I-03/I-07: abgelaufene, fremde und falsch adressierte Einladung",async()=>{
    const token=new URL((await service.localMails(aEmail)).filter(m=>m.purpose==="invitation").at(-1)!.url).searchParams.get("token");
    assert.equal((await b.call("/api/auth/sign-up/email",{email:bEmail,password,invitationToken:token})).status,403);
    assert.equal((await a.call("/api/auth/sign-up/email",{email:aEmail,password,invitationToken:"wrong"})).status,403);
    const invite=await n.call("/api/account/admin/invitations",{email:"expired@example.test",name:"Abgelaufen",requestId:"expired"});assert.equal(invite.status,201);
    await repository.database.pool.query("UPDATE stex.account_invitations SET expires_at=now()-interval '1 second' WHERE user_id=$1",[invite.data.userId]);
    const expired=new URL((await service.localMails("expired@example.test"))[0].url).searchParams.get("token");
    assert.equal((await anonymous.call("/api/auth/sign-up/email",{email:"expired@example.test",password,invitationToken:expired})).status,403);
    assert.equal((await n.call("/api/account/admin/account-action",{userId:invite.data.userId,action:"revoke",expectedRevision:1,requestId:"expired-revoke"})).status,200);
    assert.equal((await n.call("/api/account/admin/invitations",{email:"expired@example.test",name:"Kein zweiter Besitzer",requestId:"expired-duplicate"})).status,409);
  });
  await resetLimits();
  await t.test("I-04: zwanzig konkurrierende Einlösungen erzeugen genau ein Konto",async()=>{
    const token=new URL((await service.localMails(aEmail)).filter(m=>m.purpose==="invitation").at(-1)!.url).searchParams.get("token");
    const results=await Promise.all(Array.from({length:20},(_,i)=>new Browser(i%2?workerBase:base).call("/api/auth/sign-up/email",{email:aEmail,password,invitationToken:token})));
    assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===403).length,19);
    assert.equal((await repository.database.pool.query("SELECT count(*) FROM public.stex_auth_user WHERE email=$1",[aEmail])).rows[0].count,"1");
    assert.equal((await repository.database.pool.query("SELECT count(*) FROM stex.auth_identities WHERE user_id=$1",[aId])).rows[0].count,"1");
  });
  await resetLimits();
  await t.test("I-05/I-06: Fehler nach Authcommit und sichere Wiederaufnahme",async()=>{
    const invited=await n.call("/api/account/admin/invitations",{email:"interrupted@example.test",name:"Unterbrochen",requestId:"interrupted"});assert.equal(invited.status,201);
    const token=new URL((await service.localMails("interrupted@example.test"))[0].url).searchParams.get("token");
    let fail=true;service=new AccountService({database:repository.database,baseURL:base,secret,mailKey,afterSignup:async()=>{if(fail)throw new Error("Synthetischer Fehler");}});
    const c=new Browser(base);assert.equal((await c.call("/api/auth/sign-up/email",{email:"interrupted@example.test",password,invitationToken:token})).status,503);
    assert.equal((await repository.database.pool.query("SELECT count(*) FROM stex.auth_identities WHERE user_id=$1",[invited.data.userId])).rows[0].count,"0");
    assert.equal((await c.call("/api/auth/sign-in/email",{email:"interrupted@example.test",password})).status,401);
    fail=false;assert.equal((await c.call("/api/auth/sign-up/email",{email:"interrupted@example.test",password:newPassword,invitationToken:token})).status,200);
    assert.equal((await repository.database.pool.query("SELECT count(*) FROM public.stex_auth_user WHERE email='interrupted@example.test'")).rows[0].count,"1");
    await confirm(c,"interrupted@example.test");await login(c,"interrupted@example.test");
    assert.equal((await c.call("/api/account/notes")).status,403);
  });
  await t.test("A-01/A-02: echte Mitglieder warten bis zur persönlichen Freischaltung",async()=>{
    await signup(b,bEmail);assert.equal((await n.call("/api/account/admin/account-action",{userId:aId,action:"activate",expectedRevision:1,requestId:"too-early"})).status,409);await confirm(a,aEmail);await confirm(b,bEmail);await login(a,aEmail);await login(b,bEmail);
    assert.equal((await a.call("/api/account/notes")).status,403);
    assert.equal((await a.call("/api/account/admin/account-action",{userId:aId,action:"activate",expectedRevision:1,requestId:"self"})).status,403);
    for(const id of [aId,bId])assert.equal((await n.call("/api/account/admin/account-action",{userId:id,action:"activate",expectedRevision:1,requestId:`activate-${id}`})).status,200);
    assert.equal((await a.call("/api/account/notes")).status,401);await login(a,aEmail);await login(b,bEmail);
  });
  await t.test("A-03/A-04/A-05: vollständiger persönlicher Schreiben-/Lesen-Ablauf",async()=>{
    assert.equal((await a.call("/api/account/notes",{id:"same-note",note:"Notiz A",topicId:topic,expectedRevision:null})).status,200);
    assert.equal((await b.call("/api/account/notes",{id:"same-note",note:"Notiz B",topicId:topic,expectedRevision:null})).status,200);
    const aRead=await a.call("/api/account/notes/same-note"),bRead=await b.call("/api/account/notes/same-note");
    assert.equal(aRead.data.note.value.note,"Notiz A");assert.equal(bRead.data.note.value.note,"Notiz B");
    assert.equal((await a.call("/api/account/notes",{id:"foreign",note:"Fremd",topicId:topic,expectedRevision:null,ownerUserId:bId})).status,400);
    assert.equal((await a.call("/api/account/notes",{id:"same-note",note:"Neu",topicId:topic,expectedRevision:null})).status,409);
    assert.equal((await b.call("/api/account/notes/does-not-exist")).status,404);
    assert.equal((await n.call("/api/account/notes/same-note")).status,404);
    assert.equal((await a.call("/api/account/notes?ownerUserId="+bId)).data.notes[0].value.note,"Notiz A");
  });
  await t.test("S-03/N-06: Sperre und Schreiben sowie konkurrierende Verwaltung",async()=>{
    const results=await Promise.all([
      n.call("/api/account/admin/account-action",{userId:bId,action:"block",expectedRevision:2,requestId:"race-block-1"}),
      n.call("/api/account/admin/account-action",{userId:bId,action:"block",expectedRevision:2,requestId:"race-block-2"}),
      b.call("/api/account/notes",{id:"race-note",note:"Nur vor Sperrcommit erlaubt",topicId:topic,expectedRevision:null})
    ]);
    assert.equal(results.slice(0,2).filter(r=>r.status===200).length,1);assert.equal(results.slice(0,2).filter(r=>r.status===409).length,1);
    assert.ok([200,401].includes(results[2].status));assert.equal((await b.call("/api/account/notes")).status,401);
    assert.equal((await n.call("/api/account/admin/account-action",{userId:bId,action:"unblock",expectedRevision:3,requestId:"race-unblock"})).status,200);
    assert.equal((await b.call("/api/account/notes")).status,401);await login(b,bEmail);
  });
  await t.test("S-01/S-02/S-03/S-04: bestehende Sitzungen sperren, nicht wiederbeleben",async()=>{
    const second=new Browser(base);await login(second,aEmail);const old=new Map(a.cookies);
    assert.equal((await n.call("/api/account/admin/account-action",{userId:aId,action:"block",expectedRevision:2,requestId:"block-a"})).status,200);
    assert.equal((await a.call("/api/account/notes")).status,401);assert.equal((await second.call("/api/account/notes")).status,401);
    assert.equal((await a.call("/api/auth/sign-in/email",{email:aEmail,password})).status,401);
    assert.equal((await n.call("/api/account/admin/account-action",{userId:aId,action:"unblock",expectedRevision:3,requestId:"unblock-a"})).status,200);
    a.cookies=old;assert.equal((await a.call("/api/account/notes")).status,401);await login(a,aEmail);
    const who=await service.principal(a.headers());
    // A library row retained despite failed deletion is still rejected by generation.
    await repository.database.pool.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1",[aId]);
    await assert.rejects(repository.database.transaction(client=>service.checkPrincipal(client,who.sessionId,"active",false,true)),AccountError);
    assert.equal((await a.call("/api/account/notes",{id:"same-note",note:"Stale",topicId:topic,expectedRevision:1})).status,401);
    await login(a,aEmail);
  });
  await t.test("S-04: Sperre bleibt bei echtem Fehler der Sitzungsbereinigung wirksam",async()=>{
    await repository.database.pool.query(`CREATE FUNCTION public.auth_test_delete_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic cleanup failure'; END $$`);
    await repository.database.pool.query('CREATE TRIGGER auth_test_delete_failure BEFORE DELETE ON public.stex_auth_session FOR EACH ROW EXECUTE FUNCTION public.auth_test_delete_failure()');
    let revision:number;
    try {
      const current=(await n.call("/api/account/admin/accounts")).data.accounts.find((account:{userId:string})=>account.userId===aId);
      const blocked=await n.call("/api/account/admin/account-action",{userId:aId,action:"block",expectedRevision:current.revision,requestId:"cleanup-failure-block"});
      assert.equal(blocked.status,200);assert.equal(blocked.data.librarySessionsRevoked,false);revision=blocked.data.revision;
      assert.ok(Number((await repository.database.pool.query('SELECT count(*) FROM public.stex_auth_session s JOIN stex.auth_identities i ON i.auth_user_id=s."userId" WHERE i.user_id=$1',[aId])).rows[0].count)>0);
      assert.equal((await a.call("/api/account/notes")).status,401);assert.equal((await a.call("/api/account/notes",{id:"denied",note:"Verboten",topicId:topic,expectedRevision:null})).status,401);
    }finally{await repository.database.pool.query('DROP TRIGGER auth_test_delete_failure ON public.stex_auth_session');await repository.database.pool.query('DROP FUNCTION public.auth_test_delete_failure()');}
    const retry=await n.call("/api/account/admin/account-action",{userId:aId,action:"cleanup",expectedRevision:revision!,requestId:"cleanup-retry"});assert.equal(retry.status,200);assert.equal(retry.data.librarySessionsRevoked,true);
    assert.equal((await n.call("/api/account/admin/account-action",{userId:aId,action:"unblock",expectedRevision:retry.data.revision,requestId:"cleanup-unblock"})).status,200);assert.equal((await a.call("/api/account/notes")).status,401);await login(a,aEmail);
  });
  await resetLimits();
  await t.test("N-04/N-06/B-01: Rollen, letzter Admin und Origin/CSRF schützen",async()=>{
    assert.equal((await a.call("/api/account/admin/accounts")).status,403);
    assert.equal((await n.call("/api/account/admin/account-action",{userId:adminId,action:"block",expectedRevision:2,requestId:"last-admin"})).status,403);
    assert.equal((await a.call("/api/account/notes",{id:"csrf",topicId:topic,note:"CSRF",expectedRevision:null},{origin:"https://foreign.example"})).status,403);
    assert.equal((await anonymous.call("/api/auth/sign-in/email",{email:aEmail,password},{origin:"https://foreign.example"})).status,403);
    assert.equal((await anonymous.call("/api/auth/request-password-reset",{email:aEmail,redirectTo:"https://foreign.example"})).status,403);
    const missing=await fetch(`${base}/api/account/notes`,{method:"POST",headers:{cookie:a.headers().get("cookie")!,origin:base,"content-type":"application/json"},body:"{}"});assert.equal(missing.status,403);
    assert.equal((await a.call("/api/account/notes")).headers.get("cache-control"),"private, no-store");
  });
  await t.test("A-06/A-07/N-04: falsche Cookies, Ablauf und frische Adminprüfung",async()=>{
    const forged=new Browser(base);forged.cookies.set("better-auth.session_token","forged");assert.equal((await forged.call("/api/account")).status,401);
    const admin=await service.principal(n.headers(),"admin");
    await repository.database.pool.query('UPDATE public.stex_auth_session SET "createdAt"=now()-interval \'11 minutes\' WHERE id=$1',[admin.sessionId]);
    assert.equal((await n.call("/api/account/admin/invitations",{email:"fresh@example.test",name:"Frisch",requestId:"fresh"})).status,401);
    await repository.database.pool.query('UPDATE public.stex_auth_session SET "createdAt"=now()-interval \'9 hours\' WHERE id=$1',[admin.sessionId]);
    assert.equal((await n.call("/api/account/admin/accounts")).status,401);
    await login(n,adminEmail);assert.equal((await n.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI)})).status,200);
    const who=await service.principal(b.headers());
    const lifespan=(await repository.database.pool.query('SELECT extract(epoch FROM ("expiresAt"-"createdAt")) AS seconds FROM public.stex_auth_session WHERE id=$1',[who.sessionId])).rows[0];assert.ok(Math.abs(Number(lifespan.seconds)-604800)<1);
    await repository.database.pool.query('UPDATE public.stex_auth_session SET "expiresAt"=now()-interval \'1 second\' WHERE id=$1',[who.sessionId]);
    assert.equal((await b.call("/api/account")).status,401);await login(b,bEmail);
  });
  await t.test("B-01: echte Cookieausgabe bei fest konfigurierter HTTPS-Origin",async()=>{
    const https=new AccountService({database:repository.database,baseURL:"https://localhost:3443",secret,mailKey});
    const result=await https.authHTTP(new Request("https://localhost:3443/api/auth/sign-in/email",{method:"POST",headers:{origin:"https://localhost:3443","content-type":"application/json","x-stex-action":"1"},body:JSON.stringify({email:bEmail,password})}));
    assert.equal(result.status,200);const cookie=result.headers.getSetCookie().find(value=>value.includes("session_token="))!;
    assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=Lax/i);assert.match(cookie,/Path=\//);
    assert.equal((await anonymous.call("/api/auth/verify-email?token=invalid&callbackURL=https%3A%2F%2Fforeign.example")).status,403);
  });
  await t.test("R-01/R-02: Bibliotheksreset, Sessionentzug, Replay und gleiche Besitzer-ID",async()=>{
    const unknown=await anonymous.call("/api/auth/request-password-reset",{email:"unknown@example.test",redirectTo:"/konto/zuruecksetzen"});
    const known=await anonymous.call("/api/auth/request-password-reset",{email:aEmail,redirectTo:"/konto/zuruecksetzen"});assert.equal(unknown.status,known.status);assert.equal(known.status,200);
    const mail=(await service.localMails(aEmail)).filter(m=>m.purpose==="reset").at(-1)!;
    const callback=await anonymous.call(mail.url,undefined,{"sec-fetch-site":"cross-site","sec-fetch-mode":"navigate"});assert.equal(callback.status,302);
    const token=new URL(callback.headers.get("location")!,base).searchParams.get("token");
    assert.equal((await anonymous.call("/api/auth/reset-password",{token,newPassword})).status,200);
    assert.equal((await a.call("/api/account/notes")).status,401);
    assert.notEqual((await anonymous.call("/api/auth/reset-password",{token,newPassword:password})).status,200);
    await login(a,aEmail,newPassword);assert.equal((await a.call("/api/account")).data.account.userId,aId);
  });
  await t.test("R-02: Fehler beim Passwortspeichern lässt keine alte Sitzung zu",async()=>{
    await anonymous.call("/api/auth/request-password-reset",{email:aEmail,redirectTo:"/konto/zuruecksetzen"});
    const callback=await anonymous.call((await service.localMails(aEmail)).filter(m=>m.purpose==="reset").at(-1)!.url);
    const token=new URL(callback.headers.get("location")!,base).searchParams.get("token");
    await repository.database.pool.query(`CREATE FUNCTION public.auth_test_password_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic storage failure'; END $$`);
    await repository.database.pool.query('CREATE TRIGGER auth_test_password_failure BEFORE UPDATE OF password ON public.stex_auth_account FOR EACH ROW EXECUTE FUNCTION public.auth_test_password_failure()');
    try {
      assert.ok((await anonymous.call("/api/auth/reset-password",{token,newPassword:password})).status>=400);
      assert.equal((await a.call("/api/account/notes")).status,401);
    }finally{await repository.database.pool.query('DROP TRIGGER auth_test_password_failure ON public.stex_auth_account');await repository.database.pool.query('DROP FUNCTION public.auth_test_password_failure()');}
    await login(a,aEmail,newPassword);
    await anonymous.call("/api/auth/request-password-reset",{email:aEmail,redirectTo:"/konto/zuruecksetzen"});
    const next=await anonymous.call((await service.localMails(aEmail)).filter(m=>m.purpose==="reset").at(-1)!.url);
    const shared=new URL(next.headers.get("location")!,base).searchParams.get("token");
    const resets=await Promise.all([new Browser(base),new Browser(base)].map(browser=>browser.call("/api/auth/reset-password",{token:shared,newPassword})));
    assert.equal(resets.filter(result=>result.status===200).length,1);assert.equal((await a.call("/api/account/notes")).status,401);await login(a,aEmail,newPassword);
  });
  await t.test("R-03: echter Recoverycode ist nur einmal nutzbar",async()=>{
    let recovery=new Browser(base);const rival=new Browser(base);await login(recovery,adminEmail);await login(rival,adminEmail);
    const attempts=await Promise.all([recovery,rival].map(browser=>browser.call("/api/auth/two-factor/verify-backup-code",{code:codes[0],trustDevice:false})));
    assert.equal(attempts.filter(result=>result.status===200).length,1);if(attempts[1].status===200)recovery=rival;
    assert.equal((await recovery.call("/api/account/admin/accounts")).status,403);
    assert.equal((await recovery.call("/api/account")).data.account.bootstrap,true);
    assert.equal((await n.call("/api/account/admin/accounts")).status,401);
    const again=new Browser(base);await login(again,adminEmail);
    assert.notEqual((await again.call("/api/auth/two-factor/verify-backup-code",{code:codes[0],trustDevice:false})).status,200);
    const enabled=await recovery.call("/api/auth/two-factor/enable",{password,method:"totp"});assert.equal(enabled.status,200);adminURI=enabled.data.totpURI;codes=enabled.data.backupCodes;
    assert.equal((await recovery.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI)})).status,200);await service.finishAdmin(adminId);
  });
  await login(n,adminEmail);assert.equal((await n.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI)})).status,200);
  await t.test("B-02: atomare, gemeinsam gespeicherte Limits bei parallelen Versuchen",async()=>{
    await resetLimits();
    const results=await Promise.all(Array.from({length:16},(_,i)=>new Browser(i%2?workerBase:base).call("/api/auth/sign-in/email",{email:"limited@example.test",password:"incorrect-password"})));
    assert.equal(results.filter(r=>r.status===429).length,6);
    assert.equal((await repository.database.pool.query("SELECT max(count) AS maximum FROM stex.auth_limits")).rows[0].maximum,10);
  });
  await resetLimits();
  await t.test("A-03: Daten und echte Sitzungen nach PostgreSQL-Prozessneustart",async()=>{
    await stopWorker();
    repository=await runtime.restart("auth_a_source",repository.files);
    service=new AccountService({database:repository.database,baseURL:base,secret,mailKey});
    assert.equal((await a.call("/api/account/notes/same-note")).data.note.value.note,"Notiz A");
    assert.equal((await b.call("/api/account/notes/same-note")).data.note.value.note,"Notiz B");
  });
  await t.test("B-04/B-05: geschützte Vollsicherung, Restore und echte Anmeldung mit TOTP",async()=>{
    // Add synthetic private original bytes to prove the existing DATA backup boundary.
    await repository.createAccount({userId:"fixture-owner",status:"active",role:"member",revision:1});
    const context={...fixtureContext(),ownerUserId:"fixture-owner"};await repository.import(await repository.preview(fixtureBackup(),context),"fixture");
    const pending=await n.call("/api/account/admin/invitations",{email:"before-restore@example.test",name:"Offen",requestId:"before-restore"});assert.equal(pending.status,201);
    await assert.rejects(backup(repository.database,repository.files,join(runtime.root,"unprotected")),/getrennten Sicherungsschlüssel/);
    const location=join(runtime.root,"auth-backup"),protection={encryptionKey:backupKey,authSecret:secret};
    const saved=await backup(repository.database,repository.files,location,protection);assert.equal(saved.fileCount,1);
    const text=await readFile(join(location,"manifest.json"),"utf8");assert.equal(text.includes(adminEmail),false);assert.equal(text.includes(adminURI),false);assert.equal(text.includes(codes[1]),false);
    const target=await runtime.repository("auth_a_restore");
    await assert.rejects(restore(target.database,target.files,location,{...protection,authSecret:"x".repeat(48)}),/Schlüssel/);
    await restore(target.database,target.files,location,protection);
    assert.equal((await target.database.pool.query("SELECT count(*) FROM public.stex_auth_session")).rows[0].count,"0");
    assert.equal((await target.database.pool.query("SELECT count(*) FROM public.stex_auth_verification")).rows[0].count,"0");
    assert.equal((await target.database.pool.query("SELECT count(*) FROM stex.auth_email_tokens")).rows[0].count,"0");
    assert.equal((await target.database.pool.query("SELECT count(*) FROM stex.auth_mail_outbox")).rows[0].count,"0");
    assert.ok((await target.database.pool.query("SELECT revoked_at FROM stex.account_invitations WHERE user_id=$1",[pending.data.userId])).rows[0].revoked_at);
    const previous=service;service=new AccountService({database:target.database,baseURL:base,secret,mailKey});
    assert.equal((await a.call("/api/account/notes")).status,401);await login(a,aEmail,newPassword);
    assert.equal((await a.call("/api/account/notes/same-note")).data.note.value.note,"Notiz A");
    await login(n,adminEmail);assert.equal((await n.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI)})).status,200);assert.equal((await n.call("/api/account/admin/accounts")).status,200);
    service=previous;
  });
  await t.test("B-05: Altschema, beschädigte Sicherung und zusätzliche Spalten scheitern geschlossen",async()=>{
    const folder=join(runtime.root,"old-format");await mkdir(folder);await writeFile(join(folder,"manifest.json"),JSON.stringify({format:"stex-postgres-private-files",version:1}));
    const target=await runtime.repository("auth_a_old_restore");await assert.rejects(restore(target.database,target.files,folder),/Unbekanntes Sicherungsformat/);
    const broken=join(runtime.root,"broken-auth");await cp(join(runtime.root,"auth-backup"),broken,{recursive:true});
    const file=join(broken,"manifest.json"),value=JSON.parse(await readFile(file,"utf8"));const sealedParts=String(value.sealed).split(".");sealedParts[2]=sealedParts[2][0]==="A"?`B${sealedParts[2].slice(1)}`:`A${sealedParts[2].slice(1)}`;value.sealed=sealedParts.join(".");await writeFile(file,JSON.stringify(value));
    await assert.rejects(restore(target.database,target.files,broken,{encryptionKey:backupKey,authSecret:secret}),/beschädigt/);
    await repository.database.pool.query("ALTER TABLE stex.accounts ADD COLUMN unexpected text");
    await assert.rejects(backup(repository.database,repository.files,join(runtime.root,"schema-mismatch"),{encryptionKey:backupKey,authSecret:secret}),/Sicherungsschema/);
    await repository.database.pool.query("ALTER TABLE stex.accounts DROP COLUMN unexpected");
  });
  await t.test("R-04/N-02: betriebliche Adminwiederherstellung erhält Besitzer-ID",async()=>{
    await login(n,adminEmail);assert.equal((await n.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI)})).status,200);
    await service.recoverAdmin(adminId);assert.equal((await n.call("/api/account")).status,401);
    assert.equal((await login(n,adminEmail)).twoFactorRedirect,undefined);
    const account=(await n.call("/api/account")).data.account;assert.equal(account.userId,adminId);assert.equal(account.status,"pending");assert.equal(account.role,"member");assert.equal(account.bootstrap,true);
    const enabled=await n.call("/api/auth/two-factor/enable",{password,method:"totp"});assert.equal(enabled.status,200);adminURI=enabled.data.totpURI;
    assert.equal((await n.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI)})).status,200);await service.finishAdmin(adminId);
    await login(n,adminEmail);assert.equal((await n.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI)})).status,200);
    assert.equal((await n.call("/api/account/admin/accounts")).status,200);
  });
  await t.test("A-08: ausgefallene Datenbank ohne Sitzungs-/Browserfallback",async()=>{
    await repository.database.close();
    const result=await a.call("/api/account/notes");assert.equal(result.status,503);assert.equal(result.data.notes,undefined);
  });
});
