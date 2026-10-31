import type { PoolClient } from "pg";
import type { AccountService } from "../auth/service";
import { AccountError, atomicLimit } from "../auth/security";

const DAY = 86400000;
const statuses = ["queued", "processing", "committed", "failed"];
export function safeImportMessage(code: string | null): string | null {
  if (!code) return null;
  return ({ conflict: "Die Zuordnung widerspricht einem vorhandenen Eintrag.", invalid_file: "Die PDF konnte technisch nicht gelesen werden.", too_large: "Die Einreichung überschreitet die Größenbegrenzung.", invalid_input: "Die Angaben sind ungültig.", unavailable: "Der Import konnte nicht abgeschlossen werden." } as Record<string, string>)[code] ?? "Der Vorgang konnte nicht abgeschlossen werden.";
}
function iso(value: unknown): string | null { return value instanceof Date ? value.toISOString() : null; }
function invalid(): never { throw new AccountError("invalid_input", "Die Filter oder Seitenangaben sind ungültig."); }
interface Paging { from: string; to: string; status: string; limit: number; lastTime: string | null; lastId: string | null; }
export function importPaging(params: URLSearchParams): Paging {
  const limit = Number(params.get("limit") ?? 25);
  const status = params.get("status") ?? "";
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (status && !statuses.includes(status))) invalid();
  let cursor: Record<string, unknown> | null = null;
  if (params.has("cursor")) {
    try { const raw = params.get("cursor")!; if (raw.length > 1500) invalid(); cursor = JSON.parse(Buffer.from(raw, "base64url").toString()); } catch { invalid(); }
    if (!cursor || cursor.status !== status || typeof cursor.from !== "string" || typeof cursor.to !== "string" || typeof cursor.lastTime !== "string" || typeof cursor.lastId !== "string" || cursor.lastId.length > 200) invalid();
  }
  const to = params.get("to") ?? cursor?.to as string ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(to))) invalid();
  const from = params.get("from") ?? cursor?.from as string ?? new Date(Date.parse(to) - 30 * DAY).toISOString();
  const validTime = (s: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s) && Number.isFinite(Date.parse(s));
  if (!validTime(to) || !validTime(from) || Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 90 * DAY || Date.parse(to) > Date.now() + 60000) invalid();
  if (cursor && (cursor.from !== from || cursor.to !== to || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(cursor.lastTime as string) || !Number.isFinite(Date.parse(cursor.lastTime as string)) || Date.parse(cursor.lastTime as string) < Date.parse(from) || Date.parse(cursor.lastTime as string) >= Date.parse(to))) invalid();
  return { from, to, status, limit, lastTime: cursor?.lastTime as string ?? null, lastId: cursor?.lastId as string ?? null };
}
function projection(row: Record<string, unknown>) {
  const code = typeof row.error_code === "string" ? row.error_code : null;
  return { importId: row.import_id as string, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), completedAt: iso(row.completed_at), status: row.status as string,
    klausurId: row.klausur_id as string | null, title: typeof row.title === "string" ? row.title : "Klausurimport", sourceReference: row.source_reference as string,
    technicalValidation: row.technical_validation as string, duplicateStatus: row.duplicate_status as string,
    warningCount: Array.isArray(row.warnings) ? row.warnings.length : 0, warningCodes: Array.isArray(row.warnings) && row.warnings.includes("Die Einreichung überschneidet sich mit einem vorhandenen Katalogfall oder einer vorhandenen Dateiprüfsumme; sie wurde als neue Dokumentversion nachvollziehbar gespeichert.") ? ["duplicate_overlap"] : [], acceptanceMode: "direct", contentCheck: "not-performed",
    errorCode: code && ["conflict", "invalid_file", "too_large", "invalid_input", "unavailable"].includes(code) ? code : code ? "unknown" : null, safeMessage: safeImportMessage(code) };
}
export class AdminService {
  constructor(readonly auth: AccountService) {}
  async read<T extends object>(headers: Headers, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const who = await this.auth.principal(headers, "admin");
    return this.auth.database.transaction(async client => {
      // Hold the same account/access locks as existing writers until the read ends.
      await this.auth.checkPrincipal(client, who.sessionId, "admin", false, true);
      await atomicLimit(client, `admin-overview:${who.userId}`, 120, 60);
      return { ...await work(client), ownerUserId: who.userId };
    });
  }
  async overview(headers: Headers) {
    return this.read(headers, async client => {
      const asOf = (await client.query("SELECT now() AS time")).rows[0].time.toISOString();
      const from = new Date(Date.parse(asOf) - 30 * DAY).toISOString();
      const result = await client.query("SELECT status,count(*)::int AS count FROM stex.catalog_imports WHERE created_at >= $1 AND created_at < $2 GROUP BY status", [from, asOf]);
      const byStatus = Object.fromEntries(statuses.map(status => [status, result.rows.find(row => row.status === status)?.count ?? 0]));
      const unavailable = { availability: "not_available", value: null, reasonCode: "not_collected" };
      return { asOf, imports: { periodStart: from, periodEnd: asOf, byStatus }, capabilities: { generalErrors: unavailable, usage: unavailable, learningSessions: unavailable, aiCosts: unavailable, hostingCosts: unavailable } };
    });
  }
  async imports(headers: Headers, params: URLSearchParams) {
    return this.read(headers, async client => {
      const p = importPaging(params);
      const result = await client.query(`SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,metadata->>'title' AS title FROM stex.catalog_imports
        WHERE created_at >= $1 AND created_at < $2 AND ($3='' OR status=$3)
        AND ($4::timestamptz IS NULL OR (created_at,import_id)<($4::timestamptz,$5::text))
        ORDER BY created_at DESC,import_id DESC LIMIT $6`, [p.from, p.to, p.status, p.lastTime, p.lastId, p.limit + 1]);
      const rows = result.rows.slice(0, p.limit);
      const last = rows.at(-1);
      return { asOf: new Date().toISOString(), periodStart: p.from, periodEnd: p.to, items: rows.map(projection), nextCursor: result.rows.length > p.limit && last ? Buffer.from(JSON.stringify({ from: p.from, to: p.to, status: p.status, lastTime: last.cursor_time, lastId: last.import_id })).toString("base64url") : null };
    });
  }
  async detail(headers: Headers, id: string) {
    return this.read(headers, async client => {
      if (!/^ci-[A-Za-z0-9-]{20,100}$/.test(id)) invalid();
      const row = (await client.query(`SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,metadata->>'title' AS title FROM stex.catalog_imports WHERE import_id=$1`, [id])).rows[0];
      if (!row) throw new AccountError("not_found", "Importvorgang nicht gefunden.", 404);
      const documents = (await client.query(`SELECT d.document_id AS "documentId",v.document_version_id AS "documentVersionId",i.role,v.version_number AS "versionNumber",v.page_count AS "pageCount",v.text_status AS "textStatus",v.byte_size::float8 AS "byteSize"
        FROM stex.catalog_import_documents i JOIN stex.catalog_document_versions v ON v.document_version_id=i.document_version_id JOIN stex.catalog_documents d ON d.document_id=v.document_id
        WHERE i.import_id=$1 ORDER BY i.role,v.version_number`, [id])).rows;
      return { import: { ...projection(row), documents } };
    });
  }
  async audit(headers: Headers, params: URLSearchParams) {
    return this.read(headers, async client => {
      const userId = params.get("userId");
      const limit = Number(params.get("limit") ?? 25);
      if (!userId || userId.length > 200 || !Number.isInteger(limit) || limit < 1 || limit > 100) invalid();
      let offsetTime: string | null = null, offsetId: string | null = null;
      if (params.has("cursor")) {
        try {
          const raw = params.get("cursor")!; if (raw.length > 1500) invalid();
          const c = JSON.parse(Buffer.from(raw, "base64url").toString());
          if (c.userId !== userId || typeof c.id !== "string" || c.id.length > 200 || typeof c.time !== "string" || !Number.isFinite(Date.parse(c.time))) invalid();
          offsetTime = c.time; offsetId = c.id;
        } catch { invalid(); }
      }
      const rows = (await client.query(`SELECT a.id,a.created_at,a.request_id,coalesce(u.name,'Betrieblicher Zugriff') AS actor_label,to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,a.action,a.result FROM stex.account_audit a LEFT JOIN stex.auth_identities i ON i.user_id=a.actor LEFT JOIN public.stex_auth_user u ON u.id=i.auth_user_id WHERE a.target=$1
        AND a.action IN ('invite','activate','block','unblock','revoke','resend','cleanup','prepare-admin','finish-admin','recover-admin')
        AND ($2::timestamptz IS NULL OR (a.created_at,a.id)<($2::timestamptz,$3::text)) ORDER BY a.created_at DESC,a.id DESC LIMIT $4`, [userId, offsetTime, offsetId, limit + 1])).rows;
      const items = rows.slice(0, limit).map(row => ({ id: row.id, createdAt: iso(row.created_at), action: row.action, actorLabel: row.actor_label, requestId: row.request_id, outcome: row.result?.librarySessionsRevoked === false ? "cleanup_pending" : "completed" }));
      const last = items.at(-1);
      return { asOf: new Date().toISOString(), items, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ userId, time: rows[items.length - 1].cursor_time, id: last.id })).toString("base64url") : null };
    });
  }
}
