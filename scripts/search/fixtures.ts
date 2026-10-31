import { createHash } from "node:crypto";
import type { SearchDocument } from "../../src/lib/search/contract";

/** Deterministic, entirely synthetic PDF with WinAnsi glyphs and explicit Unicode map.
 * No imports from account fixtures, no database and no original collection access. */
export function syntheticSearchPdf(pages: readonly (readonly string[])[], unusedBytes = 0): Buffer {
  const codes = new Map<string, number>();
  for (const char of pages.flat().join("")) {
    if (!codes.has(char)) codes.set(char, char === "ﬁ" ? 129 : char.codePointAt(0)!);
  }
  if ([...codes.values()].some(code => code > 255)) throw new Error("unsupported_fixture_glyph");
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Synthetic) /Ordering (Unicode) /Supplement 0 >> def\n/CMapName /SearchSynthetic def\n/CMapType 2 def\n1 begincodespacerange\n<00> <ff>\nendcodespacerange\n${codes.size} beginbfchar\n${[...codes].map(([char, code]) => `<${code.toString(16).padStart(2, "0")}> <${char.charCodeAt(0).toString(16).padStart(4, "0")}>`).join("\n")}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
  const stream = (text: string) => `<< /Length ${Buffer.byteLength(text, "latin1")} >>\nstream\n${text}\nendstream`;
  const objects = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [129 /fi] >> /ToUnicode 4 0 R >>", stream(cmap)];
  const kids: string[] = [];
  pages.forEach((lines, index) => {
    const pageId = objects.length + 1;
    kids.push(`${pageId} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ${index === 1 ? "/Rotate 90" : ""} /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
    // An empty page has a vector rectangle but no text. OCR cannot be inferred.
    const content = lines.length ? `BT /F1 12 Tf 40 790 Td\n${lines.map((line, number) => `${number ? "0 -24 Td " : ""}<${[...line].map(char => codes.get(char)!.toString(16).padStart(2, "0")).join("")}> Tj`).join("\n")}\nET` : "0.9 g 40 600 250 100 re f";
    objects.push(stream(content));
  });
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  if (unusedBytes) objects.push(stream("x".repeat(unusedBytes)));
  let text = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(text, "latin1")); text += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(text, "latin1");
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text, "latin1");
}
export function fixtureDocument(bytes: Uint8Array, version = "synthetic-v1", role: SearchDocument["role"] = "kombiniert"): SearchDocument {
  return { klausurId: "synthetic-case", documentId: "synthetic-document", documentVersionId: version, role,
    sha256: createHash("sha256").update(bytes).digest("hex") };
}
export function searchFixtures() {
  const combined = syntheticSearchPdf([
    ["SEARCH-A0: synthetischer Sachverhalt und Loesung", "Kaufmän-", "nisches Bestätigungsschreiben", "Nochmals: KAUFMÄNNISCHES BESTÄTIGUNGSSCHREIBEN", "Die ofﬁce-Ligatur bleibt im Originaltext.", "Beleg ausserhalb der Metadaten: § 172 ZPO."],
    ["Normvergleich: § 172 BGB und §172 Abs. 1 Satz 2 ZPO.", "Andere Normen: § 1720 ZPO und § 172a ZPO.", "Liste: §§ 172, 173 ZPO."], []]);
  const changed = syntheticSearchPdf([["Neue Dokumentversion", "Jetzt nur einmal: kaufmännisches Bestätigungsschreiben", "§ 172 BGB"]]);
  const otherLaw = syntheticSearchPdf([["Negativer Vergleich: § 172 BGB", "Kein ZPO-Verweis auf dieser Seite."]]);
  return [
    { name: "combined-v1.pdf", bytes: combined, document: fixtureDocument(combined) },
    { name: "combined-v2.pdf", bytes: changed, document: fixtureDocument(changed, "synthetic-v2") },
    { name: "other-law.pdf", bytes: otherLaw, document: { ...fixtureDocument(otherLaw, "other-v1", "sachverhalt"), klausurId: "other-case", documentId: "other-document" } },
  ];
}
