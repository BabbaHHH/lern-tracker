import { CATALOG_MAX_FILE_BYTES } from "../../catalog/limits";
import type { PrivateFiles } from "../persistence/files";
import { extractSearchBatch } from "./extract";
import { PostgresSearchStore } from "./store";

export class SearchWorker {
  constructor(readonly store: PostgresSearchStore, readonly files: PrivateFiles) {}
  async step(options: { maxPages?: number; signal?: AbortSignal } = {}): Promise<boolean> {
    options.signal?.throwIfAborted();
    const job = await this.store.claim();
    if (!job) return false;
    try {
      // Legacy/operator imports can exceed today's upload limit. Reject before file I/O.
      if (job.byteSize > CATALOG_MAX_FILE_BYTES) { await this.store.fail(job, "document_byte_limit"); return true; }
      let bytes: Buffer;
      try { bytes = await this.files.read(job.storageKey, job.document.sha256, job.byteSize); }
      catch {
        if (options.signal?.aborted) options.signal.throwIfAborted();
        await this.store.fail(job, "file_unavailable"); return true;
      }
      // Match the import limit explicitly: A0's default 32 MiB isn't the catalog limit.
      await extractSearchBatch(bytes, job.document, this.store.adapter(job), { ...options, maxBytes: CATALOG_MAX_FILE_BYTES });
      return true;
    } catch (error) {
      // Aborted work remains resumable at its last committed page. No raw errors/paths published.
      if (!options.signal?.aborted) await this.store.fail(job);
      if (options.signal?.aborted) throw error;
      return true;
    } finally { await this.store.release(job); }
  }
}
