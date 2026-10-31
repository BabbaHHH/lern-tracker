/** Disposable synthetic browser environment; never uses normal db/.local or .env. */
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm, open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import EmbeddedPostgres from "embedded-postgres";
import { Database } from "../../src/lib/server/persistence/database";
import { PrivateFiles } from "../../src/lib/server/persistence/files";
import { AccountService } from "../../src/lib/server/auth/service";
import { CatalogImportService, validateCatalogPdf } from "../../src/lib/server/catalog/import-service";
import { syntheticPdf, SyntheticAccount } from "../pdf-a/fixtures";
import { pdfViewerURL } from "../../src/lib/pdf-viewer/contract";

async function port() {
  const server = createServer(); await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No local port");
  await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); return address.port;
}
const snapshot = resolve(process.argv[2]), infoPath = resolve(process.argv[3]);
if (!snapshot.includes("stex-pdf-a-r1-") || !infoPath.includes("pdf-a-r1-")) throw new Error("Expected isolated PDF-A-R1 paths");
const root = await mkdtemp(join(tmpdir(), "stex-pdf-a-r1-browser-")), databasePort = await port(), webPort = await port();
const password = randomBytes(24).toString("hex"), secret = randomBytes(48).toString("hex"), mailKey = randomBytes(48).toString("hex");
for (const [name, value] of [["postgres-password", password], ["auth-secret", secret], ["auth-mail-key", mailKey]]) await writeFile(join(root, name), value, { mode: 0o600 });
const cluster = new EmbeddedPostgres({ databaseDir: join(root, "postgres"), port: databasePort, user: "stex_local", password,
  persistent: true, createPostgresUser: false, authMethod: "scram-sha-256", initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1", "-k", root], onLog: () => {}, onError: () => {} });
let database: Database | undefined, child: ReturnType<typeof spawn> | undefined, running = false, stopping = false;
async function cleanup() {
  if (stopping) return; stopping = true;
  if (child && child.exitCode === null) { const ended = once(child, "exit"); child.kill("SIGTERM"); await ended; }
  await database?.close(); if (running) await cluster.stop();
  await rm(root, { recursive: true, force: true });
}
process.on("SIGTERM", () => { void cleanup().then(() => process.exit(0)); });
process.on("SIGINT", () => { void cleanup().then(() => process.exit(0)); });
try {
  await cluster.initialise(); await cluster.start(); running = true; await cluster.createDatabase("stex_local");
  database = new Database({ host: "127.0.0.1", port: databasePort, user: "stex_local", password, database: "stex_local" });
  await database.migrate(join(snapshot, "db/migrations"));
  const files = new PrivateFiles(join(root, "files")); await files.initialize();
  const baseURL = `http://localhost:${webPort}`;
  const auth = new AccountService({ database, files, baseURL, secret, mailKey });
  const a = new SyntheticAccount(auth, "pdf-r1-browser-a"), b = new SyntheticAccount(auth, "pdf-r1-browser-b");
  await a.initialize(); await b.initialize();
  const catalog = new CatalogImportService(auth, files), bytes = syntheticPdf(3);
  const documents = await Promise.all((["sachverhalt", "loesung"] as const).map(role => validateCatalogPdf({ name: `${role}.pdf`, type: "application/pdf", size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer }, role)));
  const result = await catalog.submit(a.headers(), { requestId: "pdf-a-r1-browser-import", metadata: { id: "pdf-r1-synthetic", source: "synthetic", title: "PDF-A-R1 synthetische Viewerprobe", date: "", area: "zr", topicIds: [] }, documents });
  const doc = result.summary.documents.find(value => value.role === "sachverhalt")!;
  const url = baseURL + pdfViewerURL({ klausurId: "pdf-r1-synthetic", documentId: doc.documentId, documentVersionId: doc.documentVersionId }, { pageNumber: 2, quote: "kaufmaennisches bestaetigungsschreiben", occurrence: 1 });
  await writeFile(infoPath, JSON.stringify({ processId: process.pid, root, databasePort, webPort, baseURL, url }, null, 2));
  const log = await open(infoPath + ".server.log", "w");
  child = spawn(process.execPath, [join(snapshot, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(webPort)], {
    cwd: snapshot, env: { ...process.env, STEX_AUTH_MODE: "local", BETTER_AUTH_URL: baseURL, STEX_LOCAL_DATA_DIR: root, STEX_LOCAL_POSTGRES_PORT: String(databasePort), STEX_LEARNING_MODE: "" }, stdio: ["ignore", log.fd, log.fd],
  });
  await log.close(); console.log("Isolated synthetic PDF-A-R1 viewer environment ready.");
  await once(child, "exit");
} finally { await cleanup(); }
