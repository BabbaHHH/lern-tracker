import assert from "node:assert/strict";
import { test } from "node:test";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import { recordKey } from "../src/lib/data-migration/migration";
import { pdfViewerURL } from "../src/lib/pdf-viewer/contract";
import { indexTextRuns } from "../src/lib/search/core";
import { CatalogSearchService } from "../src/lib/server/search/service";
import type { AccountService } from "../src/lib/server/auth/service";
import type { SearchDocument } from "../src/lib/search/contract";

test("R37 native SQL: cursor searches all page blocks for the current combined version", { timeout: 120_000 }, async t => {
  const runtime = await testRuntime();
  t.after(() => runtime.close());
  const repository = await runtime.repository("r37_search_native_sql");
  const schema = await repository.database.pool.query<{ count: number; newest: string }>(
    "SELECT count(*)::integer AS count,max(name) AS newest FROM stex.schema_migrations",
  );
  assert.equal(schema.rows[0].count, 18);
  assert.equal(schema.rows[0].newest, "018_catalog_metadata_commands.sql");
  const pg = await repository.database.pool.query<{ major: number }>(
    "SELECT current_setting('server_version_num')::integer / 10000 AS major",
  );
  assert.equal(pg.rows[0].major, 18);

  const owner = "r37-native-synthetic-owner";
  const klausurId = "r37-native-synthetic-case";
  const documentId = "r37-native-synthetic-combined";
  const oldVersionId = "r37-native-synthetic-v1";
  const currentVersionId = "r37-native-synthetic-v2";
  const record = { id: klausurId, title: "Synthetischer SQL-Fall ohne Suchbegriff" };
  const key = recordKey("klausur", null, klausurId);
  const hashFor = (letter: string) => letter.repeat(64);

  await repository.database.transaction(async client => {
    await client.query("INSERT INTO stex.accounts(user_id,status,role,revision) VALUES($1,'active','member',1)", [owner]);
    await client.query(
      "INSERT INTO stex.catalog_records(record_key,kind,id,revision,legacy_key,payload,normalized) VALUES($1,'klausur',$2,1,'r37-native-synthetic',$3::jsonb,'{}'::jsonb)",
      [key, klausurId, JSON.stringify(record)],
    );
    await client.query(
      "INSERT INTO stex.catalog_documents(document_id,record_key,klausur_id,role,source_reference,created_by_user_id) VALUES($1,$2,$3,'kombiniert','synthetic-only.pdf',$4)",
      [documentId, key, klausurId, owner],
    );
    for (const [suffix, versionId, versionNumber, hashLetter] of [
      ["old", oldVersionId, 1, "a"], ["current", currentVersionId, 2, "b"],
    ] as const) {
      const importId = `r37-native-import-${suffix}`;
      const sha256 = hashFor(hashLetter);
      await client.query(
        `INSERT INTO stex.catalog_imports(import_id,submitted_by_user_id,request_id,source_digest,source_reference,status,
          acceptance_mode,content_check,technical_validation,duplicate_status,metadata,warnings)
         VALUES($1,$2,$3,$4,'synthetic-only.pdf','committed','direct','not-performed','valid','identical','{}'::jsonb,'[]'::jsonb)`,
        [importId, owner, `r37-native-request-${suffix}`, sha256],
      );
      await client.query(
        `INSERT INTO stex.catalog_document_versions(document_version_id,document_id,version_number,sha256,byte_size,media_type,
          page_count,text_status,extraction_version,storage_key,data_url_header,source_filename,submitted_by_user_id,import_id)
         VALUES($1,$2,$3,$4,123,'application/pdf',17,'ready','synthetic-pdf-a',$5,'data:application/pdf;base64,',$6,$7,$8)`,
        [versionId, documentId, versionNumber, sha256, `objects/${sha256}/${sha256}.bin`, `${suffix}.pdf`, owner, importId],
      );
    }
  });

  const identity = { klausurId, documentId, documentVersionId: currentVersionId };
  const document: SearchDocument = { ...identity, role: "kombiniert", sha256: hashFor("b") };
  const epochRow = await repository.database.pool.query<{ epoch: string }>(
    "SELECT epoch FROM stex.search_jobs WHERE document_version_id=$1", [currentVersionId],
  );
  const epoch = epochRow.rows[0].epoch;
  const needle = "Kaufmännisches Bestätigungsschreiben";
  const pages = Array.from({ length: 17 }, (_, index) => index + 1).map(pageNumber => {
    const text = pageNumber === 9 || pageNumber === 17
      ? `PDF-only Fundstelle: ${needle}. Seite ${pageNumber}.`
      : `Synthetischer PDF-Text ohne gesuchten Ausdruck. Seite ${pageNumber}.`;
    return indexTextRuns(document, pageNumber, [{ str: text }]);
  });
  for (const page of pages) {
    await repository.database.pool.query(
      "INSERT INTO stex.search_pages(document_version_id,epoch,page_number,payload) VALUES($1,$2,$3,$4::jsonb)",
      [currentVersionId, epoch, page.pageNumber, JSON.stringify(page)],
    );
  }
  const manifest = {
    document, indexVersion: pages[0].indexVersion, normalizationVersion: pages[0].normalizationVersion,
    textVersion: pages[0].textVersion, revision: 17, pageCount: 17, nextPage: 18,
    status: "ready" as const, readyPages: 17, missingTextPages: 0, failedPages: 0, failure: null,
  };
  await repository.database.pool.query(
    "UPDATE stex.search_jobs SET state='complete',manifest=$2::jsonb WHERE document_version_id=$1",
    [currentVersionId, JSON.stringify(manifest)],
  );

  const principal = { userId: owner, sessionId: "synthetic-session-r37-native", generation: 1 };
  const auth = {
    database: repository.database,
    principal: async () => principal,
    checkPrincipal: async (_client: unknown, sessionId: string) => {
      assert.equal(sessionId, principal.sessionId);
      return principal;
    },
  } as unknown as AccountService;
  const response = await new CatalogSearchService(auth).search(new Headers(), { text: needle });

  assert.equal(response.totalHits, 2);
  assert.equal(response.limited, false);
  assert.equal(response.documents.length, 1, "historical document versions must stay outside current search scope");
  assert.deepEqual(response.hits.map(hit => hit.pageNumber), [9, 17]);
  assert.ok(response.hits.every(hit => hit.documentVersionId === currentVersionId && hit.role === "kombiniert"));
  const hit = response.hits[1];
  assert.equal(hit.evidence, needle);
  assert.deepEqual(hit.target, { pageNumber: 17, start: hit.start, end: hit.end, textVersion: hit.textVersion });
  assert.equal(hit.viewerURL, pdfViewerURL(identity, {
    pageNumber: 17, start: hit.start, end: hit.end, textVersion: hit.textVersion,
  }));
});
