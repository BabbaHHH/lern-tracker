import { isIP } from "node:net";
import { smtpMailbox } from "./smtp-config";
import type { AuthEnvironment } from "./production-config";

const API_ENDPOINT = "https://api.mittaro.de/v1/emails";
const VERIFIED_SENDER_DOMAIN = "mail.stex-tracker.de";
export class MittaroHttpConfigError extends Error {
  constructor(readonly field: string) { super("Die HTTP-Mailkonfiguration ist unvollständig oder ungültig."); }
}
function invalid(field: string): never { throw new MittaroHttpConfigError(field); }
function required(env: AuthEnvironment, field: string, max: number): string {
  const value = env[field];
  if (typeof value !== "string" || !value || value !== value.trim() || value.length > max
    || /[\u0000-\u001f\u007f]/.test(value)) invalid(field);
  return value;
}
export interface MittaroHttpConfig {
  readonly endpoint: typeof API_ENDPOINT;
  readonly apiKey: string;
  readonly fromAddress: string;
  readonly baseURL: string;
}

/** Pure fixed-endpoint config. It never reads a file, resolves DNS or contacts Mittaro. */
export function readMittaroHttpConfig(env: AuthEnvironment, baseURL: string): Readonly<MittaroHttpConfig> {
  const key = required(env, "STEX_MITTARO_API_KEY", 1024);
  if (!key.startsWith("tx_live_") || key.length < 16 || !/^[\x21-\x7e]+$/.test(key)
    || key === env.BETTER_AUTH_SECRET || key === env.STEX_AUTH_MAIL_KEY || key === env.STEX_SMTP_PASSWORD) {
    invalid("STEX_MITTARO_API_KEY");
  }
  const fromAddress = required(env, "STEX_MITTARO_FROM_ADDRESS", 254);
  if (!smtpMailbox(fromAddress) || fromAddress !== fromAddress.toLowerCase()
    || fromAddress.split("@")[1] !== VERIFIED_SENDER_DOMAIN) invalid("STEX_MITTARO_FROM_ADDRESS");
  let origin: URL;
  try { origin = new URL(baseURL); } catch { return invalid("baseURL"); }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash
    || origin.pathname !== "/" || !origin.hostname.includes(".") || origin.hostname.endsWith(".")
    || isIP(origin.hostname.replace(/^\[|\]$/g, "")) !== 0 || /(^|\.)localhost$/i.test(origin.hostname)
    || !/^[a-z0-9.-]+$/i.test(origin.hostname)
    || origin.hostname.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
    || (baseURL !== origin.origin && baseURL !== `${origin.origin}/`)) invalid("baseURL");
  return Object.freeze({ endpoint: API_ENDPOINT, apiKey: key, fromAddress, baseURL: origin.origin });
}
