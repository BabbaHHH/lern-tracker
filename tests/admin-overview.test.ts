import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import { AccountService } from "../src/lib/server/auth/service";
import { AdminService, importPaging } from "../src/lib/server/admin/service";
import { adminHTTP } from "../src/lib/server/admin/http";
import { CatalogImportService } from "../src/lib/server/catalog/import-service";
import { fileHash } from "../src/lib/server/persistence/files";
import { accountActions, accountCounts, accountStage, type ManagedAccount } from "../src/components/admin-model";
import { seal, tokenHash, unseal } from "../src/lib/server/auth/security";

const password = "Synthetisches Admin Passwort 2026!";
function totp(uri: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...new URL(uri).searchParams.get("secret")!].map(c => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(v => parseInt(v, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac("sha1", key).update(counter).digest(), offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}
test("ADMIN-A1: Kontozustände unterscheiden Einrichtung und Freigabe", () => {
  const a: ManagedAccount = { userId: "a", email: "a@example.test", name: "A", status: "pending", role: "member", revision: 1, emailVerified: false, invitationExpiresAt: "2020-01-01T00:00:00.000Z", invitationConsumedAt: null, invitationRevokedAt: null, librarySessionsRevoked: null };
  assert.equal(accountStage(a), "Einladung abgelaufen"); assert.ok(!accountActions(a).includes("activate"));
  a.invitationConsumedAt = new Date().toISOString(); assert.equal(accountStage(a), "Adresse noch nicht bestätigt");
  a.emailVerified = true; assert.ok(accountActions(a).includes("activate")); assert.equal(accountCounts([a]).waiting, 1);
  a.status = "blocked"; a.librarySessionsRevoked = false; assert.deepEqual(accountActions(a), ["cleanup", "unblock"]);
  a.role = "admin"; assert.deepEqual(accountActions(a), []);
  assert.throws(() => importPaging(new URLSearchParams({ to: "garbage" })));
});

test("R46-LINK-ONLY: verschlüsselte, wiederholbare Admin-Einladung ohne Mail", { timeout: 120000 }, async t => {
  const runtime = await testRuntime();
  t.after(() => runtime.close());
  const repository = await runtime.repository("auth_r46_link_only");
  const options = { database: repository.database, baseURL: "http://localhost:4998", secret: randomBytes(48).toString("hex"), mailKey: randomBytes(48).toString("hex") };
  const auth = new AccountService(options);
  let droppedLink = "";
  class Session {
    cookies = new Map<string, string>();
    headers() { return new Headers({ cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") }); }
    async call(path: string, body?: unknown, config: { service?: AccountService; headers?: Record<string, string | null>; loseResponse?: boolean } = {}) {
      const service = config.service ?? auth, headers = this.headers();
      if (body !== undefined) { headers.set("origin", service.baseURL); headers.set("x-stex-action", "1"); headers.set("content-type", "application/json"); }
      for (const [key, value] of Object.entries(config.headers ?? {})) { if (value === null) headers.delete(key); else headers.set(key, value); }
      const req = new Request(new URL(path, service.baseURL), { headers, method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      const route = new URL(req.url).pathname;
      const res = route.startsWith("/api/auth/") ? await service.authHTTP(req) : route.startsWith("/api/account/admin-overview") ? await adminHTTP(req, new AdminService(service)) : await service.accountHTTP(req);
      for (const header of res.headers.getSetCookie()) { const pair = header.split(";", 1)[0], at = pair.indexOf("="); const key = pair.slice(0, at), value = pair.slice(at + 1); if (value) this.cookies.set(key, value); else this.cookies.delete(key); }
      const text = await res.text(), data = text && res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : null;
      if (config.loseResponse) {
        assert.equal(res.status, 201);
        droppedLink = data.invitationUrl;
        // The service already committed; the caller receives no successful response.
        throw new Error("Synthetischer Antwortverlust nach Commit");
      }
      return { status: res.status, data, headers: res.headers };
    }
  }
  const n = new Session(), member = new Session(), anon = new Session(), factorMissing = new Session();
  const invitationPath = "/api/account/admin/invitations";
  const linkBody = { email: "link-r46@example.test", name: "Synthetic Link", requestId: randomUUID(), delivery: "link-only" };
  const mailBody = { email: "mail-r46@example.test", name: "Synthetic Mail", requestId: randomUUID() };
  const bodyFor = (label: string) => ({ email: `${label}-r46@example.test`, name: "Synthetic R46", requestId: randomUUID(), delivery: "link-only" });
  async function register(session: Session, email: string, url?: string) {
    const invitation = url ?? (await auth.localMails(email)).findLast(m => m.purpose === "invitation")!.url;
    assert.equal((await session.call("/api/auth/sign-up/email", { email, password, invitationToken: new URL(invitation).searchParams.get("token") })).status, 200);
  }
  async function verifyAndLogin(session: Session, email: string) {
    const verification = (await auth.localMails(email)).findLast(m => m.purpose === "verification")!;
    assert.equal((await session.call(verification.url)).status, 302);
    assert.equal((await session.call("/api/auth/sign-in/email", { email, password })).status, 200);
  }
  const adminEmail = "admin-r46@example.test";
  const bootstrap = await auth.prepareAdmin(adminEmail, "Synthetic R46 Admin") as { userId: string };
  await register(n, adminEmail); await verifyAndLogin(n, adminEmail);
  const enabled = await n.call("/api/auth/two-factor/enable", { password, method: "totp" }); assert.equal(enabled.status, 200);
  assert.equal((await n.call("/api/auth/two-factor/verify-totp", { code: totp(enabled.data.totpURI) })).status, 200);
  await auth.finishAdmin(bootstrap.userId);
  await n.call("/api/auth/sign-in/email", { email: adminEmail, password });
  assert.equal((await n.call("/api/auth/two-factor/verify-totp", { code: totp(enabled.data.totpURI) })).status, 200);
  let mailUserId = "";
  let linked: { userId: string; invitationId: string; expiresAt: string; delivery: string; invitationUrl: string };
  const auditRow = async () => (await repository.database.pool.query("SELECT result FROM stex.account_audit WHERE actor=$1 AND request_id=$2", [bootstrap.userId, linkBody.requestId])).rows[0].result;

  await t.test("R46 Auditfehler rollt Konto und Einladung atomar zurück; Wiederholung kann sicher neu beginnen", async () => {
    const body = bodyFor("rollback");
    const before = (await repository.database.pool.query("SELECT (SELECT count(*)::int FROM stex.accounts) AS accounts,(SELECT count(*)::int FROM stex.auth_mail_outbox) AS mails")).rows[0];
    const originalTransaction = repository.database.transaction.bind(repository.database);
    repository.database.transaction = async work => originalTransaction(async client => {
      const query = client.query;
      client.query = ((...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].startsWith("INSERT INTO stex.account_audit(") && Array.isArray(args[1]) && args[1][4] === body.requestId) throw new Error("Synthetic audit failure");
        return Reflect.apply(query, client, args);
      }) as typeof client.query;
      try { return await work(client); } finally { client.query = query; }
    });
    try { const failed = await n.call(invitationPath, body); assert.equal(failed.status, 503); assert.equal(failed.data.invitationUrl, undefined); }
    finally { repository.database.transaction = originalTransaction; }
    const after = (await repository.database.pool.query("SELECT (SELECT count(*)::int FROM stex.accounts) AS accounts,(SELECT count(*)::int FROM stex.auth_mail_outbox) AS mails")).rows[0];
    assert.deepEqual(after, before);
    assert.equal((await repository.database.pool.query("SELECT count(*)::int AS count FROM stex.account_invitations WHERE email=$1", [body.email])).rows[0].count, 0);
    assert.equal((await repository.database.pool.query("SELECT count(*)::int AS count FROM stex.account_audit WHERE actor=$1 AND request_id=$2", [bootstrap.userId, body.requestId])).rows[0].count, 0);
    assert.equal((await n.call(invitationPath, body)).status, 201);
    assert.equal((await auth.localMails(body.email)).length, 0);
  });
  await t.test("R46 Default bleibt Mail: gleiche Antwort und genau eine wartende Outboxmail", async () => {
    const created = await n.call(invitationPath, mailBody); assert.equal(created.status, 201);
    assert.deepEqual(Object.keys(created.data).sort(), ["expiresAt", "invitationId", "userId"]);
    mailUserId = created.data.userId;
    const replay = await n.call(invitationPath, mailBody); assert.equal(replay.status, 200); assert.deepEqual(replay.data, created.data);
    const mails = (await repository.database.pool.query("SELECT purpose,dispatch_status FROM stex.auth_mail_outbox WHERE email=$1", [mailBody.email])).rows;
    assert.equal(mails.length, 1); assert.equal(mails[0].purpose, "invitation"); assert.equal(mails[0].dispatch_status, "pending");
  });
  await t.test("R46 verlorene Commitantwort und neue Serviceinstanz liefern denselben Link ohne Duplikat/Outbox", async () => {
    const before = (await repository.database.pool.query("SELECT count(*)::int AS count FROM stex.auth_mail_outbox")).rows[0].count;
    await assert.rejects(n.call(invitationPath, linkBody, { loseResponse: true }), /Synthetischer Antwortverlust nach Commit/);
    const recreated = new AccountService(options);
    const replies = await Promise.all([n.call(invitationPath, linkBody), n.call(invitationPath, linkBody, { service: recreated })]);
    assert.ok(replies.every(r => r.status === 200 && r.data.invitationUrl === droppedLink), "Gleicher Link nach Antwortverlust und bei konkurrierendem Replay");
    linked = replies[0].data;
    assert.equal(linked.delivery, "link-only"); assert.equal(replies[0].headers.get("cache-control"), "private, no-store");
    assert.equal(replies[0].headers.get("referrer-policy"), "no-referrer");
    assert.equal(replies[0].data.sealedInvitationLink, undefined); assert.equal(replies[0].data.sent, undefined);
    const url = new URL(linked.invitationUrl), token = url.searchParams.get("token")!;
    assert.ok(url.origin === auth.baseURL && url.pathname === "/konto/einrichten" && url.searchParams.get("email") === linkBody.email && url.searchParams.size === 2);
    assert.ok(/^[A-Za-z0-9_-]{43}$/.test(token));
    assert.ok(Math.abs(Date.parse(linked.expiresAt) - Date.now() - 7 * 86400000) < 60000);
    const invitations = (await repository.database.pool.query("SELECT v.token_hash,a.status,a.role,a.revision FROM stex.account_invitations v JOIN stex.accounts a ON a.user_id=v.user_id WHERE v.email=$1", [linkBody.email])).rows;
    assert.equal(invitations.length, 1); assert.ok(invitations[0].token_hash === tokenHash(token));
    assert.equal(invitations[0].status, "pending"); assert.equal(invitations[0].role, "member"); assert.equal(invitations[0].revision, 1);
    const audit = await auditRow(), stored = JSON.stringify(audit);
    assert.equal(typeof audit.sealedInvitationLink, "string"); assert.equal(audit.invitationUrl, undefined);
    assert.ok(!stored.includes(token) && !stored.includes(linked.invitationUrl), "Audit enthält keinen Klartextlink/-token");
    assert.equal((await repository.database.pool.query("SELECT count(*)::int AS count FROM stex.account_audit WHERE actor=$1 AND request_id=$2", [bootstrap.userId, linkBody.requestId])).rows[0].count, 1);
    assert.equal((await repository.database.pool.query("SELECT count(*)::int AS count FROM stex.auth_mail_outbox")).rows[0].count, before);
    assert.equal((await auth.localMails(linkBody.email)).length, 0);
  });
  await t.test("R46 Fingerprint, Modus und sichere Auditprojektion begrenzen die Linkausgabe", async () => {
    for (const changed of [{ ...linkBody, name: "Changed" }, { ...linkBody, delivery: "mail" }, { ...linkBody, email: "different-r46@example.test" }]) {
      const result = await n.call(invitationPath, changed); assert.equal(result.status, 409); assert.equal(result.data.invitationUrl, undefined);
    }
    const invalid = await n.call(invitationPath, { ...bodyFor("invalid"), delivery: "smtp" }); assert.equal(invalid.status, 400);
    const audit = await n.call(`/api/account/admin-overview?view=audit&userId=${linked.userId}`); assert.equal(audit.status, 200);
    const serialized = JSON.stringify(audit.data);
    assert.ok(!serialized.includes(linked.invitationUrl) && !serialized.includes("sealedInvitationLink") && !serialized.includes("fingerprint"));
    assert.equal((await n.call(invitationPath)).status, 404);
  });
  await t.test("R46 Siegel bleibt an Schlüssel, Admin, Request, Fingerprint und Ursprung gebunden", async () => {
    const original = await auditRow(), envelope = JSON.parse(unseal(original.sealedInvitationLink, options.mailKey));
    const write = (result: unknown) => repository.database.pool.query("UPDATE stex.account_audit SET result=$3::jsonb WHERE actor=$1 AND request_id=$2", [bootstrap.userId, linkBody.requestId, JSON.stringify(result)]);
    for (const service of [new AccountService({ ...options, mailKey: randomBytes(48).toString("hex") }), new AccountService({ ...options, baseURL: "http://localhost:4997" })]) {
      const response = await n.call(invitationPath, linkBody, { service }); assert.equal(response.status, 503); assert.equal(response.data.invitationUrl, undefined);
    }
    try {
      await write({ ...original, sealedInvitationLink: "damaged" });
      assert.equal((await n.call(invitationPath, { ...linkBody, name: "Different fingerprint" })).status, 409);
      assert.equal((await n.call(invitationPath, linkBody)).status, 503);
      const changes = { actor: randomUUID(), requestId: randomUUID(), fingerprint: "different", baseURL: "http://localhost:4997", purpose: "mail", userId: randomUUID(), invitationId: randomUUID(), expiresAt: new Date(0).toISOString(), invitationUrl: "https://invalid.example.test/konto/einrichten" };
      for (const [field, value] of Object.entries(changes)) {
        await write({ ...original, sealedInvitationLink: seal(JSON.stringify({ ...envelope, [field]: value }), options.mailKey) });
        const response = await n.call(invitationPath, linkBody); assert.equal(response.status, 503, `Ungültige Bindung: ${field}`); assert.equal(response.data.invitationUrl, undefined);
      }
    } finally { await write(original); }
    const replay = await n.call(invitationPath, linkBody); assert.equal(replay.status, 200); assert.ok(replay.data.invitationUrl === linked.invitationUrl);
  });
  await t.test("R46 anonym, Mitglied, wartend, fehlendes TOTP und CSRF/Origin erhalten keinen Link", async () => {
    const denied = bodyFor("denied");
    assert.equal((await anon.call(invitationPath, denied)).status, 401);
    await register(member, mailBody.email); await verifyAndLogin(member, mailBody.email);
    assert.equal((await member.call(invitationPath, denied)).status, 403);
    assert.equal((await n.call("/api/account/admin/account-action", { userId: mailUserId, action: "activate", expectedRevision: 1, requestId: randomUUID() })).status, 200);
    await member.call("/api/auth/sign-in/email", { email: mailBody.email, password });
    assert.equal((await member.call(invitationPath, denied)).status, 403);
    await factorMissing.call("/api/auth/sign-in/email", { email: adminEmail, password });
    assert.equal((await factorMissing.call(invitationPath, denied)).status, 401);
    const rejectedHeaders: Record<string, string | null>[] = [{ origin: "https://invalid.example.test" }, { origin: null }, { "x-stex-action": null }, { "sec-fetch-site": "cross-site" }, { host: "invalid.example.test" }];
    for (const headers of rejectedHeaders) {
      const response = await n.call(invitationPath, denied, { headers }); assert.equal(response.status, 403); assert.equal(response.data.invitationUrl, undefined);
    }
    assert.equal((await repository.database.pool.query("SELECT count(*)::int AS count FROM stex.account_invitations WHERE email=$1", [denied.email])).rows[0].count, 0);
  });
  await t.test("R46 Replay prüft frische Anmeldung, Transaktionszugriff und Anfragelimit erneut", async () => {
    const who = await auth.principal(n.headers(), "admin");
    const timestamps = (await repository.database.pool.query('SELECT "createdAt","factorVerifiedAt" FROM public.stex_auth_session WHERE id=$1', [who.sessionId])).rows[0];
    try {
      for (const column of ["factorVerifiedAt", "createdAt"]) {
        await repository.database.pool.query(`UPDATE public.stex_auth_session SET "${column}"=now()-interval '11 minutes' WHERE id=$1`, [who.sessionId]);
        const response = await n.call(invitationPath, linkBody); assert.equal(response.status, 401); assert.equal(response.data.invitationUrl, undefined);
        await repository.database.pool.query('UPDATE public.stex_auth_session SET "createdAt"=$2,"factorVerifiedAt"=$3 WHERE id=$1', [who.sessionId, timestamps.createdAt, timestamps.factorVerifiedAt]);
      }
    } finally { await repository.database.pool.query('UPDATE public.stex_auth_session SET "createdAt"=$2,"factorVerifiedAt"=$3 WHERE id=$1', [who.sessionId, timestamps.createdAt, timestamps.factorVerifiedAt]); }
    const originalPrincipal = auth.principal.bind(auth);
    auth.principal = async (...args) => { const principal = await originalPrincipal(...args); await repository.database.pool.query("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [principal.userId]); return principal; };
    try { const response = await n.call(invitationPath, linkBody); assert.equal(response.status, 401); assert.equal(response.data.invitationUrl, undefined); }
    finally { auth.principal = originalPrincipal; await repository.database.pool.query("UPDATE stex.accounts SET status='active' WHERE user_id=$1", [who.userId]); }
    const limitKey = tokenHash("site:account:/admin/invitations");
    await repository.database.pool.query("UPDATE stex.auth_limits SET count=300 WHERE key=$1", [limitKey]);
    try { const response = await n.call(invitationPath, linkBody); assert.equal(response.status, 429); assert.equal(response.data.invitationUrl, undefined); }
    finally { await repository.database.pool.query("DELETE FROM stex.auth_limits WHERE key=$1", [limitKey]); }
  });
  await t.test("R46 Link ist adressgebunden und einmalig; Verifikation aktiviert das Mitglied nicht", async () => {
    const recipient = new Session(), token = new URL(linked.invitationUrl).searchParams.get("token");
    assert.equal((await recipient.call("/api/auth/sign-up/email", { email: "foreign-r46@example.test", password, invitationToken: token })).status, 403);
    await register(recipient, linkBody.email, linked.invitationUrl);
    assert.equal((await recipient.call("/api/auth/sign-up/email", { email: linkBody.email, password, invitationToken: token })).status, 403);
    await verifyAndLogin(recipient, linkBody.email);
    const account = await recipient.call("/api/account"); assert.equal(account.data.account.status, "pending"); assert.equal(account.data.account.role, "member");
    assert.equal((await recipient.call("/api/account/notes")).status, 403);
    assert.equal((await repository.database.pool.query("SELECT count(*)::int AS count FROM stex.auth_identities WHERE user_id=$1", [linked.userId])).rows[0].count, 1);
    const purposes = (await repository.database.pool.query("SELECT purpose FROM stex.auth_mail_outbox WHERE email=$1", [linkBody.email])).rows.map(row => row.purpose);
    assert.ok(purposes.includes("verification") && !purposes.includes("invitation"), "Nur die normale spätere Adressbestätigung erzeugt eine Mail");
  });
  await t.test("R46 Ablauf und Widerruf sperren auch Link-only-Einladungen", async () => {
    for (const mode of ["expired", "revoked"]) {
      const body = bodyFor(mode), created = await n.call(invitationPath, body); assert.equal(created.status, 201);
      if (mode === "expired") await repository.database.pool.query("UPDATE stex.account_invitations SET expires_at=now()-interval '1 second' WHERE id=$1", [created.data.invitationId]);
      else assert.equal((await n.call("/api/account/admin/account-action", { userId: created.data.userId, action: "revoke", expectedRevision: 1, requestId: randomUUID() })).status, 200);
      assert.equal((await new Session().call("/api/auth/sign-up/email", { email: body.email, password, invitationToken: new URL(created.data.invitationUrl).searchParams.get("token") })).status, 403);
      assert.equal((await auth.localMails(body.email)).length, 0);
    }
  });
});
test("ADMIN-A1: echte PostgreSQL-/Auth-/TOTP-Verwaltung", { timeout: 180000 }, async t => {
  const runtime = await testRuntime(); const repository = await runtime.repository("admin_a1");
  t.after(() => runtime.close());
  const auth = new AccountService({ database: repository.database, files: repository.files, baseURL: "http://localhost:4999", secret: randomBytes(48).toString("hex"), mailKey: randomBytes(48).toString("hex") });
  const admin = new AdminService(auth), catalog = new CatalogImportService(auth, repository.files);
  class Session {
    cookies = new Map<string, string>();
    headers() { return new Headers({ cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") }); }
    async call(path: string, body?: unknown) {
      const headers = this.headers();
      if (body !== undefined) { headers.set("origin", auth.baseURL); headers.set("x-stex-action", "1"); headers.set("content-type", "application/json"); }
      const req = new Request(new URL(path, auth.baseURL), { headers, method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      const route = new URL(req.url).pathname;
      const res = route.startsWith("/api/account/admin-overview") ? await adminHTTP(req, admin) : route.startsWith("/api/auth") ? await auth.authHTTP(req) : await auth.accountHTTP(req);
      for (const header of res.headers.getSetCookie()) { const pair = header.split(";", 1)[0], at = pair.indexOf("="); const k = pair.slice(0, at), v = pair.slice(at + 1); if (v) this.cookies.set(k, v); else this.cookies.delete(k); }
      const text = await res.text();
      return { status: res.status, data: text && res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : null, headers: res.headers };
    }
  }
  const n = new Session(), a = new Session(), waiting = new Session(), anon = new Session(), factorMissing = new Session();
  async function signup(s: Session, email: string) {
    const invite = (await auth.localMails(email)).findLast(m => m.purpose === "invitation")!;
    assert.equal((await s.call("/api/auth/sign-up/email", { email, password, invitationToken: new URL(invite.url).searchParams.get("token") })).status, 200);
    const verification = (await auth.localMails(email)).findLast(m => m.purpose === "verification")!;
    assert.equal((await s.call(verification.url)).status, 302);
    assert.equal((await s.call("/api/auth/sign-in/email", { email, password })).status, 200);
  }
  const bootstrap = await auth.prepareAdmin("admin-a1@example.test", "ADMIN Test") as { userId: string };
  await signup(n, "admin-a1@example.test");
  const enabled = await n.call("/api/auth/two-factor/enable", { password, method: "totp" }); assert.equal(enabled.status, 200);
  const uri = enabled.data.totpURI;
  assert.equal((await n.call("/api/auth/two-factor/verify-totp", { code: totp(uri) })).status, 200);
  await auth.finishAdmin(bootstrap.userId);
  await n.call("/api/auth/sign-in/email", { email: "admin-a1@example.test", password });
  assert.equal((await n.call("/api/auth/two-factor/verify-totp", { code: totp(uri) })).status, 200);
  const invite = await n.call("/api/account/admin/invitations", { email: "member-a1@example.test", name: "Member A", requestId: randomUUID() }); assert.equal(invite.status, 201);
  const id = invite.data.userId as string;
  await signup(a, "member-a1@example.test");
  const w = await n.call("/api/account/admin/invitations", { email: "waiting-a1@example.test", name: "Waiting", requestId: randomUUID() });
  await signup(waiting, "waiting-a1@example.test");
  assert.equal((await n.call("/api/account/admin/account-action", { userId: id, action: "activate", expectedRevision: 1, requestId: randomUUID() })).status, 200);
  await a.call("/api/auth/sign-in/email", { email: "member-a1@example.test", password });
  await factorMissing.call("/api/auth/sign-in/email", { email: "admin-a1@example.test", password });
  const paths = ["", "?view=imports", "?view=detail&importId=ci-00000000-0000-0000-0000-000000000000", `?view=audit&userId=${id}`];
  await t.test("Alle Adminleseansichten verweigern anonym, Mitglied, wartend und fehlendes TOTP", async () => {
    for (const s of [anon, a, waiting, factorMissing]) for (const p of paths) assert.ok([401, 403].includes((await s.call(`/api/account/admin-overview${p}`)).status));
    const overview = await n.call("/api/account/admin-overview"); assert.equal(overview.status, 200); assert.equal(overview.data.capabilities.usage.value, null); assert.match(overview.headers.get("cache-control")!, /no-store/);
    assert.equal((await n.call("/api/account/admin-overview", {})).status, 405);
  });
  const bytes = Buffer.from("Synthetische PDF-Bytes für Admin-Projektion");
  const documents = ["sachverhalt", "loesung"].map(role => ({ role: role as "sachverhalt" | "loesung", filename: `${role}.pdf`, bytes, sha256: fileHash(bytes), byteSize: bytes.length, pageCount: 1, textStatus: "ready" as const, extractionVersion: "synthetic-admin" }));
  const first = await catalog.submit(a.headers(), { requestId: randomUUID(), metadata: { id: "admin-case", source: "synthetisch", title: "Gemeinsamer Fall", date: "", area: "zr", topicIds: [] }, documents });
  const id1 = first.summary.importId;
  await catalog.submit(a.headers(), { requestId: randomUUID(), metadata: { id: "admin-case", source: "synthetisch", title: "Gemeinsamer Fall", date: "", area: "zr", topicIds: [] }, documents: documents.map(d => d.role === "loesung" ? { ...d, bytes: Buffer.from("Neue Lösung"), byteSize: Buffer.byteLength("Neue Lösung"), sha256: fileHash(Buffer.from("Neue Lösung")) } : d) });
  await t.test("Belegdetails zeigen nur zugehörige Versionen und sichere Projektionen", async () => {
    const detail = await n.call(`/api/account/admin-overview?view=detail&importId=${id1}`); assert.equal(detail.status, 200);
    assert.deepEqual(detail.data.import.documents.map((d: { versionNumber: number }) => d.versionNumber), [1, 1]);
    assert.ok(!JSON.stringify(detail.data).includes("storage_key"));
    await assert.rejects(catalog.status(waiting.headers(), id1));
    const audit = await n.call(`/api/account/admin-overview?view=audit&userId=${id}`); assert.equal(audit.status, 200); assert.ok(audit.data.items.length >= 2); assert.ok(!JSON.stringify(audit.data).includes("fingerprint"));
  });
  await t.test("Pagination verliert keine Belege bei Mikrosekunden und bindet Filter", async () => {
    await repository.database.pool.query("UPDATE stex.catalog_imports SET created_at=date_trunc('second',now())-interval '1 second'+(case when import_id=$1 then interval '0.123456 second' else interval '0.123111 second' end)", [id1]);
    const firstPage = await n.call("/api/account/admin-overview?view=imports&limit=1"); assert.equal(firstPage.status, 200); assert.ok(firstPage.data.nextCursor);
    const second = await n.call(`/api/account/admin-overview?view=imports&limit=1&cursor=${encodeURIComponent(firstPage.data.nextCursor)}`); assert.equal(second.status, 200); assert.equal(second.data.items.length, 1); assert.notEqual(second.data.items[0].importId, firstPage.data.items[0].importId);
    assert.equal((await n.call(`/api/account/admin-overview?view=imports&status=failed&cursor=${encodeURIComponent(firstPage.data.nextCursor)}`)).status, 400);
    assert.equal((await n.call("/api/account/admin-overview?view=imports&limit=101")).status, 400);
    assert.equal((await n.call("/api/account/admin-overview?view=imports&to=garbage")).status, 400);
  });
  await t.test("Rohe Fehlermeldungen und Warnungen bleiben ausgeschlossen", async () => {
    await repository.database.pool.query("UPDATE stex.catalog_imports SET status='failed',error_code='secret injected',error_message='PRIVATE TOKEN',warnings='[\"PRIVATE CONTENT\"]' WHERE import_id=$1", [id1]);
    const result = await n.call("/api/account/admin-overview?view=imports&status=failed"); assert.equal(result.status, 200); assert.equal(result.data.items.length, 1);
    assert.ok(!JSON.stringify(result.data).includes("PRIVATE")); assert.ok(!JSON.stringify(result.data).includes("secret injected"));
  });
  await t.test("Kontomutationen bleiben revisionsgebunden und idempotent; Sperre entwertet Sitzungen", async () => {
    const body = { userId: id, action: "block", expectedRevision: 2, requestId: randomUUID() };
    assert.equal((await n.call("/api/account/admin/account-action", body)).status, 200);
    assert.equal((await n.call("/api/account/admin/account-action", body)).status, 200);
    assert.equal((await n.call("/api/account/admin/account-action", { ...body, requestId: randomUUID() })).status, 409);
    for (const p of paths) assert.equal((await a.call(`/api/account/admin-overview${p}`)).status, 401);
    assert.equal((await n.call("/api/account/admin/account-action", { userId: id, action: "unblock", expectedRevision: 3, requestId: randomUUID() })).status, 200);
    assert.equal((await a.call("/api/account")).status, 401);
    assert.equal((await n.call("/api/account/admin/account-action", { userId: w.data.userId, action: "activate", expectedRevision: 1, requestId: randomUUID() })).status, 200);
  });
  await t.test("Einladung widerrufen, erneuern und Verwaltungsverlauf paginieren", async () => {
    const i = await n.call("/api/account/admin/invitations", { email: "invited-a1@example.test", name: "Invited", requestId: randomUUID() });
    assert.equal(i.status, 201);
    const accountId = i.data.userId;
    const before = (await auth.localMails("invited-a1@example.test")).findLast(m => m.purpose === "invitation")!;
    assert.equal((await n.call("/api/account/admin/account-action", { userId: accountId, action: "revoke", expectedRevision: 1, requestId: randomUUID() })).status, 200);
    const guest = new Session();
    assert.equal((await guest.call("/api/auth/sign-up/email", { email: "invited-a1@example.test", password, invitationToken: new URL(before.url).searchParams.get("token") })).status, 403);
    assert.equal((await n.call("/api/account/admin/account-action", { userId: accountId, action: "resend", expectedRevision: (await n.call("/api/account/admin/accounts")).data.accounts.find((row: { userId: string }) => row.userId === accountId).revision, requestId: randomUUID() })).status, 200);
    const after = (await auth.localMails("invited-a1@example.test")).findLast(m => m.purpose === "invitation")!; assert.notEqual(after.url, before.url);
    const page = await n.call(`/api/account/admin-overview?view=audit&userId=${accountId}&limit=1`); assert.ok(page.data.nextCursor); assert.ok(page.data.items[0].actorLabel);
    const next = await n.call(`/api/account/admin-overview?view=audit&userId=${accountId}&limit=1&cursor=${encodeURIComponent(page.data.nextCursor)}`);
    assert.equal(next.status, 200); assert.notEqual(next.data.items[0].id, page.data.items[0].id);
  });
  await t.test("Fremde Origin bleibt geschlossen und Anfragelimit greift", async () => {
    const headers = n.headers(); headers.set("sec-fetch-site", "cross-site");
    assert.equal((await adminHTTP(new Request(`${auth.baseURL}/api/account/admin-overview`, { headers }), admin)).status, 403);
    const who = await auth.principal(n.headers(), "admin");
    await repository.database.pool.query("UPDATE stex.auth_limits SET count=120 WHERE key=$1", [(await import("../src/lib/server/auth/security")).tokenHash(`admin-overview:${who.userId}`)]);
    assert.equal((await n.call("/api/account/admin-overview")).status, 429);
    await repository.database.pool.query("DELETE FROM stex.auth_limits");
  });
  await t.test("Sperre zwischen Principal und Datenabfrage wird erneut geprüft", async () => {
    const original = auth.principal.bind(auth);
    auth.principal = async (...args) => { const who = await original(...args); await repository.database.pool.query("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [bootstrap.userId]); return who; };
    try { assert.equal((await n.call("/api/account/admin-overview?view=imports")).status, 401); }
    finally { auth.principal = original; await repository.database.pool.query("UPDATE stex.accounts SET status='active' WHERE user_id=$1", [bootstrap.userId]); }
  });
  await t.test("Abgelaufene frische Anmeldung erlaubt Lesen, aber keine neue Kontoaktion", async () => {
    await repository.database.pool.query(`UPDATE public.stex_auth_session SET "createdAt"=now()-interval '11 minutes',"factorVerifiedAt"=now()-interval '11 minutes' WHERE "userId"=(SELECT auth_user_id FROM stex.auth_identities WHERE user_id=$1)`, [bootstrap.userId]);
    assert.equal((await n.call("/api/account/admin-overview")).status, 200);
    assert.equal((await n.call("/api/account/admin/invitations", { email: "expired@example.test", name: "Expired", requestId: randomUUID() })).status, 401);
  });
});
