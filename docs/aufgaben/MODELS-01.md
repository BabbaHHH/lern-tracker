# MODELS-01: Regelmäßige Modellprüfung

## Verbindlicher Modellhinweis17.10.2026

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

## Ziel

Alle 14–21 Tage Verfügbarkeit, Kosten, Format und Qualität prüfen. Verteilte Modellkonfiguration konsolidieren; Testbudget, geprüfte Übernahme und Rückwechsel. Klassifizierten Klausurbestand dadurch nicht neu analysieren.

## Nächster Arbeitsauftrag – Stand 10.10.2026

**Danach: MODELS-A – nachvollziehbare Modellprüfung**

Dieser Auftrag ist zur Besprechung und anschließenden Beauftragung durch Niklas vorbereitet; er wurde noch nicht an den Chat gesendet oder gestartet. Der frühere Einrichtungsauftrag ist abgeschlossen. Vor Beginn [ARBEITSSTART.md](../ARBEITSSTART.md), aktuelle zentrale Dateien und den tatsächlichen Dateistand lesen. Hat Niklas diesen abgegrenzten Auftrag bestätigt, innerhalb des Umfangs selbstständig fertigarbeiten; nicht für jeden Einzelschritt erneut fragen.

**Voraussetzungen / letzte Fragen:** AI-KEYS-A und echte Referenzabnahmen der jeweils geprüften Funktionen, beginnend mit AI-TEST. Zeitsteuerung erst mit HOST-B.

**Arbeitsumfang:** Modellkonfiguration pro Funktion konsolidieren; feste Referenzfälle, Format-/Qualitäts-/Kostenkriterien und Rückwechsel definieren. Katalogänderungen von bestandener Eignungsprüfung trennen. Prüfablauf für 14–21 Tage vorbereiten; ohne Credits nur Verfügbarkeit prüfen und Qualitätslauf als übersprungen kennzeichnen.

**Schreibbereich und Zusammenarbeit:** Modellkonfiguration und eigener Prüfprozess in abgestimmtem Integrationsfenster nach AI-KEYS. Keine automatische Neubewertung des Klausurbestands.

**Fertig, wenn:** Fehlender Katalog, Ausfall, fehlende Credits oder schlechter Kandidat erhalten den letzten geprüften Stand. Übernahmeentscheidung und tatsächliches Modell nachvollziehbar. Im Pilot Modellwechsel nach vereinbarter Freigabe.

**Übergabe / nächster Schritt:** Regelmäßigen Job erst konkret beauftragen; nicht aus diesem Briefing automatisch eine Automation anlegen.

Ergebnis unter `docs/ergebnisse/MODELS-01.md` mit Abschnitt für diese Teilstufe festhalten: Ausgangsstand, tatsächlich geänderte Dateien, durchgeführte Prüfungen, offene Punkte und belastbare Übergabe. Ein fertiger Teilauftrag bedeutet nicht, dass das gesamte Paket abgeschlossen ist. Gemeinsame Architektur-/Statusdateien pflegt der Planungschat. Zusätzliche gemeinsame Dateiänderungen zuerst dort zuordnen lassen; unabhängige Arbeit fortsetzen.

## Gemeinsamer Kontext

- [Projektstatus](../PROJEKTSTATUS.md)
- [To-do-Liste](../TODO.md), Arbeitspaket MODELS-01
- [Architektur](../ARCHITEKTUR.md)
- [Zusammenarbeit der Chats](../CHAT_KOORDINATION.md)

Abhängigkeiten: AI-KEYS-01, AI-TEST-01

## Relevante Dateien für die spätere Arbeit

- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/ai.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/ai-models.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/prompts.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/model-info.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/free-models.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/api/openrouter-models/route.ts`

## Abnahme

Einheitliche Konfiguration für alle Funktionen; Ausfälle/fehlende Credits ändern keine Standards ungeprüft; Qualitäts- und Formatprüfung vor Wechsel; noch keinen regelmäßigen Job anlegen.

## Ergebnis und Abstimmung

Nach tatsächlicher Arbeit das Ergebnis in `lern-tracker/docs/ergebnisse/MODELS-01.md` und im eigenen Chat hinterlegen: verwendeter Ausgangsstand, geänderte Dateien, tatsächliche Tests, Grenzen und Auswirkungen auf andere Aufgaben. Zentrale Entscheidungen pflegt der Planungschat. Bei gemeinsamen Dateien die Arbeitsweise aus CHAT_KOORDINATION.md beachten. Vorhandene Änderungen und klassifizierte Klausuren erhalten.

Der anfängliche Kontextauftrag umfasst keine Änderung von Anwendungscode, keine bezahlten KI-Aufrufe, keine externen Uploads, Portalabrufe oder Veröffentlichungen. Geheimnisse aus .env.local bzw. secrets.py gehören nicht in die Antwort.

