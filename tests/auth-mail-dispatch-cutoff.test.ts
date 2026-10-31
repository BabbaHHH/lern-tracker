import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { PoolClient } from "pg";
import { MailDispatcher, readAuthMailActivationCutoff } from "../src/lib/server/auth/mail-dispatcher";
import type { Database } from "../src/lib/server/persistence/database";
import type { DispatchMail, MailTransportResult } from "../src/lib/server/auth/mail-transport";
import { seal, tokenHash } from "../src/lib/server/auth/security";

const baseURL = "https://cutoff.example.test";
const cutoff = "2026-10-28T09:00:00.000Z";
const mailKey = createHash("sha256").update("cutoff-only-synthetic-key").digest("base64url");
type Row = { id: string; email: string; purpose: "invitation"; sealed: string; created_at: Date; expires_at: Date;
  dispatch_status: string; dispatch_attempts: number; claim_token: string | null; last_error_code?: string | null };
function row(id: string, createdAt: string, attempts = 0): Row {
  const email = `${id}@example.test`;
  return { id, email, purpose: "invitation", sealed: seal(`${baseURL}/konto/einrichten?token=token-${id}&email=${encodeURIComponent(email)}`, mailKey),
    created_at: new Date(createdAt), expires_at: new Date(Date.now() + 60_000), dispatch_status: "pending",
    dispatch_attempts: attempts, claim_token: null };
}

test("normaler Versand teilt UTC-Cutoff, recovery bleibt aus, unknown/timeout sind pro Outbox-ID terminal", async () => {
  assert.equal(readAuthMailActivationCutoff("2026-10-28T09:00:00Z"), cutoff);
  for (const bad of [undefined, "2026-10-28T10:00:00+01:00", "2026-02-30T09:00:00Z", "2026-10-28"]) {
    assert.throws(() => readAuthMailActivationCutoff(bad));
  }
  const old = row("old", "2026-10-28T08:59:59.999Z");
  const retried = row("retried", "2026-10-28T09:00:00.000Z", 1);
  const first = row("first", "2026-10-28T09:00:01.000Z");
  const second = row("second", "2026-10-28T09:00:02.000Z");
  const third = row("third", "2026-10-28T09:00:03.000Z");
  const rows = [old, retried, first, second, third];
  const before = [old.dispatch_status, old.dispatch_attempts, retried.dispatch_status, retried.dispatch_attempts];
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = { async query(sql: string, params: unknown[] = []) {
    queries.push({ sql, params });
    const result = (selected: unknown[] = [], rowCount = selected.length) => ({ rows: selected, rowCount });
    if (sql.startsWith("SET LOCAL")) return result();
    assert.equal(sql.includes("WITH stale AS"), false, "cutoff run must never run global stale-claim recovery");
    if (sql.includes("WITH candidate AS")) {
      assert.match(sql, /created_at >= \$3::timestamptz AND dispatch_attempts=0/);
      assert.equal(params[2], cutoff);
      const selected = rows.find(item => item.dispatch_status === "pending" && item.dispatch_attempts === 0
        && item.created_at >= new Date(params[2] as string));
      if (!selected) return result();
      selected.dispatch_attempts = 1; selected.claim_token = params[0] as string; selected.dispatch_status = "claimed";
      return result([{ ...selected }]);
    }
    if (sql.includes("SELECT * FROM stex.auth_mail_outbox")) {
      assert.match(sql, /created_at >= \$3::timestamptz AND dispatch_attempts=1/);
      assert.equal(params[2], cutoff);
      const selected = rows.find(item => item.id === params[0] && item.claim_token === params[1]
        && item.created_at >= new Date(params[2] as string) && item.dispatch_attempts === 1);
      return result(selected ? [{ ...selected }] : []);
    }
    if (sql.includes(" AS ms")) return result([{ ms: 60_000 }]);
    if (sql.includes("SELECT v.expires_at")) {
      const id = String(params[0]).split("@")[0];
      assert.equal(params[1], tokenHash(`token-${id}`));
      return result([{ expires_at: new Date(Date.now() + 60_000), expired: false, consumed_at: null, revoked_at: null, status: "pending" }]);
    }
    if (sql.includes("SET dispatch_status='sending'")) {
      const selected = rows.find(item => item.id === params[0] && item.claim_token === params[1]);
      if (!selected) return result();
      selected.dispatch_status = "sending";
      return result([{ remaining: 60_000 }]);
    }
    if (sql.includes("SET dispatch_status=$4")) {
      const selected = rows.find(item => item.id === params[0] && item.claim_token === params[1]
        && item.dispatch_status === params[2]);
      if (!selected) return result([], 0);
      selected.dispatch_status = params[3] as string; selected.claim_token = null;
      selected.last_error_code = params[4] as string | null;
      return result([], 1);
    }
    throw new Error("Unexpected synthetic SQL");
  } };
  const database = {
    async transaction<T>(work: (value: PoolClient) => Promise<T>): Promise<T> {
      return work(client as unknown as PoolClient);
    },
  } as unknown as Database;
  const sent: DispatchMail[] = [];
  assert.throws(() => new MailDispatcher({ database, baseURL, mailKey, batchSize: 2, activationCutoff: cutoff,
    transport: { async send() { return { outcome: "accepted" }; } } }));
  const worker = new MailDispatcher({ database, baseURL, mailKey, batchSize: 1, timeoutMs: 10, activationCutoff: cutoff,
    transport: { async send(mail, signal) {
      sent.push(mail);
      if (mail.id === "first") return { outcome: "unknown" };
      if (mail.id === "second") return new Promise<MailTransportResult>(resolve => {
        signal.addEventListener("abort", () => resolve({ outcome: "unknown" }), { once: true });
      });
      return { outcome: "accepted" };
    } } });

  const uncertain = await worker.dispatchBatch();
  assert.equal(uncertain.claimed, 1); assert.equal(uncertain.recovered, 0); assert.equal(uncertain.uncertain, 1);
  assert.equal(first.dispatch_status, "uncertain"); assert.equal(first.dispatch_attempts, 1);
  const timedOut = await worker.dispatchBatch();
  assert.equal(timedOut.claimed, 1); assert.equal(timedOut.recovered, 0); assert.equal(timedOut.uncertain, 1);
  assert.equal(second.dispatch_status, "uncertain"); assert.equal(second.dispatch_attempts, 1);
  assert.equal(second.last_error_code, "transport_timeout");
  assert.equal((await worker.dispatchBatch()).sent, 1);
  assert.equal(third.dispatch_status, "sent");
  assert.equal(sent.map(item => item.id).join(","), "first,second,third");
  assert.deepEqual([old.dispatch_status, old.dispatch_attempts, retried.dispatch_status, retried.dispatch_attempts], before);
  assert.equal(queries.filter(item => item.sql.includes("WITH candidate AS")).length, 3);
  assert.equal(queries.some(item => item.sql.includes("WITH stale AS")), false);
});
