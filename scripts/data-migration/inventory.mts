import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { BACKUP_AREAS } from "../../src/lib/data-migration/inventory";

const root = new URL("../../", import.meta.url);
const output = new URL("../../docs/entwuerfe/DATA-01/", import.meta.url);
const sourceFiles = ["src/lib/store.ts", "src/lib/types.ts", "src/lib/storage-backup.ts", "src/lib/plan-applier.ts",
  "src/lib/prompts.ts", "src/lib/free-models.ts", "src/lib/klausur-calendar.ts", "src/lib/spaced-repetition.ts",
  "src/lib/ai-config.ts", "src/lib/topics.ts", "src/lib/server/pdf-files.ts", "src/lib/server/request-safety.ts",
  "src/app/api/feedback/route.ts", "docs/aufgaben/DATA-01.md", "docs/ARBEITSSTART.md", "docs/ARCHITEKTUR.md", "docs/PROJEKTSTATUS.md"];
const sources = await Promise.all(sourceFiles.map(async path => ({ path, sha256: createHash("sha256").update(await readFile(new URL(path, root))).digest("hex") })));
const report = { capturedAt: new Date().toISOString(), projectDate: "2026-10-10", scope: "DATA-A",
  gitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  cleanCommitIsNotCurrentWorkingState: true, inventoryBasis: "observed working files including PLAN-01 reasoning settings",
  browserBackupAreas: BACKUP_AREAS,
  otherStorage: [
    { name: "lerntracker-klausur-rec-*", location: "localStorage", class: "derived-cache", backup: false, migration: "exclude and report" },
    { name: "lerntracker-free-models", location: "localStorage", class: "derived-cache", backup: false, migration: "exclude and report" },
    { name: "lerntracker-last-backup", location: "localStorage", class: "device-metadata", backup: false, migration: "exclude and report" },
    { name: "feedback JSON", location: "private-data/feedback", class: "personal-support-content", backup: "not in browser export", migration: "separate future assignment; no files read" },
    { name: "local PDF originals and catalog JSON", location: "configured PDF folder / external local collections", class: "source-files", backup: "not in browser export", migration: "IMPORT-A inventory and later explicit import; no originals copied" },
    { name: "topic tree", location: "src/lib/topics.ts", class: "shared-code-reference", backup: "not in browser export", migration: "reference validation against captured topic IDs" },
    { name: "request limiter", location: "process memory", class: "ephemeral", backup: false, migration: "rebuild" },
    { name: "credentials and portal sessions", location: "environment / separate private files", class: "secret", backup: false, migration: "never include; files not read" },
    { name: "unsaved editor/chat/upload state", location: "React/editor memory", class: "ephemeral", backup: false, migration: "save before later export; no current browser accessed" },
  ], sources };
await mkdir(output, { recursive: true });
await writeFile(new URL("inventar.json", output), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ backupAreaCount: BACKUP_AREAS.length, sourceHashCount: sources.length, gitHead: report.gitHead }, null, 2));
