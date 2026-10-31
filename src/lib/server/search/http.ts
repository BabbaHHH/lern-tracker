import { AccountError, accountFailure, accountResponse, atomicLimit, sameOrigin } from "../auth/security";
import type { CatalogSearchService } from "./service";
import type { SearchContext } from "../../search/catalog-contract";
const SEARCH_BODY_BYTES = 16 * 1024;
async function searchParameters(request: Request): Promise<URLSearchParams> {
  if (request.method === "GET") return new URL(request.url).searchParams;
  if (request.method !== "POST") throw new AccountError("invalid_input", "Nicht unterstützte Methode.", 405);
  if (new URL(request.url).search || request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    throw new AccountError("invalid_input", "Bitte die Suche als JSON senden.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("invalid_input", "Suchanfrage fehlt.");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > SEARCH_BODY_BYTES) { await reader.cancel(); throw new AccountError("too_large", "Die Suchanfrage ist zu groß.", 413); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AccountError("invalid_input", "Ungültige Suchanfrage."); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.values(body).some(value => typeof value !== "string")) {
    throw new AccountError("invalid_input", "Ungültige Suchanfrage.");
  }
  return new URLSearchParams(body as Record<string, string>);
}
export async function catalogSearchHTTP(request: Request, service: CatalogSearchService) {
  try {
    sameOrigin(request, service.auth.baseURL);
    const who = await service.auth.principal(request.headers);
    await service.auth.database.transaction(client => atomicLimit(client, `search:${who.userId}`, 120, 60));
    const params = await searchParameters(request);
    const allowed = ["q", "law", "paragraph", "accountId", "generation", "sessionContext"];
    if ([...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1)) throw new AccountError("invalid_input", "Ungültige Suchanfrage.");
    const text = params.get("q")?.trim(), law = params.get("law"), paragraph = params.get("paragraph");
    if ((text?.length ?? 0) > 2000 || (!!law !== !!paragraph) || (law?.length ?? 0) > 96 || (paragraph?.length ?? 0) > 16) throw new AccountError("invalid_input", "Bitte Suchtext oder Gesetz und Paragraph eingeben.");
    let expected: SearchContext | undefined;
    if (["accountId", "generation", "sessionContext"].some(key => params.has(key))) {
      const generation = Number(params.get("generation"));
      if (!params.get("accountId") || !params.get("sessionContext") || !params.has("generation") || !Number.isSafeInteger(generation)) throw new AccountError("invalid_input", "Die Anmeldung muss erneut geprüft werden.");
      expected = { accountId: params.get("accountId")!, generation, sessionContext: params.get("sessionContext")! };
    }
    return accountResponse(await service.search(request.headers, text || law ? { text, ...(law && paragraph ? { norm: { law, paragraph } } : {}) } : null, expected));
  } catch (error) { return accountFailure(error); }
}
