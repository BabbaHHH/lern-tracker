import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fixtureBackup, fixtureContext, TEST_OWNER } from "../scripts/data-migration/fixture";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import type { AnnotationContract, JsonObject } from "../src/lib/data-migration/contract";
import { canonical, compareMigration, digest, recordKey } from "../src/lib/data-migration/migration";
import { backup, restore } from "../src/lib/server/persistence/backup";
import { fileHash, PrivateFiles } from "../src/lib/server/persistence/files";

const otherOwner = "data-b-other-owner";
test("DATA-B: echte PostgreSQL-Persistenz mit isolierten Daten", { timeout:120000 }, async t => {
  const runtime = await testRuntime();
  t.after(() => runtime.close());
  let repository = await runtime.repository("data_b_source");
  await repository.createAccount({userId:TEST_OWNER,status:"active",role:"member",revision:1});
  await repository.createAccount({userId:otherOwner,status:"active",role:"member",revision:1});
  const source = fixtureBackup();
  const context = fixtureContext();
  const originalSource = canonical(source);
  const plan = await repository.preview(source,context);
  const imported = await repository.import(plan,"import-1");

  await t.test("Schema kann wiederholt angewendet werden; veränderte Migration blockiert", async () => {
    await repository.database.migrate();
    const folder = await mkdtemp(join(runtime.root,"changed-migration-"));
    await writeFile(join(folder,"001_data_contract.sql"),(await readFile("db/migrations/001_data_contract.sql","utf8"))+"\n-- changed\n");
    await writeFile(join(folder,"002_auth_accounts.sql"),await readFile("db/migrations/002_auth_accounts.sql","utf8"));
    await assert.rejects(repository.database.migrate(folder),/Migration wurde verändert/);
    await rm(folder,{recursive:true});
    const expectedMigrations = (await readdir("db/migrations")).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    assert.deepEqual((await repository.database.pool.query("SELECT name FROM stex.schema_migrations ORDER BY name")).rows.map(row => row.name), expectedMigrations);
  });
  await t.test("Alle 24 Bereiche, IDs, Referenzen und Klassifizierungen bleiben erhalten", async () => {
    const snapshot = await repository.snapshot(TEST_OWNER);
    const comparison = compareMigration(source,snapshot,imported.receipt);
    assert.equal(comparison.equal,true);
    assert.equal(comparison.areaCount,24);
    assert.equal(comparison.recordCount,25);
    assert.equal(snapshot.records[recordKey("klausur",null,"example-case")].normalized.date,null);
    assert.equal((snapshot.records[recordKey("klausur",null,"example-case")].value as JsonObject).type,"ZR-Urteil");
    assert.ok(Number((await repository.database.pool.query("SELECT count(*) FROM stex.record_references")).rows[0].count)>10);
    assert.equal(canonical(source),originalSource);
  });
  await t.test("Originalbytes liegen separat; PostgreSQL enthält nur Dateimetadaten", async () => {
    const record = (await repository.database.pool.query("SELECT payload FROM stex.personal_records WHERE kind='document'")).rows[0];
    assert.equal(Object.hasOwn(record.payload,"dataUrl"),false);
    const version = (await repository.database.pool.query("SELECT * FROM stex.document_versions")).rows[0];
    const file = await repository.files.read(version.storage_key,version.sha256,Number(version.byte_size));
    assert.equal(fileHash(file),version.sha256);
    assert.equal((await readFile(join(repository.files.root,version.storage_key))).equals(file),true);
  });
  await t.test("Wiederholung derselben Vorgangs-ID schreibt nichts; neue Vorgangs-ID dupliziert keine Datensätze", async () => {
    const before = await repository.snapshot(TEST_OWNER);
    assert.equal((await repository.import(plan,"import-1")).replay,true); // original, now stale preview is safe for a replay
    assert.equal(digest(await repository.snapshot(TEST_OWNER)),digest(before));
    await repository.import(await repository.preview(source,context),"import-2");
    const after = await repository.snapshot(TEST_OWNER);
    assert.equal(Object.keys(after.records).length,25);
    assert.equal(Object.keys(after.documentVersions).length,1);
    assert.equal(Object.keys(after.imports).length,2);
  });
  await t.test("ID-Kollision und wiederverwendete Vorgangs-ID überschreiben nichts", async () => {
    const changed = fixtureBackup();
    (changed.data["lerntracker-klausuren"] as JsonObject[])[0].title = "Abweichender Inhalt";
    const conflict = await repository.preview(changed,context);
    assert.equal(conflict.conflicts.length,1);
    const before = digest(await repository.snapshot(TEST_OWNER));
    await assert.rejects(repository.import(conflict,"collision"),/Migration nicht möglich/);
    await assert.rejects(repository.import(conflict,"import-1"),/Vorgangs-ID/);
    assert.equal(digest(await repository.snapshot(TEST_OWNER)),before);
  });
  await t.test("Fehler nach mehreren SQL-Schreibvorgängen rollt die gesamte Transaktion zurück", async () => {
    const isolated = await runtime.repository("data_b_atomic");
    await isolated.createAccount({userId:TEST_OWNER,status:"active",role:"member",revision:1});
    const before = digest(await isolated.snapshot(TEST_OWNER));
    const preview = await isolated.preview(source,context);
    await assert.rejects(isolated.import(preview,"failure",{beforeWrite:index => { if(index===8) throw new Error("synthetic-write-failure"); }}),/synthetic-write-failure/);
    assert.equal(digest(await isolated.snapshot(TEST_OWNER)),before);
    for (const table of ["catalog_records","personal_records","topics","record_references","imports","document_versions"]) {
      assert.equal((await isolated.database.pool.query(`SELECT count(*) FROM stex.${table}`)).rows[0].count,"0");
    }
    const controller = new AbortController();
    await assert.rejects(isolated.import(preview,"abort",{signal:controller.signal,beforeWrite:index => { if(index===5) controller.abort(); }}),/abgebrochen/);
    assert.equal(digest(await isolated.snapshot(TEST_OWNER)),before);
    await assert.rejects(isolated.import(preview,"late-failure",{beforeCommit:() => { throw new Error("synthetic-before-commit-failure"); }}),/synthetic-before-commit/);
    assert.equal(digest(await isolated.snapshot(TEST_OWNER)),before);
    assert.equal((await isolated.database.pool.query("SELECT count(*) FROM stex.document_versions")).rows[0].count,"0");
    // A prepublished immutable file can remain unreferenced; a retry verifies and reuses it.
    await isolated.import(preview,"retry-after-failure");
    assert.equal(Object.keys((await isolated.snapshot(TEST_OWNER)).records).length,25);
  });
  await t.test("Unzugeordnete eingebettete Dateibytes werden vor dem Datenbankabschluss zurückgewiesen", async () => {
    const isolated = await runtime.repository("data_b_nested_bytes");
    await isolated.createAccount({userId:TEST_OWNER,status:"active",role:"member",revision:1});
    const nested = fixtureBackup();
    const profile = nested.data["lerntracker-onboarding"] as JsonObject;
    (profile.documents as JsonObject[])[0].dataUrl = (nested.data["lerntracker-documents"] as JsonObject[])[0].dataUrl;
    await assert.rejects(isolated.import(await isolated.preview(nested,context),"nested"),/gesonderte Dateizuordnung/);
    assert.equal(Object.keys((await isolated.snapshot(TEST_OWNER)).records).length,0);
  });
  await t.test("Parallele Imports benötigen nach konkurrierendem Abschluss eine neue Vorschau", async () => {
    const preview = await repository.preview(source,context);
    const results = await Promise.allSettled([repository.import(preview,"parallel-a"),repository.import(preview,"parallel-b")]);
    assert.equal(results.filter(result => result.status==="fulfilled").length,1);
    assert.equal(results.filter(result => result.status==="rejected").length,1);
    assert.equal(Object.keys((await repository.snapshot(TEST_OWNER)).records).length,25);
  });
  await t.test("Zwei Eigentümer behalten getrennte private Texte, Dateien und Belege; Katalog bleibt gemeinsam", async () => {
    const second = fixtureBackup();
    (second.data["lerntracker-entries"] as JsonObject[])[0].note = "Notiz nur für den zweiten Eigentümer";
    await repository.import(await repository.preview(second,fixtureContext(otherOwner)),"import-1");
    const a = await repository.snapshot(TEST_OWNER);
    const b = await repository.snapshot(otherOwner);
    assert.equal(Object.values(a.records).filter(record => record.ownerUserId===otherOwner).length,0);
    assert.equal(Object.values(b.records).filter(record => record.ownerUserId===TEST_OWNER).length,0);
    assert.equal((a.records[recordKey("learning-entry",TEST_OWNER,"note-1")].value as JsonObject).note,"Meine persönliche Lernnotiz");
    assert.equal((b.records[recordKey("learning-entry",otherOwner,"note-1")].value as JsonObject).note,"Notiz nur für den zweiten Eigentümer");
    assert.deepEqual(a.records[recordKey("klausur",null,"example-case")],b.records[recordKey("klausur",null,"example-case")]);
    assert.notEqual(Object.keys(a.documentVersions)[0],Object.keys(b.documentVersions)[0]);
    assert.equal((await repository.database.pool.query("SELECT count(*) FROM stex.catalog_records")).rows[0].count,"1");
    await assert.rejects(repository.snapshot("unknown-owner"),/Aktives/);
  });
  await t.test("Datenbank-Fremdschlüssel verhindern fremde private Referenzen und Dateizuordnung", async () => {
    const sourceKey = recordKey("task",TEST_OWNER,"task-1");
    await assert.rejects(repository.database.pool.query("INSERT INTO stex.record_references VALUES ($1,$2,$3,$4,NULL,$5,NULL,NULL)",
      [sourceKey,"foreign-test",TEST_OWNER,sourceKey,recordKey("calendar-event",otherOwner,"event-1")]),/foreign key/);
    const versionId = Object.keys((await repository.snapshot(TEST_OWNER)).documentVersions)[0];
    await assert.rejects(repository.database.pool.query("UPDATE stex.document_versions SET owner_user_id=$1 WHERE document_version_id=$2",[otherOwner,versionId]),/immutable/);
  });
  await t.test("Seiten und Markierungen haben echte Versions- und Eigentümerbezüge", async () => {
    const versionId = Object.keys((await repository.snapshot(TEST_OWNER)).documentVersions)[0];
    await repository.addPage(TEST_OWNER,{documentVersionId:versionId,pageNumber:1,printedLabel:"I",width:595,height:842,rotation:0,textStatus:"pending",extractionVersion:null});
    const annotation: AnnotationContract = {id:"annotation-1",ownerUserId:TEST_OWNER,documentVersionId:versionId,pageNumber:1,
      rectangles:[{x:0.1,y:0.2,width:0.3,height:0.04}],quote:"Synthetisches Zitat",note:"Meine Anmerkung",revision:1};
    await repository.saveAnnotation(TEST_OWNER,annotation,null);
    assert.deepEqual(await repository.annotations(TEST_OWNER),[annotation]);
    assert.deepEqual(await repository.annotations(otherOwner),[]);
    await assert.rejects(repository.saveAnnotation(otherOwner,annotation,null),/Eigentümer/);
    await assert.rejects(repository.saveAnnotation(otherOwner,{...annotation,ownerUserId:otherOwner},null),/foreign key/);
    await assert.rejects(repository.saveAnnotation(TEST_OWNER,{...annotation,revision:2,pageNumber:99},1),/foreign key/);
    await repository.saveAnnotation(TEST_OWNER,{...annotation,revision:2,note:"Überarbeitete Anmerkung"},1);
    await assert.rejects(repository.saveAnnotation(TEST_OWNER,{...annotation,revision:2},1),/Revisionskonflikt/);
  });
  await t.test("Revisionen verhindern verlorene Änderungen und nachträgliches Überschreiben durch Reimport", async () => {
    const snapshot = await repository.snapshot(otherOwner);
    const value = snapshot.records[recordKey("learning-entry",otherOwner,"note-1")].value as JsonObject;
    const updated = {...value,note:"Neue persönliche Revision"};
    assert.equal(await repository.editPersonal(otherOwner,"learning-entry","note-1",updated,1,context.topicIds),2);
    await assert.rejects(repository.editPersonal(otherOwner,"learning-entry","note-1",value,1,context.topicIds),/Revisionskonflikt/);
    await assert.rejects(repository.editPersonal(TEST_OWNER,"learning-entry","note-1",{...updated,id:"changed-id"},1,context.topicIds),/ID ist unveränderlich/);
    const old = fixtureBackup();
    (old.data["lerntracker-entries"] as JsonObject[])[0].note = "Notiz nur für den zweiten Eigentümer";
    await assert.rejects(repository.import(await repository.preview(old,fixtureContext(otherOwner)),"import-1"),/Datenrevisionen/);
    assert.equal((await repository.snapshot(otherOwner)).records[recordKey("learning-entry",otherOwner,"note-1")].revision,2);
  });
  await t.test("Reimport erhält bereits fortgeschriebene Extraktionsmetadaten", async () => {
    const versionId = Object.keys((await repository.snapshot(TEST_OWNER)).documentVersions)[0];
    await repository.database.transaction(async client => {
      await client.query("SELECT generation FROM stex.state WHERE singleton FOR UPDATE");
      await client.query("UPDATE stex.document_versions SET page_count=1,text_status='ready',extraction_version='synthetic-extraction-1' WHERE document_version_id=$1",[versionId]);
      await client.query("UPDATE stex.document_pages SET text_status='ready',extraction_version='synthetic-extraction-1' WHERE document_version_id=$1",[versionId]);
      await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
    });
    await repository.import(await repository.preview(source,context),"after-extraction");
    const version = (await repository.snapshot(TEST_OWNER)).documentVersions[versionId];
    assert.equal(version.textStatus,"ready");
    assert.equal(version.pageCount,1);
    assert.equal(version.extractionVersion,"synthetic-extraction-1");
  });
  await t.test("Daten bleiben nach echtem PostgreSQL-Prozessneustart und neuen Verbindungen identisch", async () => {
    const a = digest(await repository.snapshot(TEST_OWNER));
    const b = digest(await repository.snapshot(otherOwner));
    const annotations = await repository.annotations(TEST_OWNER);
    repository = await runtime.restart("data_b_source",repository.files);
    assert.equal(digest(await repository.snapshot(TEST_OWNER)),a);
    assert.equal(digest(await repository.snapshot(otherOwner)),b);
    assert.deepEqual(await repository.annotations(TEST_OWNER),annotations);
    assert.equal((await repository.import(plan,"import-1")).replay,true);
    assert.equal(compareMigration(source,await repository.snapshot(TEST_OWNER),imported.receipt).equal,true);
  });
  const backupPath = join(runtime.root,"complete-backup");
  await t.test("Datenbank und private Dateien werden zusammen gesichert und in leeres Ziel wiederhergestellt", async () => {
    const a = digest(await repository.snapshot(TEST_OWNER));
    const b = digest(await repository.snapshot(otherOwner));
    const saved = await backup(repository.database,repository.files,backupPath);
    assert.equal(saved.fileCount,2);
    const target = await runtime.repository("data_b_restore");
    const restored = await restore(target.database,target.files,backupPath);
    assert.equal(restored.sha256,saved.sha256);
    assert.equal(digest(await target.snapshot(TEST_OWNER)),a);
    assert.equal(digest(await target.snapshot(otherOwner)),b);
    assert.deepEqual(await target.annotations(TEST_OWNER),await repository.annotations(TEST_OWNER));
    const secondBackup = await backup(target.database,target.files,join(runtime.root,"restored-backup"));
    assert.equal(secondBackup.sha256,saved.sha256); // compares every persisted table, including references and migrations
    await assert.rejects(restore(target.database,target.files,backupPath),/leere Zieldatenbank/);
    await assert.rejects(backup(repository.database,repository.files,backupPath),/EEXIST/);
    const occupied = await runtime.repository("data_b_occupied_files");
    await occupied.files.initialize();
    await writeFile(join(occupied.files.root,"occupied"),"synthetic existing file");
    await assert.rejects(restore(occupied.database,occupied.files,backupPath),/leeren privaten Dateispeicher/);
    assert.equal((await occupied.database.pool.query("SELECT count(*) FROM stex.accounts")).rows[0].count,"0");
  });
  await t.test("Beschädigtes Sicherungsmanifest bleibt ohne Wirkung", async () => {
    const folder = join(runtime.root,"corrupt-manifest");
    const original = await readFile(join(backupPath,"manifest.json"),"utf8");
    const parsed = JSON.parse(original);
    parsed.rows.accounts[0].role = "admin";
    await mkdir(folder);
    await writeFile(join(folder,"manifest.json"),JSON.stringify(parsed));
    const target = await runtime.repository("data_b_corrupt");
    await assert.rejects(restore(target.database,target.files,folder),/manifest ist beschädigt/);
    assert.equal((await target.database.pool.query("SELECT count(*) FROM stex.accounts")).rows[0].count,"0");
  });
  await t.test("Fehlende oder beschädigte Sicherungsdatei verhindert Teilwiederherstellung", async () => {
    const version = (await repository.database.pool.query("SELECT * FROM stex.document_versions ORDER BY document_version_id")).rows[0];
    const path = join(backupPath,"files",version.storage_key);
    const bytes = await readFile(path);
    await writeFile(path,Buffer.from("corrupted synthetic bytes"));
    const target = await runtime.repository("data_b_missing_file");
    await assert.rejects(restore(target.database,target.files,backupPath),/beschädigt/);
    assert.equal((await target.database.pool.query("SELECT generation FROM stex.state")).rows[0].generation,"0");
    assert.equal((await target.database.pool.query("SELECT count(*) FROM stex.accounts")).rows[0].count,"0");
    assert.equal((await readdir(target.files.root)).length,0);
    await rm(path);
    const missing = await runtime.repository("data_b_absent_file");
    await assert.rejects(restore(missing.database,missing.files,backupPath),/ENOENT/);
    assert.equal((await missing.database.pool.query("SELECT count(*) FROM stex.accounts")).rows[0].count,"0");
    await writeFile(path,bytes);
  });
  await t.test("Privater Dateispeicher weist Pfadtraversal, public und symbolische Verknüpfungen zurück", async () => {
    assert.throws(() => new PrivateFiles(join(runtime.root,"public","files")),/öffentlich/);
    await assert.rejects(repository.files.read("../escape","0".repeat(64),0),/Dateikennung/);
    const isolated = new PrivateFiles(join(runtime.root,"symlink-files"));
    await isolated.initialize();
    await symlink(repository.files.root,join(isolated.root,"objects"));
    await assert.rejects(isolated.put(`objects/${"a".repeat(64)}/${"b".repeat(64)}.bin`,Buffer.from("x"),fileHash(Buffer.from("x"))),/Verzeichnisstruktur/);
  });
});
