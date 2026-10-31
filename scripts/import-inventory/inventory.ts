import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";

export const INVENTORY_SCHEMA_VERSION = "IMPORT-01/inventory-v1";

export type SourceKind =
  | "reference-json"
  | "klausuren-komplett"
  | "klausuren-komplett-copy"
  | "hamburg"
  | "kg-merged"
  | "kg-loose"
  | "kg-raw"
  | "other-collection"
  | "kg-manifest";

export type DocumentRole =
  | "sachverhalt"
  | "loesung"
  | "kombiniert"
  | "info"
  | "metadaten"
  | "manifest"
  | "unbekannt";

export type TextStatus = "not-requested" | "extracted" | "unavailable" | "failed" | "skipped-size";

export interface InventoryOptions {
  /** Extract PDF text for duplicate candidates. Defaults to no extraction for library callers. */
  extractText?: "none" | "selected" | "all";
  /** Maximum PDF size for text extraction. */
  maxTextBytes?: number;
  /** Number of first PDF pages used for a stable text probe. */
  textPages?: number;
  /** Allow callers/tests to provide a deterministic text extractor. */
  extractPdfText?: (absolutePath: string, pages: number) => { text: string; status?: TextStatus };
}

export interface MetadataRecord {
  metadataRecordId: string;
  originFileId: string;
  originRelativePath: string;
  recordIndex: number;
  sourceKind: SourceKind;
  klausurId?: string;
  sourceReference?: string;
  title?: string;
  date?: string;
  area?: string;
  type?: string;
  topicIds: string[];
  modelVersion?: string;
  sourceKey: string;
  signature: string;
}

export interface ManifestFile {
  sourceFileId?: string;
  label: string;
  role: DocumentRole;
}

export interface ManifestRecord {
  manifestRecordId: string;
  sourceKind: "kg-manifest";
  originFileId: string;
  recordIndex: number;
  sourceReference?: string;
  section: string;
  files: ManifestFile[];
  caseKey: string;
}

export interface InventoryFile {
  inventoryId: string;
  relativePath: string;
  sourceKind: SourceKind;
  extension: string;
  mediaType: "pdf" | "json" | "other";
  documentRole: DocumentRole;
  sizeBytes: number;
  sha256: string;
  caseKey: string;
  sourceReference?: string;
  metadataRecordCount?: number;
  text: {
    status: TextStatus;
    chars?: number;
    textHash?: string;
    prefixHash?: string;
  };
}

export interface ExactDuplicateGroup {
  sha256: string;
  inventoryIds: string[];
  relativePaths: string[];
  sourceKinds: SourceKind[];
  documentRoles: DocumentRole[];
}

export type CaseGroupClassification =
  | "sicher_identisch"
  | "versionskandidat"
  | "ergaenzte_loesung"
  | "gleiche_kennzeichnung"
  | "einzelbeobachtung";

export interface CaseGroup {
  caseKey: string;
  fileIds: string[];
  metadataRecordIds: string[];
  classifications: CaseGroupClassification[];
  notes: string[];
}

export interface IdGroup {
  klausurId: string;
  metadataRecordIds: string[];
  signatures: string[];
  sources: string[];
  classification: "identitaet_bestaetigt" | "widerspruch_pruefen";
  differences: string[];
}

export interface TextMatchGroup {
  probeHash: string;
  inventoryIds: string[];
  relativePaths: string[];
  caseKeys: string[];
  classification: "textprobe_gleich";
}

export interface SourceSummary {
  sourceKind: SourceKind;
  files: number;
  pdfs: number;
  jsons: number;
  metadataRecords: number;
  distinctKlausurIds: number;
  distinctCaseKeys: number;
}

export interface ExcludedArtifact {
  relativePath: string;
  reason: string;
}

export interface InventoryReport {
  schemaVersion: typeof INVENTORY_SCHEMA_VERSION;
  rootLabel: string;
  files: InventoryFile[];
  metadataRecords: MetadataRecord[];
  manifestRecords: ManifestRecord[];
  exactDuplicateGroups: ExactDuplicateGroup[];
  textMatchGroups: TextMatchGroup[];
  caseGroups: CaseGroup[];
  idGroups: IdGroup[];
  unmatchedMetadataRecordIds: string[];
  unmatchedPdfInventoryIds: string[];
  excludedArtifacts: ExcludedArtifact[];
  sourceSummary: SourceSummary[];
}

interface SourceSpec {
  kind: SourceKind;
  relativePath: string;
  mode: "file" | "directory";
  includeExtensions?: Set<string>;
  excludeDirectoryNames?: Set<string>;
}

interface FileContext {
  absolutePath: string;
  relativePath: string;
  sourceKind: SourceKind;
}

const PDF_EXTENSIONS = new Set([".pdf"]);
const JSON_EXTENSIONS = new Set([".json"]);
const DEFAULT_MAX_TEXT_BYTES = 30 * 1024 * 1024;
const DEFAULT_TEXT_PAGES = 3;

function sourceSpecs(): SourceSpec[] {
  const pdfJson = new Set([".pdf", ".json"]);
  const pdfOnly = new Set([".pdf"]);
  const jsonOnly = new Set([".json"]);
  return [
    { kind: "reference-json", relativePath: "Lernplan Dokumente/klausuren_clean.json", mode: "file", includeExtensions: jsonOnly },
    { kind: "klausuren-komplett", relativePath: "Klausuren_Komplett", mode: "directory", includeExtensions: pdfJson, excludeDirectoryNames: new Set(["Bücher Kopie", "NotebookLM_Chunks"]) },
    { kind: "klausuren-komplett-copy", relativePath: "Klausuren_Komplett Kopie", mode: "directory", includeExtensions: pdfOnly, excludeDirectoryNames: new Set(["Bücher Kopie"]) },
    { kind: "hamburg", relativePath: "Hamburg Sachverhalte und mal Lösungsskizzen/2_Solitaere_Dateien", mode: "directory", includeExtensions: pdfJson },
    { kind: "kg-merged", relativePath: "Klausuren KG/Sonstiges/merged", mode: "directory", includeExtensions: pdfJson },
    { kind: "kg-manifest", relativePath: "Klausuren KG/Archiv_Pipeline/klausuren.json", mode: "file", includeExtensions: jsonOnly },
    { kind: "kg-raw", relativePath: "Klausuren KG/Archiv_Pipeline/01_raw", mode: "directory", includeExtensions: pdfOnly },
    { kind: "kg-loose", relativePath: "Klausuren KG/Sonstiges/Klausuren", mode: "directory", includeExtensions: pdfOnly },
    { kind: "kg-loose", relativePath: "Klausuren KG/Sonstiges/Loesungen", mode: "directory", includeExtensions: pdfOnly },
    { kind: "other-collection", relativePath: "examensgerecht_pdfs_neu", mode: "directory", includeExtensions: pdfOnly },
    { kind: "other-collection", relativePath: "Musterklausuren HH + einsame dateien", mode: "directory", includeExtensions: pdfOnly },
  ];
}

function toPosix(value: string): string {
  return value.split(sep).join("/");
}

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizedPathComponent(value: string): string {
  return stripDiacritics(value).toLocaleLowerCase("de-DE");
}

export function normalizeText(value: string): string {
  return stripDiacritics(value)
    .toLocaleLowerCase("de-DE")
    .replace(/\u00ad/g, "")
    .replace(/\r?\n/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Produces a filename/source key. It deliberately removes presentation suffixes
 * such as `_komplett` and `inkl_Loesung`, but keeps the substantive identifier.
 */
export function caseKey(value: string): string {
  const key = stripDiacritics(value)
    .toLocaleLowerCase("de-DE")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\(\s*\d+\s*pkt[^)]*\)/gi, "")
    .replace(/(?:^|[ _-])inkl(?:usive)?[ _-]*(?:loesung|losung|solution)\b/gi, " ")
    .replace(/(?:^|[ _-])(?:komplett|complete|combined|kombiniert)(?=$|[^a-z0-9])/gi, " ")
    .replace(/(?:^|[ _-])(?:aufgabe|sachverhalt|solution|loesung|losung|besprechung)(?:[ _-]*(?:pdf)?[ _-]*datei)?(?=$|[^a-z0-9])/gi, " ")
    .replace(/\b(?:pdf|datei)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return key;
}

export function inferDocumentRole(fileName: string, sourceKind?: SourceKind): DocumentRole {
  const lower = stripDiacritics(fileName).toLocaleLowerCase("de-DE");
  if (sourceKind === "kg-manifest") return "manifest";
  if (lower.endsWith(".json")) return "metadaten";
  if (/bucher kopie|notebooklm_chunks|klausuren_chunk/.test(lower)) return "unbekannt";
  if (/info|hinweis|zeittafel|kalender|anhang/.test(lower)) return "info";
  if (/combined/.test(lower) && /keine[^a-z0-9]+(?:og[^a-z0-9]+)?(?:loesung|losung)/.test(lower)) return "sachverhalt";
  if (/(?:inkl|mit|plus)[ _-]*(?:loesung|losung|solution)|(?:^|[_ -])komplett\b/.test(lower)) return "kombiniert";
  if (/loesung|losung|solution|besprechung|musterloesung|gutachten|anklageschrift/.test(lower)) return "loesung";
  if (/aufgabe|sachverhalt|(?:^|[_ -])sv(?:[_ .-]|$)|(?:^|[_ -])data(?:[_ .-]|$)|combined|klausur/.test(lower)) return "sachverhalt";
  return "unbekannt";
}

function sha256Bytes(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function inventoryId(sourceKind: SourceKind, relativePath: string): string {
  return `inv-${sha256Text(`${sourceKind}\0${relativePath}`).slice(0, 20)}`;
}

function metadataId(originFileId: string, index: number): string {
  return `meta-${originFileId.slice(4, 16)}-${index + 1}`;
}

function readFilesRecursively(root: string, spec: SourceSpec): FileContext[] {
  const start = resolve(root, spec.relativePath);
  if (!statExists(start)) return [];
  if (spec.mode === "file") {
    return [{ absolutePath: start, relativePath: toPosix(spec.relativePath), sourceKind: spec.kind }];
  }
  const result: FileContext[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "de"))) {
      if (
        entry.name.startsWith(".")
        || [...(spec.excludeDirectoryNames ?? [])].some(name => normalizedPathComponent(name) === normalizedPathComponent(entry.name))
      ) continue;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) {
        const extension = extname(entry.name).toLocaleLowerCase("de-DE");
        if (!spec.includeExtensions || spec.includeExtensions.has(extension)) {
          result.push({ absolutePath, relativePath: toPosix(relative(root, absolutePath)), sourceKind: spec.kind });
        }
      }
    }
  };
  visit(start);
  return result;
}

function statExists(pathName: string): boolean {
  try {
    return statSync(pathName).isFile() || statSync(pathName).isDirectory();
  } catch {
    return false;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function topicValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(item => item.trim()))].sort();
}

function metadataSignature(record: Omit<MetadataRecord, "metadataRecordId" | "originFileId" | "originRelativePath" | "recordIndex" | "sourceKind" | "signature">): string {
  return JSON.stringify({
    sourceReference: record.sourceReference ?? null,
    title: record.title ?? null,
    date: record.date ?? null,
    area: record.area ?? null,
    type: record.type ?? null,
    topicIds: record.topicIds,
  });
}

function parseMetadataRecords(file: InventoryFile, absolutePath: string): MetadataRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return [];
  }
  const values = Array.isArray(parsed) ? parsed : [parsed];
  const result: MetadataRecord[] = [];
  values.forEach((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const raw = value as Record<string, unknown>;
    if (!stringValue(raw.id) && !stringValue(raw.source) && !stringValue(raw.title)) return;
    const base = {
      originFileId: file.inventoryId,
      originRelativePath: file.relativePath,
      recordIndex: index,
      sourceKind: file.sourceKind,
      klausurId: stringValue(raw.id),
      sourceReference: stringValue(raw.source),
      title: stringValue(raw.title),
      date: stringValue(raw.date),
      area: stringValue(raw.area),
      type: stringValue(raw.type),
      topicIds: topicValues(raw.topicIds),
      modelVersion: stringValue(raw.model_version),
      sourceKey: caseKey(stringValue(raw.source) ?? stringValue(raw.title) ?? `record-${index + 1}`),
    } satisfies Omit<MetadataRecord, "metadataRecordId" | "signature">;
    result.push({
      metadataRecordId: metadataId(file.inventoryId, index),
      ...base,
      signature: metadataSignature(base),
    });
  });
  return result;
}

function parseManifestRecords(file: InventoryFile, absolutePath: string): ManifestRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const raw = value as Record<string, unknown>;
    const section = stringValue(raw.klausur) ?? stringValue(raw.section_raw);
    if (!section) return [];
    const rawFiles = Array.isArray(raw.files) ? raw.files : [];
    const files = rawFiles.flatMap(item => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const candidate = item as Record<string, unknown>;
      const label = stringValue(candidate.label);
      if (!label) return [];
      return [{ sourceFileId: stringValue(candidate.id), label, role: inferDocumentRole(label) }];
    });
    return [{
      manifestRecordId: `manifest-${file.inventoryId.slice(4, 16)}-${index + 1}`,
      sourceKind: "kg-manifest" as const,
      originFileId: file.inventoryId,
      recordIndex: index,
      section,
      sourceReference: stringValue(raw.section_raw),
      files,
      caseKey: caseKey(section),
    }];
  });
}

function extractPdfTextDefault(absolutePath: string, pages: number): { text: string; status: TextStatus } {
  try {
    const text = execFileSync("pdftotext", ["-f", "1", "-l", String(pages), "-layout", absolutePath, "-"], {
      encoding: "utf8",
      maxBuffer: 12 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { text, status: "extracted" };
  } catch {
    return { text: "", status: "failed" };
  }
}

function textFingerprint(text: string): InventoryFile["text"] {
  const normalized = normalizeText(text);
  if (!normalized) return { status: "extracted", chars: 0 };
  return {
    status: "extracted",
    chars: normalized.length,
    textHash: sha256Text(normalized),
    prefixHash: sha256Text(normalized.slice(0, 1800)),
  };
}

function shouldExtract(file: FileContext, sizeBytes: number, options: InventoryOptions): boolean {
  if (options.extractText === "none" || !options.extractText) return false;
  if (options.extractText === "all") return true;
  if (file.sourceKind === "klausuren-komplett" || file.sourceKind === "klausuren-komplett-copy" || file.sourceKind === "hamburg" || file.sourceKind === "kg-merged") return true;
  return sizeBytes <= (options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES);
}

function fileEntry(context: FileContext, root: string, options: InventoryOptions): InventoryFile {
  const extension = extname(context.absolutePath).toLocaleLowerCase("de-DE");
  const mediaType: InventoryFile["mediaType"] = PDF_EXTENSIONS.has(extension) ? "pdf" : JSON_EXTENSIONS.has(extension) ? "json" : "other";
  const stat = statSync(context.absolutePath);
  const bytes = readFileSync(context.absolutePath);
  const id = inventoryId(context.sourceKind, context.relativePath);
  const role = inferDocumentRole(basename(context.absolutePath), context.sourceKind);
  const result: InventoryFile = {
    inventoryId: id,
    relativePath: context.relativePath,
    sourceKind: context.sourceKind,
    extension,
    mediaType,
    documentRole: role,
    sizeBytes: stat.size,
    sha256: sha256Bytes(bytes),
    caseKey: caseKey(basename(context.absolutePath)),
    text: { status: "not-requested" },
  };
  if (mediaType === "pdf" && shouldExtract(context, stat.size, options)) {
    if (stat.size > (options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES)) {
      result.text = { status: "skipped-size" };
    } else {
      const extraction = (options.extractPdfText ?? extractPdfTextDefault)(context.absolutePath, options.textPages ?? DEFAULT_TEXT_PAGES);
      result.text = extraction.status === "extracted" ? textFingerprint(extraction.text) : { status: extraction.status ?? "failed" };
    }
  }
  return result;
}

function exactDuplicateGroups(files: InventoryFile[]): ExactDuplicateGroup[] {
  const groups = new Map<string, InventoryFile[]>();
  for (const file of files) {
    if (file.mediaType !== "pdf") continue;
    const group = groups.get(file.sha256) ?? [];
    group.push(file);
    groups.set(file.sha256, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([sha256, group]) => ({
      sha256,
      inventoryIds: group.map(file => file.inventoryId).sort(),
      relativePaths: group.map(file => file.relativePath).sort(),
      sourceKinds: [...new Set(group.map(file => file.sourceKind))].sort(),
      documentRoles: [...new Set(group.map(file => file.documentRole))].sort(),
    }))
    .sort((a, b) => a.sha256.localeCompare(b.sha256));
}

function textMatchGroups(files: InventoryFile[]): TextMatchGroup[] {
  const groups = new Map<string, InventoryFile[]>();
  for (const file of files) {
    if (file.mediaType !== "pdf" || file.text.status !== "extracted" || !file.text.textHash) continue;
    const group = groups.get(file.text.textHash) ?? [];
    group.push(file);
    groups.set(file.text.textHash, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([probeHash, group]) => ({
      probeHash,
      inventoryIds: group.map(file => file.inventoryId).sort(),
      relativePaths: group.map(file => file.relativePath).sort(),
      caseKeys: [...new Set(group.map(file => file.caseKey))].sort(),
      classification: "textprobe_gleich" as const,
    }))
    .sort((a, b) => a.relativePaths[0].localeCompare(b.relativePaths[0], "de"));
}

function caseGroups(files: InventoryFile[], metadata: MetadataRecord[]): CaseGroup[] {
  const groups = new Map<string, { files: InventoryFile[]; metadata: MetadataRecord[] }>();
  for (const file of files) {
    if (file.mediaType !== "pdf" || !file.caseKey) continue;
    const group = groups.get(file.caseKey) ?? { files: [], metadata: [] };
    group.files.push(file);
    groups.set(file.caseKey, group);
  }
  for (const record of metadata) {
    if (!record.sourceKey) continue;
    const group = groups.get(record.sourceKey) ?? { files: [], metadata: [] };
    group.metadata.push(record);
    groups.set(record.sourceKey, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const roles = new Set(group.files.map(file => file.documentRole));
      const hashes = new Set(group.files.map(file => file.sha256));
      const classifications: CaseGroupClassification[] = [];
      const notes: string[] = [];
      if (group.files.length === 1 && group.metadata.length <= 1) classifications.push("einzelbeobachtung");
      if (group.files.length > 1 && hashes.size === 1) classifications.push("sicher_identisch");
      if (group.files.length > 1 && hashes.size > 1) classifications.push("versionskandidat");
      if (roles.has("loesung") && roles.size > 1) {
        classifications.push("ergaenzte_loesung");
        notes.push("Sachverhalt und separate Lösung teilen eine normalisierte Fallkennung; nicht automatisch zusammenführen.");
      }
      if (group.metadata.length > 1 && new Set(group.metadata.map(record => record.signature)).size === 1) classifications.push("gleiche_kennzeichnung");
      if (classifications.length === 0) classifications.push("einzelbeobachtung");
      return {
        caseKey: key,
        fileIds: group.files.map(file => file.inventoryId).sort(),
        metadataRecordIds: group.metadata.map(record => record.metadataRecordId).sort(),
        classifications: [...new Set(classifications)],
        notes,
      };
    })
    .sort((a, b) => a.caseKey.localeCompare(b.caseKey));
}

function idGroups(metadata: MetadataRecord[]): IdGroup[] {
  const groups = new Map<string, MetadataRecord[]>();
  for (const record of metadata) {
    if (!record.klausurId) continue;
    const group = groups.get(record.klausurId) ?? [];
    group.push(record);
    groups.set(record.klausurId, group);
  }
  return [...groups.entries()]
    .map(([klausurId, group]) => {
      const signatures = [...new Set(group.map(record => record.signature))].sort();
      const differences: string[] = [];
      const fields: Array<[keyof MetadataRecord, string]> = [["sourceReference", "Quelle"], ["title", "Titel"], ["date", "Datum"], ["area", "Gebiet"], ["type", "Typ"]];
      for (const [field, label] of fields) {
        if (new Set(group.map(record => record[field] ?? "")).size > 1) differences.push(label);
      }
      if (new Set(group.map(record => record.topicIds.join("\u0000"))).size > 1) differences.push("Themenkennungen");
      return {
        klausurId,
        metadataRecordIds: group.map(record => record.metadataRecordId).sort(),
        signatures,
        sources: [...new Set(group.map(record => record.sourceReference).filter((value): value is string => Boolean(value)))].sort(),
        classification: signatures.length > 1 ? "widerspruch_pruefen" as const : "identitaet_bestaetigt" as const,
        differences,
      };
    })
    .sort((a, b) => a.klausurId.localeCompare(b.klausurId));
}

function sourceSummary(files: InventoryFile[], metadata: MetadataRecord[]): SourceSummary[] {
  const kinds = [...new Set([...files.map(file => file.sourceKind), ...metadata.map(record => record.sourceKind)])].sort();
  return kinds.map(sourceKind => {
    const ownFiles = files.filter(file => file.sourceKind === sourceKind);
    const ownMetadata = metadata.filter(record => record.sourceKind === sourceKind);
    return {
      sourceKind,
      files: ownFiles.length,
      pdfs: ownFiles.filter(file => file.mediaType === "pdf").length,
      jsons: ownFiles.filter(file => file.mediaType === "json").length,
      metadataRecords: ownMetadata.length,
      distinctKlausurIds: new Set(ownMetadata.map(record => record.klausurId).filter(Boolean)).size,
      distinctCaseKeys: new Set([
        ...ownFiles.filter(file => file.mediaType === "pdf").map(file => file.caseKey),
        ...ownMetadata.map(record => record.sourceKey),
      ].filter(Boolean)).size,
    };
  });
}

function excludedArtifacts(root: string): ExcludedArtifact[] {
  const candidates = [
    ["Lernplan Dokumente/all_klausuren_bundle.json", "gemischtes Bundle mit Projekt-/Abhängigkeitsdaten; nicht als Klausurmetadaten zählen"],
    ["Klausuren_Komplett/Bücher Kopie", "Referenzliteratur, keine Klausurdateien"],
    ["Klausuren_Komplett/NotebookLM_Chunks", "abgeleitete Container-Chunks, keine eigenständigen Klausuren"],
  ] as const;
  return candidates.filter(([pathName]) => statExists(join(root, pathName))).map(([relativePath, reason]) => ({ relativePath, reason }));
}

export function buildInventory(rootDirectory: string, options: InventoryOptions = {}): InventoryReport {
  const root = resolve(rootDirectory);
  const contexts = sourceSpecs().flatMap(spec => readFilesRecursively(root, spec));
  const uniqueContexts = [...new Map(contexts.map(context => [`${context.sourceKind}\0${context.relativePath}`, context])).values()]
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, "de") || a.sourceKind.localeCompare(b.sourceKind));
  const files = uniqueContexts.map(context => fileEntry(context, root, options));
  const metadataRecords = files.flatMap(file => file.mediaType === "json" && file.sourceKind !== "kg-manifest" ? parseMetadataRecords(file, join(root, file.relativePath)) : []);
  const manifestRecords = files.flatMap(file => file.sourceKind === "kg-manifest" ? parseManifestRecords(file, join(root, file.relativePath)) : []);
  for (const file of files) {
    const count = metadataRecords.filter(record => record.originFileId === file.inventoryId).length;
    if (count) file.metadataRecordCount = count;
  }
  const exact = exactDuplicateGroups(files);
  const textMatches = textMatchGroups(files);
  const cases = caseGroups(files, metadataRecords);
  const ids = idGroups(metadataRecords);
  const matchedCaseKeys = new Set(cases.filter(group => group.fileIds.length > 0 && group.metadataRecordIds.length > 0).map(group => group.caseKey));
  const unmatchedMetadataRecordIds = metadataRecords.filter(record => !matchedCaseKeys.has(record.sourceKey)).map(record => record.metadataRecordId).sort();
  const unmatchedPdfInventoryIds = files.filter(file => file.mediaType === "pdf" && file.caseKey && !matchedCaseKeys.has(file.caseKey)).map(file => file.inventoryId).sort();
  return {
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    rootLabel: "Stex. Countdown",
    files,
    metadataRecords,
    manifestRecords,
    exactDuplicateGroups: exact,
    textMatchGroups: textMatches,
    caseGroups: cases,
    idGroups: ids,
    unmatchedMetadataRecordIds,
    unmatchedPdfInventoryIds,
    excludedArtifacts: excludedArtifacts(root),
    sourceSummary: sourceSummary(files, metadataRecords),
  };
}

export function renderInventorySummary(report: InventoryReport): string {
  const sourceRows = report.sourceSummary.map(row => `| ${row.sourceKind} | ${row.files} | ${row.pdfs} | ${row.jsons} | ${row.metadataRecords} | ${row.distinctKlausurIds} |`).join("\n");
  const exactExamples = report.exactDuplicateGroups.slice(0, 3).map(group => `- ${group.relativePaths.slice(0, 3).join(" ↔ ")} (SHA-256 ${group.sha256.slice(0, 16)}…)`).join("\n") || "- keine";
  const versionExamples = report.caseGroups.filter(group => group.classifications.includes("versionskandidat")).slice(0, 3).map(group => `- ${group.caseKey} (${group.fileIds.length} Dateien)`).join("\n") || "- keine";
  const solutionExamples = report.caseGroups.filter(group => group.classifications.includes("ergaenzte_loesung")).slice(0, 3).map(group => `- ${group.caseKey} (${group.fileIds.length} Dateien)`).join("\n") || "- keine";
  const conflictExamples = report.idGroups.filter(group => group.classification === "widerspruch_pruefen").slice(0, 5).map(group => `- ${group.klausurId}: ${group.differences.join(", ")}`).join("\n") || "- keine";
  const textExamples = report.textMatchGroups.slice(0, 5).map(group => `- ${group.relativePaths.slice(0, 3).join(" ↔ ")} (Fallkennungen: ${group.caseKeys.slice(0, 3).join(", ")})`).join("\n") || "- keine";
  const extractedCount = report.files.filter(file => file.text.status === "extracted").length;
  return [
    "# IMPORT-01 Offline-Inventar (generierte Zusammenfassung)",
    "",
    `Schema: \`${report.schemaVersion}\`. Die Quellzahlen sind überlappend und werden nicht zu einer eindeutigen Klausurzahl addiert.`,
    "",
    "## Quellübersicht",
    "",
    "| Quelle | Dateien | PDFs | JSON | Metadatenzeilen | unterschiedliche Klausur-IDs |",
    "|---|---:|---:|---:|---:|---:|",
    sourceRows,
    "",
    `Erfasste Dateien: **${report.files.length}**, Metadatenzeilen: **${report.metadataRecords.length}**, Manifestfälle: **${report.manifestRecords.length}**.`,
    "",
    "## Sichere Identitäten",
    "",
    `Identische PDF-Dateien per SHA-256: **${report.exactDuplicateGroups.length} Gruppen**. Diese Gruppen sind bytegleich; sie werden nicht automatisch einer persönlichen Klausur-ID gleichgesetzt.`,
    exactExamples,
    "",
    "## Textproben",
    "",
    `Für **${extractedCount}** PDFs wurde lokal eine normalisierte Textprobe der ersten Seiten gebildet. Gleiche Proben sind zusätzliche Prüfungskandidaten, keine automatische Zusammenführung. Gefundene Textprobe-Gruppen: **${report.textMatchGroups.length}**.`,
    textExamples,
    "",
    "## Dublettenkandidaten und ergänzte Lösungen",
    "",
    "Verschiedene Dateien mit derselben normalisierten Fallkennung bleiben Prüfungskandidaten; eine separate Lösung wird als Ergänzung gekennzeichnet.",
    versionExamples,
    solutionExamples,
    "",
    "## Widersprüche",
    "",
    `Metadaten-ID-Gruppen mit abweichender Signatur: **${report.idGroups.filter(group => group.classification === "widerspruch_pruefen").length}**.`,
    conflictExamples,
    "",
    "## Ausgeschlossene oder gesondert behandelte Artefakte",
    "",
    ...report.excludedArtifacts.map(artifact => `- \`${artifact.relativePath}\`: ${artifact.reason}.`),
    "",
    "Die vollständigen Pfade und Hashzeilen bleiben im lokalen Rohinventar. Der Bericht nennt absichtlich nur die für die Übergabe notwendigen Quellen und aggregierten Befunde.",
    "",
  ].join("\n");
}
