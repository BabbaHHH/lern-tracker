import { createHash } from "node:crypto";
import type { AreaLayout, Comparison, DataRecord, ImportReceipt, JsonObject, JsonValue, LegacyBackup, MigrationContext, MigrationPlan, MigrationSnapshot, UndoToken } from "./contract";
import { BACKUP_AREAS, excludedArea } from "./inventory";
import { isObject, MigrationValidationError, validateBackup, validateReferences } from "./validation";

/** Object key ordering is irrelevant; list ordering and every payload value matter. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function digest(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
export function recordKey(kind: string, ownerUserId: string | null, id: string): string { return JSON.stringify([kind, ownerUserId, id]); }
function receiptKey(owner: string, requestId: string) { return JSON.stringify([owner, requestId]); }
export function emptySnapshot(): MigrationSnapshot { return { schemaVersion: 1, generation: 0, records: {}, documentVersions: {}, imports: {} }; }

/** In-process test adapter only. No database, browser storage, or access enforcement. */
export class MemoryMigrationStore {
  #state: MigrationSnapshot = emptySnapshot();
  snapshot(): MigrationSnapshot { return structuredClone(this.#state); }
  commit(expectedGeneration: number, next: MigrationSnapshot): void {
    if (this.#state.generation !== expectedGeneration) throw new Error("Revisionskonflikt: Testspeicher wurde seit der Vorschau verändert.");
    const copy = structuredClone(next);
    copy.generation = expectedGeneration + 1;
    this.#state = copy;
  }
  /** Used to simulate a competing edit; compare-and-swap on the record revision. */
  edit(key: string, value: JsonValue, expectedRevision: number): void {
    const next = this.snapshot();
    const previous = next.records[key];
    if (!previous || previous.revision !== expectedRevision) throw new Error("Datensatz-Revisionskonflikt.");
    if (previous.kind === "document") throw new Error("Dateiversionen sind unveränderlich; Dokumentaustausch benötigt neuen Versionsvertrag.");
    next.records[key] = { ...previous, value: structuredClone(value), revision: previous.revision + 1 };
    this.commit(next.generation, next);
  }
}

function decodeDocument(value: JsonObject, path: string): { bytes: Buffer; mediaType: string } {
  const match = typeof value.dataUrl === "string" ? value.dataUrl.match(/^data:([^;,]*);base64,([A-Za-z0-9+/]*={0,2})$/) : null;
  if (!match || match[2].length % 4 !== 0) throw new MigrationValidationError([{ code: "document-bytes", path, message: "Gültige Base64-Data-URL erforderlich." }]);
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.toString("base64") !== match[2] || bytes.byteLength !== value.size || (value.type && match[1] && match[1] !== value.type)) throw new MigrationValidationError([{ code: "document-bytes", path, message: "Dateibytes, Größe oder Medientyp widersprechen sich." }]);
  return { bytes, mediaType: match[1] || String(value.type) };
}

function projection(kind: string, id: string, ownerUserId: string | null, value: JsonValue) {
  if (kind === "catalog-extension") return { normalized: { klausurId: id } as JsonObject, version: null };
  if (kind === "klausur" && isObject(value)) return { normalized: {
    date: value.date === undefined || value.date === "" || value.date === null ? null : value.date,
    sourceReference: value.source, acceptanceMode: "legacy-preserved", contentCheck: "not-recorded",
  } as JsonObject, version: null };
  if (kind === "document" && isObject(value)) {
    const { bytes, mediaType } = decodeDocument(value, recordKey(kind, ownerUserId, id));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const documentVersionId = `dv:${digest([ownerUserId, id, sha256])}`;
    return { normalized: { documentId: id, documentVersionId, role: "unbekannt" } as JsonObject, version: {
      documentVersionId, documentId: id, ownerUserId, sha256, byteSize: bytes.byteLength,
      mediaType, pageCount: null, textStatus: "pending" as const, extractionVersion: null,
    } };
  }
  return { normalized: {} as JsonObject, version: null };
}

export function previewMigration(input: unknown, context: MigrationContext, target = emptySnapshot()): MigrationPlan {
  const backup = validateBackup(input, context);
  const plan: MigrationPlan = { contractVersion: 1, baseGeneration: target.generation, context: structuredClone(context), backup,
    sourceDigest: digest(backup.data), areas: [], records: {}, documentVersions: {}, changes: [], excluded: [], warnings: [], conflicts: [] };
  const inputData = (input as { data: JsonObject }).data;
  for (const key of Object.keys(inputData)) { const reason = excludedArea(key); if (reason) plan.excluded.push({ key, reason }); }
  function stage(key: string, record: DataRecord) {
    plan.records[key] = record;
    const existing = target.records[key];
    const same = existing && canonical({ ...existing, revision: 1 }) === canonical(record);
    const action = !existing ? "new" : same ? "unchanged" : "conflict";
    plan.changes.push({ key, action, expectedRevision: existing?.revision ?? null });
    if (action === "conflict") plan.conflicts.push({ code: "id-collision", path: key, message: "Bestehende ID hat abweichenden Inhalt; weder Überschreiben noch neue ID zulässig." });
  }
  const sharedExamFields = new Set(["id", "source", "date", "title", "area", "type", "topicIds", "createdAt", "updatedAt"]);
  for (const area of BACKUP_AREAS) {
    if (!Object.hasOwn(backup.data, area.key)) continue; // absent is distinct from empty/null
    const value = backup.data[area.key];
    const members: [string, JsonValue][] = area.shape === "list" ? (value as JsonObject[]).map(item => [String(item.id), item])
      : area.shape === "map" ? Object.entries(value as JsonObject) : [[area.key, value]];
    const layout: AreaLayout = { key: area.key, shape: area.shape, recordKeys: [] };
    for (const [id, member] of members) {
      const ownerUserId = area.ownership === "catalog" ? null : context.ownerUserId;
      const key = recordKey(area.kind, ownerUserId, id);
      const record: DataRecord = { kind: area.kind, id, ownerUserId, revision: 1, legacyKey: area.key, value: structuredClone(member), normalized: {} };
      if (area.kind === "klausur" && isObject(member)) {
        record.value = Object.fromEntries(Object.entries(member).filter(([field]) => sharedExamFields.has(field)));
        const extras = Object.fromEntries(Object.entries(member).filter(([field]) => !sharedExamFields.has(field)));
        if (Object.keys(extras).length) {
          const extensionKey = recordKey("catalog-extension", context.ownerUserId, id);
          stage(extensionKey, { kind: "catalog-extension", id, ownerUserId: context.ownerUserId, revision: 1,
            legacyKey: area.key, value: structuredClone(extras), normalized: { klausurId: id } });
          layout.extensionRecordKeys ??= {};
          layout.extensionRecordKeys[key] = extensionKey;
          plan.warnings.push({ code: "private-catalog-extension", path: key, message: "Zusatzfelder bleiben persönlich; gemeinsame Freigabe ist für diese Felder nicht festgelegt." });
        }
      }
      const projected = projection(area.kind, id, ownerUserId, record.value);
      record.normalized = projected.normalized;
      if (area.kind === "klausur" && isObject(member)) {
        if (record.normalized.date === null) plan.warnings.push({ code: "unknown-date", path: key, message: "Klausurdatum bleibt unbekannt; kein Ersatzdatum eingesetzt." });
      }
      if (projected.version) plan.documentVersions[projected.version.documentVersionId] = projected.version;
      stage(key, record);
      layout.recordKeys.push(key);
    }
    plan.areas.push(layout);
  }
  const available = { klausur: new Set<string>(), calendar: new Set<string>(), tracking: new Set<string>() };
  for (const record of [...Object.values(target.records), ...Object.values(plan.records)]) {
    if (record.kind === "klausur" && record.ownerUserId === null) available.klausur.add(record.id);
    if (record.ownerUserId !== context.ownerUserId) continue;
    if (record.kind === "calendar-event") available.calendar.add(record.id);
    if (record.kind === "tracking-entry") available.tracking.add(record.id);
  }
  validateReferences(backup, context, available);

  // Names are legacy hints, not authoritative IDs. Do not invent document links.
  const documentNames = new Map<string, number>();
  const addDocumentName = (name: string) => documentNames.set(name, (documentNames.get(name) ?? 0) + 1);
  const profile = backup.data["lerntracker-onboarding"];
  if (isObject(profile)) for (const [field, storageKey] of [["examDate", "lerntracker-exam-date"], ["lernstart", "lerntracker-lernstart"]]) {
    if (Object.hasOwn(profile, field) && Object.hasOwn(backup.data, storageKey) && profile[field] !== backup.data[storageKey]) plan.warnings.push({ code: "duplicated-setting-conflict", path: storageKey, message: "Profil und separater Datumsbereich weichen ab; beide Werte bleiben erhalten." });
  }
  if (isObject(profile) && Array.isArray(profile.documents)) for (const doc of profile.documents) if (isObject(doc) && typeof doc.name === "string") addDocumentName(doc.name);
  for (const record of Object.values(plan.records)) if (record.kind === "document" && isObject(record.value) && typeof record.value.name === "string") addDocumentName(record.value.name);
  function sourceHints(value: JsonValue, path: string): void {
    if (Array.isArray(value)) value.forEach((item, index) => sourceHints(item, `${path}[${index}]`));
    else if (isObject(value)) for (const [key, item] of Object.entries(value)) {
      if (key === "sourceDocument" && (typeof item !== "string" || documentNames.get(item) !== 1)) plan.warnings.push({ code: "unresolved-source-name", path, message: "Historischer Quellname ist nicht eindeutig als Dokument-ID belegt; unverändert erhalten." });
      sourceHints(item, `${path}.${key}`);
    }
  }
  sourceHints(backup.data, "backup.data");
  const sources = new Map<string, string>();
  const checksums = new Map<string, string>();
  for (const record of [...Object.values(target.records), ...Object.values(plan.records)]) {
    if (record.kind !== "klausur" || !isObject(record.value) || typeof record.value.source !== "string" || !record.value.source) continue;
    const previous = sources.get(record.value.source);
    if (previous && previous !== record.id) plan.warnings.push({ code: "duplicate-candidate", path: recordKey(record.kind, record.ownerUserId, record.id), message: "Gleiche Quellkennung bei verschiedenen IDs; Kandidat erhalten, nicht zusammengeführt." });
    sources.set(record.value.source, record.id);
  }
  for (const version of Object.values(plan.documentVersions)) {
    const previous = checksums.get(version.sha256);
    if (previous && previous !== version.documentId) plan.warnings.push({ code: "identical-bytes", path: version.documentVersionId, message: "Identische Dateibytes in getrennten Dokumenten; Besitz und IDs bleiben getrennt." });
    checksums.set(version.sha256, version.documentId);
  }
  return plan;
}

/** Reconstruct each imported section from current records, retaining order and blanks. */
export function exportLegacy(snapshot: MigrationSnapshot, receipt: ImportReceipt): LegacyBackup {
  const data: JsonObject = {};
  for (const area of receipt.areas) {
    const records = area.recordKeys.map(key => {
      const record = snapshot.records[key];
      if (!record || record.legacyKey !== area.key || record.ownerUserId !== (record.kind === "klausur" ? null : receipt.ownerUserId)) throw new Error("Rückexport: Datensatz oder Eigentümerzuordnung fehlt.");
      return record;
    });
    if (area.shape === "list") data[area.key] = records.map((record, index) => {
      const extensionKey = area.extensionRecordKeys?.[area.recordKeys[index]];
      if (!extensionKey) return structuredClone(record.value);
      const extension = snapshot.records[extensionKey];
      if (!extension || extension.ownerUserId !== receipt.ownerUserId || extension.kind !== "catalog-extension"
        || extension.id !== record.id || !isObject(extension.value) || !isObject(record.value)
        || Object.keys(extension.value).some(key => Object.hasOwn(record.value as JsonObject, key))) throw new Error("Rückexport: persönliche Klausurzusatzfelder sind widersprüchlich.");
      return structuredClone({ ...record.value, ...extension.value });
    });
    else if (area.shape === "map") data[area.key] = Object.fromEntries(records.map(record => [record.id, structuredClone(record.value)]));
    else {
      if (records.length !== 1) throw new Error("Rückexport: Einzelbereich ist unvollständig.");
      data[area.key] = structuredClone(records[0].value);
    }
  }
  return { version: 1, exportedAt: receipt.exportedAt, data };
}
export function compareMigration(source: LegacyBackup, snapshot: MigrationSnapshot, receipt: ImportReceipt): Comparison {
  const restored = exportLegacy(snapshot, receipt);
  const differences = [...new Set([...Object.keys(source.data), ...Object.keys(restored.data)])]
    .filter(key => canonical(source.data[key]) !== canonical(restored.data[key]));
  if (source.exportedAt !== restored.exportedAt) differences.push("exportedAt");
  for (const area of receipt.areas) for (const key of [...area.recordKeys, ...Object.values(area.extensionRecordKeys ?? {})]) {
    const record = snapshot.records[key];
    if (key !== recordKey(record.kind, record.ownerUserId, record.id)
      || canonical(record.normalized) !== canonical(projection(record.kind, record.id, record.ownerUserId, record.value).normalized)) differences.push(`record-projection:${key}`);
  }
  for (const versionId of receipt.documentVersionIds) {
    const version = snapshot.documentVersions[versionId];
    const doc = version && snapshot.records[recordKey("document", version.ownerUserId, version.documentId)];
    if (!version || !doc || !isObject(doc.value)) { differences.push(`document-version:${versionId}`); continue; }
    const { bytes, mediaType } = decodeDocument(doc.value, doc.id);
    if (version.sha256 !== createHash("sha256").update(bytes).digest("hex") || version.byteSize !== bytes.byteLength || version.mediaType !== mediaType || doc.normalized.documentVersionId !== versionId) differences.push(`document-version:${versionId}`);
  }
  return { equal: differences.length === 0, areaCount: Object.keys(source.data).length,
    recordCount: Object.keys(receipt.recordRevisions).length, differences };
}

export interface ApplyOptions { signal?: AbortSignal; beforeRecord?: (index: number) => void }
/** Pure staging shared by the test adapter and the transactional PostgreSQL adapter. */
export function prepareMigration(before: MigrationSnapshot, plan: MigrationPlan, requestId: string, options: ApplyOptions = {}): { next: MigrationSnapshot; receipt: ImportReceipt; comparison: Comparison; replay: boolean } {
  if (!requestId.trim()) throw new Error("Vorgangs-ID erforderlich.");
  const checkAbort = () => { if (options.signal?.aborted) throw new Error("Migration abgebrochen; Testspeicher bleibt unverändert."); };
  checkAbort();
  // Revalidate the held backup and recompute preview, so a modified preview cannot write.
  const fresh = previewMigration(plan.backup, plan.context, before);
  if (fresh.sourceDigest !== plan.sourceDigest) throw new Error("Vorschau verändert; neue Vorschau erforderlich.");
  const key = receiptKey(plan.context.ownerUserId, requestId);
  const previous = before.imports[key];
  if (previous) {
    if (previous.sourceDigest !== plan.sourceDigest) throw new Error("Vorgangs-ID wurde für andere Quelldaten verwendet.");
    if (Object.entries(previous.recordRevisions).some(([recordId, revision]) => before.records[recordId]?.revision !== revision)) throw new Error("Wiederholung trifft inzwischen geänderte Datenrevisionen; Konflikt statt Überschreiben.");
    const comparison = compareMigration(plan.backup, before, previous);
    if (!comparison.equal) throw new Error("Wiederholung trifft inzwischen geänderte Daten; Konflikt statt Überschreiben.");
    return { next: before, receipt: structuredClone(previous), comparison, replay: true };
  }
  if (before.generation !== plan.baseGeneration) throw new Error("Revisionskonflikt: neue Vorschau erforderlich.");
  // Excluded cache payloads are absent from fresh; they never affect the write plan.
  const comparable = (p: MigrationPlan) => ({ records: p.records, documentVersions: p.documentVersions, areas: p.areas, changes: p.changes, context: p.context });
  if (canonical(comparable(fresh)) !== canonical(comparable(plan))) throw new Error("Vorschau verändert; neue Vorschau erforderlich.");
  if (fresh.conflicts.length) throw new MigrationValidationError(fresh.conflicts);
  const next = structuredClone(before);
  const receipt: ImportReceipt = { requestId, ownerUserId: plan.context.ownerUserId, sourceDigest: plan.sourceDigest,
    exportedAt: plan.backup.exportedAt, areas: structuredClone(fresh.areas), recordRevisions: {}, documentVersionIds: Object.keys(fresh.documentVersions) };
  fresh.changes.forEach((change, index) => {
    checkAbort(); options.beforeRecord?.(index); checkAbort();
    if (change.action === "new") next.records[change.key] = structuredClone(fresh.records[change.key]);
    receipt.recordRevisions[change.key] = next.records[change.key].revision;
  });
  for (const [id, version] of Object.entries(fresh.documentVersions)) {
    const previous = next.documentVersions[id];
    const identity = (v: typeof version) => ({ documentVersionId:v.documentVersionId,documentId:v.documentId,ownerUserId:v.ownerUserId,sha256:v.sha256,byteSize:v.byteSize,mediaType:v.mediaType });
    if (previous && canonical(identity(previous)) !== canonical(identity(version))) throw new Error("Unveränderliche Dateiversion hat widersprüchliche Metadaten.");
    // Extraction state can advance later; a legacy reimport must not reset it to pending.
    next.documentVersions[id] = structuredClone(previous ?? version);
  }
  next.imports[key] = receipt;
  const comparison = compareMigration(plan.backup, next, receipt);
  if (!comparison.equal) throw new Error("Inhaltsvergleich fehlgeschlagen; keine Übernahme.");
  checkAbort();
  return { next, receipt: structuredClone(receipt), comparison, replay: false };
}
export function applyMigration(store: MemoryMigrationStore, plan: MigrationPlan, requestId: string, options: ApplyOptions = {}): { receipt: ImportReceipt; comparison: Comparison; replay: boolean; undo: UndoToken | null } {
  const before = store.snapshot();
  const result = prepareMigration(before, plan, requestId, options);
  if (result.replay) return { receipt: result.receipt, comparison: result.comparison, replay: true, undo: null };
  store.commit(plan.baseGeneration, result.next);
  const after = store.snapshot();
  return { receipt: result.receipt, comparison: result.comparison, replay: false,
    undo: { before, afterGeneration: after.generation, afterDigest: digest(after) } };
}
export function rollbackMigration(store: MemoryMigrationStore, token: UndoToken): void {
  const current = store.snapshot();
  if (current.generation !== token.afterGeneration || digest(current) !== token.afterDigest) throw new Error("Rücksetzen würde spätere Änderungen überschreiben; Konflikt.");
  store.commit(current.generation, token.before);
}
