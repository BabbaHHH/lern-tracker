import type { AuthEnvironment } from "../../src/lib/server/auth/production-config";
import type { AuthBackupProtection } from "../../src/lib/server/persistence/backup";
import { productionOperatorConfig } from "../auth/production-operator-config";

export class BackupConfigError extends Error {
  constructor(readonly code: "invalid_invocation" | "backup_protection_required" | "credential_protection_required" | "persistence_unavailable") {
    super("Der Sicherungs-/Persistenzaufruf ist in dieser Konfiguration nicht verfügbar.");
  }
}
export type PersistenceCommand = "migrate" | "backup" | "restore";

/** Pure preflight: no files, resource construction, secret generation or environment mutation. */
export function persistenceInvocation(argv: readonly string[], env: AuthEnvironment, applicationRoot: string) {
  const [command, directory, ...extra] = argv;
  if (!["migrate", "backup", "restore"].includes(command) || extra.length
    || (command === "migrate" ? !!directory : !directory)) throw new BackupConfigError("invalid_invocation");
  const production = productionOperatorConfig(env, applicationRoot);
  let protection: AuthBackupProtection | undefined;
  if (production && command !== "migrate") {
    const encryptionKey = env.STEX_AUTH_BACKUP_KEY;
    // Same minimum/separation contract as backup.ts; never substitute a local key.
    if (!encryptionKey || encryptionKey.length < 32 || encryptionKey === production.secret) {
      throw new BackupConfigError("backup_protection_required");
    }
    const encryption = env.STEX_AI_CREDENTIAL_ENCRYPTION_KEY ?? "";
    const fingerprint = env.STEX_AI_CREDENTIAL_FINGERPRINT_KEY ?? "";
    // Existing credentialSecretsFromEnvironment contract, checked without touching process.env.
    if (!/^[0-9a-fA-F]{64}$/.test(encryption) || !/^[0-9a-fA-F]{64}$/.test(fingerprint)
      || encryption.toLowerCase() === fingerprint.toLowerCase()) throw new BackupConfigError("credential_protection_required");
    protection = { encryptionKey, authSecret: production.secret };
  }
  return { command: command as PersistenceCommand, directory, production, protection };
}
