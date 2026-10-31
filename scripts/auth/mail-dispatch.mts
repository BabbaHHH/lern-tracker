import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { configuredPersistence } from "../data-migration/local-config";
import { readProductionAuthConfig, type AuthEnvironment } from "../../src/lib/server/auth/production-config";
import { readMittaroHttpConfig } from "../../src/lib/server/auth/mittaro-http-config";
import { createMittaroHttpTransport } from "../../src/lib/server/auth/mittaro-http-transport";
import { MailDispatcher, readAuthMailActivationCutoff, type MailDispatcherOptions } from "../../src/lib/server/auth/mail-dispatcher";

export interface MailDispatchBindings {
  persistence: typeof configuredPersistence;
  transport: typeof createMittaroHttpTransport;
  dispatcher(options: MailDispatcherOptions): Pick<MailDispatcher, "dispatchBatch">;
  output(value: string): void;
}
const bindings: MailDispatchBindings = {
  persistence: configuredPersistence, transport: createMittaroHttpTransport,
  dispatcher: options => new MailDispatcher(options), output: value => console.log(value),
};
/** Explicit single-batch operator capability. No import-time action or daemon. */
export async function runMailDispatch(
  argv: readonly string[], environment: AuthEnvironment = process.env,
  applicationRoot: string = process.cwd(), dependencies: MailDispatchBindings = bindings,
): Promise<void> {
  try {
    if (argv.length !== 1 || argv[0] !== "once") throw new Error();
    const env = { ...environment };
    const activationCutoff = readAuthMailActivationCutoff(env.STEX_AUTHMAIL_ACTIVATION_CUTOFF);
    const config = readProductionAuthConfig(env, applicationRoot);
    readMittaroHttpConfig(env, config.baseURL); // validate completely before resources
    const transport = dependencies.transport(env, config.baseURL);
    const { database } = await dependencies.persistence(env, applicationRoot);
    try {
      const result = await dependencies.dispatcher({ database, baseURL: config.baseURL, mailKey: config.mailKey,
        transport, batchSize: 1, activationCutoff }).dispatchBatch();
      if (result.recovered !== 0) throw new Error();
      const counts = Object.fromEntries(["claimed", "recovered", "sent", "deferred", "failed", "cancelled", "expired", "uncertain", "fenced"].map(key => {
        const value = result[key as keyof typeof result];
        if (!Number.isSafeInteger(value) || value < 0 || value > 1) throw new Error();
        return [key, value];
      }));
      dependencies.output(JSON.stringify(counts));
    } finally { await database.close(); }
  } catch { throw new Error("Der begrenzte Mailbatch konnte nicht sicher abgeschlossen werden."); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void runMailDispatch(process.argv.slice(2)).catch(() => {
    console.error("Der begrenzte Mailbatch konnte nicht sicher abgeschlossen werden."); process.exitCode = 1;
  });
}
