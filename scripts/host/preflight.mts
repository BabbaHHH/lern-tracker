import { preflight } from "./preflight.js";

const usage = "Verwendung: node --import tsx scripts/host/preflight.mts --root /absolutes/programmverzeichnis [--manifest]\nNur Programmprüfung; keine Betriebsfreigabe. Manifest: host-program.json im angegebenen Programmverzeichnis.";
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  process.stdout.write(`${usage}\n`);
} else {
  let root: string | undefined;
  let manifest = false;
  let invalid = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root" && root === undefined && args[i + 1] && !args[i + 1].startsWith("--")) root = args[++i];
    else if (args[i] === "--manifest" && !manifest) manifest = true;
    else invalid = true;
  }
  if (invalid || !root) {
    process.stderr.write(`${usage}\n`); process.exitCode = 3;
  } else {
    try {
      const report = await preflight(root, { manifest });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); process.exitCode = report.outcome.exitCode;
    } catch {
      process.stderr.write("Programmverzeichnis oder Aufnahme nicht sicher lesbar. Kein Dateipfad/Fehlerinhalt ausgegeben.\n"); process.exitCode = 3;
    }
  }
}
