import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { searchFixtures } from "./fixtures";
import { MemorySearchAdapter } from "./memory-adapter";
import { extractSearchBatch } from "../../src/lib/server/search/extract";
import { searchPages } from "../../src/lib/search/core";

const folder = fileURLToPath(new URL("./fixtures/", import.meta.url));
await mkdir(folder, { recursive: true });
const adapter = new MemorySearchAdapter();
for (const fixture of searchFixtures()) {
  await writeFile(`${folder}${fixture.name}`, fixture.bytes);
  let manifest;
  do { manifest = await extractSearchBatch(fixture.bytes, fixture.document, adapter, { maxPages: 1 }); }
  while (manifest.status === "pending");
}
const result = {
  syntheticOnly: true,
  phrase: searchPages(adapter.allPages(), { text: "KAUFMÄNNISCHES BESTÄTIGUNGSSCHREIBEN" }),
  norm: searchPages(adapter.allPages(), { norm: { law: "ZPO", paragraph: "172" } }),
};
await writeFile(`${folder}index.json`, adapter.dump() + "\n");
await writeFile(`${folder}results.json`, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ syntheticDocuments: 3, indexedPages: adapter.allPages().length,
  phraseHits: result.phrase.totalHits, normHits: result.norm.totalHits, coverage: result.norm.coverage }));
