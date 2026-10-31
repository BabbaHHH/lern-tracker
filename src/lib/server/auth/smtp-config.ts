import { isIP } from "node:net";
import type { AuthEnvironment } from "./production-config";

export interface SmtpConfig {
  readonly host: string; readonly port: 465 | 587; readonly tlsMode: "implicit" | "starttls";
  readonly user: string; readonly password: string; readonly fromAddress: string; readonly fromName: string;
  readonly baseURL: string;
}
export class SmtpConfigError extends Error {
  constructor(readonly field: string) { super("Die SMTP-Konfiguration ist unvollständig oder ungültig."); }
}
function invalid(field: string): never { throw new SmtpConfigError(field); }
function required(env: AuthEnvironment, field: string, max = 1024): string {
  const value = env[field];
  if (!value || value !== value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) invalid(field);
  return value;
}
function dns(value: string): boolean {
  return value.length <= 253 && value.includes(".") && isIP(value) === 0 && !/(^|\.)localhost$/i.test(value)
    && value.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}
/** Single ASCII mailbox only: no lists, display names, comments or header controls. */
export function smtpMailbox(value: string): boolean {
  if (value.length > 254 || !/^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.]+@[A-Za-z0-9.-]+$/.test(value)) return false;
  const [local, domain] = value.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") && dns(domain);
}
/** Pure parser; never loads files, resolves DNS or contacts a provider. */
export function readSmtpConfig(env: AuthEnvironment, baseURL: string): Readonly<SmtpConfig> {
  const host = required(env, "STEX_SMTP_HOST", 253);
  if (!dns(host) || host !== host.toLowerCase()) invalid("STEX_SMTP_HOST");
  const mode = required(env, "STEX_SMTP_TLS");
  const port = required(env, "STEX_SMTP_PORT");
  if (!((mode === "implicit" && port === "465") || (mode === "starttls" && port === "587"))) invalid("STEX_SMTP_TLS");
  if (env.STEX_SMTP_URL !== undefined || env.SMTP_URL !== undefined || env.NODE_TLS_REJECT_UNAUTHORIZED === "0") invalid("unsafe_override");
  const user = required(env, "STEX_SMTP_USER", 254), password = required(env, "STEX_SMTP_PASSWORD");
  if (password.length < 16 || password === env.BETTER_AUTH_SECRET || password === env.STEX_AUTH_MAIL_KEY) invalid("STEX_SMTP_PASSWORD");
  const fromAddress = required(env, "STEX_SMTP_FROM_ADDRESS", 254), fromName = required(env, "STEX_SMTP_FROM_NAME", 100);
  if (!smtpMailbox(fromAddress)) invalid("STEX_SMTP_FROM_ADDRESS");
  let origin: URL;
  try { origin = new URL(baseURL); } catch { return invalid("baseURL"); }
  if (origin.protocol !== "https:" || !dns(origin.hostname) || (baseURL !== origin.origin && baseURL !== `${origin.origin}/`)) invalid("baseURL");
  return Object.freeze({ host, port: Number(port) as 465 | 587, tlsMode: mode as SmtpConfig["tlsMode"], user, password, fromAddress, fromName, baseURL: origin.origin });
}
