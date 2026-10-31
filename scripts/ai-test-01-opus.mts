/** One authorized Opus comparison through the actual planning route; no browser writes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { POST } from "../src/app/api/ai/route";
import { AI_REQUEST_LIMITS } from "../src/lib/ai-limits";
import { AI_DEFAULTS } from "../src/lib/ai-config";

const folder = "/private/tmp/stex-ai-test-01-opus-long-2026-10-12";
const original = "/private/tmp/stex-ai-test-01-2026-10-11";
await mkdir(folder, { recursive: true, mode: 0o700 });
const save = (name: string, value: unknown) => writeFile(`${folder}/${name}`, JSON.stringify(value, null, 2), { mode: 0o600 });
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const messagesText = await readFile(`${original}/messages.json`, "utf8");
assert.equal(messagesText, await readFile("/private/tmp/stex-ai-test-01-cheap-2026-10-11/messages.json", "utf8"));
const messages = JSON.parse(messagesText);
assert.equal([...messages[1].content.matchAll(/<DOKUMENTINHALT>/g)].length, 6);
const limits = AI_REQUEST_LIMITS.planning;
const rates = { prompt: 4, completion: 20, request: 0 };
const inputBound = Buffer.byteLength(JSON.stringify(messages)) + 1000;
const upperCost = (inputBound * rates.prompt + limits.maxTokens * rates.completion) / 1e6;
const localLedger = JSON.parse(await readFile("/private/tmp/stex-ai-test-01-repeat-low-2026-10-12/aggregate-billing.json", "utf8"));
assert.ok(localLedger.total + upperCost < 3);
const body = { purpose: "planning", tier: "premium", maxTokens: limits.maxTokens, reasoningPreference: "high", messages };
await save("preparation.json", { inputBound, maxTokens: limits.maxTokens, timeoutMs: limits.timeoutMs, upperCost, previousObservedTotal: localLedger.total, cumulativeBound: localLedger.total + upperCost, messagesHash: hash(messagesText) });
console.log(JSON.stringify({ stage: "prepared", upperCost, previousObservedTotal: localLedger.total, cumulativeBound: localLedger.total + upperCost, maxTokens: limits.maxTokens, timeoutMs: limits.timeoutMs }));
if (!process.argv.includes("--preflight") && !process.argv.includes("--live")) process.exit(0);

const env = parseEnv(await readFile(".env.local", "utf8"));
const premiumKey = env.OPENROUTER_API_KEY_STRONG || env.OPENROUTER_API_KEY;
const cheapKey = env.OPENROUTER_API_KEY_CHEAP || env.OPENROUTER_API_KEY;
const model = env.OPENROUTER_MODEL_PREMIUM || AI_DEFAULTS.premium.id;
assert.ok(premiumKey && cheapKey && premiumKey !== cheapKey, "The comparison expects the two previously measured separate keys.");
assert.equal(model, "anthropic/claude-opus-5.5", "Do not silently change the authorized model.");
const networkFetch = globalThis.fetch;
const readUsage = async (key: string) => {
  const response = await networkFetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  return { usage: data.usage as number, remaining: data.limit_remaining as number | null };
};
const [premium, cheap, endpointResponse] = await Promise.all([
  readUsage(premiumKey), readUsage(cheapKey),
  networkFetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`, { signal: AbortSignal.timeout(30_000) }),
]);
assert.equal(endpointResponse.status, 200);
const endpoints = (await endpointResponse.json()).data.endpoints;
const provider = endpoints.find((entry: { provider_name: string; tag: string }) => entry.provider_name === "Claude Platform on AWS" && entry.tag === "claude-on-aws");
assert.ok(provider && provider.context_length >= inputBound + limits.maxTokens && provider.max_completion_tokens >= limits.maxTokens);
assert.ok(provider.supported_parameters.includes("reasoning"));
assert.ok(Number(provider.pricing.prompt) * 1e6 <= rates.prompt && Number(provider.pricing.completion) * 1e6 <= rates.completion);
const priorTotal = Math.max(localLedger.total, premium.usage - 7.329598546 + cheap.usage - 0.003791625);
assert.ok(priorTotal + upperCost <= 3, "Current cumulative cost plus this bounded request exceeds $3.");
assert.ok(premium.remaining === null || premium.remaining >= upperCost, "Insufficient key allowance.");
await save("preflight.json", { at: new Date().toISOString(), model, provider: provider.provider_name, pricing: provider.pricing, maxCompletionTokens: provider.max_completion_tokens, premium, cheap, priorTotal, upperCost, cumulativeBound: priorTotal + upperCost });
console.log(JSON.stringify({ stage: "preflight", model, provider: provider.provider_name, priorTotal, upperCost, cumulativeBound: priorTotal + upperCost }));
if (!process.argv.includes("--live")) process.exit(0);

await writeFile(`${folder}/attempt.json`, JSON.stringify({ at: new Date().toISOString(), model, provider: provider.provider_name, maxTokens: limits.maxTokens, timeoutMs: limits.timeoutMs, priorTotal, upperCost, cumulativeBound: priorTotal + upperCost, messagesHash: hash(messagesText) }, null, 2), { mode: 0o600, flag: "wx" });
await writeFile(`${folder}/messages.json`, messagesText, { mode: 0o600 });
process.env = { ...process.env, NODE_ENV: "test", OPENROUTER_API_KEY_STRONG: premiumKey, OPENROUTER_MODEL_PREMIUM: model };
let calls = 0;
let providerResult: Record<string, unknown> | undefined;
globalThis.fetch = async (url, init) => {
  assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(++calls, 1, "No automatic paid retry.");
  const outbound = JSON.parse(init!.body as string);
  assert.deepEqual(outbound.messages, messages);
  assert.equal(outbound.max_tokens, limits.maxTokens);
  assert.equal(outbound.model, model);
  assert.deepEqual(outbound.reasoning, { effort: "high" });
  // Only constrain destination and prices; preserve the route's actual non-streamed call.
  outbound.provider = { ...outbound.provider, only: ["Claude Platform on AWS"], allow_fallbacks: false, max_price: rates };
  await save("request.json", { model: outbound.model, maxTokens: outbound.max_tokens, reasoning: outbound.reasoning, provider: outbound.provider, messagesHash: hash(JSON.stringify(outbound.messages)), requestHash: hash(JSON.stringify(outbound)) });
  const response = await networkFetch(url, { ...init, body: JSON.stringify(outbound) });
  const data = await response.json();
  // Store visible output and accounting only, never raw reasoning text.
  providerResult = {
    id: data.id, model: data.model, provider: data.provider,
    choices: data.choices?.map((choice: { finish_reason: unknown; message?: { content?: unknown } }) => ({ finish_reason: choice.finish_reason, message: { role: "assistant", content: choice.message?.content } })),
    usage: data.usage,
    error: data.error ? { code: data.error.code, message: data.error.message } : undefined,
  };
  await save("response.json", providerResult);
  return Response.json(data, { status: response.status });
};
const start = Date.now();
const progress = setInterval(() => console.log(JSON.stringify({ stage: "waiting-for-opus", seconds: Math.round((Date.now() - start) / 1000) })), 45_000);
let status: number | undefined;
try {
  const response = await POST(new Request("http://localhost:3000/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const result = await response.json();
  status = response.status;
  await save("route-result.json", { status, ...result });
  await save("outcome.json", { elapsedMs: Date.now() - start, routeStatus: status, calls, model, maxTokens: limits.maxTokens, timeoutMs: limits.timeoutMs, providerResult });
  console.log(JSON.stringify({ stage: "complete", seconds: (Date.now() - start) / 1000, status, calls, model, usage: providerResult?.usage, error: result.error }));
} finally {
  clearInterval(progress);
  globalThis.fetch = networkFetch;
  const [premiumAfter, cheapAfter] = await Promise.all([readUsage(premiumKey), readUsage(cheapKey)]);
  const total = premiumAfter.usage - 7.329598546 + cheapAfter.usage - 0.003791625;
  await save("aggregate-billing.json", { at: new Date().toISOString(), premium: premiumAfter, cheap: cheapAfter, total, currentCallObservedCost: premiumAfter.usage - premium.usage });
  console.log(JSON.stringify({ stage: "billing", total, currentCallObservedCost: premiumAfter.usage - premium.usage }));
}
if (status !== 200) process.exitCode = 1;
