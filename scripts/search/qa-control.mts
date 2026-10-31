/** Only for the disposable runtime created by qa-runtime.mts. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Database } from "../../src/lib/server/persistence/database";
import { lockState } from "../../src/lib/server/persistence/repository";
const root = process.argv[2];
if (!/^\/private\/tmp\/stex-search-a1-qa-[a-zA-Z0-9]+$/.test(root) || process.argv[3] !== "block-a") throw new Error("Nur die synthetische SEARCH-QA darf gesteuert werden.");
const port = Number((await readFile(join(root, "postgres/postmaster.pid"), "utf8")).split("\n")[3]);
const password = (await readFile(join(root, "postgres-password"), "utf8")).trim();
const database = new Database({ host: "127.0.0.1", port, user: "stex_local", password, database: "stex_local" });
try {
  await database.transaction(async client => {
    await lockState(client);
    if ((await client.query("SELECT 1 FROM stex.accounts WHERE user_id NOT IN ('search-browser-a','search-browser-b') LIMIT 1")).rows.length) throw new Error("Keine reine Such-QA.");
    await client.query("UPDATE stex.accounts SET status='blocked' WHERE user_id='search-browser-a'");
    await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id='search-browser-a'");
  });
  console.log("Synthetisches Suchkonto A gesperrt.");
} finally { await database.close(); }
