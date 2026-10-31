import { randomUUID } from "node:crypto";
import { LEGACY_IMPORT_FIELDS, type LegacyImportCommand, type LegacyDocumentState } from "../../catalog/legacy-import-contract";
import type { LegacyMetadataFields, MetadataReadFields } from "../../catalog/metadata-contract";
import type { PoolClient } from "pg";
import { getLeafTopics, TOPICS } from "../../topics";
import type { Area, CatalogArea, KlausurType } from "../../types";
import { canonical, digest, recordKey } from "../../data-migration/migration";
import { AccountError } from "../auth/security";
import { AccountService, type Principal } from "../auth/service";
import { fileHash, PrivateFiles, storageKey } from "../persistence/files";
import { lockState } from "../persistence/repository";
import { extractPdfPlanningText } from "../pdf-planning-text";

export { CATALOG_MAX_FILE_BYTES, CATALOG_MAX_REQUEST_BYTES, CATALOG_MAX_METADATA_BYTES } from "../../catalog/limits";
import { CATALOG_MAX_FILE_BYTES } from "../../catalog/limits";
const CATALOG_ROLES = ["sachverhalt", "loesung"] as const;
export type CatalogDocumentRole = typeof CATALOG_ROLES[number];

const AREAS = new Set<Area>(["zr", "oeffr", "sr"]);
const TYPES = new Set<KlausurType>([
  "Urteil", "Beschluss", "Anwaltsklausur", "Kautelarklausur", "Behördenklausur", "Aktenvortrag",
  "Anklageklausur", "Revisionsklausur", "Plädoyer", "Haftklausur", "Einspruch Strafbefehl", "Abschlussverfügung",
]);
const LEAF_TOPICS = new Set(getLeafTopics(TOPICS).map(topic => topic.id));

export interface CatalogMetadata {
  id?: string;
  source: string;
  date: string;
  title: string;
  area: Area;
  type?: KlausurType;
  topicIds: string[];
}

export interface PreparedCatalogPdf<Role extends CatalogDocumentRole | "kombiniert" = CatalogDocumentRole> {
  role: Role;
  filename: string;
  bytes: Buffer;
  sha256: string;
  byteSize: number;
  pageCount: number;
  textStatus: "ready" | "needs_ocr";
  extractionVersion: string;
}

export interface CatalogImportInput {
  requestId: string;
  metadata: CatalogMetadata;
  documents: PreparedCatalogPdf[];
}

type InternalImportInput = Omit<CatalogImportInput, "documents" | "metadata"> & { metadata: CatalogMetadata | LegacyMetadataFields; documents: PreparedCatalogPdf<CatalogDocumentRole | "kombiniert">[] };

export interface CatalogDocumentSummary {
  documentId: string;
  documentVersionId: string;
  versionNumber: number;
  role: CatalogDocumentRole | "kombiniert" | "unbekannt";
  sourceFilename: string;
  sha256: string;
  byteSize: number;
  pageCount: number | null;
  textStatus: string;
}

export interface CatalogImportSummary {
  importId: string;
  requestId: string;
  status: "queued" | "processing" | "committed" | "failed";
  technicalValidation: "pending" | "valid" | "invalid";
  duplicateStatus: "pending" | "identical" | "candidate" | "distinct" | "conflict";
  klausurId: string | null;
  warnings: string[];
  errorCode: string | null;
  errorMessage: string | null;
  documents: CatalogDocumentSummary[];
}

export interface CatalogListEntry {
  id: string;
  revision: number;
  metadata: MetadataReadFields & { createdAt?: string; updatedAt?: string };
  documents: CatalogDocumentSummary[];
}

interface UploadFileLike {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function fail(code: string, message: string, status = 422): never {
  throw new AccountError(code, message, status);
}

/** Strict shape validation; client owner/role/session claims are not accepted. */
export function validateLegacyImportCommand(input: unknown): LegacyImportCommand {
  const object = (v: unknown, keys: readonly string[]): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) fail("invalid_input", "Der Legacy-Plan enthält fehlende oder unbekannte Felder.");
    return v as Record<string, unknown>;
  };
  const text = (v: unknown, max = 128): v is string => typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v && !/[\x00-\x1f\x7f]/.test(v);
  const hash = (v: unknown) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
  const positive = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
  const c = object(input, LEGACY_IMPORT_FIELDS);
  if (c.contractVersion !== 1 || !text(c.requestId) || !/^[A-Za-z0-9_-]{8,128}$/.test(c.requestId) ||
      !text(c.planId) || !/^[A-Za-z0-9_-]{8,128}$/.test(c.planId) || !hash(c.planSha256) ||
      !text(c.klausurId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(c.klausurId) ||
      !positive(c.expectedMetadataRevision) || !hash(c.expectedMetadataSha256)) fail("invalid_input", "Die Planbindung ist ungültig.");
  const source = object(c.source, ["role", "filename", "sha256", "byteSize", "edition"]);
  if (source.role !== "kombiniert" || !text(source.filename, 255) || safeFilename(source.filename) !== source.filename || !source.filename.toLowerCase().endsWith(".pdf") ||
      !hash(source.sha256) || !positive(source.byteSize) || Number(source.byteSize) > CATALOG_MAX_FILE_BYTES || !text(source.edition, 255)) fail("invalid_input", "Die kombinierte Quellfassung ist ungültig.");
  // This entry can only attach the first combined version or reuse that exact version.
  if (!Array.isArray(c.expectedDocuments) || c.expectedDocuments.length > 1) fail("invalid_input", "Dieser Legacy-Anschluss unterstützt nur einen leeren oder identischen kombinierten Dokumentstand.");
  for (const raw of c.expectedDocuments) {
    const d = object(raw, ["documentId", "documentVersionId", "versionNumber", "role", "sha256", "byteSize"]);
    if (!text(d.documentId) || !text(d.documentVersionId) || d.versionNumber !== 1 || d.role !== "kombiniert" || !hash(d.sha256) || !positive(d.byteSize)) fail("invalid_input", "Der erwartete Dokumentstand ist ungültig.");
  }
  // Detach the caller's object before asynchronous validation/commit.
  return JSON.parse(JSON.stringify(c)) as LegacyImportCommand;
}

function safeFilename(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 255 || /[/\\\x00-\x1f\x7f]/.test(value)) {
    fail("invalid_file", "Bitte eine gültige PDF-Datei ohne Pfadangabe auswählen.");
  }
  return value.trim();
}

function safeSource(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 255 || /[\x00-\x1f\x7f]/.test(value)) {
    fail("invalid_input", "Die Quellenangabe fehlt oder ist zu lang.");
  }
  return value.trim();
}

function validateMetadataFields(input: unknown, areas: ReadonlySet<string>): Omit<CatalogMetadata, "area"> & { area: CatalogArea } {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("invalid_input", "Metadaten müssen als Objekt übermittelt werden.");
  const value = input as Record<string, unknown>;
  const allowed = new Set(["id", "source", "date", "title", "area", "type", "topicIds"]);
  if (Object.keys(value).some(key => !allowed.has(key))) fail("invalid_input", "Die Metadaten enthalten ein nicht erlaubtes Feld.");
  let id: string | undefined;
  if (value.id !== undefined && value.id !== null && value.id !== "") {
    if (typeof value.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.id)) fail("invalid_input", "Die Klausur-ID ist ungültig.");
    id = value.id;
  }
  const source = safeSource(value.source);
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 300 || /[\x00-\x1f\x7f]/.test(value.title)) fail("invalid_input", "Der Klausurtitel fehlt oder ist ungültig.");
  if (typeof value.area !== "string" || !areas.has(value.area)) fail("invalid_input", "Das Rechtsgebiet ist ungültig.");
  const date = value.date === undefined || value.date === null ? "" : value.date;
  if (typeof date !== "string" || (date !== "" && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date))) fail("invalid_input", "Das Datum muss leer oder ein gültiges Datum im Format JJJJ-MM-TT sein.");
  let type: KlausurType | undefined;
  if (value.type !== undefined && value.type !== null && value.type !== "") {
    if (typeof value.type !== "string" || !TYPES.has(value.type as KlausurType)) fail("invalid_input", "Der Klausurtyp ist ungültig.");
    type = value.type as KlausurType;
  }
  if (!Array.isArray(value.topicIds) || value.topicIds.length > 80 || value.topicIds.some(topic => typeof topic !== "string" || !LEAF_TOPICS.has(topic))) {
    fail("invalid_input", "Die Themenkennungen sind ungültig.");
  }
  const topicIds = value.topicIds as string[];
  if (new Set(topicIds).size !== topicIds.length) fail("invalid_input", "Themenkennungen dürfen nicht doppelt vorkommen.");
  return { ...(id ? { id } : {}), source, date, title: value.title.trim(), area: value.area as CatalogArea, ...(type ? { type } : {}), topicIds: [...topicIds] };
}

/** The normal contract still has exactly the original three areas. */
export function validateCatalogMetadata(input: unknown): CatalogMetadata {
  return validateMetadataFields(input, AREAS) as CatalogMetadata;
}

/** Separate, source-bound metadata contract. Nothing is inferred from filenames. */
export function validateLegacyCatalogMetadata(input: unknown): LegacyMetadataFields {
  const obj = (v: unknown, keys: readonly string[]): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) fail("invalid_input", "Die Legacy-Quellenbindung ist unvollständig oder enthält Zusatzfelder.");
    return v as Record<string, unknown>;
  };
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("invalid_input", "Legacy-Metadaten fehlen.");
  const { legacy: raw, ...fields } = input as Record<string, unknown>;
  const legacy = obj(raw, ["version", "planId", "planSha256", "manifestSha256", "idMapSha256", "metadata", "pdf", "typeProjection", "roleDeclaration"]);
  const meta = obj(legacy.metadata, ["originPath", "originFileSha256", "recordIndex", "sourceId", "source", "area", "type"]);
  const pdf = obj(legacy.pdf, ["filename", "sha256", "byteSize", "edition"]);
  const hash = (v: unknown) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
  const text = (v: unknown, max: number): v is string => typeof v === "string" && !!v && v.length <= max && v.trim() === v && !/[\x00-\x1f\x7f]/.test(v);
  if (legacy.version !== 1 || !text(legacy.planId, 128) || !/^[A-Za-z0-9_-]{8,128}$/.test(legacy.planId) ||
      !hash(legacy.planSha256) || !hash(legacy.manifestSha256) || !hash(legacy.idMapSha256) || legacy.roleDeclaration !== "user-declared-combined") fail("invalid_input", "Die Legacy-Planbindung ist ungültig.");
  if (!text(meta.originPath, 1024) || meta.originPath.startsWith("/") || meta.originPath.includes("\\") || meta.originPath.split("/").some(p => !p || p === "." || p === "..") || !meta.originPath.toLowerCase().endsWith(".json") ||
      !hash(meta.originFileSha256) || !Number.isSafeInteger(meta.recordIndex) || Number(meta.recordIndex) < 0 ||
      !text(meta.sourceId, 128) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(meta.sourceId) || !text(meta.type, 255)) fail("invalid_input", "Die Original-JSONprovenienz ist ungültig.");
  // Use the same bounded PDF/source envelope as the combined import.
  validateLegacyImportCommand({ contractVersion: 1, requestId: "legacy-validation", planId: legacy.planId, planSha256: legacy.planSha256, klausurId: fields.id,
    expectedMetadataRevision: 1, expectedMetadataSha256: legacy.manifestSha256, expectedDocuments: [], source: { ...pdf, role: "kombiniert" } });
  const value = validateMetadataFields(fields, new Set(["zr", "oeffr", "sr", "eur", "steuer"]));
  if (!value.id || !value.topicIds.length || meta.source !== value.source || meta.area !== value.area) fail("invalid_input", "Quell-ID, Gebiet, Themen oder Quellname sind nicht ausdrücklich gebunden.");
  const unknownSourceType = ["SR-Angestelltenklausur", "SR-Anwaltsklausur"].includes(String(meta.type));
  if (unknownSourceType && legacy.typeProjection !== "neutral") fail("invalid_input", "Die unbekannten SR-Altwerte dürfen nicht als kanonischer Typ umgedeutet werden.");
  if (legacy.typeProjection === "neutral") {
    if (Object.hasOwn(fields, "type") || value.area !== "sr" || !unknownSourceType) fail("invalid_input", "Nur die belegten unbekannten SR-Altwerte dürfen einen neutral fehlenden Zieltyp haben.");
  } else if (legacy.typeProjection !== "canonical" || !value.type) fail("invalid_input", "Die ausdrücklich gebundene Typdarstellung fehlt.");
  return { ...value, id: value.id, legacy: JSON.parse(JSON.stringify(legacy)) } as LegacyMetadataFields;
}

/** Technical PDF validation only. It parses structure/page count; it never judges whether the file is a Klausur. */
export async function validateCatalogPdf<Role extends CatalogDocumentRole | "kombiniert">(file: UploadFileLike, role: Role): Promise<PreparedCatalogPdf<Role>> {
  const filename = safeFilename(file.name);
  if (!filename.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream")) fail("invalid_file", "Nur PDF-Dateien können als Klausurunterlage eingereicht werden.", 415);
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > CATALOG_MAX_FILE_BYTES) fail("too_large", "Eine Klausur-PDF darf höchstens 50 MB groß sein.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > CATALOG_MAX_FILE_BYTES) fail("too_large", "Die übertragene PDF ist zu groß oder unvollständig.", 413);
  if (bytes.subarray(0, 1024).indexOf(Buffer.from("%PDF-")) < 0 || bytes.subarray(Math.max(0, bytes.length - 4096)).indexOf(Buffer.from("%%EOF")) < 0) {
    fail("invalid_file", "Die Datei ist keine abgeschlossene PDF.");
  }
  let parsed: Awaited<ReturnType<typeof extractPdfPlanningText>>;
  try { parsed = await extractPdfPlanningText(bytes, filename); }
  catch { fail("invalid_file", "Die PDF konnte technisch nicht gelesen werden."); }
  if (!Number.isSafeInteger(parsed.totalPages) || parsed.totalPages < 1) fail("invalid_file", "Die PDF enthält keine lesbaren Seiten.");
  return { role, filename, bytes, sha256: fileHash(bytes), byteSize: bytes.length, pageCount: parsed.totalPages,
    textStatus: parsed.text.trim() ? "ready" : "needs_ocr", extractionVersion: "pdf-technical-v1" };
}

function compatibleMetadata(existing: unknown, incoming: InternalImportInput['metadata']): boolean {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) return false;
  const record = existing as Record<string, unknown>;
  if (record.source !== incoming.source || record.title !== incoming.title || record.area !== incoming.area) return false;
  if (incoming.date && record.date && record.date !== incoming.date) return false;
  if (incoming.type && record.type && record.type !== incoming.type) return false;
  if (incoming.topicIds.length && Array.isArray(record.topicIds) && canonical(record.topicIds) !== canonical(incoming.topicIds)) return false;
  return true;
}

function recordValue(metadata: InternalImportInput['metadata'], id: string): Record<string, unknown> {
  const now = new Date().toISOString();
  return { id, source: metadata.source, date: metadata.date, title: metadata.title, area: metadata.area,
    ...(metadata.type ? { type: metadata.type } : {}), topicIds: metadata.topicIds, createdAt: now, updatedAt: now, acceptanceMode: "direct", contentCheck: "not-performed" };
}

function importSummary(row: Record<string, unknown>, documents: CatalogDocumentSummary[] = []): CatalogImportSummary {
  return { importId: String(row.import_id), requestId: String(row.request_id), status: row.status as CatalogImportSummary["status"],
    technicalValidation: row.technical_validation as CatalogImportSummary["technicalValidation"], duplicateStatus: row.duplicate_status as CatalogImportSummary["duplicateStatus"],
    klausurId: row.klausur_id ? String(row.klausur_id) : null, warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    errorCode: row.error_code ? String(row.error_code) : null, errorMessage: row.error_message ? String(row.error_message) : null, documents };
}

async function documentSummaries(client: PoolClient, klausurId: string): Promise<CatalogDocumentSummary[]> {
  const rows = await client.query(`SELECT d.document_id,d.role,v.document_version_id,v.version_number,v.source_filename,v.sha256,v.byte_size,v.page_count,v.text_status
    FROM stex.catalog_documents d JOIN stex.catalog_document_versions v ON v.document_id=d.document_id
    WHERE d.klausur_id=$1 ORDER BY d.role,v.version_number`, [klausurId]);
  return rows.rows.map(row => ({ documentId: row.document_id, documentVersionId: row.document_version_id, versionNumber: Number(row.version_number), role: row.role,
    sourceFilename: row.source_filename, sha256: row.sha256, byteSize: Number(row.byte_size), pageCount: row.page_count === null ? null : Number(row.page_count), textStatus: row.text_status }));
}

export class CatalogImportService {
  constructor(readonly auth: AccountService, readonly files: PrivateFiles) {}

  private async begin(input: InternalImportInput, principal: Principal, sourceDigest: string, legacy?: LegacyImportCommand): Promise<{ importId: string; existing?: CatalogImportSummary; statusCode?: number }> {
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const who = await this.auth.checkPrincipal(client, principal.sessionId, legacy ? "admin" : "active", !!legacy, true);
      const previous = (await client.query("SELECT * FROM stex.catalog_imports WHERE request_id=$1 FOR UPDATE", [input.requestId])).rows[0];
      if (previous) {
        if (previous.submitted_by_user_id !== who.userId || previous.source_digest !== sourceDigest) throw new AccountError("conflict", "Diese Vorgangskennung gehört zu anderen Daten.", 409);
        const documents = previous.klausur_id ? await documentSummaries(client, previous.klausur_id) : [];
        const existing = importSummary(previous, documents);
        return { importId: previous.import_id, existing, statusCode: existing.status === "committed" ? 200 : existing.status === "processing" ? 202 : 409 };
      }
      const importId = `ci-${randomUUID()}`;
      await client.query(`INSERT INTO stex.catalog_imports(import_id,submitted_by_user_id,request_id,source_digest,source_reference,status,acceptance_mode,content_check,technical_validation,duplicate_status,metadata,warnings)
        VALUES($1,$2,$3,$4,$5,'processing','direct','not-performed','valid','pending',$6::jsonb,'[]'::jsonb)`,
        [importId, who.userId, input.requestId, sourceDigest, input.metadata.source, JSON.stringify(legacy ? { ...input.metadata, legacy, ...("legacy" in input.metadata ? { legacyMetadata: input.metadata.legacy } : {}) } : input.metadata)]);
      await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
      return { importId };
    });
  }

  private async markFailed(importId: string, code: string, message: string): Promise<void> {
    try {
      await this.auth.database.transaction(async client => {
        await lockState(client);
        await client.query(`UPDATE stex.catalog_imports SET status='failed',technical_validation=CASE WHEN $2 IN ('invalid_input','invalid_file','too_large') THEN 'invalid' ELSE technical_validation END,
          duplicate_status=CASE WHEN $2='conflict' THEN 'conflict' ELSE duplicate_status END,error_code=$2,error_message=$3,updated_at=now(),completed_at=now() WHERE import_id=$1 AND status='processing'`, [importId, code, message]);
        await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
      });
    } catch { /* The original import error remains the user-facing result. */ }
  }

  private async commit(input: InternalImportInput, principal: Principal, importId: string, legacy?: LegacyImportCommand): Promise<CatalogImportSummary> {
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const who = await this.auth.checkPrincipal(client, principal.sessionId, legacy ? "admin" : "active", !!legacy, true);
      const importRow = (await client.query("SELECT * FROM stex.catalog_imports WHERE import_id=$1 FOR UPDATE", [importId])).rows[0];
      if (!importRow || importRow.submitted_by_user_id !== who.userId) throw new AccountError("not_found", "Importvorgang nicht gefunden.", 404);
      if (importRow.status !== "processing") {
        const documents = importRow.klausur_id ? await documentSummaries(client, importRow.klausur_id) : [];
        return importSummary(importRow, documents);
      }

      if (legacy) await this.assertLegacyState(client, legacy);

      let klausurId = input.metadata.id;
      let existingPayload: Record<string, unknown> | undefined;
      let metadataCandidate = false;
      if (klausurId) {
        const row = (await client.query("SELECT id,payload FROM stex.catalog_records WHERE id=$1 AND kind='klausur' FOR UPDATE", [klausurId])).rows[0];
        if (row) {
          existingPayload = row.payload;
          if (!compatibleMetadata(existingPayload, input.metadata)) throw new AccountError("conflict", "Die vorhandene Klausur-ID hat abweichende Metadaten; sie wurde nicht überschrieben.", 409);
        }
      } else {
        const rows = await client.query("SELECT id,payload FROM stex.catalog_records WHERE kind='klausur' ORDER BY id");
        const hashes = input.documents.map(document => document.sha256);
        for (const row of rows.rows) {
          if (!compatibleMetadata(row.payload, input.metadata)) continue;
          metadataCandidate = true;
          // Metadata alone is not enough to merge two otherwise indistinguishable
          // cases. Reuse an unlabelled record only when at least one submitted
          // byte identity already belongs to that same case.
          const matchingDocument = await client.query("SELECT 1 FROM stex.catalog_document_versions v JOIN stex.catalog_documents d USING(document_id) WHERE d.klausur_id=$1 AND v.sha256=ANY($2::text[]) LIMIT 1", [row.id, hashes]);
          if (matchingDocument.rowCount) { klausurId = row.id; existingPayload = row.payload; break; }
        }
      }
      if (!klausurId) klausurId = `katalog-${randomUUID()}`;
      const catalogKey = recordKey("klausur", null, klausurId);
      if (!existingPayload) {
        const value = recordValue(input.metadata, klausurId);
        const normalized = { sourceReference: input.metadata.source, area: input.metadata.area, date: input.metadata.date || null, acceptanceMode: "direct", contentCheck: "not-performed" };
        await client.query("INSERT INTO stex.catalog_records(record_key,kind,id,revision,legacy_key,payload,normalized) VALUES($1,'klausur',$2,1,'catalog-import',$3::jsonb,$4::jsonb)", [catalogKey, klausurId, JSON.stringify(value), JSON.stringify(normalized)]);
        for (let index = 0; index < input.metadata.topicIds.length; index++) {
          const topicId = input.metadata.topicIds[index];
          await client.query("INSERT INTO stex.topics(id) VALUES($1) ON CONFLICT DO NOTHING", [topicId]);
          await client.query("INSERT INTO stex.record_references(source_key,path,source_catalog_key,target_topic_id) VALUES($1,$2,$1,$3)", [catalogKey, `value.topicIds[${index}]`, topicId]);
        }
      }

      const hashes = input.documents.map(document => document.sha256);
      const hashRows = hashes.length ? await client.query<{document_id:string;klausur_id:string;role:string}>("SELECT document_id,klausur_id,role FROM stex.catalog_document_versions v JOIN stex.catalog_documents d USING(document_id) WHERE v.sha256=ANY($1::text[])", [hashes]) : { rows: [] };
      const duplicateCandidate = !!existingPayload || metadataCandidate || hashRows.rows.length > 0;
      let identicalCount = 0;
      const documents: CatalogDocumentSummary[] = [];
      for (const document of input.documents) {
        // lockState already serializes catalog writers. Immutable identities only
        // need SELECT/INSERT privileges; a row lock would also require UPDATE.
        let documentRow = (await client.query("SELECT document_id FROM stex.catalog_documents WHERE record_key=$1 AND role=$2", [catalogKey, document.role])).rows[0];
        if (!documentRow) {
          const documentId = `cd-${randomUUID()}`;
          await client.query("INSERT INTO stex.catalog_documents(document_id,record_key,klausur_id,role,source_reference,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6)", [documentId,catalogKey,klausurId,document.role,input.metadata.source,who.userId]);
          documentRow = { document_id: documentId };
        }
        const same = (await client.query("SELECT document_version_id,version_number,source_filename,sha256,byte_size,page_count,text_status FROM stex.catalog_document_versions WHERE document_id=$1 AND sha256=$2", [documentRow.document_id, document.sha256])).rows[0];
        let version = same;
        if (same) {
          identicalCount++;
        } else {
          const next = Number((await client.query("SELECT COALESCE(MAX(version_number),0)+1 AS version FROM stex.catalog_document_versions WHERE document_id=$1", [documentRow.document_id])).rows[0].version);
          const versionId = `cdv-${randomUUID()}`;
          const key = storageKey("catalog", versionId);
          await this.files.put(key, document.bytes, document.sha256);
          await client.query(`INSERT INTO stex.catalog_document_versions(document_version_id,document_id,version_number,sha256,byte_size,media_type,page_count,text_status,extraction_version,storage_key,data_url_header,source_filename,submitted_by_user_id,import_id)
            VALUES($1,$2,$3,$4,$5,'application/pdf',$6,$7,$8,$9,'data:application/pdf;base64,',$10,$11,$12)`, [versionId,documentRow.document_id,next,document.sha256,document.byteSize,document.pageCount,document.textStatus,document.extractionVersion,key,document.filename,who.userId,importId]);
          version = { document_version_id: versionId, version_number: next, source_filename: document.filename, sha256: document.sha256, byte_size: document.byteSize, page_count: document.pageCount, text_status: document.textStatus };
        }
        await client.query("INSERT INTO stex.catalog_import_documents(import_id,document_version_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [importId,version.document_version_id,document.role]);
        documents.push({ documentId: documentRow.document_id, documentVersionId: version.document_version_id, versionNumber: Number(version.version_number), role: document.role, sourceFilename: version.source_filename, sha256: version.sha256, byteSize: Number(version.byte_size), pageCount: version.page_count === null ? null : Number(version.page_count), textStatus: version.text_status });
      }
      const duplicateStatus = identicalCount === input.documents.length ? "identical" : duplicateCandidate ? "candidate" : "distinct";
      const warning = duplicateCandidate && duplicateStatus !== "identical" ? ["Die Einreichung überschneidet sich mit einem vorhandenen Katalogfall oder einer vorhandenen Dateiprüfsumme; sie wurde als neue Dokumentversion nachvollziehbar gespeichert."] : [];
      await client.query(`UPDATE stex.catalog_imports SET status='committed',technical_validation='valid',duplicate_status=$2,klausur_id=$3,warnings=$4::jsonb,updated_at=now(),completed_at=now() WHERE import_id=$1`, [importId,duplicateStatus,klausurId,JSON.stringify(warning)]);
      await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
      return { importId, requestId: input.requestId, status: "committed", technicalValidation: "valid", duplicateStatus, klausurId, warnings: warning, errorCode: null, errorMessage: null, documents };
    });
  }

  /** No inferred IDs, metadata writes or version advancement through this entry. */
  private async assertLegacyState(client: PoolClient, command: LegacyImportCommand): Promise<void> {
    const row = (await client.query("SELECT revision,payload FROM stex.catalog_records WHERE id=$1 AND kind='klausur' FOR UPDATE", [command.klausurId])).rows[0];
    if (!row || Number(row.revision) !== command.expectedMetadataRevision || digest(row.payload) !== command.expectedMetadataSha256) {
      fail("conflict", "Die vorhandene Katalog-ID oder Metadatenrevision stimmt nicht mit dem Plan überein.", 409);
    }
    const documents = await documentSummaries(client, command.klausurId);
    // Include empty document identities as well: an unversioned role is still a conflict.
    const identities = await client.query("SELECT document_id FROM stex.catalog_documents WHERE klausur_id=$1", [command.klausurId]);
    const project = (d: LegacyDocumentState): LegacyDocumentState => ({ documentId: d.documentId, documentVersionId: d.documentVersionId, versionNumber: d.versionNumber, role: d.role, sha256: d.sha256, byteSize: d.byteSize });
    const state = (ds: LegacyDocumentState[]) => ds.map(project).sort((a, b) => a.documentVersionId.localeCompare(b.documentVersionId));
    if (canonical(state(documents)) !== canonical(state(command.expectedDocuments)) ||
        identities.rows.length !== documents.length || documents.length > 1 ||
        documents.some(d => d.role !== "kombiniert" || d.versionNumber !== 1 || d.sha256 !== command.source.sha256 || d.byteSize !== command.source.byteSize || d.sourceFilename !== command.source.filename)) {
      fail("conflict", "Der Dokumentstand weicht ab; keine Datei oder Version wurde ersetzt.", 409);
    }
  }

  async legacyStatusByRequest(headers: Headers, requestId: string): Promise<CatalogImportSummary> {
    const principal = await this.auth.principal(headers, "admin", true);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) fail("invalid_input", "Die Vorgangskennung ist ungültig.");
    return this.auth.database.transaction(async client => {
      await this.auth.checkPrincipal(client, principal.sessionId, "admin", true);
      const row = (await client.query("SELECT * FROM stex.catalog_imports WHERE request_id=$1 AND submitted_by_user_id=$2", [requestId, principal.userId])).rows[0];
      if (!row || !row.metadata?.legacy) throw new AccountError("not_found", "Legacy-Importvorgang nicht gefunden.", 404);
      return importSummary(row, row.klausur_id ? await documentSummaries(client, row.klausur_id) : []);
    }, true);
  }

  async submitLegacy(headers: Headers, rawCommand: unknown, document: PreparedCatalogPdf<"kombiniert">): Promise<{ summary: CatalogImportSummary; statusCode: number }> {
    const principal = await this.auth.principal(headers, "admin", true);
    const command = validateLegacyImportCommand(rawCommand);
    if (document.role !== "kombiniert" || document.filename !== command.source.filename || document.sha256 !== command.source.sha256 ||
        document.byteSize !== command.source.byteSize || document.bytes.length !== command.source.byteSize || fileHash(document.bytes) !== command.source.sha256) {
      fail("conflict", "Die PDF entspricht nicht der gebundenen Quelle.", 409);
    }
    const metadata = await this.auth.database.transaction(async client => {
      await this.auth.checkPrincipal(client, principal.sessionId, "admin", true);
      const row = (await client.query("SELECT revision,payload FROM stex.catalog_records WHERE id=$1 AND kind='klausur'", [command.klausurId])).rows[0];
      if (!row) fail("conflict", "Die Katalog-ID muss zuvor ausdrücklich angelegt und klassifiziert sein.", 409);
      const payload = row.payload;
      if (Number(row.revision) !== command.expectedMetadataRevision || digest(payload) !== command.expectedMetadataSha256) fail("conflict", "Die Metadaten entsprechen nicht dem Plan.", 409);
      // The authoritative revision/hash is rechecked under the writer lock in commit.
      const projected = Object.fromEntries(["id", "source", "date", "title", "area", "type", "topicIds", ...(Object.hasOwn(payload, "legacy") ? ["legacy"] : [])].filter(key => Object.hasOwn(payload, key)).map(key => [key, payload[key]]));
      const value = Object.hasOwn(payload, "legacy") ? validateLegacyCatalogMetadata(projected) : validateCatalogMetadata(projected);
      if (value.id !== command.klausurId || (!("legacy" in value) && !value.type) || !value.topicIds.length) fail("conflict", "Die vorhandene Klassifizierung ist noch ungeklärt.", 409);
      if ("legacy" in value && (value.legacy.planId !== command.planId || value.legacy.planSha256 !== command.planSha256 ||
          canonical(value.legacy.pdf) !== canonical({ filename: command.source.filename, sha256: command.source.sha256, byteSize: command.source.byteSize, edition: command.source.edition }))) {
        fail("conflict", "Metadaten und PDF gehören nicht zu derselben gebundenen Legacy-Quelle.", 409);
      }
      return value;
    }, true);
    const input: InternalImportInput = { requestId: command.requestId, metadata, documents: [document] };
    const started = await this.begin(input, principal, digest({ legacy: command }), command);
    if (started.existing && started.existing.status !== "processing") return { summary: started.existing, statusCode: started.statusCode ?? 200 };
    try { return { summary: await this.commit(input, principal, started.importId, command), statusCode: 201 }; }
    catch (error) {
      const known = error instanceof AccountError ? error : new AccountError("unavailable", "Der Import konnte nicht abgeschlossen werden.", 503);
      await this.markFailed(started.importId, known.code, known.message);
      throw error;
    }
  }

  async submit(headers: Headers, input: CatalogImportInput): Promise<{ summary: CatalogImportSummary; statusCode: number }> {
    const principal = await this.auth.principal(headers, "active");
    if (!input.requestId || !/^[A-Za-z0-9_-]{8,128}$/.test(input.requestId)) fail("invalid_input", "Eine stabile Vorgangskennung ist erforderlich.");
    if (input.documents.length !== CATALOG_ROLES.length || CATALOG_ROLES.some(role => !input.documents.some(document => document.role === role))) fail("invalid_input", "Sachverhalt und Lösung müssen jeweils als PDF vorliegen.");
    const sourceDigest = digest({ metadata: input.metadata, documents: input.documents.map(document => ({ role: document.role, filename: document.filename, sha256: document.sha256, byteSize: document.byteSize })) });
    const started = await this.begin(input, principal, sourceDigest);
    if (started.existing && started.existing.status !== "processing") return { summary: started.existing, statusCode: started.statusCode ?? 200 };
    // A caller may retry an upload after a process interruption between the
    // durable receipt and the catalog commit. The request fingerprint still
    // protects against changed data; the same payload resumes that receipt.
    try { return { summary: await this.commit(input, principal, started.importId), statusCode: 201 }; }
    catch (error) {
      const known = error instanceof AccountError ? error : new AccountError("unavailable", "Der Import konnte nicht abgeschlossen werden.", 503);
      await this.markFailed(started.importId, known.code, known.message);
      throw error;
    }
  }

  async list(headers: Headers): Promise<CatalogListEntry[]> {
    const principal = await this.auth.principal(headers, "active");
    return this.auth.database.transaction(async client => {
      await this.auth.checkPrincipal(client, principal.sessionId, "active");
      const rows = await client.query(`SELECT c.id,c.revision,c.payload,
        COALESCE(json_agg(json_build_object('documentId',d.document_id,'documentVersionId',v.document_version_id,'versionNumber',v.version_number,'role',d.role,'sourceFilename',v.source_filename,'sha256',v.sha256,'byteSize',v.byte_size,'pageCount',v.page_count,'textStatus',v.text_status) ORDER BY d.role,v.version_number) FILTER (WHERE d.document_id IS NOT NULL),'[]'::json) AS documents
        FROM stex.catalog_records c LEFT JOIN stex.catalog_documents d ON d.record_key=c.record_key LEFT JOIN stex.catalog_document_versions v ON v.document_id=d.document_id
        WHERE c.kind='klausur' GROUP BY c.id,c.revision,c.payload ORDER BY c.id`);
      return rows.rows.map(row => ({ id: row.id, revision: Number(row.revision), metadata: row.payload, documents: Array.isArray(row.documents) ? row.documents : [] }));
    }, true);
  }

  async status(headers: Headers, importId: string): Promise<CatalogImportSummary> {
    const principal = await this.auth.principal(headers, "active");
    if (!/^ci-[A-Za-z0-9-]{20,}$/.test(importId)) fail("invalid_input", "Die Vorgangskennung ist ungültig.");
    return this.auth.database.transaction(async client => {
      await this.auth.checkPrincipal(client, principal.sessionId, "active");
      const row = (await client.query("SELECT * FROM stex.catalog_imports WHERE import_id=$1 AND submitted_by_user_id=$2", [importId,principal.userId])).rows[0];
      if (!row) throw new AccountError("not_found", "Importvorgang nicht gefunden.", 404);
      const documents = row.klausur_id ? await documentSummaries(client, row.klausur_id) : [];
      return importSummary(row, documents);
    }, true);
  }

  /** Owner-scoped lookup used after a response/network interruption. */
  async statusByRequest(headers: Headers, requestId: string): Promise<CatalogImportSummary> {
    const principal = await this.auth.principal(headers, "active");
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) fail("invalid_input", "Die Vorgangskennung ist ungültig.");
    return this.auth.database.transaction(async client => {
      await this.auth.checkPrincipal(client, principal.sessionId, "active");
      const row = (await client.query("SELECT * FROM stex.catalog_imports WHERE request_id=$1 AND submitted_by_user_id=$2", [requestId, principal.userId])).rows[0];
      if (!row) throw new AccountError("not_found", "Importvorgang nicht gefunden.", 404);
      const documents = row.klausur_id ? await documentSummaries(client, row.klausur_id) : [];
      return importSummary(row, documents);
    }, true);
  }
}
