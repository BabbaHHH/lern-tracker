# Codeprüfung und Reparaturen

Stand: 9. Oktober 2026. Geprüft wurde die lokale Next.js-Anwendung `lern-tracker`; bereits vorhandene Änderungen wurden weitergeführt. Dies ist eine technische Prüfung mit Regressionstests, keine vollständige Garantie der Fehlerfreiheit oder Freigabe für Mehrbenutzerbetrieb.

## Lernplanung

### Gefundene Ursachen übervoller Tage

1. Startseite und Wochenplan ergänzten automatisch Aufgaben nach verschiedenen Regeln. Die Startseite ergänzte teilweise drei Themen ohne Abzug bereits belegter Stunden.
2. Klausur-Kalendereinträge und konkrete Klausuraufgaben wurden gleichzeitig als jeweils fünf Stunden gezählt.
3. Die Tagesgrenze stand im KI-Prompt, wurde bei Übernahme aber nicht durchgesetzt.
4. Feste Skizzen-/Nachbereitungsannahmen unterschieden sich zwischen Prompt, Kontext und Anzeige.
5. Geänderte Dauern wiederkehrender Termine wurden bei vorhandenen Aufgaben nicht aktualisiert. Alte Vorbereitungsaufgaben konnten liegen bleiben.
6. Stunden aus Titeln, gespeicherte Minuten und pauschale Schätzungen wurden uneinheitlich behandelt.
7. Der Wochenkalender zeigte nur sechs Tage und berücksichtigte den im Profil eingestellten freien Tag nicht durchgehend.
8. Ein gewöhnliches Abhaken protokollierte ohne ausdrückliche Dauer pauschal 30 Minuten. Beim Klausur-Abhaken konnte ein zusätzlicher Theorieeintrag entstehen.

### Neue Regeln

- `day-budget.ts` ist die gemeinsame Grundlage. Minuten haben Vorrang; alte Titel wie `(1,5 h)` bleiben lesbar. Unplausible Zahlen erzeugen keine negativen oder ungültigen Budgets.
- Die Stundenanzeige nennt tatsächlich geplante Belastung und persönliche Grenze. Noch nicht ausgewählte Skizzen sind ein gesonderter Vorschlag.
- `learning-planner.ts` verteilt offene KI-Aufgaben in freie Zeit. Eigene Aufgaben, feste Termine und erledigte Arbeit bleiben bestehen. Ein tatsächlicher Konflikt wird angezeigt.
- Startseite und Wochenplan nutzen `prepareLearningDays`. Wiederholtes Öffnen erzeugt keine zusätzliche Tageslast.
- Die automatische Korrektur betrachtet zunächst 90 Tage; neue KI-Pläne können beim Übernehmen bis zu vier zusätzliche Wochen für Verschiebungen nutzen, spätestens bis zum Tag vor dem Examen. Aufgaben ohne Platz bleiben gespeichert und sichtbar.
- Planübernahme validiert Typen, Daten und Dauern. Leere/ungültige/vergangene Pläne dürfen vorhandene Arbeit nicht löschen. Bei einem Schreibfehler wird der vorherige Zustand wiederhergestellt.
- Undo stellt Aufgaben, Kalender, Planbereich und die übernommenen Stations-/Onboarding-Angaben wieder her, sofern danach niemand daran geändert hat.
- Wiederkehrende Termine verwenden Profil-IDs. Änderungen von Dauer, Wiederholungsrhythmus und AG-Wochentag werden berücksichtigt. Bei mehreren gleichzeitig aktiven AGs erfolgt die Bearbeitung im Profil.
- Kernaufgaben belegen die Zeit vor optionalen Skizzenvorschlägen. Auch bei einer Tagesgrenze von zwei oder fünf Stunden werden passende 90-Minuten-Sprints angeboten, wenn Platz ist.

### Stationsplanung und Perspektiven

- `study-phases.ts` bildet den mitgebrachten Beispielplan in editierbaren Zeiträumen ab: drei staatliche, drei anwaltliche und anschließend gemischte Abschnitte. Halbmonate, Jahreswechsel und Schaltjahre sind berücksichtigt.
- Ungültige oder überlappende Abschnitte werden nicht zur Themenauswahl verwendet. Der Editor meldet sie; Lücken bleiben gemischte Zeiten.
- `auto-picker.ts` verwendet Gebiet, Perspektive, Lernblock und Fortschritt. Der Schwerpunkt enthält einen regelmäßigen Wiederholungsanteil. Die Sprints bleiben innerhalb der Tageskapazität.
- Geänderte Phasen aktualisieren ausschließlich offene zukünftige automatische Vorschläge. Erledigte Aufgaben und eigene Arbeit werden nicht ersetzt. Bereits übernommene KI-Pläne brauchen eine ausdrückliche Neuplanung.
- Die Klausur-Hauptempfehlung bevorzugt einen passenden Klausurtyp im Schwerpunktgebiet. Ein konkretes Kalendergebiet hat Vorrang; der Empfehlungscache berücksichtigt die Phase. Die KI kann ihre Auswahl nur aus den vorausgewählten Kandidaten treffen.
- Tagesprogramm, Wochenkalender und Planansicht zeigen den Ausbildungsabschnitt. Neue KI-Pläne erhalten die Zeiträume, Perspektiven und täglichen Lernblockgrenzen im Kontext.

### Grenzen der jetzigen Planung

- Die Tagesgrenze ist eine Arbeitszeitgrenze, noch keine Planung mit Uhrzeit, Pausen oder Arbeitswegen.
- Feste Verpflichtungen allein können über der Grenze liegen. Das wird sichtbar; der Code kann reale Termine nicht eigenmächtig absagen.
- Probeexamen-Startdaten sind noch kein exakter Klausurkalender. Konkrete Klausurtage gehören als Kalendertermine erfasst; die Weiterentwicklung ist im Projektplan beschrieben.
- Kalendertermine ohne Dauer verwenden Standardwerte. Zugeordnete Klausuren werden anhand ihrer Slot-/Klausur-ID einmal gezählt; ältere unzugeordnete Einträge verwenden weiterhin eine Zuordnung nach Tagesanzahl.
- Die anwaltlichen AG-Grenzen der freiwilligen Beispielvorlage sind Näherungen. Persönliche Stationsdaten aus dem normalen Dokument-Onboarding haben Vorrang. Die feste 80/20-Vorgabe und erfundene pauschale Arbeitsaufträge wurden aus dem KI-Default entfernt.
- Planung nach dem schriftlichen Examen bleibt offen. Themenwiederholungen mit echten Fälligkeiten aus der Lernhistorie sind eingebaut; kürzere Review-Slots und Anki-Anbindung bleiben spätere Schritte.

## Datenspeicherung und Bedienung

- Aktuelle Texte beim verzögerten automatischen Speichern verwenden; offene Änderungen beim Verlassen der Schreibansicht sichern.
- Speichern meldet Fehler, statt bei vollem/gesperrtem Browserspeicher Erfolg vorzutäuschen.
- Backup umfasst auch Planbereich und Promptanpassungen. Fehler beim Import setzen bereits ersetzte Bereiche zurück.
- Countdown arbeitet mit Kalendertagen, berücksichtigt fehlende und vergangene Daten und startet nicht mit einem fremden festen Prüfungstermin.
- Abgebrochene/ersetzte KI-Anfragen dürfen spätere Antworten nicht in einen anderen aktiven Vorgang schreiben.
- Fehlerhafte KI-Marker und reservierte Objektschlüssel werden verworfen.
- Die zugrunde liegende Speicherung bleibt lokal im Browser. Es gibt noch keinen Geräteabgleich und kein Benutzerkonto. Importprüfung ist keine vollständige Validierung sämtlicher historischer Unterobjekte.

## Datei- und KI-Schnittstellen

- PDF-Dateien werden über einen geprüften Namen in einem privaten Stammordner aufgelöst. Pfadwechsel und aus dem Ordner herausführende symbolische Verknüpfungen sind gesperrt.
- Öffnen in Vorschau verwendet Argumentübergabe ohne Shell-Auswertung.
- Herkunft/Host werden geprüft; standardmäßig nur lokale Zugriffe. Lokales Netzwerk ist nur über ausdrücklich eingetragene Adressen vorgesehen.
- Im Produktionsmodus sind die sensiblen API-Routen vorläufig gesperrt. Diese Grenze ist kein Ersatz für Benutzerkonten und macht aus dem Projekt noch keine veröffentlichbare Plattform.
- Begrenzte Anfragegrößen, lokale Anfrageraten, validierte KI-Parameter, Abbruch und Zeitlimits.
- `pdf-parse` wurde an die tatsächlich installierte Version 2 angepasst. Tests verwenden echte kleine PDF-, DOCX-, XLSX- und XLS-Dateien.
- Aktueller Import: höchstens 4 MB, PDF-Text aus höchstens 100 Seiten, höchstens 15.000 Textzeichen im Ergebnis. Gescannten PDFs fehlt ohne Texterkennung ein auslesbarer Text. Für Onlinebetrieb braucht die Verarbeitung zusätzlich Isolation gegen besonders aufwendige Dateien/komprimierte Daten.

## Abhängigkeiten und Start

- Next.js / zugehörige ESLint-Konfiguration auf 16.4.0 aktualisiert; kompatible Paketupdates eingespielt.
- Die große, zur Laufzeit unnötige shadcn-CLI-Abhängigkeit entfernt. Benötigtes CSS lokal mit MIT-Lizenztext abgelegt.
- Schriftdateien lokal eingebunden; kein Google-Fonts-Abruf beim Build.
- Veraltetes npm-`xlsx` durch die offizielle SheetJS-Distribution 0.20.3 ersetzt. Hintergrund: [offizielle Installationshinweise](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
- Lokaler Start beendet keine fremden Prozesse mehr. Host ist standardmäßig nur die Loopback-Adresse.
- Der Standardbuild verwendet Webpack. Turbopack scheiterte in dieser Umgebung beim Aufbau eines Hilfsprozesses; daraus folgt kein Nachweis eines Anwendungsfehlers.
- Doppelte automatisch erzeugte Typdateien in `.next` wurden entfernt, damit TypeScript nicht identische Definitionen zweimal lädt.

### Noch offene Meldungen der Paketprüfung

Die aktuelle `npm audit`-Abfrage meldet **8 betroffene Pakete: 5 hoch, 3 mittel, keine kritisch**. Das sind Abhängigkeitsketten zu zwei zugrunde liegenden Meldungen:

| Ursprung | Betroffene Kette | Einordnung |
|---|---|---|
| `braces <= 3.0.3` | `micromatch` → `fast-glob` → Next-ESLint-Plugin | Entwicklungs-/Lintwerkzeuge; keine Verarbeitung von Nutzerdateien über diese Kette vorgesehen |
| `sprintf-js <= 1.1.3` | `argparse` → `mammoth` | Abhängigkeit des Mammoth-Kommandozeilenprogramms; der verwendete `extractRawText`-Pfad lädt `argparse` nicht |

Die automatisch angebotenen Korrekturen waren hier Downgrades auf Next-ESLint 14 bzw. Mammoth 0.3.29. Sie wurden wegen der damit verbundenen Inkompatibilität nicht angewendet. Vor Veröffentlichung erneut prüfen und verfügbare kompatible Korrekturen übernehmen. Die Meldungen werden nicht als behoben ausgewiesen. [braces-Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [sprintf-js-Advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)

## Neue Verbindungen und Rückmeldung

- Das normale Onboarding übergibt jetzt die tatsächlich ausgelesenen Dokumenttexte. Erkannte Abschnitte und Termine erscheinen mit Quelle vor der Planübernahme. Eine gesonderte Stationsplan-Aktivierung entfällt; abweichende Wünsche bleiben möglich.
- Der fortlaufende Klausurenkurs wird über alle Stationen berücksichtigt. Schreibtermine, Besprechungstermine, Themenlisten und persönliche Lernvorschläge erhalten unterschiedliche Bedeutung.
- `spaced-repetition.ts` leitet Fälligkeiten aus der Historie und ausdrücklichen Abrufbewertungen ab. Ein SM-2-ähnlicher Themenalgorithmus; keine Anki-Kartensynchronisation oder FSRS-Implementierung.
- Klausurzuordnung, tatsächliche Lernhistorie und Rückgängigmachen sind mit dem Lernkalender verbunden. Speicherung von Klausurabschluss, Aufgaben und Fortschritt erfolgt gemeinsam mit Rücksetzung bei Fehlern.
- ICS mit stabilen IDs, korrekten Datumsgrenzen, Zeichenmaskierung und Unicode-Zeilenumbrüchen. Dateiexport ist eine Momentaufnahme; automatisches Ersetzen beim erneuten Import ist noch keine garantierte Funktion. Die Oberfläche materialisiert wiederkehrende Termine für höchstens 400 Tage pro Export.
- Feedbackformular auf allen Seiten und lokale Übersicht unter `/feedback`; keine automatische Codeänderung aus einer Nutzermeldung. Produktionsbetrieb benötigt zuerst Konten und Freigaben.

## Verifikation

- `npm run check`: Lint, TypeScript und **69 automatisierte Tests** erfolgreich.
- Produktionsbuild erfolgreich: **22 Routen**. Separater Ausgabeordner; der normale Entwicklungsserver wurde nicht beendet. Die historische Testanzeige fehlt im Produktions-HTML.
- Browser mit getrenntem lokalen Profil: Testfeedback erfolgreich gespeichert und in der Übersicht gelesen; ICS-Erstellung bestätigt. Kein tatsächlicher Kalenderimport in ein Drittprogramm.
- Historischer Onboardingtest am **8. April 2026**: sechs echte PDF-/Excel-/Word-/Textdateien vollständig eingelesen und mit ihren Originaldaten in der Promptvorschau vorhanden. Prüfungstermin 1. September 2026 ist eine Testannahme.
- `npm run test:documents`: tatsächliche Originaldateien durch App-Parser und Planungskontext; unabhängig geprüfte 18 Kurs-, 12 Schreib- und 12 Besprechungstermine durch Planübernahme, Zeitbudget, Verschieben, ICS und Undo. Keine Sprachmodellantwort wurde damit bewertet.
- Die Testunterlagen belegen keine verlässlichen persönlichen Stationsgrenzen. Ein tatsächlicher Stationsplan und bestätigte Termindauern fehlen für die fachliche Abnahme.
- Die KI-Verbindung war in den Tests ausgeschaltet. Kein kostenpflichtiger Aufruf und keine Übertragung der Dokumenttexte an einen KI-Anbieter.

Details, Quellenbefunde, Wiederholbarkeit und nächste Abnahme: [Historischer Dokumenttest](./HISTORISCHER_DOKUMENTTEST.md). Die frühere [Stationsansicht](./stationsplan-testwoche.jpg) zeigt einen älteren Teststand; die aktuelle [Onboardingansicht](./historischer-onboardingtest.jpg) dokumentiert die echte Dateiübernahme.

Die Tests decken Doppelzählung, Überlastung, freie Tage, Verschieben, verbleibende Aufgaben, Terminänderungen, Planübernahme/Undo, Speicherfehler, Klausurtracking, Parser und API-Zugriffssperren ab. Dazu kommen Stationen/Perspektiven, Wiederholungsfälligkeiten und Abrufbewertungen, eindeutige Klausurzuordnung, ICS-Format, Feedbackspeicherung und ein konsistentes historisches Referenzdatum. Im Produktionsmodus ist die Testuhr ausgeschaltet.

## Lokal weiterarbeiten

```sh
npm ci
npm run dev
```

Vorhandene `.env.local` behalten. Neue Installationen nutzen `.env.example` als Vorlage und eigene Zugangsdaten. `PDF_BASE_PATH` zeigt auf den privaten Dokumentordner. Für Prüfung und Build:

```sh
npm run check
npm run build
```

`npm start` zeigt den Produktionsbuild; die sensiblen API-Funktionen bleiben dort derzeit absichtlich gesperrt. Für vollständige persönliche Nutzung ist zunächst der lokale Entwicklungsstart vorgesehen.
