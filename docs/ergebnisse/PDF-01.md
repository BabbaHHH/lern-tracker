# PDF-01 – R37 kontinuierliches Scrollen, 26.10.2026

Der vorhandene PDF-Viewer zeigt jetzt alle physischen Seiten in einem vertikal fortlaufenden Lesebereich. Nutzer können durch das Dokument scrollen; Seitenfeld und URL-Seitenparameter folgen der Seite in der Mitte des Viewers. Die bisherigen Seitenknöpfe und der direkte Seitensprung bleiben verfügbar.

Platzhalter bewahren geschätzte Seitenmaße. PDF.js hält Canvas und Textebene nur für die aktuelle Seite und ihre direkten Nachbarn aktiv (höchstens drei Seiten). Suchziele bleiben an die konkrete PDF-Seite gebunden; beim Wegscrollen wird das Ziel aus der URL entfernt. Das Leeren eines Suchziels baut die Textebene nicht neu auf, sodass die native Textauswahl bedienbar bleibt. Zugriffsprüfung vor Seitenrender, Download, Text- und Geometrievertrag bleiben erhalten.

Geändert: `src/components/catalog-pdf-viewer.tsx`, `src/components/catalog-pdf-viewer.css`, neues `src/lib/pdf-viewer/scroll.ts`, neuer gezielter Test `tests/r37-pdf-scroll.test.ts`, dieser Bericht und [R37-Verhaltensnotiz](../entwuerfe/PDF-01/R37-KONTINUIERLICH-SCROLLEN.md).

Prüfung: der gezielte Scrolltest lief mit 3/3 bestandenen Tests (Renderfenster, Mittelpunktsseite und exakte physische Suchzielseite); ESLint für Viewer, Scrollhilfe und neuen Test lief ohne Meldungen. Keine Browserdarstellung oder echte Konto-/Dokumentprüfung, keine Serveraktion, kein Build und kein älterer Gesamttestlauf wurden ausgeführt. Die Umsetzung lief ausschließlich mit dem von Niklas vorgegebenen Sol.

PDF-Writerende.

# PDF-01 – PDF-A: integrierter, berechtigter Viewer

## R37-PDF-SERVER – Anschlussvertrag, 24.10.2026

**Vorhandener Viewer-/Datei-/Fundstellenanschluss ist für ein explizit zugeordnetes kombiniertes Katalogoriginal bereits korrekt vorhanden; keine Produktänderung nötig.** Katalogadapter und Suchtreffer erzeugen versionsgebundene Viewerlinks; der geschützte PDF-HTTP-Service löst nur die genaue gemeinsame Klausur-/Dokument-/Versionsbeziehung auf. Keine Rollenverdopplung, öffentlichen Dateipfade oder privaten Dokumentfallbacks. Bestehende Range-/Auth-/Download-/Textauswahlgrenzen und Originalmarkup erhalten. Der tatsächliche PDFhandler liegt in `server/catalog-pdf/http.ts`; der zugewiesene allgemeine `server/catalog/http.ts` benötigt keine Änderung.

[Konkreter R37-Anschlussvertrag](../entwuerfe/PDF-01/R37-SERVER-ANSCHLUSS.md) beschreibt IMPORT-/SEARCH-Schnittstellen, aktuelle Quellhashes und den fehlenden Zielbeleg nach echtem Import/Indexaufbau durch HOST. Offene Datenabhängigkeit: explizite Auflösung der 81 IDkonfliktgruppen und drei PDFs ohne JSON im von DATA benannten 449-PDF-/446-Metadatenbestand. Keine Klassifizierung oder ID still erfunden. HOST bleibt alleiniger Betreiber; R36-Datenzweig und neue Eingaben erhalten.

Tatsächliche Prüfung ausschließlich lesender Vertragsabgleich der aktuellen Quellen; **keine neuen automatisierten Tests, Builds, Vorschau-/Referenzserver, DB-/Serveraktionen oder echte Importe**. Keine neue Deltaimplementierung, deshalb keine Wiederholung alter R1-/UI-/Download-/Suchabnahmen. Alte Belege bleiben historischen Fassungen zugeordnet; kein echter R37-Such-/Online-/449er-Nachweis behauptet. Ausschließlich eigener Vertrag und Ergebnisnachtrag geschrieben. Kein weiterer gemeinsamer Pfad benötigt, keine anderen Chats angeschrieben. PDF-Writerende.


## R1-Sichtrest erfolgreich fortgesetzt – 17.10.2026, Runde 31

**Der konkret beauftragte lokale synthetische Sichtnachweis ist erbracht:** Die PDF wurde im normalen integrierten Viewer sichtbar auf Seite 2 von 3 bei 100 Prozent gerendert, einschließlich der vorübergehenden Auswahl des zweiten Suchausdrucks. Die Schaltfläche „Vorherige Seite“ wechselte URL, Seitenfeld, Text und Darstellung auf Seite 1. „Vergrößern“ änderte den Zoom auf 125 Prozent; Seite 1 wurde sichtbar entsprechend größer gerendert. Drei neue Bildbelege zeigen diese Zustände.

Die Fortsetzung verwendete nach dem unten dokumentierten Portfehler ausschließlich die reguläre `require_escalated`-Freigabe für die vorhandene synthetische Laufhilfe. Der Start wurde erlaubt. Eine frische vollständige Kopie des tatsächlichen uncommitteten Stands mit 429 Dateien einschließlich DATA-C5a wurde erstellt; keine fremden Änderungen ausgesondert und kein alter HEAD verwendet. Vorhandene localhost-Hilfe, künstliche Konten und künstliche PDF; Anmeldung über die normale Kontooberfläche. Keine Produktänderung, keine Wiederholung der 28 Servereinträge, Typ-/Lint-/Build- oder Gesamtläufe. Der aktuelle R1-Service, HTTP-Adapter, Viewer und die Laufhilfe stimmen nach SHA-256 zwischen Quellmanifest, isolierter Kopie und Arbeitsbaum überein. Die alten Serverbelege bleiben ihrer bisherigen Fassung zugeordnet.

Beim ersten Kontoabruf während der Entwicklungskompilierung erschien einmal HTTP 500 mit `Unexpected end of JSON input`; der folgende Abruf war 200. Anmeldung und alle beauftragten Vieweraktionen gelangen anschließend ohne Neustart oder Quelländerung. Der Fehler ist im eigenen Serverlog erhalten; daraus wird keine allgemeine Konto-/C5a-Abnahme abgeleitet.

Der ausschließlich eigene neue Prüftab 1 wurde vor dem Serverende erfolgreich geschlossen. Der eigene Dienst wurde über den regulären Freigabeweg beendet. Danach waren Helferprozess und beide lokalen Listener nicht mehr vorhanden; PostgreSQL hatte keine `postmaster.pid` mehr. Das nach SIGTERM/Exit 143 verbliebene eigene Laufzeitverzeichnis wurde anschließend zusammen mit der eigenen Quellkopie und temporären Info-/Logdatei entfernt. Alter blockierter PDF-Tab und DATA-Tab 9 wurden nicht bedient. Keine Schutzablehnung, externe Aktion oder Nachricht an andere Chats.

Belege: [aktuelles Quellmanifest](PDF-01/pdf-a-r1/sicht-source-20261017.json), [Ergebnis, Hashabgleich und Bereinigung](PDF-01/pdf-a-r1/sicht-result-20261017.json), [eigener Serverlog](PDF-01/pdf-a-r1/sicht-server-20261017.log), Bilder [Seite 2 / 100 %](PDF-01/pdf-a-r1/sicht-20261017-seite2-100.png), [Seite 1 / 100 %](PDF-01/pdf-a-r1/sicht-20261017-seite1-100.png) und [Seite 1 / 125 %](PDF-01/pdf-a-r1/sicht-20261017-seite1-125.png).

Nur eigener Bericht und eigene Belege ergänzt; sämtliche Produkt-/DATA-/Schema-/Sicherungs-/Konto-/Layout-/Paketdateien im gemeinsamen Checkout read-only. Der begrenzte Sichtrest ist abgeschlossen. Reale Safari/iPad/Touch-, Last-, Online- und allgemeine Integrationsabnahme bleiben offen; vollständiges Datei-I/O und Speicherbedarf je Range bleiben unverändert. Danach gestoppt.

## Historischer Startblock des einmaligen R1-Sichtrests – 16.10.2026, Runde 31, Nachfolgechat

**Der freigegebene frische lokale Startversuch wurde ausgeführt, aber bereits beim Öffnen des ersten lokalen Ports mit `listen EPERM: operation not permitted 127.0.0.1` verweigert. Der Sichtnachweis bleibt offen.** Kein PDF wurde geladen oder gerendert; Seitenwechsel, Zoom und Bildbelege konnten nicht entstehen. Die bestehenden 28 R1-Serverprüfungen und Typ-/Lint-/Buildbelege bleiben unverändert ihrer bisherigen Quellfassung zugeordnet und wurden nicht wiederholt.

Grundlage war die dokumentierte direkte Humanfreigabe „Ja, nur diesen lokalen Testlauf“ (Frage `call_950abde6aa894c5589e5681c33b2e12f`, Item 0), nach bestätigter alleiniger Besitzübertragung und Archivierung des Vorgängers. Der zuvor ungenutzte neue Versuch wurde genau einmal mit der bestehenden synthetischen Laufhilfe gestartet. Die aktuelle vollständige Quellkopie enthält 425 Dateien des tatsächlichen uncommitteten Arbeitsstands einschließlich des parallelen DATA-C5a-Zwischenstands; keine alte HEAD-/R1-Anfangskopie und keine ausgesonderten fremden Änderungen. Die vorhandene Kopierhilfe passt ausschließlich in der temporären Kopie die Typ-Includes auf deren eigene Ausgaben an und verknüpft die vorhandenen Abhängigkeiten; kein Gesamtbuild, keine Produktänderung, keine private Konfiguration kopiert.

Die Portverweigerung trat im ersten `port()`-Aufruf vor PostgreSQL-Initialisierung, Konto-/PDF-Erzeugung und Webserverstart auf. Der Prozess endete mit Code 1. Kein Browserwerkzeug wurde aufgerufen und kein neuer Tab angelegt; der alte blockierte PDF-Tab und DATA-Tab 9 blieben unangetastet. Gemäß Stopregel keine erneute Ausführung, Rechteeskalation oder Ersatzroute versucht. Dies war eine lokale Betriebssystem-/Sandbox-Portverweigerung, keine neue Browser-URL-Ablehnung und kein nachgewiesener DATA-C5a-Produktfehler.

Der Hashabgleich bestätigt die identische aktuelle R1-Service-/HTTP-, Viewer- und Laufhilfenfassung in Arbeitsbaum, Quellkopie und Manifest. Die ausschließlich eigene temporäre Quellkopie und das vor der Portanfrage angelegte, noch leere Laufzeitverzeichnis wurden entfernt; Laufzeit-Infodatei und Serverlog waren nicht entstanden. Kein eigener Server-/Datenbankprozess oder neuer Tab blieb zurück. Belege: [aktuelles Quellmanifest](PDF-01/pdf-a-r1/sicht-source-20261016.json), [Startblockade, Quellabgleich und Bereinigung](PDF-01/pdf-a-r1/sicht-block-20261016.json).

Geändert wurde nur dieser eigene Bericht; neu sind die beiden genannten Belegdateien. Alle Produkt-, DATA-, Schema-, Sicherungs-, Layout- und zentralen Koordinationsdateien blieben durch diesen Chat unverändert. Keine externen Aktionen oder Nachrichten an andere Chats. Erfolgreiches sichtbares Laden/Rendern samt Seiten-/Zoomaktion bleibt konkret offen; reale Safari/iPad/Touch-, Last- und Onlineabnahme bleiben ebenfalls offen. Nach Sicherung des Befunds und eigener Bereinigung gestoppt.

## PDF-A-R1 – 16.10.2026, Runde 29

**Serverkorrektur umgesetzt und gezielt geprüft; die beauftragte neue sichtbare Vieweröffnung bleibt wegen einer automatischen Browser-URL-Ablehnung offen. Keine vollständige R1-Abnahme behauptet.** PDF-A/Suchanschluss/Renderabbruchkorrektur bleiben erhalten. Der folgende Bericht vom 12.10. ist historisch; seine lange globale Lesesperre ist durch R1 ersetzt.

### Änderung und Berechtigungsgrenze

`CatalogPdfService.read` hat jetzt drei getrennte Phasen:

1. Eine kurze konsistente Read-only-Transaktion erfasst aktive Sitzung/Generation und die genaue gemeinsame Klausur–Dokument–Version samt Dateiidentität.
2. Ohne offene Datenbanktransaktion, gehaltene Verbindung oder globale Schreibsperre führt die **unveränderte** `PrivateFiles.read` die vollständige Pfad-/Symlink-, Größen- und SHA-Prüfung der gesamten Datei aus. Keine Integritätscache-Regel oder Range-Abkürzung.
3. Unmittelbar vor Antwortfreigabe folgt eine kurze Transaktion mit `lockState` vor `checkPrincipal(..., lock=true)`. Nutzer, interne Identität, Sitzung und Kontogeneration müssen weiterhin zur ersten Phase passen. Die aktuelle gemeinsame Objektbeziehung und vollständige Versions-/Dateiidentität werden erneut gelesen und verglichen. Die Antwort wird erst nach erfolgreichem Commit zurückgegeben.

Die interne Identitätsprobe umfasst Katalogschlüssel/-ID/-Art/-Revision, Dokument-ID/Zuordnung/Rolle/Herkunft/Ersteller/Erzeugungszeit und die unveränderlichen Versionsfelder einschließlich SHA, Gesamtgröße, Medientyp, Speicherkennung, Dateikopf, Dateiname, Einreicher, Import-ID und Erzeugungszeit mit PostgreSQL-Zeitpräzision. Gelöschte Beziehungen liefern 404, veränderte Identität 409, wirksam entzogene Sitzung/Freigabe 401/403. Keine alten Bytes werden bei solchen Änderungen ausgegeben. Eine Generationserhöhung wird auch dann abgewiesen, wenn jemand dieselbe Sessionzeile bereits auf die neue Generation gesetzt hat. Änderungen der globalen `stex.state`-Generation durch unabhängige Schreiber sperren nicht pauschal alle PDF-Leser.

Auch HEAD, Beschreibung und 416 passieren die abschließende Rechteprüfung, bevor Metadaten entstehen; sie lesen weiterhin keine Datei. GET/Range/If-Range/Conditional behalten ihre URLs, DTOs, Status-/Bodyregeln und private no-store-Behandlung. Der HTTP-Adapter wählt nur aus, ob der konkrete Abruf Bytes benötigt, und erstellt die Antwort nach der erneuten Prüfung synchron. Kein öffentliches Dateicaching, kein Rückgriff auf persönliche Dokumentversionen. `PrivateFiles`, Auth-/Katalogkern, Schema, Sicherung, Layout, Store, Viewer-/Suchverträge, Pakete und Produktionsroute wurden von R1 nicht geändert.

### Belegte Prüfungen

- **28/28 gezielte Testeinträge bestanden**: 18 neue Nebenläufigkeits-/Integritäts-/HTTP-Unterfälle plus Sammeltest und die vorhandenen neun PDF-Regressionseinträge. Kein 204er-Gesamtlauf, keine komplette AUTH-/IMPORT-/SEARCH-Abnahme. Echte isolierte PostgreSQL-Datenbanken, echte Better-Auth-Sitzungen, lokale HTTP-Anfragen und reale private Dateibytes.
- Im finalen kontrollierten Dateistillstand konnte der vorhandene unabhängige Kontonotizwriter bereits nach **21 ms** erfolgreich committen; die PDF-Dateiphase blieb **291 ms** zurückgehalten. Der Gate wurde erst nach dem bestätigten Writer geöffnet. Währenddessen **0 idle-in-transaction-Verbindungen**. Das belegt die Sperrgrenze, keine allgemeine Lastleistung. Der Notizwriter wird im isolierten vorhandenen Notiz-Testpfad verwendet, keine C4a-Schreibabnahme daraus ableiten.
- Kontosperre, Sessionlöschung, Kontogenerationswechsel, pending während If-Range, geänderte Dokumentzuordnung/-rolle, Versionslöschung und Austausch der Dateizuordnung unter derselben Versions-ID während I/O: Ausgabe verweigert. HEAD/Beschreibung/416 wurden zusätzlich gezielt an der finalen Writer-Sperre angehalten und nach wirksamer Sperre ohne Metadaten beantwortet.
- Erfolgreiches GET und geschlossene/Suffix-Range, If-Range-Fallback, Conditional ohne 304 sowie HEAD/Beschreibung/416 geprüft. Jeder tatsächliche Byteabruf prüft erneut die gesamte Datei. Eine erst nach erfolgreichem Range außerhalb des angeforderten Bereichs beschädigte Datei scheitert beim nächsten Range; außerdem fehlende, falsche Länge und Symlink-Dateien sowie Datenbankausfall nach erfolgreicher Dateiprüfung: 503 ohne PDF-Bytes/interne Pfade.
- Eigenes Lint und isolierte Typprüfung **aller eingefrorenen Anwendungsquellen plus eigener PDF-Tests/-Hilfen** bestanden. Strikter isolierter Produktionsbuild derselben Anwendungsquellen mit eingebauter Typprüfung bestanden. Keine Fehlerunterdrückung. Ein zusätzlicher lokaler Produktions-GET/HEAD einschließlich Range/Conditional bleibt 503/private no-store, ohne Content-Range und ohne HEAD-Body.
- Die Quellen wurden vor der Änderung als vollständiger tatsächlich uncommitteter Stand gesichert (`source-before.json`, 363 Dateien), nicht aus altem Git-HEAD rekonstruiert. Die finalen isolierten Build-/Browserkopien bestehen aus dieser unveränderten Anfangsbasis plus ausschließlich zugewiesenen PDF-Dateien. Die separaten Konfigurationen prüfen alle damaligen Produktionsquellen und eigene PDF-Prüfhilfen; unreferenzierte historische Fremdtests/-Werkzeuge sind nicht Bestandteil dieser begrenzten Typprüfung. `.mts`-Importe sind nur in der eigenen Prüfumgebung erlaubt; keine gemeinsamen Typdateien angepasst.
- Eine zusätzliche frühe Kopie des sich parallel ändernden gemeinsamen Baums scheiterte an fremden Zwischenständen (u. a. `account-learning-boundary.tsx`, Writing-Service und historische Helper-/Host-Testtypen). Diese Zwischenstände wurden weder repariert noch aus dieser Kopie entfernt; der fehlgeschlagene Versuch ist separat erhalten. **Kein Erfolgsnachweis für den finalen gemeinsamen C4a-Integrationsstand.** Der anfängliche eigene Versuch, dev/build in derselben temporären Kopie zu nutzen, wurde verworfen; die finalen Ausgaben sind getrennt.
- Eigene Produktionsdateien in Arbeitsbaum, isoliertem Test-/Build- und Browserstand stimmen nach SHA-256 überein. Zwölf relevante read-only Quellen einschließlich PrivateFiles/Auth/Katalogdienst/Produktionsroute/Viewer/Textvertrag/Paketen/gemeinsamer Konfiguration stimmen mit dem Anfangsstand überein. Belege unter `PDF-01/pdf-a-r1/`.

### Nicht bestandene/offene Sichtprüfung

Die erste synthetische Viewerprobe erreichte nur die Viewerhülle und scheiterte an einer unpassenden 127.0.0.1-/Next-localhost-Origin. Der **Testhelfer**, nicht die Anwendung, wurde auf konsistentes localhost korrigiert. Nach Neustart war der eigene Browser-Tab durch die beendete vorige Instanz auf einer automatisch erzeugten `data:`-Fehlerseite. Die Browser-URL-Schutzprüfung blockierte deshalb die Navigation zur korrigierten lokalen Instanz; auch das anschließende Schließen dieses eigenen Prüftabs wurde blockiert. Keine Umgehung durch anderen Browser, neue Tabs, Roh-CDP oder Seitenskripte, keine Verwendung alter C3b1-Zustimmung. Kein erfolgreich gerendertes R1-PDF oder neuer Bildnachweis behauptet. `browser-block.json` hält den Befund ohne die lange Fehlerseiten-Daten-URL fest.

Eine echte synthetische Vieweröffnung bleibt als ausdrückliche Restprüfung für einen neu freigegebenen getrennten Testlauf offen. Frühere PDF-A-Browserbilder sind kein R1-Nachweis. Kein echtes Dokument/normaler privater Browserbestand verwendet; keine Online-/Geräte-/Last-/Betriebsabnahme, Provideraufrufe oder externe Übertragung. Die eigenen Server-/Datenbankprozesse sind beendet, alle drei eigenen synthetischen Laufzeitordner und vier eigenen Quellkopien entfernt; Testports und gestoppte Cluster wurden vor der Bereinigung geprüft (`cleanup.json`). Der vom Werkzeug nicht schließbare temporäre Tab bleibt als separate Cleanup-Grenze dokumentiert.

### Eigene Dateien und verbleibende Grenze

Produktiv geändert: ausschließlich `src/lib/server/catalog-pdf/service.ts` und `src/lib/server/catalog-pdf/http.ts`. Die bestehende PDF-Route blieb unverändert. Neu: `tests/catalog-pdf-lock.test.ts`, `scripts/pdf-viewer/pdf-a-r1-fixture.ts`, `pdf-a-r1-browser.mts`, `pdf-a-r1-production.mts`, `pdf-a-r1-snapshot.py`, `pdf-a-r1-frozen.py`, `pdf-a-r1-tsconfig.json` sowie dieser Bericht und Belege. Keine Nachrichten an andere Chats oder zentralen Dateienänderungen.

**Die gesamte Originaldatei wird weiterhin pro Byte-/Rangeabruf gelesen, im Speicher gehalten und auf Größe/SHA geprüft.** R1 beseitigt die lange globale Datenbanksperre während dieses I/O, nicht die I/O-/Speichergrenze oder sämtliche Lastfragen. Eine erst nach der abschließenden Autorisierung wirksam werdende Sperre kann bereits freigegebene Antworten/übertragene Bytes nicht zurückrufen. Nach dieser begrenzten Nacharbeit kein weiterer Viewer-, Cache-, Streaming-, Hosting-, Markierungs-, Download- oder KI-Ausbau gestartet.

---

## Historischer PDF-A-Bericht


Stand: 12.10.2026. PDF-A ist implementiert und lokal geprüft. Eine reale iPad-/Safari-/Touchabnahme und die Online-Pilotfreigabe sind damit nicht erfolgt.

## Ausgangsstand und Umfang

PROJEKTSTATUS Stand 12, TODO, CHAT_KOORDINATION, ARCHITEKTUR, aktuelles PDF-01-Briefing, IMPORT-B-SCHNITTSTELLEN sowie SEARCH-01/PDF-02-Ergebnisse gelesen. Git-Ausgangspunkt `539bf2d` mit umfangreichen vorhandenen uncommitteten Änderungen; kein Worktree vom alten HEAD verwendet. Niklas hat den normalen PDF.js-Viewer bestätigt und Umsetzung, Prüfungen und Bericht freigegeben. Vorhandene Nutzer-/Projektänderungen erhalten.

Schreibbereich gegenüber ADMIN eingehalten: Authservice, AccountApp, Import-/Persistenzkern, DB-Migrationen und Adminansichten unverändert. Am bestehenden `catalog-import-app.tsx` nur die dokumentbezogenen Typfelder, Imports und Öffnungslinks ergänzt; Importablauf unverändert. Keine Paketinstallation, kein Update von PDF.js, keine Änderung an Paketdateien, Next-Konfiguration, gemeinsamem tsconfig oder generierten Typdateien. Installierte Next-Dokumentation zu Route Handlers, Client Components und getrennten Build-/Typausgaben vor Umsetzung gelesen.

## Geliefertes Verhalten

Unter `/konto/klausuren` lassen sich Sachverhalt und Lösung einschließlich ihrer unveränderlichen Version öffnen. `/konto/klausuren/pdf` zeigt eine PDF-Seite mit PDF.js 5.4.296, auswählbarer Textschicht, Vor-/Zurücknavigation, Seitenzahlfeld, direkter Seite im URL, Zoom von 50–300 %, Seitenbreite und zusätzlicher Drehung. Nur die aktuell sichtbare Seite wird gerendert; Canvasauflösung/Fläche sind begrenzt. Kleine Ansichten umbrechen die Steuerung; gezoomte Seiten können innerhalb des Lesebereichs gescrollt werden.

PDF.js wird als native lokale ESM-Bibliothek geladen. Das vermeidet den tatsächlich in der ersten Browserprobe gefundenen Webpack-Konflikt beim erneuten Bündeln der bereits gebündelten PDF.js-Datei. Kern und Worker stammen aus demselben installierten Paket und führen dessen Version im URL. Bibliotheksassets, CMaps, Standardschriften, WASM und Apache-2.0-Lizenz werden über eine enge Dateinamen-Allowlist aus `node_modules/pdfjs-dist` ausgeliefert. Dieser öffentliche Assetendpunkt enthält ausschließlich Bibliotheksdateien, niemals Dokumente. Keine CDN-Abhängigkeit oder externe Dokumentübertragung.

## Zugriff und HTTP-Vertrag

`GET /api/catalog/pdf?klausurId=…&documentId=…&documentVersionId=…` liefert berechtigte PDF-Bytes. `describe=1` liefert `contractVersion: 1`, `scope: catalog`, die drei IDs, Rolle, Titel, Dateiname, Version, Größe, Seitenzahl und Textstatus; keine internen Speicherpfade oder öffentlichen Datei-URLs.

Jeder GET/HEAD/Range sowie jeder Beschreibungsabruf prüft die aktive echte Sitzung. Innerhalb einer eigenen Transaktion folgen `lockState`, erneutes `checkPrincipal` und die exakte SQL-Beziehung Klausur → Dokument → Version. Die Sperrreihenfolge entspricht den vorhandenen Konto-Writern. Die Prüfung und das Lesen der unveränderlichen Originalbytes bleiben bis zum Ende dieser Transaktion zusammen. Eine vor dem Abruf abgeschlossene Kontosperre gilt sofort; eine zeitgleich gestartete Sperre wird hinter den bereits laufenden Abruf eingeordnet.

Gemeinsame PDFs sind für ein zweites aktives Mitglied lesbar. Es gibt ausdrücklich keinen Rückgriff auf die persönlichen `document_versions`, auch nicht für Admins oder den Besitzer. Reale persönliche Dateiversionen werden am Katalogendpunkt abgelehnt; deren vorhandene Besitzerbindung bleibt erhalten. Dieser Auftrag führt keinen zusätzlichen persönlichen Dateiendpunkt ein.

Antworten sind `private, no-store`; PDF-Bytes außerdem `max-age=0` und `Vary: Cookie`. Es werden keine ETags/Last-Modified-Validatoren angeboten. Bedingte Abrufe werden nach erneuter Rechteprüfung regulär beantwortet, niemals mit 304. Ohne passenden Validator fällt If-Range auf einen vollständigen berechtigten Abruf zurück. Einzelne geschlossene, offene und Suffix-Ranges liefern 206; ungültige/mehrteilige/unerfüllbare Ranges 416 erst nach Rechteprüfung. HEAD liefert keinen Body und ignoriert Range. Anonyme/pending/blocked Anfragen erhalten keine Dokumentgröße, Accept-Ranges oder Content-Range. Die unveränderte AUTH-Produktionssperre verhindert PDF-Zugriff in Produktion.

Der Viewer prüft vor jedem Seiten-/Zoom-/Rotationsrender zusätzlich die Beschreibung. Damit kann auch eine bereits im Browser gepufferte Seite nach Sperre nicht durch die nächste Vieweraktion erneut angezeigt werden. Bereits vorher übertragene Bytes können grundsätzlich nicht zurückgerufen werden.

## Anschluss für SEARCH-A und PDF-B

### Suchnavigation

`pdfViewerURL(identity, target)` aus `src/lib/pdf-viewer/contract.ts` erzeugt den integrierten Viewerlink. Identität immer vollständig übergeben: `klausurId`, `documentId`, `documentVersionId`. Ziel:

- `pageNumber`: tatsächliche PDF-Seite ab 1, im URL `page`.
- `quote`: Originalbeleg/Suchausdruck, optional `occurrence` ab 0, um mehrere Vorkommen zu unterscheiden.
- Alternativ/zusätzlich `start` inklusive und `end` exklusiv als UTF-16-Offsets mit `textVersion`.

Der exportierte `PDF_TEXT_VERSION` lautet derzeit `pdfjs-items-v1@5.4.296`. Der Seitentext wird aus `getTextContent()` aufgebaut: nur TextItems in Originalreihenfolge, jedes `str` unverändert, nach `hasEOL` ein `\n`, keine zusätzlichen Leerzeichen. `pageText()` liefert Text und die Intervallzuordnung zu den TextLayer-Spans. Offsets sind nur bei derselben Dokumentversion, Seite, Aufbauweise und PDF.js-Version gültig. Ein Bibliotheksupdate ändert die Textvertragsversion; alte numerische Offsets werden dann nicht still verwendet.

Bei mitgeliefertem Beleg muss dieser zum exakten Intervall passen. Sonst kann der Viewer den Beleg samt Vorkommensnummer erneut abgleichen. Dieser Abgleich ist unabhängig von Groß-/Kleinschreibung, normalisiert NFKC/Ligaturen, Leerraum und PDF-bedingte Trennungen am Zeilenende und führt die Position auf den Originaltext zurück. Eine DOM-Range erzeugt echte native Textauswahl und scrollt zur Fundstelle. Klick daneben entfernt die Auswahl; manuelle Auswahl ersetzt sie. Es wird nichts als Annotation gespeichert. Bei fehlendem/veraltetem/unzuverlässigem Bezug erscheint ein Hinweis statt einer behaupteten präzisen Auswahl.

Der Suchanschluss ist implementiert und im Browser mit dem zweiten Vorkommen sowie exakten Offsets geprüft. Die katalogweite Suchoberfläche/Indexierung gehört weiterhin zu SEARCH-A; sie ist durch diese Viewerintegration nicht implementiert. SEARCH muss seine Indexpositionen auf diesen Originaltext zurückführen oder Beleg plus eindeutiges Vorkommen liefern. Texte aus PDF-Annotationen/OCR oder anders aufgebautem `pdf-parse`-Text sind nicht automatisch passende TextLayer-Offsets.

### Seitengeometrie und spätere Markierungen

Nach erfolgreichem Render emittiert die Seite das bubbelnde DOM-Ereignis `stex-pdf-page-ready` mit `documentVersionId`, `pageNumber`, unverändertem `viewBox`/CropBox, gesamter Rotation aus PDF und Bedienung, Viewportbreite/-höhe, Scale und tatsächlicher PDF.js-Transformationsmatrix. Zusätzlich: Seitentext, Textvertragsversion, TextItems inklusive Transformationen und Textintervalle. Die Seitenregion besitzt `data-document-version-id`, `data-page-number` und `data-rotation`.

`geometry.ts` bietet `toViewport` und `fromViewport`. Normierte Positionen beziehen sich auf die ungedrehte CropBox mit Ursprung links oben, x/y in 0–1; die Matrix rechnet tatsächliche Rotation, Zoom und Verschiebung um. Dadurch bleiben spätere Markierungen an Dokumentversion und Seite gebunden. Keine automatische Übertragung auf neue Dateiversionen. In PDF-A gibt es keine Lesepositionsspeicherung; ein explizites Suchziel muss auch bei späterer Integration Vorrang vor einer gespeicherten Position behalten.

Keine gemeinsame Seitentabelle oder Annotationen in die bisher persönlichen DATA-Tabellen geschrieben. SEARCH/PDF-B müssen ihre spätere Persistenz im eigenen koordinierten Auftrag ergänzen. Dafür wurde der aktuelle Vertrag dokumentiert; kein Bedarf, den parallelen ADMIN-Schreibbereich jetzt zu ändern.

## Tatsächliche Prüfungen

- Neue PDF-Tests: **9/9 bestanden**. Echte temporäre PostgreSQL-Instanz und Better-Auth-Sitzungen, aktive A/B-Konten, pending, anonym, widersprüchliche IDs, reale persönliche Version mit weiterhin korrektem Besitzer, HEAD/Range/Conditional, Sperrwirkung, Originaltextpositionen und reversible Geometrie für vier Rotationsmatrizen.
- Vollständige Regression seriell: **204/204 bestanden**. Zunächst im parallelen Standardlauf 197 bestanden, fünf fehlgeschlagen und ein abgebrochen: bestehender Auth-Testlauf beim PostgreSQL-Neustart mit `terminating connection due to administrator command`. Isolierter Authlauf anschließend **26/26 bestanden**, danach vollständige serielle Läufe erfolgreich. Der Auth-/Persistenzkern wurde dazu nicht geändert. Abschließende Versionsbindung des Textvertrags zusätzlich durch aktuellen 9/9-PDF-Lauf und Browser geprüft.
- Vollständiges Lint: bestanden. Reguläre Typprüfung des gemeinsamen Checkouts an vorhandenen generierten Dubletten/verschachtelten Validatoren in `.next`/`.next-qa` gescheitert. Keine dieser Dateien verschoben, gelöscht oder umgeschrieben.
- Eigene Kopie des aktuellen Quellstands in `/tmp/stex-pdf-a-build`, ohne fremde generierte Ausgaben und ohne private Konfiguration: vollständige Typprüfung ohne inkrementelle Ausgabe und Produktionsbuild mit eingebauter Typprüfung bestanden. Eigene Include-Liste umfasst Anwendung, Tests, Skripte und frisch generierte Next-Typen. Keine Typfehlerunterdrückung. Der getrennte Build ist kein uneingeschränkter Nachweis für den weiterhin blockierten gemeinsamen Typzustand.
- Echte lokale Browserdarstellung in separater Next-/Datenbankinstanz: A aus Katalog Sachverhalt und Lösung geöffnet; Seite 1→2, 125-%-Zoom, gezielt Seite 3, ursprüngliche 90°-Rotation und zusätzliche Drehung, Reload mit direkter Seite. Zweites Treffer-Vorkommen ausgewählt, Klick daneben aufgehoben, mit Mausdrag `Paragraph 172 ZPO` manuell ausgewählt. Exakte Fundstellen-Offsets 129–167 auf Seite 2 zusätzlich geöffnet.
- B als eigenständiges aktives Mitglied: 120-seitige PDF mit rund 8,05 MiB geöffnet, Suchauswahl, Sprung auf Seite 120 und Reload. Tatsächliche 206-Abrufe im lokalen Next-Protokoll beobachtet. Nach B-Sperre verweigerte die nächste Seitenaktion den Zugriff; Canvas und TextLayer waren leer. Pending-Konto sah Freischaltungshinweis und keinen Dokumentinhalt.
- Responsive Browsergrößen: Desktop, 1024×1366 und 390×844. Schmale Ansicht ohne horizontalen Überlauf der ganzen Seite (390 px); PDF gezoomt innerhalb des Lesebereichs. **Dies sind Größenprüfungen mit Mausbedienung, keine echte Touch-/iPad-/Safari-Abnahme.** Das verfügbare Browserwerkzeug hat keine Touchgeräteemulation bereitgestellt. Touchtextauswahl, Safari-Kompatibilität und reale Zielgeräte bleiben vor Pilot zu prüfen.
- Produktionsbuild lokal auf getrenntem Port gestartet: GET und HEAD des PDF-Endpunkts einschließlich Range/Conditional erhielten **503**, private no-store, kein Content-Range und beim HEAD keinen Body. Betriebsöffnung nicht verändert.

Browserprüfung mit synthetischen Dateien/Konten, kein echter Bestandsimport, keine externen Uploads, bezahlten KI-Aufrufe oder Veröffentlichung. Browserprüfung und Build erfolgten mit Webpack; ein zusätzlicher Turbopack-Test ist nicht behauptet.

## Geänderte Dateien

Anwendung:

- `src/lib/server/catalog-pdf/service.ts`
- `src/lib/server/catalog-pdf/http.ts`
- `src/lib/pdf-viewer/contract.ts`
- `src/lib/pdf-viewer/text.ts`
- `src/lib/pdf-viewer/geometry.ts`
- `src/app/api/catalog/pdf/route.ts`
- `src/app/api/catalog/pdf-engine/[...asset]/route.ts`
- `src/app/konto/klausuren/pdf/page.tsx`
- `src/components/catalog-pdf-viewer.tsx`
- `src/components/catalog-pdf-viewer.css`
- `src/components/catalog-import-app.tsx` (nur Viewerlinks und dafür nötige Imports/Typfelder)

Prüfung/Bericht:

- `tests/pdf-a.test.ts`
- `scripts/pdf-a/fixtures.ts`
- `scripts/pdf-a/browser-runtime.mts`
- `scripts/pdf-a/block-test-account.mts`
- `docs/ergebnisse/PDF-01.md`
- `docs/ergebnisse/PDF-01/` mit synthetischen Browserbildern und Prüfprotokollen.

## Grenzen und Übergabe

SEARCH-A kann jetzt versionierte Fundstellen verlinken; die Suchoberfläche/Indexierung bleibt dessen eigener Umfang. PDF-B kann auf TextLayer, Seitenevent und Koordinatenumrechnung aufbauen; gespeicherte Markierungen, Leseposition und Ortsnotizen fehlen absichtlich noch. Word-Konvertierung, OCR, Seitenbilder, Downloadquoten und Bestandsmigration bleiben vertagt.

PrivateFiles prüft vor jeder Byteauslieferung die komplette Originaldatei auf Größe und Prüfsumme; auch ein kleiner Range-Abruf liest daher serverseitig zunächst die komplette Datei (Importlimit 50 MiB). Korrektheit ist lokal belegt, Last-/Mehrnutzerbetrieb und Optimierung der Sperrdauer sind vor Hosting zu messen. Bereitstellung muss die verwendeten PDF.js-Paketassets mitliefern; es wurde kein Hostingartefakt veröffentlicht. Abbilden normaler PDFs erlaubt technisch weiterhin das Speichern bereits übertragener Bytes; vollständiger Kopierschutz wird nicht zugesagt.

Kein zentrales Status-/Architekturdokument verändert und keine Nachrichten an andere Chats gesendet. Der Planungschat kann diesen Bericht lesend übernehmen. Zielgeräteprüfung, gemeinsamer generierter Typzustand und Betriebsabnahme bleiben ausdrücklich offen.

## Echte Klausurvorschau auf Nutzerwunsch – 12.10.2026

Niklas bat nach dem synthetischen Screenshot um eine echte Klausur im Viewer. Die vorhandene lokale PostgreSQL-Instanz wurde ohne Migration gestartet und nur lesend geprüft: **0 gemeinsame Klausuren und 0 Katalog-PDF-Versionen**. Der dauerhafte Erstimport ist somit weiterhin offen; die synthetischen Tests sind kein übernommener echter Bestand.

Für eine konkrete Ansicht wurde `kg-zr-70` aus dem vorhandenen Projektbestand gewählt: „Drittwiderspruchsklage: Sicherungseigentum vs. Vermieterpfandrecht“, Original `ZR 70 VRiinLG Paschke - Komplett.pdf`, **22 Seiten**. Originalbytes und vollständige ursprüngliche Metadaten/Klassifikation wurden in eine getrennte, temporäre lokale Vorschau kopiert; das einzige Dokument ist dort korrekt als `kombiniert` bezeichnet. Keine Änderung am dauerhaften Katalog, Original oder Browserbestand, keine Veröffentlichung/externe Übertragung. Die Vorschau verwendet dieselben geschützten PDF-A-Routen mit aktiver lokaler Testsitzung und bleibt für Niklas geöffnet. Abbildung: `PDF-01/echte-klausur.jpg`.

Die echte Datei zeigte bei raschem Renderabbruch während der noch laufenden Textauswertung einen unbehandelten `RenderingCancelledException`. In `catalog-pdf-viewer.tsx` wird die Render-Promise jetzt sofort beobachtet; die bestehende Fehlerbehandlung über Promise.all bleibt wirksam. Erneute echte Browserdarstellung, Seitenwechsel und schneller Zoomwechsel bestanden; Lint und die isolierte vollständige Typprüfung erneut bestanden. Der vorige Produktionsbuild und die 204er Regression wurden für diese kleine Client-Nacharbeit nicht erneut ausgeführt.

Der Versuch, das vorhandene Safari-Fenster für den Browserkatalog zu lesen, wurde von der automatischen Freigabeprüfung wegen möglicherweise sichtbarer, nicht auftragsbezogener privater Tabs abgelehnt. Dieser Zugriff wurde nicht weiterverfolgt; die gezeigte Datei stammt direkt aus dem autorisierten Projektordner.

## R37 – TypeScript-Korrektur nach Linux-Build · 26.10.2026

Der tatsächliche Linux-Produktionsbuild vom 26.10. meldete in `src/components/catalog-pdf-viewer.tsx` TS2304 für `engine` sowie TS18048 für die möglicherweise undefinierte `layer`. Der vorliegende Quelldateistand hatte den erwarteten SHA-256 `ee204be6e7485bb6ac4c712efdbfd5fab56f400ffc2670476e929e868dfd7b14`.

Die dynamisch geladene PDF.js-Engine wird jetzt als React-State gehalten und an `CatalogPdfPage` übergeben. Der Render-Effekt wartet auf eine verfügbare Engine. Eine lokale `textLayer`-Konstante wird für Rendern und Suchauswahl verwendet; die optionale Effektvariable bleibt nur für den Abbruch beim Cleanup. Der kontinuierliche Seitenstapel, physische Seiten-/URL-Zuordnung, Suchsprung und -auswahl, das Maximum von drei aktiven Seiten und der geschützte Reader-Ablauf wurden nicht anderweitig geändert.

Der finale gezielte ESLint-Lauf nur für `src/components/catalog-pdf-viewer.tsx` war erfolgreich. Frühere Scrolltests wurden nicht wiederholt. Kein lokaler Gesamtbuild, Typcheck, Browser- oder Serverlauf.

Ein-Datei-Overlay mit Manifest liegt unter `deploy/pilot/targets/contabo-test/import-r37-20261025/scroll-type-fix-20261026/`. Ersetzungsdatei `src/components/catalog-pdf-viewer.tsx`: alter SHA-256 `ee204be6e7485bb6ac4c712efdbfd5fab56f400ffc2670476e929e868dfd7b14` (22.458 Bytes); neuer SHA-256 `540087cc97ae1f50f0f479d7e695322d4ce6d83490095750d2d3a7fd17724810` (22.569 Bytes). Der kopierte Overlayinhalt wurde mechanisch mit dem lokalen Quellstand auf Bytegleichheit geprüft. Der nächste Linuxbau ist die ausstehende echte Typprüfung.
