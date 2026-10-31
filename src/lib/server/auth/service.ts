import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes, randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import type { PoolClient } from "pg";
import { TOPICS } from "../../topics";
import { recordKey, digest } from "../../data-migration/migration";
import { Database } from "../persistence/database";
import type { PrivateFiles } from "../persistence/files";
import { lockState } from "../persistence/repository";
import { AccountError, accountFailure, accountResponse, atomicLimit, emailAddress, exactFields, sameOrigin, seal, tokenHash, unseal } from "./security";

interface Invitation {id:string;user_id:string;email:string;name:string;token_hash:string;expires_at:Date;consumed_at:Date|null;revoked_at:Date|null}
interface InvitationResult {userId:string;invitationId:string;expiresAt:string}
interface LinkInvitationResult extends InvitationResult {delivery:"link-only";invitationUrl:string}
export interface Principal {
  userId:string;identityId:string;sessionId:string;status:"pending"|"active"|"blocked";role:"member"|"admin";
  revision:number;generation:number;createdAt:Date;factorVerifiedAt:Date|null;email:string;name:string;
}
export interface LocalMail {id:string;email:string;purpose:"invitation"|"verification"|"reset";url:string}
export interface AuthOptions {
  database:Database;baseURL:string;secret:string;mailKey:string;
  /** Shared private storage for local catalog integrations. */
  files?:PrivateFiles;
  /** Internal fault injection for the real integration test, never HTTP input. */
  afterSignup?:()=>Promise<void>;
}
const authPaths = new Set(["/sign-up/email","/sign-in/email","/sign-out","/verify-email","/send-verification-email","/request-password-reset","/reset-password","/change-password","/two-factor/enable","/two-factor/verify-totp","/two-factor/verify-backup-code","/two-factor/generate-backup-codes"]);
export class AccountService {
  readonly auth;
  readonly baseURL:string;
  readonly database:Database;
  readonly files?:PrivateFiles;
  private readonly registration = new AsyncLocalStorage<Invitation>();
  private readonly options:AuthOptions;
  constructor(options:AuthOptions) {
    if (options.secret.length<32 || options.mailKey.length<32 || options.secret===options.mailKey) throw new Error("Getrennte Auth-/Mailgeheimnisse mit mindestens 32 Zeichen erforderlich.");
    this.options=options;this.database=options.database;this.files=options.files;this.baseURL=new URL(options.baseURL).origin;
    this.auth=betterAuth({
      appName:"Stex Tracker",baseURL:this.baseURL,secret:options.secret,database:this.database.authPool,
      logger:{disabled:true},trustedOrigins:[this.baseURL],
      onAPIError:{onError:(error)=>{if(!(error instanceof APIError))throw new APIError("SERVICE_UNAVAILABLE",{message:"Der Kontozugang ist gerade nicht verfügbar."});}},
      user:{modelName:"stex_auth_user",additionalFields:{
        stexAccountId:{type:"string",input:false,returned:false},invitationId:{type:"string",input:false,returned:false},
      }},
      account:{modelName:"stex_auth_account",accountLinking:{enabled:false}},
      verification:{modelName:"stex_auth_verification"},
      session:{modelName:"stex_auth_session",expiresIn:604800,disableSessionRefresh:true,freshAge:600,
        cookieCache:{enabled:false},additionalFields:{stexGeneration:{type:"number",input:false,returned:false},factorVerifiedAt:{type:"date",input:false,returned:false}}},
      emailAndPassword:{enabled:true,requireEmailVerification:true,autoSignIn:false,minPasswordLength:15,maxPasswordLength:128,
        revokeSessionsOnPasswordReset:true,resetPasswordTokenExpiresIn:3600,
        sendResetPassword:async({user,url})=>{await this.mail(user.email,"reset",url);}},
      emailVerification:{sendOnSignUp:true,autoSignInAfterVerification:false,expiresIn:3600,
        sendVerificationEmail:async({user,url,token})=>{
          await this.database.authPool.query("INSERT INTO stex.auth_email_tokens VALUES($1,$2,now()+interval '1 hour') ON CONFLICT(token_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at",[tokenHash(token),user.email]);
          await this.mail(user.email,"verification",url);
        }},
      plugins:[twoFactor({twoFactorTable:"stex_auth_two_factor",issuer:"Stex Tracker",backupCodeOptions:{storeBackupCodes:"encrypted"}})],
      // The HTTP boundary below applies shared, atomic limits to *all* allowed paths,
      // including internal API calls. No process-local limiter is the authority.
      rateLimit:{enabled:false},
      advanced:{useSecureCookies:this.baseURL.startsWith("https:"),defaultCookieAttributes:{httpOnly:true,sameSite:"lax",path:"/"}},
      databaseHooks:{
        user:{create:{before:async(user)=>{
          const invitation=this.registration.getStore();
          if (!invitation || user.email.toLowerCase()!==invitation.email) throw new APIError("FORBIDDEN",{message:"Persönliche Einladung erforderlich."});
          return {data:{...user,stexAccountId:invitation.user_id,invitationId:invitation.id}};
        }}},
        session:{create:{before:async(session)=>{
          const row=(await this.database.authPool.query(`SELECT a.status,x.generation FROM stex.auth_identities i JOIN stex.accounts a ON a.user_id=i.user_id
            JOIN stex.account_access x ON x.user_id=a.user_id WHERE i.auth_user_id=$1`,[session.userId])).rows[0];
          if(!row || row.status==="blocked") throw new APIError("FORBIDDEN",{message:"Kontozugang nicht freigegeben."});
          return {data:{...session,stexGeneration:row.generation,factorVerifiedAt:null}};
        }}},
      },
    });
  }
  private async mail(email:string,purpose:LocalMail["purpose"],url:string,client?:PoolClient):Promise<void> {
    const executor=client??this.database.authPool;
    await executor.query("DELETE FROM stex.auth_mail_outbox WHERE expires_at<=now()");
    await executor.query("INSERT INTO stex.auth_mail_outbox(id,email,purpose,sealed,expires_at) VALUES($1,$2,$3,$4,now()+interval '24 hours')",
      [randomUUID(),email,purpose,seal(url,this.options.mailKey)]);
  }
  /** Local operator/test mail sink only. This method has no public HTTP route. */
  async localMails(email:string):Promise<LocalMail[]> {
    const result=await this.database.pool.query("SELECT * FROM stex.auth_mail_outbox WHERE email=$1 AND expires_at>now() ORDER BY created_at,id",[emailAddress(email)]);
    return result.rows.map(row=>({id:row.id,email:row.email,purpose:row.purpose,url:unseal(row.sealed,this.options.mailKey)}));
  }
  private async limits(request:Request,path:string,body:Record<string,unknown>):Promise<void> {
    // No untrusted X-Forwarded-For input. The local pilot shares a coarse site budget;
    // a hosted trusted-proxy address can be added after the hosting review.
    const mail=typeof body.email==="string"?body.email.trim().toLowerCase():null;
    await this.database.transaction(async client=>{
      await atomicLimit(client,`site:${path}`,path.includes("two-factor")?30:300,300);
      if(mail)await atomicLimit(client,`email:${path}:${mail}`,path.includes("sign-in")?10:path.includes("sign-up")?20:3,path.includes("sign-in")?900:3600);
      const factorCookie=(request.headers.get("cookie")??"").split(";").map(part=>part.trim()).find(part=>/^(?:__Secure-)?better-auth\.(?:two_factor|session_token)=/.test(part));
      if(factorCookie && path.includes("two-factor")) await atomicLimit(client,`factor:${factorCookie}`,5,300);
    });
  }
  async principal(headers:Headers,level:"identity"|"active"|"admin"="active",fresh=false):Promise<Principal> {
    const session=await this.auth.api.getSession({headers,query:{disableCookieCache:true}});
    if(!session)throw new AccountError("unauthenticated","Bitte anmelden.",401);
    return this.database.transaction(client=>this.checkPrincipal(client,session.session.id,level,fresh));
  }
  /** Rechecks session, status and generation inside a writer's transaction. */
  async checkPrincipal(client:PoolClient,sessionId:string,level:"identity"|"active"|"admin"="active",fresh=false,lock=false):Promise<Principal> {
    const result=await client.query(`SELECT a.user_id,a.status,a.role,a.revision,x.generation,s.id AS session_id,s."createdAt",s."factorVerifiedAt",u.id AS identity_id,u.email,u.name,
      u."emailVerified",u."twoFactorEnabled",s."stexGeneration",s."expiresAt",f.verified AS factor_ready
      FROM public.stex_auth_session s JOIN public.stex_auth_user u ON u.id=s."userId"
      JOIN stex.auth_identities i ON i.auth_user_id=u.id JOIN stex.accounts a ON a.user_id=i.user_id
      JOIN stex.account_access x ON x.user_id=a.user_id LEFT JOIN public.stex_auth_two_factor f ON f."userId"=u.id
      WHERE s.id=$1 ${lock?"FOR UPDATE OF a,x":""}`,[sessionId]);
    const row=result.rows[0];
    if(!row || !row.emailVerified || row.expiresAt<=new Date() || row.stexGeneration!==row.generation || row.status==="blocked") throw new AccountError("unauthenticated","Bitte neu anmelden.",401);
    const admin=row.role==="admin";
    if(admin && (Date.now()-row.createdAt.getTime()>8*3600000 || !row.twoFactorEnabled || row.factor_ready!==true || !row.factorVerifiedAt))throw new AccountError("factor_required","Bitte mit Authenticator-Code neu anmelden.",401);
    if(level!=="identity" && row.status!=="active")throw new AccountError("pending","Dein Konto wartet auf Niklas’ Freischaltung.",403);
    if(level==="admin" && !admin)throw new AccountError("forbidden","Nur die Kontoverwaltung darf diese Aktion ausführen.",403);
    if(fresh && (Date.now()-row.createdAt.getTime()>600000 || (admin && Date.now()-row.factorVerifiedAt.getTime()>600000)))throw new AccountError("reauthenticate","Bitte erneut anmelden und die Aktion wiederholen.",401);
    return {userId:row.user_id,identityId:row.identity_id,sessionId:row.session_id,status:row.status,role:row.role,revision:row.revision,generation:row.generation,
      createdAt:row.createdAt,factorVerifiedAt:row.factorVerifiedAt,email:row.email,name:row.name};
  }
  private async revokeLibrarySessions(client:PoolClient,identityId:string|null):Promise<boolean> {
    await client.query("SAVEPOINT auth_session_cleanup");
    try {
      await client.query(`DELETE FROM public.stex_auth_session s WHERE s."userId"=$1 AND EXISTS(SELECT 1 FROM stex.auth_identities i JOIN stex.accounts a ON a.user_id=i.user_id JOIN stex.account_access x ON x.user_id=a.user_id WHERE i.auth_user_id=s."userId" AND (a.status='blocked' OR s."stexGeneration" IS DISTINCT FROM x.generation))`,[identityId]);
      await client.query("RELEASE SAVEPOINT auth_session_cleanup");return true;
    }catch{
      // Status/generation revocation must commit even if redundant library cleanup
      // fails. A later block action can retry cleanup with a new request ID.
      await client.query("ROLLBACK TO SAVEPOINT auth_session_cleanup");await client.query("RELEASE SAVEPOINT auth_session_cleanup");return false;
    }
  }
  private async audit(client:PoolClient,actor:string,target:string,action:string,requestId:string,input:unknown,result:unknown):Promise<void> {
    await client.query("INSERT INTO stex.account_audit(id,actor,target,action,request_id,fingerprint,result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)",
      [randomUUID(),actor,target,action,requestId,digest(input),JSON.stringify(result)]);
  }
  private async replay(client:PoolClient,actor:string,requestId:string,input:unknown):Promise<unknown|null> {
    if(!requestId || requestId.length>100)throw new AccountError("invalid_input","Vorgangskennung fehlt.");
    const row=(await client.query("SELECT fingerprint,result FROM stex.account_audit WHERE actor=$1 AND request_id=$2",[actor,requestId])).rows[0];
    if(!row)return null;
    if(row.fingerprint!==digest(input))throw new AccountError("conflict","Die Vorgangskennung wurde bereits für andere Daten verwendet.",409);
    return row.result;
  }
  private invitationReplay(result:unknown,actor:string,requestId:string,input:Record<string,unknown>):unknown {
    if(!result || typeof result!=="object")return result;
    const row=result as Record<string,unknown>;
    if(row.delivery!=="link-only" && !("sealedInvitationLink" in row))return result;
    try {
      if(row.delivery!=="link-only" || typeof row.sealedInvitationLink!=="string")throw new Error();
      const value=JSON.parse(unseal(row.sealedInvitationLink,this.options.mailKey));
      // The authenticated envelope prevents moving ciphertext to another audit request.
      if(value.purpose!=="admin-invitation-link-v1" || value.actor!==actor || value.requestId!==requestId || value.fingerprint!==digest(input) || value.baseURL!==this.baseURL ||
        typeof row.userId!=="string" || typeof row.invitationId!=="string" || typeof row.expiresAt!=="string" ||
        value.userId!==row.userId || value.invitationId!==row.invitationId || value.expiresAt!==row.expiresAt || typeof value.invitationUrl!=="string")throw new Error();
      const url=new URL(value.invitationUrl);
      if(url.origin!==this.baseURL || url.pathname!=="/konto/einrichten" || url.username || url.password || url.hash ||
        url.searchParams.get("email")!==emailAddress(input.email) || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("token")??"") ||
        url.searchParams.size!==2)throw new Error();
      return {userId:row.userId,invitationId:row.invitationId,expiresAt:row.expiresAt,delivery:"link-only",invitationUrl:value.invitationUrl};
    }catch{throw new AccountError("unavailable","Der Einladungslink ist gerade nicht verfügbar.",503);}
  }
  private async newInvitation(client:PoolClient,email:string,name:string,actor:string|null,existingUserId?:string,delivery:"mail"|"link-only"="mail"):Promise<InvitationResult|LinkInvitationResult> {
    if(!name.trim() || name.length>100)throw new AccountError("invalid_input","Bitte einen Anzeigenamen eingeben.");
    const userId=existingUserId??randomUUID();
    if(!existingUserId)await client.query("INSERT INTO stex.accounts(user_id,status,role,revision) VALUES($1,'pending','member',1)",[userId]);
    const id=randomUUID(),token=randomBytes(32).toString("base64url");
    const result=await client.query("INSERT INTO stex.account_invitations(id,user_id,email,name,token_hash,expires_at,created_by) VALUES($1,$2,$3,$4,$5,now()+interval '7 days',$6) RETURNING expires_at",[id,userId,email,name.trim(),tokenHash(token),actor]);
    const summary={userId,invitationId:id,expiresAt:result.rows[0].expires_at.toISOString()};
    const invitationUrl=`${this.baseURL}/konto/einrichten?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    if(delivery==="link-only")return {...summary,delivery,invitationUrl};
    await this.mail(email,"invitation",invitationUrl,client);
    return summary;
  }
  /** Explicit local operator capability; no HTTP bootstrap or first-user shortcut. */
  async prepareAdmin(email:string,name:string):Promise<unknown> {
    return await this.database.transaction(async client=>{
      await lockState(client);
      if((await client.query("SELECT 1 FROM stex.auth_bootstrap")).rowCount || (await client.query("SELECT 1 FROM stex.accounts WHERE role='admin'")).rowCount)throw new AccountError("conflict","Admin-Einrichtung ist bereits vorbereitet oder abgeschlossen.",409);
      const result=await this.newInvitation(client,emailAddress(email),name,null);
      await client.query("INSERT INTO stex.auth_bootstrap(singleton,user_id,expires_at) VALUES(true,$1,now()+interval '7 days')",[result.userId]);
      await this.audit(client,"operator",result.userId,"prepare-admin",randomUUID(),{email:emailAddress(email)},result);
      return result;
    });
  }
  async finishAdmin(userId:string):Promise<void> {
    await this.database.transaction(async client=>{
      await lockState(client);
      const result=await client.query(`SELECT b.completed_at,b.expires_at,a.status,u."emailVerified",u."twoFactorEnabled",f.verified
        FROM stex.auth_bootstrap b JOIN stex.accounts a ON a.user_id=b.user_id JOIN stex.auth_identities i ON i.user_id=a.user_id
        JOIN public.stex_auth_user u ON u.id=i.auth_user_id JOIN public.stex_auth_two_factor f ON f."userId"=u.id
        WHERE b.user_id=$1 FOR UPDATE OF b,a`,[userId]);
      const row=result.rows[0];
      if(!row || row.completed_at || row.expires_at<=new Date() || row.status!=="pending" || !row.emailVerified || !row.twoFactorEnabled || row.verified!==true)throw new AccountError("conflict","Adresse und Authenticator müssen vollständig eingerichtet sein.",409);
      await client.query("UPDATE stex.accounts SET role='admin',status='active',revision=revision+1 WHERE user_id=$1",[userId]);
      await client.query("UPDATE stex.account_access SET generation=generation+1,updated_at=now() WHERE user_id=$1",[userId]);
      await client.query("UPDATE stex.auth_bootstrap SET completed_at=now() WHERE user_id=$1",[userId]);
      await client.query('DELETE FROM public.stex_auth_session WHERE "userId"=(SELECT auth_user_id FROM stex.auth_identities WHERE user_id=$1)',[userId]);
      await this.audit(client,"operator",userId,"finish-admin",randomUUID(),{userId},{completed:true});
    });
  }
  private async beginAdminRecovery(client:PoolClient,userId:string,keepSessionId?:string):Promise<void> {
    const row=(await client.query("SELECT i.auth_user_id FROM stex.accounts a JOIN stex.auth_identities i ON i.user_id=a.user_id WHERE a.user_id=$1 AND a.role='admin' FOR UPDATE OF a",[userId])).rows[0];
    if(!row)throw new AccountError("not_found","Bestehendes Adminkonto nicht gefunden.",404);
    await client.query("UPDATE stex.accounts SET role='member',status='pending',revision=revision+1 WHERE user_id=$1",[userId]);
    await client.query("UPDATE stex.account_access SET generation=generation+1,updated_at=now() WHERE user_id=$1",[userId]);
    await client.query('UPDATE public.stex_auth_user SET "twoFactorEnabled"=false WHERE id=$1',[row.auth_user_id]);
    await client.query('DELETE FROM public.stex_auth_two_factor WHERE "userId"=$1',[row.auth_user_id]);
    await client.query('DELETE FROM public.stex_auth_session WHERE "userId"=$1 AND ($2::text IS NULL OR id!=$2)',[row.auth_user_id,keepSessionId??null]);
    if(keepSessionId)await client.query('UPDATE public.stex_auth_session SET "stexGeneration"=(SELECT generation FROM stex.account_access WHERE user_id=$2),"factorVerifiedAt"=NULL WHERE id=$1',[keepSessionId,userId]);
    await client.query("DELETE FROM public.stex_auth_verification WHERE value=$1",[row.auth_user_id]);
    await client.query("UPDATE stex.auth_bootstrap SET completed_at=NULL,expires_at=now()+interval '1 day' WHERE user_id=$1",[userId]);
  }
  /** Offline recovery capability, deliberately unavailable over HTTP. */
  async recoverAdmin(userId:string):Promise<void> {
    await this.database.transaction(async client=>{
      await lockState(client);await this.beginAdminRecovery(client,userId);
      await this.audit(client,"operator",userId,"recover-admin",randomUUID(),{userId},{pending:true});
    });
  }
  private async signup(request:Request,body:Record<string,unknown>):Promise<Response> {
    exactFields(body,["name","email","password","invitationToken","callbackURL"]);
    const email=emailAddress(body.email);
    if(typeof body.invitationToken!=="string" || body.invitationToken.length>100)throw new AccountError("invalid_invitation","Gültige persönliche Einladung erforderlich.",403);
    return await this.database.transaction(async client=>{
      // Global writer lock followed by account/invitation locks: same order as block,
      // personal writes and backup. The library commits separately; immutable
      // invitationId on its user makes recovery of that partial commit safe.
      await lockState(client);
      const invitation=(await client.query<Invitation>("SELECT * FROM stex.account_invitations WHERE token_hash=$1 FOR UPDATE",[tokenHash(String(body.invitationToken))])).rows[0];
      if(!invitation || invitation.email!==email || invitation.consumed_at || invitation.revoked_at || invitation.expires_at<=new Date())throw new AccountError("invalid_invitation","Die Einladung ist ungültig, abgelaufen oder bereits verwendet.",403);
      const account=(await client.query("SELECT status FROM stex.accounts WHERE user_id=$1 FOR UPDATE",[invitation.user_id])).rows[0];
      if(account.status!=="pending")throw new AccountError("invalid_invitation","Dieses Konto kann nicht neu eingerichtet werden.",403);
      let user=(await client.query('SELECT * FROM public.stex_auth_user WHERE email=$1',[email])).rows[0];
      let response:Response;
      if(user) {
        if(user.invitationId!==invitation.id || user.stexAccountId!==invitation.user_id)throw new AccountError("conflict","Diese Adresse ist bereits einem Konto zugeordnet.",409);
        // Never replace the password on retry; recover the same committed identity.
        response=accountResponse({status:true});
      } else {
        const headers=new Headers(request.headers);headers.set("content-type","application/json");
        const forwarded=new Request(request.url,{method:"POST",headers,body:JSON.stringify({email,password:body.password,name:invitation.name,callbackURL:`${this.baseURL}/konto`})});
        response=await this.registration.run(invitation,()=>this.auth.handler(forwarded));
        if(!response.ok)return response;
        user=(await client.query('SELECT * FROM public.stex_auth_user WHERE email=$1',[email])).rows[0];
        if(!user || user.invitationId!==invitation.id || user.stexAccountId!==invitation.user_id)throw new Error("Einrichtung konnte nicht zugeordnet werden.");
        await this.options.afterSignup?.();
      }
      if(invitation.expires_at<=new Date())throw new AccountError("invalid_invitation","Die Einladung ist während der Einrichtung abgelaufen.",403);
      await client.query("INSERT INTO stex.auth_identities(user_id,auth_user_id) VALUES($1,$2)",[invitation.user_id,user.id]);
      await client.query("UPDATE stex.account_invitations SET consumed_at=now() WHERE id=$1",[invitation.id]);
      await this.audit(client,"registration",invitation.user_id,"invitation-consumed",invitation.id,{invitationId:invitation.id},{registered:true});
      return response;
    });
  }
  private mergedCookies(request:Request,response:Response):Headers {
    const cookies=new Map<string,string>();
    for(const part of (request.headers.get("cookie")??"").split(";")) {const index=part.indexOf("=");if(index>0)cookies.set(part.slice(0,index).trim(),part.slice(index+1).trim());}
    for(const part of response.headers.getSetCookie()) {const pair=part.split(";")[0],index=pair.indexOf("=");if(index>0)cookies.set(pair.slice(0,index),pair.slice(index+1));}
    const headers=new Headers();headers.set("cookie",[...cookies].map(([key,value])=>`${key}=${value}`).join("; "));return headers;
  }
  async authHTTP(request:Request):Promise<Response> {
    try {
      const path=new URL(request.url).pathname.slice("/api/auth".length);
      const resetCallback=request.method==="GET" && /^\/reset-password\/[a-zA-Z0-9_-]{1,128}$/.test(path);
      // A real mail link is a cross-site top-level navigation. It authenticates
      // only its one-time proof; other routes and all POSTs retain Origin checks.
      sameOrigin(request,this.baseURL,path==="/verify-email" || resetCallback);
      if(!authPaths.has(path) && !resetCallback)throw new AccountError("not_found","Dieser Anmeldeweg ist nicht verfügbar.",404);
      const body=request.method==="POST"?await this.json(request):{};
      for(const parameter of ["callbackURL","redirectTo"]) {const target=new URL(request.url).searchParams.get(parameter);if(target && new URL(target,this.baseURL).origin!==this.baseURL)throw new AccountError("invalid_origin","Unzulässiges Rücksprungziel.",403);}
      if(body.trustDevice || body.method==="otp" || body.disableSession)throw new AccountError("forbidden","Dieser Anmeldeweg ist nicht freigegeben.",403);
      if(typeof body.callbackURL==="string" && new URL(body.callbackURL,this.baseURL).origin!==this.baseURL)throw new AccountError("invalid_origin","Unzulässiges Rücksprungziel.",403);
      if(typeof body.redirectTo==="string" && new URL(body.redirectTo,this.baseURL).origin!==this.baseURL)throw new AccountError("invalid_origin","Unzulässiges Rücksprungziel.",403);
      await this.limits(request,resetCallback?"/reset-password-callback":path,body);
      if(path==="/sign-up/email")return await this.harden(await this.signup(request,body));
      if(path==="/sign-in/email") {
        const email=emailAddress(body.email);
        const row=(await this.database.pool.query(`SELECT a.status FROM public.stex_auth_user u LEFT JOIN stex.auth_identities i ON i.auth_user_id=u.id
          LEFT JOIN stex.accounts a ON a.user_id=i.user_id WHERE u.email=$1`,[email])).rows[0];
        if(row && (!row.status || row.status==="blocked"))throw new AccountError("unauthenticated","Anmeldung nicht möglich. Bitte die Zugangsdaten prüfen.",401);
        body.email=email;
      }
      if(["/two-factor/enable","/two-factor/generate-backup-codes","/change-password"].includes(path)) {
        const who=await this.principal(request.headers,"identity",true);
        if(path==="/two-factor/enable") {
          const bootstrap=(await this.database.pool.query("SELECT 1 FROM stex.auth_bootstrap WHERE user_id=$1 AND completed_at IS NULL AND expires_at>now()",[who.userId])).rowCount;
          if(!bootstrap)throw new AccountError("forbidden","Authenticator-Einrichtung benötigt den betrieblichen Einrichtungsauftrag.",403);
        }
        if(path==="/change-password")body.revokeOtherSessions=true;
      }
      if(path==="/verify-email") {
        const hash=tokenHash(new URL(request.url).searchParams.get("token")??"");
        return await this.database.transaction(async client=>{
          const row=(await client.query("SELECT token_hash FROM stex.auth_email_tokens WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",[hash])).rows[0];
          if(!row)throw new AccountError("invalid_token","Der Bestätigungslink ist ungültig oder abgelaufen.",403);
          const response=await this.auth.handler(request);
          // A successful verify redirects; error redirects must not consume the token.
          const location=response.headers.get("location")??"";
          if(response.ok || (response.status===302 && !new URL(location,this.baseURL).searchParams.has("error")))await client.query("DELETE FROM stex.auth_email_tokens WHERE token_hash=$1",[hash]);
          return await this.harden(response);
        });
      }
      if(path==="/reset-password" && request.method==="POST") {
        if(typeof body.newPassword!=="string" || body.newPassword.length<15 || body.newPassword.length>128)throw new AccountError("invalid_input","Das Passwort muss 15 bis 128 Zeichen enthalten.");
        // The library atomically consumes its token, but password update and session
        // deletion are separate commits. Revoke the application generation first:
        // even a later library/storage failure cannot leave old sessions authorized.
        const resetToken=typeof body.token==="string"?body.token:new URL(request.url).searchParams.get("token");
        await this.database.transaction(async client=>{
          await lockState(client);
          const identity=(await client.query('SELECT i.user_id FROM public.stex_auth_verification v JOIN stex.auth_identities i ON i.auth_user_id=v.value WHERE v.identifier=$1 AND v."expiresAt">now()',[`reset-password:${resetToken??""}`])).rows[0];
          if(identity) {
            await client.query("UPDATE stex.account_access SET generation=generation+1,updated_at=now() WHERE user_id=$1",[identity.user_id]);
            await this.audit(client,"password-reset",identity.user_id,"reset-session-revocation",randomUUID(),{userId:identity.user_id},{revoked:true});
          }
        });
      }
      const forwarded=request.method==="POST"?new Request(request.url,{method:"POST",headers:request.headers,body:JSON.stringify(body)}):request;
      const response=await this.auth.handler(forwarded);
      if(response.ok && ["/two-factor/verify-totp","/two-factor/verify-backup-code"].includes(path)) {
        const session=await this.auth.api.getSession({headers:this.mergedCookies(request,response)});
        if(session)await this.database.transaction(async client=>{
          if(path==="/two-factor/verify-backup-code")await lockState(client);
          await this.checkPrincipal(client,session.session.id,"identity").catch(error=>{
            // A newly completed admin challenge has no factor timestamp yet.
            if(error instanceof AccountError && error.code==="factor_required")return null;
            throw error;
          });
          const valid=await client.query(`UPDATE public.stex_auth_session s SET "factorVerifiedAt"=now() FROM stex.auth_identities i,stex.accounts a,stex.account_access x,public.stex_auth_two_factor f
            WHERE s.id=$1 AND s."userId"=i.auth_user_id AND a.user_id=i.user_id AND x.user_id=a.user_id AND a.status!='blocked'
            AND s."stexGeneration"=x.generation AND f."userId"=i.auth_user_id AND f.verified=true`,[session.session.id]);
          if(!valid.rowCount)throw new AccountError("unauthenticated","Bitte neu anmelden.",401);
          if(path==="/two-factor/verify-backup-code") {
            const current=(await client.query('SELECT i.user_id FROM public.stex_auth_session s JOIN stex.auth_identities i ON i.auth_user_id=s."userId" WHERE s.id=$1',[session.session.id])).rows[0];
            await this.beginAdminRecovery(client,current.user_id,session.session.id);
            await this.audit(client,current.user_id,current.user_id,"recovery-code-used",randomUUID(),{session:session.session.id},{used:true,pending:true,otherSessionsRevoked:true,newFactorRequired:true});
          }

        });
      }
      return await this.harden(response);
    }catch(error){return accountFailure(error);}
  }
  private async harden(response:Response):Promise<Response> {
    const headers=new Headers(response.headers);
    headers.set("cache-control","private, no-store");headers.set("referrer-policy","no-referrer");headers.set("x-content-type-options","nosniff");
    if(headers.get("content-type")?.includes("application/json")) {
      const raw=await response.text();
      if(raw) {
        const value=JSON.parse(raw);
        // Browser access uses the HttpOnly cookie. The library's optional bearer
        // token/session result must not create a second JavaScript-readable copy.
        if(value && typeof value==="object"){delete value.token;delete value.session;}
        headers.delete("content-length");return new Response(JSON.stringify(value),{status:response.status,headers});
      }
      return new Response(null,{status:response.status,headers});
    }
    return new Response(response.body,{status:response.status,headers});
  }
  private async json(request:Request):Promise<Record<string,unknown>> {
    if(request.headers.get("content-type")?.split(";")[0]!=="application/json")throw new AccountError("invalid_input","Bitte JSON senden.",415);
    const reader=request.body?.getReader();if(!reader)throw new AccountError("invalid_input","Eingabe fehlt.");
    let size=0;const chunks:Uint8Array[]=[];
    try {while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>32000){await reader.cancel();throw new AccountError("too_large","Eingabe ist zu groß.",413);}chunks.push(part.value);}}finally{reader.releaseLock();}
    let value;try{value=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new AccountError("invalid_input","Ungültige Eingabe.");}
    if(!value || typeof value!=="object" || Array.isArray(value))throw new AccountError("invalid_input","Ungültige Eingabe.");return value;
  }
  async accountHTTP(request:Request):Promise<Response> {
    try {
      sameOrigin(request,this.baseURL);
      const path=new URL(request.url).pathname.slice("/api/account".length);
      await this.limits(request,`account:${path}`,{});
      if(path==="" && request.method==="GET") {
        const who=await this.principal(request.headers,"identity");
        const bootstrap=!!(await this.database.pool.query("SELECT 1 FROM stex.auth_bootstrap WHERE user_id=$1 AND completed_at IS NULL AND expires_at>now()",[who.userId])).rowCount;
        return accountResponse({contractVersion:1,account:{userId:who.userId,email:who.email,name:who.name,status:who.status,role:who.role,revision:who.revision,bootstrap}});
      }
      if(path==="/notes" && request.method==="GET") {
        const who=await this.principal(request.headers);
        return await this.database.transaction(async client=>{
          await this.checkPrincipal(client,who.sessionId,"active",false,true);
          const rows=await client.query("SELECT id,payload AS value,revision FROM stex.personal_records WHERE owner_user_id=$1 AND kind='learning-entry' ORDER BY id",[who.userId]);
          return accountResponse({contractVersion:1,notes:rows.rows});
        });
      }
      if(path.startsWith("/notes/") && request.method==="GET") {
        const who=await this.principal(request.headers);const id=decodeURIComponent(path.slice(7));
        return await this.database.transaction(async client=>{
          await this.checkPrincipal(client,who.sessionId,"active",false,true);
          const result=await client.query("SELECT id,payload AS value,revision FROM stex.personal_records WHERE owner_user_id=$1 AND kind='learning-entry' AND id=$2",[who.userId,id]);
          if(!result.rowCount)throw new AccountError("not_found","Datensatz nicht gefunden.",404);
          return accountResponse({contractVersion:1,note:result.rows[0]});
        });
      }
      if(path==="/notes" && request.method==="POST") {
        // Account learning uses the same records, with the C2 receipt/session preconditions.
        if(process.env.STEX_LEARNING_MODE==='account') {
          const {PersonalService}=await import('../learning/personal-service');
          const {personalHTTP}=await import('../learning/http');
          if(!request.headers.get('x-stex-learning-contract'))throw new AccountError('invalid_input','Bitte Lernnotizen in der Lernübersicht bearbeiten. Dort werden Konto und Speichervorgang geprüft.',409);
          return await personalHTTP(request,new PersonalService(this));
        }
        const who=await this.principal(request.headers);const body=await this.json(request);exactFields(body,["id","note","topicId","expectedRevision"]);
        if(typeof body.id!=="string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.id) || typeof body.note!=="string" || !body.note.trim() || body.note.length>10000 || !TOPICS.some(t=>t.id===body.topicId)
          || (body.expectedRevision!==null && (!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision)<1)))throw new AccountError("invalid_input","Bitte Thema, Notiz und gültigen Datensatzstand angeben.");
        const note=body.note.trim();
        return await this.database.transaction(async client=>{
          await lockState(client);await this.checkPrincipal(client,who.sessionId,"active",false,true);
          const key=recordKey("learning-entry",who.userId,String(body.id));
          const previous=(await client.query("SELECT revision,payload FROM stex.personal_records WHERE record_key=$1",[key])).rows[0];
          if((previous?.revision??null)!==body.expectedRevision)throw new AccountError("conflict","Die Notiz wurde inzwischen geändert. Bitte neu laden.",409);
          const value={id:body.id,topicId:body.topicId,note,source:"manual",createdAt:previous?.payload.createdAt??new Date().toISOString()};
          await client.query("INSERT INTO stex.topics(id) VALUES($1) ON CONFLICT DO NOTHING",[body.topicId]);
          await client.query(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,'learning-entry',$3,1,'lerntracker-entries',$4::jsonb,'{}')
            ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,revision=personal_records.revision+1`,[key,who.userId,body.id,JSON.stringify(value)]);
          await client.query("DELETE FROM stex.record_references WHERE source_key=$1",[key]);
          await client.query("INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_topic_id) VALUES($1,'value.topicId',$2,$1,$3)",[key,who.userId,body.topicId]);
          await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
          return accountResponse({contractVersion:1,note:{id:body.id,value,revision:(previous?.revision??0)+1}});
        });
      }
      if(path==="/admin/accounts" && request.method==="GET") {
        await this.principal(request.headers,"admin");
        const rows=await this.database.pool.query(`SELECT a.user_id AS "userId",a.status,a.role,a.revision,coalesce(u.email,v.email) AS email,coalesce(u.name,v.name) AS name,
          coalesce(u."emailVerified",false) AS "emailVerified",v.id AS "invitationId",v.expires_at AS "invitationExpiresAt",v.consumed_at AS "invitationConsumedAt",v.revoked_at AS "invitationRevokedAt",
          (SELECT (result->>'librarySessionsRevoked')::boolean FROM stex.account_audit WHERE target=a.user_id AND action IN('block','unblock','activate','cleanup') ORDER BY created_at DESC LIMIT 1) AS "librarySessionsRevoked"
          FROM stex.accounts a LEFT JOIN stex.auth_identities i ON i.user_id=a.user_id LEFT JOIN public.stex_auth_user u ON u.id=i.auth_user_id
          LEFT JOIN LATERAL(SELECT * FROM stex.account_invitations WHERE user_id=a.user_id ORDER BY created_at DESC LIMIT 1)v ON true ORDER BY a.user_id`);
        return accountResponse({contractVersion:1,accounts:rows.rows});
      }
      if(path==="/admin/invitations" && request.method==="POST") {
        const who=await this.principal(request.headers,"admin",true);const body=await this.json(request);exactFields(body,["email","name","requestId","delivery"]);
        if(body.delivery!==undefined && body.delivery!=="mail" && body.delivery!=="link-only")throw new AccountError("invalid_input","Ungültige Einladungszustellung.");
        const email=emailAddress(body.email);
        return await this.database.transaction(async client=>{
          await lockState(client);await this.checkPrincipal(client,who.sessionId,"admin",true,true);
          const requestId=String(body.requestId??"");
          const replay=await this.replay(client,who.userId,requestId,body);if(replay)return accountResponse(this.invitationReplay(replay,who.userId,requestId,body));
          if((await client.query('SELECT 1 FROM public.stex_auth_user WHERE email=$1 UNION ALL SELECT 1 FROM stex.account_invitations WHERE email=$1',[email])).rowCount)throw new AccountError("conflict","Für diese Adresse besteht bereits ein Konto oder eine Einladung.",409);
          const result=await this.newInvitation(client,email,String(body.name??""),who.userId,undefined,body.delivery==="link-only"?"link-only":"mail");
          let auditResult:unknown=result;
          if("invitationUrl" in result) {
            const {invitationUrl,...summary}=result;
            auditResult={...summary,sealedInvitationLink:seal(JSON.stringify({purpose:"admin-invitation-link-v1",actor:who.userId,requestId,fingerprint:digest(body),baseURL:this.baseURL,...summary,invitationUrl}),this.options.mailKey)};
          }
          await this.audit(client,who.userId,result.userId,"invite",requestId,body,auditResult);return accountResponse(result,201);
        });
      }
      if(path==="/admin/account-action" && request.method==="POST") {
        const who=await this.principal(request.headers,"admin",true);const body=await this.json(request);exactFields(body,["userId","action","expectedRevision","requestId"]);
        if(typeof body.userId!=="string" || !["activate","block","unblock","revoke","resend","cleanup"].includes(String(body.action)) || !Number.isInteger(body.expectedRevision))throw new AccountError("invalid_input","Ungültige Verwaltungsaktion.");
        return await this.database.transaction(async client=>{
          await lockState(client);await this.checkPrincipal(client,who.sessionId,"admin",true,true);
          const replay=await this.replay(client,who.userId,String(body.requestId??""),body);if(replay)return accountResponse(replay);
          const row=(await client.query(`SELECT a.*,u."emailVerified",i.auth_user_id FROM stex.accounts a LEFT JOIN stex.auth_identities i ON i.user_id=a.user_id
            LEFT JOIN public.stex_auth_user u ON u.id=i.auth_user_id WHERE a.user_id=$1 FOR UPDATE OF a`,[body.userId])).rows[0];
          if(!row)throw new AccountError("not_found","Konto nicht gefunden.",404);
          if(row.revision!==body.expectedRevision)throw new AccountError("conflict","Der Kontostand wurde inzwischen geändert.",409);
          if(row.role==="admin")throw new AccountError("forbidden","Adminänderungen benötigen den betrieblichen Zugriff; der letzte Admin bleibt geschützt.",403);
          const invitation=(await client.query<Invitation>("SELECT * FROM stex.account_invitations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[body.userId])).rows[0];
          let result:unknown;
          if(body.action==="cleanup") {
            const librarySessionsRevoked=await this.revokeLibrarySessions(client,row.auth_user_id);
            await client.query("UPDATE stex.accounts SET revision=revision+1 WHERE user_id=$1",[body.userId]);
            result={userId:body.userId,status:row.status,revision:row.revision+1,librarySessionsRevoked};
          } else if(body.action==="resend" || body.action==="revoke") {
            if(!invitation || invitation.consumed_at || row.status!=="pending")throw new AccountError("conflict","Nur eine offene Einrichtung kann erneut eingeladen oder widerrufen werden.",409);
            await client.query("UPDATE stex.account_invitations SET revoked_at=now() WHERE id=$1",[invitation.id]);
            if(body.action==="resend") {
              // Keep the immutable claim ID even if the library already committed
              // before a previous application failure. Rotate only the bearer token.
              const token=randomBytes(32).toString("base64url");
              const renewed=await client.query("UPDATE stex.account_invitations SET token_hash=$2,expires_at=now()+interval '7 days',revoked_at=NULL WHERE id=$1 RETURNING expires_at",[invitation.id,tokenHash(token)]);
              await this.mail(invitation.email,"invitation",`${this.baseURL}/konto/einrichten?token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation.email)}`,client);
              result={userId:body.userId,invitationId:invitation.id,expiresAt:renewed.rows[0].expires_at.toISOString()};
            } else result={revoked:true};
          } else {
            const complete=!!row.emailVerified && !!invitation?.consumed_at && !invitation.revoked_at;
            if(body.action==="activate" && (row.status!=="pending" || !complete))throw new AccountError("conflict","Das Konto muss Einladung und Adressbestätigung vollständig abgeschlossen haben.",409);
            if(body.action==="unblock" && row.status!=="blocked")throw new AccountError("conflict","Das Konto ist nicht gesperrt.",409);
            const status=body.action==="block"?"blocked":complete?"active":"pending";
            await client.query("UPDATE stex.accounts SET status=$2,revision=revision+1 WHERE user_id=$1",[body.userId,status]);
            await client.query("UPDATE stex.account_access SET generation=generation+1,updated_at=now() WHERE user_id=$1",[body.userId]);
            const librarySessionsRevoked=await this.revokeLibrarySessions(client,row.auth_user_id);
            result={userId:body.userId,status,revision:row.revision+1,librarySessionsRevoked};
          }
          await this.audit(client,who.userId,String(body.userId),String(body.action),String(body.requestId),body,result);return accountResponse(result);
        });
      }
      throw new AccountError("not_found","Kontofunktion nicht gefunden.",404);
    }catch(error){return accountFailure(error);}
  }
}
