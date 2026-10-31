import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import MailComposer from "nodemailer/lib/mail-composer";
import SMTPConnection from "nodemailer/lib/smtp-connection";
import { readSmtpConfig } from "../src/lib/server/auth/smtp-config";
import { createSmtpTransport, type SmtpBindings } from "../src/lib/server/auth/smtp-transport";
import type { DispatchMail } from "../src/lib/server/auth/mail-transport";
import type { AuthEnvironment } from "../src/lib/server/auth/production-config";
import { runMailDispatch, type MailDispatchBindings } from "../scripts/auth/mail-dispatch.mjs";
import type { Database } from "../src/lib/server/persistence/database";
import type { PrivateFiles } from "../src/lib/server/persistence/files";
import type { MailDispatcherOptions } from "../src/lib/server/auth/mail-dispatcher";

const base = "https://pilot.example.test";
const release = "/srv/stex/releases/smtp-test";
const material = (label: string) => createHash("sha256").update(`smtp-fixture:${label}`).digest("base64url");
function environment(): Record<string, string | undefined> {
  return { NODE_ENV: "production", STEX_AUTH_MODE: "production", BETTER_AUTH_URL: base,
    DATABASE_URL: `postgres://stex:${material("db")}@postgres.example.test:5432/stex`, STEX_DATABASE_TLS: "verify-full",
    STEX_PRIVATE_FILE_ROOT: "/srv/stex/data/files", BETTER_AUTH_SECRET: material("auth"), STEX_AUTH_MAIL_KEY: material("mail"),
    STEX_SMTP_HOST: "smtp.example.test", STEX_SMTP_PORT: "465", STEX_SMTP_TLS: "implicit", STEX_SMTP_USER: "artificial-login",
    STEX_SMTP_PASSWORD: material("smtp"), STEX_SMTP_FROM_ADDRESS: "tracker@example.test", STEX_SMTP_FROM_NAME: "Stex Tracker" };
}
const mail: DispatchMail = { id: "artificial-mail-id", email: "member@example.test", purpose: "invitation", url: `${base}/konto/einrichten?token=artificial-token&email=member%40example.test` };
function harness() {
  let loginError: Error | undefined, sendError: Error | undefined, hold: "none" | "connect" | "login" | "send" = "none";
  let info = { accepted: [mail.email], rejected: [] as string[], response: "250 2.0.0 accepted" };
  const calls = { options: [] as SMTPConnection.Options[], messages: [] as MailComposer.Options[], auth: [] as SMTPConnection.AuthenticationType[], envelope: [] as SMTPConnection.Envelope[], connect: 0, close: 0, cleared: 0 };
  const stream = new PassThrough();
  const timers: (() => void)[] = [];
  class FakeConnection extends EventEmitter {
    secure = true;
    connectCallback?: Parameters<SMTPConnection["connect"]>[0];
    loginCallback?: Parameters<SMTPConnection["login"]>[1];
    sendCallback?: Parameters<SMTPConnection["send"]>[2];
    connect(callback: NonNullable<Parameters<SMTPConnection["connect"]>[0]>) { calls.connect++; this.connectCallback = callback; if (hold !== "connect") callback(); }
    login(auth: SMTPConnection.AuthenticationType | undefined, callback: Parameters<SMTPConnection["login"]>[1]) {
      calls.auth.push(auth!); this.loginCallback = callback; if (hold !== "login") callback(loginError ?? null, true);
    }
    send(envelope: SMTPConnection.Envelope, _message: unknown, callback: Parameters<SMTPConnection["send"]>[2]) {
      calls.envelope.push(envelope); this.sendCallback = callback;
      if (hold !== "send") callback(sendError ?? null, { ...info, envelopeTime: 0, messageTime: 0, messageSize: 0 });
    }
    close() { calls.close++; this.emit("end"); }
  }
  const connection = new FakeConnection();
  const bindings: SmtpBindings = {
    connection: options => { calls.options.push(options); return connection; },
    compose: options => { calls.messages.push(options); return stream; },
    timer: callback => { timers.push(callback); return 1 as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: () => { calls.cleared++; },
  };
  return { calls, bindings, connection, stream, timers,
    hold: (value: typeof hold) => { hold = value; }, loginError: (value: Error) => { loginError = value; }, sendError: (value: Error) => { sendError = value; },
    info: (value: typeof info) => { info = value; } };
}
const signal = () => new AbortController().signal;

// All connection factories below are instrumented; no socket/DNS/SMTP call is made.
test("SMTP-Konfiguration: explizite TLSmodi/Ports, Absender und keine Overrides", () => {
  const implicit = readSmtpConfig(environment(), base); assert.equal(implicit.port, 465); assert.equal(implicit.tlsMode, "implicit");
  const starttls = readSmtpConfig({ ...environment(), STEX_SMTP_PORT: "587", STEX_SMTP_TLS: "starttls" }, base); assert.equal(starttls.port, 587);
  for (const patch of [{ STEX_SMTP_PORT: "25" }, { STEX_SMTP_PORT: "587" }, { STEX_SMTP_TLS: "none" }, { STEX_SMTP_HOST: "127.0.0.1" }, { STEX_SMTP_HOST: "localhost" }, { STEX_SMTP_HOST: "smtp://smtp.example.test" }, { SMTP_URL: "smtp://private" }, { NODE_TLS_REJECT_UNAUTHORIZED: "0" }]) {
    assert.throws(() => readSmtpConfig({ ...environment(), ...patch }, base));
  }
});

test("fehlende Pflichtwerte und Header-/Credentialinjektion werden rein abgewiesen", () => {
  for (const field of Object.keys(environment()).filter(key => key.startsWith("STEX_SMTP_"))) {
    const env = environment(); delete env[field]; assert.throws(() => readSmtpConfig(env, base));
  }
  for (const patch of [{ STEX_SMTP_FROM_ADDRESS: "x@example.test,b@example.test" }, { STEX_SMTP_FROM_NAME: "X\r\nBcc:evil@example.test" }, { STEX_SMTP_USER: "x\nAUTH" }, { STEX_SMTP_PASSWORD: "x\r\n" }, { STEX_SMTP_PASSWORD: material("auth") }, { STEX_SMTP_FROM_ADDRESS: "Name <x@example.test>" }]) {
    assert.throws(() => readSmtpConfig({ ...environment(), ...patch }, base), error => { assert.ok(error instanceof Error); assert.ok(!error.message.includes("Bcc")); assert.ok(!error.message.includes(material("auth"))); return true; });
  }
});

test("bewusst erzeugter Adapter startet nichts; ungültige Mail und Preabort ohne Bibliotheksaufruf", async () => {
  const h = harness(), worker = createSmtpTransport(environment(), base, h.bindings);
  assert.equal(h.calls.options.length + h.calls.messages.length, 0);
  for (const value of [{ ...mail, email: "a@example.test\r\nBcc:x@example.test" }, { ...mail, email: "a@example.test,b@example.test" }, { ...mail, id: "x\r\nMessage-ID:x" }, { ...mail, url: "https://evil.example.test/konto/einrichten" }, { ...mail, url: `${base}/api/ai` }, { ...mail, url: `${mail.url}&token=other` }]) {
    assert.deepEqual(await worker.send(value, signal()), { outcome: "not_accepted", retryable: false });
  }
  const controller = new AbortController(); controller.abort();
  assert.deepEqual(await worker.send(mail, controller.signal), { outcome: "not_accepted", retryable: true });
  assert.equal(h.calls.options.length + h.calls.messages.length, 0);
});

test("zertifikatgeprüfte TLSoptionen, feste Fristen/Envelope und deaktivierte Logs/Quellen", async () => {
  const h = harness(); const value = await createSmtpTransport(environment(), base, h.bindings).send(mail, signal());
  assert.deepEqual(value, { outcome: "accepted" }); const options = h.calls.options[0];
  assert.equal(options.secure, true); assert.equal(options.requireTLS, true); assert.equal(options.ignoreTLS, false); assert.equal(options.opportunisticTLS, false);
  assert.deepEqual(options.tls, { rejectUnauthorized: true, minVersion: "TLSv1.2", servername: "smtp.example.test" });
  assert.equal(options.logger, false); assert.equal(options.debug, false); assert.equal(options.transactionLog, false); assert.equal(options.lmtp, false);
  assert.equal(options.connectionTimeout, 5000); assert.equal(options.dnsTimeout, 3000); assert.equal(options.socketTimeout, 5000);
  assert.deepEqual(h.calls.envelope, [{ from: "tracker@example.test", to: [mail.email] }]);
  assert.equal(h.calls.messages[0].disableUrlAccess, true); assert.equal(h.calls.messages[0].disableFileAccess, true);
  assert.ok(!JSON.stringify(value).includes(mail.url)); assert.equal(h.calls.close, 1); assert.equal(h.calls.cleared, 1); assert.equal(h.stream.destroyed, true);
});

test("STARTTLS ist zwingend; keine Anmeldung ohne sichere Bibliotheksverbindung", async () => {
  const h = harness(); h.connection.secure = false;
  const value = await createSmtpTransport({ ...environment(), STEX_SMTP_TLS: "starttls", STEX_SMTP_PORT: "587" }, base, h.bindings).send(mail, signal());
  assert.deepEqual(value, { outcome: "not_accepted", retryable: false });
  assert.equal(h.calls.options[0].secure, false); assert.equal(h.calls.options[0].requireTLS, true); assert.equal(h.calls.auth.length, 0); assert.equal(h.calls.close, 1);
});

test("positive RCPT-Liste allein genügt nicht: nur finale 2xx-Annahme für genau einen Empfänger", async () => {
  for (const info of [{ accepted: [mail.email], rejected: [], response: "451 unknown" }, { accepted: ["other@example.test"], rejected: [], response: "250 accepted" }, { accepted: [], rejected: [mail.email], response: "250 accepted" }]) {
    const h = harness(); h.info(info); assert.deepEqual(await createSmtpTransport(environment(), base, h.bindings).send(mail, signal()), { outcome: "unknown" });
  }
});

test("explizite negative SMTPantwort darf Retry entscheiden; Verbindungsverlust/Timeout bleibt unklar", async () => {
  for (const [code, command, expected] of [[450, "RCPT TO", { outcome: "not_accepted", retryable: true }], [550, "MAIL FROM", { outcome: "not_accepted", retryable: false }], [451, "DATA", { outcome: "not_accepted", retryable: true }], [554, "DATA", { outcome: "not_accepted", retryable: false }], [421, "CONN", { outcome: "unknown" }], [undefined, "DATA", { outcome: "unknown" }]] as const) {
    const h = harness(); h.sendError(Object.assign(new Error(`private ${mail.url}`), { responseCode: code, command }));
    assert.deepEqual(await createSmtpTransport(environment(), base, h.bindings).send(mail, signal()), expected); assert.equal(h.calls.envelope.length, 1);
  }
});

test("Authfehler ist vor Sendebeginn endgültig und ohne Inhalts-/Fehlerursachenausgabe", async () => {
  const h = harness(); h.loginError(Object.assign(new Error(material("smtp")), { code: "EAUTH" }));
  const value = await createSmtpTransport(environment(), base, h.bindings).send(mail, signal());
  assert.deepEqual(value, { outcome: "not_accepted", retryable: false }); assert.equal(h.calls.envelope.length, 0); assert.equal(h.calls.close, 1);
});

test("Abort vor Sendebeginn schließt Verbindung; spätes Connect startet keine Anmeldung", async () => {
  const h = harness(); h.hold("connect"); const controller = new AbortController();
  const running = createSmtpTransport(environment(), base, h.bindings).send(mail, controller.signal); controller.abort();
  assert.deepEqual(await running, { outcome: "not_accepted", retryable: true }); h.connection.connectCallback!();
  assert.equal(h.calls.auth.length, 0); assert.equal(h.calls.close, 1); assert.equal(h.stream.destroyed, true);
});

test("Abort/absolute Deadline nach Sendebeginn schließen aktiv und bleiben trotz später Annahme unklar", async () => {
  for (const mode of ["abort", "deadline"]) {
    const h = harness(); h.hold("send"); const controller = new AbortController();
    const worker = createSmtpTransport(environment(), base, h.bindings), running = worker.send(mail, controller.signal);
    assert.deepEqual(await worker.send(mail, signal()), { outcome: "not_accepted", retryable: true });
    if (mode === "abort") controller.abort(); else h.timers[0]();
    assert.deepEqual(await running, { outcome: "unknown" }); assert.equal(h.calls.close, 1); assert.equal(h.calls.envelope.length, 1);
    h.connection.sendCallback!(null, { accepted: [mail.email], rejected: [], response: "250 accepted", envelopeTime: 0, messageTime: 0, messageSize: 0 });
    h.connection.emit("error", new Error(`private ${mail.url}`)); assert.equal(h.calls.close, 1);
  }
});

test("Bibliotheks-Eventfehler, Streamfehler und synchrone Fabrikfehler bleiben bereinigt", async () => {
  const h = harness(); h.hold("send"); const running = createSmtpTransport(environment(), base, h.bindings).send(mail, signal());
  h.connection.emit("error", new Error(mail.url)); assert.deepEqual(await running, { outcome: "unknown" });
  const stream = harness(); stream.hold("connect"); const streamRun = createSmtpTransport(environment(), base, stream.bindings).send(mail, signal());
  stream.stream.emit("error", new Error(mail.url)); assert.deepEqual(await streamRun, { outcome: "not_accepted", retryable: true });
  const broken = harness(); broken.bindings.compose = () => { throw new Error(mail.url); };
  assert.deepEqual(await createSmtpTransport(environment(), base, broken.bindings).send(mail, signal()), { outcome: "not_accepted", retryable: true }); assert.equal(broken.calls.options.length, 0);
});

test("alle drei Mailzwecke haben feste Betreffzeilen; echte Bibliotheks-MIME bleibt lokal", async () => {
  for (const [purpose, url] of [["invitation", mail.url], ["verification", `${base}/api/auth/verify-email?token=artificial-token&callbackURL=%2Fkonto`], ["reset", `${base}/api/auth/reset-password/artificial-token?callbackURL=%2Fkonto`]] as const) {
    const h = harness(); assert.deepEqual(await createSmtpTransport(environment(), base, h.bindings).send({ ...mail, purpose, url }, signal()), { outcome: "accepted" });
    const bytes = await new MailComposer(h.calls.messages[0]).compile().build();
    const message = bytes.toString("utf8"); assert.ok(message.includes("From:")); assert.ok(message.includes("To:")); assert.ok(message.includes("Message-ID:"));
    assert.ok(h.calls.messages[0].text!.toString().includes(url));
    assert.equal(h.calls.messages[0].html, undefined); assert.equal(h.calls.messages[0].attachments, undefined);
  }
});

function cliHarness() {
  const calls = { persistence: 0, transport: 0, close: 0, batches: 0, options: [] as MailDispatcherOptions[], output: [] as string[] };
  const database = { close: async () => { calls.close++; } } as unknown as Database;
  let failBatch = false;
  const bindings: MailDispatchBindings = {
    persistence: async () => { calls.persistence++; return { database, files: {} as PrivateFiles, production: undefined }; },
    transport: () => { calls.transport++; return { async send() { throw new Error("Do not send"); } }; },
    dispatcher: options => { calls.options.push(options); return { async dispatchBatch() { calls.batches++; if (failBatch) throw new Error(`${material("smtp")} ${mail.url}`); return { claimed: 1, recovered: 0, sent: 0, deferred: 0, failed: 0, cancelled: 0, expired: 0, uncertain: 1, fenced: 0 }; } }; },
    output: value => { calls.output.push(value); },
  };
  return { calls, bindings, fail: () => { failBatch = true; } };
}

test("EinzelbatchCLI: nur once, Produktionsvertrag und SMTP vollständig vor Ressourcen validiert", async () => {
  for (const [argv, env] of [[[], environment()], [["watch"], environment()], [["once", "extra"], environment()], [["once"], { ...environment(), STEX_AUTH_MODE: "local" }], [["once"], { ...environment(), STEX_SMTP_PASSWORD: undefined }]] as [string[], AuthEnvironment][]) {
    const h = cliHarness(); await assert.rejects(runMailDispatch(argv, env, release, h.bindings));
    assert.equal(h.calls.persistence + h.calls.transport + h.calls.close + h.calls.batches, 0);
  }
});

test("EinzelbatchCLI übergibt Vertrag einmal, gibt nur Zähler aus und schließt Pool", async () => {
  const h = cliHarness(); await runMailDispatch(["once"], environment(), release, h.bindings);
  assert.equal(h.calls.batches, 1); assert.equal(h.calls.persistence, 1); assert.equal(h.calls.transport, 1); assert.equal(h.calls.close, 1);
  assert.equal(h.calls.options[0].baseURL, base); assert.equal(h.calls.options[0].mailKey, material("mail"));
  assert.equal(JSON.parse(h.calls.output[0]).uncertain, 1); assert.ok(!h.calls.output[0].includes("token="));
  const failed = cliHarness(); failed.fail();
  await assert.rejects(runMailDispatch(["once"], environment(), release, failed.bindings), error => {
    assert.ok(error instanceof Error); assert.ok(!error.message.includes(material("smtp"))); assert.ok(!error.message.includes(mail.url)); return true;
  });
  assert.equal(failed.calls.close, 1); assert.equal(failed.calls.output.length, 0);
});

test("Config-/Adapterkonstruktion verändert keine Eingabe und erzeugt keine Ressourcen", () => {
  const env = Object.freeze(environment()), encoded = JSON.stringify(env), h = harness();
  readSmtpConfig(env, base); createSmtpTransport(env, base, h.bindings);
  assert.equal(JSON.stringify(env), encoded); assert.equal(h.calls.options.length + h.calls.messages.length, 0);
});

test("Review: connect-Callbackfehler ohne error-Event verhindert Login und Send", async () => {
  const h = harness(); h.hold("connect");
  const running = createSmtpTransport(environment(), base, h.bindings).send(mail, signal());
  // Installed Nodemailer 10.1.2 can report a silent pre-greeting close only here.
  // secure remains true to ensure the TLS check cannot hide the missing error branch.
  h.connection.connectCallback!(Object.assign(new Error(`private ${mail.url}`), { code: "ECONNECTION", command: "CONN" }));
  const result = await running;
  assert.deepEqual(result, { outcome: "not_accepted", retryable: true });
  assert.equal(h.calls.auth.length, 0); assert.equal(h.calls.envelope.length, 0);
  assert.equal(h.calls.close, 1); assert.equal(h.calls.cleared, 1); assert.equal(h.stream.destroyed, true);
});
