import { randomBytes } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { PoolConfig } from "pg";
import { Database } from "../../src/lib/server/persistence/database";
import { PrivateFiles } from "../../src/lib/server/persistence/files";

import type { AuthEnvironment } from "../../src/lib/server/auth/production-config";
import { OperatorConfigError, productionOperatorConfig } from "../auth/production-operator-config";

function rootFor(env: AuthEnvironment, applicationRoot: string): string {
  if (env.STEX_LOCAL_DATA_DIR && !isAbsolute(env.STEX_LOCAL_DATA_DIR)) throw new Error("Lokaler Datenordner braucht einen absoluten Pfad.");
  return resolve(applicationRoot, env.STEX_LOCAL_DATA_DIR || "db/.local");
}
// Compatibility name only: no import-time resource or filesystem operation.
export const localRoot = rootFor(process.env, process.cwd());
export function localPort(env: AuthEnvironment = process.env): number {
  if (productionOperatorConfig(env, process.cwd())) throw new OperatorConfigError("local_operator_only");
  const port = Number(env.STEX_LOCAL_POSTGRES_PORT || "55432");
  if (!Number.isInteger(port) || port<1024 || port>65535) throw new Error("Ungültiger lokaler PostgreSQL-Port.");
  return port;
}
export async function localPassword(create = false): Promise<string> {
  if (productionOperatorConfig(process.env, process.cwd())) throw new OperatorConfigError("local_operator_only");
  new PrivateFiles(localRoot); // reject public/ before creating or reading a credential
  const path = join(localRoot,"postgres-password");
  if (create) {
    await mkdir(localRoot,{recursive:true,mode:0o700});
    try { await access(path); } catch {
      await writeFile(path,randomBytes(32).toString("hex"),{flag:"wx",mode:0o600});
    }
  }
  return (await readFile(path,"utf8")).trim();
}
export interface PersistenceBindings {
  database(config: PoolConfig): Database;
  files(root: string): PrivateFiles;
  readTextFile(path: string): Promise<string>;
}
const bindings: PersistenceBindings = {
  database: config => new Database(config), files: root => new PrivateFiles(root),
  readTextFile: path => readFile(path, "utf8"),
};
/** Explicit operator configuration only; no .env.local or browser storage. */
export async function configuredPersistence(
  environment: AuthEnvironment = process.env, applicationRoot: string = process.cwd(),
  dependencies: PersistenceBindings = bindings,
) {
  const env = { ...environment };
  const production = productionOperatorConfig(env, applicationRoot);
  let config: PoolConfig, fileRoot: string;
  if (production) { config = production.database; fileRoot = production.privateFileRoot; }
  else {
    const root = rootFor(env, applicationRoot);
    new PrivateFiles(root); // pure path validation before reading a password
    const connectionString = env.DATABASE_URL;
    if (connectionString && !env.STEX_PRIVATE_FILE_ROOT) throw new Error("Für DATABASE_URL muss der zugehörige private Dateispeicher ausdrücklich gesetzt sein.");
    fileRoot = env.STEX_PRIVATE_FILE_ROOT || join(root, "files");
    new PrivateFiles(fileRoot);
    config = connectionString ? { connectionString, connectionTimeoutMillis: 5000 }
      : { host: "127.0.0.1", port: localPort(env), user: "stex_local",
        password: (await dependencies.readTextFile(join(root, "postgres-password"))).trim(),
        database: "stex_local", connectionTimeoutMillis: 5000 };
  }
  let database: Database | undefined;
  try {
    database = dependencies.database(config);
    return { database, files: dependencies.files(fileRoot), production };
  } catch {
    await database?.close().catch(() => {});
    throw new OperatorConfigError("operator_unavailable");
  }
}
