# SEARCH-01: Volltextsuche und Klausur-RAG

## Verbindlicher Modellhinweis17.10.2026

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

**Aktueller Stand 15, 13.10.2026:** SEARCH-A0 und SEARCH-A1 sind am 13.10. lokal abgeschlossen; nachfolgende Auftragsabschnitte sind historisch. Einrichtung der echten Nutzerinstanz, Erstbestand und Betriebsabnahme bleiben offen.

## Ziel

Echte PDF-Inhalte pro Seite indexieren, Normverweise normalisieren und Volltexttreffer mit Seitenbeleg liefern. Beispiel: § 172 ZPO außerhalb des JSON. Danach hybride semantische Suche und optional belegte RAG-Antworten prüfen.

## Nächster Integrationsauftrag: SEARCH-A1 – Stand 14, 13.10.2026

**Voraussetzung:** DATA-C1 hat seinen Abschluss samt Sicherungsvertrag dokumentiert und bearbeitet die gemeinsamen Dateien nicht mehr. Bei Statuscheck noch aktiv; A1 ist vorbereitet, nicht gestartet oder versendet. Nach Niklas' Startauftrag aktuellen C1-Bericht und tatsächlichen Dateistand übernehmen. Modell: GPT-6.1 Sol · High · Standard.

**Ziel:** Im geschützten gemeinsamen Katalog nach Text oder Norm suchen und aus dem Treffer direkt die richtige PDF-Seite mit vorübergehend ausgewählter Fundstelle öffnen. A0 wiederverwenden; keine weitere isolierte Demo als Abschluss.

1. PostgreSQL-Adapter für A0-Manifeste/Seiten und dauerhafte Indexaufträge implementieren. Additive Migration nach 004 (005 nur, wenn weiterhin frei); bestehende Migrationen unverändert. Nur gemeinsame Katalogdokumente mit bestehenden IDs, Rollen und Versionen. Standardmäßig aktuelle Dokumentversionen durchsuchen; alte Versionen nicht still mitmischen.
2. Begrenzte Verarbeitung aus derselben Codebasis, mit gespeichertem Fortschritt, Wiederaufnahme und Schutz gegen doppelte Bearbeitung. Neue/geänderte Katalogversionen zuverlässig zur Indexierung erkennen, ohne Indexierung im Suchrequest oder langem Uploadrequest. PDF-Verarbeitung außerhalb langer globaler DB-Sperren; Transaktionen kurz, Rechte/Versionen vor Veröffentlichung erneut prüfen. Keine neue externe Queue. Größenlimits zwischen Import (50 MiB) und A0 (32 MiB Standard) ausdrücklich abstimmen; abgelehnte Dateien sichtbar erklären, Text nie abschneiden.
3. Berechtigte API und sichtbare Suche im Kontokatalog einschließlich Status für ausstehende/textlose/fehlgeschlagene Seiten. Rechte vor Trefferanzahl, Ausschnitten und Indexstatus; keine persönlichen Dokumente oder internen Pfade ausgeben. Indexstart/-wiederaufbau kein ungeschützter Endpunkt. Session-/Kontowechsel und Sperre beachten, keine alten Ergebnisse unter anderem Konto anzeigen.
4. Vorhandenen `pdfViewerURL`-/Textvertrag verwenden. Klick öffnet konkrete Version/Seite und eindeutige Fundstelle, auch bei mehreren gleichen Vorkommen; temporäre Auswahl bleibt keine persönliche Markierung. Kein Viewerumbau.
5. Suchindex als abgeleitete, wiederaufbaubare Daten behandeln. Aktuellen Sicherungsvertrag aus C1 erhalten, einschließlich privater Lernaktionsbelege und Sitzungswiderruf bei Restore. Eigene Tabellen/Aufträge konsistent sichern oder ausdrücklich wiederaufbauen; nach Restore keine veralteten Treffer oder verwaisten laufenden Aufträge. Entscheidung und konkreten Wiederaufbau dokumentieren.

**Schreibbereich nach C1 exklusiv:** eigene Suchmodule/API/Seite/Komponenten und Skripte/Tests, neue Suchmigration, erforderliche kleine Anschlussänderungen am Kontokatalog (`catalog-import-app.tsx`), Konto-Navigation (`account-app.tsx`) und Kataloglaufzeit sowie nötige Sicherungsintegration (`src/lib/server/persistence/backup.ts`). Nur falls für Suchprozess erforderlich `.env.example` ohne Geheimnisse ergänzen. Keine Änderung an Lernlogik, Browserstore, AUTH-Kern/Produktionssperre, Viewer-/PDF-Routen, Paketen oder fremden generierten Dateien. Zusätzlichen gemeinsamen Änderungsbedarf konkret dem Planungschat nennen; keine fremden Arbeiten zurücksetzen. DATA-C2, AI-KEYS und HOST greifen während dieses Fensters nicht parallel in diese gemeinsamen Bereiche ein.

**Abnahme im Aufgabenchat:** synthetische PDFs über echten Katalog/PostgreSQL → dauerhafte Indexierung → berechtigte Suche → tatsächliche Fundstellenauswahl im Browser. Text/Norm, gleichlautender Paragraph in anderem Gesetz, kombinierte PDF, mehrfacher Treffer, neue Version, Wiederaufnahme nach Abbruch/Neustart, unberechtigter/gesperrter Nutzer, Indexlücken und Restore prüfen. Erforderliche gezielte neue Prüfungen ausführen; vorhandene Abnahmen nicht pauschal wiederholen, Builds getrennt halten. Gerätelimits ehrlich ausweisen. Keine echte Browsermigration, Massenindexierung privater Sammlung, KI/OCR, bezahlten Aufrufe oder Serverbuchung.

Ergebnis unter `docs/ergebnisse/SEARCH-01.md` ergänzen: tatsächliche Dateien, Prüfungen, Start-/Wiederaufbaubefehl, Betriebsgrenzen und Übergabe für HOST sowie PDF-02. Nach C1-Fertigmeldung und konkretem Startauftrag ohne weitere Entwurfsrunde innerhalb dieses Umfangs umsetzen.

## Abgeschlossen: SEARCH-A0 (historischer Auftrag)

## Jetzt parallel umsetzen: SEARCH-A0 – Stand 13, 12.10.2026

PDF-A ist geliefert. Normaler PDF.js-Viewer, versionsgebundener Seitentext und `pdfViewerURL` stehen zur Verfügung. Nach Niklas' Startnachricht einen anschließbaren **Extraktions- und Suchkern** implementieren; keine weitere reine Entwurfsrunde. Modell: GPT-6.1 Sol · High · Standard.

Vollständigen PDF-Text pro Seite mit derselben PDF.js-Textaufbauweise wie `src/lib/pdf-viewer/text.ts` und `PDF_TEXT_VERSION` erzeugen. Keine Onboarding-Trunkierung. Originaltext, Suchnormalisierung und rückführbare Textpositionen auseinanderhalten. Text-/Phrasensuche ohne Groß-/Kleinschreibungsunterschied sowie Normensuche (Gesetz + Paragraph) liefern Treffer mit Klausur/Dokument/Version/Seite, Originalbeleg, eindeutiger Vorkommensnummer bzw. passenden UTF-16-Offsets und `textVersion`. Zeilenumbruch, Trennung, Ligaturen, mehrere Treffer und abweichende Gesetze berücksichtigen. Dokumentrollen aus Vertrag erhalten; bei kombiniertem Dokument keine Seitenrollen erfinden. Gescannte/leere Seiten ehrlich als fehlenden Text/OCR-Bedarf ausweisen, keine OCR oder KI ausführen.

**Abnahme:** reproduzierbarer kleiner synthetischer PDF-Bestand mit § 172 ZPO gegenüber § 172 BGB, Phrasensuche, getrennten Wörtern/mehreren Vorkommen, leerer Seite und neuer Dokumentversion. Funktionskern liefert `pdfViewerURL`-kompatible Ziele; End-to-End-Anschluss in die echte Suchseite folgt SEARCH-A1. Tests belegen Kernverhalten, keine bereits vorhandene katalogweite Suchfunktion behaupten. Wiederaufbaubares Indexdatenformat mit Extraktionsstatus und begrenzten Verarbeitungsportionen konkret im Code abbilden; Persistenzadapter zunächst über Schnittstelle.

**Exklusiver Schreibbereich:** neue `src/lib/search/` und `src/lib/server/search/`-Module, eigene `tests/search-*.test.ts`, `scripts/search/` mit synthetischen Fixtures sowie eigene Entwurfs-/Ergebnisdateien. Vorhandene PDF-Text-/URL-Helfer verwenden, nicht verändern. Keine Datenbankmigration, Backup-/Paket-/Layout-/Katalog-/PDF-/Authänderung, keine öffentliche Suchroute und keine echte Sammlung indexieren. DATA-C1 besitzt 004 sowie Sicherung/Layout exklusiv. Keine fremden generierten Dateien bereinigen. Eigene notwendige Prüfungen ausführen; aktuelle Schnittstellen/Dateien und tatsächlich offene SEARCH-A1-Integration dokumentieren.

SEARCH-A1 erhält nach DATA-C1 den Integrationsauftrag: PostgreSQL-Persistenz/Indexzustand, berechtigte API und sichtbare Suche mit Treffern im Viewer. Rechteprüfung erfolgt dann vor Trefferzahlen/Ausschnitten; A0 eröffnet keinen ungeschützten Datenzugriff. Dieser vorbereitete Auftrag wurde vom Planungschat nicht versendet.

## Nächster Arbeitsauftrag – Stand 10.10.2026

**Danach: SEARCH-A – Volltext- und Normensuche ohne KI-Aufruf**

Dieser Auftrag ist zur Besprechung und anschließenden Beauftragung durch Niklas vorbereitet; er wurde noch nicht an den Chat gesendet oder gestartet. Der frühere Einrichtungsauftrag ist abgeschlossen. Vor Beginn [ARBEITSSTART.md](../ARBEITSSTART.md), aktuelle zentrale Dateien und den tatsächlichen Dateistand lesen. Hat Niklas diesen abgegrenzten Auftrag bestätigt, innerhalb des Umfangs selbstständig fertigarbeiten; nicht für jeden Einzelschritt erneut fragen.

**Voraussetzungen / letzte Fragen:** DATA-B, AUTH-A und IMPORT-B mit Dokumentversionen; Fundstellenverknüpfung mit PDF-A abstimmen.

**Arbeitsumfang:** Vollständigen Text pro PDF-Seite indexieren, Normverweise mit Gesetz/Paragraph normalisieren und Text-/Normtreffer kombinieren. Extraktions- und Indexstatus sichtbar machen; gescannte/leere Seiten als OCR-Bedarf kennzeichnen. Treffer mit Klausur, Rolle, Version, Seite und Originalbeleg ausgeben. Noch keine Embeddings oder RAG einführen.

**Schreibbereich und Zusammenarbeit:** Neue Such-/Indexmodule; Klausuransicht erst in exklusivem Integrationsschritt nach IMPORT. Keine zweite Dokumentextraktion mit abweichenden IDs aufbauen.

**Fertig, wenn:** Geprüfte positive/negative Suchfälle: § 172 ZPO außerhalb der Tags, § 172 BGB als negativer Vergleich, kombinierte PDF, neue Version und nicht berechtigtes Dokument. Auch Trefferzahl und Ausschnitt dürfen keine fremden Daten preisgeben.

**Übergabe / nächster Schritt:** Suche ist mit offen ausgewiesenen Textlücken nutzbar. OCR und semantische Erweiterung erhalten später eigene begrenzte Aufträge.

Ergebnis unter `docs/ergebnisse/SEARCH-01.md` mit Abschnitt für diese Teilstufe festhalten: Ausgangsstand, tatsächlich geänderte Dateien, durchgeführte Prüfungen, offene Punkte und belastbare Übergabe. Ein fertiger Teilauftrag bedeutet nicht, dass das gesamte Paket abgeschlossen ist. Gemeinsame Architektur-/Statusdateien pflegt der Planungschat. Zusätzliche gemeinsame Dateiänderungen zuerst dort zuordnen lassen; unabhängige Arbeit fortsetzen.

## Gemeinsamer Kontext

- [Projektstatus](../PROJEKTSTATUS.md)
- [To-do-Liste](../TODO.md), Arbeitspaket SEARCH-01
- [Architektur](../ARCHITEKTUR.md)
- [Zusammenarbeit der Chats](../CHAT_KOORDINATION.md)

Abhängigkeiten: DATA-01, IMPORT-01, AUTH-01

## Relevante Dateien für die spätere Arbeit

- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/klausuren/page.tsx`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/server/pdf-files.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/api/docs/parse/route.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/types.ts`

## Abnahme

Treffer außerhalb der Tags; § 172 ZPO nicht mit § 172 BGB verwechselt; Sachverhalt/Lösung/Seite genannt; Erwähnung vs Schwerpunkt transparent; Rechte vor Treffer/Beleg/Antwort; keine Onboarding-Trunkierung im Suchindex.

## Ergebnis und Abstimmung

Nach tatsächlicher Arbeit das Ergebnis in `lern-tracker/docs/ergebnisse/SEARCH-01.md` und im eigenen Chat hinterlegen: verwendeter Ausgangsstand, geänderte Dateien, tatsächliche Tests, Grenzen und Auswirkungen auf andere Aufgaben. Zentrale Entscheidungen pflegt der Planungschat. Bei gemeinsamen Dateien die Arbeitsweise aus CHAT_KOORDINATION.md beachten. Vorhandene Änderungen und klassifizierte Klausuren erhalten.

Der anfängliche Kontextauftrag umfasst keine Änderung von Anwendungscode, keine bezahlten KI-Aufrufe, keine externen Uploads, Portalabrufe oder Veröffentlichungen. Geheimnisse aus .env.local bzw. secrets.py gehören nicht in die Antwort.



## SEARCH07 — enger Suchworker-Betreiberanschluss 2026-10-18T04:30:50+02:00

Nur07 besitzt scripts/search/worker.mts und falls nötig neuen reinen scripts/search/worker-config.ts plus eigene gezielte Tests/Belege. Bestehenden Produktionsoperator/configuredPersistence-Vertrag read-only verwenden; Suchworker benötigt DB/PrivateFiles, keinen Umweg über öffentliche weiterhin503-gesperrte AccountService-Runtime. Lokalen Suchbetrieb, once/watch/rebuild und Signal/Close erhalten. Produktionsrebuild bleibt ausdrückliche Betreiberaktion; keine automatische Migration/Umgebungsschlüsselanlage. Schema/Backup/Suchfachlogik/Authruntime/Pakete/Deploymentvorlagen read-only. Nur synthetische/instrumentierte Konfig-/Start-/Schließgrenzen ohne echte DB/Worker/Server/Index-/Originalzugriffe oder Netz, keine alte Suchgesamtabnahme. Quelle/Typ/Lint/Grenzen/Bereinigung, danach stoppen. Sol/High empfohlen, zulässiges Reasoning erhalten, Astra verboten. Dienstvorlagen bleiben blockiert, keine Produktionsöffnung/Installation.
