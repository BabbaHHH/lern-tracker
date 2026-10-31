# HOST-B-L1: lesender Programm-Vorabcheck

Stand: 14.10.2026, Arbeitsrunde 22. Dieses Werkzeug liest einen **ausdrücklich gewählten Programmordner**, führt dessen Programm nicht aus und schreibt ausschließlich JSON nach stdout. Keine Datenbankverbindung, Umgebungsdatei, Schlüsselabfrage, Dokumentinventur, Installation, Netzanfrage, Migration, Sicherung, Wiederherstellung oder Serverstart.

Aus dem Appordner mit bereits installierter `tsx`-Laufzeit:

```sh
node --import tsx scripts/host/preflight.mts --root /absoluter/programmsnapshot
node --import tsx scripts/host/preflight.mts --root /absoluter/programmsnapshot --manifest
node --import tsx scripts/host/preflight.mts --help
```

Kein Standardziel und kein automatisches Laden von `.env.local`. Der aufrufende Operator darf stdout bei einem dafür freigegebenen Auftrag **außerhalb** des erfassten Programmordners in einen Bericht umleiten. Die Umleitung schreibt eine Datei; das CLI selbst legt weder Bericht noch Manifest oder Programmkopie an. In L1 wurde nur mit synthetischen Momentaufnahmen gearbeitet; kein Lauf gegen die Normalinstanz oder echte Daten.

## Bericht und Rückgabewerte

`format: stex-host-preflight`, `version: 1`. Der Bericht enthält relative erlaubte Programmdateinamen mit SHA-256/Bytegröße, öffentliche Paketversionen, Schemafolge, Backupformat, PDF.js-/Operatorartefakte, einzelne Prüfergebnisse, Aufnahmeidentität und **separate** offene Betriebsfreigaben. Absolute Programm-/private Speicherpfade, Quelltext, Manifestwerte unbekannter Felder, Umgebungs-/Geheimnis-/Dokumentinhalte und rohe Fehlermeldungen werden nicht ausgegeben.

| Exitcode | Bedeutung |
|---|---|
| 0 | Nur `--help`, keine Prüfung |
| 1 | Keine technisch fehlgeschlagene Prüfung; Manifestbindung fehlt noch oder passt. Betriebsfreigaben bleiben ausstehend. `technical` unterscheidet `incomplete` und `passed`. |
| 2 | Technischer Vorabfehler, etwa fehlende Datei, Migrationslücke, Versions-/Manifestkonflikt oder veränderter Zwischenstand |
| 3 | Ungültiger Aufruf, unsicheres/nicht lesbares Ziel oder nicht vollständig erfassbarer Dateistand; keine verlässliche Aufnahme ausgegeben |

**Kein Exitcode erteilt eine Release-/Onlinefreigabe.** `releaseReady` und `onlinePilotReady` bleiben immer `false`; `linuxVerified` ebenso. Der aktuelle Projektvertrag ist als `projectBasis` mit Stand 22 enthalten: übernommene Migrationen 001–007, Backupformat 4, 008 als bekannter, aber noch nicht abgenommener C3a-Stand. Eine passende 008-Datei kann technisch konsistent sein und bleibt dennoch im Gate `migration_008_acceptance` blockiert. Datei-Prüfsummen beweisen keine angewendete DBmigration oder neue Fachabnahme.

## Was tatsächlich gelesen wird

- Feste Konfiguration: `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, optional `postcss.config.mjs`.
- Code unter `src/` und `scripts/` mit TS/JS/CSS/SCSS/Shell-Endungen; unabhängig von Gittracking, somit auch veränderte/unversionierte Programmdateien. Keine `.env*`, versteckten/benannten privaten Ordner, Fixturebestände, allgemeinen JSON-/PDF-/Textdokumente. Auswahl ist **kein vollständiges Git-/Releasearchiv**; Tests/Dokumente/public-/sonstige Dateien werden nicht mitgezählt. Programmquellen müssen selbst geheimnisfrei gehalten werden.
- Genau `db/migrations/*.sql`, nicht `db/.local` oder andere DB-/Backupordner. Nummernlücken, doppelte Nummern, fehlende 001–007, unbekannte/umbenannte Nummern und unerwartete Einträge erhalten unterschiedliche Fehlercodes.
- Nur feste öffentliche Paketmetadaten für Next, PDF.js, tsx, pg, Better Auth, pdf-parse, canvas; `tsx/dist/loader.mjs`. Versionen müssen zur Lockdatei passen. Kein Modul wird importiert/ausgeführt; das beweist keine vollständige native Laufzeit.
- Browser-/Legacy-PDF.js-Bibliothek und Worker, Lizenz, `.bcmap`, `.pfb`/`.ttf`, `.wasm`. Header müssen dieselbe PDF.js-Version und Buildkennung zeigen. Die Dateien sind gehasht; ihre Ausführbarkeit oder Darstellung auf Zielgeräten ist nicht getestet.
- `.next/BUILD_ID`, `required-server-files.json`, `server/`, `static/` **nur als Datei-/Ordner-Metadaten**. Buildinhalte können eingebettete Betriebswerte enthalten und werden ausdrücklich nicht gelesen. `build.verifiedBuild=false`; Artefaktidentität ist kein vollständiger Hash aller kompilierten Next-Dateien.

Symbolische Verknüpfungen und Dateien mit mehreren Hardlinks werden nicht verfolgt/gelesen; erforderliche verknüpfte Artefakte führen zu Fehlern. Je Datei höchstens 16 MiB und höchstens 5.000 gelesene erlaubte Dateien. Rohliste und Codeinhalte werden nicht kopiert.

Die Erfassung läuft zweimal. Quell-/Bibliotheksprüfsummen, optionale Manifestbytes und Metadaten der Buildmarker müssen übereinstimmen; sonst werden beide Identitäten `null` und die Aufnahme scheitert. Das erkennt beobachtete gewöhnliche Änderungen in der gemeinsamen Kopie, ist **kein atomarer Snapshot oder Schutz gegen absichtliche zeitgleiche Verzeichnismanipulation**. Für spätere Releasebindung eine unabhängig gesicherte unveränderliche Programmkopie bereitstellen. Vorhandene Datei-/Bibliotheksidentität umfasst bewusst keine privaten Daten.

## Optionaler Programmvertrag

`--manifest` liest ausschließlich `host-program.json` im expliziten Ziel. Kein frei wählbarer Manifestpfad. Exakte Felder, keine Betriebsgeheimnisse:

| Feld | Erforderlicher Wert |
|---|---|
| `format`, `version` | `stex-host-program-manifest`, `1` |
| `programIdentity` | 64-stelliger SHA-256 aus `identity.program` einer passenden Aufnahme |
| `artifactIdentity` | 64-stelliger SHA-256 aus `identity.artifacts` |
| `migrations` | Exakt geordnete `migrations.files` mit relativen `path`, `sha256`, `bytes` |
| `backupFormat`, `pdfjsVersion` | Gelesene eindeutige Format-/Paketversion; aktuell Format 4 |
| `targetPlatform` | `linux`: nur Zieldeklaration, kein Abnahmebeleg |
| `privateFileRoot` | Absolute deklarierte Adresse außerhalb Programm/public; Bericht gibt nur Gültigkeit aus |

Die private Dateiwurzel wird nur lexikalisch verglichen, einschließlich angegebener/canonicaler Programmroot-Aliase; nicht betreten, auf Erreichbarkeit geprüft oder ausgegeben. Existenz, Rechte, freie Kapazität und richtige DB-/Dateizuordnung bleiben eigene spätere Prüfungen. Backupformat wird nur aus der bekannten `BackupContent`-Deklaration und numerischen Ausgabeversionen **statisch** erkannt; bei unklarer/veränderter Schreibweise Fehler statt erfundener Version. Kein Backupcode wird geladen. Manifestbindung ist ein Vergleich mit Operatorangaben, keine Signatur oder vertrauenswürdige Abnahme.

## Eigene isolierte Prüfungen

```sh
node --import tsx --test tests/host-preflight.test.ts
node node_modules/typescript/bin/tsc -p scripts/host/tsconfig.json
node node_modules/eslint/bin/eslint.js scripts/host/preflight.ts scripts/host/preflight.mts tests/host-preflight.test.ts --max-warnings 0
```

Die Tests erzeugen/entfernen nur eigene synthetische temporäre Programmordner, einschließlich erfundener privater Gegenbeispiele. Ein echter CLI-Unterprozess erhält ein leeres Umgebungsobjekt; keine DB, Listener, Programme aus Fixtures, Provider oder bestehenden DATA-/AUTH-/Appprüfungen. Die eigene Typkonfiguration sammelt nur dieses Werkzeug und seinen Test ein, `noEmit`, keine inkrementelle Ausgabe und keine gemeinsamen Next-Typcaches.

## Nächster separater Schritt

AUTH erhält später einen zugeordneten Produktions-/Mail-/Proxyauftrag; HOST anschließend tatsächliches Linuxrelease, Ressourcen-/Zielgeräte-/Offsite-Restoreprüfung. Aktuelles `accountRuntime()` schließt Produktion weiterhin im Quellguard; Suchworker und Operator hängen an dieser lokalen Laufzeit. Anbieter/Budget, echte Erstsammlung und weiterer persönlicher Lernanschluss sind keine durch L1 geprüften Freigaben. Buchung, Schlüssel-/Bestandszugriff, echte Mail/TLS und Veröffentlichung bleiben gesondert. Dieses CLI startet keine dieser Arbeiten.
