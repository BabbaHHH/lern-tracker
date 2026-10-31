import { CatalogImportService, validateCatalogPdf } from "../../src/lib/server/catalog/import-service";
import type { AccountService } from "../../src/lib/server/auth/service";
import { searchFixtures } from "./fixtures";
export async function importSearchFixture(auth: AccountService, headers: Headers, version = 1) {
  if (!auth.files) throw new Error("Fixture-Dateispeicher fehlt.");
  const fixtures = searchFixtures();
  const prepared = await Promise.all((["sachverhalt", "loesung"] as const).map(async role => {
    const bytes = role === "sachverhalt" ? fixtures[version === 1 ? 0 : 1].bytes : fixtures[2].bytes;
    return validateCatalogPdf({ name: `${role}.pdf`, size: bytes.length, type: "application/pdf", arrayBuffer: async () => Uint8Array.from(bytes).buffer }, role);
  }));
  return new CatalogImportService(auth, auth.files).submit(headers, { requestId: `search-synthetic-import-v${version}`,
    metadata: { id: "search-synthetic-case", source: "synthetic", title: "Synthetische Suchklausur", area: "zr", date: "", topicIds: [] }, documents: prepared });
}
