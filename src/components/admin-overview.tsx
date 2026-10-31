"use client";
import Link from "next/link";
import { AdminConfirmation } from "./admin-confirmation";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountActions, accountCounts, accountStage, actionLabels, adminRequest, AdminRequestError, type ManagedAccount } from "./admin-model";

interface ImportItem { importId: string; createdAt: string; updatedAt: string; completedAt: string | null; status: string; klausurId: string | null; title: string; sourceReference: string; technicalValidation: string; duplicateStatus: string; warningCount: number; warningCodes: string[]; safeMessage: string | null; }
interface ImportPage { items: ImportItem[]; nextCursor: string | null; periodStart: string; periodEnd: string; }
interface ImportDetail extends ImportItem { documents: { documentVersionId: string; role: string; versionNumber: number; pageCount: number | null; textStatus: string; byteSize: number }[]; }
interface AuditPage { items: { id: string; createdAt: string; action: string; actorLabel: string; requestId: string; outcome: string }[]; nextCursor: string | null; }
interface Overview { ownerUserId: string; asOf: string; imports: { periodStart: string; periodEnd: string; byStatus: Record<string, number> }; }
interface PendingAction { path: string; body: Record<string, unknown>; label: string; }
interface InvitationLink { url: string; email: string; expiresAt: string; }
const api = "/api/account/admin-overview";
const box = "rounded-xl border border-slate-200 bg-white p-5 space-y-3";
const button = "rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50";
const input = "w-full rounded-lg border border-slate-300 px-3 py-2";
const statuses: Record<string, string> = { active: "Aktiv", pending: "Wartend", blocked: "Gesperrt", queued: "Vorgemerkt", processing: "In Bearbeitung", committed: "Übernommen", failed: "Fehlgeschlagen" };
const duplicates: Record<string, string> = { pending: "Noch nicht ermittelt", identical: "Identische Dateien", candidate: "Mögliche Dublette", distinct: "Eigenständig", conflict: "Zuordnungskonflikt" };
function date(value: string | null) { return value ? new Date(value).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "–"; }
export function AdminOverview() {
  const sequence = useRef(0), alive = useRef(true), writing = useRef(false);
  const inviteAnchorHandled = useRef(false);
  const pendingLink = useRef<{ owner: string; action: PendingAction } | null>(null);
  const [data, setData] = useState<{ owner: string; accounts: ManagedAccount[]; overview: Overview; imports: ImportPage; failures: ImportPage } | null>(null);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""), [filter, setFilter] = useState(""), [importFilter, setImportFilter] = useState(""), [days, setDays] = useState("30");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [retry, setRetry] = useState<PendingAction | null>(null);
  const [linkOnly, setLinkOnly] = useState(false), [invitationLink, setInvitationLink] = useState<InvitationLink | null>(null);
  const [confirm, setConfirm] = useState<{ account: ManagedAccount; action: string } | null>(null);
  const [detail, setDetail] = useState<ImportDetail | null>(null), [audit, setAudit] = useState<{ userId: string; name: string; page: AuditPage } | null>(null);
  const clear = useCallback(() => { setData(null); setDetail(null); setAudit(null); setConfirm(null); setRetry(null); setName(""); setEmail(""); setLinkOnly(false); setInvitationLink(null); }, []);
  const range = useCallback((view: string, to?: string) => {
    const end = to ?? new Date().toISOString();
    return new URLSearchParams({ view, to: end, from: new Date(Date.parse(end) - Number(days) * 86400000).toISOString(), ...(view === "imports" ? { status: importFilter } : {}) });
  }, [days, importFilter]);
  const load = useCallback(async () => {
    const current = ++sequence.current; setLoading(true); clear();
    try {
      const identity = await adminRequest<{ account: { userId: string; role: string; status: string } }>("/api/account");
      if (identity.account.role !== "admin" || identity.account.status !== "active") throw new AdminRequestError("Nur aktive Admins können die Verwaltung öffnen.", 403);
      const end = new Date().toISOString();
      const [accounts, overview, imports, failures] = await Promise.all([
        adminRequest<{ accounts: ManagedAccount[] }>("/api/account/admin/accounts"), adminRequest<Overview>(api),
        adminRequest<ImportPage>(`${api}?${range("imports", end)}`), adminRequest<ImportPage>(`${api}?${new URLSearchParams({ ...Object.fromEntries(range("imports", end)), status: "failed" })}`),
      ]);
      if (!alive.current || current !== sequence.current) return;
      const latest = await adminRequest<{ account: { userId: string } }>("/api/account");
      if (latest.account.userId !== identity.account.userId || overview.ownerUserId !== identity.account.userId) throw new AdminRequestError("Der Kontozugang hat sich geändert. Bitte neu laden.", 401);
      if (!alive.current || current !== sequence.current) return;
      setData({ owner: identity.account.userId, accounts: accounts.accounts, overview, imports, failures });
      if (pendingLink.current?.owner === identity.account.userId) setRetry(pendingLink.current.action);
      else pendingLink.current = null;
    } catch (error) { if (alive.current && current === sequence.current) { if (error instanceof AdminRequestError && [401, 403].includes(error.status)) pendingLink.current = null; setMessage(error instanceof Error ? error.message : "Die Verwaltung ist nicht verfügbar."); } }
    finally { if (alive.current && current === sequence.current) setLoading(false); }
  }, [clear, range]);
  useEffect(() => {
    alive.current = true;
    const start = setTimeout(() => void load(), 0);
    const epoch = sequence;
    const refresh = () => { if (document.visibilityState === "visible" && !writing.current) void load(); };
    const hide = () => { if (document.visibilityState !== "visible") { sequence.current++; clear(); } else refresh(); };
    window.addEventListener("pageshow", refresh); document.addEventListener("visibilitychange", hide);
    return () => { alive.current = false; epoch.current++; clearTimeout(start); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", hide); };
  }, [load, clear]);
  useEffect(() => {
    if (!data || inviteAnchorHandled.current || window.location.hash !== "#einladen") return;
    const invitationForm = document.getElementById("einladen");
    if (!invitationForm) return;
    inviteAnchorHandled.current = true;
    invitationForm.scrollIntoView({ block: "start" });
  }, [data]);
  async function read<T>(path: string, apply: (value: T) => void) {
    if (writing.current || !data) return;
    const current = sequence.current; writing.current = true; setBusy(true); setMessage("");
    try {
      const value = await adminRequest<T>(path);
      if (alive.current && current === sequence.current) {
        if ((value as { ownerUserId?: string }).ownerUserId !== data.owner) throw new AdminRequestError("Der Kontozugang hat sich geändert. Bitte neu laden.", 401);
        apply(value);
      }
    } catch (error) {
      if (alive.current && current === sequence.current) {
        if (error instanceof AdminRequestError && [401, 403].includes(error.status)) { sequence.current++; clear(); }
        setMessage(error instanceof Error ? error.message : "Der Abruf ist nicht verfügbar.");
      }
    } finally { writing.current = false; if (alive.current) setBusy(false); }
  }
  async function perform(action: PendingAction) {
    if (writing.current || !data) return;
    const isLinkOnly = action.path === "/api/account/admin/invitations" && action.body.delivery === "link-only";
    const current = sequence.current; writing.current = true; setBusy(true); setMessage(""); setConfirm(null); setInvitationLink(null);
    try {
      const identity = await adminRequest<{ account: { userId: string } }>("/api/account");
      if (identity.account.userId !== data.owner) throw new AdminRequestError("Der Kontozugang hat sich geändert. Bitte neu laden.", 401);
      if (isLinkOnly) {
        if (!alive.current || current !== sequence.current) return;
        // Retain only the request, never the link, while an answer is unresolved.
        pendingLink.current = { owner: data.owner, action };
      }
      const result = await adminRequest<{ delivery?: string; invitationUrl?: string; expiresAt?: string }>(action.path, action.body);
      if (isLinkOnly) {
        if (!alive.current || current !== sequence.current) return;
        const invalidLink = () => new AdminRequestError("Der Einladungslink konnte nicht sicher angezeigt werden. Bitte dieselbe Aktion wiederholen.", 503);
        if (result.delivery !== "link-only" || typeof result.invitationUrl !== "string" || typeof result.expiresAt !== "string" || !Number.isFinite(Date.parse(result.expiresAt))) throw invalidLink();
        let url: URL; try { url = new URL(result.invitationUrl); } catch { throw invalidLink(); }
        const recipient = String(action.body.email).trim().toLowerCase();
        if (url.origin !== window.location.origin || url.pathname !== "/konto/einrichten" || url.hash || url.username || url.password || url.searchParams.size !== 2 || url.searchParams.get("email") !== recipient || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("token") ?? "")) throw invalidLink();
        const accounts = await adminRequest<{ accounts: ManagedAccount[] }>("/api/account/admin/accounts");
        const latest = await adminRequest<{ account: { userId: string } }>("/api/account");
        if (latest.account.userId !== data.owner) throw new AdminRequestError("Der Kontozugang hat sich geändert. Bitte neu laden.", 401);
        if (alive.current && current === sequence.current) {
          setData(previous => previous?.owner === data.owner ? { ...previous, accounts: accounts.accounts } : previous);
          setInvitationLink({ url: result.invitationUrl, email: recipient, expiresAt: result.expiresAt });
          pendingLink.current = null;
          setRetry(null); setName(""); setEmail("");
          setMessage("Einladungslink erstellt. Es wurde keine Einladungs-E-Mail versendet.");
        }
      } else if (alive.current && current === sequence.current) { await load(); setMessage(`${action.label}: erfolgreich. Der Kontostand wurde neu geladen.`); }
    } catch (error) {
      if (alive.current && current === sequence.current) {
        if (error instanceof AdminRequestError) {
          if ([401, 403].includes(error.status)) { pendingLink.current = null; sequence.current++; clear(); }
          else if (error.status === 409) { pendingLink.current = null; await load(); }
          else if (error.status >= 500) setRetry(action);
          else pendingLink.current = null;
        } else setRetry(action);
        setMessage(error instanceof Error ? error.message : "Die Antwort ist unklar. Wiederholen verwendet dieselbe Vorgangskennung.");
      }
    } finally { writing.current = false; if (alive.current) { setBusy(false); if (isLinkOnly && pendingLink.current && current !== sequence.current && document.visibilityState === "visible") void load(); } }
  }
  function change(account: ManagedAccount, action: string) {
    if (["block", "revoke"].includes(action)) { setConfirm({ account, action }); return; }
    void perform({ path: "/api/account/admin/account-action", body: { userId: account.userId, action, expectedRevision: account.revision, requestId: crypto.randomUUID() }, label: `${actionLabels[action]} · ${account.name}` });
  }
  const counts = data ? accountCounts(data.accounts) : null;
  const visible = data?.accounts.filter(a => `${a.name} ${a.email}`.toLocaleLowerCase("de-DE").includes(search.toLocaleLowerCase("de-DE")) && (!filter || a.status === filter || accountStage(a) === filter)) ?? [];
  const cleanup = data?.accounts.filter(a => a.librarySessionsRevoked === false) ?? [];
  const disabled = busy || loading || !!retry;
  function importCards(items: ImportItem[]) { return items.map(item => <article key={item.importId} className={box}><h3 className="font-medium">{item.title}</h3><p>{date(item.createdAt)} · {statuses[item.status]} · {duplicates[item.duplicateStatus]}</p><p className="break-words">{item.sourceReference}</p>{item.status === "committed" && <p>Direkt angenommen · keine Inhaltsprüfung</p>}{item.safeMessage && <p>{item.safeMessage}</p>}{item.status === "processing" && <p>Letzte Aktualisierung: {date(item.updatedAt)}. Aktueller Fortschritt nicht nachgewiesen.</p>}<button className={button} disabled={disabled} onClick={() => void read<{ import: ImportDetail }>(`${api}?${new URLSearchParams({ view: "detail", importId: item.importId })}`, value => setDetail(value.import))}>Importdetails</button></article>); }
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap justify-between gap-3"><div><Link className="underline" href="/konto">Zum Konto</Link><h1 className="mt-3 text-3xl font-semibold">Verwaltung</h1><p>Konten und Betrieb · manueller Pilot</p></div><button className={button} disabled={busy || loading || !!retry} onClick={() => void load()}>Aktualisieren</button></header>
    {message && <p role="status" className="rounded-lg bg-indigo-50 p-4">{message}</p>}
    {loading && <p role="status">Verwaltung wird geladen …</p>}
    {!data && !loading && <Link className="underline" href="/konto/anmelden">Erneut mit Authenticator anmelden</Link>}
    {data && <>
      <p className="text-sm text-slate-600">Betriebsstand: {date(data.overview.asOf)} · Konten zuletzt bei diesem Abruf geladen. Zeiten: Europe/Berlin.</p>
      <div className="grid gap-3 sm:grid-cols-4">{[["Aktive Konten", counts!.active], ["Wartet auf Freischaltung", counts!.waiting], ["Gesperrt", counts!.blocked], ["Offene Einladungen", counts!.invitations]].map(([label, value]) => <p key={label} className={box}>{label}<strong className="block text-2xl">{value}</strong></p>)}</div>
      <p className="text-sm">Kontozahlen enthalten Admins. Aktive Konten sind kein Nachweis tatsächlicher Nutzung.</p>
      <nav aria-label="Verwaltungsbereiche" className="flex flex-wrap gap-5"><a className="underline" href="#einladen">Eine Person einladen</a><a className="underline" href="#konten">Konten</a><a className="underline" href="#importe">Importe</a><a className="underline" href="#betrieb">Betrieb</a></nav>
      {retry && <section className={box}><h2 className="font-semibold">Antwort unklar</h2><p>{retry.label}. Wiederholen verwendet dieselbe Vorgangskennung und verändert die Eingabe nicht.</p><button className={button} disabled={busy} onClick={() => void perform(retry)}>Dieselbe Aktion wiederholen</button><button className={button} disabled={busy} onClick={() => void load()}>Nur aktuellen Stand laden</button></section>}
      <section id="konten" className="space-y-4"><h2 className="text-2xl font-semibold">Konten</h2>
        <form id="einladen" aria-labelledby="einladen-titel" className={`${box} scroll-mt-24 border-accent-300`} onSubmit={event => { event.preventDefault(); void perform({ path: "/api/account/admin/invitations", body: { name, email, requestId: crypto.randomUUID(), ...(linkOnly ? { delivery: "link-only" } : {}) }, label: linkOnly ? "Einladungslink erstellen" : "Einladung per E-Mail vorbereiten" }); }}><h3 id="einladen-titel" className="font-medium">Eine Person einladen</h3><p className="text-sm text-slate-600">Lade jemanden ein, der ebenfalls mit dem gemeinsamen Klausurkatalog lernen möchte. Lernnotizen und Dokumente bleiben privat. Im Pilot schaltest du das Konto nach bestätigter E-Mail-Adresse weiterhin manuell frei.</p><label className="block">Name<input className={input} required maxLength={100} value={name} onChange={e => setName(e.target.value)} disabled={disabled}/></label><label className="block">E-Mail<input className={input} type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={disabled}/></label><label className="flex items-center gap-2"><input type="checkbox" checked={linkOnly} onChange={e => setLinkOnly(e.target.checked)} disabled={disabled}/>Nur persönlichen Link anzeigen (keine Einladungs-E-Mail)</label><button className={button} disabled={disabled}>{linkOnly ? "Einladungslink erstellen" : "Einladung per E-Mail vorbereiten"}</button></form>
        {invitationLink && <section className={box} aria-label="Persönlicher Einladungslink"><h3 className="font-medium">Persönlicher Einladungslink</h3><p>Für {invitationLink.email} · gültig bis {date(invitationLink.expiresAt)} · einmalig verwendbar. Gib den Link persönlich weiter.</p><textarea className={input} aria-label="Einladungslink zum Kopieren" readOnly rows={3} value={invitationLink.url}/><button className={button} onClick={async () => { try { await navigator.clipboard.writeText(invitationLink.url); setMessage("Einladungslink kopiert."); } catch { setMessage("Bitte den Link im Feld markieren und kopieren."); } }}>Link kopieren</button><button className={button} onClick={() => setInvitationLink(null)}>Link ausblenden</button></section>}
        <label className="block">Name oder E-Mail suchen<input className={input} value={search} onChange={e => setSearch(e.target.value)}/></label><label className="block">Kontofilter<select className={input} value={filter} onChange={e => setFilter(e.target.value)}><option value="">Alle Zustände</option>{["active", "pending", "blocked", "Einladung offen", "Einladung abgelaufen", "Einladung widerrufen", "Adresse noch nicht bestätigt"].map(s => <option key={s} value={s}>{statuses[s] ?? s}</option>)}</select></label>
        {!visible.length && <p>Keine Konten für diesen Filter.</p>}
        {visible.map(a => <article key={a.userId} className={box}><h3 className="font-semibold">{a.name} · {a.role === "admin" ? "Admin" : "Mitglied"}</h3><p className="break-all">{a.email}</p><p>{statuses[a.status]} · {accountStage(a)}</p>{!a.invitationConsumedAt && a.invitationExpiresAt && <p>Einladungsfrist: {date(a.invitationExpiresAt)}</p>}{a.librarySessionsRevoked === false && <p>Der Zugriffsschutz gilt. Alte Sitzungen müssen noch bereinigt werden.</p>}<div className="flex flex-wrap gap-2">{accountActions(a).map(action => <button className={button} disabled={disabled} key={action} onClick={() => change(a, action)}>{actionLabels[action]}</button>)}<button className={button} disabled={disabled} onClick={() => void read<AuditPage>(`${api}?${new URLSearchParams({ view: "audit", userId: a.userId })}`, page => setAudit({ userId: a.userId, name: a.name, page }))}>Verwaltungsverlauf</button></div></article>)}
      </section>
      {confirm && <AdminConfirmation title={`${actionLabels[confirm.action]} bestätigen`} description={`${confirm.account.name} · ${confirm.account.email}. ${confirm.action === "block" ? "Der Zugriff wird gesperrt; bisherige Sitzungen werden entwertet." : "Der bisherige Einladungslink wird ungültig."}`} busy={busy} cancel={() => setConfirm(null)} confirm={() => void perform({ path: "/api/account/admin/account-action", body: { userId: confirm.account.userId, action: confirm.action, expectedRevision: confirm.account.revision, requestId: crypto.randomUUID() }, label: `${actionLabels[confirm.action]} · ${confirm.account.name}` })} />}
      {audit && <section className={box}><h2 className="font-semibold">Verwaltungsverlauf · {audit.name}</h2>{!audit.page.items.length && <p>Noch keine Verwaltungsaktionen.</p>}<ul>{audit.page.items.map(item => <li key={item.id}>{date(item.createdAt)} · {item.actorLabel} · {actionLabels[item.action] ?? ({ invite: "Einladung erstellt", "prepare-admin": "Admin vorbereitet", "finish-admin": "Admin eingerichtet", "recover-admin": "Adminwiederherstellung" } as Record<string, string>)[item.action]} · {item.outcome === "cleanup_pending" ? "Bereinigung ausstehend" : "Abgeschlossen"}</li>)}</ul>{audit.page.nextCursor && <button className={button} disabled={disabled} onClick={() => void read<AuditPage>(`${api}?${new URLSearchParams({ view: "audit", userId: audit.userId, cursor: audit.page.nextCursor! })}`, page => setAudit({ ...audit, page: { ...page, items: [...audit.page.items, ...page.items] } }))}>Weitere Aktionen laden</button>}<button className={button} onClick={() => setAudit(null)}>Verlauf schließen</button></section>}
      <section id="importe" className="space-y-4"><h2 className="text-2xl font-semibold">Importe</h2><p>Letzte 30 Tage: {Object.entries(data.overview.imports.byStatus).map(([s, n]) => `${statuses[s]}: ${n}`).join(" · ")}. Gezählt werden gespeicherte Vorgänge, keine Uploadversuche.</p><div className="flex flex-wrap gap-3"><label>Status<select className={input} value={importFilter} disabled={busy} onChange={e => setImportFilter(e.target.value)}><option value="">Alle</option>{["queued", "processing", "committed", "failed"].map(s => <option key={s} value={s}>{statuses[s]}</option>)}</select></label><label>Zeitraum<select className={input} value={days} disabled={busy} onChange={e => setDays(e.target.value)}>{[7, 30, 90].map(d => <option key={d} value={d}>Letzte {d} Tage</option>)}</select></label></div><p className="text-sm">{date(data.imports.periodStart)} bis {date(data.imports.periodEnd)} (Ende ausgeschlossen)</p>{!data.imports.items.length && <p>Keine gespeicherten Importe in diesem Zeitraum.</p>}{importCards(data.imports.items)}{data.imports.nextCursor && <button className={button} disabled={disabled} onClick={() => void read<ImportPage>(`${api}?${new URLSearchParams({ view: "imports", status: importFilter, cursor: data.imports.nextCursor! })}`, page => setData({ ...data, imports: { ...page, items: [...data.imports.items, ...page.items] } }))}>Weitere Importe laden</button>}</section>
      {detail && <section className={box}><h2 className="font-semibold">Importdetails · {detail.title}</h2><p className="break-all">Vorgang: {detail.importId}</p><button className={button} onClick={() => void navigator.clipboard.writeText(detail.importId).then(() => setMessage("Vorgangskennung kopiert."), () => setMessage("Bitte die angezeigte Vorgangskennung manuell kopieren."))}>Vorgangskennung kopieren</button><p>{statuses[detail.status]} · {duplicates[detail.duplicateStatus]} · Technisch: {detail.technicalValidation === "valid" ? "gültig" : detail.technicalValidation === "invalid" ? "ungültig" : "ausstehend"}</p><p>Letzte Aktualisierung: {date(detail.updatedAt)} · Abschluss: {date(detail.completedAt)}</p><p>Hinweise: {detail.warningCount} · Direktannahme ohne Inhaltsprüfung</p>{detail.warningCodes.includes("duplicate_overlap") && <p>Die Einreichung überschneidet sich mit einem vorhandenen Fall oder einer Dateiprüfsumme. Die zugehörige Dokumentversion wurde nachvollziehbar gespeichert.</p>}{detail.safeMessage && <p>{detail.safeMessage}</p>}<ul>{detail.documents.map(d => <li className="break-words" key={d.documentVersionId}>{d.role === "sachverhalt" ? "Sachverhalt" : d.role === "loesung" ? "Lösung" : "Dokument"} · Version {d.versionNumber} · {d.pageCount ?? "unbekannt"} Seiten · {d.byteSize} Bytes · {d.textStatus === "ready" ? "Text vorhanden" : "Textaufbereitung ausstehend"}</li>)}</ul>{detail.klausurId && <Link className="underline" href="/konto/klausuren">Zum gemeinsamen Katalog</Link>}<button className={button} onClick={() => setDetail(null)}>Details schließen</button></section>}
      <section id="betrieb" className="space-y-4"><h2 className="text-2xl font-semibold">Betrieb</h2><p>Gespeicherte Importfehler im gewählten Zeitraum und ausstehende Sitzungsbereinigungen. Frühe Uploadablehnungen und allgemeine Serverfehler sind hier nicht vollständig erfasst.</p>{importCards(data.failures.items)}{!data.failures.items.length && <p>Keine gespeicherten Importfehler in diesem Zeitraum.</p>}{data.failures.nextCursor && <button className={button} disabled={disabled} onClick={() => void read<ImportPage>(`${api}?${new URLSearchParams({ view: "imports", status: "failed", cursor: data.failures.nextCursor! })}`, page => setData({ ...data, failures: { ...page, items: [...data.failures.items, ...page.items] } }))}>Weitere Fehler laden</button>}{cleanup.map(a => <p className={box} key={a.userId}>{a.name} · Sitzungsbereinigung ausstehend. Aktion in der Kontoverwaltung.</p>)}{!cleanup.length && <p>Keine ausstehenden Sitzungsbereinigungen.</p>}<div className={box}><h3 className="font-semibold">Noch nicht verfügbar</h3><ul className="list-disc pl-5"><li>Allgemeines Serverfehlerjournal</li><li>Besuche, letzte Nutzung und aktive Mitglieder in 7/30 Tagen</li><li>Abgeschlossene Lernsitzungen und Funktionsnutzung</li><li>KI-Kosten und Guthabenübersicht</li><li>Hostingkosten</li></ul></div></section>
    </>}
  </main>;
}
