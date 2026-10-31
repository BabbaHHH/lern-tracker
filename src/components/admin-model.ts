export interface ManagedAccount {
  userId: string; email: string; name: string; status: string; role: string; revision: number;
  emailVerified: boolean; invitationExpiresAt: string | null; invitationConsumedAt: string | null;
  invitationRevokedAt: string | null; librarySessionsRevoked: boolean | null;
}
export function ready(account: ManagedAccount) { return !!account.invitationConsumedAt && account.emailVerified && !account.invitationRevokedAt; }
export function accountStage(account: ManagedAccount, now = Date.now()) {
  if (account.role === "admin") return "Admin";
  if (account.invitationRevokedAt) return "Einladung widerrufen";
  if (!account.invitationConsumedAt) return account.invitationExpiresAt && Date.parse(account.invitationExpiresAt) <= now ? "Einladung abgelaufen" : "Einladung offen";
  return account.emailVerified ? "Adresse bestätigt" : "Adresse noch nicht bestätigt";
}
export const actionLabels: Record<string, string> = { activate: "Freischalten", block: "Sperren", unblock: "Sperre aufheben", resend: "Erneut einladen", revoke: "Einladung widerrufen", cleanup: "Sitzungen bereinigen" };
export function accountActions(account: ManagedAccount) {
  if (account.role === "admin") return [];
  const actions = account.status === "blocked" ? ["unblock"] : account.status === "active" ? ["block"] : account.invitationConsumedAt ? [...(ready(account) ? ["activate"] : []), "block"] : ["resend", ...(account.invitationRevokedAt ? [] : ["revoke"]), "block"];
  return account.librarySessionsRevoked === false ? ["cleanup", ...actions] : actions;
}
export function accountCounts(accounts: ManagedAccount[], now = Date.now()) {
  return { active: accounts.filter(a => a.status === "active").length, blocked: accounts.filter(a => a.status === "blocked").length,
    waiting: accounts.filter(a => a.status === "pending" && ready(a)).length,
    invitations: accounts.filter(a => a.status === "pending" && !a.invitationConsumedAt && !a.invitationRevokedAt && a.invitationExpiresAt && Date.parse(a.invitationExpiresAt) > now).length };
}
export class AdminRequestError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function adminRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json", "X-Stex-Action": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new AdminRequestError(data.error?.message ?? "Der Abruf ist gerade nicht verfügbar.", response.status);
  return data;
}
