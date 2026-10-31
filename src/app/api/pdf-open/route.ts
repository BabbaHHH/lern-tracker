import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findLocalPdf } from "@/lib/server/pdf-files";
import { errorResponse, readJson, requireLocalAccess, RequestError } from "@/lib/server/request-safety";

export async function POST(req: Request) {
  try {
    requireLocalAccess(req);
    if (process.platform !== "darwin") throw new RequestError("Bitte die PDF im Browser öffnen. Vorschau ist nur auf dem Mac verfügbar.", 501);
    const { filename } = await readJson(req, 2048);
    const file = await findLocalPdf(filename);
    // Direct arguments: filenames can never become shell commands.
    await promisify(execFile)("/usr/bin/open", ["-a", "Preview", file], { timeout: 5000 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
