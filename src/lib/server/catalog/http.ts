import { AccountError, accountFailure, accountResponse, sameOrigin } from "../auth/security";
import { CATALOG_MAX_METADATA_BYTES, CATALOG_MAX_REQUEST_BYTES, validateCatalogMetadata, validateCatalogPdf, type CatalogImportService } from "./import-service";

function formFile(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") return null;
  return value;
}

async function readLimitedBody(request: Request): Promise<Buffer> {
  const declaredHeader = request.headers.get("content-length");
  if (declaredHeader !== null) {
    if (!/^\d+$/.test(declaredHeader.trim())) throw new AccountError("invalid_input", "Die Größenangabe der Einreichung ist ungültig.");
    const declared = Number(declaredHeader);
    if (!Number.isSafeInteger(declared) || declared > CATALOG_MAX_REQUEST_BYTES) throw new AccountError("too_large", "Die Einreichung ist zu groß.", 413);
  }
  if (!request.body) throw new AccountError("invalid_input", "Das Uploadformular ist leer.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const next = value?.byteLength ?? 0;
      if (total > CATALOG_MAX_REQUEST_BYTES - next) {
        try { await reader.cancel(); } catch { /* Die Größenüberschreitung bleibt der Primärfehler. */ }
        throw new AccountError("too_large", "Die Einreichung ist zu groß.", 413);
      }
      total += next;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function parseSubmission(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim();
  if (contentType !== "multipart/form-data") throw new AccountError("invalid_input", "Bitte die beiden PDF-Dateien als Formular senden.", 415);
  // Read at most the configured request limit before handing the body to the
  // multipart parser. Content-Length is only an early rejection hint; the
  // actual stream remains authoritative when the header is missing or wrong.
  const body = await readLimitedBody(request);
  let form: FormData;
  try {
    const reparsed = new Request(request.url, { method: request.method, headers: new Headers(request.headers), body: body as BodyInit });
    form = await reparsed.formData();
  } catch { throw new AccountError("invalid_input", "Das Uploadformular konnte nicht gelesen werden.", 400); }
  const allowed = new Set(["requestId", "metadata", "sachverhalt", "loesung"]);
  const counts = new Map<string, number>();
  for (const [key] of form.entries()) counts.set(key, (counts.get(key) ?? 0) + 1);
  if ([...counts.keys()].some(key => !allowed.has(key))) throw new AccountError("invalid_input", "Das Uploadformular enthält ein unbekanntes Feld.");
  if ([...counts.values()].some(count => count !== 1)) throw new AccountError("invalid_input", "Jedes Uploadfeld darf nur einmal vorkommen.");
  const requestId = form.get("requestId");
  const metadata = form.get("metadata");
  if (typeof requestId !== "string" || typeof metadata !== "string") throw new AccountError("invalid_input", "Vorgangskennung und Metadaten fehlen.");
  if (Buffer.byteLength(requestId, "utf8") > 128) throw new AccountError("invalid_input", "Die Vorgangskennung ist zu lang.");
  if (Buffer.byteLength(metadata, "utf8") > CATALOG_MAX_METADATA_BYTES) throw new AccountError("too_large", "Die Metadaten sind zu groß.", 413);
  let parsed: unknown;
  try { parsed = JSON.parse(metadata); } catch { throw new AccountError("invalid_input", "Die Metadaten sind kein gültiges JSON."); }
  const sachverhalt = formFile(form.get("sachverhalt"));
  const loesung = formFile(form.get("loesung"));
  if (!sachverhalt || !loesung) throw new AccountError("invalid_input", "Sachverhalt und Lösung müssen als PDF vorliegen.");
  if (sachverhalt.size + loesung.size > CATALOG_MAX_REQUEST_BYTES) throw new AccountError("too_large", "Die Einreichung ist zu groß.", 413);
  return { requestId, metadata: validateCatalogMetadata(parsed), sachverhalt, loesung };
}

/** Route logic kept injectable so the same authenticated multipart contract is tested without a Next server. */
export async function catalogListHTTP(request: Request, service: CatalogImportService): Promise<Response> {
  try {
    sameOrigin(request, service.auth.baseURL);
    return accountResponse({ contractVersion: 1, klausuren: await service.list(request.headers) });
  } catch (error) {
    return accountFailure(error);
  }
}

export async function catalogImportHTTP(request: Request, service: CatalogImportService): Promise<Response> {
  try {
    sameOrigin(request, service.auth.baseURL);
    // Reject anonymous and pending/blocked callers before parsing or hashing their upload.
    await service.auth.principal(request.headers, "active");
    const parsed = await parseSubmission(request);
    const documents = [
      await validateCatalogPdf(parsed.sachverhalt, "sachverhalt"),
      await validateCatalogPdf(parsed.loesung, "loesung"),
    ];
    const result = await service.submit(request.headers, { requestId: parsed.requestId, metadata: parsed.metadata, documents });
    return accountResponse({ contractVersion: 1, import: result.summary }, result.statusCode);
  } catch (error) {
    return accountFailure(error);
  }
}

export async function catalogStatusHTTP(request: Request, service: CatalogImportService): Promise<Response> {
  try {
    sameOrigin(request, service.auth.baseURL);
    await service.auth.principal(request.headers, "active");
    const params = new URL(request.url).searchParams;
    const importId = params.get("importId");
    const requestId = params.get("requestId");
    if ((importId && requestId) || (!importId && !requestId)) throw new AccountError("invalid_input", "Import- oder Vorgangskennung fehlt.");
    const summary = importId ? await service.status(request.headers, importId) : await service.statusByRequest(request.headers, requestId!);
    return accountResponse({ contractVersion: 1, import: summary });
  } catch (error) {
    return accountFailure(error);
  }
}
