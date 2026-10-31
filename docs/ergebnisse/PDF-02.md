# Ergebnis PDF-02

## PDF-Vorbereitung – 11.10.2026

**Status:** Anforderungsklärung und Entwurf abgeschlossen. PDF-B und das gesamte Paket sind nicht implementiert oder abgenommen.

### Ausgangsstand

Projektstatus Koordinationsstand 10 vom 11.10.2026, TODO, CHAT_KOORDINATION, ARCHITEKTUR, ARBEITSSTART und PDF-02-Briefing gelesen. Git-HEAD: `539bf2db8862edea310d558c4fc4e7f83725201f`; zahlreiche vorhandene uncommittete Änderungen und neue Dateien gehören zum tatsächlichen Ausgangsstand. Vor dem Schreiben Dateiliste/Status geprüft; keine bestehenden PDF-02-Entwürfe oder Ergebnisdatei gefunden. Vorhandene Anwendungs- und Nutzeränderungen erhalten.

### Nutzerentscheidungen

- Keine Apple-Pencil-/Handschriftfunktionen im Einstieg.
- Persönliche farbige Textmarkierungen und automatisches Speichern/Wiederherstellen der Leseposition zuerst.
- Notizen an der angeklickten Stelle im PDF gewünscht, aber weniger wichtig; keine zwingende Bindung an eine Textauswahl.
- Laptop und iPad als Hauptgeräte, eventuell iPhone; Synchronisierung bei bestehender Internetverbindung reicht zunächst.
- Bestehende Vertagung von Downloadbeschränkungen/Seitenbildern bleibt gültig.

### Geänderte Dateien

Nur neu angelegt:

- `docs/entwuerfe/PDF-02/ANFORDERUNGEN.md`: bestätigte Anforderungen, vorgeschlagener Bedienweg, persönlicher Daten-/Koordinatenentwurf, geplante Abnahme und Anschlussfragen.
- `docs/ergebnisse/PDF-02.md`: dieser Bericht.

### Tatsächlich durchgeführte Prüfungen

Projektdateien und Git-/Dateistand lesend geprüft; erzeugte Dokumente auf Übereinstimmung mit Nutzerantworten, Umfang, Querverweisen und Unterscheidung zwischen Entscheidung/Entwurf/Abnahme kontrolliert. Keine Anwendungstests, Builds oder Geräteprüfungen ausgeführt. Die Abnahmematrix ist ein Plan, kein Testnachweis.

### Grenzen und Übergabe

DATA-B und AUTH-A laut aktuellem Projektstatus lokal geliefert; IMPORT-Abschluss und PDF-A vor Viewerintegration erforderlich. PDF-B benötigt den tatsächlichen gemeinsamen Seiten-/Versionsvertrag und ein exklusiv koordiniertes Integrationsfenster. Koordinatenumrechnung, Speicherintervalle und Revisionskonflikte dann verbindlich abgleichen. Neue Dokumentversionen übernehmen keine alten Markierungen automatisch.

PDF-A sollte Seitengeometrie und Textauswahl anschließbar bereitstellen; DATA/AUTH müssen später persönliche Anmerkungen/Positionen samt Zugriff und Restore aufnehmen. SEARCH öffnet Fundstellen vor der gespeicherten Leseposition; vorübergehende Suchauswahl wird nicht als Markierung gespeichert. Notizen dürfen den ersten Ausbau nicht verzögern. Keine weiteren grundlegenden Produktfragen für diese Teilstufe offen.

Zentrale Status-/Architekturdateien unverändert; Planungschat kann dieses Ergebnis lesend übernehmen. Keine anderen Chats angeschrieben, keine externen Uploads, bezahlten KI-Aufrufe, Migrationen oder Veröffentlichung.

## R38-PDF-ARBEIT-VERTRAG – 25.10.2026

**Status:** Präziser Integrationsvertrag für PDF-02 fertig; keine Laufzeitfunktion implementiert oder getestet. Die vorhandene 5-Downloads-pro-Berlin-Tag-Regel bleibt unverändert.

### Ausgangsstand und gelesene Anschlüsse

Aktuelle Kurzstände `docs/AUSBAUPLAN_2026-10-25.md`, `docs/PROJEKTSTATUS.md`, das PDF-02-Briefing und die bisherigen PDF-02-/PDF-01-/DATA-01-/AUTH-01-Ergebnisberichte gelesen. Zusätzlich nur eng relevante Quellen geprüft: `catalog-pdf-viewer.tsx`, `pdf-viewer/contract.ts`, `text.ts`, `geometry.ts`, `catalog-pdf/service.ts`/HTTP und Downloadservice, `auth/runtime.ts`/`auth/service.ts`, `data-migration/contract.ts`, `persistence/repository.ts`, `persistence/backup.ts`, `database.ts` und Migrationen 001/003/004/015/017. Keine neue Gesamtinventur oder private Nutzerdaten gelesen.

Wesentlicher Befund: Es gibt bereits `stex.annotations` samt `AnnotationContract` und `PersistenceRepository.saveAnnotation`, die aber per Fremdschlüssel an persönliche `stex.document_versions` gebunden sind. Katalog-PDFs liegen in getrennten `stex.catalog_document_versions`; die vorhandene Tabelle kann sie nicht speichern. Die Catalog-PDF-Service-/Viewerseite prüft bereits exaktes Identitätstripel, aktive Sitzung, Rangezugriff und Textauswahl. Die Geometrie ist bereits auf den unrotierten CropBox normierbar. Format-4-Vollsicherung ist tabellen-/spaltengebunden und nimmt neue Katalogpersonaltabellen nicht automatisch auf. Eine eigene persönliche PDF-Annotations-/Export-Route wurde im aktuellen API-Bestand nicht gefunden.

### Dateien

- Neu: `docs/entwuerfe/PDF-02/R38-PDF-ARBEIT-VERTRAG.md` – vorhandene Anschlüsse, Identitäts-/Text-/Positionsvertrag, API- und Größenbegrenzungen, Versions-/Geräteverhalten, Sicherung/Export, Umsetzungsschritte und konkrete neue Prüffälle.
- Ergänzt: `docs/ergebnisse/PDF-02.md` – dieser R38-Nachtrag.
- Keine weiteren Dateien geändert; insbesondere kein Produktcode, keine Migration, keine Backup-/Schema-/Layoutdatei und kein zentrales Architekturdokument.

### Umsetzungsvorschlag und Grenzen

Höchstens drei Schritte sind festgehalten: (1) DATA ergänzt additiv eine getrennte Katalogannotation-/Positionspersistenz und vollständige Sicherung/Restore-/Exportdeckung, ohne die private `annotations`-Tabelle umzudeuten; (2) PDF-02 baut eine geschützte Route und einen einseitigen synthetischen Vertikalschnitt für Textmarkierung plus Leseposition; (3) Ortsnotizen, mehrere Seiten, Konflikte und Zielgeräte folgen mit gezielter Abnahme. Das Datenmodell verwendet `documentVersionId`, `pageNumber`, exakte `PDF_TEXT_VERSION`-gebundene UTF-16-Textintervalle und serverseitige Kontoidentität. Keine automatische Übertragung auf neue PDF-Versionen.

### Tatsächliche Prüfung und Blocker

Nur lesender Abgleich der genannten Quelldateien und manueller Konsistenzcheck des geschriebenen Vertrags. **Keine Tests, Builds, Installationen, Schemaänderungen, Serveraktionen oder Geräteprüfungen**; die im Vertrag genannten Fälle sind künftige Annahmekriterien, keine bestandenen Tests.

Für die Dokumentvorbereitung bestand kein Blocker. Für spätere Produktintegration bestätigt der aktuelle Ausbauplan Paket 0 weiterhin als offen: Status am 25.10. war 0/5 Metadatenbatches, 0/449 PDFs und keine PDF-Bindungen; normale Adminanmeldung stand noch aus. DATA muss vor PDF-Code den Schema-/Sicherungsanschluss exklusiv zugeteilt bekommen. Für einzelne Dateien ist `page_count` optional; die Schreibroute muss unbekannte Seitenzahl geschlossen halten. Echtes iPad steht als Zielgeräteabnahme weiterhin aus.

Keine Nachrichten an andere Chats gesendet. Vertrag zur zentralen Prüfung/Zuordnung durch den Orchestrator übergeben; danach keine Implementierung durch PDF-02 in diesem Auftrag.

## PDF-DL1 – bewusste PDF-Downloads – 20.10.2026

**Status:** Der konkret beauftragte lokale Downloadumfang ist implementiert und gezielt geprüft. Die historische Vertagung oben ist hierfür durch Niklas' direkte neue Entscheidung ersetzt. Markierungen/Leseposition/PDF-B bleiben außerhalb dieses Auftrags; kein Deployment oder Serverzugriff.

### Ausgang und Umsetzung

Stand35, aktuelle Zentraldateien/CHATS.json, Runde35 einschließlich PDF-DL1, PDF-02-Briefing und beide AGENTS-Dateien gelesen. Ausgang ist die gemeinsame uncommittete/untracked Arbeitskopie (vom Planungschat mit167 Statuspfaden gebunden); eigene betroffene Dateien waren bereits untracked. Keine HEAD-Kopie/Worktree, kein Reset/Clean/Stash/Checkout; vorhandene Änderungen erhalten. Vor Codeänderung lokale Next16-Anleitung zu Routehandlers und Server-/Clientkomponenten gelesen. Ausschließlich gpt-6.1-sol für diese Arbeit, keine Astra-Variante oder weiteren Unteragenten eingesetzt.

Neuer sichtbarer Knopf „PDF herunterladen“, eigener Same-Origin-POST mit Sitzungsprüfung und sicherem Attachment-Namen. Höchstens fünf neue Downloadbefehle pro aktivem Konto und Berliner Kalendertag; dauerhafte atomare DB-Buchungen und einmaliger Verbrauch technischer Replays. Die bestehende zweiphasige Auth-/Identitätsprüfung und sperrfreie vollständige Datei-I/O bleiben erhalten. Lesen/HEAD/Beschreibung/Range/Seitenwechsel sowie persönliche Downloads/Notizen/Sicherungen zählen nicht. Keine sichtbare Zahl/Restanzeige; Limitmeldung blockiert den Viewer nicht.

Genauer Tages-/Fehler-/Replay- und Sicherungsvertrag: [PDF-DL1-VERTRAG.md](../entwuerfe/PDF-02/PDF-DL1-VERTRAG.md).

### Tatsächlich geänderte Produktdateien

- `src/components/catalog-pdf-viewer.tsx`: Schaltfläche, getrennte Fehlermeldung, Busy-Sperre und Wiederholungsschlüssel.
- `src/lib/pdf-viewer/contract.ts`: Downloadendpunkt-Konstante.
- `src/lib/server/catalog-pdf/service.ts`: optionale explizite Downloadbuchung erst nach erfolgreicher Datei-/finaler Auth-/Identitäts-/Antwortprüfung.
- Neue `src/lib/server/catalog-pdf/downloads.ts`: Berlin-Tag und kontogebundene idempotente Tagesplätze im finalen DB-Abschluss.
- Neue `src/lib/server/catalog-pdf/download-http.ts`: begrenzter POST-Vertrag und sicheres PDF-Attachment.
- Neue `src/app/api/catalog/pdf-download/route.ts`: bestehende Runtime-/Produktionsgates wiederverwenden.
- Neue `db/migrations/017_catalog_pdf_downloads.sql`: dauerhafte Quittungen mit FK, eindeutiger Konto-/Befehls-ID sowie fünf eindeutig belegbaren Tagesplätzen.
- `src/lib/server/persistence/backup.ts`: vollständiger fester Spaltenvertrag der neuen Tabelle in Format4, bestehende Restore-/Sitzungswiderrufssemantik erhalten.

`database.ts`, alte PDF-HTTP-/API-Routen, Migrationen001–016, Pakete/Lockfile, Layout/Konto und zentrale Dokumente unverändert. Weitere neue Dateien ausschließlich gezielte Tests (`catalog-pdf-download.test.ts`, `pdf-download-gate.test.ts`, optionaler `pdf-download-browser-probe.mts`), dieser Ergebnisnachtrag und PDF-DL1-Belege im eigenen Entwurfsordner.

### Tatsächliche Prüfungen

- **11 neue gezielte Tests bestanden:** echte isolierte PostgreSQL-Datenbank, reale künstliche PDF-Dateien, echte Sitzungen und Loopback-HTTP. 12 gleichzeitige neue Befehle aus zwei Sitzungen desselben Kontos ergeben exakt5 Erfolge/7Limitantworten; anderes Konto unabhängig. Acht parallele Replays kosten einen Platz; neue bewusste Befehle zählen erneut. Ungültige Identität/Request, fremde Origin, fehlende Anmeldung/Datei, manipulierte Bytes, Rechtewiderruf oder Identitätswechsel während gehaltenem Dateilesen buchen nichts. Antwortaufbaufehler rollt zurück; gestern belegte Plätze mindern den heutigen Tag nicht, alte UUID am neuen Tag wird abgewiesen. Exakte Berliner Mitternachten/Winter/Sommer sowie beide Zeitumstellungen per echter SQL-Zeitzonenrechnung geprüft. Format4-Restore erhält Quittungen und persönliche synthetische Notizen, weist fehlende Quotentabelle/gefülltes Ziel ab; nach echtem Clusterneustart und frischer Anmeldung bleibt heutige ausgeschöpfte Quote gesperrt. Neue Route bleibt im Produktionsmodus bei fehlender Betreiberfreigabe503.
- **19 bestehende unmittelbar betroffene PDF-A-R1-Tests bestanden:** unveränderte Viewer-/Range-/HEAD-/Beschreibungsrechte, Widerrufe, Generation/Identitätswechsel, fehlende/manipulierte/Symlinkdateien und freie DB-Schreibphase während Dateilesens. Kein alter Gesamt-/Lasttest wiederholt.
- **Gezielte TypeScriptprüfung der App plus neuen Tests/Hilfe und gezieltes ESLint: bestanden**, keine Diagnostik. Kein voller Build nötig/ausgeführt; echter Next16-Entwicklungsserver hat die betroffenen Konto-/PDF-Routen in isolierter erlaubter aktueller Quellkopie kompiliert.
- **Echte Browserprobe:** künstliches Konto angemeldet, bestehender Suchsprung auf Seite2 mit zweiter markierter Fundstelle korrekt gerendert; neuer Knopf ohne Quotenanzeige. Erster echter Download:1726 Bytes, bytegleich zum synthetischen Original. Zwei separate Klicks erzeugten zwei DB-Buchungen. Die übrigen drei Plätze wurden ausschließlich in der künstlichen Datenbank vorbelegt; nächster echter Klick zeigte Limittext ohne Zahl. Danach Seite3 weiter vollständig gerendert, DB-Zähler blieb5. Bild: [PDF-DL1-browser-limit.jpg](../entwuerfe/PDF-02/PDF-DL1-browser-limit.jpg). Das ist eine lokale Desktopbrowserprobe, keine iPad-/iPhone-/HTTPS-/Linuxabnahme.

Erste Versuche scheiterten an der Sandbox-Portgrenze; nach Freigabe ausschließlich lokaler Loopback-/Synthetikressourcen ausgeführt. Ein früher Test erwartete bei gesperrtem Konto irrtümlich403 statt des bestehenden401-Vertrags und blieb in einer abhängigen Gateprobe hängen; Test korrigiert, Deadline ergänzt, eigenen Prozess/Cluster gezielt beendet und Tempdaten bereinigt. Kein Produkt-Authfix daraus. Ein Typfehler der Test-Headerkonvertierung wurde ebenfalls korrigiert; alle abschließenden Prüfungen sind grün. Keine256MiB-Speicheruntergrenze oder bestehenden Schutzgrenzen abgesenkt.

### Grenzen und Übergabe

Migration017 und Quellen müssen vor späterem Release gezielt neu gebunden und auf dem freigegebenen Ziel ausdrücklich migriert werden. Format4 benötigt weiterhin exakten Schema-/Migrationsstand; fehlende Quotenbelege werden nicht als frisches Tageskontingent interpretiert. Alte001–016-Sicherung erst mit passendem alten Stand wiederherstellen, danach kontrolliert017 anwenden. Keine bisherige Produktionsgates freigegeben.

Keine privaten Unterlagen/echten Zugangsdaten gelesen, keine externen Uploads/Provider-/KI-/SMTP-/Serverkontakte oder Paketinstallation. Browserprüftab, künstlicher Next-/DBbetrieb, eigene temporäre Quellkopie und byteverifizierter künstlicher Download aus Downloads entfernt; Belege enthalten keine Testgeheimnisse. Die ursprüngliche Kopierschutzgrenze bleibt: bereits gelesene PDF-Bytes lassen sich grundsätzlich kopieren; die Quote gilt für neue explizite Downloadbefehle. Betriebssystem-/Browser-Speichern kann der Server nicht bestätigen; bei unklarem Transport ist derselbe Befehl am selben Tag ohne Doppelbuchung wiederholbar.

Nach Bericht gestoppt; Planung übernimmt lesend und führt keine Tests/Builds erneut aus.
