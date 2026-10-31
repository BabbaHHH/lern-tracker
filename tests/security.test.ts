import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, rm, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { requireLocalAccess, readJson, limitRequests } from "../src/lib/server/request-safety";
import { findLocalPdf } from "../src/lib/server/pdf-files";
import { POST as ai } from "../src/app/api/ai/route";
import { POST as parse } from "../src/app/api/docs/parse/route";
import { POST as tag } from "../src/app/api/docs/tag/route";
import { POST as preview } from "../src/app/api/pdf-open/route";
import { GET as pdf } from "../src/app/api/pdf-file/route";
import { GET as credits } from "../src/app/api/openrouter-credits/route";
import { GET as models } from "../src/app/api/openrouter-models/route";
import { GET as lan } from "../src/app/api/lan-url/route";
import { GET as feedbackInbox, POST as feedbackWrite } from "../src/app/api/feedback/route";
import { NextRequest } from "next/server";

const originalEnv = process.env;
afterEach(() => { process.env = originalEnv; });
function localEnv(extra: Record<string, string> = {}) { process.env = { ...originalEnv, NODE_ENV: "test", ...extra }; }
function request(body: unknown, url = "http://localhost:3000/api/ai") {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("every server route is denied in production before accessing keys or files", async () => {
  process.env = { ...originalEnv, NODE_ENV: "production" };
  for (const handler of [ai, parse, tag, preview, feedbackWrite]) {
    const response = await handler(new NextRequest(request({})));
    assert.equal(response.status, 403, handler.name);
  }
  for (const handler of [pdf, credits, models, lan, feedbackInbox]) {
    const response = await handler(new NextRequest("http://localhost:3000/api/test"));
    assert.equal(response.status, 403);
  }
});

test("local access rejects external hosts, rebinding and foreign browser origins", () => {
  localEnv();
  assert.doesNotThrow(() => requireLocalAccess(new Request("http://localhost:3000/api/test")));
  for (const req of [
    new Request("https://public.example/api/test"),
    new Request("http://localhost:3000/api/test", { headers: { host: "evil.example:3000" } }),
    new Request("http://localhost:3000/api/test", { headers: { origin: "https://evil.example" } }),
    new Request("http://localhost:3000/api/test", { headers: { "sec-fetch-site": "cross-site" } }),
  ]) assert.throws(() => requireLocalAccess(req), { status: 403 });
  localEnv({ LOCAL_ALLOWED_ORIGINS: "http://192.168.1.7:3000" });
  assert.doesNotThrow(() => requireLocalAccess(new Request("http://192.168.1.7:3000/api/test")));
  assert.throws(() => requireLocalAccess(new Request("http://192.168.1.8:3000/api/test")), { status: 403 });
});

test("JSON reader rejects null, invalid JSON, wrong media type and oversized streamed bodies", async () => {
  await assert.rejects(readJson(request(null)), { status: 400 });
  await assert.rejects(readJson(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })), { status: 400 });
  await assert.rejects(readJson(new Request("http://localhost", { method: "POST", body: "{}" })), { status: 415 });
  await assert.rejects(readJson(request({ value: "x".repeat(200) }), 100), { status: 413 });
  assert.deepEqual(await readJson(request({ ok: true })), { ok: true });
});

test("AI validates limits before making any provider request", async () => {
  localEnv();
  for (const body of [null, { messages: [{}] }, { messages: [{ role: "user", content: "x" }], maxTokens: 999999 },
    { messages: [{ role: "user", content: "x" }], model: "bad model" },
    { messages: [{ role: "tool", content: "x" }] }, { messages: [{ role: "user", content: "x" }], reasoning: { effort: "unlimited" } }]) {
    assert.equal((await ai(request(body))).status, 400);
  }
});

test("request budget renews only after its window", () => {
  limitRequests("test", 2, 1000);
  limitRequests("test", 2, 1001);
  assert.throws(() => limitRequests("test", 2, 1002), { status: 429 });
  assert.doesNotThrow(() => limitRequests("test", 2, 61_000));
});

test("local feedback persists once, retries are idempotent, LAN readers and invalid messages are denied", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stex-feedback-")); const previousCwd = process.cwd();
  try {
    process.chdir(root); localEnv({ LOCAL_ALLOWED_ORIGINS: "http://192.168.1.7:3000" });
    const item = { id: crypto.randomUUID(), category: "bug", text: "Synthetische Testmeldung", page: "/wochenplan", createdAt: new Date().toISOString(), version: "test" };
    assert.equal((await feedbackWrite(request(item, "http://localhost:3000/api/feedback"))).status, 201);
    assert.equal((await feedbackWrite(request(item, "http://localhost:3000/api/feedback"))).status, 201);
    assert.equal((await feedbackWrite(request({ ...item, text: "Geänderte Nachricht" }, "http://localhost:3000/api/feedback"))).status, 409);
    const result = await (await feedbackInbox(new Request("http://localhost:3000/api/feedback"))).json();
    assert.equal(result.feedback.length, 1); assert.equal(result.feedback[0].text, item.text);
    assert.equal((await feedbackInbox(new Request("http://192.168.1.7:3000/api/feedback"))).status, 403);
    assert.equal((await feedbackWrite(request({ ...item, id: "../../private" }))).status, 400);
  } finally { process.chdir(previousCwd); await rm(root, { recursive: true }); }
});

test("PDF resolver supports legacy names but blocks traversal and escaping symlinks", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "stex-pdf-")));
  const outside = await mkdtemp(path.join(os.tmpdir(), "stex-outside-"));
  try {
    localEnv({ PDF_BASE_PATH: root });
    const original = path.join(root, "Fall_komplett.pdf");
    await writeFile(original, "%PDF-1.4\n");
    assert.equal(await findLocalPdf("Fall.pdf"), original);
    const safeName = 'Fall $(echo unused) `unused`.PDF';
    await writeFile(path.join(root, safeName), "%PDF-1.4\n");
    assert.equal(await findLocalPdf(safeName), path.join(root, safeName));
    for (const name of ["../Fall.pdf", "..\\Fall.pdf", "/etc/file.pdf", "Fall.pdf\u0000", 42, null]) {
      await assert.rejects(findLocalPdf(name), { status: 400 });
    }
    await writeFile(path.join(outside, "private.pdf"), "%PDF-1.4\n");
    await symlink(path.join(outside, "private.pdf"), path.join(root, "escape.pdf"));
    await assert.rejects(findLocalPdf("escape.pdf"), { status: 403 });
    await assert.rejects(findLocalPdf("missing.pdf"), { status: 404 });
  } finally { await rm(root, { recursive: true }); await rm(outside, { recursive: true }); }
});
