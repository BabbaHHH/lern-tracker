import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildInventory, renderInventorySummary } from "./inventory";

function argumentValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const args = process.argv.slice(2);
const root = resolve(argumentValue(args, "--root") ?? "..");
const output = argumentValue(args, "--output");
const summaryOutput = argumentValue(args, "--summary");
const extractText = (argumentValue(args, "--text") ?? "none") as "none" | "selected" | "all";
const maxTextBytes = Number(argumentValue(args, "--max-text-bytes") ?? 30 * 1024 * 1024);

if (!["none", "selected", "all"].includes(extractText)) {
  throw new Error("--text muss none, selected oder all sein.");
}

const report = buildInventory(root, {
  extractText,
  maxTextBytes: Number.isFinite(maxTextBytes) ? maxTextBytes : 30 * 1024 * 1024,
});

if (output) {
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
if (summaryOutput) {
  mkdirSync(dirname(resolve(summaryOutput)), { recursive: true });
  writeFileSync(resolve(summaryOutput), renderInventorySummary(report), "utf8");
}

console.log(JSON.stringify({
  files: report.files.length,
  metadataRecords: report.metadataRecords.length,
  manifestRecords: report.manifestRecords.length,
  exactDuplicateGroups: report.exactDuplicateGroups.length,
  versionCandidates: report.caseGroups.filter(group => group.classifications.includes("versionskandidat")).length,
  solutionCandidates: report.caseGroups.filter(group => group.classifications.includes("ergaenzte_loesung")).length,
  idConflicts: report.idGroups.filter(group => group.classification === "widerspruch_pruefen").length,
  output: output ? resolve(output) : undefined,
  summary: summaryOutput ? resolve(summaryOutput) : undefined,
}, null, 2));

