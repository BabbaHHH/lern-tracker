/** Local-only browser harness for I-02/A-06; serves only synthetic mail and cookie fixtures. */
import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir,writeFile,unlink } from "node:fs/promises";
import { join } from "node:path";
import { testRuntime } from "../../data-migration/postgres-test-runtime";
import { AccountService } from "../../../src/lib/server/auth/service";
import { SessionClient,freePort,until,password,totp,counts } from "./helpers";

const reportRoot=process.env.STEX_AUTH_R1_REPORT_ROOT;
if(process.env.STEX_AUTH_R1_SNAPSHOT!=="1" || !reportRoot)throw new Error("Isolierte R1-Quellkopie und eigener Berichtsordner erforderlich.");
const runtime=await testRuntime(),repository=await runtime.repository("stex_local"),database=repository.database;
const secret=randomBytes(48).toString("base64url"),mailKey=randomBytes(48).toString("base64url"),privateRoot=join(runtime.root,"next-private"),base=`http://localhost:${await freePort()}`;
await mkdir(privateRoot,{mode:0o700});
const config=database.pool.options;
const roleSQL=(await database.pool.query("SELECT format('CREATE ROLE stex_local WITH LOGIN SUPERUSER PASSWORD %L', $1::text) AS sql",[config.password])).rows[0].sql;
await database.pool.query(roleSQL);
for(const [name,value]of [["auth-secret",secret],["auth-mail-key",mailKey],["postgres-password",config.password as string]])await writeFile(join(privateRoot,name),value,{mode:0o600});
const env:NodeJS.ProcessEnv={NODE_ENV:"development"};for(const key of ["PATH","TMPDIR","LANG","LC_ALL"])if(process.env[key])env[key]=process.env[key];
Object.assign(env,{NEXT_TELEMETRY_DISABLED:"1",NODE_ENV:"development",STEX_AUTH_MODE:"local",STEX_LEARNING_MODE:"account",BETTER_AUTH_URL:base,STEX_LOCAL_DATA_DIR:privateRoot,STEX_LOCAL_POSTGRES_PORT:String(config.port),STEX_PRIVATE_FILE_ROOT:repository.files.root,STEX_ISOLATED_DEV:"1"});
const next=spawn(process.execPath,[join(process.cwd(),"node_modules/next/dist/bin/next"),"dev","--webpack","--hostname","127.0.0.1","--port",new URL(base).port],{cwd:process.cwd(),env,stdio:["ignore","ignore","ignore"]});
const service=new AccountService({database,files:repository.files,baseURL:base,secret,mailKey});
const mail=async(email:string,purpose:string)=>(await service.localMails(email)).filter(m=>m.purpose===purpose).at(-1)!;
const register=async(client:SessionClient,email:string)=>{
  const link=(await mail(email,"invitation")).url;assert.equal((await client.call("/api/auth/sign-up/email",{email,password,invitationToken:new URL(link).searchParams.get("token")})).status,200);
  assert.equal((await client.call((await mail(email,"verification")).url,undefined,true)).status,302);
};
const admin=new SessionClient(base),email="r1-browser-admin@example.test";
let server:ReturnType<typeof createServer>|undefined;
const controlFile="/private/tmp/stex-auth-r1-browser-control.json";
let stop:()=>void=()=>{};const finished=new Promise<void>(resolve=>{stop=resolve;});
try {
  await until(async()=>{try{return (await fetch(`${base}/konto`)).status===200;}catch{return false;}},"isolated Next page",60000);
  const prepared=await service.prepareAdmin(email,"R1 Browseradmin") as {userId:string};await register(admin,email);
  assert.equal((await admin.call("/api/auth/sign-in/email",{email,password})).status,200);
  const enabled=await admin.call("/api/auth/two-factor/enable",{password,method:"totp"});assert.equal(enabled.status,200);assert.equal((await admin.call("/api/auth/two-factor/verify-totp",{code:totp(enabled.data.totpURI)})).status,200);
  await service.finishAdmin(prepared.userId);assert.equal((await admin.call("/api/auth/sign-in/email",{email,password})).status,200);assert.equal((await admin.call("/api/auth/two-factor/verify-totp",{code:totp(enabled.data.totpURI)})).status,200);
  const users=[] as {id:string;email:string;client:SessionClient}[];
  for(const letter of ["A","B","C"]) {
    const address=`r1-browser-${letter.toLowerCase()}@example.test`,invite=await admin.call("/api/account/admin/invitations",{email:address,name:`R1 ${letter}`,requestId:randomUUID()});assert.equal(invite.status,201);
    const client=new SessionClient(base);users.push({id:invite.data.userId,email:address,client});
    if(letter!=="C"){await register(client,address);const action=await admin.call("/api/account/admin/account-action",{userId:invite.data.userId,action:"activate",expectedRevision:1,requestId:randomUUID()});assert.equal(action.status,200);}
  }
  const [a,b,c]=users;assert.equal((await a.client.call("/api/auth/sign-in/email",{email:a.email,password})).status,200);
  const invitationURL=(await mail(c.email,"invitation")).url,before=await counts(database,c.email,c.id);
  const formBefore=(await database.pool.query("SELECT status,role,revision FROM stex.accounts WHERE user_id=$1",[c.id])).rows[0];
  let previewOpens=0;
  const escape=(s:string)=>s.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
  server=createServer(async(req,res)=>{
    try {
      res.setHeader("cache-control","private, no-store");res.setHeader("referrer-policy","no-referrer");res.setHeader("content-type","text/html; charset=utf-8");
      const path=new URL(req.url!,portal).pathname;
      let body="<h1>Lokale R1-Prüfumgebung</h1><p>Ausschließlich synthetische Konten.</p>";
      if(path==="/mail") {previewOpens++;body=`<h1>Lokale Einladung für R1 C</h1><p>Vorschau ohne Kontoverbrauch.</p><a href="${escape(invitationURL)}">Einladung öffnen</a>`;}
      if(path==="/fix-fake" || path==="/fix-valid") {
        const value=path==="/fix-fake"?"r1_browser_preselected_fake":a.client.cookies.get("better-auth.session_token")!;
        res.setHeader("set-cookie",`better-auth.session_token=${value}; Path=/; HttpOnly; SameSite=Lax`);res.writeHead(302,{location:`${base}/konto/anmelden`});res.end();return;
      }
      if(path==="/identity") {
        const client=new SessionClient(base);for(const raw of String(req.headers.cookie??"").split(";")){const index=raw.indexOf("=");if(index>0)client.cookies.set(raw.slice(0,index).trim(),raw.slice(index+1).trim());}
        const account=await client.call("/api/account");
        body=account.status===200?`<h1>Angemeldet als ${escape(account.data.account.name)}</h1><p>Gültige Sitzung über echte Next-API.</p>`:"<h1>Keine gültige Sitzung</h1>";
      }
      if(path==="/check-invitation" || path==="/finish") {
        const after=await counts(database,c.email,c.id),account=(await database.pool.query("SELECT status,role,revision FROM stex.accounts WHERE user_id=$1",[c.id])).rows[0];
        const unchanged=JSON.stringify(after)===JSON.stringify(before)&&JSON.stringify(account)===JSON.stringify(formBefore);
        assert.ok(unchanged);body="<h1>Einladung unverbraucht</h1><p>Keine Identität, keine Sitzung, unverändertes pending/member-Konto.</p>";
        if(path==="/finish") {
          await writeFile(join(reportRoot,"browser-db-ergebnisse.json"),JSON.stringify({date:new Date().toISOString(),mailPreviewOpens:previewOpens,invitationBefore:before,invitationAfter:after,accountStatus:account.status,accountRole:account.role,accountRevision:account.revision,unconsumed:true,realNextRoutes:true},null,2)+"\n");
          res.on("finish",stop);
        }
      }
      res.end(`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>AUTH-A-R1 · Synthetischer Browsertest</title><style>body{font:18px system-ui;max-width:800px;margin:60px auto;padding:24px}a{color:#4338ca}</style>${body}</html>`);
    }catch{res.statusCode=500;res.end("Prüfbeleg fehlgeschlagen.");}
  });
  await new Promise<void>(resolve=>server!.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw new Error("Portalport fehlt");const portal=`http://localhost:${address.port}`;
  await writeFile(controlFile,JSON.stringify({base,portal,invitationURL,aEmail:a.email,bEmail:b.email,password,source:process.cwd()}),{mode:0o600});
  console.log("Isolierte echte Next-/PostgreSQL-Browserprüfung bereit. Steuerdatei liegt privat unter /private/tmp/stex-auth-r1-browser-control.json; keine Sicherheitslinks im Log.");
  process.once("SIGINT",stop);process.once("SIGTERM",stop);
  await finished;
}finally{
  if(server){server.closeIdleConnections();await new Promise<void>(resolve=>server!.close(()=>resolve()));}
  if(next.exitCode===null && next.signalCode===null){const exited=new Promise<void>(resolve=>next.once("exit",()=>resolve()));next.kill("SIGTERM");await exited;}
  await runtime.close();await unlink(controlFile).catch(()=>{});
}
