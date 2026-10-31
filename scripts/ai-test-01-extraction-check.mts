/** Check the real extraction answer against the already authorized source texts. No network. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { parseStructuredPlan } from "../src/lib/plan-applier";

const folder = "/private/tmp/stex-ai-test-01-extract-dates-2026-10-12";
const outcome = JSON.parse(await readFile(folder + "/outcome.json", "utf8"));
assert.equal(outcome.finish, "stop");
assert.equal(outcome.doneMarker, true);
assert.ok(!outcome.error);
const response = JSON.parse(await readFile(folder + "/response.json", "utf8"));
const extraction = JSON.parse(response.choices[0].message.content.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
type Appointment = { date: string; eventType: string; sourceDocument: string; label: string; evidence?: string; derivation?: string; durationMinutes?: number };
const appointments = extraction.appointments as Appointment[];
assert.ok(Array.isArray(appointments));
const messages = JSON.parse(await readFile("/private/tmp/stex-ai-test-01-cheap-2026-10-11/messages.json", "utf8"));
const documents = new Map<string, string>([...String(messages[1].content).matchAll(/DATEI: ([^\n]+)\nBeschreibung: [^\n]*\nZusammenfassung: [^\n]*\n<DOKUMENTINHALT>([\s\S]*?)<\/DOKUMENTINHALT>/g)].map(match => [match[1], match[2]]));
assert.equal(documents.size, 6);
type Expected = Pick<Appointment, "date" | "eventType" | "sourceDocument"> & { examCode?: string };
const kissName = "Kiss Kursplan_Assessorkurs_2026_Canvas.pdf", probeName = "Probeexamen.pdf", agName = "AG Termine.pdf";
const expected: Expected[] = [...documents.get(kissName)!.matchAll(/\b(\d{2})\.(\d{2})\.(2026)\b/g)].map(m => ({ date: `${m[3]}-${m[2]}-${m[1]}`, eventType: "rep", sourceDocument: kissName }));
const months: Record<string, string> = { Jun: "06", Jul: "07", Aug: "08" };
for (const row of documents.get(probeName)!.split("\n")) {
  const examCode = row.match(/\b(?:ZR|SR|VR|ZRA|SRA|VRA) (?:I|II)\b/)?.[0];
  if (!examCode) continue;
  const dates = [...row.matchAll(/(\d{2})\. (Jun|Jul|Aug) (2026)/g)].map(m => `${m[3]}-${months[m[2]]}-${m[1]}`);
  assert.equal(dates.length, 2);
  expected.push({ date: dates[0], eventType: "probeexamen", sourceDocument: probeName, examCode }, { date: dates[1], eventType: "ag", sourceDocument: probeName, examCode });
}
for (const date of ["2026-05-05", "2026-05-12", "2026-05-19", "2026-05-26"]) expected.push({ date, eventType: "ag", sourceDocument: agName });
expected.push({ date: "2026-05-13", eventType: "klausur", sourceDocument: agName });
assert.equal(expected.length, 47);
const remaining = [...appointments];
const missing: Expected[] = [];
const labelMismatches: Expected[] = [];
for (const item of expected) {
  const index = remaining.findIndex(actual => actual.date === item.date && actual.eventType === item.eventType && actual.sourceDocument === item.sourceDocument && (!item.examCode || new RegExp(`\\b${item.examCode.replace(" ", "\\s+")}\\b`).test(actual.label)));
  if (index >= 0) { remaining.splice(index, 1); continue; }
  missing.push(item);
  if (item.examCode && appointments.some(actual => actual.date === item.date && actual.eventType === item.eventType && actual.sourceDocument === item.sourceDocument)) labelMismatches.push(item);
}
const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
const compact = (text: string) => normalize(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const evidenceChecks = appointments.map(item => ({ date: item.date, sourceDocument: item.sourceDocument, exactAfterWhitespaceNormalization: !!item.evidence && normalize(documents.get(item.sourceDocument) ?? "").includes(normalize(item.evidence)), matchesIgnoringPunctuationCaseAndWhitespace: !!item.evidence && compact(documents.get(item.sourceDocument) ?? "").includes(compact(item.evidence)) }));
const derivedDates = new Set(["2026-05-12", "2026-05-19", "2026-05-26", "2026-05-13"]);
const missingDerivations = appointments.filter(item => item.sourceDocument === agName && derivedDates.has(item.date) && !item.derivation?.trim()).map(item => item.date);
const appShape = { tasks: [], klausuren: [], appointments: appointments.map(({ date, label, eventType, sourceDocument, durationMinutes }) => ({ date, label, eventType, sourceDocument, ...(durationMinutes === undefined ? {} : { durationMinutes }) })) };
const appParserAccepts = !!parseStructuredPlan("```json\n" + JSON.stringify(appShape) + "\n```");
const report = { source: "real model response", expectedAppointments: expected.length, actualAppointments: appointments.length, missing, extra: remaining, labelMismatches, missingDerivations, appParserAccepts, durationsClaimed: appointments.filter(item => item.durationMinutes !== undefined).length, exactEvidenceCount: evidenceChecks.filter(item => item.exactAfterWhitespaceNormalization).length, normalizedEvidenceCount: evidenceChecks.filter(item => item.matchesIgnoringPunctuationCaseAndWhitespace).length, evidenceMismatches: evidenceChecks.filter(item => !item.matchesIgnoringPunctuationCaseAndWhitespace), uncertainties: extraction.uncertainties, calendarDataPass: missing.length === 0 && remaining.length === 0 && labelMismatches.length === 0 && missingDerivations.length === 0 && appParserAccepts };
await writeFile(folder + "/checks.json", JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
