import SMTPConnection from "nodemailer/lib/smtp-connection";
import MailComposer from "nodemailer/lib/mail-composer";
import type { Readable } from "node:stream";
import { createHash } from "node:crypto";
import type { AuthEnvironment } from "./production-config";
import { readSmtpConfig, smtpMailbox, type SmtpConfig } from "./smtp-config";
import type { DispatchMail, MailTransport, MailTransportResult } from "./mail-transport";

interface Connection {
  readonly secure: boolean;
  on(event: "error" | "end", listener: (error?: unknown) => void): unknown;
  connect: SMTPConnection["connect"];
  login: SMTPConnection["login"];
  send: SMTPConnection["send"];
  close: SMTPConnection["close"];
}
export interface SmtpBindings {
  connection(options: SMTPConnection.Options): Connection;
  compose(options: MailComposer.Options): Readable;
  timer(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
  clearTimer(timer: ReturnType<typeof setTimeout>): void;
}
const bindings: SmtpBindings = {
  connection: options => new SMTPConnection(options),
  compose: options => new MailComposer(options).compile().createReadStream(),
  timer: (callback, ms) => setTimeout(callback, ms), clearTimer: timer => clearTimeout(timer),
};
function validMail(mail: DispatchMail, config: SmtpConfig): boolean {
  if (!smtpMailbox(mail.email) || !/^[a-zA-Z0-9_-]{1,128}$/.test(mail.id) || mail.url.length > 16_384 || /[\u0000-\u0020\u007f]/.test(mail.url)) return false;
  try {
    const url = new URL(mail.url);
    if (url.origin !== config.baseURL || url.username || url.password || url.hash) return false;
    const keys = [...url.searchParams.keys()];
    if (keys.length !== new Set(keys).size) return false;
    const token = url.searchParams.get("token");
    const allowed = mail.purpose === "invitation" ? ["token", "email"] : mail.purpose === "verification" ? ["token", "callbackURL"] : ["callbackURL"];
    if (keys.some(key => !allowed.includes(key))) return false;
    if (mail.purpose === "invitation" && (url.pathname !== "/konto/einrichten" || !token || !/^[\w-]{1,128}$/.test(token) || url.searchParams.get("email") !== mail.email)) return false;
    if (mail.purpose === "verification" && (url.pathname !== "/api/auth/verify-email" || !token || !/^[\w.-]{1,8192}$/.test(token))) return false;
    if (mail.purpose === "reset" && !/^\/api\/auth\/reset-password\/[\w-]{1,128}$/.test(url.pathname)) return false;
    if (!["invitation", "verification", "reset"].includes(mail.purpose)) return false;
    const callback = url.searchParams.get("callbackURL");
    return !callback || new URL(callback, config.baseURL).origin === config.baseURL;
  } catch { return false; }
}
function failure(error: unknown, sending: boolean): MailTransportResult {
  const value = error as { code?: unknown; command?: unknown; responseCode?: unknown } | undefined;
  if (!sending) return { outcome: "not_accepted", retryable: !["EAUTH", "ENOAUTH", "ETLS", "ECONFIG"].includes(String(value?.code)) };
  // Only explicit negative SMTP replies prove non-acceptance after send began.
  const status = value?.responseCode;
  if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599
    && ["MAIL FROM", "RCPT TO", "DATA"].includes(String(value?.command))) return { outcome: "not_accepted", retryable: status < 500 };
  return { outcome: "unknown" };
}

/** Uses only Nodemailer's public session/MIME APIs; no custom wire protocol or retry loop. */
export function createSmtpTransport(env: AuthEnvironment, baseURL: string, dependencies: SmtpBindings = bindings): MailTransport {
  const config = readSmtpConfig({ ...env }, baseURL);
  let active = false;
  return {
    async send(mail, signal) {
      if (active || signal.aborted) return { outcome: "not_accepted", retryable: true };
      if (!validMail(mail, config)) return { outcome: "not_accepted", retryable: false };
      active = true;
      return new Promise<MailTransportResult>(resolve => {
        let settled = false, sending = false;
        let connection: Connection | undefined, stream: Readable | undefined, timer: ReturnType<typeof setTimeout> | undefined;
        const done = (result: MailTransportResult) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", abort);
          if (timer !== undefined) dependencies.clearTimer(timer);
          try { stream?.destroy(); } catch { /* no secret-bearing cleanup errors */ }
          try { connection?.close(); } catch { /* acceptance result does not change */ }
          active = false; resolve(result);
        };
        const abort = () => done(sending ? { outcome: "unknown" } : { outcome: "not_accepted", retryable: true });
        const fail = (error?: unknown) => done(failure(error, sending));
        try {
          signal.addEventListener("abort", abort, { once: true });
          if (signal.aborted) { abort(); return; }
          timer = dependencies.timer(abort, 8_000);
          const subject = { invitation: "Deine Einladung zum Stex Tracker", verification: "Deine E-Mail-Adresse bestätigen", reset: "Dein Passwort zurücksetzen" }[mail.purpose];
          stream = dependencies.compose({
            from: { name: config.fromName, address: config.fromAddress }, to: { address: mail.email }, subject,
            messageId: `<stex-${createHash("sha256").update(mail.id).digest("hex")}@${config.fromAddress.split("@")[1]}>`,
            text: `${subject}\n\n${mail.url}\n\nDieser persönliche Sicherheitslink ist zeitlich begrenzt. Falls du diese Aktion nicht angefordert hast, ignoriere diese Nachricht.`,
            disableFileAccess: true, disableUrlAccess: true,
          });
          stream.on("error", fail);
          connection = dependencies.connection({ host: config.host, port: config.port,
            secure: config.tlsMode === "implicit", requireTLS: true, ignoreTLS: false, opportunisticTLS: false,
            servername: config.host, tls: { rejectUnauthorized: true, minVersion: "TLSv1.2", servername: config.host },
            name: new URL(config.baseURL).hostname, connectionTimeout: 5_000, greetingTimeout: 5_000,
            socketTimeout: 5_000, dnsTimeout: 3_000, maxResponseSize: 65_536,
            logger: false, debug: false, transactionLog: false, lmtp: false,
          });
          connection.on("error", fail);
          connection.on("end", () => { if (!settled) fail(); });
          connection.connect(error => {
            if (settled) return;
            if (error) { fail(error); return; }
            try {
              // Never send credentials without an established TLS session.
              if (!connection!.secure) { done({ outcome: "not_accepted", retryable: false }); return; }
              connection!.login({ user: config.user, pass: config.password }, error => {
                if (settled) return;
                if (error) { fail(error); return; }
                try {
                  sending = true;
                  connection!.send({ from: config.fromAddress, to: [mail.email] }, stream!, (error, info) => {
                    if (settled) return;
                    if (error) { fail(error); return; }
                    if (info?.accepted?.length === 1 && info.accepted[0] === mail.email && !info.rejected?.length
                      && typeof info.response === "string" && /^2\d\d(?:[ -]|$)/.test(info.response)) done({ outcome: "accepted" });
                    else done({ outcome: "unknown" });
                  });
                } catch (error) { fail(error); }
              });
            } catch (error) { fail(error); }
          });
        } catch (error) { fail(error); }
      });
    },
  };
}
