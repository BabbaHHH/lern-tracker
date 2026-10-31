/** Local integration check. No AI/network request, no changes to browser data. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/docs/parse/route";
import { applyStructuredPlan, undoApply, type StructuredPlan } from "../src/lib/plan-applier";
import { STORAGE_KEYS, getOnboarding, getCalendarEvents, getTasks } from "../src/lib/store";
import { buildContextFor } from "../src/lib/prompt-context";
import { computeDayBudget, eventsOnDate } from "../src/lib/day-budget";
import { buildCalendarIcs } from "../src/lib/calendar-export";

process.env = { ...process.env, NODE_ENV: "test", STEX_REFERENCE_DATE: "2026-04-08" };
const folder = resolve(process.argv[2] || "../Lernplan Dokumente");
const names = ["AG Termine.pdf", "Kiss Kursplan_Assessorkurs_2026_Canvas.pdf", "Probeexamen.pdf", "Lernplan 2026.xlsx", "Lernplan.docx", "marianna_lernplan.txt"];
const documents = [];
for (const name of names) {
  const buffer = await readFile(resolve(folder, name));
  const response = await POST(new Request("http://localhost:3317/api/docs/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: name, dataUrl: `data:application/octet-stream;base64,${buffer.toString("base64")}` }) }));
  const result = await response.json();
  assert.equal(response.status, 200, `${name}: ${result.error}`);
  assert.equal(result.truncated, false, `${name}: unexpectedly truncated`);
  documents.push({ id: name, name, type: "test", fullText: result.text as string, parseStatus: "ready" as const });
  console.log(`${name}: ${result.chars} characters, complete`);
}

const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
Object.defineProperty(globalThis, "window", { value: { localStorage: storage, dispatchEvent() {} }, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...getOnboarding(), lernstart: "2026-04-08", examDate: "2026-09-01", documents }));
const context = buildContextFor(["timeStatus", "onboarding", "dailyBudget"]);
for (const name of names) assert.ok(context.includes(`DATEI: ${name}`));
assert.match(context, /Heute: 08\.04\.2026/);
assert.match(context, /22\.08\.2026/);
assert.match(context, /Fokus StR/);
assert.equal(getOnboarding().studyPhases?.length, 0, "Sources do not establish actual station boundaries");

// These assertions describe an independently checked output, not a simulated AI result.
const kiss = documents.find(document => document.name.startsWith("Kiss"))!;
const kissDates = [...kiss.fullText.matchAll(/\b(\d{2})\.(\d{2})\.(2026)\b/g)].map(match => `${match[3]}-${match[2]}-${match[1]}`);
assert.equal(kissDates.length, 18);
assert.equal(kissDates[0], "2026-04-13");
assert.equal(kissDates.at(-1), "2026-09-07");
const probe = documents.find(document => document.name === "Probeexamen.pdf")!;
const rows = probe.fullText.split("\n").filter(line => /\b(?:ZR|SR|VR|ZRA|SRA|VRA) (?:I|II)\b/.test(line));
assert.equal(rows.length, 12);
const months: Record<string, string> = { Jun: "06", Jul: "07", Aug: "08" };
const appointments: NonNullable<StructuredPlan["appointments"]> = kissDates.map(date => ({ date, label: "KISS Kurs", eventType: "rep", sourceDocument: kiss.name }));
for (const row of rows) {
  const dates = [...row.matchAll(/(\d{2})\. (Jun|Jul|Aug) (2026)/g)].map(match => `${match[3]}-${months[match[2]]}-${match[1]}`);
  assert.equal(dates.length, 2);
  const label = row.match(/\b(?:ZR|SR|VR|ZRA|SRA|VRA) (?:II|I)\b/)![0];
  appointments.push({ date: dates[0], label: `Pflichtklausur ${label}`, eventType: "probeexamen", sourceDocument: probe.name });
  appointments.push({ date: dates[1], label: `Besprechung ${label}`, eventType: "ag", sourceDocument: probe.name });
}
assert.equal(appointments.filter(item => item.eventType === "probeexamen").length, 12);
assert.equal(appointments.filter(item => item.eventType === "ag").length, 12);
const result = applyStructuredPlan({ tasks: [{ date: "2026-04-08", title: "Anfechtung: zwei Kurzfälle", minutes: 90 }, { date: "2026-04-13", title: "Eigenstudium neben Kurs", minutes: 300 }], klausuren: [], appointments }, "2026-04-08");
assert.equal(getCalendarEvents().length, 42);
assert.equal(getTasks().find(task => task.title === "Eigenstudium neben Kurs")?.date, "2026-04-14");
assert.equal(result.after.range?.end, "2026-04-14", "Distant appointments must not suppress learning suggestions for months");
assert.equal(computeDayBudget([], eventsOnDate(getCalendarEvents(), "2026-06-01")).totalH, 9, "Exam and KISS are independent fixed commitments; report conflict");
const ics = buildCalendarIcs({ tasks: getTasks(), events: getCalendarEvents(), tracking: [], klausuren: [], start: "2026-04-08", end: "2026-09-08" });
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 44);
undoApply(result);
assert.equal(getCalendarEvents().length, 0);
assert.equal(getTasks().length, 0);
console.log("OK: real files → context; independently checked 18 course + 12 exam + 12 review appointments → budget, rescheduling, ICS, undo. No model evaluation.");
