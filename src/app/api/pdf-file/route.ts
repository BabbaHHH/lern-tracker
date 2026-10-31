import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { findLocalPdf } from "@/lib/server/pdf-files";
import { errorResponse, requireLocalAccess } from "@/lib/server/request-safety";

export async function GET(req: Request) {
  try {
    requireLocalAccess(req);
    const file = await findLocalPdf(new URL(req.url).searchParams.get("name"));
    const buffer = await readFile(file);
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    return errorResponse(error);
  }
}
