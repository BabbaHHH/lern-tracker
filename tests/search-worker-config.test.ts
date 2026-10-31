import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { PoolConfig } from "pg";
import { configuredPersistence, type PersistenceBindings } from "../scripts/data-migration/local-config";
import { bindSearchWorkerSignals, runSearchWorker, waitForSearchWork, type SearchWorkerBindings } from "../scripts/search/worker.mjs";
import { SearchWorkerConfigError, searchWorkerInvocation } from "../scripts/search/worker-config";
import { readProductionAuthConfig } from "../src/lib/server/auth/production-config";
import type { Database } from "../src/lib/server/persistence/database";
import type { PrivateFiles } from "../src/lib/server/persistence/files";

// Entirely fictitious configuration. No process.env mutation, sockets, real DBs or originals.
const root = "/srv/stex/releases/search-config-fixture";
const material = (name: string) => createHash("sha256").update(`search-config-fixture:${name}`).digest("base64url");
const local = { NODE_ENV: "test", STEX_AUTH_MODE: "local" };
function production(): Record<string, string | undefined> {
  return { NODE_ENV: "production", STEX_AUTH_MODE: "production", BETTER_AUTH_URL: "https://pilot.example.test",
    DATABASE_URL: `postgres://stex_search:${material("db")}@postgres.example.test:5432/stex_pilot`,
    STEX_DATABASE_TLS: "verify-full", STEX_PRIVATE_FILE_ROOT: "/srv/stex/data/files",
    BETTER_AUTH_SECRET: material("auth"), STEX_AUTH_MAIL_KEY: material("mail") };
}
function harness() {
  const calls = { database: [] as PoolConfig[], files: [] as string[], reads: [] as string[], work: 0,
    discover: [] as boolean[], step: 0, pause: 0, close: 0, detach: 0, forbidden: 0 };
  const listeners = new Map<string, () => void>();
  let steps = [false], fail = "", onOpen = () => {};
  let onDiscover: (count: number) => void = () => {}, onStep: (signal: AbortSignal) => void = () => {};
  const denied = () => { calls.forbidden++; throw new Error("Forbidden synthetic I/O"); };
  const database = { close: async () => { calls.close++; if (fail === "close") throw new Error(material("db")); },
    migrate: denied, transaction: denied, pool: { query: denied } } as unknown as Database;
  const files = { read: denied, put: denied, initialize: denied } as unknown as PrivateFiles;
  const persistence: PersistenceBindings = {
    database: config => { calls.database.push(config); return database; },
    files: path => { calls.files.push(path); if (fail === "files") throw new Error(material("mail")); return files; },
    readTextFile: async path => { calls.reads.push(path); if (fail === "read") throw new Error(material("db")); return ` ${material("local-password")}\n`; },
  };
  const bindings: SearchWorkerBindings = {
    persistence: async (env, base) => { const resources = await configuredPersistence(env, base, persistence); onOpen(); return resources; },
    work: (db, storage) => {
      assert.equal(db, database); assert.equal(storage, files); calls.work++;
      if (fail === "work") throw new Error(material("auth"));
      return {
        discover: async rebuild => { calls.discover.push(rebuild); onDiscover(calls.discover.length); if (fail === "discover") throw new Error(material("auth")); },
        step: async ({ signal }) => { calls.step++; onStep(signal); if (fail === "step") throw new Error(material("db")); signal.throwIfAborted(); return steps.shift() ?? false; },
      };
    },
    signals: stop => {
      const detach = bindSearchWorkerSignals(stop, { on: (name, handler) => listeners.set(name, handler),
        removeListener: (name, handler) => { assert.equal(listeners.get(name), handler); listeners.delete(name); } });
      return () => { calls.detach++; detach(); };
    },
    pause: async signal => { calls.pause++; if (fail === "pause") throw new Error(material("db")); listeners.get("SIGTERM")!(); assert.equal(signal.aborted, true); },
  };
  return { calls, bindings, listeners, database, files,
    steps: (value: boolean[]) => { steps = value; }, fail: (value: string) => { fail = value; },
    stop: (signal = "SIGTERM") => { const stop = listeners.get(signal); assert.ok(stop); stop(); },
    onOpen: (fn: () => void) => { onOpen = fn; }, onDiscover: (fn: (count: number) => void) => { onDiscover = fn; },
    onStep: (fn: (signal: AbortSignal) => void) => { onStep = fn; } };
}
const noResources = (h: ReturnType<typeof harness>) => {
  assert.equal(h.calls.database.length + h.calls.files.length + h.calls.reads.length + h.calls.work + h.calls.close, 0);
  assert.equal(h.listeners.size, 0);
};
const closed = (h: ReturnType<typeof harness>) => {
  assert.equal(h.calls.close, 1); assert.equal(h.calls.detach, 1); assert.equal(h.listeners.size, 0); assert.equal(h.calls.forbidden, 0);
};

for (const mode of ["once", "watch", "rebuild"] as const) {
  test(`SEARCH07: production ${mode} uses shared validated DB/TLS/files without public auth runtime`, async () => {
    const h = harness(), env = production(), original = { ...env };
    const expected = readProductionAuthConfig(env, root);
    if (mode !== "watch") h.steps([true, false]);
    await runSearchWorker([mode], env, root, h.bindings);
    assert.deepEqual(h.calls.database, [expected.database]); assert.deepEqual(h.calls.files, [expected.privateFileRoot]);
    assert.equal(h.calls.database[0].connectionString, undefined); assert.deepEqual(h.calls.reads, []);
    assert.equal(h.calls.discover.filter(Boolean).length, mode === "rebuild" ? 1 : 0);
    assert.equal(h.calls.discover[0], mode === "rebuild"); assert.equal(h.calls.pause, mode === "watch" ? 1 : 0);
    assert.deepEqual(env, original); closed(h);
  });
}
test("SEARCH07: local once/watch/rebuild retain local password and default file contract", async () => {
  for (const mode of ["once", "watch", "rebuild"]) {
    const h = harness(); await runSearchWorker([mode], local, root, h.bindings);
    assert.deepEqual(h.calls.reads, [`${root}/db/.local/postgres-password`]);
    assert.deepEqual(h.calls.files, [`${root}/db/.local/files`]);
    assert.equal(h.calls.database[0].host, "127.0.0.1"); assert.equal(h.calls.database[0].port, 55432);
    assert.equal(h.calls.database[0].password, material("local-password")); closed(h);
  }
});
test("SEARCH07: explicit local overrides pass through configuredPersistence", async () => {
  const h = harness();
  await runSearchWorker(["once"], { ...local, STEX_LOCAL_DATA_DIR: "/opt/local/data", STEX_LOCAL_POSTGRES_PORT: "55439", STEX_PRIVATE_FILE_ROOT: "/opt/local/files" }, root, h.bindings);
  assert.deepEqual(h.calls.reads, ["/opt/local/data/postgres-password"]); assert.deepEqual(h.calls.files, ["/opt/local/files"]);
  assert.equal(h.calls.database[0].port, 55439); closed(h);
});
test("SEARCH07: loopback production contract is reused without adding a TLS/URI fallback", async () => {
  const env = { ...production(), DATABASE_URL: `postgres://stex_search:${material("db")}@127.0.0.1:5432/stex_pilot`, STEX_DATABASE_TLS: "loopback" };
  const h = harness(); await runSearchWorker(["once"], env, root, h.bindings);
  assert.deepEqual(h.calls.database, [readProductionAuthConfig(env, root).database]); closed(h);
});
test("SEARCH07: missing/unknown/extra command never defaults to work, rebuild or resource access", async () => {
  for (const argv of [[], [""], ["start"], ["migrate"], ["once", "extra"], ["rebuild", "extra"]]) {
    const h = harness(); await assert.rejects(runSearchWorker(argv, production(), root, h.bindings), SearchWorkerConfigError); noResources(h);
  }
});
test("SEARCH07: either production marker requires the entire production contract", async () => {
  for (const env of [{ NODE_ENV: "production", STEX_AUTH_MODE: "local" }, { NODE_ENV: "test", STEX_AUTH_MODE: "production" },
    { ...production(), STEX_AUTH_MAIL_KEY: undefined }, { ...production(), STEX_LOCAL_DATA_DIR: "/local-fallback" },
    { ...production(), DATABASE_URL: `${production().DATABASE_URL}?sslmode=disable` }, { ...production(), STEX_DATABASE_TLS: "disable" },
    { ...production(), STEX_PRIVATE_FILE_ROOT: `${root}/private` }]) {
    const h = harness(); await assert.rejects(runSearchWorker(["once"], env, root, h.bindings)); noResources(h);
  }
});
test("SEARCH07: invalid local mode and missing local password cannot create resources", async () => {
  for (const env of [{ NODE_ENV: "staging" }, { STEX_AUTH_MODE: "disabled" }]) {
    const h = harness(); await assert.rejects(runSearchWorker(["once"], env, root, h.bindings)); noResources(h);
  }
  const h = harness(); h.fail("read"); await assert.rejects(runSearchWorker(["once"], local, root, h.bindings), SearchWorkerConfigError);
  assert.equal(h.calls.database.length, 0); assert.equal(h.calls.reads.length, 1); assert.equal(h.calls.detach, 1); assert.equal(h.listeners.size, 0);
});
for (const failure of ["files", "work", "discover", "step", "pause", "close"]) {
  test(`SEARCH07: ${failure} failure closes once, detaches signals and redacts raw causes`, async () => {
    const h = harness(); h.fail(failure);
    await assert.rejects(runSearchWorker([failure === "pause" ? "watch" : "once"], production(), root, h.bindings), error => {
      assert.ok(error instanceof SearchWorkerConfigError); assert.equal(error.code, "worker_unavailable");
      assert.ok(!String(error).includes(material("db")) && !String(error).includes("postgres://")); return true;
    });
    closed(h);
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  test(`SEARCH07: instrumented ${signal} aborts an active step and closes without further actions`, async () => {
    const h = harness(); h.onStep(() => h.stop(signal));
    await runSearchWorker(["watch"], production(), root, h.bindings);
    assert.equal(h.calls.step, 1); assert.equal(h.calls.pause, 0); closed(h);
  });
}
test("SEARCH07: stop during acquisition closes resources before constructing any work", async () => {
  const h = harness(); h.onOpen(() => h.stop());
  await runSearchWorker(["rebuild"], production(), root, h.bindings);
  assert.equal(h.calls.work, 0); assert.deepEqual(h.calls.discover, []); closed(h);
});
test("SEARCH07: stop during discovery prevents even the first worker step", async () => {
  for (const stopAt of [1, 2]) {
    const h = harness(); h.onDiscover(count => { if (count === stopAt) h.stop(); });
    await runSearchWorker(["once"], production(), root, h.bindings);
    assert.equal(h.calls.step, 0); assert.equal(h.calls.discover.length, stopAt); closed(h);
  }
});
test("SEARCH07: close failure remains visible even after cancellation", async () => {
  const h = harness(); h.onStep(() => h.stop()); h.fail("close");
  await assert.rejects(runSearchWorker(["watch"], production(), root, h.bindings), SearchWorkerConfigError); closed(h);
});
test("SEARCH07: idle wait handles already-aborted and promptly-aborted signals without a live timer", async () => {
  const already = new AbortController(); already.abort(); await waitForSearchWork(already.signal);
  const pending = new AbortController(); const waited = waitForSearchWork(pending.signal); pending.abort(); await waited;
});
test("SEARCH07: import and pure preflight have no CLI, signal or resource side effects", async () => {
  const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
  const entry = await import("../scripts/search/worker.mjs"); assert.equal(typeof entry.runSearchWorker, "function");
  assert.deepEqual(searchWorkerInvocation(["once"], local, root), { mode: "once", production: false });
  assert.deepEqual(searchWorkerInvocation(["rebuild"], production(), root), { mode: "rebuild", production: true });
  assert.deepEqual([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")], before);
  // Source-only proof of the default linkage; does not execute any real worker/resource factory.
  const source = await readFile(new URL("../scripts/search/worker.mts", import.meta.url), "utf8");
  assert.ok(!source.includes("accountRuntime") && !source.includes("AccountService"));
  assert.ok(source.includes("persistence: configuredPersistence") && source.includes("import.meta.url === pathToFileURL"));
});
