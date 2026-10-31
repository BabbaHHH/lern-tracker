export interface TextRun { str: string; hasEOL?: boolean }
export function pageText(runs: TextRun[]) {
  let text = "";
  const positions = runs.map(run => {
    const start = text.length;
    text += run.str;
    const end = text.length;
    if (run.hasEOL) text += "\n";
    return { start, end };
  });
  return { text, positions };
}
function normalized(text: string) {
  let value = "";
  const starts: number[] = [], ends: number[] = [];
  for (let index = 0; index < text.length;) {
    const hyphen = /^[-\u00ad][ \t]*\r?\n[ \t]*/.exec(text.slice(index));
    if (hyphen) { index += hyphen[0].length; continue; }
    const char = String.fromCodePoint(text.codePointAt(index)!);
    const next = index + char.length;
    const converted = char.normalize("NFKC").toLocaleLowerCase("de");
    if (char === "\u00ad") { index = next; continue; }
    for (const output of converted) {
      if (/\s/u.test(output)) {
        if (value.endsWith(" ")) { ends[ends.length - 1] = next; continue; }
        value += " ";
      } else value += output;
      // Array entries address UTF-16 offsets, including supplementary characters.
      for (let unit = 0; unit < output.length; unit++) { starts.push(index); ends.push(next); }
    }
    index = next;
  }
  return { value, starts, ends };
}
/** Returns a proven original-text interval; never invents positions for OCR. */
export function findQuote(text: string, quote: string, occurrence = 0) {
  if (!Number.isSafeInteger(occurrence) || occurrence < 0 || quote.length > 2000) return null;
  const source = normalized(text), needle = normalized(quote).value.trim();
  if (!needle) return null;
  let position = -1;
  for (let index = 0; index <= occurrence; index++) {
    position = source.value.indexOf(needle, position + 1);
    if (position < 0) return null;
  }
  return { start: source.starts[position], end: source.ends[position + needle.length - 1] };
}
