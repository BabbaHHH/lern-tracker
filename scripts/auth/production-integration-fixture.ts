import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { Database } from "../../src/lib/server/persistence/database";

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (!address || typeof address === "string") throw new Error("Isolated port unavailable");
  return address.port;
}
/** Fresh cluster only. Never uses local-config, .env loaders or existing DBs. */
export async function productionIntegrationFixture() {
  const port = await freePort();
  const root = await mkdtemp(join(tmpdir(), "stex-auth-production-integration-"));
  const password = randomBytes(48).toString("base64url");
  const cluster = new EmbeddedPostgres({ databaseDir: join(root, "postgres"), port, user: "runtime_test_owner", password,
    persistent: true, createPostgresUser: false, authMethod: "scram-sha-256", initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-h", "127.0.0.1", "-k", root, "-c", "fsync=on"], onLog: () => {}, onError: () => {} });
  const databases = new Set<Database>();
  let started = false;
  const config = { host: "127.0.0.1", port, user: "runtime_test_owner", password, database: "runtime_probe", connectionTimeoutMillis: 5000, ssl: false as const };
  try {
    await cluster.initialise(); await cluster.start(); started = true;
    const admin = cluster.getPgClient("postgres", "127.0.0.1");
    try { await admin.connect(); await admin.query('CREATE DATABASE "runtime_probe"'); } finally { await admin.end(); }
    const setup = new Database(config); databases.add(setup);
    // Explicit setup before any production runtime: never a request migration.
    await setup.migrate();
    return { root, port, password, config, setup, databases,
      environment: { NODE_ENV: "production", STEX_AUTH_MODE: "production", BETTER_AUTH_URL: "https://runtime.example.test",
        DATABASE_URL: `postgres://runtime_test_owner:${password}@127.0.0.1:${port}/runtime_probe`, STEX_DATABASE_TLS: "loopback",
        STEX_PRIVATE_FILE_ROOT: join(root, "private-files"), BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"), STEX_AUTH_MAIL_KEY: randomBytes(48).toString("base64url") },
      async close() {
        for (const db of databases) await db.close();
        if (started) { await cluster.stop(); started = false; }
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch {
    for (const db of databases) await db.close().catch(() => {});
    if (started) await cluster.stop();
    await rm(root, { recursive: true, force: true });
    throw new Error("Isolated PostgreSQL setup failed");
  }
}
