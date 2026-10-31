# AUTH-01 — Ergebnis

## 31.10.2026 — Kontostatus-Fixes live · 16:12:43 MEZ

Nach direktem Liveauftrag und ausdrücklich erlaubter Übergabe an den alleinigen HOST ist exakt die Menüänderung als Build `ItLV9eNrWGupIo0bEvSM0` live. Ein notwendiger Linuxbuild Exit 0; Aktivierung Exit 0, gemeinsames Dienstfenster 5,619 Sekunden. Der getrennte lesende Nachbeleg bestätigt 9/9 Bereitschafts-/Erhaltungsprüfungen. Übrige 358 Produktionsquellen, DB-/Datei-/Konfig-/Sicherheitsbindungen erhalten. Kein Logout oder Sitzungswiderruf; Nutzer müssen sich nicht abmelden und laden offene Seiten nach Speichern ihrer Eingaben neu. Keine Browser-/Login-/Logoutabnahme oder kausale Erklärung des ursprünglichen 401-Incidents behauptet. [HOST-Abschluss](../entwuerfe/HOST-01/HEADER-STATUS-LIVE-20261031/ERGEBNIS.md). Der folgende lokale Abschluss beschreibt die vorherige Umsetzungsstufe.

## 31.10.2026 — Drei Kontostatus-Fixes · lokal fertig / Writerende

Direkter Niklasauftrag im begrenzten Kontostatuschat: detaillierte Fixaufträge und jeweils Umsetzung durch Luna / very high (`gpt-6-luna`, `xhigh`). Drei Agenten arbeiteten nacheinander ausschließlich an `src/components/account-dashboard-menu.tsx` und einer neuen gemeinsamen Regression. Die Kopfzeile unterscheidet Fehler von laufender Prüfung, behandelt vorübergehend unbekannte Provideridentität ohne falschen Kontowechsel und lässt langsame Abfragen trotz des vorhandenen Fünfsekundentakts abschließen. Bekannte fremde Identitäten, Kontoschlüsselbindung/Adminlinks, echte 401, Sign-out und verspätete Antworten bleiben geschützt. Kein neuer Poller und keine Backend-/Sitzungsänderung.

Finale quellbasierte synthetische Regression **21/21 Testeinträge**, fokussiertes ESLint und TypeScript jeweils Exit 0. Elternchat hat den Produktdiff gegen den gesicherten tatsächlichen Eingang gelesen; Settingsprovider, Navbar und AccountApp sind vor/nach SHA-256-identisch. Bestehenden untracked/uncommitteten Gesamtstand erhalten. [Detaillierte Aufträge, Einzelbelege und quellgebundener Produktpatch](../entwuerfe/AUTH-01/HEADER-STATUS-20261031/ERGEBNIS.md).

**Nicht live; konkrete Liveursache weiterhin nicht abschließend zugeordnet.** Kein Build, Browser-/HTTP-/Server-/DB-/Mailzugriff oder echte Sitzung; keine Zentraldateien geändert und keine anderen Projektchats angeschrieben. Writerende aller drei Fixagenten.

## AUTH03 — isolierte Produktionsvertrags-Verbindungsprobe, 18.10.2026

Neuer enger Eigenprüfauftrag abgeschlossen: **1/1 neuer Integrationstest mit zehn bestätigten Grenzen**, echte eigene Loopback-PostgreSQL-/PrivateFiles-Verbindung unter Produktionsvertrag im getrennten künstlichen Kindprozess. Beide Pools am selben Testziel, Service-/Dateirundlauf, Dateimodi0700/0600, echte Datei-/DBrechtefehler, Fehlerclose und drei trotz Runtimefreigabe geschlossene KI-Hauptwege nachgewiesen. Gezielte Typprüfung/Lint bestanden. Keine alten AUTH-/Modul-/Restoreläufe oder Builds wiederholt.

**Keine Produktänderung:**316 erfasste Quellen unverändert; nur neue eigene Test-/Hilfen/Belege. Eigener Cluster/Tempdateien/Loopbackport vollständig bereinigt, normale Umgebung unverändert. Frühere eigene Hilfenfehler/Fehlläufe im Bericht offengelegt. Keine echte Betriebsöffnung, externe Mail-/Provider-/DNS-/TLSaktion oder Onlineabnahme.

[Bericht, tatsächliche Grenzen und Belege](./AUTH-01/PROD-INTEGRATION/ERGEBNIS.md). Auftrag beendet. Nach zweitem größeren Abschluss Wechselregel vor weiterer großer Umsetzung prüfen.


## AUTH03 — kontrollierter Produktionsruntimeanschluss, 18.10.2026

Begrenztes neues Runtimefenster abgeschlossen: `runtime.ts` und neuer `production-runtime.ts` binden den unveränderten validierten Produktionsvertrag tatsächlich an Ressourcen. Standard bleibt503; nur das exakte zusätzliche serverseitige Betreiberfeld `STEX_AUTH_RUNTIME_RELEASE` mit Wert `operator-approved` erlaubt den Aufbau. Kein Request-/Header-/Hostschalter. Releasewert ist cachegebunden; Ressourcenfehler bereinigt und vorhandener Pool bei Folgefehler geschlossen. Lokaler Weg erhalten.

**16/16 neue synthetische/instrumentierte Runtimefälle, gezielte Typprüfung und Lint bestanden.** Keine alten Prüfungen/Builds wiederholt.31 geschützte Vergleichsdateien unverändert. Keine aktuelle Umgebung aktiviert, realen Ressourcen/Secrets/Netz/Mails geöffnet oder Deploymentvorlagen geändert. Reale Produktionsöffnung und Betriebs-/Onlineprüfung weiterhin separat zu beauftragen. Historische Aussagen zum unveränderlich geschlossenen Vorgängeradapter unten gelten für dessen damaligen Abschluss.

[Ergebnis, Freigabevertrag, Belege und Grenzen](./AUTH-01/PROD-RUNTIME/ERGEBNIS.md). Keine Folgestufe gestartet.


## AUTH03 — Produktions-Konfigurationsadapter, 17.10.2026

Das exklusive Zwei-Dateienfenster aus Arbeitsrunde 33 ist abgeschlossen: `runtime.ts` bindet den neuen reinen `production-config.ts`-Adapter ein. Feste HTTPS-Origin, explizite pg-/TLS-Konfiguration, privater Pfad außerhalb des aktuellen Releases sowie getrennte Auth-/Mailgeheimnisse werden validiert; keine lokalen Produktionsdefaults und keine Requestmigration.

**21/21 gezielte Konfigurations-/Modusprüfungen bestanden**, dazu gezieltes Lint und isolierte Typprüfung. Keine fertige AUTH-Gesamtprüfung oder Produktionsbuild wiederholt. Sämtliche Prüfwerte und Ressourcenbindungen waren synthetisch; kein echter DB-/Datei-/Host-/Mail-/Providerkontakt, keine aktuelle Umgebungsumschaltung oder Schlüsselanlage.

**Produktion bleibt auch bei gültiger Konfiguration 503 / `production_auth_not_released`.** Es gibt keinen freischaltenden Ready-Umgebungswert. Vor einer späteren Öffnung sind die serverseitige KI-Sperre, Mailtransport, Operator-/Suchanschluss und Betriebs-/Onlineprüfung getrennt zu liefern. Lokaler Modus und bestehender gemeinsamer Einstieg bleiben erhalten; Konfigurationsänderungen können keine gecachte lokale Runtime in einen anderen Modus übernehmen.

[Vertrag, Grenzen und Belege](./AUTH-01/PROD-CONFIG/ERGEBNIS.md). Nur die zwei zugeordneten Produktdateien, neue eigene Tests und AUTH-Berichte geändert. `service.ts`, Schema, Sicherung, Paketdateien, Layout, KI und Maildispatcher unverändert. Diese Teilstufe ändert keine der historischen 40 Funktionsabnahmen und ist keine Onlinefreigabe.


## AUTH-A-R1 — gezielter lokaler Abschluss, 13.10.2026

Der Auftrag aus Arbeitsrunde 16 und seine Abschlussfortsetzung sind bearbeitet. **16/16 gezielte API-/Prozess-Testeinträge bestanden**, ergänzt durch tatsächliche Browserbedienung auf einer isolierten Kopie des uncommitteten Stands mit eigener synthetischer PostgreSQL-Datenbank. Keine erneute AUTH-A-Gesamtprüfung, kein neuer Produktionsbuild und keine Anwendung-/Schema-/Sicherungsänderung durch AUTH.

- **I-02 lokal geschlossen:** dieselbe gültige Einladung dreimal geöffnet, Mailvorschau zweimal; danach weiterhin pending/member, Revision 1, keine Identität/Sitzung und kein Verbrauch.
- **I-05 lokal geschlossen:** harte Appabbrüche vor Reservierung, in der Bibliothekstransaktion, nach Authcommit und vor Appfinalisierung; sichere Wiederaufnahme ohne zweite Identität/Besitzer-ID oder Passwortersatz.
- **I-06 lokal geschlossen:** tatsächlicher Ablauf während Anlage sowie Widerruf/Neusendung bei Abschluss und Abbruch; Commitreihenfolge, Ablehnung alter Nachweise und Fortsetzung desselben Claims belegt.
- **A-06 lokal ergänzt:** Cookiefixation über echte HTTP-Sitzungen, Abmelden/Replay, Adminfaktor sowie tatsächlicher Browserwechsel A→B und B nach Neuladen geprüft. Reale Passwortmanager-Autofill-/Zweitgeräteprüfung weiter offen.
- **R-01 lokal ergänzt:** Reset bei unbestätigtem/bestätigtem pending, blocked und Admin sowie unbekannter Adresse/abgelaufenem Nachweis; Status, Besitzer, TOTP und persönliche Daten erhalten. Externe Zustellbarkeit weiter offen.

Zwei TS2741-Fehler in den eigenen Kindprozessumgebungen durch explizites `NODE_ENV` korrigiert; abschließend ausschließlich gezieltes Lint und isolierte Typprüfung der neuen Hilfen. Funktions-/Browserprüfungen in der Abschlussfortsetzung nicht erneut ausgeführt. Historische AUTH-A-Testzahlen weiter unten sind keine neue Gesamtprüfung dieses Stands.

[Ausführlicher R1-Bericht und Belege](./AUTH-01/R1/ERGEBNIS.md), [aktualisierte 40-Fälle-Matrix](./AUTH-01/AUTH-A-PRUEFMATRIX.md): **30 lokal geprüft, 10 mit benannter Restprüfung ausstehend**. Keine vollständige Online-/Mail-/Geräteabnahme. Anwendung, gemeinsame Dateien und vorhandene Prüfdateien blieben read-only; keine echten Browserdaten verändert. Eine nicht abgeschlossene numerische Origin-Diagnose ist im R1-Bericht ausdrücklich als ungeklärt vermerkt, nicht als Produktfehler oder bestandene Abnahme.


## AUTH-A: lokale Umsetzung und Übergabe zum Architekturreview

Stand: 11.10.2026. Von Niklas einschließlich Implementierung, echter PostgreSQL-/Sitzungsprüfungen und Dokumentation beauftragt; Better Auth mit PostgreSQL, bestätigter E-Mail/Passwort und zusätzlichem Admin-Authenticator bestätigt. **Der abgegrenzte lokale AUTH-A-Ablauf ist umgesetzt und geprüft. Keine Veröffentlichung oder Freigabe eines vollständigen Onlinepiloten.** Der frühere AUTH-V-Bericht weiter unten dokumentiert den damaligen Entwurfsstand.

### Ausgangspunkt und erhaltene Daten

Projektstatus 7, TODO, CHAT_KOORDINATION, ARCHITEKTUR, aktualisiertes AUTH-Briefing, AUTH-V/Prüfplan und tatsächlicher DATA-B-Code gelesen. Die gemeinsame Kopie enthielt zahlreiche fremde Änderungen; Git-HEAD weiterhin `539bf2db8862edea310d558c4fc4e7f83725201f`, kein vollständiger Ausgangssnapshot. Eigene Dateihashes vor Änderungen zum Abgleich lokal festgehalten. `001_data_contract.sql`, bestehende Besitzer-IDs, Browserstore, Datentypen, Klassifizierungen, Lernlogik und PDF-Extraktionslogik unverändert. Die inzwischen von anderer Seite geänderten zentralen Koordinations-/Startdateien erhalten; hier keine zentralen Statusdateien gepflegt.

Die vorhandene lokale PostgreSQL-Datenbank wurde gestartet und um **Migration 002** erweitert. Drei ausdrücklich synthetische Konten über die echten Next-Routen eingerichtet, sichtbar geprüft und anschließend ausschließlich diese Konten samt eigenen Notizen/Mails/Nachweisen bereinigt. Versuchszähler und fremde Verifikationen wurden nicht global bereinigt. Vorhandene Fachkonten und Daten bleiben erhalten. Kein reales Niklas-Adminkonto angelegt; dessen Adresse/Passwort/Authenticator werden bei der persönlichen Einrichtung verwendet. Testdaten erscheinen nur auf den dokumentierten Prüfbildern.

### Tatsächlich implementiert

- Better Auth **1.7.7**, vor Installation mit offizieller Dokumentation und Paketregister abgeglichen. Direkte kompatible `pdfjs-dist`-Abhängigkeit **5.4.296** ergänzt; Parser unverändert und Dokumentregression bestanden.
- Additive `002_auth_accounts.sql`: echte Bibliothekstabellen, eindeutige Verknüpfung auf `stex.accounts.user_id`, separate Kontogeneration, Einladungen, Bootstrap, Audit, verschlüsseltes lokales Postfach, Verifikationsregister und gemeinsame Limits. Altbestand und das bisher positionale `createAccount` erhalten; Trigger legt zusätzliche Zugangsdaten an.
- Einladung sieben Tage, Zieladresse fest, zufälliges Token nur als Hash im Einladungsdatensatz. Adresse trimmen/kleinschreiben, keine Provider-Aliase zusammenführen. Direkter Signup ohne Einladung geschlossen. Wiederholung/Neusendung behält Besitzer- und Claim-ID, ersetzt ausschließlich den Einladungsnachweis. Administrative Vorgangskennungen sind idempotent; geänderte Daten mit gleicher Kennung 409.
- Bibliotheksanlage und Appfinalisierung ausdrücklich getrennte Commits. Globaler Writer-Lock serialisiert Claim/Freischaltung/Sperre/persönliches Schreiben. Bibliotheksbenutzer trägt unveränderliche Claim-/Besitzerzuordnung; nach unterbrochener Finalisierung derselbe Vorgang wiederaufnehmbar, ohne Passwortersatz oder zweite Identität. Für die Bibliothekscommits reservierte Verbindungen **zur gleichen Datenbank** verhindern Poolverklemmung bei 20 konkurrierenden Einlösungen. Keine zweite Lerndatenbank.
- Passwort 15–128 Zeichen, echte Bibliothekspassworthashes, echte Adressbestätigung, kein automatischer Bestätigungsbypass. Bestätigung liefert zunächst `pending`; persönliche Aktivierung erst nach vollständiger Einrichtung durch Admin. Blockieren/Entsperren erhält Daten/IDs und erhöht Revision/Generation. Alte Cookies werden nie wiederbelebt.
- Serverguard löst das echte Bibliothekscookie auf und prüft Datenbankstatus, Identitätszuordnung, Ablauf und aktuelle Generation. Mitglieder sieben Tage absolut, Admin acht Stunden; Cookiecache/automatische Sessionverlängerung aus. Sensible Verwaltung verlangt höchstens zehn Minuten alte Passwort-/Faktorsitzung.
- Persönliches Schreiben prüft Sitzung/Status/Generation erneut **in der Schreibtransaktion**, nach Writer- und Kontosperren. Eigentümer ausschließlich aus Principal, clientseitige Besitzerfelder abgewiesen. CAS-Revisionen und vorhandene Themen-/Referenzverträge verwendet. Zwei Personen können dieselbe Notiz-ID getrennt nutzen; fremdes Detail 404. Admin sieht keine fremden Notizen.
- Sitzungsbereinigung kann scheitern, ohne die Sperre rückgängig zu machen: Savepoint isoliert den DELETE-Fehler, Status/Generation committen; Audit/Antwort melden `librarySessionsRevoked=false`. Kontoverwaltung bietet `cleanup` an. Diese Wiederholung löscht nur ungültige Sitzungen, nicht zwischenzeitlich gültige neue Sitzungen.
- Adminbootstrap ausschließlich als explizite Operatorfunktion. Zuerst persönliche Einladung/Adressbestätigung, dann echte TOTP-Einrichtung/Verifikation, danach ausdrückliche Promotion; bisherige Einrichtungssitzungen entwertet. Kein erster öffentlicher Admin, keine öffentliche Rollenänderung; öffentliche Änderungen an Adminkonten vollständig geschlossen.
- Passwortreset über tatsächliche Better-Auth-Mail-/Resetfunktionen. Appgeneration bereits vor Bibliothekspasswortänderung widerrufen: selbst bei anschließendem Speicher-/Bibliotheksfehler keine alten autorisierten Sitzungen. Bibliothek verbraucht Reset einmalig; keine gemeinsame atomare Passwort-/Sessiontransaktion behauptet.
- Recoverycode einmalig und parallel abgesichert durch Bibliothek-CAS. Erfolgreiche Verwendung entwertet alle alten Adminsitzungen/Faktoren/Codes, setzt dasselbe Konto auf `pending/member` und öffnet die markierte Neueinrichtung. Neuer TOTP muss verifiziert und Admin anschließend betrieblich erneut freigegeben werden. Separater `recover-admin`-Operatorweg bei vollständigem Faktorverlust; adressiert ausschließlich das genannte bestehende Adminkonto. Adresswechsel noch geschlossen.
- Neue Seiten `/konto`, `/konto/anmelden`, `/konto/einrichten`, `/konto/zuruecksetzen`: Einrichtung/Anmeldung, Reset, Faktor/Recoverycode, Wartestatus, persönliche Lernnotizen samt Bearbeitung, Einladen/Freischalten/Sperren/Entsperren/Widerrufen/Neusenden/Bereinigung. Kein Zugriff auf bisherigen globalen Lernstore; keine automatische Browsermigration. In-Memory-Zustand bei Kontoänderung bereinigt, alte asynchrone Ladeantworten verworfen.

### Zugriffsschutz und Betriebsgrenze

Neue Endpunkte sind Node-Routen mit festem Serverorigin, Origin-/Hostprüfung und zusätzlichem `X-Stex-Action: 1` für POST. Echte Top-Level-Mailnavigation zu Bestätigung/Reset mit Einmalnachweis erlaubt; übrige Cross-Site-Zugriffe und fremde Rücksprungziele auch bei GET verboten, JSON begrenzt, alle geschützten Antworten `private, no-store`, `no-referrer`. Cookies HttpOnly/Lax und unter HTTPS Secure; JavaScript-lesbare Bearertoken-/Sessionkopien aus Bibliotheksantworten entfernt. Nicht benutzte Authwege, Trust Device, Deaktivieren des Faktors, öffentliche Adress-/Rollen-/Sessionänderungen geschlossen. Unbekannte Bibliotheksfehler bereinigt; Next-Entwicklungslog ignoriert Auth-/Kontoseiten mit Sicherheitslinks.

Gemeinsame PostgreSQL-Limits: pro Endpoint 300 Versuche/5 Minuten, Faktorwege 30/5 Minuten; zusätzlich E-Mail-Anmeldung 10/15 Minuten, Einrichtung 20/Stunde, Bestätigungs-/Resetmails 3/Stunde und Faktorcookie 5/5 Minuten. Vorwärts-IP-Header werden nicht vertraut. Konkrete Abweichung vom frühen Entwurf: lokaler Gesamtbudgetschutz statt ungeprüfter Proxy-IP; für Hosting vertrauenswürdigen Proxy und passende Betriebsbudgets ergänzen. Bibliothek besitzt zusätzlich ihre persistente Faktorfehlversuchslogik.

`accountRuntime` öffnet die Kontofunktion ausschließlich bei `STEX_AUTH_MODE=local`, Entwicklungsbetrieb und festem Loopback-Origin. Produktion liefert absichtlich 503 bis Mail-/Hostingkonfiguration geprüft ist. Vorhandene sensible APIs behalten `requireLocalAccess`; es wurde kein pauschaler Guardersatz vorgenommen. Echte lokale Produktionsprüfung bestätigt deren 403. Alte Lernansichten bleiben separat lokal nutzbar. Weitere Fachrouten erst mit eigenem Sitzungs-/Objektbesitzschutz öffnen.

### Sicherung und Wiederherstellung

DATA-Vollsicherung auf **Formatversion 2** erweitert; feste Tabellen-/Spaltenliste umfasst alle Bibliotheks- und App-Authdaten. Schemaabweichung auch bei leerer Tabelle wird erkannt. Backup sperrt Writer und erfasste Tabellen für konsistenten Stand. Authhaltiges Manifest vollständig AES-256-GCM-verschlüsselt und 0600, getrennte zufällige Sicherungs-/Authschlüssel erforderlich. Enthalten sind Besitzerbeziehungen, Passwortnachweise, verschlüsselte TOTP-/Recoverydaten, Audit sowie temporäre Nachweise. Authschlüssel selbst nicht eingebettet; Fingerprint überprüft richtigen ursprünglichen Schlüssel. Ohne Authdaten bleibt DATA-Manifest lesbar; Version 1 wird ausdrücklich nicht als vollständige Authsicherung akzeptiert.

Unveränderliche private Dokumentbytes weiterhin separat im privaten Dateispeicher, mit Prüfsummen geprüft; **diese Dateien sind durch diese Erweiterung nicht zusätzlich verschlüsselt**. Sicherungsordner 0700; für HOST-B Speichermedium und Verschlüsselung des gesamten Backupmediums entscheiden. Nicht nur das Manifest für eine vollständige Sicherung kopieren.

Restore ausschließlich leeres, passend migriertes DB-/Dateiziel. Datenhash vor Entwertung geprüft; danach alle Bibliothekssitzungen, temporären Bibliotheksnachweise, E-Mail-JWT-Register, Mailpostfach und Limits entwertet, Generationen erhöht, offene Einladungen widerrufen und offener Bootstrap abgelaufen. Das Register ist nötig, weil Bibliotheksbestätigung JWT-basiert ist und durch Löschen der Session-/Verificationtabellen allein nicht erlischt. Entwertung geschieht vor Restorecommit, auch bei einem Stand mit lediglich offenen Einladungen. Echte neue Anmeldung mit altem Passwort bzw. ursprünglichem TOTP auf wiederhergestelltem Ziel geprüft.

Getrennt vom Backup verwahren: ursprünglicher Authschlüssel und Sicherungsschlüssel. Mailkey für laufenden lokalen Mailbetrieb behalten; das beim Restore gelöschte Postfach muss nicht wieder lesbar werden. Schlüsselverlust kein heimlicher Faktor-/Passwortbypass; statt dessen ausdrücklich geprüfter Wiederherstellungsprozess.

### Stabile Anschlussstellen für IMPORT, PDF und ADMIN

| Anschlussstelle | Vertrag |
|---|---|
| `AccountService.principal(headers, level, fresh)` | Liefert interne `userId`, `identityId`, `sessionId`, aktuellen Status/Rolle, Konto-Revision/Generation und Faktor-/Sitzungszeiten aus echter DB-Sitzung. `level`: `identity`, `active`, `admin`; keine Eigentümer-/Rollenfelder aus Request übernehmen. |
| `checkPrincipal(client, sessionId, level, fresh, lock)` | Innerhalb Fachtransaktion erneut prüfen; Writer zuerst `lockState(client)`, dann `checkPrincipal(..., true)` und Datenänderung. Zukünftige persönliche IMPORT-/PDF-Metadatenzugriffe müssen ihre Objektberechtigung zusätzlich prüfen. |
| `GET /api/account` | Eigene minimale Kontometadaten/Warte-/Bootstrapstatus, `contractVersion:1`; keine fremden Lerninhalte. |
| `GET /api/account/notes`, `/notes/:id` | Eigene Lernnotizliste/Detail, `id`, `value`, `revision`; unbekannt/fremd 404. Noch keine allgemeine öffentliche DATA-Export-/Suchschnittstelle. |
| `POST /api/account/notes` | Genau `id`, `topicId`, `note`, `expectedRevision`; `null` für Neuanlage, sonst aktuelle Revision. Persönlicher `learning-entry` in DATA-B inklusive Themenreferenz; 409 bei Konflikt. |
| `GET /api/account/admin/accounts` | Operative Rolle/Status/Revision, Adresse/Name/Einladungszustand und Ergebnis letzter Sitzungsbereinigung; keine persönlichen Inhalte. |
| `POST /api/account/admin/invitations` | `email`, `name`, `requestId`; neue Einladung 201, identische Wiederholung 200. Frischer Adminprincipal erforderlich. |
| `POST /api/account/admin/account-action` | `userId`, `action`, `expectedRevision`, `requestId`; Aktionen `activate`, `block`, `unblock`, `resend`, `revoke`, `cleanup`. Revision und Audit; kein öffentliches Promote/Demote. |
| `backup/restore(..., AuthBackupProtection)` | Erweiterte Version 2; `encryptionKey` getrennt von ursprünglichem `authSecret`. Keine ungefilterten HTTP-Operatorendpunkte. |

IMPORT bleibt Operatorcapability, bis eigene Sitzungs-/Besitzerprüfung innerhalb derselben Fachtransaktion angeschlossen ist. Bestehendes repository-`requireAccount` ist weiter eine Statusprüfung und **ersetzt keinen Sitzungsguard**. PDF braucht Zugriff auf versioniertes Objekt, aktives Konto und konkrete Freigabe; bekannte Dateinamen bleiben kein Berechtigungsnachweis. ADMIN darf operative Metadaten nutzen; fremde Notizen/PDFs gehören nicht zur Adminrolle. Kein weiterer Chat wurde angeschrieben oder gestartet.

### Lokale Start- und Einrichtungsanleitung

Im Anwendungsordner:

```sh
npm run db:local
```

In einem zweiten Terminal:

```sh
npm run auth:init
npm run dev:auth
```

Kontobereich: `http://localhost:3001/konto` (festen Host beibehalten; nicht zwischen localhost und 127.0.0.1 wechseln). Private Schlüssel unter `db/.local`, vorhandene Schlüssel werden erhalten. Keine Geheimnisse im Terminal ausgeben. Datenbankstart wendet vorhandene additive Migrationen an; bei anderweitig laufender DB ausdrücklich `npm run db:migrate` verwenden.

Persönlicher Admin wird ausdrücklich vorbereitet:

```sh
npm run auth:operator -- prepare-admin '<eigene Adresse>' 'Niklas'
npm run auth:operator -- mail '<eigene Adresse>'
```

Mailvorschau `db/.local/auth-mail-preview.html` lokal öffnen; enthält befristete Sicherheitslinks, 0600, nicht weitergeben. Einladung folgen, eigenes Passwort setzen, lokale Bestätigungsmail öffnen, anmelden, TOTP und Recoverycodes einrichten/verifizieren. Die ausgegebene interne ID zur betrieblichen Fertigstellung verwenden:

```sh
npm run auth:operator -- finish-admin '<interne Nutzer-ID>'
```

Danach neu mit Passwort und Authenticator anmelden, Mitglieder einladen, deren Bestätigung abwarten und persönlich freischalten. Passwort-/Faktor-/Recoverycodes gehören ausschließlich zur eigenen Einrichtung; bisherige Browserdaten nicht automatisch importieren. Vollständiger Faktorverlust:

```sh
npm run auth:operator -- recover-admin '<interne Nutzer-ID>'
```

Setzt das bestehende Adminkonto auf sichere Neueinrichtung zurück; anschließend wieder verifizieren und `finish-admin`. Recoverycode-Anmeldung öffnet ebenfalls ausschließlich Neueinrichtung, bis die betriebliche Freigabe erneuert wurde. Kein zweiter Besitzer.

`ui-fixture.mts prepare/cleanup` ist nur für den ausdrücklich synthetischen lokalen Prüfvorgang auf Port 3001 vorgesehen. Vorbereitung verweigert vorhandene Authkonten/Bootstrap; private Fixture enthält synthetische Faktorinformationen. Cleanup besitzt eine enge Konten-/Nachweiszuordnung und verweigert fremde Authkonten. Nicht für reale Kontoverwaltung verwenden.

### Tatsächliche Prüfungen und Ergebnisse

- **179/179 Tests bestanden**, einschließlich **26 Auth-/PostgreSQL-Tests**, bestehender Persistenz- und Sicherheits-/Lernlogikregression. Echte Bibliothekscookies, Bibliotheksmails/-Resetnachweise und tatsächliches Plugin-TOTP; kein erfundener Principal.
- Zwei echte Appprozesse: Einladungsrennen 20 Aufrufe/ein Konto; gemeinsamer Limitzähler 16 Versuche/zehn zugelassen/sechs 429. Konkurrenz Sperre/Schreiben und CAS-Verwaltung geprüft.
- Echter PostgreSQL-Prozessneustart, realer Fehler beim Passwortspeichern, realer Fehler beim Löschen von Sitzungen, Teilcommit nach Authanlage und Wiederaufnahme. Passwortreset und Recoverycodes auch parallel, keine doppelte erfolgreiche Einlösung.
- Vollsicherung mit synthetischen privaten Dokumentbytes, echte Restore-Anmeldung von Mitglied und TOTP-Admin; falscher Schlüssel, Ciphertextschaden, Altschema und zusätzliche Schemaspalte verweigert.
- Vorhandene Datenbank + echte Next-Routen: drei synthetische Konten bis verifiziertem Admin und freigeschalteten Mitgliedern. Browser A speichert/liest nach Reload; B sieht A nicht und speichert separat. Adminbrowser verlangt tatsächlichen Authenticator vor Kontoverwaltung. Prüfbilder: [A-Notiz](./AUTH-01/persoenliche-notiz.png), [Kontowechsel](./AUTH-01/kontowechsel.png), [Admin](./AUTH-01/admin-kontoverwaltung.png).
- `npm run lint`, reguläres `npm run typecheck`, `git diff --check` bestanden. Vorhandenes generiertes Duplikat `.next/dev/types/routes.d 2.ts` gezielt außerhalb des Quellbaums gesichert; keine fremden Quellen gelöscht.
- Reguläres `npm run build` mit `STEX_ISOLATED_DEV=1` im bereits vorhandenen getrennten `.next-qa`-Ausgabeverzeichnis bestanden. Eigenen QA-Server vorher beendet; bisheriger Nutzer-Entwicklungsserver nicht beendet. Next ergänzte dafür `.next-qa`-Typinklusionen in `tsconfig.json`; keine abgespeckte Typkonfiguration.
- Echter lokaler Produktionsstart auf Port 3002: zehn vorhandene API-/Methodenkombinationen jeweils ohne und mit vorgegebenem Cookie 403; neue Auth-/Kontorouten 503 bis Betriebsfreigabe; Kontoseiten No-Referrer/No-Store. Kein externer KI-/Mailaufruf.
- `npm run test:documents` bestanden: reale lokale PDF-/DOCX-/XLSX-/Textquellen, Termine/Budget/Rescheduling/ICS/Undo geprüft. Keine Modellabnahme.
- Paketprüfung meldet acht bestehende Hinweise außerhalb des Authpakets: fünf hohe über ESLint/Fast-Glob/Micromatch/Braces und drei moderate über Mammoth/Argparse/Sprintf-js. Kein Better-Auth-Hinweis in dieser Prüfung; kein erzwungenes Framework-/Mammoth-Downgrade vorgenommen. Vor Hosting beim Paketreview adressieren.

Alle **40 Entwurfsfälle** einzeln: [AUTH-A-Prüfmatrix](./AUTH-01/AUTH-A-PRUEFMATRIX.md), **27 im lokalen Umfang geprüft, 13 begründet ausstehend**. Das ist keine vollständige TLS-/Mail-/PDF-/Onlineabnahme. Fehlgeschlagene Zwischenprüfungen wurden korrigiert und die betroffene Regression erneut ausgeführt; keine derzeit fehlgeschlagene Prüfung als Erfolg ausgewiesen.

### Eigener Änderungsumfang

Neu: Migration 002; `src/lib/server/auth/{security,service,runtime}.ts`; Auth-/Account-API-Routen; vier Kontoseiten und Kontolayout; `account-app.tsx`; Operator-/Fixture-/Testworkerskripte; `tests/auth-postgres.test.ts`; Prüfbilder und Prüfmatrix. Erforderlich erweitert: `persistence/database.ts` (reservierter Authpool derselben DB und idempotenter Shutdown), `persistence/backup.ts`, DATA-Operatorskript für Sicherungsschlüssel, bestehender Persistenztest für Migrationsstand 002, Paketdateien, `.env.example`, `next.config.ts` (Authzugangslog-/Referrerschutz), automatisch ergänztes `tsconfig.json`. Keine komplette Formatierung oder Nebenänderung fremder Lernlogik.

### Für den Architekturreview offen

Persönliche Datenintegration/IMPORT-B und geschützter PDF-Viewer sind eigene folgende Aufträge. Vor Onlinefreigabe Mailanbieter, Domain/HTTPS/Proxy, Betriebsschlüssel, Backupmedium/Restorebetrieb, Logs und Zielgeräte konkret prüfen; Produktionsruntime erst danach ausdrücklich öffnen. Ausstehende Fehler-/Browservarianten in der Prüfmatrix nachholen. Adresswechsel noch geschlossen. Keine benötigte zusätzliche Produktfrage für den gelieferten lokalen Ablauf. Anbieter/Budget und persönliche Admineinsicht bleiben im vorgesehenen Planungsprozess.

Keine echten Einladungen, externen Mails, Dokumentuploads, KI-Ausgaben, Browsermigration, Commits, Veröffentlichung oder Nachrichten an andere Chats. Quellen zur Integration: [Better Auth Installation](https://www.better-auth.com/docs/installation), [Next.js](https://www.better-auth.com/docs/integrations/next), [E-Mail/Passwort](https://www.better-auth.com/docs/authentication/email-password), [Zweitfaktor](https://www.better-auth.com/docs/plugins/2fa), [Sitzungen](https://www.better-auth.com/docs/concepts/session-management). Maßgeblich für die tatsächlich geprüfte Adapter-/Fehlersemantik ist zusätzlich der installierte Releasecode.


## AUTH-V: fertiger Entwurf des Anmeldekonzepts

Stand: 10.10.2026. Durch Niklas ausdrücklich nach aktualisiertem Briefing und Projektstatus 6 beauftragt. **AUTH-V als Entwurf abgeschlossen; AUTH-A, echte Sitzungen, Versand und Onlinebetrieb sind nicht umgesetzt.**

### Ausgangsstand

Gelesen: Projektregeln, App-AGENTS.md, Projektstatus 6, TODO, CHAT_KOORDINATION, ARCHITEKTUR, eigenes aktualisiertes Briefing, DATA-A-Datenvertrag/Ergebnis und Kontotypen, DATA-B-/ADMIN-Briefings. Git-HEAD beim Beginn: `539bf2db8862edea310d558c4fc4e7f83725201f`; umfangreiche vorhandene Änderungen/unversionierte Dateien erhalten. Der Commit bildet den Arbeitsstand nicht vollständig ab.

Relevante tatsächliche Grenzen geprüft: keine Authbibliothek in `package.json`; `requireLocalAccess` sperrt sensible APIs in Produktion; PDF-Dateiabruf benutzt lokale Dateisuche nach Name; heutige Tests belegen lokale Schutzregeln, keine echte Anmeldung. Beim Lesen waren `db/` und `src/lib/server/persistence/` noch nicht vorhanden. DATA-B-Erfolg oder aktueller Fortschritt anderer Chats wird nicht daraus abgeleitet.

### Geliefert

- [Konkretes Anmeldekonzept](../entwuerfe/AUTH-01/ANMELDEKONZEPT.md): Better Auth mit PostgreSQL, bestätigter E-Mail/Passwort und verpflichtendem Admin-TOTP empfohlen; keine zweite Technik für den kleinen Pilot.
- Einladung sieben Tage, einmalige Kontoanlage mit Reservierung/Wiederanlauf, separate Adressbestätigung und manuelle Aktivierung; `pending/active/blocked` getrennt von `member/admin`.
- Datenbankgestützte Sitzungen ohne Cookiecache; aktuelle Freigabe plus Objektbesitz bei jedem Fachzugriff; Generation entwertet bestehende Sitzungen bei Sperre und verhindert Wiederbelebung nach Entsperren.
- Erster Admin über markierte betriebliche Einrichtung, bestätigte Identität/TOTP und explizite Promotion. Passwort-/Faktor-/Adresswiederherstellung ohne neue Besitzer-ID; private Inhalte ohne allgemeine Adminleserechte.
- Tabellen-, Principal-, Endpunkt- und Transaktionsvorschläge auf DATA-A; Abweichungen/Ergänzungen für DATA-B und konkrete Routengrenzen dokumentiert. Auth-Signup und App-Transaktion ausdrücklich nicht als automatisch atomar dargestellt.
- [Prüfplan](../entwuerfe/AUTH-01/PRUEFPLAN.md): zwei Mitglieder plus Admin mit echter Authinstanz/PostgreSQL, Direkt-API/PDF, bestehende gesperrte Sitzungen, Einladungmissbrauch, Parallel-/Fehler-/Restore-/Recoverytests.
- Mail-/Hostingabhängigkeiten und mögliche Kosten offengelegt. Keine zusätzliche Produktfrage nötig, um diesen Entwurf fertigzustellen; Details als konkrete Empfehlungen vorgelegt. Anbieter/Budget, echte Adminadresse bei Einrichtung und persönliche Admineinsicht bleiben in ihrem vorgesehenen Prozess.

### Geänderte Dateien

Nur drei neue eigene Dokumente: `docs/entwuerfe/AUTH-01/ANMELDEKONZEPT.md`, `docs/entwuerfe/AUTH-01/PRUEFPLAN.md`, dieser Ergebnisbericht. Keine zentralen Status-/Architekturdateien, App-/Datenbankdateien, Pakete, Browserdaten oder Klassifizierungen verändert.

### Tatsächliche Prüfungen

Offizielle aktuelle Better-Auth-Dokumentation am 10.10.2026 zu PostgreSQL, Next.js, E-Mail/Passwort, Sessions, TOTP, Hooks/Schema, CSRF und Limits gelesen und im Konzept an den jeweiligen Aussagen verlinkt. Dokumentation nennt Release 1.7.7; offizielle Sicherheitsmeldungen zu PostgreSQL-Limitrennen und OAuth/Magic-Link-Kombination berücksichtigt. Die Versionswahl muss vor AUTH-A/Veröffentlichung erneut geprüft werden.

Lokaler Abgleich des Entwurfs mit DATA-A-Kontovertrag, Besitzerregeln, tatsächlichen Routensperren und Briefing-Abnahme. Automatische Dokumentprüfung bestanden: alle lokalen Verweise vorhanden, keine abschließenden Leerzeichen, abschließende Zeilenumbrüche vorhanden, 40 eindeutige geplante Abnahmefälle. `git diff --check` bestanden; eigener Schreibbereich per Gitstatus geprüft. Keine App-, Login-, Datenbank-, Mail-, Browser- oder KI-Tests ausgeführt. Der Prüfplan beschreibt zukünftige Prüfungen und meldet sie nicht als bestanden. Bestehende Testzahlen aus Projektstatus 6 wurden nicht neu verifiziert.

### Übergabe und Grenzen

Hier im Architekturprozess nach DATA-B die Kontotabellen, Bibliotheksadapter, Claims/Migrationsweg, gemeinsame Guard-/Persistenzschnittstellen und Zuständigkeit für gemeinsame Dateien prüfen. AUTH-A danach gesondert beauftragen; mindestens echten persönlichen Speichern-/Lesen-Ablauf mit zwei Konten und vollständiger Adminanmeldung liefern. Ungeprüfte APIs bleiben geschlossen, KI-Budget-/Modellabnahme separat.

Vor echten Einladungen Hosting/Domain/Mail und Kostenlimit wählen, Restore und Notfallzugang tatsächlich erproben. E-Mail-Anbieter erhält Adressen/Linkmails, keine Lerndokumente. Keine Einladungen/E-Mails/Nachrichten an andere Chats verschickt, keine Pakete installiert, Anbieter beauftragt, bezahlten Aufrufe, Uploads, Commits oder Veröffentlichungen.

## 18.10.2026 — Maildispatcher: konkreter Schemaabgleich vorbereitet

Neuer alleiniger AUTH03-Nachfolger hat das aktuelle Maildispatcherfenster, die bestehende Outbox-/Nachweissemantik und Format-4-Sicherung lesend abgeglichen. [Konkreter Schema-/Sicherungsbedarf und gezielte Abnahme](AUTH-01/MAIL-DISPATCH/SCHEMA-ABGLEICH.md): vorgeschlagene additive Migration 016 mit sieben Outboxspalten, dazu ausschließlich deren Sicherungsliste; keine neue Tabelle oder Formatversion. Insbesondere abgelaufene Sendeleases/unklare Annahme nicht automatisch wiederholen; aktuelle Nachweise vor Transport prüfen und keine DBtransaktion während Transport halten.

**Noch keine Implementierung oder Prüfung:** Vor Schemaänderung ist der im Auftrag vorgeschriebene Abgleich durch Planung offen. Nur eigener Vorabbericht und dieser Hinweis geschrieben. Arbeitsbaum erhalten; keine Produkt-/Schema-/Sicherungsänderung, Tests, Builds, Server, DB-/Provider-/Mailkontakte, Geheimniszugriffe oder Nachrichten an andere Chats. Keine fertigen Prüfungen wiederholt. Produktion bleibt geschlossen; Astra ausgeschlossen.

## 18.10.2026 — Maildispatcher nach zentralem Schemaabgleich lokal geliefert

Der vorgeschriebene konkrete Schemaabgleich ist erfolgt, danach ausschließlich das bestätigte Dateifenster umgesetzt. [Abschluss, Quellzuordnung und Prüfgrenzen](AUTH-01/MAIL-DISPATCH/ERGEBNIS.md): neuer explizit injizierter Postcommit-Dispatcher/Transportvertrag, additive Migration 016 mit sieben Outboxspalten, exakt dieselbe Ergänzung der Format-4-Sicherung. `service.ts`, Runtime, Produktionsadapter, Pakete/Layout und alte Migrationen unverändert. Kein automatischer Start oder echter Transportadapter.

**23/23 gezielte PostgreSQL-Testeinträge bestanden**, einschließlich echter vom bestehenden Authdienst erzeugter Outboxlinks an Fake, Konkurrenz, Commit/Rollback, Widerruf/Ablauf, Backoff/Fünf-Versuchegrenze, Lease-/Crash-/Timeout-Fences und verschlüsseltem Restore mit leerer Outbox. Gezieltes Lint und isolierte Typprüfung Exitcode 0. Temporäre Cluster/Pools/Wurzel und Typkonfiguration bereinigt. Keine alten Konfigurations-/AUTH-Gesamttests und kein Gesamtbuild wiederholt.

Unklar angenommene Transporte werden nicht automatisch wiederholt; keine exactly-once-/Postfachzustellgarantie. Echte SMTP-/Providerintegration, Dienst-/Betreiberanschluss und Onlinezustellung weiter offen. Produktionsanmeldung bleibt 503; keine Umgebung umgeschaltet, echte Schlüssel oder bestehenden privaten Daten gelesen, externen Mails/KIaufrufe oder Nachrichten an andere Chats. Begrenzter Auftrag beendet; Astra ausgeschlossen.

## 18.10.2026 — begrenzte Produktions-Betreiberkonfiguration geliefert

[Vertrag, Quelle und neue Prüfbelege](AUTH-01/PROD-OPERATOR/ERGEBNIS.md): `configuredPersistence` und Authoperator verwenden in Produktion denselben `readProductionAuthConfig`-Vertrag für explizite DB-/TLS-/Dateipfad-/Auth-/Mailwerte. Neuer reiner Modus-/Befehlsadapter; keine lokalen Produktionssecret-/URIdefaults. Produktions-init und Mail-Linkvorschau geschlossen, lokaler Weg erhalten. Nur die drei zugeordneten Module und neue eigene Tests/Belege geändert; öffentliche Runtime weiter 503.

**15/15 neue synthetische/instrumentierte Konfigurations-/Ressourcenfälle sowie gezieltes Lint/isolierte Typprüfung bestanden.** Keine echten Betreiber-/DB-/Datei-/Admin-/Schlüssel-/Mailaktionen, keine Migration oder Umgebungsumschaltung. Keine Wiederholung alter 21/23-Fälle und kein Build. Temporäre Typkonfiguration entfernt; 28 geschützte Vergleichsdateien unverändert.

Offen bleibt insbesondere der eigene lokale Sicherungsschlüssel-Fallback in `scripts/data-migration/persistence.mts`, außerhalb dieses Schreibfensters. Keine Produktions-Backup-/Restorefreigabe aus diesem Anschluss ableiten. Suchworker, Backup/Schema, SMTP, Pakete/Layout unverändert. Begrenzter Auftrag beendet; Astra ausgeschlossen.

## 18.10.2026 — SMTP-Adapter ohne echte Zustellung geliefert

[Ergebnis und Belege](AUTH-01/SMTP/ERGEBNIS.md): neue explizite SMTPkonfiguration und Nodemailer-Adapter, dazu ausschließlich bewusst ausgeführter Einzelbatch-Einstieg. Nodemailer10.1.2 exakt als einzige Abhängigkeit hinzugefügt, Typen enthalten; bestehende Paketversionen erhalten. Öffentliche Nodemailer-Sitzungs-/MIME-APIs statt eigenem SMTPprotokoll, strikte TLS-/Absender-/Headergrenzen, kurze Fristen und Abort; unklare Annahme bleibt unklar, keine automatische Adapterwiederholung. Runtime503, Service/Schema/Backup/Layout/KI unverändert.

**15/15 neue rein instrumentierte SMTP-/CLI-/MIMEfälle plus Typ/Lint bestanden.** Keine echte SMTP-/Provider-/Empfänger-DNSverbindung oder tatsächliche CLIausführung, Mail, DB-/Adminaktion oder Umgebungsumschaltung. Öffentliche Bibliotheksdokumentation und npm-Metadaten geprüft, beauftragtes Paket ohne Installationsskripte installiert. Keine alten23/15/21-AUTHläufe oder Builds wiederholt. Temporäre Typ-/Paketvergleichsdateien entfernt; keine eigene Laufzeit offen.

Nach drittem begrenztem Abschluss [sichere kurze Übergabe](AUTH-01/SMTP/UEBERGABE.md) vorbereitet; vor größerer Folgeumsetzung zentral koordinierte Rotation. Keine Besitzübertragung durch diesen Bericht, kein echter Versand oder Produktionsöffnung freigegeben. Astra vollständig ausgeschlossen.

**Enger SMTP-Abschlussreview:** Tatsächlicher installierter Connectcallback-Vertrag und stiller Pre-Greeting-Abbruch geprüft; dieser Fehlerpfad läuft nicht ausschließlich über `error`-Events. Kleinste Callbackfehlerbehandlung vor Login/Send ergänzt. Genau ein neuer synthetischer Regressionstest bestand, alte15 nicht wiederholt; Typ/Lint/Hashzuordnung und Übergabe aktualisiert. [Genauer Befund und Belege](AUTH-01/SMTP/ERGEBNIS.md). Keine echte Verbindung oder neue Arbeitsstufe gestartet.

## AUTH03 — Contabo: synthetischer Bootstrapvertrag, 21.10.2026

Begrenzter öffentlicher Bericht abgeschlossen: [Produktionsweg, private Kanäle und genaue Blocker](../entwuerfe/AUTH-01/CONTABO-SYNTHETISCHER-BOOTSTRAP.md). Unverändertes U08-Archiv/Manifest gebunden,18 nötige Mitglieder individuell gegen vorhandene Hashes/Bytezahlen gelesen. Vorhandene prepare-/finish-admin-, Registrierungs-, Verifikations-, TOTP-, Einladungs- und Aktivierungsgrenzen konkretisiert. Prepare gibt nur IDs/Ablaufzeit aus; sichere neue private stdout-Datei braucht einen noch einzurichtenden HOST-Launcher, keinen CLI-Outputschalter.

Offen bleibt ein tatsächlich TLS-/AUTH-konformer ausschließlich lokaler Sink mit privatem Postfachkanal; nackter Klartextsink und Produktions-Mailvorschau sind kein gültiger Weg. Unter genau erfülltem SMTPvertrag ist kein Authproduktfix belegt. Neue Betriebs-/Sink-/TLSgeheimnisse weiterhin gesondert freizugeben. Keine Konten/Keys/Code/Schema/Deploy/Archiv geändert, keine Tests/Builds/Node-/Server-/Netz-/DBaktion oder privaten Konfigurationen; keine Nachrichten/Unteragenten. Normale Daten und Guards erhalten. Writerende für beide reservierten Pfade; Auftrag beendet. Nach drittem begrenztem Abschluss vor größerer Umsetzung Übergabe/Rotation planen, keine alten Prüfungen wiederholen.

## 24.10.2026 — R37-AUTH-FIRSTUSER-PREP abgeschlossen

Frischer autorisierter AUTH-01-Nachfolger hat AGENTS, aktuelle zentrale Einstiege/eigenes Briefing, kurze AUTH-Übergaben, öffentliche R36-/Admin-/Direktlinkmetadaten, aktuellen Quellstand und DATA-Bestandsübergabe lesend abgeglichen. Umfangreicher vorhandener Arbeitsbaum erhalten. [Konkreter Erstnutzerweg, Lücken, Dateibesitzvorschlag und endlicher Anschlussauftrag](../entwuerfe/AUTH-01/R37-ERSTNUTZER.md).

**Bestand:** Einladen und persönliche Freischaltung bereits über `/konto/verwaltung` an vorhandene APIs angeschlossen; reguläre Registrierung/Adressbestätigung, neues pending/member und spätere Aktivierung ohne neuen Adminbootstrap. Eigene Profile/Fortschritte/Notizen/Pläne/Entwürfe/private Dokumente besitzen Konto-Scope; gemeinsamer Katalog/PDF verlangt aktive Anmeldung. Bestehende lokale Isolationsabnahmen referenziert, nicht wiederholt. R36 ist live; alte Runtime503-/SMTP-zwingend-Sätze sind historisch.

**Konkrete Restlücke:** kein kopierbarer Link in Verwaltung; bisheriger privater HOST-Direktweg nur für Niklas belegt, nicht unverändert für Freund/aktuellen R36-Datenzweig übernehmen. Zwei kleine UI-Textkorrekturen in `account-app.tsx`/`admin-overview.tsx` vorgeschlagen, keine fehlende Erstellungs-/Aktivierungs-API oder neues Design. HOST benötigt neue genau empfänger-/zweck-/zielgebundene Memberzustellung und enge Netzabstimmung; bestehende `/32` blockiert den Freund sonst. Empfehlung zusätzliche bestätigte Freund-IP neben Niklas und weiter `deny all`; beliebige Netze wären eigene konkrete Reichweitenentscheidung. Auth-/Origin-/Admin-TOTP-/Dokument-/Pilotschutz erhalten. Keine echte Mailzustellung oder Postfachkontrolle behauptet. Vollständiger Katalog hängt getrennt an benanntem echtem Export/Import gemäß DATA.

Fehlend für Umsetzung: E-Mail-Adresse/Anzeigename des Freundes, bei enger Netzvariante öffentliche IP. Danach Planung: genau zwei Textpfade zuweisen und HOST den konkreten neuen Memberzustell-/Netzplan herstellen lassen; tatsächliche Konten-/Link-/Netzwirkungen erst im dafür gebundenen Folgeauftrag. Nur neue Anschlussfälle beschrieben, keine spätere Mail-/Finanzierungs-/Modellpipeline.

**Tatsächlich nur neuer Bericht und dieser Nachtrag geschrieben.** Keine Produkt-/Zentraldatei-/Schema-/Paketänderung, Tests/Builds, privaten Konfigurationen/Linkdateien/Secrets gelesen, Konten/Einladungen/Mails erzeugt, Server-/Netz-/Provideraktion, bezahlte KI, Unteragenten oder Nachrichten an andere Chats. **Writerende; kein eigenständiger weiterer Auftrag.** Sol beibehalten, Astra vollständig ausgeschlossen.

## 25.10.2026 — R37-IMPORTSTART

Neuer dünner CLI-Starter `scripts/data-migration/catalog-start.mts` verbindet nur den fertigen Loginhelfer und den unveränderten Applyoperator. Er verlangt vor jedem Login eine vollständige private `run-config.json`, prüft den echten Metadaten-Gate anhand des vom HOST gelieferten Datei-SHA, dessen Ziel-/Core-/Operator-/Phasenbindung und Frist und lässt den vorhandenen Operator den eingefrorenen Plan offline prüfen. Bei fehlender/unvollständiger Konfiguration, ungültigem Gate, vorhandener fremder Sperre oder PDFfortschritt stoppt er vor der Anmeldung.

Der manuelle Ablauf verwendet private Zustands-/Sitzungspfade unter `~/.stex-catalog-import/`, übernimmt einen vorhandenen Checkpoint ohne `prepare` oder automatische Sperrenbereinigung und lässt ausschließlich den Operator einen gespeicherten offenen Metadatenpunkt bestätigen/fortsetzen. Nach erfolgreicher versteckter Terminalanmeldung ruft er nur `apply-metadata` mit höchstens fünf Batches/300 Sekunden, anschließend `status` und bei fünf bestätigten Batches einmalig das online lesende `prepare-pdfs` auf. Kein `apply-pdfs`, PDFupload oder Indexlauf. Child-Exitcodes bleiben erhalten; nach regulärem Ende wird nur die eigene Sitzungsdatei entfernt.

Die Ausgabe der PDFbindung wird zur separaten HOST-Übergabe auf Corehash, `metadataReceiptsSha256`, `pdfBindingsSha256` und Zähler begrenzt. Der Starter liest selbst keine privaten QuellJSONs, Sitzung oder Cookieinhalte und speichert keine Checkpoints/Operatorausgaben in einer neuen Exportdatei. [Betriebsablauf und Grenzen](../entwuerfe/AUTH-01/R37-IMPORTSTART.md). Die neue `run-config.template.json` lässt Gatepfad/-hash und Quellwurzel ausdrücklich auf `null`. Laut gemeinsamem aktuellem Projektstatus erstellt HOST den tatsächlichen Metadaten-Gate noch; unter dem zugewiesenen Importordner lag nur die Vorlage. Deshalb wurde bewusst weder `run-config.json` erstellt noch irgendein Gate-/Hashwert ergänzt; der spätere Nutzeraufruf bleibt bis zum echten HOST-Gate geschlossen.

**Gezielte neue Prozessgrenztests: 10/10 TAP-Einträge bestanden** (fehlende Konfiguration ohne Prozessstart; Loginfehler und Terminalabbruch ohne Apply bei erhaltenem Exitcode; Metadatenfehler ohne PDFaktion; Checkpointwiederverwendung; bestehende Sperre unverändert erhalten; unvollständige Metadaten ohne PDFbindung; vorhandene Bindung ohne zweiten Versuch; erfolgreiche schreibfreie Bindung mit nur sechs Übergabefeldern). Ausschließlich neuer Test `tests/r37-catalog-start.test.ts`, gemockter Prozessstarter und temporärer künstlicher Gate; keine echte Login-/Server-/Importprüfung. Gezieltes ESLint für genau Starter/Test und gezielte TypeScriptprüfung für genau diese Dateien bestanden. Die erste Laufserie fand den nicht unterstützten Parameter-Property-Syntaxfehler unter Node22-Strip-Types; nach kleinster Korrektur bestand der finale neue Lauf. Keine alten Auth-/Import-/UItests oder Builds wiederholt.

Vorhandene `catalog-session.mts`/`catalog-apply.mts`, Produktcode, Schema, Pakete und Zentralstatus unverändert. Keine echte Anmeldung, Zugangsdaten, privaten Quellbytes, Cookie-/Sitzungsinhalte, externe Server-/Netzverbindung, Metadaten-/PDFimports oder tatsächliche HOST-Gates erzeugt oder gelesen. **Writerende für R37-IMPORTSTART; tatsächliche Nutzung erst nach Eingang des HOST-Gates und der daraus gebundenen lokalen Konfiguration.**

## 24.10.2026 — R37-AUTH-COPY abgeschlossen

Nach exklusiver zentraler Zuweisung nur sechs vorhandene Textstellen in `src/components/account-app.tsx` und `src/components/admin-overview.tsx` korrigiert. Veraltete Browserdaten-/lokale Testmailtexte ersetzt: Kontodaten bleiben persönlich; Einladung, Bestätigungs- und Resetanforderung verweisen auf die separate persönliche Linkbereitstellung im manuellen Pilot. Bedingte Antworten verraten keinen zusätzlichen Kontostand, kein erfolgter SMTPversand oder Linkempfang behauptet. Admin-Aktionslabel beschreibt das Vorhaben auch im bestehenden Wiederholungsdialog ohne voreilige Erfolgsaussage.

[Exakte Stellen, Quellhashes und enger Änderungsbeleg](../entwuerfe/AUTH-01/R37-ERSTNUTZER.md). Vorher-/Nachhervergleich zeigt vier plus zwei reine Textzeilen; Markup/Klassen/Navigation/Interaktion/APIaufrufe unverändert. **Gezieltes ESLint beider Komponenten Exit0**. Keine neue Testsuite, alten Tests, Typ-/Gesamtprüfungen oder Builds; temporäre eigene Vergleichskopien entfernt.

Nur diese beiden Produktdateien und die zwei eigenen Berichtsanhänge geschrieben; kein Deploy, keine Service-/Auth-/Schema-/Backup-/Paketänderung, Konten/Links/Mails/Keys/Provideraktionen oder Domainbeschaffung. Spätere gebündelte Releaseübernahme bleibt bei Planung/HOST; kein Folgeauftrag gestartet oder versendet. **Writerende R37-AUTH-COPY.** Sol beibehalten, Astra vollständig ausgeschlossen.

## 25.10.2026 — R37-IMPORTANMELDUNG abgeschlossen

Neuer minimaler `scripts/data-migration/catalog-session.mts` mit ausschließlich eingebauten Node-Modulen und neue gezielte `tests/r37-catalog-session.test.ts`. [Kurzer späterer Nutzeraufruf, exakter privater Vertrag und Grenzen](../entwuerfe/AUTH-01/R37-IMPORTANMELDUNG.md). Mensch gibt E-Mail/Passwort/TOTP später selbst ohne Echo im privaten Terminal ein. Feste HTTPS-Origin, echte normale Sign-in-/TOTP-Endpunkte, serverbestätigter aktiver Admin und vorhandene serverseitige Freshgateprüfung vor Dateianlage. Keine erfundene Sitzung/Faktorbehauptung, Redirects/TLSabschaltung und zusätzliche CLIparameter bleiben geschlossen.

Neue private0600Datei unter0700Eltern enthält ausschließlich die vier vom vorhandenen Applyoperator akzeptierten Felder und den echten Secure-Sessioncookie; kein Cookiejar, keine Rollen-/Faktorfelder, kein Cookieexport aus dem Browser. Keine vorhandenen Dateien überschrieben, Owner-/Symlink-/Exklusivitätsprüfung, begrenzter Versuch, bereinigte Codes statt Serverdetails. Datei bleibt lokal; HOST muss tatsächlichen Betreiberstandort/Erreichbarkeit und gegebenenfalls konkrete private Übergabe erst binden.

**15 nichtnative neue TAP-Einträge bestanden; vier native neue Authfälle plus Rahmen5/5 endgültig bestanden.** Echte kurzlebige PostgreSQL-/Better-Auth-/TOTP-Fixture ohne externe HTTPSverbindung belegt gültige Sitzung, falschen Faktor, reguläres Mitglied und veraltete serverseitige Faktorprüfung. Nichtnative Fälle prüfen Redirect-/Origin-/Cookie-/Limitgrenzen, instrumentierte verdeckte TTY-Eingabe/Abbruch und reale private Dateiausgabe samt tatsächlichem Apply-Sitzungsleser. Zwischenfehler (Sandboxport, ungeeignete frühere HTTPfixture, optionaler Callback-Locationheader) gezielt korrigiert; eigene verbliebene Testlaufzeit beendet/bereinigt, betroffene native Fälle erneut bestanden. Finale gezielte Lint-/Helfer-Typprüfung und nativer Node-Import Exit0. Keine alten Suiten oder Builds wiederholt.

Backend/UI/Routes/Schema/Releasepaket unverändert; Applyoperator weiter SHA256 `f3d5806a9f555f89fdb40936246e8d69c118104b427d7041b57efd129d896889`. **Keine echte Anmeldung oder Helfer-CLI gestartet**, keine echten Zugangsdaten/private Quellen/Sitzungsdateien gelesen/angelegt, externe Server-/Netz-/Providerkontakte, Konten-/Mail-/Keyaktionen, Imports oder Transfers. Neue Geheimnisse nur innerhalb gelöschter künstlicher Testfixture. Sol/high beibehalten, Astra ausgeschlossen. **Writerende R37-IMPORTANMELDUNG; kein eigenständiger weiterer Auftrag.**

## 25.10.2026 — R37-START-OUTPUT-FIX

Der echte Nutzerstart stoppte vor der Loginabfrage, weil `catalog-start.mts` beim Offline-`prepare`-Ergebnis `runnable: false` als unbekanntes Feld zurückwies. Der vorhandene Applyoperator liefert dieses Feld zusätzlich zu seiner Summary; `status` liefert nur die neun Summaryfelder. Die genaue Ursache und Feldverträge stehen im [Prüfbericht](../entwuerfe/AUTH-01/R37-START-OUTPUT-FIX.md).

Nur die strikte Summary-Verkabelung des Starters wurde angepasst: je Modus bleibt die erwartete Feldmenge exakt; `offline-prepare` verlangt ausdrücklich `runnable: false`. Login-/Applyhelfer, Auth-/Commit-/Gate-/Backendlogik, Core/Vorlagen und Runconfig wurden nicht geändert.

**Die neue tatsächliche Offline-Integration bestand:** Der unveränderte Applyoperator lief in einer eigenen privaten Tempwurzel als echte Childprozesse für `prepare`, `inspect` und `status`. Der Wrapper erreichte anschließend den Loginübergang; der Login-Child wurde vor dem Prozessstart blockiert. Ein nur im Tempverzeichnis erzeugter privater Checkpoint wurde über `status` wiederverwendet; sein Hash blieb unverändert. Der konfigurierte Quellpfad war nicht vorhanden. Keine Original-SourceJSON/PDF-Lesung, echte Anmeldung, Netzwerk-/Serververbindung oder Importaktion. Gezieltes ESLint und TypeScriptprüfung für Starter und Regression bestanden. Keine alten zehn gemockten Prozessgrenzfälle, übrigen AUTH-/Import-/UI-Suiten oder Builds wiederholt.

Die aktuellen SHA-256-Werte der unveränderten Helfer stimmen mit den zuvor bestätigten Werten überein: `catalog-apply.mts` `f3d5806a9f555f89fdb40936246e8d69c118104b427d7041b57efd129d896889`; `catalog-session.mts` `dd35200f897f26b724c396ba9398948660272425d047c025b3efed4746b717b4`. Der reale private Nutzercheckpoint, die Sitzungsdateien, das Gate und die Runconfig wurden nicht gelesen oder verändert. Laut bestehender Übergabe ist das Gate bis 14:47 CET gültig. Für Niklas gilt derselbe Aufruf aus `lern-tracker/`: `node --no-warnings --experimental-strip-types scripts/data-migration/catalog-start.mts`. Writerende; keine zentrale Statusänderung vorgenommen.

## 25.10.2026 — R37-PDFSTART

Neuer dünner Starter `scripts/data-migration/catalog-pdf-start.mts` plus absichtlich unvollständige `deploy/pilot/targets/contabo-test/import-r37-20261025/pdf-run-config.template.json`. Der Starter liest nur die vorhandene fixe private Runstatewurzel per unverändertem Offline-`status`, legt keinen State an, ersetzt keinen Checkpoint und ruft nie `prepare-pdfs` auf. Vor dem Login müssen fünf Metadatenbatches bestätigt, keine Metadatenrequests offen, PDFbindings vorhanden und ein separater aktueller HOST-Gate gültig sein. Das PDF-Gate muss Phase, Operator/Core/Ziel/Freshness sowie `metadataReceiptsSha256` und `pdfBindingsSha256` exakt binden. Der tatsächliche PDF-Gate und eine echte PDF-Runconfig fehlen weiterhin; keine Ersatzfreigabe wurde erzeugt.

Bei späterer manueller Nutzung wird derselbe versteckte Loginhelfer genau einmal genutzt und anschließend genau ein bestehender `apply-pdfs`-Aufruf mit maximal449Schritten/480Sekunden gestartet. Kein Wrapperloop, Reauth, Retry, `prepare-pdfs`-Neubindung oder Indexlauf. Danach werden nur echte sekretfreie Status-/Restzähler ausgegeben, stets als PDF-Fortschritt, nie als Gesamtkatalogabschluss. Offene Beleg-/Responsefälle bleiben Aufgabe des Applyoperators.

**7/7 neue gezielte TAP-Fälle bestanden:** ungefüllte Vorlage; fehlende Runconfig, fehlendes PDF-Gate, falsche Gatebindung, Teilmetadaten und fehlende Bindungen jeweils vor Login; vollständige Metadaten mit bestehenden Bindungen und synthetischem PDF-Teilstand erreichen den explizit vor Spawn/Netz blockierten Loginübergang. Echte lokale Offline-`prepare`- und `status`-Childprozesse belegen Format und Modus der aktuellen CLI-Ausgaben; die Statusausgabe enthält genau neun Summaryfelder ohne `mode`. Gezieltes ESLint und TypeScriptprüfung bestanden. Kein echtes `apply-pdfs`, Login, Serverkontakt, Originalquell-/PDFlesen oder Import.

Nur die neuen Starter-/Test-/Templatepfade und dieser Bericht wurden geschrieben. `catalog-start.mts`, `catalog-session.mts`, `catalog-apply.mts`, die Metadaten-Runconfig, Backend, Core/Vorlagen, Gate und realer privater Nutzercheckpoint blieben unberührt. [Ablauf, exakter späterer Config-/Gatevertrag, Prüfungen und Grenzen](../entwuerfe/AUTH-01/R37-PDFSTART.md). Späterer Aufruf nach echtem Gate und gebundener privater Runconfig: `node --no-warnings --experimental-strip-types scripts/data-migration/catalog-pdf-start.mts` aus `lern-tracker/`. **Writerende für R37-PDFSTART; keine zentrale Statusänderung.**

## 25.10.2026 — R37-LOGIN-EXIT-DIAG

Die neue Regression belegt eine mögliche TTY-Lifecycleursache für `session_saved` ohne anschließendes Child-`close`: War stdin bereits aktiv, pausierte `privateTerminal.close()` den Stream zuvor nicht. Der Helfer konnte damit die Erfolgsausgabe schreiben, während der Prozess offenblieb. `catalog-start.runChild` wartet korrekt auf `close` und startet Apply erst nach erfolgreichem Login-Child; der Wrapper blieb unverändert.

Minimal korrigiert: Der CLI-Hauptpfad pausiert stdin beim TTY-Aufräumen immer; `session_saved` erscheint erst danach. **1 gezielter neuer Prozess-/TTY-/synthetischer-Transporttest bestand nach der Korrektur**; vor ihr scheiterte derselbe Test nach 2,5 Sekunden, weil der Kindprozess nicht schloss. Gezieltes ESLint und gezielte TypeScriptprüfung für genau Helfer und Test bestanden. Keine alten Suiten oder Builds wiederholt. [Diagnose, exakte Grenzen und Belege](../entwuerfe/AUTH-01/R37-LOGIN-EXIT-DIAG.md).

Die synthetische Reproduktion ist keine Feststellung zum damaligen echten Prozess. Keine Prozessinspektion oder -unterbrechung, private Session-/Checkpoint-/Runconfig-Lesung, echte Anmeldung, Server-/Netzverbindung, Importaktion oder Sessionbereinigung. Der korrigierte Quellstand wirkt nicht rückwirkend auf einen bereits laufenden Prozess; eine möglicherweise nach Abbruch verbliebene private Session wird nicht wiederverwendet. Keine zentrale Status-/Koordinationsdatei geändert; Diagnose abgeschlossen.

## 26.10.2026 — R37-PDF-HELPER-ERROR

Im PDF-Starter wurde der Fehlervertrag des Apply-Childs korrigiert: Statt `stderr` pauschal zu verwerfen und jeden Exit als `helper_failed` zu melden, übernimmt der Starter nun ausschließlich eine exakte, einzeilige JSON-Fehlerform mit allowlist-basiertem festem `ApplyError.code`. Eingabe ist auf 2 KiB begrenzt; unbekannte/injizierte Codes, Zusatzfelder, Mehrzeilen- und Überlängenausgabe bleiben generisch. Rohinhalte werden nie ausgegeben. Child-Exitcode und nachfolgender echter Offline-Status bleiben erhalten. `catalog-apply.mts` blieb unverändert. [Befund, erlaubte Fehlergrenze und Wiederaufnahmeablauf](../entwuerfe/AUTH-01/R37-PDF-HELPER-ERROR.md).

**5/5 neue synthetische Prozessgrenzen bestanden**, einschließlich gültigem Code, unbekanntem/pfadinjiziertem Inhalt, zusätzlichem und doppeltem Feld sowie überlanger Ausgabe. Alle Fälle behielten Exitcode 7 und den künstlichen Status `Metadaten 5/5; PDF 0/449; wartend 1`. Gezieltes ESLint und eine isolierte Typprüfung für Starter und neue Regression bestanden. Kein Loginhelfer, Applyoperator, Netzwerk, Upload, Quell-PDF oder privater Checkpoint wurde ausgeführt/gelesen. Keine alten Tests oder Builds wiederholt.

HOST fand für den offenen echten Vorgang bislang keinen Importbeleg, keine Dokumentidentität/-version oder Suchjob; die betroffene Katalogzeile blieb Revision 1. Im App-/Proxyjournal war kein passender Eintrag, HTTP-Ankunft bleibt ungeklärt. Der ursprüngliche Childcode ist verloren, weil die frühere Version `stderr` verworfen hat; kein Loginfehler oder bestimmter Transportfehler wird daraus abgeleitet. Der bestehende Applyoperator fragt bei Wiederaufnahme erst den Beleg mit derselben stabilen Request-ID ab und verwendet bei erneutem `not_found` nach Zielprüfung dasselbe gespeicherte Binding und dieselbe ID. Keine Wiederaufnahme ausgeführt oder freigegeben. Nächster Schritt: HOST schließt die rein lesende Serverabstimmung ab; bis Serverlage und sichere Ursache geklärt sind kein neuer Login-/Applylauf. Keine zentrale Status-/Koordinationsdatei geändert; Writerende.

## 26.10.2026 — R37-LOGIN-RESPONSE-DIAG

Read-only Codeeinordnung von `catalog-session.mts` und `catalog-pdf-start.mts`; keine Quellcodeänderung. `response_denied` entsteht nach dem ersten `POST /api/auth/sign-in/email` bei zusammengefassten Responseprüfungen (MIME/Body, Lesen, JSON-Syntax/-Form). Der HTTP-Status wird erst nach erfolgreicher JSONobjektprüfung ausgewertet; TOTP-Abfrage folgt erst nach erfolgreicher Status- und Challengeprüfung. Der Wrapper erbt den Helferfehler im Terminal, startet bei fehlgeschlagenem Login kein Apply und meldet anschließend `helper_failed`. Der Code belegt weder falsche Zugangsdaten noch Rate-Limit.

HOST fand im 30-Minutenfenster keine App-Journaleinträge oder zuordenbare Proxyanfrage; kein HTTP-Status, Route, Denial oder Rate-Limit ist belegt. Der konkrete Responsezweig bleibt offen. [Kurzbefund, fehlende bereinigte Statusdaten und kleinster Diagnosefolgeauftrag](../entwuerfe/AUTH-01/R37-LOGIN-RESPONSE-DIAG.md). Kein Login, Netzwerkaufruf, private Config-/Checkpointzugriff, Test oder Build; vorhandene offene Request-/Bindungsdaten unberührt. Kein neuer Login angefordert. **Writerende.**

## 26.10.2026 — R37-LOGIN-FIXED-SUBCODES

Nur `catalog-session.mts` wurde für feste Response-Untercodes geändert. MIME, fehlender Body, Größenlimit, Lesefehler, JSON-Syntax und JSON-Form erhalten getrennte Codes. Für diese Kategorien kann der Helfer zusätzlich ausschließlich einen validierten numerischen HTTP-Status ausgeben. Transportgrößenfehler bleiben als Größenfehler erkennbar; andere Transportfehler behalten `network_or_tls_failed`. Freie Meldungen, Responsebody, StatusText, Headerwerte, URL und Cookie bleiben verborgen. Auth-/TOTP-/Redirect-/Cookie-/Transportgrenzen sind semantisch unverändert; der PDF-Starter blieb unverändert. [Technischer Befund und Grenzen](../entwuerfe/AUTH-01/R37-LOGIN-FIXED-SUBCODES.md).

**13/13 neue synthetische Fälle bestanden**, darunter alle sechs Responsekategorien, Status-/Inhaltsfilter, Größenlimit an der 65.536-Byte-Grenze, bestehende Schutzablehnungen und erfolgreiche TOTP-Challenge. Gezieltes ESLint und isolierte Typprüfung bestanden. Keine alten Tests/Builds, echte Anmeldung, Netzwerk-/Serveraktion oder private Dateilesung. Die tatsächliche Ursache des vorherigen Responsefehlers bleibt unbekannt; kein Retry angefordert.

Kein offener Request, Gate, Binding oder Checkpoint verändert. **Dritter großer Abschluss seit Rotation; vor einem weiteren Großauftrag sichere Rotation vorsehen. Writerende.**

## 26.10.2026 — R37-LOGIN-403-CLIENT-READ

Ein einzelner curl-Aufruf an den festgelegten öffentlichen Ursprung ergab **403**, MIME-Klasse `text/html`, **146 Byte**; curl meldete eine HTTP-Antwort ohne Transportfehler. Das stützt eine vor Auth liegende Zugriffssperre als Möglichkeit, belegt aber weder denselben 403-Zweig noch die konkrete Ursache. Da curl nicht mit `-q` gestartet wurde, sind lokale Auth-/Cookie-/Redirect-/TLS-Optionen und der endgültig beantwortete Pfad nicht unabhängig verifiziert. Der Loginfehler bleibt ungeklärt. [Befund, Einschränkung und nächster Schritt](../entwuerfe/AUTH-01/R37-LOGIN-403-CLIENT-READ.md).

Der explizite Kommandoaufruf enthielt keine Auth-/Cookie-/Redirectfolge-/TLS-Ausnahmeoption. Da curl nicht mit `-q` gestartet wurde, kann eine benutzerspezifische Konfiguration solche Optionen nicht sicher ausschließen; es gab keinen zweiten Abruf. Kein Login, Test, Build, Servereingriff, privater Dateizugriff oder Änderung an Code, Gate, Binding oder Checkpoint. Nächster Schritt: HOST schließt den rein lesenden Abgleich tatsächlicher 403-Zweige/Ingressregel ab. **Writerende.**

## 26.10.2026 — R37-LOGIN-403-CLIENT-READ: korrigierte Messung

Der erste curl-Aufruf bleibt eingeschränkt dokumentiert. Genau ein korrigierter Aufruf derselben öffentlichen Startseite lief mit `-q` als erstem curl-Argument; Benutzerkonfiguration war deaktiviert. Keine Auth-/Cookie-/netrc-Option, Redirectfolge oder TLS-Ausnahme; normale TLS-Prüfung und Standard-Proxyverhalten. Keine Proxy-/VPN-/DNS-/Hostumgehung.

**Maßgeblicher Messbeleg:** 2026-10-26 07:53:52 UTC; Status **403**; MIME-Klasse `text/html`; **146 Byte**; Transportkategorie HTTP-Antwort empfangen (curl-Exitcode 0, TLS-Prüfung aktiv). Das stützt eine vorgelagerte Zugriffssperre als Möglichkeit, belegt aber nicht denselben Auth-403-Zweig oder die Ursache. [Ausführlicher Messbeleg und Grenzen](../entwuerfe/AUTH-01/R37-LOGIN-403-CLIENT-READ.md).

Kein weiterer Abruf, Login, Test, Build oder Servereingriff. Nächster Schritt bleibt HOSTs rein lesender Abgleich der tatsächlichen 403-Zweige und Ingressregel. **Writerende.**

## 26.10.2026 — R37-PDF-503-CODEMAP

Read-only Zuordnung des Clientfehlers `http_503`: Der Code unterscheidet Laufkontext, PDF-Belegstatus, Katalogabgleich und Multipart-POST nicht. Der separate Legacy-Probeaufruf meldet bei 503 einen anderen festen Fehlercode. Serverseitig kommen Auth-/Katalog-Runtime-503 sowie der generische `accountFailure`-Fallback für unbekannte Exceptions infrage. **Die konkrete Phase und Ursache sind aus `0/449` plus `http_503` nicht ableitbar.** [Codepfad, konkrete 503-Kategorien und kleinster sicherer Unterscheidungsbeleg](../entwuerfe/AUTH-01/R37-PDF-503-CODEMAP.md).

Keine Sitzung, private Konfiguration, Checkpointdatei, Quell-PDF oder tatsächlicher Receipt-/Serverzustand gelesen; keine Anfrage, Tests, Builds, Code- oder Serveränderung. Nächster Schritt: HOSTs getrennter read-only Abgleich des tatsächlichen Receipt- und Serverzustands. **Writerende.**

## 26.10.2026 — R37-PDF-COMMIT-FIX-PREPARE

Rechtefehler im tatsächlichen Schema18-Commit isoliert reproduziert: Dokumentidentitätslookup mit `FOR UPDATE` scheitert unter der vorgesehenen SELECT/INSERT-Approlle an **SQLSTATE 42501**. Ergebnis wie HOSTs Signatur: failed/unavailable, Generation +2, keine Identität/Version/Dateiverknüpfung/Suchjob. Minimalpatch entfernt ausschließlich diese unnötige Zeilensperre in `import-service.ts`; die globale Schreibsperre und alle Daten-/Quellenprüfungen bleiben bestehen. Storagequelle, Schema, Rollen, Pakete und 23 geschützte Vergleichsdateien unverändert; Vorherquelle passt exakt zum R37-Paket.

Neue echte PG-Nachherregression und zusätzlicher Konkurrenzfall bestanden: datenerhaltender Commit samt synthetischer Dateirücklesung, identischer Replay, konkurrierende gleiche und unterschiedliche Requests, unverändertes terminales failed-Receipt. Gezielte Lint-/Typ-/Runnerprüfung bestanden, eigene Tempcluster bereinigt. Vorherlauf belegte den Fehler und bereinigte vollständig, blieb anschließend wegen eines IPC-Testhilfenfehlers offen und endete per Zeitwächter143; unverändert offengelegt, keine Vorherwiederholung. [Ursache, Minimaldiff, Belege und Betriebs-/Rückweggrenzen](../entwuerfe/AUTH-01/R37-PDF-COMMIT-FIX.md).

Reviewbarer eigener Kandidatenordner `pdf-commit-fix-20261026/` fertig; keine Livewirkung. Die echte UUID bleibt terminal failed und braucht HOSTs getrennten exakten Recoveryvertrag; kein Nutzerretry. Keine private Config-/Session-/Checkpoint-/OriginalPDFlesung oder Produktionsaktion. **Dritter größerer Abschluss: vor weiterem Großauftrag sicher rotieren. Writerende.**

## R37-PDF-EXPLICIT-RETRY-INTEGRATE · 26.10.2026 · Writerende

Kleiner lokaler Adapter fertig: bestehender catalog-apply plus ausdrücklicher catalog-pdf-start --retry-first. Genau Index0/kg-sr-061, bekannter failed/unavailable-Parent; ein stabiler zusätzlicher technischer Kindversuch mit dauerhaftem Parent-/Command-/Fingerprintledger vor Transport. Keine Source-/Fall-IDänderung, Parentreceipt unverändert. GET-Reconciliation vor POST; sent/unknown erzeugt keinen weiteren Upload. Erst vollständiger Result-/Fall-/Quellen-/Versions-/Linkabgleich übernimmt pdf[0] als done, Originalrequest/-command und Pendinghistorie bleiben erhalten. Fünf Metadatenreceipts und 449 Bindungen unverändert; Rest normal.

Final neue Schema18-/echte Auth-/HTTP-Prüfungen: Antwortverlust5/5, direkte Antwort2/2, Profilmigration1/1; Typ/Lint/Strip-Types-Syntax grün, lesender codefinisher ohne Produktbefund. Negative Quellen-/Owner-/Revision-/Parent-/Gate-/Generation-/TOTP-/Resultgrenzen geprüft. Korrigierte TOTP-Testannahme403→401 und Fehlbeleg erhalten. Keine alte Commitregression/Builds wiederholt. 24 geschützte Quellen unverändert; import-service.ts weiterhin277f8a739da48bba72669ac2e758b96d1f23b2d369123fbaf4b16a636b502cb9.

Bericht: docs/entwuerfe/AUTH-01/R37-PDF-EXPLICIT-RETRY.md. Kandidat: deploy/pilot/targets/contabo-test/import-r37-20261025/pdf-explicit-retry-20261026/manifest.json. ApplySHA1396b93a162b17a55656bdde31bde2c663c32d6073c61d57bd86c6edc286c698; StartSHA35bdaba131a515d34cf1e666aea7e1f82211147ad873277a0d1db2aa614eae0b. Bestehender Checkpoint behält altes Profil; frischer HOST-Gate muss neuen Applyhash, tatsächlich korrigiertes Release und ursprüngliche Bindungsdigests tragen. Normale GETroute exponiert keinen Commandfingerprint: lokale Fingerprintbindung plus bekannter ownergebundener Parent und vollständige Dokumentwirkung, kein unabhängiger Remote-Fingerprintbeleg behauptet.

Späterer Nutzerstart nach tatsächlicher HOST-Release-/Gateübernahme: node --no-warnings --experimental-strip-types scripts/data-migration/catalog-pdf-start.mts --retry-first. Menschliche normale Anmeldung bleibt erforderlich; maximal1PDF, danach Reststart ohneFlag. Hier keine privaten Zustände/Owner/Sitzungen/Konfiguration/Original-PDFs gelesen, kein Livezugriff/Upload/Server-/Schema-/Rechteumbau. Zentralstatus bleibt Planung. Writerende.

## R37-WEB-EXTERNAL-VERIFY · 26.10.2026 · Writerende

Genau zwei credentialfreie `curl -q`-GETs an die bestehende HTTPS-Origin, mit normaler TLS-Prüfung, engen Timeouts, ohne Redirectfolge oder Wiederholung. `/`: `2026-10-26T15:13:26Z`, 200, `text/html`, 20577 Bytes, `http_response`. `/api/catalog/klausuren`: gleiche UTC-Sekunde, 401, `application/json`, 84 Bytes, `http_response`. Keine Cookies/Auth/netrc/privaten Profile, keine Response-Bodies/Headers ausgegeben; keine privaten Dateien, Original-PDFs oder Konfiguration gelesen. Startseite erreichbar, anonymer Katalog geschützt; der vorherige Mac-403-vor-Login wurde unter der beschriebenen Policy nicht reproduziert. Dies belegt ausschließlich die zwei Webantworten, keinen Login oder Import. [Prüfbericht](../entwuerfe/AUTH-01/R37-WEB-EXTERNAL-VERIFY.md). Writerende.
## 27.10.2026 — R37-NETCUP-DOMAIN-NEXT-STEPS · Writerende

Direkte Nutzerbestätigung: Niklas hat `stex-tracker.de` selbst bei Netcup registriert. Aktuelle CHATS.json-Bindung bestätigt: keine DNSänderung, kein gewählter Mailanbieter, kein Resendkonto, kein Schlüssel, keine SMTPaktivierung, kein echter Versand. Die bestehende Maildomainvorbereitung wurde auf den tatsächlichen Domainstatus aktualisiert und um aktuelle offizielle Netcup-CloudDNS- und Resend-Schritte ergänzt. Neuer Ablaufbericht: [R37-NETCUP-DOMAIN-NEXT-STEPS](../entwuerfe/AUTH-01/R37-NETCUP-DOMAIN-NEXT-STEPS.md).

Konkrete nächste menschliche Entscheidung: Versanddienst (Resend bleibt Vorschlag), sichtbarer Absender/Antwortweg, Rootdomain oder Sendesubdomain sowie die Resend-Datenregion. Resend empfiehlt eine Sendesubdomain; EU-Versand aus Ireland bedeutet laut Anbieter dennoch US-Speicherung von Kontodaten, Metadaten, Logs und API-Daten. Nach einer Providerentscheidung erzeugt dessen Dashboard die öffentlichen DNSrecords (Typ, Host, Wert/Ziel, gegebenenfalls TTL/Priorität). Erst diese echten Werte dürfen einzeln mit der bestehenden Netcup-CloudDNS-Zone abgeglichen werden; keine Beispielwerte und keine Root-MX-/Originänderung ableiten.

Kein Providerkonto erstellt, DNS-/Provider-/Serveränderung, Schlüsselanlage, Mailversand, Test/Build, Website-Originanschluss oder David-/Authaktion. HOST bleibt alleiniger Serverbediener. Ausschließlich die beiden reservierten Entwurfsdateien und dieser eigene Ergebnisnachtrag wurden geschrieben. **Writerende.**

## 27.10.2026 — R37-LOGIN-HOME-REDIRECT · lokales Delta / Writerende

Der Loginclient routete Passwort-, TOTP- und Wiederherstellungscodeabschluss bisher immer nach `/konto`; `load()` lieferte keinen bestätigten Kontostatus zurück. In `src/components/account-app.tsx` gibt `load()` nun ein bestätigtes Konto oder `null` bei Fehler/veraltetem Ladevorgang zurück. Eine feste Hilfsfunktion wählt `/` nur bei aktivem Konto ohne Bootstrap; pending, Bootstrap und unbestätigte Fehler bleiben im `/konto`-/Einrichtungsweg. `callbackURL` ist `/`; TOTP und Recovery nutzen dieselbe geprüfte Weiterleitung. Bestehender Bootstrapzweig erhalten.

Vorher-SHA-256 `98498267fb1fd5c0bc0939cf61daf6ac62b934115ec3428eb75bd3728f53ffac`; Nachher-SHA-256 `4d2847125d42e5f260ec0d627f95e3fb5225213c3be23dc51af150ec019fdae9`. Das eigene Übergabepatch liegt in `docs/entwuerfe/AUTH-01/R37-LOGIN-HOME-REDIRECT-20261027/change.patch` (SHA-256 `cf9bda18ec50369cb4bd67ad0d7f19f03dd7549228a79198e6ee61c2714af2eb`); ausführlicher Befund und Grenzen in `docs/entwuerfe/AUTH-01/R37-LOGIN-HOME-REDIRECT.md`.

Gezielter TSX-Syntaxparse der geänderten Datei bestanden. ESLint wurde nach 75 Sekunden ohne Ausgabe abgebrochen (Exit 130), daher kein Linterfolg behauptet. Keine Tests/Builds, Browser-/Credential-/Sitzungslesung oder Serveraktion. Noch nicht an HOST übertragen oder live; ausschließlich die reservierten AUTH-Dateien geändert. **Writerende.**

## 27.10.2026 — R37-SCOPED-AUTHMAIL-LOCAL · Writerende

Expliziter gesonderter Dispatcher-Modus lokal implementiert: gültiger fester UTCcutoff, einzelner Zweck invitation/verification/reset und Bindung an Nutzerauftrags-Outbox-ID oder einzelne Pilotmailbox. Die Claim-SQL selbst begrenzt created_at>=cutoff, pending, attempts=0 und max1; Scope vor Versand erneut geprüft. Kein globales Recover und im gesonderten Modus kein temporärer Retry; Proof-/Ablauf-/Empfänger-/Konto-/Claimtoken-/Lease-/TLSgrenzen weiterverwendet. Fehlerausgänge verriegeln die Instanz; neuer CLI liefert reines Aggregatergebnis und Sperrbit sowie einen gesonderten Betreiber-Stopcallback vor Cleanup. Der CLI bleibt ohne ausdrücklich injizierten dauerhaften HOST-Gate geschlossen; dessen reale Persistenz-/Crashgrenze ist nicht installiert oder abgenommen.

Exakte Produktquellen: `src/lib/server/auth/mail-dispatcher.ts` vorher `39c6bcb08fd2f8766a5178b36a3c9e482205bb28b02e83466148e400587bf2b0`, nachher `23ad714ede561b12e374b7eb42b9c57fb87cf8fa05e2d6a3b4c754be21c8af1a`; neu `scripts/auth/scoped-mail-dispatch.mts` SHA256 `822ddbfdd01b47e11d1cce37ea1d333d446ded46f8902f83c534d972c10818f6`. Generischer Caller bytegleich. Zweiquellenpatch SHA256 `1d72d882df9a80f5f8af10920fa1f50b44d9570e64bcf1668915437a60379700`, isoliert exakt anwendbar. [Bericht, Manifest, Patch und Belege](../entwuerfe/AUTH-01/R37-SCOPED-AUTHMAIL/ERGEBNIS.md).

18 unterschiedliche neue fokussierte Checks mit instrumentierten DBtransaktionen/Transporten über begrenzte Läufe bestanden; nach kleinen Fehlerpfadänderungen nur betroffene neue Checks wiederholt. Finale gezielte Typprüfung Exit0; keine alte Authsuite, Lint oder Builds. Synthetische Codegrenzen sind keine echte PostgreSQL-/SMTP-/Mailabnahme. Kein Server-/Provider-/Secretzugriff, keine Mail, Installation, Übertragung, Rechte-/Dienst-/Runtime-/Kontoverifikationsaktion. Index weder gestartet/vorbereitet noch getestet. Dritter größerer Abschluss: [kurze sichere Übergabe](../entwuerfe/AUTH-01/R37-SCOPED-AUTHMAIL/UEBERGABE.md), vor weiterer Großarbeit frisch rotieren ohne Fullhistoryfork. **Writerende.**


## 27.10.2026 — R37-AUTHMAIL-DURABLE-GATE-LOCAL · auf Rootanweisung gestoppt / Writerende

Während der Bearbeitung ausdrücklich gestoppt; keine weitere Implementierung, Tests oder Recherche. Zwei neue, ungetestete Entwürfe bewahrt: `deploy/pilot/targets/contabo-test/authmail-gate-r37-20261027/durable-gate.mts` und `host-adapter.mts`. Kein fertiges Betriebspaket, keine Unit-/Timer-/Installationsvorlagen/EFFECTS.json und kein ausführbarer Einstieg. Persistenz-/Crash-/Konkurrenz-/Cleanupabnahme und tatsächlicher HOST-Shimanschluss bleiben offen. Nicht installieren/aktivieren/senden; Root priorisiert zuerst HOSTs konkretes SMTPinstall-/AUTHproblem und entscheidet danach den kleinsten Betriebsweg.

[Gestoppter Stand](../entwuerfe/AUTH-01/R37-AUTHMAIL-DURABLE-GATE.md). Fertiges Scoped-Quelldelta mit18Checks unverändert, keine Wiederholung. Keine App-/Core-/Maildispatcher-/Schema-/Routen-/Zentraldatei geändert, keine Tests/Typchecks/Builds und keine Server-/Secret-/Provider-/SMTP-/Indexaktion. **Writerende.**

## 28.10.2026 — R37-MITTARO-HTTP-APP · lokaler Adapter / Writerende

Neue lokale Transportgrenze in `src/lib/server/auth/mittaro-http-config.ts` und `mittaro-http-transport.ts`: fester HTTPS API-Endpunkt, Key/Absender aus separater Serverumgebung, begrenzter Fetch, stable Outbox-ID-basierter Idempotency-Key, erlaubte Einladung/Verification/Reset-Linkformen und keine Provider-/Secret-/Linkfehlerausgabe. HTTP200/202 gelten als angenommen; dokumentierte Ablehnungen terminal, andere Antworten/Netzfehler/Timeout `unknown`, ohne automatischen Retry. Keine neue Abhängigkeit.

Neue `tests/auth-mittaro-http-transport.test.ts`: 6/6 isolierte Fake-Fetch-Checks bestanden. Fokussierter strikter TypeScript-Lauf über zwei neue Module, Test und Importclosure Exit0. Kein Netz, DB, SMTP, echter Key, Mail, Serverzugriff, Alt-Suite, Lint oder Build.

Kleinster geplanter Appanschluss ausschließlich `scripts/auth/scoped-mail-dispatch.mts`: vorhandene SMTPconfig/-factory durch Mittaro-HTTPconfig/-factory binden; generischer Mehrzeilen-CLI und `AccountService` bleiben unangetastet. Das bestehende Scoped-CLI-Gate ist ungebunden, automatischer Dispatcher und isolierter HTTP-Egress sind laut aktuellem HOST-Bestand nicht installiert. HOST muss vor einem Aufruf passenden einmaligen Startweg, private Credentialinjektion und API-443-Egress konkret binden. Lokale Module sind nicht deployed/live. Kein Versandauftrag daraus.

[Detailbericht und Wiringplan](../entwuerfe/AUTH-01/R37-MITTARO-HTTP-APP/ERGEBNIS.md). Kein Gate-/Timerentwurf fortgeführt. **Writerende.**

## 28.10.2026 — R37-MITTARO-HTTP-APP · Scoped-CLI-Wiring / Writerende

`scripts/auth/scoped-mail-dispatch.mts` lokal auf `readMittaroHttpConfig`/`createMittaroHttpTransport` umgestellt; `transport`-Binding passend typisiert. Genau diese Datei geändert; Gate-/Scope-/Claim-/Output-/Cleanupgrenzen blieben erhalten, generischer CLI unangetastet. Gezielter strikter TypeScript-Lauf für den geänderten CLI-Einstieg und Importclosure Exit0. Vorherige Adaptertests/-typprüfung nicht wiederholt; keine weiteren Tests, kein Lint/Build/Server-/Secret-/Netz-/Mailaufruf.

Lokale Änderung, nicht deployed/live. HOST muss getrennten privaten Key-/Absenderzugang, festen API-443-Egress und zulässigen Einmal-Gate-Startweg mit genau einer neuen Outbox-ID/Cutoff bestimmen. [Bericht und HOST-Anschluss](../entwuerfe/AUTH-01/R37-MITTARO-HTTP-APP/ERGEBNIS.md). **Writerende.**

## 28.10.2026 — normaler Mittaro-CLI mit UTC-Aktivierungscutoff · Writerende

`src/lib/server/auth/mail-dispatcher.ts` teilt den strikten UTC-Cutoffparser mit dem Scoped-Modus. Neuer Normalmodus filtert Claim und Startrecheck auf `created_at >= cutoff`, `dispatch_attempts=0/1`; globale Recovery aus, Batchgröße1 verbindlich. `scripts/auth/mail-dispatch.mts` nutzt den Mittaro-HTTPtransport, verlangt `STEX_AUTHMAIL_ACTIVATION_CUTOFF`, gibt nur Zähler (0..1) aus. Unsicherer Ausgang/Timeout wird für genau die beanspruchte ID `uncertain`, ohne Instanz-langen/globalen Fehlerlatch; nächste unabhängige frische Zeile kann später laufen. Bestehende Proof-/Token-/Status-/Origin-/Empfänger-/Ablaufprüfungen bleiben erhalten.

Neue fokussierte Probe `tests/auth-mail-dispatch-cutoff.test.ts`: 1/1, einschließlich Cutoff-/Erstversuch-SQL, Recoveryverzicht, terminalem Unknown und Timeout pro ID, Fortsetzung an separaten neuen Outboxeinträgen. Gezielter strikter TypeScript-Lauf der CLI, Dispatcherdatei und neuen Probe samt Importclosure Exit0. Keine alten Transport-/Scoped-Tests wiederholt, keine Vollsuite/Lint/Build, kein Netz/DB/Server/Secret/Mail.

HOST-Variablen nach Quellübernahme: `STEX_MITTARO_API_KEY` privat, `STEX_MITTARO_FROM_ADDRESS=noreply@mail.stex-tracker.de`, `STEX_AUTHMAIL_ACTIVATION_CUTOFF` als fester UTC-ISO-Wert aus dem tatsächlichen Aktivierungszeitpunkt. Start aus dem gebundenen Release: `/opt/stex/node-v22.23.3-linux-x64/bin/node --import tsx scripts/auth/mail-dispatch.mts once`. Neue Quelle noch nicht installiert/live; HOST muss DB-/API443-/Keybindung bereitstellen. Der bestehende shared Produktionsconfigleser verlangt auch `BETTER_AUTH_SECRET`, obwohl der Dispatcher diesen Inhalt nicht nutzt; kein gemeinsamer Konfigurationsrefactor in diesem Zwei-Datei-Auftrag.

[Detailbericht und genaue Übergabe](../entwuerfe/AUTH-01/R37-MITTARO-HTTP-APP/ERGEBNIS.md). Nur `scripts/auth/mail-dispatch.mts` und `src/lib/server/auth/mail-dispatcher.ts` als Produktdateien geändert. **Writerende.**

## 29.10.2026 — Einladungseinstieg in der Verwaltung · Writerende

Der Einladungsweg für die Startphase ist jetzt im Kontomenü aktiver Admins dauerhaft auffindbar und führt direkt zum Formular. In der Verwaltung hebt ein ruhiger Text den Zugang zum gemeinsamen Klausurkatalog hervor und erklärt, dass Lernnotizen privat bleiben und die Freischaltung im aktuellen Pilot manuell erfolgt. Kein globaler Banner, Pop-up oder PDF-/Lernansichtseingriff.

Geändert: `src/components/account-dashboard-menu.tsx` und `src/components/admin-overview.tsx`. Die Auswahl bleibt Admins vorbehalten, weil der vorhandene Einladungsendpunkt weiterhin Adminrechte verlangt. Ein Member-zu-Member-Versand und die automatische Aktivierung nach Bestätigung sind mit dieser UI-Änderung nicht umgesetzt.

Gezieltes ESLint für beide Dateien bestanden. Der breite TypeScriptlauf bleibt im Bestand an unabhängigen `.next-qa`-Routentypen und archivierten Prüfkopien fehlerhaft; eine gefilterte Wiederholung meldete keine Fehler in den beiden geänderten Dateien. Keine App-/DB-/Server-/Mailaktion. **Writerende.**


## 29.10.2026 — R37 anonymer Home-Einstieg · Writerende

Die Startseite mountet in der bestehenden Kontoumgebung ihre Home-Komponenten erst nach erfolgreicher Statusprüfung über `GET /api/account`. Nur ein Konto mit `status === "active"` und `bootstrap === false` erhält die Home-Ansicht. `401` führt zur bestehenden `/konto/anmelden`-Route; wartende, Bootstrap- oder sonstige Kontoantworten sowie `403` führen zu `/konto`. Netzwerk-, Server-, Rate-Limit- und Vertragsfehler zeigen eine Retry-Ansicht, ohne eine anonyme Sitzung zu behaupten oder automatisch umzuleiten. Feste interne Routen und `redirect: "error"` verhindern Weiterleitungen auf fremde Ziele.

Geändert wurden ausschließlich `src/app/page.tsx` und die neue `src/components/account-entry-guard.tsx`. Die zuvor vorhandenen lokalen Startseitenänderungen blieben erhalten. Der existierende Login-zu-Home-Fix in `account-app.tsx` sowie der vorherige Admin-Einladungs-CTA sind nicht Bestandteil dieses Deltas; sie wurden nicht zurückgesetzt oder als live ausgegeben. Layout-/Brandingdateien, Authserver, API, Schema, Rollen, Mail und Daten blieben außerhalb dieses Auftrags.

Der gezielte synthetische Guardcheck bestand mit **10/10** Statusfällen (anonym, aktives Mitglied/Admin, pending, Bootstrap, gesperrter Status, 403, 503, anderer Serverfehler und fehlerhafter Vertrag) sowie Strukturprüfungen für feste Ziele, fehlende Rückleitung zur Home-Seite und das Mount-Gate. Der erste `tsx`-Starterlauf stoppte vor Codeausführung an einer gesperrten lokalen IPC-Pipe; der direkte installierte TypeScript-Loader bestand anschließend. Keine Test-Suite, kein Build/Lint, keine echte Sitzung, kein Server-/Browser-/Netz-/Mailkontakt.

Das isolierte Patchpaket ließ sich im exakt gebundenen Vorherstand trocken prüfen und in einer temporären Kopie anwenden; beide erzeugten Quelldateien stimmen SHA-256-genau mit den gelieferten Zielquellen überein.

Quellgebundenes Minimalpaket: `docs/entwuerfe/AUTH-01/R37-HOME-ENTRY-20261029/`. Basis `src/app/page.tsx` SHA-256 `c9413f31fff480b7c76d6f224d6cbc7166c661cf03fc384c3503ec80857b9ebe`; Ziel SHA-256 `c7c79bd379300a64476ec9b3edbf7c285c8eb32302ed0fe8953bc5282e46a457`; neue Guarddatei SHA-256 `0c8e432d3cdb2a075ee9f4cd15711c070a2666f601d2ec42c9b8a40365e3f188`; Patch SHA-256 `e51e23fe6ba7cfdc3298b4766122e4094a132b301c565038f19792a5e691a4fe`. Lokal fertig, nicht als HOST-Übernahme oder Liveänderung behauptet.

**Writerende.**
