// Isolated synthetic fixture for manual ADMIN-A1 browser checks. Never loads the user's DB or keys.
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import { AccountService } from "../src/lib/server/auth/service";
import { CatalogImportService } from "../src/lib/server/catalog/import-service";
import { fileHash } from "../src/lib/server/persistence/files";
const runtime = await testRuntime();
try {
  const repo = await runtime.repository("stex_local");
  const secret = randomBytes(48).toString("hex"), mailKey = randomBytes(48).toString("hex"), pgPassword = randomBytes(24).toString("hex");
  await repo.database.pool.query(`CREATE ROLE stex_local WITH LOGIN SUPERUSER PASSWORD '${pgPassword}'`);
  const root = join(runtime.root, "admin-ui"); await mkdir(root, { mode: 0o700 });
  for (const [name, value] of [["auth-secret", secret], ["auth-mail-key", mailKey], ["postgres-password", pgPassword]]) await writeFile(join(root, name), value, { mode: 0o600 });
  const baseURL = "http://127.0.0.1:4179", password = "Synthetisches Admin Passwort 2026!";
  const auth = new AccountService({ database: repo.database, files: repo.files, baseURL, secret, mailKey });
  const catalog = new CatalogImportService(auth, repo.files);
  const cookies = new Map<string, string>();
  async function call(path: string, body?: unknown) {
    const url = new URL(path, baseURL), headers = new Headers({ cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") });
    if (body !== undefined) { headers.set("origin", baseURL); headers.set("x-stex-action", "1"); headers.set("content-type", "application/json"); }
    const req = new Request(url, { headers, method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body) });
    const res = url.pathname.startsWith("/api/auth") ? await auth.authHTTP(req) : await auth.accountHTTP(req);
    for (const h of res.headers.getSetCookie()) { const pair = h.split(";", 1)[0], at = pair.indexOf("="); if (pair.slice(at + 1)) cookies.set(pair.slice(0, at), pair.slice(at + 1)); else cookies.delete(pair.slice(0, at)); }
    const text = await res.text(); const data = text ? JSON.parse(text) : null;
    if (![200, 201, 302].includes(res.status)) throw new Error(`Synthetic fixture: ${res.status} ${JSON.stringify(data)}`);
    return data;
  }
  async function register(email: string) {
    const invite = (await auth.localMails(email)).findLast(m => m.purpose === "invitation")!;
    await call("/api/auth/sign-up/email", { email, password, invitationToken: new URL(invite.url).searchParams.get("token") });
    const mail = (await auth.localMails(email)).findLast(m => m.purpose === "verification")!;
    await call(mail.url); await call("/api/auth/sign-in/email", { email, password });
  }
  function factor(uri: string) {
    const bits = [...new URL(uri).searchParams.get("secret")!].map(c => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5, "0")).join("");
    const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(v => parseInt(v, 2))); const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const mac = createHmac("sha1", key).update(counter).digest(), offset = mac[mac.length - 1] & 15;
    return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
  }
  const admin = await auth.prepareAdmin("admin-ui@example.test", "Admin Browserprüfung") as { userId: string };
  await register("admin-ui@example.test"); const enabled = await call("/api/auth/two-factor/enable", { password, method: "totp" });
  await call("/api/auth/two-factor/verify-totp", { code: factor(enabled.totpURI) }); await auth.finishAdmin(admin.userId);
  await call("/api/auth/sign-in/email", { email: "admin-ui@example.test", password }); await call("/api/auth/two-factor/verify-totp", { code: factor(enabled.totpURI) });
  const saved = new Map(cookies);
  const member = await call("/api/account/admin/invitations", { email: "member-ui@example.test", name: "Mitglied Browserprüfung", requestId: randomUUID() });
  cookies.clear(); await register("member-ui@example.test");
  cookies.clear(); saved.forEach((v, k) => cookies.set(k, v));
  await call("/api/account/admin/account-action", { userId: member.userId, action: "activate", expectedRevision: 1, requestId: randomUUID() });
  await call("/api/account/admin/invitations", { email: "invited-ui@example.test", name: "Offene Einladung", requestId: randomUUID() });
  await call("/api/auth/sign-in/email", { email: "member-ui@example.test", password });
  const headers = new Headers({ cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") });
  const bytes = Buffer.from("Synthetic admin UI catalog data");
  await catalog.submit(headers, { requestId: randomUUID(), metadata: { id: "admin-ui-case", source: "synthetische Browserprüfung", title: "Gemeinsame Testklausur", date: "", area: "zr", topicIds: [] }, documents: ["sachverhalt", "loesung"].map(role => ({ role: role as "sachverhalt" | "loesung", filename: `${role}.pdf`, bytes, sha256: fileHash(bytes), byteSize: bytes.length, pageCount: 1, textStatus: "ready" as const, extractionVersion: "admin-ui-synthetic" })) });
  await writeFile("/private/tmp/admin-a1-ui-meta.json", JSON.stringify({ root, port: repo.database.pool.options.port, uri: enabled.totpURI, memberId: member.userId, adminId: admin.userId, fileRoot: repo.files.root }), { mode: 0o600 });
  console.log("ADMIN Browserfixture bereit: isolierte synthetische Konten, PostgreSQL und Testklausur.");
  process.stdin.resume(); await new Promise<void>(resolve => { process.stdin.once("data", () => resolve()); process.once("SIGTERM", () => resolve()); });
} finally { await runtime.close(); }
