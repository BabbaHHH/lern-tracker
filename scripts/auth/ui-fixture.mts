import { readFile,writeFile,unlink } from "node:fs/promises";
import { randomUUID,createHmac } from "node:crypto";
import { join } from "node:path";
import { configuredPersistence,localRoot } from "../data-migration/local-config";
import { AccountService } from "../../src/lib/server/auth/service";
const command=process.argv[2];
if(!["prepare","cleanup"].includes(command))throw new Error("ui-fixture.mts prepare | cleanup");
const {database}=await configuredPersistence();
const statePath=join(localRoot,"auth-ui-fixture.json");
const base="http://localhost:3001",password="Synthetisches Passwort 2026!";
const cookies=new Map<string,string>();
const service=new AccountService({database,baseURL:base,secret:(await readFile(join(localRoot,"auth-secret"),"utf8")).trim(),mailKey:(await readFile(join(localRoot,"auth-mail-key"),"utf8")).trim()});
async function call(path:string,body?:unknown) {
  const headers:Record<string,string>={cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")};
  if(body!==undefined)Object.assign(headers,{origin:base,"x-stex-action":"1","content-type":"application/json"});
  const response=await fetch(new URL(path,base),{method:body===undefined?"GET":"POST",headers,body:body===undefined?undefined:JSON.stringify(body),redirect:"manual"});
  for(const v of response.headers.getSetCookie()){const pair=v.split(";")[0],i=pair.indexOf("=");cookies.set(pair.slice(0,i),pair.slice(i+1));}
  const raw=await response.text();const value=raw&&response.headers.get("content-type")?.includes("application/json")?JSON.parse(raw):{};
  if(response.status>=400)throw new Error(`Lokale Oberflächenfixture: ${path.split("?")[0]} lieferte ${response.status}.`);
  return value;
}
async function register(email:string) {
  const link=(await service.localMails(email)).find(m=>m.purpose==="invitation")!.url;
  await call("/api/auth/sign-up/email",{email,password,invitationToken:new URL(link).searchParams.get("token")});
  await call((await service.localMails(email)).find(m=>m.purpose==="verification")!.url);
  await call("/api/auth/sign-in/email",{email,password});
}
try {
  if(command==="prepare") {
    if((await database.pool.query("SELECT 1 FROM stex.auth_bootstrap")).rowCount)throw new Error("Vorhandene Admin-Einrichtung bleibt erhalten; Fixture nicht angelegt.");
    if((await database.pool.query("SELECT 1 FROM public.stex_auth_user")).rowCount)throw new Error("Vorhandene Authkonten bleiben erhalten; Fixture nicht angelegt.");
    const state:{ids:string[];emails:string[];adminURI?:string}={ids:[],emails:[]};
    const save=()=>writeFile(statePath,JSON.stringify(state),{mode:0o600});
    const email="auth-ui-admin@example.test";
    const admin=await service.prepareAdmin(email,"AUTH Testadmin") as {userId:string};state.ids.push(admin.userId);state.emails.push(email);await save();
    await register(email);
    const enabled=await call("/api/auth/two-factor/enable",{password,method:"totp"});state.adminURI=enabled.totpURI;await save();
    const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";for(const c of new URL(enabled.totpURI).searchParams.get("secret")!)bits+=alphabet.indexOf(c).toString(2).padStart(5,"0");
    const key=Buffer.from((bits.match(/.{8}/g)??[]).map(v=>parseInt(v,2)));
    const factor=()=>{const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac("sha1",key).update(counter).digest(),offset=h.at(-1)!&15;return ((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,"0");};
    await call("/api/auth/two-factor/verify-totp",{code:factor()});await service.finishAdmin(admin.userId);
    await call("/api/auth/sign-in/email",{email,password});await call("/api/auth/two-factor/verify-totp",{code:factor()});
    for(const suffix of ["a","b"]) {
      const memberEmail=`auth-ui-${suffix}@example.test`;
      const invitation=await call("/api/account/admin/invitations",{email:memberEmail,name:`AUTH Test ${suffix.toUpperCase()}`,requestId:randomUUID()});state.ids.push(invitation.userId);state.emails.push(memberEmail);await save();
      const adminCookies=new Map(cookies);cookies.clear();await register(memberEmail);cookies.clear();for(const [k,v]of adminCookies)cookies.set(k,v);
      await call("/api/account/admin/account-action",{userId:invitation.userId,action:"activate",expectedRevision:1,requestId:randomUUID()});
    }
    console.log("Drei synthetische Konten über die echten Next-Routen auf vorhandener PostgreSQL-Datenbank eingerichtet. Private Fixture enthält nur die Testdaten und wird beim Aufräumen gelöscht.");
  } else {
    const state=JSON.parse(await readFile(statePath,"utf8")) as {ids:string[];emails:string[]};
    if(state.emails.some(v=>!/^auth-ui-(admin|a|b)@example\.test$/.test(v)))throw new Error("Unbekannte Fixture; kein Löschen.");
    await database.transaction(async client=>{
      await client.query("SELECT singleton FROM stex.state FOR UPDATE");
      if((await client.query("SELECT 1 FROM public.stex_auth_user WHERE id NOT IN (SELECT auth_user_id FROM stex.auth_identities WHERE user_id=ANY($1))",[state.ids])).rowCount)throw new Error("Weitere Authkonten vorhanden; Fixture wird nicht global bereinigt.");
      const identities=(await client.query("SELECT auth_user_id FROM stex.auth_identities WHERE user_id=ANY($1)",[state.ids])).rows.map(r=>r.auth_user_id);
      await client.query("DELETE FROM stex.record_references WHERE owner_user_id=ANY($1)",[state.ids]);
      await client.query("DELETE FROM stex.personal_records WHERE owner_user_id=ANY($1)",[state.ids]);
      await client.query("DELETE FROM stex.auth_bootstrap WHERE user_id=ANY($1)",[state.ids]);
      await client.query("DELETE FROM stex.account_invitations WHERE user_id=ANY($1)",[state.ids]);
      await client.query("DELETE FROM stex.auth_identities WHERE user_id=ANY($1)",[state.ids]);
      await client.query("DELETE FROM public.stex_auth_user WHERE id=ANY($1)",[identities]);
      await client.query("DELETE FROM stex.account_access WHERE user_id=ANY($1)",[state.ids]);
      await client.query("DELETE FROM stex.accounts WHERE user_id=ANY($1)",[state.ids]);
      await client.query("DELETE FROM stex.auth_mail_outbox WHERE email=ANY($1)",[state.emails]);
      await client.query("DELETE FROM stex.auth_email_tokens WHERE email=ANY($1)",[state.emails]);
      await client.query("DELETE FROM stex.account_audit WHERE target=ANY($1) OR actor=ANY($1)",[state.ids]);
      await client.query("DELETE FROM public.stex_auth_verification WHERE value=ANY($1)",[identities]);
    });
    await unlink(statePath);console.log("Ausschließlich die drei synthetischen Konten samt Testnotizen und Sicherheitsnachweisen entfernt; bisherige Fachkonten und Daten erhalten.");
  }
}finally{await database.close();}
