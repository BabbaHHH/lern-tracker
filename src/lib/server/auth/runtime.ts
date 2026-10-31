import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve, join } from "node:path";
import type { PoolConfig } from "pg";
import { Database } from "../persistence/database";
import { PrivateFiles } from "../persistence/files";
import { AccountService, type AuthOptions } from "./service";
import { AccountError } from "./security";
import { type AuthEnvironment } from "./production-config";
import { productionAccountRuntime } from "./production-runtime";

export interface AccountRuntimeBindings {
  readTextFile(path: string): Promise<string>;
  database(config: PoolConfig): Database;
  files(root: string): PrivateFiles;
  service(options: AuthOptions): AccountService;
}
const bindings: AccountRuntimeBindings = {
  readTextFile: path => readFile(path, "utf8"),
  database: config => new Database(config),
  files: root => new PrivateFiles(root),
  service: options => new AccountService(options),
};
const environmentFields = ["NODE_ENV", "STEX_AUTH_MODE", "STEX_AUTH_RUNTIME_RELEASE", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "STEX_AUTH_MAIL_KEY", "DATABASE_URL", "STEX_DATABASE_TLS", "STEX_PRIVATE_FILE_ROOT", "STEX_LOCAL_DATA_DIR", "STEX_LOCAL_POSTGRES_PORT"] as const;
const unavailable = () => new AccountError("unavailable", "Die Kontofunktion ist noch nicht für diese Umgebung eingerichtet.", 503);

/** Isolated instance seam; only explicit server environment can release production. */
export function createAccountRuntime(
  environment: () => AuthEnvironment = () => process.env,
  dependencies: AccountRuntimeBindings = bindings,
  applicationRoot: () => string = () => process.cwd(),
): () => Promise<AccountService> {
  let runtime: Promise<AccountService> | undefined;
  let fingerprint: string | undefined;
  async function load(env: AuthEnvironment, currentRoot: string): Promise<AccountService> {
    if (env.STEX_AUTH_MODE === "production") {
      return productionAccountRuntime(env, currentRoot, dependencies);
    }
    const baseURL = env.BETTER_AUTH_URL;
    if (env.STEX_AUTH_MODE !== "local" || env.NODE_ENV === "production" || !baseURL) throw unavailable();
    let origin: URL;
    try { origin = new URL(baseURL); } catch { throw unavailable(); }
    if (!["http:", "https:"].includes(origin.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) throw unavailable();
    if (env.STEX_LOCAL_DATA_DIR && !isAbsolute(env.STEX_LOCAL_DATA_DIR)) throw unavailable();
    const root = resolve(currentRoot, env.STEX_LOCAL_DATA_DIR || "db/.local");
    const port = Number(env.STEX_LOCAL_POSTGRES_PORT || 55432);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw unavailable();
    const secret = env.BETTER_AUTH_SECRET || (await dependencies.readTextFile(join(root, "auth-secret"))).trim();
    const mailKey = (await dependencies.readTextFile(join(root, "auth-mail-key"))).trim();
    const password = (await dependencies.readTextFile(join(root, "postgres-password"))).trim();
    const database = dependencies.database({ host: "127.0.0.1", port, user: "stex_local", password, database: "stex_local", connectionTimeoutMillis: 5000 });
    try {
      const files = dependencies.files(env.STEX_PRIVATE_FILE_ROOT || join(root, "files"));
      await files.initialize();
      // Schema changes remain explicit operator work, never an incoming request.
      return dependencies.service({ database, files, baseURL, secret, mailKey });
    } catch (error) {
      await database.close().catch(() => {});
      throw error;
    }
  }
  return () => {
    const source = environment();
    const env: AuthEnvironment = Object.fromEntries(environmentFields.map(field => [field, source[field]]));
    const currentRoot = applicationRoot();
    const next = createHash("sha256").update(JSON.stringify([currentRoot, env])).digest("hex");
    // Never return a cached local service after an in-process mode/secret/path change.
    // Restart is required; unrelated environment variables do not invalidate it.
    if (runtime && fingerprint !== next) return Promise.reject(new AccountError("auth_configuration_changed", "Die Kontokonfiguration wurde geändert. Ein kontrollierter Neustart ist erforderlich.", 503));
    fingerprint = next;
    runtime ??= load(env, currentRoot).catch(error => { runtime = undefined; fingerprint = undefined; throw error; });
    return runtime;
  };
}

/** Existing callers keep the same lazy, shared entry point. */
export const accountRuntime = createAccountRuntime();
