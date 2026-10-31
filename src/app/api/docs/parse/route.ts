import { NextResponse } from "next/server";
import { errorResponse, limitRequests, readJson, requireLocalAccess, RequestError } from "@/lib/server/request-safety";
import { extractPdfPlanningText, type PdfPlanningText } from "@/lib/server/pdf-planning-text";

export const runtime = "nodejs";
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_CHARS = 15000;

export async function POST(req: Request) {
  try {
    requireLocalAccess(req);
    limitRequests("doc-parse", 15);
    const { dataUrl, filename } = await readJson(req, 6 * 1024 * 1024);
    if (typeof dataUrl !== "string" || typeof filename !== "string" || !filename || filename.length > 255) {
      throw new RequestError("Datei und Dateiname fehlen oder sind ungültig.");
    }
    const comma = dataUrl.indexOf(",");
    const b64 = dataUrl.slice(comma + 1);
    if (comma < 0 || !/^data:[^,]*;base64$/.test(dataUrl.slice(0, comma)) || !b64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
      throw new RequestError("Ungültige Dateiübertragung.");
    }
    const buf = Buffer.from(b64, "base64");
    if (buf.byteLength > MAX_FILE_BYTES) throw new RequestError("Die Datei darf höchstens 4 MB groß sein.", 413);
    const lower = filename.toLowerCase();
    let text = "";
    let sourceTruncated = false;
    let pdf: PdfPlanningText | undefined;
    if (lower.endsWith(".pdf")) {
      if (buf.subarray(0, 1024).indexOf("%PDF-") < 0) throw new RequestError("Die Datei ist keine gültige PDF.", 422);
      pdf = await extractPdfPlanningText(buf, filename);
      text = pdf.text;
      sourceTruncated = pdf.incomplete;
    } else if (lower.endsWith(".docx")) {
      const { extractRawText } = await import("mammoth");
      text = (await extractRawText({ buffer: buf })).value;
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "buffer", sheetRows: 2000, bookVBA: false });
      sourceTruncated = wb.SheetNames.length > 20 || wb.SheetNames.some(name => !!wb.Sheets[name]["!fullref"]);
      text = wb.SheetNames.slice(0, 20).map(name => `=== ${name} ===\n${XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false })}`).join("\n\n");
    } else if (/\.(txt|md|csv)$/i.test(lower)) {
      text = buf.toString("utf-8");
    } else {
      throw new RequestError("Dateityp nicht unterstützt.", 415);
    }
    const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!normalized) throw new RequestError("Kein lesbarer Text gefunden. Bei gescannten PDFs bitte zuerst eine Texterkennung durchführen.", 422);
    // Inline warnings survive existing clients which persist only the text and
    // truncated flag; additive metadata needs no shared storage/type changes.
    let notice = pdf?.warnings.length ? `HINWEIS ZUR PDF-AUSWERTUNG:\n${pdf.warnings.join("\n")}\n\n` : "";
    if (pdf && notice.length + normalized.length > MAX_CHARS) {
      pdf.warnings.unshift(`Die Ausgabe ist auf ${MAX_CHARS} Zeichen begrenzt; fehlende Texte oder Termine nicht ergänzen oder raten.`);
      notice = `HINWEIS ZUR PDF-AUSWERTUNG:\n${pdf.warnings.join("\n")}\n\n`;
    }
    const trimmed = (notice + normalized).slice(0, MAX_CHARS);
    return NextResponse.json({ text: trimmed, chars: trimmed.length, truncated: sourceTruncated || notice.length + normalized.length > MAX_CHARS,
      ...(pdf ? { pdf: { totalPages: pdf.totalPages, parsedPages: pdf.parsedPages, textAnnotations: pdf.textAnnotations, warnings: pdf.warnings } } : {}),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error instanceof RequestError ? error : new RequestError("Die Datei konnte nicht gelesen werden. Bitte Format und Datei prüfen.", 422));
  }
}
