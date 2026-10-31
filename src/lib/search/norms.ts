import { normalizeSearchText, originalInterval } from "./normalize";
import type { NormalizedText, NormReference } from "./contract";

export function normalizeLaw(law: string) {
  if (law.length > 96) throw new Error("invalid_law");
  const value = normalizeSearchText(law).value.replace(/[.\s]/g, "");
  if (!/^[a-zäöü][a-zäöü0-9]{1,23}$/.test(value)) throw new Error("invalid_law");
  return value.toUpperCase();
}
export function normalizeParagraph(paragraph: string) {
  if (paragraph.length > 16) throw new Error("invalid_paragraph");
  const value = paragraph.trim().toLowerCase();
  if (!/^[1-9]\d{0,5}[a-z]?$/.test(value)) throw new Error("invalid_paragraph");
  return value;
}

/** Explicit Gesetz + Paragraph only. No inference from context, no range expansion.
 * Explicit lists share their original citation interval; subsections stay in the evidence. */
export function extractNorms(normalized: NormalizedText): NormReference[] {
  const references: NormReference[] = [];
  const pattern = /(?:§{1,2}|\bparagraph(?:en)?|\b(?=[1-9]))\s*([1-9]\d{0,5}[a-z]?(?:\s*,\s*[1-9]\d{0,5}[a-z]?)*)\s+((?:(?:abs(?:atz)?\.?|s(?:atz)?\.?|nr\.?|lit\.?)\s*(?:\d+|[a-z])\s*)*)([a-zäöü](?:\.?[a-zäöü0-9]){1,23}\.?)\b/gu;
  for (const match of normalized.value.matchAll(pattern)) {
    if (match.index && /[\p{L}\p{N}_\-–—]/u.test(normalized.value[match.index - 1])) continue;
    const after = normalized.value[match.index + match[0].length];
    if (after && /[\p{L}\p{N}_]/u.test(after)) continue;
    const interval = originalInterval(normalized, match.index, match.index + match[0].length);
    const law = normalizeLaw(match[3]);
    // A missing law followed by a qualifier isn't a law citation.
    if (["ABS", "ABSATZ", "SATZ", "NR", "LIT", "UND", "BIS"].includes(law)) continue;
    for (const number of match[1].split(/\s*,\s*/)) {
      references.push({ law, paragraph: normalizeParagraph(number), ...interval });
    }
  }
  return references;
}

/** Returns a norm only for an entire explicit citation, never for arbitrary prose. */
export function parseNormQuery(text: string): { law: string; paragraph: string } | null {
  const normalized = normalizeSearchText(text.trim());
  const norms = extractNorms(normalized);
  if (norms.length !== 1 || norms[0].start !== 0 || !/^\.?$/.test(text.trim().slice(norms[0].end))) return null;
  return { law: norms[0].law, paragraph: norms[0].paragraph };
}
