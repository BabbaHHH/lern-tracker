import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { Database } from "../persistence/database";
import { emailAddress, tokenHash, unseal } from "./security";
import { smtpMailbox } from "./smtp-config";
import type { DispatchMail, MailTransport, MailTransportResult } from "./mail-transport";

type Status = "pending" | "claimed" | "sending" | "sent" | "failed" | "cancelled" | "expired" | "uncertain";
type ErrorCode = "outbox_expired" | "proof_invalid" | "proof_expired" | "proof_not_ready" | "invalid_message"
  | "attempts_exhausted" | "claim_expired" | "sending_expired" | "transport_rejected"
  | "transport_temporary" | "transport_unknown" | "transport_timeout";
interface Claim {
  id: string; email: string; purpose: DispatchMail["purpose"]; sealed: string;
  claim_token: string; dispatch_attempts: number; expires_at: Date;
}
interface Proof { status: "valid" | "invalid" | "expired" | "waiting"; expiresAt?: Date }
export interface ScopedMailDispatchScope {
  mode: "scoped";
  activationCutoff: string;
  purpose: DispatchMail["purpose"];
  binding: { kind: "request"; outboxId: string } | { kind: "pilot"; recipient: string };
}
export interface ScopedMailDispatchResult {
  outcome: "idle" | "accepted" | "blocked";
  counts: DispatchBatchResult | null;
}
/** Shared strict parser for scoped and normal post-activation mail runs. */
export function readAuthMailActivationCutoff(input: unknown): string {
  try {
    if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input)
      || input.startsWith("0000-")) throw new Error();
    const normalized = new Date(input).toISOString();
    if (input !== normalized && input !== normalized.replace(".000Z", "Z")) throw new Error();
    return normalized;
  } catch { throw new Error("Ungültiger Authmail-Aktivierungsstichtag."); }
}
/** Pure, strict operator-input validation. No defaults may widen a scoped selection. */
export function readScopedMailDispatchScope(input: unknown): Readonly<ScopedMailDispatchScope> {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    const value = input as Record<string, unknown>;
    if (Object.keys(value).some(key => !["mode", "activationCutoff", "purpose", "binding"].includes(key))
      || value.mode !== "scoped"
      || !["invitation", "verification", "reset"].includes(value.purpose as string)) throw new Error();
    const cutoff = readAuthMailActivationCutoff(value.activationCutoff);
    const binding = value.binding as Record<string, unknown> | null;
    if (!binding || typeof binding !== "object" || Array.isArray(binding)) throw new Error();
    let selected: ScopedMailDispatchScope["binding"];
    if (binding.kind === "request" && Object.keys(binding).length === 2
      && typeof binding.outboxId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(binding.outboxId)) {
      selected = { kind: "request", outboxId: binding.outboxId };
    } else if (binding.kind === "pilot" && Object.keys(binding).length === 2
      && typeof binding.recipient === "string" && smtpMailbox(binding.recipient)
      && emailAddress(binding.recipient) === binding.recipient) {
      selected = { kind: "pilot", recipient: binding.recipient };
    } else throw new Error();
    return Object.freeze({ mode: "scoped", activationCutoff: cutoff,
      purpose: value.purpose as DispatchMail["purpose"], binding: Object.freeze(selected) });
  } catch { throw new Error("Ungültiger begrenzter Authmail-Auftrag."); }
}
export interface MailDispatcherOptions {
  database: Database; baseURL: string; mailKey: string; transport: MailTransport;
  batchSize?: number; leaseMs?: number; timeoutMs?: number;
  activationCutoff?: string;
  scope?: ScopedMailDispatchScope;
}
export interface DispatchBatchResult {
  claimed: number; recovered: number; sent: number; deferred: number;
  failed: number; cancelled: number; expired: number; uncertain: number; fenced: number;
}

/** Bounded server/operator capability, deliberately not wired to runtime or HTTP. */
export class MailDispatcher {
  private readonly database: Database;
  private readonly baseURL: string;
  private readonly mailKey: string;
  private readonly transport: MailTransport;
  private readonly batchSize: number;
  private readonly leaseMs: number;
  private readonly timeoutMs: number;
  private readonly scope: Readonly<ScopedMailDispatchScope> | undefined;
  private readonly activationCutoff: string | undefined;
  private scopedBlocked = false;
  private running = false;
  private unsettledTransport = false;

  constructor(options: MailDispatcherOptions) {
    const url = new URL(options.baseURL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
      || (url.protocol !== "https:" && !(url.protocol === "http:" && local))
      || options.mailKey.length < 32 || typeof options.transport?.send !== "function") {
      throw new Error("Ungültiger Maildispatcher-Vertrag.");
    }
    this.scope = options.scope === undefined ? undefined : readScopedMailDispatchScope(options.scope);
    if (this.scope && options.activationCutoff !== undefined) throw new Error("Ungültige Maildispatcher-Grenzen.");
    this.activationCutoff = this.scope ? this.scope.activationCutoff
      : options.activationCutoff === undefined ? undefined : readAuthMailActivationCutoff(options.activationCutoff);
    this.batchSize = options.batchSize ?? (this.scope ? 1 : 10);
    this.leaseMs = options.leaseMs ?? 60_000;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isInteger(this.batchSize) || this.batchSize < 1 || this.batchSize > 10
      || (this.activationCutoff !== undefined && this.batchSize !== 1)
      || !Number.isInteger(this.timeoutMs) || this.timeoutMs < 10 || this.timeoutMs > 30_000
      || !Number.isInteger(this.leaseMs) || this.leaseMs < this.timeoutMs + 100 || this.leaseMs > 120_000) {
      throw new Error("Ungültige Maildispatcher-Grenzen.");
    }
    this.database = options.database; this.baseURL = url.origin;
    this.mailKey = options.mailKey; this.transport = options.transport;
  }

  private scopeParameters(): (string | null)[] {
    return this.scope ? [this.scope.activationCutoff, this.scope.purpose,
      this.scope.binding.kind === "request" ? this.scope.binding.outboxId : null,
      this.scope.binding.kind === "pilot" ? this.scope.binding.recipient : null] : [];
  }
  private activationParameters(): (string | null)[] {
    return this.scope ? this.scopeParameters() : this.activationCutoff ? [this.activationCutoff] : [];
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.database.transaction(async client => {
      await client.query("SET LOCAL lock_timeout='2s'");
      await client.query("SET LOCAL statement_timeout='5s'");
      return work(client);
    });
  }

  private async recover(): Promise<number> {
    return this.transaction(async client => {
      const result = await client.query(`WITH stale AS (
        SELECT id FROM stex.auth_mail_outbox WHERE dispatch_status IN ('claimed','sending')
          AND lease_until<=clock_timestamp() ORDER BY lease_until,id FOR UPDATE SKIP LOCKED LIMIT 10
      ) UPDATE stex.auth_mail_outbox m SET
        dispatch_status=CASE WHEN dispatch_status='sending' THEN 'uncertain'
          WHEN expires_at<=clock_timestamp() THEN 'expired'
          WHEN dispatch_attempts>=5 THEN 'failed' ELSE 'pending' END,
        last_error_code=CASE WHEN dispatch_status='sending' THEN 'sending_expired'
          WHEN expires_at<=clock_timestamp() THEN 'outbox_expired'
          WHEN dispatch_attempts>=5 THEN 'attempts_exhausted' ELSE 'claim_expired' END,
        claim_token=NULL,lease_until=NULL,
        next_attempt_at=clock_timestamp()+interval '30 seconds'
        FROM stale WHERE m.id=stale.id`);
      return result.rowCount ?? 0;
    });
  }

  private async claim(): Promise<Claim | undefined> {
    return this.transaction(async client => {
      const result = await client.query<Claim>(`WITH candidate AS (
        SELECT id FROM stex.auth_mail_outbox WHERE dispatch_status='pending'
          ${this.scope ? `AND created_at >= $3::timestamptz AND dispatch_attempts=0
          AND purpose IN ('invitation','verification','reset') AND purpose=$4
          AND ($5::text IS NULL OR id=$5) AND ($6::text IS NULL OR email=$6)`
          : this.activationCutoff ? `AND created_at >= $3::timestamptz AND dispatch_attempts=0` : ""}
          AND next_attempt_at<=statement_timestamp() ORDER BY next_attempt_at,created_at,id
          FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE stex.auth_mail_outbox m SET
        dispatch_status=CASE WHEN expires_at<=statement_timestamp() THEN 'expired'
          WHEN dispatch_attempts>=5 THEN 'failed' ELSE 'claimed' END,
        last_error_code=CASE WHEN expires_at<=statement_timestamp() THEN 'outbox_expired'
          WHEN dispatch_attempts>=5 THEN 'attempts_exhausted' ELSE NULL END,
        claim_token=CASE WHEN expires_at>statement_timestamp() AND dispatch_attempts<5 THEN $1 ELSE NULL END,
        lease_until=CASE WHEN expires_at>statement_timestamp() AND dispatch_attempts<5
          THEN statement_timestamp()+$2*interval '1 millisecond' ELSE NULL END,
        dispatch_attempts=least(5,dispatch_attempts+1)
        FROM candidate WHERE m.id=candidate.id RETURNING m.*`, [randomUUID(), this.leaseMs, ...this.activationParameters()]);
      // Return terminal candidates too, so bounded batches count them as work.
      return result.rows[0];
    });
  }

  private message(row: Claim): DispatchMail {
    const url = new URL(unseal(row.sealed, this.mailKey));
    if (url.origin !== this.baseURL || url.username || url.password || url.hash
      || url.href.length > 16_384 || emailAddress(row.email) !== row.email
      || (this.scope && !smtpMailbox(row.email))) throw new Error();
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length) throw new Error();
    const allowed = row.purpose === "invitation" ? ["token", "email"]
      : row.purpose === "verification" ? ["token", "callbackURL"] : ["callbackURL"];
    if (keys.some(key => !allowed.includes(key))) throw new Error();
    const token = url.searchParams.get("token");
    if (row.purpose === "invitation") {
      if (url.pathname !== "/konto/einrichten" || !token || !/^[\w-]{1,128}$/.test(token)
        || url.searchParams.get("email") !== row.email) throw new Error();
    } else if (row.purpose === "verification") {
      if (url.pathname !== "/api/auth/verify-email" || !token || !/^[\w.-]{1,8192}$/.test(token)) throw new Error();
    } else if (row.purpose !== "reset" || !/^\/api\/auth\/reset-password\/[\w-]{1,128}$/.test(url.pathname)) {
      throw new Error();
    }
    const callback = url.searchParams.get("callbackURL");
    if (callback && new URL(callback, this.baseURL).origin !== this.baseURL) throw new Error();
    return Object.freeze({ id: row.id, email: row.email, purpose: row.purpose, url: url.href });
  }

  private async proof(client: PoolClient, mail: DispatchMail): Promise<Proof> {
    const url = new URL(mail.url);
    if (mail.purpose === "invitation") {
      const row = (await client.query(`SELECT v.expires_at, v.expires_at<=clock_timestamp() AS expired,
          v.consumed_at,v.revoked_at,a.status FROM stex.account_invitations v
          JOIN stex.accounts a ON a.user_id=v.user_id WHERE v.email=$1 AND v.token_hash=$2`,
        [mail.email, tokenHash(url.searchParams.get("token")!)])).rows[0];
      if (!row || row.consumed_at || row.revoked_at || row.status !== "pending") return { status: "invalid" };
      return { status: row.expired ? "expired" : "valid", expiresAt: row.expires_at };
    }
    const user = (await client.query(`SELECT u.id,u."emailVerified",u."stexAccountId",u."invitationId",
        i.user_id,a.status FROM public.stex_auth_user u
        LEFT JOIN stex.auth_identities i ON i.auth_user_id=u.id
        LEFT JOIN stex.accounts a ON a.user_id=i.user_id WHERE u.email=$1`, [mail.email])).rows[0];
    if (!user || user.status === "blocked" || (mail.purpose === "verification" && user.emailVerified)) return { status: "invalid" };
    const proof = mail.purpose === "verification"
      ? (await client.query(`SELECT expires_at,expires_at<=clock_timestamp() AS expired FROM stex.auth_email_tokens
          WHERE token_hash=$1 AND email=$2`, [tokenHash(url.searchParams.get("token")!), mail.email])).rows[0]
      : (await client.query(`SELECT "expiresAt" AS expires_at,"expiresAt"<=clock_timestamp() AS expired
          FROM public.stex_auth_verification WHERE identifier=$1 AND value=$2 ORDER BY "expiresAt" DESC LIMIT 1`,
        [`reset-password:${url.pathname.split("/").at(-1)}`, user.id])).rows[0];
    if (!proof) return { status: "invalid" };
    if (proof.expired) return { status: "expired" };
    if (!user.user_id) {
      // The library may commit before the app finishes its invitation transaction.
      // Only a still-open matching application invitation may wait for that commit.
      const pending = (await client.query(`SELECT 1 FROM stex.account_invitations v JOIN stex.accounts a ON a.user_id=v.user_id
          WHERE v.id=$1 AND v.user_id=$2 AND v.email=$3 AND a.status='pending'
          AND v.consumed_at IS NULL AND v.revoked_at IS NULL AND v.expires_at>clock_timestamp()`,
        [user.invitationId, user.stexAccountId, mail.email])).rowCount;
      return { status: pending ? "waiting" : "invalid" };
    }
    if (user.user_id !== user.stexAccountId || !["pending", "active"].includes(user.status)) return { status: "invalid" };
    return { status: "valid", expiresAt: proof.expires_at };
  }

  private async finish(client: PoolClient, row: Claim, from: "claimed" | "sending", status: Status, code: ErrorCode | null): Promise<Status | "fenced"> {
    const result = await client.query(`UPDATE stex.auth_mail_outbox SET dispatch_status=$4,last_error_code=$5,
        claim_token=NULL,lease_until=NULL,sent_at=CASE WHEN $4='sent' THEN clock_timestamp() ELSE NULL END,
        next_attempt_at=CASE WHEN $4='pending' THEN clock_timestamp()+least(900,30*power(2,dispatch_attempts-1))*interval '1 second' ELSE next_attempt_at END
        WHERE id=$1 AND claim_token=$2 AND dispatch_status=$3 AND lease_until>clock_timestamp()`,
      [row.id, row.claim_token, from, status, code]);
    return result.rowCount ? status : "fenced";
  }

  private async start(row: Claim): Promise<{ mail: DispatchMail; deadline: number } | Status | "fenced"> {
    return this.transaction(async client => {
      const current = (await client.query<Claim & { dispatch_status: Status }>(`SELECT * FROM stex.auth_mail_outbox
          WHERE id=$1 AND claim_token=$2 AND dispatch_status='claimed' AND lease_until>clock_timestamp()
          ${this.scope ? `AND created_at >= $3::timestamptz AND dispatch_attempts=1
          AND purpose IN ('invitation','verification','reset') AND purpose=$4
          AND ($5::text IS NULL OR id=$5) AND ($6::text IS NULL OR email=$6)`
          : this.activationCutoff ? `AND created_at >= $3::timestamptz AND dispatch_attempts=1` : ""}
          FOR UPDATE`, [row.id, row.claim_token, ...this.activationParameters()])).rows[0];
      if (!current) return "fenced";
      const remaining = (await client.query<{ms: number}>(`SELECT extract(epoch FROM ($1::timestamptz-clock_timestamp()))*1000 AS ms`, [current.expires_at])).rows[0].ms;
      if (remaining <= 0) return this.finish(client, row, "claimed", "expired", "outbox_expired");
      let mail: DispatchMail;
      try { mail = this.message(current); }
      catch { return this.finish(client, row, "claimed", "failed", "invalid_message"); }
      const proof = await this.proof(client, mail);
      if (proof.status !== "valid") {
        const status = proof.status === "expired" ? "expired" : proof.status === "waiting"
          ? (!this.scope && !this.activationCutoff && row.dispatch_attempts < 5 ? "pending" : "failed") : "cancelled";
        const code = proof.status === "expired" ? "proof_expired" : proof.status === "waiting" ? "proof_not_ready" : "proof_invalid";
        return this.finish(client, row, "claimed", status, code);
      }
      const result = await client.query<{remaining: number}>(`UPDATE stex.auth_mail_outbox SET dispatch_status='sending',
          lease_until=clock_timestamp()+$3*interval '1 millisecond'
          WHERE id=$1 AND claim_token=$2 AND dispatch_status='claimed' AND lease_until>clock_timestamp()
          AND expires_at>clock_timestamp() AND $4::timestamptz>clock_timestamp()
          RETURNING least(extract(epoch FROM (expires_at-clock_timestamp()))*1000,
            extract(epoch FROM ($4::timestamptz-clock_timestamp()))*1000) AS remaining`,
        [row.id, row.claim_token, this.leaseMs, proof.expiresAt]);
      if (!result.rows[0]) return this.finish(client, row, "claimed", "expired", "proof_expired");
      return { mail, deadline: Date.now() + Math.min(this.timeoutMs, Number(result.rows[0].remaining)) };
    });
  }

  private async send(mail: DispatchMail, deadline: number): Promise<{result: MailTransportResult; timedOut: boolean}> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (deadline <= Date.now()) return { result: { outcome: "not_accepted", retryable: false }, timedOut: false };
    this.unsettledTransport = true;
    const sending = Promise.resolve().then(() => this.transport.send(mail, controller.signal))
      .then(result => ({ result, timedOut: false }), () => ({ result: { outcome: "unknown" } as MailTransportResult, timedOut: false }))
      .finally(() => { this.unsettledTransport = false; });
    try {
      return await Promise.race([sending, new Promise<{result: MailTransportResult; timedOut: boolean}>(resolve => {
        timer = setTimeout(() => {
          // Resolve the conservative outcome before notifying an abort listener.
          resolve({ result: { outcome: "unknown" }, timedOut: true }); controller.abort();
        }, Math.max(1, deadline - Date.now()));
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }

  async dispatchBatch(): Promise<DispatchBatchResult> {
    if (this.scope) {
      this.scopedBlocked = true;
      throw new Error("Begrenzter Auftrag benötigt den gesonderten Einstieg.");
    }
    return this.runBatch();
  }

  /** One attempt only. Any non-success permanently fences this instance; no lease cleanup. */
  async dispatchScopedOnce(): Promise<ScopedMailDispatchResult> {
    if (!this.scope) throw new Error("Begrenzter Authmail-Auftrag fehlt.");
    try {
      const counts = await this.runBatch();
      return { outcome: this.scopedBlocked ? "blocked" : counts.sent === 1 ? "accepted" : "idle", counts };
    } catch {
      this.scopedBlocked = true;
      return { outcome: "blocked", counts: null };
    }
  }

  private async runBatch(): Promise<DispatchBatchResult> {
    if (this.running || this.unsettledTransport || this.scopedBlocked) throw new Error("Maildispatcher ist bereits beschäftigt oder gesperrt.");
    this.running = true;
    const report: DispatchBatchResult = { claimed: 0, recovered: 0, sent: 0, deferred: 0, failed: 0, cancelled: 0, expired: 0, uncertain: 0, fenced: 0 };
    const count = (status: Status | "fenced") => {
      if (this.scope && status !== "sent") this.scopedBlocked = true;
      if (status === "pending") report.deferred++;
      else if (status !== "claimed" && status !== "sending") report[status]++;
    };
    try {
      // Cutoff-bound runs never globally recover old/in-flight outbox rows.
      if (!this.scope && !this.activationCutoff) report.recovered = await this.recover();
      for (let index = 0; index < this.batchSize; index++) {
        const row = await this.claim() as (Claim & {dispatch_status: Status}) | undefined;
        if (!row) break;
        report.claimed++;
        if (row.dispatch_status !== "claimed") { count(row.dispatch_status); continue; }
        const started = await this.start(row);
        if (typeof started === "string") { count(started); continue; }
        if (started.deadline <= Date.now()) {
          count(await this.transaction(client => this.finish(client, row, "sending", "expired", "proof_expired")));
          continue;
        }
        const { result, timedOut } = await this.send(started.mail, started.deadline);
        let status: Status = "uncertain", code: ErrorCode | null = timedOut ? "transport_timeout" : "transport_unknown";
        if (result?.outcome === "accepted") { status = "sent"; code = null; }
        else if (result?.outcome === "not_accepted" && typeof result.retryable === "boolean") {
          status = !this.scope && result.retryable && row.dispatch_attempts < 5 ? "pending" : "failed";
          code = result.retryable ? "transport_temporary" : "transport_rejected";
        }
        count(await this.transaction(client => this.finish(client, row, "sending", status, code)));
        // Do not accumulate abandoned promises after a non-cooperative transport.
        if (timedOut) break;
      }
      return report;
    } catch {
      if (this.scope) this.scopedBlocked = true;
      // DB errors can contain statement parameters. Never expose their messages/causes.
      throw new Error("Maildispatcher konnte den begrenzten Lauf nicht abschließen.");
    } finally { this.running = false; }
  }
}
