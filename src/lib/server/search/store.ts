import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { Database } from "../persistence/database";
import { lockState } from "../persistence/repository";
import { currentIndex, type SearchBatch, type SearchDocument, type SearchIndexAdapter, type SearchManifest } from "../../search/contract";
import { summarizeSearch, type SearchStatusRow } from "./status";

export const currentDocumentsSQL = `SELECT c.id AS klausur_id,c.payload->>'title' AS title,d.role,v.*
  FROM stex.catalog_records c JOIN stex.catalog_documents d ON d.record_key=c.record_key AND d.klausur_id=c.id
  JOIN stex.catalog_document_versions v ON v.document_id=d.document_id
  WHERE c.kind='klausur' AND NOT EXISTS(SELECT 1 FROM stex.catalog_document_versions newer
    WHERE newer.document_id=d.document_id AND newer.version_number>v.version_number)`;
export interface ClaimedSearchJob {
  document: SearchDocument; storageKey: string; byteSize: number; epoch: string; token: string; connection: PoolClient;
}
export class PostgresSearchStore {
  constructor(readonly database: Database) {}
  async status() {
    const rows = (await this.database.pool.query<SearchStatusRow>(`SELECT docs.*,j.epoch,j.state AS job_state,j.manifest,j.error_code
      FROM (${currentDocumentsSQL}) docs LEFT JOIN stex.search_jobs j USING(document_version_id)`)).rows;
    return summarizeSearch(rows);
  }
  async discover(rebuild = false) {
    return this.database.transaction(async client => {
      await lockState(client);
      const documents = (await client.query(currentDocumentsSQL)).rows;
      await client.query(`UPDATE stex.search_jobs SET state='superseded',token=NULL,updated_at=now()
        WHERE state<>'superseded' AND document_version_id NOT IN(SELECT document_version_id FROM (${currentDocumentsSQL}) current_docs)`);
      for (const row of documents) {
        await client.query("INSERT INTO stex.search_jobs(document_version_id) VALUES($1) ON CONFLICT DO NOTHING", [row.document_version_id]);
        const job = (await client.query("SELECT manifest FROM stex.search_jobs WHERE document_version_id=$1", [row.document_version_id])).rows[0];
        if (rebuild || (job.manifest && (!currentIndex(job.manifest) || job.manifest.document.role !== row.role
          || job.manifest.document.sha256 !== row.sha256 || job.manifest.document.documentVersionId !== row.document_version_id))) {
          await client.query("DELETE FROM stex.search_pages WHERE document_version_id=$1", [row.document_version_id]);
          await client.query("UPDATE stex.search_jobs SET epoch=gen_random_uuid(),state='queued',manifest=NULL,token=NULL,error_code=NULL,updated_at=now() WHERE document_version_id=$1", [row.document_version_id]);
        }
      }
      return documents.length;
    });
  }
  /** A session advisory lock survives the short claim transaction, but not a crash.
   * No global transaction is held while reading files or running PDF.js. */
  async claim(): Promise<ClaimedSearchJob | null> {
    const connection = await this.database.pool.connect();
    let held: string | null = null;
    try {
      await connection.query("BEGIN"); await lockState(connection);
      const candidates = (await connection.query(`SELECT docs.*,j.epoch FROM (${currentDocumentsSQL}) docs
        JOIN stex.search_jobs j USING(document_version_id) WHERE j.state IN ('queued','running') ORDER BY j.updated_at LIMIT 32`)).rows;
      for (const row of candidates) {
        const id = row.document_version_id;
        if (!(await connection.query("SELECT pg_try_advisory_lock(734903,hashtext($1)) AS acquired", [id])).rows[0].acquired) continue;
        held = id;
        const token = randomUUID();
        await connection.query("UPDATE stex.search_jobs SET state='running',token=$2,attempts=attempts+1,updated_at=now() WHERE document_version_id=$1", [id, token]);
        await connection.query("COMMIT");
        return { document: { klausurId: row.klausur_id, documentId: row.document_id, documentVersionId: id, role: row.role, sha256: row.sha256 },
          storageKey: row.storage_key, byteSize: Number(row.byte_size), epoch: row.epoch, token, connection };
      }
      await connection.query("COMMIT"); connection.release(); return null;
    } catch (error) {
      await connection.query("ROLLBACK");
      if (held) await connection.query("SELECT pg_advisory_unlock(734903,hashtext($1))", [held]);
      connection.release(); throw error;
    }
  }
  async release(job: ClaimedSearchJob) {
    try { await job.connection.query("SELECT pg_advisory_unlock(734903,hashtext($1))", [job.document.documentVersionId]); }
    finally { job.connection.release(); }
  }
  adapter(job: ClaimedSearchJob): SearchIndexAdapter {
    return {
      readManifest: async () => {
        const row = (await this.database.pool.query("SELECT manifest FROM stex.search_jobs WHERE document_version_id=$1 AND epoch=$2 AND token=$3", [job.document.documentVersionId, job.epoch, job.token])).rows[0];
        if (!row) throw new Error("search_job_replaced");
        return row.manifest as SearchManifest | null;
      },
      commitBatch: batch => this.commit(job, batch),
    };
  }
  private async commit(job: ClaimedSearchJob, batch: SearchBatch) {
    await this.database.transaction(async client => {
      await lockState(client);
      const row = (await client.query(`SELECT * FROM stex.search_jobs WHERE document_version_id=$1 AND epoch=$2 AND token=$3 FOR UPDATE`,
        [job.document.documentVersionId, job.epoch, job.token])).rows[0];
      if (!row || (row.manifest?.revision ?? null) !== batch.expectedRevision) throw new Error("search_job_replaced");
      // Scope, identity and current version are checked again before publication.
      const source = (await client.query(`SELECT * FROM (${currentDocumentsSQL}) docs WHERE document_version_id=$1`, [job.document.documentVersionId])).rows[0];
      if (!source || source.klausur_id !== job.document.klausurId || source.document_id !== job.document.documentId
        || source.sha256 !== job.document.sha256 || source.role !== job.document.role) {
        await client.query("UPDATE stex.search_jobs SET state='superseded',token=NULL WHERE document_version_id=$1", [job.document.documentVersionId]);
        return;
      }
      if (batch.replacePages) await client.query("DELETE FROM stex.search_pages WHERE document_version_id=$1", [job.document.documentVersionId]);
      for (const page of batch.pages) await client.query(`INSERT INTO stex.search_pages VALUES($1,$2,$3,$4::jsonb)
        ON CONFLICT(document_version_id,epoch,page_number) DO UPDATE SET payload=EXCLUDED.payload`,
        [job.document.documentVersionId, job.epoch, page.pageNumber, JSON.stringify(page)]);
      await client.query("UPDATE stex.search_jobs SET manifest=$4::jsonb,state=$5,error_code=NULL,updated_at=now() WHERE document_version_id=$1 AND epoch=$2 AND token=$3",
        [job.document.documentVersionId, job.epoch, job.token, JSON.stringify(batch.manifest), batch.manifest.status === "pending" ? "queued" : "complete"]);
    });
  }
  async fail(job: ClaimedSearchJob, code: "processing_failed" | "document_byte_limit" | "file_unavailable" = "processing_failed") {
    await this.database.transaction(async client => {
      await lockState(client);
      await client.query("UPDATE stex.search_jobs SET state='failed',error_code=$4,updated_at=now() WHERE document_version_id=$1 AND epoch=$2 AND token=$3",
        [job.document.documentVersionId, job.epoch, job.token, code]);
    });
  }
}
