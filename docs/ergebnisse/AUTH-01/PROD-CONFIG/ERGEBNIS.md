# AUTH03 — validierter Produktions-Konfigurationsadapter

Stand: 17.10.2026. Begrenztes exklusives Fenster aus der Fortschreibung von Arbeitsrunde 33; HOST-Nicht-KI-Betriebsvorlage gezielt gelesen. **Adapter implementiert, 21/21 gezielte Prüfungen bestanden. Produktionsanmeldung weiterhin ausdrücklich gesperrt.** Kein Deployment und keine neue Online-/Mail-/Auth-Gesamtabnahme.

## Änderung und Freigabegrenze

`production-config.ts` ergänzt einen reinen serverseitigen Konfigurationsadapter. `readProductionAuthConfig(environment, applicationRoot)` liefert feste `baseURL`, explizite pg-Konfiguration, private Dateiwurzel, Authsecret und getrennten Mailkey. Er liest weder Dateien noch DNS/Netzwerk, erzeugt keine Geheimnisse, verändert keine Umgebung und migriert keine Datenbank.

`accountRuntime` verwendet den Adapter bei ausdrücklich gewähltem Produktionsmodus. Nach erfolgreicher Validierung liefert es derzeit absichtlich **503 / `production_auth_not_released`**, bevor Datenbank, privater Speicher oder AccountService erzeugt werden. Fehlerhafte Konfiguration liefert **503 / `invalid_production_config`**. Es gibt keinen Umgebungswert, der die noch fehlende Freigabe umgehen kann. Das ist ein vorbereiteter Konfigurationsanschluss, noch kein laufender Produktions-Ressourcenadapter.

Diese Sperre ist notwendig, weil eine bloße Authöffnung auch vorhandene Konto-KI erreichbar machen könnte und bislang nur die lokale verschlüsselte Mail-Outbox existiert. KI-Sperre, Mailtransport sowie Betriebs-/Onlineabnahme sind eigene koordinierte Schritte. Dieser Auftrag implementiert keinen dieser zusätzlichen Produktpfade und öffnet auch bei vollständig gesetzten Produktionswerten keine Anmeldung.

## Expliziter Vertrag

Alle Angaben stammen später ausschließlich aus kontrollierter Serverkonfiguration. Die folgende Tabelle ist Dokumentation; es wurde kein Wert in der aktuellen Umgebung gesetzt.

| Name | Gültiger Produktionsvertrag |
|---|---|
| `NODE_ENV` | Genau `production`. |
| `STEX_AUTH_MODE` | Genau `production`; kein automatischer Wechsel aus `local`, unbekannte Werte bleiben geschlossen. |
| `BETTER_AUTH_URL` | Feste kanonische HTTPS-Origin mit DNS-Hostname; optional ein abschließender Slash. Keine IP-/Loopback-/localhost-Origin, Zugangsdaten, zusätzlichen Pfade, Query, Fragment oder Wildcards. Keine Ableitung aus Request-/Forwarded-Headern. |
| `DATABASE_URL` | `postgres:` oder `postgresql:` mit explizitem Host, Port, Benutzer, Passwort und Datenbanknamen. Kein impliziter lokaler Anschluss, kein leerer DBname. Datenbankname 1–63 Zeichen aus Buchstaben/Ziffern/Unterstrich/Punkt/Bindestrich, beginnend mit Buchstabe/Ziffer/Unterstrich. URI-Queryoptionen werden abgewiesen. Zugangsdaten werden einmal dekodiert; Passwort mindestens 16 Zeichen und kein offensichtlicher Standardwert. |
| `STEX_DATABASE_TLS` | Genau `verify-full`: pg erhält `ssl: { rejectUnauthorized: true }`. Alternativ ausdrücklich `loopback`, ausschließlich für `localhost`, `127.0.0.1` oder `[::1]` als DBhost; dann `ssl:false`. Keine unverschlüsselte entfernte Verbindung. Keine SSL-URIoption darf den Vertrag überschreiben. |
| `STEX_PRIVATE_FILE_ROOT` | Expliziter absoluter kanonischer Pfad außerhalb des aktuellen Anwendungs-/Releasepfads; keine Wurzel `/`, `public`, `.local`, `.next`, `.next-qa`, `node_modules` oder `.git`. Anwendungskontext ebenfalls absolut, kanonisch und nicht `/`. Keine Dateiwurzel als Default im Release. |
| `BETTER_AUTH_SECRET` | Explizit bereitgestelltes Authgeheimnis: 43–128 Base64url-/Hex-kompatible Zeichen, keine Leer-/Steuerzeichen, offensichtlichen Platzhalter oder periodischen Wiederholungen; Mindestzeichendiversität. Kein Laden aus lokalen Entwicklungsdateien und keine Erzeugung. |
| `STEX_AUTH_MAIL_KEY` | Eigenes explizites Mail-Outbox-Geheimnis mit demselben Format. Muss vom Authsecret und DBpasswort verschieden sein. |

`STEX_LOCAL_DATA_DIR` und `STEX_LOCAL_POSTGRES_PORT` dürfen im Produktionsvertrag überhaupt nicht gesetzt sein, auch nicht leer. pg erhält explizite Felder statt einer weitergereichten `connectionString`; dadurch können URIoptionen oder fehlende Felder nicht unbemerkt auf andere Verbindungsdaten ausweichen. Das Verbindungszeitlimit beträgt 5 Sekunden; es wurde keine Verbindung aufgebaut.

Die Geheimnisprüfung erkennt Formatfehler und offensichtliche Fehlbelegung. Sie beweist keine kryptografische Entropie oder Herkunft. Für den späteren echten Betrieb getrennte zufällige Geheimnisse mit mindestens 32 Zufallsbytes sicher bereitstellen und unverändert zur jeweiligen Datenbank/Sicherung zuordnen. Keine lokalen Testgeheimnisse übernehmen. Die ursprünglichen Auth-/Sicherungs-/Credential-Schlüsselverträge bleiben unberührt.

Physische Pfad-/Symlinkprüfung, tatsächliche Rechte bestehender Verzeichnisse, Zertifikatskette, DNS, DBrollen/-rechte, Verfügbarkeit und Linuxlaufzeit werden durch diese rein syntaktische Prüfung **nicht** belegt. Diese Umgebungsprüfungen müssen vor einer späteren Freigabe erfolgen. Der Adapter enthält keinen unsicheren TLS- oder Zertifikatsfallback und derzeit keinen besonderen privaten CA-/Unix-Socket-Vertrag.

## Lokaler Modus und Fehlerverhalten

Der bestehende Einstieg `accountRuntime(): Promise<AccountService>` und seine gemeinsame Lazy-Instanz bleiben erhalten. `createAccountRuntime` erlaubt isolierte Instanzen für die neuen Konfigurationsprüfungen; die Freigabesperre lässt sich darüber nicht injizieren oder deaktivieren.

Im lokalen Modus bleiben Loopback-Origin, lokale Schlüssel-/Passwortdateien, `stex_local`, standardmäßig Port 55432 und der bisherige private Dateipfad erhalten. Explizite lokale Überschreibungen bleiben wirksam. Ein vorhandenes `DATABASE_URL` wird dort weiterhin nicht zum entfernten DBanschluss umgedeutet. Produktion kann nie über `STEX_AUTH_MODE=local` geöffnet werden. Ungültige lokale URLprotokolle, Pfade und Portnummern werden vor Ressourcenöffnung abgewiesen.

Die Runtime bindet sich an die relevanten Konfigurationswerte und den Anwendungsort. Ändern sich Modus, Origin, Umgebungsgeheimnisse oder Pfade nach Initialisierung, erhält der Aufrufer 503 / `auth_configuration_changed` statt einer übernommenen gecachten lokalen Instanz. Ein kontrollierter Prozessneustart ist erforderlich; es gibt keine automatische Liveumschaltung/Schlüsselrotation. Dateien werden im Cachebetrieb nicht auf externe Änderungen überwacht. Fehlgeschlagene Initialisierung kann wiederholt werden. Bereits erzeugte DBpools werden bei nachfolgendem Datei-/Servicefehler geschlossen. Keine Requestmigration.

Konfigurationsfehler enthalten ausschließlich einen festen Fehlercode, eine generische Meldung und serverseitig einen Feldnamen. Abgelehnte URI-/Passwortwerte und ursprüngliche Parserursachen werden nicht in Fehlermeldungen oder HTTP-Fehlerantworten übernommen.

## Tatsächliche Prüfung

[21 gezielte Prüfungen](tests.log), ausschließlich `tests/auth-production-config.test.ts`:

- gültiger expliziter Vertrag, striktes pg-TLS, einmalige Dekodierung und ausdrücklich konfigurierte lokale DB;
- fehlende/leere Werte, unbekannte/gemischte Modi und fehlende automatische Fallbacks;
- HTTPS-Originfehler einschließlich numerischer Aliasformen, Pfadnormalisierung, Zugangsdaten und Redirectteilen;
- unvollständige DBanschlüsse, URI-/TLS-Overrides, lokale Entwicklungsparameter in Produktionskonfiguration;
- private Pfadgrenzen und zusätzlich ungültiger Releasekontext;
- Geheimnisformat, Platzhalter, Wiederholung, Wiederverwendung und bereinigte Fehlermeldungen;
- gültige Produktion bleibt 503 ohne Ressourcen-/Secretzugriffe, auch bei frei erfundenen Ready-/Releaseflags;
- lokaler Vertrag, gemeinsame Lazy-Instanz, Fehlerbereinigung/Wiederholung und Abweisung geänderter gecachter Konfiguration;
- keine Veränderung der geprüften Umgebungsobjekte oder der Prozessumgebung.

Die erste Fassung bestand 20 Prüfungen. Nach Ergänzung der Releasekontextgrenze wurde genau die neue Konfigurationsdatei mit nun **21/21** erneut geprüft. Die spätere Fortsetzung hat diese Funktionsprüfungen nicht nochmals gestartet; sie hat vorhandene Protokolle übernommen und nur noch gezieltes Lint sowie isolierte Typprüfung mit bestätigtem Exitcode 0 abgeschlossen.

Die Ressourcenbindungen der Runtime werden in diesen Tests durch instrumentierte Platzhalter ersetzt, um jede unerlaubte Ressourcenöffnung/Migration zu erkennen. Das ist ausdrücklich eine Konfigurations-/Modusprüfung, keine echte Anmeldung, PostgreSQL-Verbindung oder erneute AUTH-A-Abnahme. Kein existierendes `.env.local`, lokaler Secretbestand oder realer Zielanschluss wurde gelesen. Keine Umgebung auf Produktion umgeschaltet, kein Server/Browser/Cluster gestartet, kein Provider oder Maildienst kontaktiert. Kein Modelltest und kein Astraeinsatz.

[Abschlussbeleg](pruefungen.json) und [Quellzuordnung](quellstand.json) dokumentieren die tatsächlichen Dateien/Prüfgrenzen. Der [Ausgangsstand](ausgangsstand.json) erfasst den vorhandenen uncommitteten Stand, keinen vollständigen Git-Release-Snapshot. Gezieltes Lint der drei bearbeiteten/neuen Code-/Prüfdateien und isolierte Typprüfung derselben Einstiege samt notwendiger lesender Importabhängigkeiten bestanden. Kein Gesamt-Lint, kein AUTH-Gesamtlauf und kein Build.

## Dateien und notwendige Folgeanschlüsse

Geändert: `src/lib/server/auth/runtime.ts`. Neu: `src/lib/server/auth/production-config.ts`, `tests/auth-production-config.test.ts`, dieser Belegordner. AUTH-Ergebnis ergänzt. Keine Änderung von `service.ts`, Schema, Sicherung, Paketdateien, Layout, KI oder Maildispatcher.

Vor Produktivöffnung gesondert zuordnen:

1. Tatsächliche serverseitige Nicht-KI-Grenze und zugehörige UIgrenzen; aktuelle Authsperre erst nach belegtem Ersatz öffnen.
2. Maildispatcher/Transport nach Commit einschließlich Zustellung, Fehlern und privaten Logs. Der neue Mailkey konfiguriert lediglich die bestehende Verschlüsselung, keinen Versand.
3. Operator-/Such-/Appanschluss auf denselben validierten DB-/Datei-/Secretvertrag abgleichen. Besonders `scripts/data-migration/local-config.ts` verwendet bisher den rohen URIvertrag und kennt `STEX_DATABASE_TLS` nicht; `scripts/auth/operator.mts` nutzt noch lokale Secretdateien. Diese Pfade wurden hier nicht geändert. Der Suchworker bleibt durch die geschlossene Runtime ebenfalls geschlossen.
4. Feste Domain/Proxy-HTTPS, tatsächlicher Request-Origin/Host, Cookies, bestehende Dateirechte, DBrechte, Linuxrelease und unabhängig wiederhergestellte Sicherung gezielt auf der separat freigegebenen Zielumgebung abnehmen.

Der derzeitige Betriebs-/Onlineverschluss ist beabsichtigt. Dieser abgeschlossene Adapterauftrag erteilt weder Kauf-, Schlüsselanlage-, Mail-, Datenübertragungs-, Migrations- noch Deploymentfreigabe. Keine Folgestufe gestartet und keine Nachricht an andere Chats gesendet. Vor dem nächsten größeren AUTH-Auftrag den inzwischen langen AUTH-Verlauf anhand dieses Berichts und der aktuellen Dateizuordnung für einen frischen Nachfolger übergeben; dieser Abschluss selbst ändert keine Zuständigkeit.

Eigene temporäre Typkonfiguration und temporäre Protokolle nach Übernahme der Belege entfernt. Es gab keine zu beendende Server-/Clusterlaufzeit.
