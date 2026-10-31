import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { configuredPersistence } from "../data-migration/local-config";
import type { AuthEnvironment } from "../../src/lib/server/auth/production-config";
import type { Database } from "../../src/lib/server/persistence/database";
import type { PrivateFiles } from "../../src/lib/server/persistence/files";
import { PostgresSearchStore } from "../../src/lib/server/search/store";
import { SearchWorker } from "../../src/lib/server/search/worker";
import { SearchWorkerConfigError, searchWorkerInvocation } from "./worker-config";
import type { SearchIndexSummary } from "../../src/lib/search/catalog-contract";

export interface SearchWork {
  discover(rebuild: boolean): Promise<unknown>;
  step(options: { signal: AbortSignal; maxPages?: number }): Promise<boolean>;
  status?(): Promise<SearchIndexSummary>;
}
export interface SearchWorkerBindings {
  persistence: typeof configuredPersistence;
  work(database: Database, files: PrivateFiles): SearchWork;
  signals(stop: () => void): () => void;
  pause(signal: AbortSignal): Promise<void>;
  output?(value: string): void;
}
interface SearchSignalSource {
  on(signal: "SIGINT" | "SIGTERM", stop: () => void): unknown;
  removeListener(signal: "SIGINT" | "SIGTERM", stop: () => void): unknown;
}
export function bindSearchWorkerSignals(stop: () => void, source: SearchSignalSource = process): () => void {
  source.on("SIGINT", stop); source.on("SIGTERM", stop);
  return () => { source.removeListener("SIGINT", stop); source.removeListener("SIGTERM", stop); };
}

export function waitForSearchWork(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, 2000);
    signal.addEventListener("abort", finish, { once: true });
  });
}
const bindings: SearchWorkerBindings = {
  persistence: configuredPersistence,
  work: (database, files) => {
    const store = new PostgresSearchStore(database), worker = new SearchWorker(store, files);
    return { discover: rebuild => store.discover(rebuild), step: options => worker.step(options), status: () => store.status() };
  },
  signals: bindSearchWorkerSignals,
  pause: waitForSearchWork,
  output: value => console.log(value),
};

/** Operator entry only: import is inert; tests can instrument every resource/action. */
export async function runSearchWorker(
  argv: readonly string[], environment: AuthEnvironment = process.env,
  applicationRoot: string = process.cwd(), dependencies: SearchWorkerBindings = bindings,
): Promise<void> {
  const env = { ...environment };
  const { mode, maxBatches, pagesPerBatch } = searchWorkerInvocation(argv, env, applicationRoot);
  const cancellation = new AbortController();
  let database: Database | undefined, detach: (() => void) | undefined, failed = false;
  try {
    detach = dependencies.signals(() => cancellation.abort());
    const resources = await dependencies.persistence(env, applicationRoot);
    database = resources.database;
    if (!cancellation.signal.aborted) {
      const work = dependencies.work(database, resources.files);
      let batches = 0, stopped = mode === "status" ? "status" : "idle";
      if (mode !== "status") {
        await work.discover(mode === "rebuild");
        while (!cancellation.signal.aborted) {
          await work.discover(false);
          if (cancellation.signal.aborted) break;
          const worked = await work.step({ signal: cancellation.signal, ...(pagesPerBatch ? { maxPages: pagesPerBatch } : {}) });
          if (worked) batches++;
          if (maxBatches !== undefined && batches >= maxBatches) { stopped = "batch_limit"; break; }
          if (!worked && mode !== "watch") break;
          if (!worked) await dependencies.pause(cancellation.signal);
        }
      }
      if (!cancellation.signal.aborted && dependencies.output) {
        if (!work.status) throw new SearchWorkerConfigError("worker_unavailable");
        const status = await work.status();
        // Whitelist numeric aggregates even for an instrumented or future status implementation.
        const keys: (keyof SearchIndexSummary)[] = ["documents", "readyDocuments", "pendingDocuments", "missingTextDocuments", "failedDocuments", "readyPages", "missingTextPages", "failedPages", "pendingPages"];
        const index = Object.fromEntries(keys.map(key => {
          const value = status[key];
          if (!Number.isSafeInteger(value) || value < 0) throw new SearchWorkerConfigError("worker_unavailable");
          return [key, value];
        }));
        dependencies.output(JSON.stringify({ mode, batches, stopped, index }));
      }
    }
  } catch { failed = !cancellation.signal.aborted; }
  finally {
    try { await database?.close(); } catch { failed = true; }
    try { detach?.(); } catch { failed = true; }
  }
  // Even after a signal, a failed close is an error; never emit raw URI/credential causes.
  if (failed) throw new SearchWorkerConfigError("worker_unavailable");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void runSearchWorker(process.argv.slice(2)).catch(() => {
    console.error("Der Suchworker-Aufruf konnte nicht sicher abgeschlossen werden."); process.exitCode = 1;
  });
}
