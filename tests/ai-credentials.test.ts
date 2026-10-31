import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { test } from "node:test";
import type { NextRequest } from "next/server";
import { GET as credentialsGet, POST as credentialsPost } from "../src/app/api/account/ai-credential/route";
import { GET as adminCredentialsGet, POST as adminCredentialsPost } from "../src/app/api/account/admin/ai-credential/route";
import { POST as aiPost } from "../src/app/api/ai/route";
import { POST as tagPost } from "../src/app/api/docs/tag/route";
import { GET as creditsGet } from "../src/app/api/openrouter-credits/route";
import { accountRuntime } from "../src/lib/server/auth/runtime";
import { AccountService } from "../src/lib/server/auth/service";
import { decryptCredential, type CredentialSecrets } from "../src/lib/server/ai-credentials/crypto";
import { mapProviderFailure } from "../src/lib/server/ai-credentials/openrouter";
import { Database } from "../src/lib/server/persistence/database";
import { backup, restore } from "../src/lib/server/persistence/backup";
import { PrivateFiles } from "../src/lib/server/persistence/files";

const password = "Synthetic account password 2026!";
const pilotKey = "sk-or-v1-PILOT-SYNTHETIC-0001";
const ownKeyA = "sk-or-v1-OWN-SYNTHETIC-A-0002";
const ownKeyAReplacement = "sk-or-v1-OWN-SYNTHETIC-A-REPLACEMENT-0002";
const ownKeyB = "sk-or-v1-OWN-SYNTHETIC-B-0003";
const globalFallback = "sk-or-v1-GLOBAL-FALLBACK-SHOULD-NOT-APPEAR";
const topicId = "zr-mat-at-vertragsschluss-145ff";
interface ActorContext { accountId: string; accessGeneration: number; sessionContext: string }
interface TargetContext { accountId: string; accessGeneration: number }
interface TestData {
  [key: string]: unknown;
  error?: { code?: string; message?: string };
  twoFactorRedirect?: boolean;
  totpURI?: string;
  userId?: string;
  reply?: string;
  summary?: string;
  topicIds?: string[];
  providerStatus?: { source?: string };
  selection?: { source?: string; revision?: number };
  credentials?: Record<string,{ maskedKey?: string | null }>;
  credential?: { maskedKey?: string | null };
}
interface CredentialStatus {
  context: ActorContext;
  selection: { source: string; revision: number };
  credentials: { pilot: { configured: boolean; revision: number; maskedKey: string | null }; own: { configured: boolean; revision: number; maskedKey: string | null } };
  providerStatus: { source?: string } | null;
}

async function freePort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Testport nicht verfügbar.");
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

function totp(uri: string): string {
  const secret = new URL(uri).searchParams.get("secret")!;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.toUpperCase().replace(/=+$/,"")) bits += alphabet.indexOf(char).toString(2).padStart(5,"0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(value => parseInt(value,2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const mac = createHmac("sha1",key).update(counter).digest(), offset = mac[mac.length-1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6,"0");
}

class Browser {
  private cookies = new Map<string,string>();
  constructor(readonly base: string) {}
  private headers(): Headers { return new Headers({ cookie: [...this.cookies].map(([name,value]) => `${name}=${value}`).join("; ") }); }
  async call(path: string, body?: unknown) {
    const headers = this.headers();
    if (body !== undefined) {
      headers.set("content-type","application/json"); headers.set("origin",this.base); headers.set("x-stex-action","1");
    }
    const response = await fetch(new URL(path,this.base), { method: body === undefined ? "GET" : "POST", headers,
      body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";")[0], index = pair.indexOf("=");
      if (index < 1) continue;
      const name = pair.slice(0,index), value = pair.slice(index+1);
      if (!value || /max-age=0/i.test(header)) this.cookies.delete(name); else this.cookies.set(name,value);
    }
    const text = await response.text();
    return { status: response.status, data: text && response.headers.get("content-type")?.includes("json") ? JSON.parse(text) as TestData : {} };
  }
}

test("AI-KEYS-A: persönliche Schlüssel, beide KI-Routen, Fehler, Sperre und Backup/Restore", { timeout: 240_000 }, async t => {
  const privateRoot = await mkdtemp(join(tmpdir(),"stex-ai-keys-"));
  const pgPort = await freePort();
  const dbPassword = randomBytes(24).toString("hex");
  const authSecret = randomBytes(48).toString("base64url");
  const mailKey = randomBytes(48).toString("base64url");
  const backupKey = randomBytes(48).toString("base64url");
  const credentialSecrets: CredentialSecrets = { encryptionKey: randomBytes(32), fingerprintKey: randomBytes(32) };
  const envKeys = ["NODE_ENV","STEX_AUTH_MODE","STEX_LEARNING_MODE","BETTER_AUTH_URL","BETTER_AUTH_SECRET","STEX_LOCAL_DATA_DIR","STEX_LOCAL_POSTGRES_PORT","STEX_PRIVATE_FILE_ROOT","STEX_AI_CREDENTIAL_ENCRYPTION_KEY","STEX_AI_CREDENTIAL_FINGERPRINT_KEY","OPENROUTER_API_KEY","OPENROUTER_API_KEY_STRONG","OPENROUTER_API_KEY_CHEAP","OPENROUTER_API_KEY_TEST"];
  const previousEnv = Object.fromEntries(envKeys.map(name => [name,process.env[name]]));
  const originalFetch = globalThis.fetch;
  const providerRequests: Array<{ endpoint: string; key: string; status?: number }> = [];
  let dropResponseForRequestId: string | null = null;
  const providerKeys = new Map<string,{ limit: number | null; limit_remaining: number | null; limit_reset: string | null; is_free_tier: boolean }>([
    [pilotKey,{ limit:5,limit_remaining:5,limit_reset:null,is_free_tier:false }],
    [ownKeyA,{ limit:100,limit_remaining:77.25,limit_reset:"monthly",is_free_tier:false }],
    [ownKeyAReplacement,{ limit:100,limit_remaining:70,limit_reset:"monthly",is_free_tier:false }],
    [ownKeyB,{ limit:20,limit_remaining:18.5,limit_reset:"monthly",is_free_tier:false }],
  ]);
  let nextCompletionStatus: { status: number; body: string } | null = null;
  let delayed: { started: () => void; wait: Promise<void>; release: () => void } | null = null;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://openrouter.ai/api/v1/key") {
      const key = new Headers(init?.headers).get("authorization")?.replace(/^Bearer /,"") ?? "";
      providerRequests.push({ endpoint:"key-status",key });
      if (key === "sk-or-v1-INVALID-SYNTHETIC-0004") return new Response("{}",{status:401});
      const status = providerKeys.get(key);
      return status
        ? Response.json({ data: { is_management_key:false,is_provisioning_key:false,...status } })
        : new Response("{}",{status:401});
    }
    if (url === "https://openrouter.ai/api/v1/chat/completions") {
      const key = new Headers(init?.headers).get("authorization")?.replace(/^Bearer /,"") ?? "";
      providerRequests.push({ endpoint:"completion",key });
      if (delayed) {
        const pending = delayed; delayed = null; pending.started(); await pending.wait;
      }
      if (nextCompletionStatus) {
        const failed = nextCompletionStatus; nextCompletionStatus = null;
        return new Response(failed.body,{status:failed.status});
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: { content?: string }[] };
      const tagging = body.messages?.[0]?.content?.includes("Taxonomie") ?? false;
      const content = tagging ? JSON.stringify({summary:"Synthetischer Treffer.",topicIds:[topicId]}) : "Synthetische KI-Antwort.";
      return Response.json({choices:[{finish_reason:"stop",message:{content}}]});
    }
    return originalFetch(input,init);
  };

  const cluster = new EmbeddedPostgres({ databaseDir:join(privateRoot,"postgres"),port:pgPort,user:"stex_local",password:dbPassword,
    persistent:true,authMethod:"scram-sha-256",createPostgresUser:false,initdbFlags:["--encoding=UTF8","--locale=C"],
    postgresFlags:["-h","127.0.0.1","-k",privateRoot,"-c","fsync=on"],onLog:()=>{},onError:()=>{} });
  let clusterRunning = false;
  let database: Database | null = null;
  let auth: AccountService | null = null;
  let server: ReturnType<typeof createHttpServer> | null = null;
  let base = "";
  let port = 0;
  try {
    await cluster.initialise(); await cluster.start(); clusterRunning = true;
    await cluster.createDatabase("stex_local");
    database = new Database({host:"127.0.0.1",port:pgPort,user:"stex_local",password:dbPassword,database:"stex_local",connectionTimeoutMillis:5000});
    await database.migrate();
    const fileRoot = join(privateRoot,"files");
    await mkdir(fileRoot,{recursive:true,mode:0o700});
    await writeFile(join(privateRoot,"auth-secret"),authSecret,{mode:0o600});
    await writeFile(join(privateRoot,"auth-mail-key"),mailKey,{mode:0o600});
    await writeFile(join(privateRoot,"postgres-password"),dbPassword,{mode:0o600});
    for (const [name,value] of Object.entries({
      NODE_ENV:"test",STEX_AUTH_MODE:"local",STEX_LEARNING_MODE:"account",BETTER_AUTH_SECRET:authSecret,
      STEX_LOCAL_DATA_DIR:privateRoot,STEX_LOCAL_POSTGRES_PORT:String(pgPort),STEX_PRIVATE_FILE_ROOT:fileRoot,
      STEX_AI_CREDENTIAL_ENCRYPTION_KEY:credentialSecrets.encryptionKey.toString("hex"),
      STEX_AI_CREDENTIAL_FINGERPRINT_KEY:credentialSecrets.fingerprintKey.toString("hex"),
      OPENROUTER_API_KEY:globalFallback,OPENROUTER_API_KEY_STRONG:globalFallback,OPENROUTER_API_KEY_CHEAP:globalFallback,OPENROUTER_API_KEY_TEST:globalFallback,
    })) process.env[name] = value;

    server = createHttpServer(async (incoming,outgoing) => {
      try {
        const address = `http://${incoming.headers.host}${incoming.url ?? "/"}`;
        const chunks: Buffer[] = [];
        for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
        const headers = new Headers();
        for (const [name,value] of Object.entries(incoming.headers)) if (typeof value === "string") headers.set(name,value);
        const requestBody = chunks.length ? Buffer.concat(chunks) : undefined;
        const request = new Request(address,{method:incoming.method,headers,body:requestBody});
        const path = new URL(address).pathname;
        let response: Response;
        if (path.startsWith("/api/auth/")) response = await auth!.authHTTP(request);
        else if (path === "/api/account/ai-credential") response = request.method === "POST" ? await credentialsPost(request) : await credentialsGet(request);
        else if (path === "/api/account/admin/ai-credential") response = request.method === "POST" ? await adminCredentialsPost(request) : await adminCredentialsGet(request);
        else if (path === "/api/ai") response = await aiPost(request);
        else if (path === "/api/docs/tag") response = await tagPost(request as unknown as NextRequest);
        else if (path === "/api/openrouter-credits") response = await creditsGet(request);
        else response = await auth!.accountHTTP(request);
        if (dropResponseForRequestId && response.status < 400 && requestBody) {
          try {
            const submitted = JSON.parse(requestBody.toString("utf8")) as { requestId?: string };
            if (submitted.requestId === dropResponseForRequestId) {
              dropResponseForRequestId = null;
              outgoing.destroy();
              return;
            }
          } catch { /* Only valid request bodies can match a simulated lost response. */ }
        }
        outgoing.statusCode = response.status;
        for (const [name,value] of response.headers) if (name !== "set-cookie") outgoing.setHeader(name,value);
        const cookies = response.headers.getSetCookie();
        if (cookies.length) outgoing.setHeader("set-cookie",cookies);
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        outgoing.statusCode = 500; outgoing.end("Synthetic test server failed.");
      }
    });
    await new Promise<void>(resolve => server!.listen(0,"127.0.0.1",resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Testserver nicht verfügbar.");
    port = address.port; base = `http://127.0.0.1:${port}`;
    process.env.BETTER_AUTH_URL = base;
    auth = new AccountService({database,baseURL:base,secret:authSecret,mailKey});
  } catch (error) {
    globalThis.fetch = originalFetch;
    for (const name of envKeys) { if (previousEnv[name] === undefined) delete process.env[name]; else process.env[name] = previousEnv[name]!; }
    if (database) await database.close();
    if (clusterRunning) await cluster.stop();
    await rm(privateRoot,{recursive:true,force:true});
    throw error;
  }

  t.after(async () => {
    globalThis.fetch = originalFetch;
    try { await (await accountRuntime()).database.close(); } catch { /* Routes may not have initialized the account runtime. */ }
    if (database) await database.close();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    if (clusterRunning) await cluster.stop();
    await rm(privateRoot,{recursive:true,force:true});
    for (const name of envKeys) { if (previousEnv[name] === undefined) delete process.env[name]; else process.env[name] = previousEnv[name]!; }
  });

  const browserFor = () => new Browser(base);
  const confirmEmail = async (browser: Browser,email: string) => {
    const mail = (await auth!.localMails(email)).filter(item => item.email === email && item.purpose === "verification").at(-1)!;
    const request = new Request(mail.url,{headers:{host:new URL(base).host,"sec-fetch-site":"cross-site","sec-fetch-mode":"navigate"}});
    const response = await auth!.authHTTP(request);
    assert.equal(response.status,302,"synthetische E-Mail-Bestätigung");
    void browser;
  };
  const signUp = async (browser: Browser,email: string,token: string) => {
    const result = await browser.call("/api/auth/sign-up/email",{email,password,invitationToken:token});
    assert.equal(result.status,200,"synthetische Kontoanlage");
  };
  const signIn = async (browser: Browser,email: string) => {
    const result = await browser.call("/api/auth/sign-in/email",{email,password});
    assert.equal(result.status,200,"synthetische Anmeldung");
    return result.data;
  };
  const ownerContext = async (browser: Browser) => (await browser.call("/api/account/ai-credential?contextOnly=1")).data.context as ActorContext;
  const ownerStatus = async (browser: Browser) => (await browser.call("/api/account/ai-credential")).data as unknown as CredentialStatus;
  const adminTargetStatus = async (userId: string) => (await admin.call(`/api/account/admin/ai-credential?userId=${userId}`)).data as unknown as {
    actorContext: ActorContext; targetContext: TargetContext; credential: { configured: boolean; revision: number; maskedKey: string | null };
  };
  const adminWrite = async (body: Record<string, unknown>, actor?: ActorContext, target?: TargetContext) => {
    actor ??= await ownerContext(admin);
    const targetContext = target ?? (typeof body.targetUserId === "string" ? (await adminTargetStatus(body.targetUserId)).targetContext : undefined);
    return admin.call("/api/account/admin/ai-credential", { ...body, expectedActorContext: actor, expectedTargetContext: targetContext });
  };
  const ownerWrite = async (browser: Browser, body: Record<string, unknown>, actor?: ActorContext) => {
    actor ??= await ownerContext(browser);
    return browser.call("/api/account/ai-credential", { ...body, expectedActorContext: actor });
  };
  const adminEmail = "ai-admin@example.test", memberAEmail = "ai-a@example.test", memberBEmail = "ai-b@example.test";
  const adminInvite = await auth!.prepareAdmin(adminEmail,"AI Test Admin") as { userId: string };
  let admin = browserFor();
  const adminInviteMail = (await auth!.localMails(adminEmail)).filter(item => item.purpose === "invitation").at(-1)!;
  await signUp(admin,adminEmail,new URL(adminInviteMail.url).searchParams.get("token")!);
  await confirmEmail(admin,adminEmail);
  await signIn(admin,adminEmail);
  const factors = await admin.call("/api/auth/two-factor/enable",{password,method:"totp"});
  assert.equal(factors.status,200);
  const adminTotpUri = factors.data.totpURI as string;
  assert.equal((await admin.call("/api/auth/two-factor/verify-totp",{code:totp(adminTotpUri),trustDevice:false})).status,200);
  await auth!.finishAdmin(adminInvite.userId);
  admin = browserFor();
  assert.equal((await signIn(admin,adminEmail)).twoFactorRedirect,true);
  assert.equal((await admin.call("/api/auth/two-factor/verify-totp",{code:totp(adminTotpUri),trustDevice:false})).status,200);

  const inviteMember = async (email: string,name: string) => {
    const invitation = await admin.call("/api/account/admin/invitations",{email,name,requestId:`invite-${name}`});
    assert.equal(invitation.status,201);
    const memberId = invitation.data.userId as string;
    const inviteMail = (await auth!.localMails(email)).filter(item => item.purpose === "invitation").at(-1)!;
    const browser = browserFor();
    await signUp(browser,email,new URL(inviteMail.url).searchParams.get("token")!);
    await confirmEmail(browser,email);
    const activated = await admin.call("/api/account/admin/account-action",{userId:memberId,action:"activate",expectedRevision:1,requestId:`activate-${name}`});
    assert.equal(activated.status,200);
    assert.equal((await signIn(browser,email)).twoFactorRedirect,undefined);
    return { memberId,browser };
  };
  const memberA = await inviteMember(memberAEmail,"AI A");
  const memberB = await inviteMember(memberBEmail,"AI B");

  const adminContext = await ownerContext(admin);
  const pilotFormA = await adminTargetStatus(memberA.memberId);
  const adminSetPilot = await adminWrite({
    action:"set-pilot",targetUserId:memberA.memberId,apiKey:pilotKey,expectedRevision:null,requestId:"pilot-a-1",
  }, adminContext, pilotFormA.targetContext);
  assert.equal(adminSetPilot.status,201);
  assert.equal(JSON.stringify(adminSetPilot.data).includes(pilotKey),false);
  const keyStatusCallsAfterPilot = providerRequests.filter(item => item.endpoint === "key-status").length;
  const staleRevision = await adminWrite({
    action:"set-pilot",targetUserId:memberA.memberId,apiKey:ownKeyAReplacement,expectedRevision:null,requestId:"pilot-a-stale-revision",
  }, adminContext, pilotFormA.targetContext);
  assert.equal(staleRevision.status,409,"veraltete Adminrevision wird vor der Anbieterprüfung abgelehnt");
  assert.equal(staleRevision.data.error?.code,"conflict");
  assert.equal(providerRequests.filter(item => item.endpoint === "key-status").length,keyStatusCallsAfterPilot);

  const staleTargetFormB = await adminTargetStatus(memberB.memberId);
  await database!.pool.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1",[memberB.memberId]);
  const staleTarget = await adminWrite({
    action:"set-pilot",targetUserId:memberB.memberId,apiKey:ownKeyAReplacement,expectedRevision:null,requestId:"pilot-b-stale-target",
  }, adminContext, staleTargetFormB.targetContext);
  assert.equal(staleTarget.status,409,"veraltete Mitgliedergeneration wird vor der Anbieterprüfung abgelehnt");
  assert.equal(staleTarget.data.error?.code,"account_changed");
  assert.equal(providerRequests.filter(item => item.endpoint === "key-status").length,keyStatusCallsAfterPilot);
  const refreshedMemberB = browserFor();
  await signIn(refreshedMemberB,memberBEmail);
  memberB.browser = refreshedMemberB;

  assert.equal((await ownerWrite(memberA.browser,{action:"select",source:"pilot",expectedRevision:0,requestId:"select-pilot-a-1"})).status,200);

  const displayedContextA = await ownerContext(memberA.browser);
  const keyStatusBeforeCrossAccount = providerRequests.filter(item => item.endpoint === "key-status").length;
  const oldAFormUnderB = await memberB.browser.call("/api/account/ai-credential",{
    action:"set-own",apiKey:ownKeyA,expectedRevision:null,requestId:"own-a-from-b-session",expectedActorContext:displayedContextA,
  });
  assert.equal(oldAFormUnderB.status,409,"ein offenes A-Formular kann den Schlüssel nicht B zuordnen");
  assert.equal(oldAFormUnderB.data.error?.code,"account_changed");
  assert.equal(providerRequests.filter(item => item.endpoint === "key-status").length,keyStatusBeforeCrossAccount);
  assert.equal((await database!.pool.query("SELECT count(*) FROM stex.ai_credentials WHERE owner_user_id=$1 AND source='own' AND configured",[memberB.memberId])).rows[0].count,"0");

  const staleReloginBody = {
    action:"set-own",apiKey:ownKeyA,expectedRevision:null,requestId:"own-a-old-session",expectedActorContext:displayedContextA,
  };
  await memberA.browser.call("/api/auth/sign-out",{});
  const reauthenticatedA = browserFor();
  await signIn(reauthenticatedA,memberAEmail);
  const reauthenticatedContextA = await ownerContext(reauthenticatedA);
  assert.notEqual(reauthenticatedContextA.sessionContext,displayedContextA.sessionContext);
  const keyStatusBeforeReloginReplay = providerRequests.filter(item => item.endpoint === "key-status").length;
  const oldSessionWrite = await reauthenticatedA.call("/api/account/ai-credential",staleReloginBody);
  assert.equal(oldSessionWrite.status,409,"alte A-Sitzung wird nach erneuter Anmeldung abgewiesen");
  assert.equal(providerRequests.filter(item => item.endpoint === "key-status").length,keyStatusBeforeReloginReplay);
  memberA.browser = reauthenticatedA;

  const noGlobalStart = providerRequests.filter(item => item.endpoint === "completion").length;
  const unselected = await memberB.browser.call("/api/ai",{messages:[{role:"user",content:"synthetic"}]});
  assert.equal(unselected.status,409);
  assert.equal(providerRequests.filter(item => item.endpoint === "completion").length,noGlobalStart,"unselected account never reaches any provider key");
  assert.equal(JSON.stringify(unselected.data).includes(globalFallback),false);

  const firstAi = await memberA.browser.call("/api/ai",{messages:[{role:"user",content:"synthetic"}]});
  assert.equal(firstAi.status,200);
  assert.equal(firstAi.data.reply,"Synthetische KI-Antwort.");
  assert.equal(providerRequests.filter(item => item.endpoint === "completion").at(-1)?.key,pilotKey);

  let startProvider!: () => void;
  let releaseProvider!: () => void;
  const providerStarted = new Promise<void>(resolve => { startProvider = resolve; });
  const providerWait = new Promise<void>(resolve => { releaseProvider = resolve; });
  delayed = { started:startProvider,wait:providerWait,release:releaseProvider };
  const lateReply = memberA.browser.call("/api/ai",{messages:[{role:"user",content:"slow synthetic"}]});
  await providerStarted;
  const removedDuringRequest = await adminWrite({
    action:"remove-pilot",targetUserId:memberA.memberId,expectedRevision:1,requestId:"remove-pilot-a-1",
  });
  assert.equal(removedDuringRequest.status,200);
  releaseProvider();
  const staleReply = await lateReply;
  assert.equal(staleReply.status,409,"späte Antwort nach Entfernung wird verworfen");
  assert.equal(staleReply.data.reply,undefined);

  const reassignedPilot = await adminWrite({
    action:"set-pilot",targetUserId:memberA.memberId,apiKey:pilotKey,expectedRevision:2,requestId:"pilot-a-2",
  });
  assert.equal(reassignedPilot.status,201);
  let statusA = await ownerStatus(memberA.browser);
  assert.equal(statusA.selection.source,"off");
  assert.equal((await ownerWrite(memberA.browser,{action:"select",source:"pilot",expectedRevision:statusA.selection.revision,requestId:"select-pilot-a-2"},statusA.context)).status,200);

  const ownAContext = await ownerContext(memberA.browser);
  const ownAOperation = { action:"set-own",apiKey:ownKeyA,expectedRevision:null,requestId:"own-a-lost-response",expectedActorContext:ownAContext };
  dropResponseForRequestId = "own-a-lost-response";
  await assert.rejects(memberA.browser.call("/api/account/ai-credential",ownAOperation),/fetch|socket|network|terminated|ECONNRESET/i);
  const keyStatusCallsAfterLostCommit = providerRequests.filter(item => item.endpoint === "key-status").length;
  const replayedOwnA = await memberA.browser.call("/api/account/ai-credential",ownAOperation);
  assert.equal(replayedOwnA.status,201);
  assert.equal(replayedOwnA.data.replay,true,"derselbe vollständige Auftrag erhält denselben Beleg");
  assert.equal(providerRequests.filter(item => item.endpoint === "key-status").length,keyStatusCallsAfterLostCommit,"Replay prüft den Commit ohne erneuten Anbieteraufruf");
  const changedKeyReplay = await memberA.browser.call("/api/account/ai-credential",{...ownAOperation,apiKey:ownKeyAReplacement});
  assert.equal(changedKeyReplay.status,409,"gleiche Vorgangskennung mit verändertem Schlüssel kollidiert");
  assert.equal(providerRequests.filter(item => item.endpoint === "key-status").length,keyStatusCallsAfterLostCommit,"widersprüchlicher Replay endet vor Providerzugriff");
  const ownA = replayedOwnA;
  assert.equal(ownA.status,201);
  statusA = await ownerStatus(memberA.browser);
  assert.equal(statusA.selection.source,"pilot","Hinterlegen wählt den eigenen Schlüssel nicht automatisch aus");
  assert.equal(statusA.credentials.own.maskedKey,"••••0002");
  assert.equal(statusA.providerStatus?.source,"pilot");
  const personalCreditView = await memberA.browser.call("/api/openrouter-credits");
  assert.equal(personalCreditView.status,200);
  assert.equal((personalCreditView.data as unknown as CredentialStatus).providerStatus?.source,"pilot");
  assert.equal(personalCreditView.data.strong,undefined);
  assert.equal(personalCreditView.data.cheap,undefined);
  assert.equal(personalCreditView.data.test,undefined);
  assert.equal(JSON.stringify(personalCreditView.data).includes(globalFallback),false);
  assert.equal(JSON.stringify(personalCreditView.data).includes(ownKeyA),false);

  const beforeExhausted = providerRequests.filter(item => item.endpoint === "completion").length;
  nextCompletionStatus = {status:402,body:JSON.stringify({error:{message:"private provider text",metadata:{limit_source:"openrouter_key_limit"}}})};
  const exhaustedPilot = await memberA.browser.call("/api/ai",{messages:[{role:"user",content:"synthetic"}]});
  assert.equal(exhaustedPilot.status,402);
  assert.equal(exhaustedPilot.data.error?.code,"pilot_limit_exhausted");
  assert.match(exhaustedPilot.data.error?.message ?? "",/4,00|Startzugang/);
  assert.equal(providerRequests.filter(item => item.endpoint === "completion").length,beforeExhausted+1,"kein stiller zweiter Schlüsselaufruf");
  assert.equal(JSON.stringify(exhaustedPilot.data).includes("private provider text"),false);
  statusA = (await memberA.browser.call("/api/account/ai-credential")).data as unknown as CredentialStatus;
  assert.equal(statusA.selection.source,"pilot","Limitfehler ändert die Auswahl nicht");
  assert.equal((await ownerWrite(memberA.browser,{action:"select",source:"own",expectedRevision:statusA.selection.revision,requestId:"select-own-a-1"},statusA.context)).status,200);
  const ownAi = await memberA.browser.call("/api/ai",{messages:[{role:"user",content:"synthetic"}]});
  assert.equal(ownAi.status,200);
  assert.equal(providerRequests.filter(item => item.endpoint === "completion").at(-1)?.key,ownKeyA);

  const ownB = await ownerWrite(memberB.browser,{
    action:"set-own",apiKey:ownKeyB,expectedRevision:null,requestId:"own-b-1",
  });
  assert.equal(ownB.status,201);
  const statusB = await ownerStatus(memberB.browser);
  assert.equal(statusB.selection.source,"off");
  assert.equal(statusB.credentials.own.maskedKey,"••••0003");
  assert.equal(JSON.stringify(statusB).includes(ownKeyA),false);
  assert.equal(JSON.stringify(statusB).includes(pilotKey),false);
  assert.equal((await ownerWrite(memberB.browser,{action:"select",source:"own",expectedRevision:statusB.selection.revision,requestId:"select-own-b-1"},statusB.context)).status,200);
  const tagged = await memberB.browser.call("/api/docs/tag",{name:"synthetic-file.pdf",type:"application/pdf",description:"synthetic document"});
  assert.equal(tagged.status,200);
  assert.equal(tagged.data.summary,"Synthetischer Treffer.");
  assert.deepEqual(tagged.data.topicIds,[topicId]);
  assert.equal(providerRequests.filter(item => item.endpoint === "completion").at(-1)?.key,ownKeyB);

  const invalidOwn = await ownerWrite(memberB.browser,{
    action:"set-own",apiKey:"sk-or-v1-INVALID-SYNTHETIC-0004",expectedRevision:1,requestId:"own-b-invalid",
  });
  assert.equal(invalidOwn.status,401);
  assert.equal(invalidOwn.data.error?.code,"provider_key_invalid");
  const duplicate = await ownerWrite(memberB.browser,{
    action:"set-own",apiKey:pilotKey,expectedRevision:1,requestId:"own-b-duplicate",
  });
  assert.equal(duplicate.status,409);
  assert.equal(duplicate.data.error?.code,"key_already_assigned");

  nextCompletionStatus = {status:402,body:JSON.stringify({error:{metadata:{limit_source:"openrouter_key_limit"}}})};
  const exhaustedOwn = await memberB.browser.call("/api/docs/tag",{name:"synthetic.pdf"});
  assert.equal(exhaustedOwn.status,402);
  assert.equal(exhaustedOwn.data.error?.code,"own_limit_exhausted");
  assert.equal(providerRequests.filter(item => item.endpoint === "completion").at(-1)?.key,ownKeyB);
  assert.deepEqual(mapProviderFailure(429,"{}","own"),{code:"provider_rate_limited",message:"OpenRouter ist gerade überlastet. Bitte kurz warten und dann bewusst erneut versuchen.",status:429});

  delayed = null;
  const previousProviderCalls = providerRequests.filter(item => item.endpoint === "completion").length;
  nextCompletionStatus = null;
  globalThis.fetch = async (input,init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://openrouter.ai/api/v1/chat/completions") throw new TypeError("synthetic network interruption");
    return originalFetch(input,init);
  };
  const uncertain = await memberB.browser.call("/api/ai",{messages:[{role:"user",content:"synthetic disconnect"}]});
  assert.equal(uncertain.status,504);
  assert.equal(uncertain.data.error?.code,"provider_uncertain");
  assert.match(uncertain.data.error?.message ?? "",/Anbieterstatus kann unklar sein/);
  assert.equal(providerRequests.filter(item => item.endpoint === "completion").length,previousProviderCalls,"unklare Antwort wird nicht wiederholt");
  globalThis.fetch = async (input,init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://openrouter.ai/api/v1/key") {
      const key = new Headers(init?.headers).get("authorization")?.replace(/^Bearer /,"") ?? "";
      providerRequests.push({endpoint:"key-status",key});
      const status = providerKeys.get(key);
      return status ? Response.json({data:{is_management_key:false,is_provisioning_key:false,...status}}) : new Response("{}",{status:401});
    }
    if (url === "https://openrouter.ai/api/v1/chat/completions") {
      const key = new Headers(init?.headers).get("authorization")?.replace(/^Bearer /,"") ?? "";
      providerRequests.push({endpoint:"completion",key});
      return Response.json({choices:[{finish_reason:"stop",message:{content:"Synthetische KI-Antwort."}}]});
    }
    return originalFetch(input,init);
  };

  const databaseRows = await database!.pool.query<{encrypted_key:string;key_fingerprint:string;credential_id:string;owner_user_id:string;source:"pilot"|"own"}>(
    "SELECT encrypted_key,key_fingerprint,credential_id,owner_user_id,source FROM stex.ai_credentials WHERE configured ORDER BY owner_user_id,source");
  assert.equal(databaseRows.rows.length,3);
  for (const row of databaseRows.rows) {
    assert.equal(row.encrypted_key.includes(pilotKey) || row.encrypted_key.includes(ownKeyA) || row.encrypted_key.includes(ownKeyB),false);
    const plaintext = decryptCredential(row.encrypted_key,{credentialId:row.credential_id,ownerUserId:row.owner_user_id,source:row.source},credentialSecrets);
    assert.ok([pilotKey,ownKeyA,ownKeyB].includes(plaintext));
  }
  const auditText = JSON.stringify((await database!.pool.query("SELECT fingerprint,result FROM stex.account_audit WHERE action LIKE 'ai-credential-%'")).rows);
  for (const key of [pilotKey,ownKeyA,ownKeyB,globalFallback]) assert.equal(auditText.includes(key),false);

  const adminStatus = await admin.call(`/api/account/admin/ai-credential?userId=${memberA.memberId}`);
  assert.equal(adminStatus.status,200);
  assert.equal((adminStatus.data.credential as { maskedKey: string | null }).maskedKey,"••••0001");
  const deniedAdminStatus = await memberA.browser.call(`/api/account/admin/ai-credential?userId=${memberB.memberId}`);
  assert.equal(deniedAdminStatus.status,403);

  const protectedBackup = {encryptionKey:backupKey,authSecret};
  const backupDirectory = join(privateRoot,"backup");
  await backup(database!,new PrivateFiles(join(privateRoot,"files")),backupDirectory,protectedBackup);
  const manifestText = await readFile(join(backupDirectory,"manifest.json"),"utf8");
  assert.equal(manifestText.includes(pilotKey),false);
  assert.equal(manifestText.includes(ownKeyA),false);
  assert.equal(manifestText.includes(ownKeyB),false);
  const targetName = "ai_keys_restore";
  await cluster.createDatabase(targetName);
  const targetDb = new Database({host:"127.0.0.1",port:pgPort,user:"stex_local",password:dbPassword,database:targetName,connectionTimeoutMillis:5000});
  await targetDb.migrate();
  const targetFiles = new PrivateFiles(join(privateRoot,"restore-files")); await targetFiles.initialize();
  await restore(targetDb,targetFiles,backupDirectory,protectedBackup);
  const restored = await targetDb.pool.query<{owner_user_id:string;source:"pilot"|"own";credential_id:string;encrypted_key:string}>(
    "SELECT owner_user_id,source,credential_id,encrypted_key FROM stex.ai_credentials WHERE configured ORDER BY owner_user_id,source");
  assert.equal(restored.rows.length,3);
  const restoredOwnA = restored.rows.find(row => row.owner_user_id===memberA.memberId && row.source==="own")!;
  assert.equal(decryptCredential(restoredOwnA.encrypted_key,{credentialId:restoredOwnA.credential_id,ownerUserId:restoredOwnA.owner_user_id,source:restoredOwnA.source},credentialSecrets),ownKeyA);
  assert.equal((await targetDb.pool.query("SELECT selected_source FROM stex.ai_credential_selections WHERE owner_user_id=$1",[memberA.memberId])).rows[0].selected_source,"own");
  await targetDb.close();

  const wrongKeyName = "ai_keys_wrong_restore";
  await cluster.createDatabase(wrongKeyName);
  const wrongDb = new Database({host:"127.0.0.1",port:pgPort,user:"stex_local",password:dbPassword,database:wrongKeyName,connectionTimeoutMillis:5000});
  await wrongDb.migrate();
  const correctEncryptionKey = process.env.STEX_AI_CREDENTIAL_ENCRYPTION_KEY!;
  process.env.STEX_AI_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  await assert.rejects(restore(wrongDb,new PrivateFiles(join(privateRoot,"wrong-restore-files")),backupDirectory,protectedBackup),/KI-Zugang|Entschlüsselungsgeheimnis/);
  process.env.STEX_AI_CREDENTIAL_ENCRYPTION_KEY = correctEncryptionKey;
  assert.equal((await wrongDb.pool.query("SELECT count(*) FROM stex.ai_credentials")).rows[0].count,"0");
  await wrongDb.close();

  const beforeOwnRemoval = await ownerStatus(memberA.browser);
  const removedOwn = await ownerWrite(memberA.browser,{
    action:"remove-own",expectedRevision:beforeOwnRemoval.credentials.own.revision,requestId:"remove-own-a-end",
  },beforeOwnRemoval.context);
  assert.equal(removedOwn.status,200);
  const afterOwnRemoval = await ownerStatus(memberA.browser);
  assert.equal(afterOwnRemoval.selection.source,"off","Entfernen schaltet nur die entfernte Quelle aus");
  assert.equal(afterOwnRemoval.credentials.own.maskedKey,null);

  const blocked = await admin.call("/api/account/admin/account-action",{
    userId:memberA.memberId,action:"block",expectedRevision:2,requestId:"block-ai-a",
  });
  assert.equal(blocked.status,200);
  const callsBeforeBlocked = providerRequests.filter(item => item.endpoint === "completion").length;
  const blockedAi = await memberA.browser.call("/api/ai",{messages:[{role:"user",content:"blocked synthetic"}]});
  assert.equal(blockedAi.status,401);
  assert.equal(providerRequests.filter(item => item.endpoint === "completion").length,callsBeforeBlocked,"gesperrtes Konto erreicht den Provider nicht");
  assert.equal(JSON.stringify(blockedAi.data).includes(globalFallback),false);
  assert.equal(JSON.stringify(await database!.pool.query("SELECT encrypted_key,key_fingerprint FROM stex.ai_credentials" )).includes(globalFallback),false);
  assert.equal(JSON.stringify({port,providerRequests:providerRequests.map(item => item.endpoint)}).includes(pilotKey),false);
});
