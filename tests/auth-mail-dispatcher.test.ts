import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { PoolClient } from "pg";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import { MailDispatcher } from "../src/lib/server/auth/mail-dispatcher";
import { createMemoryMailSink, type MailTransport } from "../src/lib/server/auth/mail-transport";
import { AccountService } from "../src/lib/server/auth/service";
import { seal, tokenHash, unseal } from "../src/lib/server/auth/security";
import { backup, restore } from "../src/lib/server/persistence/backup";

const baseURL = "https://pilot.example.test";
const mailKey = randomBytes(32).toString("hex");
const secret = randomBytes(32).toString("hex");
const protection = { encryptionKey: randomBytes(32).toString("hex"), authSecret: secret };
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test("AUTH03: begrenzter PostgreSQL-Outboxdispatcher, nur künstliche Transporte", { timeout: 120_000 }, async t => {
  const runtime = await testRuntime();
  const root = runtime.root;
  t.after(async () => {
    await runtime.close();
    await assert.rejects(stat(root), { code: "ENOENT" });
  });
  const repository = await runtime.repository("mail_dispatch");
  const database = repository.database;
  const query = database.pool.query.bind(database.pool);
  const service = new AccountService({ database, baseURL, secret, mailKey });
  const dispatcher = (transport: MailTransport = createMemoryMailSink(), extra = {}) =>
    new MailDispatcher({ database, baseURL, mailKey, transport, ...extra });
  const clear = () => query("DELETE FROM stex.auth_mail_outbox");
  const row = async (id: string) => (await query("SELECT * FROM stex.auth_mail_outbox WHERE id=$1", [id])).rows[0];
  const ready = (id: string) => query("UPDATE stex.auth_mail_outbox SET next_attempt_at=now()-interval '1 second' WHERE id=$1", [id]);
  async function invitation(client?: PoolClient) {
    const executor = client ?? database.pool;
    const userId = randomUUID(), invitationId = randomUUID(), id = randomUUID();
    const email = `${userId}@example.test`, token = randomBytes(32).toString("base64url");
    const url = `${baseURL}/konto/einrichten?token=${token}&email=${email}`;
    await executor.query("INSERT INTO stex.accounts(user_id,status,role,revision) VALUES($1,'pending','member',1)", [userId]);
    await executor.query(`INSERT INTO stex.account_invitations(id,user_id,email,name,token_hash,expires_at)
      VALUES($1,$2,$3,'Künstliches Konto',$4,now()+interval '7 days')`, [invitationId, userId, email, tokenHash(token)]);
    await executor.query(`INSERT INTO stex.auth_mail_outbox(id,email,purpose,sealed,expires_at)
      VALUES($1,$2,'invitation',$3,now()+interval '24 hours')`, [id, email, seal(url, mailKey)]);
    return { id, userId, invitationId, email, token, url };
  }
  async function identity(purpose: "verification" | "reset", linked = true) {
    const value = await invitation();
    await query("DELETE FROM stex.auth_mail_outbox WHERE id=$1", [value.id]);
    const identityId = randomUUID();
    await query(`INSERT INTO public.stex_auth_user(id,name,email,"emailVerified","createdAt","updatedAt","stexAccountId","invitationId")
      VALUES($1,'Künstliches Konto',$2,$3,now(),now(),$4,$5)`, [identityId, value.email, purpose === "reset", value.userId, value.invitationId]);
    if (linked) {
      await query("INSERT INTO stex.auth_identities VALUES($1,$2)", [value.userId, identityId]);
      await query("UPDATE stex.account_invitations SET consumed_at=now() WHERE id=$1", [value.invitationId]);
    }
    const token = randomBytes(24).toString("base64url");
    const url = purpose === "verification" ? `${baseURL}/api/auth/verify-email?token=${token}&callbackURL=%2Fkonto`
      : `${baseURL}/api/auth/reset-password/${token}?callbackURL=%2Fkonto`;
    if (purpose === "verification") await query("INSERT INTO stex.auth_email_tokens VALUES($1,$2,now()+interval '1 hour')", [tokenHash(token), value.email]);
    else await query(`INSERT INTO public.stex_auth_verification(id,identifier,value,"expiresAt","createdAt","updatedAt")
      VALUES($1,$2,$3,now()+interval '1 hour',now(),now())`, [randomUUID(), `reset-password:${token}`, identityId]);
    await query(`INSERT INTO stex.auth_mail_outbox(id,email,purpose,sealed,expires_at) VALUES($1,$2,$3,$4,now()+interval '24 hours')`,
      [value.id, value.email, purpose, seal(url, mailKey)]);
    return { ...value, identityId, token, url };
  }

  await t.test("016: vorhandene 015-Outbox additiv übernehmen, Constraints und wiederholte Migration", async () => {
    const migrations = join(root, "through-015");
    await mkdir(migrations);
    for (const file of (await readdir("db/migrations")).filter(name => /^(00|01[0-5])/.test(name))) {
      await cp(join("db/migrations", file), join(migrations, file));
    }
    const old = await runtime.repository("mail_upgrade");
    // Fresh isolated DB, recreate precisely the already supported 001–015 state.
    await old.database.pool.query("DROP SCHEMA stex CASCADE");
    await old.database.pool.query("DROP TABLE public.stex_auth_user,public.stex_auth_account,public.stex_auth_session,public.stex_auth_verification,public.stex_auth_two_factor CASCADE");
    await old.database.migrate(migrations);
    await old.database.pool.query(`INSERT INTO stex.auth_mail_outbox(id,email,purpose,sealed,expires_at)
      VALUES('upgrade','upgrade@example.test','invitation',$1,now()+interval '1 day')`, [seal("synthetic", mailKey)]);
    await old.database.migrate();
    const upgraded = (await old.database.pool.query("SELECT * FROM stex.auth_mail_outbox")).rows[0];
    assert.equal(upgraded.dispatch_status, "pending"); assert.equal(upgraded.dispatch_attempts, 0);
    assert.equal(upgraded.claim_token, null); assert.equal(upgraded.sent_at, null);
    await old.database.migrate();
    assert.equal((await old.database.pool.query("SELECT count(*) FROM stex.schema_migrations")).rows[0].count, "16");
    for (const sql of ["dispatch_status='invalid'", "dispatch_attempts=6", "dispatch_attempts=-1", "dispatch_status='claimed'", "dispatch_status='sent'", "last_error_code='sensitive-provider-text'"]) {
      await assert.rejects(old.database.pool.query(`UPDATE stex.auth_mail_outbox SET ${sql}`), { code: "23514" });
    }
    await rm(migrations, { recursive: true });
  });

  await t.test("echter Service erzeugt kompatible Outbox; Sinkannahme bleibt von Postfachzustellung getrennt", async () => {
    await clear();
    await service.prepareAdmin("dispatch-admin@example.test", "Künstlicher Admin");
    const sink = createMemoryMailSink(), worker = dispatcher(sink);
    const result = await worker.dispatchBatch();
    assert.equal(result.sent, 1); assert.equal(sink.messages.length, 1);
    assert.equal(sink.messages[0].purpose, "invitation");
    const state = await row(sink.messages[0].id);
    assert.equal(state.dispatch_status, "sent"); assert.ok(state.sent_at); assert.equal(state.claim_token, null);
    assert.equal((await worker.dispatchBatch()).claimed, 0);
  });

  await t.test("Postcommit: offene Zeile unsichtbar, Rollback ohne Transport, Commit wird verarbeitet", async () => {
    await clear(); const sink = createMemoryMailSink(), worker = dispatcher(sink);
    const client = await database.pool.connect();
    try {
      await client.query("BEGIN"); await invitation(client);
      assert.equal((await worker.dispatchBatch()).claimed, 0);
      await client.query("ROLLBACK"); assert.equal((await worker.dispatchBatch()).claimed, 0);
      await client.query("BEGIN"); await invitation(client); await client.query("COMMIT");
      assert.equal((await worker.dispatchBatch()).sent, 1); assert.equal(sink.messages.length, 1);
    } finally { await client.query("ROLLBACK"); client.release(); }
  });

  await t.test("bestehender Authdienst: tatsächlich erzeugte Bestätigungs-/Resetlinks an Fake übergeben", async () => {
    await clear(); const value = await invitation(), sink = createMemoryMailSink();
    const request = (path: string, body: unknown) => service.authHTTP(new Request(`${baseURL}/api/auth${path}`, {
      method: "POST", headers: { origin: baseURL, "content-type": "application/json", "x-stex-action": "1" }, body: JSON.stringify(body),
    }));
    const registered = await request("/sign-up/email", { email: value.email, password: "Künstliches Passwort zur Mailprüfung 2026!", invitationToken: value.token });
    assert.equal(registered.status, 200);
    const confirmation = await dispatcher(sink).dispatchBatch();
    assert.equal(confirmation.sent, 1); assert.equal(confirmation.cancelled, 1);
    assert.equal(sink.messages[0].purpose, "verification");
    const reset = await request("/request-password-reset", { email: value.email, redirectTo: `${baseURL}/konto` });
    assert.equal(reset.status, 200);
    assert.equal((await dispatcher(sink).dispatchBatch()).sent, 1);
    assert.equal(sink.messages[1].purpose, "reset");
  });

  await t.test("zwei Dispatcher konkurrieren; Batch höchstens zehn, jeder Kandidat einmal", async () => {
    await clear(); for (let i = 0; i < 23; i++) await invitation();
    const sink = createMemoryMailSink();
    const reports = await Promise.all([dispatcher(sink).dispatchBatch(), dispatcher(sink).dispatchBatch()]);
    assert.equal(reports[0].claimed, 10); assert.equal(reports[1].claimed, 10);
    assert.equal(new Set(sink.messages.map(mail => mail.id)).size, 20);
    assert.equal((await dispatcher(sink).dispatchBatch()).sent, 3);
    assert.equal(sink.messages.length, 23);
  });

  await t.test("keine DBsperre im Transport; nachfolgender Widerruf, Tokenrotation und Kontosperre verhindern Versand", async () => {
    await clear(); const first = await invitation(), revoked = await invitation(), rotated = await invitation(), blocked = await invitation();
    // Deterministic first candidate; the other proofs change while fake send waits.
    await query("UPDATE stex.auth_mail_outbox SET next_attempt_at=now()-interval '1 minute' WHERE id=$1", [first.id]);
    const entered = latch(), release = latch(); let count = 0;
    const worker = dispatcher({ async send() { count++; entered.resolve(); await release.promise; return { outcome: "accepted" }; } });
    const batch = worker.dispatchBatch();
    try {
      await entered.promise;
      await assert.rejects(worker.dispatchBatch(), /beschäftigt/);
      const client = await database.pool.connect();
      try {
        await client.query("BEGIN"); await client.query("SET LOCAL lock_timeout='500ms'");
        await client.query("SELECT generation FROM stex.state WHERE singleton FOR UPDATE");
        await client.query("SELECT id FROM stex.auth_mail_outbox WHERE id=$1 FOR UPDATE NOWAIT", [first.id]);
        await client.query("UPDATE stex.account_invitations SET revoked_at=now() WHERE id=$1", [revoked.invitationId]);
        await client.query("UPDATE stex.account_invitations SET token_hash=$2 WHERE id=$1", [rotated.invitationId, tokenHash("rotated")]);
        await client.query("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [blocked.userId]);
        await client.query("COMMIT");
      } finally { await client.query("ROLLBACK"); client.release(); }
    } finally { release.resolve(); }
    const report = await batch; assert.equal(report.sent, 1); assert.equal(report.cancelled, 3); assert.equal(count, 1);
  });

  await t.test("Einladung verbraucht/abgelaufen und Outboxablauf: kein Transport", async () => {
    await clear(); const consumed = await invitation(), expired = await invitation(), outbox = await invitation();
    await query("UPDATE stex.account_invitations SET consumed_at=now() WHERE id=$1", [consumed.invitationId]);
    await query("UPDATE stex.account_invitations SET expires_at=now()-interval '1 second' WHERE id=$1", [expired.invitationId]);
    await query("UPDATE stex.auth_mail_outbox SET expires_at=now()-interval '1 second' WHERE id=$1", [outbox.id]);
    const sink = createMemoryMailSink(), report = await dispatcher(sink).dispatchBatch();
    assert.equal(report.cancelled, 1); assert.equal(report.expired, 2); assert.equal(sink.messages.length, 0);
  });

  await t.test("Bestätigung und Reset: aktuelle Registry/Identität, bestätigte oder gesperrte Konten", async () => {
    await clear(); await identity("verification"); await identity("reset");
    const verified = await identity("verification"), blocked = await identity("reset"), consumed = await identity("verification"), resetUsed = await identity("reset");
    await query('UPDATE public.stex_auth_user SET "emailVerified"=true WHERE id=$1', [verified.identityId]);
    await query("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [blocked.userId]);
    await query("DELETE FROM stex.auth_email_tokens WHERE token_hash=$1", [tokenHash(consumed.token)]);
    await query("DELETE FROM public.stex_auth_verification WHERE identifier=$1", [`reset-password:${resetUsed.token}`]);
    const sink = createMemoryMailSink(), report = await dispatcher(sink).dispatchBatch();
    assert.equal(report.sent, 2); assert.equal(report.cancelled, 4);
    assert.deepEqual(sink.messages.map(mail => mail.purpose).sort(), ["reset", "verification"]);
  });

  await t.test("Nachweise laufen früher als 24h-Outbox ab: Bestätigung/Reset werden nicht gesendet", async () => {
    await clear(); const verification = await identity("verification"), reset = await identity("reset");
    await query("UPDATE stex.auth_email_tokens SET expires_at=now()-interval '1 second' WHERE email=$1", [verification.email]);
    await query('UPDATE public.stex_auth_verification SET "expiresAt"=now()-interval \'1 second\' WHERE value=$1', [reset.identityId]);
    const sink = createMemoryMailSink(), report = await dispatcher(sink).dispatchBatch();
    assert.equal(report.expired, 2); assert.equal(sink.messages.length, 0);
  });

  await t.test("Bibliothekscommit vor Appzuordnung wartet begrenzt, danach normaler Versand", async () => {
    await clear(); const value = await identity("verification", false), sink = createMemoryMailSink();
    assert.equal((await dispatcher(sink).dispatchBatch()).deferred, 1);
    assert.equal((await row(value.id)).last_error_code, "proof_not_ready");
    await query("INSERT INTO stex.auth_identities VALUES($1,$2)", [value.userId, value.identityId]);
    await ready(value.id);
    assert.equal((await dispatcher(sink).dispatchBatch()).sent, 1); assert.equal(sink.messages.length, 1);
  });

  await t.test("fehlende Appzuordnung ohne offene passende Einladung wird verworfen", async () => {
    await clear(); const value = await identity("verification", false);
    await query("UPDATE stex.account_invitations SET revoked_at=now() WHERE id=$1", [value.invitationId]);
    const sink = createMemoryMailSink(); assert.equal((await dispatcher(sink).dispatchBatch()).cancelled, 1); assert.equal(sink.messages.length, 0);
  });

  await t.test("unfertige Appzuordnung wartet höchstens fünf Versuche", async () => {
    await clear(); const value = await identity("verification", false), sink = createMemoryMailSink();
    const worker = dispatcher(sink);
    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = await worker.dispatchBatch(); assert.equal(result.deferred, attempt < 5 ? 1 : 0);
      await ready(value.id);
    }
    assert.equal((await row(value.id)).dispatch_status, "failed"); assert.equal(sink.messages.length, 0);
  });

  await t.test("definitiv nicht angenommen: Backoff, höchstens fünf Versuche, kein Hotloop", async () => {
    await clear(); const value = await invitation(); let calls = 0;
    const worker = dispatcher({ async send() { calls++; return { outcome: "not_accepted", retryable: true }; } });
    for (let i = 1; i <= 5; i++) {
      const report = await worker.dispatchBatch();
      assert.equal(report.claimed, 1); assert.equal((await row(value.id)).dispatch_attempts, i);
      assert.equal(report.deferred, i < 5 ? 1 : 0);
      if (i < 5) {
        const next = await row(value.id); assert.ok(next.next_attempt_at.getTime() > Date.now() + 20_000);
        assert.equal((await worker.dispatchBatch()).claimed, 0); await ready(value.id);
      }
    }
    assert.equal(calls, 5); assert.equal((await row(value.id)).dispatch_status, "failed");
    assert.equal((await worker.dispatchBatch()).claimed, 0);
  });

  await t.test("endgültige Ablehnung, Exception und explizit unbekannter Ausgang bleiben ohne Wiederholung", async () => {
    for (const mode of ["reject", "throw", "unknown"]) {
      await clear(); const value = await invitation(); let calls = 0;
      const worker = dispatcher({ async send() {
        calls++; if (mode === "throw") throw new Error(`Sensitive ${value.url}`);
        return mode === "reject" ? { outcome: "not_accepted", retryable: false } : { outcome: "unknown" };
      } });
      const report = await worker.dispatchBatch(); assert.equal(report[mode === "reject" ? "failed" : "uncertain"], 1);
      assert.equal((await worker.dispatchBatch()).claimed, 0); assert.equal(calls, 1);
      assert.ok(!JSON.stringify(await row(value.id)).includes(value.url));
      assert.ok(!JSON.stringify(report).includes(value.email));
    }
  });

  await t.test("Timeout mit nicht kooperativem Transport: abort, unklar, keine wachsenden Altversuche", async () => {
    await clear(); const first = await invitation(); await invitation();
    const entered = latch(), release = latch(); let signal: AbortSignal | undefined;
    const worker = dispatcher({ async send(_mail, value) { signal = value; entered.resolve(); await release.promise; return { outcome: "accepted" }; } }, { timeoutMs: 30, leaseMs: 500 });
    try {
      const running = worker.dispatchBatch(); await entered.promise;
      const report = await running; assert.equal(report.uncertain, 1); assert.equal(report.claimed, 1); assert.equal(signal!.aborted, true);
      await assert.rejects(worker.dispatchBatch(), /beschäftigt/);
      assert.equal((await row(first.id)).dispatch_status, "uncertain");
    } finally { release.resolve(); }
  });

  await t.test("abgelaufener Claim vor Transport kann erneut versucht werden; sending nach Crash bleibt unklar", async () => {
    await clear(); const claimed = await invitation(), sending = await invitation(), exhausted = await invitation();
    for (const [value, status, attempts] of [[claimed, "claimed", 1], [sending, "sending", 1], [exhausted, "claimed", 5]] as const) {
      await query(`UPDATE stex.auth_mail_outbox SET dispatch_status=$2,dispatch_attempts=$3,claim_token=$4,
        lease_until=now()-interval '1 second' WHERE id=$1`, [value.id, status, attempts, randomUUID()]);
    }
    const sink = createMemoryMailSink(), worker = dispatcher(sink);
    assert.equal((await worker.dispatchBatch()).recovered, 3); assert.equal(sink.messages.length, 0);
    assert.equal((await row(sending.id)).dispatch_status, "uncertain");
    assert.equal((await row(exhausted.id)).dispatch_status, "failed");
    await ready(claimed.id); assert.equal((await worker.dispatchBatch()).sent, 1); assert.equal(sink.messages[0].id, claimed.id);
  });

  await t.test("Leaseverlust während Fakeannahme: spätes Ergebnis überschreibt Recovery nicht", async () => {
    await clear(); const value = await invitation(), entered = latch(), release = latch();
    const worker = dispatcher({ async send() { entered.resolve(); await release.promise; return { outcome: "accepted" }; } });
    const batch = worker.dispatchBatch();
    try {
      await entered.promise;
      await query("UPDATE stex.auth_mail_outbox SET lease_until=now()-interval '1 second' WHERE id=$1", [value.id]);
      const sink = createMemoryMailSink(); assert.equal((await dispatcher(sink).dispatchBatch()).recovered, 1); assert.equal(sink.messages.length, 0);
    } finally { release.resolve(); }
    assert.equal((await batch).fenced, 1); assert.equal((await row(value.id)).dispatch_status, "uncertain");
  });

  await t.test("veralteter Claim vor Sendebeginn bleibt durch UUID-Fence ausgesperrt", async () => {
    await clear(); const value = await invitation();
    // Test-only access to internal phase boundaries; all claims/state changes use real PostgreSQL.
    type ClaimAccess = {
      claim(): Promise<{ id: string; claim_token: string }>;
      start(claim: unknown): Promise<unknown>;
    };
    const oldWorker = dispatcher() as unknown as ClaimAccess;
    const stale = await oldWorker.claim();
    await query("UPDATE stex.auth_mail_outbox SET lease_until=now()-interval '1 second' WHERE id=$1", [value.id]);
    const sink = createMemoryMailSink(), current = dispatcher(sink);
    assert.equal((await current.dispatchBatch()).recovered, 1);
    await ready(value.id);
    assert.equal((await current.dispatchBatch()).sent, 1);
    assert.equal(await oldWorker.start(stale), "fenced");
    assert.equal(sink.messages.length, 1); assert.equal((await row(value.id)).dispatch_status, "sent");
  });

  await t.test("Zeile während Fake entfernt: kein Wiederanlegen/erneuter Versand, Abschluss fenced", async () => {
    await clear(); const value = await invitation();
    const report = await dispatcher({ async send() { await query("DELETE FROM stex.auth_mail_outbox WHERE id=$1", [value.id]); return { outcome: "accepted" }; } }).dispatchBatch();
    assert.equal(report.fenced, 1); assert.equal(await row(value.id), undefined);
  });

  await t.test("korrupte Verschlüsselung und fremde/mehrdeutige Links erreichen keinen Transport", async () => {
    await clear();
    const messages = ["https://other.example.test/konto/einrichten?token=x&email=x@example.test", `${baseURL}/api/ai?token=x`, `${baseURL}/konto/einrichten?token=x&token=y&email=x@example.test`, `${baseURL}/konto/einrichten?token=x&email=other@example.test`, "not-a-url"];
    for (const url of messages) { const value = await invitation(); await query("UPDATE stex.auth_mail_outbox SET sealed=$2 WHERE id=$1", [value.id, seal(url, mailKey)]); }
    const corrupted = await invitation(); await query("UPDATE stex.auth_mail_outbox SET sealed='invalid' WHERE id=$1", [corrupted.id]);
    const callback = await identity("verification"); await query("UPDATE stex.auth_mail_outbox SET sealed=$2 WHERE id=$1", [callback.id, seal(`${callback.url}&unexpected=1`, mailKey)]);
    const sink = createMemoryMailSink(); assert.equal((await dispatcher(sink).dispatchBatch()).failed, 7); assert.equal(sink.messages.length, 0);
    assert.deepEqual((await query("SELECT DISTINCT last_error_code FROM stex.auth_mail_outbox")).rows, [{ last_error_code: "invalid_message" }]);
  });

  await t.test("Konstruktor begrenzt Operatorwerte und feste Origin", () => {
    for (const extra of [{ batchSize: 11 }, { batchSize: 0 }, { batchSize: 1.2 }, { timeoutMs: 30_001 }, { leaseMs: 50 }, { leaseMs: 120_001 }, { baseURL: "http://remote.example.test" }, { baseURL: `${baseURL}/path` }]) {
      assert.throws(() => dispatcher(createMemoryMailSink(), extra), /Ungültig/);
    }
  });

  await t.test("Format4: alle Zustände/Spalten verschlüsselt sichern, Restore leert Outbox und widerruft Nachweise", async () => {
    await clear();
    for (const status of ["pending", "claimed", "sending", "sent", "failed", "cancelled", "expired", "uncertain"]) {
      const value = await invitation();
      await query(`UPDATE stex.auth_mail_outbox SET dispatch_status=$2,dispatch_attempts=1,
        claim_token=CASE WHEN $2 IN ('claimed','sending') THEN $3 ELSE NULL END,
        lease_until=CASE WHEN $2 IN ('claimed','sending') THEN now()+interval '1 minute' ELSE NULL END,
        sent_at=CASE WHEN $2='sent' THEN now() ELSE NULL END WHERE id=$1`, [value.id, status, randomUUID()]);
    }
    const folder = join(root, "mail-format4");
    await backup(database, repository.files, folder, protection);
    const envelope = JSON.parse(await readFile(join(folder, "manifest.json"), "utf8"));
    assert.equal(envelope.version, 4); assert.equal(envelope.format, "stex-postgres-encrypted");
    const manifest = JSON.parse(unseal(envelope.sealed, protection.encryptionKey)).manifest;
    assert.equal(manifest.rows.auth_mail_outbox.length, 8);
    assert.equal(Object.keys(manifest.rows.auth_mail_outbox[0]).length, 13);
    assert.equal(manifest.migrations.at(-1).name, "016_auth_mail_dispatch.sql");
    const target = await runtime.repository("mail_restore");
    await restore(target.database, target.files, folder, protection);
    assert.equal((await target.database.pool.query("SELECT count(*) FROM stex.auth_mail_outbox")).rows[0].count, "0");
    assert.equal((await target.database.pool.query("SELECT count(*) FROM stex.account_invitations WHERE consumed_at IS NULL AND revoked_at IS NULL")).rows[0].count, "0");
    const sink = createMemoryMailSink();
    assert.equal((await new MailDispatcher({ database: target.database, baseURL, mailKey, transport: sink }).dispatchBatch()).claimed, 0);
    assert.equal(sink.messages.length, 0);
    await rm(folder, { recursive: true });
  });
});
