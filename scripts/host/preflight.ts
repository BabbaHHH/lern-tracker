import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** Round 22 is a declared project baseline, not a new approval by this CLI. */
export const PROJECT_BASIS = {
  coordination: 22,
  backupFormat: 4,
  migrations: ["001_data_contract.sql", "002_auth_accounts.sql", "003_catalog_import.sql",
    "004_learning_commands.sql", "005_catalog_search.sql", "006_personal_learning_commands.sql", "007_ai_credentials.sql"],
  pendingMigration: "008_schedule_commands.sql",
  delivered: ["DATA-C1", "DATA-C2", "SEARCH-A1", "AUTH-A-R1", "AI-KEYS-A/R1"],
} as const;

const CONFIGS = ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "eslint.config.mjs", "postcss.config.mjs"];
const ENTRYPOINTS = ["scripts/data-migration/persistence.mts", "scripts/data-migration/local-config.ts", "scripts/auth/operator.mts",
  "scripts/search/worker.mts", "src/lib/server/search/worker.ts", "src/lib/server/search/extract.ts",
  "src/lib/server/auth/runtime.ts", "src/lib/server/persistence/backup.ts", "src/lib/server/persistence/files.ts",
  "src/app/api/catalog/pdf-engine/[...asset]/route.ts"];
const PACKAGES = ["next", "pdfjs-dist", "tsx", "pg", "better-auth", "pdf-parse", "@napi-rs/canvas"];
const PDF_FILES = ["LICENSE", "build/pdf.min.mjs", "build/pdf.worker.min.mjs", "legacy/build/pdf.mjs", "legacy/build/pdf.worker.mjs"];
const BUILD_FILES = [".next/BUILD_ID", ".next/required-server-files.json"];
const SOURCE_EXTENSION = /\.(?:[cm]?tsx?|[cm]?jsx?|css|scss|sh)$/;
const PRIVATE_NAME = /(?:^\.|^(?:secrets?|credentials?|sessions?|cookies?|auth-secret|auth-mail-key|auth-backup-key|postgres-password)(?:[.-].*)?$|\.(?:pem|key)$)/i;
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_FILES = 5000;
const SHA = /^[a-f0-9]{64}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/;

export interface FileIdentity { path: string; sha256: string; bytes: number }
export interface Check { code: string; status: "passed" | "failed" | "unknown"; message: string }
export interface ProgramManifest {
  format: "stex-host-program-manifest";
  version: 1;
  programIdentity: string;
  artifactIdentity: string;
  migrations: FileIdentity[];
  backupFormat: number;
  pdfjsVersion: string;
  targetPlatform: "linux";
  privateFileRoot: string;
}
export interface PreflightReport {
  format: "stex-host-preflight";
  version: 1;
  projectBasis: typeof PROJECT_BASIS;
  scope: { programOnly: true; environmentRead: false; privateDataRead: false; programExecuted: false; filesystemWritten: false };
  observedRuntime: { platform: string; node: string; linuxVerified: false };
  identity: { program: string | null; artifacts: string | null; stableAcrossCaptures: boolean; atomicSnapshot: false };
  files: FileIdentity[];
  artifacts: FileIdentity[];
  build: { markers: string[]; contentsRead: false; verifiedBuild: false };
  migrations: { files: FileIdentity[]; pending: boolean; databaseStateRead: false };
  versions: { backupFormat: number | null; pdfjs: string | null; tsx: string | null };
  authProduction: "closed_by_source_guard" | "not_established";
  manifest: { supplied: boolean; valid: boolean; privateFileRoot: { declared: boolean; valid: boolean; inspected: false } };
  checks: Check[];
  gates: { code: string; status: "not_verified" | "blocked" }[];
  outcome: { technical: "passed" | "incomplete" | "failed"; releaseReady: false; onlinePilotReady: false; exitCode: 1 | 2 };
}
export interface CaptureOptions {
  manifest?: boolean;
  /** Test seams only; the CLI never supplies callbacks or executes snapshot code. */
  afterFirstCapture?: () => Promise<void>;
  onRead?: (path: string) => void;
}
type JsonObject = Record<string, unknown>;
interface Capture { source: FileIdentity[]; artifacts: FileIdentity[]; texts: Map<string, string>; issues: Check[]; build: string[]; buildMetadata: string[] }
const object = (value: unknown): value is JsonObject => !!value && typeof value === "object" && !Array.isArray(value);
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const sorted = (files: FileIdentity[]) => [...files].sort((a, b) => a.path.localeCompare(b.path, "en"));
const identity = (files: FileIdentity[]) => hash(JSON.stringify(sorted(files)));
function json(text: string | undefined): JsonObject | null {
  try { const value: unknown = JSON.parse(text ?? ""); return object(value) ? value : null; } catch { return null; }
}
function issue(code: string, message: string): Check { return { code, status: "failed", message }; }

/** Never traverse private folders, arbitrary JSON/data or links. */
async function capture(root: string, options: CaptureOptions): Promise<Capture> {
  const result: Capture = { source: [], artifacts: [], texts: new Map(), issues: [], build: [], buildMetadata: [] };
  let count = 0;
  async function safePath(path: string): Promise<boolean> {
    const parts = path.split("/");
    let current = root;
    for (const part of parts) {
      current = join(current, part);
      try { const stat = await lstat(current); if (stat.isSymbolicLink()) return false; }
      catch { return false; }
    }
    return true;
  }
  async function read(path: string, target: FileIdentity[]): Promise<void> {
    if (++count > MAX_FILES) { result.issues.push(issue("capture_limit", "Programmaufnahme überschreitet die Dateigrenze.")); return; }
    try {
      if (!await safePath(path)) throw new Error();
      const handle = await open(join(root, path), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const before = await handle.stat();
        if (!before.isFile() || before.size > MAX_BYTES || before.nlink !== 1) throw new Error();
        options.onRead?.(path);
        const bytes = await handle.readFile();
        const after = await handle.stat();
        if (bytes.length !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error();
        target.push({ path, sha256: hash(bytes), bytes: bytes.length });
        // Keep only needed public metadata/source texts, never put them in output.
        if (CONFIGS.includes(path) || path.endsWith("/package.json") || ENTRYPOINTS.includes(path) || path === "host-program.json") result.texts.set(path, bytes.toString("utf8"));
        if (/node_modules\/pdfjs-dist\/(?:legacy\/)?build\//.test(path)) result.texts.set(path, bytes.subarray(0, 4096).toString("utf8"));
      } finally { await handle.close(); }
    } catch { result.issues.push(issue("unreadable_program_file", "Eine erlaubte Programmdatei fehlt, ist verknüpft, zu groß oder während des Lesens verändert.")); }
  }
  async function walk(path: string, target: FileIdentity[], accept: (name: string) => boolean): Promise<void> {
    if (count > MAX_FILES) return;
    if (!await safePath(path)) { result.issues.push(issue("unsafe_or_missing_directory", "Ein erforderlicher Programm-/Artefaktordner fehlt oder ist verknüpft.")); return; }
    let entries;
    try { entries = await readdir(join(root, path), { withFileTypes: true }); }
    catch { result.issues.push(issue("unreadable_program_directory", "Ein Programm-/Artefaktordner ist nicht lesbar.")); return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      if (!/^[A-Za-z0-9_.\-[\]()]+$/.test(entry.name) || PRIVATE_NAME.test(entry.name)
        || ["fixtures", "private-data", "public", "backups", "node_modules"].includes(entry.name)) continue;
      if (entry.isSymbolicLink()) { result.issues.push(issue("program_symlink", "Programmverzeichnis enthält eine nicht erfasste symbolische Verknüpfung.")); continue; }
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(child, target, accept);
      else if (entry.isFile() && accept(entry.name)) await read(child, target);
    }
  }
  for (const path of CONFIGS) {
    if (path === "postcss.config.mjs" && !await safePath(path)) continue;
    await read(path, result.source);
  }
  // Don't walk a mistakenly supplied data/home directory without a readable
  // public program package. All errors still go through the safe report.
  if (!json(result.texts.get("package.json"))) {
    result.issues.push(issue("not_a_program_directory", "Ohne lesbares Paketobjekt werden keine Programm-/Artefaktverzeichnisse durchlaufen."));
    result.source = sorted(result.source);
    return result;
  }
  await walk("src", result.source, name => SOURCE_EXTENSION.test(name));
  await walk("scripts", result.source, name => SOURCE_EXTENSION.test(name));
  // Enumerate exactly migrations, not db/.local, a database or any backup.
  if (!await safePath("db/migrations")) result.issues.push(issue("missing_migrations", "Der Migrationsordner fehlt oder ist verknüpft."));
  else {
    const entries = await readdir(join(root, "db/migrations"), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      if (entry.name.startsWith(".")) continue;
      if (!entry.isFile() || !/^\d{3}_[a-z0-9_]+\.sql$/.test(entry.name)) { result.issues.push(issue("unexpected_migration_entry", "Der Migrationsordner enthält einen unerwarteten Eintrag.")); continue; }
      await read(`db/migrations/${entry.name}`, result.source);
    }
  }
  for (const name of PACKAGES) await read(`node_modules/${name}/package.json`, result.artifacts);
  await read("node_modules/tsx/dist/loader.mjs", result.artifacts);
  for (const file of PDF_FILES) await read(`node_modules/pdfjs-dist/${file}`, result.artifacts);
  for (const [directory, extension] of [["cmaps", /\.bcmap$/], ["standard_fonts", /\.(pfb|ttf)$/], ["wasm", /\.wasm$/]] as const) {
    await walk(`node_modules/pdfjs-dist/${directory}`, result.artifacts, name => extension.test(name));
    if (!result.artifacts.some(file => file.path.startsWith(`node_modules/pdfjs-dist/${directory}/`))) result.issues.push(issue("missing_pdf_asset_group", "Eine benötigte PDF.js-Assetgruppe ist leer oder fehlt."));
  }
  for (const file of BUILD_FILES) {
    if (await safePath(file)) {
      const stat = await lstat(join(root, file));
      if (stat.isFile() && stat.size > 0) {
        result.build.push(file); result.buildMetadata.push(JSON.stringify([file, stat.size, stat.mtimeMs, stat.ctimeMs]));
      }
    }
  }
  for (const directory of [".next/server", ".next/static"]) {
    if (await safePath(directory)) {
      const stat = await lstat(join(root, directory));
      if (stat.isDirectory()) {
        result.build.push(directory); result.buildMetadata.push(JSON.stringify([directory, stat.mtimeMs, stat.ctimeMs]));
      }
    }
  }
  // Build outputs may contain runtime values: inspect presence only, not contents.
  if (options.manifest) await read("host-program.json", []);
  result.source = sorted(result.source); result.artifacts = sorted(result.artifacts);
  return result;
}

function validateManifest(value: JsonObject | null): value is JsonObject & ProgramManifest {
  const keys = ["format", "version", "programIdentity", "artifactIdentity", "migrations", "backupFormat", "pdfjsVersion", "targetPlatform", "privateFileRoot"];
  return !!value && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
    && value.format === "stex-host-program-manifest" && value.version === 1 && value.targetPlatform === "linux"
    && typeof value.programIdentity === "string" && SHA.test(value.programIdentity)
    && typeof value.artifactIdentity === "string" && SHA.test(value.artifactIdentity)
    && Number.isSafeInteger(value.backupFormat) && typeof value.pdfjsVersion === "string" && SEMVER.test(value.pdfjsVersion)
    && typeof value.privateFileRoot === "string" && value.privateFileRoot.length <= 1024
    && Array.isArray(value.migrations) && value.migrations.length <= 100
    && value.migrations.every(row => object(row) && Object.keys(row).length === 3 && typeof row.path === "string"
      && /^db\/migrations\/\d{3}_[a-z0-9_]+\.sql$/.test(row.path) && typeof row.sha256 === "string" && SHA.test(row.sha256)
      && Number.isSafeInteger(row.bytes) && (row.bytes as number) > 0);
}

export async function preflight(directory: string, options: CaptureOptions = {}): Promise<PreflightReport> {
  // Resolve just the explicit program root; don't print paths or raw FS/JSON errors.
  if (!isAbsolute(directory) || (await lstat(directory)).isSymbolicLink() || !(await lstat(directory)).isDirectory()) throw new Error("invalid_program_root");
  const root = await realpath(directory);
  if (root.split(sep).some(part => [".local", "private-data", "secrets", "sessions", "backups"].includes(part))) throw new Error("invalid_program_root");
  const first = await capture(root, options);
  await options.afterFirstCapture?.();
  const second = await capture(root, options);
  const stable = identity(first.source) === identity(second.source) && identity(first.artifacts) === identity(second.artifacts)
    && JSON.stringify(first.buildMetadata) === JSON.stringify(second.buildMetadata) && first.texts.get("host-program.json") === second.texts.get("host-program.json");
  const checks: Check[] = [...first.issues, ...second.issues];
  const add = (code: string, passed: boolean, message: string) => checks.push({ code, status: passed ? "passed" : "failed", message });
  add("capture_stability", stable, stable ? "Erlaubte Dateien sind in beiden Aufnahmen gleich; keine atomare Snapshotgarantie." : "Programm-/Artefakt-/Manifeststand änderte sich während der Aufnahme.");
  const paths = new Set(first.source.map(file => file.path));
  add("operator_entrypoints", ENTRYPOINTS.every(path => paths.has(path)), "App-, Persistenz-, Auth- und Suchworker-Einstiege müssen als Programmdateien vorliegen.");
  add("build_presence", first.build.length === 4, "Next-Produktionsmarker/server/static: nur Vorhandensein geprüft, kein Buildinhalt oder Buildnachweis.");
  const pkg = json(first.texts.get("package.json")); const lock = json(first.texts.get("package-lock.json"));
  const lockPackages = object(lock?.packages) ? lock.packages : null;
  const lockRoot = object(lockPackages?.[""]) ? lockPackages[""] : null;
  const deps = (value: JsonObject | null, name: string) => object(value?.[name]) ? value[name] : null;
  const sameDeps = (name: string) => {
    const a = deps(pkg, name), b = deps(lockRoot, name);
    return !!a && !!b && JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  };
  add("package_lock_binding", !!pkg && !!lockRoot && typeof pkg.version === "string" && SEMVER.test(pkg.version)
    && typeof pkg.name === "string" && pkg.name === lockRoot.name && pkg.version === lockRoot.version
    && [2, 3].includes(Number(lock?.lockfileVersion)) && sameDeps("dependencies") && sameDeps("devDependencies"), "Paket-/Lockwurzel müssen dieselben Programmversionen und Abhängigkeiten beschreiben.");
  const versions = new Map<string, string>();
  for (const name of PACKAGES) {
    const installed = json(first.texts.get(`node_modules/${name}/package.json`));
    const lockEntry = lockPackages?.[`node_modules/${name}`];
    const locked = object(lockEntry) ? lockEntry : null;
    const version = typeof installed?.version === "string" && SEMVER.test(installed.version) ? installed.version : null;
    if (version) versions.set(name, version);
    add(`package_${name.replace(/[^a-z0-9]/g, "_")}`, !!version && installed?.name === name && locked?.version === version, "Installierte öffentliche Paketmetadaten müssen eine gültige Version haben und zur Lockdatei passen; keine native Plattformabnahme.");
  }
  const pdfjs = versions.get("pdfjs-dist") ?? null;
  add("pdfjs_pinned", !!pdfjs && deps(pkg, "dependencies")?.["pdfjs-dist"] === pdfjs, "PDF.js muss exakt gebunden sein; Bibliothek/Worker/Assetgruppen sind erfasst, nicht ausgeführt.");
  const headers = PDF_FILES.filter(file => file !== "LICENSE").map(file => first.texts.get(`node_modules/pdfjs-dist/${file}`) ?? "");
  const builds = headers.map(header => /pdfjsBuild\s*=\s*([a-f0-9]+)/.exec(header)?.[1]);
  add("pdfjs_asset_versions", !!pdfjs && headers.every(header => /pdfjsVersion\s*=\s*([\d.]+)/.exec(header)?.[1] === pdfjs)
    && builds.every(build => !!build && build === builds[0]), "Browser- und Legacy-Bibliothek/Worker müssen dieselbe PDF.js-Version und Buildkennung in den Paketkopfzeilen haben.");
  const backupText = first.texts.get("src/lib/server/persistence/backup.ts") ?? "";
  const backupInterface = /interface BackupContent\s*\{([\s\S]*?)\n\}/.exec(backupText)?.[1] ?? "";
  const typeVersions = [...backupInterface.matchAll(/\bversion\s*:\s*(\d+)\s*;/g)].map(match => Number(match[1]));
  const formatVersions = [...backupText.matchAll(/\bversion\s*:\s*(\d+)\b/g)].map(match => Number(match[1]));
  const backupFormat = typeVersions.length === 1 && formatVersions.every(version => version === typeVersions[0]) ? typeVersions[0] : null;
  add("backup_format", backupFormat === PROJECT_BASIS.backupFormat, "BackupContent und deklarierte Ausgabeversionen müssen eindeutig Format 4 angeben; keine echte Sicherung geprüft.");
  const migrations = first.source.filter(file => file.path.startsWith("db/migrations/"));
  const numbers = migrations.map(file => Number(file.path.slice(14, 17)));
  add("migration_duplicates", new Set(numbers).size === numbers.length, "Migrationsnummern dürfen nicht doppelt vorkommen.");
  add("migration_sequence", migrations.length > 0 && [...numbers].sort((a,b) => a-b).every((n,i) => n === i + 1), "Die Migrationsfolge muss bei 001 beginnen und lückenlos sein.");
  const allowed = new Set<string>([...PROJECT_BASIS.migrations, PROJECT_BASIS.pendingMigration]);
  add("migration_expected_names", migrations.every(file => allowed.has(file.path.slice(14))), "Nur die in Arbeitsrunde 22 benannten Migrationen sind bekannt; zusätzliche/umbenannte Dateien benötigen neuen Abgleich.");
  add("migration_accepted_basis", PROJECT_BASIS.migrations.every(name => paths.has(`db/migrations/${name}`)), "Übernommene Basis 001–007 muss vorhanden sein; Hashgleichheit zu früherer Abnahme wird dadurch nicht behauptet.");
  const pending = paths.has(`db/migrations/${PROJECT_BASIS.pendingMigration}`);
  const authText = first.texts.get("src/lib/server/auth/runtime.ts") ?? "";
  const authProduction = /process\.env\.NODE_ENV\s*===\s*["']production["']/.test(authText)
    && /process\.env\.STEX_AUTH_MODE\s*!==\s*["']local["']/.test(authText) ? "closed_by_source_guard" : "not_established";
  const manifest = options.manifest ? json(first.texts.get("host-program.json")) : null;
  const valid = validateManifest(manifest);
  let privateValid = false;
  if (options.manifest) {
    add("manifest_shape", valid, "Manifest muss exakt dem geheimnisfreien Version-1-Vertrag entsprechen; unbekannte Angaben werden nicht ausgegeben.");
    if (valid) {
      const declared = resolve(manifest.privateFileRoot);
      const outside = (base: string) => {
        const rel = relative(base, declared);
        return !!rel && (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel));
      };
      // macOS /var and /private/var aliases must not make an in-program root
      // appear external. Only compare lexical paths; never probe private data.
      privateValid = isAbsolute(manifest.privateFileRoot) && !/[\\\x00-\x1f]/.test(manifest.privateFileRoot)
        && outside(root) && outside(resolve(directory)) && !declared.split(sep).some(part => part.toLowerCase() === "public");
      add("manifest_private_root", privateValid, "Private Dateiwurzel nur lexikalisch prüfen: absolut, außerhalb Programm/public; Inhalt und Erreichbarkeit bleiben ungeprüft.");
      add("manifest_program", stable && manifest.programIdentity === identity(first.source), "Manifest-Programmidentität muss zu genau der stabil beobachteten Quellmomentaufnahme passen.");
      add("manifest_artifacts", stable && manifest.artifactIdentity === identity(first.artifacts), "Manifest-Artefaktidentität muss zu den erfassten Bibliotheksdateien/Paketmetadaten passen; kein vollständiger Buildhash.");
      add("manifest_schema", JSON.stringify(manifest.migrations) === JSON.stringify(migrations), "Manifest-Schemafolge, Reihenfolge, Größen und Prüfsummen müssen exakt passen.");
      add("manifest_versions", manifest.backupFormat === backupFormat && manifest.pdfjsVersion === pdfjs, "Manifest-Backup-/PDF.js-Version muss zum gelesenen Programm passen.");
    }
  } else checks.push({ code: "manifest_binding", status: "unknown", message: "Keine ausdrückliche Programm-/Schema-/Artefaktbindung vorgelegt." });
  const gates: PreflightReport["gates"] = ["production_auth_mail_tls_proxy", "linux_native_build", "devices_and_load", "offsite_backup_restore", "provider_budget", "real_initial_catalog", "remaining_personal_learning"].map(code => ({ code, status: "not_verified" }));
  if (authProduction === "closed_by_source_guard") gates[0].status = "blocked";
  if (pending) gates.push({ code: "migration_008_acceptance", status: "blocked" });
  const technical = checks.some(check => check.status === "failed") ? "failed" : checks.some(check => check.status === "unknown") ? "incomplete" : "passed";
  return {
    format: "stex-host-preflight", version: 1, projectBasis: PROJECT_BASIS,
    scope: { programOnly: true, environmentRead: false, privateDataRead: false, programExecuted: false, filesystemWritten: false },
    observedRuntime: { platform: process.platform, node: process.version, linuxVerified: false },
    identity: { program: stable ? identity(first.source) : null, artifacts: stable ? identity(first.artifacts) : null, stableAcrossCaptures: stable, atomicSnapshot: false },
    files: first.source, artifacts: first.artifacts, build: { markers: first.build, contentsRead: false, verifiedBuild: false },
    migrations: { files: migrations, pending, databaseStateRead: false },
    versions: { backupFormat, pdfjs, tsx: versions.get("tsx") ?? null },
    authProduction,
    manifest: { supplied: !!options.manifest, valid, privateFileRoot: { declared: valid, valid: privateValid, inspected: false } },
    checks: checks.filter((check, i) => checks.findIndex(other => other.code === check.code && other.message === check.message) === i), gates,
    outcome: { technical, releaseReady: false, onlinePilotReady: false, exitCode: technical === "failed" ? 2 : 1 },
  };
}
