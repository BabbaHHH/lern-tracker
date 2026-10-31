# IMPORT-02: Analyse neuer Klausuren und JSON

## Verbindlicher Modellhinweis17.10.2026

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

## Ziel

Analyseworkflow für neue/geänderte Klausuren versionieren und vorhandene Prompts/JSON-Verträge vergleichen. Bestehende Klassifizierungen und IDs behalten; aktuelle Kennungen verwenden, Quellen-/Datumsunsicherheit und Lösungspaarung prüfen.

Nutzerkorrektur vom 10.10.2026: Uploads werden zunächst direkt akzeptiert; eine zusätzliche KI- oder deterministische Prüfung des Klausurcharakters bleibt für später als optionale Einstellung vorgemerkt. Jetzt keinen Bestätigungsworkflow oder Einstellungsbutton implementieren. Metadatenanalyse neuer Inhalte bleibt ein getrenntes späteres Arbeitspaket und darf die anfängliche direkte Aufnahme nicht voraussetzen. Keine Bestandsneuanalyse; bezahlte Aufrufe nur im konkreten Testauftrag.

## Jetzt unabhängig vorbereitbar – Stand 10, 11.10.2026

**IMPORT-C-V: abgegrenzte Vorbereitung.** Modell: GPT-6.1 Sol · Medium · Standard. Dieser Teilauftrag kann nach Niklas' Startnachricht neben dem laufenden IMPORT-Abschluss beginnen; noch nicht gestartet oder versendet. Er ersetzt für diese Runde den vollständigen Integrationsauftrag unten.

Den bisherigen Analyse-/NotebookLM-Prompt mit aktuellem Themenbaum, bestehenden Klassifizierungen und IMPORT-B-Metadatenvertrag lesend vergleichen. Einen versionierten Entwurf für die Analyse ausschließlich neuer Klausuren erstellen: strukturierte Ausgabe, gültige Themenkennungen, unbekanntes Datum, Dokumentrollen, Herkunft und Analyseversion. Mindestens drei kleine synthetische Ein-/Ausgabebeispiele für vollständige, unvollständige und widersprüchliche Angaben beschreiben. Klar zuordnen, welche Felder der aktuelle Import schon akzeptiert und welche später eine bewusste Vertragserweiterung benötigen; keinen inkompatiblen Entwurf als anschlussfertig bezeichnen. Bestehende Klassifizierungen erhalten. Analyse bleibt Metadatenanreicherung nach direkter Annahme, keine Inhaltsfreigabe. Ergebnis: Schema-/Promptentwurf, Unterschiede zum Importvertrag und begrenzter späterer Integrationsauftrag. Keine reale Modellabnahme behaupten.

**Schreibbereich:** ausschließlich `docs/entwuerfe/IMPORT-02/` und `docs/ergebnisse/IMPORT-02.md`. Vorhandenen Code und zentrale Dokumente lesen, aber nicht ändern. Keine Datenbankmigrationen, Paketänderungen, Tests/Builds oder laufenden Server für diesen Dokumentationsauftrag. Keine bezahlten Aufrufe, Schlüsselzugriffe oder externen Dokumentuploads. Offene Produktfragen gezielt mit Niklas klären; unabhängige Teile weiter ausarbeiten. Vorhandene Entscheidungen nicht erneut pauschal zur Freigabe stellen. Die spätere Umsetzung erhält nach diesem Ergebnis ein eigenes Integrationsfenster; zentraler Stand beim Planungschat.

## Nächster Arbeitsauftrag – Stand 10.10.2026

**Danach: IMPORT-C – Analyse neuer Klausuren an den Import anschließen**

Dieser Auftrag ist zur Besprechung und anschließenden Beauftragung durch Niklas vorbereitet; er wurde noch nicht an den Chat gesendet oder gestartet. Der frühere Einrichtungsauftrag ist abgeschlossen. Vor Beginn [ARBEITSSTART.md](../ARBEITSSTART.md), aktuelle zentrale Dateien und den tatsächlichen Dateistand lesen. Hat Niklas diesen abgegrenzten Auftrag bestätigt, innerhalb des Umfangs selbstständig fertigarbeiten; nicht für jeden Einzelschritt erneut fragen.

**Voraussetzungen / letzte Fragen:** DATA-B, IMPORT-B und AI-KEYS-A für Metadatenanalyse; zusätzliche Inhaltsbestätigung bleibt vertagt. Reale Analyse benötigt konkreten Daten-/Budgetauftrag.

**Arbeitsumfang:** Bestehende Analyseprompts gegen Importvertrag und aktuellen Themenbaum abgleichen. Neue/geänderte Inhalte mit Schema-/Prompt-/Themenversion, Herkunft und tatsächlich verwendetem Modell analysieren. Unbekannte Daten, Dokumentrolle und Zuordnungssicherheit explizit führen. Analyseergebnis validieren und über denselben Importvertrag als Metadaten ergänzen; keine zweite Katalogübernahme und keine neue Freigabesperre für direkt akzeptierte Uploads.

**Schreibbereich und Zusammenarbeit:** Analyse-/Schemaadapter und versionierte Prompts, keine parallele Änderung des Importkerns. Bestehende Klassifizierungen niemals allein wegen Modellwechsels neu berechnen.

**Fertig, wenn:** Lokale Vertrags-/Fehlerfälle und anschließend gesondert echte Qualitätsfälle: falsche Datei, unklare Paarung, unbekanntes Datum, ungültige Themen-ID und Dublettenkandidat. Inhaltsbestätigung ist nicht Teil dieses Auftrags; ihre spätere optionale Einführung erhält einen eigenen Auftrag.

**Übergabe / nächster Schritt:** Ergänzt Import und später Portalquellen; eigener Qualitätsnachweis neben AI-TEST für Lernplanung.

Ergebnis unter `docs/ergebnisse/IMPORT-02.md` mit Abschnitt für diese Teilstufe festhalten: Ausgangsstand, tatsächlich geänderte Dateien, durchgeführte Prüfungen, offene Punkte und belastbare Übergabe. Ein fertiger Teilauftrag bedeutet nicht, dass das gesamte Paket abgeschlossen ist. Gemeinsame Architektur-/Statusdateien pflegt der Planungschat. Zusätzliche gemeinsame Dateiänderungen zuerst dort zuordnen lassen; unabhängige Arbeit fortsetzen.

## Gemeinsamer Kontext

- [Projektstatus](../PROJEKTSTATUS.md)
- [To-do-Liste](../TODO.md), Arbeitspaket IMPORT-02
- [Architektur](../ARCHITEKTUR.md)
- [Zusammenarbeit der Chats](../CHAT_KOORDINATION.md)

Abhängigkeiten: DATA-01, IMPORT-01, AI-KEYS-01

## Relevante Dateien für die spätere Arbeit

- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/docs/notebooklm-klausur-import-prompt.md`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/topics.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/types.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/klausuren/page.tsx`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/Hamburg Sachverhalte und mal Lösungsskizzen/klausur_scanner_hamburg.py`

## Abnahme

Neue Daten kompatibel; Dateiprüfsumme, Modell, Prompt/Schema/Themenversion und Quelle erfasst; kein Modellname als alleiniger Grund zur Neubewertung des gesamten Bestands.

## Ergebnis und Abstimmung

Nach tatsächlicher Arbeit das Ergebnis in `lern-tracker/docs/ergebnisse/IMPORT-02.md` und im eigenen Chat hinterlegen: verwendeter Ausgangsstand, geänderte Dateien, tatsächliche Tests, Grenzen und Auswirkungen auf andere Aufgaben. Zentrale Entscheidungen pflegt der Planungschat. Bei gemeinsamen Dateien die Arbeitsweise aus CHAT_KOORDINATION.md beachten. Vorhandene Änderungen und klassifizierte Klausuren erhalten.

Der anfängliche Kontextauftrag umfasst keine Änderung von Anwendungscode, keine bezahlten KI-Aufrufe, keine externen Uploads, Portalabrufe oder Veröffentlichungen. Geheimnisse aus .env.local bzw. secrets.py gehören nicht in die Antwort.
