import { METADATA_MAX_BYTES } from '../../catalog/metadata-contract';
import { AccountError, accountFailure, accountResponse, sameOrigin } from '../auth/security';
import type { CatalogMetadataService } from './metadata-service';

async function json(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim() !== 'application/json') throw new AccountError('invalid_input', 'Bitte Metadaten als JSON senden.', 415);
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) throw new AccountError('invalid_input', 'Ungültige Größenangabe.');
  if (declared !== null && Number(declared) > METADATA_MAX_BYTES) throw new AccountError('too_large', 'Die Metadaten sind zu groß.', 413);
  if (!request.body) throw new AccountError('invalid_input', 'Die Metadaten fehlen.');
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.byteLength > METADATA_MAX_BYTES - size) {
        try { await reader.cancel(); } catch { /* Preserve the size error. */ }
        throw new AccountError('too_large', 'Die Metadaten sind zu groß.', 413);
      }
      size += value.byteLength; chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))); }
  catch { throw new AccountError('invalid_input', 'Die Metadaten sind kein gültiges JSON.'); }
}

/** Injectable route contract; rejects rights/origin before consuming JSON. */
export async function catalogMetadataHTTP(request: Request, service: CatalogMetadataService, preview = false): Promise<Response> {
  try {
    sameOrigin(request, service.auth.baseURL);
    const params = new URL(request.url).searchParams;
    const legacy = request.method === 'POST' && params.get('legacy') === '1';
    await service.auth.principal(request.headers, 'admin', legacy);
    let value: unknown;
    if (request.method === 'GET' && !preview) {
      if ([...params].some(([k]) => !['id', 'requestId'].includes(k)) || [...params.keys()].length > 1) throw new AccountError('invalid_input', 'Bitte genau eine Klausur oder Vorgangskennung auswählen.');
      const requestId = params.get('requestId'), id = params.get('id');
      value = requestId !== null ? await service.status(request.headers, requestId) : await service.read(request.headers, id === null ? undefined : id);
    } else if (request.method === 'POST') {
      if (params.size && (!legacy || params.size !== 1)) throw new AccountError('invalid_input', 'Unerwartete Anfrageparameter.');
      const input = await json(request);
      value = preview ? await service.preview(request.headers, input, legacy) : await service.submit(request.headers, input, legacy);
    } else throw new AccountError('method_not_allowed', 'Diese Methode ist nicht verfügbar.', 405);
    const response = accountResponse(value); response.headers.set('Vary', 'Cookie'); return response;
  } catch (error) { const response = accountFailure(error); response.headers.set('Vary', 'Cookie'); return response; }
}
