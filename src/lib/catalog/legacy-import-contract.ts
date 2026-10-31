import type { CatalogArea } from '../types';

/** Exact source pointers, never interpreted as server paths or commands. */
export interface LegacyCatalogBinding {
  version: 1;
  planId: string;
  planSha256: string;
  manifestSha256: string;
  idMapSha256: string;
  metadata: {
    originPath: string;
    originFileSha256: string;
    recordIndex: number;
    sourceId: string;
    source: string;
    area: CatalogArea;
    type: string;
  };
  pdf: { filename: string; sha256: string; byteSize: number; edition: string };
  typeProjection: 'canonical' | 'neutral';
  roleDeclaration: 'user-declared-combined';
}

/** A plan binds one existing catalog record to one already combined legacy PDF. */
export interface LegacyDocumentState {
  documentId: string;
  documentVersionId: string;
  versionNumber: number;
  role: 'sachverhalt' | 'loesung' | 'kombiniert' | 'unbekannt';
  sha256: string;
  byteSize: number;
}

export interface LegacyImportCommand {
  contractVersion: 1;
  requestId: string;
  planId: string;
  planSha256: string;
  klausurId: string;
  expectedMetadataRevision: number;
  /** SHA256 of canonical(full catalog_records.payload), including timestamps. */
  expectedMetadataSha256: string;
  expectedDocuments: LegacyDocumentState[];
  source: { role: 'kombiniert'; filename: string; sha256: string; byteSize: number; edition: string };
}

export const LEGACY_IMPORT_FIELDS = ['contractVersion', 'requestId', 'planId', 'planSha256', 'klausurId', 'expectedMetadataRevision', 'expectedMetadataSha256', 'expectedDocuments', 'source'] as const;
