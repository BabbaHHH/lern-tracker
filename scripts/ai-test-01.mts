/** Authorized historical model test. Never writes real browser data. Each retry requires an explicit flag. */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/docs/parse/route";
import { STORAGE_KEYS, getOnboarding, getTasks, getCalendarEvents, getPlanAppliedRange } from "../src/lib/store";
import { DEFAULT_PROMPTS } from "../src/lib/prompts";
import { composePlanningPrompt } from "../src/lib/planning-documents";
import { buildContextFor } from "../src/lib/prompt-context";
import { AI_DEFAULTS } from "../src/lib/ai-config";
import { parseStructuredPlan, applyStructuredPlan, undoApply } from "../src/lib/plan-applier";
import { computeDayBudget, eventsOnDate } from "../src/lib/day-budget";
import { getLeafTopics, TOPICS } from "../src/lib/topics";

const output = resolve(process.env.AI_TEST_OUTPUT || "/private/tmp/stex-ai-test-01-2026-10-11");
await mkdir(output, { recursive: true, mode: 0o700 });
const save = (name: string, value: unknown) => writeFile(resolve(output, name), typeof value === "string" ? value : JSON.stringify(value, null, 2), { mode: 0o600 });
const hash = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
process.env = { ...process.env, NODE_ENV: "test", STEX_REFERENCE_DATE: "2026-04-08" };
const names = ["AG Termine.pdf", "Kiss Kursplan_Assessorkurs_2026_Canvas.pdf", "Probeexamen.pdf", "Lernplan 2026.xlsx", "Lernplan.docx", "marianna_lernplan.txt"];
const documents: { id: string; name: string; type: string; fullText: string; parseStatus: "ready" }[] = [];
const sources = [];
for (const name of names) {
  const bytes = await readFile(resolve("../Lernplan Dokumente", name));
  const parseStart = performance.now();
  const response = await POST(new Request("http://localhost:3317/api/docs/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: name, dataUrl: `data:application/octet-stream;base64,${bytes.toString("base64")}` }) }));
  const parsed = await response.json();
  assert.equal(response.status, 200, `${name}: parse failed`);
  assert.equal(parsed.truncated, false);
  documents.push({ id: name, name, type: "test", fullText: parsed.text as string, parseStatus: "ready" as const });
  sources.push({ name, sha256: hash(bytes), characters: parsed.chars, pdf: parsed.pdf, parseMilliseconds: performance.now() - parseStart });
}
const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
Object.defineProperty(globalThis, "window", { value: { localStorage: storage, dispatchEvent() {} }, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
storage.setItem(STORAGE_KEYS.onboarding, JSON.stringify({ ...getOnboarding(), lernstart: "2026-04-08", examDate: "2026-09-01", maxDailyHours: 7, documents }));
storage.setItem(STORAGE_KEYS.examDate, JSON.stringify("2026-09-01"));
storage.setItem(STORAGE_KEYS.lernstart, JSON.stringify("2026-04-08"));
const sys = DEFAULT_PROMPTS.find(p => p.id === "plan-adjust")!;
const promptStart = performance.now();
const messages = [
  { role: "system", content: composePlanningPrompt(sys.prompt) },
  { role: "user", content: `${buildContextFor(sys.contextFlags)}\n\nDies ist der allererste Plan im Onboarding. Erstelle einen konkreten Plan für die nächsten vier Wochen ab heute sowie einen groben Ausblick bis zum Examen. Berücksichtige alle Angaben und das Zeitbudget.` },
];
const promptMilliseconds = performance.now() - promptStart;
assert.ok(messages[1].content.includes("Heute: 08.04.2026"));
assert.ok(messages[1].content.includes("05.05.2026"));
assert.ok(messages[1].content.includes("13.05"));
await save("sources.json", sources);
await save("messages.json", messages);
if (process.argv.includes("--measure-context")) {
  const blocks = sys.contextFlags.map(flag => ({ flag, characters: buildContextFor([flag]).length }));
  const metrics = { systemCharacters: messages[0].content.length, documentCharacters: sources.reduce((sum, source) => sum + source.characters, 0), leafCount: getLeafTopics(TOPICS).length, blocks, totalCharacters: messages.reduce((sum, message) => sum + message.content.length, 0), parseMilliseconds: sources.reduce((sum, source) => sum + source.parseMilliseconds, 0), promptMilliseconds };
  await save("context-metrics.json", metrics);
  console.log(JSON.stringify(metrics, null, 2));
  const progressBlock = buildContextFor(["progress"]);
  const topicBlock = buildContextFor(["topics"]);
  const progressSummary = progressBlock.split("\n\nALLE THEMEN MIT FORTSCHRITT:")[0] + "\nFrisches Testprofil: Alle Themen haben 0% Fortschritt und kein letztes Lerndatum.";
  const topicSummary = topicBlock.split("\n\n⚠️ COVERAGE-LÜCKEN")[0] + "\nCoverage: 0%; alle IDs der vorstehenden Liste sind unbearbeitete Lücken. Nur die in vier Wochen und das Budget passenden Lücken priorisieren.";
  const compactUser = messages[1].content.replace(progressBlock, progressSummary).replace(topicBlock, topicSummary);
  const documentBlocks = (text: string) => [...text.matchAll(/<DOKUMENTINHALT>[\s\S]*?<\/DOKUMENTINHALT>/g)].map(match => match[0]);
  assert.deepEqual(documentBlocks(compactUser), documentBlocks(messages[1].content), "Compaction changed document text.");
  for (const leaf of getLeafTopics(TOPICS)) assert.ok(compactUser.includes(leaf.id), "Compaction removed a valid topic ID.");
  const compaction = { originalCharacters: metrics.totalCharacters, compactCharacters: messages[0].content.length + compactUser.length, documentBlocksUnchanged: true, canonicalIdsPreserved: metrics.leafCount, scope: "fresh zero-progress test profile only" };
  await save("compaction-metrics.json", compaction);
  await save("compact-messages.json", [messages[0], { ...messages[1], content: compactUser }]);
  console.log(JSON.stringify(compaction));
  process.exit(0);
}
const env = parseEnv(await readFile(".env.local", "utf8"));
const cheap = process.argv.includes("--cheap");
const model = cheap ? env.OPENROUTER_MODEL_CHEAP || AI_DEFAULTS.cheap.id : env.OPENROUTER_MODEL_PREMIUM || AI_DEFAULTS.premium.id;
const key = cheap ? env.OPENROUTER_API_KEY_CHEAP || env.OPENROUTER_API_KEY : env.OPENROUTER_API_KEY_STRONG || env.OPENROUTER_API_KEY;
const maxTokens = process.argv.includes("--retry-final") ? 40000 : 16000;
if (process.argv.includes("--live") || process.argv.includes("--retry-once") || process.argv.includes("--retry-final")) {
  const attemptNumber = process.argv.includes("--retry-final") ? 3 : process.argv.includes("--retry-once") ? 2 : 1;
  const retry = attemptNumber > 1;
  const marker = resolve(output, `attempt-${attemptNumber}.json`);
  const previous = resolve(output, cheap ? "attempt-1.json" : "attempt.json");
  try {
    await access(marker);
    throw new Error("This bounded attempt was already started; no duplicate request.");
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  if (retry) {
    await access(previous);
    if (attemptNumber === 2) {
      try { await access(resolve(output, "response.json")); throw new Error("A model response already exists; do not retry."); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    } else {
      const priorResponse = JSON.parse(await readFile(resolve(output, "response.json"), "utf8"));
      if (priorResponse.choices?.[0]?.finish_reason !== "length") throw new Error("Prior response was not token-limited; do not retry.");
    }
  }
  assert.ok(key);
  const models = await (await fetch("https://openrouter.ai/api/v1/models")).json();
  const info = models.data.find((m: { id: string }) => m.id === model);
  assert.ok(info, "Configured planning model is unavailable; no fallback allowed.");
  // UTF-8 bytes are a deliberately loose input-token bound plus message overhead.
  const inputBound = Buffer.byteLength(JSON.stringify(messages)) + 1000;
  const upperCost = inputBound * Number(info.pricing.prompt) + maxTokens * Number(info.pricing.completion);
  assert.ok(Number.isFinite(upperCost) && upperCost <= 3, "Conservative request bound exceeds $3.");
  if (cheap) assert.ok(upperCost * attemptNumber + 1.356236 <= 3, "Cumulative authorized test budget would exceed $3.");
  // The previous two attempts consumed about $0.91 according to provider usage.
  if (attemptNumber === 3) assert.ok(upperCost + 0.91 <= 3, "Cumulative authorized test budget would exceed $3.");
  const keyResponse = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
  assert.equal(keyResponse.status, 200);
  const keyData = (await keyResponse.json()).data;
  if (keyData.limit_remaining !== null) assert.ok(keyData.limit_remaining >= upperCost, "Insufficient key allowance.");
  const body = { model, messages, max_tokens: maxTokens, ...(cheap ? {} : { reasoning: { effort: AI_DEFAULTS.premium.effort }, provider: { require_parameters: true } }) };
  await writeFile(marker, JSON.stringify({ at: new Date().toISOString(), model, requestHash: hash(JSON.stringify(body)), inputBound, maxTokens, upperCost, pricing: info.pricing, retry, keyUsageBefore: keyData.usage }), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ stage: "sending", model, upperCost }));
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Stex Tracker AI-TEST-01" }, body: JSON.stringify(body), signal: AbortSignal.timeout(retry ? 240000 : 115000) });
  const result = await response.json();
  await save("response.json", result);
  const after = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
  if (after.ok) { const data = (await after.json()).data; await save("billing.json", { usageBefore: keyData.usage, usageAfter: data.usage, difference: data.usage - keyData.usage, remaining: data.limit_remaining }); }
  console.log(JSON.stringify({ stage: "response", status: response.status, model: result.model, id: result.id, finish: result.choices?.[0]?.finish_reason, usage: result.usage, error: result.error ? { code: result.error.code, message: result.error.message } : undefined }));
  assert.equal(response.status, 200);
}
let response;
try { response = JSON.parse(await readFile(resolve(output, "response.json"), "utf8")); } catch { console.log(JSON.stringify({ stage: "prepared", model, messageCharacters: messages.reduce((n, m) => n + m.content.length, 0), output })); process.exit(0); }
const reply = response.choices?.[0]?.message?.content;
if (typeof reply !== "string") {
  const checks = { parsed: false, finish: response.choices?.[0]?.finish_reason, model: response.model, usage: response.usage, responseContent: null };
  await save("checks.json", checks);
  console.log(JSON.stringify(checks, null, 2));
  process.exit(0);
}
await save("plan.md", reply);
const plan = parseStructuredPlan(reply);
const responseComplete = response.choices?.[0]?.finish_reason === "stop";
const checks: Record<string, unknown> = { parsed: !!plan, responseComplete, finish: response.choices?.[0]?.finish_reason, model: response.model, usage: response.usage };
if (plan && responseComplete) {
  await save("structured.json", plan);
  const appointments = plan.appointments ?? [];
  const kiss = documents[1];
  const expectedKiss = [...kiss.fullText.matchAll(/\b(\d{2})\.(\d{2})\.(2026)\b/g)].map(m => `${m[3]}-${m[2]}-${m[1]}`);
  const probeRows = documents[2].fullText.split("\n").filter(l => /\b(?:ZR|SR|VR|ZRA|SRA|VRA) (?:I|II)\b/.test(l));
  const months: Record<string, string> = { Jun: "06", Jul: "07", Aug: "08" };
  const expectedProbe = probeRows.flatMap(row => {
    const dates = [...row.matchAll(/(\d{2})\. (Jun|Jul|Aug) (2026)/g)].map(m => `${m[3]}-${months[m[2]]}-${m[1]}`);
    const examCode = row.match(/\b(?:ZR|SR|VR|ZRA|SRA|VRA) (?:I|II)\b/)![0];
    return [{ date: dates[0], eventType: "probeexamen", examCode }, { date: dates[1], eventType: "ag", examCode }];
  });
  const remainingProbe = appointments.filter(a => a.sourceDocument === documents[2].name);
  const missingProbe = expectedProbe.filter(expected => {
    // The product prompt explicitly permits Klausur OR Probeexamen for writing.
    // Consume each match once so same-day discussions cannot hide a missing row.
    const index = remainingProbe.findIndex(actual => actual.date === expected.date
      && (actual.eventType === expected.eventType || (expected.eventType === "probeexamen" && actual.eventType === "klausur"))
      && new RegExp(`\\b${expected.examCode.replace(" ", "\\s+")}\\b`).test(actual.label));
    if (index < 0) return true;
    remainingProbe.splice(index, 1);
    return false;
  });
  const actualKiss = appointments.filter(a => a.sourceDocument === kiss.name && a.eventType === "rep").map(a => a.date);
  const leafIds = new Set(getLeafTopics(TOPICS).map(t => t.id));
  checks.tasks = plan.tasks.length;
  checks.exams = plan.klausuren.length;
  checks.appointments = appointments.length;
  checks.studyPhases = plan.studyPhases ?? [];
  checks.missingKiss = expectedKiss.filter(d => !actualKiss.includes(d));
  checks.extraKiss = actualKiss.filter(d => !expectedKiss.includes(d));
  checks.missingProbe = missingProbe;
  checks.extraProbe = remainingProbe;
  checks.matchedProbeAppointments = expectedProbe.length - missingProbe.length;
  checks.invalidTopics = plan.tasks.filter(t => t.topicId && !leafIds.has(t.topicId));
  checks.outsideFourWeeks = [...plan.tasks, ...plan.klausuren].filter(t => t.date < "2026-04-08" || t.date > "2026-05-05");
  checks.sundayLearning = [...plan.tasks, ...plan.klausuren].filter(t => new Date(`${t.date}T12:00:00Z`).getUTCDay() === 0);
  checks.unknownSources = appointments.filter(a => !names.includes(a.sourceDocument));
  checks.claimedDurations = appointments.filter(a => a.durationMinutes !== undefined);
  checks.missingAgReference = ["2026-05-05", "2026-05-12", "2026-05-19", "2026-05-26"].filter(date => !appointments.some(a => a.sourceDocument === "AG Termine.pdf" && a.date === date && a.eventType === "ag"));
  checks.missingAgExam = !appointments.some(a => a.sourceDocument === "AG Termine.pdf" && a.date === "2026-05-13" && (a.eventType === "klausur" || a.eventType === "probeexamen"));
  checks.agDatesBeforeAnchor = appointments.filter(a => a.sourceDocument === "AG Termine.pdf" && a.date < "2026-05-05");
  const beforeEntries = new Map(values);
  const before = JSON.stringify([...values.entries()].sort());
  try {
    const applied = applyStructuredPlan(plan, "2026-04-08");
    checks.apply = { tasksCreated: applied.tasksCreated, klausurenCreated: applied.klausurenCreated, moved: applied.moved, deferred: applied.deferred, warnings: applied.warnings };
    const tasks = getTasks(), events = getCalendarEvents();
    await save("applied.json", { tasks, events });
    checks.overload = [...new Set(tasks.filter(t => !t.deferred).map(t => t.date))].flatMap(date => { const budget = computeDayBudget(tasks.filter(t => t.date === date), eventsOnDate(events, date)); return budget.overloadH ? [{ date, overloadH: budget.overloadH }] : []; });
    undoApply(applied);
    checks.undoExact = JSON.stringify([...values.entries()].sort()) === before;
    checks.undoPlanningStateEqual = JSON.stringify({ tasks: getTasks(), events: getCalendarEvents(), range: getPlanAppliedRange(), onboarding: getOnboarding() }) === JSON.stringify(applied.before);
    checks.undoStorageDifferences = [...new Set([...beforeEntries.keys(), ...values.keys()])].filter(key => beforeEntries.get(key) !== values.get(key)).map(key => ({ key, existedBefore: beforeEntries.has(key), existsAfter: values.has(key), beforeCharacters: beforeEntries.get(key)?.length ?? null, afterCharacters: values.get(key)?.length ?? null }));
  } catch (e) { checks.applyError = (e as Error).message; }
}
await save("checks.json", checks);
console.log(JSON.stringify(checks, null, 2));
