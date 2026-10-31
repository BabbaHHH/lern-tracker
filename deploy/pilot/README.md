# Lokale Betriebsvorlagen für den geschlossenen Pilot

Stand **19.10.2026**, ausschließlich Auftrag PILOT-TEMPLATES-CURRENT aus Arbeitsrunde 33. **Nicht installiert, nicht gerendert, kein funktionsfähiges Deployment.** Die Servermiete ist laut Niklas erfolgt; Anbieter/Tarif, tatsächliches Betriebssystem/Architektur, Zugang, DNS und Onlineeinrichtung sind hier weiterhin unbestätigt. Die frühere Contabo-Empfehlung ist kein Bestellbeleg. Alle Platzhalter bleiben absichtlich ungelöst. Keine Datei dieser Ablage lädt reale Geheimnisse oder startet selbst Dienste.

Die bisherigen breiten HOST-Empfehlungen zur KI-Sperre vom 17.10. sind durch die jüngere ausdrückliche Scopeklärung überholt: Der implementierte Produktionsguard verschiebt **nur Lernplangenerierung, Check-in und Korrektur**. Allgemeiner KI-Zweck, Tagging, Schlüsselverwaltung, Credits und Modellliste werden durch diese Vorlagen nicht zusätzlich gesperrt oder freigeschaltet. Externe Nutzung erhält hier keine neue Freigabe.

## Dateien und echte Grenzen

| Vorlage | Heutiger Einstieg / Zustand |
|---|---|
| `systemd/stex-pilot-app.service.in` | Node/Next auf `127.0.0.1:3000`, Produktionskonfiguration. Zusätzlicher `ExecStartPre=/usr/bin/false` bleibt. `accountRuntime()` verwendet inzwischen `productionAccountRuntime`; ohne exakte serverseitige Betreiberfreigabe bleibt der gültige Produktionsvertrag standardmäßig 503. In der Environmentvorlage steht nur ein ungültiger Platzhalter. |
| `systemd/stex-pilot-search.service.in` | Ein serieller `scripts/search/worker.mts watch`, mit tsx. Inzwischen unabhängig von `accountRuntime()`: `worker-config.ts` prüft den gemeinsamen Operatorvertrag, `configuredPersistence` liefert DB/PrivateFiles. Die Dienstvorlage bleibt durch `ExecStartPre` hart blockiert; der Produktworker besitzt keinen zusätzlichen öffentlichen Auth-Freigabeschalter. |
| `systemd/stex-pilot-mail.service.in` und `.timer.in` | Expliziter vorhandener `mail-dispatch.mts once`, vorgeschlagenes Polling frühestens 60 s nach letztem Lauf. Vor echter SMTPfreigabe blockiert; Timer hat keinen Install-Abschnitt und ist nicht aktiviert. Kein `watch`-Argument im Mail-CLI. |
| `systemd/stex-pilot-backup@.service.in` | Konkreter vorhandener Format-4-Vollbackupaufruf. Blockiert, Instanz ist eine neue manuelle Satz-ID. Kein automatischer Backuptimer und kein Offsiteclient vorhanden. |
| `nginx/*.in` | HTTPS, feste Origin/Loopbackupstream, Test-IP-Allowlist und routenbezogene Uploadgrenzen. Zusätzlicher Wartungs-503 im Zielserver. Keine Domain/Zertifikate/IP gewählt. |
| `env/*.example` | Nur vorhandene Konfigurationsnamen, absichtlich ungültige Platzhalter. Kein Fallback auf `db/.local`; der vorhandene Name `STEX_AUTH_RUNTIME_RELEASE` ist ausschließlich mit ungültigem Platzhalter enthalten, keine Freigabe. |
| `release-record.example.json` | Auszufüllende Operatornotiz zur späteren Releasebindung, kein vom Produkt gelesener oder automatisch beglaubigter Vertrag. Alle Runtime-/Installations-/Mailtimer-/Online-/Linux-/Offsitefreigaben false; Ziel-OS und Architektur bleiben Platzhalter. |
| `source-lock.json` | SHA-256 von 43 gelesenen öffentlichen Quellen einschließlich neuem Runtimeadapter/Workervertrag und 001–016. Bindet diese statische Vorlage an heutigen Code, ist keine Signatur und kein vollständiges Releaseinventar. |

Die harten Vorlagensperren dienen dem sicheren Vorbereitungsstand. Sie werden **jetzt nicht entfernt**. Ihre spätere Entfernung verlangt konkreten Einrichtungsumfang und passende neue Produkt-/Zielbelege; die inzwischen implementierte Runtimefähigkeit ist keine erteilte Betriebsfreigabe. Das konkrete serverseitige Releasefeld gehört zum heutigen Programmvertrag; weder Quellhashabgleich noch Entfernen einer Vorlagensperre setzt es oder öffnet den Proxy.

## Zielpfade und Dienstrechte – noch nicht angelegt

| Ziel | Geplante Trennung / Rechte |
|---|---|
| `/srv/stex/releases/<release-id>` | Linuxprogramm mit Lockfile, Migrationen, kompiliertem Next, passenden nativen Paketen, vollständigen PDF.js-Assets und Operatorquellen/tsx. Betreiberbesitz, für Dienste lesbar, Produktquellen nicht durch App beschreibbar. Kein privater Bestand im Release. |
| `/srv/stex/current` | Betreiberverwalteter Verweis auf genau ein geprüftes Release. Nur im geschlossenen Wartungsfenster umstellen; Dienste vorher kontrolliert beenden. |
| `/srv/stex/data/files` | Unveränderliche private Originalversionen; `stex-app`, Verzeichnisse 0700/Dateien 0600. Nicht unter public, kein Proxyalias. App und Suchworker teilen diesen OSnutzer, damit bestehende PrivateFiles-Rechte passen. |
| PostgreSQL-Datenverzeichnis | Separater PostgreSQL-Systemnutzer/-Dienst und dauerhaftes Volume außerhalb Releases, nur intern/Loopback. Distributionsdienst/Binary und Datenbankrollen sind erst im Zielauftrag festzulegen. |
| `/srv/stex/cache/<release-id>` | Abgeleiteter Nextcache, `stex-app` beschreibbar, nicht Teil persönlicher Daten. Ein später vorbereiteter `.next/cache`-Verweis kann hierhin zeigen. Keine Änderung an aktuellem Nextcode. |
| `/srv/stex/backup-staging/<new-set-id>` | Vollständiger frischer Satz außerhalb Release, `stex-app`, 0700/0600; darf nicht existieren. Unvollständige Abbruchsätze isolieren, nicht als Erfolg verwenden. |
| `/etc/stex/{common,core-secrets,smtp-secrets,backup-secrets}.env` | Je root:root 0600, Verzeichnis 0700, außerhalb Release/Backup. Dienstmanager übergibt nur zugeordnete Dateien. Nicht mit Shell-`source` laden oder Werte/URLs ausgeben. |
| `/etc/stex/tls/` und `/etc/stex/proxy/` | Separat bereitgestellte Zertifikate/Schlüssel und gerenderte Proxysnippets; private Schlüssel nur für zuständige Betreiber-/Proxyprozesse lesbar. |
| `/var/lib/nginx/stex-pilot-body` | Eigener privater begrenzter Uploadtempbereich für Proxybenutzer; Bereinigung/freier Platz im Ziel prüfen. |

Die Dienstnutzer und Verzeichnisse existieren dadurch nicht. Mail verwendet `stex-mail` ohne private Dateileserechte; der heutige Mail-CLI konstruiert lediglich einen Dateiadapter, liest/initialisiert aber keinen Originalbestand. Geheimnisse für Mail enthalten dennoch den gemeinsamen Produktionsvertrag. App/Worker bekommen keine SMTP-/Backupgeheimnisse. Backup erhält die benötigten Datei- und eigenen Schutzwerte.

`ProtectSystem=strict` erlaubt der App nur private Originale und Cachewurzeln. **Ungeprüfter Linuxrest:** Next kann je verwendeter Cache-/Revalidierungsfunktion weitere Laufzeitschreiborte benötigen. `.next/cache`-Auslagerung, tatsächliche Rechte, native Bibliotheken, `/usr/bin/node`, Nginx-/systemd-Version und Hardening müssen am separaten Ziel geprüft werden; kein funktionierender Nur-Lese-Releasebetrieb aus dem Textcheck behauptet. Kein pauschales Schreibrecht auf persönliche Daten oder Releases als vermeintliche Reparatur.

## Umgebungsvertrag

| Datei | Bestehende Namen / Bedingungen |
|---|---|
| `common.env` | `NODE_ENV=production`, `STEX_AUTH_MODE=production`, `STEX_LEARNING_MODE=account`; vorhandenes `STEX_AUTH_RUNTIME_RELEASE=__OPERATOR_RELEASE_NOT_GRANTED__` ist absichtlich ungültig, niemals `NEXT_PUBLIC_` oder Browser-/Requestfeld. `BETTER_AUTH_URL` feste HTTPS-DNS-Origin ohne Pfad/Query, dieselbe Origin wie Proxy. `STEX_PRIVATE_FILE_ROOT` explizit außerhalb App; `STEX_DATABASE_TLS=loopback` nur zur expliziten Loopback-DB. Für eine andere DB ist später der vorhandene `verify-full`-Vertrag mit Zertifikatsprüfung nötig. |
| `core-secrets.env` | `DATABASE_URL` mit explizitem Nutzer/Passwort/Port/Datenbank und ohne URIoptionen. URIzeichen in Zugangsdaten korrekt kodieren. `BETTER_AUTH_SECRET` und `STEX_AUTH_MAIL_KEY` getrennte ausreichend zufällige 43–128-Zeichen-Base64urlwerte nach vorhandenem Validator, verschieden vom DBpasswort. |
| `smtp-secrets.env` | `STEX_SMTP_HOST`, `PORT=587`, `TLS=starttls`, `USER`, `PASSWORD`, `FROM_ADDRESS`, `FROM_NAME`. DNSname, ein Absender, keine Headerkontrollzeichen; Passwort mindestens 16 Zeichen und getrennt von Auth/Mailkey. Alternative im Produkt nur 465/implicit. Kein Klartext-/TLS-aus-/Zertifikatsprüfungsbypass. |
| `backup-secrets.env` | `STEX_AUTH_BACKUP_KEY` mindestens 32 Zeichen und getrennt vom Authsecret; `STEX_AI_CREDENTIAL_ENCRYPTION_KEY` und `STEX_AI_CREDENTIAL_FINGERPRINT_KEY` je 64 Hexzeichen, verschieden. **Der aktuelle Produktions-Backup/Restore-CLI fordert beide auch ohne aktive KI.** Das sind lokale Schutzgeheimnisse, keine OpenRouterzugänge oder Aktivierung der drei vertagten Funktionen. |
| `build.env` | Nur `NODE_ENV=production`, `STEX_LEARNING_MODE=account`, passend zum späteren Betrieb. Keine echten DB-, Auth-, SMTP- oder Sicherungsgeheimnisse im Builder. Kein `STEX_ISOLATED_DEV`/Testdatum. |

`STEX_LOCAL_DATA_DIR` und `STEX_LOCAL_POSTGRES_PORT` müssen im Produktionsvertrag vollständig fehlen, auch nicht als leere Werte. Ebenso keine `SMTP_URL`, `STEX_SMTP_URL`, unsicheren TLSvariablen oder allgemeinen `OPENROUTER_API_KEY*` in diese neuen Dateien übernehmen. Etwaiger vorhandener eigener KI-Zugangsvertrag bleibt eine getrennte bestehende Zuständigkeit, wird hier weder eingerichtet noch pauschal deaktiviert. Alle Beispiele sind **ungültig**, bis im separat freigegebenen Setup echte passende Werte sicher bereitgestellt werden.

## HTTPS, Logs und Uploads

Die Hauptvorlage gehört später in den Nginx-`http`-Kontext; die beiden Snippets in `/etc/stex/proxy/`. Gleichen `__PILOT_HOST__` an allen Stellen verwenden, `__TEST_IP_OR_CIDR__` nur mit genehmigten Testgeräten füllen. Keine Default-Öffnung ins Internet. Unbekannte HTTPziele werden verworfen, unbekannte TLShosts abgewiesen; kein unsicherer Redirect eines HTTP-Authlinks. Zertifikatsausstellung/-erneuerung und DNS sind **nicht implementiert**. ACME-/DNSverfahren erst im Zielauftrag festlegen, keinen funktionierenden Port-80-Challengeweg vortäuschen.

Proxy setzt Host/Forwarded-Origin fest und ersetzt die Forwarded-IPkette, statt fremde Angaben anzuhängen. Kein Proxycache/store für Konten/PDFs, keine nachträgliche Umdeutung eines AUTHfehlers. App-Sitzungs-, Objekt-, Origin-/CSRF- und Rangeprüfung bleibt zuständig. Lokale sensible Altrouten bleiben durch Produktcode geschlossen.

Accesslog enthält ausschließlich Zeit, Status, Byteanzahl und Dauer. **Keine URI**, da auch Passwortresetpfade selbst Tokens enthalten können; ebenfalls keine Query, Referrer, Cookies oder Bodies. Vhost-Errorlogs gehen nach `/dev/null`, App-/Suchstdout und -stderr sind in diesen Vorlagen deaktiviert. Mail-/Backup-CLI liefern vorhandene bereinigte Summen/Hashes oder generische Fehler an Journal. Das begrenzt die Diagnose: kein fertiger bereinigter App-Alarmkanal behauptet. Globale Proxy-/Systemlogs, Rotation, Zugriffsrechte, Logs vor Vhostauswahl und spätere sichere Fehlerdiagnose bleiben Zielprüfungen; niemals Debug-/Linklogs aktivieren, um Anmeldung zu untersuchen.

Nur `/api/catalog/import` erhält 110 MiB Proxygrenze; App begrenzt weiterhin tatsächlich gelesene 110 MiB und 50 MiB je PDF. `/api/learning/documents` erhält 5 MiB Proxyrahmen für 4 MiB plus Metadaten/Multipart; App prüft ihre engere exakte Grenze und 15-Sekunden-Lesefrist. Sonst 1 MiB. Proxybufferung und privater Tempbereich verhindern keine App-RAMkosten: Import und PDF-Range lesen weiterhin größere Originalbytes. `client_body_timeout` misst im Proxy nicht dieselbe Gesamtfrist wie der Appparser. Langsame Mobiluploads/Abbruch/Status und Zielressourcen sind später zu prüfen.

Die 130-Sekunden-Lesefrist nur an `/api/ai` berücksichtigt bestehenden allgemeinen Zweck; sie schaltet keine vertagte Planung frei. Keine 900-Sekunden-Freigabe und keine breiten neuen Proxysperren gegen Keys/Tagging/Modelllisten. Reale Provider-/Budgetnutzung bleibt gesondert.

## Späterer Release- und Updateablauf – hier nicht ausgeführt

1. **Eingaben/Freigaben zuerst:** tatsächlichen Server, OS/Architektur, bereitgestellten Betreiberzugang und separat bestätigte Hostidentität, genehmigten DNS-Namen/Testgeräte, kontrollierten SMTP-Absender samt TLS/Versandfreigabe sowie unabhängigen Sicherungsort und Schlüsselverwahrung klären. Die Runtime- und Suchanschlüsse sind geliefert; passende heutige AUTH-/SEARCH-/SMTP-/DB-/Backupbelege zuordnen. Online- und Datenumfang separat freigeben. Diese Vorlagen sind dafür Material, kein Auftrag zum Starten. Quellen aktuell halten; L1 bleibt auf altem Stand22 und wird nicht ersatzweise trotz 001–016 verwendet.
2. **Linuxrelease getrennt bauen:** vollständigen aktuellen uncommitteten Programmstand mit erlaubter Dateiliste sichern, keine alte HEADkopie. Keine `.env.local`, DB-/Original-/Session-/Backupbestände kopieren. Lockfile und 001–016 mit Namen/Bytes hashen. Erst nach bestätigter Linux-Zielarchitektur in dazu passender ausdrücklich genehmigter Bauumgebung Ziel-Nodepatch >=22.13.0, Pakete einschließlich der heute nötigen devDependency `tsx` und native Linuxmodule bereitstellen. Build mit `build.env` in eigenem Ausgabebaum; kein Install/Build auf der laufenden Nutzerinstanz. Kein macOS-`node_modules` und kein `--omit=dev` ohne gesondertes gebautes Operatorpaket.
3. **Releaseinhalt nachweisen:** Nextbuild, Produktionskonfiguration, `db/migrations`, `scripts/auth`, `scripts/data-migration` mit transitiven Quellen, Suchworker und tsx; Browser-/Legacy-PDF.js plus Worker/CMaps/Schriften/WASM/Lizenz derselben 5.4.296. Linuxstart/Rechte und erlaubte Cacheorte später prüfen. `release-record.example.json` mit wirklicher Dateiliste/Hashes/Versionen/Belegen füllen; unbekannte Online-/Restoregates false lassen. Statischer Vorlagencheck beweist weder vollständige transitive Paketierung noch native Ausführbarkeit.
4. **Wartungsfenster:** Proxyzugang geschlossen halten, Mailtimer anhalten und laufenden Einzelbatch kontrolliert beenden, App/Suchprozess kontrolliert drainen/stoppen. Unklare Mailannahmen nicht zurücksetzen oder automatisch erneut versenden. Keine Dienste jetzt stoppen. Mit bisherigem passenden Release expliziten vollständigen Vorupdatesatz erzeugen und prüfen; DB/Originale unverändert erhalten. Beispielinstanz nur neue Satz-ID `[A-Za-z0-9_-]+`, kein Pfad, kein Wiederverwenden. Fehlendes Manifest/abgebrochener Satz ist kein Backup.
5. **Schema bewusst ändern:** mit neuem passenden Release explizit `persistence.mts migrate`; nicht im App-ExecStart. Backupformat4 allein beweist keine Schemakompatibilität. Migration016 ergänzt sieben Outboxspalten und zugehörige Backupspalten; ein älterer 001–015-/Backupvertrag darf nicht still auf heutige DB losgelassen werden. Keine automatische Downmigration.
6. **Umschalten:** erst nach getrennt geprüfter Schema-/Daten-/Secretbindung den `current`-Verweis im weiterhin geschlossenen Fenster auf das neue Release umstellen. Dienstvorlagen nach Zielprüfung separat installieren, Vorbereitungsblocker erst nach Freigabe gezielt bearbeiten. App/Worker/Einzelmail zunächst nur mit freigegebenem Testzugang überprüfen; keine automatische Öffnung oder reale Einladungen durch Dateikopie. Mit dem gelieferten ungültigen Releaseplatzhalter bleibt die App503; die Suchfähigkeit ist unabhängig davon implementiert. Alle vier gelieferten Dienstvorlagen scheitern vorher absichtlich an `ExecStartPre=/usr/bin/false`. Kein Start ist in diesem Auftrag erlaubt.
7. **Abnahme:** synthetische A/B-/Adminkonten an echter HTTPS-Origin, Mailannahme vs Postfachzustellung, Reset/TOTP/Sperre, manuelle Kontoreise, berechtigte PDFs/Fundstellen und echte iPad-/Handygeräte. Native Last, RAM/I/O/Uploadtemps, Backupsperrzeit, Fehler-/Plattenalarm und Restore vom unabhängigen Ort prüfen. Erst danach separat freigegebener sichtbarer Browserkatalog mit passender PDFzuordnung und anschließend echte Pilotpersonen. Keine automatische KI-/C6-Erweiterung.

Konkrete heutige **Argumentvorlagen**, nach sicherer externer Umgebungsübergabe und mit Arbeitsverzeichnis auf das passende Release; **jetzt nicht ausführen**:

```text
/usr/bin/node --import tsx scripts/data-migration/persistence.mts migrate
/usr/bin/node --import tsx scripts/data-migration/persistence.mts backup /srv/stex/backup-staging/NEW_SET_ID
/usr/bin/node --import tsx scripts/data-migration/persistence.mts restore /srv/stex/backup-staging/VERIFIED_SET_ID
/usr/bin/node --import tsx scripts/auth/mail-dispatch.mts once
```

Restore verlangt einen anderen expliziten leeren DB-/Dateizielvertrag mit passendem Migrationssatz, ursprünglichem Authsecret und den gesonderten Schutzwerten. Nicht auf die belegte aktive DB zeigen. Produktiver Authoperator `init` und lokale Mail-Linkvorschau `mail` bleiben geschlossen. Adminvorbereitung/-abschluss/-recovery sind private, ausdrücklich zu beauftragende Operatoraktionen; kein entsprechender Dienst oder Geheimnisgenerator in diesen Vorlagen.

## Rückweg und unabhängige Sicherung

| Situation | Kontrollierter Rückweg |
|---|---|
| Fehler vor Daten-/Schemaänderung | Wartung beibehalten, bisheriges Release/Verweis und dieselbe aktuelle DB/Dateiablage erhalten. |
| Appfehler nach Update, **belegte** Rückwärtskompatibilität | Vorheriges passendes Release wählen; aktuelle bestätigte Daten erhalten. Gleiche Formatnummer allein genügt nicht für diese Entscheidung. |
| Neues/inkompatibles Schema oder Datenfehler | Aktuellen Stand zusätzlich sichern, Zugriffe geschlossen halten; passendes altes Release und seine vollständige Sicherung in **leeres anderes Ziel** restaurieren. Nach Sicherungszeitpunkt bestätigte Nutzerdaten und Kontosperren bewusst abgleichen. Erst danach kontrolliert umschalten; niemals blind alte DB über neu bestätigte Daten schreiben. |
| Abbruch/ungewisse SMTPannahme | Vorhandene `uncertain`-/Lease-/Fence-Regeln erhalten, Status klären; kein genau-einmal-/Postfachzustellversprechen, kein neuer Resend allein wegen Dienstneustart. |

Vollbackup hält Writer-/Tabellensperren während der gesamten Dateikopie. Ruhiges Fenster, Dauer/Platz und wartende Änderungen später messen. Originale im logischen Satz sind nicht automatisch insgesamt verschlüsselt. **Noch nicht vorhandener Offsiteschritt:** fertigen vollständigen Satz einschließlich PDFs lokal mit gesondertem Schlüssel verschlüsseln, Integrität prüfen, an getrennt gewählten privaten Ort übertragen, Retention/Erfolg/Fehler überwachen und zurückholen. Kein Transfer-/Verschlüsselungswerkzeug, kein Anbieter, keine automatische Rotation oder installierter Alarm wird durch diese Vorlagen geliefert.

Geheimnisse getrennt wiederherstellbar verwahren; keine echten Werte in Releasebeleg, Backupmetadaten oder Logs. Vorschläge RPO24h/RTO4h und etwa sieben Tages-/vier Wochenstände bleiben zu bestätigen und zu messen. Vollsätze kopieren alle Versionen erneut; Speicher wächst entsprechend, ohne behauptete Deduplizierung. Auf leerem Ziel Format4 + **identische** Migrationshashes + alle Dateien/Bezüge prüfen; Restore entwertet Sitzungen/offene Nachweise/Einladungen, Suche wird neu aufgebaut. Vor Öffnung auch spätere Kontosperren nachführen.

## Ausschließlich lokalen statischen Abgleich ausführen

Aus dem Appordner, nur eigenes neues Prüfwerkzeug und künstliche Gegenbeispiele:

```sh
node scripts/host/pilot-check.mjs --root "$PWD"
node --test scripts/host/pilot-check.test.mjs
```

Der erste Aufruf liest nur feste öffentliche Vorlagen/Quellen, importiert kein geprüftes Programm, lädt keine Umgebung und schreibt JSON nach stdout. Exit **1** bedeutet: statischer Vertrag passt, weiterhin blockiert; **2**: Widerspruch; **3**: unsicherer/unbrauchbarer Aufruf oder Dateistand; `--help` Exit0. Kein Install-/Render-/Startmodus. 43 Quellhashes und Vorlagen werden nochmals gelesen, um beobachtete Änderungen zu erkennen; keine atomare Aufnahme oder Schutz gegen absichtliche zeitgleiche Verzeichnismanipulation. Datei-/untergeordnete Verzeichnissymlinks und Hardlinks werden verweigert; Zielwurzel muss eine vertrauenswürdige Programmkopie sein.

Die Ausgabeversion2 unterscheidet `productionAuth.sourceContractMatched/defaultClosed/operatorReleaseInTemplate`, `searchWorker.sourceContractMatched/publicAuthRuntimeIndependent/templateStartBlocked` und `deploymentState=not_observed`. Das sind statische Textverträge, keine Ausführung des Produktcodes. Auch der gemeinsame Produktions-DB-/Dateivertrag wird nur lesend abgeglichen. Der Textcheck ist **kein** nativer Nginx-/systemd-Parser, keine Linux-/TLS-/Ressourcen-/Backup-/SMTPprüfung. Beispiele bleiben ungelöst, alle Dienste blockiert und `onlineReady=false`, auch bei bestandenem Abgleich. Quellenänderungen erfordern bewussten neuen Beleg, kein automatisches Überschreiben des Locks. Die früheren 21 HOST-L1-Tests werden nicht wiederholt.
