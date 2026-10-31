import type { PdfIdentity } from "../../src/lib/pdf-viewer/contract";
import type { SearchBatch, SearchIndexAdapter, SearchManifest, SearchPage } from "../../src/lib/search/contract";

interface Snapshot { manifests: [string, SearchManifest][]; pages: [string, SearchPage][] }
const key = (value: PdfIdentity) => JSON.stringify([value.klausurId, value.documentId, value.documentVersionId]);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** Test/demo adapter only; JSON roundtrip demonstrates the persistence contract.
 * This is explicitly NOT the production PostgreSQL adapter or an authorization layer. */
export class MemorySearchAdapter implements SearchIndexAdapter {
  private manifests = new Map<string, SearchManifest>();
  private pages = new Map<string, SearchPage>();
  constructor(snapshot?: string) {
    if (snapshot) { const parsed: Snapshot = JSON.parse(snapshot); this.manifests = new Map(parsed.manifests); this.pages = new Map(parsed.pages); }
  }
  async readManifest(identity: PdfIdentity) { return copy(this.manifests.get(key(identity)) ?? null); }
  async commitBatch(batch: SearchBatch) {
    const id = key(batch.manifest.document), before = this.manifests.get(id);
    if ((before?.revision ?? null) !== batch.expectedRevision) throw new Error("index_revision_conflict");
    if (batch.replacePages) for (const [pageKey, page] of this.pages) if (key(page.document) === id) this.pages.delete(pageKey);
    for (const page of batch.pages) this.pages.set(JSON.stringify([id, page.pageNumber]), copy(page));
    this.manifests.set(id, copy(batch.manifest));
  }
  allPages() { return [...this.pages.values()].map(copy); }
  dump() { return JSON.stringify({ manifests: [...this.manifests], pages: [...this.pages] } satisfies Snapshot); }
}
