import type { AreaShape } from "./inventory";

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }
export interface LegacyBackup { version: 1; exportedAt: string; data: JsonObject }
export interface AccountContract {
  userId: string;
  status: "pending" | "active" | "blocked";
  role: "member" | "admin";
  revision: number;
}

/** The owner is supplied by the migration operator, never read from the backup. */
export interface MigrationContext { ownerUserId: string; topicIds: readonly string[] }
export interface DataRecord {
  kind: string;
  id: string;
  ownerUserId: string | null; // null is the common catalog, not unrestricted access
  revision: number;
  legacyKey: string;
  value: JsonValue; // lossless legacy payload; opaque extra fields are retained
  normalized: JsonObject;
}
export interface DocumentVersionContract {
  documentVersionId: string;
  documentId: string;
  ownerUserId: string | null;
  sha256: string;
  byteSize: number;
  mediaType: string;
  pageCount: number | null;
  textStatus: "pending" | "ready" | "needs_ocr" | "failed";
  extractionVersion: string | null;
}
export interface DocumentPageContract {
  documentVersionId: string;
  pageNumber: number; // PDF page, one-based; printed labels are separate
  printedLabel: string | null;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  textStatus: DocumentVersionContract["textStatus"];
  extractionVersion: string | null;
}
export interface AnnotationContract {
  id: string;
  ownerUserId: string;
  documentVersionId: string;
  pageNumber: number;
  rectangles: { x: number; y: number; width: number; height: number }[];
  quote: string | null;
  note: string | null;
  revision: number;
}
/** DATA-A models this handoff; it does not implement the online upload workflow. */
export interface CatalogImportContract {
  importId: string;
  submittedByUserId: string;
  sourceReference: string;
  status: "queued" | "processing" | "committed" | "failed";
  acceptanceMode: "direct";
  contentCheck: "not-performed";
  technicalValidation: "pending" | "valid" | "invalid";
  duplicateStatus: "pending" | "identical" | "candidate" | "distinct" | "conflict";
  klausurId: string;
  documents: { documentId: string; documentVersionId: string; role: "sachverhalt" | "loesung" | "kombiniert" | "unbekannt" }[];
}

export interface Issue {
  code: string;
  path: string;
  message: string; // messages contain no payload values or document text
}
export interface AreaLayout {
  key: string;
  shape: AreaShape;
  recordKeys: string[];
  /** Unknown catalog fields remain personal until an explicit shared contract exists. */
  extensionRecordKeys?: Record<string, string>;
}
export interface ImportReceipt {
  requestId: string;
  ownerUserId: string;
  sourceDigest: string;
  exportedAt: string;
  areas: AreaLayout[];
  recordRevisions: Record<string, number>;
  documentVersionIds: string[];
}
export interface MigrationSnapshot {
  schemaVersion: 1;
  generation: number;
  records: Record<string, DataRecord>;
  documentVersions: Record<string, DocumentVersionContract>;
  imports: Record<string, ImportReceipt>;
}
export interface MigrationPlan {
  contractVersion: 1;
  baseGeneration: number;
  context: MigrationContext;
  backup: LegacyBackup;
  sourceDigest: string;
  areas: AreaLayout[];
  records: Record<string, DataRecord>;
  documentVersions: Record<string, DocumentVersionContract>;
  changes: { key: string; action: "new" | "unchanged" | "conflict"; expectedRevision: number | null }[];
  excluded: { key: string; reason: "derived-cache" | "device-metadata" }[];
  warnings: Issue[];
  conflicts: Issue[];
}
export interface Comparison { equal: boolean; areaCount: number; recordCount: number; differences: string[] }
export interface UndoToken { before: MigrationSnapshot; afterGeneration: number; afterDigest: string }
