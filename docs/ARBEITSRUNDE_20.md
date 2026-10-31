# Arbeitsrunde 20 – DATA-C3a: Aufgaben, Kalender und Lernhistorie

Stand: 13.10.2026, Koordinationscheck 22:00 Uhr. Niklas' direkte lokale Koordinationsbeauftragung und 30-Minuten-Heartbeat gelten fort. Modellangaben sind Empfehlungen; kein automatischer Modellwechsel. Nur bedeutende Änderungen melden. Echte Bestandsmigration, bezahlte/providerseitige Aktionen, externe Dokument-/Mailübertragungen und Veröffentlichung bleiben separat freizugeben.

**Versand:** DATA-C3a am 13.10.2026 direkt an den vorhandenen Chat 02 gesendet; bestehende Modelleinstellungen erhalten.

## Abgeschlossene Voraussetzungen und Ergebnisreview

DATA-C1/C2, SEARCH-A1 und AUTH-A-R1 bleiben abgeschlossen. AI-KEYS-A einschließlich R1 wurde am 13.10.2026 lesend übernommen: Credential-Kontextvertrag v2, Konto-/Loginbindung vor Providerzugriff und innerhalb der Schreibtransaktion, eingefrorene Pilot-Zielrevision, Anfragegenerationen und zweckgebundener Nachweis der vollständigen Wiederholung. Bericht, kritische Code-/Testassertionen und vorhandene Laufoutputs abgeglichen; keine Tests/Builds durch Architektur. R1-Prüfungen laut 08: 1/1 gruppierte echte AUTH-/PostgreSQL-Integration, 2/2 Client-/HMAC-Einträge, gezieltes Lint und isolierte Typprüfung. Browser: synthetischen Schlüssel hinzufügen, ausdrücklich wählen, entfernen und A→B mit geleertem Formular. Keine echte Modell-/Kosten-/Zweitgeräte-/Onlineabnahme.

Migrationen 001–007 vorhanden. **Backupformat 4** ist jetziger Vertrag: Credentialtabellen verschlüsselt vollständig, separate Credential-Verschlüsselungs-/Fingerabdruckgeheimnisse, C1/C2-Belege, private Dateiversionen, Sitzungswiderruf und Such-Neuaufbau erhalten. Ältere Format-3-Sicherungen nur mit passendem damaligem Code/Schema auf getrenntes leeres Ziel; nicht still über neue Daten restaurieren. Normale Nutzerinstanz und echter Browserbestand wurden nicht migriert. Gemeinsame generierte Typdubletten/archivierte Beispiele bleiben ein gesonderter Prüfumgebungsbefund; keine fremden Dateien dafür löschen.

08-Reservierung endet mit dieser Ergebnisübernahme. Neuer alleiniger Integrationsbearbeiter **02 DATA**. Kein paralleler Schema-/Backup-/Layout-/Viewerauftrag.

## Begrenzter Umfang C3a und endlicher Anschluss

C3a übernimmt die vier vorhandenen persönlichen Bereiche `tasks`, `calendar`, `tracking` und `ag-weeks`: manuelle Aufgaben/Termine, AG-Wochenkorrekturen, bestätigte Bearbeitung und Lernhistorie. Tatsächliche Monats-/Wochen-/Tagesansichten und Tracking anschließen, keine weitere isolierte Speicherprobe. C1-Fortschritt und C2-Profil/Datumswerte verwenden; gemeinsamer Katalog bleibt gemeinsame Quelle für stabile Klausurbezüge.

**C3b bleibt danach offen:** Planvorschau/Anwendung/Undo, `onboarding-airesult`, `plan-history`, `plan-applied-range`, automatischer Planungs-/Empfehlungs-/Rückstandsumbau und Check-in. Dazu gehört die fachliche Quellterminnacharbeit aus 01/05. Noch keine KI-Plananwendung, echten Provideraufrufe oder Freigabe dieser Leser/Schreiber. C4 eigene Lösungen und C5 persönliche Dokumente/Einstellungen folgen separat. Diese Teilung begrenzt C3, sie verwirft keinen bisherigen Bereich oder Vertrag.

## Eindeutiger Dateibesitz

Alle Pfade relativ zu lern-tracker/.

| Bearbeiter | Schreibzuordnung |
|---|---|
| Planung | Zentrale Status-/Architektur-/Koordinations-/Chat-/Runden-/Startdateien, Aufgabenbriefings. |
| 02 DATA-C3a | Neue eigene Module in `src/lib/server/learning/`, `src/lib/learning/`, Routen in `src/app/api/learning/`, neue Account-Aufgaben-/Kalender-/Wochen-/Tracking-/Historienkomponenten. Bestehende Integrationsdateien ausschließlich 02: `src/app/kalender/page.tsx`, `src/app/wochenplan/page.tsx`, `src/app/page.tsx`, `src/components/account-learning-dashboard.tsx`, `src/components/today-program.tsx`, `src/components/tracking-fab.tsx`, `src/components/day-learning-history.tsx`, `src/components/klausur-calendar-link.tsx`, `src/components/calendar-export.tsx`, `src/components/account-learning-boundary.tsx`, `src/app/layout.tsx`, `src/lib/learning/progress-contract.ts`, begrenzter atomarer Fortschrittsanschluss in `src/lib/server/learning/progress-service.ts`, `src/lib/server/persistence/backup.ts`, `.env.example`. Additive Migration ab 008 nur bei tatsächlichem Bedarf und erneut geprüfter freier Nummer. Eigene C3a-Tests/`scripts/data-migration/c3a-*`, DATA-Entwürfe/Ergebnis. Bestehende DATA-/SEARCH-/AI-KEYS-Prüfdateien nur konkret notwendige Schema-/Formatkonstanten; sonst read-only. |
| 01, 03–17 | Kein neuer Schreibauftrag in dieser Runde. KI-Credentials, AUTH, Katalog, PDF und Suche read-only. |

Store/App-Typen, Paket-/Lockdateien, Modell-/Prompt-/KI-Limits und Credentialmodule, Lernplan-Kern (`plan-applier.ts`, `learning-planner.ts`, `auto-picker.ts`, `prompt-context.ts`), Planseite und Checkin bleiben read-only. Reine Datum-/Wiederholungs-/Budget-/Exporthilfen lesend wiederverwenden. Bei konkret fehlender gemeinsamer Datei melden; Planung ordnet sie zu. Keine allgemeine Freigabe zusätzlicher Module.

## Startprompt DATA-C3a

**Modell: GPT-6.1 Sol · Reasoning: High · Geschwindigkeit: Standard.** Empfehlung ohne Umstellung.

Setze jetzt ausschließlich DATA-C3a nach dieser Arbeitsrunde und DATA-C-V § 6 um. C1/C2, SEARCH-A1, AUTH-R1 und AI-KEYS-A/R1 bleiben erhalten; keine abgeschlossene Aufgabe neu starten. Lies Regeln, zentrale Dateien, aktuelles DATA-Briefing und tatsächlichen Arbeitsbaum. Du übernimmst allein die oben benannten gemeinsamen Dateien; 08 ist abgeschlossen. Ausgangspunkt ist der aktuelle uncommittete Stand, kein Worktree allein aus altem HEAD. Keine echten Browserdaten lesen, ändern oder migrieren.

Binde `tasks`, `calendar`, `tracking`, `ag-weeks` kontogebunden an echte PostgreSQL-Fachoperationen und die bestehenden Monats-/Wochenansichten sowie Dashboard-Tagesprogramm und Tracking an. Definiere begrenzte Create/Edit/Delete-/Bearbeitungsoperationen mit bestehenden stabilen IDs/Referenzen und Revisionen. Hydrierung schreibt keine Defaults. Profil/Datum/Stationen ausschließlich aus C2, Themenfortschritt aus C1, Klausurmetadaten aus dem geschützten gemeinsamen Katalog lesen. Notizen/Entwürfe bleiben persönlich; keine zweite Klausurklassifizierung.

`completeTask`, `uncompleteTask`, Aufgabenlöschung samt zugehörigem Tracking sowie Klausur geschrieben/gelesen mit betroffenen Fortschrittswerten werden atomare Fachaktionen, kein nacheinander erfolgender Teilcommit. Bestehende Semantik/Boosts und Unterscheidung written/read erhalten; kein beliebiger neuer Wiederholungsstand. Validierte Dauer/Ratings/Datumswerte, Themen-/Klausur-/Kalenderreferenzen und stabile wiederkehrende Kennungen erhalten. Wiederholte Vorgangs-ID erzeugt kein doppeltes Tracking, keine doppelte Fortschrittserhöhung und keine erneut gelöschte/überschriebene neuere Zeile. Uncomplete/Rücknahme nur mit gültigen betroffenen Revisionen; keine fremden oder unbeteiligten Änderungen überschreiben. Keine verschachtelte neue Repository-Transaktion innerhalb einer offenen Fachaktion.

AUTH-Sitzung bestimmt Besitzer; jeder Write bindet den dargestellten Konto-/Zugangsgenerations-/Sitzungskontext und erwartete Revisionen und prüft nach lockState/checkPrincipal in derselben Transaktion erneut. Stabile private Vorgangsbelege inklusive kompletter fachlicher Eingabe für sichere Wiederaufnahme, gleiche-ID-Konflikte und Antwortverlust. Lese-/Schreib-/Formularzustände, verspätete Antworten, Fokus-/Zurücknavigation und Neuanmeldung wie C1/C2 behandeln; alte A-Aufträge unter B ablehnen. Kein Browserfallback, keine Offlinequeue und keine persönliche Browserpersistenz.

Neue Konto-Komponenten vor dem Mounten von Browser-/Kontopfaden trennen. Freigabe einer Seite erst, wenn sämtliche dort aktiven direkten/indirekten Leser und Schreiber angeschlossen sind, einschließlich Navigation/Helfer/Effekte. Im Account-Dashboard nur die neuen bestätigten Tages-/Historienteile ergänzen. Plananwendung, automatische Empfehlung/Rescheduling, Checkin, Schreibentwürfe, Dokumentupload und übrige C3b/C4/C5-Wege weiterhin klar geschlossen halten. C2-Profil/Countdown/TopicGrid, Katalog/Suche/PDF/Kontoverwaltung/KI-Zugang bleiben erreichbar. Die Browserfassung bleibt erhalten. ICS-Export, soweit in den freigegebenen Kalender eingebunden, aus bestätigten Kontodaten speisen.

Feste vorhandene Quelltermine nicht bei Kapazitäts-/Planungsentscheidungen löschen oder verschieben. Teilnahme und Planung davon getrennt halten; abgeleitete Termine kennzeichnen, unbekannte Dauern nicht erfinden. In C3a keine neue KI-Quellenextraktion oder allgemeine fachliche Parserreparatur. Dokumentbezüge/Quellfelder erhalten, ohne alte Indizes ungeprüft zu neuen IDs umzudeuten.

Migrationen 001–007 unverändert; ab 008 nur tatsächlichen additiven Bedarf umsetzen. Format-4-Sicherung, Credential-Geheimnisse/Tabellen, C1/C2-Belege, private Dateien, Sitzungswiderruf und Such-Neuaufbau erhalten. Neue private Aktionen/Referenzen vollständig sichern. Formatänderung nur mit expliziter Version und begründetem Bedarf; inkompatible alte Sicherungen geschlossen behandeln. Eigene leere synthetische Restoreziele nutzen, normale Nutzerinstanz nicht migrieren/umschalten.

Prüfe nur neue/geänderte C3a-Wege und konkret betroffene Regressionen mit synthetischen A/B-Konten, echten Sitzungen/PostgreSQL und tatsächlichem Browser. Belege manuelle Aufgabe/Termin, AG-Wochenkorrektur, Datum/Wiederholung, Klausurbezug, complete/uncomplete/gelöschtes Tracking, written/read und Fortschrittswirkung, Neuladen/Konflikt/Sperre/Kontowechsel, injizierten Teilfehler, verlorene Bestätigung und gleicher/widersprüchlicher Replay. Künstliche Altbrowserkeys unverändert und geschlossene Altwege nachweisen. Vollsicherung/Restore auf leeres Ziel, neue Anmeldung und sichtbare Lern-/Kalender-/Historiewerte sowie C1/C2/Suche und geschützte Credentials erhalten. Keine echten Schlüssel/Provider-/Modellaufrufe; ggf. rein synthetische Credentialdaten und Mock. Gezielte Typ-/Lintprüfung und isolierter Build; kein fremdes Cacheaufräumen oder pauschaler Projektgesamtlauf. Zwei Tabs sind kein echtes Zweitgerät.

Lege neuen begrenzten C3a-Vertrag, Dateien, tatsächliche Belege und verbleibenden C3b-Anschluss in DATA-Ergebnis/Entwürfen ab. Konkrete Konflikte/fehlende Dateizuordnung früh im eigenen Chat melden, innerhalb zugeordneten Umfangs selbstständig fortfahren. Zentrale Dateien bleiben Planung; keine Nachricht an andere Chats nötig. Kein C3b/C4/C5-Ausbau oder Veröffentlichung. Nach C3a abschließen.

## Check 22:30 Uhr

DATA-C3a weiter aktiv. Additive Migration 008 und Account-Schedule-Module im Arbeitsstand; kein Abschlussbericht und keine fertige Funktionsabnahme. Aufgabenchat meldet gezielte lokale Prüfungen und korrigiert eine synthetische C2-Kennung im Restoretest. Das ist derzeit keine dauerhafte Blockade; keine Tests durch Planung wiederholt. Exklusive Dateizuordnung bleibt 02, kein C3b-/Markierungs-/HOST-Folgeauftrag.

## Check 23:00 Uhr – Koordinationsstand 21

Eigene 21/21 C3a- und 78/78 betroffene Regressionseinträge in vorhandenen Protokollen bestanden; Planung liest sie, startet keine Prüfung. Aufgabenchat hat weitere echte Browserwege geprüft, der Abschlussbericht ist noch nicht vorhanden. Appstatus aktiv mit `waitingOnApproval`; letzter sichtbarer Schritt „Wochenansicht mit Lernhistorie sichern und Kontodatenexport öffnen“. Das Tool gibt den konkreten anstehenden Freigabetext nicht heraus; keine automatische Ablehnung daraus ableiten. Die bestehende Freigabe bleibt Niklas in 02 überlassen; keine zweite Genehmigung im Planungschat oder Umgehung. Dateifenster bleibt 02.
