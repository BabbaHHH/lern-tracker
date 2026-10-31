import type { AuthEnvironment } from "../../src/lib/server/auth/production-config";
import { productionOperatorConfig } from "../auth/production-operator-config";

export type SearchWorkerMode = "once" | "watch" | "rebuild" | "status";
export class SearchWorkerConfigError extends Error {
  constructor(readonly code: "invalid_invocation" | "worker_unavailable") {
    super("Der Suchworker-Aufruf konnte nicht sicher abgeschlossen werden.");
  }
}

/** Pure preflight. Neither a production marker nor a missing argument selects a default action. */
export function searchWorkerInvocation(argv: readonly string[], env: AuthEnvironment, applicationRoot: string) {
  if (!argv.length || !["once", "watch", "rebuild", "status"].includes(argv[0])) {
    throw new SearchWorkerConfigError("invalid_invocation");
  }
  let maxBatches: number | undefined, pagesPerBatch: number | undefined;
  for (const option of argv.slice(1)) {
    const match = /^--(max-batches|pages-per-batch)=([1-9]\d*)$/.exec(option);
    if (!match || argv[0] === "status") throw new SearchWorkerConfigError("invalid_invocation");
    const value = Number(match[2]);
    if (!Number.isSafeInteger(value)) throw new SearchWorkerConfigError("invalid_invocation");
    if (match[1] === "max-batches") {
      if (maxBatches !== undefined || value > 1000) throw new SearchWorkerConfigError("invalid_invocation");
      maxBatches = value;
    } else {
      if (pagesPerBatch !== undefined || value > 8) throw new SearchWorkerConfigError("invalid_invocation");
      pagesPerBatch = value;
    }
  }
  // Reuse the exact shared operator contract, including production mode/TLS/path validation.
  const production = productionOperatorConfig(env, applicationRoot);
  return { mode: argv[0] as SearchWorkerMode, production: !!production,
    ...(maxBatches === undefined ? {} : { maxBatches }), ...(pagesPerBatch === undefined ? {} : { pagesPerBatch }) };
}
