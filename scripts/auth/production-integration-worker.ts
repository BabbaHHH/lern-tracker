import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { access, chmod, lstat, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { join } from "node:path";
import type { PoolConfig } from "pg";
import { productionIntegrationFixture } from "./production-integration-fixture";
import { Database } from "../../src/lib/server/persistence/database";
import { PrivateFiles, fileHash, storageKey } from "../../src/lib/server/persistence/files";
import { AccountService } from "../../src/lib/server/auth/service";
import { AccountError } from "../../src/lib/server/auth/security";
import { accountRuntime, createAccountRuntime, type AccountRuntimeBindings } from "../../src/lib/server/auth/runtime";
import { readProductionAuthConfig } from "../../src/lib/server/auth/production-config";

let stage = "setup";
const passed: string[] = [];
let failureInfo: object | undefined;
async function report(value: object) {
  if (process.send) await new Promise<void>((resolve, reject) => process.send!(value, error => error ? reject(error) : resolve()));
}
async function check(name: string, work: () => Promise<void>) {
  stage = name;
  try { await work(); } catch (error) {
    const actual = (error as { actual?: unknown }).actual;
    const detail = actual && typeof actual === "object" && "code" in actual ? actual as AccountError : error instanceof AccountError ? error : undefined;
    failureInfo = { kind: (error as Error).name, accountCode: detail?.code, configField: (detail as { field?: string } | undefined)?.field };
    throw error;
  }
  passed.push(name); await report({ boundary: name });
}
async function portClosed(port: number) {
  return await new Promise<boolean>(resolve => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("error", () => { socket.destroy(); resolve(true); });
    socket.once("connect", () => { socket.destroy(); resolve(false); });
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}
async function main() {
  // The parent supplies a minimal environment; release values exist only here.
  const fixture = await productionIntegrationFixture();
  let cleanup = false;
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error("Network provider forbidden in isolated test"); };
  try {
    Object.assign(process.env, fixture.environment);
    delete process.env.STEX_AUTH_RUNTIME_RELEASE;
    const beforeMigrations = (await fixture.setup.pool.query("SELECT name,sha256 FROM stex.schema_migrations ORDER BY name")).rows;
    await check("explicit-migrations-001-016", async () => {
      assert.equal(beforeMigrations.length, 16); assert.match(beforeMigrations[15].name, /^016_/);
      const host = await fixture.setup.pool.query("SELECT host(inet_server_addr()) AS address, current_database() AS name");
      assert.equal(host.rows[0].address, "127.0.0.1"); assert.equal(host.rows[0].name, "runtime_probe");
    });
    await check("no-release-no-runtime-resources", async () => {
      let calls = 0;
      const forbidden = () => { calls++; throw new Error("Unreleased resource access"); };
      const deps: AccountRuntimeBindings = { readTextFile: async () => forbidden(), database: forbidden, files: forbidden, service: forbidden };
      await assert.rejects(createAccountRuntime(() => process.env, deps)(), (error: unknown) => error instanceof AccountError && error.code === "production_auth_not_released");
      await assert.rejects(accountRuntime(), (error: unknown) => error instanceof AccountError && error.code === "production_auth_not_released");
      assert.equal(calls, 0); await assert.rejects(access(fixture.environment.STEX_PRIVATE_FILE_ROOT));
    });
    process.env.STEX_AUTH_RUNTIME_RELEASE = "operator-approved";
    stage = "default-runtime-build";
    const service = await accountRuntime(); fixture.databases.add(service.database);
    await check("default-runtime-real-database-and-auth-pool", async () => {
      assert.ok(service instanceof AccountService); assert.equal(await accountRuntime(), service);
      const expected = readProductionAuthConfig(process.env, process.cwd());
      assert.equal(service.baseURL, expected.baseURL); assert.equal(service.files?.root, expected.privateFileRoot);
      for (const pool of [service.database.pool, service.database.authPool]) {
        const row = (await pool.query("SELECT current_database() AS name,current_user AS owner,inet_server_port() AS port, (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl")).rows[0];
        assert.equal(row.name, "runtime_probe"); assert.equal(row.owner, "runtime_test_owner"); assert.equal(row.port, fixture.port); assert.equal(row.ssl, false);
        assert.equal(pool.options.host, "127.0.0.1"); assert.equal(pool.options.password, fixture.password);
      }
      assert.equal((await stat(expected.privateFileRoot)).mode & 0o777, 0o700);
    });
    await check("same-runtime-service-write-and-private-file-roundtrip", async () => {
      const prepared = await service.prepareAdmin("runtime-owner@example.test", "Synthetic runtime owner") as { userId: string };
      assert.equal((await fixture.setup.pool.query("SELECT count(*)::int AS n FROM stex.accounts WHERE user_id=$1", [prepared.userId])).rows[0].n, 1);
      const mails = await service.localMails("runtime-owner@example.test"); assert.equal(mails.length, 1);
      assert.equal(new URL(mails[0].url).origin, service.baseURL);
      const bytes = Buffer.from("synthetic production-contract file"), hash = fileHash(bytes), key = storageKey(prepared.userId, "runtime-file");
      await service.files!.put(key, bytes, hash); assert.deepEqual(await service.files!.read(key, hash, bytes.length), bytes);
      assert.equal((await stat(join(service.files!.root, key))).mode & 0o777, 0o600);
      assert.equal((await readdir(service.files!.root)).length, 1);
      // Compare stored ciphertext to plaintext without printing either value.
      const encrypted = (await fixture.setup.pool.query("SELECT sealed FROM stex.auth_mail_outbox LIMIT 1")).rows[0];
      assert.ok(encrypted); assert.ok(!JSON.stringify(encrypted).includes(mails[0].url));
    });
    await check("fixed-https-origin-rejects-foreign-request-without-dns", async () => {
      const response = await service.accountHTTP(new Request("https://foreign.example.test/api/account", { headers: { host: "foreign.example.test" } }));
      assert.equal(response.status, 403); assert.equal((await response.json()).error.code, "invalid_origin");
    });
    await check("real-file-failure-closes-created-pools", async () => {
      for (const variant of ["regular-file", "symlink"]) {
        const path = join(fixture.root, variant); if (variant === "regular-file") await writeFile(path, "synthetic blocker", { mode: 0o600 });
        else await symlink(fixture.environment.STEX_PRIVATE_FILE_ROOT, path);
        let opened: Database | undefined, close = 0;
        const deps: AccountRuntimeBindings = {
          readTextFile: async () => { throw new Error("Secret file fallback forbidden"); },
          database: config => { opened = new Database(config); fixture.databases.add(opened); const end = opened.close.bind(opened); opened.close = async () => { close++; await end(); }; return opened; },
          files: root => new PrivateFiles(root), service: options => new AccountService(options),
        };
        await assert.rejects(createAccountRuntime(() => ({ ...process.env, STEX_PRIVATE_FILE_ROOT: path }), deps)(), (error: unknown) => error instanceof AccountError && error.code === "production_auth_initialization_failed" && error.cause === undefined);
        assert.equal(close, 1); assert.ok(opened);
        await assert.rejects(opened.pool.query("SELECT 1")); await assert.rejects(opened.authPool.query("SELECT 1"));
        if (variant === "symlink") assert.equal((await lstat(path)).isSymbolicLink(), true);
      }
    });
    await check("real-private-directory-write-permission-denied", async () => {
      const path = join(fixture.root, "readonly-files"), files = new PrivateFiles(path); await files.initialize(); await chmod(path, 0o500);
      try {
        const bytes = Buffer.from("must-not-write");
        await assert.rejects(files.put(storageKey("owner", "denied"), bytes, fileHash(bytes)), (error: unknown) => (error as NodeJS.ErrnoException).code === "EACCES");
        assert.equal((await readdir(path)).length, 0);
      } finally { await chmod(path, 0o700); }
    });
    await check("real-database-role-permission-denied-no-fallback", async () => {
      const password = randomBytes(48).toString("base64url");
      // Password is generated test material; bind via quote_literal before DDL.
      const literal = (await fixture.setup.pool.query("SELECT quote_literal($1) AS value", [password])).rows[0].value;
      await fixture.setup.pool.query(`CREATE ROLE runtime_readonly LOGIN PASSWORD ${literal}`);
      await fixture.setup.pool.query("GRANT CONNECT ON DATABASE runtime_probe TO runtime_readonly");
      await fixture.setup.pool.query("GRANT USAGE ON SCHEMA stex TO runtime_readonly");
      await fixture.setup.pool.query("GRANT SELECT ON ALL TABLES IN SCHEMA stex TO runtime_readonly");
      const env = { ...process.env, DATABASE_URL: `postgres://runtime_readonly:${password}@127.0.0.1:${fixture.port}/runtime_probe`, STEX_PRIVATE_FILE_ROOT: join(fixture.root, "readonly-role-files") };
      const dbs: Database[] = [];
      const deps: AccountRuntimeBindings = { readTextFile: async () => { throw new Error("No fallback"); }, database: (config: PoolConfig) => { const db = new Database(config); dbs.push(db); fixture.databases.add(db); return db; }, files: path => new PrivateFiles(path), service: options => new AccountService(options) };
      const restricted = await createAccountRuntime(() => env, deps)();
      try {
        assert.equal((await restricted.database.pool.query("SELECT current_user AS owner")).rows[0].owner, "runtime_readonly");
        const response = await restricted.accountHTTP(new Request(service.baseURL + "/api/account/notes"));
        assert.equal(response.status, 503); const text = await response.text(); assert.ok(!text.includes(password)); assert.ok(!text.includes("permission denied"));
        const owner = (await service.database.pool.query("SELECT current_user AS owner")).rows[0].owner; assert.equal(owner, "runtime_test_owner");
      } finally { for (const db of dbs) await db.close(); }
    });
    await check("released-runtime-three-ai-routes-still-closed", async () => {
      const planning = await import("../../src/app/api/ai/route");
      const checkin = await import("../../src/app/api/learning/checkin/route");
      const correction = await import("../../src/app/api/learning/correction/route");
      for (const [path, handler, body] of [["ai", planning.POST, { purpose: "planning", messages: [] }], ["learning/checkin", checkin.POST, { action: "ask" }], ["learning/correction", correction.POST, { action: "run" }]] as const) {
        const request = new Request(service.baseURL + "/api/" + path + "?enableAi=1", { method: "POST", headers: { "content-type": "application/json", origin: service.baseURL, "x-stex-action": "1", "x-stex-ai-enabled": "true" }, body: JSON.stringify(body) });
        const response = await handler(request); assert.equal(response.status, 503); assert.equal((await response.json()).error.code, "pilot_ai_deferred");
      }
      assert.equal(providerCalls, 0);
    });
    await check("no-request-migration-and-real-close", async () => {
      assert.deepEqual((await fixture.setup.pool.query("SELECT name,sha256 FROM stex.schema_migrations ORDER BY name")).rows, beforeMigrations);
      await service.database.close(); await assert.rejects(service.database.pool.query("SELECT 1")); await assert.rejects(service.database.authPool.query("SELECT 1"));
    });
  } finally {
    globalThis.fetch = originalFetch;
    await fixture.close();
    await assert.rejects(access(fixture.root)); assert.equal(await portClosed(fixture.port), true); cleanup = true;
    await report({ cleanup, rootRemoved: true, portClosed: true });
  }
  await report({ passed, count: passed.length, cleanup });
}
// embedded-postgres installs a beforeExit hook with code 0; keep the worker alive
// until all assertions, cleanup and the final IPC report have settled.
const keepAlive = setInterval(() => {}, 1000);
main().then(() => { clearInterval(keepAlive); process.disconnect?.(); }, () => {
  process.exitCode = 1;
  report({ failedStage: stage, passed, failureInfo }).finally(() => { clearInterval(keepAlive); process.disconnect?.(); process.exit(1); });
});
