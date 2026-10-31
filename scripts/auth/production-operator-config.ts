import { readProductionAuthConfig, type AuthEnvironment, type ProductionAuthConfig } from "../../src/lib/server/auth/production-config";

export class OperatorConfigError extends Error {
  constructor(readonly code: "invalid_operator_mode" | "invalid_operator_command" | "local_operator_only" | "operator_unavailable") {
    super("Der Betreiberaufruf ist in dieser Konfiguration nicht verfügbar.");
  }
}

/** Pure mode boundary. Either production marker requires the full production contract. */
export function productionOperatorConfig(env: AuthEnvironment, applicationRoot: string): ProductionAuthConfig | undefined {
  if (env.NODE_ENV === "production" || env.STEX_AUTH_MODE === "production") return readProductionAuthConfig(env, applicationRoot);
  if ((env.STEX_AUTH_MODE !== undefined && env.STEX_AUTH_MODE !== "local")
    || (env.NODE_ENV !== undefined && !["development", "test"].includes(env.NODE_ENV))) throw new OperatorConfigError("invalid_operator_mode");
  return undefined;
}

export type OperatorCommand = "init" | "prepare-admin" | "finish-admin" | "recover-admin" | "mail";
/** Validate before constructing resources or reading local secrets. */
export function operatorInvocation(argv: readonly string[], env: AuthEnvironment, applicationRoot: string) {
  const [command, ...args] = argv;
  const arities: Record<OperatorCommand, number> = { init: 0, "prepare-admin": 2, "finish-admin": 1, "recover-admin": 1, mail: 1 };
  if (!Object.hasOwn(arities, command ?? "") || args.length !== arities[command as OperatorCommand]) throw new OperatorConfigError("invalid_operator_command");
  const production = productionOperatorConfig(env, applicationRoot);
  if (production && (command === "init" || command === "mail")) throw new OperatorConfigError("local_operator_only");
  return { command: command as OperatorCommand, args, production };
}
