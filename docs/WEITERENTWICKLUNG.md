# Stex Tracker: persönlicher Lernplan und geschlossener Pilot

Stand: 9. Oktober 2026. Hosting als geschlossene Website ist gewählt; der Anbieter bleibt offen. Die Seite ist noch nicht veröffentlicht. Neue Entscheidungen, offene Gespräche und Arbeitspakete stehen in der [aktuellen To-do-Liste](./TODO.md).

## 1. Empfehlung

Zuerst den reparierten Lernplan einschließlich Stationsplanung persönlich erproben. Danach eine kostenlose, geschlossene Webversion für eine kleine Gruppe von Referendaren aufbauen. Du lädst Personen ein und schaltest sie einzeln frei. Möglichst keine laufenden Kosten und wenig Wartung sind die Vorgaben für die spätere Anbieterwahl; ein kleiner eigener Server bleibt eine Option. Zahlungen gehören derzeit nicht zum vorgesehenen Funktionsumfang.

Die App enthält bereits Themen, Fortschritt, Kalender, Klausurenverwaltung, einen Schreibbereich und KI-Funktionen. Ihre Daten liegen überwiegend im jeweiligen Browser. Der geprüfte Ordner `Klausuren_Komplett` umfasst derzeit ungefähr 2,1 GB, 500 PDFs und 193 JSON-Dateien. PDFs, ergänzende Metadaten und Programmcode brauchen getrennte Speicher- und Freigaberegeln.

## 2. Bereits umgesetzt

- Eine gemeinsame Berechnung der Tagesbelastung für Startseite, Wochenplan und KI-Kontext.
- Einstellbare Tagesgrenze, zunächst 7 Stunden, einschließlich fester Termine und Vor-/Nachbereitung.
- Automatische Aufgaben werden nur bei ausreichendem Platz ergänzt. Urlaub und freier Wochentag werden berücksichtigt.
- Neue KI-Pläne werden beim Übernehmen geprüft. Zu volle Tage werden entzerrt; nicht unterbringbare Aufgaben bleiben unter „Noch einzuplanen“ erhalten.
- Bereits bestehende unerledigte KI-Aufgaben werden beim Öffnen von Startseite oder Lernkalender für die kommenden 90 Tage überprüft. Historie und selbst eingetragene Termine werden nicht zur Verschönerung der Stundenanzeige gekürzt.
- Eine konkrete Klausur und ihr zugeordneter Kalendereintrag verbrauchen ihre Zeit einmal. Skizzenvorschläge werden getrennt von tatsächlich geplanten Stunden angezeigt.
- Geänderte AG-/Rep-Dauern aktualisieren bestehende offene Aufgaben. Vorbereitungsaufgaben an Bereichsgrenzen und Lerngruppen-Duplikate werden korrekt behandelt. Wiederkehrende Termine nutzen die ID ihres Profileintrags.
- Bei einer einzelnen aktiven AG verändert der Wocheneditor auch die tatsächlichen Aufgaben. Bei mehreren gleichzeitig aktiven AGs erfolgt die Zuordnung über das Profil.
- „Rückgängig“ stellt auch ersetzte Aufgaben und den vorherigen Planbereich wieder her. Zwischenzeitliche Änderungen werden vor Überschreiben geschützt.
- Sicherheitsgrenzen für lokale Datei- und KI-Schnittstellen, reparierter PDF-Import, robustere Textspeicherung und Backup-Wiederherstellung, aktualisierte Abhängigkeiten.
- Editierbare Ausbildungsabschnitte mit staatlicher und anwaltlicher Perspektive, passenden 90-Minuten-Sprints, Wiederholungsanteil und Anzeige des aktuellen Lernblocks.

Details und Prüfergebnisse: [CODEPRUEFUNG.md](./CODEPRUEFUNG.md).

## 3. Der normale Ablauf der Lernplanerstellung

Die Stationsplanung ist jetzt der Standard des normalen Onboardings. Niemand muss eine zweite Funktion aktivieren. Die persönliche PDF und alle weiteren datierten Unterlagen werden im vorhandenen Dokumentenschritt hochgeladen.

| Schritt | Eingaben und Verarbeitung |
|---|---|
| 1 · Grunddaten | Prüfungstermin, Lernstart, Tagesgrenze und freier Wochentag. Stationsplanung ist vorausgewählt; eine ausdrücklich abweichende Planung ist möglich. |
| 2 · Termine | Bereits bekannte AG, Rep, Lerngruppe, Urlaub und weitere Verpflichtungen. Manuelle Angaben haben Vorrang vor doppelten Dokumentterminen. |
| 3 · Lernstand | Selbsteinschätzung, vorhandener Fortschritt und tatsächliche Lernaktivitäten. |
| 4 · Dokumente | Persönlicher Stationsverlauf, AG- und Rep-Pläne, fortlaufender Klausurenkurs und sonstige datierte Unterlagen. Tatsächlichen Text einlesen, Fehler oder Kürzung sichtbar melden, Text prüfen bzw. ergänzen. |
| 5 · Plan erstellen und prüfen | Derselbe KI-Aufruf bekommt Dokumenttexte, Termine, Lernstand, verfügbare Stunden und Wiederholungsfälligkeiten. Erkannte Abschnitte und Termine erscheinen mit Quelle vor der Übernahme. |

**Gefundener Fehler:** Der Upload speicherte den ausgelesenen Text bereits, aber der zentrale Planungskontext übergab vor allem Dateinamen und Kurzbeschreibungen. Jetzt enthalten Onboarding und spätere Plananpassungen die tatsächlichen Texte. Eine eigene zusätzliche KI-Auswertung der Stationen ist nicht erforderlich.

Bei „Übernehmen“ werden eindeutig datierte `studyPhases` und `appointments` aus der strukturierten Antwort zusammen mit den Lernaufgaben gespeichert. Ungültige Zeiträume, Überschneidungen und fehlende Quelldateien blockieren die Übernahme. Die Stunden der Termine werden vor den Lernblöcken berücksichtigt. Bei Speicherfehlern wird der vorherige Zustand wiederhergestellt. „Rückgängig“ auf der Planseite umfasst auch die übernommenen Abschnitte und Dokumenttermine.

### Ausbildungsabschnitte und Lernaufgaben

Der **Klausurenkurs begleitet die gesamten zwei Jahre**, einschließlich staatlicher und anwaltlicher Stationen. Ein späterer Intensivkurs oder Tauchen ist kein Beginn sämtlicher Klausurpraxis. Übernommen werden tatsächliche Klausurtage; aus einer bloßen Übersicht werden keine konkreten Wochentage erfunden.

Staatliche und anwaltliche Perspektive bestimmen passende Themen und Klausurtypen. „Arbeitsform“ ist keine amtliche Kategorie. Die zuvor pauschal an jeden automatisch ausgewählten Inhalt angehängten Gerichts-/Mandantenaufträge wurden entfernt. Der KI-Prompt soll aus den konkreten Unterlagen und dem Lernstand ein sinnvolles Bearbeitungsziel formulieren. Automatische Ersatzvorschläge ohne KI zeigen zunächst den tatsächlichen Themennamen.

Deine Februar-PDF bleibt als **freiwillige, manuell prüfbare Beispielvorlage** hinterlegt: zunächst 4 Monate Zivil, 3½ Monate Straf, 3½ Monate Verwaltung; später anwaltliche AG-Schwerpunkte und gemischte Vorbereitung. Die grob verteilten anwaltlichen Unterblöcke sind Schätzungen. Persönliche Dokumentdaten sind die maßgebliche Grundlage. Ausbildungsstation und AG-Schwerpunkt können auseinanderfallen; überlappende AGs dürfen keine überlappenden Stationsabschnitte erzeugen.

Innerhalb eines Abschnitts werden Lernblöcke von höchstens 14 Tagen angezeigt. Abschnittswechsel starten einen neuen Block. Freie Tage, reale Termine und verfügbare Stunden haben Vorrang. Fällige Wiederholungen gehen vor neuen automatischen Vorschlägen; die übrige Themenrotation behält einen Anteil anderer Rechtsgebiete. Eine pauschale 80/20-Quote ist keine verbindliche Vorgabe für den KI-Plan.

### Grenzen der Dokumentauswertung

Aktuell: PDF/DOCX/TXT/MD/CSV/XLSX/XLS, höchstens 4 MB pro Datei; bis zu 100 PDF-Seiten und 15.000 Zeichen je Datei. Der Planungskontext hat zusätzlich ein gemeinsames Textbudget. Kürzungen werden gekennzeichnet. Ohne OCR kann ein Scan keinen Text liefern; der Text kann im Onboarding ergänzt werden. Ein fehlendes Jahr oder Startdatum wird nicht automatisch geraten. KI-Erkennung bleibt ein Vorschlag, der vor Übernahme gegen die persönlichen Dokumente geprüft werden muss. Die tatsächliche Erkennungsqualität mit deinem vollständigen Dokumentensatz wurde noch nicht durch einen bezahlten KI-Aufruf getestet.

Der [historische Dokumenttest](./HISTORISCHER_DOKUMENTTEST.md) verwendet sechs echte Dateien mit Referenztag 8. April 2026. Import und Kontextübergabe funktionieren vollständig. Modell-Erkennung und tatsächlicher Kalenderimport sind noch offen. Die Unterlagen liefern keinen vollständigen persönlichen Stationsverlauf.

## 3a. Feedback und spätere Codeanpassungen

**Jetzt eingebaut:** „Feedback geben“ auf allen Seiten, Kategorie, Freitext und optionaler Name. Seite und App-Version werden mitgegeben; Dokumente, Prompts und Klausurtexte werden nicht automatisch angehängt. Im lokalen Entwicklungsbetrieb speichert der App-Rechner Meldungen als einzelne Dateien unter `private-data/feedback`. Die Übersicht unter `/feedback` ist nur über die lokale Rechneradresse abrufbar. Meldungen können einzeln bzw. gesammelt als JSON gesichert werden. Scheitert das Senden, bleibt der Text im Formular und lässt sich herunterladen.

Das ist noch kein gemeinsamer Onlineeingang für getrennte Installationen. Wenn jeder die App selbst betreibt, liegen seine Meldungen bei ihm. Für einen geschlossenen Onlinepilot erhält Feedback später eine eigene serverseitige Tabelle mit Konto, Status, Zuständigkeit und Antwortmöglichkeit.

**Sinnvoller Ausbau:** Meldung → nachvollziehbarer Fehlerbericht → Änderungsvorschlag in einer getrennten Vorschau → Prüfung/Tests → Freigabe und neue Version. Eine Feedbackmeldung führt derzeit nicht zur automatischen Änderung des laufenden Codes. Als erster kleiner Schritt eignen sich vom Betreiber editierbare Planungsregeln und begrenzte Einstellungen; für echte Codeänderungen braucht es Vorschau, Versionshistorie und Rückkehr zur vorherigen Version.

Ein vorhandenes GitHub-Projekt ist [giscus](https://github.com/giscus/giscus/blob/main/README.de.md): ein Kommentarsystem mit GitHub Discussions. Zum Kommentieren wird eine GitHub-Autorisierung gebraucht. Für Referendare ohne GitHub-Konto passt der eigene einfache Feedbackeingang besser; GitHub Issues können später als freiwillige Übergabe für technische Meldungen dienen. Es wurde kein externes Kommentarsystem angeschlossen und keine Meldung an GitHub gesendet.

## 3b. Klausurdatenbank und Lernkalender

**Jetzt eingebaut:** Ein konkreter Klausurtag kann im Lernkalender über „Klausur zuordnen“ mit einer vorhandenen Klausur-ID verbunden werden. Die zugehörige Aufgabe erscheint im Tagesprogramm. Schreiben und Gelesen/Skizziert werden mit tatsächlichem Datum, Dauer und Bewertung protokolliert. Die Wochenansicht zeigt pro Tag unter „Tatsächlich bearbeitet“ die Lernaktivitäten und Links zur jeweiligen Klausur.

Eine Klausuraufgabe und ihr Termin zählen einmal. Ein ausdrücklich zugeordneter Termin wird nicht durch eine andere am selben Tag geschriebene Klausur abgehakt. Wiederholtes Speichern erzeugt keine zweite Aufgabe. Rückwirkende Einträge in der Klausurdatenbank erscheinen am tatsächlich gewählten Datum. Eine Klausurbewertung ist keine Abrufbewertung einer einzelnen Karte.

**Weiter:** Kursklausuren anhand Kennung und Datum aus Dokumenten mit der Sammlung abgleichen, zunächst als prüfbare Kandidaten. Wiederkehrende Kurstermine in einzelne Klausurtage auflösen. Ist-Dauer zusätzlich zu Soll-Dauer erfassen, Fälle und Nachbereitung sichtbar verbinden, Konfliktbearbeitung verbessern.

## 3c. Export in den privaten Kalender

**Jetzt eingebaut:** ICS-Download im Lernkalender mit wählbarem Zeitraum, Lernaufgaben, festen Terminen und tatsächlicher Historie. Stabile Kennungen, Sonderzeichen, UTF-8-Zeilenfaltung und ganztägige Datumsgrenzen werden nach [iCalendar / RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545) behandelt. Ganztägig bedeutet: Die App kennt bislang keine zuverlässigen Uhrzeiten; im Beschreibungstext steht die geplante Dauer. Freie Notizen und PDF-Inhalte werden nicht exportiert.

**Dateiimport ist keine laufende Synchronisation.** Google dokumentiert ausdrücklich, dass importierte Termine nicht synchronisiert werden. Ein wiederholter Import garantiert auch mit stabilen Kennungen keine vollständige Ersetzung alter Einträge. Für den derzeitigen Ablauf einen eigenen „Stex“-Kalender verwenden und bei Bedarf dessen alten Inhalt vor einem neuen Import ersetzen. [Google-Kalender-Import](https://support.google.com/calendar/answer/37118?hl=de)

**Nächster Ausbau nach Konten/Server:** Ein privater, widerrufbarer Kalender-Abolink je Nutzer. Derselbe Eintrag behält seine Kennung bei Änderungen; entfernte Einträge verschwinden aus dem Feed. Kalenderprogramme aktualisieren ein Abo in eigenen Abständen, daher keine Zusage sofortiger Live-Änderungen. Echte Zweiwege-Synchronisation mit Google/Microsoft wäre eine weitere separate Funktion mit Anmeldung, Konfliktregeln und Berechtigungen.

## 3d. Spaced Repetition und Anki

**Jetzt eingebaut:** Ein einfacher themenbezogener Algorithmus, an SM-2 angelehnt. Der erste protokollierte Lernkontakt macht eine Wiederholung am Folgetag fällig. Im Tagesprogramm lässt sich eine Wiederholung mit „Nochmal / Schwer / Gut / Leicht“ bewerten. Erfolgreiche Abrufe verlängern die Intervalle; „Nochmal“ setzt sie auf einen Tag zurück. Bei „Gut“ wachsen sie zunächst von einem auf sechs Tage und danach mit einem angepassten Faktor. Mehrere Einträge desselben Tages werden nicht als mehrere erfolgreiche Wiederholungstage gezählt.

Fällige Themen belegen vorhandene automatische 90-Minuten-Slots; sie addieren keine Stunden. Der KI-Lernplan erhält dieselben Fälligkeiten. Die Planung wird aus der tatsächlichen Historie abgeleitet: Rückgängigmachen entfernt auch den Effekt auf die nächste Fälligkeit. Ein Prozentwert oder eine Klausurnote beweist keinen erfolgreichen aktiven Abruf. Der jetzige Algorithmus arbeitet auf Themenebene, nicht auf einzelnen Anki-Karten, und ist nicht mit Ankis aktuellem Scheduler gleichzusetzen.

**Nice to have:** Zunächst Themen/Klausuren mit eigenen Anki-Tags verbinden und einen Import/Export erproben. Für eine spätere lokale Verbindung ist [AnkiConnect](https://github.com/FooSoft/anki-connect) ein möglicher Ansatz; das ursprüngliche GitHub-Repository verweist inzwischen auf sein neues Projektarchiv. Das ist keine jetzt eingebaute AnkiWeb-Integration. Kompatibilität, aktuelle Schnittstelle, Leserechte und Zuordnung bestehender Karten müssten im eigenen Anki-Testprofil geprüft werden. Anki-Synchronisation bleibt zurückgestellt.

## 4. Persönliche Nutzung weiter glätten

Vor einer Mehrbenutzerversion sind diese Punkte sinnvoll:

- Einen echten Wochenplan mit deinen Terminangaben durchgehen und geschätzte Dauern nachjustieren. Die automatischen Prüfungen arbeiten mit Testdaten, nicht mit einem vollständigen Abbild deines Browserspeichers.
- Individuelle Tagesbudgets, Pausen und Puffer ergänzen. Die heutige Grenze gilt einheitlich für Lerntage; sie ist Nettoaufwand einschließlich Termine, keine Uhrzeitenplanung.
- Bei festen Konflikten eine konkrete Auswahl anbieten: Vorbereitung verschieben, Termin kürzen, Inhalt in die Folgewoche übernehmen. Feste Termine werden derzeit sichtbar belassen.
- Probeexamina durch ihre tatsächlichen Klausurdaten erfassen. Die zwei Startdatumsfelder im Profil reichen für eine eindeutige Folge von Klausurtagen nicht aus; bislang dienen sie insbesondere als KI-Kontext. Konkrete Kalendereinträge werden im Budget berücksichtigt.
- Für einzelne Kalendertermine eine editierbare Dauer und eine ausdrückliche Verknüpfung zum Profileintrag anbieten. Aktuell gelten bei fehlender Dauer Standardwerte. Klausur-Slots können bereits einer konkreten Klausur zugeordnet werden; die ausdrückliche Verbindung anderer Termine mit Profileinträgen steht noch aus.
- Rückstand übersichtlich bearbeiten: Aufgaben kürzen, teilen, neu terminieren und bewusst streichen. Die aktuelle Liste bewahrt zunächst alles auf, was keinen Platz findet.
- Kurzversion für kleine Bildschirme prüfen und bei mehreren geöffneten Tabs Änderungen synchron anzeigen.

## 5. Hosting gewählt, Anbieter vertagt

**Deine Entscheidung vom 09.10.2026:** Die Plattform soll als Website betrieben werden. Du möchtest möglichst keine laufenden Kosten und wenig Wartung; eine kleine Ausgabe für einen eigenen Hetzner-Cloudserver ist denkbar. Anbieter und Budget werden später entschieden. Die früheren Preisbeispiele sind keine aktuelle Entscheidungsgrundlage.

Jetzt sinnvoll vorzubereiten:

- Konten, persönliche Daten und privaten Dateispeicher unabhängig von einem bestimmten Anbieter gestalten.
- Reproduzierbare Einrichtung, Datenmigration, Sicherung und Wiederherstellung planen.
- PDF-Verarbeitung und größere Importe mit Grenzen und Wiederaufnahme vorbereiten.
- Kosten für Betrieb, Speicher, Sicherungen, E-Mail und KI getrennt begrenzen.
- Programmänderungen mit Tests, Vorschau und Rückkehr zur vorherigen Version veröffentlichen können.

Ein kostenloser Pilot ist ein Ziel; dauerhaft kostenloser Betrieb mit der vollständigen Sammlung ist noch nicht zugesagt. Ein persönlicher Datenexport bleibt vorgesehen. Ein Agent kann Prüfungen und Änderungsvorschläge übernehmen; Betrieb, Sicherungen und Kostensteuerung bleiben Aufgaben des Betreibers. Die konkrete Vorbereitung steht unter HOST-01 in der [To-do-Liste](./TODO.md).

## 6. Konten und persönliche Freischaltung

**Von dir angenommen.** Du verwaltest die Plattform als Administrator und erhältst eine Übersicht über Konten, Nutzung, Fehler, Klausuren und KI-Kosten.

Der genaue Umfang persönlicher Einsicht ist nach deiner jüngsten Rückmeldung vertagt und wird später besprochen.

### Ablauf

1. Du legst eine Einladung für eine E-Mail-Adresse an.
2. Die Person bestätigt ihre Adresse und meldet sich an.
3. Status zunächst `pending`, danach durch dich `active`; später bei Bedarf `blocked`.
4. Nur aktive Konten erhalten Zugriff auf freigegebene Inhalte und Funktionen.
5. Sperren greifen auch bei bestehenden Sitzungen. Administratorrechte sind getrennt von normalem Zugriff.

### Umsetzung

- Eine etablierte Authentifizierung verwenden; keine selbst entwickelte Passwortverwaltung.
- Sitzungen in sicheren Cookies, serverseitige Prüfung bei jedem geschützten Abruf.
- Jede Datenbankabfrage auf die jeweilige Person begrenzen. Die ID kommt aus der geprüften Sitzung, nicht aus frei eingesendeten Formularfeldern.
- PDFs über einen geschützten Abruf oder kurz gültige Links bereitstellen; jeder Abruf prüft Person und Berechtigung. Keine private Sammlung im öffentlichen Webseitenordner.
- Einladung, Freischaltung und Sperrung protokollieren. Administrationsansicht selbst serverseitig schützen.

Zugang zu persönlichen Texten, Uploads und Lernverläufen für Betreuung und Fehlersuche wird ausdrücklich geregelt und protokolliert. Nutzer werden darüber informiert, welche Daten für welchen Zweck zugänglich sind. Eine genaue Wohnadresse oder verdeckte Standortermittlung ist für den bisherigen Zweck nicht nötig; eine Stadtangabe kann freiwillig sein. Transparenz, Zweckbindung und Datenminimierung sind zu berücksichtigen. [Art. 5 und 13 DSGVO](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX%3A32016R0679)

**Abnahme:** Person A kann weder Lernstand noch Texte von Person B lesen; unangemeldete und gesperrte Personen bekommen auch bei direktem PDF-/API-Aufruf keinen Zugriff. Abgelaufene Einladungen und wiederverwendete Tokens funktionieren nicht.

## 7. Nutzung zählen, mit möglichst wenigen Daten

**Grundsätzlich von dir angenommen.** Einzelheiten der Adminübersicht und persönlicher Einsicht stehen als Gesprächspunkt in der [To-do-Liste](./TODO.md).

Für deine Frage „Wie viele nutzen es?“ reichen zunächst:

- Zahl eingeladener, aktiver und gesperrter Konten.
- Zahl unterschiedlicher aktiver Konten in den letzten 7 bzw. 30 Tagen.
- Optional pro Konto das letzte Nutzungsdatum, wenn es für die Pilotbetreuung gebraucht wird.
- Getrennt davon: verbrauchte KI-Kontingente zur Kostenkontrolle.

Ein Aufruf einer authentifizierten Funktion kann die Aktivität einmal pro Tag aktualisieren. Ein Seitenaufrufzähler würde dieselbe Person mehrfach zählen. Eine abgeschlossene Lernsitzung ist eine andere Kennzahl als ein Besuch; diese Begriffe sollten in der Übersicht getrennt sein.

Zunächst keine Aufzeichnung von Tastatureingaben, Klausurtexten oder detaillierten individuellen Lernwegen zu Analysezwecken. Die Adminübersicht braucht für die Nutzungsmessung keinen Zugriff auf persönliche Entwürfe. Zweck, Rechtsgrundlage, Empfänger und Aufbewahrung werden vor dem Pilotstart verständlich dokumentiert. Maßstab für die Information bei Datenerhebung ist unter anderem [Art. 13 DSGVO](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX%3A32016R0679).

## 8. Daten und PDFs trennen

**Grundsätzlich von dir angenommen.** Einfach gesagt: Jede Person bekommt ihren eigenen Lernplan, ihre Texte und ihre Markierungen. Die freigegebenen Klausuren können gemeinsam angeboten werden. Dateien liegen geschützt außerhalb des Programmcodes; eine Berechtigung entscheidet, wer welche Datei sehen darf. So können Updates stattfinden und Geräte synchronisieren, ohne persönliche Daten zu vermischen.

Vorgesehenes Datenmodell:

- `users`: Konto, Rolle, Freigabestatus, Aktivitätsdatum.
- `profiles` und `study_phases`: Termine, Tagesbudgets, Abschnitte.
- `tasks`, `calendar_events`, `tracking`, `topic_progress`: jeweils mit Eigentümer.
- `drafts`: persönliche Texte mit automatischer Speicherung und Versionsstand.
- `documents`: Dateiverweis, Quelle, Rechteinhaber, erlaubte Nutzung, Nachweis, Freigabestatus.
- `document_grants`: Zugriff auf einzelne Dokumente oder Sammlungen.
- Persönliche Onboarding-Uploads mit Eigentümer und Zugriff getrennt vom gemeinsamen Klausurarchiv.
- Persönliche PDF-Markierungen und Leseposition mit Dokument-ID und Dateiversion; Originale bleiben als gemeinsame Quelle erhalten.
- `ai_usage`: Konto, Funktion, Verbrauch und Kontingent; standardmäßig ohne vollständige Nutzereingaben.

Migration: lokales Backup erstellen, Struktur validieren, Vorschau zeigen, pro Konto importieren, Anzahl und Stichproben vergleichen. Alte Browserdaten erst dann freiwillig entfernen. Datenbank und Dateien getrennt sichern und gemeinsam auf einem leeren Testsystem wiederherstellen.

## 9. Dokumentrechte: laut dir geklärt

**Deine Rückmeldung vom 09.10.2026:** Die Rechtefrage ist geklärt und für den vorgesehenen Einsatz in Ordnung. Das wird als Projektentscheidung übernommen; eine eigene erneute rechtliche Prüfung wurde hier nicht vorgenommen.

Für die technische Umsetzung Herkunft, freigegebene Materialien, erlaubten Personenkreis und Umfang der Freigabe hinterlegen. Diese Angaben steuern später Zugriff und Import. Die frühere allgemeine Rechteklärung bleibt kein offener Arbeitspunkt.

## 10. Reihenfolge bis zu einem Pilotbetrieb

| Etappe | Ergebnis | Erledigt, wenn … |
|---|---|---|
| A — Lernplan stabilisieren | Aktueller Fixstand persönlich erprobt | Wochenlast plausibel; Konflikte, freie Tage und Verschiebungen nachvollziehbar |
| B — Dokumente, Wiederholung und Rückmeldung erproben | Standard-Onboarding, prüfbare Abschnitte/Termine, Feedback, Klausurhistorie und ICS sind eingebaut | Persönliche Dokumente richtig erkannt; Wiederholungen plausibel; Testmeldung angekommen; Kalenderimport in separatem Testkalender geprüft |
| C — Konten und Datentrennung | Einladung, Freigabe, Sperre; Daten pro Nutzer | Zugriffs- und Isolationstests bestanden, Datenmigration geprüft |
| D — Dokumentzugriff und Import | Kleine freigegebene Testsammlung, Viewer und geprüfter manueller Import | Abrufe geschützt; Lesen auf den Zielgeräten; keine Dubletten oder verlorene persönliche Historie |
| E — Betrieb und Kosten | Server, HTTPS, Backups, KI-Kontingente | Wiederherstellung getestet, Kostenlimit greift, kein Geheimnis im Client |
| F — Pilot mit 3–5 Personen | Wenige Wochen echte Nutzung und Feedback | Fehler gesammelt, Nutzungszahlen aussagekräftig, Aufwand überschaubar |

Der echte Dokumentimport aus Etappe B wurde mit historischem Referenztag bereits geprüft; Details und verbleibende Abnahme stehen im [Dokumenttest](./HISTORISCHER_DOKUMENTTEST.md). Tatsächlichen Stationsplan und Termindauern ergänzen, Kalenderimport erproben und Konten/Datentrennung sowie manuellen Klausurimport vorbereiten. Ein echter KI-Probeplan wartet auf Credits und ein begrenztes Testbudget; das hält die übrigen Vorbereitungen nicht auf. Ein Onlinepilot setzt C–E voraus.

Alle 2–3 Wochen soll ein automatischer Prozess die Modellklassen prüfen und geeignete Aktualisierungen vorbereiten. PDF-Markierungen, Downloadregeln, Portalaktualisierung und Feedback mit möglichen Codevorschlägen sind aufgenommen. Anki und eine größere UI-Überarbeitung bleiben spätere Schritte. Prioritäten, offene Gespräche und Abnahmekriterien stehen in der [To-do-Liste](./TODO.md).

## 11. Letzte Anforderungen vor dem Onlinegang

- Die aktuelle Produktionssperre für sensible APIs wird erst durch echte Sitzungs-, Freigabe- und Quotenprüfungen ersetzt.
- Dokumentparser laufen mit Speicher-/Zeitgrenzen; größere und komprimierte Uploads dürfen keinen gemeinsamen Server blockieren.
- KI kostet pro Konto und insgesamt höchstens das vereinbarte Budget; keine unbegrenzte Modellwahl über eine Clientanfrage.
- Bei fehlenden KI-Credits einen verständlichen Zustand anzeigen; Lernen, Kalender und freigegebene Dokumente bleiben nutzbar.
- Hosting- und KI-Dienstleister, Datenschutzhinweise und Anbieterinformationen sind geklärt.
- Laufzeitabhängigkeiten erneut auf bekannte Sicherheitsprobleme prüfen; offene Befunde behandeln oder dokumentiert begründen.
- Separater Testbetrieb ohne echte Nutzerdaten, Sicherungs- und Wiederherstellungstest, nachvollziehbare Fehlerbehandlung.
- Server und Domain werden erst nach konkreter Anbieter-/Budgetentscheidung eingerichtet. Aktuell wurde nichts veröffentlicht oder bestellt.

## 12. PDF-Nutzung und neue Klausuren

Ein integrierter Viewer mit persönlichen Markierungen sowie guter Bedienung auf iPad und Handy ist vorgesehen. Ob Downloads angeboten, ausgeblendet oder auf 1–2 pro Tag begrenzt werden, ist offen. Eine Downloadquote begrenzt ausdrückliche Downloads; ein PDF-Viewer kann Kopien aus dem Browser oder Screenshots nicht zuverlässig verhindern.

Der alte NotebookLM-Prompt, ein Hamburg-Analyseskript mit JSON-Ausgabe und die KG/Moodle-Downloadwerkzeuge sind gefunden. Sie brauchen einen gemeinsamen aktuellen Importvertrag, Dokumentversionen, Prüfung und Vorschau. Die Aktualisierung aus Portalen und der Umgang mit persönlichen Anmeldungen werden später besprochen; manueller Import wird zuerst vorbereitet. Fundstellen und Ablauf stehen in Abschnitt 7 der [To-do-Liste](./TODO.md).

**Klarstellung:** Rund 450 Klausuren sind bereits klassifiziert. Die Bestandsdaten werden erhalten; der Hinweis auf ältere Kennungen betrifft den alten NotebookLM-Prompt für zukünftige Importe. Geplant ist zusätzlich eine Suche im tatsächlichen PDF-Volltext, später ergänzt um semantische Suche/RAG. Pilotnutzer sollen zunächst Niklas' begrenztes KI-Kontingent und später eigene auswählbare OpenRouter-Schlüssel verwenden können. Details: SEARCH-01 und AI-KEYS-01 in der To-do-Liste.
