# IMPORT-01: Klausurimport und Bestandsdaten

## Verbindlicher Modellhinweis17.10.2026

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

## Ziel

Manuellen Import mit Vorschau, Dubletten-/Versionsprüfung und zugeordneten Dokumenten vorbereiten. Rund 450 vorhandene klassifizierte Klausuren erhalten. Keine neue Klassifizierung aus dem alten NotebookLM-Prompt ableiten.

Nutzerkorrektur vom 10.10.2026: Neue als Klausur eingereichte Uploads zunächst direkt gemeinsam akzeptieren. Keine menschliche, KI- oder regelbasierte Bestätigung des Klausurcharakters. Technische Validierung und Dublettenerkennung bleiben; keine Daten bei ID-Konflikten überschreiben. Ein zusätzlicher Inhaltscheck mit optionaler Einstellung bleibt für später, jetzt weder Check noch Button bauen. Private Notizen und eigene Entwürfe bleiben persönlich.

**Späterer Nutzerwunsch vom 11.10.2026:** Neue Klausursachverhalte und Lösungen einheitlich als PDF bereitstellen, auch wenn die Ausgangsdatei Word ist. Word-zu-PDF-Konvertierung und Formatvereinheitlichung gehören zu einem späteren Importausbau, nicht zu IMPORT-B oder dem ersten Viewer. Ob Sachverhalt und Lösung zusätzlich zu einer einzigen PDF zusammengeführt werden und wie diese gestaltet wird, im späteren Auftrag festlegen. Originaldateien unverändert erhalten; erzeugte PDF-Fassungen mit Herkunft/Version zuordnen. Jetzt keine Konvertierung oder neue Formatierungsstrecke implementieren.

## Aktueller Abschlussauftrag – Koordinationsstand 9, 11.10.2026

**IMPORT-B-Nachprüfung: vorhandenen Ablauf abschließen, danach PDF-A.** Modell: GPT-6.1 Sol · Reasoning: High · Geschwindigkeit: Standard. IMPORT-B wurde geliefert; der Planungschat hat alle acht vorhandenen Import-Testeinträge gegen echte lokale PostgreSQL/Sitzungen erneut bestanden. Gesamttests (187), Lint, Typprüfung und Build laut Aufgabenbericht, in dieser Statusrunde nicht erneut ausgeführt. Die folgende begrenzte Nacharbeit ist vorbereitet, nicht an den Chat versendet.

1. **Uploadgrenze vor vollständigem Einlesen durchsetzen.** `src/lib/server/catalog/http.ts` vertraut zunächst auf `Content-Length` und ruft anschließend unbegrenzt `request.formData()` auf. Die anschließende Größenprüfung erfasst nur die zwei ausgewählten Dateien. Ohne Längenangabe oder mit zusätzlichen Multipart-Feldern ist deshalb keine belastbare Gesamtgrenze vor Speicherbelegung nachgewiesen. Tatsächlich gelesene Bytes begrenzen und bei Überschreitung abbrechen; unerwartete/doppelte Formularfelder und übergroße Metadaten begrenzen bzw. ablehnen. Tests mit fehlender Längenangabe, zusätzlichem Datei-/Textfeld und überschrittenem Gesamtlimit; nur synthetische Daten, keine Belastung realer Instanzen. Vorhandene Limits erhalten oder begründet dokumentieren.
2. **Wiederaufnahme in der Oberfläche anschließen.** `CatalogImportApp.submit` erzeugt pro Klick eine neue `requestId`; die Statusroute wird dort bisher nicht benutzt. Bei unbekanntem Ausgang eines Uploads dieselbe Vorgangskennung für unveränderte Eingaben wiederverwenden, nachvollziehbaren Status/Fehler und einen Wiederholungsweg anzeigen. Geänderte Eingaben bekommen einen neuen Vorgang. Ein bereits gespeicherter Upload mit anschließend fehlgeschlagenem Katalogabruf darf nicht als fehlgeschlagene Übernahme dargestellt werden. Kein neuer Hintergrunddienst nötig. Nachweisen: Antwortverlust nach erfolgreichem Speichern und erneuter Versuch erzeugen keinen zweiten Importbeleg/keine zusätzliche Version; liegengebliebener Vorgang ist über den tatsächlichen Bedienweg fortsetzbar. Falls Status nur per importId erreichbar ist, minimalen besitzergebundenen Anschluss anhand requestId vorsehen und dokumentieren.
3. **Ausstehende Abnahme des ursprünglichen Auftrags ergänzen.** Tatsächlichen Browser mit zwei aktiven Testkonten verwenden: A lädt synthetische PDFs hoch, B sieht den Eintrag nach Neuladen. Die Testhilfsklasse namens `Browser` ist ein HTTP-Client und ersetzt diesen Oberflächentest nicht. Echte Sitzungen für pending/blocked/anonym auf Upload, Katalog und Status prüfen; fremde Importbelege und persönliche Daten bleiben unsichtbar. Sperre zwischen Beginn und Commit deterministisch testen: keine Katalogübernahme. Vorhandene Tests zeigen bislang nur anonymen Katalogabruf, keinen vollständigen Nachweis dieser Fälle. Beobachtete Fehler beheben und Grenzen ehrlich dokumentieren.

Schreibbereich bleibt der vorhandene exklusive IMPORT-B-Bereich; keine parallelen Änderungen durch AUTH/DATA/PDF. Nur betroffene Anwendungsteile ändern, keine neue Migration des echten Bestands, Word-Konvertierung, KI oder Viewer. Relevante Regressionen, Lint, reguläre Typprüfung und getrennten Build nach Änderungen prüfen; vollständige Tests einmal zum Abschluss. Ergebnis und Schnittstellenübergabe aktualisieren. Zentrale Statusdateien pflegt der Planungschat. Anschließend erneutes Architekturreview, dann PDF-A; keine neue Produktentscheidung erforderlich.

## Ursprünglicher IMPORT-B-Auftrag – Stand 11.10.2026


**IMPORT-B – angemeldeter Klausurimport mit gemeinsamer Dokumentablage**

**Modell: GPT-6.1 Sol · Reasoning: High · Geschwindigkeit: Standard.** IMPORT-A ist abgeschlossen; kein erneutes Gesamtinventar. DATA-B und der lokale AUTH-A-Ablauf liegen vor. Projektstatus 8, tatsächlichen Dateistand, eigene Ergebnisse und AUTH-A-Übergabe samt Prüfmatrix vor Beginn lesen. Historischer Startauftrag; inzwischen geliefert. Maßgeblich für die nächste Runde ist der Abschlussauftrag oben.

**Sichtbares Ziel:** Im lokalen angemeldeten Bereich eine neue Klausur mit Metadaten und Sachverhalts-/Lösungs-PDF einreichen. Nach technischer Validierung und Dublettenprüfung unmittelbar im gemeinsamen Katalog sehen; ein zweites aktives Mitglied sieht denselben Eintrag. Eigene Notizen, Entwürfe und persönliche Dokumente bleiben getrennt. Keine zusätzliche Inhaltsbestätigung, KI-Prüfung, OCR, Neuklassifizierung oder Freigabeschleife.

**Arbeitsumfang und Integrationsregeln:**

1. Einen vollständigen kleinen Ablauf mit Upload, technischer Vorschau bzw. Validierungsfehlern, direkter Übernahme und Katalogliste bauen. Kein weiterer Bestätigungsdialog über den Klausurcharakter. Vorhandene Metadaten, Themen und IDs erhalten; unbekannte Angaben unbekannt lassen. Neue IDs serverseitig stabil vergeben. Neue Lösung demselben Fall als Dokumentrolle/-version zuordnen. Unsichere Zuordnung/ID-Konflikt sichtbar zurückgeben; keine bestehende Klausur still überschreiben oder verschiedene Fälle wegen gleicher Dateibytes vereinigen.
2. Additive SQL-Migration ab 003 für gemeinsame Katalogdokumente, unveränderliche Versionen, Rollen/Quellen und dauerhafte Importbelege. Die vorhandenen `document_versions` sind ausdrücklich persönliche Dokumente mit Besitzer-Fremdschlüsseln; kein künstliches Sammelnutzerkonto und kein bloßes Entfernen der Besitzerprüfung. Gemeinsamen Katalogzugriff explizit modellieren, globale Dokument-/Versionsidentität eindeutig halten und die bestehenden persönlichen Referenzen erhalten. Kein widersprüchlicher zweiter Klausurkatalog; bestehende `catalog_records` weiterverwenden. Vertragsänderungen im eigenen Entwurf/Ergebnis konkret dokumentieren, damit Architektur/PDF/SEARCH sie übernehmen können. Migration 001/002 unverändert lassen.
3. AUTH wiederverwenden: `principal` für die echte Sitzung; schreibend im selben SQL-Vorgang erst `lockState`, dann `checkPrincipal(..., true)`, dann Übernahme. Rolle/Besitzer/Sitzung niemals aus Uploadmetadaten übernehmen. Nur aktive Mitglieder dürfen lesen/einreichen; pending/blocked/anonym verweigern. Persönliche Daten nicht in Katalogantworten oder Dublettenhinweisen offenlegen. Bestehender BackupBundle-Operatorimport wird kein allgemeiner HTTP-Endpunkt. Gemeinsame Updates revisionsgebunden und konservativ behandeln.
4. Private Originalbytes außerhalb öffentlicher Pfade; Größe/Dateityp, Rollen, Prüfsumme und Metadaten begrenzen und prüfen. Keine Originalpfade/Dateisystemparameter aus dem Browser. Bewusste konfigurierbare Upload-/Mengenlimits dokumentieren und gegen bekannte IMPORT-/HOST-Größen abgleichen; die alte 4-MB-Onboardinggrenze nicht ungeprüft für den Klausurkatalog übernehmen. Große Übernahmen in begrenzte Arbeitsschritte aufteilen. Import-ID mit Inhaltsfingerprint, Status, Ergebnis/Warnung dauerhaft speichern; gleiche Wiederholung schreibfrei, widersprüchliche Wiederholung 409, konkurrierende Übernahme ohne Duplikate. Zwischenablagen nach Fehlern bleiben unsichtbar; Wiederaufnahme/Restdateien nachvollziehbar behandeln. Kein vollständiger Archivimport innerhalb eines Seitenaufrufs.
5. DATA+AUTH-Sicherung erweitern, sodass gemeinsame Originale, Versionen, Metadaten und Importstatus enthalten sind. Manifest-/Schemaprüfung darf neue Tabellen nicht übersehen. Gemeinsamen und persönlichen Bestand samt Anmeldung auf leerem Testziel wiederherstellen; Entwertung alter Authnachweise erhalten. Authschlüssel und vertrauliche Inhalte nicht in Ergebnisdateien schreiben.
6. Lokal dieselbe geschlossene AUTH-Laufzeit benutzen. Neue Katalog-/Import-Routen bekommen eigenen geprüften Sitzungs-/Origin-/Größen-/Objektzugriffsschutz. Auth-Produktionssperre und alte sensible Routen bleiben unverändert geschlossen. Dokumentvertrag für PDF-01 liefern (Klausur-ID, Dokument-ID, Version, Rolle, Größe/Typ, Quelle und Zugriff), aber den vollständigen Viewer/Byte-Range-Endpunkt nicht nebenbei implementieren. Unbekannte Seitenzahlen nicht erfinden.

**Schreibbereich dieser Runde:** IMPORT ist alleiniger Integrationsbearbeiter: neue Katalog-/Importmodule, eigene API-Routen und kleine kontogebundene Katalog-/Uploadansicht (z. B. unter `/konto/klausuren`), additive DB-Migrationen, nötige Erweiterungen der Persistenz/privaten Dateien/Sicherung sowie eigene Tests/Skripte/Entwürfe. Nötige Paket-/Beispielkonfiguration nur durch IMPORT und mit erhaltenen vorhandenen Änderungen. Bestehende Authsemantik, Lernlogik, Browserstore, globale Typen und bisherige `/klausuren`-Ansicht nicht pauschal umstellen. Persönliche Browsermigration und vollständige Lernansichten-Synchronisierung gehören zur späteren DATA-Integration. AUTH/DATA/PDF ändern parallel keine gemeinsamen Dateien.

**Testbestand und echte Sammlung:** Mit kleinen synthetischen Klausuren/PDFs und tatsächlichen lokalen Testkonten arbeiten. Die erste echte Übernahme des sichtbaren Browserkatalogs erfordert später den konkreten Snapshot und geprüfte PDF-Zuordnung; hier nicht automatisch migrieren. Nicht die 2.753 inventarisierten Dateien importieren. Originalsammlungen und echte Browserdaten bleiben erhalten.

**Fertig, wenn:** Echter lokaler Browserablauf A lädt hoch → sofort gemeinsame Kataloganzeige → B sieht denselben Eintrag, während persönliche Inhalte privat bleiben. Tests gegen echte Sitzungen/PostgreSQL für Neuanlage, Wiederholung, konkurrierende Einreichung, ID-Konflikt, ergänzte Lösung/neue Version, ungültige/zu große Datei, Fehler vor Commit, Neustart/Wiederaufnahme, fehlende oder gesperrte Sitzung und Sperre während Übernahme. Status/Metadaten/Dublettenhinweise vor Berechtigungsprüfung nicht ausgeben. Backup/Restore einschließlich neuer Originale und Authregression prüfen. Lint, normale Typprüfung und relevanter Build mit getrenntem Ausgabeordner; keine fremden Entwicklungsprozesse beenden. Gesamttests nach fertiger Integration einmal ausführen, Fehler/übersprungene Fälle ehrlich benennen.

**Übergabe:** Ergebnis um IMPORT-B ergänzen: tatsächliche Dateien, Abnahme, Grenzen, neue Datenverträge und Bedienweg für PDF-01. Lokaler Folgeausbau ist keine Hostingfreigabe. Keine bezahlten Modelle, externen Uploads/Mails, Portalabrufe, echten Browsermigrationen oder Veröffentlichung. Gemeinsame Projektdateien pflegt der Planungschat.

## Gemeinsamer Kontext

- [Projektstatus](../PROJEKTSTATUS.md)
- [To-do-Liste](../TODO.md), Arbeitspaket IMPORT-01
- [Architektur](../ARCHITEKTUR.md)
- [Zusammenarbeit der Chats](../CHAT_KOORDINATION.md)

Abhängigkeiten: DATA-01

## Relevante Dateien für die spätere Arbeit

- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/klausuren/page.tsx`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/store.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/types.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/topics.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/Lernplan Dokumente/klausuren_clean.json`

## Abnahme

Erneuter Import erzeugt keine Doppelungen, zerstört keine Historie/Notizen und erklärt Änderungen. Quellkennungen und Dateiprüfsummen von persönlicher Klausur-ID unterscheiden.

## Ergebnis und Abstimmung

Nach tatsächlicher Arbeit das Ergebnis in `lern-tracker/docs/ergebnisse/IMPORT-01.md` und im eigenen Chat hinterlegen: verwendeter Ausgangsstand, geänderte Dateien, tatsächliche Tests, Grenzen und Auswirkungen auf andere Aufgaben. Zentrale Entscheidungen pflegt der Planungschat. Bei gemeinsamen Dateien die Arbeitsweise aus CHAT_KOORDINATION.md beachten. Vorhandene Änderungen und klassifizierte Klausuren erhalten.

Der anfängliche Kontextauftrag umfasst keine Änderung von Anwendungscode, keine bezahlten KI-Aufrufe, keine externen Uploads, Portalabrufe oder Veröffentlichungen. Geheimnisse aus .env.local bzw. secrets.py gehören nicht in die Antwort.


**Erstbestand, Nutzerentscheidung 10.10.2026:** Für die erste Servermigration nur den aktuell in der Website sichtbaren Browser-Klausurkatalog (`lerntracker-klausuren`) mit seinen bestehenden IDs/Klassifizierungen übernehmen; Snapshot und PDF-Zuordnung im Migrationsauftrag prüfen. Die 2.753 inventarisierten Dateien sind kein pauschaler Erstimport. Weitere Quellen bleiben als [Migrationsvorrat](../entwuerfe/IMPORT-01/MIGRATIONS-VORRAT.md) dokumentiert.
