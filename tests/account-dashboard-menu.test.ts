import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

type ElementNode = { type: unknown; props: Record<string, unknown> };
type SyntheticSettings = {
  hidden: boolean;
  view: { account: { userId: string; key: string } } | null;
};
type Listener = () => void;
type Timer = { id: number; fn: () => void; due: number; interval: number };
type EffectSlot = { deps?: readonly unknown[]; cleanup: (() => void) | null };

export type AccountMenuHarness = {
  advance(ms: number): Promise<void>;
  fireWindow(name: string): void;
  fireDocument(name: string): void;
  render(): unknown;
  setSettings(value: SyntheticSettings): void;
  statusText(): string;
  dispose(): void;
  now(): number;
};

const accountSettings = (
  userId = "synthetic-u1",
  hidden = false,
  key = `${userId}-synthetic-key`,
): SyntheticSettings => ({
  hidden,
  view: { account: { userId, key } },
});

const hiddenSettings = (): SyntheticSettings => ({ hidden: true, view: null });

export function syntheticAccountReply(userId = "synthetic-u1", role: "member" | "admin" = "member") {
  return {
    contractVersion: 1,
    account: { userId, status: "active", bootstrap: false, role, name: "Synthetic User" },
  };
}

export function syntheticResponse(status: number, value: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => value,
  } as Response;
}

function elements(node: unknown): ElementNode[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ElementNode;
  return [element, ...elements(element.props.children)];
}

function text(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (node && typeof node === "object" && "props" in node) {
    return text((node as ElementNode).props.children);
  }
  return "";
}

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve())
    .then(() => Promise.resolve()).then(() => Promise.resolve());
}

// Executes the current TSX source with synthetic hooks, provider data, browser events,
// timers and fetch. The fake clock and mutable settings support later identity/timing cases.
export function createAccountMenuHarness(
  transport: typeof fetch,
  initialSettings: SyntheticSettings = accountSettings(),
): AccountMenuHarness {
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map<number, Timer>();
  const windowListeners = new Map<string, Set<Listener>>();
  const documentListeners = new Map<string, Set<Listener>>();
  const addTimer = (fn: () => void, delay: number, interval = 0) => {
    const id = nextTimerId++;
    timers.set(id, { id, fn, due: now + Math.max(0, Number(delay) || 0), interval });
    return id;
  };
  const makeEventTarget = (listeners: Map<string, Set<Listener>>) => ({
    addEventListener(name: string, listener: Listener) {
      const group = listeners.get(name) ?? new Set<Listener>();
      group.add(listener);
      listeners.set(name, group);
    },
    removeEventListener(name: string, listener: Listener) {
      listeners.get(name)?.delete(listener);
    },
    dispatch(name: string) {
      for (const listener of [...(listeners.get(name) ?? [])]) listener();
    },
  });
  const windowTarget = makeEventTarget(windowListeners);
  const documentTarget = makeEventTarget(documentListeners);
  const browserWindow = {
    ...windowTarget,
    setTimeout: (fn: () => void, delay: number) => addTimer(fn, delay),
    setInterval: (fn: () => void, delay: number) => addTimer(fn, delay, Math.max(1, Number(delay) || 1)),
  };
  const browserDocument = { ...documentTarget, visibilityState: "visible" };
  const clearTimer = (id: number) => { timers.delete(id); };

  async function advance(ms: number) {
    const end = now + ms;
    while (true) {
      const due = [...timers.values()].filter(timer => timer.due <= end)
        .sort((left, right) => left.due - right.due || left.id - right.id)[0];
      if (!due) break;
      now = due.due;
      if (due.interval) due.due += due.interval;
      else timers.delete(due.id);
      due.fn();
      await flushMicrotasks();
    }
    now = end;
    await flushMicrotasks();
  }

  const slots: unknown[] = [];
  const effectSlots: Array<EffectSlot | undefined> = [];
  let cursor = 0;
  let layoutEffectJobs: Array<() => void> = [];
  let effectJobs: Array<() => void> = [];
  let settings = initialSettings;
  const hooks = {
    useState<T>(initial: T | (() => T)): [T, (value: T | ((current: T) => T)) => void] {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? (initial as () => T)() : initial;
      return [slots[index] as T, value => {
        const current = slots[index] as T;
        slots[index] = typeof value === "function" ? (value as (current: T) => T)(current) : value;
      }];
    },
    useRef<T>(initial: T): { current: T } {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index] as { current: T };
    },
    registerEffect(
      effect: () => void | (() => void),
      deps: readonly unknown[] | undefined,
      queue: Array<() => void>,
    ) {
      const index = cursor++;
      const previous = effectSlots[index];
      const unchanged = previous && deps && previous.deps && deps.length === previous.deps.length &&
        deps.every((value, position) => Object.is(value, previous.deps?.[position]));
      if (unchanged) return;
      previous?.cleanup?.();
      effectSlots[index] = { deps: deps ? [...deps] : undefined, cleanup: null };
      queue.push(() => {
        effectSlots[index]!.cleanup = effect() || null;
      });
    },
    useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      hooks.registerEffect(effect, deps, layoutEffectJobs);
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      hooks.registerEffect(effect, deps, effectJobs);
    },
  };
  const stub = () => null;
  const dependencies: Record<string, unknown> = {
    react: hooks,
    "react/jsx-runtime": jsx,
    "next/navigation": { usePathname: () => "/", useRouter: () => ({ replace() {}, refresh() {} }) },
    "next/link": stub,
    "lucide-react": { Settings: stub },
    "@/lib/learning/use-account-settings": { useAccountSettings: () => settings },
    "@/lib/learning/settings-contract": {
      settingsAccountKey: (account: { key: string }) => account.key,
    },
    "./account-settings-provider": {
      notifyAccountSignedOut() { windowTarget.dispatch("stex:account-signed-out"); },
    },
    "./ui/dialog": { Dialog: stub, DialogContent: stub, DialogHeader: stub, DialogTitle: stub, DialogTrigger: stub },
  };
  const source = readFileSync("src/components/account-dashboard-menu.tsx", "utf8");
  const code = ts.transpileModule(source, {
    fileName: "account-dashboard-menu.tsx",
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} as { AccountDashboardMenu: () => unknown } };
  new Script(code, { filename: "account-dashboard-menu.tsx" }).runInNewContext({
    module: compiledModule,
    exports: compiledModule.exports,
    require(name: string) {
      if (!(name in dependencies)) throw new Error(`Unexpected component dependency: ${name}`);
      return dependencies[name];
    },
    fetch: transport,
    window: browserWindow,
    document: browserDocument,
    AbortController,
    clearTimeout: clearTimer,
    clearInterval: clearTimer,
  });

  const render = () => {
    cursor = 0;
    layoutEffectJobs = [];
    effectJobs = [];
    const tree = compiledModule.exports.AccountDashboardMenu();
    const layoutJobs = layoutEffectJobs;
    const jobs = effectJobs;
    layoutEffectJobs = [];
    effectJobs = [];
    for (const job of layoutJobs) job();
    for (const job of jobs) job();
    return tree;
  };
  const getStatusText = () => elements(render())
    .filter(element => element.props.role === "status")
    .map(element => text(element.props.children)).join(" | ");
  render();

  return {
    advance,
    fireWindow: name => windowTarget.dispatch(name),
    fireDocument: name => documentTarget.dispatch(name),
    render,
    setSettings(value) { settings = value; },
    statusText: getStatusText,
    dispose() {
      for (const effect of effectSlots) effect?.cleanup?.();
      timers.clear();
    },
    now: () => now,
  };
}

function scriptedResponses(responses: Response[]) {
  let calls = 0;
  const transport: typeof fetch = async (input, init) => {
    assert.equal(String(input), "/api/account");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal instanceof AbortSignal);
    const response = responses[calls++];
    assert.ok(response, "unexpected extra synthetic account request");
    return response;
  };
  return { transport, calls: () => calls };
}

function clickRetry(app: AccountMenuHarness) {
  const button = elements(app.render()).find(element => element.props["aria-label"] === "Erneut prüfen");
  assert.ok(button, "the existing manual check button should be present");
  const onClick = button.props.onClick;
  assert.equal(typeof onClick, "function");
  (onClick as () => void)();
  app.render();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("STATUS-1: synthetische Kontostatusanzeige trennt Prüfung von Nichtverfügbarkeit", async t => {
  await t.test("initial zeigt laufende Prüfung", async () => {
    const api = scriptedResponses([]);
    const app = createAccountMenuHarness(api.transport);
    assert.equal(app.statusText(), "Status wird geprüft");
    assert.doesNotMatch(text(app.render()), /Angemeldet|Anmelden/);
    app.dispose();
  });

  await t.test("503 pausiert reguläre Polls; Fokus setzt die Prüfung fort", async () => {
    const api = scriptedResponses([
      syntheticResponse(503, { error: "synthetic unavailable" }),
      syntheticResponse(200, syntheticAccountReply()),
    ]);
    const app = createAccountMenuHarness(api.transport);
    await app.advance(0);
    assert.equal(app.statusText(), "Kontostatus gerade nicht verfügbar");
    assert.doesNotMatch(text(app.render()), /Status wird geprüft|Angemeldet|Anmelden/);
    await app.advance(5000);
    assert.equal(api.calls(), 1, "the existing regular poll must respect the error pause");
    app.fireWindow("focus");
    await flushMicrotasks();
    assert.match(app.statusText(), /Synthetic User.*Angemeldet/);
    assert.equal(api.calls(), 2);
    app.dispose();
  });

  await t.test("Netzfehler bleibt neutral und Prüfen startet einen neuen Abruf", async () => {
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      if (calls === 1) throw new Error("synthetic network failure");
      return syntheticResponse(200, syntheticAccountReply());
    };
    const app = createAccountMenuHarness(transport);
    await app.advance(0);
    assert.equal(app.statusText(), "Kontostatus gerade nicht verfügbar");
    assert.doesNotMatch(text(app.render()), /Angemeldet|Anmelden/);
    clickRetry(app);
    await app.advance(0);
    assert.match(app.statusText(), /Synthetic User.*Angemeldet/);
    assert.equal(calls, 2);
    app.dispose();
  });

  await t.test("401 bleibt Anmeldung", async () => {
    const api = scriptedResponses([syntheticResponse(401, { error: "synthetic signed out" })]);
    const app = createAccountMenuHarness(api.transport);
    await app.advance(0);
    assert.match(text(app.render()), /Anmelden/);
    assert.equal(app.statusText(), "");
    assert.doesNotMatch(text(app.render()), /Kontostatus gerade nicht verfügbar/);
    app.dispose();
  });

  await t.test("malformed 200 bleibt neutral mit manueller Prüfung", async () => {
    const api = scriptedResponses([syntheticResponse(200, { contractVersion: 1, account: null })]);
    const app = createAccountMenuHarness(api.transport);
    await app.advance(0);
    assert.equal(app.statusText(), "Kontostatus gerade nicht verfügbar");
    assert.doesNotMatch(text(app.render()), /Angemeldet|Anmelden/);
    assert.ok(elements(app.render()).some(element => element.props["aria-label"] === "Erneut prüfen"));
    app.dispose();
  });
});

test("STATUS-2: synthetische Identitätsprüfung übersteht unbekannte Providerdaten und sperrt Kontowechsel", async t => {
  await t.test("A wird vorübergehend verborgen; passende Antwort bestätigt sich nach Rückkehr von A", async () => {
    const reply = deferred<Response>();
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      return reply.promise;
    };
    const app = createAccountMenuHarness(transport, accountSettings("synthetic-a"));
    await app.advance(0);
    assert.equal(calls, 1);

    app.setSettings(hiddenSettings());
    app.render();
    reply.resolve(syntheticResponse(200, syntheticAccountReply("synthetic-a")));
    await flushMicrotasks();
    assert.equal(app.statusText(), "Status wird geprüft", "hidden provider data must not expose a mismatched account status");

    app.setSettings(accountSettings("synthetic-a"));
    assert.match(app.statusText(), /Angemeldet/, "the accepted matching response should appear when the same identity returns");
    assert.equal(calls, 1, "provider recovery must not require focus, reload, or another poll");
    app.dispose();
  });

  await t.test("unbekannte Anfrageidentität darf sich vor der Antwort zu A auflösen", async () => {
    const reply = deferred<Response>();
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      return reply.promise;
    };
    const app = createAccountMenuHarness(transport, hiddenSettings());
    await app.advance(0);
    app.setSettings(accountSettings("synthetic-a"));
    app.render();
    reply.resolve(syntheticResponse(200, syntheticAccountReply("synthetic-a")));
    await flushMicrotasks();
    assert.match(app.statusText(), /Synthetic User.*Angemeldet/);
    assert.equal(calls, 1);
    app.dispose();
  });

  await t.test("bekannte Anfrage A und verborgener Provider verwerfen Antwort B", async () => {
    const reply = deferred<Response>();
    const app = createAccountMenuHarness(async () => reply.promise, accountSettings("synthetic-a"));
    await app.advance(0);
    app.setSettings(hiddenSettings());
    app.render();
    reply.resolve(syntheticResponse(200, syntheticAccountReply("synthetic-b")));
    await flushMicrotasks();
    assert.equal(app.statusText(), "Kontostatus gerade nicht verfügbar");
    assert.doesNotMatch(text(app.render()), /Synthetic User|Angemeldet|Anmelden/);
    app.dispose();
  });

  await t.test("bekannte Anfrage A mit aktuellem B verwirft Antwort A und Antwort B", async t => {
    for (const responseUserId of ["synthetic-a", "synthetic-b"]) {
      await t.test(`Antwort ${responseUserId.slice(-1).toUpperCase()} bleibt geschlossen`, async () => {
        const reply = deferred<Response>();
        const app = createAccountMenuHarness(async () => reply.promise, accountSettings("synthetic-a"));
        await app.advance(0);
        app.setSettings(accountSettings("synthetic-b"));
        app.render();
        reply.resolve(syntheticResponse(200, syntheticAccountReply(responseUserId)));
        await flushMicrotasks();
        assert.equal(app.statusText(), "Kontostatus gerade nicht verfügbar");
        assert.doesNotMatch(text(app.render()), /Synthetic User|Angemeldet|Anmelden/);
        app.dispose();
      });
    }
  });

  await t.test("geänderter Schlüssel derselben Nutzer-ID gibt alte Adminbestätigung nicht frei", async () => {
    const firstReply = deferred<Response>();
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      if (calls === 1) return firstReply.promise;
      return syntheticResponse(200, syntheticAccountReply("synthetic-a", "admin"));
    };
    const app = createAccountMenuHarness(transport, accountSettings("synthetic-a", false, "synthetic-key-old"));
    await app.advance(0);
    app.setSettings(accountSettings("synthetic-a", false, "synthetic-key-new"));
    app.render();
    firstReply.resolve(syntheticResponse(200, syntheticAccountReply("synthetic-a", "admin")));
    await flushMicrotasks();
    assert.equal(calls, 1);
    assert.equal(elements(app.render()).some(element => element.props.href === "/konto/verwaltung"), false);
    await app.advance(5000);
    assert.equal(calls, 2, "the existing regular poll can confirm the changed account key");
    assert.equal(elements(app.render()).some(element => element.props.href === "/konto/verwaltung"), true);
    app.dispose();
  });

  await t.test("explizite Abmeldung macht eine verspätete erfolgreiche Antwort unwirksam", async () => {
    const lateReply = deferred<Response>();
    let accountCalls = 0;
    const transport: typeof fetch = async input => {
      if (String(input) === "/api/auth/sign-out") return syntheticResponse(200, {});
      assert.equal(String(input), "/api/account");
      accountCalls++;
      if (accountCalls === 1) return syntheticResponse(200, syntheticAccountReply());
      return lateReply.promise;
    };
    const app = createAccountMenuHarness(transport);
    await app.advance(0);
    assert.match(app.statusText(), /Angemeldet/);
    await app.advance(5000);
    assert.equal(accountCalls, 2);

    const signOutButton = elements(app.render()).find(element =>
      element.type === "button" && text(element.props.children).includes("Abmelden"),
    );
    assert.ok(signOutButton, "the existing explicit sign-out button should be available");
    const onClick = signOutButton.props.onClick;
    assert.equal(typeof onClick, "function");
    (onClick as () => void)();
    await flushMicrotasks();
    lateReply.resolve(syntheticResponse(200, syntheticAccountReply()));
    await flushMicrotasks();
    assert.match(text(app.render()), /Anmelden/);
    assert.doesNotMatch(text(app.render()), /Synthetic User|Angemeldet|Verwaltung/);
    app.dispose();
  });
});

test("STATUS-3: synthetische Polls schützen langsame laufende Abrufe", async t => {
  await t.test("eine Antwort nach exakt sechs Sekunden übersteht den Fünfsekundentakt", async () => {
    const firstReply = deferred<Response>();
    let calls = 0;
    const signals: AbortSignal[] = [];
    const transport: typeof fetch = async (_input, init) => {
      calls++;
      signals.push(init?.signal as AbortSignal);
      return calls === 1 ? firstReply.promise : syntheticResponse(200, syntheticAccountReply());
    };
    const app = createAccountMenuHarness(transport);
    await app.advance(0);
    assert.equal(calls, 1);

    await app.advance(5000);
    assert.equal(app.now(), 5000);
    assert.equal(calls, 1, "the regular poll at t5 must skip the active request");
    assert.equal(signals[0].aborted, false, "the t5 poll must not abort the six-second request");

    await app.advance(1000);
    assert.equal(app.now(), 6000);
    firstReply.resolve(syntheticResponse(200, syntheticAccountReply()));
    await flushMicrotasks();
    assert.match(app.statusText(), /Synthetic User.*Angemeldet/);
    assert.equal(calls, 1);

    await app.advance(4000);
    assert.equal(app.now(), 10000);
    assert.equal(calls, 2, "the existing t10 interval should start the next request after t6 completed");
    assert.match(app.statusText(), /Synthetic User.*Angemeldet/);
    await app.advance(5000);
    assert.equal(calls, 3, "the original five-second interval should continue at t15");
    app.dispose();
  });

  await t.test("eine Viersekundenantwort bleibt vor dem nächsten regulären Takt unberührt", async () => {
    const firstReply = deferred<Response>();
    let calls = 0;
    const signals: AbortSignal[] = [];
    const transport: typeof fetch = async (_input, init) => {
      calls++;
      signals.push(init?.signal as AbortSignal);
      return calls === 1 ? firstReply.promise : syntheticResponse(200, syntheticAccountReply());
    };
    const app = createAccountMenuHarness(transport);
    await app.advance(0);
    await app.advance(4000);
    firstReply.resolve(syntheticResponse(200, syntheticAccountReply()));
    await flushMicrotasks();
    assert.match(app.statusText(), /Synthetic User.*Angemeldet/);
    await app.advance(1000);
    assert.equal(calls, 2, "the existing t5 poll should run after the t4 response completed");
    assert.equal(signals[0].aborted, false);
    app.dispose();
  });

  await t.test("ein Netzwerkfehler räumt auf, pausiert den Poll und Fokus nimmt wieder auf", async () => {
    const firstReply = deferred<Response>();
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      return calls === 1 ? firstReply.promise : syntheticResponse(200, syntheticAccountReply());
    };
    const app = createAccountMenuHarness(transport);
    await app.advance(0);
    firstReply.reject(new Error("synthetic network failure"));
    await flushMicrotasks();
    assert.equal(app.statusText(), "Kontostatus gerade nicht verfügbar");

    await app.advance(5000);
    assert.equal(calls, 1, "the existing error pause should still suppress the t5 poll");
    app.fireWindow("focus");
    await flushMicrotasks();
    assert.equal(calls, 2, "focus should start a fresh request after the failed request settled");
    assert.match(app.statusText(), /Synthetic User.*Angemeldet/);
    app.dispose();
  });

  await t.test("Fokus ersetzt einen Abruf im JSON-Parsing; dessen finally schützt den neuen Controller", async () => {
    const firstJson = deferred<unknown>();
    const secondJson = deferred<unknown>();
    let calls = 0;
    const signals: AbortSignal[] = [];
    const jsonStarted: boolean[] = [];
    const transport: typeof fetch = async (_input, init) => {
      calls++;
      signals.push(init?.signal as AbortSignal);
      const parsed = calls === 1 ? firstJson.promise : secondJson.promise;
      jsonStarted.push(false);
      const index = calls - 1;
      return {
        status: 200,
        ok: true,
        json: () => {
          jsonStarted[index] = true;
          return parsed;
        },
      } as Response;
    };
    const app = createAccountMenuHarness(transport);
    await app.advance(0);
    assert.equal(calls, 1);
    assert.equal(jsonStarted[0], true, "the first request should be waiting inside response parsing");

    app.fireWindow("focus");
    await flushMicrotasks();
    assert.equal(calls, 2, "the explicit focus check should replace the parsing request");
    assert.equal(signals[0].aborted, true);
    assert.equal(jsonStarted[1], true);

    firstJson.resolve(syntheticAccountReply());
    await flushMicrotasks();
    await app.advance(5000);
    assert.equal(calls, 2, "the old request's finally must not clear the new request during parsing");
    assert.equal(signals[1].aborted, false);

    secondJson.resolve(syntheticAccountReply());
    await flushMicrotasks();
    assert.match(app.statusText(), /Synthetic User.*Angemeldet/);
    app.dispose();
  });

  await t.test("Unmount macht eine verspätete erfolgreiche Antwort unwirksam", async () => {
    const lateReply = deferred<Response>();
    let signal: AbortSignal | undefined;
    let calls = 0;
    const transport: typeof fetch = async (_input, init) => {
      calls++;
      signal = init?.signal as AbortSignal;
      return lateReply.promise;
    };
    const app = createAccountMenuHarness(transport);
    await app.advance(0);
    assert.equal(calls, 1);
    app.dispose();
    assert.equal(signal?.aborted, true, "unmount should abort the active request");

    lateReply.resolve(syntheticResponse(200, syntheticAccountReply()));
    await flushMicrotasks();
    assert.equal(app.statusText(), "Status wird geprüft");
    assert.doesNotMatch(text(app.render()), /Synthetic User|Angemeldet/);
    assert.equal(calls, 1);
  });
});
