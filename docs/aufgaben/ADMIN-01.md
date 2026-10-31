# ADMIN-01: Adminübersicht und Nutzungszahlen

## Verbindlicher Modellhinweis17.10.2026

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

## Ziel

Konto-, Import-, Fehler- und Kostenübersicht sowie klar definierte Aktivitätskennzahlen vorbereiten. Persönliche Admineinsicht und Wohnortfrage sind von Niklas ausdrücklich auf später vertagt.

## Nächste Umsetzung: ADMIN-A1 – Stand 11, 11.10.2026

ADMIN-V liegt vor. Nach Niklas' Bestätigung der drei Bedienempfehlungen und Startnachricht kann ADMIN-A1 parallel zu PDF-A in getrennten Dateien beginnen. Empfehlungen, noch keine Nutzerentscheidung: eigener Bereich `/konto/verwaltung`, Bestätigung bei Sperren/Widerrufen, zunächst reine Fehlerliste ohne gespeichertes „gesehen“. Modell: GPT-6.1 Sol · Medium · Standard.

**Umfang:** vorhandene Kontoaktionen wiederverwenden; Kontosuche/-filter und bestehende Einladungszustände im Verwaltungsbereich anzeigen. Zusätzlich paginierte ausschließlich lesende Übersichten für gemeinsame Importbelege und bereits gespeicherte Betriebsfehler bauen. Kosten, Nutzungszahlen und allgemeines Fehlerjournal ohne tatsächliche Datenquelle als nicht verfügbar kennzeichnen. Keine Inhaltsfreigabe neuer Klausuren, persönliche Admineinsicht, neuen Budgets oder allgemeinen Überwachungsfunktionen.

**Parallel getrennte Schreibbereiche:** eigene `src/lib/server/admin/`-Module, neue `/api/account/admin-overview/`-Routen (konkreter expliziter Pfad statt Veränderung der vorhandenen Catch-all-Route), `/konto/verwaltung` und Admin-Komponenten/-Tests. `account-app.tsx` ausschließlich ADMIN für Extraktion vorhandener Verwaltung/Link. Bestehende Authguard-/Kontofunktionen und DB-Schema read-only wiederverwenden; kein Umbau von `auth/service.ts` oder `auth/runtime.ts`, keine Migration/Backup-/Paket-/Lockfileänderung. PDF hat `catalog-import-app.tsx`, Viewer und PDF-Routen. Import-/Statusrouten bleiben unverändert; adminseitig nur sichere Projektionen aus vorhandenen Tabellen. Ein nötiger darüber hinausgehender gemeinsamer Eingriff wird separat koordiniert.

Vorhandene Schutzsemantik/TOTP/frische Anmeldung erhalten. Importdetails über `catalog_import_documents` den tatsächlichen Belegversionen zuordnen, nicht pauschal allen späteren Klausurversionen. Relevante Rechte-/Bedienprüfungen selbst durchführen und berichten, keine fremden Tests pauschal wiederholen. Prüfprozesse getrennt halten und keine fremden generierten Typdateien verschieben/löschen; Paketänderungen exklusiv bei PDF. Ergebnisbericht aktualisieren. Zentrale Statusdateien beim Planungschat; keine Veröffentlichung. Die vollständigen Verträge/Bedienentwürfe unter `docs/entwuerfe/ADMIN-01/` bleiben die Grundlage.

## Jetzt unabhängig vorbereitbar – Stand 10, 11.10.2026

**ADMIN-V: abgegrenzte Vorbereitung.** Modell: GPT-6.1 Sol · Medium · Standard. Dieser Teilauftrag kann nach Niklas' Startnachricht neben dem laufenden IMPORT-Abschluss beginnen; noch nicht gestartet oder versendet. Er ersetzt für diese Runde den vollständigen Integrationsauftrag unten.

Die durch AUTH-A bereits vorhandene Kontoverwaltung lesend aufnehmen und nur fehlende Adminfunktionen planen. Eine konkrete minimale Ansicht mit Feldern und Aktionen für Einladungen/Aktivierung/Sperren, Importstatus und technische Fehler entwerfen. Bestehende Auth-/TOTP-Prüfung wiederverwenden, jede Anzeige/Aktion einer vorhandenen oder noch benötigten Schnittstelle zuordnen. Kosten und Nutzungszahlen nur dort anbieten, wo Daten tatsächlich erhoben werden; sonst als noch nicht verfügbar kennzeichnen. Direkte Klausurannahme bleibt: keine zusätzliche Importfreigabe einführen. Persönliche Admineinsicht bleibt vertagt. Ergebnis: einfacher Bildschirm-/Bedienentwurf, fehlende Schnittstellen mit Dateizuordnung und priorisierter kleiner Umsetzungsauftrag; keine zweite Kontoverwaltung bauen.

**Schreibbereich:** ausschließlich `docs/entwuerfe/ADMIN-01/` und `docs/ergebnisse/ADMIN-01.md`. Vorhandenen Code und zentrale Dokumente lesen, aber nicht ändern. Keine Datenbankmigrationen, Paketänderungen, Tests/Builds oder laufenden Server für diesen Dokumentationsauftrag. Keine bezahlten Aufrufe, Schlüsselzugriffe oder externen Dokumentuploads. Offene Produktfragen gezielt mit Niklas klären; unabhängige Teile weiter ausarbeiten. Vorhandene Entscheidungen nicht erneut pauschal zur Freigabe stellen. Die spätere Umsetzung erhält nach diesem Ergebnis ein eigenes Integrationsfenster; zentraler Stand beim Planungschat.

## Nächster Arbeitsauftrag – Stand 10.10.2026

**Danach: ADMIN-A – notwendige Betriebsverwaltung**

Dieser Auftrag ist zur Besprechung und anschließenden Beauftragung durch Niklas vorbereitet; er wurde noch nicht an den Chat gesendet oder gestartet. Der frühere Einrichtungsauftrag ist abgeschlossen. Vor Beginn [ARBEITSSTART.md](../ARBEITSSTART.md), aktuelle zentrale Dateien und den tatsächlichen Dateistand lesen. Hat Niklas diesen abgegrenzten Auftrag bestätigt, innerhalb des Umfangs selbstständig fertigarbeiten; nicht für jeden Einzelschritt erneut fragen.

**Voraussetzungen / letzte Fragen:** DATA-B und AUTH-A; Importstatus nach IMPORT-B, Kostenstatus nach AI-KEYS-A. Fehlende Kostenfunktion darf zunächst sichtbar als nicht verfügbar erscheinen.

**Arbeitsumfang:** Geschützte Übersicht für Einladung/Aktivierung/Sperre, Importprüfungen und technische Fehler aufbauen. Besuche, aktive Nutzer und abgeschlossene Lernsitzungen eindeutig unterscheiden. Sobald vorhanden, Kostenbuchungen anzeigen. Private Lösungsentwürfe/Notizen nicht als allgemeine Adminansicht einführen.

**Schreibbereich und Zusammenarbeit:** Adminoberfläche und zugewiesene Adminrouten. Konto-/Prüfregeln wiederverwenden; keine zweite Authlogik.

**Fertig, wenn:** Nur Admin kann verwalten; direkte unberechtigte Zugriffe scheitern; Sperren und Importentscheidungen sind nachvollziehbar; Kennzahlen haben dokumentierte Bedeutung.

**Übergabe / nächster Schritt:** Grundverwaltung für geschlossenen Pilot. Persönliche Admineinsicht bleibt eine spätere eigene Produktentscheidung.

Ergebnis unter `docs/ergebnisse/ADMIN-01.md` mit Abschnitt für diese Teilstufe festhalten: Ausgangsstand, tatsächlich geänderte Dateien, durchgeführte Prüfungen, offene Punkte und belastbare Übergabe. Ein fertiger Teilauftrag bedeutet nicht, dass das gesamte Paket abgeschlossen ist. Gemeinsame Architektur-/Statusdateien pflegt der Planungschat. Zusätzliche gemeinsame Dateiänderungen zuerst dort zuordnen lassen; unabhängige Arbeit fortsetzen.

## Gemeinsamer Kontext

- [Projektstatus](../PROJEKTSTATUS.md)
- [To-do-Liste](../TODO.md), Arbeitspaket ADMIN-01
- [Architektur](../ARCHITEKTUR.md)
- [Zusammenarbeit der Chats](../CHAT_KOORDINATION.md)

Abhängigkeiten: DATA-01, AUTH-01, AI-KEYS-01

## Relevante Dateien für die spätere Arbeit

- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/feedback/page.tsx`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/feedback.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/components/credit-badge.tsx`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/api/openrouter-credits/route.ts`

## Abnahme

Betriebsverwaltung geschützt; Besuch und abgeschlossene Lernsitzung getrennt; weitergehende persönliche Einsicht bleibt als offene Produktentscheidung dokumentiert.

## Ergebnis und Abstimmung

Nach tatsächlicher Arbeit das Ergebnis in `lern-tracker/docs/ergebnisse/ADMIN-01.md` und im eigenen Chat hinterlegen: verwendeter Ausgangsstand, geänderte Dateien, tatsächliche Tests, Grenzen und Auswirkungen auf andere Aufgaben. Zentrale Entscheidungen pflegt der Planungschat. Bei gemeinsamen Dateien die Arbeitsweise aus CHAT_KOORDINATION.md beachten. Vorhandene Änderungen und klassifizierte Klausuren erhalten.

Der anfängliche Kontextauftrag umfasst keine Änderung von Anwendungscode, keine bezahlten KI-Aufrufe, keine externen Uploads, Portalabrufe oder Veröffentlichungen. Geheimnisse aus .env.local bzw. secrets.py gehören nicht in die Antwort.

