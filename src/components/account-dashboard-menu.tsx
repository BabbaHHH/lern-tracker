"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { useAccountSettings } from "@/lib/learning/use-account-settings";
import { settingsAccountKey } from "@/lib/learning/settings-contract";
import { notifyAccountSignedOut } from "./account-settings-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

type AccountHeaderStatus =
  | { kind: "checking" | "unavailable" | "signed-out" }
  | { kind: "active"; userId: string; name: string; admin: boolean; accountKey: string | null }
  | { kind: "restricted"; userId: string; accountKey: string | null; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function AccountDashboardMenu() {
  const settings = useAccountSettings();
  const path = usePathname();
  const router = useRouter();
  const key = !settings.hidden && settings.view ? settingsAccountKey(settings.view.account) : null;
  const userId = !settings.hidden ? settings.view?.account.userId ?? null : null;
  const identity = useRef<{ key: string | null; userId: string | null }>({ key, userId });
  useLayoutEffect(() => {
    identity.current = { key, userId };
  }, [key, userId]);
  const [status, setStatus] = useState<AccountHeaderStatus>({ kind: "checking" });
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let epoch = 0;
    let request: AbortController | undefined;
    let stopPolling = false;
    let resolved = false;

    const updateStatus = (next: AccountHeaderStatus) => {
      resolved = true;
      setStatus(next);
    };

    const refresh = async (showChecking = true) => {
      if (document.visibilityState === "hidden" || (stopPolling && !showChecking)) return;
      if (!showChecking && request) return;
      if (showChecking) stopPolling = false;
      const sequence = ++epoch;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      const requestedIdentity = identity.current;
      if (showChecking || !resolved) setStatus({ kind: "checking" });

      try {
        const response = await fetch("/api/account", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (sequence !== epoch) return;
        if (response.status === 401) {
          stopPolling = true;
          updateStatus({ kind: "signed-out" });
          return;
        }
        if (!response.ok) {
          stopPolling = true;
          updateStatus({ kind: "unavailable" });
          return;
        }

        const value: unknown = await response.json();
        if (sequence !== epoch) return;
        if (!isRecord(value) || value.contractVersion !== 1 || !isRecord(value.account)) {
          stopPolling = true;
          updateStatus({ kind: "unavailable" });
          return;
        }

        const account = value.account;
        if (
          typeof account.userId !== "string" || !account.userId ||
          (account.status !== "active" && account.status !== "pending" && account.status !== "blocked") ||
          typeof account.bootstrap !== "boolean" ||
          (account.role !== "member" && account.role !== "admin")
        ) {
          stopPolling = true;
          updateStatus({ kind: "unavailable" });
          return;
        }

        const currentIdentity = identity.current;
        if (
          (requestedIdentity.userId && requestedIdentity.userId !== account.userId) ||
          (currentIdentity.userId && currentIdentity.userId !== account.userId)
        ) {
          stopPolling = true;
          updateStatus({ kind: "unavailable" });
          return;
        }

        const accountKey = requestedIdentity.userId === account.userId
          ? requestedIdentity.key ?? currentIdentity.key
          : currentIdentity.key;

        if (account.status === "active" && !account.bootstrap) {
          stopPolling = false;
          updateStatus({
            kind: "active",
            userId: account.userId,
            name: typeof account.name === "string" ? account.name.trim() : "",
            admin: account.role === "admin",
            accountKey,
          });
          return;
        }

        const message = account.status === "blocked"
          ? "Zugang gesperrt"
          : account.status === "pending"
            ? "Freischaltung ausstehend"
            : "Einrichtung erforderlich";
        stopPolling = true;
        updateStatus({
          kind: "restricted",
          userId: account.userId,
          accountKey,
          message,
        });
      } catch {
        if (sequence !== epoch || controller.signal.aborted) return;
        stopPolling = true;
        updateStatus({ kind: "unavailable" });
      } finally {
        if (request === controller) request = undefined;
      }
    };

    const timer = window.setTimeout(() => void refresh(true), 0);
    const poll = window.setInterval(() => void refresh(false), 5000);
    const onRefresh = () => void refresh(true);
    const onSignedOut = () => {
      stopPolling = true;
      epoch++;
      request?.abort();
      request = undefined;
      updateStatus({ kind: "signed-out" });
    };
    window.addEventListener("focus", onRefresh);
    window.addEventListener("pageshow", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    window.addEventListener("stex:account-signed-out", onSignedOut);

    return () => {
      epoch++;
      request?.abort();
      request = undefined;
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("pageshow", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
      window.removeEventListener("stex:account-signed-out", onSignedOut);
    };
  }, [retry]);

  const statusMatchesAccount =
    (status.kind !== "active" && status.kind !== "restricted") ||
    ((!userId || status.userId === userId) && (status.accountKey === null || status.accountKey === key));
  const visibleStatus: AccountHeaderStatus = statusMatchesAccount ? status : { kind: "checking" };
  const verifiedAdmin =
    key !== null && userId !== null &&
    status.kind === "active" && status.userId === userId &&
    status.accountKey === key && status.admin;

  const links: [string, string][] = [
    ["/onboarding", "Profil & Stationen"], ["/kalender", "Monatskalender"],
    ["/plan", "Lernplan"], ["/konto/dokumente", "Meine Dokumente"],
    ["/admin", "Einstellungen"], ["/konto/ki", "KI-Zugang"],
    ["/konto", "Mein Konto"],
  ];
  if (verifiedAdmin) links.push(["/konto/verwaltung#einladen", "Eine Person einladen"], ["/konto/verwaltung", "Verwaltung"]);

  const signOut = async () => {
    if (signingOut || (visibleStatus.kind !== "active" && visibleStatus.kind !== "restricted")) return;
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Stex-Action": "1" },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Abmeldung nicht bestätigt.");
      notifyAccountSignedOut();
      setOpen(false);
      router.replace("/konto/anmelden");
      router.refresh();
    } catch {
      setStatus({ kind: "unavailable" });
    } finally {
      setSigningOut(false);
    }
  };

  return <div className="flex items-center gap-1 sm:gap-2">
    {(visibleStatus.kind === "active" || visibleStatus.kind === "restricted") && <>
      {visibleStatus.kind === "active" ? (
        <div role="status" aria-label={`${visibleStatus.name ? `${visibleStatus.name} · ` : ""}Angemeldet`} className="flex max-w-[4rem] flex-col items-end text-right text-[10px] leading-tight sm:max-w-[11rem] sm:text-xs">
          {visibleStatus.name && <span title={visibleStatus.name} className="max-w-full truncate font-medium">{visibleStatus.name}</span>}
          <span className="whitespace-nowrap text-slate-500">Angemeldet</span>
        </div>
      ) : (
        <>
          <span role="status" className="max-w-[4.5rem] text-right text-[9px] leading-tight sm:max-w-[11rem] sm:text-xs">{visibleStatus.message}</span>
          <button type="button" aria-label="Erneut prüfen" title="Erneut prüfen" onClick={() => setRetry(value => value + 1)} className="whitespace-nowrap text-[9px] underline sm:text-[11px]">Prüfen</button>
        </>
      )}
      <button type="button" disabled={signingOut} onClick={() => void signOut()} className="whitespace-nowrap text-[10px] text-slate-600 underline hover:text-slate-900 disabled:opacity-50 sm:text-xs">
        {signingOut ? "Abmelden …" : "Abmelden"}
      </button>
    </>}
    {visibleStatus.kind === "signed-out" && <Link href="/konto/anmelden" className="whitespace-nowrap text-xs underline">Anmelden</Link>}
    {(visibleStatus.kind === "checking" || visibleStatus.kind === "unavailable") && <div className="flex items-center gap-1">
      <span role="status" className="max-w-[4rem] text-right text-[9px] leading-tight sm:max-w-none sm:text-[11px]">
        {visibleStatus.kind === "checking" ? "Status wird geprüft" : "Kontostatus gerade nicht verfügbar"}
      </span>
      <button type="button" aria-label="Erneut prüfen" title="Erneut prüfen" onClick={() => setRetry(value => value + 1)} className="whitespace-nowrap text-[9px] underline sm:text-[11px]">Prüfen</button>
    </div>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger aria-label="Konto und Einstellungen" title="Konto und Einstellungen" className="h-9 w-9 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors"><Settings className="h-4 w-4" /></DialogTrigger>
      <DialogContent className="rounded-none border border-slate-200 shadow-none sm:max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-serif text-xl font-normal">Konto und Einstellungen</DialogTitle></DialogHeader>
        <ul className="divide-y divide-slate-200">{links.map(([href, label]) => <li key={href}><Link href={href} onClick={() => setOpen(false)} className={`block py-3 font-sans text-sm hover:text-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 ${href.includes("#einladen") ? "font-medium text-accent-700" : ""}`} aria-current={path === href ? "page" : undefined}>{label}</Link></li>)}</ul>
      </DialogContent>
    </Dialog>
  </div>;
}
