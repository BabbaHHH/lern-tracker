import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

type Environment = Record<string, string | undefined>;
type Guard = (feature: "planning" | "checkin" | "correction") => Response | null;
type Handler = (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
type Routes = Record<string, Handler>;
const production = { NODE_ENV: "production", STEX_AUTH_MODE: "production" };
const local = { NODE_ENV: "development", STEX_AUTH_MODE: "local" };
const learningRoutes = [
  ["checkin/route.ts", "GET"], ["checkin/route.ts", "POST"],
  ["checkin/commands/[requestId]/route.ts", "GET"],
  ["correction/route.ts", "GET"], ["correction/route.ts", "POST"],
  ["correction/commands/[requestId]/route.ts", "GET"],
] as const;

// Execute the current handler source, but allow only explicit synthetic imports.
// The VM has no real process environment, filesystem, DB, credentials or network.
function sourceModule<T>(file: string, env: Environment, dependencies: Record<string, unknown> = {}): T {
  const filename = resolve(file);
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const compiledModule = { exports: {} };
  new Script(compiled, { filename }).runInNewContext({ module: compiledModule, exports: compiledModule.exports, Response, Request, URL, Buffer,
    process: { env: Object.freeze({ ...env }) },
    require(name: string) {
      if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return compiledModule.exports as T;
}
function guard(env: Environment): Guard {
  return sourceModule<{ deferredPilotAiResponse: Guard }>("src/lib/server/pilot-ai-guard.ts", env).deferredPilotAiResponse;
}
function request(path: string, method = "GET", body?: Record<string, unknown>) {
  return new Request(`https://pilot.example.test/api/${path}?enableAi=1`, {
    method,
    headers: { "Content-Type": "application/json", cookie: "better-auth.session_token=synthetic-session",
      origin: "https://pilot.example.test", "x-stex-action": "1", "x-stex-ai-enabled": "true", "x-forwarded-host": "localhost" },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
}
async function disabled(response: Response) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const value = await response.json();
  assert.equal(value.contractVersion, 1);
  assert.equal(value.error.code, "pilot_ai_deferred");
  assert.match(value.error.message, /im ersten Pilot noch nicht verfügbar/);
  assert.doesNotMatch(JSON.stringify(value), /synthetic-session|synthetic-key|PRIVATE_INPUT/);
}
function learning(file: string, env: Environment) {
  const calls = { runtime: 0, http: 0, failure: 0, params: 0 };
  const run = async () => { calls.runtime++; return { synthetic: true }; };
  const http = async (_request: Request, _service: unknown, id?: string) => { calls.http++; return Response.json({ id: id ?? null, synthetic: true }); };
  const handlers = sourceModule<Routes>(`src/app/api/learning/${file}`, env, {
    "@/lib/server/pilot-ai-guard": { deferredPilotAiResponse: guard(env) },
    "@/lib/server/learning/runtime": { checkinRuntime: run, correctionRuntime: run },
    "@/lib/server/learning/checkin-http": { checkinHTTP: http },
    "@/lib/server/learning/correction-http": { correctionHTTP: http },
    "@/lib/server/auth/security": { accountFailure: () => { calls.failure++; return Response.json({}, { status: 500 }); } },
  });
  const params = { then(done: (value: { requestId: string }) => void) { calls.params++; done({ requestId: "synthetic-command" }); } } as unknown as Promise<{ requestId: string }>;
  return { handlers, calls, context: { params } };
}

test("Pilotguard: alle drei Funktionen bleiben in Produktion, Mischmodi und unbekannter Umgebung geschlossen", async () => {
  for (const env of [production, { NODE_ENV: "production", STEX_AUTH_MODE: "local" }, { ...local, STEX_AUTH_MODE: "production" }, {},
    { ...production, STEX_AI_ENABLED: "1", STEX_PILOT_AI_RELEASED: "true" }]) {
    for (const feature of ["planning", "checkin", "correction"] as const) await disabled(guard(env)(feature)!);
  }
});
test("Pilotguard: bestehende Entwicklungs- und synthetische Testumgebung bleiben lokal nutzbar", () => {
  for (const env of [local, { NODE_ENV: "test" }]) for (const feature of ["planning", "checkin", "correction"] as const) assert.equal(guard(env)(feature), null);
});
for (const [file, method] of learningRoutes) test(`Produktionsgrenze vor Runtime/HTTP und direktem Unterroutenaufruf: ${method} ${file}`, async () => {
  const h = learning(file, production), req = request(`learning/${file.replace("route.ts", "")}`, method, { action: "run", content: "PRIVATE_INPUT" });
  await disabled(await h.handlers[method](req, h.context));
  assert.equal(req.bodyUsed, false);
  assert.deepEqual(h.calls, { runtime: 0, http: 0, failure: 0, params: 0 });
});
test("Produktionsgrenze umfasst Check-in-Übernahme und Korrektur-Verwaltungsaktionen ohne Seiteneffekt", async () => {
  for (const [file, actions] of [["checkin/route.ts", ["ask", "apply"]], ["correction/route.ts", ["run", "settings", "reset", "abandon"]]] as const) {
    for (const action of actions) {
      const h = learning(file, production);
      await disabled(await h.handlers.POST(request("learning/synthetic", "POST", { action, apiKey: "PRIVATE_INPUT" }), h.context));
      assert.deepEqual(h.calls, { runtime: 0, http: 0, failure: 0, params: 0 });
    }
  }
});
test("Lokale Lernrouten und Status-Unterseiten erreichen weiterhin ihren vorhandenen Anschluss", async () => {
  for (const [file, method] of learningRoutes) {
    const h = learning(file, local), response = await h.handlers[method](request("learning/synthetic", method), h.context);
    assert.equal(response.status, 200);
    assert.equal(h.calls.runtime, 1); assert.equal(h.calls.http, 1); assert.equal(h.calls.failure, 0);
    assert.equal(h.calls.params, file.includes("commands") ? 1 : 0);
  }
});

function ai(env: Environment) {
  const calls = { runtime: 0, origin: 0, credential: 0, provider: 0, current: 0 };
  const safety = sourceModule<Record<string, unknown>>("src/lib/server/request-safety.ts", env, { "next/server": { NextResponse: { json: Response.json } } });
  const handlers = sourceModule<Routes>("src/app/api/ai/route.ts", env, {
    "next/server": { NextResponse: { json: Response.json } },
    "@/lib/server/pilot-ai-guard": { deferredPilotAiResponse: guard(env) },
    "@/lib/server/request-safety": safety,
    "@/lib/ai": { AiProviderError: class extends Error {}, chatCompletion: async () => { calls.provider++; return "synthetic reply"; } },
    "@/lib/ai-config": { isReasoningPreference: () => true, REASONING_EFFORTS: [] },
    "@/lib/ai-limits": { AI_REQUEST_LIMITS: { general: { maxTokens: 16000 }, planning: { maxTokens: 50000 } } },
    "@/lib/server/auth/security": { accountResponse: Response.json, accountFailure: () => Response.json({}, { status: 503 }) },
    "@/lib/server/ai-credentials/runtime": {
      isAccountAiRequest: (r: Request) => !!r.headers.get("cookie"),
      sameOriginAiRequest: () => { calls.origin++; },
      aiCredentialRuntime: async () => { calls.runtime++; return { auth: { baseURL: "https://pilot.example.test" },
        resolveSelected: async () => { calls.credential++; return { apiKey: "synthetic-key", source: "own" }; },
        assertAccessCurrent: async () => { calls.current++; },
      }; },
    },
  });
  return { handlers, calls };
}
test("Lernplangenerierung endet vor Runtime/Schlüssel/Provider, mit oder ohne Kontocookie", async () => {
  for (const account of [true, false]) {
    const h = ai(production), req = request("ai", "POST", { purpose: "planning", messages: [{ role: "user", content: "PRIVATE_INPUT" }] });
    if (!account) req.headers.delete("cookie");
    await disabled(await h.handlers.POST(req, { params: Promise.resolve({ requestId: "unused" }) }));
    assert.deepEqual(h.calls, { runtime: 0, origin: 0, credential: 0, provider: 0, current: 0 });
  }
});
test("Allgemeiner KI-Zweck erhält den bestehenden Anschluss; lokale Planung ebenso (nur synthetische Stubs)", async () => {
  for (const [env, purpose] of [[production, "general"], [local, "planning"]] as const) {
    const h = ai(env), response = await h.handlers.POST(request("ai", "POST", { purpose, messages: [{ role: "user", content: "synthetic" }] }), { params: Promise.resolve({ requestId: "unused" }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, "synthetic reply");
    assert.deepEqual(h.calls, { runtime: 1, origin: 1, credential: 1, provider: 1, current: 1 });
  }
});

function panel(file: string, name: string, env: Environment) {
  let hooks = 0;
  const unexpectedHook = () => { hooks++; throw Error("Deferred panel must not mount its local hook"); };
  const exports = sourceModule<Record<string, (props: unknown) => React.ReactElement>>(`src/components/${file}`, env, {
    react: React, "react/jsx-runtime": jsx, "next/link": () => null,
    "@tiptap/react": {}, "@/lib/learning/correction-core": {}, "@/lib/ai-models": { KORREKTUR_MODELS: [] },
    "@/lib/topics": { TOPICS: [] }, "@/lib/learning/personal-contract": {}, "./ui/button": {},
    "@/lib/learning/use-account-checkin": { useAccountCheckin: unexpectedHook },
    "@/lib/learning/use-account-correction": { useAccountCorrection: unexpectedHook },
  });
  const element = exports[name]({ account: { userId: "synthetic", accessGeneration: 1, sessionContext: "synthetic" }, onApplied: () => {} });
  return { element, hooks: () => hooks };
}
test("Produktionsoberfläche zeigt die Vertagung ohne KI-Hooks; manuelles Schreiben/Fortschritt bleibt ausdrücklich nutzbar", () => {
  for (const [file, name, manual] of [["account-checkin-panel.tsx", "AccountCheckinPanel", "Lernfortschritt weiterhin manuell"], ["account-correction-panel.tsx", "AccountCorrectionPanel", "Texte weiterhin manuell schreiben und speichern"]]) {
    const p = panel(file, name, production), html = renderToStaticMarkup(p.element);
    assert.match(html, /role="status"/); assert.match(html, /im ersten Pilot noch nicht verfügbar/);
    assert.ok(html.includes(manual)); assert.doesNotMatch(html, /<form|<textarea|<button/); assert.equal(p.hooks(), 0);
  }
});
test("Lokale Oberfläche behält ihre bestehenden interaktiven Unterkomponenten", () => {
  for (const [file, name] of [["account-checkin-panel.tsx", "AccountCheckinPanel"], ["account-correction-panel.tsx", "AccountCorrectionPanel"]]) {
    const p = panel(file, name, local);
    assert.equal(typeof p.element.type, "function"); assert.equal(p.hooks(), 0);
  }
});
