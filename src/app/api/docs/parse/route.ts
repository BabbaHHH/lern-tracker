import { NextRequest, NextResponse } from "next/server";

const MAX_CHARS = 15000;

export async function POST(req: NextRequest) {
  try {
    const { dataUrl, filename } = await req.json() as { dataUrl?: string; filename?: string };
    if (!dataUrl || !filename) {
      return NextResponse.json({ error: "dataUrl und filename fehlen" }, { status: 400 });
    }

    const [meta, b64] = dataUrl.split(",");
    if (!b64) return NextResponse.json({ error: "Ungültige dataUrl" }, { status: 400 });

    const buf = Buffer.from(b64, "base64");
    const lower = filename.toLowerCase();
    let text = "";

    if (lower.endsWith(".pdf")) {
      // pdf-parse: dynamisch importieren damit Next.js Server Component es nicht bundlet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfMod = await import("pdf-parse") as any;
      const pdfParse = (pdfMod.default ?? pdfMod) as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buf);
      text = result.text;
    } else if (lower.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value;
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      // xlsx-Dateien: XLSX library
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "buffer" });
      text = wb.SheetNames.map(name => {
        const ws = wb.Sheets[name];
        return `=== ${name} ===\n${XLSX.utils.sheet_to_csv(ws)}`;
      }).join("\n\n");
    } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      text = buf.toString("utf-8");
    } else {
      return NextResponse.json({ error: "Dateityp nicht unterstützt" }, { status: 415 });
    }

    // Auf MAX_CHARS kürzen
    const trimmed = text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
    return NextResponse.json({ text: trimmed, chars: trimmed.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
