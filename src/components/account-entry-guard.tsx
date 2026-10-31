"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type AccountEntryDecision = "home" | "login" | "account" | "unavailable";

export function decideAccountEntry(status: number, payload: unknown): AccountEntryDecision {
  if (status === 401) return "login";
  if (status === 403) return "account";
  if (status !== 200 || !isRecord(payload) || payload.contractVersion !== 1 || !isRecord(payload.account)) {
    return "unavailable";
  }

  const account = payload.account;
  if (typeof account.status !== "string" || typeof account.bootstrap !== "boolean") {
    return "unavailable";
  }

  return account.status === "active" && account.bootstrap === false ? "home" : "account";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type GuardStatus = "checking" | "ready" | "redirecting" | "unavailable";

export function AccountEntryGuard({ accountMode, children }: { accountMode: boolean; children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<GuardStatus>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!accountMode) return;

    const controller = new AbortController();
    let current = true;

    const check = async () => {
      let decision: AccountEntryDecision;
      try {
        const response = await fetch("/api/account", {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        const payload = response.status === 200 ? await response.json() : null;
        decision = decideAccountEntry(response.status, payload);
      } catch {
        if (current && !controller.signal.aborted) setStatus("unavailable");
        return;
      }

      if (!current) return;
      if (decision === "home") {
        setStatus("ready");
      } else if (decision === "login" || decision === "account") {
        setStatus("redirecting");
        router.replace(decision === "login" ? "/konto/anmelden" : "/konto");
      } else {
        setStatus("unavailable");
      }
    };

    void check();
    return () => {
      current = false;
      controller.abort();
    };
  }, [accountMode, attempt, router]);

  if (!accountMode || status === "ready") return <>{children}</>;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12" aria-busy={status !== "unavailable"}>
      {status === "unavailable" ? (
        <>
          <h1 className="font-serif text-xl text-slate-900">Kontozugang nicht geprüft</h1>
          <p role="status" className="mt-3 text-sm text-slate-600">
            Dein Kontozugang konnte gerade nicht geprüft werden. Bitte versuche es erneut.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
            <button className="underline" type="button" onClick={() => setAttempt((value) => value + 1)}>
              Erneut prüfen
            </button>
            <Link className="underline" href="/konto/anmelden">Zur Anmeldeseite</Link>
          </div>
        </>
      ) : (
        <p role="status" className="text-sm text-slate-600">
          {status === "redirecting" ? "Der Kontozugang wird geöffnet …" : "Dein Kontozugang wird geprüft …"}
        </p>
      )}
    </main>
  );
}
