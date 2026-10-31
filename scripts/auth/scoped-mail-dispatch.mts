import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { configuredPersistence } from "../data-migration/local-config";
import { readProductionAuthConfig, type AuthEnvironment } from "../../src/lib/server/auth/production-config";
import { readMittaroHttpConfig } from "../../src/lib/server/auth/mittaro-http-config";
import { createMittaroHttpTransport } from "../../src/lib/server/auth/mittaro-http-transport";
import { MailDispatcher, readScopedMailDispatchScope, type DispatchBatchResult,
  type MailDispatcherOptions, type ScopedMailDispatchResult, type ScopedMailDispatchScope } from "../../src/lib/server/auth/mail-dispatcher";

/** HOST must supply a durable, exclusive start gate. No default or environment bypass. */
export interface ScopedMailOperatorGate {
  /** Atomically consume a permit and persist in-flight before returning; crashes/timeouts stay blocked.
   * The enclosing HOST operator may settle success only from a clean accepted/idle result. */
  assertStartAllowed(scope: Readonly<ScopedMailDispatchScope>): Promise<void>;
  blockFurtherStarts(): Promise<void>;
}
export interface ScopedMailDispatchBindings {
  persistence: typeof configuredPersistence;
  transport: typeof createMittaroHttpTransport;
  dispatcher(options: MailDispatcherOptions): Pick<MailDispatcher, "dispatchScopedOnce">;
  gate: ScopedMailOperatorGate | undefined;
  output(value: string): void;
}
export interface ScopedMailOperatorResult extends ScopedMailDispatchResult {
  mustBlockFurtherStarts: boolean;
}
const bindings: ScopedMailDispatchBindings = {
  persistence: configuredPersistence, transport: createMittaroHttpTransport,
  dispatcher: options => new MailDispatcher(options), gate: undefined,
  output: value => console.log(value),
};
const countKeys = ["claimed", "recovered", "sent", "deferred", "failed", "cancelled", "expired", "uncertain", "fenced"] as const;

function scopeFromEnvironment(env: AuthEnvironment): Readonly<ScopedMailDispatchScope> {
  const kind = env.STEX_AUTHMAIL_BINDING;
  if ((kind === "request" && env.STEX_AUTHMAIL_PILOT_RECIPIENT !== undefined)
    || (kind === "pilot" && env.STEX_AUTHMAIL_OUTBOX_ID !== undefined)) throw new Error();
  return readScopedMailDispatchScope({ mode: env.STEX_AUTHMAIL_SCOPE_MODE,
    activationCutoff: env.STEX_AUTHMAIL_ACTIVATION_CUTOFF, purpose: env.STEX_AUTHMAIL_PURPOSE,
    binding: kind === "request" ? { kind, outboxId: env.STEX_AUTHMAIL_OUTBOX_ID }
      : { kind, recipient: env.STEX_AUTHMAIL_PILOT_RECIPIENT } });
}

/** Rebuild the output from a closed list; never serialize a dependency's payload/error. */
function safeResult(value: ScopedMailDispatchResult): ScopedMailDispatchResult {
  if (!["idle", "accepted", "blocked"].includes(value?.outcome)) throw new Error();
  if (value.counts === null) {
    if (value.outcome !== "blocked") throw new Error();
    return { outcome: "blocked", counts: null };
  }
  const counts = Object.fromEntries(countKeys.map(key => {
    const count = value.counts?.[key];
    if (!Number.isSafeInteger(count) || typeof count !== "number" || count < 0 || count > 1) throw new Error();
    return [key, count];
  })) as unknown as DispatchBatchResult;
  const terminal = counts.sent + counts.deferred + counts.failed + counts.cancelled + counts.expired + counts.uncertain + counts.fenced;
  if (counts.recovered !== 0 || terminal !== counts.claimed
    || (value.outcome === "idle" && counts.claimed !== 0)
    || (value.outcome === "accepted" && counts.sent !== 1)
    || (value.outcome !== "blocked" && terminal !== counts.sent)) throw new Error();
  return { outcome: value.outcome, counts };
}

/** Explicit once-only capability. Raw CLI stays closed until HOST binds the durable gate. */
export async function runScopedMailDispatch(
  argv: readonly string[], environment: AuthEnvironment = process.env,
  applicationRoot: string = process.cwd(), dependencies: ScopedMailDispatchBindings = bindings,
): Promise<ScopedMailOperatorResult> {
  let result: ScopedMailDispatchResult = { outcome: "blocked", counts: null };
  let blockAttempted = false;
  const block = async () => {
    if (blockAttempted) return;
    blockAttempted = true;
    // A failed gate write is still a blocking result, never permission to restart.
    try { await dependencies.gate?.blockFurtherStarts(); } catch { /* no secret-bearing errors */ }
  };
  try {
    if (argv.length !== 1 || argv[0] !== "once") throw new Error();
    const env = { ...environment }, scope = scopeFromEnvironment(env);
    if (!dependencies.gate) throw new Error();
    await dependencies.gate.assertStartAllowed(scope);
    const config = readProductionAuthConfig(env, applicationRoot);
    readMittaroHttpConfig(env, config.baseURL);
    const transport = dependencies.transport(env, config.baseURL);
    const { database } = await dependencies.persistence(env, applicationRoot);
    try {
      result = safeResult(await dependencies.dispatcher({ database, baseURL: config.baseURL,
        mailKey: config.mailKey, transport, batchSize: 1, scope }).dispatchScopedOnce());
      if (result.outcome === "blocked") await block();
    } catch {
      result = { outcome: "blocked", counts: result.counts };
      await block();
    } finally { await database.close(); }
  } catch {
    result = { outcome: "blocked", counts: result.counts };
  }
  if (result.outcome === "blocked") await block();
  let report: ScopedMailOperatorResult = { ...result, mustBlockFurtherStarts: result.outcome === "blocked" };
  try { dependencies.output(JSON.stringify(report)); }
  catch { await block(); report = { ...result, outcome: "blocked", mustBlockFurtherStarts: true }; }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void runScopedMailDispatch(process.argv.slice(2)).then(result => {
    if (result.mustBlockFurtherStarts) process.exitCode = 1;
  }).catch(() => { console.error("Der begrenzte Authmail-Auftrag wurde gesperrt."); process.exitCode = 1; });
}
