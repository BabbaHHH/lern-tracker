import assert from "node:assert/strict";
import { test } from "node:test";
import { indexTextRuns, searchPages } from "../src/lib/search/core";
import { normalizeSearchText } from "../src/lib/search/normalize";
import { parseNormQuery } from "../src/lib/search/norms";
import { PDF_TEXT_VERSION, pdfViewerURL } from "../src/lib/pdf-viewer/contract";
import { findQuote } from "../src/lib/pdf-viewer/text";
import { fixtureDocument } from "../scripts/search/fixtures";

const document = fixtureDocument(Buffer.from("synthetic core"));
const page = (text: string) => indexTextRuns(document, 1, [{ str: text }]);

test("SEARCH-A0: case-insensitive phrase maps hyphens, whitespace and repeated occurrences to PDF-A", () => {
  const original = "😀 Kaufmän-\nnisches\tBestätigungsschreiben. KAUFMÄNNISCHES Bestätigungsschreiben";
  const result = searchPages([page(original)], { text: "kaufmännisches bestätigungsschreiben" });
  assert.equal(result.totalHits, 2);
  for (const [occurrence, hit] of result.hits.entries()) {
    assert.deepEqual({ start: hit.start, end: hit.end }, findQuote(original, "kaufmännisches Bestätigungsschreiben", occurrence));
    assert.equal(hit.evidence, original.slice(hit.start, hit.end));
    assert.equal(hit.occurrence, occurrence);
    assert.equal(hit.textVersion, PDF_TEXT_VERSION);
    assert.equal(hit.role, "kombiniert");
    assert.equal(hit.relevance, "mention");
    assert.equal(hit.viewerURL, pdfViewerURL({ klausurId: document.klausurId, documentId: document.documentId,
      documentVersionId: document.documentVersionId }, hit.target));
    const url = new URL(hit.viewerURL, "http://localhost");
    assert.equal(url.searchParams.has("sha256"), false);
    assert.equal(url.searchParams.has("role"), false);
    assert.equal(Number(url.searchParams.get("start")), hit.start);
    assert.equal(hit.excerpt.text.slice(hit.start - hit.excerpt.start, hit.end - hit.excerpt.start), hit.evidence);
  }
});

test("SEARCH-A0: normalization preserves UTF-16 positions, ligatures, soft hyphens and real compound hyphens", () => {
  const text = "😀 ofﬁce\u00ad\r\nTest und E-Mail Kaufmän- \r\n nisch";
  const normalized = normalizeSearchText(text);
  assert.equal(normalized.value.length, normalized.starts.length);
  assert.equal(normalized.ends.length, normalized.starts.length);
  for (const quote of ["officeTest", "E-Mail", "Kaufmännisch", "😀"]) {
    const hit = searchPages([page(text)], { text: quote }).hits[0];
    assert.ok(hit);
    assert.deepEqual({ start: hit.start, end: hit.end }, findQuote(text, quote));
  }
  assert.equal(searchPages([page(text)], { text: "EMail" }).totalHits, 0);
});

test("SEARCH-A0: normalized partial ligature matches deduplicate the same original glyph", () => {
  const result = searchPages([page("ﬀ")], { text: "f" });
  assert.equal(result.totalHits, 1);
  assert.equal(result.hits[0].evidence, "ﬀ");
});

test("SEARCH-A0: norm spelling variants require exact law and paragraph, with original citation evidence", () => {
  const source = page("§ 172 BGB; §172 Abs. 1 Satz 2 ZPO; Paragraph 172 z.p.o.; 172 ZPO; § 1720 ZPO; § 172a ZPO; §172 ZPOx.");
  for (const input of ["§ 172 ZPO", "§172 zpo", "Paragraph 172 Z.P.O.", "172 ZPO"]) {
    assert.deepEqual(parseNormQuery(input), { law: "ZPO", paragraph: "172" });
    const result = searchPages([source], { text: input });
    assert.equal(result.totalHits, 3);
    assert.ok(result.hits.every(hit => hit.kinds.includes("norm")));
    assert.ok(result.hits.every(hit => !/BGB|1720|172a|ZPOx/.test(hit.evidence)));
  }
  assert.equal(searchPages([source], { norm: { law: "BGB", paragraph: "172" } }).totalHits, 1);
  assert.equal(searchPages([source], { norm: { law: "ZPO", paragraph: "172a" } }).totalHits, 1);
  assert.equal(searchPages([page("§ 172 BGB")], { text: "§ 172 ZPO" }).totalHits, 0);
});

test("SEARCH-A0: explicit norm lists stay evidenced, bare numbers and unexpanded ranges are not guessed", () => {
  const source = page("§§ 172, 173 ZPO; § 172; 172; §§ 174–176 ZPO");
  assert.equal(searchPages([source], { norm: { law: "ZPO", paragraph: "172" } }).totalHits, 1);
  assert.equal(searchPages([source], { norm: { law: "ZPO", paragraph: "173" } }).hits[0].evidence, "§§ 172, 173 ZPO");
  assert.equal(searchPages([source], { norm: { law: "ZPO", paragraph: "175" } }).totalHits, 0);
  assert.equal(searchPages([source], { norm: { law: "ZPO", paragraph: "176" } }).totalHits, 0);
  assert.equal(parseNormQuery("Welche Klausur behandelt § 172 ZPO?"), null);
});

test("SEARCH-A0: explicitly combined phrase/norm queries return a union without duplicate intervals", () => {
  const result = searchPages([page("BGB und § 172 ZPO und BGB")], { text: "BGB", norm: { law: "ZPO", paragraph: "172" } });
  assert.equal(result.totalHits, 3);
  assert.deepEqual(result.hits.map(hit => hit.evidence), ["BGB", "§ 172 ZPO", "BGB"]);
  const citations = searchPages([page("§ 172 BGB; § 172 ZPO")], { text: "§ 172 BGB", norm: { law: "ZPO", paragraph: "172" } });
  assert.deepEqual(citations.hits.map(hit => hit.evidence), ["§ 172 BGB", "§ 172 ZPO"]);
});

test("SEARCH-A0: no-text, failed and stale pages are reported separately, never searched", () => {
  const blank = page(" \t\n"), failed = { ...page("hidden"), textStatus: "failed" as const }, stale = { ...page("hidden"), textVersion: "old" };
  const result = searchPages([blank, failed, stale, page("visible")], { text: "hidden" });
  assert.equal(blank.textStatus, "needs_ocr");
  assert.equal(result.totalHits, 0);
  assert.deepEqual(result.coverage, { readyPages: 1, missingTextPages: 1, failedPages: 1, stalePages: 1 });
});

test("SEARCH-A0: hit limit reports true total and rejects empty/unbounded queries", () => {
  const result = searchPages([page("Test Test Test")], { text: "TEST" }, 2);
  assert.equal(result.hits.length, 2); assert.equal(result.totalHits, 3); assert.equal(result.limited, true);
  for (const text of ["", " \n ", "x".repeat(2001)]) assert.throws(() => searchPages([], { text }));
  assert.throws(() => searchPages([], { text: "Test" }, 0));
  assert.throws(() => searchPages([], { norm: { law: "", paragraph: "172" } }));
  assert.throws(() => searchPages([], { norm: { law: "ZPO", paragraph: "1720aX" } }));
});

test("SEARCH-A0: full page text is retained beyond onboarding-style truncation", () => {
  const original = "Vorspann ".repeat(5000) + "kaufmännisches Bestätigungsschreiben";
  const source = page(original);
  assert.equal(source.originalText, original);
  assert.equal(searchPages([source], { text: "kaufmännisches Bestätigungsschreiben" }).hits[0].start, 45_000);
});
