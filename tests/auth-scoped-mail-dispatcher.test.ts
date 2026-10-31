import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { PoolClient } from "pg";
import type { Database } from "../src/lib/server/persistence/database";
import { MailDispatcher, readScopedMailDispatchScope, type MailDispatcherOptions,
  type ScopedMailDispatchScope, type ScopedMailDispatchResult } from "../src/lib/server/auth/mail-dispatcher";
import { seal, tokenHash } from "../src/lib/server/auth/security";
import type { MailTransport, MailTransportResult, DispatchMail } from "../src/lib/server/auth/mail-transport";
import { runScopedMailDispatch, type ScopedMailDispatchBindings } from "../scripts/auth/scoped-mail-dispatch.mjs";

// Only instrumented transactions/transports. No Pool, socket, DNS, SMTP or real secrets.
const baseURL = "https://scoped.example.test", cutoff = "2026-10-27T12:00:00.000Z";
const material = (label: string) => createHash("sha256").update(`scoped-fixture:${label}`).digest("base64url");
const mailKey = material("mail"), privateMarker = "synthetic-private-provider-error";
const scope = (binding: ScopedMailDispatchScope["binding"] = { kind: "pilot", recipient: "one@example.test" },
  purpose: DispatchMail["purpose"] = "invitation"): ScopedMailDispatchScope => ({ mode: "scoped", activationCutoff: cutoff, purpose, binding });
interface Row {
  id: string; email: string; purpose: DispatchMail["purpose"]; sealed: string; created_at: Date; expires_at: Date;
  dispatch_status: string; dispatch_attempts: number; claim_token: string | null; last_error_code?: string | null;
}
function row(id = "one", purpose: DispatchMail["purpose"] = "invitation", email = "one@example.test"): Row {
  const url = purpose === "invitation" ? `${baseURL}/konto/einrichten?token=scope-token&email=${encodeURIComponent(email)}`
    : purpose === "verification" ? `${baseURL}/api/auth/verify-email?token=scope-token&callbackURL=%2Fkonto`
      : `${baseURL}/api/auth/reset-password/scope-token?callbackURL=%2Fkonto`;
  return { id, email, purpose, sealed: seal(url, mailKey), created_at: new Date(cutoff), expires_at: new Date(Date.now() + 60_000),
    dispatch_status: "pending", dispatch_attempts: 0, claim_token: null };
}
function harness(rows: Row[] = [row()], transportResult: MailTransportResult = { outcome: "accepted" }) {
  const queries: { sql: string; params: unknown[] }[] = [], sent: DispatchMail[] = [];
  const controls = { proof: "valid", fenceStart: false, fenceFinish: false, throwQuery: false, mutateScope: false };
  let closes = 0;
  const matchesScope = (candidate: Row, params: unknown[], attempts: number) => candidate.created_at >= new Date(params[2] as string)
    && candidate.dispatch_attempts === attempts && candidate.purpose === params[3]
    && (params[4] === null || candidate.id === params[4]) && (params[5] === null || candidate.email === params[5]);
  const client = { async query(sql: string, params: unknown[] = []) {
    queries.push({ sql, params });
    if (controls.throwQuery) throw new Error(privateMarker);
    const result = (selected: unknown[] = [], count = selected.length) => ({ rows: selected, rowCount: count });
    if (sql.startsWith("SET LOCAL")) return result();
    assert.ok(!sql.includes("WITH stale"), "scoped must never call global recovery");
    if (sql.includes("WITH candidate AS")) {
      assert.match(sql, /WHERE dispatch_status='pending'\s+AND created_at >= \$3::timestamptz AND dispatch_attempts=0/);
      assert.match(sql, /purpose IN \('invitation','verification','reset'\) AND purpose=\$4/);
      assert.match(sql, /\(\$5::text IS NULL OR id=\$5\) AND \(\$6::text IS NULL OR email=\$6\)/);
      assert.match(sql, /next_attempt_at<=statement_timestamp\(\)/);
      assert.match(sql, /FOR UPDATE SKIP LOCKED LIMIT 1/);
      assert.equal(params.length, 6);
      const selected = rows.find(candidate => candidate.dispatch_status === "pending" && matchesScope(candidate, params, 0));
      if (!selected) return result();
      selected.dispatch_attempts++; selected.claim_token = params[0] as string;
      selected.dispatch_status = selected.expires_at.getTime() <= Date.now() ? "expired" : "claimed";
      return result([{ ...selected }]);
    }
    if (sql.includes("SELECT * FROM stex.auth_mail_outbox")) {
      assert.match(sql, /id=\$1 AND claim_token=\$2 AND dispatch_status='claimed' AND lease_until>clock_timestamp\(\)/);
      assert.match(sql, /created_at >= \$3::timestamptz AND dispatch_attempts=1/);
      assert.match(sql, /purpose IN \('invitation','verification','reset'\) AND purpose=\$4/);
      assert.match(sql, /\(\$5::text IS NULL OR id=\$5\) AND \(\$6::text IS NULL OR email=\$6\)/);
      const selected = rows.find(candidate => candidate.id === params[0] && candidate.claim_token === params[1]);
      if (selected && controls.mutateScope) selected.created_at = new Date("2026-10-26T00:00:00Z");
      return result(selected && !controls.fenceStart && selected.dispatch_status === "claimed" && matchesScope(selected, params, 1) ? [{ ...selected }] : []);
    }
    if (sql.includes(" AS ms")) return result([{ ms: (params[0] as Date).getTime() - Date.now() }]);
    if (sql.includes("SELECT v.expires_at")) {
      assert.equal(params[1], tokenHash("scope-token"));
      return result(controls.proof === "missing" ? [] : [{ expires_at: new Date(Date.now() + 60_000),
        expired: controls.proof === "expired", consumed_at: controls.proof === "invalid" ? new Date() : null,
        revoked_at: null, status: "pending" }]);
    }
    if (sql.includes('SELECT u.id,u."emailVerified"')) return result([{ id: "auth-user", emailVerified: controls.proof === "verified",
      stexAccountId: "account", invitationId: "invitation", user_id: controls.proof === "waiting" ? null : "account",
      status: controls.proof === "blocked" ? "blocked" : "pending" }]);
    if (sql.includes("FROM stex.auth_email_tokens") || sql.includes("FROM public.stex_auth_verification")) {
      return result(controls.proof === "missing" ? [] : [{ expires_at: new Date(Date.now() + 60_000), expired: controls.proof === "expired" }]);
    }
    if (sql.includes("SELECT 1 FROM stex.account_invitations")) return result([{}]);
    if (sql.includes("SET dispatch_status='sending'")) {
      const selected = rows.find(candidate => candidate.id === params[0] && candidate.claim_token === params[1] && candidate.dispatch_status === "claimed");
      if (!selected) return result();
      selected.dispatch_status = "sending"; return result([{ remaining: 60_000 }]);
    }
    if (sql.includes("SET dispatch_status=$4")) {
      assert.match(sql, /id=\$1 AND claim_token=\$2 AND dispatch_status=\$3 AND lease_until>clock_timestamp\(\)/);
      const selected = rows.find(candidate => candidate.id === params[0] && candidate.claim_token === params[1] && candidate.dispatch_status === params[2]);
      if (!selected || controls.fenceFinish) return result();
      selected.dispatch_status = params[3] as string; selected.last_error_code = params[4] as string | null; selected.claim_token = null;
      return result([], 1);
    }
    throw new Error("Unexpected instrumented SQL");
  } };
  const database = { transaction: async <T>(work: (value: PoolClient) => Promise<T>) => work(client as unknown as PoolClient),
    close: async () => { closes++; } } as unknown as Database;
  const transport: MailTransport = { async send(mail) { sent.push(mail); return transportResult; } };
  const worker = (extra: Partial<MailDispatcherOptions> = {}) => new MailDispatcher({ database, baseURL, mailKey, transport, scope: scope(), ...extra });
  return { rows, queries, controls, sent, database, transport, worker, closes: () => closes };
}

test("scope: missing/invalid UTC, purpose, binding and widening batch rejected before resources", () => {
  const h = harness();
  const invalid = [null, {}, { ...scope(), mode: "generic" }, { ...scope(), activationCutoff: undefined },
    ...["2026-02-30T12:00:00Z", "2026-10-27T13:00:00+01:00", "2026-10-27", "2026-10-27T12:00:00Z ", "0000-01-01T00:00:00Z"].map(value => ({ ...scope(), activationCutoff: value })),
    { ...scope(), purpose: "newsletter" }, { ...scope(), binding: { kind: "request", outboxId: "x", recipient: "one@example.test" } },
    { ...scope(), binding: { kind: "request", outboxId: "x OR true" } },
    { ...scope(), binding: { kind: "pilot", recipient: "One@example.test" } },
    { ...scope(), binding: { kind: "pilot", recipient: "one@example.test,two@example.test" } }, { ...scope(), extra: true }];
  for (const value of invalid) assert.throws(() => h.worker({ scope: value as ScopedMailDispatchScope }));
  assert.throws(() => h.worker({ batchSize: 2 }));
  assert.equal(h.queries.length + h.sent.length, 0);
  assert.equal(readScopedMailDispatchScope({ ...scope(), activationCutoff: "2026-10-27T12:00:00Z" }).activationCutoff, cutoff);
});

test("SQL cutoff inclusive, purpose, first attempt and recipient applied before claim; old rows untouched/uncounted", async () => {
  const old = { ...row("old"), created_at: new Date("2026-10-27T11:59:59.999Z") };
  const attempted = { ...row("attempted"), dispatch_attempts: 1 };
  const claimed = { ...row("claimed"), dispatch_status: "claimed", dispatch_attempts: 1, claim_token: "stale" };
  const otherPurpose = row("reset", "reset"), otherRecipient = row("other", "invitation", "two@example.test");
  const untouched = [old, attempted, claimed, otherPurpose, otherRecipient], before = structuredClone(untouched);
  const h = harness([...untouched, row(), row("second")]);
  const result = await h.worker().dispatchScopedOnce();
  assert.equal(result.outcome, "accepted"); assert.equal(result.counts?.claimed, 1); assert.equal(result.counts?.recovered, 0);
  assert.equal(h.sent.length, 1); assert.equal(h.rows.at(-1)?.dispatch_attempts, 0);
  assert.deepEqual(untouched, before);
  assert.equal(h.queries.filter(query => query.sql.includes("WITH candidate AS")).length, 1);
});

test("request binding exact, copied/frozen scope and explicit scoped entry only", async () => {
  const selected = scope({ kind: "request", outboxId: "chosen" });
  const h = harness([row("other"), row("chosen")]), worker = h.worker({ scope: selected });
  selected.activationCutoff = "2020-01-01T00:00:00Z";
  selected.binding = { kind: "request", outboxId: "other" };
  const wrongEntry = h.worker();
  await assert.rejects(wrongEntry.dispatchBatch());
  assert.equal((await wrongEntry.dispatchScopedOnce()).outcome, "blocked");
  assert.equal(h.queries.length, 0);
  assert.equal((await worker.dispatchScopedOnce()).outcome, "accepted");
  assert.equal(h.sent[0].id, "chosen");
  const generic = h.worker({ scope: undefined });
  await assert.rejects(generic.dispatchScopedOnce());
});

test("all three purposes reuse recipient/proof validation; pilot max one recipient", async () => {
  for (const purpose of ["invitation", "verification", "reset"] as const) {
    const h = harness([row("one", purpose)]);
    assert.equal((await h.worker({ scope: scope(undefined, purpose) }).dispatchScopedOnce()).outcome, "accepted");
    assert.equal(h.sent[0].purpose, purpose);
  }
});

test("empty selection idle without writes or recovery", async () => {
  const h = harness([]), result = await h.worker().dispatchScopedOnce();
  assert.equal(result.outcome, "idle"); assert.equal(result.counts?.claimed, 0); assert.equal(h.sent.length, 0);
});

test("proof expiry/invalid/blocked/waiting and malformed links stop without transport or retry", async () => {
  for (const state of ["invalid", "missing", "expired", "blocked", "verified", "waiting", "malformed"] as const) {
    const purpose = ["blocked", "verified", "waiting"].includes(state) ? "verification" : "invitation";
    const h = harness([row("one", purpose)]); h.controls.proof = state;
    if (state === "malformed") h.rows[0].sealed = seal(`${baseURL}/konto/einrichten?token=scope-token&email=two%40example.test`, mailKey);
    const worker = h.worker({ scope: scope(undefined, purpose) }), result = await worker.dispatchScopedOnce();
    assert.equal(result.outcome, "blocked", state); assert.equal(h.sent.length, 0, state);
    assert.notEqual(h.rows[0].dispatch_status, "pending", state);
    const calls = h.queries.length;
    assert.equal((await worker.dispatchScopedOnce()).outcome, "blocked"); assert.equal(h.queries.length, calls);
  }
});

test("start scope and finish claim/lease fences block; no recovery", async () => {
  for (const control of ["fenceStart", "mutateScope", "fenceFinish"] as const) {
    const h = harness(); h.controls[control] = true;
    const worker = h.worker(), result = await worker.dispatchScopedOnce();
    assert.equal(result.outcome, "blocked"); assert.equal(result.counts?.fenced, 1);
    assert.equal(h.sent.length, control === "fenceFinish" ? 1 : 0);
    const calls = h.queries.length; await worker.dispatchScopedOnce(); assert.equal(h.queries.length, calls);
  }
});

test("temporary/rejected/unknown outcomes stop first attempt; no pending retry", async () => {
  for (const outcome of [{ outcome: "not_accepted", retryable: true }, { outcome: "not_accepted", retryable: false }, { outcome: "unknown" }] as const) {
    const h = harness([row()], outcome), worker = h.worker();
    assert.equal((await worker.dispatchScopedOnce()).outcome, "blocked");
    assert.equal(h.rows[0].dispatch_attempts, 1); assert.notEqual(h.rows[0].dispatch_status, "pending");
    const calls = h.queries.length; await worker.dispatchScopedOnce(); assert.equal(h.queries.length, calls);
  }
});

test("timeout and concurrent invocation fence further starts, including noncooperative transport", async () => {
  const h = harness(); let signal: AbortSignal | undefined;
  const worker = h.worker({ timeoutMs: 10, leaseMs: 1000, transport: { send: async (_mail, value) => { signal = value; return new Promise(() => {}); } } });
  const timed = await worker.dispatchScopedOnce();
  assert.equal(timed.outcome, "blocked"); assert.equal(timed.counts?.uncertain, 1); assert.equal(signal?.aborted, true);
  const calls = h.queries.length; await worker.dispatchScopedOnce(); assert.equal(h.queries.length, calls);
  const h2 = harness(); let release!: (value: MailTransportResult) => void, entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const concurrent = h2.worker({ transport: { send: async () => { entered(); return new Promise(resolve => { release = resolve; }); } } });
  const first = concurrent.dispatchScopedOnce(); await ready;
  assert.equal((await concurrent.dispatchScopedOnce()).outcome, "blocked"); release({ outcome: "accepted" });
  assert.equal((await first).outcome, "blocked");
});

test("DB/transport exceptions return only fixed aggregate blocked result", async () => {
  const h = harness(); h.controls.throwQuery = true;
  const result = await h.worker().dispatchScopedOnce();
  assert.deepEqual(result, { outcome: "blocked", counts: null }); assert.ok(!JSON.stringify(result).includes(privateMarker));
  const h2 = harness();
  assert.equal((await h2.worker({ transport: { send: async () => { throw new Error(privateMarker); } } }).dispatchScopedOnce()).outcome, "blocked");
});

function environment() {
  return { NODE_ENV: "production", STEX_AUTH_MODE: "production", BETTER_AUTH_URL: baseURL,
    DATABASE_URL: `postgres://stex:${material("db")}@postgres.example.test:5432/scoped`, STEX_DATABASE_TLS: "verify-full",
    STEX_PRIVATE_FILE_ROOT: "/srv/scoped/files", BETTER_AUTH_SECRET: material("auth"), STEX_AUTH_MAIL_KEY: mailKey,
    STEX_SMTP_HOST: "smtp.example.test", STEX_SMTP_PORT: "587", STEX_SMTP_TLS: "starttls", STEX_SMTP_USER: "apikey",
    STEX_SMTP_PASSWORD: material("smtp"), STEX_SMTP_FROM_ADDRESS: "system@example.test", STEX_SMTP_FROM_NAME: "Fixture",
    STEX_AUTHMAIL_SCOPE_MODE: "scoped", STEX_AUTHMAIL_ACTIVATION_CUTOFF: cutoff, STEX_AUTHMAIL_PURPOSE: "invitation",
    STEX_AUTHMAIL_BINDING: "request", STEX_AUTHMAIL_OUTBOX_ID: "one" } as Record<string, string | undefined>;
}
function cliHarness() {
  const h = harness(), output: string[] = [], events: string[] = [];
  let options: MailDispatcherOptions | undefined;
  const deps: ScopedMailDispatchBindings = {
    persistence: (async () => { events.push("database"); return { database: h.database }; }) as ScopedMailDispatchBindings["persistence"],
    transport: () => { events.push("transport"); return h.transport; },
    dispatcher: value => { options = value; return new MailDispatcher(value); },
    gate: { assertStartAllowed: async () => { events.push("gate"); }, blockFurtherStarts: async () => { events.push("block"); } },
    output: value => output.push(value),
  };
  return { ...h, deps, output, events, options: () => options };
}
test("CLI once requires durable gate before resources and exposes only aggregate output", async () => {
  const h = cliHarness(), result = await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", h.deps);
  assert.equal(result.outcome, "accepted"); assert.equal(result.mustBlockFurtherStarts, false);
  assert.deepEqual(h.events, ["gate", "transport", "database"]); assert.equal(h.closes(), 1);
  assert.equal(h.options()?.batchSize, 1); assert.equal(h.options()?.scope?.binding.kind, "request");
  const text = h.output.join();
  for (const value of ["one@example.test", "scope-token", baseURL, mailKey, material("smtp")]) assert.ok(!text.includes(value));
  assert.deepEqual(Object.keys(JSON.parse(text)).sort(), ["counts", "mustBlockFurtherStarts", "outcome"]);
});

test("CLI invalid mode/cutoff/binding/options/config and denied/missing gate never reach resources", async () => {
  const variants = [{ STEX_AUTHMAIL_ACTIVATION_CUTOFF: undefined }, { STEX_AUTHMAIL_SCOPE_MODE: undefined },
    { STEX_AUTHMAIL_BINDING: "all" }, { STEX_AUTHMAIL_PILOT_RECIPIENT: "" }, { STEX_SMTP_TLS: "none" }];
  for (const patch of variants) {
    const h = cliHarness();
    const result = await runScopedMailDispatch(["once"], { ...environment(), ...patch }, "/srv/scoped/app", h.deps);
    assert.equal(result.mustBlockFurtherStarts, true); assert.ok(!h.events.includes("database")); assert.ok(!h.events.includes("transport"));
    assert.ok(h.events.includes("block"));
  }
  for (const argv of [[], ["watch"], ["once", "--retry"], ["once", "--recover"]]) {
    const h = cliHarness(); assert.equal((await runScopedMailDispatch(argv, environment(), "/srv/scoped/app", h.deps)).outcome, "blocked");
    assert.deepEqual(h.events, ["block"]);
  }
  const absent = cliHarness(); absent.deps.gate = undefined;
  assert.equal((await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", absent.deps)).outcome, "blocked"); assert.deepEqual(absent.events, []);
  const denied = cliHarness(); denied.deps.gate!.assertStartAllowed = async () => { throw new Error(privateMarker); };
  assert.equal((await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", denied.deps)).outcome, "blocked");
  assert.deepEqual(denied.events, ["block"]);
});

test("CLI all negative outcomes and deferred/fenced/timeout equivalents invoke persistent stop callback", async () => {
  for (const key of ["deferred", "failed", "cancelled", "expired", "uncertain", "fenced"] as const) {
    const h = cliHarness(), counts = { claimed: 1, recovered: 0, sent: 0, deferred: 0, failed: 0, cancelled: 0, expired: 0, uncertain: 0, fenced: 0, [key]: 1 };
    h.deps.dispatcher = () => ({ dispatchScopedOnce: async () => ({ outcome: "blocked", counts }) });
    const result = await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", h.deps);
    assert.equal(result.mustBlockFurtherStarts, true); assert.equal(h.events.at(-1), "block"); assert.equal(h.closes(), 1);
  }
});

test("CLI malformed results/cleanup/output/gate failures fail closed and never serialize payloads", async () => {
  const valid = { claimed: 1, recovered: 0, sent: 1, deferred: 0, failed: 0, cancelled: 0, expired: 0, uncertain: 0, fenced: 0 };
  for (const value of [{ outcome: "accepted", counts: { ...valid, claimed: 2 } }, { outcome: "accepted", counts: { ...valid, recovered: 1 } },
    { outcome: "idle", counts: valid }, { outcome: "accepted", counts: null }]) {
    const h = cliHarness(); h.deps.dispatcher = () => ({ dispatchScopedOnce: async () => value as ScopedMailDispatchResult });
    assert.equal((await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", h.deps)).outcome, "blocked");
    assert.ok(h.events.includes("block"));
  }
  const extras = cliHarness(); extras.deps.dispatcher = () => ({ dispatchScopedOnce: async () => ({ outcome: "accepted", counts: { ...valid, secret: privateMarker }, email: privateMarker }) });
  assert.equal((await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", extras.deps)).outcome, "accepted");
  assert.ok(!extras.output.join().includes(privateMarker));
  const close = cliHarness(); close.database.close = async () => { throw new Error(privateMarker); };
  const closed = await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", close.deps);
  assert.equal(closed.outcome, "blocked"); assert.equal(closed.counts?.sent, 1); assert.ok(close.events.includes("block"));
  const broken = cliHarness(); broken.controls.throwQuery = true;
  broken.deps.gate!.blockFurtherStarts = async () => { throw new Error(privateMarker); };
  assert.equal((await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", broken.deps)).mustBlockFurtherStarts, true);
  assert.ok(!broken.output.join().includes(privateMarker));
  const output = cliHarness(); output.deps.output = () => { throw new Error(privateMarker); };
  assert.equal((await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", output.deps)).outcome, "blocked");
  assert.ok(output.events.includes("block"));
});

test("existing generic CLI remains byte-identical; no previous suites invoked", async () => {
  const content = await readFile("scripts/auth/mail-dispatch.mts");
  assert.equal(createHash("sha256").update(content).digest("hex"), "d057371711ba2bd7bea1f32ecc6101fdbff2a102d498514ea105a9c1bc3445b6");
});

test("request binding also rejects a non-single mailbox; expired outbox stops without transport", async () => {
  const malformed = harness([row("one", "invitation", "one,two@example.test")]);
  const requestScope = scope({ kind: "request", outboxId: "one" });
  assert.equal((await malformed.worker({ scope: requestScope }).dispatchScopedOnce()).outcome, "blocked");
  assert.equal(malformed.sent.length, 0); assert.equal(malformed.rows[0].last_error_code, "invalid_message");
  const expired = harness(); expired.rows[0].expires_at = new Date(Date.now() - 1000);
  const result = await expired.worker().dispatchScopedOnce();
  assert.equal(result.outcome, "blocked"); assert.equal(result.counts?.expired, 1); assert.equal(expired.sent.length, 0);
});

test("operator stop callback blocks a later invocation with a fresh dispatcher before any resources", async () => {
  const h = cliHarness(); let stopped = false;
  h.deps.gate = { assertStartAllowed: async () => { if (stopped) throw new Error(privateMarker); },
    blockFurtherStarts: async () => { stopped = true; } };
  h.deps.transport = () => ({ send: async () => ({ outcome: "not_accepted", retryable: true }) });
  assert.equal((await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", h.deps)).mustBlockFurtherStarts, true);
  const calls = h.queries.length, events = h.events.length;
  assert.equal((await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", h.deps)).mustBlockFurtherStarts, true);
  assert.equal(h.queries.length, calls); assert.equal(h.events.length, events); assert.equal(h.closes(), 1);
});

test("blocking result/exception reaches operator gate before connection cleanup", async () => {
  for (const throws of [false, true]) {
    const h = cliHarness(), order: string[] = [];
    h.deps.gate!.blockFurtherStarts = async () => { order.push("block"); };
    h.database.close = async () => { order.push("close"); };
    h.deps.dispatcher = () => ({ dispatchScopedOnce: async () => {
      if (throws) throw new Error(privateMarker);
      return { outcome: "blocked", counts: null };
    } });
    assert.equal((await runScopedMailDispatch(["once"], environment(), "/srv/scoped/app", h.deps)).outcome, "blocked");
    assert.deepEqual(order, ["block", "close"]);
  }
});
