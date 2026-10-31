# Arbeitsrunde 35 – Umzugsplan für Contabo

Stand: 20.10.2026. **Plan zur Durchsicht, keine Umsetzungsaufträge versendet.** Die U-Nummern bezeichnen kleine Teile dieses Plans, keine zusätzlichen Projektaufgaben oder neu angelegten Chats.

Niklas hat im aktiven HOST-Chat zunächst ausdrücklich nur den Umzugsplan mit Aufgaben für weniger leistungsstarke zulässige Modelle beauftragt; Originalnachricht von Planung gelesen, Turn 01a158ec-05e0-74a1-b1fd-ed37caff224c. Nach Speichern/Pause hat er im Planungschat mit „weiter, sind wieder back“ die Planung fortgesetzt. Der [gesicherte Zwischenstand](PLANUNG_ZWISCHENSTAND_2026-10-20.md) bleibt als historische Übergabe erhalten. Die Fortsetzung startet weder die Servereinrichtung noch einen echten Datenumzug.

## Ziel und Reihenfolge

Zuerst die vorhandene Anwendung unverändert auf einem geschlossenen Linux-Testziel mit künstlichen Daten betreiben. Danach Zugänge, Dokumente, Suche, Ressourcen und Wiederherstellung am tatsächlichen Ziel prüfen. Erst auf dieser Grundlage den konkret benannten echten Bestand übernehmen und den kleinen eingeladenen Pilot öffnen.

| Phase | Ergebnis | Pakete |
|---|---|---|
| A – Basis und Release | Zielbestand bekannt, passende Runtime, begrenzte Dienstrechte und vollständiges Linuxrelease | U01–U08 |
| B – Geschlossener Test | Leere Test-DB/Dateiablage, tatsächliche HTTPS-Proben und belegter Restore | U09–U13 |
| C – Echter Umzug | Ausgewählter Quellbestand unverändert übernommen, gesicherter Rückweg und ausdrücklich freigegebene Pilotpersonen | U14–U16; gesonderter Daten-/Mailumfang |

**Erledigt bleibt erledigt:** C0 ist durch den [HOST-Abschlussbericht](entwuerfe/HOST-01/C0-ABSCHLUSS-2026-10-20.md) unabhängig belegt: angemeldete Linux-VNC-Rootshell, passender öffentlicher ED25519-Fingerprint und Ubuntu24.04.5/noble nach Anmeldung. Planung hat diesen Bericht lesend übernommen; kein erneuter C0-Test. H1 hat noch nicht begonnen.

Ressourcen aus direkter Nutzerausgabe: x86_64,4 verfügbare CPUs,7.8Gi RAM, Rootdateisystem96G/94G frei,0Swap. Das ist kein Lastnachweis. UFW wurde als inactive beobachtet; andere Firewallregeln sind damit unbekannt. Nachfolgende apt-cache-Eingaben blieben ohne sichtbaren Befehl/Output. Paketkandidaten, Zielpfade/-benutzer und effektive SSH-/übrige Firewallkonfiguration sind noch zu erheben.

## Modelle und sparsame Übergaben

| Arbeit | Empfehlung | Grenze |
|---|---|---|
| Dateiliste, Hashmanifest, fest vorgegebenes Rendering, kleines Paketierungsskript, mechanischer Belegvergleich | gpt-6-luna, Medium | Ein klarer Auftrag, wenige Quellen, feste Ausgabe und Dateigrenze. Bei fachlicher Entscheidung oder unerwartetem Bestand stoppen. |
| Planung, Installations-/Rechteprüfung, SSH/Firewall, Authentifizierung, Schema-/Datenentscheidungen, Fehleranalyse und Abnahme | gpt-6.1-sol, High | Kurzer Review des konkreten Ergebnisses; keinen schon gelieferten Review oder bestandenen alten Test wiederholen. |
| Serverbedienung | Bestehender HOST10 mit zulässigem Solstand | Genau ein Bediener; vorbereitete Luna-Ergebnisse sind keine zweite Root-Sitzung. |

Luna soll die genannten Routineergebnisse tatsächlich erstellen, nicht nur Sol zusätzliche Vorschläge liefern. Sol prüft die Auswirkungen und führt sicherheitsrelevante Zielaktionen aus. Das ist eine Aufgabenempfehlung, keine gemessene Kosten-/Qualitätsgarantie. Die verfügbaren Modellnamen sind im aktuellen Werkzeugkatalog und in der [offiziellen Codex-Modellwahl](https://learn.chatgpt.com/docs/developer-commands#built-in-slash-commands) belegt; die Eignungszuordnung ist unsere Projektentscheidung.

Bestehende Chatmodelle und zulässige Reasoningstufen werden jetzt nicht umgestellt. Für spätere Routinepakete bevorzugt kurze Unteragenten unter dem zuständigen Aufgabenchat mit ausdrücklich gewähltem Luna-Modell und frischem knappen Kontext. Keine neue unabhängige Projektaufgabe. Astra und sämtliche Varianten bleiben in Planung, Umsetzung und jedem Test/Review ausgeschlossen. Vorhandenen lesenden HOST-Unteragentenreview nicht erneut starten.

Jede spätere Übergabe enthält nur: U-Nummer/Ziel, geprüften Ausgangsstand, maximal die benötigten Quellen, genaue Writerpfade, erlaubte Befehle/Wirkungen, Abnahmekriterien, Stopppunkt und Rückweg. Ergebnis: geänderte Dateien/Hashes, tatsächlich ausgeführte Befehle mit bereinigtem Ergebnis und offene Grenzen. Keine Altverläufe, privaten Konfigurationen, Dokumenttexte oder Geheimnisse in Unteragentenprompts. Parallel sind höchstens getrennte lokale Vorbereitungen möglich; kein paralleles Schreiben derselben Datei und keine parallele Serverbedienung.

## Dateibesitz und Zieltrennung

Die Zuordnung reserviert spätere Fenster; sie startet keinen Writer. Aktive Chat-IDs kommen ausschließlich aus CHATS.json.

| Bereich | Einziger zuständiger Writer nach späterem Auftrag |
|---|---|
| Zentraldateien, diese Runde, Briefings, CHATS.json/CHATS.md und Abnahmestatus | Planung |
| Eigene nicht geheime Manifeste/Transaktionspläne, gerenderte Beispiele/Dienste/Proxy unter deploy/pilot/targets/contabo-test/; gegebenenfalls neues scripts/host/contabo-release.mjs | HOST10; pro Paket genau ein lokaler Unteragent, HOST integriert erst danach |
| Eigene Zielprobe scripts/data-migration/contabo-target-probe.mts und Berichte docs/entwuerfe/DATA-01/CONTABO-U*.md | DATA02; AUTH/SEARCH liefern getrennte Befunde, schreiben diese Probe nicht gleichzeitig |
| Eigener Auth-Prüfplan/Bericht docs/entwuerfe/AUTH-01/CONTABO-U09-AUTH.md bzw. CONTABO-U16-MAIL.md | AUTH03; keine parallele Bearbeitung von DATA-Probe oder HOST-Konfiguration |
| Reine Such-/PDF-Zielbefunde in eigenen Ergebnis-/CONTABO-Berichten | SEARCH07 bzw. PDF06; keine Produkt-/Deploymentdateien |
| Produktcode, package.json/Lockfile, Migrationen001–016, Backupkern, Layout und Kontooberflächen | In diesem Plan read-only. Ein belegter notwendiger Produktfix braucht vorher ein eigenes enges Writerfenster bei DATA/AUTH/PDF/SEARCH/UI. |
| Alle Dateien und Befehle auf dem VPS | Ausschließlich HOST10 als Serverbediener; fremde Vorschläge werden nicht von anderen Chats am Ziel ausgeführt |

Gemeinsame Pfade wie Schema/Migrationen, Backup und Konto-/Layoutdateien werden nicht vorsorglich mehreren Bearbeitern überlassen. Bestehende blockierte deploy/pilot-Beispiele und datierte static-*/Quellbelege bleiben erhalten. Der alte HOST-L1-Prüfer mit Basis Stand22 ist kein aktueller 001–016-Gesamtfreigabeprüfer.

Vorgeschlagener Testvertrag: eigene neue DB stex_test_20261020, private Dateien /srv/stex/data/contabo-test/files, Konfiguration /etc/stex/contabo-test/, Sicherungsstaging /srv/stex/backup-staging/contabo-test/. Existiert eines dieser Ziele bereits oder ist anders belegt, stoppt der Standardpfad; nichts ersetzen. Releases liegen getrennt unter /srv/stex/releases/ und Builderausgaben unter /srv/stex/build/. Der spätere echte Bestand erhält einen eigenen bestätigten DB-/Dateivertrag. Werden Test und Echtbetrieb nebeneinander erhalten, müssen auch Dienstzugriffe/UIDs entsprechend getrennt werden; keine stillschweigende gemeinsame Datenwurzel.

## Abhängigkeiten und gebündelte Prüfpunkte

| Paket | Voraussetzung | Führender Aufgabenchat | Hauptmodell für das Ergebnis |
|---|---|---|---|
| U01 | C0 vorhanden; neue Plan-/Ausführungsentscheidung | HOST10 | Sol |
| U02 | Vereinbartes kurzes Schreibruhefenster für Programmquellen | HOST10 | Luna Medium |
| U03 | Öffentliches Restinventar aus U01 | HOST10 | Luna Medium, Sol prüft |
| U04 | Fertiger jeweiliger U03-Teilblock und konkrete Ausführungsfreigabe | HOST10 | Sol als Bediener |
| U05 | Pfad-/Nutzerbestand aus U01, gewählter U04-Basisstand | HOST10 | Luna Medium für feste Einrichtungsvorlage |
| U06 | U05; benannter öffentlicher Schlüssel, zweiter bewiesener Zugang | HOST10 | Sol High |
| U07 | U02/U03/U05; festgelegte Testbindung | HOST10 | Luna Medium |
| U08 | U02/U04/U05; erlaubter Transferweg | HOST10 | Luna Medium für Paketierung/Bauablauf |
| U09 | U06/U07/U08; genaue neue Test-DB-/Datei-/Secretbindung | DATA02 mit AUTH03; Ausführung HOST10 | Sol |
| U10 | U09 und neuer gezielter Prüfplan | DATA02, Ausführung HOST10 | Luna Medium für feste Probe/Auswertung |
| U11 | U06/U07/U10; DNS/ACME-/Testgeräteumfang gebunden | HOST10 | Sol; Luna rendert feste Dateien |
| U12 | U09/U10; unabhängiger privater Ort und Schlüsselverwahrung gebunden | DATA02; Ausführung HOST10 | Sol; Luna vergleicht Belege |
| U13 | U10/U11/U12 und echte Geräte-/Zielbefunde | Planung übernimmt Aufgabenbefunde lesend | Sol; Luna erstellt Matrix |
| U14 | U13; benannte tatsächliche Quelle/Auswahl und erlaubter Quellzugriff | DATA02 | Sol |
| U15 | U14; konkrete Freigabe echter Datenübertragung und geprüfter Sicherungs-/Restoreweg | DATA02; Ausführung HOST10 | Sol |
| U16 | U13/U15; benannter SMTP-Absender/Empfänger-/Pilotumfang | AUTH03; Ausführung HOST10 | Sol |

U02 kann lokal neben U01 vorbereitet werden. U07 kann nach seinen feststehenden Eingaben neben anderen lokalen Vorbereitungen entstehen. U11 und U12 dürfen ihre Dokumente unabhängig vorbereiten, Serveraktionen bleiben seriell. U03/U04 haben bewusst zwei kurze Phasen: zuerst gegebenenfalls genau begrenztes Metadatenupdate, danach feste Pakettransaktion; kein unbegrenzter Installationsauftrag mit später selbst erfundenen Versionen.

Prüfpunkte: erst den Plan entscheiden; dann U01/U02 als begrenzte Vorbereitung; danach genaue Basis-/Zugangsblöcke; danach ausschließlich das neue künstliche Testziel. Für U15 sind Datenquelle/-umfang/-ziel und für U16 reale Empfänger gesondert zu bestätigen. Innerhalb eines passend gebundenen und freigegebenen Blocks braucht nicht jede harmlose Zeile eine neue Grundsatzfrage. Unterbrechungen, Abweichungen oder Werkzeugablehnungen werden am konkreten offenen Punkt übernommen.

## Phase A – Basis und Release

### U01 – Bedienbarkeit und fehlendes Restinventar

**Ergebnis/Besitz:** HOST schreibt nur docs/entwuerfe/HOST-01/CONTABO-U01-INVENTAR.md. C0-Beleg mitführen, nicht wiederholen. Die gespeicherte Linuxkonsole frisch ansehen; die letzte Rootshell ist keine Garantie einer noch lebenden Sitzung.

**Aktion:** Jeweils einen kurzen harmlosen Lesebefehl vor Absenden visuell prüfen und Prompt/Ergebnis danach bestätigen. Nur fehlende Paket-/Dienst-/Pfad-/Nutzermetadaten erheben: apt-cache policy für postgresql-16, postgresql-client-16, nginx, ca-certificates, curl, xz-utils; getent für geplante Dienstnutzer; Existenz/Owner/Rechte eigener Zielpfade; pg_lsclusters falls vorhanden; UFW-/Netfilterbestand und gefilterte effektive SSHwerte. Vor SSHänderung Include-/Matchbedingungen und den tatsächlichen Verbindungskontext berücksichtigen. Keine komplette Umgebungs-/Konfigurations-/Prozessargumentausgabe.

**Abnahme/Stop/Rückweg:** Beobachtete Ergebnisse mit Herkunft, keine angenommene leere Maschine. Erlaubten zuverlässigen Befehlseingabe- und späteren Programmtransferweg benennen. Bei erneut unsichtbarer/vertauschter Eingabe sofort stoppen; keine blinden langen Blöcke. Die gesperrte Mac-Terminal-App weder über andere UI noch Shell-/SSH-/Clipboardtechnik umgehen. Kein zusätzlicher Systemzustand zum Zurücksetzen; vorhandene Sitzung erhalten. Ohne tragfähigen Weg bleiben Zielaktionen blockiert, lokale Vorbereitung ist trotzdem möglich.

### U02 – Vollständigen Programmstand binden

**Ergebnis/Besitz:** Luna erstellt unter HOST ein neues öffentliches source-manifest.json im reservierten Zielordner und bei Bedarf das eng begrenzte contabo-release.mjs. Zuerst nur Dateiliste/Hashes; eine spätere Kopie entsteht ausschließlich aus der geprüften Auswahl.

**Aktion:** Tatsächlichen Stand einschließlich uncommitteter/untracked Dateien erfassen, Schreibruhe vereinbaren, Quellen vorher/nachher vergleichen. Erlaubt sind benötigte Programmquellen, feste Konfiguration/Lockfile, genau001–016, Operatortransitive und ausdrücklich überprüfte öffentliche Assets/Lizenzen. Keine pauschale Kopie des übergeordneten Lernordners. Ausgeschlossen sind .env.local/echte .env-Dateien, private Dokumente, Datenbanken, Sitzungen, Backups, historische Snapshots und macOS-node_modules/.next. Symlinks/Hardlinks oder unklare Dateien nicht blind verfolgen.

**Abnahme/Stop/Rückweg:** Sol prüft die feste Auswahl; Bytegrößen/Hashes, PDF.js5.4.296 einschließlich Worker/CMaps/Schriften/WASM/Lizenz, tsx und Operatorabhängigkeiten sind nachvollziehbar. Ein git-archive nur vom HEAD539bf2d wäre unvollständig und ist unzulässig. Bei Quellenänderung nur betroffene Auswahl neu binden. Nur eigene unbenutzte Stagingkopie verwerfen; Nutzercheckout und bestehende Belege erhalten. Kein Commit/Reset/Clean/Worktree von altem HEAD.

### U03 – Feste Transaktion vorbereiten

**Ergebnis/Besitz:** Luna schreibt package-plan.md unter dem HOST-Zielordner: Pakete/Versionen/Abhängigkeiten, Herkunft, Node-URL/Prüfsumme, Platzbedarf, Startverhalten, vorhandene betroffene Objekte und Rückweg. Sol prüft diesen kleinen konkreten Block.

**Aktion:** Bestehende APT-Metadaten zunächst lesend verwenden. Falls Aktualisierung nötig, zuerst nur den genau begrenzten U04a-Block vorbereiten: apt-get update, bestätigte Bezugsquellen und betroffene Metadaten/etwaige Hooks, noch keine Installation. Danach Kandidaten und apt-get --simulate install --no-install-recommends für postgresql-16, postgresql-client-16, nginx und tatsächlich nötige Hilfspakete festhalten. Vorhandenes OpenSSH/sudo/UFW nicht pauschal neu installieren. Node unterstützt den bestehenden Vertrag >=22.13.0; Patch/Architektur/Hash aus offizieller Quelle exakt binden, kein automatisch wechselndes latest.

**Abnahme/Stop/Rückweg:** Vollständige feste Installationsliste erst nach dem tatsächlichen Kandidatenstand. Platzhalter oder bloße öffentliche Webversionen reichen nicht. Vorhandene policy-rc.d und Dienstzustände beachten. Ohne Paketkandidaten bleibt nur der Metadatenblock prüfbar, keine erfundene Installationsfreigabe. Dieser Vorbereitungsschritt selbst ändert den VPS nicht.

### U04 – Metadaten und Pakete seriell ausführen

**Ergebnis/Besitz:** HOST liefert CONTABO-U04-BASIS.md mit konkreten Versionen, neuen Dateien/Diensten, Rückweg und tatsächlichem Stopppunkt. Nur exakt gebundene Befehle.

**Aktion:** U04a aktualisiert bei Bedarf ausschließlich die vorher geprüften APT-Metadaten und gibt an U03 für die endgültige Transaktion zurück. U04b installiert erst die danach fest gebundenen Pakete/Node-Distribution. Keine pauschale Vollaktualisierung, Kernel-/Distributionsmigration oder Reboot. Unerwünschten Paketdienststart anhand des tatsächlichen Bestands verhindern; eine neue temporäre policy-rc.d wirkt global und gehört ausdrücklich in die geprüfte Wirkung. Fremde Policy nie überschreiben; nur die selbst erzeugte unveränderte Datei anschließend zurücknehmen. Node separat unter /opt/stex/, kein Ersetzen von /usr/bin/node und kein curl-pipe-shell.

**Abnahme/Stop/Rückweg:** Versionsaufrufe, tatsächlich erzeugte Dienstzustände und Listener gezielt prüfen. Nginx bleibt bis U11 ohne öffentliche Webfreischaltung; Datenbankzugang geschlossen. Keine Appmigration/Uploads. Bei Abweichung stoppen, gegebenenfalls ausschließlich neu gestarteten eigenen Dienst schließen. Kein blindes Paketpurge, Down-/Datenrollback oder Löschen neuer Cluster; erreichten Bestand dokumentieren.

### U05 – Rechte, Builder und Pfade

**Ergebnis/Besitz:** Luna erstellt dirs-plan.md und eine feste, von Sol geprüfte Einrichtungsvorlage im HOST-Zielordner. HOST allein wendet den freigegebenen Teil an.

**Aktion/Wirkung:** Nur nach bestätigter Nichtexistenz Betreiberkonto stex-ops, nicht interaktive Dienstkonten stex-app und stex-build, später bei Mailbedarf stex-mail. Builder ohne sudo und ohne Zugriff auf DB-/Auth-/Originaldaten. Vorgeschlagen: /srv/stex/releases rootverwaltet0755; eigene Buildwurzel und Builderhome0700/stex-build; private Testdateiwurzel0700/stex-app, Dateien0600; /etc/stex/contabo-test0700/root und später jeweilige Secretdatei0600/root. Eltern so zugänglich wie nötig, keine rekursiven Rechteänderungen an Bestandsbäumen. Releasequellen für Dienste nur lesbar, Cache separat beschreibbar.

**Abnahme/Stop/Rückweg:** Nur festgelegte Pfadmetadaten/Owner prüfen und Negativzugriffe auf künstliche Marker. Ein kollidierender Benutzer/Pfad blockiert statt Übernahme. Kein npm-/Buildlauf als root oder unter einem Konto mit passwortlosem Vollsudo. Im Fehlerfall eigene noch ungenutzte Objekte stehenlassen/kennzeichnen; keine unbekannten Konten/Dateien entfernen.

### U06 – Zweiter Zugang und begrenzte Härtung

**Ergebnis/Besitz:** Sol/HOST bindet den genau benannten öffentlichen Betreiberschlüssel, Rechteumfang, SSHdropin und Firewallregeln in CONTABO-U06-ZUGANG.md. Private Schlüssel/Passwörter bleiben außerhalb der Übergaben.

**Aktion/Wirkung:** Zunächst Schlüsselzugang und benötigte Administration in einer zweiten tatsächlichen Sitzung beweisen. Vorschlag ist passwortpflichtiges sudo für stex-ops; älteres NOPASSWD:ALL wird nicht automatisch übernommen. Erst danach Root-SSH/Passwortauthentifizierung gezielt einschränken, lokale Root-VNC-Rettung erhalten. Vor Reload sshd -t und effektive Werte einschließlich Matchkontext prüfen. UFW nur nach Prüfung anderer Regeln und erhaltenem Rückzugang; Basis eingehend22/tcp für beide IPfamilien, ausgehend erlaubt.80/443 erst U11;3000/5432 niemals öffentlich, VNC-Anbieterport nicht als Gastport freigeben.

**Abnahme/Stop/Rückweg:** Neuer Zugang und sudo nach jeder sicherheitsrelevanten Änderung erneut belegen, alte Sitzung erst am Ende schließen. Fehlender öffentlicher Schlüssel/zweiter Zugang blockiert Härtung. Vorherige Konfiguration privat serverlokal sichern; nur eigenen Dropin bzw. eigene neue UFWaktivierung gezielt zurücknehmen. Kein Firewallreset, Passworthash-/Schlüsselverlust oder blinder Neustart.

### U07 – Zielkonfiguration mechanisch rendern

**Ergebnis/Besitz:** Luna erstellt nur nicht geheime Dateien unter deploy/pilot/targets/contabo-test/systemd/, nginx/, env/*.example sowie release-record.json. HOST ist Owner; alte Beispiele/Quelllocks unverändert.

**Aktion/Wirkung:** Absolute gewählte Nodepfade auch für Next, Suchworker und Operatoren einsetzen, genaue Test-DB-/Datei-/Cachebindung eintragen, getrennte Dienstumgebungen und vorbereitete Startsperren erhalten. App nur127.0.0.1:3000; Proxy zunächst Wartung und feste Test-Allowlist. Produktionsruntimefreigabe ist ein eigenes serverseitiges Feld; Quellhashes setzen es nicht. Keine breite zusätzliche KI-Sperre: nur die drei bereits vertagten Funktionen bleiben vertagt. Mailtimer nicht aktivieren.

**Abnahme/Stop/Rückweg:** Luna prüft nur das neue Rendering gegen feste Eingaben, Sol prüft Rechte/Exponierung und Änderungen an den Startsperren. Native systemd-/nginx-Validierung erfolgt erst am Ziel vor Installation. Ungelöste Werte blockieren Start; keine Geheimnisse rendern oder aus alten .env-Dateien kopieren. Eigene Entwürfe korrigieren, keine Produkt-/alten Vorlagentests wiederholen.

### U08 – Paketieren und einmalig unter Linux bauen

**Ergebnis/Besitz:** Luna erstellt aus U02 das erlaubte Quellpaket, festen Bauablauf und Hash-/Artefaktbeleg; HOST überträgt/bedient über den bestätigten erlaubten Weg. Build nur im separaten neuen Builderbaum.

**Aktion:** Ziel-Node/npm und vorhandenes Lockfile verwenden; npm ci --include=dev, anschließend npm run build mit nur geplanter geheimnisfreier Bauumgebung. tsx ist derzeit auch für Produktionsoperatoren nötig; kein ungeprüftes omit-dev. Keine echten Laufzeit-/Mail-/Sicherungswerte beim Build. Native Linuxmodule und vollständige PDF.js-/Operatorassets mitliefern; keine macOS-Artefakte übernehmen. Erforderliche zusätzliche native Buildpakete melden und vor Installation genau binden.

**Abnahme/Stop/Rückweg:** Ein erfolgreicher passender Linuxbuild, unverändertes Lockfile, feste Artefakt-/Migrations-/Quellhashes und tatsächlich vollständiges Laufzeitpaket. Ressourcengrenzen vor längerer Arbeit prüfen; keine fremden Prozesse beenden. Nur Builderausgabe beschreibbar; geprüftes Release anschließend rootverwaltet versiegeln. Fehler lässt bisherige Releases/Daten unberührt; keine alten App-/Mac-Lasttests wiederholen.

## Phase B – Geschlossener künstlicher Zielbetrieb

### U09 – Leeres Testziel, Schema und tatsächlicher Runtimevertrag

**Ergebnis/Besitz:** DATA erstellt den Testvertrag/Probe ausschließlich in eigenen reservierten Dateien, AUTH einen getrennten kleinen Auth-Prüfplan; HOST richtet das Ziel seriell ein. Sol prüft DB-/Datei-/Rechtebindung.

**Aktion/Wirkung:** Neue unbenutzte Test-DB/Dateiwurzel, PostgreSQL nur127.0.0.1:5432 mit passendem SCRAM-Vertrag, keine Fremdclusterinitialisierung.001–016 bewusst vor Requests über vorhandenes persistence.mts migrate anwenden, nicht im Appstart. Lokale Schutzwerte serverseitig geschützt erzeugen/verwahren und nur dem zuständigen Dienst übergeben; keine Providerkeys anlegen. Backup/Restore benötigt auch die vorhandenen KI-Credential-Schutzwerte, ohne dadurch KI zu aktivieren. Serverkonfiguration/Secrets außerhalb Release/Repo, keine lokalen Produktionsfallbacks.

**Abnahme/Stop/Rückweg:** Tatsächlicher Schema-/Migrationshash-/Zielbeleg und leere Ausgangsbasis; nur dieses synthetische Ziel freigeben. Sol kontrolliert, wann allein gerenderte Zielstartsperren und das bestehende Runtimefeld bewusst gesetzt werden dürfen. Produktionsoperator init/mail bleiben geschlossen. Bootstrap-/Testwerte nicht ausgeben oder in Berichte übernehmen. Bei falscher Bindung vor Konstruktion/Schreiben stoppen; keinen vorhandenen Bestand ersetzen. Testzustand isolieren statt Echtziele restaurieren.

### U10 – Gezielte Linuxprobe mit künstlichen Konten/Dateien

**Ergebnis/Besitz:** DATA führt die neue kleine Zielprobe, AUTH prüft den Authteil, SEARCH/PDF liefern nur nötige eigene Befunde. Luna kann feste Probe-/Auswertungsschritte implementieren; Sol übernimmt Sicherheits-/Datenabweichungen. HOST bleibt einziger Serverbediener.

**Aktion:** Authentifizierte echte PostgreSQL-/PrivateFiles-/Produktionsruntimebindung, A/B-/Admintrennung, Sperre, künstlicher Import/PDF mit Range/Fundstelle, serieller Suchworker, begrenzte Schreib-/Cacheorte und Neustartpersistenz prüfen. Zunächst Loopback-Smoke; authentifizierte Browser-/Origin-/Cookieabnahme erst mit U11. Kleine fest begrenzte synthetische Upload-/Ressourcenproben mit bisherigen Stoppschwellen; keinen alten eingebetteten lokalen Testdriver als Linuxproduktionsbeleg umetikettieren. Kein echter Provider-/Mailaufruf.

**Abnahme/Stop/Rückweg:** Tatsächliche neue Zielbelege je geprüfter Grenze und offen markierte Restfälle. Ein In-memory-/simulierter Authablauf beweist keine echte Mailzustellung. Falls künstliche Konten mit dem Produktionsvertrag nicht sicher bereitgestellt werden können, AUTH meldet den kleinsten fehlenden Schritt statt Guard-/SQL-Bypass. Eigene Testprozesse stoppen, neue Testdaten getrennt erhalten, reale Quellen unberührt.

### U11 – Kostenlose Adresse, TLS und beschränkter Testzugang

**Ergebnis/Besitz:** HOST bindet den schon gewählten Kandidaten stex.62-171-162-115.sslip.io, ACMEclient/-version, Zertifikatserneuerung, Challengepfad und bestätigte Testgeräte/IPs in eigenen Zielkonfigurationen; Luna rendert feste Dateien.

**Aktion/Wirkung:** DNS auf genau die VPS-IP prüfen, gegebenenfalls AAAA bewusst berücksichtigen, keine Domain-/DNS-APIbuchung. Eigenes gültiges Zertifikat; bei HTTP-01 nur den vorgesehenen Challengepfad über80 bereitstellen, übrige Inhalte Wartung/gesperrt.443 nur für den bestätigten geschlossenen Testzugang. Kein automatisch umschreibendes Proxysetup oder TLS-Prüfungsbypass. ACME-Installation und dauerhaft nötige Erneuerungsregeln als konkrete zusätzliche Systemänderungen binden.

**Abnahme/Stop/Rückweg:** nginx -t, vertrauenswürdige Zertifikatskette/Name, feste Origin, HTTPS-Cookies/Originprüfung, abgewiesener fremder Zugriff und weiterhin interne App/DB. Eigene Proxy-/Systemlogs auf URI-/Token-/Cookie-/Bodyfreiheit prüfen. Mailtimer bleibt aus. DNS-, Zertifikats- oder Allowlistproblem blockiert diesen Teil; kein Ausweichen auf öffentlich alle erlauben. Vorherigen eigenen Proxy-/Dienstzustand wiederherstellen und Wartung beibehalten.

### U12 – Vollbackup, unabhängiger Ort und echter Restore

**Ergebnis/Besitz:** DATA bindet einen neuen vollständigen synthetischen Format4-Satz und anderes leeres Restoreziel; HOST bedient. Luna vergleicht feste Summen/Hashes/Referenzen, Sol beurteilt Wiederherstellbarkeit.

**Aktion/Wirkung:** Writer kontrolliert anhalten, neue eindeutige Satz-ID, vorhandenes persistence.mts backup verwenden. Der Satz einschließlich Originaldateien ist nicht automatisch vollständig verschlüsselt. Vorschlag für die äußere Verschlüsselung ist age aus verifizierter Bezugsquelle; genaue Version/Installation, öffentlicher Empfänger, getrennt verwahrte Wiederherstellungsidentität und unabhängiger privater Sicherungsort müssen vor Transfer gebunden sein. Keine neue kostenpflichtige Ablage anlegen. Verschlüsselten Satz übertragen, am unabhängigen Ort prüfen/zurückholen, entschlüsseln und mit passenden Schutzwerten/identischen Migrationen in ein anderes ausdrücklich leeres Ziel restaurieren.

**Abnahme/Stop/Rückweg:** Manifest/Dateivollständigkeit, IDs/Zuordnungen, erwartete Sitzungsentwertung, neu aufzubauende Suche, gemessene Dauer/Platz/Sperrzeit und tatsächlicher Rückhol-/Restorebeleg. Lokal kopierter Ordner ist kein Offsitebeleg. Alter Zielbestand wird nicht überschrieben. Fehlender Ort/Schlüssel oder unvollständiger Satz blockiert Abnahme. Vorhandene Daten/Schlüssel/Sicherungen nicht löschen; keine pauschale Retention vor erfolgreicher Prüfung.

### U13 – Geschlossenen Test abnehmen

**Ergebnis/Besitz:** Luna erstellt aus tatsächlichen Aufgabenberichten eine kleine Matrix: durchgeführt/bestanden/offen mit Belegreferenz. Sol und Planung prüfen lesend; Planung führt keine Tests/Builds erneut aus.

**Abnahme:** U10-Zielgrenzen, tatsächliche HTTPS-Kontoreise, iPad-/Handy-PDF-/Uploadbedienung, native Ressourcen, Neustart, U12-Restore und nötiger sicherer Diagnose-/Alarmweg. Reale Geräte müssen tatsächlich benutzt worden sein; Simulation als solche markieren. RPO/RTO/Retention erst aus bestätigten Anforderungen und Messwerten übernehmen. Unbelegte SMTP-Zustellung oder realer Bestand bleiben ausdrücklich offen.

**Stop/Rückweg:** Kein onlineReady aus statischen Hashes, keinem vollständigen Prüfprotokoll oder fehlender Nutzerrückmeldung ableiten. Relevante Fehler an genau einen zuständigen Owner mit begrenztem Fixfenster geben; keine pauschalen Neubauten/Testwiederholungen. Bis Abschluss bleibt Testzugang begrenzt. Kein echter Umzug automatisch nach einem grünen Einzeltest.

## Phase C – Später gesondert freizugebender echter Umzug

### U14 – Quelle, Auswahl und Erhaltung konkret binden

**Ergebnis/Besitz:** DATA erstellt CONTABO-U14-QUELLVERTRAG.md ohne private Texte: tatsächliche Quelle/Exportweg, verantwortlicher Besitzer, ausgewählte Datenarten, Freeze-/Exportzeitpunkt, Datei-/Objektzählungen, Integritäts-/Referenzregeln und Zielzuordnung. IMPORT04 nur für eine nachgewiesene zusätzliche Importlücke einbeziehen, keine neue Klassifizierung starten.

**Aktion:** Vor erlaubtem Quellzugriff keine Browser-/AltDB-/Backupquelle erfinden. Rund450 klassifizierte Klausuren sind Nutzerangabe, keine Vorgabe alle Projekt-PDFs zu importieren. Gemeinsamen Katalog von persönlichen Notizen, Lernständen, Schreibdaten und Kalenderbezügen unterscheiden; IDs/Klassifizierungen, Eigentümer, private Notizen und bestehende Kalender-UIDs/Links erhalten. Schlüssel-/Kontobindung und nicht exportierbare Felder klären.

**Abnahme/Stop/Rückweg:** Sol prüft eine Erhaltungsmatrix und den konkreten späteren Übertragungsumfang. Bei ungeklärtem Besitzer/Quelldelta/Exportweg stoppen, keine automatische Dubletten-Neuklassifizierung oder IDsneuvergabe. Quelloriginale unverändert lassen. Erst danach kann Niklas genau diesen Daten-/Dokumenttransfer freigeben.

### U15 – Kontrollierter echter Datenumzug

**Ergebnis/Besitz:** DATA führt den abgegrenzten Umzug; HOST bedient das Ziel. Luna kann feste Zähl-/Hash-/Referenzvergleiche ausführen, die Zuordnungsentscheidung bleibt Sol.

**Aktion/Wirkung:** Erst nach konkreter Quell-/Auswahl-/Ziel-/Transferfreigabe. Quelle kurz einfrieren und unabhängig sichern; vollständigen autorisierten Satz über bestätigten geschützten Weg in eigenes neues Echtziel übernehmen. Bei späteren Quelländerungen vor Umschalten ein bewusstes Delta behandeln. Rollen/persönliche Zuordnung/Originalversionen erhalten; keine künstlichen Testkonten/-daten als Echtbestand weiterverwenden und keinen fremden Bestand leeren. Vor Öffnung vollständigen verschlüsselten Echtsatz samt Rückweg sichern; keine private Datei/Notiz in Arbeitsbericht kopieren.

**Abnahme/Stop/Rückweg:** Mengen, Integrität, IDs, Versionen, Fremdschlüssel, Eigentümer, Notizen und Kalenderbezüge mit Quelle vergleichen; persönliche Stichprobe durch berechtigte Person. Quelle zunächst weiter verfügbar, aber keine parallelen widersprüchlichen Schreibsysteme. Bei Fehler Ziel geschlossen lassen; neue bestätigte Zieländerungen gesondert erhalten, niemals blind alte Sicherung über neuere Daten schreiben. Vor endgültiger Umschaltung ausdrücklich entscheiden, welches System führend ist.

### U16 – Reale Mail und kleiner eingeladener Pilot

**Ergebnis/Besitz:** AUTH bindet SMTPhost/TLS-/Absendervertrag, genau benannte Testempfänger und Pilotpersonen in einem eigenen privaten Betreiberprozess; HOST führt den seriellen Einzellauf aus. Geheimnisse und Einladungs-/Resetlinks nicht ins Ergebnis.

**Aktion/Wirkung:** Reale Zustellung nur für den separat bestätigten Umfang. Zunächst vorhandenes mail-dispatch.mts once, beobachtete Annahme von tatsächlicher Postfachzustellung unterscheiden. uncertain-/Lease-/Fence-Regeln erhalten, kein blindes Wiederholen ungeklärter Zustellung. Erst danach kontrollierte Einladungen/persönliche Aktivierung, Admin/TOTP und Sperre am echten HTTPS-Ziel prüfen. Timer erst nach gebundenem Einzeltest/Intervall/Rückweg aktivieren.

**Abnahme/Stop/Rückweg:** Kleiner geschlossener Pilot mit funktionierendem Nutzer-/Betreiber-/Sicherungsweg. Bei Mailproblem keine neue Einladung oder Kontorücksetzung als Retryersatz. Eigenen Timer stoppen, Dienst-/Zugangsfreigaben gezielt zurücknehmen, bestätigte Daten/Kontosperren erhalten. Keine öffentliche Plattformöffnung, neuen Kosten, bezahlte KI oder Aktivierung von Lernplangenerierung/Korrektur/Check-in aus diesem Paket ableiten.

## Befehlsverträge und noch nicht gebundene Werte

Dies ist kein Installationsskript. Folgende vorhandene CLIeinstiege sind anhand des gelesenen Codes real; der absolute Nodepfad, Arbeitsordner, private Umgebungsübergabe und Satz-/Zielbindung müssen im jeweiligen späteren Ausführungsblock bereits feststehen. Winkelklammern markieren bewusst nicht ausführbare offene Werte.

~~~text
<NODE_ABS> --import tsx scripts/data-migration/persistence.mts migrate
<NODE_ABS> --import tsx scripts/data-migration/persistence.mts backup <NEUER_VOLLSTAENDIGER_SATZ>
<NODE_ABS> --import tsx scripts/data-migration/persistence.mts restore <VERIFIZIERTER_SATZ>
<NODE_ABS> --import tsx scripts/search/worker.mts watch
<NODE_ABS> --import tsx scripts/auth/mail-dispatch.mts once
~~~

Migrate nur auf den ausdrücklich gebundenen Zielvertrag; Restore nur in ein anderes leeres DB-/Dateiziel. Umgebungsdateien nicht shell-sourcen oder ausgeben. Authoperator prepare-admin/finish-admin und etwaige private Bootstrapübergabe müssen separat genau gebunden sein; produktives init/mail ist im vorhandenen Code geschlossen. Neue Zielproben/Packagerschnittstellen sind erst zu implementierende kleine Werkzeuge, keine schon existierenden oder ausgeführten Befehle.

Vor Ausführung fehlen noch diese konkreten Werte/Belege: zuverlässiger erlaubter Bedien-/Transferweg; Restinventar und Pakettransaktion; exakte Node-/APT-Versionen/Hashes; bestätigter öffentlicher Betreiberschlüssel und sudo-Vertrag; Testgeräte/IPs und ACMEclient/Erneuerung; unabhängiger Sicherungsort/Schlüsselverwahrung; später tatsächliche Datenquelle/-auswahl/-besitzer sowie reale SMTP-/Empfängerfreigabe. Diese Lücken sind Aufgabeninputs, keine als erfolgreich vorausgesetzten Details.

## Freigabegrenze, Rückwege und heutiger Abschluss

Die automatische Freigabeprüfung hatte den breiten H1-Mutationsauftrag abgelehnt, weil dauerhafte SSH-/sudo-/Firewall-/DB-/Proxy-/Dienständerungen nicht mit genauen Einstellungen und Auswirkungen gebunden waren. Diese Ablehnung bleibt wirksam. Kleine Aufgaben ersetzen die genaue technische Bindung und nötige konkrete Freigabe nicht. Nach Entscheidung über diesen Plan zuerst nur die passende begrenzte Vorbereitung, anschließend den fertigen konkreten Ausführungsblock prüfen; keine erneute vage Pauschalfrage als Ersatz für diese Arbeit.

Nach jeder Stufe hält der Aufgabenchat den tatsächlich erreichten Zustand und den nächsten offenen Punkt fest. Verbrauchslimit, UI-/Netzunterbrechung oder automatische Ablehnung bewahrt bestehende Arbeit; kein pauschaler Neustart oder behauptetes Bestehen. Bei Rotationsbedarf nach der allgemeinen Regel kurze Übergabe, alter Writer/Bediener stoppt, genau ein neuer Owner übernimmt denselben erhaltenen Stand; keine Wiederholung fertiger Prüfungen. Erst nach zwei größeren Abschlüssen prüfen, spätestens vor weiterem größeren Auftrag nach drei bzw. ungefähr30 inhaltlichen Runden; tatsächliche Kontextfehler früher. Aktueller HOST-Nachfolger hat bisher C0 abgeschlossen, keine pauschale sofortige Rotation wegen alter Vorgängerarbeit.

Heute wurde ausschließlich dieser Plan erstellt und zentral eingeordnet.17 aktuelle kompakte Chatstände sind gegenüber dem gespeicherten Stand unverändert. Keine Umsetzungsnachricht, neuen Chats/Unteragenten, Modellwechsel, Tests/Builds, Serverbedienung, Installationen, Schlüsselanlage, realen Transfers/Mails/Käufe oder Veröffentlichungen. Die drei vertagten KI-Funktionen bleiben geschlossen; bestehende übrige KI-/Schlüsselwege unverändert.

## Quellen und Belege

Ausgangsstand: [gesicherte Planung](PLANUNG_ZWISCHENSTAND_2026-10-20.md), [Runde34](ARBEITSRUNDE_34.md), [HOST-H1-Einzelentwurf](entwuerfe/HOST-01/H1-KONKRETER-AENDERUNGSPLAN-2026-10-20.md), [C0-Abschluss](entwuerfe/HOST-01/C0-ABSCHLUSS-2026-10-20.md), [Betriebsvorlagen19.10.](../deploy/pilot/README.md), package.json/Lockfile und vorhandene Persistenz-/Auth-/Such-CLIquellen. Alte Abnahmebelege nicht erneut ausgeführt. Uncommitteter Stand165 short-status-Pfade beim Wiederaufnehmen; die Zahl ist kein Releaseinventar.

Offizielle Primärquellen: [Ubuntu OpenSSH: Snippets/Prüfung](https://ubuntu.com/server/docs/how-to/security/openssh-server/), [Ubuntu PostgreSQL](https://ubuntu.com/server/docs/how-to/databases/install-postgresql/), [Node22-Releaseindex](https://nodejs.org/download/release/latest-v22.x/). Zielversionen sind vor Installation zusätzlich tatsächlich zu binden.

Die [nip.io/sslip.io-Dokumentation](https://nip.io/) beschreibt IP-gebundene Hostnamen und individuelle Zertifikate. [Let's Encrypt](https://letsencrypt.org/docs/challenge-types/) bindet HTTP-01 an Port80. Daraus folgt unser Vorschlag eines getrennten Challengepfads; DNS/TLS/Erneuerung dieses VPS sind noch nicht geprüft.

[age](https://github.com/FiloSottile/age) unterstützt explizite Empfänger und getrennte Entschlüsselungsidentitäten sowie Ubuntuinstallation. U12 muss Version, neuen Ausgabepfad, Empfänger und echten Rückholweg fest binden; ein vorhandenes Ausgabeziel darf nicht versehentlich überschrieben werden. Kein Schlüssel oder Sicherungsziel wurde angelegt.

## Start von Niklas: exklusives erstes Fenster U01/U02 – 20.10.2026

Niklas hat nach Planvorlage ausdrücklich „ok starte den umzug“ beauftragt. Die Plan-only-Grenze ist aufgehoben; Runde35 startet nach ihren Abhängigkeiten mit U01/U02. Genau HOST10 übernimmt: U01 ausschließlich öffentliches fehlendes Restinventar in der eigenen Linuxkonsole, U02 lokale Programmliste/Hashes durch einen kurzen Luna-Medium-Unteragenten. Bestehender HOST bleibt Sol mit unveränderter zulässiger Reasoningstufe; High empfohlen. Kein Astra.

Vor Versand festgelegte Writer: HOST allein CONTABO-U01-INVENTAR.md, CONTABO-U02-PROGRAMMSTAND.md und eigener Ergebnisbericht; ein von HOST benannter Luna-Writer allein deploy/pilot/targets/contabo-test/source-manifest.json und bei Bedarf neues scripts/host/contabo-release.mjs. HOST integriert diese Dateien erst nach Ende des Unteragenten. Zentraldateien bei Planung; sämtliche bestehenden Produkt-/Paket-/Schema-/Backup-/Layout-/Kontoquellen, alte Vorlagen/Belege und private Daten read-only. Für die Quellenaufnahme gilt Schreibruhe; übrige16 unverändert ohne neu beobachteten aktiven Writer.

Dieser erste Versand erlaubt keine Installation/APTaktualisierung, Benutzer-/Rechte-/SSH-/sudo-/Firewall-/DB-/Dienständerung, Schlüsselanlage, Archiv-/Programmupload oder echten Bestand/Mail. Bei unzuverlässiger Eingabe nicht blind fortsetzen. C0/alte Tests nicht wiederholen. Nach Ergebnis lesende Übernahme und passender U03-Folgeentwurf; keine Fortsetzung des früher abgelehnten pauschalen H1-Auftrags. Nutzerwunsch zum Umzug ist gespeichert, konkrete reale Quell-/Daten-/Empfängerbindung bleibt gemäß Plan vor ihrer späteren Aktion erforderlich.

## Ergebnis erstes Fenster: U02 angenommen, U01 offen – 20.10.2026

Planung hat [U01](entwuerfe/HOST-01/CONTABO-U01-INVENTAR.md), [U02](entwuerfe/HOST-01/CONTABO-U02-PROGRAMMSTAND.md), eigenen HOST-Ergebnisnachtrag und das Manifest lesend übernommen.551 eindeutige erlaubte reguläre Single-link-Dateien/23.565.221 Bytes, alle551 Bytes/Hashes passend; tatsächliche278 src und genau16 Migrationen001–016 mengenidentisch, notwendige PDF.js-Browser-/Legacyworker-/Lizenz- und Authoperatorbestandteile vorhanden. Lockbindung PDF.js5.4.296/tsx4.23.15/esbuild0.28.2 passend. ManifestSHA256 d2442805889a7c7e4f7d138dcbdda3e203193d083549427ba20c2fc853dd9cdc. Keine Planungstests/-builds/Programmausführung.

Abnahme ausschließlich U02-Quell-/ausgewähltes Assetinventar, keine atomare Sicherung, kein Archiv/vollständige transitive Paketpayload/Linuxrelease. Luna Medium war alleiniger Manifestwriter bis zum Abschluss, HOST integrierte danach. Produkt-/Schema-/Backup-/Paket-/UIquellen und alte Belege erhalten. U02-Schreibruhe beendet; spätere relevante Quellenänderungen bewusst neu binden.

U01 bleibt offen: gespeicherte VNC-Verbindung schlägt ausdrücklich vor Authentifizierung fehl. Endzustand Alle Verbindungen, keine aktuell bedienbare Rootshell; Ursache unbewiesen. HOST hat Niklas direkt um VNC-Aktivierungsstatus/aktuelle Adresse im Panel gebeten, ohne Passwortwert/Reset/Neustart. C0 nicht wiederholen. Vor erlaubtem Wiederzugang keine weitere Server-/Portalaktion und keine U03-Installationsannahme. HOST bleibt alleiniger Owner des offenen U01-Rests; kein neuer Auftrag/Doppelwriter. Die übrigen16 Chats unverändert.

## U01-Teilstand übernommen; U03a begrenzt vorbereitet – 20.10.2026

Rootkonsole wieder erreichbar. Neuester U01-Bericht belegt alle6 Paketstände aus vorhandenen APT-Metadaten: PostgreSQL16/Client16 Kandidat16.15-0ubuntu0.24.04.1, Nginx1.24.0-2ubuntu7.18, drei Hilfspakete bereits installiert=Kandidat. Geplante Stexnutzer/-wurzeln und policy-rc.d ohne Treffer; Standard-PostgreSQLpfade/-Werkzeug nicht gefunden, UFW added rules none/nft-Tabellenabfrage leer. Kein umfassender Leermaschinen-/Firewall-/Metadatenfrischenachweis. Effektive SSHwerte/Matchbedingungen/Dropins und weitere Repository-/Hookgrenzen offen. Sonderzeichenfehler vor Ausführung erkannt, Text entfernt; leerer Rootprompt gesichert. Kein Serverzustand geändert.

Neues begrenztes Fenster U01-Rest + U03a: HOST bleibt einziger Bediener. Er darf nur fehlende öffentliche Metadaten und bei vollständig zuverlässig sichtbarer Eingabe die ausdrückliche No-action-APT-Simulation lesen. Ein neuer kurzer Luna-Medium-Unteragent schreibt ausschließlich deploy/pilot/targets/contabo-test/package-plan.md; HOST schreibt U01-Bericht, neuen CONTABO-U03-PAKETPLAN.md und eigenen Ergebnisnachtrag erst nach Agentenabschluss. Frühere U02-Manifest-/Quellbindung unverändert/read-only, kein neuer Produktwriter.

Simulation exakt mit -s und --assume-no für postgresql-16/postgresql-client-16/nginx und --no-install-recommends; niemals ohne diese sichtbaren No-action-Grenzen absenden. [APT-Primärdokumentation](https://manpages.debian.org/bookworm/apt/apt-get.8.en.html) beschreibt Simulation ohne Systemänderung. Ergebnis ist nur Auflösung auf aktuellem Cache, keine Download-/Frische-/Signatur-/Installationsabnahme. Keine APTaktualisierung/Downloads/Installation, Dienste/SSH/sudo/Firewall/Benutzer/Rechte/Keys oder Uploads. Bei VNC-Eingabeproblem stoppen, keine gesperrte Terminal-App umgehen oder ungefilterte Konfiguration ausgeben. U03a darf offene Sicherheits-/Transaktionslücken benennen statt U01 oder U03 vollständig abzunehmen.

## HOST-Wechsel nach U03a – 20.10.2026

U03a-Bericht/Paketplan sind als lokaler Entwurf mit partieller einmaliger Simulation lesend übernommen; fehlende Aktionssummen/Bedarf/Exitcode sowie SSH-/Repository-/Hookwerte bleiben offen, keine Installationsfreigabe. Planung hat Node22.23.3 und Linux-x64-Prüfsumme an den offiziellen [Release-](https://nodejs.org/en/blog/release/v22.23.3) und [SHA256-Quellen](https://nodejs.org/download/release/v22.23.3/SHASUMS256.txt) verglichen; keine Zielbinärdatei geladen oder ausgeführt. U02-Manifest unverändert, keine551-Dateien-Prüfung wiederholt.

Nach drei substanziellen begrenzten Abschlüssen C0/U02/U03a wurde am sicheren gestoppten Übergabepunkt rotiert. 10 · HOST-01 — Servereinrichtung · Folge (01a158a5-02f3-7c10-977f-845ce4c1bad5) hat bei Cursor15 seine Bedienung beendet; [zentrale kurze Übergabe](HOST_UEBERGABE_U03A_2026-10-20.md) gesichert. Neuer alleiniger HOST ist 10 · HOST-01 — Paketbindung und Serverbasis… (01a1597f-2a14-7a41-aec6-6d8cb6748426), gleiche lokale unveränderte Kopie, ausdrücklich Sol und keine Reasoningumstellung. Lesesetup abgeschlossen; vor konkretem neuen Computerauftrag Archivierungsbestätigung des ruhenden Vorgängers. Keine parallele Bedienung oder Test-/Reviewwiederholung.

Nächster begrenzter Ansatz: maximal zwei ungesendete Zeichenproben mit dokumentierten Tastenfunktionen am frisch angesehenen leeren Rootprompt. Fehlender/zu kurzer Shiftmodifier ist nur eine Hypothese aus den bisherigen Zeichen-/Scrollbeobachtungen. Keine Layout-/Systemänderung. Erst bei visuell verlässlich richtiger Methode fehlende öffentliche Metadaten gezielt lesen; keine zweite Simulation oder APTaktualisierung/Installation/Downloads/Uploads aus der Übergabe.

## Vorgänger archiviert; neuer enger Eingabe-/Leseauftrag vorbereitet – 20.10.2026

Die App hat die Archivierung von HOST-Vorgänger01a158a5-02f3-7c10-977f-845ce4c1bad5 bestätigt. Ausschließlich Nachfolger01a1597f-2a14-7a41-aec6-6d8cb6748426 besitzt die künftige Bedienung. Nächster konkreter Umfang: maximal zwei ungesendete Zeichenproben, bei nachweislich zuverlässiger Methode nur fehlende gefilterte öffentliche SSH-/Repository-/Hookmetadaten; keine weitere Simulation/APTaktualisierung oder Installation. Keine System-/Tastaturlayoutänderung. Neuer HOST allein schreibt CONTABO-U01-EINGABE-REST.md, U01-Fortschreibung/eigenes Ergebnis und nur bei ausreichenden Befunden einen konkreten noch unausgeführten CONTABO-U04A-METADATENPLAN.md. Bestehende Paket-/Quellmanifeste read-only, keine neuen Unteragenten oder alten Reviews/Tests. Stopppunkt bei Eingabeproblem mit genauer restlicher Nutzeraktion.

## Eingabeprüfung ohne Ergebnis; lokale manuelle Probe nötig – 20.10.2026

Neuer alleiniger HOST hat [genau zwei ungesendete Proben](entwuerfe/HOST-01/CONTABO-U01-EINGABE-REST.md) mit dokumentierten pressKey-/typeText-Funktionen durchgeführt. Frisch sichtbare Rootkonsole und eingeschaltete Steuerung, aber kein Markerzeichen, auch keine Buchstaben. Kein Enter/Befehl, keine Layout-/System-/Appänderung. Shift-Hypothese bleibt unbestätigt. Letzter Screenshot zeigt leeren Prompt; verzögerte Übertragung nicht unabhängig ausgeschlossen. Bedienung beendet.

Kleinste aktuelle Nutzeraktion: dieselbe Linux-Konsole lokal anklicken, ohne Enter ein einzelnes a tippen, Sichtbarkeit prüfen und mit Backspace entfernen; melden, ob es erschien und die Zeile wieder leer ist. Bei anderem unerwartetem Text kein Enter. Noch keine weiteren automatisierten Proben oder SSH-/Repository-/Hookabfragen. U01/Installation offen, kein U04a-Metadatenplan erstellt; C0/U02/U03a erhalten, keine alten Tests/Builds/551-Dateien-Aufnahme neu gestartet. Vorgänger archiviert, nur neuer HOST bleibt zuständig.

## SSH-Zugang durch Niklas eingerichtet; App-Verbindung offen – 20.10.2026

Niklas hat im aktiven HOST-Chat den manuellen SSH-Weg gewählt und die Einrichtung selbst ausgeführt. Direkte Entscheidung „denke volles sudo passt“; anschließend Schlüsselanmeldung als stex-ops und passwortloses Voll-sudo laut „läuft alles“/„läuft beides“ bestätigt. Dies sind Nutzerbestätigungen nach konkreten Kopiervorlagen, keine unabhängige Remoteabnahme durch Planung oder HOST. Öffentliche SSH-Ausgabe: Port22, Schlüssel-/Root-/Passwortlogin aktiv; Match-/Dropin-/Repository-/Hookwerte weiter offen. Aktueller Beleg: [HOST-Ergebnis](ergebnisse/HOST-01.md) und [U01-Nachtrag](entwuerfe/HOST-01/CONTABO-U01-INVENTAR.md).

Der frühere manuelle VNC-Zeichentest ist durch diesen neuen Einrichtungsweg als nächster Nutzerschritt abgelöst; VNC-Sonderzeichen bleiben unzuverlässig. HOST hat die eigenständige Codex-Installation unter stex-ops und Geräteanmeldung erklärt und wartet auf Versions-/Login-/Pfadbefund. Installation, Anmeldung und App-Verbindung sind noch nicht bestätigt. Kein neuer Codex-Arbeitsauftrag, kein zweiter Serverbediener, keine Umgehung der Werkzeug-Terminalsperre. Zugangswerte bleiben außerhalb der Berichte. Vor späteren Serveraufträgen zulässigen Nicht-Astra-Modellstand und tatsächliche Arbeitskopie/Verbindung binden. C0/U02/U03a bleiben erhalten; Anwendung, Paketinstallation, Datenumzug, DNS/TLS und Mail bleiben offen.

## Codex auf dem VPS angemeldet; App-Verbindung noch offen – 20.10.2026

Niklas hat im alleinigen HOST-Chat den Loginstatus „Logged in using ChatGPT“ und den gefundenen CLI-Pfad /home/stex-ops/.local/bin/codex am stex-ops-Serverprompt geliefert. Installation, ChatGPT-Anmeldung und Login-Pfad sind damit durch Nutzeroutput belegt; die genaue Versionsnummer fehlt. Keine unabhängige Remoteausführung durch Planung oder HOST, keine Zugangswerte übernommen. [HOST-Ergebnis](ergebnisse/HOST-01.md) und [U01-Nachtrag](entwuerfe/HOST-01/CONTABO-U01-INVENTAR.md) lesend übernommen.

HOST hat Niklas die Einrichtung eines benannten SSH-Zugangs und der App-Verbindung erklärt und wartet auf deren Erfolg oder Fehlermeldung. /home/stex-ops/stex-admin ist als Verwaltungsordner vorgeschlagen, dessen Anlage/Remoteprojekt noch nicht bestätigt. Anwendung und aktueller uncommitteter Stand bleiben lokal; kein Programmtransfer, Linuxbuild, DB-/Proxybetrieb oder Bestandsumzug belegt. Vor einem späteren Remoteauftrag tatsächliche Verbindung, Arbeitskopie, alleinigen Bedienbesitz und ausdrücklich zulässiges Nicht-Astra-Modell binden. Keine zusätzliche Remoteaufgabe/Chatrotation oder Testwiederholung gestartet. Vorherige Schlüssel-/Voll-sudo-Nutzerbestätigung und C0/U02/U03a bleiben erhalten.

## PDF-Downloads jetzt beauftragt: fünf pro Konto und Tag – 20.10.2026

Direkter Nutzerauftrag: PDF-Downloads ermöglichen, höchstens fünf pro Tag; die Zahl und ein Restkontingent sollen nicht in der Oberfläche erscheinen. Umsetzung als begrenzter Unteragentenauftrag PDF-DL1 innerhalb der bestehenden Aufgaben-ID PDF-02, kein zusätzlicher sichtbarer Projektchat. Bestehende Vertagung zusätzlicher Downloadregeln ist für diesen Umfang aufgehoben; Markierungen/Seitenbilder bleiben außerhalb.

Arbeitsannahmen: fünf ausdrückliche Katalog-PDF-Downloads je aktivem Konto und Kalendertag Europe/Berlin, geräte-/sitzungsübergreifend serverseitig atomar und dauerhaft durchgesetzt. Normales Lesen, Beschreibung, HEAD, Seiten-/Rangeabrufe verbrauchen nichts; wiederholte absichtliche Downloads zählen, technische Wiederholung desselben Befehls soll nicht doppelt zählen. Berechtigungen und Widerrufsprüfung bleiben erhalten. Schaltfläche „PDF herunterladen“, keine sichtbare Zahl/Restanzeige; bei Ausschöpfung kurze verständliche Meldung ohne Zahlen. Persönliche Sicherungen/Notizen und bereits bestehende eigene Dokumentexporte erhalten. Keine Veröffentlichung oder Servermigration aus diesem Auftrag.

Exklusiver Writer: ein benannter Sol-Unteragent für PDF-02. Reserviert: src/components/catalog-pdf-viewer.tsx, src/lib/pdf-viewer/contract.ts, src/lib/server/catalog-pdf/**, src/app/api/catalog/pdf/route.ts und neuer src/app/api/catalog/pdf-download/route.ts; bei notwendiger dauerhafter Speicherung ausschließlich neue Migration017_catalog_pdf_downloads.sql sowie src/lib/server/persistence/database.ts und backup.ts. Sicherungsformat/Restore dürfen die Quotenspeicherung nicht unbeabsichtigt umgehen oder persönliche Daten verlieren. Neue gezielte PDF-Downloadtests, gezielt ergänzte PDF-/Backupfälle und docs/ergebnisse/PDF-02.md/docs/entwuerfe/PDF-02/PDF-DL1-*.md beim selben Writer. Weitere gemeinsame Pfade vor Änderung an Planung melden. Zentrale Dateien/Briefing/Registry bleiben bei Planung, andere16 Aufgaben ohne neue Produktaufträge; HOST behält den Serverzugang und Runde35-Umzugsauftrag.

Unteragent prüft tatsächlichen uncommitteten Stand, arbeitet lokal mit künstlichen Konten/PDFs und führt seine notwendigen gezielten Prüfungen selbst aus. Planung übernimmt Ergebnis lesend, wiederholt keine Tests/Builds. Sol High empfohlen, ausdrücklich gpt-6.1-sol; kein Astra, keine weiteren Unteragenten/externen Uploads/KI-Aufrufe/Schlüssel/Installationen/Portal-/Serverzugriffe. U02-Quellmanifest bleibt historisch übernommen; geänderte Quellen vor einem späteren Release gezielt neu binden, alte Aufnahme nicht pauschal wiederholen.

## HOST-01 an verbundenen Serverchat übergeben – 20.10.2026

Der direkte Nutzerauftrag zur weiteren Orchestrierung wurde im lokalen HOST-Originalturn geprüft. Die App bestätigt das Remoteprojekt /home/stex-ops/stex-admin auf stex-contabo. Neuer alleiniger HOST ist 10 · HOST-01 — Servereinrichtung auf… (01a15ad8-ea17-71d0-bae3-b1e7bf127e2f, remote-ssh-discovered:stex-contabo), ausdrücklich Sol. Er hat das reine Prompt-Lesesetup ohne Werkzeuge/Befehle abgeschlossen. Lokaler Vorgänger01a1597f-2a14-7a41-aec6-6d8cb6748426 hat bei Cursor18 Bedienung und Writer beendet; Archivierung durch App bestätigt. [Kurze öffentliche Übergabe](HOST_UEBERGABE_REMOTE_2026-10-20.md) lokal gesichert, keine privaten Zentraldateien oder Zugangswerte übertragen.

Besitz jetzt ausschließlich beim Remote-HOST für das nächste konkret versendete U01-REMOTEREAD-Fenster: tatsächlichen Benutzer/Arbeitsordner/CLIversion/nichtinteraktives sudo und nur fehlende gefilterte SSH-/Match-/Dropin-/APTquellen-/Signatur-/Hookmetadaten lesen. Bericht nur im Remotechat, keine lokalen Produkt-/Schema-/Backupänderungen und keine weiteren Bediener. Noch keine Paketaktualisierung/Simulation/Downloads/Installation/Härtung/Firewall-/Dienst-/DBänderung. Nach lesender Übernahme exakte nächste Metadaten-/Paketstufe binden.

Der Verwaltungsordner ist keine Anwendungskopie. Vollständiger uncommitteter Quellstand bleibt lokal; PDF-DL1-Unteragent /root/pdf_downloads weiter exklusiver lokaler Produktwriter einschließlich reservierter017/Backupintegration. Keine Quellaufnahme/Releasefreigabe während dessen Arbeit, C0/U02/U03a/alte Tests nicht wiederholen. Reale Daten/Mails/Veröffentlichung/Kosten bleiben konkret zu binden. Zentrale Dokumente/Registry weiter ausschließlich lokale Planung.

## Remote-Grundprüfung übernommen; Hook- und Metadatenplan läuft – 20.10.2026

Der neue alleinige Remote-HOST hat U01-REMOTEREAD abgeschlossen; Planung hat tatsächliche öffentliche Kommandoausgaben und den Bericht lesend geprüft. Ausführung auf vmd209708 unter stex-ops in /home/stex-ops/stex-admin, nichtinteraktives sudo UID0 und codex-cli0.163.0 belegt. Geplante Stex-/Standard-PGpfade fehlen, benannte PG-/nginx-/stex-Dienste not-found/inactive. SSH effektiv weiter Root-/Passwortlogin yes; widersprüchliche Cloud-Dropins erkannt, keine Änderung. Öffentliche Ubuntuquellen/Signaturkonfiguration und acht Hookdateien mit SHA belegt. [Lesende Übernahme und genaue Grenzen](HOST_REMOTE_ABNAHME_2026-10-20.md).

Das ist keine vollständige Hook-, verbindungsspezifische SSH-, Metadatenfrische-, Paket- oder Installationsabnahme. Derselbe HOST erhält nun ausschließlich U01-HOOK-PLAN: fehlende sichere Hookwirkungen/Proxy-/SSH-Kontextgrenzen lesen und einen exakten noch unausgeführten befehlslokal gebundenen U04a-Metadatenblock entwerfen. Keine Paketaktualisierung/Simulation/Downloads/Schreib-/Serverkonfigänderung aus diesem Auftrag. Ergebnis im Remotechat; Planung weist erst danach eine konkret geprüfte Mutation zu. PDF-DL1 lokal parallel im zugewiesenen Besitz, kein Release-/Programm-/Bestandsupload und keine neuen Bediener.

## PDF-DL1 lokal übernommen: fünf Downloads, kein sichtbares Kontingent – 20.10.2026

Der ausdrücklich beauftragte Unteragent hat PDF-DL1 abgeschlossen und seine Writer/Testressourcen beendet. Planung hat neuen POST-/Quoten-/Viewer-/Sicherungsvertrag, vier Änderungen gegen den tatsächlichen Beginn, Tests/Protokolle und Browserbild lesend geprüft: zwölf gebundene aktuelle Dateien ohne Hashabweichung, alle sechzehn bisherigen Migrationen unverändert. [Ergebnis](ergebnisse/PDF-02.md), [Vertrag und Belege](entwuerfe/PDF-02/PDF-DL1-VERTRAG.md).

Im Katalogviewer steht „PDF herunterladen“. Serverseitig höchstens fünf neue ausdrückliche Downloadbefehle pro aktivem Konto und Berliner Kalendertag; atomare dauerhafte Tagesplätze, konten-/dokumentgebundene idempotente Wiederholung und bestehende finale Rechteprüfung. Lesen/Seiten-/Range-/HEADabrufe kosten nichts. Keine Zahl/Restanzeige; kurze Limitmeldung blockiert das Weiterlesen nicht. Persönliche Dateien/Notizen/Exporte bleiben erhalten. Neue additive Migration017, vollständige Quittungen in Format4; Restore verlangt weiterhin passenden exakten Migrationsstand und erneuert die Tagesquote nicht.

Gemeldet und in Protokollen nachvollzogen: elf neue gezielte Fälle und neunzehn unmittelbar betroffene PDF-Regressionsfälle bestanden, gezielte Typ-/Lintprüfung ohne Diagnostik. Echter künstlicher Browserdownload bytegleich; Suchsprung, zwei getrennte Downloads, Limitmeldung ohne Zahl und Weiterlesen auf Seite3 geprüft. Restore/echter DB-Neustart/frische Anmeldung erhalten ausgeschöpfte Quote und synthetische private Notizen. Keine Planungstests/-builds oder Servermigration. Lokal macOS/embeddedPostgres und Desktopbrowser; keine Linux-PG16-/iPad-/HTTPS-/Produktionsabnahme. Alte001–016-Format4-Sicherung mit passendem alten Stand restaurieren und danach kontrolliert017 anwenden, kein stiller Cross-Schema-Restore.

PDF-DL1-Dateibesitz nach Abschluss frei, weitere Produktarbeit erst nach neuem konkretem Auftrag. Historisches U02-Manifest unverändert; die acht geänderten/neuen Produktdateien und017 vor späterem Release gezielt neu binden. Der Remote-HOST arbeitet unabhängig weiter an U01-HOOK-PLAN ohne App-/Bestandsübertragung oder Installation. Keine Markierungen/Seitenbilder aus dem Downloadauftrag ableiten.

## U04a erfolgreich; frischer HOST simuliert den Paketumfang – 20.10.2026

Der exakt geprüfte U04a-Block wurde einmal ausgeführt; Planung hat Shellblock und tatsächliche Ausgaben lesend verglichen, SHA139c3a3a identisch. Ubuntuindexabruf mit aktivierter Signatur-/Zeitprüfung, Exit0 und null Warnungen/Fehler; drei Update-Hooklisten nur befehlslokal leer. Keine Pakete installiert oder aktualisiert, keine Dienste/SSH/Firewall/Benutzer/DB verändert. Aktuelle PG16-/Client16-Kandidaten16.15-0ubuntu0.24.04.1 und Nginx1.24.0-2ubuntu7.18; neue CA-/XZ-Kandidaten sind kein Upgradeauftrag. [Gesicherter Abschluss und Übergabe](HOST_UEBERGABE_U04A_2026-10-20.md).

Nach drei abgeschlossenen Aufträgen wurde derselbe HOST-Umfang im selben Remoteprojekt auf den frischen alleinigen Chat 10 · HOST-01 — Paketbindung auf Contabo… (01a15aea-b437-76b0-ba80-25acc6122b46) übertragen. Vorgänger01a15ad8-ea17-71d0-bae3-b1e7bf127e2f hat Bedienung beendet. Trotz technischer Fehlerantwort des Archivierungsaufrufs ist seine Archivierung unabhängig in der Remote-Archivliste bestätigt; die zwischenzeitlich angefragte manuelle Nutzeraktion ist entfallen. Codex-App-Bedienung bleibt für Computer Use gesperrt, kein Umgehungsweg benutzt. Neues Promptsetup ohne Befehle abgeschlossen, ausdrücklich Sol, keine Reasoningumstellung.

Konkreter nächster Auftrag U03B-FRESH-SIM: genau eine neue No-action-Simulation auf der legitimen frischen Indexbasis, -s plus --assume-no, --no-remove/keine Empfehlungen und drei fest gebundene Hauptversionen. Vollständiger Graph/Exitcode/Summen, danach nur lokale exakte Paketkontrollfelder für Versionen/Archiv-/Installed-Size und öffentliche Quellen; keine Downloads/zweite Simulation/Installation oder Startpolitikänderung. Danach stoppen und lesend übernehmen. Historische VNC-Simulation/C0/U02/alte Tests werden nicht wiederholt. PDF-DL1 ist lokal fertig übernommen; Quellneubindung/017 und Linuxprüfung vor späterem Apptransfer bleiben offen. Keine reale Daten-/Dokumentübertragung oder Mailfreigabe.

## Frische Paketbindung übernommen; U03C lädt nur geprüfte Archive – 20.10.2026

Die einmalige neue Simulation gegen die legitim aktualisierte Indexbasis ist vollständig lesend übernommen: Exit0, zehn neue Pakete, keine Upgrades oder Entfernungen, vier nicht aktualisierte Pakete. Quellen-/Keyring-/APT-Konfigbindungen und fehlende Proxyvariablen stimmen. Größen aus exakten lokalen Kontrollfeldern abgeleitet:44.092.982 Byte Archive und172.541KiB installierter Paketinhalt, ohne zusätzlich erzeugte Cluster-/Laufzeitdaten. [Vollständiger Bericht](HOST_U03B_PAKETBINDUNG_2026-10-20.md), [zehn feste Versions-/Größen-/SHA-Bindungen](HOST_U03C_PAKETBINDUNG_2026-10-20.json). Bekanntes bwrap-Vorstartproblem über regulär akzeptierte Werkzeugfreigabe am offenen Punkt gelöst; keine Sandboxkonfiguration verändert und keine zweite Simulation.

Derselbe alleinige frische HOST erhält U03C-PAYLOAD: genau diese zehn authentifizierten normalen Ubuntuarchive als stex-ops in neuen exklusiven Ordner /home/stex-ops/stex-admin/apt-payloads-u03c-20261020 (0700) herunterladen, Soll-Ist-Größen/SHA/Kontrollfelder prüfen und Kontroll-/Maintainerskript-/Template-/Triggerdaten nur streamend lesen. Keine Nutzlast entpacken, Skripte ausführen oder Pakete installieren. Danach exakten noch unausgeführten Installations-/Hook-/Start-/Cluster-/Schlüsselerzeugungsplan berichten und stoppen. Bei Abweichung keine automatische Wiederholung/Reparatur. Keine globalen Paketcache-, Konfig-, SSH-, Firewall-, Dienst-, Benutzer-, DB- oder Schlüsseländerungen; nur neuer Ordner und gebundene Archive erlaubt. Kein App-/Bestands-/Dokumenttransfer.

Vorgänger archiviert und unabhängig per Archivliste bestätigt; Nutzer meldet ebenfalls nur noch den neuen Chat sichtbar. Keine weitere manuelle Archivierungsaktion nötig. PDF-DL1 lokal übernommen/Writer beendet; gezielte Quellneubindung und017 vor späterem Release weiterhin erforderlich. Zentrale Planung führt keine Tests/Builds oder Zielkommandos aus.

## Paketarchive übernommen; genaue Installationspolitik und lokales Quellpaket – 20.10.2026

U03C-PAYLOAD ist lesend übernommen: ein Downloadaufruf mit Exit0, zehn reguläre Archive in neuem privatem Benutzerordner, Soll=Ist44.092.982Byte und alle Versions-/Architektur-/SHA-Bindungen passend. [Abnahme und tatsächlicher Bericht](HOST_U03C_ABNAHME_2026-10-20.md). Noch keine Paketinstallation. Die Skripte können direkt Snakeoil-Schlüssel und einen PostgreSQL-Cluster erzeugen, Verzeichnisrechte ändern sowie Dienste aktivieren/starten; policy-rc.d allein deckt diese Wirkungen nicht ab.

HOST erhält ausschließlich U03D-INSTALLPLAN: bestehende Befunde behalten, die noch offenen Archiv-/Hook-/Start-/Cluster-/Schlüsselwirkungen in einem genauen unausgeführten Gesamtblock lösen und berichten. Keine Installation, Konfig-/Debconf-/Maskänderung, neue Schlüssel oder weiterer Abruf. Nach diesem dritten größeren Abschluss sicheren HOST-Wechsel vor nächster großer Ausführung prüfen.

Parallel ist ein neuer lokaler DATA-Nachfolger derselben ID für U08-SOURCEPACK vorbereitet: drei alte Aufträge beendet, [kurze Übergabe](DATA_UEBERGABE_QUELLPACK_2026-10-20.md), kein Neustart alter Proben. Nach separater Besitzbindung nur neuer Ordner deploy/pilot/targets/contabo-test/source-u08-20261020/ und eigener Bericht; historisches U02-Manifest unverändert, gezielte PDF-DL1-Neubindung, reguläre öffentliche Programmdateien ohne private Daten. Alle Produkt-/Schema-/Backup-/Layout-/Kontodateien read-only. Noch kein Paketierungsauftrag und kein Apptransfer gestartet.

PDF-DL1 bleibt lokal übernommen, Writer beendet; keine Onlineabnahme. Alte HOST-Archivierung ist bestätigt; Niklas sieht nur den neuen Chat. Keine manuelle Archivierung oder Nutzerantwort offen. Planung wiederholt keine Tests/Builds/Zielbefehle.

## Aktiver Dateibesitz für U03D und U08 – 20.10.2026

HOST10 bleibt alleiniger Remotebediener in 10 · HOST-01 — Paketbindung auf Contabo… (01a15aea-b437-76b0-ba80-25acc6122b46), derzeit nur lesender U03D-Installationsplan. U03C-Archive vollständig übernommen; noch keine Installation/Schlüssel-/Cluster-/Dienständerung.

Frischer lokaler DATA02: 02 · DATA-01 — Programmpaket für Contabo (01a15afd-742e-7583-9812-88f0fdc2cfa4). Lesesetup abgeschlossen, ruhender Vorgänger01a14baa-de69-79d0-ba03-4d7db2421fc9 durch App bestätigt archiviert. Nur dessen drei abgeschlossene Aufträge sind der Wechselgrund; keine alten Tests/Proben neu starten. Zentrale Registry enthält den alleinigen Nachfolger und die erhaltene Kette.

| Bereich | Alleiniger Bearbeiter / Grenze |
|---|---|
| Neuer lokaler Ordner deploy/pilot/targets/contabo-test/source-u08-20261020/, Bericht docs/entwuerfe/DATA-01/CONTABO-U08-SOURCEPACK.md, eigener DATA-Ergebnisbericht | DATA02 nach separat versandtem U08-SOURCEPACK-Auftrag; nur Programmpaket, keine Übertragung |
| Historisches U02-Manifest und alle vorhandenen Deploybelege | read-only, keine rückwirkende Änderung |
| Produktquellen, Schema001–017, Sicherung, Layout, Kontoflächen, package.json/Lockfile und öffentliche Buildkonfiguration | Schreibruhe für Paketierung, kein Writer; PDF-DL1 bereits beendet |
| Alle Zielaktionen/-dateien auf VPS | ausschließlich HOST10, U03D aktuell ohne Schreibrecht |
| Zentraldateien, Briefings, CHATS.json und CHATS.md | Planung |

Mechanische Byte-/Mitglied-/Hashprüfung eines neuen lokalen Archivs ist keine neue App-/Linux-/Onlineabnahme. Keine privaten Daten, Dokumente, Konfigurationen, Sicherungen oder macOS-Abhängigkeiten kopieren; kein alter HEAD als Quelle. Unerwartete Quelldrift vor Paketbildung melden und stoppen. Andere15 Aufgaben ohne neue Arbeit; kompakte Stände aller17 geprüft.

## Installationsplan fertig; zwei konkrete Wirkungen vor Start binden – 20.10.2026

U03D ist rein lesend abgeschlossen und [gesichert](HOST_U03D_INSTALLATIONSPLAN_2026-10-20.md). Die zehn Archive bleiben unverändert geprüft; keine Installation. Normaler ssl-cert-Paketlauf erzeugt zwingend ein lokales selbstsigniertes Zertifikat samt privatem Schlüssel und setzt die angegebenen Rechte unter /etc/ssl/private. Das Nginx-Profil aktiviert außerdem den UFW-Profiltrigger. Beides wird vor Ausführung konkret zur Entscheidung gestellt; UFW muss bei später erlaubter Profilaktualisierung deaktiviert bleiben, keine Ports/SSHregeln öffnen. Ein absichtlich offener Triggerzwischenzustand gilt nicht als abgeschlossene Installation.

HOST hat jetzt drei größere Aufträge U03B/U03C/U03D beendet und ist gestoppt. Kurze Planübergabe liegt vor; vor größerer Ausführung regulärer Wechsel derselben ID, keine fertigen Prüfungen/Downloads wiederholen. Nach Entscheidung ist der vollständige konkrete Guard-/Anlage-/Trigger-/Nachkontrollblock vor Start noch lesend zu übernehmen.

Unabhängig arbeitet allein der frische lokale DATA02 an U08-SOURCEPACK mit555 ausdrücklich ausgewählten öffentlichen Programmdateien einschließlich PDF-DL1/017. Historisches Manifest bleibt erhalten, alle Produktdateien read-only. Noch kein Programmtransfer oder Linuxbuild. Keine echte Daten-/Dokument-/Mail-/Veröffentlichungsfreigabe.

## Lokales Programmpaket übernommen; Serverinstallation wartet auf konkrete Entscheidung – 20.10.2026

U08-SOURCEPACK ist fertig und lesend übernommen. [Bericht](entwuerfe/DATA-01/CONTABO-U08-SOURCEPACK.md), [konkretes Quellarchiv](../deploy/pilot/targets/contabo-test/source-u08-20261020/program-source.tar.gz), [Manifest](../deploy/pilot/targets/contabo-test/source-u08-20261020/source-manifest-v2.json).555 reguläre öffentliche Programm-/Assetdateien,23.574.674Quellbytes,6.694.573Archivbytes; ArchivSHA9988df3e98520f7cb38f3e9f05f0b15b7cc519e41bb56b413005bcf6a0e78af9.

DATA meldet vollständige Mitglied-/Byte-/Hashprüfung sowie unveränderte Quellen vor/beim/nach dem Packen. Planung hat fünf Artefakthashes, sichere eindeutige reguläre555-Mitgliederliste gegen Manifest, Paketierer/Belege, acht aktuelle PDF-DL1-Quellhashes,547 unveränderte historische Manifestbindungen und historischen Manifest-SHA lesend geprüft. Keine Abweichung, keine Tests/Builds/Installationen durch Planung. Nur vier geänderte/vier neue PDF-DL1-Pfade neu gebunden,017 enthalten,001–016 unverändert. Writer beendet; lokale Produkt-Schreibruhe aufgehoben, fertiges Artefakt ohne neuen Auftrag unverändert.

Das ist ein vorbereitetes Quellpaket einschließlich PDF-Downloads, keine vollständige Linuxabhängigkeits-/Build-/PG16-/Onlineabnahme und noch nicht übertragen. Keine privaten Daten/Dokumente/Notizen/Konfigurationen/Sicherungen enthalten, keine macOS-native Laufzeitkopie.

HOST-U03D und zehn geprüfte Ubuntuarchive sind ebenfalls abgeschlossen/gesichert. Konkrete Nutzerentscheidung zur lokalen selbstsignierten Testzertifikats-/Schlüsselanlage und Nginx-UFW-Profilaktualisierung angefragt; kein Installationsstart bis Antwort. UFW muss deaktiviert bleiben, keine Ports/SSHregeln ändern. Nach drei HOST-Abschlüssen vor größerer Ausführung kurze reguläre Rotation und vollständigen Schutz-/Trigger-/Vor-/Nachkontrollblock lesend übernehmen. Kein offener Triggerzwischenzustand als fertige Installation, kein pauschaler neuer Generalauftrag.

## Konkrete Paketwirkungen freigegeben – 21.10.2026

Niklas hat die bestehende konkrete Frage mit „Beides erlauben (empfohlen)“ beantwortet: lokale selbstsignierte Testzertifikats-/Schlüsselanlage und normale Nginx-UFW-Profilaktualisierung sind im beschriebenen Paketinstallationsumfang erlaubt. Firewall bleibt deaktiviert; keine Ports oder SSHzugänge ändern, keine öffentliche TLS-/Appfreischaltung. Keine weitere Nutzerantwort hierfür nötig. [Genauer Plan](HOST_U03D_INSTALLATIONSPLAN_2026-10-20.md) und alle zehn Archivbindungen bleiben Grundlage.

HOST ist nach drei beendeten Aufträgen gestoppt; vor größerer Ausführung kurze Rotation derselben ID im verbundenen Remoteprojekt. Danach nur fehlende aktuelle Vorbedingungen und vollständigen konkreten Offline-Guard-/Schutzdatei-/Trigger-/Nachkontrollblock fertigstellen; Planung übernimmt lesend, bevor der alleinige HOST ausführt. Keine alten Downloads/Tests neu starten. Teilfehler stoppen, keine pauschale Reparatur/Purge. Das geprüfte555-Dateien-Programmpaket/PDF-DL1 bleibt unverändert lokal; keine Bestandsdaten-/Dokument-/Mailübertragung oder Veröffentlichung.

## Aktiver HOST-Wechsel nach Freigabe abgeschlossen – 21.10.2026

Alleiniger Remotebediener ist jetzt 10 · HOST-01 — Geschützte Paketinstallation (01a15cea-4c87-71d1-9d1e-02088ccca276), ausdrücklich GPT-6.1 Sol, High empfohlen ohne Reasoningumstellung. Reines Prompt-Lesesetup ohne Werkzeuge abgeschlossen. Vorgänger01a15aea-b437-76b0-ba80-25acc6122b46 ist nach U03B/U03C/U03D gestoppt; Archivierung unabhängig per Remote-Archivliste bestätigt. Keine manuelle Archivierungsaktion nötig. [Kurze aktuelle Übergabe](HOST_UEBERGABE_U04B_2026-10-21.md).

Niklas erlaubt beide konkret angefragten Paketwirkungen. Als erstes folgt nur aktuelle Vorprüfung und vollständiger noch unausgeführter Schutz-/Offline-/Trigger-/Nachkontrollblock für genau die zehn geprüften Archive. Alle Zielpfade/Dienste/Schlüssel/Firewall-/Paketstände bis separater zentraler Übernahme unverändert. Danach führt ausschließlich dieser HOST den schon autorisierten gebundenen Installationsumfang aus; keine neue Nutzergrundsatzfrage. Lokale Quell-/Schema-/Backup-/Layout-/Kontodateien bleiben hier ohne Writer, U08/PDF-DL1 fertig. Kein App-/Bestands-/Dokumenttransfer.

## Geschützte Offlineinstallation konkret gebunden – 21.10.2026

Die aktuelle Vorprüfung ist vollständig übernommen: zehn Archivbindungen passend,69Ziel-/2399Bestands-Abhängigkeitsgruppen erfüllt, keine Paketkonflikte/fremdenPendingTrigger/Nutzlastkollisionen; UFW inaktiv ohne gespeicherte App-Regeln, Schutz-/Ziel-/Schlüsselpfade wie erwartet frei. Eigenes Helper-Pfadproblem rein lesend gelöst, globale Clusterkonfiguration über tatsächlichen Parser nachgewiesen.

[Vollständiger Ausführungsblock](HOST_U04B_AUSFUEHRUNGSBLOCK_2026-10-21.md) lesend geprüft und nur um --abort-after=1 je dpkg-Unteraufruf ergänzt. ExakterPythonbody32.222Byte/SHA2c21e3e800fd0509353042d845efcf9eac53211ff8abdc206cf6afaec54d8503. Ausschließlich alleiniger frischer HOST darf diesen Block einmal ausführen; vorher identischen Bodyhash sicherstellen. Zehn genaue Offlinearchive, exklusive neue Policy/Masken/Clusterdropin, kontrollierter vollständiger Eigentriggerabschluss und echte Vor-/Nachkontrollen.

Die genehmigten lokalen Snakeoil-/Nginx-UFW-Wirkungen sind enthalten; UFW/Regelhashes bleiben unverändert deaktiviert, kein Cluster/Listener/Dienststart. Eigene unveränderte Policy nur nach Erfolg entfernen, vier Masken/Clusterunterdrückung bleiben bis späterer gebundener Aktivierung. Fehler bewahren/stopp, kein Repair/Retry/Purge. Bisher noch keine Ausführung/Erfolgsabnahme behauptet, Planung führt keine Zielkommandos/Tests/Builds aus. U08/PDF-DL1 fertig unverändert lokal, kein Transfer/Bestandsumzug.

## Paketlauf nach Entpacken geschützt angehalten – 21.10.2026

Ein tatsächlicher Ausführungsversuch mit exakt freigegebenem32.222Byte-Body/SHA2c21e3e8. Offline-dpkg-Unpack allerzehnArchive Exit0, allezehnVersionen jetzt install ok unpacked. Anschließend stoppte derProfilmengenguard mit unexpected new UFW profile, GesamtExit1. Keine Paketkonfiguration, Triggerverarbeitung oder Snakeoil-Anlage begonnen; keine vollständigeInstallationsabnahme.

Policy,vierMasken,Clusterdropin bleiben erhalten. Der unmittelbar vor demProfilguard ausgeführte Schutzcheck bestätigt UFW weiterinaktiv/gleicheRegel- undConfighashes,keineCluster/Zielprozesse undunveränderteListener. EigenePendingTrigger libc-bin/ldconfig,man-db/usr/share/man,ufw/etc/ufw/applications.d bewahrt. KeinRetry/Repair/Reconfigure/Purge.

AlleinigerHOST erhält nur lesendegezielteDiagnose der tatsächlichenProfilpfade gegen gebundeneNginxConffile-Payload-/Statusdaten; möglicher .dpkg-new-Zwischenzustand ist Hypothese, nichtAbnahme. Danach kleinsten konkretenFortsetzungsplan aus genau dem belegtenUnpackedzustand vorbereiten, keinenVollrestart oder erneutesEntpacken. Nutzerfreigabe beiderPaketwirkungen bestehtfort; keine neueGeneralfrage. PlanungkeineTests/Builds/Zielkommandos. U08/PDF-DL1 unverändertlokal,keinTransfer.

## Authentifiziertes Installationsstaging geklärt; Konfiguration wird fortgesetzt – 21.10.2026

Die zusätzliche Datei nginx.dpkg-new ist bytegleich mit dem öffentlichen Profil des gebundenen Nginxpakets. dpkg führt sie als newconffile; der Stopp entstand durch einen zu engen Check der normalen Erstinstallationsphase. [Lesende Diagnose und konkrete Fortsetzung](HOST_U04B_FORTSETZUNG_2026-10-21.md) einschließlich Status-/Trigger-SHA, Schutzinodes, unverändertem UFW und aktueller Listenerbindung übernommen. Eine ungültige instanzlose Systemd-Templateabfrage wird durch die belegte gültige masked-Abfrage ersetzt; Masken bleiben bestehen.

Derselbe alleinige HOST setzt ausschließlich die ausstehenden Konfigurationen der bereits entpackten zehn Pakete und ihre eigenen Pendingtrigger fort. Vor Mutation harte Teilzustandsbindungen prüfen, Profilstaging nur in der zugehörigen Phase und mit authentifiziertem Inhalt zulassen. Kein erneutes Entpacken oder pauschaler Reparaturlauf. Nach vollständigen Abschlussprüfungen nur eigene unveränderte Policy entfernen; vier Masken und globale Clusterunterdrückung bleiben. Bei neuem Fehler Zustand bewahren und stoppen.

Niklas hat beide Paketwirkungen bereits freigegeben; keine neue Nutzerantwort nötig. Noch keine fertige Installation oder Onlineabnahme behauptet. U08-Quellpaket und PDF-DL1 bleiben fertig lokal; keine Anwendungs-/Bestandsübertragung, keine Port-/SSH-/Firewallaktivierung. Planung führt keine Zielkommandos, Tests oder Builds aus.

## Zehn Ubuntu-Pakete vollständig installiert und übernommen – 21.10.2026

[U04B-Abschluss](HOST_U04B_ABSCHLUSS_2026-10-21.md) lesend übernommen: alle zehn gebundenen Versionen/Architekturen install ok installed, vollständiger Fortsetzungslauf Exit0, alle fünf tatsächlichen Konfigurations-/Triggeraufrufe Exit0. Abhängigkeiten erfüllt, dpkg-Audit leer, keine Pending-/Awaited-/uninkorporierten Trigger. Andere Paketwerte bleiben erhalten, nur die drei belegten Triggerempfänger sind wieder vollständig abgeschlossen.

Das normale Conffile-Staging wurde gezielt berücksichtigt; kein erneutes Entpacken oder pauschaler Reparaturlauf. Vier administrative Masken und globale Clusterunterdrückung bleiben wirksam; eigene unveränderte Policy nach vollständigem Erfolg entfernt. Keine Cluster, Zielprozesse, aktiven Zieldienste oder neuen Listener. UFW bleibt deaktiviert, alle drei ursprünglichen Regel-/Konfigurationshashes und das OpenSSH-Profil unverändert. Nginx-Endprofil korrekt ohne Stagingrest. Genehmigtes lokales Snakeoil-Paar mit korrekten Rechten angelegt, keine Schlüsselbytes ausgegeben.

Der alleinige HOST hat drei größere Abschlüsse erreicht und ist gestoppt. Vor Node reguläre kurze Übergabe/Rotation derselben ID, keine fertigen Paket-/Browser-/Appprüfungen neu starten. Node22.23.3 ist bisher nur exakt vorgeschlagen und noch nicht heruntergeladen/installiert; dessen Payload und isolierter /opt/stex-Zielvertrag werden als Nächstes separat vorbereitet. U08/PDF-DL1 bleiben geprüft lokal, noch kein Programmtransfer, Linuxbuild, Testziel oder öffentlicher Betrieb/Bestandsumzug. Planung wiederholt keine Tests/Builds oder Zielkommandos.

## Alleiniger HOST für die Node-Laufzeit übernommen – 21.10.2026

10 · HOST-01 — Node-Laufzeit auf Contabo (01a15d08-0547-73a3-9bde-dd98fccc0d84) ist nach reinem Prompt-Lesesetup alleiniger Remote-HOST, ausdrücklich Sol. Vorgänger nach drei Abschlüssen gestoppt und unabhängig per Archivliste bestätigt archiviert. [Aktuelle kurze Übergabe](HOST_UEBERGABE_NODE_2026-10-21.md). U04B/zehn Ubuntu-Pakete bleiben abgeschlossen; keine Wiederholung ihrer Tests/Installations-/Triggerläufe.

Nächster konkreter Auftrag nur U04C-NODE-PLAN: feste Node22.23.3-Linux-x64-Payload und isoliertes neues /opt/stex-Laufzeitlayout anhand vorhandener öffentlicher Werkzeuge/Pfadmetadaten exakt planen. Noch kein Download, Installieren oder globaler Node-/npm-/PATHwechsel. Vorherige Masken/Clusterunterdrückung, inaktive Firewall und unveränderte SSH-/Portkonfiguration bleiben gebunden. Zentrale Dokumente/Registry und lokale Programm-/Schema-/Backup-/Kontodateien ohne HOST-Schreibfenster. Kein Programm-/Bestands-/Dokumenttransfer.

## Feste Node-Payload gebunden – 21.10.2026

[Node-Plan](HOST_U04C_NODE_PLAN_2026-10-21.md) lesend übernommen: benötigte lokale Werkzeuge vorhanden, neue Ziele frei, rund99,65GB verfügbar, keine vorhandene Node-/npm-Datei im geprüften Suchpfad oder unter /usr/bin.

StufeA erlaubt ausschließlich einen strikten HTTPS-GET des festen offiziellen node-v22.23.3-linux-x64.tar.xz in neuen privaten Benutzerordner, maximal64MiB, SHA256df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de. Anschließend begrenzte statische XZ-/Tar-/Symlinkprüfung ohne Extraktion oder Programme. Nur der alleinige HOST schreibt die zwei gebundenen neuen Benutzerobjekte; keine globalen Node-/npm-/PATH-, Dienst-, Schlüssel- oder Firewalländerungen.

StufeB wird erst anhand tatsächlicher Archivstruktur/Linkliste/npm-Version für isoliertes neues /opt/stex gebunden. U04B ist fertig, seine Prüfungen werden nicht wiederholt. U08/PDF-DL1 bleiben fertig lokal; noch kein Programmtransfer, Linuxbuild oder öffentlicher Testbetrieb. Planung führt keine Zielkommandos/Tests/Builds aus.

## Node-Archiv vollständig verifiziert; isolierte Installation gebunden – 21.10.2026

[Payloadbefund und B-Fenster](HOST_U04C_NODE_PAYLOAD_2026-10-21.md) lesend übernommen: ein HTTPS-GET/HTTP200/Exit0,31.001.304Byte mit exakt gebundenem SHA; XZ-/Tarprüfung bestanden.5.866Mitglieder mit4.750Dateien/1.113Verzeichnissen/3internenSymlinks,196.362.450Dateibytes,Node22.23.3/npm10.9.9. Keine Extraktion/Programme inA. Normale Symlinkmode0777 wurde korrekt typbezogen behandelt, alle tatsächlichen Pfad-/Link-/Dateirechtegrenzen gelten.

Nur neue isolierte root-eigene Runtime unter/opt/stex/node-v22.23.3-linux-x64 mit privatemStaging und atomarerNoreplace-Übernahme erlaubt. Alle Inhalte/Objekte/Rechte/Linkziele gegen gebundenesArchiv prüfen; konkrete Node-/npm-Versionsaufrufe alsstex-ops mit ignorierterprivaterKonfiguration und deaktiviertenUpdatenachläufen. Keine globalenNode-/npm-/PATHlinks oder Dienste/Cluster/SSH/Port-/Firewalländerungen, keine neuenDownloads/Pakete/Appstarts/Builds. Fehler bewahren/stopp, keine Wiederholung/Purge.

U04B ist vollständig fertig; U08/PDF-DL1 fertig lokal, noch kein Anwendungsquelltransfer oder öffentlicherPilot. Planung führt keine Tests/Builds/Zielkommandos aus.

## Node installiert; npm-/Endnachweis gezielt offen – 21.10.2026

[Node-B-Teilstand](HOST_U04C_NODE_TEILSTAND_2026-10-21.md): Runtime unter/opt/stex/node-v22.23.3-linux-x64 atomar ohne Überschreiben finalisiert, Staging abwesend. Alle5.866Objekte/196.362.450Dateibytes/Datei-SHA/Rechte/3Linkziele gegen authentifiziertesArchiv passend. Node alsstex-ops meldet v22.23.3/Exit0. Der anschließende isolierte npm-Versionsaufruf scheiterte; tatsächliche Unterprozessausgabe und Schlussinvarianz fehlen noch, eigene Cache blieb bewahrt. Kein vollständigerB-Abschluss.

Gezielt nur den npm-Aufruf diagnostizieren. Bei belegter doppelter Konfigurationspfadladung sind zwei verschiedene neue leere Dateien im eigenen Cache und ein korrigierter Versionsaufruf erlaubt; danach nur bisherigeEndprüfung und eigenerCachecleanup. Keine Runtimeinstallation/Extraktion wiederholen oder private npm-Konfiguration öffnen, keine Downloads/Provideraufrufe. Bei anderer Ursache oder weiterem Fehler Zustand bewahren und stoppen. U04B undU08/PDF-DL1 bleiben abgeschlossen; keine Anwendungs-/Bestandsübertragung. Planung führt keine Tests/Builds/Zielkommandos aus.

## Node vollständig abgenommen; Programmkopie vom Mac steht aus – 21.10.2026

Die zehn gebundenen Ubuntu-Pakete und die isolierte Runtime Node 22.23.3/npm 10.9.9 sind vollständig abgeschlossen. Die Planung hat die tatsächlichen Serverausgaben und den ausgeführten Fortsetzungscode lesend geprüft; keine Tests, Builds oder Serverbefehle hier wiederholt. Die npm-Konfigurationskollision wurde gezielt behoben, Endabgleich und eigener Cachecleanup endeten mit Exit 0. Alle Schutzwerte blieben unverändert. [Node-Abschluss](HOST_U04C_NODE_ABSCHLUSS_2026-10-21.md).

Das öffentliche U08-Programmpaket einschließlich der fertigen PDF-Downloads (maximal fünf pro Konto/Berlin-Kalendertag, ohne Quotenanzeige) ist lokal fertig und geprüft. Der nächste tatsächliche Schritt ist die einmalige Kopie über Niklas’ vorhandenen SSH-Zugang vom Mac: [genaue Kopieranleitung](CONTABO_PROGRAMMUEBERTRAGUNG_2026-10-21.md). Noch keine Übertragung oder Linux-Anwendungs-/Onlineabnahme behaupten. Private Lernunterlagen und Bestandsdaten gehören nicht in dieses Paket.

HOST ist nach drei größeren Abschlüssen gestoppt; keine weiteren Serveraktionen und keine parallelen Bediener. Vor dem nächsten größeren HOST-Auftrag sichere Rotation derselben ID nach [gesicherter Übergabe](HOST_UEBERGABE_QUELLTRANSFER_2026-10-21.md). Nach Nutzerkopie zunächst nur tatsächliche Zielidentität, Dateityp, Rechte, Größe und festen SHA256 prüfen; keine automatische Extraktion, Dienste, Schlüssel oder Veröffentlichung. Die übrigen 16 kompakten Chatstände sind unverändert und inaktiv. Kein neuer oder doppelter Auftrag.

## Programmkopie fehlt tatsächlich; unabhängiger U05-Plan läuft – 21.10.2026

Nach Niklas’ Fortsetzungs-/Statusfrage wurde HOST nach drei abgeschlossenen größeren Aufträgen sicher in denselben Remoteprojektkontext rotiert. Nur der neue aktive HOST laut CHATS.json bedient den Server; der gestoppte Vorgänger ist nachweislich archiviert. Keine fertige Paket-/Runtimeprüfung wiederholt. Der gezielte tatsächliche Dateieingangscheck bestätigt: Das U08-Programmarchiv ist am Server weiterhin **abwesend**, sein Elternpfad entspricht den Vorgaben. [Befund und Übergabe](HOST_U08_EINGANGSSTAND_2026-10-21.md).

Unmittelbar erforderlich bleibt die einmalige [Programmkopie vom Mac](CONTABO_PROGRAMMUEBERTRAGUNG_2026-10-21.md) durch Niklas. Der Serverchat kann den Macpfad nicht lesen. Anschließend nur tatsächlich übertragene Größe/Metadaten/SHA prüfen, bevor ein begrenzter Staging-/Buildauftrag folgt. Keine private Dokument- oder Bestandsübertragung daraus ableiten.

Unabhängig läuft **U05-LAYOUT-PLAN**: allein HOST liest nur die genau benannten öffentlichen Konto-/Pfadmetadaten und darf eine einzige neue öffentliche Datei `/home/stex-ops/stex-admin/u05-layout-plan-20261021.md` exklusiv/0600 anlegen. App-/Builderkonten und `/srv/stex`/`/etc/stex` fehlen tatsächlich noch. Der Plan bindet getrennte nicht privilegierte Identitäten und minimale Traversierungsrechte; er ist noch nicht fertig oder abgenommen. Keine Benutzer-/Verzeichnis-/Rechte-/Schlüssel-/Dienst-/Firewalländerung, kein Build/Test. Zentrale Dateien gehören Planung; Schema001–017, Sicherung, Layout, Kontooberflächen und alle bisherigen Produktdateien bleiben hier ohne neuen Writer.

Planungsschätzung: **1–2 konzentrierte Arbeitstage ab erfolgreicher Programmkopie bis zum ersten geschlossenen HTTPS-Testzugang mit künstlichen Daten**, bei reibungslosem Linuxbuild/-start und den nötigen Zugangs-/Zielprüfungen. Kein fester Live-Termin. Für den eingeladenen Pilot mit echten Daten folgen belegter Restore, konkret gebundener freigegebener Bestandstransfer und Mail-/Pilotumfang. Die übrigen 16 Chatstände sind unverändert und inaktiv; keine doppelten Aufträge oder zusätzliche KI-Funktionsarbeit.

## Programmkopie am Server bestätigt; konkreter U05-Block in Vorbereitung – 21.10.2026

Niklas hat die Kopie bestätigt; HOST hat die tatsächliche Datei anschließend vollständig lesend abgenommen: 6.694.573 Byte, regulär/Singlelink, 1001:1001/0600, stabile Identität/Größe/Zeiten und exakt passender SHA256. [Eingangsbeleg](HOST_U08_DATEIEINGANG_2026-10-21.md). Die bisher nötige Nutzerkopie ist erledigt. Noch keine Extraktion, kein Linuxbuild oder Anwendungs-/Onlinebetrieb.

[U05-Layoutentwurf](HOST_U05_LAYOUT_REVIEW_2026-10-21.md) lesend übernommen; exakte öffentliche Planbelegkopie lokal hashgleich. Alleiniger HOST bereitet nur `/home/stex-ops/stex-admin/u05-layout-guarded-20261021.py` exklusiv/0600 als vollständigen noch nicht ausgeführten Block vor: zwei getrennte nicht privilegierte Systemidentitäten und zwölf neue leere Verzeichnisse, genaue Kollisions-/Identitätsprüfungen und künstlicher Zugriffsnachweis. Systemänderungen erst nach lesender Codeprüfung und konkretem Folgeauftrag. Keine Schlüssel, Dienste, Paketläufe, Quellenextraktion, Builds oder externen Aufrufe daraus. Gemeinsame Produkt-/Schema-/Sicherungs-/Layout-/Kontodateien ohne neuen Writer; zentrale Dateien Planung.

Vorhandene Pakete/Node/PDF-DL1/U08-Paketierung bleiben abgeschlossen. Keine fertigen Prüfungen wegen des Chatwechsels neu starten. Rest bis zum ersten geschlossenen Testzugang: isolierte Einrichtung und Linuxrelease, tatsächliche Test-DB-/Runtimebindung, Zugangshärtung, HTTPS und Zielprüfungen. Der grobe bedingte Planungsrahmen von 1–2 konzentrierten Arbeitstagen ab erfolgreicher Programmkopie bleibt eine Schätzung, keine Terminzusage oder Livefreigabe. Echte Daten, Wiederherstellung und Mail-/Pilotumfang danach konkret binden.

## U05 abgeschlossen; sichere Quelleinrichtung als Builder gestartet – 21.10.2026

Die getrennten Systemidentitäten stex-build900/stex-app901 und alle zwölf Layoutverzeichnisse sind tatsächlich eingerichtet und lesend übernommen. Nach einem Fehler im Traversierungs-Prüfhelfer wurde ausschließlich der offene Zugriffsnachweis gezielt fortgesetzt: beide Eigen-/Fremdzugriffsprüfungen bestanden, drei eigene künstliche Prüffiles entfernt, keine erneute Konto-/Verzeichnisanlage. Schutzvergleich über die erfolgreiche Fortsetzung und historische Listenerbindung passen. Der abgebrochene erste Gesamtabgleich wird nicht als bestanden ausgegeben. [U05-Abschluss](HOST_U05_ABSCHLUSS_2026-10-21.md).

Nach drei größeren Abschlüssen sichere Rotation derselben HOST-ID im selben Remoteprojekt; gestoppter Vorgänger tatsächlich archiviert, nur der aktive Nachfolger in CHATS.json bedient den Server. [Kurze Übergabe](HOST_UEBERGABE_LINUXBAU_2026-10-21.md). Keine fertigen Paket-/Runtime-/U05-Prüfungen wegen des Wechsels wiederholen.

Aktiver begrenzter Folgeauftrag **U08-SOURCE-STAGE**: ausschließlich das bereits am Server hashgeprüfte öffentliche U08-Archiv in den NEUEN privaten Baum `/srv/stex/build/work/u08-20261021/` als UID/GID900 einrichten. Nur Archivkopie0600, sichere Quellenextraktion unter source/0700 und eigener öffentlicher Stagebeleg. Root liest nur die feste Quelle und reicht authentifizierte Bytes weiter; Parser/Anlagen vollständig unprivilegiert. Genau555regulärePfade/23.574.674Dateibyte, keine Links/Spezialpfade, exklusive Anlage und vollständiger abschließender Hash-/Mengennachweis. Bei Abweichung bewahren und stoppen. Noch keine Abhängigkeitsinstallation, kein Linuxbuild oder Anwendungsbetrieb.

Dateibesitz: allein HOST für diesen neuen Builderbaum; bestehende Layout-/Daten-/Config-/Backup-/Releasebäume sowie Produktcode/Schema001–017/Sicherung/Layout/Kontoflächen haben keinen neuen Änderungsauftrag. Zentrale Dokumente Planung. Keine Schlüssel, Dienste, DB, Veröffentlichungen, echten Daten-/Mailtransfers oder Provideraufrufe. Nach tatsächlichem Stageergebnis lesend übernehmen und npm-/Linuxbau gesondert mit passendem Quell-/Lockfile-/Ressourcenvertrag binden. Die Nutzerkopie ist erledigt; dafür kein weiterer Nutzerschritt.

## Quelleinrichtung abgenommen; erster Linuxbau und Laufzeitvertragsentwurf aktiv – 21.10.2026

[U08-SOURCE-STAGE](HOST_U08_SOURCE_STAGE_2026-10-21.md) tatsächlich abgeschlossen und lesend übernommen: alle 555 Dateien/23.574.674 Byte als UID/GID900 im privaten Builderbaum. Code und ungekürzte Ausgabe geprüft; der kanonische Gesamtmanifesthash stimmt unabhängig vollständig mit dem gebundenen öffentlichen Archiv überein. Keine neue Nutzerkopie oder Quellenextraktion nötig.

Alleiniger HOST bearbeitet **U08-LINUX-BUILD**: genau eine npm-ci-Installation einschließlich dev-Abhängigkeiten und nur bei Erfolg ein vorhandener Produktionsbuild im neuen privaten Builderbaum. Genau eine transiente private Bauunit unter UID/GID900, 4GiB RAM/kein Swap, zwei CPU-Kerne, 256 Tasks und 20 Minuten Höchstlaufzeit; saubere Umgebung, eigene neue unterschiedliche leere npm-Konfigurationen und private Logs/Cache. Keine persistenten Dienstdateien, App-/DBstarts, Schlüssel, privaten Konfigurationen, Veröffentlichungen, APT-/globale Paketänderungen oder Provideraufrufe. Keine alten Tests/Builds im Planungschat. Tatsächliche neue Bauvoraussetzungen werden geprüft; noch kein erfolgreicher Linuxbuild behauptet. Ein Konflikt oder fehlende Ressourcen-/Isolierungsfunktion stoppt statt unbeschränktem Fallback.

Unabhängig bereitet ausschließlich DATA einen öffentlichen lokalen **U09-RUNTIME-CONTRACT-DRAFT** vor, Writerpfade nur `docs/entwuerfe/DATA-01/CONTABO-U09-LAUFZEITVERTRAG.md` und eigener Ergebnisnachtrag. Nur tatsächlich implementierte Gates, minimale spätere DB-/Auth-/Sicherungsschlüssel mit Format/Zweck/Pfaden und nötige Konfigurationszuführung/Operatorrechte dokumentieren. Keine Schlüssel-/DBanlage, Produkt-/Schema-/Sicherungs-/Layout-/Kontoänderung, Server-/Netz-/Test-/Buildaktion. Der vorherige Verbrauchslimitfehler trat nach einer lesenden Statusabfrage auf; gewöhnliche Nutzung ist wieder erlaubt, bestehender Solauftrag wird gezielt am offenen Quellvertrag fortgesetzt. Kein Creditkauf, Limitreset oder Modellwechsel; kein Astra.

Gemeinsame Produkt-, Schema001–017-, Sicherungs-, Layout- und Kontodateien haben keinen neuen Writer. Root-Konfiguration bleibt0700/root; konkrete neue Schlüssel und spätere Exponierung/echte Daten/Mail benötigen ihren gesonderten fertigen Umfang. Ein Quell-/Bauerfolg ist noch kein Anwendungs-/HTTPS-/Restore-/Onlinebeleg. Zentralstatus und Abnahme ausschließlich Planung.



## Linuxbau aktiv; Laufzeitvertrag übernommen und künstliche Konten vorbereitet – 21.10.2026

Die einmalige Paketinstallation ist tatsächlich mit Exit0 abgeschlossen: 539 Pakete in81,296s. Der erste Linuxproduktionsbau unter UID/GID900 läuft in der begrenzten transienten Bauunit. Kompilierung und TypeScript sind laut neuer Ausgabe erfolgreich; finale Artefakte und Quelleinhaltung noch nicht abgenommen. Die Bauumgebung enthält bislang keinen `STEX_LEARNING_MODE=account`; vor Releaseübernahme ist die tatsächliche statische Kontoansichtsbindung lesend zu klären. Kein automatischer Neubau oder Neuinstallation.

[DATA-Laufzeitvertrag](entwuerfe/DATA-01/CONTABO-U09-LAUFZEITVERTRAG.md) fertig und anhand der gebundenen öffentlichen Produktions-/Operator-/Migrations-/Layoutverträge lesend übernommen. Sieben unabhängige lokale Schutzwerte bei getrennten DDL-/Runtime-DBrollen vorgeschlagen; noch keine erzeugt oder genehmigt. root0700-Konfiguration kann der privilegierte Dienstmanager an UID901 übergeben. Konkrete Release-/Cluster-/Dienste-/Cachebindung und der Backupzugang zum root0700-Staging bleiben zu planen. DATA-Writer beendet; nach zwei größeren Abschlüssen Rotation geprüft, kein Kontextfehler, vor weiterem Großauftrag erneut prüfen.

Exklusiv für AUTH reserviert: neuer öffentlicher Bericht `docs/entwuerfe/AUTH-01/CONTABO-SYNTHETISCHER-BOOTSTRAP.md` und eigener Ergebnisnachtrag. Nur bestehenden sicheren Produktionsbootstrap für zwei künstliche Konten einschließlich TOTP/Verifikation/Aktivierung ohne echte Mail konkretisieren; fehlende vorhandene Fähigkeit ehrlich benennen. Keine Konten-/Schlüsselanlage, Code-/Schema-/Sicherungs-/Layoutänderung, Tests/Builds/Server-/Netz-/Mailaktion. HOST bleibt alleiniger VPS-Bediener. Sonstige gemeinsame Produktdateien ohne Writer. Bestehende Sol-/Reasoningstufen erhalten; Astra ausgeschlossen.

Vor einer weiteren Zielwirkung konkrete fertige Bindung prüfen; neue lokale Schlüssel brauchen Niklas' gesonderte Freigabe. Vorhandene Umzugsfreigabe bleibt gültig; keine neue generische Freigabe oder Nutzerkopie nötig. Linuxbau ist noch kein App-/HTTPS-/Restore-/Onlinebeleg.


## Erster Linuxbau gestoppt; gezielte Kontomoduskorrektur – 21.10.2026

[Erster Bauversuch](HOST_U08_LINUXBAU_ERSTER_VERSUCH_2026-10-21.md): npm ci erfolgreich, der anschließende Bau endet mit Exit1 beim Prerendern von `/konto/einstellungen` („Kontoeinstellungen fehlen.“). Kein Ressourcenfehler; Peak2,74GiB. package.json/Lockfile/001–017/tsconfig unverändert; nur erlaubte next-env-Typimporte erzeugt. Keine App/Releasefreigabe.

Konkreter Planungsfehler: Im ersten Bauauftrag fehlte `STEX_LEARNING_MODE=account`. Archivquelle und bereits vorhandene Teil-HTML/RSC belegen die fehlende Provider-/falsche Modusbindung. HOST beendet ausschließlich die lesende Diagnose; danach ein begrenzter korrigierter Kontobau mit getrenntem Fehlerbeleg, ohne erneutes npm ci oder Quellfix. Keine automatische Wiederholung oder Lockerung der Ressourcen-/Sicherheitsgrenzen. AUTH bereitet parallel ausschließlich seinen reservierten öffentlichen Bootstrapbericht vor; DATA fertig/Writer beendet. Keine neue Nutzerkopie oder generische Bestätigung nötig. Neue Schutzschlüssel benötigen weiterhin ihre gesonderte konkrete Freigabe.


## Gezielter Kontobau beauftragt – 21.10.2026

Die lesende Modusdiagnose ist abgeschlossen (HOST-Turn01a15e20-5f8c-7d83-aff4-202beafcb752, Cursor14). Ursache und Teil-Artefakte bestätigen `accountMode:false`; kein fehlendes Geheimnis und kein nachgewiesener Produktfixbedarf. HOST erhält genau einen korrigierten U08-LINUX-BUILD-ACCOUNT mit NODE_ENV=production und STEX_LEARNING_MODE=account, OHNE npm-ci-Wiederholung. Alte .next-Ausgabe vorab nur identitätsgebunden als eigener neuer Fehlerbaum erhalten; erste Logs/Receipt/Unit unverändert. Neue eigene transiente Bauunit stex-build-u08-account-20261021, gleiche UID900-/4GiB-/2CPU-/256Task-/20min-Grenzen. Neuer Erfolg erst nach finalen Artefakten/BUILD_ID und tatsächlicher Kontoansichtsbindung; keine App-/DB-/Secret-/Release-/Netzfreigabe. AUTH-Bericht aktiv, DATA-Writer beendet.


## Bootstrapvertrag übernommen; noch keine Kontenanlage – 21.10.2026

[AUTH-Bootstrapvertrag](entwuerfe/AUTH-01/CONTABO-SYNTHETISCHER-BOOTSTRAP.md) fertig und lesend übernommen: 18 gebundene Archivquellhashes passend; vorhandene prepare-admin/Registrierung/Verifikation/TOTP/finish-admin und spätere persönliche Mitgliederaktivierung gelesen. prepare-admin liefert nur nicht geheime IDs/Ablaufzeit, Sicherheitslinks bleiben verschlüsselte Outboxdaten. Produktions-mail/init bleiben gesperrt. Kein belegter Produktfix nötig.

Nächste konkrete Hostplanung muss einen sicheren neuen privaten stdout-Kanal und einen ausschließlich lokalen TLS-/SMTPAUTH-konformen Testposteingang für genau zwei künstliche Adressen binden. Keine Klartext-/Guard-/SQL-/lokale-Mailvorschau-Umgehung und kein externer Versand. Neue lokale SMTPschutz-/Zertifikatswerte dürfen nicht aus der Snakeoil-Freigabe abgeleitet werden. Bestehende sieben DATA-Schutzwerte, genauer Release-/Cluster-/Dienst-/DNS-/HTTPS-/Backupvertrag bleiben vor Ausführung zu binden. AUTH beendet, dritter begrenzter Abschluss im aktuellen Nachfolger; vor größerer Umsetzung Übergabe/Rotation. DATA ebenfalls beendet. HOST führt weiterhin allein den gezielt korrigierten Kontobau aus; lokale Produkt-/Schema-/Sicherungs-/Layout-/Kontodateien ohne Writer.


## Linuxkontobau erfolgreich abgenommen; private Runtimeplanung – 21.10.2026

[Baubeleg](HOST_U08_KONTOBAU_ABNAHME_2026-10-21.json) und tatsächlicher Ausführungscode lesend übernommen: korrigierter Kontobau Exit0, UnitExit0,175,853s, Peak1,44GiB/Swap0. BUILD_ID `5krZ1A-EhTzTzk6hyIbwG`; ReceiptSHA `3c5a983014960cd1ba2e1dcae232030137ad8e58605034b6c6527dad56aa47a2`. Keine Neuinstallation. 314 ursprüngliche Quellen außerhalb ersetzbarer node_modules geprüft,001–017/Lockfile/tsconfig unverändert; keine weitere next-env-Änderung. 18 normale HTML/RSC-Seiten mit accountMode=true; insbesondere /, /konto/einstellungen, /konto und /konto/anmelden final vorgerendert und korrekt gebunden. Alter fehlgeschlagener Bau/Logs bleiben erhalten.

DATA- und AUTH-Verträge fertig/Writer beendet. Alle übrigen14 Aufgaben aktuell kompakt unverändert/completed/notLoaded; keine Doppelaufträge. Keine lokale Produkt-/Schema-/Sicherungs-/Layout-/Kontobearbeitung. HOST bleibt alleiniger VPS-Bediener. Für ihn reserviert: neuer öffentlicher Plan `/home/stex-ops/stex-admin/u09-private-runtime-plan-20261021.md`, ausschließlich Planung/gezielte neue öffentliche Metadaten. Rootverwaltetes Release außerhalb Builder, neue synthetische DB/Rollen, root0700-Konfigurationsübergabe, begrenzte Dienste/Cache/Backupzugang und private TLS-/AUTH-Testpostfachfähigkeit genau binden. Noch keine Anlage/Ausführung dieser Ziele, keine neuen Schlüssel oder Dienste. Konkrete neue Schlüssel brauchen gesonderte Freigabe; echte Daten/Mail und Veröffentlichung bleiben getrennt. Linuxbau ist noch keine Betriebs-/HTTPS-/Restore-/Onlineabnahme.


## Sieben lokale Testschutzwerte ausdrücklich freigegeben – 21.10.2026

Niklas hat die konkrete Frage `call_dc3cab024a264beba32144ee52017904` mit **„Sieben lokale Schutzwerte erlauben“** beantwortet. Umfang ausschließlich Erzeugung und private Ablage der sieben unabhängigen DATA-Werte: Runtime-/Migrations-DBkennwort, BETTER_AUTH_SECRET, STEX_AUTH_MAIL_KEY, STEX_AUTH_BACKUP_KEY und die beiden internen KI-Credential-Cryptowerte. Keine Providerkeys/APIkosten. Vier neue root0600-Dateien `core-secrets.env`, `migrate-db.env`, `backup-secrets.env`, `credential-secrets.env` ausschließlich unter vorhandenem root0700 `/etc/stex/contabo-test/`. Keine Werte in Chat/Bericht/Quellen/Journal.

Diese konkrete Freigabe bleibt gültig und muss nicht erneut erfragt werden. Sie umfasst keine neuen TLS-/SMTP-/Kontoschlüssel, keine App-/DB-/Mailstarts, echten Daten oder Veröffentlichung. HOST beendet zunächst seinen laufenden ausschließlich öffentlichen U09-Plan; noch kein Schlüssel-Ausführungsauftrag gesendet oder Erzeugung behauptet. Nach dessen drittem begrenzten Abschluss sicheren Übergang vor Zielumsetzung beachten. Linuxkontobau ist abgenommen, DATA/AUTH-Verträge fertig, keine lokalen Produktwriter. AUTH vor nächstem größeren Umsetzungsauftrag ebenfalls nach drittem Abschluss rotieren.


## Sicherer HOST-Nachfolger; sieben-Werte-Codevorbereitung – 21.10.2026

U09-Plan mit33105Byte/SHA7ed1a0de0ee7de21d72295b5c2b74088edb5a08898ce6becfeab3abf80a1c5e5 exakt übernommen und ganz gelesen. Sieben-Werte-Teil vollständig konkret; weitere Runtime-/Kopierer-/TLS-/Sink-/Clientdetails bleiben getrennte offene Schritte. Nach drei Abschlüssen ist Vorgänger01a15dc7-21b5-75d0-b6ef-b916fa5da466 gestoppt und tatsächlich archiviert. Frischer alleiniger HOST01a15e40-855d-7192-840d-6fdf951908d5, gpt-6.1-sol, reines Promptsetup bestätigt. [Übergabe](HOST_UEBERGABE_TESTRUNTIME_2026-10-21.md), keine alten Prüfungen neu gestartet.

Nächster enger Block vor übriger Runtime: zunächst nur neuer öffentlicher Standardbibliotheks-Generator und genauer Dispatcher für die sieben bereits ausdrücklich erlaubten Werte vorbereiten, lesend prüfen, danach separat genau diesen Block einmal ausführen. Vier private Dateien im vorhandenen root0700-Verzeichnis brauchen kein Release/DB/Start/TLS; deshalb darf dieser unabhängige Schritt vor der Releasekopie erfolgen. Keine Erweiterung der menschlichen Schlüsselfreigabe. Noch keine privaten Dateien erzeugt, DB/Runtime weiter geschlossen. DATA/AUTH beendet, keine gemeinsamen Produktwriter.


## Sieben Schutzwerte angelegt; geschützte Programmübernahme vorbereiten – 21.10.2026

[Schlüsselabschluss](HOST_U09_SCHLUESSEL_ABSCHLUSS_2026-10-21.md) tatsächlich durchgeführt und lesend übernommen: geprüfter v2-Dispatcher genau einmal, Exit0; vier neue reguläre root0600/Singlelink-Dateien unter bestehendem root0700/etc/stex/contabo-test, sieben unabhängige Werte/Format-/Trennungsprüfung/privater Schreibvergleich bestanden. Keine Werte, URIs, Env oder Geheimdateihashes veröffentlicht. Keine Wiederholung oder weitere Schlüsselfrage für diesen erledigten Umfang.

Linuxkontobau ist ebenfalls abgenommen. Als nächster begrenzter Schritt reserviert ausschließlich HOST den neuen öffentlichen Rootrelease-Kopierer und Dispatcher in /home/stex-ops/stex-admin/u09-release-copy-20261021.py bzw. u09-release-copy-dispatch-20261021.sh.txt. Nur Code vorbereiten/lesend prüfen, noch keine Releasekopie oder private Konfigurationslesung. Zielrahmen/Inventar im geprüften [U09-Plan](HOST_U09_PRIVATER_RUNTIMEPLAN_2026-10-21.md). Vier vorhandene private Dateien erhalten; keine neuen Secrets/DB/Dienste/TLS/SMTP/Konten oder Veröffentlichung. DATA/AUTH beendet, keine gemeinsamen Produkt-/Schema-/Sicherungs-/Layout-/Kontowriter. Die geschlossene Testruntime, Anmeldung, HTTPS und Restore stehen weiterhin aus.

## Releasekopierer gelesen; ursprüngliches Inventarformat gezielt korrigieren – 21.10.2026

Kopierer v1 und Dispatcher vollständig lesend geprüft; beide unverändert und nicht ausgeführt. Der ursprüngliche native Inventurbefehl belegt für denselben Quellenhash die Typwerte `directory`/`symlink` und Dateimodi `0755`/`0644`. Die verkürzte Plan-/Auftragsbeschreibung mit `dir`/`link` bzw. die v1-Modidarstellung `0o755`/`0o644` passen nicht zu dieser Serialisierung. Keine neue Vollinventur erforderlich; die bestehende Hashbindung bleibt bestehen.

Ausschließlich HOST reserviert die neuen öffentlichen Texte `u09-release-copy-v2-20261021.py` und `u09-release-copy-dispatch-v2-20261021.sh.txt` unter `/home/stex-ops/stex-admin/`. Nur diese Formatkorrektur und aktualisierte vollständige Byte-/Identitätsbindung, danach erneute Leseprüfung. Noch keine Releasekopie oder private Konfigurationslesung. Sieben Schutzwerte und Linuxkontobau bleiben abgeschlossen. Andere16 Chats beendet/unverändert; kein zusätzlicher Produkt-/Schema-/Sicherungs-/Layout-/Kontowriter. Geschlossene Runtime, Datenbank, HTTPS, Anmeldung und Restore weiterhin offen.

## Geprüfte v2: einmalige geschützte Programmübernahme – 21.10.2026

v2-Kopierer/Dispatcher vollständig lesend übernommen: nur belegte Inventarserialisierung und neue vollständige Quellbyte-/Identitätsbindung geändert. Quellenhash bleibt unverändert. Ausschließlich HOST erhält einen einmaligen gebundenen Kopierauftrag in das neue rootverwaltete Release `/srv/stex/releases/u09-account-20261021-5krZ1A-EhTzTzk6hyIbwG`, einschließlich neuem leerem Cachemountpunkt und öffentlichem Manifest. Zusätzlich ausschließlich neues root0700-Operatorverzeichnis und öffentlicher root0600-Abschlussbeleg unter `/etc/stex/contabo-test/operator/release-u09-20261021.json`. Keine vorhandenen Dateien überschreiben oder privaten Konfigurationen öffnen.

Code/Dispatchergrenzen bleiben unverändert; tatsächliche vollständige Quellinventur vor erster Zielanlage und vollständige Zielhash-/Rechte-/Linkprüfung vor Erfolg. Bei Fehler eigene Teilobjekte erhalten, kein automatischer Retry/Löschen. Sieben Schutzwerte und Linuxkontobau abgeschlossen; keine Wiederholung. Keine DB-/Dienst-/Netz-/TLS-/Mail-/Konto-/Schlüsselwirkung oder Veröffentlichung. Runtime, HTTPS, Anmeldung und Restore weiter offen. Alle übrigen16 Chats ruhen.

## Geschützte Programmübernahme abgeschlossen; PostgreSQL-Cluster vorbereiten – 21.10.2026

[Native Releasekopie](HOST_U09_RELEASE_ABSCHLUSS_2026-10-21.json) lesend übernommen: genau ein geprüfter v2-Aufruf, Exit0,238,505Sekunden. Vollständiges Quelleninventar vor Zielanlage und abschließende Zielhash-/Mengen-/Rechte-/Linkprüfung bestanden:42.476 unabhängige Dateien,3.851 Payloadunterverzeichnisse,43 interne Links,899.161.836 reguläre Dateibyte. Rootverwaltetes neues Release `/srv/stex/releases/u09-account-20261021-5krZ1A-EhTzTzk6hyIbwG`; zusätzlich neuer leerer Cachemountpunkt/Manifest, neues root0700-Operatorverzeichnis und öffentlicher root0600-Abschlussbeleg. Vier vorhandene private Schutzdateien nicht geöffnet. Keine Runtime-/HTTPS-/Restore-/Onlineabnahme oder Dienste gestartet. Linuxkontobau und sieben Schutzwerte bleiben erledigt.

Nach zwei größeren abgeschlossenen Blöcken Rotation geprüft: keine Kontextfehler; gleicher alleiniger HOST für den nächsten begrenzten bestehenden U09-Block. Ausschließlich HOST bearbeitet die drei neuen öffentlichen Vorbereitungstexte unter `/home/stex-ops/stex-admin/`: `u09-postgres-cluster-20261021.py`, `u09-postgres-service-20261021.service.txt`, `u09-postgres-dispatch-20261021.sh.txt`. Noch kein initdb, kein Unit-/DB-/Rollen-/Schlüssel-/Konfig-/Startzugriff, keine privaten Werte lesen, keine Appmigration. Planung liest die konkreten Texte vor gesondertem Ausführungsauftrag. Andere16 Chats ruhen; kein gemeinsamer Produkt-/Schema-/Sicherungs-/Layout-/Kontowriter.

## PostgreSQL-v1 gelesen; Prozessrechte vor Zielanlage korrigieren – 21.10.2026

Drei vollständige öffentliche PG-v1-Texte bytegenau übernommen und einschließlich vollständiger eingebetteter Helfer-/Unitbytes lesend geprüft, nicht ausgeführt. Der bestehende OS-postgres gehört zu113 und112(ssl-cert). v1 stoppt deshalb bewusst vor jeder Zielanlage. Keine Mitgliedschaften ändern; der spätere Dienst muss prozesslokal ohne Gruppe112 und ohne verbleibende Fähigkeiten laufen. Zusätzlich muss die periodische Größenprobe während PostgreSQL-eigener Umbenennungen/Entfernungen unterscheiden zwischen erlaubten flüchtigen Liveobjekten und dem abschließenden strengen Census im bestätigten Stillstand. Keine atomare256MiB-Quote behaupten.

Ausschließlich gleicher HOST für drei neue öffentliche v2-Texte unter `/home/stex-ops/stex-admin/`: `u09-postgres-cluster-v2-20261021.py`, `u09-postgres-service-v2-20261021.service.txt`, `u09-postgres-dispatch-v2-20261021.sh.txt`. Vorbereitung und Prüfung anhand installierter Originalhandbücher; noch kein initdb, Cluster, Unit-/Dienst-/DB-/Rollen-/Schlüsselzugriff und keine private Konfiglesung. Alte Texte und alle fertigen Release-/Bau-/Schlüsselarbeiten erhalten.

## Verbrauchsunterbrechung am fehlenden PG-v2-Lesebeleg fortsetzen – 21.10.2026

HOST wurde nach tatsächlich abgeschlossener Erzeugung der drei öffentlichen v2-Texte durch ein Verbrauchslimit unterbrochen; kein initdb/Cluster-/Dienststart oder privater Zugriff. Vollständige Textausgaben und Leseabnahme fehlen noch, daher keine Ausführungsfreigabe oder Clusterabnahme. Aktuelle gewöhnliche Nutzung ist wieder erlaubt; weder Zusatzcredits kaufen noch Reset verbrauchen oder Modelle wechseln. Ausschließlich fehlende Volltext-/Metadatenausgabe der vorhandenen drei Dateien fortsetzen, keinerlei Neuerzeugung/Übernahme/Tests/Builds oder andere Serverwirkung. Alle17 Stände geprüft; übrige16 beendet. Neue Fortschrittscursor nach App-Neuladung gespeichert, keine Aufgaben neu gestartet.

## Vorrangige lesende PHP-Betroffenheitsprüfung – 21.10.2026

Niklas hat die Contabo-Sicherheitsmail eingebracht. Beide PHP-Advisories und PHP.net-Hinweis direkt bei den Primärquellen geöffnet/verifiziert; keine Trackinglinks verwendet und keine Mailanweisungen ungeprüft ausgeführt. Anwendung ist Node/Next, dennoch vorhandene Server-PHP-/Web-/Panelkomponenten separat lesend feststellen. HOST alleiniger Bearbeiter; nur neuer öffentlicher Bericht `/home/stex-ops/stex-admin/u09-php-exposure-20261021.md`. Keine Paketänderungen, Restarts, PHP-/phpinfo-Ausführung, Konfigurations-/SSH-/Firewall-/Schlüsselaktion. PG-Code und fertige Arbeit bleiben erhalten.

## PHP-Warnung geprüft; keine passende laufende Angriffsfläche nachgewiesen – 21.10.2026

Offizielle PHP-Advisories und PHP.net-Veröffentlichung direkt verifiziert; Inhalt der Contabo-Warnung insoweit bestätigt. [Native Server-Bestandsaufnahme](HOST_PHP_BETROFFENHEIT_2026-10-21.md) vollständig lesend übernommen: Erhebung19:09CEST, keine PHP-/Apache-/FrankenPHP-/LiteSpeed-/bekannte Panel- oder Containerkomponente in Paket-/Standardpfad-/Unitmetadaten, keine entsprechenden Prozesse bei128Prozessen mit Rootsicht und ohne verweigerte Metadatenzugriffe. Nginx installiert, maskiert/inaktiv. Nur SSH22 und lokales DNS53 lauschen. Aktuell kein konkret adressierbarer PHP-Updatebedarf im geprüften Bestand; unbekannte Sonderpfade/Namespaces/Containerinhalte nicht pauschal mitabgenommen. Keine Updates, Restarts, Konfigurationen, Keys oder private Daten geändert/gelesen.

PG-v2-Volltextausgabe nach Verbrauchsunterbrechung gezielt abgeschlossen, bestehende Dateien unverändert, sämtliche öffentlichen Bytebindungen statisch verglichen. Vor Ausführung noch Unit-Start-CWD/anstellePGDATA für den eingeschränkten !/setpriv-Rootübergang eng korrigieren und neu binden. Nach drittem größeren Vorbereitungsblock sicherer Wechsel desselben HOST-01 vor weiterem Auftrag; Übergabe in HOST_UEBERGABE_POSTGRES_2026-10-21.md. Noch kein Cluster, Runtime-, HTTPS-, Anmelde- oder Restore-Erfolg.

## Alleiniger HOST-Nachfolger für enge PG-v3-Textkorrektur – 21.10.2026

Frischer gleicher Aufgaben-ID HOST-01 ist01a15f74-7788-74d0-ae94-f137a5cae366, Titel„10 · HOST-01 — PostgreSQL auf Contabo“, explizit gpt-6.1-sol. Reines Promptsetup ohne Tools abgeschlossen. Vorgänger01a15e40-855d-7192-840d-6fdf951908d5 ruht und ist erfolgreich archiviert, genaue ID unabhängig in Remote-Archivliste bestätigt. Drei größere Aufträge plus kleine dringende lesende PHP-Prüfung abgeschlossen; keine Tests/Bauten/Schlüssel-/Releaseaktionen wegen Wechsel neu starten.

Ausschließlich Nachfolger erhält drei neue öffentliche v3-Writerpfade unter/home/stex-ops/stex-admin: u09-postgres-cluster-v3-20261021.py, u09-postgres-service-v3-20261021.service.txt, u09-postgres-dispatch-v3-20261021.sh.txt. Nur Unit-Start-CWD auf/und zugehörige vollständige Version-/Byte-/Identitätsbindungen; übrige gelesene v2 unverändert. Danach Leseprüfung vor jeder Ausführung. Keine Cluster-/Unit-/Dienst-/DB-/Rollen-/Secret-/PHP-Aktion.

## PG-v3 gelesen; einmalige begrenzte Cluster-Inbetriebnahme – 21.10.2026

Vollständige v3-Texte und sämtliche eingebetteten Bytes lesend geprüft. Nur UnitStart-CWD/und zugehörige vollständige Versions-/Identitäts-/Bytebindungen geändert. Ausschließlich HOST01a15f74-7788-74d0-ae94-f137a5cae366 erhält genau einen konkreten Inbetriebnahmeblock: neue16/PGDATA,eigeneKonfigs,exakteUnit,eigenerRuntimepfad,öffentlicherBeleg; begrenzterStart/öffentlichePeer-/Prozess-/Gruppen-/Capabilities-/Cgroup-/Sandbox-/HBA-/Loggingprüfung undFaststop. Noch keine AppDB/Rollen/Migration/Kennworteinspielung/private Konfiglesung/Schlüssel/Veröffentlichung. Bei Fehler Teilobjekte erhalten, keine Wiederholung oder Bereinigung. Ergebnis erst nach tatsächlichem nativen Exit und Beleg übernehmen. Fertige Bau-/Release-/Schlüssel-/PHPprüfungen bleiben erledigt.

## PostgreSQL-Grundlage tatsächlich eingerichtet und geprüft – 21.10.2026

[Native Inbetriebnahme](HOST_U09_POSTGRES_ABSCHLUSS_2026-10-21.json) vollständig lesend übernommen: genau eine tatsächliche v3-Payloadausführung, Exit0/oktrue,3,884Sekunden. Vorheriger Sandboxstartfehler und formaler Freigabe-Timeout hatten keinerlei Prozess-/Zielwirkung; ein unveränderter regulärer Freigabeversuch danach erfolgreich. Vollständige Peer-/Loopback-/HBA-/Logging-/Cgroup-/Namespace-/Gruppen-/Capabilityprüfung bestanden, Faststop bestätigt, Unit nicht aktiviert, Port5432 wiederfrei. Drei Systemdatenbanken; KEINE AppDB/Rollen/Migration/Kennworteinspielung oder private Schutzdateilesung. CPU-Verbrauch/Speicherspitze waren nicht verfügbar und werden nicht als gemessen behauptet.

Ausschließlich gleicher HOST bearbeitet als nächsten begrenzten Schritt zwei neue öffentliche Vorbereitungstexte unter/home/stex-ops/stex-admin: u09-appdb-roles-20261021.py und u09-appdb-roles-dispatch-20261021.sh.txt. Nur Code für spätere neue leere AppDB/zwei eingeschränkte Rollen aus bereits erzeugten DBkennwörtern vorbereiten; jetzt keine Geheimdateien öffnen, Rollen/DB anlegen, Dienste starten, Migration oder neue Schlüssel. Danach Leseprüfung vor gesonderter Ausführung. Linuxbau, Release, sieben Werte und PHPprüfung bleiben abgeschlossen. HTTPS/Anmeldung/Restore/Online weiter offen.

## AppDB-Vorbereitung gezielt fortsetzen – 21.10.2026

Die automatische Einzelfreigabe der ersten öffentlichen Vertragslesung endete ohne Prozesswirkung durch Timeout. Die ausdrücklich erlaubte einmalige gleiche Wiederanfrage wurde inzwischen regulär gewährt: Native exec-b4facc42-6d76-4c17-b796-26eed2833cc1 Exit0/55ms; nötige öffentliche Unit-/Pfad-/Clusteridentitäten mit exec-0eb9446b-5aa3-4975-ae6e-a7a81f39378e Exit0 gelesen. Keine private Datei/SQL/Dienstwirkung. Ausschließlich HOST setzt die bereits beauftragte öffentliche Zwei-Text-Vorbereitung fort; Texte noch nicht zur Leseprüfung geliefert. [Beleg und Grenzen](HOST_APPDB_VORBEREITUNG_TECHNIKBLOCK_2026-10-21.md). PostgreSQL-Grundlage, Bau, Release, sieben Schutzwerte und PHPprüfung bleiben abgeschlossen.

## AppDB-V1 bewahrt; enge öffentliche V2-Korrektur – 21.10.2026

Turn01a15fba-d01b-7be1-ad9e-b31c773b3acb/Cursor24 abgeschlossen. Zwei öffentliche V1-Texte erzeugt (35086/50115Byte, SHA3356bf449bf7dfd9106cea9132de4bbec8465fb2b75a45a72cface37ba115885 und60c0b8c91af45a85bb76d757e8e5c0e505ac9da668bd1bdff54eabcda4f22581). Nur Helferbytes0–11999 ausgegeben; folgende öffentliche Teil2-Lesung endete vor Prozessstart durch erneuten formalen Timeout. Kein privater Zugriff/SQL/DB-/Rollen-/Diensteffekt. V1 unvollständig gelesen und nicht ausführungsreif: Fehlerstop kann am Hauptzeitlimit/noch laufendem Kindprozess hängen; Type=exec/active belegt noch keine native PG-Bereitschaft. V1 bewahren, nie ausführen, keine Abnahme behaupten.

Exklusiv gleicher HOST erhält neue öffentliche V2-Pfade `/home/stex-ops/stex-admin/u09-appdb-roles-v2-20261021.py` und `/home/stex-ops/stex-admin/u09-appdb-roles-dispatch-v2-20261021.sh.txt`. Nur diese beiden konkreten Fehler und zugehörige vollständige Bindungen korrigieren; unabhängiger begrenzter Faststop und kurze native Bereitschaft vor jedem Secretzugriff, kein DDL-Retry. Danach vollständige öffentliche Byte-/Textleseprüfung, weiterhin keinerlei tatsächlicher DB-/Rollen-/Dienst-/Privat-/Migration-/Schlüsseleffekt in dieser Vorbereitung. V1-Ausgabe nicht erneut starten, da bereits bekannte Sperrgründe; keine erfolgreiche Prüfung wiederholen.

## AppDB-V2 vollständig gelesen; konkreter Einmalblock – 21.10.2026

Alle öffentlichen V2-Bytes vollständig übernommen: Dispatcher56869Byte/SHAe34d152104e0031088bc87dfb2d3ffa8902c9da4fc20052aeff577e3d7df63d1, eingebetteter Helfer40148Byte/SHA1fede87729c2490ad5d9c0c533a69969dbbafed34e6a45e2551ef38edc7caa9f. Nur fehlende Transportabschnitte gezielt nachgeliefert, keine Tests/Builds ausgeführt. Beide Fehler konkret korrigiert: begrenzte native Bereitschaft vor privaten Lesungen/DDL und unabhängiger Faststop mit getrennten Kindprozessen. [Vollständige statische Prüfung](HOST_APPDB_CODEABNAHME_2026-10-21.md).

Ausschließlich bestehender HOST führt den [exakten Einmalaufruf](HOST_APPDB_EINMALAUFRUF_2026-10-21.sh.txt) nach regulärer Tool-Einzelfreigabe aus: bestehende eigene Unit einmal starten; aktuelle Schutz-/Abwesenheitsprüfungen; nur die zwei bereits genehmigten DBkennwörter aus bestehenden core-/migrate-Dateien über private Pipe verwenden; exakt zwei eingeschränkte LOGIN-Rollen und neue leere AppDB samt engen PUBLIC-/Defaultrechten anlegen; native Profile und Faststop/Portfrei; neuer öffentlicher Beleg. Keine private Ausgabe/Kopie, neue Schlüssel, Migrationen, App-/HTTPS-/Anmelde-/Restoreabnahme, Bestandsübernahme, reale Mail oder Veröffentlichung. Bei Fehler Teilzustand bewahren und stoppen, keine tatsächliche Wiederholung. Vor nativen Belegen noch kein Erfolg angenommen.

## AppDB-V2 vor privaten Lesungen gestoppt; enger V3-Fix – 21.10.2026

Erste tatsächliche V2-Ausführung: Native `exec-32968b12-2171-4ac8-83af-0e0f9be1c416`, Turn `01a15fd0-7ed7-74e0-8db6-2986f96fd172`, Exit1/1430ms, während der nativen Lese-Bereitschaft. psql Exit3; keine DDL versucht oder bestätigt, private Lesephase nicht erreicht, kein Erfolgsbeleg. Faststop ausgeführt und bestätigt, ursprüngliches Kind Exit3/nicht lebend, keine lebenden Cleanupkinder beim letzten Stand. [Tatsächlicher nativer Abbruch](HOST_APPDB_V2_ABBRUCH_2026-10-21.json). Kein AppDB-/Rollen-Erfolg angenommen, kein unveränderter Retry.

Konkreter statischer Fehler im gemeinsam geprüften Text: `SQL_PREFIX` setzt `client_min_messages=panic`. Laut [offizieller PostgreSQL16-Dokumentation](https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-CLIENT-MIN-MESSAGES) ist hier ERROR zulässig, PANIC nicht. Das erklärt den frühen SQL-Fehler plausibel; nativer stderr war bewusst unterdrückt, daher keinen exakten SQLSTATE behauptet. Die Textabnahme dieser Einstellung war fehlerhaft und wird korrigiert. Schutz für Serverlogs, Parameter und stderr bleibt unverändert.

Nur derselbe HOST erhält zwei neue öffentliche V3-Texte: `u09-appdb-roles-v3-20261021.py` und `u09-appdb-roles-dispatch-v3-20261021.sh.txt`. Exakt SQL_PREFIX auf `client_min_messages=error` und zugehörige vollständige Pfad-/Byte-/Identitätsbindungen ändern. Keine weitere Funktions-/SQL-/Rechte-/Dienständerung. V1/V2 bewahren und nie erneut ausführen. Jetzt keine private Datei, SQL-/Diensteffekt, neue Werte oder Tests. Vollständige neue öffentliche Textübernahme vor jeder weiteren Ausführung.

## AppDB-V3 vollständig gelesen; korrigierter Einmalblock – 21.10.2026

Vollständige öffentliche V3-Texte aus zwei ungekürzten Toolausgaben übernommen: Nativeexec-8860abf6-e627-434e-bed1-c21febaab044 undexec-4cf370c5-8e5d-404c-81bc-3017b5d7d5e7, Turn01a15fd2-e218-75a2-842d-5ce78689fbcc, beideExit0. Vollständige Originalbytes eigenständig rekonstruiert: Dispatcher56869/SHA1a32250ded14c0f5b862516bf4ce599ec3550ce1dee51675b13800e94074c9cf, Helfer40148/SHA c350f3a92e250c00feb1422b4030cb0bd3147d91e516566a1f4295f5cefa18d6. Voller Helfer unterscheidet sich exakt einmal durch `SET client_min_messages=panic;` → `SET client_min_messages=error;`; alle weiteren Bytes identisch. Gesamter Dispatcher unterscheidet sich ausschließlich in vollständigem Helferrecord/Identität/Hash und V3-Compilepfad. Keine neue Funktionsprüfung oder Ausführung auf dem Mac.

Der fehlerhafte V2-Lauf bleibt vor privaten Lesungen/DDL sauber gestoppt und wird nicht wiederholt. Nun ausschließlich neuer [konkret korrigierter V3-Einmalaufruf](HOST_APPDB_EINMALAUFRUF_V3_2026-10-21.sh.txt) im alleinigen HOST: exakt derselbe begrenzte leere AppDB-/Zweirollenrahmen mit vorhandenen DBkennwörtern, Prüfungen und Faststop. Keine weitere private Datei, neue Werte, Migration, echter Bestand, Anwendung/HTTPS/Mail/Veröffentlichung. Reguläre konkrete Tool-Einzelfreigabe, bei Fehler stoppen und tatsächlichen Zustand melden. Kein Erfolg vor nativem Beleg.

## Anwendungsdatenbank und zwei Zugänge tatsächlich fertig – 21.10.2026

Der korrigierte V3-Einmalblock ist erfolgreich: Native `exec-8c954759-36f1-47f2-822b-6006c3a52800`, Turn `01a15fd5-9109-7793-bea7-af547e849ff1`, Exit0/oktrue, Helferlaufzeit2,937s. Äußerer Aufruf stimmt exakt mit dem geprüften V3-Einmalbefehl überein. Neuer öffentlicher1479Byte-Beleg mit SHA `c9e7b9824b32bed30a60b16a37c7b9905039b0bbf30935170c3ea94279756a13` vollständig unabhängig geprüft, native Lesung `exec-00e8cd8e-bee9-459b-9544-ac46cf12c8d5` Exit0. [Tatsächlicher Abschluss](HOST_APPDB_ABSCHLUSS_2026-10-21.json).

Neue leere DB `stex_test_20261020`, DDL-Eigentümer `stex_u09_ddl_20261021` und Runtime-Rolle `stex_u09_runtime_20261021`, beide LOGIN/NOINHERIT ohne privilegierte Flags oder Mitgliedschaften. Runtime nur CONNECT/Schema-USAGE, keine CREATE/TEMP/Ownership/DML. Native Profile bestanden: Rollen15→17, Datenbanken4, AppDB7707671Byte, keine Anwendungsrelationen/-funktionen/-typen, nurplpgsql, enge PUBLIC-/Defaultrechte. Faststop und Port5432frei bestätigt, Unit nicht aktiviert. Bestehende zwei DBkennwörter ausschließlich privat wie geprüft verwendet, keine Werte/URIs/privaten Metadaten/-hashes ausgegeben, keine neuen Schlüssel. V1/V2/V3-Rollenhelfer jetzt niemals erneut ausführen; Zielobjekte existieren tatsächlich.

Noch0Migrationen, keine Runtime-DMLgrants und keine Kennwortanmelde-/App-/HTTPS-/Restore-/Onlineabnahme. Die frühere V2-Fehlkonfiguration ist gezielt behoben, ihr Abbruch blieb vor privaten Lesungen/DDL. Keine Erfolgserklärung für fehlende Stufen.

Nach zwei größeren Abschlüssen im frischen HOST (PG-Grundlage und AppDB/Rollen) Wechselregel geprüft: keine belegte Kontextverwechslung, ungefähr13Auftrags-/Korrekturturns, mehrere rein technische Ausgabe-/Freigabefortsetzungen. Gleicher HOST darf als dritten begrenzten größeren Block die explizite Migration des leeren Testziels vorbereiten; nach dessen Abschluss vor weiterem größeren Laufzeitauftrag rotieren. Keine abgeschlossenen Tests/Builds wegen Modell-/Chatwechsel neu starten.

Nächster Schritt ausschließlich öffentliche Vorbereitung im selben HOST, drei neue eigene Textpfade `u09-migrate-20261021.py`, `u09-migrate-service-20261021.service.txt`, `u09-migrate-dispatch-20261021.sh.txt` unter `/home/stex-ops/stex-admin/`. Nur spätere explizite001–017-Migration im versiegelten Release durch UID901/DDL-Vertrag und nativer Schema-/Namens-/Hash-/Leerheitsbeleg; jetzt kein SQL, Dienststart, private Datei oder neue Rechte/Schlüssel. DML-Grants bleiben separater gebundener Folgeschritt. Bestehender AppDB-Beleg ersetzt keine Migration. Danach vollständige öffentliche Leseprüfung vor Ausführung.

## Aktuelle Planung: frischer Kontext · 21.10.2026

Niklas hat einen neuen Planungschat mit weniger Kontext beauftragt. Alleiniger Koordinator ist jetzt `01a15fdd-616f-7c71-9114-75450d0d174c`; Vorgänger `01a1547a-a47c-7863-9126-fb439d54e81d` gibt keine weiteren Aufträge aus und schreibt nach dieser Übergabe keine Zentraldateien mehr. [Kompakte Übergabe](PLANUNG_UEBERGABE_2026-10-21.md) zuerst lesen; aktuelle Zuordnungen/Cursor in CHATS.json, historische lange Abschnitte nur bei Bedarf. Kein Verlauf-Fork, keine Wiederholung erledigter Arbeit.

Tatsächlich fertig: Linuxbau/geschütztes Release/sieben genehmigte Werte, PostgreSQL-Grundlage und leere AppDB/zwei eingeschränkte Rollen. Noch0Migrationen/keineRuntime-/Liveabnahme. Nur HOST `01a15f74-7788-74d0-ae94-f137a5cae366` bleibt im schon aktiven U09-MIGRATE-PREP-Turn `01a15fd9-8c94-7a41-baad-8ace7453ed0c`, Cursor40: drei öffentliche Vorbereitungstexte, keine private Datei/SQL/Dienst-/Migrationsaktion. Nicht doppelt beauftragen, kein Wechsel des Serverbearbeiters. Aktuelle Übergabe und tatsächliche Belege haben Vorrang vor älteren Plan-only-/Einrichtungsabschnitten unten.

Bestehenden Heartbeat ausschließlich auf diesen Nachfolger umhängen; tatsächliche90Minuten-Frequenz, Prompt und übrige Einstellungen erhalten. Technischen Transfer vor Erfolgsaussage prüfen. Bisherige30Minuten-Angaben beschreiben ältere Beauftragung, nicht die aktuell gespeicherte Frequenz. Neuer Planungsowner dokumentiert den verifizierten Transfer und die anschließende Vorgängerarchivierung.



## 22.10.2026 · V2-Migration erfolgreich; Runtimevorbereitung

Alle17 Migrationen erfolgreich ausgeführt und anhand nativer Ausgabe übernommen; exakter ausgeführter Dispatcher stimmt bytegleich mit abgenommenem V2 überein. Direkte Nutzerfreigabe im HOST liegt vor. [Nativer Abschluss](HOST_U09_MIGRATE_V2_ABSCHLUSS_2026-10-22.json): Exit0,6,333s, Generation0, Nutzertabellen leer, Runtime-DDL/DML weiterhin nicht vergeben. Beide Dienste sauber gestoppt/MainPID0/ControlGroups leer; kein automatischer Neustart. Noch keine Runtime-/Browser-/HTTPS-/Restoreabnahme. Nächster alleiniger HOST-Auftrag: knappe konkrete Vorbereitung des unmittelbar nötigen Runtime-/Zugangsblocks anhand vorhandener öffentlicher Vorlagen, keine Dienst-/Rechte-/Proxywirkung und keine Wiederholung fertiger Migrationen. Cursor bba0051c-4a8a-4b51-b5e9-3f4a7c75d0c1:35.


Runtime-Grants22.10.: [vollständige Codeabnahme](HOST_U09_RUNTIME_GRANTS_CODEABNAHME_2026-10-22.md) ohne blockierenden Befund. Konkreter Einmalauftrag wurde vor Prozessstart durch automatische Freigabeprüfung blockiert: dauerhafte Datenbankrechte benötigen direkte Zustimmung im aktuellen HOST; dortiges „ok prüf“ autorisiert nur Prüfung. Keine Dienste gestartet/Rechte verändert. Nötige Nachricht dort: „Ich genehmige den einmaligen geprüften Runtime-Grantjob einschließlich PostgreSQL-Start und anschließendem Stop.“ Kein Retry/Ausweichweg. Parallel nur begrenztes öffentliches App-/Namespace-/Dauerbetriebskonzept; alleiniger HOST besitzt Vorbereitung, keine bestehende Unit/Schema/Proxy-/Kontodatei zur Änderung freigegeben. Aktueller Cursor47.


## 22.10.2026 · Grants fertig; sichere HOST-Rotation/Appvorbereitung

Die Runtime-Rechte sind erfolgreich vergeben: [vollständiger nativer Beleg](HOST_U09_RUNTIME_GRANTS_ABSCHLUSS_2026-10-22.json), ausgeführter Dispatcher bytegleich, Commit bestätigt, Exit 0 nach 1,603 Sekunden. Die Rechte auf 35 Produkttabellen entsprechen der geprüften Liste. Schema, Generation 0 und Datenleerheit blieben unverändert. PostgreSQL ist sauber gestoppt: MainPID 0, ControlGroup leer, keine laufenden Kinder. Die frühere Freigabesperre ist erledigt; den Grantjob nicht erneut starten.

Auch die fünf App-, Launcher-, Bridge- und PG-Vorlagen sind vollständig bytegleich übernommen und [lesend geprüft](HOST_U09_APPVORLAGEN_CODEABNAHME_2026-10-22.md). Noch keine Installation oder Abnahme von App, Bridge, HTTPS und Restore. Nach drei größeren Abschlüssen ist der alleinige HOST regelgerecht auf `01a163db-2cab-7383-8ed7-1a5365869c77` gewechselt, weiterhin gpt-6.1-sol mit High. Der Vorgänger hat sein Bedienungsende bestätigt und ist archiviert. [Sichere Übergabe](HOST_UEBERGABE_APPSTART_2026-10-22.md).

Nächster begrenzter Auftrag: nur den öffentlichen Installer mit begrenztem App-/Bridge-Start und anschließendem Stop vorbereiten. Noch keine Ausführung. Der bestehende PG-Vertrag mit 180 Sekunden bleibt wirksam; den Dauerbetriebs-Drop-in noch nicht installieren. Keine Wiederholung von Builds, Migrationen oder Grants. Keine privaten Lesungen, neuen Werte, Proxy-, Zertifikats-, Netz- oder Bestandsänderungen. Planung besitzt die Zentraldateien, der neue HOST allein die zwei öffentlichen Vorbereitungstexte. Ziel bleibt der direkte geschützte HTTPS-Browserzugang; noch gibt es keinen Testlink.


## 22.10.2026 · App-/Bridge-Lauf geprüft, direkte Freigabe erforderlich

Appstart: Der [vollständige Installer und Dispatcher sind lesend geprüft](HOST_U09_APP_BRIDGE_INSTALL_CODEABNAHME_2026-10-22.md), bytegleiche öffentliche Kopien sind gesichert. Der konkrete Einmalauftrag wurde vor Prozessstart von der automatischen Freigabeprüfung abgelehnt: Für die eigenen Root-Installationen und Dienststarts fehlt eine direkte konkrete Nutzernachricht im ausführenden Chat. Es wurde nichts installiert oder gestartet; kein Wiederholungsversuch und kein Ausweichweg. Aktueller HOST: **10 · HOST-01 — Appstart und Browserzugang**, ID `01a163db-2cab-7383-8ed7-1a5365869c77`, Cursor `304d9d2f-fcea-433b-a48e-048d0535b5a5:7`.

Nötige direkte Freigabe dort: einmalige geprüfte App-/Launcher-/Bridge-/Cache-/Ingress-Installation, ein privater PG-/App-/Bridge-Start, genau eine UID33-HEAD-Anfrage und unabhängige Stops unter 170 Sekunden; bei Fehler kein Retry. Der bestehende PG-Vertrag mit 180 Sekunden bleibt unverändert. HTTPS, öffentliche Ports, neue Schlüssel, Bestandsdaten, Mail und Dauerbetrieb gehören nicht zu diesem Lauf.

Erledigt bleiben Release, sieben Schutzwerte, Cluster/Rollen/DB, alle 17 Migrationen und die gezielten Runtime-Rechte. Native Abschlussbelege sind vollständig übernommen; keine Wiederholung. App, Browserzugang, HTTPS und Restore sind weiterhin nicht abgenommen. Alleiniger HOST besitzt die vorbereiteten öffentlichen Texte, Planung die Zentraldateien; vorhandener uncommitteter Stand erhalten.


## 22.10.2026 · Erste HTTP200-Antwort; Stopabnahme offen

Die App ist erstmals auf dem Server erreichbar gewesen: Eine interne HEAD-Anfrage als UID33 über den Unixsocket lieferte **HTTP200**. App und Bridge liefen als901 im abgeschotteten PG-Netz. UID-/Capability-/Namespace-/Loopback-/RO-/RW-/Cache-/Dateiwurzelprüfungen bestanden. [Vollständiger nativer Teilabschluss](HOST_U09_APP_BRIDGE_TEILABSCHLUSS_2026-10-22.json). Ausgeführter Dispatcher-Programmtext entspricht der abgenommenen V2; nur ein Kommentar und das letzte Newline fehlen.

Die Gesamtabnahme ist nicht bestanden: Nach SIGINT meldete die App Exit130 und systemd failed; die Bridge wurde mit SIGINT beendet und systemd Resultsuccess, der Manager hatte ausschließlich Exit0 erwartet. PostgreSQL beendet mit Exit0. **Alle Prozesse und Cgroups sind beendet, Host-/private TCP- und Unixlistener geschlossen**, Lauf8,911s. Installierte eigene Units/Launcher/Cache/Ingress bleiben erhalten. Keine erneute Ausführung des exklusiven Installers. Bestehender PG180s-Vertrag unverändert; kein dauerhafter Betrieb oder HTTPS-/Auth-/Restore-Erfolg angenommen.

Nächster begrenzter Auftrag im alleinigen HOST `01a163db-2cab-7383-8ed7-1a5365869c77`: genaue öffentliche Next-Shutdownhandler und vorhandenes Proxyhandbuch lesen, daraus minimale eigene Stopvorlagen vorbereiten. Keine Starts, tatsächlichen Unitänderungen, privaten Lesungen oder neuen Werte. Den Exit130 nicht ohne fachlichen Beleg als Erfolg umetikettieren. Migrationen/Grants/Release bleiben fertig, keine Wiederholung. Noch kein Browser-Testlink.


## 22.10.2026 · Dokumentierter Next-Exit und minimale Wiederaufnahme

Stopdiagnose abgeschlossen: Im tatsächlich gebundenen Next-Release führt SIGINT erst den regulären Cleanup aus und beendet danach ausdrücklich mit130. Die einzige nötige Appvorlage setzt deshalb SuccessExitStatus=130; Signal/Timeout bleiben. [Quellbelege und Leseabnahme](HOST_U09_APP_STOP_CODEABNAHME_2026-10-22.md). Für die Bridge ist keine Unitänderung nötig; ihr vorhandenes Resultsuccess bei SIGINT wird künftig getrennt vom normalen Exit bewertet. Das ersetzt nicht die tatsächlichen Prozess-/Cgroup-/Listenerbelege.

Der alleinige HOST bereitet jetzt nur einen begrenzten Wiederaufnahmehelfer vor: bereits installierte eigene Objekte strikt erhalten, neuer eigener Stopdropin und aktualisierte öffentliche App-Namespacekoordinaten, gleicher privater Start/HTTPHEAD/Stoprahmen. Noch keine Ausführung oder endgültige Stopabnahme. Kein erneuter exklusiver Installer, keine zusätzlichen Runtimegrants/Migrationen/Keys/öffentlichen Ports/HTTPS-/Proxyänderungen. Der frühere HTTP200-Teilerfolg bleibt bestehen; kein Browser-Testlink.


## 22.10.2026 · Wiederaufnahme geprüft; direkte Freigabe noch nötig

Der [vollständig geprüfte Wiederaufnahmejob](HOST_U09_APP_BRIDGE_RESUME_CODEABNAHME_2026-10-22.md) wurde vor Prozessstart durch die automatische Freigabeprüfung blockiert. Sie verlangt im ausführenden HOST eine direkte Nutzerzustimmung für den neuen dauerhaften App-Stopdropin SuccessExitStatus130 und die Änderung der vier öffentlichen Namespacezahlen in der installierten Appunit. Frühere ja/fix-Zustimmung wird für diesen konkreten neuen Umfang nicht anerkannt. Keine Datei geändert, keine Dienste gestartet, kein Ausweichweg.

Nötige direkte Freigabe in **10 · HOST-01 — Appstart und Browserzugang** (`01a163db-2cab-7383-8ed7-1a5365869c77`): einmal den geprüften Stopdropin anlegen, vier Namespacezahlen aktualisieren, einen privaten PG-/App-/Bridge-Lauf mit interner HEAD-Anfrage und unabhängigen Stops unter170Sekunden durchführen. Bei Fehler kein Retry. Danach sind tatsächliche native Belege nötig.

Der frühere HTTP200-Teilerfolg und alle bestätigten Prozesse-/Listenerstops bleiben bestehen. Noch kein dauerhafter App- oder Browserzugang. Unabhängig nur konkreten öffentlichen HTTPS-Plan vorbereiten: feste Origin/DNS/Zertifikatsclient/engste Port- und Proxyänderungen, keine Ausführung, neuen Werte, öffentlichen Listener oder Veröffentlichung. Bestehende Migrationen/Grants/Release nicht wiederholen.


## 22.10.2026 · Öffentlicher HTTPS-Plan übernommen

Öffentlicher HTTPS-Plan vollständig lesend übernommen: [Plan](HOST_U09_HTTPS_PUBLIC_PLAN_2026-10-22.md). Native DNS-Antwort passt zur VPS-IP, kein AAAA-Eintrag. Certbot ist nicht installiert; lokaler Kandidat2.9.0-1, Abhängigkeiten/Payloads noch nicht gebunden. Keine Zertifikats-/ACME-Schlüssel oder Bestellung, kein öffentlicher Listener. Als nächstes nur zwei öffentliche geschlossene Proxyvorlagen mit ausdrücklich offenem Betreiber-CIDR und zukünftigen Zertifikatspfaden; keine Installation/Tests/Netzänderung. Resume-Freigabesperre unverändert, noch keine neue unmittelbare Nutzeraktion.


## 22.10.2026 · Proxyprüfung und konkrete Verbindung

Proxyvorlagen vollständig gelesen; vor Abnahme eng begrenzte Korrektur der bestehenden PDF-/Katalog-Uploadgrößen und Route-Timeouts beauftragt. Sonst würde Nginx standardmäßig1MiB begrenzen. Die aktuelle öffentliche IPv4 des lokalen Nutzerrechners ist rein lesend ermittelt und validiert; geplantes enges /32-Ziel für diese Verbindung in CHATS.json, kein erneutes Abfragen nötig. Aktivierung erfordert frischen Verbindungsabgleich und die weiterhin fehlenden TLS-/Dauerbetriebsbelege. Keine Installation/Tests/öffentlichen Listener. Der bereits geprüfte private Wiederanlauf wartet unverändert auf direkte Freigabe im ausführenden HOST.


## Direkte Nutzerkorrektur · schnellster erster Browserzugang

**Direkte Nutzerkorrektur: endlich online, keine weiteren isolierten Prüfrunden.** Die bisherige kleinteilige Folge von Helfer-/Abnahme-/Freigabeaufträgen ist projektspezifisch und hat den ersten Browserzugang verzögert. Bestehende Erfolge verwenden: Release/DB/17Migrationen/Runtimegrants und tatsächlicher interner HTTP200-Teilerfolg. Noch offen: dauerhafter App-/PG-/Bridgebetrieb, vertrauenswürdiges HTTPS und konkreter nutzbarer Einladungs-/Loginweg. Der bisherige einmalige Wiederanlauf ist weiterhin durch automatische Freigabeprüfung gesperrt; keine Umgehung und keine neue isolierte Ausführung daraus ableiten. Alleiniger HOST fasst jetzt nur die zwingenden Restarbeiten und konkreten Freigaben zu einem zusammenhängenden ersten Inbetriebnahmeumfang zusammen. Keine neue Datei-/Test-/Build-/Paket-/Forschungsspur in diesem Schritt.


## 22.10.2026 · Eine konkrete gebündelte Onlinefreigabe

**Zusammenhängende Inbetriebnahme statt weiterer Kurztest-Runden.** Niklas hat allgemein „ok, durchführen“ beauftragt. Die automatische Freigabeprüfung hat jedoch bereits die Auftragsübergabe vor Zustellung abgelehnt: Die hinterlegten Regeln verlangen eine gesonderte konkrete Zustimmung für neue ACME-/TLS-Schlüssel, Zertifikatsbestellung und Veröffentlichung sowie dauerhaften Betrieb mit Ports80/443. Kein Ausweichweg, keine Installation/Starts/Keys/Bestellung/Veröffentlichung erfolgt.

Jetzt steht im geöffneten **10 · HOST-01 — Appstart und Browserzugang** (`01a163db-2cab-7383-8ed7-1a5365869c77`) eine einzige direkte gebündelte Freigabefrage: dauerhafter App-/PG-/Bridgebetrieb, benötigte Certbot-Pakete, neues geschütztes ACME-Konto/AGB und TLS-Zertifikat für feste Origin,80 nurChallenge, eigener443-Proxy nur für frisch bestätigte Betreiberverbindung, Weiterbetrieb und erforderliche Erneuerung dieses Zertifikats. Frage-IDcall_fef7c3d3039047869bfd354fcf2d0357. Ausgeschlossen Käufe/paidKI/Bestandsmigration/Dokumentuploads/echteMail. Erst ausdrückliche direkte Antwort genehmigt diesen Umfang.

Vorhandene Proxykonfiguration samt Uploadgrenzen und aktueller /32-Verbindung ist [vollständig lesend geprüft](HOST_U09_HTTPS_PROXY_CODEABNAHME_2026-10-22.md). Release/DB/Migrationen/Grants/HTTP200 bleiben erledigt; keine Wiederholung. Für tatsächlichen Kontozugang fehlen noch Empfängeradresse und Versandkonfiguration, beim Nutzer parallel angefragt. Lokale .env.local hat keine SMTPwerte; nur deren Vorhandensein geprüft, keine Werte ausgegeben. Aktuell weiterhin kein dauerhafter Browserzugang.


## 22.10.2026 · Konkrete gebündelte Freigabe erhalten; Umsetzung aktiv

**Die gebündelte direkte Freigabe liegt jetzt nachweislich vor.** Niklas hat im ausführenden HOST auf Fragecall_fef7c3d3039047869bfd354fcf2d0357 mit „Ja, ich genehmige ausdrücklich genau diesen Umfang.“ geantwortet (Nutzerbeleg01a16486-72bc-79f2-9a4c-bc9473605e6e, Turn01a16486-7245-7c53-94a8-0bb79dba6311). Die bisherige Freigabesperre ist damit für diesen exakt benannten Umfang erledigt; nicht erneut fragen.

Alleiniger HOST `01a163db-2cab-7383-8ed7-1a5365869c77` setzt die zusammenhängende Inbetriebnahme bereits um: dauerhafter App-/PG-/Bridgebetrieb mit eigenem Stopvertrag und richtigen Namespacezahlen, notwendige kostenfreie Certbot-Pakete, geschütztes ACME-Konto ohne Kontaktmail/AGB und unabhängiger TLS-Key mit öffentlich sichtbarem Zertifikat für die feste Origin,80 nur zeitweiseChallenge, eigener443-Proxy nur für die frisch bestätigte Betreiberverbindung sowie nötige Erneuerung dieses Zertifikats. Normale Toolprüfungen bleiben; bestehende sieben Werte/Masken/Daten erhalten. Kein doppelter Folgeauftrag und kein neuer Kurztestzyklus.

Noch keine neuen nativen Fertig-/Livebelege; keine vorweggenommene Installation, Zertifikatsausstellung oder Erreichbarkeit behaupten. Release/DB/Migrationen/Grants/HTTP200 bleiben erledigt. Käufe, bezahlteKI, Bestandsmigration, Dokumentuploads und reale Mail sind ausdrücklich ausgeschlossen. Empfängeradresse und Versandkonfiguration für tatsächlichen Login bleiben beim Nutzer separat angefragt. Aktueller Fortschrittscursor33; keine zusätzliche Nutzeraktion im jetzigen Check.


## 22.10.2026 · HTTPS erreicht; Originaloberfläche nicht erfüllt; Mail offen

**Der Server ist inzwischen über HTTPS erreichbar:** https://stex.62-171-162-115.sslip.io. [Native Betriebsbelege](HOST_U09_ONLINE_STATUS_2026-10-22.json): dauerhafter App-/PG-/Bridgebetrieb aktiv, eigener ProxyUID33 auf443, TLS1.3 mit geprüftem Zertifikat, Schlüsselpassung/Domain/Gültigkeit bestätigt; Port80 geschlossen. Zugriff nur für bestätigte Betreiberverbindung78.120.243.206/32; Nutzer hat im Serverchat die sichtbare STEX-Seite bestätigt. Die frühere gebündelte Freigabe ist erfüllt und bleibt gültig. Nicht erneut fragen oder bereits abgeschlossene Installation/Schlüssel/Migrationen/Grants/Builds wiederholen. Automatische Zertifikatserneuerung ist noch offen.

**Die Anwendung ist fachlich noch nicht abgenommen.** Niklas meldet abweichendes Design und Bugs und hat im HOST ausdrücklich „erstmal Analyse“ verlangt. Ursache: aktivierte Kontotestansicht ersetzt bisherige Navigation/Dashboard/Onboarding/Themes und mehrere Funktionen durch andere oder unvollständige Kontoansichten. Kein fehlender CSS-/JS-Transfer:26eingebundeneAssets erfolgreich. HOST hat281Archivquellen mitServer verglichen, alle gleich. Planung hat ergänzend [aktuellen lokalenSrc gegen dasselbe Archiv verglichen](HOST_U09_LOKAL_ARCHIV_QUELLVERGLEICH_2026-10-22.json): ebenfalls281Dateien, keineAbweichung/fehlenden/neuenDateien. Originalcode ist erhalten; bloßes Abschalten von Konto-/Produktionsschutz ist keine freigegebene Lösung. Noch keine UI-/Funktionsänderung nach dieser Analyse.

Mail: direkte Empfängerangabe niklashauser@gmail.com, noch kein Versandkonto eingerichtet. Gmail wurde als erste Option besprochen, Nutzer fragt nach Sicherheit und hat es nicht ausgewählt. Empfehlung ist getrenntes Versandsystem mit auf Versand begrenztem Zugang; noch kein Anbieter gewählt, kein Konto/Schlüssel angelegt, keine reale Mail versandt. Tatsächlicher Login/Verifikation/Adminabschluss weiterhin offen. Änderungen an Oberfläche zuerst anhand der Nutzeranalyse-Anforderung planen, bestehende Schutzwerte/Daten/Kalenderbezüge bewahren.


## 22.10.2026 · Begrenzter Restauftrag Zertifikatserneuerung

HOST ist nach Cursor34 unverändert und untätig. Nur der bereits ausdrücklich genehmigte offene Hostingrest wird fortgesetzt: automatische Erneuerung des vorhandenen Zertifikats für die feste Origin. Alleiniger Bearbeiter bleibt HOST; neue eigene Erneuerungsdateien und eng erforderliche eigene ACME-/Challenge-/Proxybehandlung sind ihm zugeordnet. App/PG/Bridge, Schema/Migrationen, Sicherung, Layout und Kontooberflächen haben keinen Writer. Zentraldateien bleiben bei Planung. Kein erzwungenes neues Zertifikat, keine erneuten Builds/Migrationen/Live-Prüfzyklen. Oberfläche bleibt gemäß Nutzerkorrektur zunächst unverändert; Gmail ist nicht gewählt und reale Mail weiter ausgeschlossen. Modell gpt-6.1-sol/High beibehalten, kein Astra. Nach diesem kleinen Rest vor größerem Neuauftrag Wechselregel erneut anwenden.


## 22.10.2026 · Persönliche Testeinladung beauftragt, Absender fehlt

Direkter Auftrag: Einladung an chips-eiweiss.2k@icloud.com; diese Adresse ersetzt den bisherigen Empfänger für den persönlichen Test. Reale Zustellung genau dieser Einladung ist jetzt autorisiert. Ein eingerichteter Versanddienst mit zulässigem Absender und privaten Zugangsdaten fehlt weiterhin. Vorhandene Produktions-CLI gibt nur IDs/Ablaufzeit aus und sperrt die lokale Mailvorschau; ein fertiger sicherer manueller Linkweg ist nicht vorhanden. Keine Kontenanlage, Mailzustellung, neue Provider-/Schlüsselanlage oder Schutzumgehung ausgeführt. Kein weiterer HOST-Auftrag für den bereits bekannten Konfigurationsblocker.


## Aktuell: persönlicher Test ohne Mailversand · 22.10.2026

Niklas hat den direkten Einladungs-/Bestätigungsweg mit „ok letsgo“ genehmigt, ausschließlich für chips-eiweiss.2k@icloud.com. Neuer alleiniger HOST `01a1652f-88d5-72c3-b32e-ecb8f2d74a03` implementiert einen eng gebundenen privaten Operatorweg außerhalb des bestehenden Releases. Passwort setzt der Nutzer selbst im Browser; reguläre Einmalnachweise, Registrierung und Aktivierung bleiben erforderlich. Kein SMTP, keine tatsächliche Mailzustellung oder behauptete Postfachkontrolle, keine öffentliche Outbox, keine direkte Änderung von Verifikations-/Rollenflags. Bisher noch kein tatsächlicher Einladungslink erzeugt oder ausgegeben. Oberflächenkorrekturen bleiben im Analysezustand.

Vorgänger nach Abschluss und Idle archiviert; gleiche Aufgaben-ID und Remoteprojekt, kein zweiter Serverbearbeiter. [Kompakte Übergabe](HOST_UEBERGABE_DIREKTEINLADUNG_2026-10-22.md). Runtime, HTTPS und automatische Zertifikatsprüfung sind fertig; nativer finaler Worker-/Timerbeleg gelesen, Port80 geschlossen und laufende Prozesse unverändert. Ein echter fälliger Zertifikatswechsel wurde noch nicht benötigt oder abgenommen. Neue eigene Operatordateien gehören nur HOST; Schema/Migrationen/Sicherung/Layout/Kontooberflächen und bestehender Release haben keinen Writer. Zentraldateien nur Planung. gpt-6.1-sol/High beibehalten, Astra verboten.



## 22.10.2026 · Persönliche Einladung liegt vor

Native exec-959d2ff3-0fd4-4fc7-b855-5f242ac13fa4 Exit0 bestätigt genau eine Einladung für chips-eiweiss.2k@icloud.com. [Metadaten ohne Token](HOST_DIREKTEINLADUNG_ABSCHLUSS_2026-10-22.json). Privater Link im Chat, keine Mail oder behauptete Postfachkontrolle. Konto pending/member, Bootstrap offen. Nächster notwendiger Nutzerschritt: eigenes Passwort im HTTPSbrowser setzen und Registrierung melden. Erst danach den dazugehörigen regulären Bestätigungslink bereitstellen; TOTP/Finish weiter normale Voraussetzungen für persönlichen Adminabschluss. Kein aktiver Writer und kein Wiederholen von prepare-admin.


## 22.10.2026 · Registrierungs-Origin korrigiert

Fester separater Custom-Serverstarter und eng geänderter eigener App-Launcher installiert; unverändertes Release, keine Produkt-/UI-/Schemaänderung. [Native Abnahme](HOST_REGISTRIERUNG_ORIGIN_ABSCHLUSS_2026-10-22.json), [öffentliche Übergabe](HOST_REGISTRIERUNG_ORIGIN_UEBERGABE_2026-10-22.md). App/Bridge/Proxy geordnet neu gestartet, PG durchgehend aktiv. Korrekte Origin passiert Guard; fremde Origin/Host/Forwarded-Host, falsches Protokoll und fehlender Aktionsheader bleiben403. Laufzeit UID901 ohne Capabilities/Gruppen und nur private erwartete Listener bestätigt. Registrierung weiterhin nicht gespeichert und Einladung unverbraucht. Nutzer verwendet denselben privaten Einladungslink erneut; erst nach tatsächlicher Registrierung Bestätigungslink bereitstellen. Kein Wiederholen von prepare-admin, kein aktiver Writer.


## Aktuell: Registrierung gespeichert, private Bestätigung ausstehend · 23.10.2026

Registrierung für chips-eiweiss.2k@icloud.com nativ gespeichert, bestehende Einladung konsumiert und Identität korrekt zugeordnet. [Metadaten ohne Link](HOST_REGISTRIERUNG_BESTAETIGUNG_BEREIT_2026-10-23.json). Regulärer Bestätigungslink liegt in privater Operator-Datei bereit, Nachweis bis23.10.2026 08:37:37 Europe/Berlin gültig. Konto weiterhin pending/member, emailVerified=false, TOTP=false; keine Aktivierung/Promotion oder reale Mail. Die automatische Freigabeprüfung blockiert das Auslesen/Anzeigen des Links trotz direkt nachgelesener Zustimmung im Planungschat und verlangt direkte Bestätigung im ausführenden HOST. Erneuter regulärer Versuch mit konkreten Belegen ebenfalls abgelehnt; kein Ausweichweg. Datei unverändert, Link weder gelesen/angezeigt noch geöffnet. Nutzer wird dafür zum vorhandenen HOST geleitet. Keine neue Einladung, kein Passwortreset. Bei später abgelaufenem Nachweis regulären Bestätigungsweg gezielt fortsetzen, Konto/Passwort erhalten.



## Aktuell: Adresse bestätigt, Authenticator noch offen · 23.10.2026

Persönliche Registrierung und E-Mail-Bestätigung sind nativ abgeschlossen: emailVerified=true für genau das bestehende Konto chips-eiweiss.2k@icloud.com. [Nativer Stand ohne Links/Geheimnisse](HOST_EMAILBESTAETIGUNG_ABSCHLUSS_2026-10-23.json). Nutzer meldete invalid_token beim erneuten Linkaufruf; alleiniger HOST hat den bereits bestätigten Kontostand geprüft und zur normalen Anmeldung/Authenticator-Einrichtung aufgefordert. Keine neue Einladung oder Bestätigung, kein Passwortreset, keine weitere Linkausgabe erforderlich. Die vorherige Ausgabesperre ist als historischer Zwischenstand erhalten und blockiert diesen nächsten Schritt nicht mehr.

Weiterhin pending/member, twoFactorEnabled=false, Bootstrap offen, kein Admin vorhanden. Der Nutzer richtet den Authenticator selbst im HTTPSbrowser ein und bewahrt Recoverycodes privat auf. Erst nach tatsächlicher Faktorverifikation ist das normale finish-admin möglich; keine direkte Rollen-/Status-/Verifikationsänderung. Keine Dienste/Tests/Builds/SMTPaktionen oder neuen Aufträge im jetzigen Check. Oberflächenkorrektur weiterhin nicht implementiert.



## Aktuell: Adminzugang funktioniert; ursprüngliche Anwendung noch nicht vollständig portiert · 23.10.2026

[Bestandsaufnahme](BESTANDSAUFNAHME_2026-10-23.md) zum direkten Nutzerauftrag „bin drin … Bestandsaufnahme“ abgeschlossen. Der [reguläre Adminabschluss](HOST_ADMINABSCHLUSS_2026-10-23.json) ist nativ belegt (active/admin, Adresse und TOTP bestätigt, Bootstrap fertig, alte Sitzungen widerrufen); Niklas meldet erfolgreiche Anmeldung. Ältere Abschnitte mit pending/TOTP-offen sind historische Zwischenstände.

Die sichtbare Abweichung stammt aus der aktiven Kontotestansicht: andere Navigation, getrennte Start-/Profil-/Plan-/Kalender-/Schreibseiten und geschlossene bisherige Pfade. Originalcode ist erhalten, teils wiederverwendet, aber gleiche Bedienung und vollständige Abläufe wurden nicht fertiggestellt. Kontodatenadapter für große Teile der manuellen Lernarbeit sind implementiert; neue KI-Planung, Check-in und Korrektur bleiben im Pilot bewusst gesperrt. Persönlicher Altbestand und tatsächlicher Klausurkatalog wurden noch nicht übertragen. Serverbackup/Restore, Suchworker/Bestandsindex und vollständiger Online-Nutzerablauf sind als fehlende Zielbelege getrennt ausgewiesen; regulärer SMTPversand fehlt weiter.

Auftrag war ausschließlich Bestandsaufnahme. Keine UI-/Produkt-/Daten-/Dienständerung, kein Test/Build oder neuer Arbeitsauftrag. Kein aktiver Writer; gemeinsame Schema-/Backup-/Layout-/Kontodateien bleiben unangetastet. Empfehlung im Bericht: ursprüngliche Oberfläche mit vorhandenen Kontoanschlüssen zusammenführen, fehlende Kernabläufe klären, dann konkret gesicherten Bestandsumzug und gezielte Nutzerabnahme durchführen. Bestehende Freigaben, Daten/IDs und Modellgrenze bleiben erhalten.



## Neue alleinige Orchestrierung · 23.10.2026

Direkter Nutzerauftrag: frischen Orchestrator anlegen, einen Plan für die vollständige Portierung erstellen, ihn umsetzen lassen und sämtliche bestehenden Aufgabenchats01–17 erneut prüfen. Neuer alleiniger Koordinator ist **Stex · Orchestrierung der vollständigen Portierung**, `01a167b8-9e90-7222-b7f7-d199784ea100`. Vorgänger `01a15fdd-616f-7c71-9114-75450d0d174c` hat seine Übergabe abgeschlossen und schreibt ab hier keine Zentraldateien bzw. Arbeitsaufträge mehr. [Kompakte Übergabe](PLANUNG_UEBERGABE_2026-10-23.md) und [Bestandsaufnahme](BESTANDSAUFNAHME_2026-10-23.md) sind die Einstiege; CHATS.json bleibt aktive Zuordnung. Frühere Plan-only-/Bestandsaufnahme-only-Grenzen beschreiben vergangene Aufträge, nicht diesen neuen Umsetzungsauftrag.

Neuer Orchestrator hat die lesende Einrichtung bestätigt. Zentrale Schreibverantwortung ist übertragen; nach Aktivierung plant und koordiniert nur er. Bestehender Heartbeat wurde ohne Duplikat auf ihn umgehängt; ACTIVE und gespeicherte90Minuten-Frequenz unabhängig bestätigt. Fachliche, Kosten-/Daten-/Externgrenzen und Nicht-Astra-Modellvorgabe gelten unverändert. Keine Produkt-/Serveränderung während dieser Übergabe; vollständiger uncommitteter Gesamtstand und alle bestehenden Aufgaben bleiben erhalten. Aktuelle Runde35 enthält den bisherigen Serverumzug; der neue Koordinator erstellt den nächsten konkreten Portierungsplan und prüft dabei passende Dateibesitze und die vorhandenen17Chats.

