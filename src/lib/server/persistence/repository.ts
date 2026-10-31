import type { PoolClient } from "pg";
import type { AccountContract, AnnotationContract, DataRecord, DocumentPageContract, DocumentVersionContract, ImportReceipt, JsonValue, MigrationContext, MigrationPlan, MigrationSnapshot } from "../../data-migration/contract";
import { emptySnapshot, prepareMigration, previewMigration, recordKey, type ApplyOptions } from "../../data-migration/migration";
import { isObject } from "../../data-migration/validation";
import { BACKUP_AREAS } from "../../data-migration/inventory";
import { Database } from "./database";
import { PrivateFiles, storageKey } from "./files";

export interface VersionRow {
  document_version_id: string; document_id: string; owner_user_id: string; record_key: string;
  sha256: string; byte_size: string; media_type: string; page_count: number | null;
  text_status: DocumentVersionContract["textStatus"]; extraction_version: string | null;
  storage_key: string; data_url_header: string;
}
export interface PersistenceImportOptions extends ApplyOptions {
  /** Operator/test fault injection. Never read callbacks or commands from a backup. */
  beforeWrite?: (index: number) => void | Promise<void>;
  beforeCommit?: () => void | Promise<void>;
}
interface RecordRow { record_key: string; kind: string; id: string; owner_user_id: string | null; revision: number; legacy_key: string; payload: JsonValue; normalized: DataRecord["normalized"] }
export function versionContract(row: VersionRow): DocumentVersionContract {
  return { documentVersionId: row.document_version_id, documentId: row.document_id, ownerUserId: row.owner_user_id,
    sha256: row.sha256, byteSize: Number(row.byte_size), mediaType: row.media_type, pageCount: row.page_count,
    textStatus: row.text_status, extractionVersion: row.extraction_version };
}
export async function requireAccount(client: PoolClient, owner: string): Promise<void> {
  const result = await client.query("SELECT 1 FROM stex.accounts WHERE user_id=$1 AND status='active'", [owner]);
  if (!result.rowCount) throw new Error("Aktives zugeordnetes Konto erforderlich.");
}
export async function lockState(client: PoolClient): Promise<number> {
  const result = await client.query<{generation: string}>("SELECT generation FROM stex.state WHERE singleton FOR UPDATE");
  const generation = Number(result.rows[0]?.generation);
  if (!Number.isSafeInteger(generation)) throw new Error("Unbekannter Datenbankstand.");
  return generation;
}
async function bump(client: PoolClient): Promise<void> { await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton"); }
function requireMetadataOnly(value: JsonValue): void {
  if (typeof value === "string" && /^data:[^;,]*;base64,/.test(value)) throw new Error("Eingebettete Dateibytes außerhalb des Dokumentvertrags benötigen eine gesonderte Dateizuordnung.");
  if (Array.isArray(value)) value.forEach(requireMetadataOnly);
  else if (isObject(value)) Object.values(value).forEach(requireMetadataOnly);
}

/** Owner scoping is enforced here and by composite foreign keys. Authentication is a later integration. */
export class PersistenceRepository {
  constructor(readonly database: Database, readonly files: PrivateFiles) {}
  /** Operator-only account registration, independent of any authentication provider. */
  async createAccount(account: AccountContract): Promise<void> {
    if (account.revision !== 1) throw new Error("Neues Konto beginnt mit Revision 1.");
    await this.database.transaction(async client => {
      await lockState(client);
      await client.query("INSERT INTO stex.accounts VALUES ($1,$2,$3,$4)", [account.userId,account.status,account.role,account.revision]);
      await bump(client);
    });
  }
  private async readSnapshot(client: PoolClient, owner: string): Promise<MigrationSnapshot> {
    await requireAccount(client, owner);
    const snapshot = emptySnapshot();
    snapshot.generation = Number((await client.query("SELECT generation FROM stex.state WHERE singleton")).rows[0].generation);
    const records = await client.query<RecordRow>(`SELECT record_key,kind,id,NULL::text AS owner_user_id,revision,legacy_key,payload,normalized FROM stex.catalog_records
      UNION ALL SELECT record_key,kind,id,owner_user_id,revision,legacy_key,payload,normalized FROM stex.personal_records WHERE owner_user_id=$1`, [owner]);
    for (const row of records.rows) snapshot.records[row.record_key] = { kind: row.kind, id: row.id, ownerUserId: row.owner_user_id,
      revision: row.revision, legacyKey: row.legacy_key, value: row.payload, normalized: row.normalized };
    const versions = await client.query<VersionRow>("SELECT * FROM stex.document_versions WHERE owner_user_id=$1", [owner]);
    for (const row of versions.rows) {
      const version = versionContract(row);
      snapshot.documentVersions[version.documentVersionId] = version;
      const record = snapshot.records[row.record_key];
      if (!record || !isObject(record.value)) throw new Error("Dokumentdatensatz fehlt.");
      // A snapshot exposes only the explicitly selected original, never query order.
      // Every immutable version remains in documentVersions and in full backup.
      if (record.normalized.documentVersionId === row.document_version_id) {
        const bytes = await this.files.read(row.storage_key, row.sha256, Number(row.byte_size));
        record.value = { ...record.value, dataUrl: row.data_url_header + bytes.toString("base64") };
      }
    }
    const receipts = await client.query<{request_id: string; source_digest: string; exported_at: string; areas: ImportReceipt["areas"]}>("SELECT * FROM stex.imports WHERE owner_user_id=$1", [owner]);
    for (const row of receipts.rows) {
      const revisions = await client.query<{record_key: string; revision: number}>("SELECT record_key,revision FROM stex.import_records WHERE owner_user_id=$1 AND request_id=$2", [owner,row.request_id]);
      const documents = await client.query<{document_version_id: string}>("SELECT document_version_id FROM stex.import_documents WHERE owner_user_id=$1 AND request_id=$2 ORDER BY document_version_id", [owner,row.request_id]);
      snapshot.imports[JSON.stringify([owner,row.request_id])] = { requestId: row.request_id, ownerUserId: owner,
        sourceDigest: row.source_digest, exportedAt: row.exported_at, areas: row.areas,
        recordRevisions: Object.fromEntries(revisions.rows.map(r => [r.record_key,r.revision])), documentVersionIds: documents.rows.map(r => r.document_version_id) };
    }
    return snapshot;
  }
  async snapshot(owner: string): Promise<MigrationSnapshot> {
    return this.database.transaction(client => this.readSnapshot(client, owner), true);
  }
  async preview(input: unknown, context: MigrationContext): Promise<MigrationPlan> {
    return previewMigration(input, context, await this.snapshot(context.ownerUserId));
  }
  async import(plan: MigrationPlan, requestId: string, options: PersistenceImportOptions = {}) {
    return this.database.transaction(async client => {
      await lockState(client);
      const before = await this.readSnapshot(client, plan.context.ownerUserId);
      const staged = prepareMigration(before, plan, requestId, options);
      if (staged.replay) return { receipt: staged.receipt, comparison: staged.comparison, replay: true };
      const checkAbort = () => { if (options.signal?.aborted) throw new Error("Import abgebrochen."); };
      for (const topic of plan.context.topicIds) await client.query("INSERT INTO stex.topics VALUES ($1) ON CONFLICT DO NOTHING", [topic]);
      // Records precede references; all targets can therefore be checked by SQL foreign keys.
      let writeIndex = 0;
      for (const change of plan.changes) {
        await options.beforeWrite?.(writeIndex++);
        checkAbort();
        if (change.action !== "new") continue;
        const record = staged.next.records[change.key];
        const payload = structuredClone(record.value);
        if (record.kind === "document" && isObject(payload)) delete payload.dataUrl;
        requireMetadataOnly(payload);
        if (record.ownerUserId === null) {
          await client.query("INSERT INTO stex.catalog_records VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)",
            [change.key,record.kind,record.id,record.revision,record.legacyKey,JSON.stringify(payload),JSON.stringify(record.normalized)]);
        } else {
          await client.query("INSERT INTO stex.personal_records VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)",
            [change.key,record.ownerUserId,record.kind,record.id,record.revision,record.legacyKey,JSON.stringify(payload),JSON.stringify(record.normalized)]);
        }
      }
      for (const change of plan.changes) if (change.action === "new") await this.writeReferences(client, change.key, staged.next.records[change.key]);
      for (const version of Object.values(plan.documentVersions)) {
        checkAbort();
        const key = recordKey("document", version.ownerUserId, version.documentId);
        const record = staged.next.records[key];
        if (!version.ownerUserId || !isObject(record.value) || typeof record.value.dataUrl !== "string") throw new Error("Persönliche Dateizuordnung fehlt.");
        const comma = record.value.dataUrl.indexOf(",");
        const header = record.value.dataUrl.slice(0,comma+1);
        const bytes = Buffer.from(record.value.dataUrl.slice(comma+1), "base64");
        const fileKey = storageKey(version.ownerUserId,version.documentVersionId);
        await this.files.put(fileKey, bytes, version.sha256);
        await client.query(`INSERT INTO stex.document_versions VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
          [version.documentVersionId,version.documentId,version.ownerUserId,key,version.sha256,version.byteSize,version.mediaType,version.pageCount,version.textStatus,version.extractionVersion,fileKey,header]);
      }
      const receipt = staged.receipt;
      await client.query("INSERT INTO stex.imports VALUES ($1,$2,$3,$4,$5::jsonb)", [receipt.ownerUserId,requestId,receipt.sourceDigest,receipt.exportedAt,JSON.stringify(receipt.areas)]);
      for (const [key,revision] of Object.entries(receipt.recordRevisions)) {
        const personal = staged.next.records[key].ownerUserId !== null;
        await client.query("INSERT INTO stex.import_records VALUES ($1,$2,$3,$4,$5,$6)", [receipt.ownerUserId,requestId,key,revision,personal ? key : null,personal ? null : key]);
      }
      for (const versionId of receipt.documentVersionIds) await client.query("INSERT INTO stex.import_documents VALUES ($1,$2,$3)", [receipt.ownerUserId,requestId,versionId]);
      await options.beforeCommit?.();
      checkAbort();
      await bump(client);
      return { receipt, comparison: staged.comparison, replay: false };
    });
  }
  private async writeReferences(client: PoolClient, key: string, record: DataRecord): Promise<void> {
    const fields: Record<string,string> = { klausurId: "klausur", linkedKlausurId: "klausur", calendarEventId: "calendar-event", trackingEntryId: "tracking-entry", topicId: "topic", linkedTopicId: "topic" };
    const add = async (path: string, kind: string, id: string) => {
      const personalTarget = kind === "calendar-event" || kind === "tracking-entry";
      await client.query("INSERT INTO stex.record_references VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [key,path,record.ownerUserId,record.ownerUserId === null ? null : key,record.ownerUserId === null ? key : null,
          personalTarget ? recordKey(kind,record.ownerUserId,id) : null,kind === "klausur" ? recordKey(kind,null,id) : null,kind === "topic" ? id : null]);
    };
    const visit = async (value: JsonValue, path: string): Promise<void> => {
      if (Array.isArray(value)) { for (let i=0;i<value.length;i++) await visit(value[i], `${path}[${i}]`); return; }
      if (!isObject(value)) return;
      for (const [field,item] of Object.entries(value)) {
        const next = `${path}.${field}`;
        if (fields[field] && typeof item === "string") await add(next,fields[field],item);
        if ((field === "topicIds" || field === "linkedTopicIds") && Array.isArray(item)) for (let i=0;i<item.length;i++) await add(`${next}[${i}]`,"topic",String(item[i]));
        if (field === "selfAssessment" && isObject(item)) for (const id of Object.keys(item)) await add(`${next}.${id}`,"topic",id);
        await visit(item,next);
      }
    };
    await visit(record.value,"value");
    if (record.kind === "catalog-extension") await add("normalized.klausurId","klausur",record.id);
  }
  /** Compare-and-swap for existing personal records; identity and document bytes cannot be edited. */
  async editPersonal(owner: string, kind: string, id: string, value: JsonValue, expectedRevision: number, topicIds: readonly string[]): Promise<number> {
    if (kind === "document" || kind === "catalog-extension") throw new Error("Diese Daten benötigen einen gesonderten Änderungsvertrag.");
    return this.database.transaction(async client => {
      await lockState(client);
      const snapshot = await this.readSnapshot(client,owner);
      const key = recordKey(kind,owner,id);
      const current = snapshot.records[key];
      const area = BACKUP_AREAS.find(item => item.kind === kind && item.ownership !== "catalog");
      if (!current || !area || current.revision !== expectedRevision) throw new Error("Datensatz-Revisionskonflikt.");
      if (isObject(value) && value.id !== undefined && value.id !== id) throw new Error("Datensatz-ID ist unveränderlich.");
      const input = { version: 1, exportedAt: new Date().toISOString(), data: { [area.key]: area.shape === "list" ? [value] : area.shape === "map" ? { [id]:value } : value } };
      const projected = previewMigration(input,{ ownerUserId:owner,topicIds },snapshot).records[key];
      if (!projected) throw new Error("Datensatz-ID ist unveränderlich.");
      requireMetadataOnly(value);
      await client.query("DELETE FROM stex.record_references WHERE source_key=$1", [key]);
      await client.query("UPDATE stex.personal_records SET payload=$1::jsonb,normalized=$2::jsonb,revision=revision+1 WHERE record_key=$3 AND owner_user_id=$4 AND revision=$5",
        [JSON.stringify(value),JSON.stringify(projected.normalized),key,owner,expectedRevision]);
      await this.writeReferences(client,key,{ ...projected,value });
      await bump(client);
      return expectedRevision+1;
    });
  }
  async addPage(owner: string, page: DocumentPageContract): Promise<void> {
    await this.database.transaction(async client => {
      await lockState(client); await requireAccount(client,owner);
      const version = await client.query("SELECT page_count FROM stex.document_versions WHERE document_version_id=$1 AND owner_user_id=$2", [page.documentVersionId,owner]);
      if (!version.rowCount || (version.rows[0].page_count !== null && page.pageNumber > version.rows[0].page_count)) throw new Error("Seitenbezug nicht erlaubt.");
      await client.query("INSERT INTO stex.document_pages VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [page.documentVersionId,page.pageNumber,page.printedLabel,page.width,page.height,page.rotation,page.textStatus,page.extractionVersion]);
      await bump(client);
    });
  }
  async saveAnnotation(owner: string, annotation: AnnotationContract, expectedRevision: number | null): Promise<void> {
    if (annotation.ownerUserId !== owner || !annotation.id.trim() || annotation.revision !== (expectedRevision ?? 0)+1
      || !annotation.rectangles.length || annotation.rectangles.some(r => ![r.x,r.y,r.width,r.height].every(Number.isFinite)
        || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x+r.width > 1 || r.y+r.height > 1)) throw new Error("Ungültige Markierung oder Eigentümerzuordnung.");
    await this.database.transaction(async client => {
      await lockState(client); await requireAccount(client,owner);
      const args = [annotation.id,owner,annotation.documentVersionId,annotation.pageNumber,JSON.stringify(annotation.rectangles),annotation.quote,annotation.note,annotation.revision];
      if (expectedRevision === null) await client.query("INSERT INTO stex.annotations VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)", args);
      else {
        const result = await client.query("UPDATE stex.annotations SET document_version_id=$3,page_number=$4,rectangles=$5::jsonb,quote=$6,note=$7,revision=$8 WHERE id=$1 AND owner_user_id=$2 AND revision=$9", [...args,expectedRevision]);
        if (!result.rowCount) throw new Error("Markierungs-Revisionskonflikt.");
      }
      await bump(client);
    });
  }
  async annotations(owner: string): Promise<AnnotationContract[]> {
    return this.database.transaction(async client => {
      await requireAccount(client,owner);
      const rows = await client.query("SELECT * FROM stex.annotations WHERE owner_user_id=$1 ORDER BY id", [owner]);
      return rows.rows.map(row => ({ id:row.id,ownerUserId:owner,documentVersionId:row.document_version_id,pageNumber:row.page_number,rectangles:row.rectangles,quote:row.quote,note:row.note,revision:row.revision }));
    },true);
  }
}
