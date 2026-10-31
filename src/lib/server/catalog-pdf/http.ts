import { accountFailure, accountResponse, sameOrigin } from "../auth/security";
import type { CatalogPdfService } from "./service";
import type { PdfIdentity } from "../../pdf-viewer/contract";

export function byteRange(value: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null;
  if (first === null) {
    if (!last || last < 1) return null;
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  if (first >= size || (last !== null && last < first)) return null;
  return { start: first, end: Math.min(last ?? size - 1, size - 1) };
}

export async function catalogPdfHTTP(request: Request, service: CatalogPdfService): Promise<Response> {
  try {
    sameOrigin(request, service.auth.baseURL);
    const params = new URL(request.url).searchParams;
    const identity: PdfIdentity = { klausurId: params.get("klausurId") ?? "", documentId: params.get("documentId") ?? "", documentVersionId: params.get("documentVersionId") ?? "" };
    const describe = params.get("describe") === "1";
    const rawRange = request.method === "GET" && !request.headers.has("if-range") ? request.headers.get("range") : null;
    return await service.read(request.headers, identity, {
      needsBytes: descriptor => !describe && request.method !== "HEAD" && (!rawRange || byteRange(rawRange, descriptor.byteSize) !== null),
      respond: (descriptor, bytes) => {
        if (describe) {
          const response = accountResponse(descriptor);
          return request.method === "HEAD" ? new Response(null, { headers: response.headers }) : response;
        }
        const headers = new Headers({ "Content-Type": "application/pdf", "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie",
          "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Content-Disposition": "inline" });
        // No reusable validators for private documents: conditional requests never
        // bypass authorization. If-Range cannot match without a validator.
        const range = rawRange ? byteRange(rawRange, descriptor.byteSize) : null;
        if (rawRange && !range) {
          headers.set("Content-Range", `bytes */${descriptor.byteSize}`);
          return new Response(null, { status: 416, headers });
        }
        const start = range?.start ?? 0;
        const end = range?.end ?? descriptor.byteSize - 1;
        headers.set("Content-Length", String(end - start + 1));
        if (range) headers.set("Content-Range", `bytes ${start}-${end}/${descriptor.byteSize}`);
        const body = request.method === "HEAD" ? null : new Uint8Array(bytes!.subarray(start, end + 1));
        return new Response(body, { status: range ? 206 : 200, headers });
      },
    });
  } catch (error) {
    const response = accountFailure(error);
    if (request.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
    return response;
  }
}
