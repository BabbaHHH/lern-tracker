# SEARCH-01: Anforderungen und Ergebnisse

## SEARCH-A1-Auftrag vom 30.10.2026 – Bestandsprüfung und gezielte Nachprüfung

DATA-C1 ist in `docs/ergebnisse/DATA-01.md` und `docs/entwuerfe/DATA-01/DATA-C1.md` ausdrücklich als lokal abgeschlossen dokumentiert. Der C1-Bericht hält Sicherungsformat 3, private Lernaktionsbelege und Sitzungsentwertung fest; die spätere Sicherungsweiterentwicklung ist davon getrennt. Die SEARCH-A1-Integration aus Koordinationsstand 14 war im aktuellen Dateistand bereits vollständig vorhanden: Migration 005, dauerhafte Jobs/Seiten, Kontosuche/API und PDF-Ziel mit versionsgebundenen UTF-16-Offsets. Daher waren in diesem Auftrag keine erneuten Produktcodeänderungen nötig.

Gezielt erneut ausgeführt wurde ausschließlich `tests/search-integration.test.ts`. Der erste Start scheiterte vor den Prüffällen an der Sandbox-Grenze für `127.0.0.1`; derselbe begrenzte Lauf wurde mit Loopback-Freigabe wiederholt. Ergebnis: **11 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Die A1-Fälle prüfen echte kurzlebige PostgreSQL-Instanzen und synthetische Konten: geschützte Treffer/Status, Prozessneustart und Wiederaufnahme, Text-/Normsuche samt Seitenzielen, Versionswechsel, Kontowechsel/Sperre, private Dokumente, 33-MiB-PDF sowie Restore mit Erhalt der C1-Belege, Sitzungswiderruf und Neuaufbau des abgeleiteten Suchindex.

Die Auswahlübergabe wurde am aktuellen Codepfad geprüft: Suchtreffer geben die PDF-Textversion und Fundstellenoffsets an den bestehenden Viewer weiter; dieser wählt den passenden Text-Layer-Bereich nativ aus und scrollt ihn ins Bild. Die bereits protokollierte synthetische Browserabnahme vom 13.10. zeigt Text-, Norm-, Mehrfach- und getrennte-Wort-Auswahl sowie das Aufheben der Auswahl. Sie wurde nicht erneut abgespielt, weil an UI und Viewer in diesem Auftrag nichts geändert wurde.

Keine Migration auf eine echte Nutzerdatenbank, kein Indexlauf auf dem echten Katalog, keine Build-/Gesamtabnahme und keine Geräte-/Lastprüfung. Betrieb setzt weiterhin Migration 005 und den getrennten Suchprozess voraus. Es gab keine Änderung an Produktdateien; dieser Nachtrag dokumentiert die gezielte A1-Nachprüfung und ihre Grenzen.

Vorheriger begrenzter Abschluss vom 24.10.2026: **R37-SEARCH-SERVER lokal implementiert, 9/9 neue instrumentierte Delta-Prüfungen sowie gezielte Typprüfung und Lint bestanden.** Endlich begrenzte Workeraufrufe, inhaltsfreier Betreiberstatus, vollständige Suche in begrenzten Leseblöcken und Suchanfragen ohne Suchwörter in normalen Request-URLs. Kein echter Import-/Index-/Server-/Browsernachweis; dieser bleibt HOST vorbehalten. Fertige Betriebsübergabe und Grenzen: [R37-SERVER-ANSCHLUSS](../entwuerfe/SEARCH-01/R37-SERVER-ANSCHLUSS.md). Ältere Abschlüsse unten bleiben historisch.

Neuester begrenzter Abschluss 18.10.2026: **SEARCH07-Betreiberanschluss gemäß Runde33 implementiert und ausschließlich synthetisch/instrumentiert geprüft (22 neue Testeinträge).** Worker-CLI verwendet den bestehenden Persistenzoperator statt öffentlicher Kontoruntime. Kein echter Worker-/DB-/Index-/Serverbetrieb oder Deployment; Dienstvorlagen und Produktionsöffnung bleiben blockiert. Einzelheiten im jüngsten Abschnitt unten.

Aktueller Stand 13.10.2026: **SEARCH-A0 und SEARCH-A1 lokal umgesetzt und abgegrenzt geprüft.** Echte gemeinsame Katalogsuche mit dauerhafter Indexierung und tatsächlicher PDF-Fundstellenauswahl synthetisch abgenommen. Keine echte Bestandsmigration, Zielgeräte-/Last-/Produktionsfreigabe. Historische Abschnitte unten behalten ihren damaligen Stand.

## Nutzerpräzisierung vom 11.10.2026: Fundstelle vorübergehend auswählen

Niklas wünscht für Text- und Normtreffer die Öffnung der passenden PDF-Seite mit einer vorübergehenden Hervorhebung wie bei einer Textauswahl mit der Maus. Beispiel: Die Suche nach „kaufmännisches Bestätigungsschreiben“ findet den Ausdruck unabhängig von Groß-/Kleinschreibung und zeigt beim Öffnen genau die gewählte Fundstelle an. Die Hervorhebung ist keine gespeicherte persönliche Annotation und verändert das PDF nicht.

Für den späteren SEARCH-A-/PDF-A-Anschluss berücksichtigen:

- Klausur, Dokumentrolle, Dokumentversion und PDF-Seite müssen zur gewählten Fundstelle gehören.
- Neben dem Originalbeleg eine auf den dargestellten PDF-Text rückführbare Trefferposition vorsehen; normalisierte Suchtexte allein liefern keine zuverlässige Auswahlposition.
- Groß-/Kleinschreibung sowie PDF-bedingte Zeilenumbrüche und Worttrennungen beim Abgleich berücksichtigen. Mehrere Vorkommen müssen unterscheidbar sein.
- Zur gewählten Fundstelle scrollen und sie vorübergehend wie eine Textauswahl anzeigen; Aufheben durch Klick an anderer Stelle oder Auswahl anderen Texts vorsehen. Echte Textauswahl im integrierten Viewer als Ziel, deren Verhalten auf Desktop und Touchgeräten noch zu prüfen ist.
- Fehlenden Seitentext/OCR-Bedarf offen anzeigen. Ohne verlässliche Textposition keine präzise Auswahl behaupten.

### Tatsächlicher Stand und Prüfung

Projektstatus (Koordinationsstand 9), Aufgabenbriefings SEARCH-01/PDF-01, zentrale Kontextdateien, Git-Status und vorhandenes Sachverhalt-Panel lesend geprüft. Geschützter integrierter Viewer und SEARCH-A sind laut aktuellem Stand noch ausstehend; IMPORT-Abschluss ist dem Viewer vorgeschaltet. Zahlreiche vorhandene uncommittete Änderungen wurden erhalten.

Diese Notiz hält den Nutzerwunsch für die spätere Umsetzung fest. Keine Anwendungscodeänderung, kein implementierter Such-/Auswahlablauf und keine Funktionsabnahme. Keine Tests, externen Uploads, KI-Aufrufe oder Nachrichten an andere Chats. Geändert wurde ausschließlich diese Ergebnisdatei; zentrale Architektur-/Statuspflege bleibt beim Planungschat.

## SEARCH-A0 umgesetzt – 12.10.2026

Niklas hat den neuen Auftrag „Jetzt parallel umsetzen: SEARCH-A0 – Stand 13“ einschließlich Umsetzung, Prüfungen und Bericht ausdrücklich freigegeben. Der Extraktions- und Suchkern ist implementiert. **Keine katalogweite Suchfunktion oder E2E-Auswahl aus der Suchoberfläche abgenommen; deren Anschluss folgt SEARCH-A1.**

### Ausgangsstand und Schreibbereiche

Lokales Repository `lern-tracker`, HEAD `539bf2db8862edea310d558c4fc4e7f83725201f` mit zahlreichen vorhandenen uncommitteten Änderungen. Maßgeblich war der tatsächliche lokale Dateistand mit PDF-A, AUTH-A und IMPORT-B, nicht HEAD allein. Projektstatus/TODO/Architektur/Koordination, ARBEITSSTART und eigenes Briefing gelesen. SEARCH-A0-Bereich war vor Beginn noch nicht angelegt; bestehende Nutzerpräzisierung oben erhalten.

PDF-A-Textvertrag und URL-Helfer unverändert wiederverwendet. Eingesehene Helfer am Abschluss: `text.ts` SHA-256 `2a276015cda009e59cf9a96e1c7530a47d64714e3fd6cc25a77c54d56f4c1724`, `contract.ts` SHA-256 `bc511698a2ef564590172fc552f7a4c5336c4dd0f598426a555acbcaffa6f3dc`. Diese Hashes dokumentieren den Prüfstand, keine globale Repositorybereinigung.

### Tatsächlich geändert/angelegt

- `src/lib/search/contract.ts`: versioniertes Seiten-/Manifestformat, Adaptervertrag, Treffer und Suchanfrage.
- `src/lib/search/normalize.ts`: rückführbare Suchnormalisierung mit UTF-16-Positionskarten.
- `src/lib/search/norms.ts`: Gesetz-/Paragraphnormalisierung, Originalbelege und explizite Normlisten.
- `src/lib/search/core.ts`: PDF-A-konformer Textaufbau, Phrasen-/Normsuche, Ausschnitte, Trefferzahlen, Textlücken und Viewerziele.
- `src/lib/server/search/extract.ts`: echte PDF.js-Extraktion mit Seitenportionen, Status, Wiederaufnahme, Hashprüfung, Abbruch und Größenfehlern ohne Trunkierung.
- `tests/search-core.test.ts`, `tests/search-extraction.test.ts`: 16 eigene Prüfungen.
- `scripts/search/fixtures.ts`, `memory-adapter.ts`, `demo.mts`, `tsconfig.json`: deterministische PDF-Fixtures, rein synthetischer JSON-Referenzadapter, reproduzierbare Demo und isolierte Typprüfung.
- `scripts/search/fixtures/combined-v1.pdf`, `combined-v2.pdf`, `other-law.pdf`, `index.json`, `results.json`: erzeugter synthetischer Bestand und prüfbare Ergebnisse. Keine privaten Quellen.
- `docs/entwuerfe/SEARCH-01/SEARCH-A0-SCHNITTSTELLEN.md`: implementierter Vertrag und konkrete A1-Übergabe.
- Diese Ergebnisdatei und eigene Prüfprotokolle unter `docs/ergebnisse/SEARCH-01/`.

Keine Änderung an DATA-C1/004, Migrationen, Sicherung, Paketen/Lockfile, Layout, Katalogansicht, Viewer, PDF-/Authrouten oder zentralen Projektdateien. Keine fremden generierten Dateien verschoben oder gelöscht. Keine echten Dokumente indexiert, Datenbank-/Browserkonten geändert, externen Uploads, bezahlten KI-Aufrufe oder Nachrichten an andere Chats.

### Verhalten und tatsächliche Prüfungen

**16/16 Tests, gezieltes Lint und isolierte Typprüfung bestanden, jeweils Exit 0.** Protokolle: [Tests](./SEARCH-01/search-tests.log), [Lint](./SEARCH-01/lint.log), [Typprüfung](./SEARCH-01/types.log), [Demo](./SEARCH-01/demo.log). Leere Lint-/Typprüfprotokolle entsprechen erfolgreicher Prüfung ohne Diagnosen. Kein vollständiger Appbuild, kein Gesamttestlauf, keine erneute gemeinsame Typ-/Geräte-/Sicherheitsabnahme behauptet.

Nachgewiesen:

- Groß-/Kleinschreibung, Zeilenumbruch und Worttrennung für „kaufmännisches Bestätigungsschreiben“; getrennte gleiche Vorkommen mit bewiesenen Originalintervallen und PDF-A-kompatiblen Links.
- Ligaturen, weiche Trennzeichen, Supplementärzeichen/UTF-16 und echte Bindestriche; gleiche Originalglyphen nach Normalisierung nicht mehrfach geliefert.
- § 172 ZPO getrennt von § 172 BGB, § 1720 ZPO, § 172a ZPO und ZPOx; Abkürzungsvarianten, Absatz-/Satzbeleg und explizite Listen. Die Treffer sind Erwähnungen, keine behaupteten Schwerpunkte.
- Originaltext exakt gleich dem regulären Viewer-Engine-Textaufbau, über alle drei Seiten des kombinierten synthetischen PDFs. PDF.js' Hinweis zum regulären Build in Node ist im Testprotokoll enthalten; produktive Extraktion verwendet den empfohlenen Legacy-Build.
- Kombinierte Rolle unverändert; leere Seite offen als fehlender Text/OCR-Bedarf gekennzeichnet, ohne OCR zu behaupten.
- Neue Dokumentversion mit eigenen Textpositionen; alte Version unverändert. Wiederaufbau erzeugt dieselben Seiteneinträge; Wiederaufnahme nach JSON-Adapterneuerzeugung und Ablehnung veralteter Revisionen geprüft. Dies ersetzt keinen PostgreSQL-/echten Prozessneustarttest.
- Tatsächlicher synthetischer PDF-Text auf Seite 101 und Textbeleg hinter 45.000 Originalzeichen erreichbar; keine Onboarding-Seiten-/Texttrunkierung.
- Beschädigtes PDF, Dateigrößen-/Seitentextgrenze, Hash-/Rollenkonflikt, vorab abgebrochener Auftrag, Eingabelimits, Trefferbegrenzung und veraltete Textversion geprüft. Zu große Seiten werden fehlerhaft ausgewiesen, nicht teilweise als vollständiger Index angeboten.

Die Demo wurde erfolgreich ausgeführt: drei Dokumentversionen, fünf Seiten, vier lesbare Seiten, eine Textlücke, drei Phrasentreffer und drei §-172-ZPO-Treffer. Alle fünf Seiten der drei erzeugten PDFs mit Poppler gerendert und visuell eingesehen: lesbarer Text, keine abgeschnittenen Zeilen; Seite 2 absichtlich gedreht, Seite 3 enthält nur eine graue Fläche. Poppler meldete nicht beschreibbare Fontconfig-Caches, erzeugte die geprüften Seitenbilder dennoch erfolgreich. Vorschauausgaben lagen nur unter `/private/tmp`.

### Grenzen und Übergabe

Der Kern arbeitet auf den vom Aufrufer bereitgestellten Seiten; **Rechte müssen in A1 vor Übergabe, Zählung und Ausschnitten geprüft werden**. A0 eröffnet keine Suchroute oder ungeschützten Katalogzugriff. Bereits vorhandene PDF-Berechtigungen wurden nicht verändert. Der Memory-Adapter ist eine Referenz, keine dauerhafte Produktionsspeicherung. Die Demo-IDs sind nicht in den echten Katalog importiert; ihre URLs zeigen den gültigen PDF-A-Vertrag, keine bereits online lesbaren Dokumente.

Standardportion acht Seiten (maximal 16), 32 MiB Originalbytes und 500.000 Seitentextzeichen. Fehlende/fehlgeschlagene/veraltete Seiten sind getrennt sichtbar. Noch nicht extrahierte Seiten werden im Manifest, nicht in der Such-Coverage der bereits bereitgestellten Seiten gezählt. Grenzen beschränken Portionen und behaltene Daten, keine harte PDF.js-CPU-/RAM-Grenze innerhalb einer Seite. Abkürzungen sind lexikalisch erkannt; kein Gesetzesregister, keine Bereichs-/Kontextauflösung, Absatz-/Satzfilter, OCR, Embeddings oder RAG.

SEARCH-A1 muss nach DATA-C1 PostgreSQL-Adapter/Indexmigration, geschützte Aufträge und API, erlaubte aktuelle Versionen, Fortschrittsanzeige und sichtbare Suche integrieren. Danach tatsächlichen Suchklick → richtige Seite/Textauswahl sowie Sperr-/Fremdzugriff und Zielgeräte prüfen. Gemeinsame PDF-Text-/URL-Helfer benötigen für A0 keine Änderung; DATA-C1s exklusiver Bereich wurde nicht berührt. Details und Reproduktionsbefehle im [Schnittstellenbericht](../entwuerfe/SEARCH-01/SEARCH-A0-SCHNITTSTELLEN.md).

## SEARCH-A1 umgesetzt – 13.10.2026, Koordinationsstand 14

### Voraussetzung und Ausgangsstand

Niklas hat SEARCH-A1 einschließlich erforderlicher gezielter Prüfungen beauftragt. **DATA-C1 zuerst geprüft:** `docs/ergebnisse/DATA-01.md` und `docs/entwuerfe/DATA-01/DATA-C1.md` dokumentieren den Abschluss vom 13.10., Sicherungsformat 3, private Lernaktionsbelege und Sitzungsentwertung. Damit war das Integrationsfenster frei; der noch ältere zentrale Status 14 beschreibt C1 weiterhin als in Abschlussarbeit. Konkreter aktueller C1-Bericht wurde vorrangig übernommen.

Tatsächlicher lokaler Ausgangsstand: HEAD weiterhin `539bf2d` mit zahlreichen vorbestehenden Änderungen einschließlich DATA-C1/PDF-A/A0. Migrationen 001–004 vorhanden; 005 frei. Status, TODO, Architektur, Koordination, eigenes Briefing, aktuelle Laufzeit-/Katalog-/Sicherungs-/Textverträge und Dateistand gelesen. Keine fremden Änderungen zurückgesetzt.

### Fertiges Ergebnis

- Dauerhafte PostgreSQL-Aufträge und Seiteneinträge in additiver Migration 005; Trigger erkennt neue gemeinsame Versionen im Katalogcommit. Aktuelle Versionen werden standardmäßig durchsucht, alte nicht mitgemischt.
- Begrenzter lokaler Prozess mit acht Seiten je Portion, gespeichertem Fortschritt, Prozess-/Verbindungsfreigabe der Session-Advisory-Sperre und Epoch-/Token-/Revisionsschutz gegen konkurrierende oder veraltete Veröffentlichung. PDF-Verarbeitung außerhalb globaler Transaktionen; Quelle/Version vor Commit erneut geprüft.
- Berechtigte Such-API und `/konto/klausuren/suche`, verknüpft aus Konto und Katalog. Status für ausstehende, textlose und fehlgeschlagene Seiten; Originalbelege/Rollen/Seiten, Erwähnung statt behauptetem Schwerpunkt. Keine persönlichen Dokumente, internen Pfade oder alten Versionen in Trefferzahlen/Ausschnitten.
- Tatsächlicher Klick im Browser öffnet PDF-A mit eindeutigen Originalpositionen. Erste getrennte Phrase, zweites gleiches Vorkommen und Normbeleg auf Seite 2 wurden **nativ ausgewählt**, nicht bloß als URL ausgegeben. Klick daneben entfernt die Auswahl. Kein Viewerumbau, keine gespeicherte Markierung.
- Suchindex ausdrücklich abgeleitet: Sicherungsformat 3 und private C1-Belege erhalten; Restore erzeugt frische wartende Aufträge und widerruft bestehende Sitzungen. Kein altes Seitenpayload oder laufender Jobtoken wird restauriert.

### Tatsächlich geänderte Dateien

Neu:

- `db/migrations/005_catalog_search.sql`.
- `src/lib/server/search/{store,worker,service,runtime,http}.ts`.
- `src/lib/search/{catalog-contract,client-boundary}.ts`.
- `src/app/api/catalog/search/route.ts`, `src/app/konto/klausuren/suche/page.tsx`, `src/components/catalog-search-app.tsx`.
- `scripts/search/{worker.mts,catalog-fixture.ts,qa-runtime.mts,qa-control.mts}` und `tests/search-integration.test.ts`.
- `docs/entwuerfe/SEARCH-01/SEARCH-A1-BETRIEB.md`, eigene Protokolle/Bilder unter `docs/ergebnisse/SEARCH-01/A1/`.

Kleine Anschlüsse:

- `src/components/catalog-import-app.tsx`, `src/components/account-app.tsx`: ausschließlich Suchnavigation.
- `src/lib/server/persistence/backup.ts`: abgeleitete Tabellen vor Restore leeren; Format 3/Originaltabellen/Lernbelege/Authwiderruf unverändert.
- `scripts/search/fixtures.ts`: optionaler unbenutzter PDF-Stream für die echte 33-MiB-Probe; vorhandene Fixtureausgabe bleibt bei Default identisch.
- `scripts/search/tsconfig.json`: Typprüfung der neuen Integrationsdateien.
- `tests/postgres-persistence.test.ts`: ausschließlich die durch 005 veraltete feste Migrationserwartung 4 durch Vergleich der tatsächlich vorhandenen Migrationsnamen ersetzt. Kein Fachverhalten geändert.
- Dieser Ergebnisbericht.

Keine Änderung an Migrationen 001–004, Lernlogik, Browserstore, AUTH-Kern/Produktionssperre, PDF-Viewer/-Routen, Paketen/Lockfile, `.env.example`, fremden generierten Dateien oder zentralen Architektur-/Statusdateien.

### Tatsächliche Prüfungen

| Prüfung | Ergebnis / Beleg |
|---|---|
| Suchtests, finaler Stand | **27 bestanden, 0 Fehler, 0 übersprungen**: bestehende 16 A0-Einträge und 11 A1-Einträge einschließlich der Sammlung, acht echten DB-Integrationsfällen, Clientgrenze und separater Größen-Guard-Unit. [Protokoll](./SEARCH-01/A1/search-tests.log). |
| Schemaanschluss | **19 DATA-B-Einträge bestanden.** Der beabsichtigte Schemafilter erfasste aufgrund der übergeordneten Testsammlung unbeabsichtigt die gesamte betroffene Datei. Dies wurde Niklas mitgeteilt; kein globaler Projekt-Gesamtlauf und keine weitere bestehende Reihe gestartet. [Tatsächlicher Lauf](./SEARCH-01/A1/schema-regression.log). |
| Gezieltes Lint, max. 0 Warnungen | Bestanden für Suchbereich, benannte Integrationsdateien, QA/Skripte und betroffenen Schema-Test. [Protokoll](./SEARCH-01/A1/lint.log). |
| Isolierte Quell-Typprüfung | Bestanden mit eigenem Suchprofil einschließlich neuer UI/API. Keine gemeinsame generierte Ausgabe bereinigt. [Protokoll](./SEARCH-01/A1/types.log). |
| Finaler Produktionsbuild | Bestanden in frischer wegwerfbarer Quellkopie, ohne `.env.local` oder echte Daten. Suchseite und API im Routenverzeichnis enthalten. Unveränderte Produktionssperre bleibt bestehen. [Protokoll](./SEARCH-01/A1/build.log). |
| Browserdurchstich | Tatsächliche Kontoseite → Suchseite → Viewer; Phrasen- und Normsuche, Mehrfachtreffer, Rolle kombiniert und OCR-Lücke. Siehe Bilder unten. |
| `git diff --check` | Bestanden für den beobachteten Stand; unversionierte neue Dateien zusätzlich mit Lint/Typprüfung/Build geprüft. |

Echte lokale PostgreSQL-/AUTH-/Katalogfälle belegen:

- Neue Versionen erhalten Aufträge im echten Katalogcommit. Ohne Index zunächst keine Treffer, Status ausstehend. Anonymes/noch nicht aktives/gesperrtes Konto erhält weder Trefferzahlen noch Indexstatus; Fremdursprung wird abgewiesen.
- Eine committed Seite bleibt nach echtem PostgreSQL-Prozessneustart erhalten; ein vorher beanspruchter `running`-Auftrag lässt sich wieder aufnehmen. Eine lebende Session-Advisory-Sperre verhindert doppelten Claim. Abbruch nach Claim und echtem Dateilesen hinterlässt wiederaufnehmbare Arbeit.
- Groß-/Kleinschreibung, mehrere Originalpositionen, § 172 ZPO gegenüber § 172 BGB, kombinierte Rolle ohne erfundene Seitenrollen, Rollenwechsel mit automatischem Neuaufbau und leere Seite.
- Neue aktuelle Version entfernt alte Treffer sofort, auch bevor ihr Index fertig ist. Nach Rebuild können alte Claim-Tokens nichts mehr veröffentlichen; aktuelle Version liefert ihre eigenen Offsets.
- Kontowechsel und Neuanmeldung desselben Kontos lehnen alte Suchkontexte ab. Separater Clienttest verwirft verspätete Antwortgenerationen; keine als Datenbankabnahme ausgegebenen simulierten Antworten.
- Tatsächliche private `document_versions` samt Originalbytes und private Dokumentdatensätze werden nie entdeckt/durchsucht. Text „Privates Geheimnis“ ergibt keinen Treffer.
- Echte synthetische **33-MiB-PDF** durch technischen Katalogimport, private Ablage und Worker verarbeitet. Eine separate Guard-Unit zeigt, dass Metadaten über 50 MiB vor Dateilesen abgewiesen werden; diese Unit ist keine echte DB-/Oversize-Uploadabnahme.
- Verschlüsselte Vollsicherung/Restore auf frische DB: private C1-Belege/37 % erhalten, alte Sitzung abgewiesen, keine alten Suchseiten oder laufenden Tokens, frische wartende Aufträge. Nach Verarbeitung wieder korrekter aktueller Treffer. Restore wurde in der realen Datenbank-/Serviceprüfung durchgeführt, nicht als zusätzlicher Browser-Restore behauptet.

### Tatsächliche Browserbelege

Die wegwerfbare lokale Website hatte ausschließlich synthetische A/B-Konten und synthetischen Katalog. Im Codex-In-App-Browser geprüft:

- [Suchergebnisse und Textlücke](./SEARCH-01/A1/suche.png): zwei Phrasentreffer unabhängig von Groß-/Kleinschreibung.
- [Zweites Vorkommen ausgewählt](./SEARCH-01/A1/auswahl-zweiter-treffer.png): tatsächliche Auswahl `KAUFMÄNNISCHES BESTÄTIGUNGSSCHREIBEN`, Seite 1, Offsets 98–134.
- [Getrenntes Wort ausgewählt](./SEARCH-01/A1/auswahl-getrenntes-wort.png): tatsächliche Auswahl `Kaufmän-\nnisches Bestätigungsschreiben`, Seite 1, Offsets 49–87. Ein Klick auf die Überschrift entfernte zuvor die native Auswahl vollständig.
- [Normsuche](./SEARCH-01/A1/normsuche.png) und [Auswahl auf Seite 2](./SEARCH-01/A1/auswahl-norm-seite2.png): drei §-172-ZPO-Treffer; tatsächliche Auswahl `§172 Abs. 1 Satz 2 ZPO`, Seite 2, Offsets 29–51. § 172 BGB erscheint lediglich im umliegenden Originalkontext, nicht als passender Treffer.
- [Offenes Konto nach Sperre](./SEARCH-01/A1/sperre.png): „Bitte neu anmelden“, keine Trefferlinks und kein Indexstatus mehr.
- [Nach Neuanmeldung als B](./SEARCH-01/A1/konto-b.png): zuerst leere Suche ohne alte Eingaben/Ergebnisse, anschließend neue erfolgreiche Suche. Keine unabhängige Browserprofil-/Zweitgeräteprüfung behauptet.

Temporäre Website, PostgreSQL-Cluster und Quellkopien sind beendet/entfernt; Testtab geschlossen. Keine tatsächlichen Browserdaten/Nutzerkonten oder private Konfiguration kopiert, keine externe Dokumentübertragung, bezahlten Aufrufe, Serverbuchung oder Nachrichten an andere Chats.

### Einrichtung, Grenzen und Übergabe

Start-/Wiederaufbaubefehle, Snapshot-/Revisionsvertrag, Sicherungsentscheidung und HOST-/PDF-02-Anschluss stehen im [Betriebsbericht](../entwuerfe/SEARCH-01/SEARCH-A1-BETRIEB.md). Installation benötigt Migration 005 und den lokalen Suchprozess; die echte laufende Nutzerinstanz wurde nicht automatisch migriert oder umgeschaltet. Ohne Prozess bleibt neue Arbeit sichtbar ausstehend. Codeabnahme ist keine Übernahme des echten Browserkatalogs.

Offen: echter ausgewählter Erstbestand samt PDF-Zuordnung, reale Safari/iPad/Touch-/Zweitgeräteprüfung, Last-/Speicher-/Zeitgrenzen und dauerhafter Prozessbetrieb vor Hosting. Die Suche lädt berechtigte Seiten derzeit für A0 in den Prozess; keine gemessene Kataloglast zusagen. Einzelne PDF.js-Seiten haben keine harte Prozess-RAM-/CPU-Grenze. Die bestehende vollständige PDF-Dateilesung unter globaler Sperre bleibt ein PDF/HOST-Thema. Keine OCR, semantische Suche/RAG, persönlichen Markierungen oder neue KI-Freigabe.

SEARCH-A1 ist damit innerhalb des lokalen beauftragten Umfangs abgeschlossen. Zentrale Fortschritts-/Architekturpflege bleibt beim Planungschat; weitere persönliche Lernbereiche, Hosting und PDF-02 erhalten ihre eigenen Aufträge.

## SEARCH07: enger Suchworker-Betreiberanschluss – 18.10.2026 / Runde33

### Gültiger Auftrag und Ausgangsstand

Ausgeführt wurde ausschließlich das neueste exakte Fenster `SEARCH07 — enger Suchworker-Betreiberanschluss 2026-10-18T04:30:50+02:00` in eigenem Briefing, `CHAT_KOORDINATION.md` und `ARBEITSRUNDE_33.md`, konkret durch Planung beauftragt. Projektstatus/TODO/Architektur und vorhandenen tatsächlichen Code lesend übernommen. Historische SEARCH-A0/A1-Aufträge wurden nicht erneut gestartet. Astra ausgeschlossen; kein Modell-/Provideraufruf oder Einstellungswechsel vorgenommen.

HEAD weiterhin `539bf2db8862edea310d558c4fc4e7f83725201f`; zahlreiche vorbestehende uncommittete Änderungen gehören zum Ausgangsstand. Die öffentliche Kontoruntime verweigert weiterhin die Produktionsöffnung. Der inzwischen vorhandene gemeinsame Operatorvertrag validiert Produktions-DB/TLS/privaten Dateipfad unabhängig davon. Der Suchprozess benötigt ausschließlich DB/PrivateFiles, keinen AccountService.

### Tatsächliche Änderung und Schreibbereich

- **`scripts/search/worker.mts`**: direkten `configuredPersistence`-Anschluss implementiert; keine `accountRuntime`-/AccountService-Abhängigkeit mehr. Defaultpfad reicht ausschließlich die erhaltenen DB-/PrivateFiles-Instanzen an die unveränderten Suchklassen weiter. CLI-Start ist importgeschützt; Start, Signale, Wartephase und Close sind getrennt instrumentierbar. Raw-Fehler/URLs/Schlüssel werden nicht ausgegeben.
- **Neu `scripts/search/worker-config.ts`**: reine Argument-/Modusvorprüfung mit read-only wiederverwendetem `productionOperatorConfig`. Exakt ein Argument `once`, `watch` oder `rebuild`; kein Default bei fehlenden/zusätzlichen Argumenten. Der Produktionsvertrag wird nicht dupliziert oder abgeschwächt.
- **Neu `tests/search-worker-config.test.ts`**: ausschließlich die neue Konfigurations-/Start-/Schließgrenze, ohne echte Ressourcen oder Workeraktionen.
- **Eigene Belege unter `docs/ergebnisse/SEARCH-01/SEARCH07/`**: eigenes enges Typprüfprofil, Test-/Typ-/Lintprotokolle, Ausgangs-/Endquellenhashes und Read-only-Vergleich. Dazu ausschließlich dieser Ergebnisbericht.

Keine Änderung an Produktionsoperator/`configuredPersistence`, öffentlicher Authruntime, Suchfachlogik, Schema/Migrationen, Backup, Paketen, Deploymentvorlagen oder anderen Produktdateien. Sechs übernommene Verträge/Quellen sind im [Read-only-Vergleich](./SEARCH-01/SEARCH07/readonly-vergleich.json) vor/nach identisch: `local-config.ts`, `production-operator-config.ts`, `production-config.ts`, `auth/runtime.ts`, `search/store.ts`, `search/worker.ts`. Die konkreten Ausgangs-/Endquellen stehen in [ausgang.sha256](./SEARCH-01/SEARCH07/ausgang.sha256) und [quellen.sha256](./SEARCH-01/SEARCH07/quellen.sha256).

### Erhaltenes Verhalten

`once` arbeitet vorhandene Portionen ab und beendet sich bei Leerlauf. `watch` wartet bei Leerlauf weiterhin abbrechbar zwei Sekunden. Nur das ausdrücklich übergebene Argument `rebuild` setzt beim ersten Discover den Rebuildparameter auf `true`, anschließend wird wie zuvor mit `false` fortgesetzt. Die bestehende Discover-/Versions-/Formatlogik selbst bleibt unverändert. Keine zusätzliche automatische Migration, Initialisierung, Schlüsselanlage oder vom Produktionsmodus abgeleitete Rebuildaktion.

Die CLI startet ausschließlich bei direkter Ausführung der Datei. Import ruft weder Persistenz noch Sucharbeit auf und installiert keine Signalhandler. `SIGINT`/`SIGTERM` lösen ein AbortSignal aus; nach Abbruch während Ressourcenaufnahme/Discovery wird keine weitere Arbeit begonnen. Nach Erfolg, Fehler oder Abbruch wird die erhaltene DB genau einmal geschlossen und die eigenen Signalhandler werden entfernt. Ein fehlgeschlagener Close bleibt auch nach Abbruch ein Fehler. Partieller Ressourcenbau folgt dem bestehenden Cleanupvertrag von `configuredPersistence`.

Lokale Passwort-/Pfad-/Portkonfiguration einschließlich expliziter Overrides bleibt beim gemeinsamen lokalen Operator. Produktion verwendet ausschließlich den bereits validierten Produktionsvertrag; weder URI-Optionen noch lokale Secretdateien oder TLS-Defaults ersetzen fehlende Produktionsangaben. Der vollständige Produktionsvertrag verlangt weiterhin seine vorhandenen Auth-/Mail-Konfigurationsfelder, obwohl der Worker keinen öffentlichen AccountService erzeugt.

### Tatsächlich ausgeführte neue Prüfungen

**22 neue Testeinträge bestanden, 0 fehlgeschlagen/übersprungen; gezieltes Lint mit null Warnungen und eng begrenzte Typprüfung jeweils Exit 0.** Keine alte SEARCH-/AUTH-/Persistenz-Gesamtabnahme, kein Build und kein Deploymenttest ausgeführt.

| Beleg | Umfang |
|---|---|
| [Tests](./SEARCH-01/SEARCH07/tests.log) | Alle drei Modi mit fiktiver vollständiger Produktionskonfiguration und exakt gemeinsamem DB/TLS/Dateivertrag; lokale Standard-/Overridekonfiguration und ausdrücklich erlaubter Loopbackvertrag. |
| Derselbe gezielte Test | Fehlendes/unbekanntes/zusätzliches Argument, unvollständige/widersprüchliche Produktionsmarker, fehlender Mailkey, lokaler Produktionsfallback, URI-TLS-Umgehung, unsicherer TLSwert und Dateipfad im Release: Ablehnung vor Ressourcen. Kein Produktionsrebuild ohne Argument `rebuild`. |
| Derselbe gezielte Test | Instrumentierte Teilbau-/Work-/Discover-/Step-/Pause-/Closefehler; genau ein Close und Signalabbau. Fehlerursachen werden durch feste Meldung ersetzt. |
| Derselbe gezielte Test | Instrumentiertes `SIGINT`/`SIGTERM`, Abbruch nach Ressourcenaufnahme und während beider Discoverphasen, Closefehler trotz Abbruch sowie echte lokale Timer-/Abortbereinigung ohne Wartezeit oder Hintergrundtimer. Es wurde kein Betriebssystemsignal an einen echten Dienst gesendet. |
| Derselbe gezielte Test | Inerter Import und reine Vorprüfung; unveränderte übergebene Umgebung; Quellabgleich der Defaultverknüpfung ohne Ausführung realer Ressourcenfabriken. |
| [Typen](./SEARCH-01/SEARCH07/types.log) / [Profil](./SEARCH-01/SEARCH07/tsconfig.json) | Nur Workerentry, reine Konfiguration und neuer Test samt erforderlichen importierten Verträgen. Keine breit eingesammelten fremden Testhilfen oder generierten Typdateien. Leeres Protokoll entspricht erfolgreicher Prüfung. |
| [Lint](./SEARCH-01/SEARCH07/lint.log) | Exakt `scripts/search/worker.mts`, `worker-config.ts` und `tests/search-worker-config.test.ts`; max. 0 Warnungen. Leeres Protokoll entspricht erfolgreicher Prüfung. |
| Quellprüfung | Sechs Read-only-Quellen unverändert, finale Quellenhashes gesichert; `git diff --check` bestanden. Neue unversionierte Dateien zusätzlich gezielt typ-/lintgeprüft. |

Die Ressourcenfabriken des bestehenden `configuredPersistence` wurden in diesen Prüfungen vollständig instrumentiert. DB-/Dateiinstanzen waren Testobjekte mit verbotenen Query-/Migrations-/Original-I/O-Funktionen; deren Aufrufzähler blieb null. Das sind ausdrücklich **keine echten DB-/Worker-/TLS-/Index- oder Produktionsabnahmen**. Tests verwendeten ausschließlich fiktive `.test`-Konfigurationswerte; keine echte Konfiguration, Secretdatei oder Originalsammlung wurde gelesen/kopiert. Quell-/Belegdateien sind die einzigen tatsächlichen Datei-I/O dieser Prüfung.

Reproduzierbare, ausschließlich neue Prüfungen aus dem Repository:

```sh
node --import tsx --test --test-reporter=spec tests/search-worker-config.test.ts
node node_modules/typescript/bin/tsc --project docs/ergebnisse/SEARCH-01/SEARCH07/tsconfig.json --noEmit
node node_modules/eslint/bin/eslint.js scripts/search/worker.mts scripts/search/worker-config.ts tests/search-worker-config.test.ts --max-warnings 0
```

### Grenzen, Bereinigung und Stop

Die neue Betreiberverknüpfung beseitigt nur die unnötige öffentliche AccountService-Abhängigkeit der Worker-CLI. **Öffentliche Produktion bleibt 503-gesperrt; Betriebsvorlagen bleiben blockiert.** Kein tatsächlicher Produktionsaufruf, Rebuild, Migrate, Schlüsselanlage, Index-/Originalzugriff, Netz, DB-/Worker-/Serverstart oder Umgebungswechsel fand statt. Die Befehlsformen `worker.mts once|watch|rebuild` bleiben im Code erhalten; reale Nutzung/Dienstinstallation ist durch diese synthetische Anschlussprüfung nicht freigegeben.

Keine neuen temporären Dienste, Datenbanken oder Originaldateien angelegt. Instrumentierte Signalregistrierungen/Warte-Timer sind nachweislich entfernt; Prüfprogramme beendet. Nur die eigenen Source-/Test-/Belegdateien bleiben. Keine fremden generierten Dateien bereinigt, keine Nachricht an andere Chats versendet. Keine Produktionsöffnung, Kauf-/Deployment- oder externe Aktion.

Die alte lokale SEARCH-Abnahme bleibt historisch bestehen und wurde hier nicht wiederholt. Echte DB-/Dateiverbindungen, Produktions-TLS, Prozessverwaltung/Neustart unter dem späteren Dienstkonto und Onlineprüfung müssen erst in einem separat freigegebenen Betriebsfenster erfolgen. Dieser begrenzte Auftrag ist abgeschlossen; danach gestoppt.


## R37-SEARCH-SERVER abgeschlossen · 24.10.2026

Ausschließlich konkrete Lücken des bestehenden Suchpfads geschlossen: endliche Workerportionen und reiner Status; begrenzter Seitentextspeicher bei vollständiger Suche über den berechtigten aktuellen Bestand; sichtbare Datei-/PDFfehler; POST-Suchkörper mit harter Grenze statt Suchwort in normalen Request-URLs. Importtrigger, PDF-A-Vertrag, Produktionsoperator und Rechte-/Versionsschutz wiederverwendet. Keine zweite Queue oder Migration.

**9/9 neue instrumentierte Tests, gezielte Typprüfung und Lint bestanden**, keine Gesamtabnahmen oder Builds wiederholt. Neuer Test belegt PDF-only-Treffer auf Seite17 hinter dem ersten Leseblock und vollständige380-Treffer-Zählung bei maximal100 ausgegebenen Treffern. Kein nativer PostgreSQL-/echter Import-/Browser-/Servernachweis; die neue SQLabfrage ist nur instrumentiert geprüft. Tatsächliche Serverindexierung und geöffnete vorübergehende Auswahl bleiben HOST-Abschlusskriterien.

Tatsächliche Dateien, neue Prüfbelege, endliche Start-/Statusbefehle, Rollen-/Datei-/Speichergrenzen und konkrete HOST-Übergabe stehen in [R37-SERVER-ANSCHLUSS](../entwuerfe/SEARCH-01/R37-SERVER-ANSCHLUSS.md). Ausgangs-/Endhashes und Read-only-Vergleich liegen im dortigen R37-belege-Verzeichnis. Keine Änderungen an fremdem Import/Viewer/Katalogseite, Schema/Backup/Paketen oder zentralen Projektdateien. Keine Originale gelesen, Sammlung indexiert, externen Uploads oder Modell-/Provider-/Serveraktionen. **Writerende für diesen begrenzten lokalen Auftrag.**


## R37-SEARCH-NATIVE-SQL abgeschlossen · 24.10.2026

Ein zusätzlicher nativer Integrationstest auf kurzlebigem lokalem PostgreSQL18 mit dem vorhandenen Schema18 bestanden (**1/1**). Er hat die neue echte `unnest`-/UUID-/Tupelcursor-Suchabfrage über drei Seitenblöcke ausgeführt: PDF-only Treffer auf Seiten9 und17, Gesamtzahl2, aktuelle kombinierte Version2 und passendes bestehendes Viewerziel. Keine Korrektur am Suchproduktcode nötig; lediglich ein überzähliger Parameter im synthetischen Fixture-INSERT wurde vor dem grünen Lauf entfernt. Keine weiteren Suiten/Builds ausgeführt. Datenbank und temporäre Testdaten wurden beim Testende bereinigt. Keine Produktions-/Serververbindung, kein echter Import und kein Browserviewer; letzterer bleibt HOST vorbehalten. Details und Protokoll: [R37-NATIVE-SQL](../entwuerfe/SEARCH-01/R37-NATIVE-SQL.md). **Writerende für den lokalen SEARCH-NATIVE-SQL-Auftrag.**
