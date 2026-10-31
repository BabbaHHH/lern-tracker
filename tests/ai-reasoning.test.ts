import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { AI_DEFAULTS, normalizeReasoningSettings } from "../src/lib/ai-config";
import { fetchAi, withAiPreferences } from "../src/lib/ai-settings";
import { getAiReasoningSettings, saveAiReasoningSettings, exportAll, importAll, STORAGE_KEYS, getPlanModel, getKorrekturSettings } from "../src/lib/store";
import { POST } from "../src/app/api/ai/route";

const originalEnv = process.env;
const originalFetch = globalThis.fetch;
const descriptors = new Map(["window", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
afterEach(() => {
  process.env = originalEnv;
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function storage() {
  const values = new Map<string, string>();
  const mock = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: mock } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: mock });
  return mock;
}

function localEnv() {
  process.env = { ...originalEnv, NODE_ENV: "test", OPENROUTER_API_KEY: "synthetic-key" };
  for (const name of ["OPENROUTER_MODEL_PREMIUM", "OPENROUTER_MODEL_STRONG", "OPENROUTER_MODEL_CHEAP", "OPENROUTER_API_KEY_TEST", "OPENROUTER_API_KEY_STRONG", "OPENROUTER_API_KEY_CHEAP"]) delete process.env[name];
}
function request(body: unknown) {
  return new Request("http://localhost:3000/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("saved preferences override explicit picker defaults; provider mode does not revive high", () => {
  assert.equal(withAiPreferences({ tier: "strong" }, {}).reasoningPreference, "max");
  assert.equal(withAiPreferences({ tier: "cheap" }, {}).reasoningPreference, "provider");
  assert.equal(withAiPreferences({ model: AI_DEFAULTS.premium.id, reasoning: { effort: "high" } }, { [AI_DEFAULTS.premium.id]: "low" }).reasoningPreference, "low");
  assert.equal(withAiPreferences({ model: AI_DEFAULTS.premium.id, reasoning: { effort: "high" } }, { [AI_DEFAULTS.premium.id]: "provider" }).reasoningPreference, "provider");
  assert.equal(withAiPreferences({ model: "example/other" }, { [AI_DEFAULTS.strong.id]: "max" }).reasoningPreference, undefined);
});

test("preferences persist through backup/restore; invalid modes are filtered without touching learning data", () => {
  const mock = storage();
  mock.setItem(STORAGE_KEYS.tasks, JSON.stringify([{ id: "existing-task", done: true }]));
  const prefs = { [AI_DEFAULTS.strong.id]: "low", [AI_DEFAULTS.cheap.id]: "xhigh" } as const;
  assert.equal(saveAiReasoningSettings(prefs), true);
  const backup = exportAll();
  assert.deepEqual(backup.data[STORAGE_KEYS.aiReasoning], prefs);
  saveAiReasoningSettings({});
  importAll(backup);
  assert.deepEqual(getAiReasoningSettings(), prefs);
  assert.deepEqual(JSON.parse(mock.getItem(STORAGE_KEYS.tasks)!), [{ id: "existing-task", done: true }]);
  assert.deepEqual(normalizeReasoningSettings({ [AI_DEFAULTS.premium.id]: "none", [AI_DEFAULTS.cheap.id]: "medium", bogus: "high" }), {});
});

test("every new client request reads the latest preference, including an open correction editor", async () => {
  storage();
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init!.body as string));
    return Response.json({ reply: "synthetic response" });
  };
  const options = { method: "POST", body: JSON.stringify({ model: AI_DEFAULTS.strong.id, reasoning: { effort: "max" }, messages: [{ role: "user", content: "synthetic" }] }) };
  await fetchAi(options);
  saveAiReasoningSettings({ [AI_DEFAULTS.strong.id]: "low" });
  await fetchAi(options);
  assert.equal(bodies[0].reasoningPreference, "max");
  assert.equal(bodies[1].reasoningPreference, "low");
});

test("replaced Opus/Fable defaults upgrade while stored alternative choices and raw data survive", () => {
  const mock = storage();
  mock.setItem(STORAGE_KEYS.planModel, JSON.stringify("~anthropic/claude-fable-latest"));
  assert.equal(getPlanModel(), AI_DEFAULTS.premium.id);
  mock.setItem(STORAGE_KEYS.planModel, JSON.stringify("openai/gpt-5.4"));
  assert.equal(getPlanModel(), "openai/gpt-5.4");
  const old = JSON.stringify({ model: "anthropic/claude-opus-4.8", granularity: "manuell" });
  mock.setItem(STORAGE_KEYS.korrekturSettings, old);
  assert.equal(getKorrekturSettings().model, AI_DEFAULTS.premium.id);
  assert.equal(mock.getItem(STORAGE_KEYS.korrekturSettings), old);
  mock.setItem(STORAGE_KEYS.korrekturSettings, JSON.stringify({ model: "z-ai/glm-5.2", granularity: "manuell" }));
  assert.equal(getKorrekturSettings().model, "z-ai/glm-5.2");
});

test("server sends tier defaults and selected reasoning; provider mode omits reasoning and unsupported sampling", async () => {
  localEnv();
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init!.body as string));
    return Response.json({ choices: [{ message: { content: "synthetic response" }, finish_reason: "stop" }] });
  };
  const messages = [{ role: "user", content: "synthetic" }];
  for (const tier of ["premium", "strong", "cheap"]) assert.equal((await POST(request({ tier, messages }))).status, 200);
  assert.equal(bodies[0].model, AI_DEFAULTS.premium.id);
  assert.deepEqual(bodies[0].reasoning, { effort: "high" });
  assert.equal(bodies[1].model, AI_DEFAULTS.strong.id);
  assert.deepEqual(bodies[1].reasoning, { effort: "max" });
  assert.equal(bodies[2].model, AI_DEFAULTS.cheap.id);
  assert.equal(bodies[2].reasoning, undefined);
  for (const body of bodies) assert.equal(body.temperature, undefined);
  assert.equal((await POST(request({ tier: "premium", messages, reasoning: { effort: "high" }, reasoningPreference: "provider" }))).status, 200);
  assert.equal(bodies[3].reasoning, undefined);
  assert.equal((await POST(request({ tier: "cheap", messages, reasoningPreference: "xhigh" }))).status, 200);
  assert.deepEqual(bodies[4].reasoning, { effort: "xhigh" });
  assert.deepEqual(bodies[4].provider, { require_parameters: true });
  for (const [tier, reasoningPreference] of [["premium", "none"], ["cheap", "low"], ["strong", "unlimited"]]) {
    assert.equal((await POST(request({ tier, messages, reasoningPreference }))).status, 400);
  }
  assert.equal(bodies.length, 5);
});

test("truncated reasoning responses are errors, never partially applied plans", async () => {
  localEnv();
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: "unfinished synthetic plan" }, finish_reason: "length" }] });
  const res = await POST(request({ tier: "premium", messages: [{ role: "user", content: "synthetic" }] }));
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /abgeschnitten/);
});
