import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildInventory,
  caseKey,
  inferDocumentRole,
  normalizeText,
} from "../scripts/import-inventory/inventory";

test("normalisiert Fallkennungen ohne Rollen- und Versionssuffixe", () => {
  assert.equal(caseKey("061_StR_I_combined_komplett.pdf"), "061 str i");
  assert.equal(caseKey("061_StR_I_combined_inkl_Loesung.pdf"), "061 str i");
  assert.equal(caseKey("ZA 70 Korn Aufgabe PDFDatei.pdf"), "za 70 korn");
  assert.equal(caseKey("ZA 70 Korn Lösung PDFDatei.pdf"), "za 70 korn");
});

test("ordnet Dokumentrollen konservativ zu", () => {
  assert.equal(inferDocumentRole("061_ZR_I_combined_komplett.pdf"), "kombiniert");
  assert.equal(inferDocumentRole("061_ZR_I_combined_inkl_Loesung.pdf"), "kombiniert");
  assert.equal(inferDocumentRole("061_ZR_I_combined.pdf"), "sachverhalt");
  assert.equal(inferDocumentRole("061_ZR_I_combined (keine og Lösung).pdf"), "sachverhalt");
  assert.equal(inferDocumentRole("061-str-i-data.pdf"), "sachverhalt");
  assert.equal(inferDocumentRole("061_ZR_I_Loesung.pdf"), "loesung");
  assert.equal(inferDocumentRole("Klausuren_Chunk_01.pdf"), "unbekannt");
});

test("normalisiert extrahierten Text für scanunabhängige Fingerprints", () => {
  assert.equal(normalizeText("§ 172 ZPO\n  Rücktritt – Prüfung"), "172 zpo rucktritt prufung");
});

test("trennt bytegleiche Dateien, Fassungen, Lösungen und ID-Konflikte", () => {
  const root = mkdtempSync(join(tmpdir(), "import-inventory-test-"));
  mkdirSync(join(root, "Klausuren_Komplett"), { recursive: true });
  mkdirSync(join(root, "Hamburg Sachverhalte und mal Lösungsskizzen/2_Solitaere_Dateien/Klausuren_Combined"), { recursive: true });
  mkdirSync(join(root, "Lernplan Dokumente"), { recursive: true });
  const metadata = [
    { id: "kg-zr-1", source: "001_ZR_I_combined.pdf", title: "Fall A", date: "2024-01-01", area: "zr", type: "ZR-Urteil", topicIds: ["zr-a"] },
    { id: "kg-zr-1", source: "001_ZR_II_combined.pdf", title: "Fall B", date: "2024-01-02", area: "zr", type: "ZR-Anwaltsklausur", topicIds: ["zr-b"] },
  ];
  writeFileSync(join(root, "Lernplan Dokumente/klausuren_clean.json"), JSON.stringify(metadata));
  writeFileSync(join(root, "Klausuren_Komplett/001_ZR_I_combined_komplett.pdf"), "same case bytes");
  writeFileSync(join(root, "Klausuren_Komplett/001_ZR_I_combined_inkl_Loesung.pdf"), "different scan bytes");
  writeFileSync(join(root, "Hamburg Sachverhalte und mal Lösungsskizzen/2_Solitaere_Dateien/Klausuren_Combined/001_ZR_I_Loesung.pdf"), "solution bytes");
  const report = buildInventory(root);
  assert.equal(report.metadataRecords.length, 2);
  assert.equal(report.idGroups.find(group => group.klausurId === "kg-zr-1")?.classification, "widerspruch_pruefen");
  const group = report.caseGroups.find(item => item.caseKey === "001 zr i");
  assert.ok(group);
  assert.ok(group.classifications.includes("versionskandidat"));
  assert.ok(group.classifications.includes("ergaenzte_loesung"));
  assert.equal(report.exactDuplicateGroups.length, 0);
});

test("erzeugt stabile Datei-IDs unabhängig vom absoluten Stamm", () => {
  const makeRoot = (name: string): string => {
    const root = mkdtempSync(join(tmpdir(), name));
    mkdirSync(join(root, "Lernplan Dokumente"), { recursive: true });
    writeFileSync(join(root, "Lernplan Dokumente/klausuren_clean.json"), "[]");
    return root;
  };
  const first = buildInventory(makeRoot("import-inventory-a-")).files[0]?.inventoryId;
  const second = buildInventory(makeRoot("import-inventory-b-")).files[0]?.inventoryId;
  assert.equal(first, second);
});

test("macht gleiche Textproben auch bei abweichenden Dateinamen sichtbar", () => {
  const root = mkdtempSync(join(tmpdir(), "import-inventory-text-"));
  mkdirSync(join(root, "Klausuren_Komplett"), { recursive: true });
  writeFileSync(join(root, "Klausuren_Komplett/001_ZR_I_combined.pdf"), "scan-a");
  writeFileSync(join(root, "Klausuren_Komplett/anderer-dateiname-klausur.pdf"), "scan-b");
  const report = buildInventory(root, {
    extractText: "selected",
    extractPdfText: () => ({ text: "Gemeinsamer Sachverhalt § 172 ZPO", status: "extracted" }),
  });
  assert.equal(report.textMatchGroups.length, 1);
  assert.deepEqual(report.textMatchGroups[0]?.caseKeys, ["001 zr i", "anderer dateiname klausur"]);
});
