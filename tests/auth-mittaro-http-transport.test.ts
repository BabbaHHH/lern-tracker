import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createMittaroHttpTransport, type MittaroFetchBindings } from "../src/lib/server/auth/mittaro-http-transport";
import { readMittaroHttpConfig } from "../src/lib/server/auth/mittaro-http-config";
import type { DispatchMail } from "../src/lib/server/auth/mail-transport";
import type { AuthEnvironment } from "../src/lib/server/auth/production-config";

const baseURL = "https://stex.example.de";
const apiKey = `tx_live_${createHash("sha256").update("synthetic-only").digest("hex")}`;
const mail: DispatchMail = {
  id: "synthetic-outbox-1", email: "member@example.de", purpose: "invitation",
  url: `${baseURL}/konto/einrichten?token=synthetic-token&email=member%40example.de`,
};
function env(): AuthEnvironment {
  return { NODE_ENV: "production", STEX_AUTH_MODE: "production", STEX_MITTARO_API_KEY: apiKey,
    STEX_MITTARO_FROM_ADDRESS: "noreply@mail.stex-tracker.de", STEX_MITTARO_FROM_NAME: "Stex Tracker" };
}
function harness(reply: Response | Error | "timeout") {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  const bindings: MittaroFetchBindings = {
    timeoutMs: 100,
    timer: (callback, milliseconds) => setTimeout(callback, milliseconds),
    clearTimer: timer => clearTimeout(timer),
    fetch: async (input, init) => {
      calls.push({ input, init });
      if (reply === "timeout") return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error(`private ${apiKey} ${mail.url}`)), { once: true });
      });
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { calls, bindings };
}

test("config stays fixed to the verified sender domain and never changes credentials", () => {
  const input = env();
  assert.equal(readMittaroHttpConfig(input, baseURL).endpoint, "https://api.mittaro.de/v1/emails");
  for (const patch of [
    { STEX_MITTARO_FROM_ADDRESS: "noreply@other.example" },
    { STEX_MITTARO_API_KEY: "short" },
  ]) assert.throws(() => readMittaroHttpConfig({ ...input, ...patch }, baseURL));
  assert.throws(() => readMittaroHttpConfig(input, "http://api.mittaro.de"));
});

test("202 accepted makes one fixed HTTPS request with a stable idempotency key", async () => {
  const h = harness(new Response('{"id":"email_synthetic1234","status":"queued"}', { status: 202 }));
  const result = await createMittaroHttpTransport(env(), baseURL, h.bindings).send(mail, new AbortController().signal);
  assert.deepEqual(result, { outcome: "accepted" });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].input, "https://api.mittaro.de/v1/emails");
  assert.equal(h.calls[0].init.method, "POST");
  assert.equal(h.calls[0].init.redirect, "error");
  const headers = new Headers(h.calls[0].init.headers);
  assert.equal(headers.get("Authorization"), `Bearer ${apiKey}`);
  assert.equal(headers.get("Idempotency-Key"), `stex-auth-${createHash("sha256").update(mail.id).digest("hex")}`);
  const body = JSON.parse(String(h.calls[0].init.body));
  assert.equal(body.to, mail.email);
  assert.equal(body.from, "noreply@mail.stex-tracker.de");
  assert.equal(body.text.includes(mail.url), true);
});

test("Einladung, Verification und Reset behalten die drei erlaubten Linkformen", async () => {
  const h = harness(new Response('{"id":"email_synthetic1234","status":"queued"}', { status: 202 }));
  const transport = createMittaroHttpTransport(env(), baseURL, h.bindings);
  const samples: DispatchMail[] = [
    mail,
    { ...mail, id: "synthetic-verify-2", purpose: "verification",
      url: `${baseURL}/api/auth/verify-email?token=synthetic.token&callbackURL=%2Fkonto` },
    { ...mail, id: "synthetic-reset-3", purpose: "reset",
      url: `${baseURL}/api/auth/reset-password/synthetic-token?callbackURL=%2Fkonto` },
  ];
  for (const sample of samples) assert.deepEqual(await transport.send(sample, new AbortController().signal), { outcome: "accepted" });
  assert.deepEqual(h.calls.map(call => JSON.parse(String(call.init.body)).subject), [
    "Deine Einladung zum Stex Tracker", "Deine E-Mail-Adresse bestätigen", "Dein Passwort zurücksetzen",
  ]);
});

test("dokumentierte Ablehnung ist terminal und Providertext bleibt unsichtbar", async () => {
  const privateText = `diagnostic bearer ${apiKey} ${mail.url}`;
  const h = harness(new Response(privateText, { status: 403 }));
  const result = await createMittaroHttpTransport(env(), baseURL, h.bindings).send(mail, new AbortController().signal);
  assert.deepEqual(result, { outcome: "not_accepted", retryable: false });
  assert.equal(JSON.stringify(result).includes(apiKey), false);
  assert.equal(JSON.stringify(result).includes(mail.url), false);
  assert.equal(h.calls.length, 1);
});

test("Timeout und Transportfehler bleiben unknown ohne zweiten Aufruf oder Geheimnistext", async () => {
  for (const reply of ["timeout", new Error(`private ${apiKey} ${mail.url}`)] as const) {
    const h = harness(reply);
    const result = await createMittaroHttpTransport(env(), baseURL, h.bindings).send(mail, new AbortController().signal);
    assert.deepEqual(result, { outcome: "unknown" });
    assert.equal(h.calls.length, 1);
    assert.equal(JSON.stringify(result).includes(apiKey), false);
    assert.equal(JSON.stringify(result).includes(mail.url), false);
  }
});

test("unzulässiger Zweck, Empfänger oder fremde URL werden vor fetch abgewiesen", async () => {
  const h = harness(new Response("{}", { status: 202 }));
  const transport = createMittaroHttpTransport(env(), baseURL, h.bindings);
  assert.deepEqual(await transport.send({ ...mail, purpose: "other" as DispatchMail["purpose"] }, new AbortController().signal),
    { outcome: "not_accepted", retryable: false });
  assert.deepEqual(await transport.send({ ...mail, email: "other@example.de" }, new AbortController().signal),
    { outcome: "not_accepted", retryable: false });
  assert.deepEqual(await transport.send({ ...mail, url: "https://evil.example/konto/einrichten?token=x" }, new AbortController().signal),
    { outcome: "not_accepted", retryable: false });
  assert.equal(h.calls.length, 0);
});
