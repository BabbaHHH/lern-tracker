# Arbeitsrunde 32 – DATA-C5b persönliche Einstellungen

## Aktuelle verbindliche Modellgrenze

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

Stand: 2026-10-17T15:31:25+02:00. **Aktiv nach vollständiger lokaler lesender C5a-Übernahme.** Alleiniger Bearbeiter DATA02 gemäß CHATS.json. Uncommitteter Ausgangsstand mit158 Statuspfaden erhalten. Kein neuer Parallelwriter.

## Bestehender Umfang und Bearbeiter

C5b schließt ausschließlich die übrigen persönlichen Einstellungen aus [DATA-C-V § 6](entwuerfe/DATA-01/DATA-C-V.md#6-endliche-anschlussfolge-und-abdeckung-der-vorhandenen-bereiche). Vorgesehener Bearbeiter ist die dann aktive Zuordnung **02 / DATA-01** aus CHATS.json. Der aktuelle Nachfolger hat noch keinen größeren Auftrag abgeschlossen; Routinechecks und C5a-Fortsetzungen sind keine Rotationsgründe. Vor Versand allgemeine Wechselregel erneut anwenden. Empfehlung **GPT-6.1 Sol · High · Standard**, vorhandene Modell-/Reasoningeinstellungen erhalten; kein Override aus der Empfehlung ableiten.

| Vorhandener Schlüssel | Persönliche Art | Begrenzter Anschluss |
|---|---|---|
| `lerntracker-recommender-weights` | `recommender-settings` | Elf vorhandene Gewichte anzeigen, bewusst ändern/zurücksetzen; vorhandene Namen und Bedeutung erhalten. |
| `lerntracker-theme` | `theme` | Bestehende sechs Farbschemata kontogebunden wählen und sichtbar anwenden. |
| `lerntracker-prompts` | `prompt` | Vorhandene stabile Prompt-IDs lesen; manuelles Bearbeiten und bewusstes Zurücksetzen einzelner Vorgaben. |
| `lerntracker-plan-model` | `plan-model` | Vorhandene lokale Modellauswahl speichern; unbekannte Altwerte erhalten und verständlich ausweisen. |
| `lerntracker-ai-reasoning` | `reasoning-settings` | Vorhandene lokale Modellfähigkeiten und erlaubte Reasoningwerte verwenden. |
| `lerntracker-ai-metrics` | `ai-metrics` | Persönliche Akzeptanz-/Planaktionszähler lesend anzeigen; keine Kostenbuchhaltung oder manuelle Zählerbearbeitung. |

Dies sind vorhandene Inventarbereiche, keine neue Einstellungswelt. Einzelobjekt-IDs und Payloadformen aus tatsächlicher Normalisierung übernehmen. Fehlende Werte nur als ungespeicherte Vorgabe anzeigen; Laden, Anmelden und Öffnen dürfen weder neue Datensätze noch Revisionen erzeugen. Unbekannte Felder/IDs sowie ungültige oder künftig unterstützte Altwerte verlustfrei erhalten und deren Nutzungsgrenze sichtbar machen. Nur bewusst bearbeitete bekannte Felder ersetzen. Kein stilles Wegfiltern oder Überschreiben durch Defaults.

## Tatsächlicher Anschluss und Grenzen

- Eine persönliche Kontoseite, voraussichtlich `/konto/einstellungen`, mit bestätigtem Laden/Speichern, Revisionskonflikt, sicherer Wiederholung und eigenem Vorgangsstatus anlegen. Persönliche Einstellungen nicht in `/konto/verwaltung` verlagern. Die alte Adminseite enthält außerdem fremde Betriebs-/KI-Wege und darf dafür nicht im Kontomodus gemountet werden.
- Farbschemata sind `indigo`, `azure`, `sapphire`, `bordeaux`, `forest`, `graphite`. Aktuell wird ThemeBootstrap im Kontomodus bewusst nicht geladen; es gibt dort noch keinen persönlichen Themeanschluss. Nur bestätigtes Konto-Theme auf das Dokument anwenden. Bei Konto-/Sitzungswechsel alte Anzeige und ausstehende Antworten verwerfen; fehlendes/ungültiges Theme neutral anzeigen. Keine Browserstore-Themehelfer im Kontomodus aktivieren.
- Prompttext, Modellstufe und Kontextauswahl sind Daten. Keine KI-gestützte Promptbearbeitung, Anbieterliste aus dem Netz, neue KI-Anfrage oder Dokumentübertragung. Aktuelle Korrektur-/Check-in-Leser und ihre Quell-, Modell- und Kontextgrenzen erhalten. Insbesondere C4b unterstützt nicht automatisch sämtliche Legacy-Kontextflags; nicht unterstützte Einstellungen ausdrücklich kenntlich machen. Kein zusätzlicher Quellenkontext und keine neue Providerbefugnis durch das Speichern.
- Bestehende zulässige Leser mit den gespeicherten Kontoeinstellungen verbinden. Noch geschlossene Plan-/Empfehlungs-/Quellenwege dadurch nicht freischalten; tatsächliche Verbraucher und verbleibende Anschlussstellen im Bericht nennen. Keine Änderung des Plan- oder Empfehlungsalgorithmus und keine zweite Korrektureinstellungsoberfläche.
- `ai-metrics` enthält `proposalsAccepted`, `proposalsRejected`, `plansApplied`, `plansUndone`. Die bisherige Browserfassung zählt diese an ihren tatsächlichen Bestätigungsaktionen; ein entsprechender Kontoanschluss ist im gelesenen Serverstand noch nicht vorhanden. Für bereits freigegebene Konto-Planübernahme/-rücknahme nur die zugehörigen Zähler atomar im selben bestätigten Fachvorgang einmalig fortschreiben. Replay/Status/Laden zählen nicht; Rücknahme darf zwischenzeitliche andere Zähleränderungen nicht zurücksetzen. Alte Belege nicht umdeuten und keine historischen Zähler hochrechnen. Vorschlagszähler ohne bereits angeschlossene entsprechende Kontoaktion nur erhalten/anzeigen; kein neuer KI-Vorschlagsablauf in C5b.
- Aktive Sitzung, Eigentum, Zugangsgeneration und betroffene Revisionen serverseitig erneut prüfen. Fremde IDs/Ownerfelder ablehnen; Zugriffsverlust während einer Aktion darf weder unberechtigten Commit noch spätere Anzeige alter Kontodaten erlauben. Unbestätigte Bearbeitung nur im Arbeitsspeicher, kein Browserfallback, keine Schlüssel in Payload/Beleg/Export.

## Vorgesehene Dateizuständigkeit nach gesondertem Versand

**Aktives exklusives Schreibfenster für DATA02** nach C5a-Übernahme; keine parallelen Writer an diesen Dateien:

| Bereich | Einziger vorgesehener Bearbeiter / Grenze |
|---|---|
| Neue Settingsmodule | 02: neue `src/lib/learning/settings-*`, `use-account-settings.ts`, `src/lib/server/learning/settings-*`, `src/app/api/learning/settings/**`, Konto-Einstellungsseite/-komponenten und eigene gezielte Tests/Laufhilfen. |
| Konto-/Layoutanschluss | 02: `src/components/account-learning-boundary.tsx`, `src/components/account-profile-page.tsx`, `src/app/layout.tsx`, `src/lib/server/learning/runtime.ts`; nur Navigation, Modusgrenze und bestätigtes Konto-Theme/-Settings. |
| Bestehende Verbraucher | 02: `src/lib/server/learning/correction-context.ts`, `checkin-context.ts`, `plan-service.ts`; nur gleicher privater Einstellungsstand bzw. atomare Planaktionszähler, keine fachliche/Providererweiterung. |
| Schema/Sicherung/Snapshot | 02 allein: bei belegtem Bedarf additive nächste freie Migration ab015, `src/lib/server/persistence/backup.ts`, `repository.ts` und notwendige Datenmigrations-Typ-/Validierungs-/Snapshotadapter. Vorab exakte betroffene Adapter nennen. 001–014 erhalten; keine Migration allein für die neue Runde. Format4 beibehalten, soweit der bestehende Vertrag genügt. |
| Ergebnis und Belege | 02: `docs/ergebnisse/DATA-01.md` und `docs/entwuerfe/DATA-01/`; tatsächliche Quelle, Diff, Prüfungen/Grenzen und eigene Bereinigung dokumentieren. |
| Zentrale Dateien | Planung allein. Alle übrigen Chats ohne neuen Auftrag. |

Auth-/PrivateFiles-/PDF-/Katalog-/Provider-/Schlüsselmodule, alte Browserseiten und `store.ts`, Promptvorlagen, lokale Modellkonfiguration, globale Styles, Pakete/Lockfile bleiben lesend. Reine Konstanten/Typen verwenden, keine Browserleser montieren. Falls ein weiterer gemeinsamer Adapter nötig wird, dessen konkreten Änderungsgrund und Pfad vor Bearbeitung an Planung melden. Aktuellen uncommitteten Stand vollständig erhalten; keine fremden Zwischenstände für einen Prüferfolg ausnehmen.

## Begrenzte Eigenabnahme im Aufgabenchat

Gezielt neue Settings-HTTP-/PostgreSQL-/Clientgrenzen, A/B-/Sitzungswechsel, ungültige Werte, revisionsabhängiges Speichern, Antwortverlust/Replay und Zähleratomarität prüfen. Vorhandene Korrektur-/Planfälle nur dort ergänzen oder ausführen, wo der Anschluss sie tatsächlich ändert. Eigene notwendige Typ-/Lint-/isolierte Buildprüfung zur finalen Quelle zuordnen. Keine pauschale Wiederholung fertiger C1–C5a/PDF/Auth-Prüfungen.

Tatsächliche Kontoseite mit künstlichen Daten sichtbar bearbeiten, neuladen und kontenübergreifende Trennung zeigen; vollständige Sicherung desselben bearbeiteten Bestands in leeres Testziel mit neuer Anmeldung und Vergleich der Settings/Zähler/Belege sowie erhaltener persönlicher Referenzen. Vorlagen-/Kontextgrenzen und sichtbares Theme mitbelegen. Eigene Instanzen/Kopien/Tabs kontrolliert bereinigen; bei konkret blockierter Restprüfung erhalten und genau ausweisen. Automatische Schutzablehnung nicht umgehen. Planung liest Code/Protokolle/Quellenzuordnung/Bilder, führt keine Tests oder Builds aus.

Nach Bericht stoppen. Persönlicher Quellen-/KI-Plananschluss, lokale Gesamtverbindung und späterer Online-/Erstbestandsschritt bleiben die bereits benannten separaten Folgen. Keine echte Bestandsmigration, Schlüsselanlage, bezahlten/externen KI-Aufrufe, Portale, reale Mail, Dokumentübertragung, Veröffentlichung oder neue Automation.


## Fortschreibung 2026-10-17T16:01:32+02:00 — C5b übernommen

C5b/015 im beauftragten lokalen Umfang lesend übernommen: sechs Settingsbereiche, atomare einmalige Planaktionszähler, bestätigtes Konto-Theme und Grenzen vorhandener Verbraucher.288 aktuelle Quellhashes und sämtliche hinterlegten Belegsha passen; Service/HTTP/Client/Theme-/Metrik-/gemeinsame Diffs gelesen. Zehn eigene Grundfälle und ein separater reiner Verbrauchergrenzfall, finale Typ-/Lint-/Buildbelege ihrer Fassung zugeordnet. Derselbe browserbearbeitete Bestand restauriert, neue Anmeldung: neun Tabellen/drei Dateien gleich,32 persönliche Zeilen/27 Belege/13 Referenzen. Theme-/Zählerbilder gelesen; fünf eigene Wurzeln fehlen, vier Ports ohne Listener. Keine Tests/Builds durch Planung, keine echte KI-/Onlineabnahme.

Nächster begrenzter Auftrag allein DATA02: ausschließlich vorhandenen Quellen-/KI-Plananschluss lesend untersuchen und kompakten Umsetzungsvertrag samt exakten Dateigrenzen, Teilschritten und rein lokalen Fake-/synthetischen Prüfungen liefern. Noch kein Produkt-/Schema-/Sicherungs-/Layout-Schreibfenster oder neuer Testlauf. Nach zwei größeren Abschlüssen Rotation geprüft; kein wiederholter Kontextfehler, vor größerer Umsetzung erneut prüfen. Astra ausgeschlossen, Sol zulässig.
