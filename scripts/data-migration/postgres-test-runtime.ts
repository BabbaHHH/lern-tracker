import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { Database } from "../../src/lib/server/persistence/database";
import { PrivateFiles } from "../../src/lib/server/persistence/files";
import { PersistenceRepository } from "../../src/lib/server/persistence/repository";

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve,reject) => { server.once("error",reject); server.listen(0,"127.0.0.1",resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Testport nicht verfügbar.");
  await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}
/** Real PostgreSQL binaries, a random local port, synthetic credentials and a fresh OS temp folder. */
export async function testRuntime() {
  const port = await freePort();
  const root = await mkdtemp(join(tmpdir(),"stex-data-b-"));
  const password = randomBytes(24).toString("hex");
  const messages: string[] = [];
  const cluster = new EmbeddedPostgres({ databaseDir:join(root,"postgres"),port,user:"data_b_test",password,
    persistent:true,authMethod:"scram-sha-256",createPostgresUser:false,initdbFlags:["--encoding=UTF8","--locale=C"],
    postgresFlags:["-h","127.0.0.1","-k",root,"-c","fsync=on"],
    onLog:message => messages.push(message),onError:() => {} });
  const databases = new Set<Database>();
  let running = false;
  const connect = (name: string) => {
    const database = new Database({ host:"127.0.0.1",port,user:"data_b_test",password,database:name,connectionTimeoutMillis:5000 });
    databases.add(database);
    return database;
  };
  try {
    await cluster.initialise(); await cluster.start(); running = true;
  } catch (error) {
    await cluster.stop();
    await rm(root,{recursive:true,force:true});
    throw new Error(`Echte PostgreSQL-Testlaufzeit konnte nicht starten: ${String(error)} ${messages.slice(-3).join(" ")}`);
  }
  return {
    root,
    async repository(name: string) {
      await cluster.createDatabase(name);
      const database = connect(name);
      await database.migrate();
      const files = new PrivateFiles(join(root,`${name}-files`));
      return new PersistenceRepository(database,files);
    },
    async restart(name: string, files: PrivateFiles) {
      for (const database of databases) await database.close();
      databases.clear();
      await cluster.stop(); running = false;
      await cluster.start(); running = true;
      return new PersistenceRepository(connect(name),files);
    },
    async close() {
      for (const database of databases) await database.close();
      databases.clear();
      if (running) await cluster.stop();
      await rm(root,{recursive:true,force:true});
    },
  };
}
