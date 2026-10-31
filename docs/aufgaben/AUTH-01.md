# AUTH-01: Konten und persönliche Freischaltung

## Verbindlicher Modellhinweis17.10.2026

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

## Aktuell20.10.2026 – Runde35 nur Planvorlage

Die Planungspause wurde auf direkte Fortsetzung beendet. [Umzugsplan U01–U16](../ARBEITSRUNDE_35.md) ist fertig, noch kein neuer Umsetzungsauftrag oder Modellwechsel. Ausschließlich aktuelle Zuordnung/Cursor aus CHATS.json verwenden; ältere IDs und Ausführungssätze unten sind historisch. C0 unabhängig abgeschlossen, H1 unbegonnen; HOST alleiniger späterer Serverbediener. Dateireservierungen und Luna-/Sol-Empfehlungen im Plan starten keinen Writer. Bis konkretem Folgeauftrag keine alten Arbeiten/Tests neu starten oder am Server fortsetzen.


**Abschluss übernommen, Stand 18 / 13.10.2026, 20:00 Uhr:** AUTH-A-R1 abgeschlossen. I-02/I-05/I-06 lokal geschlossen; Matrix 30 geprüft/10 Restfälle. Eigene Typfehler korrigiert; Bericht/Protokolle durch Planung lesend abgeglichen. Kein neuer Auftrag; vorheriger Starttext unten ist historische Herkunft.

## Verbindlicher Auftrag – Stand 16, 13.10.2026

Niklas hat die direkte Koordination durch den neuen Planungschat autorisiert. Maßgeblich ist der vollständige Startauftrag **AUTH-A-R1** samt exklusiver Dateizuordnung und Abnahme in [Arbeitsrunde 16](../ARBEITSRUNDE_16.md). Modell: **GPT-6.1 Sol · High · Standard**, Empfehlung ohne automatische Umstellung. Versandstatus in CHATS.json. Frühere Arbeitsaufträge unten sind abgeschlossen/historisch und werden nicht neu gestartet. Zentrale Dateien/Briefings pflegt Planung; eigene Ergebnisse im zuständigen Bericht.

## Ziel

Einladungen, bestätigte Anmeldung, pending/active/blocked, sichere Sitzungen und Adminrolle auf einer bewährten Authentifizierung planen. Lokale Schutzprüfungen erst durch belastbare Onlineprüfung ersetzen.

## Historischer Status – 11.10.2026, Koordinationsstand 8

AUTH-A ist im lokalen Umfang geliefert; Ergebnis, 26 unabhängig wiederholte Auth-Testeinträge und Schnittstellen sind im Planungschat geprüft. Keine Onlineabnahme. Nächster Integrationsbearbeiter ist IMPORT-01. Die fünf zusätzlichen lokalen Matrixfälle und spätere Fach-/Hostingprüfungen sind im Projektstatus zugeordnet; hier derzeit kein weiterer Auftrag gestartet.

## Abgeschlossener Arbeitsauftrag – Stand 10.10.2026

**AUTH-A – echte lokale Anmeldung auf DATA-B mit einem persönlichen Ablauf**

AUTH-V liegt vor; DATA-B und PLAN-B sind abgeschlossen und durch den Planungschat geprüft (Projektstatus 7). Dieser Folgeauftrag ist vorbereitet, nicht versendet oder gestartet. Niklas' Startnachricht beauftragt die folgende Umsetzung. Aktuelle Dateien und Änderungen zuerst lesen, insbesondere DATA-B-Code/Ergebnis, AUTH-V und Prüfplan. Nicht wieder bei der allgemeinen Konzeptklärung beginnen.

**Architekturempfehlung für diesen Auftrag:** Better Auth mit dem vorhandenen PostgreSQL-/pg-Aufbau, E-Mail/Passwort und Adressbestätigung; Admin zusätzlich mit verifiziertem TOTP. Einladung einmalig, sieben Tage; separate persönliche Aktivierung/Sperre. Die Empfehlung wird mit Niklas' entsprechendem Startauftrag zur Umsetzungsgrundlage. Aktuelles gepflegtes Release und offizielle Integration vor Installation prüfen; keine ungeprüfte Versionsangabe aus dem Entwurf übernehmen. Der Planungschat hat PostgreSQL-Anschluss, E-Mail/Passwort und TOTP am 10.10.2026 in offizieller Dokumentation erneut abgeglichen.

**Arbeitsumfang:** Echte Bibliothekssitzungen, Einladung/Bestätigung, pending/active/blocked, Adminbootstrap, Aktivierung, Sperre/Entsperre, Abmelden und Kontowiederherstellung lokal implementieren. Kleine verständliche Seiten für Einrichtung/Anmeldung, Wartestatus, Admin-Kontoverwaltung und einen tatsächlich gespeicherten persönlichen Lern-Datensatz. Diesen Ablauf mit zwei synthetischen Mitgliedern und Admin von Oberfläche/API bis PostgreSQL nachweisen. Eigene kontogebundene Ansicht verwenden; bisherigen privaten Browserbestand nicht automatisch übernehmen oder anderen Konten anzeigen. Die vollständige Umstellung aller bestehenden Lernansichten ist ein späterer Integrationsschritt.

**Verbindliche Integrationspunkte:**

1. Bestehende `stex.accounts.user_id`, Rolle/Status/Revision und Besitzerreferenzen erhalten. Authidentität eindeutig zuordnen; keine zweite Lerndatenbank. Neue additive Migration ab 002; angewendete 001 nicht ändern. Positional arbeitendes `createAccount` an zusätzliche Spalten anpassen oder Zusatzdaten in verknüpften Tabellen halten; beide Wege mit Altbestand prüfen.
2. Ein serverseitiger Sitzungsprüfer liefert interne Nutzer-ID, aktuellen Status und Sitzungs-/Kontogeneration. Persönliche Schreibvorgänge prüfen diese innerhalb ihrer Transaktion, Sperre und Schreiben bekommen eine konsistente Sperrreihenfolge. Bestehendes `requireAccount` prüft bisher nur Status, noch keine Sitzung/Generation und keine Sperre der Kontoreihe. Clientseitige Eigentümer-/Rollenangaben niemals übernehmen. Die vollständige Operator-Migration und der Rückexport sind keine ungefilterten öffentlichen Endpunkte.
3. DATA-B-Sicherung hat eine feste Tabellen-/Spaltenliste und erfasst bislang keine Authdaten. Backup/Restore im selben Auftrag versioniert erweitern oder einen klaren vollständigen Ersatz bauen: Besitzerzuordnung, Passwortnachweise, TOTP-/Recoverydaten und erforderliche getrennte Schlüssel berücksichtigen. Wiederherstellung mit nachfolgender echter Anmeldung prüfen; alte Sitzungen/Reset-/Einladungs-/Bootstrapnachweise vor Öffnung entwerten. Fehler-/Altschemafälle dürfen nicht als vollständige Sicherung durchgehen.
4. Echte Auth-/PostgreSQL-Integration mit lokalem abgefangenem Testmailversand prüfen; kein externer Versand und keine Anbieterbestellung. Die realen Verifikations-/Resetfunktionen der Bibliothek testen, keinen unbestätigten Produktionsbypass bauen. Testmails/Geheimnisse nicht im normalen Log oder Ergebnis veröffentlichen. Hosting-/Mailanbieter blockieren diese lokale Abnahme nicht.
5. Nur nachweislich abgesicherte neue Routen freigeben. Alte KI-, Import- und Dateinamen-PDF-Routen bleiben im Onlinebetrieb gesperrt, bis ihre eigene Integration erfolgt. Die bestehende lokale App bleibt nutzbar. TOTP, direkte Signup-Aufrufe, CSRF/Origin, serverseitige Limits, Einladungsrennen und Wiederanlauf nach Fehlern anhand des Prüfplans abdecken.

**Exklusiver Schreibbereich dieser Runde:** AUTH ist einziger Bearbeiter von Paketdateien, notwendigen Konfigurationsergänzungen, neuen Auth-/Kontoseiten und -Routen, serverseitigen Sitzungs-/Kontomodulen, additiven SQL-Migrationen und erforderlichen Änderungen unter `src/lib/server/persistence/` einschließlich Backup sowie zugehörigen Tests/Skripten. Bestehende Änderungen erhalten. Keine parallele DATA-/IMPORT-Schemaarbeit. PDF-Extraktionslogik nicht verändern; deren direkte Nutzung von `pdfjs-dist` bei Paketintegration ausdrücklich als direkte kompatible Abhängigkeit deklarieren und Regression prüfen. Gemeinsame Lernlogik/Browserhaltung nur lesen; konkrete zusätzliche Integration hier melden.

**Prüfung und Abschluss:** Tests mit echten Sitzungen/PostgreSQL und mindestens zwei Mitgliedskonten plus Admin, verweigerter Fremdzugriff, Sperre vorhandener Sitzungen auch nach Entsperre, sichere Einladung/Wiederherstellung, persönliche Daten nach Neustart, Upgrade/Backup/Restore und Rollentrennung. Sichtbaren lokalen Ablauf prüfen. Standard-Typprüfung und Build in exklusivem Zeitfenster durchführen; vorhandenes generiertes Typduplikat gezielt prüfen und bereinigen, keine fremden Quelländerungen löschen und keinen laufenden Entwicklungsprozess ungeprüft beenden. Vollständiges Lint und relevante bisherige Tests erhalten. Alle 40 Entwurfsfälle als geprüft, fehlgeschlagen oder begründet noch ausstehend ausweisen; keinen vollständigen Onlinepilot behaupten.

**Übergabe:** AUTH-A in eigenem Ergebnisbericht dokumentieren: tatsächliche Änderungen/Prüfungen, lokale Start-/Testanleitung, Sicherheits- und Speichergrenzen sowie stabile Schnittstellen für IMPORT/PDF/ADMIN. Keine echten Einladungen, Browsermigration oder Veröffentlichung. Gemeinsame Architektur-/Statusdateien pflegt der Planungschat. Anschließend hier prüfen und IMPORT-B bzw. persönliche Datenintegration beauftragen.

## Gemeinsamer Kontext

- [Projektstatus](../PROJEKTSTATUS.md)
- [To-do-Liste](../TODO.md), Arbeitspaket AUTH-01
- [Architektur](../ARCHITEKTUR.md)
- [Zusammenarbeit der Chats](../CHAT_KOORDINATION.md)

Abhängigkeiten: DATA-01

## Relevante Dateien für die spätere Arbeit

- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/lib/server/request-safety.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/api/ai/route.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/api/docs/parse/route.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/api/pdf-file/route.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/src/app/api/feedback/route.ts`
- `/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/tests/security.test.ts`

## Abnahme

Direktaufrufe geschützt; kein Konto erreicht fremde Daten; Sperren greifen auch bei vorhandener Sitzung; Einladungen laufen ab.

## Ergebnis und Abstimmung

Nach tatsächlicher Arbeit das Ergebnis in `lern-tracker/docs/ergebnisse/AUTH-01.md` und im eigenen Chat hinterlegen: verwendeter Ausgangsstand, geänderte Dateien, tatsächliche Tests, Grenzen und Auswirkungen auf andere Aufgaben. Zentrale Entscheidungen pflegt der Planungschat. Bei gemeinsamen Dateien die Arbeitsweise aus CHAT_KOORDINATION.md beachten. Vorhandene Änderungen und klassifizierte Klausuren erhalten.

Der anfängliche Kontextauftrag umfasst keine Änderung von Anwendungscode, keine bezahlten KI-Aufrufe, keine externen Uploads, Portalabrufe oder Veröffentlichungen. Geheimnisse aus .env.local bzw. secrets.py gehören nicht in die Antwort.



## Fortschreibung 2026-10-17T16:31:10+02:00 — HOST geprüft / enger Produktionsanschluss

HOST-Nicht-KI-Betriebsvorlage lesend übernommen; kein Online-ready: AUTH-Runtime verweigert Produktion, Mail ist nur verschlüsselte Outbox, nach AUTH-Öffnung eigene serverseitige KI-Sperre erforderlich. DATA-Kontoreise aktiv, keine Doppelbeauftragung; gemeldete Profil/Kalender/Planübergänge noch keine Gesamtabnahme. Serverannahme2vCPU/4GiB/64GB ungemessen, keine Kaufentscheidung.

Exklusives neues Teilfenster AUTH03: src/lib/server/auth/runtime.ts und neue eigene auth/production-config.ts sowie eigene gezielte Runtimeprüfungen/Belege und Ergebnisbericht. Nur expliziten validierten Produktions-Konfigurationsadapter implementieren, ohne Umgebung umzuschalten oder echten Zielkontakt. Lokalen Modus erhalten; feste HTTPS-Origin, expliziter DB-/privater Dateipfad-/Secretvertrag, keine Defaults auf Testgeheimnisse, keine Requestmigration. Keine service.ts-/Schema-/Backup-/Layout-/KI-/Provider-/Maildispatcheränderung in diesem Teilfenster. Vor jedem weiteren gemeinsamen Pfad Planung informieren. Produktivöffnung bleibt bis KI-Sperre/Mail/Betrieb/Onlineprüfung geschlossen; Runtimeadapter ist keine Deploymentfreigabe. DATA-Produktfenster bleibt read-only, somit keine Überschneidung. Empfehlung Sol/High, zulässiges Reasoning erhalten, Astra verboten.


## AUTH-Maildispatcher — aktives exklusives Fenster 2026-10-18T00:30:56+02:00

AUTH03-Nachfolger01a14be1-b9fc-7593-8cd4-65c8eee70d60 lesend bestätigt, alleiniger Owner; Vorgänger01a1226c-3412-7993-8725-514e4c771924 ruhend/Archivierung. Nur neuer src/lib/server/auth/mail-dispatcher.ts, mail-transport.ts und eigene scripts/auth/mail-* / gezielte Tests/Belege. Vorhandene src/lib/server/auth/service.ts nur Outbox-Schnittstelle ohne Änderung von Auth-/Einladungs-/Resetsemantik. Erforderliche neue Zustellzustände/Claims zunächst exakt benennen: ausschließlich03 darf nächste freie additive Migration ab016 und genau nötigen Backup-Tabellen-/Spaltenvertrag in src/lib/server/persistence/backup.ts ändern; vorher Schema-/Sicherungsbedarf an Planung melden, noch kein Schemafix ohne diesen Abgleich. Andere Owner schreiben dort nicht. Format4/001–015 erhalten, wenn additiver Vertrag genügt, keinen Formatwechsel erfinden. Authruntime/Produktionssperre/Layout/KI/Pakete read-only.

Begrenzter Postcommit-Dispatcher mit injizierbarem Transport: keine DB-Schreibsperre während Transport, begrenzter Batch/Versuche/Lease/Backoff/Ablauf, kein Versand abgelaufener/widerrufener Nachweise, Claimkonkurrenz/Crash/unklarer Zustellstatus ehrlich dokumentieren (kein behauptetes exactly-once bei externem SMTP). Geheime Mailinhalte/Links nicht loggen. Nur künstliche lokale Sink-/Fake-Transportprüfungen; kein echter SMTP-/Providerkontakt, keine Schlüsselanlage/Umgebung umschalten. Reale SMTP-Anbindung/Zustellprobe bleibt separat freizugeben. Gegen tatsächliche PostgreSQL-Outbox gezielte neue Grenzen prüfen, keine alten AUTH-Gesamtläufe. Notwendige Typ/Lint/Build nur betroffener Umfang. Quelle/Belege/Bereinigung/Grenzen melden und stoppen. Sol/High empfohlen, bestehendes zulässiges Reasoning erhalten; Astra verboten.


### Konkreter Mail-Schemaabgleich 2026-10-18T01:00:56+02:00

AUTH-Vorschlag docs/ergebnisse/AUTH-01/MAIL-DISPATCH/SCHEMA-ABGLEICH.md lesend geprüft und für den begrenzten lokalen Auftrag abgeglichen: ausschließlich03 additive nächste freie016_auth_mail_dispatch.sql mit sieben benannten Zustell-/Fence-/Lease-Spalten an auth_mail_outbox, Constraints/Indizes, dieselben sieben Spalten in backup.ts.columns.auth_mail_outbox. Format4/alte Migrationen/Restore-Widerrufsstufe erhalten. Keine neue Tabelle/Secretart, service.ts nach Befund unverändert. Dispatcher/Transport nur neue benannte Module und gezielte synthetische PostgreSQL/Fake-Transportprüfungen. Keine echten Mails/SMTP/Provider/Produktionsöffnung. Alleiniger Owner03, kein anderer Schema-/Backupwriter. Technischer Übergang gemäß konkret vorgelegtem Vertrag darf fortgesetzt werden; keine neue Nutzerfreigabe für reversible lokale Umsetzung nötig.


## Nächstes exklusives AUTH03-Fenster — Betreiberkonfiguration 2026-10-18T02:00:48+02:00

Lokaler Maildispatcher016 mit fünf aktuellen Quellhashes/23 unveränderten Vergleichsdateien lesend übernommen. Keine echte Zustellung. Nun allein03: scripts/data-migration/local-config.ts, scripts/auth/operator.mts und bei Bedarf neuer reiner scripts/auth/production-operator-config.ts, eigene gezielte Tests/Belege. Expliziten Produktionsvertrag aus readProductionAuthConfig wiederverwenden statt roher DATABASE_URL/TLS-Defaults und lokaler Secretdateien; lokalen Betriebsweg erhalten. Produktions-init/Schlüsselerzeugung und lokale Mail-Linkvorschau im Produktionsmodus geschlossen halten. Geheimnisse/URLs nicht loggen. Öffentliche accountRuntime/503-Sperre unverändert; Suchworker/Schema/Backup/SMTP/Pakete/Layout read-only. Nur synthetische Konfigurations-/instrumentierte Ressourcenprüfungen, keine realen Betreiberbefehle/DB/Keys/Mails/Migration/Netz. Keine alten Prüfungen wiederholen. Vor zusätzlichem gemeinsamen Pfad melden. Nach Bericht stoppen. Empfehlung Sol/High, zulässiges Reasoning erhalten, Astra ausgeschlossen.


## Exklusives AUTH03-Fenster — SMTP-Adapter ohne echte Zustellung 2026-10-18T03:00:58+02:00

Nur03: neue src/lib/server/auth/smtp-transport.ts und smtp-config.ts, erforderliches scripts/auth/mail-dispatch.mts, eigene gezielte Tests/Belege. Bestehender mail-transport.ts nur genaue Typanbindung falls nötig. Ausschließlich03 darf für bewährte SMTP-Bibliothek nodemailer und nötige Typen package.json/package-lock.json ändern; installierte Version/Primärdokumentation prüfen, kein eigenes SMTPprotokoll schreiben. Andere Owner dort read-only. Authruntime/service/Schema/Backup/Layout/KI unverändert. Produktionssperre bleibt.

Expliziter Host/Port/Absender/Anmeldungs-/TLSvertrag, Zertifikatsprüfung ohne unsicheren Fallback, Headerinjektion abweisen, kurze Fristen/Abort/Transportannahme vs unsicherer Ausgang konservativ an Dispatcher abbilden. Transport nur bewusst erzeugen, kein Autostart/Send bei Import/fehlender Konfiguration. CLI nur explizite Einzelbatch-Ausführung, reale Nutzung braucht separate Freigabe. Tests ausschließlich künstlicher lokaler SMTP-Sink oder instrumentierte Bibliothek, kein echter DNS/SMTP/Providerkontakt, keine echten Credentials/Empfänger/Umgebungsumschaltung. Versand-/Deploymentfreigabe nicht ableiten. Exakte Quellen/Prüf-/Typ/Lint-/Bereinigungsbelege/Grenzen, danach stoppen. Nach zwei großen Abschlüssen Wechselregel geprüft: dieser dritte begrenzte Adapterauftrag im frischen03, danach vor großem Folgeauftrag rotieren. Sol/High empfohlen, zulässiges Reasoning erhalten, Astra verboten.


## AUTH03 — kontrollierter Produktionsruntimeanschluss 2026-10-18T06:00:57+02:00

Nach bestätigter lesender Einrichtung alleiniger03-Owner01a14d0f-ded1-7340-9bb7-b4666952b4d5; Vorgänger ruht/Archivierung. Produktfenster nur src/lib/server/auth/runtime.ts und nötiger neuer auth/production-runtime.ts, production-config.ts nur engster nötiger Releasevertrag; eigene gezielte Tests/Belege. Validierten Produktionskonfigurationsvertrag tatsächlich in Ressourcenaufbau übersetzen, aber standardmäßig geschlossen und nur explizite serverseitige Betreiberfreigabe als Voraussetzung, keine Freigabe durch Requests/Header/Host/fehlende Werte. Runtimeöffnung ausschließlich implementieren, nicht aktuelle Umgebung aktivieren oder deployen. Feste Origin/DB/TLS/private Pfade/Secrets, keine Requestmigration, keine lokalen Fallbacks. Keine globalen Defaults/SMTPautostarts. Bestehenden lokalen Modus/Cachebindungs-/Fehlerbereinigungsvertrag erhalten. Schema/Backup/Service/Authsemantik/KI/SMTP/Deployment/Pakete/Layout read-only. Neue synthetische instrumentierte Ressourcen-/Konfig-/Fehlerfälle einschließlich fehlender Freigabe ohne I/O und korrekter gleicher DB-/Dateibindung; keine echten DB/Datei-/Key-/Netz/Mailkontakte. Bestehende Tests nicht pauschal wiederholen, passende Typ/Lint/Quellbelege, Grenzen/Bereinigung und Stop. Sol/High empfohlen, zulässiges Reasoning erhalten, Astra ausgeschlossen. Reale Produktionsöffnung/Onlineprüfung braucht weiterhin separate konkrete Freigabe.


## AUTH03 — isolierte Produktionsvertrags-Verbindungsprobe 2026-10-18T06:31:04+02:00

Runtime lokal gelesen/übernommen,3 aktuelle Quellsha passend,16 instrumentierte Fälle. Nächster enger Auftrag allein03 neue tests/auth-production-integration.test.ts und eigene scripts/auth/production-integration-* plus Belege. Alle Produkt-/Schema-/Backup-/Deployment-/Paketdateien read-only. In eigenem vollständig künstlichem lokalen PostgreSQL-/Dateiziel mit separatem Testprozess validierten Produktionskonfigurationsvertrag und neue Runtime tatsächlich zusammenführen: ohne Betreiberflag keine Ressourcen, mit explizitem Flag im NUR künstlichen Prozess gleiche DB/PrivateFiles/AccountService, Migrationsstand001–016 vorab explizit durch eigene Testhilfe, keine Requestmigration. Drei vertagte KI-Routen weiterhin geschlossen. Keine externen DNS/SMTP/Provider/echten Daten/normalen Secretbestände; HTTPS-.test-Origin nur als Requestdaten ohne DNS, keine echte TLS-/Onlineabnahme behaupten. Genau neue Verbindungs-/Rechte-/Fehler-/Closegrenzen prüfen, alteAUTH-/Modul-/Restoreläufe nicht wiederholen. Tatsächliche Konfig-/Dateirechte-/Pfadgrenzen im Testziel dokumentieren und eigene Ressourcen entfernen. Produktfehler mit exaktem kleinsten Fixbedarf melden statt fremde Pfade ändern. Quelle/Belege/Grenzen und Stop. Sol/High, zulässiges Reasoning erhalten; Astra verboten.


## Linuxbau aktiv; Laufzeitvertrag übernommen und künstliche Konten vorbereitet – 21.10.2026

Die einmalige Paketinstallation ist tatsächlich mit Exit0 abgeschlossen: 539 Pakete in81,296s. Der erste Linuxproduktionsbau unter UID/GID900 läuft in der begrenzten transienten Bauunit. Kompilierung und TypeScript sind laut neuer Ausgabe erfolgreich; finale Artefakte und Quelleinhaltung noch nicht abgenommen. Die Bauumgebung enthält bislang keinen `STEX_LEARNING_MODE=account`; vor Releaseübernahme ist die tatsächliche statische Kontoansichtsbindung lesend zu klären. Kein automatischer Neubau oder Neuinstallation.

[DATA-Laufzeitvertrag](entwuerfe/DATA-01/CONTABO-U09-LAUFZEITVERTRAG.md) fertig und anhand der gebundenen öffentlichen Produktions-/Operator-/Migrations-/Layoutverträge lesend übernommen. Sieben unabhängige lokale Schutzwerte bei getrennten DDL-/Runtime-DBrollen vorgeschlagen; noch keine erzeugt oder genehmigt. root0700-Konfiguration kann der privilegierte Dienstmanager an UID901 übergeben. Konkrete Release-/Cluster-/Dienste-/Cachebindung und der Backupzugang zum root0700-Staging bleiben zu planen. DATA-Writer beendet; nach zwei größeren Abschlüssen Rotation geprüft, kein Kontextfehler, vor weiterem Großauftrag erneut prüfen.

Exklusiv für AUTH reserviert: neuer öffentlicher Bericht `docs/entwuerfe/AUTH-01/CONTABO-SYNTHETISCHER-BOOTSTRAP.md` und eigener Ergebnisnachtrag. Nur bestehenden sicheren Produktionsbootstrap für zwei künstliche Konten einschließlich TOTP/Verifikation/Aktivierung ohne echte Mail konkretisieren; fehlende vorhandene Fähigkeit ehrlich benennen. Keine Konten-/Schlüsselanlage, Code-/Schema-/Sicherungs-/Layoutänderung, Tests/Builds/Server-/Netz-/Mailaktion. HOST bleibt alleiniger VPS-Bediener. Sonstige gemeinsame Produktdateien ohne Writer. Bestehende Sol-/Reasoningstufen erhalten; Astra ausgeschlossen.

Vor einer weiteren Zielwirkung konkrete fertige Bindung prüfen; neue lokale Schlüssel brauchen Niklas' gesonderte Freigabe. Vorhandene Umzugsfreigabe bleibt gültig; keine neue generische Freigabe oder Nutzerkopie nötig. Linuxbau ist noch kein App-/HTTPS-/Restore-/Onlinebeleg.
