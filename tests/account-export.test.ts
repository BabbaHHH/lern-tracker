import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolClient } from "pg";
import { AccountError } from "@/lib/server/auth/security";
import type { AccountService, Principal } from "@/lib/server/auth/service";
import {
  ACCOUNT_EXPORT_COMMAND_ACTIONS,
  ACCOUNT_EXPORT_RECORD_KINDS,
  AccountExportService,
  accountExportHTTP,
} from "@/lib/server/account-export-service";

const ownerA = "owner-A-private";
const ownerB = "owner-B-private";
const recordKey = (kind: string, owner: string, id: string) => JSON.stringify([kind, owner, id]);
const portableKey = (kind: string, id: string) => JSON.stringify([kind, id]);

function fixture() {
  const records = [
    {
      owner_user_id: ownerA,
      record_key: recordKey("profile", ownerA, "main"),
      kind: "profile",
      id: "main",
      revision: 4,
      legacy_key: recordKey("profile", ownerA, "main"),
      payload: {
        notes: "Meine private Profilnotiz",
        password: "SECRET_PROFILE_PASSWORD",
        studyPhases: [{ id: "phase-1", label: "Station", start: "2026-01-01", end: "2026-02-01", sourceDocument: "doc-1", parserText: "SECRET_PARSER_TEXT" }],
      },
    },
    {
      owner_user_id: ownerA,
      record_key: recordKey("document", ownerA, "doc-1"),
      kind: "document",
      id: "doc-1",
      revision: 2,
      legacy_key: recordKey("document", ownerA, "doc-1"),
      payload: {
        id: "doc-1",
        name: "Eigene Unterlage.pdf",
        tags: ["Zivilrecht"],
        includeInNextPlan: true,
        type: "application/pdf",
        size: 1234,
        uploadedAt: "2026-10-01T10:00:00.000Z",
        summary: "SECRET_DOCUMENT_TEXT",
        textContent: "SECRET_EXTRACTED_TEXT",
        dataUrlHeader: "SECRET_DATA_URL_HEADER",
        storageKey: "SECRET_STORAGE_PATH",
      },
    },
    {
      owner_user_id: ownerA,
      record_key: recordKey("unknown-private-kind", ownerA, "hidden"),
      kind: "unknown-private-kind",
      id: "hidden",
      revision: 1,
      legacy_key: "hidden",
      payload: { note: "SECRET_UNSUPPORTED_RECORD" },
    },
    {
      owner_user_id: ownerB,
      record_key: recordKey("note", ownerB, "b-note"),
      kind: "note",
      id: "b-note",
      revision: 1,
      legacy_key: "b-note",
      payload: { text: "SECRET_OWNER_B_NOTE" },
    },
  ];
  const references = [
    {
      owner_user_id: ownerA,
      source_key: recordKey("profile", ownerA, "main"),
      path: "studyPhases.0.sourceDocument",
      source_personal_key: recordKey("profile", ownerA, "main"),
      target_personal_key: recordKey("document", ownerA, "doc-1"),
      target_catalog_key: null,
      target_topic_id: null,
    },
    {
      owner_user_id: ownerA,
      source_key: recordKey("document", ownerA, "doc-1"),
      path: "relatedExam",
      source_personal_key: recordKey("document", ownerA, "doc-1"),
      target_personal_key: null,
      target_catalog_key: JSON.stringify(["klausur", null, "exam-1"]),
      target_topic_id: null,
    },
    {
      owner_user_id: ownerB,
      source_key: recordKey("note", ownerB, "b-note"),
      path: "relatedExam",
      source_personal_key: recordKey("note", ownerB, "b-note"),
      target_personal_key: null,
      target_catalog_key: null,
      target_topic_id: "topic-b",
    },
  ];
  const versions = [
    {
      owner_user_id: ownerA,
      document_version_id: "version-a",
      document_id: "doc-1",
      record_key: recordKey("document", ownerA, "doc-1"),
      sha256: "a".repeat(64),
      byte_size: "1234",
      media_type: "application/pdf",
      page_count: 1,
      text_status: "ready",
      extraction_version: "extract-v1",
      storage_key: "SECRET_STORAGE_KEY",
      data_url_header: "SECRET_DATA_URL_HEADER",
    },
    {
      owner_user_id: ownerB,
      document_version_id: "version-b",
      document_id: "b-doc",
      record_key: recordKey("document", ownerB, "b-doc"),
      sha256: "b".repeat(64),
      byte_size: "99",
      media_type: "application/pdf",
      page_count: 1,
      text_status: "ready",
      extraction_version: null,
      storage_key: "SECRET_OWNER_B_STORAGE_KEY",
      data_url_header: "data:application/pdf;base64,",
    },
  ];
  const pages = [
    { document_version_id: "version-a", page_number: 1, printed_label: "1", width: 612, height: 792, rotation: 0, text_status: "ready", extraction_version: "extract-v1" },
    { document_version_id: "version-b", page_number: 1, printed_label: "1", width: 612, height: 792, rotation: 0, text_status: "ready", extraction_version: null },
  ];
  const annotations = [
    { owner_user_id: ownerA, id: "annotation-a", document_version_id: "version-a", page_number: 1, rectangles: [{ x: 1, y: 2, width: 3, height: 4 }], quote: "Eigene Markierung", note: "Private Notiz", revision: 2 },
    { owner_user_id: ownerB, id: "annotation-b", document_version_id: "version-b", page_number: 1, rectangles: [], quote: "SECRET_OWNER_B_ANNOTATION", note: null, revision: 1 },
  ];
  const commands = [
    {
      owner_user_id: ownerA,
      request_id: "request-a",
      contract_version: 1,
      action: "profile",
      before_values: [{ before: null, after: { kind: "profile", id: "main", record_key: recordKey("profile", ownerA, "main"), payload: { notes: "receipt note", password: "SECRET_RECEIPT_PASSWORD" } } }],
      result: {
        account: { userId: ownerA },
        accountId: ownerA,
        ownerId: ownerA,
        apiKey: "SECRET_API_KEY",
        refreshToken: "SECRET_REFRESH_TOKEN",
        authorization: "SECRET_AUTHORIZATION",
        databaseUrl: "SECRET_DATABASE_URL",
        sessionId: "SECRET_SESSION_ID",
        storageKey: "SECRET_STORAGE_KEY",
        changes: [{ kind: "profile", id: "main", record_key: recordKey("profile", ownerA, "main"), payload: { notes: "receipt note" } }],
        catalogRecord: { kind: "klausur", id: "exam-1", title: "SECRET_CATALOG_PAYLOAD" },
      },
      created_at: "2026-10-30T08:00:00.000Z",
      fingerprint: "SECRET_COMMAND_FINGERPRINT",
    },
    {
      owner_user_id: ownerB,
      request_id: "request-b",
      contract_version: 1,
      action: "profile",
      before_values: [],
      result: { note: "SECRET_OWNER_B_COMMAND" },
      created_at: "2026-10-30T08:00:00.000Z",
      fingerprint: "SECRET_OWNER_B_FINGERPRINT",
    },
  ];
  return { records, references, versions, pages, annotations, commands };
}

function makeService(mode: "active" | "unauthenticated" | "restricted" = "active") {
  const data = fixture();
  const queries: { sql: string; values: unknown[] }[] = [];
  const empty = { rows: [], rowCount: 0 };
  const client = {
    async query(sql: string, values: unknown[] = []) {
      queries.push({ sql, values });
      if (sql.startsWith("SET TRANSACTION")) return empty;
      if (sql.startsWith("INSERT INTO stex.auth_limits")) return { rows: [{ count: 1 }], rowCount: 1 };

      const owner = values[0];
      if (sql.includes("FROM stex.personal_records")) {
        const kinds = values[1] as string[];
        return { rows: data.records.filter(row => row.owner_user_id === owner && kinds.includes(row.kind)).sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)), rowCount: 0 };
      }
      if (sql.includes("FROM stex.record_references")) {
        assert.match(sql, /source_personal_key=ANY\(\$2::text\[\]\)/);
        const sourceKeys = values[1] as string[];
        return { rows: data.references.filter(row => row.owner_user_id === owner && sourceKeys.includes(row.source_personal_key)), rowCount: 0 };
      }
      if (sql.includes("FROM stex.document_versions")) {
        return { rows: data.versions.filter(row => row.owner_user_id === owner), rowCount: 0 };
      }
      if (sql.includes("FROM stex.document_pages")) {
        const visibleVersions = new Set(data.versions.filter(row => row.owner_user_id === owner).map(row => row.document_version_id));
        return { rows: data.pages.filter(row => visibleVersions.has(row.document_version_id)), rowCount: 0 };
      }
      if (sql.includes("FROM stex.annotations")) {
        return { rows: data.annotations.filter(row => row.owner_user_id === owner), rowCount: 0 };
      }
      if (sql.includes("FROM stex.learning_commands")) {
        const actions = values[1] as string[];
        return { rows: data.commands.filter(row => row.owner_user_id === owner && actions.includes(row.action)), rowCount: 0 };
      }
      throw new Error(`Unexpected query in export service: ${sql}`);
    },
  } as unknown as PoolClient;
  const principal: Principal = {
    userId: ownerA,
    identityId: "identity-a",
    sessionId: "session-a",
    status: "active",
    role: "member",
    revision: 1,
    generation: 1,
    createdAt: new Date("2026-10-30T07:00:00.000Z"),
    factorVerifiedAt: null,
    email: "private@example.test",
    name: "Private Account",
  };
  const auth = {
    baseURL: "https://app.test",
    database: { transaction: async (work: (client: PoolClient) => Promise<unknown>) => work(client) },
    principal: async () => {
      if (mode === "unauthenticated") throw new AccountError("unauthenticated", "Bitte erneut anmelden.", 401);
      return principal;
    },
    checkPrincipal: async () => {
      if (mode === "restricted") throw new AccountError("forbidden", "Kontozugang nicht freigegeben.", 403);
      return principal;
    },
  } as unknown as AccountService;
  return { service: new AccountExportService(auth), queries };
}

function request() {
  return new Request("https://app.test/api/account/export", { method: "GET", headers: { host: "app.test" } });
}

test("exports only the declared personal record and command kinds in a stable JSON shape", async () => {
  const { service, queries } = makeService();
  const response = await accountExportHTTP(request(), service);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.schema, "stex.personal-account-export");
  assert.equal(body.schemaVersion, 1);
  assert.deepEqual(body.records.map((row: { kind: string }) => row.kind), ["document", "profile"]);
  assert.deepEqual(body.records.map((row: { record_key: string }) => row.record_key), [portableKey("document", "doc-1"), portableKey("profile", "main")]);
  assert.equal(body.commands.length, 1);
  assert.equal(body.commands[0].action, "profile");
  assert.ok(ACCOUNT_EXPORT_RECORD_KINDS.includes("profile"));
  assert.ok(ACCOUNT_EXPORT_RECORD_KINDS.includes("document"));
  assert.ok(ACCOUNT_EXPORT_COMMAND_ACTIONS.includes("documents"));
  assert.ok(queries.some(query => query.sql.includes("FROM stex.personal_records")));
});

test("keeps every row and reference within the authenticated owner and omits embedded owner IDs", async () => {
  const { service, queries } = makeService();
  const response = await accountExportHTTP(request(), service);
  const body = await response.json();
  const serialized = JSON.stringify(body);

  assert.ok(queries.filter(query => query.sql.includes("FROM stex.")).every(query => query.values[0] === ownerA));
  assert.equal(body.records.some((row: { id: string }) => row.id === "b-note"), false);
  assert.equal(body.documents.versions.some((row: { documentId: string }) => row.documentId === "b-doc"), false);
  assert.equal(body.documents.annotations.some((row: { id: string }) => row.id === "annotation-b"), false);
  assert.equal(body.commands.some((row: { requestId: string }) => row.requestId === "request-b"), false);
  assert.equal(body.references.some((row: { fieldPath: string }) => row.fieldPath === "relatedExam" && row.targetTopicId === "topic-b"), false);
  assert.equal(serialized.includes(ownerA), false);
  assert.equal(serialized.includes(ownerB), false);
});

test("preserves personal metadata while stripping credentials, server paths, extracted text, and catalog payloads", async () => {
  const { service } = makeService();
  const response = await accountExportHTTP(request(), service);
  const body = await response.json();
  const serialized = JSON.stringify(body);

  for (const secret of [
    "SECRET_PROFILE_PASSWORD",
    "SECRET_PARSER_TEXT",
    "SECRET_DOCUMENT_TEXT",
    "SECRET_EXTRACTED_TEXT",
    "SECRET_DATA_URL_HEADER",
    "SECRET_STORAGE_PATH",
    "SECRET_STORAGE_KEY",
    "SECRET_API_KEY",
    "SECRET_DATABASE_URL",
    "SECRET_SESSION_ID",
    "SECRET_REFRESH_TOKEN",
    "SECRET_AUTHORIZATION",
    "SECRET_RECEIPT_PASSWORD",
    "SECRET_CATALOG_PAYLOAD",
    "SECRET_COMMAND_FINGERPRINT",
    "SECRET_UNSUPPORTED_RECORD",
    "SECRET_OWNER_B_NOTE",
    "SECRET_OWNER_B_COMMAND",
  ]) assert.equal(serialized.includes(secret), false, `${secret} must not appear in the export`);

  assert.equal(body.records.find((row: { kind: string }) => row.kind === "profile").payload.notes, "Meine private Profilnotiz");
  assert.equal(body.records.find((row: { kind: string }) => row.kind === "document").payload.name, "Eigene Unterlage.pdf");
  assert.equal(body.documents.versions[0].recordKey, portableKey("document", "doc-1"));
  assert.equal(body.references.find((row: { targetCatalogKey: string | null }) => row.targetCatalogKey)?.targetCatalogKey, JSON.stringify(["klausur", null, "exam-1"]));
  assert.equal(body.commands[0].result.catalogRecord.id, "exam-1");
  assert.equal(body.commands[0].result.catalogRecord.title, undefined);
});

test("sets private attachment and no-cache response headers", async () => {
  const { service } = makeService();
  const response = await accountExportHTTP(request(), service);
  const body = await response.json();

  assert.match(response.headers.get("content-type") ?? "", /^application\/json; charset=utf-8$/);
  assert.match(response.headers.get("content-disposition") ?? "", /^attachment; filename="stex-personal-data-\d{4}-\d{2}-\d{2}\.json"/);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.match(body.createdAt, /^2026-\d{2}-\d{2}T/);
});

test("returns private error responses without a download for unauthenticated or restricted accounts", async () => {
  for (const [mode, status] of [["unauthenticated", 401], ["restricted", 403]] as const) {
    const { service, queries } = makeService(mode);
    const response = await accountExportHTTP(request(), service);
    const body = await response.json();

    assert.equal(response.status, status);
    assert.equal(response.headers.get("content-disposition"), null);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(body.contractVersion, 1);
    assert.equal(queries.some(query => query.sql.includes("FROM stex.personal_records")), false);
  }
});
