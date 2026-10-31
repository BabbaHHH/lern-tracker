import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import { createFixture,SessionClient,password,replacement,topic,totp,freePort,phase,hardKill,gate,workerWaiting,counts,holdState,until } from "../scripts/auth/restfaelle/helpers";

const reportRoot=process.env.STEX_AUTH_R1_REPORT_ROOT??"";
const isolated=process.env.STEX_AUTH_R1_SNAPSHOT==="1" && !!reportRoot;
const evidence:{case:string;variant:string;result:string;details:unknown}[]=[];
function record(id:string,variant:string,details:unknown){evidence.push({case:id,variant,result:"passed",details});}
const fingerprint=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("AUTH-A-R1: nur fünf offene lokale Varianten, echte Sitzungen und PostgreSQL",{timeout:180000,skip:isolated?false:"R1 nur in ausdrücklich isolierter Quellkopie; keine zusätzliche Gesamtprüfung"},async t=>{
  const runtime=await testRuntime();let serial=0;
  t.after(async()=>{await runtime.close();await writeFile(join(reportRoot,"api-ergebnisse.json"),JSON.stringify({date:new Date().toISOString(),evidence},null,2)+"\n");});
  const fixture=async()=>createFixture(runtime,`auth_r1_${++serial}`);

  for(const point of ["before-reservation","library-transaction","after-auth-commit","before-finalization"] as const)await t.test(`I-05: SIGKILL bei ${point}, Neuaufnahme mit derselben Besitzer-ID`,async st=>{
    const f=await fixture();st.after(f.close);
    const email=`crash-${point}@example.test`,invitation=await f.invite(f.admin,email),workerBase=`http://127.0.0.1:${await freePort()}`,tag=`r1_crash_${serial}`;
    const child=await f.worker(workerBase,tag,point==="after-auth-commit"),client=new SessionClient(workerBase);
    let release:(()=>Promise<void>)|undefined;
    if(point==="before-reservation")release=await holdState(f.database);
    else if(point==="library-transaction" || point==="before-finalization")release=(await gate(f.database,point==="library-transaction"?"library":"finalization",serial)).release;
    const reached=point==="after-auth-commit"?phase(child,"after-auth-commit"):null;
    const attempt=f.register(client,email,invitation.token).catch(()=>null);
    try {
      if(reached)await reached;else await workerWaiting(f.database,tag,point==="before-reservation"?"state":point==="library-transaction"?"library":"finalization");
      const expected=point==="before-reservation" || point==="library-transaction"?0:1;
      assert.deepEqual(await counts(f.database,email,invitation.id),{users:expected,credentials:expected,mappings:0,consumed:0});
      await hardKill(child);await attempt;
    }finally{await release?.();}
    await until(async()=>!(await f.database.pool.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1",[tag])).rowCount,"PostgreSQL noticed killed application");
    const afterKill=await counts(f.database,email,invitation.id);
    const identityBefore=(await f.database.pool.query('SELECT id FROM public.stex_auth_user WHERE email=$1',[email])).rows[0]?.id;
    assert.equal((await new SessionClient(f.base).call("/api/auth/sign-in/email",{email,password})).status,401);
    await f.worker(workerBase,`${tag}_restart`);
    assert.equal((await f.register(client,email,invitation.token)).status,200);
    const completed=await counts(f.database,email,invitation.id);assert.deepEqual(completed,{users:1,credentials:1,mappings:1,consumed:1});
    if(identityBefore)assert.equal((await f.database.pool.query('SELECT id FROM public.stex_auth_user WHERE email=$1',[email])).rows[0].id,identityBefore);
    await f.confirm(client,email);await f.login(client,email);assert.equal((await client.call("/api/account")).data.account.userId,invitation.id);assert.equal((await client.call("/api/account/notes")).status,403);
    assert.equal((await client.call("/api/auth/sign-in/email",{email,password:replacement})).status,401);
    record("I-05",point,{signal:"SIGKILL",taggedDatabaseBackendsNaturallyDisconnected:true,afterKill,completed,partialAccess:401,afterRecoveryPendingAccess:403});
  });

  await t.test("I-06: Einladung läuft nach Authcommit vor Finalisierung wirklich ab",async st=>{
    const f=await fixture();st.after(f.close);const email="expires-inflight@example.test",invitation=await f.invite(f.admin,email);
    await f.database.pool.query("UPDATE stex.account_invitations SET expires_at=clock_timestamp()+interval '4 seconds' WHERE user_id=$1",[invitation.id]);
    const base=`http://127.0.0.1:${await freePort()}`,child=await f.worker(base,`r1_expiry_${serial}`,true),client=new SessionClient(base),reached=phase(child,"after-auth-commit");
    const attempt=f.register(client,email,invitation.token);await reached;
    assert.deepEqual(await counts(f.database,email,invitation.id),{users:1,credentials:1,mappings:0,consumed:0});
    await until(async()=>!!(await f.database.pool.query("SELECT 1 FROM stex.account_invitations WHERE user_id=$1 AND expires_at<clock_timestamp()",[invitation.id])).rowCount,"real invitation expiry",7000);
    child.send("continue");assert.equal((await attempt).status,403);
    const expired=await counts(f.database,email,invitation.id);assert.deepEqual(expired,{users:1,credentials:1,mappings:0,consumed:0});
    assert.equal((await client.call("/api/auth/sign-in/email",{email,password})).status,401);
    assert.equal((await f.action(invitation.id,"resend")).status,200);const renewed=new URL((await f.mail(email,"invitation")).url).searchParams.get("token")!;
    assert.ok(renewed!==invitation.token);assert.equal((await f.register(client,email,invitation.token)).status,403);
    assert.equal((await f.register(client,email,renewed,replacement)).status,200);await f.confirm(client,email);await f.login(client,email);
    assert.equal((await client.call("/api/auth/sign-in/email",{email,password:replacement})).status,401);
    assert.deepEqual(await counts(f.database,email,invitation.id),{users:1,credentials:1,mappings:1,consumed:1});
    record("I-06","expiry-after-auth-commit",{expiryStatus:403,partial:expired,renewedSameOwner:true,oldPasswordRetained:true});
  });

  for(const action of ["revoke","resend"])for(const outcome of ["finish","kill"] as const)await t.test(`I-06: ${action} während Bibliotheksanlage, ${outcome}`,async st=>{
    const f=await fixture();st.after(f.close);const email=`${action}-${outcome}@example.test`,invitation=await f.invite(f.admin,email);
    const base=`http://127.0.0.1:${await freePort()}`,tag=`r1_order_${serial}`,child=await f.worker(base,tag,true),client=new SessionClient(base);
    const reached=phase(child,"after-auth-commit"),attempt=f.register(client,email,invitation.token).catch(()=>null);await reached;
    let actionDone=false;const management=f.action(invitation.id,action).then(result=>{actionDone=true;return result;});
    await until(async()=>!!(await f.database.pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%stex.state%' AND pid<>pg_backend_pid()")).rowCount,"real queued admin writer");assert.equal(actionDone,false);
    if(outcome==="finish") {
      child.send("continue");assert.equal((await attempt)!.status,200);assert.equal((await management).status,409);
      assert.deepEqual(await counts(f.database,email,invitation.id),{users:1,credentials:1,mappings:1,consumed:1});
      record("I-06",`${action}-queued-claim-finishes`,{signup:200,management:409,consumed:1,secondIdentity:false});
    }else{
      await hardKill(child);await attempt;assert.equal((await management).status,200);
      assert.deepEqual(await counts(f.database,email,invitation.id),{users:1,credentials:1,mappings:0,consumed:0});
      await f.worker(base,`${tag}_restart`);
      assert.equal((await f.register(client,email,invitation.token)).status,403);
      assert.equal((await client.call("/api/auth/sign-in/email",{email,password})).status,401);
      if(action==="revoke")assert.equal((await f.action(invitation.id,"resend")).status,200);
      const current=new URL((await f.mail(email,"invitation")).url).searchParams.get("token")!;
      assert.equal((await f.register(client,email,current)).status,200);await f.confirm(client,email);await f.login(client,email);
      assert.equal((await client.call("/api/account")).data.account.userId,invitation.id);
      assert.deepEqual(await counts(f.database,email,invitation.id),{users:1,credentials:1,mappings:1,consumed:1});
      record("I-06",`${action}-queued-process-killed`,{signal:"SIGKILL",management:200,oldProof:403,partialLogin:401,resumeSameOwner:true});
    }
  });

  await t.test("A-06: gefälschtes und gültiges vorher gesetztes Cookie fixieren die neue Anmeldung nicht",async st=>{
    const f=await fixture();st.after(f.close);
    const members=[] as {email:string;id:string;client:SessionClient}[];
    for(const email of ["fixation-a@example.test","fixation-b@example.test"]){const invitation=await f.invite(f.admin,email),client=new SessionClient(f.base);assert.equal((await f.register(client,email,invitation.token)).status,200);await f.confirm(client,email);assert.equal((await f.action(invitation.id,"activate")).status,200);await f.login(client,email);members.push({email,id:invitation.id,client});}
    const [a,b]=members,attacker=new SessionClient(f.base),target=new SessionClient(f.base);for(const [k,v]of a.client.cookies){target.cookies.set(k,v);attacker.cookies.set(k,v);}
    const original=target.headers().get("cookie");assert.equal((await target.call("/api/account")).data.account.userId,a.id);
    await f.login(target,b.email);assert.ok(target.headers().get("cookie")!==original,"Neue Sitzung statt vorgegebenem gültigem Cookie");assert.equal((await target.call("/api/account")).data.account.userId,b.id);
    assert.equal((await attacker.call("/api/account")).data.account.userId,a.id);
    const victim=new SessionClient(f.base);victim.cookies.set("better-auth.session_token","r1_invalid_preselected_cookie");assert.equal((await victim.call("/api/account")).status,401);
    await f.login(victim,b.email);assert.ok(!victim.headers().get("cookie")?.includes("r1_invalid_preselected_cookie"));assert.equal((await victim.call("/api/account")).data.account.userId,b.id);
    const old=new SessionClient(f.base);for(const [k,v]of victim.cookies)old.cookies.set(k,v);assert.equal((await victim.call("/api/auth/sign-out",{})).status,200);assert.equal((await old.call("/api/account")).status,401);
    const adminVictim=new SessionClient(f.base);adminVictim.cookies.set("better-auth.session_token","r1_invalid_preselected_cookie");const challenge=await f.login(adminVictim,f.adminEmail);assert.equal(challenge.data.twoFactorRedirect,true);assert.equal((await adminVictim.call("/api/account/admin/accounts")).status,401);
    assert.equal((await adminVictim.call("/api/auth/two-factor/verify-totp",{code:totp(f.adminURI)})).status,200);assert.equal((await adminVictim.call("/api/account")).data.account.userId,f.adminId);
    record("A-06","preselected-fake-and-real-cookies",{fakeCookieDenied:401,newProofOnLogin:true,oldRealProofOwnerUnchanged:true,logoutOldProof:401,adminNeedsActualTotp:true});
  });

  for(const state of ["pending-unconfirmed","pending","blocked","admin"] as const)await t.test(`R-01: Bibliotheksreset ${state} erhält Besitzer, Status und TOTP`,async st=>{
    const f=await fixture();st.after(f.close);const anonymous=new SessionClient(f.base);
    let id=f.adminId,email=f.adminEmail,client=f.admin;
    if(state!=="admin") {
      email=`reset-${state}@example.test`;const invitation=await f.invite(f.admin,email);id=invitation.id;client=new SessionClient(f.base);assert.equal((await f.register(client,email,invitation.token)).status,200);
      if(state!=="pending-unconfirmed"){await f.confirm(client,email);await f.login(client,email);}
      if(state==="blocked"){assert.equal((await f.action(id,"activate")).status,200);await f.login(client,email);assert.equal((await client.call("/api/account/notes",{id:"preserved-note",note:"Persönlicher synthetischer Bestand",topicId:topic,expectedRevision:null})).status,200);assert.equal((await f.action(id,"block")).status,200);}
    }
    const snapshot=async()=>{
      const account=(await f.database.pool.query('SELECT a.user_id,a.status,a.role,a.revision,u.id,u."emailVerified",u."twoFactorEnabled" FROM stex.accounts a JOIN stex.auth_identities i ON i.user_id=a.user_id JOIN public.stex_auth_user u ON u.id=i.auth_user_id WHERE a.user_id=$1',[id])).rows[0];
      const factors=(await f.database.pool.query('SELECT f.* FROM public.stex_auth_two_factor f JOIN stex.auth_identities i ON i.auth_user_id=f."userId" WHERE i.user_id=$1',[id])).rows;
      const notes=(await f.database.pool.query('SELECT id,payload,revision FROM stex.personal_records WHERE owner_user_id=$1 ORDER BY id',[id])).rows;
      return {account,factors:fingerprint(factors),notes:fingerprint(notes)};
    };
    const before=await snapshot();
    const unknown=await anonymous.call("/api/auth/request-password-reset",{email:"no-account@example.test",redirectTo:"/konto/zuruecksetzen"});
    const requested=await anonymous.call("/api/auth/request-password-reset",{email,redirectTo:"/konto/zuruecksetzen"});assert.equal(requested.status,200);assert.deepEqual(requested.data,unknown.data);
    assert.equal((await f.service.localMails("no-account@example.test")).length,0);
    const mail=await f.mail(email,"reset"),redirect=await anonymous.call(mail.url,undefined,true);assert.equal(redirect.status,302);const token=new URL(redirect.headers.get("location")!,f.base).searchParams.get("token")!;
    const reset=await anonymous.call("/api/auth/reset-password",{token,newPassword:replacement});assert.equal(reset.status,200);assert.deepEqual(await snapshot(),before);
    assert.equal((await client.call("/api/account")).status,401);
    let finalStatus:number;
    if(state==="blocked") {
      finalStatus=(await client.call("/api/auth/sign-in/email",{email,password:replacement})).status;assert.equal(finalStatus,401);assert.equal((await f.action(id,"unblock")).status,200);await f.login(client,email,replacement);assert.equal((await client.call("/api/account/notes/preserved-note")).data.note.value.note,"Persönlicher synthetischer Bestand");
    }else if(state==="pending-unconfirmed") {
      finalStatus=(await client.call("/api/auth/sign-in/email",{email,password:replacement})).status;assert.equal(finalStatus,403);await f.confirm(client,email);await f.login(client,email,replacement);assert.equal((await client.call("/api/account/notes")).status,403);
    }else{
      const newLogin=await f.login(client,email,replacement);
      if(state==="admin"){assert.equal(newLogin.data.twoFactorRedirect,true);assert.equal((await client.call("/api/account/admin/accounts")).status,401);assert.equal((await client.call("/api/auth/two-factor/verify-totp",{code:totp(f.adminURI)})).status,200);finalStatus=(await client.call("/api/account/admin/accounts")).status;assert.equal(finalStatus,200);}else{finalStatus=(await client.call("/api/account/notes")).status;assert.equal(finalStatus,403);}
    }
    record("R-01",state,{neutralResponse:true,localMailOnly:true,ownerStatusRoleRevisionRetained:true,factorFingerprintUnchanged:true,personalRecordsUnchanged:true,oldSession:401,postResetStatus:finalStatus});
  });

  await t.test("R-01: abgelaufener Resetlink verändert weder Passwort noch Kontogeneration",async st=>{
    const f=await fixture();st.after(f.close);const email="expired-reset@example.test",invitation=await f.invite(f.admin,email),client=new SessionClient(f.base),anonymous=new SessionClient(f.base);
    assert.equal((await f.register(client,email,invitation.token)).status,200);await f.confirm(client,email);assert.equal((await f.action(invitation.id,"activate")).status,200);await f.login(client,email);
    assert.equal((await anonymous.call("/api/auth/request-password-reset",{email,redirectTo:"/konto/zuruecksetzen"})).status,200);
    const mail=await f.mail(email,"reset"),token=new URL(mail.url).pathname.split("/").at(-1)!;
    await f.database.pool.query('UPDATE public.stex_auth_verification SET "expiresAt"=clock_timestamp()-interval \'1 second\' WHERE identifier=$1',[`reset-password:${token}`]);
    const generation=(await f.database.pool.query("SELECT generation FROM stex.account_access WHERE user_id=$1",[invitation.id])).rows[0].generation;
    const callback=await anonymous.call(mail.url,undefined,true);assert.equal(callback.status,302);assert.ok(new URL(callback.headers.get("location")!,f.base).searchParams.has("error"));
    assert.equal((await anonymous.call("/api/auth/reset-password",{token,newPassword:replacement})).status,400);
    assert.equal((await f.database.pool.query("SELECT generation FROM stex.account_access WHERE user_id=$1",[invitation.id])).rows[0].generation,generation);assert.equal((await client.call("/api/account")).status,200);await f.login(client,email);
    record("R-01","expired-proof",{callback:302,errorRedirect:true,reset:400,generationUnchanged:true,previousPasswordAndSessionPreserved:true});
  });
});
