import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/docs/parse/route";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const originalEnv = process.env;
afterEach(() => { process.env = originalEnv; });
function request(filename: string, content: Buffer) {
  process.env = { ...originalEnv, NODE_ENV: "test" };
  return new Request("http://localhost:3000/api/docs/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename, dataUrl: `data:application/octet-stream;base64,${content.toString("base64")}` }) });
}
function pdfFixture() {
  const content = "BT /F1 12 Tf 50 750 Td (StEx PDF Import Test) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(result)); result += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const start = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(result);
}

test("PDF v2 parser extracts text from a real PDF byte stream", async () => {
  const result = await POST(request("test.pdf", pdfFixture()));
  const body = await result.json();
  assert.equal(result.status, 200, JSON.stringify(body));
  assert.match(body.text, /StEx PDF Import Test/);
});

test("XLSX and legacy XLS remain supported by the patched parser", async () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Datum", "Thema"], ["2026-10-08", "Zivilrecht"]]), "Plan");
  for (const bookType of ["xlsx", "xls"] as const) {
    const result = await POST(request(`plan.${bookType}`, XLSX.write(wb, { type: "buffer", bookType })));
    const body = await result.json();
    assert.equal(result.status, 200, JSON.stringify(body));
    assert.match(body.text, /Zivilrecht/);
  }
});

test("DOCX extracts plain text without rendering uploaded HTML", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>StEx DOCX Import Test</w:t></w:r></w:p></w:body></w:document>');
  const result = await POST(request("test.docx", await zip.generateAsync({ type: "nodebuffer" })));
  const body = await result.json();
  assert.equal(result.status, 200, JSON.stringify(body));
  assert.match(body.text, /StEx DOCX Import Test/);
});

test("formatted empty spreadsheet rows do not consume the document budget", async () => {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Januar", "Februar"], ["Fokus ZR", "Fokus StR"]]);
  sheet["!ref"] = "A1:Z1004";
  XLSX.utils.book_append_sheet(wb, sheet, "Plan");
  const response = await POST(request("historisch.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx" })));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.truncated, false);
  assert.ok(body.text.length < 300);
  assert.match(body.text, /Fokus StR/);
});

test("CSV works; unsupported, invalid PDF and oversized uploads fail clearly", async () => {
  assert.equal((await POST(request("test.csv", Buffer.from("Datum,Thema\n2026-10-08,StPO")))).status, 200);
  assert.equal((await POST(request("test.exe", Buffer.from("data")))).status, 415);
  assert.equal((await POST(request("test.pdf", Buffer.from("not a PDF")))).status, 422);
  assert.equal((await POST(request("test.txt", Buffer.alloc(4 * 1024 * 1024 + 1, "x")))).status, 413);
});
