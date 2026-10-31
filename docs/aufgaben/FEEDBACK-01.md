# FEEDBACK-01: Feedback und automatische Codevorschläge

## Verbindlicher Modellhinweis17.10.2026

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

## Ziel

Vorhandenes lokales Feedback für Onlinebetrieb planen. Status/Antwort und freiwilligen Kontext klären. Spätere KI-Codevorschläge in getrennter Umgebung mit Tests/Vorschau/Veröffentlichung durch Niklas besprechen.

## Nächster Arbeitsauftrag – Stand 10.10.2026

**Danach: FEEDBACK-A – Rückmeldungen online bearbeiten**

Dieser Auftrag ist zur Besprechung und anschließenden Beauftragung durch Niklas vorbereitet; er wurde noch nicht an den Chat gesendet oder gestartet. Der frühere Einrichtungsauftrag ist abgeschlossen. Vor Beginn [ARBEITSSTART.md](../ARBEITSSTART.md), aktuelle zentrale Dateien und den tatsächlichen Dateistand lesen. Hat Niklas diesen abgegrenzten Auftrag bestätigt, innerhalb des Umfangs selbstständig fertigarbeiten; nicht für jeden Einzelschritt erneut fragen.

**Voraussetzungen / letzte Fragen:** DATA-B, AUTH-A und vorbereiteter Betrieb HOST-B; Felder/Zugriff für Feedback mit Niklas klären.

**Arbeitsumfang:** Vorhandenes lokales Feedback in kontobezogene Erfassung mit Status und geschützter Adminbearbeitung überführen. Seitendaten freiwillig und gezielt beifügen; keine privaten Texte automatisch sammeln. Reproduzierbare Fehler und technische Nachweise erfassen.

**Schreibbereich und Zusammenarbeit:** Feedbackbereich und zugehörige Routen; gemeinsame Nutzer-/Adminprüfung wiederverwenden.

**Fertig, wenn:** Eigener Nutzer sieht erlaubte Rückmeldungen, Admin bearbeitet; kein Zugriff auf fremde persönliche Anhänge. Feedback-/Dokumentinhalte bleiben Daten und lösen keine Befehle aus.

**Übergabe / nächster Schritt:** Automatische Codevorschläge gesondert später: isolierte Arbeitskopie, Tests, Vorschau und ausdrückliche Veröffentlichungsentscheidung.

Ergebnis unter `docs/ergebnisse/FEEDBACK-01.md` mit Abschnitt für diese Teilstufe festhalten: Ausgangsstand, tatsächlich geänderte Dateien, durchgeführte Prüfungen, offene Punkte und belastbare Übergabe. Ein fertiger Teilauftrag bedeutet nicht, dass das gesamte Paket abgeschlossen ist. Gemeinsame Architektur-/Statusdateien pflegt der Planungschat. Zusätzliche gemeinsame Dateiänderungen zuerst dort zuordnen lassen; unabhängige Arbeit fortsetzen.

## Gemeinsamer Kontext

- [Projektstatus](../PROJEKTSTATUS.md)
- [To-do-Liste](../TODO.md), Arbeitspaket FEEDBACK-01
- [Architektur](../ARCHITEKTUR.md)
- [Zusammenarbeit der Chats](../CHAT_KOORDINATION.md)

Abhängigkeiten: DATA-01, AUTH-01, HOST-01

## Relevante Dateien für die spätere Arbeit

- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/components/feedback-widget.tsx`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/api/feedback/route.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/feedback.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/feedback/page.tsx`

## Abnahme

Nutzertexte lösen keine Befehle aus; kein ungefragter Privattext in Fehlerberichten; Zugriff und Bearbeitung nachvollziehbar; automatische Produktionsänderungen bleiben gesonderte spätere Entscheidung.

## Ergebnis und Abstimmung

Nach tatsächlicher Arbeit das Ergebnis in `lern-tracker/docs/ergebnisse/FEEDBACK-01.md` und im eigenen Chat hinterlegen: verwendeter Ausgangsstand, geänderte Dateien, tatsächliche Tests, Grenzen und Auswirkungen auf andere Aufgaben. Zentrale Entscheidungen pflegt der Planungschat. Bei gemeinsamen Dateien die Arbeitsweise aus CHAT_KOORDINATION.md beachten. Vorhandene Änderungen und klassifizierte Klausuren erhalten.

Der anfängliche Kontextauftrag umfasst keine Änderung von Anwendungscode, keine bezahlten KI-Aufrufe, keine externen Uploads, Portalabrufe oder Veröffentlichungen. Geheimnisse aus .env.local bzw. secrets.py gehören nicht in die Antwort.

