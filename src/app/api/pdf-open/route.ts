import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  const { filename } = await req.json() as { filename?: string };

  if (!filename || typeof filename !== "string") {
    return NextResponse.json({ error: "filename fehlt" }, { status: 400 });
  }

  // Sicherheit: nur .pdf, kein path traversal
  const base = path.basename(filename);
  if (!base.endsWith(".pdf") || base !== filename) {
    return NextResponse.json({ error: "Ungültiger Dateiname" }, { status: 400 });
  }

  const basePath = process.env.PDF_BASE_PATH;
  if (!basePath) {
    return NextResponse.json({ error: "PDF_BASE_PATH nicht konfiguriert" }, { status: 500 });
  }

  const fullPath = path.join(basePath, base);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "PDF nicht gefunden" }, { status: 404 });
  }

  // macOS: öffne mit Vorschau-App
  exec(`open -a Preview "${fullPath.replace(/"/g, '\\"')}"`, (err) => {
    if (err) console.error("Preview open error:", err);
  });

  return NextResponse.json({ ok: true });
}
