/** Local causal probes: production route, synthetic provider responses, zero external calls. */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { POST } from "../src/app/api/ai/route";
import { AI_DEFAULTS, supportsReasoning } from "../src/lib/ai-config";
import { parseStructuredPlan } from "../src/lib/plan-applier";

const folder = "/private/tmp/stex-ai-test-01-diagnose-2026-10-11";
await mkdir(folder, { recursive: true, mode: 0o700 });
const messages = JSON.parse(await readFile("/private/tmp/stex-ai-test-01-cheap-2026-10-11/messages.json", "utf8"));
const originalEnv = process.env;
const originalFetch = globalThis.fetch;
const originalTimeout = AbortSignal.timeout;
const fakePlan = "```json\n{\"tasks\":[],\"klausuren\":[]}\n```";
type Mode = "success" | "timeout" | "length";
type Capture = { model: string; inputCharacters: number; maxTokens: number; streaming: boolean; reasoning: unknown; credentialGroup: string };
const results: Record<string, unknown>[] = [];
const localCases = [
  { name: "full-request-default", body: {}, mode: "success", status: 200, calls: 1 },
  { name: "larger-token-limit", body: { maxTokens: 65536 }, mode: "success", status: 400, calls: 0 },
  { name: "low-reasoning", body: { reasoningPreference: "low" }, mode: "success", status: 400, calls: 0 },
  { name: "client-timeout-and-stream-options", body: { timeoutMs: 600000, stream: true }, mode: "success", status: 200, calls: 1 },
  { name: "server-timeout-error", body: {}, mode: "timeout", status: 500, calls: 1 },
  { name: "token-length-error", body: {}, mode: "length", status: 502, calls: 1 },
  { name: "explicit-cheap-model-credential", body: { model: AI_DEFAULTS.cheap.id }, mode: "success", status: 200, calls: 1 },
] as const;
try {
  process.env = { ...originalEnv, NODE_ENV: "test", OPENROUTER_API_KEY: "synthetic-main", OPENROUTER_API_KEY_CHEAP: "synthetic-cheap", OPENROUTER_API_KEY_STRONG: "synthetic-strong", OPENROUTER_API_KEY_TEST: "synthetic-correction" };
  for (const name of ["OPENROUTER_MODEL_CHEAP", "OPENROUTER_MODEL_STRONG", "OPENROUTER_MODEL_PREMIUM"]) delete process.env[name];
  for (const probe of localCases) {
    const captures: Capture[] = [], timeoutMilliseconds: number[] = [];
    Object.defineProperty(AbortSignal, "timeout", { configurable: true, writable: true, value: (milliseconds: number) => {
      timeoutMilliseconds.push(milliseconds);
      return (probe.mode as Mode) === "timeout" ? AbortSignal.abort(new DOMException("Synthetic deadline", "TimeoutError")) : new AbortController().signal;
    } });
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://openrouter.ai/api/v1/chat/completions");
      const sent = JSON.parse(init!.body as string);
      const auth = new Headers(init?.headers).get("authorization");
      captures.push({ model: sent.model, inputCharacters: sent.messages.reduce((sum: number, message: { content: string }) => sum + message.content.length, 0), maxTokens: sent.max_tokens, streaming: sent.stream === true, reasoning: sent.reasoning ?? null, credentialGroup: auth === "Bearer synthetic-cheap" ? "cheap" : auth === "Bearer synthetic-correction" ? "correction" : "other" });
      if (init?.signal?.aborted) throw init.signal.reason;
      return Response.json({ choices: [{ finish_reason: probe.mode === "length" ? "length" : "stop", message: { content: fakePlan } }] });
    };
    const response = await POST(new Request("http://localhost:3000/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: "cheap", messages, ...probe.body }) }));
    const data = await response.json();
    assert.equal(response.status, probe.status, probe.name);
    assert.equal(captures.length, probe.calls, probe.name);
    if (captures.length) assert.deepEqual(timeoutMilliseconds, [115000]);
    if (probe.name === "full-request-default") {
      assert.equal(captures[0].maxTokens, 16000);
      assert.equal(captures[0].streaming, false);
      assert.equal(captures[0].reasoning, null);
      assert.equal(captures[0].credentialGroup, "cheap");
    }
    if (probe.name === "explicit-cheap-model-credential") assert.equal(captures[0].credentialGroup, "correction");
    if (probe.name === "client-timeout-and-stream-options") assert.equal(captures[0].streaming, false);
    results.push({ name: probe.name, status: response.status, error: data.error ?? null, syntheticReplyParsed: typeof data.reply === "string" ? !!parseStructuredPlan(data.reply) : false, timeoutMilliseconds, captures });
  }
  const modelModes = { low: supportsReasoning(AI_DEFAULTS.cheap.id, "low"), xhigh: supportsReasoning(AI_DEFAULTS.cheap.id, "xhigh"), max: supportsReasoning(AI_DEFAULTS.cheap.id, "max") };
  const parser = { fencedJson: !!parseStructuredPlan(fakePlan), rawJson: !!parseStructuredPlan('{"tasks":[],"klausuren":[]}') };
  const files = ["src/lib/ai.ts", "src/app/api/ai/route.ts", "src/lib/ai-config.ts", "src/lib/ai-settings.ts", "src/lib/prompt-context.ts", "src/lib/prompts.ts"];
  const fileHashes = await Promise.all(files.map(async path => ({ path, sha256: createHash("sha256").update(await readFile(path)).digest("hex") })));
  const report = { simulated: true, externalCalls: 0, cases: results, modelModes, parser, fileHashes };
  await writeFile(folder + "/local-probes.json", JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
} finally {
  process.env = originalEnv;
  globalThis.fetch = originalFetch;
  Object.defineProperty(AbortSignal, "timeout", { configurable: true, writable: true, value: originalTimeout });
}
