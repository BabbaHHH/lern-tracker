import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { PoolClient } from "pg";
import { testRuntime } from "../data-migration/postgres-test-runtime";
import { syntheticPdf, SyntheticAccount } from "../pdf-a/fixtures";
import { AccountService } from "../../src/lib/server/auth/service";
import { CatalogImportService, validateCatalogPdf } from "../../src/lib/server/catalog/import-service";
import { CatalogPdfService } from "../../src/lib/server/catalog-pdf/service";
import { catalogPdfHTTP } from "../../src/lib/server/catalog-pdf/http";
import { PrivateFiles } from "../../src/lib/server/persistence/files";
import { lockState } from "../../src/lib/server/persistence/repository";
import { pdfFileURL, type PdfIdentity } from "../../src/lib/pdf-viewer/contract";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
export class DelayedPrivateFiles extends PrivateFiles {
  calls: { key: string; size: number; completed: boolean }[] = [];
  private next: { enter: () => void; wait: Promise<void> } | undefined;
  arm() {
    if (this.next) throw new Error("Only one controlled file read at a time.");
    const entered = deferred<void>(), release = deferred<void>();
    this.next = { enter: () => entered.resolve(), wait: release.promise };
    return { entered: entered.promise, release: () => release.resolve() };
  }
  override async read(key: string, sha256: string, size: number) {
    const record = { key, size, completed: false };
    this.calls.push(record);
    const gate = this.next; this.next = undefined;
    if (gate) { gate.enter(); await gate.wait; }
    // All actual filesystem, path, size and hash checks stay in PrivateFiles.
    const bytes = await super.read(key, sha256, size);
    record.completed = true;
    return bytes;
  }
}

export async function pdfR1Fixture() {
  const runtime = await testRuntime();
  let server: ReturnType<typeof createServer> | undefined;
  try {
    const repository = await runtime.repository("pdf_a_r1");
    const files = new DelayedPrivateFiles(repository.files.root);
    let base = "";
    server = createServer(async (incoming, outgoing) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
        const request = new Request(`${base}${incoming.url}`, { method: incoming.method,
          headers: new Headers(incoming.headers as Record<string, string>), body: chunks.length ? Buffer.concat(chunks) : undefined });
        const response = incoming.url?.startsWith("/api/catalog/pdf") ? await catalogPdfHTTP(request, pdf)
          : incoming.url?.startsWith("/api/account") ? await auth.accountHTTP(request)
          : new Response(null, { status: 404 });
        outgoing.statusCode = response.status;
        for (const [key, value] of response.headers) outgoing.setHeader(key, value);
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch { outgoing.statusCode = 503; outgoing.end(); }
    });
    await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing local HTTP listener.");
    base = `http://127.0.0.1:${address.port}`;
    const auth = new AccountService({ database: repository.database, files: repository.files, baseURL: base,
      secret: randomBytes(48).toString("hex"), mailKey: randomBytes(48).toString("hex") });
    const pdf = new CatalogPdfService(auth, files);
    const reader = new SyntheticAccount(auth, "pdf-r1-reader"), writer = new SyntheticAccount(auth, "pdf-r1-writer");
    await reader.initialize(); await writer.initialize();
    const catalog = new CatalogImportService(auth, repository.files);
    const bytes = syntheticPdf(3, 1024 * 1024);
    const documents = await Promise.all((["sachverhalt", "loesung"] as const).map(role => validateCatalogPdf({ name: `${role}.pdf`, type: "application/pdf", size: bytes.length,
      arrayBuffer: async () => Uint8Array.from(bytes).buffer }, role)));
    let count = 0;
    return { runtime, repository, files, auth, reader, writer, bytes, base,
      async seed(): Promise<PdfIdentity> {
        const id = `pdf-r1-${++count}`;
        const result = await catalog.submit(writer.headers(), { requestId: `request-${id}`, metadata: { id, source: "synthetic", title: "PDF-A-R1 Sperrprobe", date: "", area: "zr", topicIds: [] }, documents });
        const document = result.summary.documents.find(value => value.role === "sachverhalt")!;
        return { klausurId: id, documentId: document.documentId, documentVersionId: document.documentVersionId };
      },
      async change(work: (client: PoolClient) => Promise<void>) {
        await auth.database.transaction(async client => { await lockState(client); await work(client); });
      },
      get(identity: PdfIdentity, options: { method?: string; extra?: Record<string, string>; describe?: boolean } = {}) {
        const headers = reader.headers(); Object.entries(options.extra ?? {}).forEach(([key, value]) => headers.set(key, value));
        return fetch(`${base}${pdfFileURL(identity, options.describe)}`, { headers, method: options.method ?? "GET" });
      },
      async close() {
        server!.closeAllConnections();
        await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
        await runtime.close();
      },
    };
  } catch (error) {
    server?.closeAllConnections();
    if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
    await runtime.close(); throw error;
  }
}
