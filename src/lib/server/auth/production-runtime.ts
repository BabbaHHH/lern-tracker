import type { AccountRuntimeBindings } from "./runtime";
import type { AccountService } from "./service";
import { AccountError } from "./security";
import { readProductionAuthConfig, type AuthEnvironment } from "./production-config";

/** Server/operator setting, never a public NEXT_PUBLIC value or request field.
 * This code implements the capability; setting it in a real environment requires
 * a separate operational release. Importing this module performs no resource I/O.
 */
export async function productionAccountRuntime(
  environment: AuthEnvironment,
  applicationRoot: string,
  dependencies: Pick<AccountRuntimeBindings, "database" | "files" | "service">,
): Promise<AccountService> {
  const config = readProductionAuthConfig(environment, applicationRoot);
  if (environment.STEX_AUTH_RUNTIME_RELEASE !== "operator-approved") {
    throw new AccountError("production_auth_not_released", "Die Produktionsanmeldung ist noch nicht freigegeben.", 503);
  }
  // Construct resources from the same validated snapshot; no local secret reads,
  // request migration, environment mutation or implicit mail/worker startup.
  let database: ReturnType<AccountRuntimeBindings["database"]> | undefined;
  try {
    database = dependencies.database(config.database);
    const files = dependencies.files(config.privateFileRoot);
    await files.initialize();
    return dependencies.service({ database, files, baseURL: config.baseURL, secret: config.secret, mailKey: config.mailKey });
  } catch {
    if (database) await database.close().catch(() => {});
    // Resource/library errors can contain credentials, paths or connection URIs.
    throw new AccountError("production_auth_initialization_failed", "Die Produktionsanmeldung ist derzeit nicht verfügbar.", 503);
  }
}
