# IMPORT-01 · Übergabe Runde36-B2 ·23.10.2026

Gleiche Aufgaben-ID04,gleiche gemeinsame uncommittete Kopie,kein neues unabhängiges Projekt. Bisheriger Chat01a1226d-17d5-7c90-ab92-5beae06c2ce7 ist abgeschlossen/notLoaded,letzter Cursor0c4f450f-822b-451e-a830-c2ba7a413d0d:1. Zwei große IMPORT-B-Blöcke mit mehreren älteren Verdichtungen; vor neuem B2-Block frischer Kontext nach Wechselregel. Bisherige Import-/Uploadprüfungen bleiben fertig und werden nicht pauschal wiederholt. Neuer Chat zunächst nur Setup;Produktauftrag erst nach Zuordnung/Folgeauftrag. Astra strikt verboten;gpt-6.1-sol/high.

Aktuelle oberste Zentralabschnitte,Runde36 und gezielt B2 in docs/entwuerfe/DATA-01/R36-ANSCHLUSSLUECKEN.md lesen. HTTPS,17Migrationen,Dienste und persönlicher active/admin-Zugang fertig. Kein Serverzugriff oder echter Bestandsumzug. Ziel ist vertraute Originalanwendung mit Kontopersistenz,keine Browserpersistenz.

Nächster Backendblock: dateifreier revisions-/konto-/sitzungsgebundener Katalogmetadaten-JSONimport und Änderungs-/Löschaktionen für Admin;normale aktive Mitglieder behalten bestehenden technischen PDFimport. Originalfilter,PDFleser und exam.record sind bereits wiederverwendbar. Vorhandene Katalog-ID/Klassifizierung nicht ersetzen. Unbekanntes Datum leer,kein KIklassifizieren. Unbekannte private Erweiterungen niemals in gemeinsamen Katalog verschieben.

Neue eigene metadata-contract/client/hook und metadata-service/http/runtimeadapter,neue APIroute;bestehende validateCatalogMetadata und Record-/Auth-/Sperrverträge verwenden. Idempotente dauerhafte Mutationsbelege,revisionsgebundene Vorschau/Batches,bei abweichender existierender ID konflikt statt Überschreiben. Löschen mit Datei-/Import-/Kalender-/Task-/Draft-/privaten Bezügen verweigern statt Kaskade. Genaue bereits vorhandene Referenzpflege prüfen. Kein erfundenes Archivieren als Delete.

Voraussichtlich exklusiv: neue src/lib/catalog/metadata-*.ts;src/lib/server/catalog/metadata-*.ts;neue src/app/api/catalog/metadata/**;kleiner Zusatz src/lib/server/catalog/runtime.ts und Importvalidatornurwiederverwenden. Falls Belegtabellen nötig ausschließlich neue018_catalog_metadata_commands.sql sowie backup.ts eigener Fixed-Table-/Restorevertrag. Vorherige001–017 unverändert,database.ts zunächst read-only. Exakte Pfade im Folgeauftrag/CHATS.json.

UI-01 besitzt Navigation/Themes/Startseite;DATA besitzt Profil/Schedule-Backend36-B1. Keine Überschneidung. Keine UI/Paket/Auth/SchemaAltpfade/Deploymentänderung,keine anderen Chats beauftragen. Nur neue passende künstliche DB-/Auth-/Konflikt-/Restoreprüfungen selbst durchführen;Testressourcen isolieren. Planung nur lesende Abnahme,kein Test/Build. Öffentlicher Bericht und konkrete Clientexports für folgende UIintegration,dann Writerende.

