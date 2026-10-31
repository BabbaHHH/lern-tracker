import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient, type PoolConfig } from "pg";

/** Server/operator capability. Never construct this from browser-supplied settings. */
export class Database {
  readonly pool: Pool;
  /** Reserved connections to the same database for library commits while invitation transactions hold locks. */
  readonly authPool: Pool;
  constructor(config: PoolConfig) { this.pool = new Pool(config); this.authPool = new Pool({...config,max:4}); }
  private closing:Promise<void>|undefined;
  async close(): Promise<void> { this.closing??=Promise.all([this.pool.end(),this.authPool.end()]).then(()=>undefined); await this.closing; }
  async transaction<T>(work: (client: PoolClient) => Promise<T>, readOnly = false): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query(readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  async migrate(directory = resolve("db/migrations")): Promise<void> {
    const files = (await readdir(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    if (!files.length) throw new Error("Keine Datenbankmigrationen gefunden.");
    await this.transaction(async client => {
      await client.query("SELECT pg_advisory_xact_lock(734901,1)");
      await client.query("CREATE SCHEMA IF NOT EXISTS stex");
      await client.query("CREATE TABLE IF NOT EXISTS stex.schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL)");
      const applied = await client.query<{name: string; sha256: string}>("SELECT name,sha256 FROM stex.schema_migrations ORDER BY name");
      // Check the content of every already applied file before reporting a
      // missing/new file in the directory. This keeps a changed migration
      // distinguishable even after later additive migrations were installed.
      for (const row of applied.rows) {
        if (!files.includes(row.name)) throw new Error("Migrationsfolge wurde verändert.");
        const sql = await readFile(resolve(directory, row.name), "utf8");
        if (createHash("sha256").update(sql).digest("hex") !== row.sha256) throw new Error("Bereits angewendete Migration wurde verändert.");
      }
      if (applied.rows.some((row, i) => files[i] !== row.name)) throw new Error("Migrationsfolge wurde verändert.");
      for (const file of files) {
        const sql = await readFile(resolve(directory, file), "utf8");
        const sha256 = createHash("sha256").update(sql).digest("hex");
        const previous = applied.rows.find(row => row.name === file);
        if (previous) {
          if (previous.sha256 !== sha256) throw new Error("Bereits angewendete Migration wurde verändert.");
          continue;
        }
        await client.query(sql);
        await client.query("INSERT INTO stex.schema_migrations VALUES ($1,$2)", [file, sha256]);
      }
    });
  }
}
