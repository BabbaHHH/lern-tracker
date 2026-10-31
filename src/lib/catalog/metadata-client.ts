import { METADATA_MAX_BATCH, metadataContext, sameMetadataAccount, type MetadataAccount, type MetadataCommand, type MetadataEntry, type MetadataFields, type MetadataPatch, type MetadataPreview, type MetadataResult, type MetadataView, type MetadataReadFields, type LegacyMetadataFields } from './metadata-contract';

export class MetadataFailure extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); }
}
export interface CatalogMetadataState {
  status: 'loading' | 'ready' | 'error';
  view: MetadataView | null;
  preview: MetadataPreview | null;
  result: MetadataResult | null;
  busy: boolean;
  uncertain: boolean;
  message: string;
}
const BASE = '/api/catalog/metadata';
/** Memory only. No localStorage, implicit retries or background writes. */
export class CatalogMetadataClient {
  state: CatalogMetadataState = { status: 'loading', view: null, preview: null, result: null, busy: false, uncertain: false, message: '' };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private controller: AbortController | null = null;
  private pending: MetadataCommand | null = null;
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args)) {}
  subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f); }; };
  getSnapshot = () => this.state;
  private update(value: Partial<CatalogMetadataState>) { this.state = { ...this.state, ...value }; this.listeners.forEach(f => f()); }
  private start() { this.controller?.abort(); this.controller = new AbortController(); return { epoch: ++this.epoch, signal: this.controller.signal }; }
  private async request<T extends MetadataView | MetadataPreview | MetadataResult>(url: string, signal: AbortSignal, body?: unknown): Promise<T> {
    const response = await this.transport(url, { method: body === undefined ? 'GET' : 'POST', signal, credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Stex-Action': '1' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const value = await response.json();
    if (!response.ok) throw new MetadataFailure(value?.error?.code ?? 'unavailable', value?.error?.message ?? 'Der Katalog ist nicht verfügbar.', response.status);
    if (value?.contractVersion !== 1 || typeof value?.account?.userId !== 'string' || !Number.isSafeInteger(value?.account?.accessGeneration) || !/^[0-9a-f]{64}$/.test(value?.account?.sessionContext ?? '')) throw new MetadataFailure('unavailable', 'Antwort nicht bestätigt.', 503);
    return value as T;
  }
  hide = () => {
    this.epoch++; this.controller?.abort();
    this.update({ status: 'loading', view: null, preview: null, result: null, busy: false, uncertain: !!this.pending, message: this.pending ? 'Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.' : '' });
  };
  async load(id?: string): Promise<void> {
    if (this.state.busy) return;
    const { epoch, signal } = this.start();
    this.update({ status: 'loading', view: null, preview: null, result: null });
    try {
      const view = await this.request<MetadataView>(BASE + (id === undefined ? '' : `?id=${encodeURIComponent(id)}`), signal);
      if (epoch !== this.epoch) return;
      if (!Number.isSafeInteger(view.maxBatchSize) || !Object.hasOwn(view, 'entry')) throw new MetadataFailure('unavailable', 'Katalogstand nicht bestätigt.', 503);
      if (this.pending && this.pending.expectedAccountId !== view.account.userId) this.pending = null;
      this.update({ status: 'ready', view, uncertain: !!this.pending, busy: false, message: this.pending ? 'Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.' : '' });
    } catch (error) { if (epoch === this.epoch) this.update({ status: 'error', view: null, busy: false, message: error instanceof Error ? error.message : 'Katalog nicht verfügbar.' }); }
  }
  private ready(account: MetadataAccount): boolean {
    return this.state.status === 'ready' && !this.state.busy && !this.pending && sameMetadataAccount(account, this.state.view?.account ?? null);
  }
  async preview(records: MetadataReadFields[], account: MetadataAccount, legacy = false): Promise<MetadataPreview | null> {
    if (!this.ready(account)) return null;
    const { epoch, signal } = this.start(); this.update({ busy: true, preview: null, result: null, message: 'Vorschau wird geprüft …' });
    try {
      const value = await this.request<MetadataPreview>(`${BASE}/preview${legacy ? '?legacy=1' : ''}`, signal, { ...metadataContext(account), records, ...(legacy ? { action: 'legacy-import' } : {}) });
      if (epoch !== this.epoch) return null;
      if (value.action !== (legacy ? 'legacy-import' : undefined) || !sameMetadataAccount(account, value.account) || !Array.isArray(value.rows) || !Array.isArray(value.records) || !/^[0-9a-f]{64}$/.test(value.snapshot)) throw new MetadataFailure('account_changed', 'Anmeldung oder Vorschau hat sich geändert.', 409);
      this.update({ busy: false, preview: value, message: '' }); return value;
    } catch (error) { if (epoch === this.epoch) this.failure(error, false); return null; }
  }
  async import(preview: MetadataPreview): Promise<MetadataResult | null> {
    if (!this.ready(preview.account) || this.state.preview !== preview) return null;
    const base = { ...metadataContext(preview.account), requestId: crypto.randomUUID(), snapshot: preview.snapshot };
    return this.execute(preview.action === 'legacy-import' ? { ...base, action: 'legacy-import', records: structuredClone(preview.records) as LegacyMetadataFields[] } : { ...base, action: 'import', records: structuredClone(preview.records) as MetadataFields[] });
  }
  async patch(entry: MetadataEntry, fields: MetadataPatch, account: MetadataAccount): Promise<MetadataResult | null> {
    if (!this.ready(account)) return null;
    return this.execute({ ...metadataContext(account), action: 'patch', requestId: crypto.randomUUID(), id: entry.id, expectedRevision: entry.revision, expectedSnapshot: entry.snapshot, fields: structuredClone(fields) });
  }
  async delete(entry: MetadataEntry, account: MetadataAccount): Promise<MetadataResult | null> {
    if (!this.ready(account)) return null;
    return this.execute({ ...metadataContext(account), action: 'delete', requestId: crypto.randomUUID(), id: entry.id, expectedRevision: entry.revision, expectedSnapshot: entry.snapshot });
  }
  private failure(error: unknown, write: boolean) {
    const uncertain = write && (!(error instanceof MetadataFailure) || error.status >= 500);
    if (write && !uncertain) this.pending = null;
    // Rights and conflicts require a fresh confirmed view; never leave a stale edit enabled.
    this.update({ status: 'error', view: null, preview: null, result: null, busy: false, uncertain: write ? uncertain : !!this.pending, message: uncertain ? 'Speichern ist nicht bestätigt. Bitte Ergebnis prüfen.' : error instanceof Error ? error.message : 'Der Katalog ist nicht verfügbar.' });
  }
  private async execute(command: MetadataCommand): Promise<MetadataResult | null> {
    this.pending = command;
    const { epoch, signal } = this.start(); this.update({ busy: true, preview: null, result: null, message: 'Wird gespeichert …' });
    try {
      const value = await this.request<MetadataResult>(`${BASE}${command.action === 'legacy-import' ? '?legacy=1' : ''}`, signal, command);
      if (epoch !== this.epoch) return null;
      this.confirm(value, command); return value;
    } catch (error) { if (epoch === this.epoch) this.failure(error, true); return null; }
  }
  private confirm(value: MetadataResult, command: MetadataCommand) {
    if (value.requestId !== command.requestId || value.action !== command.action || !Array.isArray(value.rows) || !['committed', 'conflict'].includes(value.status) || !sameMetadataAccount(value.account, { userId: command.expectedAccountId, accessGeneration: command.expectedAccessGeneration, sessionContext: command.expectedSessionContext })) throw new MetadataFailure('unavailable', 'Speichern ist nicht bestätigt.', 503);
    this.pending = null;
    // A receipt is a historical outcome, never a replacement for the latest row.
    this.update({ status: 'ready', busy: false, uncertain: false, view: { contractVersion: 1, account: value.account, maxBatchSize: this.state.view?.maxBatchSize ?? METADATA_MAX_BATCH, entry: null }, preview: null, result: value, message: value.status === 'conflict' ? 'ID-Konflikt: Der gesamte Batch blieb unverändert.' : 'Gespeichert. Katalog neu laden.' });
  }
  /** Explicit recovery may follow sign-in; lookup is owner/admin checked first.
   * Only a confirmed missing receipt permits retry, with the same UUID/content. */
  async recover(): Promise<MetadataResult | null> {
    if (this.state.busy) return null;
    const pending = this.pending;
    await this.load();
    const a = this.state.view?.account;
    if (!pending || this.pending !== pending || !a || a.userId !== pending.expectedAccountId) return null;
    const command = { ...pending, ...metadataContext(a) };
    const { epoch, signal } = this.start(); this.update({ busy: true });
    try {
      const value = await this.request<MetadataResult>(`${BASE}?requestId=${encodeURIComponent(command.requestId)}`, signal);
      if (epoch !== this.epoch) return null;
      this.confirm(value, command); return value;
    } catch (error) {
      if (epoch !== this.epoch) return null;
      if (error instanceof MetadataFailure && error.status === 404) return this.execute(command);
      // A failed lookup says nothing about a previously sent mutation.
      this.update({ status: 'error', busy: false, view: null, preview: null, result: null, uncertain: true, message: error instanceof Error ? error.message : 'Ergebnis konnte nicht geprüft werden.' }); return null;
    }
  }
}
