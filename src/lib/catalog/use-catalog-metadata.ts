'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { CatalogMetadataClient } from './metadata-client';
import type { MetadataEntry, MetadataFields, MetadataPatch, MetadataPreview } from './metadata-contract';

export function useCatalogMetadata() {
  const [client] = useState(() => new CatalogMetadataClient());
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  useEffect(() => {
    const timer = setTimeout(() => void client.load(), 0);
    const refresh = () => { client.hide(); if (document.visibilityState === 'visible') void client.load(); };
    window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); document.removeEventListener('visibilitychange', refresh); client.hide(); };
  }, [client]);
  return { ...state, reload: (id?: string) => client.load(id), recover: () => client.recover(),
    previewImport: (records: MetadataFields[]) => state.view ? client.preview(records, state.view.account) : Promise.resolve(null),
    importPreview: (preview: MetadataPreview) => client.import(preview),
    patch: (entry: MetadataEntry, fields: MetadataPatch) => state.view ? client.patch(entry, fields, state.view.account) : Promise.resolve(null),
    remove: (entry: MetadataEntry) => state.view ? client.delete(entry, state.view.account) : Promise.resolve(null) };
}
