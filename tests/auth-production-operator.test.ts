import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { PoolConfig } from "pg";
import { configuredPersistence, type PersistenceBindings } from "../scripts/data-migration/local-config";
import { runOperator, type OperatorBindings } from "../scripts/auth/operator.mjs";
import { operatorInvocation, productionOperatorConfig } from "../scripts/auth/production-operator-config";
import { readProductionAuthConfig, type AuthEnvironment } from "../src/lib/server/auth/production-config";
import type { Database } from "../src/lib/server/persistence/database";
import type { PrivateFiles } from "../src/lib/server/persistence/files";
import type { AuthOptions } from "../src/lib/server/auth/service";

const release = "/srv/stex/releases/operator-test";
const material = (label: string) => createHash("sha256").update(`operator-fixture:${label}`).digest("base64url");
function production(): Record<string, string | undefined> {
  return { NODE_ENV: "production", STEX_AUTH_MODE: "production", BETTER_AUTH_URL: "https://pilot.example.test",
    DATABASE_URL: `postgres://stex_auth:${material("db")}@postgres.example.test:5432/stex_pilot`,
    STEX_DATABASE_TLS: "verify-full", STEX_PRIVATE_FILE_ROOT: "/srv/stex/data/files",
    BETTER_AUTH_SECRET: material("auth"), STEX_AUTH_MAIL_KEY: material("mail") };
}
function harness() {
  const calls = { databases: [] as PoolConfig[], roots: [] as string[], reads: [] as string[],
    writes: [] as { path: string; value: string; options: { flag?: string; mode: number } }[],
    mkdirs: [] as string[], secrets: 0, services: [] as AuthOptions[], actions: [] as string[],
    outputs: [] as string[], close: 0, initialize: 0, migrate: 0 };
  let failFiles = false, failService = false, failAction = false, existingSecret = false, failDatabase = false;
  const database = { close: async () => { calls.close++; }, migrate: async () => { calls.migrate++; throw new Error("No real migrations"); } } as unknown as Database;
  const files = { initialize: async () => { calls.initialize++; throw new Error("No real initialization"); } } as unknown as PrivateFiles;
  const persistence: PersistenceBindings = {
    database: config => { calls.databases.push(config); if (failDatabase) throw new Error(`private ${material("db")}`); return database; },
    files: root => { calls.roots.push(root); if (failFiles) throw new Error(`private ${material("mail")}`); return files; },
    readTextFile: async path => { calls.reads.push(path); return ` ${material(path)}\n`; },
  };
  const bindings: OperatorBindings = {
    persistence: (env, root) => configuredPersistence(env, root, persistence),
    service: options => {
      calls.services.push(options); if (failService) throw new Error(`private ${material("auth")}`);
      return {
        async prepareAdmin() { calls.actions.push("prepare-admin"); if (failAction) throw new Error(`private ${material("auth")}`); return { userId: "artificial-user", invitationId: "artificial-invitation", expiresAt: "synthetic-date" }; },
        async finishAdmin() { calls.actions.push("finish-admin"); if (failAction) throw new Error(`private ${material("auth")}`); },
        async recoverAdmin() { calls.actions.push("recover-admin"); },
        async localMails(email) { calls.actions.push("mail"); return [{ id: "artificial-mail", email, purpose: "invitation", url: "http://localhost:3001/konto/einrichten?token=private-fixture&email=x%40example.test" }]; },
      };
    },
    readTextFile: persistence.readTextFile,
    writeTextFile: async (path, value, options) => { calls.writes.push({ path, value, options }); if (existingSecret) throw Object.assign(new Error("exists"), { code: "EEXIST" }); },
    mkdir: async path => { calls.mkdirs.push(path); }, secret: () => { calls.secrets++; return material(`generated:${calls.secrets}`); },
    output: value => { calls.outputs.push(value); },
  };
  return { calls, bindings, persistence, database, files,
    failFiles: () => { failFiles = true; }, failService: () => { failService = true; },
    failAction: () => { failAction = true; }, failDatabase: () => { failDatabase = true; },
    existingSecret: () => { existingSecret = true; } };
}
function noResources(h: ReturnType<typeof harness>) {
  assert.equal(h.calls.databases.length + h.calls.roots.length + h.calls.reads.length + h.calls.writes.length
    + h.calls.mkdirs.length + h.calls.secrets + h.calls.services.length + h.calls.actions.length + h.calls.close, 0);
}

test("Betreiber-Persistenz übernimmt exakt gemeinsamen Produktionsvertrag, ohne URI-/Dateifallback", async () => {
  const env = production(), h = harness(), expected = readProductionAuthConfig(env, release);
  const result = await configuredPersistence(env, release, h.persistence);
  assert.deepEqual(h.calls.databases, [expected.database]); assert.deepEqual(h.calls.roots, [expected.privateFileRoot]);
  assert.equal(h.calls.databases[0].connectionString, undefined); assert.deepEqual(h.calls.reads, []);
  assert.deepEqual(result.production, expected); assert.equal(result.database, h.database); assert.equal(result.files, h.files);
  assert.equal(h.calls.initialize + h.calls.migrate + h.calls.close, 0);
});

test("Produktionsoperator reicht dieselben geprüften Secrets/Origin/DB/Dateien an Service weiter", async () => {
  const env = production(), h = harness();
  await runOperator(["prepare-admin", "admin@example.test", "Künstlicher Admin"], env, release, h.bindings);
  const value = h.calls.services[0], config = readProductionAuthConfig(env, release);
  assert.equal(value.secret, config.secret); assert.equal(value.mailKey, config.mailKey); assert.equal(value.baseURL, config.baseURL);
  assert.equal(value.database, h.database); assert.equal(value.files, h.files); assert.deepEqual(h.calls.databases[0], config.database);
  assert.deepEqual(h.calls.actions, ["prepare-admin"]); assert.equal(h.calls.close, 1);
  assert.equal(h.calls.reads.length + h.calls.writes.length + h.calls.mkdirs.length + h.calls.secrets + h.calls.initialize + h.calls.migrate, 0);
  assert.ok(!h.calls.outputs.join().includes(config.secret)); assert.ok(!h.calls.outputs.join().includes(config.mailKey));
});

test("finish/recover sind explizite injizierte Betreiberaktionen, kein Runtime-/Migrationsaufruf", async () => {
  for (const command of ["finish-admin", "recover-admin"]) {
    const h = harness(); await runOperator([command, "artificial-id"], production(), release, h.bindings);
    assert.deepEqual(h.calls.actions, [command]); assert.equal(h.calls.close, 1); assert.equal(h.calls.initialize + h.calls.migrate, 0);
  }
});

test("Produktions-init und -Mailvorschau scheitern vor allen Ressourcen/Secretoperationen", async () => {
  for (const argv of [["init"], ["mail", "admin@example.test"]]) {
    const h = harness(); await assert.rejects(runOperator(argv, production(), release, h.bindings)); noResources(h); assert.deepEqual(h.calls.outputs, []);
  }
});

test("gemischte/fehlende/vertippte Modi führen nie auf lokale Dateien oder rohe DATABASE_URL zurück", async () => {
  const variants: AuthEnvironment[] = [
    { ...production(), STEX_AUTH_MODE: undefined }, { ...production(), STEX_AUTH_MODE: "local" },
    { ...production(), NODE_ENV: "development" }, { ...production(), NODE_ENV: undefined },
    { STEX_AUTH_MODE: "prod" }, { NODE_ENV: "prod" }, { STEX_AUTH_MODE: "" },
  ];
  for (const env of variants) {
    const h = harness(); await assert.rejects(configuredPersistence(env, release, h.persistence)); noResources(h);
    await assert.rejects(runOperator(["finish-admin", "id"], env, release, h.bindings)); noResources(h);
  }
});

test("fehlende Produktionspflichtwerte werden vor Pool-/Servicekonstruktion abgewiesen", async () => {
  for (const field of ["DATABASE_URL", "STEX_DATABASE_TLS", "STEX_PRIVATE_FILE_ROOT", "BETTER_AUTH_SECRET", "STEX_AUTH_MAIL_KEY", "BETTER_AUTH_URL"]) {
    const h = harness(), env = production(); delete env[field];
    await assert.rejects(runOperator(["prepare-admin", "a@example.test", "A"], env, release, h.bindings)); noResources(h);
  }
});

test("lokale Produktionsreste und URI-TLSoptionen können den gemeinsamen Vertrag nicht umgehen", async () => {
  for (const patch of [{ STEX_LOCAL_DATA_DIR: "" }, { STEX_LOCAL_POSTGRES_PORT: "55432" }, { DATABASE_URL: `${production().DATABASE_URL}?sslmode=disable` }, { STEX_DATABASE_TLS: "disable" }]) {
    const h = harness(); await assert.rejects(configuredPersistence({ ...production(), ...patch }, release, h.persistence)); noResources(h);
  }
  const env = production(); env.DATABASE_URL = `postgres://stex_auth:${material("db")}@127.0.0.1:55434/stex_pilot`; env.STEX_DATABASE_TLS = "loopback";
  const h = harness(); await configuredPersistence(env, release, h.persistence);
  assert.equal(h.calls.databases[0].ssl, false); assert.equal(h.calls.databases[0].host, "127.0.0.1");
});

test("unbekannte Befehle und falsche Argumentzahl werden vor mkdir/Pool gelesen abgewiesen", async () => {
  for (const argv of [[], ["unknown"], ["constructor"], ["prepare-admin", "a@example.test"], ["mail"], ["init", "extra"], ["finish-admin", "id", "extra"]]) {
    const h = harness(); await assert.rejects(runOperator(argv, production(), release, h.bindings)); noResources(h);
    await assert.rejects(runOperator(argv, {}, release, h.bindings)); noResources(h);
  }
});

test("lokaler Standardweg bleibt Loopback mit bestehenden lokalen Secrets und Dateien", async () => {
  const h = harness(); await runOperator(["finish-admin", "artificial-id"], {}, release, h.bindings);
  assert.deepEqual(h.calls.mkdirs, [`${release}/db/.local`]);
  assert.equal(h.calls.databases[0].host, "127.0.0.1"); assert.equal(h.calls.databases[0].port, 55432);
  assert.equal(h.calls.databases[0].user, "stex_local"); assert.equal(h.calls.databases[0].database, "stex_local");
  assert.deepEqual(h.calls.reads, [`${release}/db/.local/postgres-password`, `${release}/db/.local/auth-secret`, `${release}/db/.local/auth-mail-key`]);
  assert.equal(h.calls.services[0].baseURL, "http://localhost:3001"); assert.equal(h.calls.close, 1);
});

test("lokale Pfad-/Portüberschreibung und bisheriger expliziter URIweg bleiben erhalten", async () => {
  const h = harness(), env = { NODE_ENV: "test", STEX_AUTH_MODE: "local", STEX_LOCAL_DATA_DIR: "/private/tmp/operator-fixture", STEX_LOCAL_POSTGRES_PORT: "55437", STEX_PRIVATE_FILE_ROOT: "/private/tmp/operator-files" };
  await configuredPersistence(env, release, h.persistence);
  assert.equal(h.calls.databases[0].port, 55437); assert.deepEqual(h.calls.roots, [env.STEX_PRIVATE_FILE_ROOT]);
  assert.deepEqual(h.calls.reads, [`${env.STEX_LOCAL_DATA_DIR}/postgres-password`]);
  const uri = harness(); await configuredPersistence({ DATABASE_URL: "postgres://synthetic-only", STEX_PRIVATE_FILE_ROOT: env.STEX_PRIVATE_FILE_ROOT }, release, uri.persistence);
  assert.equal(uri.calls.databases[0].connectionString, "postgres://synthetic-only"); assert.deepEqual(uri.calls.reads, []);
  const bad = harness(); await assert.rejects(configuredPersistence({ DATABASE_URL: "postgres://synthetic-only" }, release, bad.persistence)); noResources(bad);
});

test("lokales init bleibt exklusiv wx/0600, vorhandene Dateien erhalten; nur Fakegenerierung", async () => {
  for (const existing of [false, true]) {
    const h = harness(); if (existing) h.existingSecret();
    await runOperator(["init"], {}, release, h.bindings);
    assert.equal(h.calls.writes.length, 3); assert.equal(h.calls.secrets, 3); assert.deepEqual(h.calls.databases, []);
    assert.ok(h.calls.writes.every(write => write.options.flag === "wx" && write.options.mode === 0o600));
    assert.ok(!h.calls.outputs.join().includes(material("generated:1")));
  }
});

test("lokale Mailvorschau bleibt privat und maskiert HTML; Links nicht im Terminal", async () => {
  const h = harness(); await runOperator(["mail", "<fake>@example.test"], {}, release, h.bindings);
  assert.equal(h.calls.writes.length, 1); assert.equal(h.calls.writes[0].options.mode, 0o600);
  assert.ok(h.calls.writes[0].value.includes("&lt;fake&gt;")); assert.ok(h.calls.writes[0].value.includes("no-referrer"));
  assert.ok(!h.calls.outputs.join().includes("token=")); assert.ok(!h.calls.outputs.join().includes("private-fixture"));
});

test("unsichere lokale Pfade werden vor lokalen Schreib-/Secretoperationen verworfen", async () => {
  for (const root of ["relative/path", "/srv/stex/public/files"]) {
    const h = harness(); await assert.rejects(runOperator(["init"], { STEX_LOCAL_DATA_DIR: root }, release, h.bindings)); noResources(h);
  }
});

test("Ressourcen-/Service-/Aktionsfehler schließen Pool und geben keine Geheimnisursache aus", async () => {
  for (const point of ["files", "service", "action", "database"]) {
    const h = harness();
    if (point === "files") h.failFiles(); if (point === "service") h.failService(); if (point === "action") h.failAction(); if (point === "database") h.failDatabase();
    await assert.rejects(runOperator(["prepare-admin", "a@example.test", "A"], production(), release, h.bindings), error => {
      assert.ok(error instanceof Error); assert.ok(!error.message.includes(material("auth"))); assert.ok(!error.message.includes(material("db"))); assert.equal(error.cause, undefined); return true;
    });
    assert.equal(h.calls.close, point === "database" ? 0 : 1); assert.deepEqual(h.calls.outputs, []);
  }
});

test("reine Adapter und injizierte Aufrufe verändern weder Eingabe noch Prozessumgebung", async () => {
  const digestEnvironment = () => createHash("sha256").update(JSON.stringify(process.env)).digest("hex");
  const before = digestEnvironment(), env = Object.freeze(production()), encoded = JSON.stringify(env);
  assert.ok(productionOperatorConfig(env, release)); operatorInvocation(["finish-admin", "id"], env, release);
  const h = harness(); await runOperator(["finish-admin", "id"], env, release, h.bindings);
  assert.equal(JSON.stringify(env), encoded); assert.equal(digestEnvironment(), before);
});
