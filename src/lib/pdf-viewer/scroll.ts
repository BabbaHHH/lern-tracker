import type { PdfSearchTarget } from "./contract";

export interface VisiblePdfPage {
  pageNumber: number;
  top: number;
  bottom: number;
  intersecting: boolean;
}

/** Search offsets may only be applied to their exact physical PDF page. */
export function pdfSearchTargetForPage(target: PdfSearchTarget | null, pageNumber: number): PdfSearchTarget | null {
  return target?.pageNumber === pageNumber ? target : null;
}

/** Keep rendered canvas/text-layer memory bounded while preserving adjacent pages. */
export function pdfRenderWindow(pageNumber: number, pageCount: number, radius = 1): number[] {
  if (!Number.isSafeInteger(pageNumber) || !Number.isSafeInteger(pageCount)
    || !Number.isSafeInteger(radius) || pageCount < 1 || radius < 0) return [];
  const center = Math.max(1, Math.min(pageNumber, pageCount));
  const first = Math.max(1, center - radius);
  const last = Math.min(pageCount, center + radius);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/** Select the page whose visible center is nearest the scroll viewport center. */
export function visiblePdfPage(pages: Iterable<VisiblePdfPage>, viewportTop: number, viewportBottom: number): number | null {
  if (!Number.isFinite(viewportTop) || !Number.isFinite(viewportBottom) || viewportBottom < viewportTop) return null;
  const center = (viewportTop + viewportBottom) / 2;
  let selected: VisiblePdfPage | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (const page of pages) {
    if (!page.intersecting || !Number.isSafeInteger(page.pageNumber) || page.pageNumber < 1
      || !Number.isFinite(page.top) || !Number.isFinite(page.bottom) || page.bottom < page.top) continue;
    const nextDistance = Math.abs((page.top + page.bottom) / 2 - center);
    if (nextDistance < distance || (nextDistance === distance && page.pageNumber < (selected?.pageNumber ?? Infinity))) {
      selected = page;
      distance = nextDistance;
    }
  }
  return selected?.pageNumber ?? null;
}
