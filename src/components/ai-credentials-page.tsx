"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AiCredentialAdminStatus,
  AiCredentialActorContext,
  AiCredentialAdminTarget,
  AiCredentialSource,
  AiCredentialStatus,
} from "@/lib/ai-credentials/contract";
import { AiCredentialClientBoundary, sameAiCredentialContext } from "@/lib/ai-credentials/client-boundary";

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const buttonClass = "rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50";
const openRouterKeysUrl = "https://openrouter.ai/settings/keys";

class CredentialRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly uncertain = false) {
    super(message);
  }
}

async function request(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json", "X-Stex-Action": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = data?.error;
    const message = typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message : typeof error === "string" ? error : "Die Aktion konnte nicht ausgeführt werden.";
    const code = typeof error === "object" && error && "code" in error && typeof error.code === "string" ? error.code : undefined;
    throw new CredentialRequestError(message, response.status, code);
  }
  if (!data) throw new CredentialRequestError("Die Bestätigung ist unklar. Bitte denselben Vorgang erneut prüfen.", response.status, undefined, response.ok);
  return data;
}

function isActorContext(value: unknown): value is AiCredentialActorContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  return typeof context.accountId === "string" && Number.isSafeInteger(context.accessGeneration)
    && typeof context.sessionContext === "string" && /^[0-9a-f]{64}$/.test(context.sessionContext);
}

async function readCurrentContext(): Promise<AiCredentialActorContext> {
  const result = await request("/api/account/ai-credential?contextOnly=1");
  if (result.contractVersion !== 2 || !isActorContext(result.context)) {
    throw new CredentialRequestError("Die Anmeldung konnte nicht bestätigt werden. Bitte neu laden.", 503);
  }
  return result.context;
}

function providerStatusLabel(status: AiCredentialStatus["providerStatus"]): string {
  if (!status) return "Wähle einen KI-Zugang aus, um dessen Anbieterstatus zu prüfen.";
  if (status.message) return status.message;
  if (status.state !== "ready") return "Der OpenRouter-Status ist gerade nicht verfügbar.";
  if (status.limitRemaining === null) return "OpenRouter meldet für diesen Schlüssel kein festes Limit.";
  if (typeof status.limitRemaining === "number") return `OpenRouter meldet noch $${status.limitRemaining.toFixed(2)} vom Limit dieses Schlüssels.`;
  return "Der OpenRouter-Status ist verfügbar.";
}

function expectedRevision(status: AiCredentialStatus, source: AiCredentialSource): number | null {
  const credential = status.credentials[source];
  return credential.configured || credential.revision > 0 ? credential.revision : null;
}

interface PendingOperation {
  path: string;
  body: Record<string, unknown>;
  actorContext: AiCredentialActorContext;
  successMessage: string;
}

export function AiCredentialsPage() {
  const [boundary] = useState(() => new AiCredentialClientBoundary());
  const confirmedContextRef = useRef<AiCredentialActorContext | null>(null);
  const pendingOperationRef = useRef<PendingOperation | null>(null);
  const busyRequestRef = useRef<string | null>(null);
  const targetReadRef = useRef(0);
  const targetUserIdRef = useRef("");
  const pilotStatusRef = useRef<AiCredentialAdminStatus | null>(null);
  const probeRef = useRef(0);

  const [status, setStatus] = useState<AiCredentialStatus | null>(null);
  const [confirmedContext, setConfirmedContext] = useState<AiCredentialActorContext | null>(null);
  const [targets, setTargets] = useState<AiCredentialAdminTarget[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [pilotStatus, setPilotStatus] = useState<AiCredentialAdminStatus | null>(null);
  const [ownKey, setOwnKey] = useState("");
  const [pilotKey, setPilotKey] = useState("");
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = busyRequestId !== null;
  const pending = pendingRequestId !== null;

  const clearFormState = useCallback(() => {
    pendingOperationRef.current = null;
    busyRequestRef.current = null;
    targetReadRef.current += 1;
    targetUserIdRef.current = "";
    pilotStatusRef.current = null;
    setPendingRequestId(null);
    setBusyRequestId(null);
    setOwnKey("");
    setPilotKey("");
    setTargetUserId("");
    setPilotStatus(null);
    setMessage("");
    setError("");
  }, []);

  const load = useCallback(async () => {
    probeRef.current += 1;
    const sequence = boundary.begin();
    confirmedContextRef.current = null;
    setConfirmedContext(null);
    setStatus(null);
    setTargets([]);
    clearFormState();
    setLoading(true);
    try {
      const context = await readCurrentContext();
      if (!boundary.isCurrent(sequence)) return;
      const acceptance = boundary.accept(sequence, context);
      if (acceptance === "changed") clearFormState();

      const current = await request("/api/account/ai-credential") as unknown as AiCredentialStatus;
      if (!boundary.isCurrent(sequence)) return;
      if (current.contractVersion !== 2 || !sameAiCredentialContext(context, current.context)) {
        throw new CredentialRequestError("Deine Kontositzung hat sich geändert. Bitte neu laden.", 409, "account_changed");
      }
      if (current.account.role === "admin") {
        const accounts = await request("/api/account/admin/accounts") as { accounts?: AiCredentialAdminTarget[] };
        if (!boundary.isCurrent(sequence)) return;
        const confirmed = await readCurrentContext();
        if (!boundary.isCurrent(sequence)) return;
        if (!sameAiCredentialContext(context, confirmed)) {
          throw new CredentialRequestError("Deine Kontositzung hat sich geändert. Bitte neu laden.", 409, "account_changed");
        }
        const members = (accounts.accounts ?? []).filter(account => account.role === "member" && account.status === "active");
        const currentTarget = acceptance === "changed" ? "" : targetUserIdRef.current;
        const nextTarget = members.some(account => account.userId === currentTarget) ? currentTarget : members[0]?.userId ?? "";
        targetUserIdRef.current = nextTarget;
        setTargetUserId(nextTarget);
        setTargets(members);
      }
      if (!boundary.isCurrent(sequence)) return;
      confirmedContextRef.current = context;
      setConfirmedContext(context);
      setStatus(current);
    } catch (cause) {
      if (!boundary.isCurrent(sequence)) return;
      confirmedContextRef.current = null;
      setConfirmedContext(null);
      setStatus(null);
      setTargets([]);
      targetUserIdRef.current = "";
      pilotStatusRef.current = null;
      setTargetUserId("");
      setPilotStatus(null);
      setError(cause instanceof Error ? cause.message : "Bitte melde dich an, um deinen KI-Zugang zu verwalten.");
    } finally {
      if (boundary.isCurrent(sequence)) setLoading(false);
    }
  }, [boundary, clearFormState]);

  const probeSession = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const expected = confirmedContextRef.current;
    if (!expected) return;
    const probe = ++probeRef.current;
    try {
      const current = await readCurrentContext();
      if (probe !== probeRef.current || !sameAiCredentialContext(confirmedContextRef.current, expected)) return;
      if (!sameAiCredentialContext(expected, current)) await load();
    } catch {
      if (probe === probeRef.current && sameAiCredentialContext(confirmedContextRef.current, expected)) await load();
    }
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const refresh = () => { void load(); };
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => { void probeSession(); }, 8_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visible);
      window.clearInterval(timer);
    };
  }, [load, probeSession]);

  useEffect(() => {
    const sequence = ++targetReadRef.current;
    const actorContext = status?.context;
    if (!status || status.account.role !== "admin" || !targetUserId || !actorContext
      || !sameAiCredentialContext(confirmedContextRef.current, actorContext)) {
      return;
    }
    void request(`/api/account/admin/ai-credential?userId=${encodeURIComponent(targetUserId)}`)
      .then(result => {
        if (sequence !== targetReadRef.current || !boundary.context()
          || targetUserIdRef.current !== targetUserId
          || !sameAiCredentialContext(confirmedContextRef.current, actorContext)) return;
        const current = result as unknown as AiCredentialAdminStatus;
        if (current.contractVersion !== 2 || !sameAiCredentialContext(current.actorContext, actorContext)
          || current.targetContext.accountId !== targetUserId) return;
        pilotStatusRef.current = current;
        setPilotStatus(current);
      })
      .catch(() => {
        if (sequence === targetReadRef.current && targetUserIdRef.current === targetUserId
          && sameAiCredentialContext(confirmedContextRef.current, actorContext)) {
          pilotStatusRef.current = null;
          setPilotStatus(null);
        }
      });
    return () => { if (sequence === targetReadRef.current) targetReadRef.current += 1; };
  }, [boundary, status, targetUserId]);

  async function runOperation(operation: PendingOperation, retry = false) {
    const expectedContext = operation.actorContext;
    if (!sameAiCredentialContext(confirmedContextRef.current, expectedContext)) {
      await load();
      setError("Deine Anmeldung wurde erneut geprüft. Lade den aktuellen Stand und wiederhole die Aktion bewusst.");
      return;
    }
    if (pendingOperationRef.current && pendingOperationRef.current.body.requestId !== operation.body.requestId) return;

    const sequence = boundary.begin();
    busyRequestRef.current = operation.body.requestId as string;
    setBusyRequestId(busyRequestRef.current);
    setMessage("");
    setError("");
    let sent = false;
    try {
      const currentContext = await readCurrentContext();
      if (!boundary.isCurrent(sequence)) return;
      if (!sameAiCredentialContext(expectedContext, currentContext)
        || !sameAiCredentialContext(confirmedContextRef.current, expectedContext)) {
        await load();
        setError("Konto oder Anmeldung hat sich geändert. Die alte Eingabe wurde verworfen.");
        return;
      }
      if (!retry) {
        pendingOperationRef.current = operation;
        setPendingRequestId(operation.body.requestId as string);
      }
      if ("apiKey" in operation.body) {
        if (operation.body.action === "set-own") setOwnKey("");
        if (operation.body.action === "set-pilot") setPilotKey("");
      }
      sent = true;
      const result = await request(operation.path, operation.body);
      if (result.contractVersion !== 2) {
        throw new CredentialRequestError("Die Bestätigung ist unklar. Bitte denselben Vorgang erneut prüfen.", 200, undefined, true);
      }
      if (!boundary.isCurrent(sequence)) return;
      pendingOperationRef.current = null;
      setPendingRequestId(null);
      await load();
      if (sameAiCredentialContext(confirmedContextRef.current, expectedContext)) setMessage(operation.successMessage);
    } catch (cause) {
      if (!boundary.isCurrent(sequence)) return;
      const uncertain = sent && (!(cause instanceof CredentialRequestError) || cause.uncertain || cause.status >= 500);
      if (uncertain) {
        pendingOperationRef.current = operation;
        setPendingRequestId(operation.body.requestId as string);
        setOwnKey("");
        setPilotKey("");
        setMessage("Die Bestätigung ist unklar. Der unveränderte Vorgang bleibt nur bis zum Schließen oder Kontowechsel im Arbeitsspeicher und kann sicher erneut geprüft werden.");
        setError("");
      } else {
        pendingOperationRef.current = null;
        setPendingRequestId(null);
        const failure = cause instanceof Error ? cause.message : "Die Aktion konnte nicht ausgeführt werden.";
        if (sent) {
          await load();
          if (sameAiCredentialContext(confirmedContextRef.current, expectedContext)) setError(failure);
        } else {
          setError(failure);
        }
      }
    } finally {
      if (busyRequestRef.current === operation.body.requestId) {
        busyRequestRef.current = null;
        setBusyRequestId(null);
      }
    }
  }

  function ownerOperation(action: string, fields: Record<string, unknown>, successMessage: string) {
    if (!status) return;
    const body: Record<string, unknown> = {
      action,
      ...fields,
      requestId: crypto.randomUUID(),
      expectedActorContext: status.context,
    };
    void runOperation({ path: "/api/account/ai-credential", body, actorContext: status.context, successMessage });
  }

  function saveOwnKey() {
    if (!status || !ownKey) return;
    ownerOperation("set-own", { apiKey: ownKey, expectedRevision: expectedRevision(status, "own") },
      "Dein OpenRouter-Schlüssel wurde geprüft und sicher gespeichert. Wähle ihn anschließend ausdrücklich als KI-Zugang aus.");
  }

  function select(source: AiCredentialStatus["selection"]["source"]) {
    if (!status) return;
    ownerOperation("select", { source, expectedRevision: status.selection.revision },
      source === "off" ? "Die KI ist ausgeschaltet." : "Deine KI-Auswahl wurde gespeichert.");
  }

  function removeOwnKey() {
    if (!status) return;
    ownerOperation("remove-own", { expectedRevision: status.credentials.own.revision },
      "Der Schlüssel wurde aus deinem Tracker-Konto entfernt. Widerrufe ihn zusätzlich bei OpenRouter, wenn du ihn nicht mehr verwenden möchtest.");
  }

  function adminOperation(action: string, fields: Record<string, unknown>, successMessage: string) {
    if (!status || !pilotStatus || pilotStatus.targetContext.accountId !== targetUserId
      || targetUserIdRef.current !== targetUserId || pilotStatusRef.current !== pilotStatus
      || !sameAiCredentialContext(pilotStatus.actorContext, status.context)) return;
    const body: Record<string, unknown> = {
      action,
      targetUserId,
      ...fields,
      requestId: crypto.randomUUID(),
      expectedActorContext: status.context,
      expectedTargetContext: pilotStatus.targetContext,
    };
    void runOperation({ path: "/api/account/admin/ai-credential", body, actorContext: status.context, successMessage });
  }

  function savePilotKey() {
    if (!status || !pilotStatus || !pilotKey) return;
    adminOperation("set-pilot", {
      apiKey: pilotKey,
      expectedRevision: pilotStatus.credential.configured || pilotStatus.credential.revision > 0 ? pilotStatus.credential.revision : null,
    }, "Der Pilot-Schlüssel wurde geprüft und dem ausgewählten Konto zugeordnet. Die Auswahl des Nutzers wurde nicht geändert.");
  }

  function removePilotKey() {
    if (!status || !pilotStatus?.credential.configured) return;
    adminOperation("remove-pilot", { expectedRevision: pilotStatus.credential.revision },
      "Der Pilot-Schlüssel wurde aus der Tracker-Zuordnung entfernt. Widerrufe ihn zusätzlich bei OpenRouter.");
  }

  function changeTarget(userId: string) {
    targetReadRef.current += 1;
    targetUserIdRef.current = userId;
    pilotStatusRef.current = null;
    setPilotStatus(null);
    setPilotKey("");
    setMessage("");
    setError("");
    setTargetUserId(userId);
  }

  function retryPending() {
    const operation = pendingOperationRef.current;
    if (!operation || busy) return;
    void runOperation(operation, true);
  }

  return <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
    <header className="space-y-2">
      <p className="text-sm text-indigo-700">Persönlicher Kontobereich</p>
      <h1 className="text-3xl font-semibold">KI-Zugang</h1>
      <p className="text-slate-700">Der einmalige Startzugang umfasst 4,00&nbsp;€ pro Nutzer. Ist das Anbieterlimit aufgebraucht, kannst du deinen eigenen OpenRouter-Zugang hinterlegen. Im Tracker gibt es keine zweite Guthaben- oder Kostenabrechnung.</p>
    </header>

    {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">{message}</p>}
    {pending && <button type="button" className={buttonClass} disabled={busy || loading} onClick={retryPending}>Denselben Vorgang erneut prüfen</button>}
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3">{error} <Link href="/konto/anmelden" className="underline">Zur Anmeldung</Link></p>}
    {loading && <p role="status">KI-Zugang wird geladen …</p>}

    {status && confirmedContext && sameAiCredentialContext(status.context, confirmedContext) && <>
      <section className="space-y-4 rounded-xl border border-slate-200 p-5">
        <div>
          <h2 className="text-xl font-medium">Ausgewählter Zugang</h2>
          <p className="mt-1 text-sm text-slate-600">Die Auswahl wird nur auf deine ausdrückliche Aktion geändert. Bei Fehlern wechselt der Tracker nicht automatisch zu einem anderen Schlüssel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pilot", "own", "off"] as const).map(source => {
            const credential = source === "off" ? null : status.credentials[source];
            const label = source === "pilot" ? "Pilot-Startzugang" : source === "own" ? "Eigener OpenRouter-Schlüssel" : "KI ausschalten";
            return <button key={source} type="button" className={status.selection.source === source ? buttonClass : "rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"}
              disabled={busy || pending || loading || (source !== "off" && !credential?.configured)} onClick={() => select(source)}>
              {label}{status.selection.source === source ? " · ausgewählt" : ""}
            </button>;
          })}
        </div>
        <p className="text-sm text-slate-700" role="status">{providerStatusLabel(status.providerStatus)}</p>
        {status.selection.source !== "off" && status.credentials[status.selection.source].maskedKey && <p className="text-sm text-slate-500">Hinterlegter Schlüssel: {status.credentials[status.selection.source].maskedKey}</p>}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 p-5">
        <div>
          <h2 className="text-xl font-medium">Eigenen OpenRouter-Schlüssel hinzufügen</h2>
          <p className="mt-1 text-sm text-slate-700">Das geht in wenigen einfachen Schritten:</p>
        </div>
        <ol className="list-inside list-decimal space-y-2 text-sm text-slate-700">
          <li><Link href={openRouterKeysUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 underline">OpenRouter öffnen und API-Key erstellen</Link>.</li>
          <li>Kopiere den neuen Schlüssel und füge ihn unten ein.</li>
          <li>Wähle danach „Eigener OpenRouter-Schlüssel“ ausdrücklich als Zugang aus.</li>
        </ol>
        <p className="text-sm text-slate-600">OpenRouter belastet die Nutzung dieses Schlüssels deinem eigenen OpenRouter-Konto. Prüfe dort Guthaben und Limit. Der Schlüssel wird beim Speichern geprüft und verschlüsselt deinem Konto zugeordnet.</p>
        <label className="block text-sm font-medium">OpenRouter-API-Schlüssel<input className={inputClass} type="password" autoComplete="new-password" spellCheck={false} value={ownKey} onChange={event => setOwnKey(event.target.value)} placeholder="Schlüssel hier einfügen" maxLength={512} disabled={busy || pending}/></label>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} disabled={busy || pending || loading || !ownKey.trim()} onClick={saveOwnKey}>Schlüssel prüfen und speichern</button>
          {status.credentials.own.configured && <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50" disabled={busy || pending || loading} onClick={removeOwnKey}>Eigenen Schlüssel entfernen</button>}
        </div>
        {status.credentials.own.configured && <p className="text-sm text-slate-600">Gespeichert: {status.credentials.own.maskedKey}. Wenn du ihn entfernst oder ersetzt, widerrufe den alten Schlüssel zusätzlich in deinem OpenRouter-Konto.</p>}
      </section>

      {status.account.role === "admin" && <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
        <div><h2 className="text-xl font-medium">Pilotzugang zuordnen</h2><p className="mt-1 text-sm text-slate-600">Nur für aktive Mitgliedskonten. Der OpenRouter-Schlüssel muss bereits manuell angelegt und auf 4,00&nbsp;€ ohne Reset begrenzt sein.</p></div>
        <label className="block text-sm font-medium">Aktives Mitglied<select className={inputClass} value={targetUserId} onChange={event => changeTarget(event.target.value)} disabled={busy || pending || loading}>
          {targets.map(account => <option key={account.userId} value={account.userId}>{account.name} · {account.email}</option>)}
        </select></label>
        <label className="block text-sm font-medium">Pilot-API-Schlüssel<input className={inputClass} type="password" autoComplete="new-password" spellCheck={false} value={pilotKey} onChange={event => setPilotKey(event.target.value)} placeholder="Manuell angelegten Schlüssel einfügen" maxLength={512} disabled={busy || pending || loading || !pilotStatus}/></label>
        <div className="flex flex-wrap gap-3"><button type="button" className={buttonClass} disabled={busy || pending || loading || !targetUserId || !pilotStatus || !pilotKey.trim()} onClick={savePilotKey}>Pilot-Schlüssel prüfen und zuordnen</button>
          <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50" disabled={busy || pending || loading || !targetUserId || !pilotStatus?.credential.configured} onClick={removePilotKey}>Pilot-Zuordnung entfernen</button></div>
        {pilotStatus?.credential.configured && <p className="text-sm text-slate-600">Hinterlegt: {pilotStatus.credential.maskedKey}{pilotStatus.selected ? " · vom Mitglied ausgewählt" : " · noch nicht vom Mitglied ausgewählt"}</p>}
        {!targets.length && <p className="text-sm text-slate-600">Es gibt derzeit keine aktiven Mitgliedskonten.</p>}
      </section>}
    </>}
    <p className="text-sm"><Link href="/konto" className="underline">Zurück zum Konto</Link></p>
  </main>;
}
