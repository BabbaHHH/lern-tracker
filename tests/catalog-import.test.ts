import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { test } from "node:test";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import type { PersistenceRepository } from "../src/lib/server/persistence/repository";
import { AccountService } from "../src/lib/server/auth/service";
import { catalogImportHTTP, catalogListHTTP, catalogStatusHTTP } from "../src/lib/server/catalog/http";
import { CatalogImportService, CATALOG_MAX_FILE_BYTES, CATALOG_MAX_REQUEST_BYTES, validateCatalogPdf, type CatalogMetadata, type PreparedCatalogPdf } from "../src/lib/server/catalog/import-service";
import { backup, restore } from "../src/lib/server/persistence/backup";
import { fileHash } from "../src/lib/server/persistence/files";
import { lockState } from "../src/lib/server/persistence/repository";
import { tokenHash } from "../src/lib/server/auth/security";
import { digest } from "../src/lib/data-migration/migration";

const password = "Synthetisches Passwort 2026!";
const topic = "zr-mat-at-vertragsschluss-145ff";

function pdfFixture(text: string): Buffer {
  const content = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(result));
    result += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(result);
}

class Browser {
  cookies = new Map<string, string>();
  constructor(readonly base: string) {}
  headers(): Headers { return new Headers({ cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ") }); }
  private remember(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";", 1)[0];
      const index = pair.indexOf("=");
      if (index < 1) continue;
      const key = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (!value || /max-age=0/i.test(header)) this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
  }
  async call(path: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers = this.headers();
    Object.entries(extra).forEach(([key, value]) => headers.set(key, value));
    if (body !== undefined) {
      headers.set("content-type", "application/json");
      if (!headers.has("origin")) headers.set("origin", this.base);
      headers.set("x-stex-action", "1");
    }
    const response = extra["sec-fetch-mode"] === "navigate"
      ? await this.navigation(path, headers)
      : await fetch(new URL(path, this.base), { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    this.remember(response);
    const text = await response.text();
    return { status: response.status, data: text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : null, headers: response.headers };
  }
  private async navigation(path: string, headers: Headers): Promise<Response> {
    return new Promise((resolve, reject) => {
      const request = httpRequest(new URL(path, this.base), { method: "GET", headers: Object.fromEntries(headers) }, incoming => {
        const chunks: Buffer[] = [];
        incoming.on("data", part => chunks.push(Buffer.from(part)));
        incoming.on("end", () => {
          const responseHeaders = new Headers();
          for (let index = 0; index < incoming.rawHeaders.length; index += 2) responseHeaders.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1]);
          resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode, headers: responseHeaders }));
        });
        incoming.on("error", reject);
      });
      request.on("error", reject);
      request.end();
    });
  }
  async upload(path: string, requestId: string, metadata: CatalogMetadata, sachverhalt: Buffer, loesung: Buffer, names: readonly [string, string] = ["sachverhalt.pdf", "loesung.pdf"]) {
    const form = new FormData();
    form.set("requestId", requestId);
    form.set("metadata", JSON.stringify(metadata));
    form.set("sachverhalt", new Blob([arrayBufferOf(sachverhalt)], { type: "application/pdf" }), names[0]);
    form.set("loesung", new Blob([arrayBufferOf(loesung)], { type: "application/pdf" }), names[1]);
    const headers = this.headers();
    headers.set("origin", this.base);
    headers.set("x-stex-action", "1");
    const response = await fetch(new URL(path, this.base), { method: "POST", headers, body: form, redirect: "manual" });
    this.remember(response);
    const text = await response.text();
    return { status: response.status, data: text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : null, headers: response.headers };
  }
}

function arrayBufferOf(bytes: Buffer): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }

async function directMultipart(base: string, browser: Browser, form: FormData, handler: (request: Request) => Promise<Response>): Promise<{ status: number; data: Record<string, unknown> | null }> {
  const source = new Request(`${base}/api/catalog/import`, { method: "POST", body: form });
  const body = await source.arrayBuffer();
  const headers = browser.headers();
  headers.set("origin", base); headers.set("x-stex-action", "1");
  headers.set("content-type", source.headers.get("content-type")!);
  headers.delete("content-length");
  const response = await handler(new Request(`${base}/api/catalog/import`, { method: "POST", headers, body }));
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) as Record<string, unknown> : null };
}

async function seedInvitation(repository: PersistenceRepository, userId: string, email: string, name: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await repository.database.transaction(async client => {
    await lockState(client);
    await client.query("INSERT INTO stex.accounts(user_id,status,role,revision) VALUES($1,'pending','member',1)", [userId]);
    await client.query("INSERT INTO stex.account_invitations(id,user_id,email,name,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '1 day')", [randomUUID(), userId, email, name, tokenHash(token)]);
    await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
  });
  return token;
}

test("IMPORT-B: aktiver A-Upload wird nach Prüfung für aktives B sichtbar", { timeout: 240000 }, async t => {
  const runtime = await testRuntime();
  let repository = await runtime.repository("catalog_import_source");
  const secret = randomBytes(48).toString("base64url");
  const mailKey = randomBytes(48).toString("base64url");
  const backupKey = randomBytes(48).toString("base64url");
  const emails = { a: "catalog-a@example.test", b: "catalog-b@example.test", pending: "catalog-pending@example.test" };
  const tokens = {
    a: await seedInvitation(repository, "catalog-user-a", emails.a, "Katalog A"),
    b: await seedInvitation(repository, "catalog-user-b", emails.b, "Katalog B"),
    pending: await seedInvitation(repository, "catalog-user-pending", emails.pending, "Katalog Pending"),
  };
  let service: AccountService;
  let catalog: CatalogImportService;
  let base = "";
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const request = new Request(`${base}${incoming.url}`, {
        method: incoming.method,
        headers: new Headers(incoming.headers as Record<string, string>),
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      let response: Response;
      if (incoming.url?.startsWith("/api/auth/")) response = await service.authHTTP(request);
      else if (incoming.url === "/api/catalog/klausuren") response = await catalogListHTTP(request, catalog);
      else if (incoming.url?.startsWith("/api/catalog/import") && incoming.method === "GET") response = await catalogStatusHTTP(request, catalog);
      else if (incoming.url === "/api/catalog/import") response = await catalogImportHTTP(request, catalog);
      else response = new Response("not found", { status: 404 });
      outgoing.statusCode = response.status;
      for (const [key, value] of response.headers) if (key !== "set-cookie") outgoing.setHeader(key, value);
      if (response.headers.getSetCookie().length) outgoing.setHeader("set-cookie", response.headers.getSetCookie());
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.statusCode = 500;
      outgoing.end(`transport failed: ${String(error)}`);
    }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Testserver fehlt.");
  base = `http://127.0.0.1:${address.port}`;
  service = new AccountService({ database: repository.database, files: repository.files, baseURL: base, secret, mailKey });
  catalog = new CatalogImportService(service, repository.files);
  const a = new Browser(base);
  const b = new Browser(base);
  const pending = new Browser(base);
  const anonymous = new Browser(base);
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await runtime.close(); });

  const finishSignup = async (browser: Browser, email: string, token: string) => {
    assert.equal((await browser.call("/api/auth/sign-up/email", { email, password, invitationToken: token })).status, 200);
    const verification = (await service.localMails(email)).filter(mail => mail.purpose === "verification").at(-1);
    assert.ok(verification);
    const verificationURL = new URL(verification.url);
    const result = await browser.call(`${verificationURL.pathname}${verificationURL.search}`, undefined, { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" });
    assert.equal(result.status, 302);
  };
  await finishSignup(a, emails.a, tokens.a);
  await finishSignup(b, emails.b, tokens.b);
  await finishSignup(pending, emails.pending, tokens.pending);
  await repository.database.transaction(async client => {
    await lockState(client);
    await client.query("UPDATE stex.accounts SET status='active',revision=2 WHERE user_id IN ('catalog-user-a','catalog-user-b')");
    await client.query("UPDATE stex.account_access SET generation=generation+1,updated_at=now() WHERE user_id IN ('catalog-user-a','catalog-user-b')");
    await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
  });
  assert.equal((await a.call("/api/auth/sign-in/email", { email: emails.a, password })).status, 200);
  assert.equal((await b.call("/api/auth/sign-in/email", { email: emails.b, password })).status, 200);
  assert.equal((await pending.call("/api/auth/sign-in/email", { email: emails.pending, password })).status, 200);

  const metadata: CatalogMetadata = { id: "synthetic-hh-berlin-001", source: "synthetic-hh-berlin", date: "2026-10-11", title: "Synthetischer gemeinsamer Fall", area: "zr", type: "Urteil", topicIds: [topic] };
  const sachverhalt = pdfFixture("Synthetischer Sachverhalt");
  const loesung = pdfFixture("Synthetische Lösung");
  const uploaded = await a.upload("/api/catalog/import", "catalog-request-001", metadata, sachverhalt, loesung);
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data));
  assert.equal(uploaded.data.import.duplicateStatus, "distinct");
  assert.equal(uploaded.data.import.documents.length, 2);
  const importId = uploaded.data.import.importId as string;
  assert.equal((await a.call(`/api/catalog/import?importId=${encodeURIComponent(importId)}`)).data.import.status, "committed");
  const firstList = await b.call("/api/catalog/klausuren");
  assert.equal(firstList.status, 200);
  assert.equal(firstList.data.klausuren.length, 1);
  assert.equal(firstList.data.klausuren[0].id, metadata.id);
  assert.equal(firstList.data.klausuren[0].metadata.title, metadata.title);
  assert.deepEqual(firstList.data.klausuren[0].metadata.topicIds, [topic]);
  assert.equal(firstList.data.klausuren[0].documents.length, 2);

  await t.test("Multipartgrenze liest auch ohne Content-Length nur bis zum Limit", async () => {
    const form = new FormData();
    form.set("requestId", "catalog-request-no-length");
    form.set("metadata", JSON.stringify(metadata));
    form.set("sachverhalt", new Blob([arrayBufferOf(sachverhalt)], { type: "application/pdf" }), "no-length-sachverhalt.pdf");
    form.set("loesung", new Blob([arrayBufferOf(loesung)], { type: "application/pdf" }), "no-length-loesung.pdf");
    const accepted = await directMultipart(base, a, form, request => catalogImportHTTP(request, catalog));
    assert.equal(accepted.status, 201, JSON.stringify(accepted.data));
    const acceptedImport = accepted.data?.import as { status: string; importId: string };
    assert.equal(acceptedImport.status, "committed");
    const byRequest = await a.call(`/api/catalog/import?requestId=${encodeURIComponent("catalog-request-no-length")}`);
    assert.equal(byRequest.status, 200);
    assert.equal(byRequest.data.import.importId, acceptedImport.importId);

    const extraText = new FormData();
    extraText.set("requestId", "catalog-request-extra-text"); extraText.set("metadata", JSON.stringify(metadata));
    extraText.set("sachverhalt", new Blob([arrayBufferOf(sachverhalt)], { type: "application/pdf" }), "extra-text-sachverhalt.pdf");
    extraText.set("loesung", new Blob([arrayBufferOf(loesung)], { type: "application/pdf" }), "extra-text-loesung.pdf"); extraText.set("unexpected", "nicht erlaubt");
    assert.equal((await directMultipart(base, a, extraText, request => catalogImportHTTP(request, catalog))).status, 400);

    const extraFile = new FormData();
    extraFile.set("requestId", "catalog-request-extra-file"); extraFile.set("metadata", JSON.stringify(metadata));
    extraFile.set("sachverhalt", new Blob([arrayBufferOf(sachverhalt)], { type: "application/pdf" }), "extra-file-sachverhalt.pdf");
    extraFile.set("loesung", new Blob([arrayBufferOf(loesung)], { type: "application/pdf" }), "extra-file-loesung.pdf"); extraFile.set("anderesDokument", new Blob([arrayBufferOf(loesung)], { type: "application/pdf" }), "anderes.pdf");
    assert.equal((await directMultipart(base, a, extraFile, request => catalogImportHTTP(request, catalog))).status, 400);

    const duplicateField = new FormData();
    duplicateField.set("requestId", "catalog-request-duplicate-field"); duplicateField.append("requestId", "catalog-request-duplicate-field-2"); duplicateField.set("metadata", JSON.stringify(metadata));
    duplicateField.set("sachverhalt", new Blob([arrayBufferOf(sachverhalt)], { type: "application/pdf" }), "duplicate-sachverhalt.pdf"); duplicateField.set("loesung", new Blob([arrayBufferOf(loesung)], { type: "application/pdf" }), "duplicate-loesung.pdf");
    assert.equal((await directMultipart(base, a, duplicateField, request => catalogImportHTTP(request, catalog))).status, 400);

    const oversizedMetadata = new FormData();
    oversizedMetadata.set("requestId", "catalog-request-large-metadata"); oversizedMetadata.set("metadata", JSON.stringify({ ...metadata, extra: "x".repeat(40_000) }));
    oversizedMetadata.set("sachverhalt", new Blob([arrayBufferOf(sachverhalt)], { type: "application/pdf" }), "large-metadata-sachverhalt.pdf"); oversizedMetadata.set("loesung", new Blob([arrayBufferOf(loesung)], { type: "application/pdf" }), "large-metadata-loesung.pdf");
    assert.equal((await directMultipart(base, a, oversizedMetadata, request => catalogImportHTTP(request, catalog))).status, 413);

    let sent = 0;
    const overLimit = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > CATALOG_MAX_REQUEST_BYTES) { controller.close(); return; }
        const chunk = Math.min(1024 * 1024, CATALOG_MAX_REQUEST_BYTES + 1 - sent);
        sent += chunk; controller.enqueue(new Uint8Array(chunk));
      },
    });
    const overHeaders = a.headers();
    overHeaders.set("origin", base); overHeaders.set("x-stex-action", "1"); overHeaders.set("content-type", "multipart/form-data; boundary=synthetic-over-limit");
    const overResponse = await catalogImportHTTP(new Request(`${base}/api/catalog/import`, { method: "POST", headers: overHeaders, body: overLimit, duplex: "half" } as RequestInit & { duplex: "half" }), catalog);
    assert.equal(overResponse.status, 413);
    assert.equal((await repository.database.pool.query("SELECT count(*) FROM stex.catalog_imports WHERE request_id LIKE 'catalog-request-extra-%' OR request_id LIKE 'catalog-request-duplicate-field%' OR request_id='catalog-request-large-metadata'")).rows[0].count, "0");
  });

  await t.test("Pending-, anonyme und Fremdzugriffe geben keinen Katalogbeleg preis", async () => {
    assert.equal((await pending.call("/api/catalog/klausuren")).status, 403);
    assert.equal((await pending.call(`/api/catalog/import?importId=${encodeURIComponent(importId)}`)).status, 403);
    assert.equal((await pending.upload("/api/catalog/import", "catalog-request-pending", metadata, sachverhalt, loesung)).status, 403);
    assert.equal((await anonymous.call(`/api/catalog/import?importId=${encodeURIComponent(importId)}`)).status, 401);
    assert.equal((await anonymous.upload("/api/catalog/import", "catalog-request-anonymous", metadata, sachverhalt, loesung)).status, 401);
    const foreign = await b.call(`/api/catalog/import?importId=${encodeURIComponent(importId)}`);
    assert.equal(foreign.status, 404);
    const listJSON = JSON.stringify(firstList.data);
    assert.equal(listJSON.includes(emails.a), false);
    assert.equal(listJSON.includes("submittedBy"), false);

  });

  await t.test("Wiederholung und Lösungsversion bleiben nachvollziehbar", async () => {
    const replay = await a.upload("/api/catalog/import", "catalog-request-001", metadata, sachverhalt, loesung);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.import.importId, importId);
    const contradictoryReplay = await a.upload("/api/catalog/import", "catalog-request-001", { ...metadata, title: "Widersprüchliche Wiederholung" }, sachverhalt, loesung);
    assert.equal(contradictoryReplay.status, 409);
    const identical = await a.upload("/api/catalog/import", "catalog-request-002", metadata, sachverhalt, loesung);
    assert.equal(identical.status, 201);
    assert.equal(identical.data.import.duplicateStatus, "identical");
    const changedSolution = pdfFixture("Synthetische Lösung, Ergänzung v2");
    const versioned = await a.upload("/api/catalog/import", "catalog-request-003", metadata, sachverhalt, changedSolution);
    assert.equal(versioned.status, 201);
    assert.equal(versioned.data.import.duplicateStatus, "candidate");
    const versions = (await repository.database.pool.query("SELECT role,version_number FROM stex.catalog_document_versions v JOIN stex.catalog_documents d USING(document_id) ORDER BY role,version_number")).rows;
    assert.deepEqual(versions, [{ role: "loesung", version_number: 1 }, { role: "loesung", version_number: 2 }, { role: "sachverhalt", version_number: 1 }]);
  });

  await t.test("Ein liegengebliebener Verarbeitungseintrag wird mit demselben Inhalt fortgesetzt", async () => {
    const resumeMetadata: CatalogMetadata = { id: "synthetic-resume-001", source: "synthetic-resume", date: "2026-10-11", title: "Fortsetzbarer Fall", area: "zr", topicIds: [topic] };
    const resumeSachverhalt = pdfFixture("Fortsetzung Sachverhalt");
    const resumeLoesung = pdfFixture("Fortsetzung Lösung");
    const prepared = [
      { role: "sachverhalt" as const, filename: "resume-sachverhalt.pdf", sha256: fileHash(resumeSachverhalt), byteSize: resumeSachverhalt.length },
      { role: "loesung" as const, filename: "resume-loesung.pdf", sha256: fileHash(resumeLoesung), byteSize: resumeLoesung.length },
    ];
    const sourceDigest = digest({ metadata: resumeMetadata, documents: prepared });
    const staleImportId = `ci-${randomUUID()}`;
    await repository.database.transaction(async client => {
      await lockState(client);
      await client.query(`INSERT INTO stex.catalog_imports(import_id,submitted_by_user_id,request_id,source_digest,source_reference,status,acceptance_mode,content_check,technical_validation,duplicate_status,metadata,warnings)
        VALUES($1,'catalog-user-a','catalog-request-resume',$2,$3,'processing','direct','not-performed','valid','pending',$4::jsonb,'[]'::jsonb)`, [staleImportId, sourceDigest, resumeMetadata.source, JSON.stringify(resumeMetadata)]);
    });
    const resumed = await a.upload("/api/catalog/import", "catalog-request-resume", resumeMetadata, resumeSachverhalt, resumeLoesung, ["resume-sachverhalt.pdf", "resume-loesung.pdf"]);
    assert.equal(resumed.status, 201, JSON.stringify(resumed.data));
    assert.equal(resumed.data.import.importId, staleImportId);
    assert.equal(resumed.data.import.status, "committed");
  });

  await t.test("ID-Konflikt wird dauerhaft abgelehnt und überschreibt den Katalog nicht", async () => {
    const conflict = await a.upload("/api/catalog/import", "catalog-request-conflict", { ...metadata, title: "Fremder Titel" }, sachverhalt, loesung);
    assert.equal(conflict.status, 409);
    const failedImport = (await repository.database.pool.query("SELECT import_id,status,duplicate_status,error_code FROM stex.catalog_imports WHERE request_id='catalog-request-conflict'")).rows[0];
    assert.equal(failedImport.status, "failed");
    assert.equal(failedImport.duplicate_status, "conflict");
    assert.equal(failedImport.error_code, "conflict");
    const unchanged = (await b.call("/api/catalog/klausuren")).data.klausuren[0];
    assert.equal(unchanged.metadata.title, metadata.title);
  });

  await t.test("Fehlende Berechtigung und technische PDF-Grenzen bleiben geschlossen", async () => {
    assert.equal((await anonymous.call("/api/catalog/klausuren")).status, 401);
    const invalid = await a.upload("/api/catalog/import", "catalog-request-invalid", metadata, Buffer.from("not a PDF"), loesung);
    assert.equal(invalid.status, 422);
    await assert.rejects(validateCatalogPdf({ name: "too-large.pdf", type: "application/pdf", size: CATALOG_MAX_FILE_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) }, "sachverhalt"), { code: "too_large" });
  });

  await t.test("Ein Fehler vor dem Commit hinterlässt nur einen dauerhaften Fehlstatus", async () => {
    const failedMetadata: CatalogMetadata = { id: "synthetic-failed-001", source: "synthetic-failure", date: "2026-10-11", title: "Fehlerfall", area: "zr", topicIds: [topic] };
    const validSachverhalt = await validateCatalogPdf({ name: "failed-sachverhalt.pdf", type: "application/pdf", size: sachverhalt.length, arrayBuffer: async () => arrayBufferOf(sachverhalt) }, "sachverhalt");
    const validLoesung = await validateCatalogPdf({ name: "failed-loesung.pdf", type: "application/pdf", size: loesung.length, arrayBuffer: async () => arrayBufferOf(loesung) }, "loesung");
    const broken: PreparedCatalogPdf = { ...validSachverhalt, sha256: "f".repeat(64) };
    await assert.rejects(catalog.submit(a.headers(), { requestId: "catalog-request-failed", metadata: failedMetadata, documents: [broken, validLoesung] }));
    const failed = (await repository.database.pool.query("SELECT status,error_code FROM stex.catalog_imports WHERE request_id='catalog-request-failed'")).rows[0];
    assert.deepEqual(failed, { status: "failed", error_code: "unavailable" });
    assert.equal((await repository.database.pool.query("SELECT count(*) FROM stex.catalog_records WHERE id=$1", [failedMetadata.id])).rows[0].count, "0");
  });

  await t.test("Konkurrierende Einreichungen erzeugen keine weitere Version", async () => {
    const concurrent = await Promise.all([
      a.upload("/api/catalog/import", "catalog-request-race-a", metadata, sachverhalt, changedSolutionForRace(loesung)),
      b.upload("/api/catalog/import", "catalog-request-race-b", metadata, sachverhalt, changedSolutionForRace(loesung)),
    ]);
    assert.equal(concurrent.filter(result => result.status === 201).length, 2);
    const count = await repository.database.pool.query("SELECT count(*) FROM stex.catalog_document_versions");
    assert.equal(count.rows[0].count, "6");
  });

  await t.test("Neustart und geschützte DATA+AUTH-Sicherung erhalten Katalogbytes", async () => {
    const before = (await repository.database.pool.query("SELECT count(*) FROM stex.catalog_document_versions")).rows[0].count;
    repository = await runtime.restart("catalog_import_source", repository.files);
    service = new AccountService({ database: repository.database, files: repository.files, baseURL: base, secret, mailKey });
    catalog = new CatalogImportService(service, repository.files);
    assert.equal((await b.call("/api/catalog/klausuren")).data.klausuren.length, 2);
    const backupPath = join(runtime.root, "catalog-complete-backup");
    const saved = await backup(repository.database, repository.files, backupPath, { encryptionKey: backupKey, authSecret: secret });
    assert.equal(saved.fileCount, Number(before));
    const target = await runtime.repository("catalog_import_restore");
    const restored = await restore(target.database, target.files, backupPath, { encryptionKey: backupKey, authSecret: secret });
    assert.equal(restored.fileCount, Number(before));
    assert.equal((await target.database.pool.query("SELECT count(*) FROM stex.catalog_document_versions")).rows[0].count, before);
    const restoredVersion = (await target.database.pool.query("SELECT storage_key,sha256,byte_size FROM stex.catalog_document_versions ORDER BY document_version_id LIMIT 1")).rows[0];
    const restoredBytes = await target.files.read(restoredVersion.storage_key, restoredVersion.sha256, Number(restoredVersion.byte_size));
    assert.equal(fileHash(restoredBytes), restoredVersion.sha256);
  });

  await t.test("Sperre nach dauerhaftem Beginn verhindert den Commit", async () => {
    const blockedMetadata: CatalogMetadata = { id: "synthetic-blocked-001", source: "synthetic-blocked", date: "2026-10-11", title: "Sperrfall", area: "zr", topicIds: [topic] };
    const blockedSachverhalt = pdfFixture("Sperrfall Sachverhalt");
    const blockedLoesung = pdfFixture("Sperrfall Lösung");
    const blockedPrepared = [
      await validateCatalogPdf({ name: "blocked-sachverhalt.pdf", type: "application/pdf", size: blockedSachverhalt.length, arrayBuffer: async () => arrayBufferOf(blockedSachverhalt) }, "sachverhalt"),
      await validateCatalogPdf({ name: "blocked-loesung.pdf", type: "application/pdf", size: blockedLoesung.length, arrayBuffer: async () => arrayBufferOf(blockedLoesung) }, "loesung"),
    ];
    const blockedRequestId = "catalog-request-blocked";
    const internal = catalog as unknown as { commit: (input: unknown, principal: unknown, importId: string) => Promise<unknown> };
    const originalCommit = internal.commit.bind(catalog);
    internal.commit = async (input, principal, importId) => {
      await repository.database.transaction(async client => {
        await lockState(client);
        await client.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id='catalog-user-a'");
        await client.query("UPDATE stex.account_access SET generation=generation+1,updated_at=now() WHERE user_id='catalog-user-a'");
        await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
      });
      return originalCommit(input, principal, importId);
    };
    try {
      await assert.rejects(catalog.submit(a.headers(), { requestId: blockedRequestId, metadata: blockedMetadata, documents: blockedPrepared }), { code: "unauthenticated" });
    } finally {
      internal.commit = originalCommit;
    }
    assert.equal((await a.call("/api/catalog/klausuren")).status, 401);
    assert.equal((await a.call(`/api/catalog/import?importId=${encodeURIComponent(importId)}`)).status, 401);
    assert.equal((await a.upload("/api/catalog/import", "catalog-request-blocked-http", blockedMetadata, blockedSachverhalt, blockedLoesung)).status, 401);
    assert.equal((await b.call("/api/catalog/klausuren")).status, 200);
    const receipt = (await repository.database.pool.query("SELECT status,klausur_id FROM stex.catalog_imports WHERE request_id=$1", [blockedRequestId])).rows[0];
    assert.deepEqual(receipt, { status: "failed", klausur_id: null });
    assert.equal((await repository.database.pool.query("SELECT count(*) FROM stex.catalog_records WHERE id=$1", [blockedMetadata.id])).rows[0].count, "0");
  });
});

function changedSolutionForRace(original: Buffer): Buffer { return Buffer.concat([original, Buffer.from("\n% race-same-bytes")]); }
