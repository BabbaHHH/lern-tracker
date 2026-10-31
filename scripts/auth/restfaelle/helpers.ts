import assert from "node:assert/strict";
import { randomBytes,createHmac,randomUUID } from "node:crypto";
import { createServer,request as httpRequest } from "node:http";
import { fork,type ChildProcess } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { PoolConfig,PoolClient } from "pg";
import { AccountService } from "../../../src/lib/server/auth/service";
import { Database } from "../../../src/lib/server/persistence/database";
import { testRuntime } from "../../data-migration/postgres-test-runtime";

export const password="Nur synthetisch: AUTH Restfaelle 2026!";
export const replacement="Anderes synthetisches Passwort 2026!";
export const topic="zr-mat-at-vertragsschluss-145ff";
export function totp(uri:string) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";
  for(const c of new URL(uri).searchParams.get("secret")!)bits+=alphabet.indexOf(c).toString(2).padStart(5,"0");
  const key=Buffer.from((bits.match(/.{8}/g)??[]).map(value=>parseInt(value,2)));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const mac=createHmac("sha1",key).update(counter).digest();
  return ((mac.readUInt32BE(mac.at(-1)!&15)&0x7fffffff)%1000000).toString().padStart(6,"0");
}
export class SessionClient {
  readonly cookies=new Map<string,string>();
  constructor(readonly base:string){}
  headers(){return new Headers({cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; ")});}
  async call(path:string,body?:unknown,navigation=false) {
    const url=new URL(path,this.base),headers=this.headers();
    if(body!==undefined){headers.set("origin",this.base);headers.set("x-stex-action","1");headers.set("content-type","application/json");}
    if(navigation){headers.set("sec-fetch-site","cross-site");headers.set("sec-fetch-mode","navigate");}
    const result=await new Promise<{status:number;headers:Headers;text:string}>((resolve,reject)=>{
      const request=httpRequest(url,{method:body===undefined?"GET":"POST",headers:Object.fromEntries(headers)},incoming=>{
        const chunks:Buffer[]=[];incoming.on("data",part=>chunks.push(Buffer.from(part)));
        incoming.on("end",()=>{const h=new Headers();for(let i=0;i<incoming.rawHeaders.length;i+=2)h.append(incoming.rawHeaders[i],incoming.rawHeaders[i+1]);resolve({status:incoming.statusCode!,headers:h,text:Buffer.concat(chunks).toString("utf8")});});incoming.on("error",reject);
      });request.on("error",()=>reject(new Error("HTTP-Prozess unterbrochen")));request.end(body===undefined?undefined:JSON.stringify(body));
    });
    for(const raw of result.headers.getSetCookie()){const pair=raw.split(";")[0],index=pair.indexOf("="),key=pair.slice(0,index),value=pair.slice(index+1);if(!value || /max-age=0/i.test(raw))this.cookies.delete(key);else this.cookies.set(key,value);}
    return {...result,data:result.text && result.headers.get("content-type")?.includes("application/json")?JSON.parse(result.text):null};
  }
}
export async function freePort(){const server=createServer();await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address || typeof address==="string")throw new Error("Prüfport fehlt");await new Promise<void>(resolve=>server.close(()=>resolve()));return address.port;}
export async function until(check:()=>Promise<boolean>,label:string,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await check())return;await delay(25);}throw new Error(`Prüfgrenze nicht erreicht: ${label}`);}
export function phase(child:ChildProcess,name:string){return new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{child.off("message",receive);reject(new Error(`Prüfphase ${name} nicht erreicht`));},15000);const receive=(message:unknown)=>{if((message as {phase:string}).phase===name){clearTimeout(timer);child.off("message",receive);resolve();}};child.on("message",receive);});}
export async function hardKill(child:ChildProcess){const exited=new Promise<void>(resolve=>child.once("exit",()=>resolve()));child.kill("SIGKILL");await exited;}
export async function createFixture(runtime:Awaited<ReturnType<typeof testRuntime>>,name:string,baseOverride?:string) {
  const repository=await runtime.repository(name),secret=randomBytes(48).toString("base64url"),mailKey=randomBytes(48).toString("base64url");
  const server=createServer(async(req,res)=>{
    try{const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
      const request=new Request(`${base}${req.url}`,{method:req.method,headers:new Headers(req.headers as Record<string,string>),body:chunks.length?Buffer.concat(chunks):undefined});
      const response=req.url?.startsWith("/api/auth/")?await service.authHTTP(request):await service.accountHTTP(request);
      res.statusCode=response.status;for(const [k,v]of response.headers)if(k!=="set-cookie")res.setHeader(k,v);if(response.headers.getSetCookie().length)res.setHeader("set-cookie",response.headers.getSetCookie());res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.statusCode=503;res.end("Prüftransport nicht verfügbar");}
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw new Error("HTTP-Prüfport fehlt");const base=baseOverride??`http://127.0.0.1:${address.port}`;
  const service=new AccountService({database:repository.database,files:repository.files,baseURL:base,secret,mailKey});
  const options=repository.database.pool.options;
  const config:PoolConfig={host:options.host,port:options.port,user:options.user,password:options.password,database:options.database,connectionTimeoutMillis:5000};
  const mail=async(email:string,purpose:"invitation"|"verification"|"reset")=>{const mails=(await service.localMails(email)).filter(m=>m.purpose===purpose);assert.ok(mails.length,"Lokale Bibliotheksmail vorhanden");return mails.at(-1)!;};
  const invite=async(admin:SessionClient,email:string)=>{const result=await admin.call("/api/account/admin/invitations",{email,name:"Synthetisches R1-Konto",requestId:randomUUID()});assert.equal(result.status,201);return {id:result.data.userId,token:new URL((await mail(email,"invitation")).url).searchParams.get("token")!,url:(await mail(email,"invitation")).url};};
  const register=async(client:SessionClient,email:string,token:string,pass=password)=>{return client.call("/api/auth/sign-up/email",{email,password:pass,invitationToken:token});};
  const confirm=async(client:SessionClient,email:string)=>{assert.equal((await client.call((await mail(email,"verification")).url,undefined,true)).status,302);};
  const login=async(client:SessionClient,email:string,pass=password)=>{const result=await client.call("/api/auth/sign-in/email",{email,password:pass});assert.equal(result.status,200);return result;};
  const admin=new SessionClient(base),adminEmail="r1-admin@example.test";
  const prepared=await service.prepareAdmin(adminEmail,"R1 Admin") as {userId:string};
  assert.equal((await register(admin,adminEmail,new URL((await mail(adminEmail,"invitation")).url).searchParams.get("token")!)).status,200);await confirm(admin,adminEmail);await login(admin,adminEmail);
  const enabled=await admin.call("/api/auth/two-factor/enable",{password,method:"totp"});assert.equal(enabled.status,200);const adminURI=enabled.data.totpURI;
  assert.equal((await admin.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI)})).status,200);await service.finishAdmin(prepared.userId);await login(admin,adminEmail);assert.equal((await admin.call("/api/auth/two-factor/verify-totp",{code:totp(adminURI)})).status,200);
  const action=async(id:string,action:string)=>{const revision=(await repository.database.pool.query("SELECT revision FROM stex.accounts WHERE user_id=$1",[id])).rows[0].revision;return admin.call("/api/account/admin/account-action",{userId:id,action,expectedRevision:revision,requestId:randomUUID()});};
  const workers:{child:ChildProcess;tag:string}[]=[];
  const worker=async(workerBase:string,tag:string,pauseAfterAuth=false)=>{
    const file=join(runtime.root,`${tag}.json`);await writeFile(file,JSON.stringify({database:config,base:workerBase,tag,secret,mailKey,pauseAfterAuth}),{mode:0o600});
    const child=fork(join(process.cwd(),"scripts/auth/restfaelle/worker.mts"),[file],{execArgv:["--import","tsx"],stdio:["ignore","ignore","ignore","ipc"]});workers.push({child,tag});await phase(child,"ready");return child;
  };
  return {repository,database:repository.database,config,base,secret,mailKey,service,admin,adminId:prepared.userId,adminEmail,adminURI,mail,invite,register,confirm,login,action,worker,
    close:async()=>{for(const {child}of workers)if(child.exitCode===null && child.signalCode===null)await hardKill(child);await new Promise<void>(resolve=>server.close(()=>resolve()));await repository.database.close();}};
}
export async function gate(database:Database,point:"library"|"finalization",key:number) {
  const holder=await database.pool.connect();await holder.query("SELECT pg_advisory_lock(872616,$1)",[key]);
  const table=point==="library"?"public.stex_auth_account":"stex.auth_identities";
  const clause=point==="library"?"NEW.\"providerId\"='credential'":"true";
  await database.pool.query(`CREATE FUNCTION public.r1_gate_${key}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${clause} THEN PERFORM pg_advisory_xact_lock(872616,${key}); END IF; RETURN NEW; END $$`);
  await database.pool.query(`CREATE TRIGGER r1_gate_${key} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION public.r1_gate_${key}()`);
  return {holder,release:async()=>{await holder.query("SELECT pg_advisory_unlock(872616,$1)",[key]);holder.release();await database.pool.query(`DROP TRIGGER r1_gate_${key} ON ${table}`);await database.pool.query(`DROP FUNCTION public.r1_gate_${key}()`);}};
}
export async function workerWaiting(database:Database,tag:string,point:"library"|"state"|"finalization") {
  await until(async()=>!!(await database.pool.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2",[tag,point==="state"?"%stex.state%":point==="library"?"%stex_auth_account%":"%auth_identities%"])).rowCount,`real database barrier ${point}`);
}
export async function counts(database:Database,email:string,userId:string){const rows=(await database.pool.query(`SELECT
  (SELECT count(*)::int FROM public.stex_auth_user WHERE email=$1) AS users,
  (SELECT count(*)::int FROM public.stex_auth_account c JOIN public.stex_auth_user u ON u.id=c."userId" WHERE u.email=$1 AND c."providerId"='credential') AS credentials,
  (SELECT count(*)::int FROM stex.auth_identities WHERE user_id=$2) AS mappings,
  (SELECT count(*)::int FROM stex.account_invitations WHERE user_id=$2 AND consumed_at IS NOT NULL) AS consumed`,[email,userId])).rows[0];return rows as {users:number;credentials:number;mappings:number;consumed:number};}
export async function holdState(database:Database){const client:PoolClient=await database.pool.connect();await client.query("BEGIN");await client.query("SELECT singleton FROM stex.state FOR UPDATE");return async()=>{await client.query("ROLLBACK");client.release();};}
