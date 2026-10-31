import type { NormalizedText } from "./contract";

/** Mirrors PDF-A's findQuote normalization, with an explicit serializable offset map.
 * The original PDF.js pageText is never rewritten. Hyphen deletion is limited to EOL. */
export function normalizeSearchText(text: string): NormalizedText {
  let value = "";
  const starts: number[] = [], ends: number[] = [];
  const lineHyphen = /[-\u00ad][ \t]*\r?\n[ \t]*/y;
  for (let index = 0; index < text.length;) {
    lineHyphen.lastIndex = index;
    const removed = lineHyphen.exec(text);
    if (removed) { index += removed[0].length; continue; }
    const char = String.fromCodePoint(text.codePointAt(index)!);
    const next = index + char.length;
    if (char !== "\u00ad") {
      for (const converted of char.normalize("NFKC").toLocaleLowerCase("de")) {
        if (/\s/u.test(converted) && value.endsWith(" ")) {
          ends[ends.length - 1] = next;
          continue;
        }
        const output = /\s/u.test(converted) ? " " : converted;
        value += output;
        for (let unit = 0; unit < output.length; unit++) { starts.push(index); ends.push(next); }
      }
    }
    index = next;
  }
  return { value, starts, ends };
}

export function originalInterval(text: NormalizedText, start: number, end: number) {
  if (start < 0 || end <= start || end > text.value.length) throw new Error("invalid_normalized_interval");
  return { start: text.starts[start], end: text.ends[end - 1] };
}
