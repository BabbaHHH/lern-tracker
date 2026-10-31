# PLAN-01: Ergebnisse

## Zusatzauftrag: appweite Modelle und einstellbarer Denkaufwand — 10.10.2026

Niklas hat direkt die appweite Modellumstellung sowie eine Reasoning-Auswahl in den Einstellungen beauftragt. Dies ist ein zusätzlicher Auftrag. **PLAN-A (fachliche Quellenabnahme des Lernplans) wurde damit nicht beauftragt oder abgeschlossen.**

### Ausgangsstand und Recherche

Git-Ausgangspunkt `539bf2d` mit zahlreichen vorhandenen uncommitteten Änderungen. Diese wurden erhalten; die gemeinsame Arbeitskopie enthält auch laufende Vorarbeiten anderer Aufgaben. Die bisherigen Stufen waren Premium/Strong/Cheap, mit getrennten expliziten Modellwahlen bei Planung und Korrektur. Der API-Eingang erlaubte nur low/medium/high; der bisherige Fable-Planstandard verwendete einen von der API nicht akzeptierten Alias und 32000 Tokens oberhalb der erlaubten 16000.

Öffentliche OpenRouter-Seiten und Metadaten wurden am 10.10.2026 recherchiert, ohne Schlüssel oder Dokumentdaten zu übertragen:

| Stufe | Neuer Standard | Reasoning-Vorgabe | Beleg |
|---|---|---|---|
| Premium | `anthropic/claude-opus-5.5` | high | [Modellseite](https://openrouter.ai/anthropic/claude-opus-5.5), [Endpunkte](https://openrouter.ai/api/v1/models/anthropic/claude-opus-5.5/endpoints) |
| Stark | `openai/gpt-6-luna` | max | [Modellseite mit Effort-Vergleichen](https://openrouter.ai/openai/gpt-6-luna), [Migrationsguide](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/model-migrations/gpt-6) |
| Günstig | `deepseek/deepseek-v4-flash-0731` | Anbietervorgabe | [Modellseite](https://openrouter.ai/deepseek/deepseek-v4-flash-0731), [OpenRouter zu DeepSeek V4](https://openrouter.ai/blog/insights/why-openrouter-for-deepseek/), [0731-Benchmark mit high](https://openrouter.ai/benchmarks/deepsearchqa/) |

Die [Reasoning-Dokumentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) beschreibt die einheitlichen effort-Parameter. Für DeepSeek ist high konkret in OpenRouters 0731-Benchmark belegt; xhigh ist in der V4-Familiendokumentation als Maximum beschrieben. Die Einstellungsoberfläche bietet dort nur Anbietervorgabe/high/xhigh. Keine Übertragung der V4.1-Auswahl und keine Behauptung, die einzelnen Provider bereits mit echten Modellanfragen geprüft zu haben. Ergänzend wurde die [offizielle Luna-Dokumentation](https://developers.openai.com/api/docs/models/gpt-6-luna) geprüft.

### Änderungen

- Neue zentrale Vorgaben und modellbezogene Reasoning-Werte in `src/lib/ai-config.ts`.
- Neue persönliche Auswahl in `src/components/ai-reasoning-settings.tsx`, eingebunden in `src/app/admin/page.tsx`: automatische Speicherung, Fehlermeldung bei gesperrtem Speicher und Wiederherstellen der Standards.
- Neuer Aufrufadapter `src/lib/ai-settings.ts`: liest die Auswahl vor jeder Anfrage, auch bei schon geöffneten Editoren. Eingebunden in `src/lib/use-ai.ts`, `src/app/plan/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/admin/page.tsx`, `src/components/checkin-chat.tsx`, `src/components/document-manager.tsx` und `src/components/prompt-gear.tsx`.
- `src/lib/ai.ts`, `src/app/api/ai/route.ts` und `src/app/api/docs/tag/route.ts`: modellbezogene Validierung und Übertragung der Auswahl. Anbietervorgabe lässt reasoning weg; bei den neuen Modellen wird keine inkompatible Temperatureinstellung gesendet. Bei explizitem Reasoning werden nur Endpunkte mit Unterstützung der Parameter zugelassen. Bestehende Produktionssperren und Schlüsselzuordnung bleiben erhalten.
- Reasoning-Aufrufe erhalten standardmäßig bis zu 16000 Gesamttokens; die bestehende API-Obergrenze bleibt bestehen. Explizit kleinere Antwortbudgets bleiben kleiner. Eine wegen Tokenbegrenzung abgeschnittene Antwort wird als Fehler zurückgegeben. Der zentrale Browser-Timeout beträgt jetzt 120 Sekunden, der Server bleibt bei 115 Sekunden.
- `src/lib/ai-models.ts` und `.env.example`: neue Standards und Auswahlmöglichkeiten. Die bestehenden ausdrücklich ausgewählten Alternativen bleiben erhalten. Ersetztes Opus 4.8 wird beim Lesen auf 5.5 abgebildet; alte Opus/Fable-Planvorgaben fallen auf den neuen Planstandard zurück. Die gespeicherten Rohdaten werden dabei nicht überschrieben. Lokale Modell-Overrides wurden passend gesetzt; Zugangsdaten wurden nicht verändert oder ausgegeben.
- `src/lib/store.ts`: neuer Bereich `STORAGE_KEYS.aiReasoning` mit Normalisierung sowie Aufnahme in den bestehenden Backup-/Restoreumfang. Sonstige Lern-, Klausur- und Notizdaten bleiben erhalten.
- Neue Prüfungen in `tests/ai-reasoning.test.ts`.

### Tatsächliche Prüfung

- `npm test`: **81 Tests bestanden**, einschließlich sechs neuer Reasoning-/Integrationsprüfungen. Modellantworten synthetisch; kein echter Modelltest.
- Lint aller oben geänderten Quell- und Testdateien bestanden; `git diff --check` bestanden.
- Quelltypprüfung mit einer temporären Konfiguration auf Basis der vorhandenen `tsconfig.json` bestanden: Anwendung, Tests, Skripte und kanonische Next-Typreferenzen; doppelte generierte Dateien nicht zusätzlich aufgenommen. Keine Änderung an der Projektkonfiguration.
- Normale Typprüfung meldete die bereits vorhandene generierte Datei `.next/dev/types/routes.d 2.ts` mit doppelten `LayoutProps`-/`RouteContext`-Definitionen. Gesamt-Lint meldete `prefer-const` in `scripts/import-inventory/inventory.ts:223`. Diese fremden Bereiche wurden nicht verändert. Kein gemeinsamer Produktionsbuild gestartet.
- Auf dem laufenden Port-3000-Server `/admin` im Browser geprüft: drei korrekte Standardwerte, Änderung Luna max → low gespeichert und nach Neuladen erhalten; anschließend max wiederhergestellt. Keine KI- oder Guthaben-Testaktion ausgelöst. Die Darstellung wurde visuell geprüft und als Screenshot gesichert.

### Übergabe und Grenzen

Die Einstellung gilt lokal in diesem Browser für die drei neuen Modelle, einschließlich Onboarding, Lernplan, Check-in, Dokumentzuordnung, Promptbearbeitung und Korrektur. Andere explizit gewählte Modelle behalten ihre Vorgaben. Anbietervorgabe ist kein Ausschalten des Denkens; insbesondere Opus verwendet adaptives Thinking.

**Für DATA-01:** zusätzlicher Sicherungs-/Migrationsbereich `lerntracker-ai-reasoning`; Inhalt ist eine Modell-ID → Preference-Zuordnung (provider/none/low/medium/high/xhigh/max), bei diesen drei Modellen modellbezogen normalisiert. Alte Backups ohne den Bereich bleiben verwendbar. Die Datenmigration muss diesen Bereich bei ihrer Bestandsaufnahme berücksichtigen; es wurde keine Nachricht an andere Chats versendet.

Keine bezahlten Aufrufe, externen Dokumentuploads oder fachliche KI-Abnahme. Reasoning-Höhe, Antwortqualität, Zeit und Kosten im echten Einsatz bleiben Teil eines gesonderten freigegebenen Modelltests; Kostenobergrenzen sind hier weiterhin die bisherigen Antwortlimits, keine neue Pilotbudgetverwaltung. Die zentralen Status-/Architekturdateien wurden nicht verändert.

## PLAN-A: lokale Quellenprüfung und Korrekturen — 10.10.2026

### Auftrag und Ausgangsstand

Niklas hat PLAN-A jetzt direkt beauftragt: den ursprünglichen Lernplan-Ersteller prüfen und hierfür Unterlagen aus „Lernplan Dokumente“ verwenden. ARBEITSSTART.md, PLAN-01-Briefing und gemeinsame Status-, Aufgaben-, Architektur- und Koordinationsdateien wurden gelesen. Git-Ausgangspunkt weiterhin `539bf2d`, mit zahlreichen vorhandenen Änderungen einschließlich des vorherigen Modellauftrags und paralleler DATA-/IMPORT-Arbeit. Andere Änderungen wurden erhalten.

**Ergebnis:** Die geprüften lokalen Planungsabläufe bestehen nach gezielten Korrekturen. Eine vollständige persönliche bzw. echte KI-Abnahme bleibt offen: Stationsgrenzen und reale Kurs-/Besprechungsdauern fehlen; außerdem verliert der PDF-Einleser sichtbare Datumsnotizen. Originalunterlagen, Browserdaten und Klausurbestände wurden durch diese Prüfung nicht verändert. Es gab keine Modellanfragen und keine externen Dokumentübertragungen.

Historische Referenz: **08.04.2026**. Das im bisherigen Integrationsskript verwendete Examen **01.09.2026** ist weiterhin eine **Testannahme**, keine bestätigte persönliche Angabe. Zusätzliche Novemberfälle sind isolierte Regressionen. Die Februar-Stationsvorlage prüft Funktionen und Perspektiven; sie belegt nicht Niklas' tatsächlichen Stationsverlauf.

### Quellenprüfung

Die sechs unterstützten Dateien aus dem lokalen Ordner wurden über die tatsächliche Dokumentroute eingelesen. Die PDF-Tabellen wurden zusätzlich mit lokal gerenderten Seiten abgeglichen; die AG-Seite wurde einschließlich ihrer sichtbaren Textnotizen untersucht. DOCX-/XLSX-/TXT-Inhalte wurden zusätzlich direkt gelesen.

| Quelle / Referenz | Erwartung | Festgestelltes Verhalten / Ergebnis |
|---|---|---|
| `Kiss Kursplan_Assessorkurs_2026_Canvas.pdf` | 18 konkrete Kurstage vom 13.04. bis 07.09.2026; keine ergänzten Montagskurse in den Lücken. | Alle 18 Daten erreichen den Kontext und werden in der geprüften Referenz übernommen. Insbesondere 25.05. sowie 20./27.07. und 03.08. bleiben ohne erfundene KISS-Termine. Dauer nicht belegt. |
| `Probeexamen.pdf`, tatsächlicher Titel Pflichtklausurenkurs | 12 Schreibtermine und 12 separate Besprechungstermine; beide Tabellenspalten getrennt behandeln. | Referenz mit 24 Terminen übernommen. Beispiel ZR I: Schreiben 01.06., Besprechung 22.06.2026. Besprechungen am 25.06. und 30.07. jeweils zweimal; kein Zusammenlegen. Beginnzeiten belegen keine Dauer. |
| Beide Kurs-PDFs: 01./08.06. und 06.07.2026 | Unabhängige feste Verpflichtungen erhalten, Konflikt offen melden. | KISS plus Pflichtklausur ergeben mit bisherigen Ersatzdauern 4h + 5h = 9h. Vorher fehlte die Übernahmewarnung, wenn an diesen Tagen keine Aufgabe stand. Jetzt Warnung auch für entfernte reine Kalenderdaten. Keine Änderung der Quelltermine. |
| KISS + Besprechungen: 22./29.06.; doppelte Besprechungen 25.06./30.07.2026 | Mehrere feste Termine nicht unsichtbar machen. | Mit jeweils 4h Ersatzdauer entstehen 8h; jetzt Warnung über der 7h-Grenze. Diese Zahlen sind konservative Rechenannahmen, keine Quellenangaben zu Dauer oder tatsächlicher Überschneidung der Uhrzeiten. |
| `AG Termine.pdf`, Seite 1 | Anwaltliche ÖR-Perspektive, sichtbare Notizen berücksichtigen; keine Stationsgrenzen daraus erfinden. | PDF enthält zwei `/FreeText`-Notizen: dritte Übungsstunde 05.05.2026, weitere Termine wöchentlich dienstags; zweite Klausur Mittwoch 13.05. **Die App liest diese Notizen nicht ein**, obwohl die Route `truncated:false` meldet. Sie liefert nur 1950 Zeichen Grundtext. Diese Lücke bleibt als Anschlussbedarf unten offen. |
| Sichtbar geprüfte AG-Notizen, separat ergänzter Quelltext | Aus dem Mai-Anker nur belegbare Folgefälle bilden. | Referenz mit AG 05./12./19./26.05. und Klausur 13.05.2026 lokal geprüft. Das Jahr der zweiten Klausur wurde aus demselben datierten Mai-Kontext abgeleitet. Keine erste Klausur und keine ersten beiden AG-Daten erfunden. Kontext erhält die Ergänzungen, Aufgaben weichen dem AG-Budget aus, Stationsabschnitte bleiben leer. **Dies ist kein erfolgreicher Annotationenimport durch die App.** |
| `Lernplan.docx`, 12.04.2026 Sonntag Wiederholung | Persönlicher freier Sonntag hat Vorrang vor dem Lernvorschlag. | Wiederholung auf Montag verschoben. Separater synthetischer fester Sonntagstermin bleibt erhalten und wird als Konflikt mit dem freien Tag gemeldet. |
| `Lernplan 2026.xlsx` | Monatsfokus und Themen als Lernquelle lesen; keine amtlichen Stationen daraus ableiten. | Fokusangaben erreichen den Kontext; leere Rasterzeilen verdrängen keine Themen. Keine persönlichen Stationsabschnitte automatisch aus der Monatsübersicht übernommen. |
| `marianna_lernplan.txt` und Themenliste im DOCX | Themen und Perspektiven erhalten, undatierte Inhalte nicht zu echten Terminen machen. | Lesbarer Volltext im Kontext. Undatierte Themen bleiben ohne Kalender- oder Stationsannahmen. |
| Historische Dateiübernahme insgesamt | Entfernte feste Termine dürfen einen kurzen konkreten Lernplan nicht monatelang blockieren; Rückweg vollständig. | Bestehender Realdateitest: 42 Termine + 2 Aufgaben, konkretes Ende 14.04., 44 ICS-Ereignisse, Undo vollständig. Zusatzprüfung mit manuell ergänzten AG-Notizen: 47 Termine + 2 Aufgaben, 49 ICS-Ereignisse, Konfliktwarnungen und Undo bestanden. |

RTF und die Klausur-JSON-Bestände wurden nicht als Lernplan importiert. Die aktuelle Route unterstützt RTF nicht; die JSON-Dateien sind kein Anlass zur Neuklassifizierung bestehender Klausuren.

### Nachgewiesene Fehler und gezielte Änderungen

Vor der jeweiligen Korrektur wurden Regressionen ausgeführt. Die ersten fünf neuen Fehlerfälle scheiterten am bestehenden Verhalten; die zusätzliche Examensgrenze wurde beim Prüfen der Rückstandsreparatur abgesichert.

| Fall / Grundlage | Erwartung | Vorher → nachher |
|---|---|---|
| Reine Kalenderkonflikte aus den Kursquellen | Sichtbare Warnung auch ohne Aufgabe und außerhalb des kurzen Inhaltsplans. | Warnungen prüften nur Tage mit Aufgaben. Jetzt Prüfung des konkreten Zeitraums und aller künftigen Termine aus dem übergebenen Dokumentplan; der angewendete Inhaltszeitraum bleibt kurz. Feste Verpflichtungen an freien Tagen werden ebenfalls gemeldet. |
| Verpasste offene Planaufgabe, Urlaub am nächsten Tag | Aufgabe mit gleicher ID und Notiz am nächsten passenden Lerntag; erledigte, manuelle und feste historische Arbeit erhalten. | Offene vergangene Aufgaben wurden ausgeschlossen. Jetzt werden gültig datierte offene Planinhalte vorgetragen oder bleiben als Rückstand erhalten. Die Platzierung endet immer vor einem eingetragenen Examen, auch beim Aufruf am Prüfungstag oder später. |
| Bereits zurückgestellte 480-Minuten-Aufgabe bei neuem Plan | Rückstand mit ID und Notiz erhalten; nicht wegen des Ersetzens von Inhaltsaufgaben löschen. | Rückstand wurde gelöscht. Jetzt erhalten, erneut auf Kapazität geprüft und bei fehlendem Platz weiter als Rückstand geführt; Undo stellt den Ausgangszustand wieder her. |
| Erledigte bzw. fest verknüpfte Klausuraufgabe beim neuen Plan | Zugehöriger Kalendertermin und ID bleiben erhalten. | Aufgabe blieb, ihr KI-Kalendertermin wurde entfernt bzw. ersetzt. Jetzt erhaltene `calendarEventId`-Verweise bei der Terminbereinigung berücksichtigen; kein zusätzlicher Klausurslot desselben Tages. |
| KI-Tagesbudget mit erhaltener Kalenderverknüpfung | Erhaltene feste Termine auch dann zählen, wenn sie ursprünglich aus einem KI-Plan stammen. | Ereignisse mit `source:plan` wurden pauschal ausgelassen. Jetzt solche Termine aufnehmen, wenn eine erhaltene Aufgabe darauf verweist. Regression: 90-Minuten-Aufgabe plus unbesetzter Klausurslot ergibt 6,5h statt 1,5h. |

Tatsächlich in **diesem Teilauftrag** geändert:

- `src/lib/learning-planner.ts`: vergangene offene Planinhalte einbeziehen; harte Grenze vor dem Examen auch bei Rückstandsreparatur.
- `src/lib/plan-applier.ts`: Rückstände und Kalenderbezüge erhalten; reine Terminkonflikte und Verpflichtungen an freien Tagen offen melden.
- `src/lib/prompt-context.ts`: erhaltene Kalenderbezüge im festen Zeitbudget berücksichtigen.
- `tests/learning-planner.test.ts`, `tests/historical-planning.test.ts`: acht neue Regressionen bzw. Quellenreferenzfälle.
- `docs/ergebnisse/PLAN-01.md`: dieser Bericht.

`study-phases.ts` und `day-budget.ts` wurden geprüft, aber nicht geändert. Speicherung, Datentypen, Paketdateien, Konfiguration und Oberflächen blieben in PLAN-A unverändert. Der Parser wurde ebenfalls nicht verändert, da er außerhalb des freigegebenen Schreibbereichs liegt.

### Weitere geprüfte Abläufe

- Staatliche und anwaltliche Technik getrennt in Zivil-, Straf- und Öffentlichem Recht; gemischte Phasen decken alle drei Gebiete ab. Abschnittswechsel starten neue maximal 14-tägige Blöcke. Das sind Funktionsprüfungen an expliziten Beispielphasen, keine persönliche Stationsabnahme.
- Fester Kalender-/Klausurenkurs wird unabhängig vom Fokus berücksichtigt. Historische Quelltermine bleiben datiert; ein nach dem angenommenen Examen liegender KISS-Termin wird als Kalenderquelle erhalten, nicht als neuer Prüfungsvorbereitungstag.
- Freier Wochentag, Urlaub, mehrtägige Seminare, Vor-/Nachbereitung und die persönliche Tagesgrenze werden berücksichtigt. Unauflösbare feste Überlast bleibt sichtbar; zusätzliche Planinhalte werden verschoben bzw. zurückgestellt.
- Klausurslot und konkrete/erledigte Klausuraufgabe werden einmal berechnet; getrennte Prüfungen zeigen echte Konflikte weiter an. Skizzen bleiben optionale Kapazität, ohne Zusatzpflicht an Klausurtagen.
- Wiederholungsintervalle stammen aus tatsächlicher Historie und ausdrücklichen Abrufbewertungen. Gewöhnliche Lernkontakte oder Klausurnoten fingieren keine Abrufbewertung. Fällige Reviews belegen vorhandene automatische Slots; wiederholter Aufruf im geprüften Ablauf erzeugt keine Doppelung. Abschluss und Undo erhalten Dauer und Historie.
- Erledigte Aufgaben, eigene Notizen und manuelle Aufgaben bleiben bei den geprüften Übernahmen erhalten. Undo verweigert das Überschreiben späterer Änderungen. Speicherfehler führen im getesteten Übernahmeablauf zum Rückweg.

### Tatsächliche Prüfungen

- **60 gezielte Planungstests bestanden**: learning-planner, historical-planning, study-phases und planning-features.
- **124 Tests im aktuellen gemeinsamen Gesamtstand bestanden**, einschließlich der inzwischen vorhandenen DATA-/IMPORT-Tests anderer Aufgaben. Daraus folgt keine fachliche Paketabnahme dieser anderen Aufgaben.
- `npm run test:documents` erneut bestanden: sechs tatsächliche Dateien → Dokumentroute → Kontext → unabhängig überprüfte Terminreferenz → Budget/Verschiebung → ICS → Undo. Keine KI-Ausgabe verwendet. Die Meldung „complete“ bedeutet hierbei nur, dass die Text-/Seitenobergrenze nicht erreicht wurde; sie bestätigt ausdrücklich nicht die Übernahme von Annotationen.
- Zusätzliche lokale Realdateiprüfung mit optisch/technisch bestätigten AG-Annotationen bestanden, nachdem die fehlenden Notizen ausdrücklich als ergänzter Quelltext bereitgestellt wurden. Keine Übernahme in Niklas' echten Browserbestand.
- Lint aller fünf geänderten Quell-/Testdateien bestanden; `git diff --check` bestanden.
- Quelltypprüfung für Anwendung, Tests, `.ts`-/`.mts`-Skripte und Next-Konfiguration mit temporärer Konfiguration auf Basis des vorhandenen tsconfig bestanden. Keine Änderung der Projektkonfiguration.
- Die normale Projekt-Typprüfung bleibt an vorhandenen generierten Duplikaten in `.next/dev/types/routes.d 2.ts` hängen (`LayoutProps`, `RouteContext`). Diese fremden generierten Dateien wurden nicht verändert. Kein gemeinsamer Produktionsbuild.

### Offene Punkte und belastbare Übergabe

1. **Persönliche fachliche Daten:** tatsächliche Stationsanfänge/-enden sowie KISS-, AG- und Besprechungsdauern fehlen weiterhin. Niklas wurde während der Prüfung gezielt nach diesen Angaben bzw. ihrer Quelldatei gefragt. Die Quellen belegen keine Dauer allein durch eine Beginnzeit. Ohne Ergänzung bleibt die persönliche Gesamtplanung teilweise ungeprüft.
2. **Konkreter Anschlussbedarf am PDF-Einleser:** `src/app/api/docs/parse/route.ts` nutzt `PDFParse.getText`, das die zwei sichtbaren `/FreeText`-Annotationen der AG-Datei auslässt. Reproduktion: Original Seite 1 anzeigen bzw. lokal `pdftotext -layout` auswerten und mit dem 1950-Zeichen-Route-Ergebnis vergleichen; dieses enthält weder `05.05.2026` noch `13.05`. PDF-Prüfsumme SHA-256: `20dff29677f55e5010071b77b94449984b11f2b17c23a2724f4c81d592e79c56`. Parserzuständigkeit im Planungschat zuordnen; Annotationentext mit Seiten-/Positionsbezug als Quelldaten übernehmen oder Auslassung sichtbar melden. Abnahmefall: beide Mai-Notizen erreichen den Kontext, ohne den Grundtext doppelt einzufügen oder Dokumentinhalte als Anweisungen zu behandeln. Danach tatsächlichen Rohdatei-Test ohne manuelle Textergänzung wiederholen.
3. **Für AI-TEST-01:** sechs lokale Quellen und oben genannte Sollfälle sind eine überprüfte Referenz. Echte Modellerkennung, korrekte Terminextraktion einschließlich Annotationen und fachliche Aufgabenqualität brauchen einen separat begrenzten und freigegebenen Modelltest. Hier wurde kein KI-generierter Lernplan fachlich abgenommen.
4. **Für UI-01:** Warnungen zu Überlastung und freien Tagen sowie Rückstände werden durch bestehende Ergebnis-/Kalenderanzeigen versorgt. Beobachtungen am echten Nutzerablauf und eine spätere Oberflächenabnahme bleiben separat; keine persönlichen Testdaten wurden in den laufenden Browser geschrieben.

Keine Nachricht an andere Chats gesendet. Zentrale Status- und Architekturdateien bleiben beim Planungschat. PLAN-A liefert damit einen geprüften Teilbericht und lokale Korrekturen; die persönliche Gesamt- und KI-Abnahme bleiben ausdrücklich offen.

## PLAN-B: sichtbare PDF-Datumsnotizen einlesen — 10.10.2026

### Auftrag und Ergebnis

Niklas hat PLAN-B ausdrücklich gestartet: den PDF-Einleser samt Tests im abgegrenzten Bereich reparieren, parallel zu DATA-B und ohne Abhängigkeit von fehlenden persönlichen Stationsangaben. Grundlage: aktualisiertes PLAN-01-Briefing und Projektstatus **Koordinationsstand 6**, dazu ARBEITSSTART, TODO, Architektur, Koordinationsregeln und PLAN-A-Ergebnis. Ausgangspunkt weiterhin `539bf2d` mit dem aktuellen uncommitteten Gesamtstand; fremde Änderungen wurden erhalten.

**PLAN-B ist umgesetzt und lokal geprüft.** Die beiden sichtbaren Textanmerkungen des unveränderten Originals `Lernplan Dokumente/AG Termine.pdf` erreichen jetzt den eingelesenen Dokumenttext und den tatsächlichen Onboarding-/Planungskontext, jeweils mit Dateiname und Seite. Die Prüfung verwendete ausschließlich Originalbytes; kein manuelles Ergänzen, kein Ersatzquelltext und keine KI-Extraktion. Der frühere Parser-Anschlussfehler aus PLAN-A ist damit behoben.

### Vorher / nachher am Original

SHA-256 vor und nach der Prüfung unverändert: `20dff29677f55e5010071b77b94449984b11f2b17c23a2724f4c81d592e79c56`.

| Nachweis | Vorher | Nachher |
|---|---|---|
| Dokumenttext | 1950 Zeichen; beide Datumsnotizen fehlten trotz `truncated:false`. | 2237 Zeichen; beide Notizen jeweils genau einmal, `truncated:false`, keine Warnungen. |
| Erste sichtbare Textanmerkung | `05.05.2026` und der wöchentliche Dienstagshinweis fehlten. | Originaltext aus Annotation `178R`, Quelle `AG Termine.pdf`, Seite 1, Textanmerkung 1. Positionsrechteck `[170.6513, 406.1975, 742.7447, 443.703]` in PDF-Koordinaten. |
| Zweite sichtbare Textanmerkung | `13.05` fehlte. | Originaltext aus Annotation `193R`, Quelle `AG Termine.pdf`, Seite 1, Textanmerkung 2. Positionsrechteck `[170.9604, 210.2996, 377.4272, 231.1815]`. Kein Jahr hinzugefügt. |
| Dokument-/Planungskontext | Nur Grundtext vorhanden. | Ausgabe der Dokumentroute unverändert als `fullText` an `buildContextFor(["onboarding"])` übergeben; beide Daten und ihre Quellen-/Seitenkennungen nachgewiesen. Stationsabschnitte bleiben leer. |
| Laufender lokaler Server | Fehlender Annotationstext aus bisherigem Parser. | Dieselbe Prüfung auch per tatsächlichem POST an `http://localhost:3000/api/docs/parse` bestanden; identische 2237 Zeichen und zwei Quellenbelege. Damit wurde auch die tatsächliche Next-Laufzeit geprüft. |

Seite 1 wurde zusätzlich lokal gerendert und visuell mit den beiden sichtbaren Notizen abgeglichen. Originaldatei und echter Browserbestand wurden nicht verändert; Kontextprüfungen liefen in isoliertem Speicher innerhalb des Testprozesses. Lokale Serverprüfung übertrug das Dokument ausschließlich an localhost.

### Änderungen und Quellenbezug

- **`src/app/api/docs/parse/route.ts`:** PDF-Zweig an den neuen Extraktionshelfer angebunden. Bisherige Dateivalidierung, Zugriffsprüfung, Dateigrößenlimit und andere Dokumentformate erhalten. Die Antwort behält `text`, `chars` und `truncated`; zusätzlich enthält `pdf` Seitenzahlen, Anmerkungsquellen mit IDs/Positionen/Extraktionsstatus sowie Warnungen.
- **Neuer `src/lib/server/pdf-planning-text.ts`:** bisherige Seitentext-/Tabellenextraktion mit `pdf-parse` erhalten; sichtbare `FreeText`-Anmerkungen über die öffentliche PDF.js-API ergänzen. Dateiname, Seite und Anmerkungsnummer stehen direkt vor dem übernommenen Quelltext. Beide PDF-Ladevorgänge werden beendet, ihre Bytepuffer getrennt gehalten.
- **Neue `tests/pdf-annotations.test.ts`:** zehn Prüfungen mit ausschließlich synthetischen PDF-Bytes. Keine private Originaldatei und keine privaten Auszüge in Testfixtures kopiert.
- **`docs/ergebnisse/PLAN-01.md`:** dieser Abschnitt.

Der normale Planungskontext bekommt die Quellenkennungen direkt über den Text; er ist nicht darauf angewiesen, dass zusätzliche Antwortmetadaten dauerhaft gespeichert werden. Deshalb keine Änderungen an Speicherung, gemeinsamen Typen oder Oberfläche. Keine Paket-, Lockfile-, Datenbank-, Build- oder Konfigurationsänderungen durch PLAN-B.

Verwendet werden vorhandenes `pdf-parse` 2.4.5 und dessen bereits installiertes `pdfjs-dist` 5.4.296. Der Helfer importiert die öffentliche PDF.js-Anzeige-API direkt, ohne private Parserfelder auszulesen oder Bibliotheken zu verändern. Bei einer späteren eigenständigen Paketaktualisierung diese bestehende transitive Abhängigkeit mitprüfen bzw. eine direkte Deklaration im zuständigen Integrationsschritt berücksichtigen; hierfür wurde parallel zu DATA-B keine Paketdatei angefasst.

### Dopplungen, Grenzen und Datenbehandlung

- Schon im selben Seitentext vorhandene Anmerkungen werden nicht erneut als Inhalt eingefügt. Vergleich berücksichtigt Unicode-Normalisierung, Leerraum, weiche Trennzeichen und die erzeugten Tabellen-Trennzeichen. Wiederholte identische Anmerkungen derselben Seite erscheinen einmal; dieselbe Notiz auf einer anderen Seite behält ihren eigenen Seitenbezug. Metadaten unterscheiden `included`, `already-in-page`, `duplicate` und `unreadable`.
- PDF.js-Anmerkungen mit Anzeigeabsicht werden zusätzlich anhand der Sichtbarkeitsflags und des Seitenrechtecks gefiltert. Versteckte bzw. nicht für die Anzeige bestimmte Textfelder und vollständig außerhalb der Seite liegende Felder werden nicht zu Planungsquellen.
- Bestehende Grenzen: 4 MB Datei, erste 100 PDF-Seiten, höchstens 15000 Ausgabezeichen. Hinzu kommt eine Grenze von 1000 sichtbaren Textanmerkungen. Tatsächlich ausgelassene Seiten/Anmerkungen, nicht lesbare einfache Anmerkungstexte und Anmerkungs-Lesefehler setzen die Unvollständigkeitskennzeichnung; Hinweise stehen auch im zurückgegebenen Text. Eine Zeichenbegrenzung wird am Textanfang genannt und bleibt damit im bestehenden Planungskontext sichtbar.
- Erfasst werden maschinenlesbarer Seitentext und sichtbare `FreeText`-Inhalte. Keine neue OCR, Pixel-/Appearance-Analyse, Formularauswertung oder Auswertung anderer Kommentararten. RichText ohne lesbaren einfachen Inhalt wird nicht als HTML interpretiert, sondern als nicht lesbar gemeldet. Anmerkungstext kann sich von einer abgeschnittenen visuellen Darstellung unterscheiden; Position und Originalinhalt bleiben daher als Quellenbeleg erhalten.
- Dokument- und Anmerkungstext bleiben wörtliche Daten. Beide PDF-Lader verwenden `isEvalSupported:false`; keine PDF-Aktionen, Serverbefehle oder HTML-Ausführung ergänzt. Bestehende Regeln des Planungskontexts behandeln den enthaltenen Text weiterhin als Quelle statt als Anweisung.

### Tatsächliche Prüfungen

1. Vor der Reparatur scheiterte der neue synthetische Regressionstest, weil die Anmerkungsdaten nicht im Text standen. Separat am Original reproduziert: beide Daten fehlen im bisherigen 1950-Zeichen-Ergebnis.
2. **75 relevante Dokument-/Planungstests bestanden**, einschließlich zehn neuer PDF-Prüfungen: Quellen-/Seitenbezug, Dopplungen, Tabellen-/Leerraumvergleich, mehrseitige und reine Anmerkungsseiten, Sichtbarkeit, Unicode/literaler Quelltext, Seitenlimit, Zeichenlimit, unlesbare Felder und Anmerkungslimit.
3. **134 Tests im gemeinsamen Gesamtstand bestanden.** Das ist eine erneute Gesamt-Testausführung, keine Abnahme paralleler DATA-B-Arbeit.
4. **Originalprüfung ohne Ergänzungen bestanden**, direkt über die Route und über den laufenden lokalen HTTP-Server. Beide Daten jeweils einmal, beide Quellenbelege Seite 1, zwei `included`-Metadatensätze, keine Warnung; anschließender echter Onboarding-Kontext geprüft. Originalhash nach der Prüfung identisch.
5. **`npm run test:documents` bestanden:** sechs Originaldateien über dieselbe Dokumentroute, Kontext, Terminreferenz, Budget, Verschiebung, ICS und Undo. AG-Datei jetzt 2237 statt 1950 Zeichen; die anderen fünf Textlängen unverändert. Dieser bestehende Test wertet weiterhin eine unabhängig geprüfte Terminreferenz aus und bleibt kein Modelltest; die neue Originalprüfung deckt zusätzlich die AG-Notizen ab.
6. **Lint der drei geänderten Quell-/Testdateien und `git diff --check` bestanden. Quelltypprüfung bestanden**, mit temporärem Prüfprofil auf Basis des aktuellen Projekt-tsconfig und ohne gemeinsame Cacheänderungen.
7. Normale Projekt-Typprüfung weiterhin durch die bereits bekannten generierten Duplikate in `.next/dev/types/routes.d 2.ts` blockiert: doppelte `LayoutProps` und abweichende `RouteContext`-Definitionen. Keine neuen Quelltypfehler; keine Bereinigung dieser gemeinsamen Dateien und kein Produktionsbuild.

### Übergabe und verbleibende Angaben

Der Parserfehler ist geschlossen. Für Dokumentübernahme und AI-TEST-01 können nun die unveränderten Originalbytes verwendet werden; die Mai-Notizen müssen nicht mehr manuell bereitgestellt werden. Bereits früher eingelesener und im Browser gespeicherter Grundtext wird durch eine Parseränderung nicht automatisch ersetzt: Für diesen Bestand das Dokument erneut einlesen. Diese Prüfung hat keine echte Browsermigration durchgeführt.

Persönliche Stationsgrenzen, tatsächliche Kurs-/Besprechungsdauern und die echte Modellabnahme bleiben getrennte offene Punkte. Sie haben PLAN-B nicht blockiert und wurden durch die Reparatur weder erfunden noch fachlich bestätigt. Keine bezahlten Modellaufrufe, externen Uploads oder Nachrichten an andere Chats. Zentrale Planungstexte bleiben beim Planungschat; DATA-B-Schreibbereiche wurden nicht berührt.
