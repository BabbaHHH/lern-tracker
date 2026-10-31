import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { PoolConfig } from "pg";
import { readProductionAuthConfig, ProductionAuthConfigError, type AuthEnvironment } from "../src/lib/server/auth/production-config";
import { createAccountRuntime, type AccountRuntimeBindings } from "../src/lib/server/auth/runtime";
import { AccountError, accountFailure } from "../src/lib/server/auth/security";
import type { Database } from "../src/lib/server/persistence/database";
import type { PrivateFiles } from "../src/lib/server/persistence/files";
import type { AccountService, AuthOptions } from "../src/lib/server/auth/service";

// Synthetic configuration only: never read .env, existing keys, files, DB or network.
const material = (label: string) => createHash("sha512").update(`AUTH03 configuration fixture ${label}`).digest("base64url");
const release = "/srv/stex/releases/release-a";
function production(): Record<string, string | undefined> {
  return { NODE_ENV: "production", STEX_AUTH_MODE: "production", BETTER_AUTH_URL: "https://pilot.example.org",
    DATABASE_URL: `postgresql://stex_auth:${material("db")}@postgres.example.org:5432/stex_pilot`, STEX_DATABASE_TLS: "verify-full",
    STEX_PRIVATE_FILE_ROOT: "/srv/stex/data/files", BETTER_AUTH_SECRET: material("auth"), STEX_AUTH_MAIL_KEY: material("mail") };
}
function rejected(env: AuthEnvironment, field?: string) {
  assert.throws(() => readProductionAuthConfig(env, release), (error: unknown) => error instanceof ProductionAuthConfigError && error.status === 503 && (!field || error.field === field));
}
function harness() {
  const calls: { reads: string[]; db: PoolConfig[]; paths: string[]; service: AuthOptions[]; init: number; close: number; migrations: number } = { reads: [], db: [], paths: [], service: [], init: 0, close: 0, migrations: 0 };
  let failInitialize = false, failService = false;
  const database = { close: async () => { calls.close++; }, migrate: async () => { calls.migrations++; throw new Error("Request migration must never run"); } } as unknown as Database;
  const files = { initialize: async () => { calls.init++; if (failInitialize) throw new Error("synthetic file failure"); } } as unknown as PrivateFiles;
  const service = {} as AccountService;
  const bindings: AccountRuntimeBindings = {
    readTextFile: async path => { calls.reads.push(path); return ` ${material(path)}\n`; },
    database: config => { calls.db.push(config); return database; },
    files: root => { calls.paths.push(root); return files; },
    service: options => { calls.service.push(options); if (failService) throw new Error("synthetic constructor failure"); return service; },
  };
  return { calls, bindings, service, failFiles: (value: boolean) => { failInitialize = value; }, failService: (value: boolean) => { failService = value; } };
}
function noIO(h: ReturnType<typeof harness>) {
  assert.equal(h.calls.reads.length + h.calls.db.length + h.calls.paths.length + h.calls.service.length + h.calls.init + h.calls.close + h.calls.migrations, 0);
}

test("AUTH03: vollständiger expliziter Vertrag erzeugt feste Origin und verifizierendes pg-TLS", () => {
  const value = readProductionAuthConfig(production(), release);
  assert.equal(value.baseURL, "https://pilot.example.org");
  assert.equal(value.database.host, "postgres.example.org"); assert.equal(value.database.port, 5432);
  assert.equal(value.database.user, "stex_auth"); assert.equal(value.database.database, "stex_pilot");
  assert.deepEqual(value.database.ssl, { rejectUnauthorized: true }); assert.equal(value.database.connectionTimeoutMillis, 5000);
  assert.equal(value.database.connectionString, undefined); assert.equal(value.privateFileRoot, "/srv/stex/data/files");
  assert.ok(value.secret !== value.mailKey);
});
test("AUTH03: explizite Loopback-DB ist möglich, niemals ein versteckter Fallback", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    const env = production(); env.DATABASE_URL = `postgres://stex_auth:${material("db")}@${host}:55433/stex_pilot`; env.STEX_DATABASE_TLS = "loopback";
    const config = readProductionAuthConfig(env, release); assert.equal(config.database.ssl, false); assert.equal(config.database.port, 55433); assert.equal(config.database.host, host.replace(/^\[|\]$/g, ""));
  }
  const env = production(); env.STEX_DATABASE_TLS = "loopback"; rejected(env, "STEX_DATABASE_TLS");
});
test("AUTH03: fehlende und leere Pflichtwerte bleiben geschlossen", () => {
  for (const key of Object.keys(production())) for (const missing of [undefined, "", " "]) { const env = production(); env[key] = missing; rejected(env); }
});
test("AUTH03: HTTP, lokale/numerische Hosts, Pfade, Zugangsdaten und Redirectteile sind keine HTTPS-Origin", () => {
  for (const value of ["http://pilot.example.org", "https://localhost", "https://x.localhost", "https://127.1", "https://2130706433", "https://[::1]", "https://192.0.2.4", "https://pilot.example.org/app", "https://pilot.example.org/../", "https://pilot.example.org/?token=private", "https://pilot.example.org/#x", "https://user:private@pilot.example.org", "https://*.example.org", "https://pilot.example.org.", "invalid", " https://pilot.example.org"]) {
    const env = production(); env.BETTER_AUTH_URL = value; rejected(env, "BETTER_AUTH_URL");
  }
  const env = production(); env.BETTER_AUTH_URL = "https://pilot.example.org/"; assert.equal(readProductionAuthConfig(env, release).baseURL, "https://pilot.example.org");
});
test("AUTH03: DB braucht eigenes Protokoll, Host, Port, Benutzer, Passwort und Datenbank", () => {
  for (const value of ["https://u:password@db.example.org:5432/db", "postgres://db.example.org:5432/db", "postgres://u@db.example.org:5432/db", "postgres://u:short@db.example.org:5432/db", "postgres://u:password123456789@db.example.org/db", `postgres://u:${material("db")}@db.example.org:5432`, `postgres://u:${material("db")}@db.example.org:5432/one/two`, `postgres://u:${material("db")}@db.example.org:0/db`, `postgres://u:${material("db")}@db.example.org:65536/db`, `postgres://u:${material("db")}@db.example.org:5432/db#private`, `postgres://u:${material("db")}@db.example.org:5432/%GG`]) {
    const env = production(); env.DATABASE_URL = value; rejected(env, "DATABASE_URL");
  }
});
test("AUTH03: URI-/TLS-Overrides können den gewählten DB-/Prüfvertrag nicht verändern", () => {
  for (const suffix of ["?sslmode=disable", "?sslmode=require", "?ssl=true", "?host=127.0.0.1", "?user=other", "?password=private", "?options=-csearch_path%3Dpublic"]) { const env = production(); env.DATABASE_URL += suffix; rejected(env, "DATABASE_URL"); }
  for (const mode of ["false", "disable", "require", "no-verify", "VERIFY-FULL"]) { const env = production(); env.STEX_DATABASE_TLS = mode; rejected(env, "STEX_DATABASE_TLS"); }
});
test("AUTH03: Prozentkodierte DB-Zugangsdaten werden genau einmal dekodiert", () => {
  const env = production(), dbPassword = "r1+percent%20:at@slash/valid";
  env.DATABASE_URL = `postgres://stex%2Eauth:${encodeURIComponent(dbPassword)}@db.example.org:5432/stex_pilot`;
  const value = readProductionAuthConfig(env, release); assert.equal(value.database.user, "stex.auth"); assert.ok(value.database.password === dbPassword);
});
test("AUTH03: private Wurzel ist absolut, kanonisch und außerhalb Release/public und Entwicklungsablagen", () => {
  for (const path of ["files", "/", "/srv/stex/data/../files", "/srv/stex//files", "/srv/stex/files/", release, release + "/data", "/srv/public/files", "/srv/PUBLIC/files", "/srv/db/.local/files", "/srv/.next/files", "/srv/node_modules/files", "/srv/.git/files"]) {
    const env = production(); env.STEX_PRIVATE_FILE_ROOT = path; rejected(env, "STEX_PRIVATE_FILE_ROOT");
  }
  assert.equal(readProductionAuthConfig({ ...production(), STEX_PRIVATE_FILE_ROOT: release + "-data" }, release).privateFileRoot, release + "-data");
});
test("AUTH03: ein fehlender/nicht kanonischer Releasekontext kann keine private Wurzel legitimieren", () => {
  for (const root of ["/", "relative", "/srv/stex/releases/../current", "/srv/stex//release"]) assert.throws(() => readProductionAuthConfig(production(), root), (error: unknown) => error instanceof ProductionAuthConfigError && error.field === "application_root");
});
test("AUTH03: kurze, repetitive, Platzhalter- und mehrfach verwendete Geheimnisse werden abgewiesen", () => {
  for (const value of ["x".repeat(64), "abcd0123456789_-".repeat(4), "changeme_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdef", material("auth").slice(0, 32), material("auth") + "\n"]) for (const key of ["BETTER_AUTH_SECRET", "STEX_AUTH_MAIL_KEY"]) {
    const env = production(); env[key] = value; rejected(env, key);
  }
  const same = production(); same.STEX_AUTH_MAIL_KEY = same.BETTER_AUTH_SECRET; rejected(same, "separate_secrets");
  const reused = production(); reused.DATABASE_URL = `postgres://stex_auth:${reused.BETTER_AUTH_SECRET}@db.example.org:5432/stex_pilot`; rejected(reused, "separate_secrets");
});
test("AUTH03: Produktionsmodus akzeptiert weder lokale Geheimnispfade noch lokalen Port-Fallback", () => {
  for (const key of ["STEX_LOCAL_DATA_DIR", "STEX_LOCAL_POSTGRES_PORT"]) for (const value of ["", "/tmp/synthetic-local", "55432"]) rejected({ ...production(), [key]: value }, "local_fallback");
});
test("AUTH03: Konfigurationsfehler geben keine Werte oder ursprünglichen Parserursachen aus", async () => {
  const env = production(), marker = "PRIVATE_MUST_NOT_APPEAR_123456789"; env.DATABASE_URL = `postgres://user:${marker}@bad host/db`;
  let caught: unknown; try { readProductionAuthConfig(env, release); } catch (error) { caught = error; }
  assert.ok(caught instanceof ProductionAuthConfigError); const publicResponse = accountFailure(caught);
  assert.equal(publicResponse.status, 503); const output = JSON.stringify(caught) + String(caught) + await publicResponse.text();
  assert.ok(!output.includes(marker)); assert.ok(!output.includes(env.DATABASE_URL)); assert.equal((caught as Error & {cause?: unknown}).cause, undefined);
});

test("AUTH03: gültige Produktion bleibt ausdrücklich 503 vor jedem Ressourcen-/Secretzugriff", async () => {
  const h = harness(), env = production(), run = createAccountRuntime(() => env, h.bindings, () => release);
  await assert.rejects(run(), (error: unknown) => error instanceof AccountError && error.code === "production_auth_not_released" && error.status === 503); noIO(h);
  env.STEX_AUTH_PRODUCTION_READY = "1"; env.STEX_AUTH_PRODUCTION_RELEASED = "true";
  await assert.rejects(run(), (error: unknown) => error instanceof AccountError && error.code === "production_auth_not_released"); noIO(h);
});
test("AUTH03: ungültige Produktionskonfiguration kann nie in lokalen Modus ausweichen", async () => {
  const h = harness(), env = production(); delete env.BETTER_AUTH_SECRET;
  await assert.rejects(createAccountRuntime(() => env, h.bindings, () => release)(), ProductionAuthConfigError); noIO(h);
});
test("AUTH03: fehlende/unbekannte/gemischte Modi und ungültige lokale URL bleiben ohne IO geschlossen", async () => {
  for (const env of [ {}, { STEX_AUTH_MODE: "prod" }, { STEX_AUTH_MODE: "production", NODE_ENV: "development" }, { STEX_AUTH_MODE: "local", NODE_ENV: "production", BETTER_AUTH_URL: "http://localhost:3001" }, { STEX_AUTH_MODE: "local", BETTER_AUTH_URL: "malformed" }, { STEX_AUTH_MODE: "local", BETTER_AUTH_URL: "https://pilot.example.org" }, { STEX_AUTH_MODE: "local", BETTER_AUTH_URL: "ftp://localhost" } ]) {
    const h = harness(); await assert.rejects(createAccountRuntime(() => env, h.bindings, () => release)(), AccountError); noIO(h);
  }
});
test("AUTH03: lokaler Vertrag behält Dateien, pg-Ziel, Initialisierung und gemeinsame Lazy-Instanz", async () => {
  const h = harness(), env = { NODE_ENV: "development", STEX_AUTH_MODE: "local", BETTER_AUTH_URL: "http://localhost:3001" }, run = createAccountRuntime(() => env, h.bindings, () => "/synthetic/app");
  const one = run(), two = run(); assert.equal(one, two); assert.equal(await one, h.service); assert.equal(await run(), h.service);
  assert.deepEqual(h.calls.reads, ["/synthetic/app/db/.local/auth-secret", "/synthetic/app/db/.local/auth-mail-key", "/synthetic/app/db/.local/postgres-password"]);
  assert.equal(h.calls.db.length, 1); assert.equal(h.calls.db[0].host, "127.0.0.1"); assert.equal(h.calls.db[0].port, 55432); assert.equal(h.calls.db[0].user, "stex_local"); assert.equal(h.calls.db[0].database, "stex_local");
  assert.deepEqual(h.calls.paths, ["/synthetic/app/db/.local/files"]); assert.equal(h.calls.init, 1); assert.equal(h.calls.service[0].baseURL, env.BETTER_AUTH_URL); assert.equal(h.calls.migrations, 0); assert.equal(h.calls.close, 0);
});
test("AUTH03: explizite lokale Überschreibungen bleiben erhalten, Host aus DB-Umgebung wird ignoriert", async () => {
  const h = harness(), env = { NODE_ENV: "test", STEX_AUTH_MODE: "local", BETTER_AUTH_URL: "http://127.0.0.1:4001", STEX_LOCAL_DATA_DIR: "/synthetic/private", STEX_LOCAL_POSTGRES_PORT: "55435", STEX_PRIVATE_FILE_ROOT: "/synthetic/files", BETTER_AUTH_SECRET: material("local-override"), DATABASE_URL: "postgres://must-not-use.invalid/db" };
  await createAccountRuntime(() => env, h.bindings, () => "/synthetic/app")(); assert.equal(h.calls.reads.length, 2); assert.ok(h.calls.reads.every(path => !path.endsWith("auth-secret"))); assert.equal(h.calls.db[0].port, 55435); assert.equal(h.calls.db[0].host, "127.0.0.1"); assert.deepEqual(h.calls.paths, [env.STEX_PRIVATE_FILE_ROOT]);
});
test("AUTH03: fehlerhafte lokale Pfade/Ports öffnen keine Dateien/Verbindungen", async () => {
  for (const extra of [{ STEX_LOCAL_DATA_DIR: "relative" }, { STEX_LOCAL_POSTGRES_PORT: "NaN" }, { STEX_LOCAL_POSTGRES_PORT: "0" }, { STEX_LOCAL_POSTGRES_PORT: "65536" }]) { const h = harness(); await assert.rejects(createAccountRuntime(() => ({ STEX_AUTH_MODE: "local", BETTER_AUTH_URL: "http://localhost", ...extra }), h.bindings)(), AccountError); noIO(h); }
});
test("AUTH03: lokale Initialisierungs-/Konstruktorfehler schließen Ressourcen und erlauben kontrollierte Wiederholung", async () => {
  for (const failure of ["files", "service"]) {
    const h = harness(), run = createAccountRuntime(() => ({ STEX_AUTH_MODE: "local", BETTER_AUTH_URL: "http://localhost" }), h.bindings, () => "/synthetic/app");
    if (failure === "files") h.failFiles(true); else h.failService(true);
    await assert.rejects(run()); assert.equal(h.calls.close, 1); h.failFiles(false); h.failService(false); assert.equal(await run(), h.service); assert.equal(h.calls.db.length, 2); assert.equal(h.calls.migrations, 0);
  }
});
test("AUTH03: geänderte Modi/Geheimnisse/Pfade können keine gecachte lokale Runtime übernehmen", async () => {
  for (const change of [{ NODE_ENV: "production" }, { STEX_AUTH_MODE: "production" }, { BETTER_AUTH_URL: "http://localhost:4000" }, { BETTER_AUTH_SECRET: material("new") }, { STEX_PRIVATE_FILE_ROOT: "/synthetic/new-files" }]) {
    const h = harness(), env: Record<string, string | undefined> = { STEX_AUTH_MODE: "local", BETTER_AUTH_URL: "http://localhost" }, run = createAccountRuntime(() => env, h.bindings, () => "/synthetic/app");
    await run(); Object.assign(env, change); await assert.rejects(run(), (error: unknown) => error instanceof AccountError && error.code === "auth_configuration_changed"); assert.equal(h.calls.db.length, 1); assert.equal(h.calls.service.length, 1);
  }
});
test("AUTH03: Prüfen expliziter Objekte verändert weder diese Objekte noch die Prozessumgebung", () => {
  const before = process.env.NODE_ENV, env = Object.freeze(production()), copy = JSON.stringify(env); readProductionAuthConfig(env, release); assert.equal(JSON.stringify(env), copy); assert.equal(process.env.NODE_ENV, before);
});
