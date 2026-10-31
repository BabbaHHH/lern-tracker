import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";

export class AccountError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function seal(value: string, key: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(key).digest(), nonce);
  cipher.setAAD(Buffer.from("stex-auth-v1"));
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [nonce, cipher.getAuthTag(), bytes].map(part => part.toString("base64url")).join(".");
}
export function unseal(value: string, key: string): string {
  const [iv, tag, content, extra] = value.split(".");
  if (!iv || !tag || !content || extra) throw new Error("Geschützte Sicherung ist beschädigt.");
  const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(key).digest(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from("stex-auth-v1"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(content, "base64url")), decipher.final()]).toString("utf8");
}
export function emailAddress(input: unknown): string {
  if (typeof input !== "string" || input.length > 254) throw new AccountError("invalid_input", "Bitte eine gültige E-Mail-Adresse eingeben.");
  const email = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccountError("invalid_input", "Bitte eine gültige E-Mail-Adresse eingeben.");
  return email;
}
export function exactFields(body: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new AccountError("invalid_input", "Unbekanntes Eingabefeld.");
}
export function sameOrigin(request: Request, baseURL: string, mailNavigation = false): void {
  const origin = new URL(baseURL).origin;
  if (new URL(request.url).origin !== origin || (request.headers.get("host") && request.headers.get("host") !== new URL(baseURL).host)) {
    throw new AccountError("invalid_origin", "Unzulässige Adresse.", 403);
  }
  if (request.headers.get("sec-fetch-site") === "cross-site" && !(mailNavigation && request.method === "GET" && request.headers.get("sec-fetch-mode") === "navigate")) throw new AccountError("invalid_origin", "Zugriff von einer anderen Website ist nicht erlaubt.", 403);
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (request.headers.get("origin") !== origin || request.headers.get("x-stex-action") !== "1") throw new AccountError("invalid_origin", "Bitte die Aktion innerhalb der Website ausführen.", 403);
  }
}
export async function atomicLimit(client: PoolClient, key: string, max: number, seconds: number): Promise<void> {
  const result = await client.query<{count:number}>(`INSERT INTO stex.auth_limits(key,count,reset_at) VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_limits.reset_at<=now() THEN 1 ELSE auth_limits.count+1 END,
    reset_at=CASE WHEN auth_limits.reset_at<=now() THEN EXCLUDED.reset_at ELSE auth_limits.reset_at END RETURNING count`, [tokenHash(key), seconds]);
  if (result.rows[0].count > max) throw new AccountError("rate_limited", "Zu viele Versuche. Bitte später erneut versuchen.", 429);
}
export function accountResponse(value: unknown, status = 200): Response {
  return Response.json(value, {status, headers:{"Cache-Control":"private, no-store", "Referrer-Policy":"no-referrer", "X-Content-Type-Options":"nosniff"}});
}
export function accountFailure(error: unknown): Response {
  const known = error instanceof AccountError;
  return accountResponse({contractVersion:1,error:{code:known ? error.code : "unavailable",message:known ? error.message : "Der Kontozugang ist gerade nicht verfügbar."}},known ? error.status : 503);
}
