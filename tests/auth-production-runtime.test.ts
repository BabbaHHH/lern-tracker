import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { PoolConfig } from "pg";
import { createAccountRuntime, type AccountRuntimeBindings } from "../src/lib/server/auth/runtime";
import { readProductionAuthConfig, ProductionAuthConfigError } from "../src/lib/server/auth/production-config";
import { AccountError, accountFailure } from "../src/lib/server/auth/security";
import type { AuthOptions, AccountService } from "../src/lib/server/auth/service";
import type { Database } from "../src/lib/server/persistence/database";
import type { PrivateFiles } from "../src/lib/server/persistence/files";

const material = (label: string) => createHash("sha512").update(`AUTH runtime fixture ${label}`).digest("base64url");
const root = "/srv/stex/releases/test-release";
const marker = "PRIVATE_RESOURCE_ERROR_MUST_NOT_ESCAPE";
function production(): Record<string, string | undefined> {
  return { NODE_ENV: "production", STEX_AUTH_MODE: "production", STEX_AUTH_RUNTIME_RELEASE: "operator-approved",
    BETTER_AUTH_URL: "https://pilot.example.test/", DATABASE_URL: `postgres://pilot:${material("db")}@db.example.test:5432/pilot`,
    STEX_DATABASE_TLS: "verify-full", STEX_PRIVATE_FILE_ROOT: "/srv/stex/data/files",
    BETTER_AUTH_SECRET: material("auth"), STEX_AUTH_MAIL_KEY: material("mail") };
}
type Failure = "database" | "files" | "initialize" | "service" | undefined;
function harness() {
  const calls = { reads: 0, configs: [] as PoolConfig[], paths: [] as string[], options: [] as AuthOptions[], initialize: 0, close: 0, forbidden: 0 };
  let failure: Failure, closeFails = false, wait: Promise<void> | undefined;
  const forbidden = () => { calls.forbidden++; throw new Error("Forbidden real operation"); };
  const database = { close: async () => { calls.close++; if (closeFails) throw new Error(marker); }, migrate: forbidden, transaction: forbidden, pool: { query: forbidden }, authPool: { query: forbidden } } as unknown as Database;
  const files = { initialize: async () => { calls.initialize++; await wait; if (failure === "initialize") throw new Error(marker); }, read: forbidden, put: forbidden } as unknown as PrivateFiles;
  const service = {} as AccountService;
  const dependencies: AccountRuntimeBindings = {
    readTextFile: async () => { calls.reads++; return material("local-file"); },
    database: config => { calls.configs.push(config); if (failure === "database") throw new Error(marker); return database; },
    files: path => { calls.paths.push(path); if (failure === "files") throw new Error(marker); return files; },
    service: options => { calls.options.push(options); if (failure === "service") throw new Error(marker); return service; },
  };
  return { calls, dependencies, service, database, files, fail: (value: Failure) => { failure = value; }, closeFails: () => { closeFails = true; }, wait: (value: Promise<void>) => { wait = value; } };
}
const code = (value: string) => (error: unknown) => error instanceof AccountError && error.status === 503 && error.code === value;
function noIO(h: ReturnType<typeof harness>) { assert.deepEqual(h.calls, { reads: 0, configs: [], paths: [], options: [], initialize: 0, close: 0, forbidden: 0 }); }

test("Runtime: fehlende oder ungenaue Betreiberfreigabe bleibt 503 ohne Ressourcen", async () => {
  for (const value of [undefined, "", "true", "1", "operator-approved ", "OPERATOR-APPROVED", "false"]) {
    const env = production(); env.STEX_AUTH_RUNTIME_RELEASE = value; const h = harness();
    await assert.rejects(createAccountRuntime(() => env, h.dependencies, () => root)(), code("production_auth_not_released")); noIO(h);
  }
});
test("Runtime: Request-/Header-/öffentliche und alte Readywerte können nicht freigeben", async () => {
  const env = production(); delete env.STEX_AUTH_RUNTIME_RELEASE;
  Object.assign(env, { NEXT_PUBLIC_STEX_AUTH_RUNTIME_RELEASE: "operator-approved", STEX_AUTH_PRODUCTION_READY: "1", STEX_AUTH_PRODUCTION_RELEASED: "true", host: "pilot.example.test", origin: "https://pilot.example.test", "x-stex-auth-runtime-release": "operator-approved" });
  const h = harness(); await assert.rejects(createAccountRuntime(() => env, h.dependencies, () => root)(), code("production_auth_not_released")); noIO(h);
});
test("Runtime: Betreiberfreigabe ersetzt weder Modus noch vollständige Konfiguration", async () => {
  for (const extra of [{ BETTER_AUTH_SECRET: undefined }, { NODE_ENV: "development" }, { STEX_AUTH_MODE: "prod" }, { STEX_AUTH_MODE: "local" }, { STEX_LOCAL_DATA_DIR: "/synthetic/local" }, { STEX_DATABASE_TLS: "disable" }, { STEX_PRIVATE_FILE_ROOT: root + "/files" }]) {
    const h = harness(); await assert.rejects(createAccountRuntime(() => ({ ...production(), ...extra }), h.dependencies, () => root)(), AccountError); noIO(h);
  }
});
test("Runtime: gültiger freigegebener Snapshot bindet exakt DB/TLS/Dateien/Origin/Secrets", async () => {
  const env = Object.freeze(production()), h = harness(), expected = readProductionAuthConfig(env, root);
  const run = createAccountRuntime(() => env, h.dependencies, () => root); assert.equal(await run(), h.service);
  assert.deepEqual(h.calls.configs, [expected.database]); assert.deepEqual(h.calls.paths, [expected.privateFileRoot]);
  assert.deepEqual(h.calls.options, [{ database: h.database, files: h.files, baseURL: expected.baseURL, secret: expected.secret, mailKey: expected.mailKey }]);
  assert.equal(h.calls.initialize, 1); assert.equal(h.calls.reads + h.calls.forbidden + h.calls.close, 0);
  assert.equal(h.calls.configs[0].connectionString, undefined);
});
test("Runtime: explizite Loopback-DB bleibt derselbe validierte Vertrag", async () => {
  const env = production(); env.DATABASE_URL = `postgres://pilot:${material("db")}@[::1]:55439/pilot`; env.STEX_DATABASE_TLS = "loopback";
  const h = harness(); await createAccountRuntime(() => env, h.dependencies, () => root)();
  assert.deepEqual(h.calls.configs, [readProductionAuthConfig(env, root).database]); assert.equal(h.calls.configs[0].ssl, false);
});
test("Runtime: konkurrierender Erstzugriff teilt genau einen Ressourcenaufbau", async () => {
  const h = harness(); let resume!: () => void; h.wait(new Promise<void>(resolve => { resume = resolve; }));
  const run = createAccountRuntime(production, h.dependencies, () => root), one = run(), two = run(); assert.equal(one, two);
  resume(); assert.equal(await one, h.service); assert.equal(await run(), h.service); assert.equal(h.calls.configs.length, 1); assert.equal(h.calls.initialize, 1);
});
for (const failure of ["database", "files", "initialize", "service"] as const) test(`Runtime: ${failure}-Fehler bereinigt Geheimnisse und erlaubt Wiederholung`, async () => {
  const h = harness(); h.fail(failure); const run = createAccountRuntime(production, h.dependencies, () => root);
  let caught: unknown; try { await run(); } catch (error) { caught = error; }
  assert.ok(code("production_auth_initialization_failed")(caught));
  assert.equal(h.calls.close, failure === "database" ? 0 : 1); assert.equal(h.calls.reads + h.calls.forbidden, 0);
  const response = accountFailure(caught); assert.equal(response.status, 503);
  assert.ok(!(String(caught) + JSON.stringify(caught) + await response.text()).includes(marker)); assert.equal((caught as Error).cause, undefined);
  h.fail(undefined); assert.equal(await run(), h.service); assert.equal(h.calls.configs.length, 2);
});
test("Runtime: auch fehlerhaftes Poolclose gibt keine Ressourcenursache aus", async () => {
  const h = harness(); h.fail("initialize"); h.closeFails();
  await assert.rejects(createAccountRuntime(production, h.dependencies, () => root)(), code("production_auth_initialization_failed")); assert.equal(h.calls.close, 1);
});
test("Runtime: Releaseentzug und relevante Snapshotänderungen verlangen Neustart", async () => {
  for (const extra of [{ STEX_AUTH_RUNTIME_RELEASE: undefined }, { STEX_AUTH_RUNTIME_RELEASE: "false" }, { BETTER_AUTH_URL: "https://other.example.test" }, { BETTER_AUTH_SECRET: material("other") }, { STEX_AUTH_MAIL_KEY: material("other-mail") }, { DATABASE_URL: production().DATABASE_URL?.replace("5432", "5433") }, { STEX_DATABASE_TLS: "loopback" }, { STEX_PRIVATE_FILE_ROOT: "/srv/stex/other" }, { STEX_AUTH_MODE: "local" }]) {
    const env = production(), h = harness(), run = createAccountRuntime(() => env, h.dependencies, () => root); await run(); Object.assign(env, extra);
    await assert.rejects(run(), code("auth_configuration_changed")); assert.equal(h.calls.configs.length, 1); assert.equal(h.calls.options.length, 1);
  }
});
test("Runtime: Releasepfadänderung verlangt Neustart, fremde Requestwerte bleiben wirkungslos", async () => {
  const env = production(), h = harness(); let location = root; const run = createAccountRuntime(() => env, h.dependencies, () => location); await run();
  env.HTTP_HOST = "attacker.example.test"; env.NEXT_PUBLIC_STEX_AUTH_RUNTIME_RELEASE = "false"; assert.equal(await run(), h.service);
  location = root + "-new"; await assert.rejects(run(), code("auth_configuration_changed")); assert.equal(h.calls.configs.length, 1);
});
test("Runtime: Konfiguration wird vor asynchronem Ressourcenaufbau kopiert", async () => {
  const env = production(), expected = readProductionAuthConfig(env, root), h = harness(); let resume!: () => void;
  h.wait(new Promise<void>(resolve => { resume = resolve; })); const run = createAccountRuntime(() => env, h.dependencies, () => root), pending = run();
  env.BETTER_AUTH_SECRET = material("changed-during-init"); resume(); await pending;
  assert.equal(h.calls.options[0].secret, expected.secret); await assert.rejects(run(), code("auth_configuration_changed"));
});
test("Runtime: lokaler Modus bleibt lokal und Betreiberflag erzeugt keinen Produktionswechsel", async () => {
  const h = harness(), env = { NODE_ENV: "test", STEX_AUTH_MODE: "local", BETTER_AUTH_URL: "http://localhost:3001", STEX_AUTH_RUNTIME_RELEASE: "operator-approved" };
  await createAccountRuntime(() => env, h.dependencies, () => "/synthetic/app")();
  assert.equal(h.calls.reads, 3); assert.equal(h.calls.configs[0].host, "127.0.0.1"); assert.equal(h.calls.configs[0].port, 55432); assert.equal(h.calls.initialize, 1); assert.equal(h.calls.forbidden, 0);
});
test("Runtime: Eingaben und Prozessumgebung bleiben unverändert; Konfigfehler bleiben geschlossen", async () => {
  const before = createHash("sha256").update(JSON.stringify(process.env)).digest("hex"), env = Object.freeze(production()), copy = JSON.stringify(env), h = harness();
  await createAccountRuntime(() => env, h.dependencies, () => root)(); assert.equal(JSON.stringify(env), copy);
  assert.equal(createHash("sha256").update(JSON.stringify(process.env)).digest("hex"), before);
  const invalid = harness(); await assert.rejects(createAccountRuntime(() => ({ ...production(), DATABASE_URL: "invalid" }), invalid.dependencies, () => root)(), ProductionAuthConfigError); noIO(invalid);
});
