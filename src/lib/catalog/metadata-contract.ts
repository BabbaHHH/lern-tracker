import type { Area, CatalogArea, KlausurType } from '../types';
import type { LegacyCatalogBinding } from './legacy-import-contract';

export const METADATA_MAX_BATCH = 100;
export const METADATA_MAX_BYTES = 256 * 1024;
/** Explicit public allowlist. Unknown legacy/private extensions are never accepted. */
export interface MetadataFields {
  id: string;
  source: string;
  date: string;
  title: string;
  area: Area;
  type?: KlausurType;
  topicIds: string[];
}
export interface LegacyMetadataFields extends Omit<MetadataFields, 'area'> {
  area: CatalogArea;
  legacy: LegacyCatalogBinding;
}
export type MetadataReadFields = MetadataFields | LegacyMetadataFields;
export type MetadataPatch = Partial<Omit<MetadataFields, 'id' | 'type'>> & { type?: KlausurType | null };
export interface MetadataAccount { userId: string; accessGeneration: number; sessionContext: string }
export interface MetadataContext {
  contractVersion: 1;
  expectedAccountId: string;
  expectedAccessGeneration: number;
  expectedSessionContext: string;
}
export interface MetadataEntry { id: string; revision: number; snapshot: string; metadata: MetadataReadFields }
export interface MetadataView { contractVersion: 1; account: MetadataAccount; maxBatchSize: number; entry: MetadataEntry | null }
export interface MetadataPreviewInput extends MetadataContext { records: MetadataReadFields[]; action?: 'legacy-import' }
export interface MetadataPreviewRow { id: string; expectedRevision: number | null; disposition: 'create' | 'identical' | 'conflict' }
export interface MetadataPreview {
  contractVersion: 1;
  account: MetadataAccount;
  snapshot: string;
  records: MetadataReadFields[];
  action?: 'legacy-import';
  rows: MetadataPreviewRow[];
}
export type MetadataCommand = MetadataContext & { requestId: string } & (
  { action: 'import'; records: MetadataFields[]; snapshot: string } |
  { action: 'legacy-import'; records: LegacyMetadataFields[]; snapshot: string } |
  { action: 'patch'; id: string; expectedRevision: number; expectedSnapshot: string; fields: MetadataPatch } |
  { action: 'delete'; id: string; expectedRevision: number; expectedSnapshot: string }
);
export interface MetadataResult {
  contractVersion: 1;
  account: MetadataAccount;
  requestId: string;
  action: MetadataCommand['action'];
  status: 'committed' | 'conflict';
  replay: boolean;
  rows: { id: string; revision: number | null; outcome: 'created' | 'identical' | 'updated' | 'deleted' | 'conflict' | 'skipped' }[];
}
export function metadataContext(account: MetadataAccount): MetadataContext {
  return { contractVersion: 1, expectedAccountId: account.userId, expectedAccessGeneration: account.accessGeneration, expectedSessionContext: account.sessionContext };
}
export function sameMetadataAccount(a: MetadataAccount | null, b: MetadataAccount | null): boolean {
  return !!a && !!b && a.userId === b.userId && a.accessGeneration === b.accessGeneration && a.sessionContext === b.sessionContext;
}
