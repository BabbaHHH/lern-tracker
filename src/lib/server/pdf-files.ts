import path from "node:path";
import { realpath, stat } from "node:fs/promises";
import { RequestError } from "./request-safety";

export async function findLocalPdf(filename: unknown): Promise<string> {
  if (typeof filename !== "string" || filename.length > 255 || !/\.pdf$/i.test(filename)
    || /[/\\\x00-\x1f\x7f]/.test(filename) || filename !== path.basename(filename)) {
    throw new RequestError("Ungültiger PDF-Dateiname.");
  }
  const configured = process.env.PDF_BASE_PATH;
  if (!configured) throw new RequestError("Der lokale PDF-Ordner ist noch nicht eingerichtet.", 503);
  let root: string;
  try { root = await realpath(configured); }
  catch { throw new RequestError("Der lokale PDF-Ordner ist nicht erreichbar.", 503); }
  for (const name of [filename, filename.replace(/\.pdf$/i, "_komplett.pdf")]) {
    let resolved: string;
    try { resolved = await realpath(path.join(root, name)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const relative = path.relative(root, resolved);
    if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
      throw new RequestError("Die Datei liegt außerhalb des freigegebenen PDF-Ordners.", 403);
    }
    const info = await stat(resolved);
    if (!info.isFile()) throw new RequestError("Keine PDF-Datei.");
    if (info.size > 100 * 1024 * 1024) throw new RequestError("Die PDF ist größer als 100 MB.", 413);
    return resolved;
  }
  throw new RequestError("PDF nicht gefunden.", 404);
}
