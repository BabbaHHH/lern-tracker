import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

type Element = { type: unknown; props: Record<string, unknown> };
type Step = { path: string; status: number; value: unknown };
const active = { userId: "synthetic-r47-a", email: "a@example.test", name: "Synthetic A", status: "active", role: "member", revision: 1, bootstrap: false };
const accountReply = (account = active) => ({ contractVersion: 1, account });
const failure = { error: { code: "unavailable", message: "Synthetic request failure" } };
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}
function text(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  return node && typeof node === "object" && "props" in node ? text((node as Element).props.children) : "";
}
function hasLogin(tree: unknown) { return elements(tree).some(e => e.type === "input" && e.props.type === "password"); }

// Execute the current component/request/loader source. Only React hook storage,
// navigation and network are synthetic; no browser, session or auth backend is read.
function mount(transport: typeof fetch, mode: "main" | "login" | "setup" = "main") {
  const slots: unknown[] = []; let cursor = 0;
  let load!: () => Promise<unknown>;
  const hooks = {
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value: unknown) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useCallback(callback: () => Promise<unknown>) { load = callback; return callback; },
    useEffect() { /* Explicitly call the real loader instead of scheduling effects. */ },
  };
  const dependencies: Record<string, unknown> = {
    react: hooks, "react/jsx-runtime": jsx,
    "next/link": () => null, "next/image": () => null,
    "next/navigation": { useRouter: () => ({ replace() {}, refresh() {} }) },
    qrcode: { toDataURL: () => { throw Error("Unexpected QR action"); } },
    "@/lib/topics": { TOPICS: [], getLeafTopics: () => [] },
    "./account-settings-provider": { notifyAccountSignedOut: () => { throw Error("Unexpected logout"); } },
  };
  const source = readFileSync("src/components/account-app.tsx", "utf8");
  const code = ts.transpileModule(source, { fileName: "account-app.tsx", compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const compiledModule = { exports: {} as { AccountApp: (props: { mode: string }) => unknown } };
  new Script(code, { filename: "account-app.tsx" }).runInNewContext({ module: compiledModule, exports: compiledModule.exports, fetch: transport,
    require(name: string) { if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`); return dependencies[name]; },
  });
  const render = () => { cursor = 0; return compiledModule.exports.AccountApp({ mode }); };
  render();
  return { render, load: () => load() };
}
function scripted(steps: Step[]) {
  const calls: string[] = [];
  const transport: typeof fetch = async (input, init) => {
    const path = String(input), step = steps[calls.length]; calls.push(path);
    assert.ok(step, "No unexpected network request"); assert.equal(path, step.path);
    assert.equal(init?.credentials, "same-origin"); assert.equal(init?.cache, "no-store");
    return Response.json(step.value, { status: step.status });
  };
  return { transport, calls };
}

test("R47: Kontofehler und Notizstörung sind keine pauschale Abmeldung", async t => {
  await t.test("bestätigte Identität bleibt bei Notizen 503 erhalten; alte Notizanzeige wird entfernt", async () => {
    const api = scripted([
      { path: "/api/account", status: 200, value: accountReply() },
      { path: "/api/account/notes", status: 200, value: { notes: [{ id: "synthetic-note", revision: 1, value: { topicId: "synthetic-topic", note: "Synthetic old note" } }] } },
      { path: "/api/account", status: 200, value: accountReply() },
      { path: "/api/account/notes", status: 503, value: failure },
    ]);
    const app = mount(api.transport); await app.load(); assert.match(text(app.render()), /Synthetic old note/);
    const result = await app.load(); assert.equal((result as typeof active).userId, active.userId);
    const tree = app.render(); assert.equal(hasLogin(tree), false); assert.match(text(tree), /Hallo Synthetic A/);
    assert.doesNotMatch(text(tree), /Synthetic old note/); assert.match(text(tree), /Anmeldung ist bestätigt/);
  });
  await t.test("unbestätigte Identität bei 503, Origin-403 oder Netzfehler zeigt Prüfen statt Login", async () => {
    for (const status of [503, 403, 429]) {
      const app = mount(scripted([{ path: "/api/account", status, value: failure }]).transport);
      assert.equal(await app.load(), null); const tree = app.render();
      assert.equal(hasLogin(tree), false); assert.match(text(tree), /Kontozugang erneut prüfen/);
      assert.equal(text(elements(tree).find(e => e.type === "h1")), "Kontozugang prüfen");
    }
    const app = mount(async () => { throw Error("Synthetic network failure"); });
    await app.load(); assert.equal(hasLogin(app.render()), false); assert.match(text(app.render()), /Kontozugang erneut prüfen/);
  });
  await t.test("bestätigtes Konto-401 zeigt weiterhin die Anmeldung", async () => {
    const api = scripted([{ path: "/api/account", status: 401, value: failure }]);
    const app = mount(api.transport); assert.equal(await app.load(), null); assert.equal(hasLogin(app.render()), true); assert.equal(api.calls.length, 1);
  });
  await t.test("Notiz-401 wird durch erneutes Konto-401 als echte Zugriffsverweigerung bestätigt", async () => {
    const api = scripted([{ path: "/api/account", status: 200, value: accountReply() }, { path: "/api/account/notes", status: 401, value: failure }, { path: "/api/account", status: 401, value: failure }]);
    const app = mount(api.transport); assert.equal(await app.load(), null); assert.equal(hasLogin(app.render()), true); assert.equal(api.calls.length, 3);
  });
  await t.test("Notiz-401 mit erneut bestätigter Identität erzeugt keinen falschen Login", async () => {
    const api = scripted([{ path: "/api/account", status: 200, value: accountReply() }, { path: "/api/account/notes", status: 401, value: failure }, { path: "/api/account", status: 200, value: accountReply() }]);
    const app = mount(api.transport); await app.load(); assert.equal(hasLogin(app.render()), false); assert.match(text(app.render()), /Hallo Synthetic A/); assert.equal(api.calls.length, 3);
  });
  await t.test("Notiz-403 mit nun wartendem Konto übernimmt den geschützten aktuellen Status", async () => {
    const api = scripted([{ path: "/api/account", status: 200, value: accountReply() }, { path: "/api/account/notes", status: 403, value: failure }, { path: "/api/account", status: 200, value: accountReply({ ...active, status: "pending" }) }]);
    const app = mount(api.transport); await app.load(); const tree = app.render();
    assert.equal(hasLogin(tree), false); assert.match(text(tree), /wartet auf Niklas/); assert.doesNotMatch(text(tree), /Meine Lernnotizen/);
  });
  await t.test("ungeklärte erneute Identitätsprüfung nach Notizverweigerung bleibt geschlossen", async () => {
    const api = scripted([{ path: "/api/account", status: 200, value: accountReply() }, { path: "/api/account/notes", status: 403, value: failure }, { path: "/api/account", status: 503, value: failure }]);
    const app = mount(api.transport); await app.load(); const tree = app.render();
    assert.equal(hasLogin(tree), false); assert.match(text(tree), /Kontozugang erneut prüfen/); assert.doesNotMatch(text(tree), /Hallo Synthetic A|Meine Lernnotizen/);
  });
  await t.test("verspätetes altes 401 überschreibt keine neu bestätigte Identität", async () => {
    let completeOld!: (value: Response) => void; let accounts = 0;
    const app = mount(async input => {
      if (String(input) === "/api/account" && ++accounts === 1) return new Promise<Response>(resolve => { completeOld = resolve; });
      return Response.json(String(input) === "/api/account" ? accountReply() : { notes: [] });
    });
    const old = app.load(); await app.load(); completeOld(Response.json(failure, { status: 401 })); await old;
    const tree = app.render(); assert.equal(hasLogin(tree), false); assert.match(text(tree), /Hallo Synthetic A/);
  });
  await t.test("initiale Kontoprüfung zeigt keinen Loginblitz; direkte Anmeldung und Einrichtung bleiben verfügbar", () => {
    const transport: typeof fetch = async () => { throw Error("Unexpected network"); };
    const main = mount(transport); assert.equal(hasLogin(main.render()), false); assert.match(text(main.render()), /Kontozugang wird geprüft/);
    assert.equal(text(elements(main.render()).find(e => e.type === "h1")), "Kontozugang prüfen");
    assert.equal(hasLogin(mount(transport, "login").render()), true); assert.equal(hasLogin(mount(transport, "setup").render()), true);
  });
});
