import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { configuredPersistence } from "../data-migration/local-config";
import { AccountService, type AuthOptions } from "../../src/lib/server/auth/service";
import { PrivateFiles } from "../../src/lib/server/persistence/files";
import type { AuthEnvironment } from "../../src/lib/server/auth/production-config";
import { OperatorConfigError, operatorInvocation } from "./production-operator-config";

export interface OperatorBindings {
  persistence: typeof configuredPersistence;
  service(options: AuthOptions): Pick<AccountService, "prepareAdmin" | "finishAdmin" | "recoverAdmin" | "localMails">;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, value: string, options: { flag?: string; mode: number }): Promise<void>;
  mkdir(path: string): Promise<void>;
  secret(): string;
  output(value: string): void;
}
const bindings: OperatorBindings = {
  persistence: configuredPersistence, service: options => new AccountService(options),
  readTextFile: path => readFile(path, "utf8"),
  writeTextFile: (path, value, options) => writeFile(path, value, options),
  mkdir: async path => { await mkdir(path, { recursive: true, mode: 0o700 }); },
  secret: () => randomBytes(48).toString("base64url"), output: value => console.log(value),
};

/** Explicit CLI capability. Importing this module executes no operator action. */
export async function runOperator(
  argv: readonly string[], environment: AuthEnvironment = process.env,
  applicationRoot: string = process.cwd(), dependencies: OperatorBindings = bindings,
): Promise<void> {
  const env = { ...environment };
  const { command, args, production } = operatorInvocation(argv, env, applicationRoot);
  try {
    if (!production && env.STEX_LOCAL_DATA_DIR && !isAbsolute(env.STEX_LOCAL_DATA_DIR)) throw new OperatorConfigError("operator_unavailable");
    const root = production ? undefined : resolve(applicationRoot, env.STEX_LOCAL_DATA_DIR || "db/.local");
    if (root) {
      new PrivateFiles(root); // validate before mkdir or generation
      await dependencies.mkdir(root);
    }
    if (command === "init") {
      for (const name of ["auth-secret", "auth-mail-key", "auth-backup-key"]) {
        try { await dependencies.writeTextFile(join(root!, name), dependencies.secret(), { flag: "wx", mode: 0o600 }); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      }
      dependencies.output("Getrennte lokale Auth-, Mail- und Sicherungsschlüssel liegen im privaten Entwicklungsordner. Vorhandene Schlüssel wurden erhalten.");
      return;
    }
    const { database, files } = await dependencies.persistence(env, applicationRoot);
    try {
      const service = dependencies.service({ database, files,
        baseURL: production?.baseURL ?? env.BETTER_AUTH_URL ?? "http://localhost:3001",
        secret: production?.secret ?? (await dependencies.readTextFile(join(root!, "auth-secret"))).trim(),
        mailKey: production?.mailKey ?? (await dependencies.readTextFile(join(root!, "auth-mail-key"))).trim(),
      });
      if (command === "prepare-admin") {
        dependencies.output(JSON.stringify(await service.prepareAdmin(args[0], args[1])));
      } else if (command === "finish-admin" || command === "recover-admin") {
        if (command === "finish-admin") await service.finishAdmin(args[0]); else await service.recoverAdmin(args[0]);
        dependencies.output(command === "finish-admin" ? "Admin eingerichtet; bitte mit Passwort und Authenticator neu anmelden." : "Adminzugang auf sichere Neueinrichtung zurückgesetzt. Bestehende Sitzungen wurden entwertet.");
      } else {
        const mails = await service.localMails(args[0]);
        const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
        const output = join(root!, "auth-mail-preview.html");
        await dependencies.writeTextFile(output, `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Lokale Testmails</title><h1>Lokale Testmails</h1><p>Enthält zeitlich begrenzte Sicherheitslinks. Nicht weitergeben.</p>${mails.map(mail => `<p>${escape(mail.email)} · ${mail.purpose}: <a rel="noreferrer" href="${escape(mail.url)}">Testmail öffnen</a></p>`).join("")}</html>`, { mode: 0o600 });
        dependencies.output(`Lokale Vorschau unter ${output}; keine Links oder Geheimnisse im Terminal ausgegeben.`);
      }
    } finally { await database.close(); }
  } catch {
    // Do not forward DB/filesystem/library messages or parameters to terminal logs.
    throw new OperatorConfigError("operator_unavailable");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void runOperator(process.argv.slice(2)).catch(() => {
    console.error("Der Betreiberaufruf konnte nicht sicher abgeschlossen werden."); process.exitCode = 1;
  });
}
