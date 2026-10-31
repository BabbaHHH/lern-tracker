import type { PoolClient } from "pg";
import { projectProfile } from "../learning/profile-fields";
import type { AccountService, Principal } from "./auth/service";
import { AccountError, accountFailure, atomicLimit, sameOrigin } from "./auth/security";

export const ACCOUNT_EXPORT_RECORD_KINDS = [
  "profile",
  "exam-date",
  "lernstart",
  "learning-start",
  "learning-entry",
  "note",
  "progress",
  "task",
  "calendar-event",
  "tracking-entry",
  "ag-week",
  "plan-result",
  "plan-history",
  "plan-range",
  "draft",
  "notepad",
  "document",
  "recommender-settings",
  "theme",
  "prompt",
  "plan-model",
  "reasoning-settings",
  "ai-metrics",
  "correction-settings",
  "error-profile",
] as const;

export const ACCOUNT_EXPORT_COMMAND_ACTIONS = [
  "set",
  "undo",
  "profile",
  "note",
  "schedule",
  "plan",
  "preparation",
  "checkin",
  "writing",
  "correction",
  "documents",
  "settings",
] as const;

const omitted = Symbol("omitted-export-field");
type Omitted = typeof omitted;
type JsonObject = Record<string, unknown>;

interface PersonalRecordRow {
  record_key: string;
  kind: string;
  id: string;
  revision: number;
  legacy_key: string;
  payload: unknown;
}

interface ReferenceRow {
  source_key: string;
  path: string;
  source_personal_key: string | null;
  target_personal_key: string | null;
  target_catalog_key: string | null;
  target_topic_id: string | null;
}

interface CommandRow {
  request_id: string;
  contract_version: number;
  action: string;
  before_values: unknown;
  result: unknown;
  created_at: Date | string;
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

const forbiddenFields = new Set([
  "account",
  "accountid",
  "accountkey",
  "owner",
  "ownerid",
  "ownerkey",
  "userid",
  "owneruserid",
  "identity",
  "identityid",
  "authuserid",
  "session",
  "sessionid",
  "sessiontoken",
  "sessioncontext",
  "accessgeneration",
  "expectedaccountid",
  "expectedaccessgeneration",
  "expectedsessioncontext",
  "cookie",
  "password",
  "passwordhash",
  "authorization",
  "refreshtoken",
  "accesstoken",
  "privatekey",
  "invitation",
  "invitationid",
  "token",
  "tokenhash",
  "verificationtoken",
  "mailoutbox",
  "audit",
  "credential",
  "credentials",
  "encryptedkey",
  "keyfingerprint",
  "keysuffix",
  "apikey",
  "secret",
  "secretkey",
  "storagekey",
  "storagepath",
  "dataurl",
  "dataurlheader",
  "filecontents",
  "contentbase64",
  "binarydata",
  "filepath",
  "fileurl",
  "viewerurl",
  "serverpath",
  "databasepath",
  "dbpath",
  "databaseurl",
  "connectionstring",
  "privatefileroot",
  "baseurl",
  "hostname",
  "directory",
  "path",
  "fingerprint",
  "accessproof",
  "snapshot",
]);

const catalogDataFields = new Set([
  "catalog",
  "catalogdata",
  "catalogrecords",
  "catalogitems",
  "klausur",
  "klausuren",
  "katalog",
  "katalogdaten",
]);
const personalRecordKinds = new Set<string>(ACCOUNT_EXPORT_RECORD_KINDS);

function publicRecordKey(value: string, ownerUserId: string): string {
  const key = portableReference(value, ownerUserId);
  return key === omitted ? "" : key;
}

function portableReference(value: string, ownerUserId: string): string | Omitted {
  try {
    const key: unknown = JSON.parse(value);
    if (!Array.isArray(key) || key.length !== 3 || typeof key[0] !== "string" || typeof key[2] !== "string") return value;
    if (key[0] === "klausur" && key[1] === null) return value;
    if (!personalRecordKinds.has(key[0])) return value;
    if (key[1] === ownerUserId) return JSON.stringify([key[0], key[2]]);
    // A foreign personal key should never be present in this owner's rows.
    // Drop it defensively instead of copying another account identifier out.
    return omitted;
  } catch {
    return value;
  }
}

function sanitizeJson(value: unknown, ownerUserId: string): unknown | Omitted {
  if (typeof value === "string") return portableReference(value, ownerUserId);
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const output: unknown[] = [];
    for (const item of value) {
      const sanitized = sanitizeJson(item, ownerUserId);
      if (sanitized !== omitted) output.push(sanitized);
    }
    return output;
  }
  if (!isObject(value)) return omitted;

  // A nested catalog row can contribute only its stable identity.
  if (value.kind === "klausur" && typeof value.id === "string") {
    return {
      ...(typeof value.record_key === "string" ? { record_key: value.record_key } : {}),
      kind: "klausur",
      id: value.id,
    };
  }

  const output: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    if (forbiddenFields.has(normalized) || catalogDataFields.has(normalized)) continue;

    // Command receipts contain before/after personal-record snapshots. Reapply
    // the record-specific projection so legacy document text cannot leak through.
    if (key === "payload" && typeof value.kind === "string") {
      output[key] = sanitizeRecordPayload(value.kind, child, ownerUserId);
      continue;
    }

    const sanitized = sanitizeJson(child, ownerUserId);
    if (sanitized !== omitted) output[key] = sanitized;
  }
  return output;
}

const documentMetadataFields = [
  "id",
  "name",
  "tags",
  "includeInNextPlan",
  "type",
  "size",
  "uploadedAt",
  "updatedAt",
] as const;

function sanitizeRecordPayload(kind: string, payload: unknown, ownerUserId: string): unknown {
  if (kind === "profile") {
    const projected = projectProfile(isObject(payload) ? payload : {});
    const sanitized = sanitizeJson(projected, ownerUserId);
    return sanitized === omitted ? {} : sanitized;
  }
  if (kind === "document") {
    const output: JsonObject = {};
    if (isObject(payload)) {
      for (const field of documentMetadataFields) {
        if (!Object.hasOwn(payload, field)) continue;
        const sanitized = sanitizeJson(payload[field], ownerUserId);
        if (sanitized !== omitted) output[field] = sanitized;
      }
    }
    return output;
  }
  const sanitized = sanitizeJson(payload, ownerUserId);
  return sanitized === omitted ? null : sanitized;
}

function isoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export interface PersonalAccountExport {
  schema: "stex.personal-account-export";
  schemaVersion: 1;
  createdAt: string;
  records: {
    record_key: string;
    kind: string;
    id: string;
    revision: number;
    legacyKey: string;
    payload: unknown;
  }[];
  references: {
    sourceKey: string;
    fieldPath: string;
    sourcePersonalKey: string;
    targetPersonalKey: string | null;
    targetCatalogKey: string | null;
    targetTopicId: string | null;
  }[];
  documents: {
    versions: {
      documentVersionId: string;
      documentId: string;
      recordKey: string;
      sha256: string;
      byteSize: number;
      mediaType: string;
      pageCount: number | null;
      textStatus: string;
      extractionVersion: string | null;
    }[];
    pages: {
      documentVersionId: string;
      pageNumber: number;
      printedLabel: string | null;
      width: number;
      height: number;
      rotation: number;
      textStatus: string;
      extractionVersion: string | null;
    }[];
    annotations: {
      id: string;
      documentVersionId: string;
      pageNumber: number;
      rectangles: unknown;
      quote: string | null;
      note: string | null;
      revision: number;
    }[];
  };
  commands: {
    requestId: string;
    contractVersion: number;
    action: string;
    createdAt: string;
    beforeValues: unknown;
    result: unknown;
  }[];
}

export class AccountExportService {
  constructor(readonly auth: AccountService) {}

  async read(headers: Headers): Promise<PersonalAccountExport> {
    const principal = await this.auth.principal(headers, "active");
    return this.auth.database.transaction(async (client: PoolClient) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const current: Principal = await this.auth.checkPrincipal(client, principal.sessionId, "active", false, true);
      if (current.userId !== principal.userId || current.generation !== principal.generation || current.sessionId !== principal.sessionId) {
        throw new AccountError("unauthenticated", "Bitte erneut anmelden.", 401);
      }
      await atomicLimit(client, `account-export:${current.userId}`, 5, 60 * 60);

      const recordRows = (await client.query<PersonalRecordRow>(
        `SELECT record_key,kind,id,revision,legacy_key,payload
         FROM stex.personal_records
         WHERE owner_user_id=$1 AND kind=ANY($2::text[])
         ORDER BY kind,id`,
        [current.userId, ACCOUNT_EXPORT_RECORD_KINDS],
      )).rows;
      const records = recordRows.map(row => ({
        record_key: publicRecordKey(row.record_key, current.userId),
        kind: row.kind,
        id: row.id,
        revision: row.revision,
        legacyKey: publicRecordKey(row.legacy_key, current.userId),
        payload: sanitizeRecordPayload(row.kind, row.payload, current.userId),
      }));

      const references = (await client.query<ReferenceRow>(
        `SELECT source_key,path,source_personal_key,target_personal_key,target_catalog_key,target_topic_id
         FROM stex.record_references
         WHERE owner_user_id=$1 AND source_personal_key IS NOT NULL AND source_personal_key=ANY($2::text[])
         ORDER BY source_key,path`,
        [current.userId, recordRows.map(record => record.record_key)],
      )).rows.map(row => ({
        sourceKey: publicRecordKey(row.source_key, current.userId),
        fieldPath: row.path,
        sourcePersonalKey: publicRecordKey(row.source_personal_key!, current.userId),
        targetPersonalKey: row.target_personal_key === null ? null : publicRecordKey(row.target_personal_key, current.userId),
        targetCatalogKey: row.target_catalog_key,
        targetTopicId: row.target_topic_id,
      }));

      const versions = (await client.query<{
        document_version_id: string;
        document_id: string;
        record_key: string;
        sha256: string;
        byte_size: string | number;
        media_type: string;
        page_count: number | null;
        text_status: string;
        extraction_version: string | null;
      }>(
        `SELECT document_version_id,document_id,record_key,sha256,byte_size,media_type,page_count,text_status,extraction_version
         FROM stex.document_versions
         WHERE owner_user_id=$1
         ORDER BY document_id,document_version_id`,
        [current.userId],
      )).rows.map(row => ({
        documentVersionId: row.document_version_id,
        documentId: row.document_id,
        recordKey: publicRecordKey(row.record_key, current.userId),
        sha256: row.sha256,
        byteSize: Number(row.byte_size),
        mediaType: row.media_type,
        pageCount: row.page_count,
        textStatus: row.text_status,
        extractionVersion: row.extraction_version,
      }));

      const pages = (await client.query<{
        document_version_id: string;
        page_number: number;
        printed_label: string | null;
        width: number;
        height: number;
        rotation: number;
        text_status: string;
        extraction_version: string | null;
      }>(
        `SELECT p.document_version_id,p.page_number,p.printed_label,p.width,p.height,p.rotation,p.text_status,p.extraction_version
         FROM stex.document_pages p
         JOIN stex.document_versions v ON v.document_version_id=p.document_version_id
         WHERE v.owner_user_id=$1
         ORDER BY p.document_version_id,p.page_number`,
        [current.userId],
      )).rows.map(row => ({
        documentVersionId: row.document_version_id,
        pageNumber: row.page_number,
        printedLabel: row.printed_label,
        width: row.width,
        height: row.height,
        rotation: row.rotation,
        textStatus: row.text_status,
        extractionVersion: row.extraction_version,
      }));

      const annotations = (await client.query<{
        id: string;
        document_version_id: string;
        page_number: number;
        rectangles: unknown;
        quote: string | null;
        note: string | null;
        revision: number;
      }>(
        `SELECT id,document_version_id,page_number,rectangles,quote,note,revision
         FROM stex.annotations
         WHERE owner_user_id=$1
         ORDER BY document_version_id,page_number,id`,
        [current.userId],
      )).rows.map(row => ({
        id: row.id,
        documentVersionId: row.document_version_id,
        pageNumber: row.page_number,
        rectangles: (() => { const value = sanitizeJson(row.rectangles, current.userId); return value === omitted ? [] : value; })(),
        quote: row.quote,
        note: row.note,
        revision: row.revision,
      }));

      const commands = (await client.query<CommandRow>(
        `SELECT request_id,contract_version,action,before_values,result,created_at
         FROM stex.learning_commands
         WHERE owner_user_id=$1 AND action=ANY($2::text[])
         ORDER BY created_at,request_id`,
        [current.userId, ACCOUNT_EXPORT_COMMAND_ACTIONS],
      )).rows.map(row => ({
        requestId: row.request_id,
        contractVersion: row.contract_version,
        action: row.action,
        createdAt: isoTimestamp(row.created_at),
        beforeValues: (() => { const value = sanitizeJson(row.before_values, current.userId); return value === omitted ? null : value; })(),
        result: (() => { const value = sanitizeJson(row.result, current.userId); return value === omitted ? null : value; })(),
      }));

      return {
        schema: "stex.personal-account-export",
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        records,
        references,
        documents: { versions, pages, annotations },
        commands,
      };
    });
  }
}

function privateFailure(error: unknown): Response {
  const response = accountFailure(error);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function accountExportHTTP(request: Request, service: AccountExportService): Promise<Response> {
  try {
    sameOrigin(request, service.auth.baseURL);
    const data = await service.read(request.headers);
    const date = data.createdAt.slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="stex-personal-data-${date}.json"; filename*=UTF-8''stex-personal-data-${date}.json`,
        "Cache-Control": "private, no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Vary": "Cookie",
      },
    });
  } catch (error) {
    return privateFailure(error);
  }
}
