import { isIP } from "node:net";
import { isAbsolute, resolve, sep } from "node:path";
import type { PoolConfig } from "pg";
import { AccountError } from "./security";

export type AuthEnvironment = Readonly<Record<string, string | undefined>>;
export interface ProductionAuthConfig {
  baseURL: string;
  database: PoolConfig;
  privateFileRoot: string;
  secret: string;
  mailKey: string;
}

/** Carries a field name, never a rejected value, URI, password or parser cause. */
export class ProductionAuthConfigError extends AccountError {
  constructor(readonly field: string) {
    super("invalid_production_config", "Die Produktionskonfiguration ist unvollständig oder ungültig.", 503);
  }
}
function invalid(field: string): never { throw new ProductionAuthConfigError(field); }
function required(env: AuthEnvironment, field: string): string {
  const value = env[field];
  if (typeof value !== "string" || !value || value.length > 8192 || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) invalid(field);
  return value;
}
function secret(env: AuthEnvironment, field: string): string {
  const value = required(env, field);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(value) || new Set(value).size < 12
    || /secret|password|changeme|placeholder|development|example|synthetic/i.test(value)) invalid(field);
  for (let size = 1; size <= value.length / 2; size++) {
    if (value.length % size === 0 && value.slice(0, size).repeat(value.length / size) === value) invalid(field);
  }
  return value;
}
function url(value: string, field: string): URL {
  try { return new URL(value); } catch { return invalid(field); }
}
function loopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Pure server-side adapter: no DNS, files, sockets, migrations, secret generation or env mutation. */
export function readProductionAuthConfig(env: AuthEnvironment, applicationRoot: string): ProductionAuthConfig {
  if (env.NODE_ENV !== "production" || env.STEX_AUTH_MODE !== "production") invalid("mode");
  if (env.STEX_LOCAL_DATA_DIR !== undefined || env.STEX_LOCAL_POSTGRES_PORT !== undefined) invalid("local_fallback");

  const originValue = required(env, "BETTER_AUTH_URL"), origin = url(originValue, "BETTER_AUTH_URL");
  // A fixed DNS origin, never a proxy/request-derived value or development address.
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash
    || origin.pathname !== "/" || !origin.hostname.includes(".") || origin.hostname.endsWith(".")
    || isIP(origin.hostname.replace(/^\[|\]$/g, "")) !== 0 || /(^|\.)localhost$/i.test(origin.hostname)
    || !/^[a-z0-9.-]+$/i.test(origin.hostname)
    || origin.hostname.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) invalid("BETTER_AUTH_URL");
  // Reject normalized paths such as /../ too, while accepting a single trailing slash.
  if (originValue !== origin.origin && originValue !== `${origin.origin}/`) invalid("BETTER_AUTH_URL");

  const dbValue = required(env, "DATABASE_URL"), db = url(dbValue, "DATABASE_URL");
  if (!["postgres:", "postgresql:"].includes(db.protocol) || !db.hostname || !db.username || !db.password
    || !db.port || db.hash || db.search) invalid("DATABASE_URL");
  let user: string, password: string, database: string;
  try { user = decodeURIComponent(db.username); password = decodeURIComponent(db.password); database = decodeURIComponent(db.pathname.slice(1)); }
  catch { return invalid("DATABASE_URL"); }
  if (!user || password.length < 16 || /^(postgres|password|changeme|placeholder|test)(?:[-_0-9]*)$/i.test(password)
    || /[\u0000-\u001f\u007f]/.test(user + password) || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,62}$/.test(database)) invalid("DATABASE_URL");
  const port = Number(db.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) invalid("DATABASE_URL");
  const tls = required(env, "STEX_DATABASE_TLS");
  if (tls !== "verify-full" && !(tls === "loopback" && loopback(db.hostname))) invalid("STEX_DATABASE_TLS");

  if (!isAbsolute(applicationRoot) || resolve(applicationRoot) !== applicationRoot || applicationRoot === sep) invalid("application_root");
  const privateFileRoot = required(env, "STEX_PRIVATE_FILE_ROOT");
  if (!isAbsolute(privateFileRoot) || resolve(privateFileRoot) !== privateFileRoot
    || privateFileRoot === sep || privateFileRoot.split(sep).some(part => ["public", ".local", ".next", ".next-qa", "node_modules", ".git"].includes(part.toLowerCase()))
    || privateFileRoot === resolve(applicationRoot) || privateFileRoot.startsWith(resolve(applicationRoot) + sep)) invalid("STEX_PRIVATE_FILE_ROOT");

  const authSecret = secret(env, "BETTER_AUTH_SECRET"), mailKey = secret(env, "STEX_AUTH_MAIL_KEY");
  if (authSecret === mailKey || authSecret === password || mailKey === password) invalid("separate_secrets");
  return {
    baseURL: origin.origin,
    // Explicit fields prevent libpg URI query options or PG* defaults overriding the contract.
    database: { host: db.hostname.replace(/^\[|\]$/g, ""), port, user, password, database,
      ssl: tls === "verify-full" ? { rejectUnauthorized: true } : false, connectionTimeoutMillis: 5000 },
    privateFileRoot, secret: authSecret, mailKey,
  };
}
