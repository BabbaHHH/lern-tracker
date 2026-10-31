import assert from "node:assert/strict";
import { test } from "node:test";
import { searchFixtures, fixtureDocument, syntheticSearchPdf } from "../scripts/search/fixtures";
import { MemorySearchAdapter } from "../scripts/search/memory-adapter";
import { extractSearchBatch } from "../src/lib/server/search/extract";
import { searchPages } from "../src/lib/search/core";
import { pageText, findQuote } from "../src/lib/pdf-viewer/text";
import { PDF_TEXT_VERSION } from "../src/lib/pdf-viewer/contract";

test("SEARCH-A0: actual synthetic PDF extraction resumes bounded batches after JSON restart", async () => {
  const fixture = searchFixtures()[0];
  let adapter = new MemorySearchAdapter();
  let manifest = await extractSearchBatch(fixture.bytes, fixture.document, adapter, { maxPages: 1 });
  assert.equal(manifest.status, "pending"); assert.equal(manifest.nextPage, 2);
  assert.equal(adapter.allPages().length, 1);
  const firstPage = adapter.allPages()[0];
  assert.match(firstPage.originalText, /Kaufmän-\nnisches/);
  // PDF.js normalizes the fixture's Unicode fi ligature before pageText, as in PDF-A.
  assert.match(firstPage.originalText, /office/);
  // Recreate the adapter, not merely reuse object references in the same process.
  adapter = new MemorySearchAdapter(adapter.dump());
  manifest = await extractSearchBatch(fixture.bytes, fixture.document, adapter, { maxPages: 1 });
  assert.equal(manifest.nextPage, 3); assert.equal(manifest.status, "pending");
  manifest = await extractSearchBatch(fixture.bytes, fixture.document, adapter, { maxPages: 1 });
  assert.equal(manifest.pageCount, 3); assert.equal(manifest.nextPage, 4);
  assert.equal(manifest.status, "needs_ocr");
  assert.equal(manifest.readyPages, 2); assert.equal(manifest.missingTextPages, 1);
  const before = adapter.dump();
  assert.deepEqual(await extractSearchBatch(fixture.bytes, fixture.document, adapter), manifest);
  assert.equal(adapter.dump(), before);
  const phrase = searchPages(adapter.allPages(), { text: "kaufmännisches Bestätigungsschreiben" });
  assert.equal(phrase.totalHits, 2);
  for (const hit of phrase.hits) {
    assert.deepEqual(hit.target, { pageNumber: 1, start: hit.start, end: hit.end, textVersion: PDF_TEXT_VERSION });
    assert.deepEqual({ start: hit.start, end: hit.end }, findQuote(firstPage.originalText, "kaufmännisches Bestätigungsschreiben", hit.occurrence));
  }
  assert.ok(adapter.allPages().every(page => page.document.role === "kombiniert"));
  assert.equal(searchPages(adapter.allPages(), { norm: { law: "ZPO", paragraph: "172" } }).totalHits, 3);
});

test("SEARCH-A0: server extraction equals PDF-A's regular browser-engine text construction", async () => {
  const fixture = searchFixtures()[0], adapter = new MemorySearchAdapter();
  await extractSearchBatch(fixture.bytes, fixture.document, adapter);
  // Legacy server import initializes Node's canvas primitives; regular build is the viewer engine.
  const viewerEngineModule = "pdfjs-dist/build/pdf.mjs";
  const engine = await import(viewerEngineModule) as typeof import("pdfjs-dist");
  const task = engine.getDocument({ data: Uint8Array.from(fixture.bytes), isEvalSupported: false, verbosity: 0 });
  try {
    const pdf = await task.promise;
    for (const indexed of adapter.allPages()) {
      const content = await (await pdf.getPage(indexed.pageNumber)).getTextContent();
      const runs = content.items.filter(item => "str" in item);
      assert.equal(indexed.originalText, pageText(runs).text);
    }
  } finally { await task.destroy(); }
});

test("SEARCH-A0: new document version keeps old offsets and roles isolated; rebuild is reproducible", async () => {
  const [old, changed, other] = searchFixtures(), adapter = new MemorySearchAdapter();
  for (const fixture of [old, changed, other]) await extractSearchBatch(fixture.bytes, fixture.document, adapter);
  const result = searchPages(adapter.allPages(), { text: "kaufmännisches Bestätigungsschreiben" });
  assert.deepEqual(result.hits.map(hit => hit.documentVersionId), ["synthetic-v1", "synthetic-v1", "synthetic-v2"]);
  assert.notEqual(result.hits[0].start, result.hits[2].start);
  const norm = searchPages(adapter.allPages(), { text: "§ 172 ZPO" });
  assert.equal(norm.totalHits, 3);
  assert.ok(norm.hits.every(hit => hit.documentVersionId === "synthetic-v1"));
  const pages = adapter.allPages();
  await extractSearchBatch(old.bytes, old.document, adapter, { rebuild: true, maxPages: 1 });
  assert.equal(adapter.allPages().filter(page => page.document.documentVersionId === "synthetic-v1").length, 1);
  await extractSearchBatch(old.bytes, old.document, adapter);
  assert.deepEqual(adapter.allPages().sort((a, b) => a.document.documentVersionId.localeCompare(b.document.documentVersionId) || a.pageNumber - b.pageNumber),
    pages.sort((a, b) => a.document.documentVersionId.localeCompare(b.document.documentVersionId) || a.pageNumber - b.pageNumber));
});

test("SEARCH-A0: actual PDF pages beyond page 100 remain searchable in successive portions", async () => {
  const bytes = syntheticSearchPdf(Array.from({ length: 101 }, (_, index) => [`Seite ${index + 1}`, index === 100 ? "Spaeter Volltextbeleg" : "Vorspann"]));
  const document = fixtureDocument(bytes, "long-v1"), adapter = new MemorySearchAdapter();
  let manifest;
  do { manifest = await extractSearchBatch(bytes, document, adapter, { maxPages: 16 }); }
  while (manifest.status === "pending");
  assert.equal(manifest.readyPages, 101);
  assert.equal(searchPages(adapter.allPages(), { text: "Spaeter Volltextbeleg" }).hits[0].pageNumber, 101);
});

test("SEARCH-A0: invalid PDFs and resource limits fail honestly without truncated searchable text", async () => {
  const bad = Buffer.from("not a PDF"), invalidAdapter = new MemorySearchAdapter();
  const failed = await extractSearchBatch(bad, fixtureDocument(bad), invalidAdapter);
  assert.equal(failed.status, "failed"); assert.equal(failed.failure, "invalid_pdf");
  assert.equal(failed.pageCount, null); assert.equal(invalidAdapter.allPages().length, 0);
  const fixture = searchFixtures()[0], byteAdapter = new MemorySearchAdapter();
  const byteLimit = await extractSearchBatch(fixture.bytes, fixture.document, byteAdapter, { maxBytes: 10 });
  assert.equal(byteLimit.failure, "document_byte_limit"); assert.equal(byteAdapter.allPages().length, 0);
  const pageAdapter = new MemorySearchAdapter();
  const pageLimit = await extractSearchBatch(fixture.bytes, fixture.document, pageAdapter, { maxPageCharacters: 5 });
  assert.equal(pageLimit.status, "failed"); assert.equal(pageLimit.failedPages, 2);
  assert.ok(pageAdapter.allPages().filter(page => page.textStatus === "failed").every(page =>
    page.failure === "page_text_limit" && page.originalText === "" && page.normalized.value === ""));
});

test("SEARCH-A0: immutable byte/role conflicts, cancellation and invalid limits leave index untouched", async () => {
  const [fixture, changed] = searchFixtures(), adapter = new MemorySearchAdapter();
  await extractSearchBatch(fixture.bytes, fixture.document, adapter, { maxPages: 1 });
  const before = adapter.dump();
  await assert.rejects(() => extractSearchBatch(changed.bytes, fixture.document, adapter), /source_hash_mismatch/);
  await assert.rejects(() => extractSearchBatch(changed.bytes, { ...fixture.document, sha256: changed.document.sha256 }, adapter), /immutable_document_conflict/);
  await assert.rejects(() => extractSearchBatch(fixture.bytes, { ...fixture.document, role: "loesung" }, adapter), /immutable_document_conflict/);
  for (const maxPages of [0, 17, NaN]) await assert.rejects(() => extractSearchBatch(fixture.bytes, fixture.document, adapter, { maxPages }), /invalid_extraction_limit/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => extractSearchBatch(fixture.bytes, fixture.document, adapter, { signal: controller.signal }));
  assert.equal(adapter.dump(), before);
});

test("SEARCH-A0: adapter revision conflicts reject concurrent stale commits", async () => {
  const fixture = searchFixtures()[0], adapter = new MemorySearchAdapter();
  const captured: Parameters<MemorySearchAdapter["commitBatch"]>[0][] = [];
  const worker = { readManifest: () => Promise.resolve(null), commitBatch: async (batch: Parameters<MemorySearchAdapter["commitBatch"]>[0]) => { captured.push(batch); } };
  await extractSearchBatch(fixture.bytes, fixture.document, worker, { maxPages: 1 });
  await adapter.commitBatch(captured[0]);
  await assert.rejects(() => adapter.commitBatch(captured[0]), /index_revision_conflict/);
  const snapshot = JSON.parse(adapter.dump());
  snapshot.manifests[0][1].textVersion = "obsolete";
  const stale = new MemorySearchAdapter(JSON.stringify(snapshot));
  await assert.rejects(() => extractSearchBatch(fixture.bytes, fixture.document, stale), /index_rebuild_required/);
  assert.equal((await extractSearchBatch(fixture.bytes, fixture.document, stale, { rebuild: true })).textVersion, PDF_TEXT_VERSION);
});
