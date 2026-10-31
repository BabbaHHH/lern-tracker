/** Optional observer for the existing disposable PDF-A-R1 browser fixture only. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Database } from "../src/lib/server/persistence/database";
import { lockState } from "../src/lib/server/persistence/repository";
const info = JSON.parse(await readFile("/tmp/pdf-a-r1-dl1-info.json", "utf8"));
if (!info.root.includes("stex-pdf-a-r1-browser-") || info.baseURL !== `http://localhost:${info.webPort}`) throw new Error("Expected disposable synthetic fixture");
const password = (await readFile(join(info.root, "postgres-password"), "utf8")).trim();
const database = new Database({ host: "127.0.0.1", port: info.databasePort, user: "stex_local", password, database: "stex_local" });
try {
  if (process.argv[2] === "fill") await database.transaction(async client => {
    await lockState(client);
    const row = (await client.query("SELECT owner_user_id,download_day::text AS day,fingerprint FROM stex.catalog_pdf_downloads WHERE owner_user_id='pdf-r1-browser-a' LIMIT 1")).rows[0];
    if (!row) throw new Error("A real UI download must exist first");
    for (let slot = 1; slot <= 5; slot++) await client.query("INSERT INTO stex.catalog_pdf_downloads(owner_user_id,request_id,download_day,slot,fingerprint) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_user_id,download_day,slot) DO NOTHING", [row.owner_user_id, randomUUID(), row.day, slot, row.fingerprint]);
  });
  console.log(JSON.stringify((await database.pool.query("SELECT owner_user_id,download_day::text AS day,count(*)::int AS commands FROM stex.catalog_pdf_downloads GROUP BY owner_user_id,download_day ORDER BY owner_user_id,download_day")).rows));
} finally { await database.close(); }
