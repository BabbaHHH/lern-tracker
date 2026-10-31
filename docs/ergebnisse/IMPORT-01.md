# Aktueller Abschluss · IMPORT-01 /36.2-K-R ·23.10.2026

Fehlender Katalogtyp beim Schreibshortcut behoben: Vorhandener verknüpfter Entwurf wird weiterhin direkt geöffnet. Sonst verlangt eine bewusste Typwahl am Katalogshortcut zunächst eine leere Auswahl; erst „Schreiben“ legt den privaten Entwurf an. Kein erratener Katalogtyp, kein gelockerter Writingvertrag. Abbrechen schreibt nichts.

Der endgültige Stand der zwei geänderten Produktdateien ist mit künstlichem Mitglied im tatsächlichen Browser geprüft: Abbruch0Entwürfe/0Schreibbefehle; bewusste Wahl „Anwaltsklausur“ danach1Entwurf/1Schreibbefehl; Katalogtyp weiterleer; erneuter Shortcut öffnet dieselbe Entwurf-ID ohne weiteren Schreibbefehl. Gezielte Typ-/Lintprüfung bestanden, Ressourcen bereinigt. Keine Wiederholung vorheriger Katalog-/UI-/B2Gesamtläufe.

**success:true · writerEnded:true.** Maßgebliches Dependency-Signal für DATA: [R36-KATALOG-TYP-ABSCHLUSS.md](../entwuerfe/IMPORT-01/R36-KATALOG-TYP-ABSCHLUSS.md). Keine weitere Produktänderung nach diesem Abschluss.

---

# Vorheriger Abschluss · IMPORT-01 /36.2-K ·23.10.2026

Die ursprüngliche Klausuransicht wurde aus der tatsächlichen2227Zeilen umfassenden Browserfassung extrahiert und unter `/konto/klausuren` mit Kontodaten verbunden. Dieselben Karten/Filter/Sidebar/Dialoge, B2-Metadatenaktionen, versionierter PDFleser, Tagesplan/Bearbeitungsabschluss und Schreibshortcut. Browserfassung erhalten, kein Konto-Store-Fallback.4neue gezielte Tests, Typprüfung/Lint und echter synthetischer Browserablauf einschließlich390pxAnsicht bestanden. B2-Backend/Schemadateien unverändert, kein Server oder echter Bestand verändert.

**Offen:** `/klausuren` wird von der gemeinsamen Boundary über `schedulePageAllowed` weiterhin gesperrt; die allein zugewiesene Änderung an `personalPageAllowed` reicht tatsächlich nicht. Zusätzliche eine Pfadfreigabe liegt außerhalb der zugewiesenen Schreibpfade und wurde früh angefragt. `/konto/klausuren` nutzt die Originalansicht bereits. Schreibarbeit hier beendet, kein selbstständiger weiterer Ausbau.

[Kurzer Abschluss mit Dateiliste und genauem Routenblocker](../entwuerfe/IMPORT-01/R36-KATALOG-ABSCHLUSS.md) · [Desktop](../entwuerfe/IMPORT-01/R36-KATALOG-desktop.png) · [Mobil](../entwuerfe/IMPORT-01/R36-KATALOG-mobil.png).

---

# Vorheriger Abschluss · IMPORT-01 / R36-B2 · 23.10.2026

Dateifreier Metadatenimport und revisions-/objektstandsgebundene Adminänderungen einschließlich geschütztem Löschen lokal implementiert. Dauerhafte UUID-Belege, besitzergebundene Statusabfrage und flüchtiger Konto-/Sitzungsclient für die anschließende Integration in die ursprünglichen Ansichten. Technischer PDFimport für Mitglieder erhalten; keine UI, echte Bestände oder Server geändert.

Stabile Exports, Feldsemantik und Bedienfolge: [R36-B2-UI-ANSCHLUSS.md](../entwuerfe/IMPORT-01/R36-B2-UI-ANSCHLUSS.md). Dateien, native Prüfbelege und Grenzen: [R36-B2-ABSCHLUSS.md](../entwuerfe/IMPORT-01/R36-B2-ABSCHLUSS.md). Quellbindungen: [R36-B2-QUELLEN.json](../entwuerfe/IMPORT-01/R36-B2-QUELLEN.json).

Echter synthetischer PostgreSQL-/Auth-/HTTPlauf:11bestandene Tests (Gruppe+10Fälle), darin Format4-Restore einschließlich neuer Belege und Neuanmeldung. Nach letzter Objektstands-/Kontowechselergänzung ausschließlich2neue Fälle bestanden (mit Gruppe3Tests); ursprüngliche11Prüfungen/Typprüfung/Restore auf Folgeauftrag nicht wiederholt. Gezieltes Lint auch für letzte Änderungen sauber. Alte001–017 anhand17Hashes unverändert. Einzige neue Migration018 und eine feste Tabellenzeile im Format4-Backupvertrag; Zielmigration/Runtimegrants/Releasepaket später separat durch HOST.

**Writerende:** Übergabe fertig, eigene Testressourcen über Testfinalizer geschlossen/entfernt; kein weiteres Paket begonnen. Frühere Ergebnisse unten sind unverändert erhalten.

---

# Ergebnis IMPORT-01: Offline-Inventar

Stand: 10.10.2026

Der abgegrenzte Auftrag IMPORT-A ist abgeschlossen. Der vorhandene lokale Klausurbestand wurde quellengetrennt inventarisiert. Die Inventur ändert weder die Anwendung noch Originaldateien, vorhandene Klassifizierungen, IDs, persönliche Notizen oder Kalenderbezüge.

## Nachträgliche Umfangsentscheidung

Für den ersten Serverimport gilt der Katalog, den die aktuelle Website unter `/klausuren` anzeigt. Dieser liegt in der bestehenden Anwendung im Browser-LocalStorage unter `lerntracker-klausuren`; die 2.753 lokal inventarisierten Dateien werden daher nicht pauschal auf den Server übernommen. Die übrigen Bestände sind als [Migrationsvorrat](../entwuerfe/IMPORT-01/MIGRATIONS-VORRAT.md) mit Pfad, Inhalt und späterem Prüfgrund dokumentiert.

## Vorgehen

Erfasst wurden der Referenzexport, die klassifizierten JSON-Bestände, das KG-Dateimanifest sowie die lokalen PDF-Bestände aus den Komplett-, Hamburg-, KG-, Muster- und examensgerecht-Ordnern. Jede Datei erhielt eine stabile Inventar-ID aus Quelle und relativem Pfad. Zusätzlich wurden Dateigröße, Rolle, normalisierte Fallkennung und SHA-256-Prüfsumme erhoben. Vorhandene Metadaten-IDs und Kennzeichnungen wurden nur übernommen.

Für die zweite Auswertung wurden bei lokal extrahierbaren PDFs die ersten drei Seiten normalisiert und als Textprobe gehasht. Gleiche Prüfsummen oder Textproben sind ausschließlich Prüfhinweise. Es wurde keine Datei zusammengeführt, gelöscht, umklassifiziert oder in die App importiert.

Die Methodik ist in [METHODIK.md](../entwuerfe/IMPORT-01/METHODIK.md) beschrieben. Die ausführliche aggregierte Auswertung steht in [inventory-summary-text.md](../entwuerfe/IMPORT-01/inventory-summary-text.md); die Hash-/Strukturauswertung ohne Textproben ist in [inventory-summary.md](../entwuerfe/IMPORT-01/inventory-summary.md) erhalten.

## Befund

| Kennzahl | Ergebnis |
|---|---:|
| erfasste Dateien | 2.753 |
| JSON-Metadatenzeilen | 756 |
| KG-Manifestfälle | 166 |
| bytegleiche PDF-Gruppen (SHA-256) | 285 |
| Fallkennungs-/Versionskandidaten | 367 |
| mögliche getrennte Lösungsergänzungen | 231 |
| gleiche Textproben-Gruppen | 340 |
| Metadaten-ID-Gruppen mit Widerspruch | 101 |
| Metadatenzeilen ohne PDF-Inventar-ID | 0 |
| PDF-Inventar-IDs ohne Metadatenzeile | 792 |

Die Quellbestände überschneiden sich und dürfen nicht zu einer eindeutigen Klausurzahl addiert werden:

| Quelle | Dateien | PDFs | JSON | Metadaten | unterschiedliche IDs |
|---|---:|---:|---:|---:|---:|
| Hamburg | 278 | 215 | 63 | 63 | 43 |
| KG lose Dateien | 460 | 460 | 0 | 0 | 0 |
| KG Manifest | 1 | 0 | 1 | 0 | 0 |
| KG merged | 440 | 220 | 220 | 220 | 171 |
| KG raw | 341 | 341 | 0 | 0 | 0 |
| Klausuren komplett | 642 | 449 | 193 | 193 | 156 |
| Klausuren komplett Kopie | 283 | 283 | 0 | 0 | 0 |
| sonstige lokale Sammlungen | 307 | 307 | 0 | 0 | 0 |
| Referenz-JSON | 1 | 0 | 1 | 280 | 211 |

Beispiele aus der Kandidatenliste:

- Die PDF `VA 30 RAin Dr Kassabova - Komplett.pdf` aus dem KG-`merged`-Bestand und `VA 30 RAin Dr Kassabova - Komplett_komplett.pdf` aus der Komplett-Kopie sind bytegleich.
- Die Hamburg-Dateien `061-str-i-data.pdf` und `Klausuren_Combined/061_StR_I_combined.pdf` haben dieselbe normalisierte Textprobe, obwohl ihre Dateinamen zu unterschiedlichen Fallkennungen führen.
- Für `061 str i data`, `065 str i data`, `067 oer ii data` und `067 zhg data` werden getrennte Sachverhalts-/Lösungsdateien als mögliche Lösungsergänzungen sichtbar.
- Bei 101 vorhandenen Metadaten-IDs weichen Quelle, Titel, Datum, Typ oder Themenkennungen zwischen den Einträgen ab. Diese Fälle sind mit `widerspruch_pruefen` markiert und nicht entschieden.

Das gemischte `Lernplan Dokumente/all_klausuren_bundle.json`, der Bücherordner und die NotebookLM-Container-Chunks wurden als gesonderte Artefakte ausgewiesen und nicht als eigenständige Klausuren gezählt.

## Reproduzierbarkeit und Dateien

Die Auswertung kann aus `lern-tracker/` mit dem dokumentierten CLI wiederholt werden. Der Textlauf wurde mit `--text selected --max-text-bytes 1048576` und lokaler `pdftotext`-Extraktion ausgeführt. Das Rohinventar liegt bewusst außerhalb des Repositories unter `/private/tmp`; es enthält keine PDF-Texte, sondern nur technische Prüfwerte und relative Pfade.

Die neue, auf diese Teilstufe begrenzte Implementierung liegt in:

- [scripts/import-inventory/inventory.ts](../../scripts/import-inventory/inventory.ts)
- [scripts/import-inventory/run.ts](../../scripts/import-inventory/run.ts)
- [scripts/import-inventory/README.md](../../scripts/import-inventory/README.md)
- [tests/import-inventory.test.ts](../../tests/import-inventory.test.ts)

Die in diesem Bericht aufgeführten Inventur-Skripte, Tests, Entwürfe und der Ergebnisbericht sind die von diesem Auftrag neu angelegten Dateien. Bestehende Änderungen anderer Arbeitsstände wurden nicht angefasst.

## Prüfung

- `npm test`: 81 von 81 Tests bestanden.
- `npm run lint`: 0 Fehler; eine bereits vorhandene Warnung zu `DocumentVersionContract` in `src/lib/data-migration/migration.ts`.
- `npx tsc --noEmit --pretty false`: der Lauf endet an zwei bereits erzeugten `.next/dev/types/routes.d 2.ts`-Fehlern (`LayoutProps`/`RouteContext` doppelt). In den neuen Inventurdateien wurden keine TypeScript-Fehler gemeldet.
- `git diff --check` für die neuen Inventur- und Entwurfsdateien: sauber.

## Übergabegrenzen

Die Ergebnisse sind ein Prüf- und kein Ziel-Datenmodell. Eine gleiche Fallkennung, Prüfsumme oder Textprobe beweist keine fachliche Identität; gescannte und über der Textgrenze liegende PDFs bleiben teilweise ungeklärt. Die 792 PDF-Inventar-IDs ohne Metadatenzeile brauchen in einem späteren Auftrag eine explizite Zuordnung zu Quelle, Dokumentrolle und gegebenenfalls Fall-ID. Die 101 ID-Widersprüche benötigen eine fachliche Prüfung.

Für IMPORT-A wurden weder Portalzugriffe noch Uploads, bezahlte KI-Aufrufe oder externe Dokumente verwendet. Die nächste Importstufe kann die Inventur als Kandidatenliste nutzen, darf daraus aber keine automatische Zusammenführung oder neue Klassifizierung ableiten.

## IMPORT-B: lokaler gemeinsamer Klausurimport

Stand: 11.10.2026

Der beauftragte zweite Teilauftrag ist lokal umgesetzt. Ein aktives Mitglied kann unter `/konto/klausuren` zwei synthetische PDFs mit begrenzten Metadaten einreichen. Der Server prüft Sitzung, Origin, Dateityp, PDF-Struktur, Seitenzahl, Prüfsumme, Metadaten und Größenlimits. Danach übernimmt er den Datensatz ohne Inhaltsbestätigung direkt in den gemeinsamen `catalog_records`-Bestand. Ein zweites aktives Mitglied sieht denselben Eintrag über den gemeinsamen Katalog. Der bestehende Browserkatalog und die Originalsammlung wurden nicht automatisch migriert.

### Tatsächlich geänderte Dateien und Verträge

- `db/migrations/003_catalog_import.sql` ergänzt gemeinsame Katalogdokumente, Rollen, unveränderliche Dokumentversionen, Importbelege und Import-zu-Version-Zuordnungen. Die persönlichen DATA-B-Dokumenttabellen bleiben unverändert.
- `src/lib/server/catalog/import-service.ts` enthält technische PDF-/Metadatenprüfung, Fingerprint-/ID-Deduplizierung, direkte Übernahme, Versionsbildung, Konflikt- und Fehlerstatus, Wiederaufnahme eines liegengebliebenen `processing`-Belegs sowie aktive Objektprüfung.
- `src/lib/server/catalog/http.ts`, `src/app/api/catalog/import/route.ts` und `src/app/api/catalog/klausuren/route.ts` bilden die geschützten Multipart-, Status- und Katalogrouten. `src/lib/server/catalog/runtime.ts` bindet den vorhandenen AUTH-/PostgreSQL-/Privatspeicher an.
- `src/app/konto/klausuren/page.tsx` und `src/components/catalog-import-app.tsx` liefern die kleine lokale Upload-/Katalogansicht; der Browserstore und `/klausuren` bleiben unangetastet.
- `src/lib/server/auth/service.ts` und `src/lib/server/auth/runtime.ts` reichen den vorhandenen privaten Speicher in die Katalogintegration durch. `src/lib/server/persistence/backup.ts` sichert und restauriert persönliche und gemeinsame Versionen einschließlich Importstatus und Authdaten.
- `tests/catalog-import.test.ts` ist der echte Zwei-Mitglieder-/PostgreSQL-/Restore-Test. Die bestehenden PostgreSQL-/AUTH-Regressionstests berücksichtigen den jetzt dreiteiligen Migrationsstand und prüfen ihre Zeit-/Manipulationsgrenzen deterministisch.
- Die genaue Übergabe für PDF-01 steht in [IMPORT-B-SCHNITTSTELLEN.md](../entwuerfe/IMPORT-01/IMPORT-B-SCHNITTSTELLEN.md). Sie beschreibt `klausurId`, `documentId`, `documentVersionId`, Rolle, Quelle, Prüfsumme, Größe und Seitenzahl; Byte-Range-/Viewer-Endpunkte sind noch nicht implementiert.

### Abnahme und echte lokale Prüfungen

Der Test `tests/catalog-import.test.ts` verwendet eingebettetes PostgreSQL, einen lokalen HTTP-Server, zwei echte Better-Auth-Sitzungen und synthetische PDFs. Er prüft:

- A-Upload → direkte gemeinsame Übernahme → B-Katalogliste und Statusbeleg,
- identische Wiederholung ohne neue Version und widersprüchliche Wiederholung mit `409`,
- ergänzte Lösung als Version 2 und nachvollziehbare Rollen-/Prüfsummenverknüpfung,
- Wiederaufnahme eines liegengebliebenen `processing`-Belegs,
- sichtbaren ID-/Metadatenkonflikt ohne Überschreiben,
- anonyme Lesesperre, ungültige/zu große PDFs und einen Fehler vor dem Commit mit dauerhaftem `failed`-Status,
- konkurrierende Einreichungen ohne zusätzliche Version,
- PostgreSQL-Neustart sowie verschlüsselte vollständige DATA+AUTH-Sicherung und Wiederherstellung der gemeinsamen Originalbytes.

Der IMPORT-B-Test endet mit 8 von 8 Tests bestanden. Der vollständige lokale Testsatz endet mit 187 von 187 Tests bestanden. `npm run lint`, `npm run typecheck` und `git diff --check` sind fehlerfrei. `STEX_ISOLATED_DEV=1 npm run build` baut den Next-Stand erfolgreich; die neuen Katalogrouten erscheinen als dynamische Serverrouten. PostgreSQL und die lokalen HTTP-Tests benötigten wegen der Sandbox-Sperre für Listener die freigegebene lokale Ausführung.

## IMPORT-B-Nachprüfung: Koordinationsstand 9

Stand: 11.10.2026

Die drei offenen Nacharbeiten sind umgesetzt. Die Uploadgrenze wird jetzt vor dem Multipart-Parsing am tatsächlich gelesenen Request-Stream durchgesetzt. Fehlendes oder falsches `Content-Length` kann die 110-MiB-Grenze nicht umgehen; bei der ersten überschreitenden Chunkgrenze endet der Request mit `413`. Je PDF bleiben 50 MiB, das Metadaten-JSON ist auf 32 KiB begrenzt und das Multipart-Formular akzeptiert genau ein Feld je `requestId`, `metadata`, `sachverhalt` und `loesung`. Unbekannte, zusätzliche oder doppelte Text-/Dateifelder werden verworfen.

Die Oberfläche unter `/konto/klausuren` zeigt diese Grenzen vor dem Absenden. Bei einem unbekannten Ausgang bewahrt sie in `sessionStorage` nur eine kontogebundene Vorgangskennung, Metadaten und technische Dateifingerabdrücke auf. Nach dem erneuten Auswählen derselben PDFs wird dieselbe Vorgangskennung verwendet; eine Änderung von Metadaten oder Datei erzeugt eine neue Kennung. Der Status kann über `GET /api/catalog/import?requestId=…` besitzergebunden abgefragt werden. Ein bereits gespeicherter `committed`-Beleg bleibt nach einem anschließenden Katalog-Ladefehler erfolgreich und wird nicht als fehlgeschlagene Übernahme angezeigt. Die PDF-Bytes werden nicht im Browser gespeichert; beim Wechsel auf ein anderes Konto wird der lokale Entwurf verworfen.

### Geänderte Dateien

- `src/lib/catalog/limits.ts` bündelt die gemeinsamen Datei-, Request- und Metadatenlimits für Server und Oberfläche.
- `src/lib/server/catalog/http.ts` liest multipart-Anfragen begrenzt als Stream, prüft Feldanzahl/-namen und erstellt erst danach das `FormData`.
- `src/lib/server/catalog/import-service.ts` ergänzt den Besitzeranschluss über `requestId`; der bestehende dauerhafte `processing`-Beleg wird mit unverändertem Fingerabdruck fortgesetzt.
- `src/components/catalog-import-app.tsx` zeigt Uploadgrenzen, prüft sie vor dem Senden, speichert den Wiederaufnahmebeleg und behandelt Status-/Katalogabruf getrennt.
- `tests/catalog-import.test.ts` erweitert die echten lokalen PostgreSQL-/HTTP-Prüfungen um fehlende Längenangabe, zusätzliche und doppelte Felder, übergroße Metadaten, Streamüberschreitung, `requestId`-Status, pending/blocked/anonym/fremde Belege sowie Sperre nach dauerhaftem Beginn.
- `docs/entwuerfe/IMPORT-01/IMPORT-B-SCHNITTSTELLEN.md` dokumentiert die neuen Status-, Größen- und Bedienverträge.

### Tatsächlich durchgeführte Abnahme

Der erweiterte Importtest lief mit **11 von 11 Einträgen bestanden**. Er verwendete ausschließlich synthetische PDFs, echte lokale PostgreSQL-Tabellen, den echten lokalen HTTP-Server und echte Sitzungen. Zusätzlich wurde die Oberfläche in einem echten lokalen Browser mit zwei aktiven synthetischen Konten geprüft: A meldete sich an, wählte zwei synthetische PDFs aus und übernahm sie; B meldete sich in einem getrennten Browser-Tab an, lud `/konto/klausuren` neu und sah denselben Katalogeintrag mit beiden Dokumentrollen. Die synthetische Browser-Fixture, die Testkonten, der Testkatalogeintrag und die privaten Testbytes wurden anschließend wieder entfernt.

Die Prüfung umfasst damit auch den tatsächlichen Bedienweg für einen gespeicherten Statusbeleg; der HTTP-Test setzt einen liegengebliebenen `processing`-Beleg mit unverändertem Fingerabdruck fort und weist nach, dass dabei keine zweite Dokumentversion entsteht. Pending-, anonyme, gesperrte und fremde Sitzungen erhalten auf Katalog, Upload und Status keine fremden Daten. Eine Sperre nach dem dauerhaft gespeicherten Beginn lässt den Commit mit einem dauerhaften `failed`-Beleg enden und erzeugt keinen Katalogdatensatz.

### Grenzen

Die Browserabnahme konnte einen echten Netzwerkabbruch während der Antwort nicht reproduzieren; der Wiederaufnahmeweg ist über die sichtbare Status-/Fortsetzungsoberfläche und den echten serverseitigen `processing`-Test abgesichert. PDF-Dateien müssen nach einem Reload oder Tabverlust erneut ausgewählt werden, weil ihre Bytes absichtlich nicht im Browserspeicher liegen. Es gibt weiterhin keinen PDF-Viewer-, Byte-Range- oder Seitenrendering-Endpunkt, keine OCR-/Word-Konvertierung und keine automatische Migration des Browserkatalogs oder der Originalsammlung.

Der Abschlusslauf endete mit `npm test`: **190 von 190 Tests bestanden**, `npm run lint`: bestanden, `npm run typecheck`: bestanden und `STEX_ISOLATED_DEV=1 npm run build`: bestanden. Für Typprüfung und Build wurden nur die bereits vorhandenen, kollidierenden generierten Route-Typen aus parallelen `.next`-/`.next-qa`-Ausgaben vorübergehend aus dem Prüfpfad genommen; Anwendungscode und Konfiguration wurden dadurch nicht verändert. `git diff --check` und die Prüfung der neuen Dateien auf Leerraumfehler waren sauber.

Es gibt keine KI-/OCR-/manuelle Inhaltsfreigabe, keine Word-zu-PDF-Konvertierung, keinen vollständigen Viewer, keine öffentliche Datei-URL und keinen automatischen Import des Browserkatalogs oder der 2.753 inventarisierten Dateien. Ungültige Uploads werden vor dem Erzeugen eines Importbelegs abgewiesen; bereits angenommene Uploads besitzen einen dauerhaften Status und können nach einer Unterbrechung mit derselben Vorgangs-ID fortgesetzt werden. Verwaiste private Bytes bleiben außerhalb des Katalogs und werden nie über eine Route sichtbar; eine spätere Wartungsroutine kann ihre Bereinigung ergänzen.


## R37-LEGACY-COMBINED · 24.10.2026 · frischer IMPORT-01-Nachfolger

Enger lokaler Legacy-Anschluss tatsächlich implementiert: eine vorhandene kombinierte PDF an genau eine bereits explizit bestimmte/klassifizierte Katalog-ID, an Revision und vollständigen Payloadhash sowie erwartete Dokumentidentitäten/-versionen gebunden. Neue `POST/GET /api/catalog/legacy-import` mit aktivem Admin, frischer Anmeldung/TOTP, SameOrigin und harten Body-/Formulargrenzen. Vollständige requestId-/Plan-/Quellbindung im bestehenden Importbeleg. Keine Metadatenänderung oder IDerzeugung, kein Überschreiben/Versionsfortschreiben; erste kombinierte Version oder identische Wiederverwendung. Normaler Zweidokumentvertrag erhalten.

Geschrieben ausschließlich `src/lib/server/catalog/import-service.ts`, neue `src/lib/catalog/legacy-import-contract.ts`, neue `src/lib/server/catalog/legacy-import-http.ts`, neue `src/app/api/catalog/legacy-import/route.ts`, eigene `tests/r37-catalog-legacy.test.ts` und eigener Bericht/Nachtrag. `catalogRuntime()` wiederverwendet, Runtime-/Schema-/Backup-/UI-/Viewer-/Suchdateien nicht geändert. Vorhandener stark veränderter/unversionierter Arbeitsbaum erhalten.

Eigene neue Prüfung mit echtem lokalem PostgreSQL/privaten synthetischen PDFs/echten Admin- und TOTP-Sitzungen final **12/12 TAP-Einträge bestanden**; darunter genau ein Dokument/eine Version/ein bestehender Indexjob, Replay ohne Writes, Plan-/Hash-/Revisions-/Versionskonflikte, Rechteentzug und Metadatenänderung unmittelbar vor Commit, processing-Fortsetzung/Parallelität, Zugriffs-/Formular-/Streamgrenzen und erhaltener normaler Zweidokumentweg. Gezielte Typprüfung und Lint der betroffenen Dateien erfolgreich. Keine alten Suiten/Gesamtbuilds oder echte Upload-/Import-/Server-/Provideraktionen. Sandbox blockierte zunächst den lokalen Testlistener; die erlaubte lokale Ausführung bestand. Keine offene automatische Freigabeablehnung.

Exakte konsumierbare Exporte, Multipart-/JSONfelder, Hashbildung, Status-/Fortsetzungssemantik und Indextriggerzeitpunkt stehen in [R37-LEGACY-COMBINED](../entwuerfe/IMPORT-01/R37-LEGACY-COMBINED.md). Erste Version erzeugt per bestehendem SQLtrigger den Suchjob in derselben Transaktion; identische Wiederverwendung nicht. Kein gestarteter Worker oder echter Such-/Viewerabnahmebeleg. DATAs81Quell-IDkonflikte/drei fehlende JSONzuordnungen und tatsächliche Rollen-/Fassungsnachweise bleiben vorgelagert. **Writerende; keine laufenden Jobs.**


## R37-LEGACY-NEUTRAL · 24.10.2026

Sieben neutral zu erhaltende Altfälle lokal angeschlossen: vier unbekannte SR-Typen kanonisch fehlend mit unverändertem Rohtyp und genauer JSONprovenienz; zwei `eur`-Fälle/ein `steuer`-Fall mit unverändertem Gebiet und erlaubtem vorhandenem Aliaszieltyp. Keine neue juristische Zuordnung. Der ausdrückliche Legacy-Metadatenmodus `POST /api/catalog/metadata[/preview]?legacy=1` mit `action:"legacy-import"` bindet SourceJSONpfad/-hash/-index, Original-ID/-Gebiet/-Typ, endgültige Ziel-ID, SourcePDFhash/-größe/-fassung sowie Manifest-/Map-/Planfassung. Erst bestätigte Metadatenanlage, danach Combined-Import mit vollständigem Payloadhash/Revision und exakt gleicher Plan-/PDFbindung.

Normale Metadaten-/JSON-/Zweidokumentannahme nicht gelockert. Neue Lesetypen `CatalogArea/CatalogKlausur` begrenzen `eur/steuer` auf den Katalog; `Area`, Topic-/Privatentwurfskategorien bleiben erhalten. Originalmarkup bleibt bestehen; zusätzliche vorhandene Altgebiete erhalten neutrale Filter/Beschriftung/Statistik. Keine Umdeutung zum dritten Standardgebiet. Bindungsändernde normale PATCHs auf Legacyzeilen bleiben gesperrt. Kein zusätzliches Schema/Backup, kein weiterer gemeinsamer Pfad benötigt; store-Aliastabelle und OriginalJSONs unverändert.

Eigene neue Neutral-Testdatei: nativer PostgreSQL-/Admin-/TOTP-/PDF-/HTTP-/Markup-Lauf **16/16 TAP-Einträge bestanden**, danach ausschließlich neuer enger Umdeutungs-Policyfall **1/1 bestanden**. Typprüfung und Lint der betroffenen Module/Account-Anbindung sauber. Alte Combined-/B2-/Gesamtsuiten und Gesamtbuild nicht wiederholt. Keine echten Quellen-/Server-/Transfer-/Import-/Modellaktionen oder Kosten. Testbestände entfernt.

[Exakte Felder und Operatorübergabe](../entwuerfe/IMPORT-01/R37-LEGACY-NEUTRAL.md). Die bestehende DATA-V2-Map/der Planoperator weisen die sieben Fälle noch als Rest aus; vor tatsächlichem Import neue ausdrücklich angenommene Planfassung über diesen fertigen Vertrag bilden, keinen alten Blocker still übergehen. Echte Zielabfrage/18erRückweg/Import/Indexbelege bleiben getrennt. **Writerende; keine laufenden Jobs. Anschließend Paketierung, kein weiterer Produktumfang.**


## R37-IMPORTOPERATOR · 25.10.2026 · dritter Abschluss

Tatsächlicher separater, eigenständig mit Node22.13+ ausführbarer Zweiphasen-CLIoperator `scripts/data-migration/catalog-apply.mts` fertig. Ausschließlich neue Operator-/Test-/Berichtsdateien; unveränderliches Programmpaket, Produktservices, Schema/Backup und finaler449erCore/Vorlagen erhalten. Fester Core `dda48b8f5fed009f6a262e392aecb66841c9391d7e4ec5f03fe18c0f29f95d9d`, fünf Metadatenbatches und449PDFs; exakt454stabileUUIDs. Offlineinspect/prepare, ausdrücklich schreibendes apply-metadata, nach bestätigten Metadaten rein lesendes prepare-pdfs mit tatsächlichem vollen Payloadhash/Revision/Dokumentstand, ausdrücklich schreibendes apply-pdfs und private durable Wiederaufnahme.

Authentisierung nur über vorhandene reguläre Adminsitzung in privater0600/0400Datei oder geschütztem Descriptor≥3. Kein Secret als CLIargument/Log/Checkpoint, keine erfundene Admin-/TOTPbestätigung, kein Bootstrap oder SQLbypass. Tatsächlicher Konto-/Generation-/Sitzungskontext aus der API; frischer Admin-/Faktorvertrag über bestehende geschützte Legacy-Statusroute vor Schreibschritten und Service-Commit-Rechecks. Beleg vor Wiederholungsversuch zuerst abfragen, bestätigte POSTs nicht wiederholen. SourceJSON-/PDFbytes und Plan-/Map-/Manifest-/Quellfassung exakt gebunden; Konflikt, zusätzliche Dokumente, andere Payloadrevision, Sessionwiderruf/-ablauf/Faktorablauf, fremdeOrigin oder Redirect stoppen.

Eigene neue native Operatorprüfung **8/8 TAP-Einträge inklusive Rahmen** mit echten synthetischen PostgreSQL-/Dateicommit- und Admin-/TOTP-/HTTPabläufen bestanden. Nach ergänzter Prüfung späterer Änderungen an bereits bestätigten PDFs ausschließlich betroffenen Unterfall erneut bestanden (zwei Einträge inklusive Rahmen/sechs übersprungen); Wiederholung nicht addiert. Zwei isolierte neue Fälle (454Kennungen, sichere Crash-Lock-Wiederaufnahme) jeweils1/1 bestanden. Insgesamt neun verschiedene neue Fälle/zehnTAPeinträge inklusive Rahmen. Typprüfung und Lint nur der neuen Dateien sauber; alte12Combined-/17Neutral-/B2-/Gesamtsuiten und Gesamtbuild nicht wiederholt.

Gebundene echte449erVorlagen nur offline mit tatsächlichem eigenständigem CLI geprüft/vorbereitet:454eindeutigeIDs,0700/0600-Checkpoint, keine erfundenen PDFzielrevisionen. Temporären Offlinebeleg/Testbestände entfernt. Keine echte QuellJSON-/PDFlesung, reguläre Sitzungsauslese, Serververbindung, Dokumentübertragung, Import-/Releaseaktion, Mail oder KI/Kosten. Noch keine tatsächlicheOnline-/449erAbnahme.

Operator SHA256 `f3d5806a9f555f89fdb40936246e8d69c118104b427d7041b57efd129d896889`; neue Testdatei SHA256 `c34c863bc10e7672a227200303197704637d0cc74982b6a1be863a8faba3db39`. [Ausführbarer CLIvertrag, AUTHvoraussetzungen und konkrete HOST-Gates](../entwuerfe/IMPORT-01/R37-IMPORTOPERATOR.md). Die bestehende API liefert vollständige Payloads; kein zusätzlicher SQLlesepfad nötig. HOST muss physische Ziel-/Releasezuordnung, aktuelles18erBackup/echten separaten18erRückweg, ausgewähltes privates Quellpaket, regulären frischen Adminzugang und zwei tatsächliche phasengebundene Gates liefern. Hier kein produktiver Gate oder ausführender Betreiberauftrag erfunden.

**Writerende; keine laufenden Jobs. Nach diesem dritten größeren Abschluss vor weiterem Großauftrag frischen IMPORT-Nachfolger einsetzen.**
