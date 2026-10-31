import { access } from "node:fs/promises";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { Database } from "../../src/lib/server/persistence/database";
import { localPassword, localPort, localRoot } from "./local-config";

const password = await localPassword(true);
const port = localPort();
const cluster = new EmbeddedPostgres({databaseDir:join(localRoot,"postgres"),port,user:"stex_local",password,
  persistent:true,createPostgresUser:false,authMethod:"scram-sha-256",initdbFlags:["--encoding=UTF8","--locale=C"],
  postgresFlags:["-h","127.0.0.1","-k",localRoot,"-c","fsync=on"],onLog:() => {},onError:() => {}});
let running = false;
let database: Database | undefined;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await database?.close(); database = undefined;
  if (running) await cluster.stop();
  running = false;
}
try {
  let initialized = true;
  try { await access(join(localRoot,"postgres","PG_VERSION")); } catch { initialized = false; }
  if (!initialized) await cluster.initialise();
  await cluster.start(); running = true;
  const admin = cluster.getPgClient("postgres","127.0.0.1");
  await admin.connect();
  try {
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname=$1",["stex_local"])).rowCount) await admin.query('CREATE DATABASE "stex_local"');
  } finally { await admin.end(); }
  database = new Database({host:"127.0.0.1",port,user:"stex_local",password,database:"stex_local"});
  await database.migrate();
  console.log(`Lokale PostgreSQL-Datenbank bereit auf 127.0.0.1:${port}. Daten bleiben unter db/.local erhalten. Strg+C beendet den Server.`);
  await new Promise<void>(resolve => {
    process.once("SIGINT",resolve);
    process.once("SIGTERM",resolve);
  });
} catch {
  console.error("Lokale PostgreSQL-Datenbank konnte nicht eingerichtet oder gestartet werden. Prüfe Port, Paketinstallation und lokale Zugriffsrechte.");
  process.exitCode = 1;
} finally { await stop(); }
