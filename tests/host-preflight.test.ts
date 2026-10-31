import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, link } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { preflight, PROJECT_BASIS, type PreflightReport, type ProgramManifest } from "../scripts/host/preflight";

const run = promisify(execFile);
const CLI = resolve("scripts/host/preflight.mts");
const LOADER = resolve("node_modules/tsx/dist/loader.mjs");
const VERSIONS: Record<string, string> = { next: "16.4.0", "pdfjs-dist": "5.4.296", tsx: "4.23.15", pg: "8.23.1", "better-auth": "1.7.7", "pdf-parse": "2.4.5", "@napi-rs/canvas": "0.1.80" };
const BACKUP = "interface BackupContent {\n format: 'stex-postgres-private-files';\n version: 4;\n}\nconst output = { version: 4 };\n";
const AUTH = "if (process.env.STEX_AUTH_MODE!==\"local\" || process.env.NODE_ENV===\"production\") throw new Error('closed');";
const PDF = "/* pdfjsVersion = 5.4.296\n pdfjsBuild = f56dc8601 */\nthrow new Error('This program must never execute');\n";
async function put(root: string, file: string, value: string) {
  await mkdir(dirname(join(root, file)), { recursive: true }); await writeFile(join(root, file), value);
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "stex-host-fixture-"));
  const dependencies = Object.fromEntries(Object.entries(VERSIONS).filter(([name]) => name !== "tsx"));
  const devDependencies = { tsx: VERSIONS.tsx };
  const pkg = { name: "synthetic-stex", version: "0.1.0", dependencies, devDependencies };
  await put(root, "package.json", JSON.stringify(pkg));
  await put(root, "package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: { "": pkg,
    ...Object.fromEntries(Object.entries(VERSIONS).map(([name, version]) => [`node_modules/${name}`, { version }])) } }));
  for (const file of ["next.config.ts", "tsconfig.json", "eslint.config.mjs"]) await put(root, file, "{}\n");
  for (const file of ["scripts/data-migration/persistence.mts", "scripts/data-migration/local-config.ts", "scripts/auth/operator.mts",
    "scripts/search/worker.mts", "src/lib/server/search/worker.ts", "src/lib/server/search/extract.ts", "src/lib/server/persistence/files.ts",
    "src/app/api/catalog/pdf-engine/[...asset]/route.ts"]) await put(root, file, "throw new Error('This program must never execute');\n");
  await put(root, "src/lib/server/persistence/backup.ts", BACKUP); await put(root, "src/lib/server/auth/runtime.ts", AUTH);
  await put(root, "src/lib/ai-credentials/service.ts", "export const revision = 1;\n");
  for (const migration of PROJECT_BASIS.migrations) await put(root, `db/migrations/${migration}`, "-- synthetic migration\nSELECT 1;\n");
  for (const [name, version] of Object.entries(VERSIONS)) await put(root, `node_modules/${name}/package.json`, JSON.stringify({ name, version }));
  await put(root, "node_modules/tsx/dist/loader.mjs", "throw new Error('do not execute');\n");
  for (const file of ["build/pdf.min.mjs", "build/pdf.worker.min.mjs", "legacy/build/pdf.mjs", "legacy/build/pdf.worker.mjs"]) await put(root, `node_modules/pdfjs-dist/${file}`, PDF);
  for (const file of ["LICENSE", "cmaps/Synthetic.bcmap", "standard_fonts/Synthetic.ttf", "wasm/Synthetic.wasm"]) await put(root, `node_modules/pdfjs-dist/${file}`, "synthetic asset\n");
  await put(root, ".next/BUILD_ID", "synthetic-build"); await put(root, ".next/required-server-files.json", "{\"config\":\"NOT_READ\"}");
  await mkdir(join(root, ".next/server"), { recursive: true }); await mkdir(join(root, ".next/static"), { recursive: true });
  return root;
}
function manifest(report: PreflightReport, overrides: Partial<ProgramManifest> = {}): ProgramManifest {
  assert.ok(report.identity.program); assert.ok(report.identity.artifacts);
  return { format: "stex-host-program-manifest", version: 1, programIdentity: report.identity.program,
    artifactIdentity: report.identity.artifacts, migrations: report.migrations.files, backupFormat: 4,
    pdfjsVersion: "5.4.296", targetPlatform: "linux", privateFileRoot: "/srv/synthetic-private/files", ...overrides };
}
async function bind(root: string, overrides: Partial<ProgramManifest> = {}) {
  const before = await preflight(root); await put(root, "host-program.json", JSON.stringify(manifest(before, overrides)));
  return preflight(root, { manifest: true });
}
function failed(report: PreflightReport, code: string) { assert.equal(report.checks.find(check => check.code === code)?.status, "failed"); }
async function withFixture(work: (root: string) => Promise<void>) {
  const root = await fixture(); try { await work(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function tree(root: string, prefix = ""): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const item of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) Object.assign(result, await tree(root, path));
    else if (item.isFile()) result[path] = createHash("sha256").update(await readFile(join(root, path))).digest("hex");
  }
  return result;
}

test("consistent bound synthetic program passes technical preflight without any Linux or pilot approval", async () => withFixture(async root => {
  const report = await bind(root);
  assert.equal(report.outcome.technical, "passed"); assert.equal(report.outcome.exitCode, 1);
  assert.equal(report.identity.stableAcrossCaptures, true); assert.equal(report.identity.atomicSnapshot, false);
  assert.equal(report.outcome.releaseReady, false); assert.equal(report.outcome.onlinePilotReady, false);
  assert.equal(report.observedRuntime.linuxVerified, false); assert.equal(report.authProduction, "closed_by_source_guard");
  assert.ok(report.gates.some(gate => gate.code === "production_auth_mail_tls_proxy" && gate.status === "blocked"));
  assert.ok(report.files.some(file => file.path === "src/lib/ai-credentials/service.ts"));
  assert.deepEqual(report.versions, { backupFormat: 4, pdfjs: "5.4.296", tsx: "4.23.15" });
}));

test("identity includes new untracked source and configuration changes rather than just a commit", async () => withFixture(async root => {
  const first = await preflight(root);
  await put(root, "src/new-untracked.ts", "export const changed = 1;\n");
  const second = await preflight(root); assert.notEqual(first.identity.program, second.identity.program);
  await put(root, "next.config.ts", "export default {changed:true};\n");
  assert.notEqual(second.identity.program, (await preflight(root)).identity.program);
  assert.equal(second.outcome.technical, "incomplete");
}));

test("missing browser worker and tsx loader are reported without trying to repair or execute", async () => withFixture(async root => {
  await rm(join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"));
  await rm(join(root, "node_modules/tsx/dist/loader.mjs"));
  const report = await preflight(root); assert.equal(report.outcome.exitCode, 2); failed(report, "unreadable_program_file");
}));

test("non-program target does not traverse source or library trees when package metadata is unreadable", async () => withFixture(async root => {
  await put(root, "package.json", "{invalid package");
  const reads: string[] = []; const report = await preflight(root, { onRead: path => reads.push(path) });
  failed(report, "not_a_program_directory"); assert.ok(reads.every(path => !path.startsWith("src/") && !path.startsWith("scripts/") && !path.startsWith("node_modules/")));
}));

test("empty PDF asset groups and missing build marker are not accepted as deployment artifacts", async () => withFixture(async root => {
  await rm(join(root, "node_modules/pdfjs-dist/wasm/Synthetic.wasm")); await rm(join(root, ".next/BUILD_ID"));
  const report = await preflight(root); failed(report, "missing_pdf_asset_group"); failed(report, "build_presence");
}));

test("library/worker version and build disagreement is distinguished from missing files", async () => withFixture(async root => {
  await put(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs", PDF.replace("5.4.296", "5.4.100"));
  failed(await preflight(root), "pdfjs_asset_versions");
  await put(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs", PDF.replace("f56dc8601", "123456789"));
  failed(await preflight(root), "pdfjs_asset_versions");
}));

test("package/lock and installed public package version conflicts are identified", async () => withFixture(async root => {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")); pkg.version = "0.2.0";
  await put(root, "package.json", JSON.stringify(pkg));
  await put(root, "node_modules/tsx/package.json", JSON.stringify({ name: "tsx", version: "99.0.0" }));
  const report = await preflight(root); failed(report, "package_lock_binding"); failed(report, "package_tsx");
}));

test("migration gaps, duplicate numbers and unexpected entries get distinct diagnostics", async () => withFixture(async root => {
  await rm(join(root, "db/migrations/003_catalog_import.sql"));
  failed(await preflight(root), "migration_sequence");
  await put(root, "db/migrations/003_catalog_import.sql", "SELECT 1;\n");
  await put(root, "db/migrations/003_duplicate.sql", "SELECT 1;\n");
  const duplicate = await preflight(root); failed(duplicate, "migration_duplicates"); failed(duplicate, "migration_expected_names");
  await rm(join(root, "db/migrations/003_duplicate.sql")); await put(root, "db/migrations/not-a-migration.txt", "private sentinel");
  failed(await preflight(root), "unexpected_migration_entry");
}));

test("pending migration 008 stays unapproved even with a fully consistent source/manifest", async () => withFixture(async root => {
  await put(root, `db/migrations/${PROJECT_BASIS.pendingMigration}`, "SELECT 8;\n");
  const report = await bind(root); assert.equal(report.outcome.technical, "passed"); assert.equal(report.migrations.pending, true);
  assert.ok(report.gates.some(gate => gate.code === "migration_008_acceptance" && gate.status === "blocked"));
  assert.equal(report.outcome.releaseReady, false);
}));

test("ambiguous backup versions and conflicting declared schema/program snapshot are rejected", async () => withFixture(async root => {
  await put(root, "src/lib/server/persistence/backup.ts", BACKUP.replace("const output = { version: 4 }", "const output = { version: 3 }"));
  const ambiguous = await preflight(root); failed(ambiguous, "backup_format"); assert.equal(ambiguous.versions.backupFormat, null);
  await put(root, "src/lib/server/persistence/backup.ts", BACKUP);
  const baseline = await preflight(root); const bad = manifest(baseline, { programIdentity: "0".repeat(64), backupFormat: 3 });
  bad.migrations = bad.migrations.map((file,i) => i === 0 ? { ...file, sha256: "0".repeat(64) } : file);
  await put(root, "host-program.json", JSON.stringify(bad));
  const report = await preflight(root, { manifest: true }); failed(report, "manifest_program"); failed(report, "manifest_schema"); failed(report, "manifest_versions");
}));

test("unknown manifest fields and malformed JSON never expose their sensitive contents", async () => withFixture(async root => {
  const value = { ...manifest(await preflight(root)), secret: "DO_NOT_ECHO_SYNTHETIC_SECRET" };
  await put(root, "host-program.json", JSON.stringify(value));
  const report = await preflight(root, { manifest: true }); failed(report, "manifest_shape");
  assert.ok(!JSON.stringify(report).includes("DO_NOT_ECHO_SYNTHETIC_SECRET"));
  await put(root, "host-program.json", "{DO_NOT_ECHO_MALFORMED");
  assert.ok(!JSON.stringify(await preflight(root, { manifest: true })).includes("DO_NOT_ECHO_MALFORMED"));
}));

test("declared private root is validated as metadata only, never probed or printed", async () => withFixture(async root => {
  const report = await bind(root, { privateFileRoot: join(root, "private-data", "must-not-read") });
  failed(report, "manifest_private_root"); assert.equal(report.manifest.privateFileRoot.inspected, false);
  assert.ok(!JSON.stringify(report).includes("must-not-read"));
}));

test("artifact identity mismatch and reordered schema cannot be mistaken for a matching snapshot", async () => withFixture(async root => {
  const baseline = await preflight(root);
  const value = manifest(baseline, { artifactIdentity: "0".repeat(64), migrations: [...baseline.migrations.files].reverse() });
  await put(root, "host-program.json", JSON.stringify(value));
  const report = await preflight(root, { manifest: true }); failed(report, "manifest_artifacts"); failed(report, "manifest_schema");
}));

test("manifest modification between captures is detected even when code and assets stay unchanged", async () => withFixture(async root => {
  const value = manifest(await preflight(root)); await put(root, "host-program.json", JSON.stringify(value));
  const report = await preflight(root, { manifest: true, afterFirstCapture: () => put(root, "host-program.json", JSON.stringify({ ...value, backupFormat: 3 })) });
  failed(report, "capture_stability"); assert.equal(report.identity.program, null);
}));

test("source or library changes during capture invalidate both snapshot identities", async () => withFixture(async root => {
  const source = await preflight(root, { afterFirstCapture: () => put(root, "src/new-file.ts", "export const now = 2;") });
  failed(source, "capture_stability"); assert.equal(source.identity.program, null); assert.equal(source.identity.artifacts, null);
  const asset = await preflight(root, { afterFirstCapture: () => put(root, "node_modules/pdfjs-dist/wasm/Synthetic.wasm", "changed") });
  failed(asset, "capture_stability"); assert.equal(asset.identity.program, null);
}));

test("build marker metadata changes are detected without reading possible inlined environment values", async () => withFixture(async root => {
  const reads: string[] = [];
  const report = await preflight(root, { onRead: path => reads.push(path), afterFirstCapture: () => put(root, ".next/required-server-files.json", "{\"value\":\"LONGER_SYNTHETIC_PRIVATE_MARKER\"}") });
  failed(report, "capture_stability"); assert.equal(report.build.contentsRead, false); assert.equal(report.build.verifiedBuild, false);
  assert.ok(!reads.some(path => path.startsWith(".next/"))); assert.ok(!JSON.stringify(report).includes("LONGER_SYNTHETIC_PRIVATE_MARKER"));
}));

test("program capture excludes private files, build content and environment while performing no writes/network", async () => withFixture(async root => {
  for (const file of [".env.local", "db/.local/postgres-password", "private-data/real.ts", "scripts/.session/real.ts",
    "src/secrets/local.ts", "scripts/fixtures/doc.pdf", "scripts/secret.key", "src/personal-document.pdf"]) await put(root, file, "SYNTHETIC_PRIVATE_SENTINEL");
  const before = await tree(root); const reads: string[] = []; const previousFetch = globalThis.fetch; let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw new Error("Unexpected network request"); };
  try {
    const report = await preflight(root, { onRead: path => reads.push(path) });
    assert.equal(report.scope.environmentRead, false); assert.equal(report.scope.filesystemWritten, false);
    assert.equal(report.scope.programExecuted, false); assert.ok(!JSON.stringify(report).includes("SYNTHETIC_PRIVATE_SENTINEL"));
    assert.ok(!JSON.stringify(report).includes(root));
    assert.ok(reads.every(path => !path.includes(".env") && !path.includes(".local") && !path.includes("private-data") && !path.includes("secret") && !path.endsWith(".pdf") && !path.startsWith(".next/")));
    assert.deepEqual(await tree(root), before);
    assert.equal(networkCalls, 0);
  } finally { globalThis.fetch = previousFetch; }
}));

test("hard-linked program files are refused before reading their contents", async () => withFixture(async root => {
  const outside = await mkdtemp(join(tmpdir(), "stex-host-hardlink-"));
  try {
    await put(outside, "private.ts", "HARDLINK_PRIVATE_SENTINEL");
    await link(join(outside, "private.ts"), join(root, "src/hardlink.ts"));
    const reads: string[] = []; const report = await preflight(root, { onRead: path => reads.push(path) });
    failed(report, "unreadable_program_file"); assert.ok(!reads.includes("src/hardlink.ts"));
    assert.ok(!JSON.stringify(report).includes("HARDLINK_PRIVATE_SENTINEL"));
  } finally { await rm(outside, { recursive: true, force: true }); }
}));

test("escaping source/library symlinks are not followed, and a symlink program root is refused", async () => withFixture(async root => {
  const outside = await mkdtemp(join(tmpdir(), "stex-host-outside-"));
  try {
    await put(outside, "private.ts", "SYMLINK_PRIVATE_SENTINEL");
    await symlink(join(outside, "private.ts"), join(root, "src/linked.ts"));
    const report = await preflight(root); failed(report, "program_symlink");
    assert.ok(!JSON.stringify(report).includes("SYMLINK_PRIVATE_SENTINEL"));
    const link = join(outside, "root-link"); await symlink(root, link); await assert.rejects(preflight(link));
  } finally { await rm(outside, { recursive: true, force: true }); }
}));

test("real CLI returns versioned JSON and deliberate nonzero gate status without mutating synthetic root", async () => withFixture(async root => {
  await bind(root); const before = await tree(root);
  try { await run(process.execPath, ["--import", LOADER, CLI, "--root", root, "--manifest"], { env: {}, maxBuffer: 2 * 1024 * 1024 }); assert.fail("exit 1 expected"); }
  catch (error) {
    const result = error as Error & { code: number; stdout: string; stderr: string };
    assert.equal(result.code, 1); assert.equal(result.stderr, "");
    const report = JSON.parse(result.stdout) as PreflightReport;
    assert.equal(report.format, "stex-host-preflight"); assert.equal(report.version, 1); assert.equal(report.outcome.technical, "passed");
    assert.equal(report.outcome.onlinePilotReady, false);
  }
  assert.deepEqual(await tree(root), before);
}));

test("CLI help/usage and unsafe root do not echo supplied paths or unknown argument contents", async () => {
  const help = await run(process.execPath, ["--import", LOADER, CLI, "--help"], { env: {} }); assert.match(help.stdout, /Verwendung/);
  for (const args of [["--root", "relative-private-name"], ["--root", "/does-not-exist-private", "--unknown-secret-argument"]]) {
    try { await run(process.execPath, ["--import", LOADER, CLI, ...args], { env: {} }); assert.fail("exit 3 expected"); }
    catch (error) {
      const result = error as Error & { code: number; stdout: string; stderr: string };
      assert.equal(result.code, 3); assert.ok(!result.stderr.includes("relative-private-name")); assert.ok(!result.stderr.includes("unknown-secret-argument")); assert.equal(result.stdout, "");
    }
  }
});
