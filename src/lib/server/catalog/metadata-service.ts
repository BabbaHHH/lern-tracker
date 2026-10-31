import type { PoolClient } from 'pg';
import { canonical, digest, recordKey } from '../../data-migration/migration';
import { METADATA_MAX_BATCH, type MetadataAccount, type MetadataCommand, type MetadataContext, type MetadataEntry, type MetadataFields, type MetadataPreview, type MetadataPreviewInput, type MetadataResult, type MetadataView, type MetadataReadFields } from '../../catalog/metadata-contract';
import type { AccountService, Principal } from '../auth/service';
import { AccountError, exactFields } from '../auth/security';
import { lockState } from '../persistence/repository';
import { validateCatalogMetadata, validateLegacyCatalogMetadata } from './import-service';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const CONTEXT = ['contractVersion', 'expectedAccountId', 'expectedAccessGeneration', 'expectedSessionContext'];
const FIELDS = ['source', 'date', 'title', 'area', 'type', 'topicIds'];
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const context = (p: Principal): MetadataAccount => ({ userId: p.userId, accessGeneration: p.generation, sessionContext: digest(['catalog-metadata-session-v1', p.sessionId]) });
function invalid(message = 'Ungültige Katalogaktion.'): never { throw new AccountError('invalid_input', message); }
function conflict(message = 'Der Katalogstand hat sich geändert. Bitte Vorschau neu laden.'): never { throw new AccountError('conflict', message, 409); }
function validateContext(v: Record<string, unknown>) {
  if (v.contractVersion !== 1 || typeof v.expectedAccountId !== 'string' || !v.expectedAccountId || v.expectedAccountId.length > 255 || !Number.isSafeInteger(v.expectedAccessGeneration) || Number(v.expectedAccessGeneration) < 1 || !hash(v.expectedSessionContext)) invalid('Konto- oder Sitzungsstand fehlt.');
}
function assertContext(a: MetadataAccount, v: MetadataContext) {
  if (a.userId !== v.expectedAccountId || a.accessGeneration !== v.expectedAccessGeneration || a.sessionContext !== v.expectedSessionContext) throw new AccountError('account_changed', 'Das Konto oder die Anmeldung hat sich geändert. Bitte neu laden.', 409);
}
function records(v: unknown, legacy: boolean): MetadataReadFields[] {
  if (!Array.isArray(v) || !v.length || v.length > METADATA_MAX_BATCH) invalid(`Bitte 1 bis ${METADATA_MAX_BATCH} Klausuren pro Vorschau übermitteln.`);
  const result = v.map(value => {
    const result = legacy ? validateLegacyCatalogMetadata(value) : validateCatalogMetadata(value);
    if (!result.id) invalid('Der Metadatenimport benötigt vorhandene ausdrückliche Klausur-IDs.');
    return result as MetadataReadFields;
  });
  if (new Set(result.map(r => r.id)).size !== result.length) invalid('Klausur-IDs dürfen im Batch nicht doppelt vorkommen.');
  return result;
}
export function validateMetadataPreview(v: unknown, legacy = false): MetadataPreviewInput {
  if (!object(v)) invalid();
  exactFields(v, [...CONTEXT, 'records', ...(legacy ? ['action'] : [])]); validateContext(v);
  if (legacy && v.action !== 'legacy-import') invalid('Die Legacyaktion fehlt.');
  return { ...v, records: records(v.records, legacy) } as unknown as MetadataPreviewInput;
}
export function validateMetadataCommand(v: unknown, legacy = false): MetadataCommand {
  if (!object(v)) invalid();
  validateContext(v);
  if (!uuid(v.requestId)) invalid('Eine UUID als stabile Vorgangskennung ist erforderlich.');
  if (legacy ? v.action === 'legacy-import' : v.action === 'import') {
    exactFields(v, [...CONTEXT, 'requestId', 'action', 'records', 'snapshot']);
    if (!hash(v.snapshot)) invalid('Die bestätigte Vorschau fehlt.');
    return { ...v, requestId: v.requestId.toLowerCase(), records: records(v.records, legacy) } as unknown as MetadataCommand;
  }
  if (legacy) invalid('Dieser Legacyanschluss erlaubt nur Metadatenanlage.');
  exactFields(v, [...CONTEXT, 'requestId', 'action', 'id', 'expectedRevision', 'expectedSnapshot', ...(v.action === 'patch' ? ['fields'] : [])]);
  if (!id(v.id) || !Number.isSafeInteger(v.expectedRevision) || Number(v.expectedRevision) < 1 || !hash(v.expectedSnapshot)) invalid('Klausur-ID oder bestätigter Objekt-/Revisionsstand fehlt.');
  if (v.action === 'patch') {
    if (!object(v.fields) || !Object.keys(v.fields).length) invalid('Die Änderung ist leer.');
    exactFields(v.fields, FIELDS);
  } else if (v.action !== 'delete') invalid();
  return { ...v, requestId: v.requestId.toLowerCase() } as unknown as MetadataCommand;
}

interface Row { id: string; record_key: string; revision: number; payload: Record<string, unknown>; normalized: Record<string, unknown> }
/** Deliberately projects only safe fields; never serializes the full legacy payload. */
function project(row: Row): MetadataReadFields {
  const p = row.payload;
  if (Object.hasOwn(p, 'legacy')) {
    return validateLegacyCatalogMetadata(Object.fromEntries(['id', ...FIELDS, 'legacy'].filter(k => Object.hasOwn(p, k)).map(k => [k, p[k]])));
  }
  if (!object(p) || typeof p.source !== 'string' || typeof p.title !== 'string' || !['zr', 'oeffr', 'sr'].includes(String(p.area)) || (p.type !== undefined && p.type !== null && typeof p.type !== 'string') || (p.topicIds !== undefined && (!Array.isArray(p.topicIds) || p.topicIds.some(v => typeof v !== 'string')))) {
    throw new AccountError('catalog_invalid', 'Die vorhandenen Katalogmetadaten haben eine ungültige Form. Keine Änderung vorgenommen.', 409);
  }
  return { id: row.id, source: p.source as string, date: typeof p.date === 'string' ? p.date : '', title: p.title as string, area: p.area as MetadataFields['area'], ...(p.type ? { type: p.type as MetadataFields['type'] } : {}), topicIds: Array.isArray(p.topicIds) ? p.topicIds as string[] : [] };
}
function rowSnapshot(owner: string, row: Row): string { return digest(['catalog-metadata-row-v1', owner, row]); }
function entry(owner: string, row: Row): MetadataEntry { return { id: row.id, revision: row.revision, snapshot: rowSnapshot(owner, row), metadata: project(row) }; }

export class CatalogMetadataService {
  constructor(readonly auth: AccountService, private readonly faults: { beforeTransaction?: () => Promise<void>; beforeCommit?: () => void } = {}) {}
  private async row(c: PoolClient, key: string): Promise<Row | undefined> {
    return (await c.query<Row>("SELECT id,record_key,revision,payload,normalized FROM stex.catalog_records WHERE kind='klausur' AND id=$1", [key])).rows[0];
  }
  async read(headers: Headers, key?: string): Promise<MetadataView> {
    const who = await this.auth.principal(headers, 'admin');
    if (key !== undefined && !id(key)) invalid('Ungültige Klausur-ID.');
    return this.auth.database.transaction(async c => {
      const account = context(await this.auth.checkPrincipal(c, who.sessionId, 'admin', false, true));
      const row = key ? await this.row(c, key) : undefined;
      if (key && !row) throw new AccountError('not_found', 'Klausur nicht gefunden.', 404);
      return { contractVersion: 1, account, maxBatchSize: METADATA_MAX_BATCH, entry: row ? entry(account.userId, row) : null };
    });
  }
  private async previewIn(c: PoolClient, a: MetadataAccount, values: MetadataReadFields[], legacy = false): Promise<MetadataPreview> {
    const stored = (await c.query<Row>("SELECT id,record_key,revision,payload,normalized FROM stex.catalog_records WHERE id=ANY($1::text[]) ORDER BY id", [values.map(r => r.id)])).rows;
    const rows = values.map(v => {
      const old = stored.find(r => r.id === v.id);
      return { id: v.id, expectedRevision: old?.revision ?? null, disposition: !old ? 'create' as const : canonical(project(old)) === canonical(v) ? 'identical' as const : 'conflict' as const };
    });
    // Includes full old payloads in the hash only, preserving unknown extensions
    // and detecting any change without disclosing them in the preview.
    const snapshot = digest([legacy ? 'catalog-legacy-metadata-preview-v1' : 'catalog-metadata-preview-v1', a.userId, values, stored]);
    return { contractVersion: 1, account: a, snapshot, records: values, rows, ...(legacy ? { action: 'legacy-import' as const } : {}) };
  }
  async preview(headers: Headers, input: unknown, legacy = false): Promise<MetadataPreview> {
    const who = await this.auth.principal(headers, 'admin', legacy), v = validateMetadataPreview(input, legacy);
    return this.auth.database.transaction(async c => {
      const a = context(await this.auth.checkPrincipal(c, who.sessionId, 'admin', legacy, true));
      assertContext(a, v); return this.previewIn(c, a, v.records, legacy);
    });
  }
  async status(headers: Headers, requestId: string): Promise<MetadataResult> {
    const who = await this.auth.principal(headers, 'admin');
    if (!uuid(requestId)) invalid('Ungültige Vorgangskennung.');
    return this.auth.database.transaction(async c => {
      const a = context(await this.auth.checkPrincipal(c, who.sessionId, 'admin', false, true));
      const row = (await c.query<{ result: MetadataResult }>('SELECT result FROM stex.catalog_metadata_commands WHERE owner_user_id=$1 AND request_id=$2', [a.userId, requestId])).rows[0];
      if (!row) throw new AccountError('not_found', 'Katalogaktion nicht gefunden.', 404);
      return { ...row.result, account: a, replay: true };
    });
  }
  private async topics(c: PoolClient, key: string, ids: string[]) {
    // Only own canonical topic paths are replaced; all other provenance stays.
    await c.query("DELETE FROM stex.record_references WHERE source_catalog_key=$1 AND path ~ '^value\\.topicIds\\[[0-9]+\\]$'", [key]);
    for (const [i, topic] of ids.entries()) {
      await c.query('INSERT INTO stex.topics(id) VALUES($1) ON CONFLICT DO NOTHING', [topic]);
      await c.query('INSERT INTO stex.record_references(source_key,path,source_catalog_key,target_topic_id) VALUES($1,$2,$1,$3)', [key, `value.topicIds[${i}]`, topic]);
    }
  }
  private async requireDeletable(c: PoolClient, row: Row) {
    const linked = (await c.query<{ linked: boolean }>(`SELECT
      EXISTS(SELECT 1 FROM stex.record_references WHERE target_catalog_key=$1) OR
      EXISTS(SELECT 1 FROM stex.catalog_documents WHERE record_key=$1 OR klausur_id=$2) OR
      EXISTS(SELECT 1 FROM stex.catalog_imports WHERE klausur_id=$2 OR metadata->>'id'=$2) OR
      EXISTS(SELECT 1 FROM stex.import_records WHERE catalog_key=$1 OR record_key=$1) OR
      EXISTS(SELECT 1 FROM stex.personal_records WHERE
        jsonb_path_exists(payload, '$.** ? (@ == $id)', jsonb_build_object('id',to_jsonb($2::text))) OR
        jsonb_path_exists(normalized, '$.** ? (@ == $id)', jsonb_build_object('id',to_jsonb($2::text)))) AS linked`, [row.record_key, row.id])).rows[0].linked;
    // The JSON scan also catches nested old draft/calendar links not yet indexed.
    // No owner, content, count, or private path is exposed in the error.
    if (linked) conflict('Die Klausur ist noch mit Dateien, Importen oder persönlichen Einträgen verknüpft und kann nicht gelöscht werden.');
  }
  async submit(headers: Headers, input: unknown, legacy = false): Promise<MetadataResult> {
    const who = await this.auth.principal(headers, 'admin', legacy), command = validateMetadataCommand(input, legacy);
    await this.faults.beforeTransaction?.();
    return this.auth.database.transaction(async c => {
      await lockState(c);
      const a = context(await this.auth.checkPrincipal(c, who.sessionId, 'admin', legacy, true));
      assertContext(a, command);
      const { expectedAccessGeneration: generation, expectedSessionContext: session, ...semantic } = command;
      void generation; void session;
      const fingerprint = digest(semantic);
      const old = (await c.query<{ fingerprint: string; result: MetadataResult }>('SELECT fingerprint,result FROM stex.catalog_metadata_commands WHERE owner_user_id=$1 AND request_id=$2', [a.userId, command.requestId])).rows[0];
      if (old) {
        if (old.fingerprint !== fingerprint) conflict('Diese Vorgangskennung gehört zu einer anderen Änderung.');
        return { ...old.result, account: a, replay: true };
      }
      const result: MetadataResult = { contractVersion: 1, account: a, requestId: command.requestId, action: command.action, status: 'committed', replay: false, rows: [] };
      if (command.action === 'import' || command.action === 'legacy-import') {
        const preview = await this.previewIn(c, a, command.records, legacy);
        if (preview.snapshot !== command.snapshot) conflict();
        const blocked = preview.rows.some(r => r.disposition === 'conflict');
        if (blocked) result.status = 'conflict';
        for (const [i, v] of command.records.entries()) {
          const p = preview.rows[i];
          if (blocked || p.disposition === 'identical') {
            result.rows.push({ id: v.id, revision: p.expectedRevision, outcome: p.disposition === 'conflict' ? 'conflict' : p.disposition === 'identical' ? 'identical' : 'skipped' });
            continue;
          }
          const key = recordKey('klausur', null, v.id), now = new Date().toISOString();
          await c.query("INSERT INTO stex.catalog_records(record_key,kind,id,revision,legacy_key,payload,normalized) VALUES($1,'klausur',$2,1,'catalog-metadata',$3::jsonb,$4::jsonb)", [key, v.id, JSON.stringify({ ...v, createdAt: now, updatedAt: now }), JSON.stringify({ sourceReference: v.source, area: v.area, date: v.date || null })]);
          await this.topics(c, key, v.topicIds);
          result.rows.push({ id: v.id, revision: 1, outcome: 'created' });
        }
      } else {
        const row = await this.row(c, command.id);
        if (!row) throw new AccountError('not_found', 'Klausur nicht gefunden.', 404);
        if (row.revision !== command.expectedRevision || rowSnapshot(a.userId, row) !== command.expectedSnapshot) conflict();
        if (command.action === 'delete') {
          await this.requireDeletable(c, row);
          await c.query('DELETE FROM stex.record_references WHERE source_catalog_key=$1', [row.record_key]);
          await c.query('DELETE FROM stex.catalog_records WHERE record_key=$1', [row.record_key]);
          result.rows.push({ id: row.id, revision: null, outcome: 'deleted' });
        } else {
          if (Object.hasOwn(row.payload, 'legacy')) conflict('Dieser quellengebundene Alteintrag kann hier nicht umklassifiziert werden.');
          const value = validateCatalogMetadata({ ...project(row), ...command.fields });
          const same = canonical(project(row)) === canonical(value);
          if (!same) {
            const payload = { ...row.payload, ...value, updatedAt: new Date().toISOString() };
            if (!value.type) delete payload.type;
            await c.query('UPDATE stex.catalog_records SET payload=$2::jsonb,normalized=$3::jsonb,revision=revision+1 WHERE record_key=$1', [row.record_key, JSON.stringify(payload), JSON.stringify({ ...row.normalized, area: value.area, date: value.date || null })]);
            await this.topics(c, row.record_key, value.topicIds);
          }
          result.rows.push({ id: row.id, revision: row.revision + (same ? 0 : 1), outcome: same ? 'identical' : 'updated' });
        }
      }
      await c.query('INSERT INTO stex.catalog_metadata_commands(owner_user_id,request_id,action,fingerprint,result) VALUES($1,$2,$3,$4,$5::jsonb)', [a.userId, command.requestId, command.action === 'legacy-import' ? 'import' : command.action, fingerprint, JSON.stringify(result)]);
      await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');
      this.faults.beforeCommit?.();
      return result;
    });
  }
}
