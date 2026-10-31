import assert from "node:assert/strict";
import { test } from "node:test";
import { pdfRenderWindow, pdfSearchTargetForPage, visiblePdfPage } from "../src/lib/pdf-viewer/scroll";

test("R37 PDF scroll renders at most current page and adjacent pages", () => {
  assert.deepEqual(pdfRenderWindow(1, 449), [1, 2]);
  assert.deepEqual(pdfRenderWindow(225, 449), [224, 225, 226]);
  assert.deepEqual(pdfRenderWindow(449, 449), [448, 449]);
  assert.deepEqual(pdfRenderWindow(900, 449), [448, 449]);
  assert.deepEqual(pdfRenderWindow(0, 449), [1, 2]);
  assert.deepEqual(pdfRenderWindow(1, 0), []);
});

test("R37 PDF scroll tracks the visible physical page at the viewport center", () => {
  assert.equal(visiblePdfPage([
    { pageNumber: 4, top: 0, bottom: 700, intersecting: true },
    { pageNumber: 5, top: 716, bottom: 1416, intersecting: true },
  ], 0, 800), 4);
  assert.equal(visiblePdfPage([
    { pageNumber: 4, top: -500, bottom: 200, intersecting: true },
    { pageNumber: 5, top: 216, bottom: 916, intersecting: true },
  ], 0, 800), 5);
  assert.equal(visiblePdfPage([{ pageNumber: 6, top: 0, bottom: 800, intersecting: false }], 0, 800), null);
});

test("R37 PDF scroll keeps a search target bound to its exact physical page", () => {
  const target = { pageNumber: 172, quote: "§ 172 ZPO", occurrence: 1 };
  assert.equal(pdfSearchTargetForPage(target, 172), target);
  assert.equal(pdfSearchTargetForPage(target, 173), null);
  assert.equal(pdfSearchTargetForPage(null, 172), null);
});
