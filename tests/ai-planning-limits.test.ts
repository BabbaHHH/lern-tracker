import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/ai/route";
import { AI_DEFAULTS } from "../src/lib/ai-config";
import { getPlanModelInfo, getKorrekturModel } from "../src/lib/ai-models";

const originalEnv = process.env;
const originalFetch = globalThis.fetch;
afterEach(() => {
  process.env = originalEnv;
  globalThis.fetch = originalFetch;
});

function request(body: Record<string, unknown> = {}, signal?: AbortSignal) {
  process.env = { ...originalEnv, NODE_ENV: "test", OPENROUTER_API_KEY: "synthetic-key" };
  for (const key of ["OPENROUTER_API_KEY_STRONG", "OPENROUTER_API_KEY_TEST", "OPENROUTER_MODEL_PREMIUM"]) delete process.env[key];
  return new Request("http://localhost:3000/api/ai", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ tier: "premium", messages: [{ role: "user", content: "synthetic plan" }], ...body }),
  });
}

test("a four-minute planning response survives the old deadline; ordinary requests still time out", async t => {
  // Advance a controlled deadline clock without waiting or contacting a provider.
  let now = 0;
  const deadlines: { at: number; controller: AbortController }[] = [];
  t.mock.method(AbortSignal, "timeout", (ms: number) => {
    const controller = new AbortController();
    deadlines.push({ at: now + ms, controller });
    return controller.signal;
  });
  const advance = (ms: number) => {
    now += ms;
    for (const deadline of deadlines) {
      if (deadline.at <= now) deadline.controller.abort(new DOMException("Deadline", "TimeoutError"));
    }
  };
  let start!: () => void, finish!: () => void;
  let ready = new Promise<void>(resolve => { start = resolve; });
  let providerSignal: AbortSignal;
  const bodies: { max_tokens: number }[] = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init!.body as string));
    providerSignal = init!.signal!;
    return new Promise<Response>((resolve, reject) => {
      const aborted = () => reject(providerSignal.reason);
      providerSignal.addEventListener("abort", aborted, { once: true });
      finish = () => {
        providerSignal.removeEventListener("abort", aborted);
        resolve(Response.json({ choices: [{ finish_reason: "stop", message: { content: "complete synthetic plan" } }] }));
      };
      start();
    });
  };

  const planning = POST(request({ purpose: "planning" }));
  await ready;
  advance(240_000);
  assert.equal(providerSignal!.aborted, false);
  assert.equal(bodies[0].max_tokens, 50_000);
  finish();
  const result = await planning;
  assert.equal(result.status, 200);
  assert.equal((await result.json()).reply, "complete synthetic plan");

  ready = new Promise<void>(resolve => { start = resolve; });
  const ordinary = POST(request());
  await ready;
  advance(115_000);
  const timeout = await ordinary;
  assert.equal(timeout.status, 504);
  assert.match((await timeout.json()).error, /Zeitlimit/);
  assert.equal(bodies[1].max_tokens, 16_000);
});

test("planning accepts the selected Opus allowance, correction retains its existing allowance", async () => {
  const planModel = getPlanModelInfo(AI_DEFAULTS.premium.id);
  assert.equal(getKorrekturModel(AI_DEFAULTS.premium.id)!.maxTokens, 16_000);
  let sent: Record<string, unknown> | undefined;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(init!.body as string);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: "synthetic" } }] });
  };
  const response = await POST(request({ purpose: "planning", model: planModel.id, maxTokens: planModel.maxTokens, reasoning: planModel.reasoning }));
  assert.equal(response.status, 200);
  assert.equal(sent!.max_tokens, 50_000);
  assert.deepEqual(sent!.reasoning, { effort: "high" });
});

test("unknown purposes and excessive budgets are rejected before any provider call", async () => {
  globalThis.fetch = async () => { throw new Error("Unexpected provider request"); };
  for (const body of [
    { purpose: "planning", maxTokens: 50_001 },
    { maxTokens: 16_001 },
    { purpose: "planning", maxTokens: -1 },
    { purpose: "planning", maxTokens: 2.5 },
    { purpose: "unlimited" }, { purpose: null }, { purpose: {} },
  ]) assert.equal((await POST(request(body))).status, 400);
});

test("planning still has a finite fifteen-minute deadline and respects caller cancellation", async t => {
  let deadline!: AbortController;
  t.mock.method(AbortSignal, "timeout", (ms: number) => {
    assert.equal(ms, 900_000);
    deadline = new AbortController();
    return deadline.signal;
  });
  for (const cancelByCaller of [false, true]) {
    let start!: () => void;
    const ready = new Promise<void>(resolve => { start = resolve; });
    globalThis.fetch = async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
      start();
    });
    const caller = new AbortController();
    const pending = POST(request({ purpose: "planning" }, caller.signal));
    await ready;
    if (cancelByCaller) caller.abort();
    else deadline.abort(new DOMException("Deadline", "TimeoutError"));
    const response = await pending;
    assert.notEqual(response.status, 200);
    assert.equal((await response.json()).reply, undefined);
    if (!cancelByCaller) assert.equal(response.status, 504);
  }
});

test("a token-truncated planning response is not returned as a usable plan", async () => {
  globalThis.fetch = async () => Response.json({ choices: [{ finish_reason: "length", message: { content: "incomplete synthetic plan" } }] });
  const response = await POST(request({ purpose: "planning" }));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /abgeschnitten/);
});
