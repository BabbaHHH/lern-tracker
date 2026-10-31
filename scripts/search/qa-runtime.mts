/** Disposable local synthetic QA and isolated build, never loads .env.local. */
import { randomBytes } from "node:crypto";
import { cp, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import EmbeddedPostgres from "embedded-postgres";
import { Database } from "../../src/lib/server/persistence/database";
import { PrivateFiles } from "../../src/lib/server/persistence/files";
import { AccountService } from "../../src/lib/server/auth/service";
import { SyntheticAccount } from "../pdf-a/fixtures";
import { importSearchFixture } from "./catalog-fixture";
import { PostgresSearchStore } from "../../src/lib/server/search/store";
import { SearchWorker } from "../../src/lib/server/search/worker";
import { lockState } from "../../src/lib/server/persistence/repository";

async function freePort() { const server = createServer(); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("Port fehlt."); await new Promise<void>(resolve => server.close(() => resolve())); return address.port; }
const source = process.cwd(), root = await mkdtemp("/private/tmp/stex-search-a1-qa-"), snapshot = join(root, "app");
await mkdir(snapshot);
const names = ["src", "public", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "next-env.d.ts", "postcss.config.mjs"];
async function sync() { for (const name of names) await cp(join(source, name), join(snapshot, name), { recursive: true }); }
await sync(); await symlink(resolve("node_modules"), join(snapshot, "node_modules"));
if (process.argv[2] === "build") {
  const build = spawn(process.execPath, [join(snapshot, "node_modules/next/dist/bin/next"), "build", "--webpack"], { cwd: snapshot, env: { ...process.env, STEX_AUTH_MODE: "", STEX_LEARNING_MODE: "account" }, stdio: "inherit" });
  const code = await new Promise<number>(resolve => build.once("exit", code => resolve(code ?? 1)));
  await rm(root, { recursive: true, force: true }); process.exit(code);
}
const port = await freePort(), webPort = await freePort(), baseURL = `http://localhost:${webPort}`;
const password = randomBytes(24).toString("hex"), secret = randomBytes(48).toString("hex"), mailKey = randomBytes(48).toString("hex");
for (const [name, value] of [["postgres-password", password], ["auth-secret", secret], ["auth-mail-key", mailKey]]) await writeFile(join(root, name), value, { mode: 0o600 });
const cluster = new EmbeddedPostgres({ databaseDir: join(root, "postgres"), port, user: "stex_local", password, persistent: true, authMethod: "scram-sha-256", createPostgresUser: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-h", "127.0.0.1", "-k", root], onLog: () => {}, onError: () => {} });
await cluster.initialise(); await cluster.start(); await cluster.createDatabase("stex_local");
const database = new Database({ host: "127.0.0.1", port, user: "stex_local", password, database: "stex_local" }); await database.migrate();
const files = new PrivateFiles(join(root, "files")); await files.initialize();
const auth = new AccountService({ database, files, baseURL, secret, mailKey });
const a = new SyntheticAccount(auth, "search-browser-a"), b = new SyntheticAccount(auth, "search-browser-b");
await a.initialize(); await b.initialize(); await importSearchFixture(auth, a.headers());
await database.transaction(async client => { await lockState(client); await client.query("UPDATE stex.catalog_documents SET role='kombiniert' WHERE role='sachverhalt'"); });
const store = new PostgresSearchStore(database), worker = new SearchWorker(store, files);
await store.discover(); while (await worker.step()) { /* only the synthetic fixture */ }
console.log(JSON.stringify({ baseURL, snapshot, accounts: [a.name, b.name] }));
const next = spawn(process.execPath, [join(snapshot, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(webPort)], {
  cwd: snapshot, env: { ...process.env, NODE_ENV: "development", STEX_AUTH_MODE: "local", STEX_LEARNING_MODE: "account", BETTER_AUTH_URL: baseURL, STEX_LOCAL_DATA_DIR: root, STEX_LOCAL_POSTGRES_PORT: String(port) }, stdio: ["ignore", "inherit", "inherit"] });
let stopping = false;
async function stop() { if (stopping) return; stopping = true; next.kill("SIGTERM"); await new Promise<void>(resolve => next.once("exit", () => resolve())); await database.close(); await cluster.stop(); await rm(root, { recursive: true, force: true }); process.exit(0); }
const input = createInterface({ input: process.stdin });
input.on("line", async line => {
  if (line === "stop") await stop();
  if (line === "sync") { await sync(); console.log("QA-Quellkopie aktualisiert."); }
  if (line === "block-a") { await database.transaction(async client => { await lockState(client); await client.query("UPDATE stex.accounts SET status='blocked' WHERE user_id=$1", [a.name]); await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1", [a.name]); }); console.log("Synthetisches A-Konto gesperrt."); }
});
process.on("SIGTERM", () => void stop()); process.on("SIGINT", () => void stop());
