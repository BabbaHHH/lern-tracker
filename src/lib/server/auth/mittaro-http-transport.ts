import { createHash } from "node:crypto";
import { smtpMailbox } from "./smtp-config";
import type { AuthEnvironment } from "./production-config";
import { readMittaroHttpConfig, type MittaroHttpConfig } from "./mittaro-http-config";
import type { DispatchMail, MailTransport, MailTransportResult } from "./mail-transport";

export interface MittaroFetchBindings {
  fetch(input: string, init: RequestInit): Promise<Response>;
  timer(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
  clearTimer(timer: ReturnType<typeof setTimeout>): void;
  timeoutMs: number;
}
const bindings: MittaroFetchBindings = {
  fetch: (input, init) => globalThis.fetch(input, init),
  timer: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimer: timer => clearTimeout(timer),
  timeoutMs: 8_000,
};

const subjects = {
  invitation: "Deine Einladung zum Stex Tracker",
  verification: "Deine E-Mail-Adresse bestätigen",
  reset: "Dein Passwort zurücksetzen",
} as const;

/** Re-checks the existing dispatcher's strict purpose, recipient and origin boundary. */
function validMail(mail: DispatchMail, config: MittaroHttpConfig): boolean {
  if (!mail || !smtpMailbox(mail.email) || !/^[A-Za-z0-9_-]{1,128}$/.test(mail.id)
    || typeof mail.url !== "string" || mail.url.length > 16_384
    || /[\u0000-\u0020\u007f]/.test(mail.url)) return false;
  try {
    const url = new URL(mail.url);
    if (url.origin !== config.baseURL || url.username || url.password || url.hash) return false;
    const keys = [...url.searchParams.keys()];
    if (keys.length !== new Set(keys).size) return false;
    const token = url.searchParams.get("token");
    const allowed = mail.purpose === "invitation" ? ["token", "email"]
      : mail.purpose === "verification" ? ["token", "callbackURL"] : ["callbackURL"];
    if (!Object.hasOwn(subjects, mail.purpose) || keys.some(key => !allowed.includes(key))) return false;
    if (mail.purpose === "invitation" && (url.pathname !== "/konto/einrichten" || !token
      || !/^[\w-]{1,128}$/.test(token) || url.searchParams.get("email") !== mail.email)) return false;
    if (mail.purpose === "verification" && (url.pathname !== "/api/auth/verify-email" || !token
      || !/^[\w.-]{1,8192}$/.test(token))) return false;
    if (mail.purpose === "reset" && !/^\/api\/auth\/reset-password\/[\w-]{1,128}$/.test(url.pathname)) return false;
    const callback = url.searchParams.get("callbackURL");
    return !callback || new URL(callback, config.baseURL).origin === config.baseURL;
  } catch { return false; }
}

function rejected(status: number): MailTransportResult | undefined {
  // These documented responses explicitly reject/decline the current request.
  // Even quota/service responses are not retried by the mail dispatcher.
  if ([400, 401, 403, 409, 413, 422, 429, 503].includes(status)) {
    return { outcome: "not_accepted", retryable: false };
  }
  return undefined;
}

/** Uses the existing server fetch and MailTransport contract; never retries or logs. */
export function createMittaroHttpTransport(
  env: AuthEnvironment, baseURL: string, dependencies: MittaroFetchBindings = bindings,
): MailTransport {
  const config = readMittaroHttpConfig({ ...env }, baseURL);
  if (!Number.isInteger(dependencies.timeoutMs) || dependencies.timeoutMs < 100 || dependencies.timeoutMs > 10_000
    || typeof dependencies.fetch !== "function") throw new Error("Ungültige HTTP-Mailgrenze.");
  let active = false;
  return {
    async send(mail, signal) {
      if (active || signal.aborted) return { outcome: "not_accepted", retryable: false };
      if (!validMail(mail, config)) return { outcome: "not_accepted", retryable: false };
      active = true;
      const controller = new AbortController();
      let timedOut = false;
      const abort = () => controller.abort();
      let timer: ReturnType<typeof setTimeout> | undefined;
      signal.addEventListener("abort", abort, { once: true });
      try {
        if (signal.aborted) controller.abort();
        timer = dependencies.timer(() => { timedOut = true; controller.abort(); }, dependencies.timeoutMs);
        const idempotencyKey = `stex-auth-${createHash("sha256").update(mail.id).digest("hex")}`;
        const subject = subjects[mail.purpose];
        const body = JSON.stringify({
          from: config.fromAddress,
          to: mail.email,
          subject,
          text: `${subject}\n\n${mail.url}\n\nDieser persönliche Sicherheitslink ist zeitlich begrenzt. Falls du diese Aktion nicht angefordert hast, ignoriere diese Nachricht.`,
        });
        if (signal.aborted) return { outcome: "not_accepted", retryable: false };
        const response = await dependencies.fetch(config.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body,
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        // Do not inspect or retain provider response bodies; the documented status is enough.
        void response.body?.cancel().catch(() => {});
        if (response.status === 200 || response.status === 202) return { outcome: "accepted" };
        return rejected(response.status) ?? { outcome: "unknown" };
      } catch {
        // Once fetch has started, a timeout/connection failure cannot prove non-acceptance.
        return { outcome: "unknown" };
      } finally {
        if (timer !== undefined) dependencies.clearTimer(timer);
        signal.removeEventListener("abort", abort);
        active = false;
      }
    },
  };
}
