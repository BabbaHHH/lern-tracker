import type { PdfPageGeometry } from "./contract";
/** Normalized positions use the unrotated CropBox, origin top-left, x/y in 0..1.
 * viewportTransform is PDF.js's actual rotation/scale/translation matrix. */
export function toViewport(geometry: PdfPageGeometry, x: number, y: number) {
  const [left, bottom, right, top] = geometry.viewBox;
  const [a, b, c, d, e, f] = geometry.viewportTransform;
  const px = left + x * (right - left), py = top - y * (top - bottom);
  return { x: a * px + c * py + e, y: b * px + d * py + f };
}
export function fromViewport(geometry: PdfPageGeometry, x: number, y: number) {
  const [left, bottom, right, top] = geometry.viewBox;
  const [a, b, c, d, e, f] = geometry.viewportTransform;
  const determinant = a * d - b * c;
  if (!determinant || right <= left || top <= bottom) throw new Error("Ungültige Seitengeometrie.");
  const px = (d * (x - e) - c * (y - f)) / determinant;
  const py = (-b * (x - e) + a * (y - f)) / determinant;
  return { x: (px - left) / (right - left), y: (top - py) / (top - bottom) };
}
