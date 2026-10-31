import { backup, restore, type AuthBackupProtection } from "../../src/lib/server/persistence/backup";
import { configuredPersistence } from "./local-config";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AuthEnvironment } from "../../src/lib/server/auth/production-config";
import { BackupConfigError, persistenceInvocation } from "./backup-config";

export interface BackupCliBindings {
  persistence: typeof configuredPersistence;
  readTextFile(path: string): Promise<string>;
  backup: typeof backup;
  restore: typeof restore;
  output(value: string): void;
}
const bindings: BackupCliBindings = {
  persistence: configuredPersistence, readTextFile: path => readFile(path, "utf8"),
  backup, restore, output: value => console.log(value),
};

/** Importing is inert. All resources and actions can be instrumented independently. */
export async function runPersistence(
  argv: readonly string[], environment: AuthEnvironment = process.env,
  applicationRoot: string = process.cwd(), dependencies: BackupCliBindings = bindings,
): Promise<void> {
  const env = { ...environment };
  const { command, directory, production, protection: productionProtection } = persistenceInvocation(argv, env, applicationRoot);
  try {
    const { database, files } = await dependencies.persistence(env, applicationRoot);
    try {
      let protection: AuthBackupProtection | undefined = productionProtection;
      if (!production) {
        const root = resolve(applicationRoot, env.STEX_LOCAL_DATA_DIR || "db/.local");
        try {
          const encryptionKey = env.STEX_AUTH_BACKUP_KEY || (await dependencies.readTextFile(join(root, "auth-backup-key"))).trim();
          const authSecret = env.BETTER_AUTH_SECRET || (await dependencies.readTextFile(join(root, "auth-secret"))).trim();
          protection = { encryptionKey, authSecret };
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      }
      if (command === "migrate") { await database.migrate(); dependencies.output("Datenbankschema ist aktuell."); }
      else if (command === "backup") dependencies.output(JSON.stringify(await dependencies.backup(database, files, directory!, protection)));
      else { await database.migrate(); dependencies.output(JSON.stringify(await dependencies.restore(database, files, directory!, protection))); }
    } finally { await database.close(); }
  } catch { throw new BackupConfigError("persistence_unavailable"); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void runPersistence(process.argv.slice(2)).catch(() => {
    console.error("Der Sicherungs-/Persistenzaufruf konnte nicht sicher abgeschlossen werden."); process.exitCode = 1;
  });
}
