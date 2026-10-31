import { AccountError, accountFailure, exactFields, sameOrigin } from "../auth/security";
import type { CatalogPdfService } from "./service";

/** Both the attachment header and browser fallback use a bounded basename. */
export function pdfDownloadFilename(source: string): string {
  const basename = source.split(/[\\/]/).at(-1) ?? "";
  const name = basename.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9 _().-]/g, "_").replace(/^[. ]+|[. ]+$/g, "").slice(0, 120);
  return `${name || "Dokument"}.pdf`;
}

export async function catalogPdfDownloadHTTP(request: Request, service: CatalogPdfService): Promise<Response> {
  try {
    sameOrigin(request, service.auth.baseURL);
    if (request.method !== "POST") throw new AccountError("invalid_input", "Diese Aktion ist nicht verfügbar.", 405);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AccountError("invalid_input", "Der Downloadauftrag ist ungültig.");
    // Bound input before JSON parsing, including bodies without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new AccountError("invalid_input", "Der Downloadauftrag fehlt.");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const item = await reader.read(); if (item.done) break;
        size += item.value.byteLength;
        if (size > 4096) { await reader.cancel(); throw new AccountError("invalid_input", "Der Downloadauftrag ist zu groß."); }
        chunks.push(item.value);
      }
    } finally { reader.releaseLock(); }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new AccountError("invalid_input", "Der Downloadauftrag ist ungültig."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccountError("invalid_input", "Der Downloadauftrag ist ungültig.");
    const data = body as Record<string, unknown>;
    exactFields(data, ["klausurId", "documentId", "documentVersionId", "requestId"]);
    if ([data.klausurId, data.documentId, data.documentVersionId, data.requestId].some(value => typeof value !== "string")) throw new AccountError("invalid_input", "Der Downloadauftrag ist ungültig.");
    const identity = { klausurId: data.klausurId as string, documentId: data.documentId as string, documentVersionId: data.documentVersionId as string };
    return await service.read(request.headers, identity, {
      downloadRequestId: data.requestId as string,
      needsBytes: () => true,
      respond: (descriptor, bytes) => new Response(new Uint8Array(bytes!), { headers: {
        "Content-Type": "application/pdf", "Content-Length": String(bytes!.length),
        "Content-Disposition": `attachment; filename="${pdfDownloadFilename(descriptor.sourceFilename)}"`,
        "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie",
        "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
      } }),
    });
  } catch (error) { return accountFailure(error); }
}
