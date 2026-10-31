# AUTH03 — begrenzter lokaler Postcommit-Maildispatcher

Stand: 18.10.2026. **Lokal implementiert; 23/23 gezielte Testeinträge, Typ- und Lintprüfung bestanden.** Ausschließlich künstlicher Sink/Faketransport an isoliertem echtem PostgreSQL. Keine reale Mailzustellung, SMTP-/Provideranbindung oder Produktionsöffnung.

## Auftrag, Ausgangsstand und Dateien

Maßgeblich sind das exklusive Maildispatcherfenster und der konkrete Schemaabgleich in Arbeitsrunde 33 sowie das eigene AUTH-Briefing. Der zuvor vorgelegte [Schemaabgleich](SCHEMA-ABGLEICH.md) wurde zentral bestätigt; erst danach begann die Umsetzung. Alleiniger Bearbeiter AUTH03-Nachfolger `01a14be1-b9fc-7593-8cd4-65c8eee70d60`. Bestehende gemeinsame Arbeitskopie mit umfangreichen uncommitteten Änderungen erhalten, kein Reset/Clean/Worktree oder Commit. HEAD allein bildet diesen Stand nicht ab.

Fünf bearbeitete/neue Quell- und Testdateien:

- `db/migrations/016_auth_mail_dispatch.sql`: nächste freie additive Migration; sieben vereinbarte Outboxspalten, Constraints und zwei partielle Indizes. Keine neue Tabelle.
- `src/lib/server/auth/mail-dispatcher.ts`: explizit konstruierbare serverseitige Fähigkeit, keine automatische Laufzeit-/HTTPanbindung.
- `src/lib/server/auth/mail-transport.ts`: Transportvertrag und ausdrücklich gewählter flüchtiger Speichersink ohne Netz-/Datei-/Logzugriffe.
- `src/lib/server/persistence/backup.ts`: ausschließlich sieben Spalten an `columns.auth_mail_outbox` ergänzt; Format 4 und Widerrufsstufe unverändert.
- `tests/auth-mail-dispatcher.test.ts`: neue gezielte PostgreSQL-/Fakefälle einschließlich echter Outboxerzeugung durch den bestehenden Authdienst.

Eigene Belege liegen ausschließlich in diesem Ordner, ergänzt um den Hinweis im AUTH-Ergebnis. Die vorübergehende Typkonfiguration unter `scripts/auth/mail-typecheck.generated.json` ist entfernt. Kein zusätzlicher Dispatcher-CLI-, Dienst-, Environment- oder Provideranschluss. `service.ts`, Runtime, Produktionsadapter, Datenbankabstraktion, Pakete, Layout und alle Migrationen 001–015 unverändert gegenüber dem [selektiven Ausgangsstand](ausgangsstand.json). [Finale Quellzuordnung](quellstand.json) enthält fünf SHA-256-Werte, 23 unveränderte geschützte Vergleichsdateien und den Nachweis, dass die einzige Änderung an Backup exakt die sieben benannten Spalten ist. Dies ist kein atomarer vollständiger Release-Snapshot.

## Verhalten und feste Grenzen

Der Aufrufer muss Datenbank, feste kanonische Basis-Origin, bestehenden Mailkey und Transport ausdrücklich übergeben. Es wird keine Konfiguration aus der Umgebung geladen, kein Geheimnis erzeugt und kein laufender Kontodienst umgestellt. `dispatchBatch()` arbeitet seriell höchstens zehn Kandidaten ab; kleine explizite Batchwerte sind erlaubt. Pro Mail bestehen dauerhaft höchstens fünf Versuche. Die reine Auswahl ist nur für committed sichtbare Outboxzeilen möglich.

Kurze getrennte DBtransaktionen wählen per `FOR UPDATE SKIP LOCKED`, setzen eine zufällige UUID und endliche Lease, prüfen die Nachricht und den aktuellen Nachweis und committen `sending` **vor** Aufruf des Transports. Keine gehaltene DBverbindung, Writertransaktion oder globale Zustandssperre während des Transports. Transaktionsinterne Lock-/Statementgrenzen sind zwei/fünf Sekunden; Poolanschlussgrenzen gehören zur übergebenen Datenbankkonfiguration. Standardlease 60 Sekunden, maximale Lease 120 Sekunden; Transportstandard zehn Sekunden, maximal 30 Sekunden, stets mindestens 100 Millisekunden kürzer als die gewählte Lease. Der frühere Ablauf von Outbox oder Nachweis verkürzt das Transportzeitfenster zusätzlich.

Es werden nur bekannte Authlinks derselben Origin akzeptiert: Einrichtung mit passender Adresse/Token, E-Mailbestätigung und Resetcallback der Bibliothek. Doppelte/unbekannte Queryparameter, fremde Origins/Rücksprünge, andere Pfade und beschädigte Verschlüsselung erreichen keinen Transport. Keine generische URLabruf-Fähigkeit. Vor Sendebeginn gelten aktuelle Nachweise:

- Einladung: gleicher Tokenhash und Empfänger, offene unverbrauchte/nicht widerrufene Einladung, pending Konto und Frist.
- Bestätigung: Hash in der Appregistry, passende unbestätigte Bibliotheksidentität und nicht gesperrte zugeordnete Person.
- Reset: aktueller Bibliotheksnachweis `reset-password:<token>`, dieselbe Identität/Adresse und nicht gesperrtes Konto.

Die 24-Stunden-Outboxfrist ersetzt nicht die kürzere Bestätigungs-/Resetfrist. Hat die Bibliothek vor der Appzuordnung committed, wird nur bei passender noch offener Einladung begrenzt zurückgestellt; ohne diese Grundlage verworfen. Nach höchstens fünf Versuchen endet auch diese Wartephase. Auth-, Registrierungs-, Aktivierungs- und Resetsemantik selbst wurden nicht verändert.

Transportausgänge sind bestätigte Annahme, sicher nicht angenommene vorübergehende/endgültige Ablehnung oder unbekannt. Nur die **sicher nicht angenommene** vorübergehende Ablehnung darf erneut versucht werden: 30/60/120/240 Sekunden Backoff, allgemeiner Deckel 900 Sekunden. Endgültige Ablehnung endet `failed`. Exceptions, unbekannte Ergebnisse und Timeouts enden `uncertain`; keine automatische Wiederholung und kein Übernehmen von Providerantworten/Exceptiontexten. Nach Timeout stoppt der Batch. Solange ein nicht kooperativer Transport noch nicht abgeschlossen ist, startet dieselbe Instanz keinen weiteren Batch.

Abgelaufene `claimed`-Versuche ohne committed Sendebeginn dürfen innerhalb der Grenzen später neu beansprucht werden. Abgelaufenes `sending` wird konservativ `uncertain`, auch wenn die tatsächliche Annahme nicht mehr ermittelt werden kann. Recovery bearbeitet pro Aufruf höchstens zehn abgelaufene Leases. Jeder spätere Abschluss braucht dieselbe UUID, passenden Status und gültige Lease. Alte Worker oder verspätete Antworten überschreiben kein neueres Ergebnis. Verschwundene Outboxzeilen werden niemals neu angelegt. Die bisherigen Löschregeln des Authdienstes für abgelaufene Outboxzeilen bleiben erhalten; es entsteht keine dauerhafte Versandhistorie.

## Sicherung und Restore

Migration 016 erweitert nur die bestehende Outbox. Alle sieben neuen Spalten werden vollständig verschlüsselt im bisherigen Format 4 erfasst und beim internen vollständigen Restorevergleich einbezogen. Anschließend löscht die unveränderte Widerrufsstufe die gesamte Outbox und temporären Nachweise, widerruft offene Einladungen und verhindert Wiederzustellung. Leere getrennte Zieldatenbank und identische Migrationsfolge bleiben Voraussetzung.

Eine Sicherung vor 016 ist weiterhin an ihren passenden früheren Release-/Migrationsstand gebunden. Keine neue automatische Altschema-Restorekompatibilität behauptet und keine alten Sicherungen verändert. Diese gezielte Änderung ersetzt weder einen unabhängigen Offsite-Restore noch eine umfassende erneute Daten-/Authabnahme.

## Tatsächliche Prüfung

[Finales Testprotokoll](tests.log): **23 Einträge bestanden**, davon 22 fachliche Unterfälle und der übergeordnete Integrationseintrag; null Fehler/übersprungene Fälle. Reales temporäres PostgreSQL mit synthetischen Adressen, Konten, Links und Schlüsseln, nur flüchtiger Sink oder kontrollierte Fakefunktionen. Kein HTTP-/SMTPserver, keine tatsächliche Zielzustellung.

Geprüft wurden Upgrade mit bestehender 015-Outbox/Defaults/Constraints/Wiederholungsmigration, Outbox aus dem echten Authdienst, tatsächlich erzeugte Bibliotheksbestätigungs-/Resetlinks, Commit/Rollback, zwei konkurrierende Dispatcher und Batchgrenze, freie Writer während Transport, Widerruf/Rotation/Sperre/Verbrauch/Ablauf, frühere Nachweisfristen, unfertige Identitätszuordnung und ihre Versuchsgrenze, Backoff/Fünf-Versuchegrenze, endgültige Ablehnung/Exception/unklarer Ausgang, Timeout/Abort bei nicht kooperativem Fake, abgelaufene Claims/Crashzustände, UUID-Fence vor Sendebeginn, Leaseverlust mit spätem Ergebnis, entfernte Zeilen, korrupte/fremde/mehrdeutige Links, Konstruktorgrenzen und verschlüsselte Sicherung aller acht Zustände mit Restorewiderruf.

Crashgrenzen werden durch gezielt manipulierte dauerhafte PostgreSQLzustände und angehaltene Fakeversuche geprüft; kein echter SMTPprozess oder echtes Provider-Crashverhalten. Die Upgradeprüfung setzt ausschließlich eine eigene frische Testdatenbank auf 001–015 zurück und migriert diese vorwärts; keine dauerhafte Nutzer-/Entwicklungsdatenbank wird angefasst.

Der erste Start wurde von der Sandbox am lokalen Listener für die Wegwerf-Datenbank verhindert (`EPERM`), vor einer Funktionsprüfung. Danach war derselbe gezielte Test mit passender lokaler Werkzeugfreigabe ausführbar. Erster grüner Zwischenstand 20 Einträge; nach drei zusätzlichen gezielten Fällen finale 23 Einträge. Zahlen nicht addieren. [Lint](lint.log) für die vier TypeScriptdateien und [isolierte Typprüfung](typen.log) derselben Einstiege samt lesender Importabhängigkeiten jeweils Exitcode 0. Leere Protokolle bedeuten keine Diagnostik; Exitcodes zusätzlich in [pruefungen.json](pruefungen.json).

Keine alten 21 Konfigurationsfälle, keine AUTH-Gesamtprüfung oder Repository-Gesamtprüfung wiederholt. Kein Next-/Gesamtbuild: keine UI-/Runtimeanbindung, Pakete oder Buildkonfiguration geändert; gezielte Typ-/Lint-/PostgreSQLprüfung des neuen Servermoduls durchgeführt. Temporäre Datenbankcluster geschlossen, Pools beendet; der Test prüft nach `runtime.close()` die Abwesenheit seiner gesamten Wurzel. Keine eigene dauerhafte Server-/Browser-/Clusterlaufzeit verbleibt. Temporäre Typkonfiguration entfernt.

## Verbleibende Grenzen

**Das Ergebnis ist kein laufender Produktionsmaildienst.** Es fehlt weiterhin der gesondert zugeordnete reale SMTP-/Provideradapter samt Absender-/Domainvertrag, SPF/DKIM/DMARC, Dienststart/Überwachung, sicheren Betreiberabläufen und tatsächlicher Zustellprüfung. Für `uncertain` gibt es bewusst keine automatische Rücksetzung/Wiederholung; ein späterer Betreiberablauf muss unbekannte Annahme behandeln und gegebenenfalls bewusst einen frischen Authnachweis erzeugen. Providerdeduplizierung könnte zusätzlich dieselbe stabile Mail-ID verwenden, ist hier aber nicht vorhanden oder zugesichert.

Zwischen letzter DBprüfung/Commit und Transportannahme bleibt ein unvermeidbares Widerrufs-/Ablauffenster. Ein bereits gestarteter externer Versand kann nicht atomar mit einer späteren Kontosperre oder einem Widerruf zurückgerufen werden. Die vorhandene Authprüfung entscheidet weiterhin bei Verwendung des Links. Ein AbortSignal stoppt einen kooperativen Transport, beweist aber keine Nichtannahme. Bei Crash nach Annahme vor Statuscommit kann eine Mail trotz `uncertain` angekommen sein oder ungeklärt fehlen. **Keine exactly-once- oder Postfachzustellgarantie.**

Für einen echten Restore/Releasewechsel sind alte Dienstprozesse vor Wiederöffnung zu stoppen; ein gelöschter Fence verhindert Statusupdates, kann einen bereits begonnenen externen Transport nicht zurückholen. Ein zukünftiger Transport darf Erfolg nur bei eigener belegter Annahme melden und `not_accepted` ausschließlich bei sicherer Nichtannahme. Inhalte/Links bleiben private Daten; der Sink ist nur eine ausdrücklich gewählte flüchtige Test-/Operatorfähigkeit ohne automatische Verwendung.

Produktionsruntime bleibt absichtlich gesperrt. Kein Kauf, Deployment, echte Schlüsselanlage, Konfigurationsumschaltung, externe Mail-/Dokument-/KIaktion oder Bestandsmigration. Keine Geheimnisse aus bestehenden privaten Konfigurationen gelesen oder ausgegeben. Keine Nachrichten an andere Chats; Planung liest eigenen Bericht/Chat. Astra und sämtliche Varianten ausgeschlossen. Begrenzter Auftrag beendet; weitere Betreiber-/Produktionsanschlüsse separat zuordnen.
