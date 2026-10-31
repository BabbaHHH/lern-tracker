# ANKI-01: Optionale Anki-Verbindung

## Verbindlicher Modellhinweis17.10.2026

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

## Ziel

Als spätere Option Karten/Themen zuordnen, Import/Export und gegebenenfalls AnkiConnect prüfen. Bestehende Wiederholungslogik nicht ungeprüft mit Kartenständen gleichsetzen.

## Nächster Arbeitsauftrag – Stand 10.10.2026

**Später: ANKI-A – begrenzten Export mit Testbestand prüfen**

Dieser Auftrag ist zur Besprechung und anschließenden Beauftragung durch Niklas vorbereitet; er wurde noch nicht an den Chat gesendet oder gestartet. Der frühere Einrichtungsauftrag ist abgeschlossen. Vor Beginn [ARBEITSSTART.md](../ARBEITSSTART.md), aktuelle zentrale Dateien und den tatsächlichen Dateistand lesen. Hat Niklas diesen abgegrenzten Auftrag bestätigt, innerhalb des Umfangs selbstständig fertigarbeiten; nicht für jeden Einzelschritt erneut fragen.

**Voraussetzungen / letzte Fragen:** PLAN-A und DATA-B; Export oder Synchronisierung als ersten gewünschten Nutzen mit Niklas klären.

**Arbeitsumfang:** Zunächst nachvollziehbare Zuordnung von Karten/Themen/Klausuren und persönlichen Inhalten festlegen. Einen kleinen Export mit separatem Testbestand erproben und Importergebnis prüfen. Fortschritt des Lernplans nicht automatisch in echte Anki-Wiederholungsstände übertragen.

**Schreibbereich und Zusammenarbeit:** Eigener Exportadapter und Testmaterial; keine Verbindung zu Niklas' echtem Anki-Profil oder bestehender Synchronisierung ohne gesonderten Auftrag.

**Fertig, wenn:** Export/Import mit reproduzierbarer Zuordnung, stabilen Kennungen und klarer Erklärung, welche Daten übertragen werden. Keine Veränderung bestehender Wiederholungsstände.

**Übergabe / nächster Schritt:** Zweiseitige Synchronisierung bleibt eigener späterer Ausbau.

Ergebnis unter `docs/ergebnisse/ANKI-01.md` mit Abschnitt für diese Teilstufe festhalten: Ausgangsstand, tatsächlich geänderte Dateien, durchgeführte Prüfungen, offene Punkte und belastbare Übergabe. Ein fertiger Teilauftrag bedeutet nicht, dass das gesamte Paket abgeschlossen ist. Gemeinsame Architektur-/Statusdateien pflegt der Planungschat. Zusätzliche gemeinsame Dateiänderungen zuerst dort zuordnen lassen; unabhängige Arbeit fortsetzen.

## Gemeinsamer Kontext

- [Projektstatus](../PROJEKTSTATUS.md)
- [To-do-Liste](../TODO.md), Arbeitspaket ANKI-01
- [Architektur](../ARCHITEKTUR.md)
- [Zusammenarbeit der Chats](../CHAT_KOORDINATION.md)

Abhängigkeiten: PLAN-01, DATA-01

## Relevante Dateien für die spätere Arbeit

- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/spaced-repetition.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/topics.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/types.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/docs/WEITERENTWICKLUNG.md`

## Abnahme

Möglichkeiten und Grenzen aktuell geprüft; eigener Testbestand und Datenbesitz geregelt; keine Eingriffe in Niklas' echtes Anki oder vorhandene Synchronisierung.

## Ergebnis und Abstimmung

Nach tatsächlicher Arbeit das Ergebnis in `lern-tracker/docs/ergebnisse/ANKI-01.md` und im eigenen Chat hinterlegen: verwendeter Ausgangsstand, geänderte Dateien, tatsächliche Tests, Grenzen und Auswirkungen auf andere Aufgaben. Zentrale Entscheidungen pflegt der Planungschat. Bei gemeinsamen Dateien die Arbeitsweise aus CHAT_KOORDINATION.md beachten. Vorhandene Änderungen und klassifizierte Klausuren erhalten.

Der anfängliche Kontextauftrag umfasst keine Änderung von Anwendungscode, keine bezahlten KI-Aufrufe, keine externen Uploads, Portalabrufe oder Veröffentlichungen. Geheimnisse aus .env.local bzw. secrets.py gehören nicht in die Antwort.

