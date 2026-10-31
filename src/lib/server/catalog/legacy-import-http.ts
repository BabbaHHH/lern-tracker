import { AccountError, accountFailure, accountResponse, sameOrigin } from '../auth/security';
import { CATALOG_MAX_METADATA_BYTES, CATALOG_MAX_REQUEST_BYTES, validateCatalogPdf, validateLegacyImportCommand, type CatalogImportService } from './import-service';

/** Independent strict envelope; the normal two-document route remains unchanged. */
async function submission(request: Request) {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim() !== 'multipart/form-data') throw new AccountError('invalid_input', 'Bitte die kombinierte PDF als Formular senden.', 415);
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared.trim()) || !Number.isSafeInteger(Number(declared)))) throw new AccountError('invalid_input', 'Ungültige Größenangabe.');
  if (declared !== null && Number(declared) > CATALOG_MAX_REQUEST_BYTES) throw new AccountError('too_large', 'Die Einreichung ist zu groß.', 413);
  if (!request.body) throw new AccountError('invalid_input', 'Das Uploadformular fehlt.');
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > CATALOG_MAX_REQUEST_BYTES - size) {
        try { await reader.cancel(); } catch { /* Preserve the limit error. */ }
        throw new AccountError('too_large', 'Die Einreichung ist zu groß.', 413);
      }
      size += value.byteLength; chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Request(request.url, { method: 'POST', headers: request.headers, body: Buffer.concat(chunks, size) as BodyInit }).formData(); }
  catch { throw new AccountError('invalid_input', 'Das Uploadformular konnte nicht gelesen werden.'); }
  const keys = [...form.keys()];
  if (keys.length !== 2 || keys.filter(k => k === 'command').length !== 1 || keys.filter(k => k === 'kombiniert').length !== 1) throw new AccountError('invalid_input', 'Genau command und kombiniert sind erforderlich.');
  const raw = form.get('command'), pdf = form.get('kombiniert');
  if (typeof raw !== 'string' || !pdf || typeof pdf === 'string') throw new AccountError('invalid_input', 'Plan oder kombinierte PDF fehlt.');
  if (Buffer.byteLength(raw, 'utf8') > CATALOG_MAX_METADATA_BYTES) throw new AccountError('too_large', 'Der Plan ist zu groß.', 413);
  let command: unknown;
  try { command = JSON.parse(raw); } catch { throw new AccountError('invalid_input', 'Der Plan ist kein gültiges JSON.'); }
  return { command: validateLegacyImportCommand(command), pdf };
}

export async function catalogLegacyImportHTTP(request: Request, service: CatalogImportService): Promise<Response> {
  try {
    sameOrigin(request, service.auth.baseURL);
    await service.auth.principal(request.headers, 'admin', true);
    const params = new URL(request.url).searchParams;
    if (request.method === 'GET') {
      if ([...params.keys()].length !== 1 || !params.has('requestId')) throw new AccountError('invalid_input', 'Genau eine Vorgangskennung ist erforderlich.');
      const summary = await service.legacyStatusByRequest(request.headers, params.get('requestId')!);
      return response({ contractVersion: 1, import: summary });
    }
    if (request.method !== 'POST') throw new AccountError('method_not_allowed', 'Diese Methode ist nicht verfügbar.', 405);
    if (params.size) throw new AccountError('invalid_input', 'Unerwartete Anfrageparameter.');
    const { command, pdf } = await submission(request);
    const document = await validateCatalogPdf(pdf, 'kombiniert');
    const result = await service.submitLegacy(request.headers, command, document);
    return response({ contractVersion: 1, import: result.summary }, result.statusCode);
  } catch (error) { const result = accountFailure(error); result.headers.set('Vary', 'Cookie'); return result; }
}

function response(value: unknown, status = 200) {
  const result = accountResponse(value, status); result.headers.set('Vary', 'Cookie'); return result;
}
