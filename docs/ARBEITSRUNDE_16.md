# Arbeitsrunde 16 – persönliche Kontodaten und offene AUTH-Prüfungen

**Fortschreibung Stand 17:** Niklas hat im Folgeauftrag einen Check alle 30 Minuten und passende neue Aufgaben autorisiert. Heartbeat `stex-projektchats-koordinieren` aktiv. DATA-C2 abgeschlossen, AUTH-A-R1-Abschluss fortgesetzt; aktuelle Zuständigkeiten in [Arbeitsrunde 17](ARBEITSRUNDE_17.md). Frühere Aussagen ohne Automation beschreiben den damaligen Auftrag.

Stand: 13.10.2026. Planung: Chat `01a13510-7d19-74f0-9b34-d4fa3a6df6b9`. Niklas hat diesen Chat direkt zur Koordination der bestehenden Aufgabenchats 01–17 einschließlich lokaler Folgeaufträge beauftragt. Keine wiederkehrende Automation. Modellangaben sind Empfehlungen; beim Senden bleiben die bestehenden Chat-Einstellungen erhalten.

**Versand bestätigt:** DATA-C2 und AUTH-A-R1 am 13.10.2026 direkt an ihre vorhandenen Chats gesendet; keine Modellumstellung. Beide Chats haben den Auftrag angenommen und arbeiten; Abschluss ausstehend.

Modellempfehlung gemäß bestehender Projektzuordnung; GPT-6.1 Sol und High wurden zusätzlich in [OpenAI Docs](https://developers.openai.com/api/docs/models/gpt-6.1-sol) nachgeschlagen. Die Wahl für diese sicherheits-/datenkritischen Teilaufträge ist eine Architekturempfehlung, kein gemessener Projektbenchmark.

## Ziel und Abschlussgrenze

Diese Runde umfasst genau **DATA-C2** und parallel **AUTH-A-R1**. C1 und SEARCH-A1 bleiben abgeschlossen. Keine neue allgemeine Entwurfsrunde. Nächste Integrationsfenster erst nach lesendem Ergebnisabgleich und ausdrücklicher Zuordnung durch Planung. Bezahlte Aktionen, Veröffentlichung, echte Bestandsmigration und externe Dokumentübertragungen brauchen weiterhin Niklas' separate Freigabe.

## Eindeutiger Dateibesitz

Alle Pfade relativ zu `lern-tracker/`. Reservierung endet erst mit dokumentiertem Abschluss oder neuer Zuordnung durch Planung.

| Bearbeiter | Schreibbereich dieser Runde |
|---|---|
| Planung, dieser Chat | Zentrale Status-/Architektur-/Koordinations-/Chat-/Startdateien, `docs/aufgaben/`, dieses Rundendokument. |
| 02 DATA-C2 | `src/lib/learning/`, `src/lib/server/learning/`, `src/app/api/learning/`; C2-spezifische neue Komponenten. Bestehende Integrationsdateien ausschließlich 02: `src/app/page.tsx`, `src/app/onboarding/page.tsx`, `src/components/topic-grid.tsx`, `src/components/countdown.tsx`, `src/components/study-phase-editor.tsx`, `src/components/account-learning-boundary.tsx`, `src/app/layout.tsx`, `src/lib/server/persistence/backup.ts`, `.env.example`. `src/lib/server/auth/service.ts` ausschließlich falls eine eng begrenzte Delegation der bisherigen Notizrouten nötig ist; keine übrige Authänderung. Additive Migration ab 006, sofern fachlich erforderlich und bei Start noch frei. Eigene C2-Tests, `scripts/data-migration/c2-*`, nötige kleine Aktualisierung des vorhandenen Persistenztests, `docs/entwuerfe/DATA-01/`, `docs/ergebnisse/DATA-01.md`. |
| 03 AUTH-A-R1 | Ausschließlich neue `tests/auth-restfaelle.test.ts`, neue Helfer unter `scripts/auth/restfaelle/`, eigene Belege unter `docs/ergebnisse/AUTH-01/R1/`, AUTH-Ergebnis und AUTH-Prüfmatrix. Anwendungs-, Paket-, Schema- und gemeinsame Prüfdateien bleiben read-only. |
| 01, 04–17 | In Runde 16 kein neuer Schreibauftrag. 08/11 warten auf das nächste Schema-/Sicherungsfenster; 10 übernimmt keine Produktionsanmeldung aus seinem alten breiten Vorschlag. |

Migrationen 001–005 unverändert lassen. `store.ts`, `types.ts`, Paket-/Lockdateien, Authkern außerhalb der begrenzten Notizdelegation, Katalog-/Such-/PDF-/Adminbereiche und sonstige Fachseiten bleiben read-only. Bei nötiger Erweiterung konkrete Datei und Grund im eigenen Chat melden; Planung ordnet zu. Keine eigenmächtige Gesamtfreigabe.

Prüfinstanzen mit getrennten temporären Datenbanken, Dateien, Ports, Browser-Tabs und Buildausgaben. AUTH nimmt vor seinen Prüfungen eine gezielte Quellkopie des aktuellen uncommitteten Stands ohne Geheimnisse; kein Worktree nur vom alten HEAD. Keine fremden Prozesse beenden oder generierte Dateien aufräumen. Parallelität erlaubt keine gemeinsamen Laufzeitdaten. Architektur führt keine Tests/Builds aus.

## 02 · DATA-01 — Datenhaltung und sichere Migration

**Modell: GPT-6.1 Sol · Reasoning: High · Geschwindigkeit: Standard.**

### Startprompt DATA-C2

Setze jetzt DATA-C2 gemäß `docs/ARBEITSRUNDE_16.md` und `docs/entwuerfe/DATA-01/DATA-C-V.md` § 6 um. Niklas hat den neuen Planungschat direkt zur Vergabe dieser begrenzten lokalen Aufträge autorisiert. Lies die aktuellen Projektregeln, zentralen Dateien und dein Briefing; prüfe den tatsächlichen Dateistand. DATA-C1 und SEARCH-A1 sind abgeschlossen und werden nicht neu gestartet.

Verbinde Profil, Stationsabschnitte, Examensdatum, Lernstart und Themen-Lernnotizen mit dem angemeldeten Konto. Profil und separate Datumswerte müssen atomar, revisioniert und mit stabilen verschachtelten IDs gespeichert werden. Hydrieren darf keine Defaults/IDs ungefragt persistieren. Verknüpfe TopicGrid mit dem bestehenden C1-Fortschritt und den bereits gespeicherten `learning-entry`-Datensätzen; kein zweiter Notizbestand. Erhalte bestehende Daten, IDs und Referenzen. Sichere Notizvorgänge gegen Wiederholung, verlorene Bestätigung und Kontowechsel ab.

Ergänze im ausdrücklich aktivierten Kontomodus den tatsächlichen Profil-/Stationsbedienweg sowie die angeschlossenen Dashboardteile Countdown und TopicGrid. Teile Browser- und Kontokomponenten vor dem Mounten: Onboarding-Dokumentupload, KI-Planung, Tagesprogramm, Klausurempfehlung, Check-in und andere noch nicht angeschlossene persönliche Leser/Schreiber bleiben dort geschlossen. Auch indirekte Leser in Navigation, Helfern und Effekten berücksichtigen. Die vorhandene Browserfassung bleibt erhalten; keine echten Browserdaten lesen, ändern oder übernehmen. Keine Ausweitung auf C3–C5.

Nutze die aktuelle AUTH-Sitzung und die C1-Verträge für Revisionen, Kontogeneration, Sitzungshinweis und private Vorgangsbelege. Bei Schreiben `lockState` vor `checkPrincipal` in derselben Transaktion. Späte Antworten/alte Aufträge dürfen weder A-Daten unter B anzeigen noch B ändern; kein Browserfallback. Prüfe Revisionskonflikte für Profil und Notizen, erneutes Laden bei Fokus/Neuanmeldung sowie unklare Commitbestätigungen. Alle fachlich zusammengehörigen Änderungen und Belege atomar behandeln.

Du bist alleiniger Bearbeiter der oben 02 zugeordneten gemeinsamen Dateien. Migrationen 001–005 bleiben unverändert; 006 nur bei tatsächlichem Bedarf additiv und nach Prüfung der freien Nummer. Format-3-Sicherung, private C1-Belege, Such-Neuaufbau und Sitzungswiderruf beim Restore erhalten; falls eine Formatänderung erforderlich wird, explizit versionieren und inkompatible Sicherungen geschlossen behandeln. Kleine notwendige Notizroutendelegation ist zugeordnet, kein allgemeiner Authumbau. 03 arbeitet ausschließlich in eigenen Prüfdateien auf isolierter Quellkopie.

Prüfe nur neue/geänderte C2-Wege und konkret betroffene Regressionen mit synthetischen Konten, echten Sitzungen/PostgreSQL und tatsächlicher Browserbedienung. Belege Neuladen, A/B-Trennung, Konflikte, Wiederaufnahme, Sperre/Kontowechsel, unveränderte künstliche Altbrowserkeys, sichere Teilfreigabe der Ansichten und vollständiges Restore auf leeres Testziel einschließlich C1-/Suchanschluss. Notwendige Typ-/Lintprüfung und Build getrennt ausgeben; keine fremden Tests pauschal wiederholen. Echte Zweitgeräteabnahme nicht aus zwei Tabs ableiten.

Dokumentiere Dateien, Verträge, tatsächlich gelaufene Prüfungen, Grenzen und C3-Anschluss in deinem Ergebnisbericht. Melde früh konkrete Überschneidungen oder fehlende Schreibzuordnung im eigenen Chat; eine erneute allgemeine Zustimmung ist nicht nötig. Keine bezahlten Aufrufe, Schlüsselanlage, externe Dokumentübertragung, Veröffentlichung oder echte Bestandsmigration. Nach C2 abschließen, keinen Folgeschritt selbst starten.

## 03 · AUTH-01 — Konten und persönliche Freischaltung

**Modell: GPT-6.1 Sol · Reasoning: High · Geschwindigkeit: Standard.**

### Startprompt AUTH-A-R1

Schließe als begrenzten lokalen Prüfauftrag AUTH-A-R1 ausschließlich die noch offenen Varianten **I-02, I-05, I-06, A-06 und R-01** aus `docs/ergebnisse/AUTH-01/AUTH-A-PRUEFMATRIX.md`. Niklas hat den neuen Planungschat direkt zur Koordination autorisiert. Lies Projektregeln, aktuellen Stand 16, `docs/ARBEITSRUNDE_16.md` und dein Briefing. AUTH-A ist geliefert: keine Wiederholung seiner Gesamtprüfung und keine neue allgemeine Entwurfsrunde.

Prüfe: wiederholtes GET-Öffnen einer Einladung/Mailvorschau ohne Verbrauch (I-02); harte Prozessabbrüche an den vorgesehenen Einladungsfehlerpunkten und Wiederaufnahme ohne zweite Identität (I-05); Ablauf/Widerruf/Neusendung während laufender Bibliotheksanlage (I-06); vorher gesetzte Cookies/Sessionfixation und lokal mögliche Browser-/Passwortmanagerfälle (A-06); Resetvarianten pending/blocked/Admin, abgelaufene Links und lokale Zustellgrenze bei erhaltenem Status, Besitzer und TOTP (R-01). Echte Bibliothekssitzungen und PostgreSQL verwenden, keine simulierten Principals als Abnahme ausgeben.

Schreibbereich ausschließlich neue `tests/auth-restfaelle.test.ts`, neue Helfer `scripts/auth/restfaelle/`, Belege `docs/ergebnisse/AUTH-01/R1/`, AUTH-Ergebnis und Prüfmatrix. Erstelle eine isolierte Quellkopie des tatsächlichen aktuellen Arbeitsstands ohne `.env.local`, Sitzungsdaten oder andere Geheimnisse; eigene synthetische Datenbank/Dateien/Ports. DATA-C2 bearbeitet parallel die gemeinsamen Anwendungs-/Schema-/Sicherungsdateien. Diese und sämtliche Authanwendungsdateien bleiben für dich read-only. Vorhandene Testhilfen lesend wiederverwenden, keine fremden Prüfdateien ändern.

Kein externer Mailversand, keine Produktionsöffnung, Buchung, bezahlte KI, Dokumentübertragung oder Bestandsmigration. Ein echter Produktfehler oder ein zwingend fehlender Anwendungshook wird mit konkreter Datei/Stelle und Reproduktion gemeldet; keinen nicht zugeordneten Code verändern. Andere mögliche Restfälle selbstständig weiter prüfen. Nicht ausführbare Geräte-/Mailvarianten konkret offen lassen; Teilnachweise nicht zum vollständig bestandenen Matrixfall aufwerten. Kein erneuter Gesamtbuild; nur nötige Prüfung der neuen Hilfen.

Ergebnis samt tatsächlich geprüften Varianten, Belegen, gefundenen Fehlern und verbliebenen Grenzen in AUTH-Ergebnis/Prüfmatrix festhalten und im eigenen Chat melden. Danach abschließen; keine Produktionsanmeldung/Mailintegration aus dem HOST-Vorschlag übernehmen.

## Folgefenster nach dieser Runde

1. Planung liest C2-/R1-Ergebnisse und nötige Code-/Protokollstellen, ohne Prüfungen zu wiederholen. Fehlgeschlagene Kriterien erhalten einen gezielten Reparaturauftrag statt eines pauschalen Neustarts.
2. **08 AI-KEYS-A** ist der vorgesehene nächste gemeinsame Integrationsschritt (Sol High): bestätigte einmalige 4 EUR ohne Reset, bewusste Auswahl Pilot/eigener Schlüssel, Verschlüsselung, beide KI-Routen und Sicherung, keine zweite Guthabenbuchhaltung oder allgemeiner Fallback. Vor Versand aktuellen C2-Stand und genaue Schreibdateien zuordnen. Keine echte Schlüsselanlage oder Anbieteraufrufe in einer lokalen Umsetzung.
3. Danach DATA-C3 und 11 Markierungen nach konkreter Kollisionsprüfung staffeln. C3–C5 sind Voraussetzung für vollständige persönliche Lernfunktionen; Markierungen ersetzen sie nicht.
4. Vor Onlinebetrieb AUTH-Produktionskonfiguration bei 03, Betriebsaufbau bei 10, PDF-Range-/Suchlastgrenzen bei 06/07 zuordnen. Echter Erstbestand, Geräteabnahme, Anbieter/Budget und Veröffentlichung bleiben gesonderte Schritte. Nicht alle Zusatzfunktionen zum Vorwand machen, den geschlossenen Online-Test unbegrenzt zu verschieben.

Keine Folgefenster sind durch diese Liste bereits gestartet. Kein regelmäßiges Nachsehen nach Ende dieses Turns eingerichtet.
