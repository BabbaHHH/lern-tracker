# Dokumenttest mit historischem Planungsdatum

Prüfstand: 9. Oktober 2026. Referenztag des Tests: **8. April 2026**. Lernstart ebenfalls 8. April; als Testannahme wurde der Prüfungstermin 1. September 2026 gesetzt. Dieser Prüfungstermin wurde nicht aus den Dokumenten erkannt.

## Geprüfte Quellen

Die Originale unter `Lernplan Dokumente` wurden nicht verändert. Sechs unterstützte Dateien wurden über den normalen Uploadschritt in einem separaten lokalen Browserprofil eingelesen.

| Datei | Inhalt und Aussagekraft für die Planung |
|---|---|
| AG Termine.pdf | Sechs Themenblöcke Öffentliches Recht aus anwaltlicher Sicht. Keine konkreten Daten: Themenquelle, kein datierter Kalender und kein Beleg für Stationsgrenzen. |
| Kiss Kursplan_Assessorkurs_2026_Canvas.pdf | 18 Kurstage vom 13. April bis 7. September 2026. Unterbrechungen bleiben erhalten; keine erfundenen wöchentlichen Termine in den Lücken. |
| Probeexamen.pdf | Tatsächlich als Pflichtklausurenkurs bezeichnet. Je 12 Schreib- und Besprechungstermine im Juni/Juli/August 2026. Beide Datumsspalten haben unterschiedliche Bedeutung. |
| Lernplan 2026.xlsx | Monatliche fachliche Schwerpunkte und Stoffübersicht. Daraus folgen keine verlässlichen staatlichen/anwaltlichen Stationsgrenzen. Viele formatierte Leerzeilen. |
| Lernplan.docx | Themenliste und datierte Lernvorschläge ab 8. April bis August 2026. Ein Vorschlag für Sonntagswiederholung hebt einen ausdrücklich gewählten freien Sonntag nicht auf. |
| marianna_lernplan.txt | Themenübersicht ohne konkrete Lerntermine. |

`sonstiges.rtf` enthält kurze Materialnotizen und gehört derzeit nicht zu den unterstützten Importformaten. Die zwei JSON-Dateien sind Datenbestände für die Klausurenverwaltung, keine Planungstexte. Das große Bundle enthält 13.450 heterogene Einträge, darunter Paketmetadaten; `klausuren_clean.json` enthält 280 Einträge. Es wurde keine vorhandene Klausurensammlung damit überschrieben.

## Gefundene und behobene Fehler

1. Leere Excel-Zeilen konnten das Zeichenbudget auffüllen. Beim Auslesen werden sie jetzt ausgelassen; die Spalten bleiben erhalten.
2. PDF-Tabellen verloren sichtbare Spaltentrenner. Sie werden jetzt als ` | ` erhalten. Die Textreihenfolge kann weiterhin von der sichtbaren Seite abweichen; bei der geprüften Tabelle erscheinen übergeordnete Spaltenüberschriften nach den Zeilen.
3. Kürzungen nach Seiten-, Zeilen- oder Blattgrenzen wurden nicht immer als Ausschnitt markiert. Der Parser gibt diese Grenzen jetzt ebenfalls an.
4. Die Planung verwendete an verschiedenen Stellen unterschiedliche Tagesdaten. Der getrennte Entwicklungsserver kann nun ein einheitliches historisches Referenzdatum verwenden. Eine sichtbare Testanzeige kennzeichnet es; der Produktionsbuild ignoriert es.
5. Die Anweisung, alle Stofflücken in vier Wochen unterzubringen, widersprach dem Zeitbudget. Jetzt sollen Lücken priorisiert und langfristig abgedeckt werden.
6. Eine alte 7/14/30-Tage-Regel konkurrierte mit dem neuen Wiederholungsalgorithmus. Der Prompt verwendet jetzt dessen tatsächliche Fälligkeiten.
7. Die Onboarding-Zusammenfassung behauptete noch ein pauschales wöchentliches Klausurpflichtpensum. Sie beschreibt jetzt den durchgehenden Kurs mit tatsächlichen Terminen.
8. Feste Klausurtermine aus Dokumenten fehlten im separaten Kalenderkontext; Termine am aktuellen Tag konnten wegen ihrer Mitternachtszeit herausfallen. Beides korrigiert.
9. Ein abgebrochener Dateiimport konnte nach Neuladen dauerhaft „in Bearbeitung“ bleiben. Er zeigt jetzt einen Fehler und kann neu gestartet werden. Dokumentänderungen werden anhand stabiler IDs zugeordnet.

## Was tatsächlich geprüft wurde

- Browser: sechs Dateien vollständig eingelesen; Originaldaten, spätere DOCX-Tabellenzeilen und die vollständigen Texte in der Planvorschau vorhanden. Referenzdatum und 28-Tage-Budget beginnen am 8. April 2026. Kein OCR-Schritt erforderlich.
- Separater lokaler Integrationstest: dieselben sechs Originaldateien durch den App-Parser, danach in den tatsächlichen Planungskontext.
- Ein unabhängig anhand der Quellen geprüfter Terminsatz mit 18 Kurs-, 12 Schreib- und 12 Besprechungsterminen durchläuft Planübernahme, Zeitbudget, Aufgabenverschiebung, ICS-Ausgabe und Rückgängigmachen.
- Die Eigenlernaufgabe am ersten KISS-Tag wird wegen fehlender Kapazität verschoben. Ein weit entfernter Kurstermin verlängert den konkreten Lernplanbereich nicht bis September.
- Am 1. Juni treffen KISS und Pflichtklausur zusammen. Mit konservativen Standarddauern entsteht ein fester Konflikt. Er wird nicht durch zusätzliche Lernaufgaben verschärft oder durch stilles Absagen versteckt. Die tatsächlichen Dauern sind noch zu bestätigen.

**Nicht geprüft:** Die Erkennung durch ein Sprachmodell. Der lokale Testserver hatte keinen KI-Schlüssel. Der geprüfte Terminsatz ist eine Referenz für die Verarbeitung, keine behauptete KI-Antwort. Es wurden keine Texte an einen KI-Anbieter übertragen. Auch der tatsächliche Import in Apple/Google/Outlook wurde noch nicht ausgeführt.

![Historisches Testprofil](./historischer-onboardingtest.jpg)

## Wiederholen

Aus dem Projektordner:

```sh
npm run test:documents
# Alternativer Quellenordner:
npm run test:documents -- "/absoluter/Pfad/Lernplan Dokumente"
```

Der Test arbeitet mit Speicher im Prozess. Er verändert weder Originaldateien noch den Browserspeicher oder den persönlichen Lernstand.

Für einen separaten Browserdurchlauf mit ausgeschalteter KI:

```sh
OPENROUTER_API_KEY='' STEX_ISOLATED_DEV=1 STEX_TEST_DATE=2026-04-08 \
  node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3317
```

Ein eigener Port trennt den Browserspeicher vom normalen App-Start. `STEX_ISOLATED_DEV` trennt außerdem die erzeugten Next-Dateien. Bei einem gewöhnlichen Start wird das aktuelle Datum verwendet.

## Nächste fachliche Abnahme

1. Einen tatsächlichen persönlichen Stations-/Ausbildungsplan zusätzlich verwenden. Start- und Enddaten sowie staatliche/anwaltliche Perspektiven gegen die Quelle abgleichen.
2. Einen echten KI-Probeplan mit ausdrücklicher Freigabe der sechs Dokumenttexte an den verwendeten KI-Dienst und festgelegtem Kostenrahmen erstellen.
3. Gegen die Referenz prüfen: 18 Kurstage, 12 Klausuren, 12 Besprechungen, keine erfundenen AG-Termine, keine Verschiebung ins aktuelle Jahr, keine doppelte Klausurpraxis an denselben Tagen. Einen Kurs nach dem angenommenen Examen nicht als reguläre Examensvorbereitung einplanen.
4. Unbekannte Kurs-/Besprechungsdauern ergänzen. Die PDF nennt Beginnzeiten, aber keine Endzeiten; sie belegt deshalb keine vierstündigen Besprechungen.
5. Eine Klausur im Kalender zuordnen, schreiben/abhaken, Rückgängigmachen und nächste Wiederholung über mehrere reale Lerntage erproben.
6. ICS in einem separaten privaten Testkalender importieren und eine aktualisierte Datei erneut importieren. Ersetzung/Dubletten anhand des konkreten Kalenderprogramms prüfen.
