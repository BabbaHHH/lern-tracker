# Arbeitsrunde 36 · vertraute Anwendung im Kontobetrieb

## Aktuell: ursprüngliche Ansichten als R36 auf dem Server aktiv ·24.10.2026

**R36 ist seit16:37:19 CEST tatsächlich aktiv.** HOST-Abschluss belegt das versiegelte Release `r36-20261023-3usae1W09aqQi1yIpn-i_` am laufenden Prozess, die aktuelle DB `stex_rollback_r36_20261023` mit Schema18 und die Dateiwurzel `/srv/stex/data/contabo-test/r36-rollback-20261023/files`. Proxy/443, TLS, Origin und bestehende /32-Zugriffsgrenze sind erhalten. [Kurze zentrale Übergabe](HOST_R36_LIVE_2026-10-24.md).

Frischer finaler Snapshot16:37:04 CEST, echter getrennter Restore sowie Integrität/Admin/TOTP bestätigt.018 und enge Rechte auf dem aktuellen Datenzweig erfolgreich; Wartungsfenster rund21Sekunden. Mögliche neue R36-Eingaben erhalten: kein verlustbehafteter17er-Snapshotrollback, kein Wechsel zur historischen DB. HOST-Writerende, keine laufenden Betreiberjobs. Keine weitere Serverprüfung oder Original-Fach-/UIabnahme durch Planung; externe Nutzersitzung wurde nicht neu getestet. Bewusste KI-Sperren bleiben bestehen.

**Nächster begrenzter Schritt36-BESTAND-PREP:** DATA erstellt nur die benannte Altbestands-/Zielkontoübergabe aus vorhandenen öffentlichen Berichten und Werkzeugen. Eigener Bericht `docs/entwuerfe/DATA-01/R36-BESTAND-UEBERGABE.md` plus eigener Ergebnisnachtrag; kein Produktwriter, privater Bestandszugriff, neuer Build/Test, echter Import oder Serverbefehl. Fehlende benannte Quelle konkret ausweisen. Echte Bestandsübertragung bleibt gesondert freizugeben. Keine zusätzlichen Funktionen vorziehen. Zentraldateien allein Planung; HOST bleibt alleiniger Serverbediener und derzeit ohne neuen Zielauftrag.

## Aktuell: R17 wieder erreichbar; R36-Abschluss auf aktuellem Datenzweig ·24.10.2026

HOST-Recovery erfolgreich seit16:15:53.190CEST:Proxy/443/TLS aktiv,App/Bridge/PG ohneNeustart. Konkreter neuerProxygatefehler war die zu früheListenerprüfung;endliche10s-Bereitschaftsprüfung behebt ihn. HistorischeWindow-/Rescueursache bleibt unbekannt. LetzterBeleg prüft TLS lokal;externeSitzung aus freigegebener/32 nicht neuabgenommen.

Maßgeblich sind jetzt stex_rollback_r36_20261023/Schema17 und r36-rollback-20261023/files;Schreibzauntrue,mögliche neueEingaben erhalten. Alte stex_test_20261020/Schema18 und Snapshot15:55:55 sind historischerZweig,kein aktuellerZielbestand.

**36-HOST-FINISH-B:** derselbe alleinigeHOST setzt den konkreten Anschlussplan r36-recovery-20261024.r36-next.md um. Neue genaueBetreiberdateien/Guards/Einmalslots zuerst reviewbar herstellen und intern festbinden,dann im begrenztenAuftrag ausführen:neue leereDB stex_rollback_r36_20261024b,neueFiles r36-rollback-20261024b/files,Snapshotparent r36-20261024b,alteRollen/zwei engeHBA-Regeln. FrischenfinalenSnapshot desAKTUELLEN17erZweigs tatsächlich insneue17erZiel restaurieren;erstnachIntegrität/Admin/TOTP018+engeGrants aufAKTUELLERDB und fertigesR36Release mitderselbenDB/Dateiwurzel starten.900sHauptfenster/120sRettung,neuefehlerarmeReadiness+ursprünglicheSchutzgates,keineChatpauseimFenster. AlteverbrauchteSlots/Snapshots/Fehlernichtresetten. KeinLegacyimport,Reichweitenwechsel,Build,UIumbau/VorschauodererneuteFachabnahme. R36weiterhinnichtlivebestätigt.

Dateibesitz:ausschließlichneue eigene r36-finish-20261024b.*-Quellen,rootlibexec-Unterordner gleichenNamens,neue eigeneUnits/Checkpoints,ein eigenerApp-50erDrop-in und exaktbenannte neueDB/Files/Snapshotziele;Bestandscode/Operatoren/20er/40erDateien erhalten,Zentraldateien alleinPlanung. NachmöglichenWrites aufneuemR36Zielkein verlustbehafteter17erRollback.

## Aktuell: echter Restore und018 fertig; Ingress-Wiederanlauf offen ·24.10.2026

Tatsächlicher HOST-Beleg:finalerSnapshot24.10.2026 15:55:55.820CEST,echterRestore ins getrennte17er-Ziel erfolgreich,Integrität/Admin/TOTP stimmen.018 und enge18er-Grants auf ursprünglicherDB stex_test_20261020 erfolgreich. R36-Wechsel und automatischeRescue endeten vorProxyfreigabe mitExit1;Ursacheoffen. AktiverCode R17 am Rückwegziel stex_rollback_r36_20261023/Schema17,App/Bridge/PG aktiv;Proxy inaktiv,kein443Listener. **Extern derzeit nicht erreichbar;R36nichtlive.** Keine laufenden Betreiberjobs.

HOST erhält sofort den begrenzten Wiederanlaufauftrag:konkreten Fehler vorIngress klären und bestehende geschlossene Proxykette ausschließlich am belegtenR17-Restoreziel wiederherstellen. Neue eigene öffentliche r36-recovery-20261024.*-Dateien,falls nötig genau neuerRoothelper /usr/local/libexec/stex-r36-recovery-20261024.py,alteOperatoren/Units/Fehler/Snapshots unverändert erhalten. EngesReadinesswarten nur bei belegtemStarttimingproblem;keine Schutzprüfung abschwächen. VorProxyöffnung konservativen Schreibzaun dauerhaft fortschreiben. KeinWindow-/Restore-/018-/Grant-/Init-/DBanlage-Wiederholung,keineOriginal-UItests. OriginalDB18 und tatsächlichen17erRestore erhalten;nachwiederangenommenenWriteskeinverlustbehafteterRücksprung. R36-Abschluss danach gesondert amtatsächlichenTeilstand,zuerstVerfügbarkeitherstellen.

## Aktuell: Rückweg-Zielinitialisierung gezielt an frischen HOST übergeben ·24.10.2026

R17/Schema17 und HTTPS443 weiter aktiv. Neue Rückweg-DB und zwei HBA-Regeln sind hergestellt;DB noch ohne Anwendungsschema. Ein fehlerhafter Node-Gruppenguard stoppte den Initlauf vor DBressourcenkonstruktion:korrekte effektive Gruppe[901] wurde fälschlich abgelehnt. Kein Snapshot/Restore/018/R36-Wechsel und kein Wartungsfenster begonnen. Keine erledigte DB-/HBAanlage oder alte Installation erneut ausführen.

Vorgänger hat Writerende/keine Jobs und kompakte exec-handoff.md gesichert. Neuer alleiniger HOST `01a16e30-dd84-7543-a126-9d9732991504` übernimmt denselben offenen Ausführungsblock. V3-Korrektur aus groups-correction.md konkret gebunden:Operator e65156e6598a93d846cf3b12feba66d844fdfccab0f03522573b36038a773bdc;Manifest bb139b912a9ac9139ecdc17e2f145a844b2a303227f296679e0f423994bfb289;Installer ac631394ce653ad33eee31698573df9052ae9b910573737f825b0a304615554a. Exakt15zusätzlicheRootdateien/9neueDrop-inverzeichnisse gemäß Manifest plus daemon-reload;alte Dateien/Fehlerbelege bleiben erhalten.

Dann `continue-target-init` mit frischem Unit-/Ergebnisslot;nur nach tatsächlichem Erfolg bestehendes900s/120s-Wartungsverfahren bis finalemR17Snapshot,echtem getrenntem17erRestore und erst danach018/engenGrants/R36. Keine weiteren großen Funktionsarbeiten,Originalabnahme oder Vorschau. Liveaktivierung weiterhin unbestätigt. Zentraldateien allein Planung,Server allein neuerHOST;kein Chatwechsel im Wartungsfenster.

## Aktuell: korrigierte SAFEWAY-Fortsetzung gebunden ·24.10.2026

Separate Proxy-/Fortsetzungskorrektur anhand kurzem Delta übernommen. Originaloperator/28Assets bleiben erhalten;keine alte Installation oder bestandene Anschlussprüfung wiederholen. Exklusiv zusätzlich drei neue HOST-Ziele: operator-v2.py und jeein40-operator-v2.conf-Drop-in für eigene Wartungs-/Rescueunit,root:root/0644. Enger Installer darf nur diese Ziele/Verzeichnisse und daemon-reload erzeugen,keinen Dienst starten/stoppen.

Neu gebunden:OperatorV2 88e919905510a85b6bdbfc4b700bb0cf357cef18739586a235955701ff8b5adb;Korrekturmanifest7e306ffbe227c0a1edc66ddf1cf62deb642724958490fd77776bc3f187631728;Installer ae8e4e4b5f220e5077c485bc582d60a50e32b981a02b21f768f03904869b0d1d. HOST setzt bestehenden dritten Ausführungsblock fort:Korrektur anwenden,`continue-installed`,nur nach erfolgreichem Zielaufbau einmaliges zusammenhängendes`execute-window`+`status`. NeueDB/HBA/17erRückweg,finaleSicherung/echterRestore VOR018/R36 und900s/120s-Grenzen unverändert. R17weiterhin letzter belegter Livecode,018/R36nichtalsfertigmarkieren. Keine neuen externen Wirkungen,Nutzerabnahme oder Modellauswahl. Kapazitätsunterbrechung durch gezielten gleichenSol-Folgeauftrag behoben.

## Aktuell: R17 wieder aktiv; gezielte Operatorkorrektur nach Unterbrechung ·24.10.2026

HOST hat R17-App,Bridge/Socket und tatsächlichen Proxy `stex-u09-proxy.service` wieder gestartet;PG bleibt aktiv. Enge Prozess-/Namespace-/Originbelege erfolgreich. Live weiterhin17Migrationen,kein018 und kein R36-Wechsel. Die gebundenen Betreiberdateien wurden installiert;danach brach `prepare` wegen fälschlichem `stex-u09-https-proxy.service` ab. Keine neue Rückweg-DB,HBA unverändert;neue Snapshot-/Rückwegdateiverzeichnisse leer. Vorbereitung nicht blind wiederholen.

Anschließend Modellkapazitätsfehler „Selected model is at capacity“. Arbeit ist erhalten. Derselbe HOST setzt nur die bereits angekündigte öffentliche Korrektur fort: richtiger Proxyname plus sicherer Resume nach bereits erfolgter Installation,neue separate Hashbindung/Übergabe. Ursprünglich gebundener Operator bleibt erhalten. Keine neue operative Zielausführung bis zur konkreten Übernahme der korrigierten Bindung,kein pauschales Neustarten,kein Wechsel zu Astra oder unbestellter Modellwechsel. Danach bestehender begrenzter Sicherungs-/Restore-/018-/Umschaltauftrag am tatsächlichen offenen Punkt fortsetzen.

## Aktuell: Wiederanlauf und abgesicherte R36-Umstellung konkret beauftragt ·24.10.2026

SAFEWAY-PREP fertig:28gebundene Betreiberdateien einschließlich zwölf Units,lokale Syntaxprüfungen gemeldet;noch nichts installiert/ausgeführt. Neuer Ausgangsbefund: App/Bridge/Socket/Proxy waren bei HOST-Lesung bereits inaktiv,PG aktiv;alter App-Namespace4026532267 statt tatsächlichem PG4026532265. Ursache des Dienststopps damit nicht vollständig erklärt;PREP hat ihn nicht ausgelöst. Frühere „Live unverändert“-Angaben beschreiben eigene Nichtänderung,keinen aktuellen Verfügbarkeitsnachweis.

**Jetzt alleiniger HOST36-HOST-SAFEWAY-EXEC:** genau gebundene EXECUTION.md ausführen: `prepare --resume-r17`,danach nur bei erfolgreichem laufendem Altbetrieb einmaliges `execute-window` und `status`. Operatorhash ed9c794f518165b60e6bbff31a418595a371a8cab3020a4dcca0be9a525de982;Assetmanifest eca6db131a7fa74fada51556a5344f077cef3d5d26a2b62755421bc888106374. Ausschließlich28benannte Installationsziele,neues Rückwegziel stex_rollback_r36_20261023/neue Dateiwurzel,enge HBA/alte Rollen,PG-Reload ohne Neustart. Bestehende Schutzwerte nur managerseitig;HBA nur exakt gebunden lesen/vergleichen/ergänzen. Finaler R17-Snapshot und tatsächlich geprüfter separater17er-Restore VOR018 und R36-Wechsel,900s-Hauptlauf+120s-Rettungsversuch,keine Chatpause im Wartungsfenster. Bei geänderter Bindung oder Reviewablehnung stoppen und konkret melden,keine Umgehung.

Bestehende geschlossene Origin und /32-Reichweite bleiben,keine neue Veröffentlichungserweiterung,kein echter Altbestandsimport,Käufe/Keys/Mail/Uploads. Migration018 undR36-Aktivierung erst nach tatsächlichem Zielbeleg alslive markieren. Alle Produktdateien ohne Writer,Zentraldateien allein Planung. Nach zweitem großen HOST-Abschluss geprüft;dritter gebundener Ausführungsblock zulässig,Rotation erst am sicheren Abschluss/Wiederanlauf,nicht im Wartungsfenster. Keine neuen Fach-/UItests,Vorschau oder Architektentests.

## Aktuell: Linuxrelease fertig; konkrete Sicherungs-/Rückwegtexte ·24.10.2026

HOST36-HOST-STAGE anhand kurzem Abschlussbericht übernommen: Paketbindungen bestätigt,Linuxbau Exit0 und versiegeltes Release `/srv/stex/releases/r36-20261023-3usae1W09aqQi1yIpn-i_` fertig. Keine laufenden Jobs,keine Produktpatches. Migration018 weiterhin nicht live;Altbetrieb unverändert. Automatischer Reviewtimeout vor Kopierstart wurde mit ausdrücklich gestatteter identischer Wiederholung behoben;kein offener Freigabeblocker.

**Jetzt36-HOST-SAFEWAY-PREP:** derselbe alleinige HOST erstellt ausschließlich neue öffentliche `r36-safeway-20261024.*`-Betreibertexte: konkrete R17-Sicherung,getrennter leerer17er-Restore samt zielgebundenem Launcher,enge DB/HBA-/Rechteänderungen sowie R36-App-/Cache-/Originbindungen. Endliches zusammenhängendes Wartungs-/Wiederanlaufverfahren vor018 festlegen;keinen finalen Snapshot nach erneut angenommenen Writes weiterverwenden. Noch keine Installation/SQL/Privatlesung/Sicherung/Restore/Dienständerung oder Umschaltung in diesem Vorbereitungsblock. Danach gebundene Ausführung unter bestehenden Freigaben;echten Altbestandsimport weiterhin getrennt. Keine Vorschau/erneute Originalabnahme und keine Tests/Builds durch Planung. Zentraldateien allein Planung,alle Produktdateien ohne Writer.

## Aktuell: Pakettransfer erfolgreich; HOST setzt Linuxbau fort ·24.10.2026

Nach direktem „ok nxt step“ sind genau `program-source.tar.gz` und `source-manifest.json` vom Mac über die vorhandene verschlüsselte Verbindung in `/home/stex-ops/stex-admin/r36-source-20261023/` übertragen worden(SCP Exit0,fest bestätigte Serverkennung). Keine Serverbefehle/Tests/Builds durch Planung. HOST übernimmt jetzt die eigene gebundene Paketannahme und setzt36-HOST-STAGE am offenen Linuxbau fort. Empfangs-/Paketprüfung und Linuxbauergebnis noch nicht bestätigt;kein neues Live-Release. Bestehende Dateibesitze und Stufengrenzen unverändert: nur getrennte neue Bau-/Releasepfade;kein SQL/018,Grants,Sicherungs-/Restorelauf,Dienstwechsel oder privater Konfigzugriff in dieser Stufe. Keine erneute Originalabnahme oder Vorschau.

## Aktuell: Pakettransfer vom Mac fehlt ·24.10.2026

HOST hat36-HOST-STAGE vor dem Transfer mit Writerende unterbrochen: Die Remote-Sitzung kann den Mac-Quellpfad nicht erreichen. Das leere Annahmeverzeichnis `/home/stex-ops/stex-admin/r36-source-20261023/` ist vorbereitet(0700).0Dateien übertragen,kein Linuxbau/neues Release; laufende Instanz und Datenbank unverändert. [Konkreter einmaliger Mac-Transfer](HOST_R36_PAKETTRANSFER_MAC_2026-10-24.md) nur für öffentliches Archiv und Manifest über vorhandene Verbindung. Keine neue pauschale Freigabe nötig. Danach denselben HOST gezielt ab Paketannahme fortsetzen;keine erneute Paketierung/Rotation/alten Tests. HOST bleibt alleiniger Serverbediener.

## Aktuell: Programmpaket fertig, getrennter Linuxbau beauftragt ·23.10.2026

Original-Kernansichten und enger Katalogtypfix sind lokal abgeschlossen. Das gemeinsame Paket enthält352öffentliche Dateien; gemeinsamer macOS-Typ-/Buildnachweis liegt vor. HOST-Umstellungsplan und kompakte Übergabe sind fertig. Nach Writerende sicherer Wechsel auf alleinigen HOST-Nachfolger `01a16a97-fd13-7bf2-8648-6b385e607382` im bestehenden Remoteprojekt.

**Jetzt36-HOST-STAGE:** gebundenes Paket über vorhandenen verschlüsselten Weg übertragen/annehmen, getrennt auf Linux bauen und neues separates Release vorbereiten. Keine Umschaltung,018/Grants,Sicherungs-/Restoreausführung,privaten Konfigurationslesungen oder Dienständerungen in diesem Block. Neue eigene remote `r36-stage-20261023.*`-Dateien und vorher konkret benannte neue Quell-/Baureleasepfade gehören ausschließlich HOST. Alle Produktdateien und zentralen lokalen Dateien bleiben ohne weiteren Aufgabenwriter; Zentralstatus allein Planung. Bestehende HTTPSinstanz/Konto laufen unverändert. Danach konkreter Sicherungs-/Rückwegblock,anschließend gesondert gebundene Umstellung. Keine Vorschau/erneute ursprüngliche UI-Abnahme.

## Verbindlich: so nah wie möglich am Original ·23.10.2026

Direkte Nutzeranweisung: „wichtig so nah wie mgl am original“. Originalcode,Gestaltung,Funktionen und Bedienabläufe maximal erhalten. Nur konkret erforderliche Änderungen für Server-/Kontospeicherung,Anmeldung,Rechte und geschützten Dateizugriff sind Abweichungsgründe;je Abweichung kurze Begründung. Keine beiläufigen Neuentwürfe,Umbenennungen oder Funktionsumbauten bei Paketierung/Deployment. Erhaltener Originalquellstand bleibt Vergleichsreferenz;kein erneuter Gesamt-UItestauftrag daraus.

## Nutzerkorrektur: Original bereits getestet,keine neue Vorschau ·23.10.2026

Niklas hat die ursprüngliche Anwendung bereits vor dem Serverkauf ausführlich getestet. Der zusätzlich abgeleitete Vorschau-/erneute Sicht- und Gesamtbedienabnahmeauftrag ist ausdrücklich zurückgenommen. [Portierungs-Zwischenübergaben](NIKLAS_ABNAHME_R36.md) betreffen nur notwendige Serveranpassungen,gemeinsames Programmpaket,konkrete Zielumstellung und Datenerhalt. DATA36-PACK ist abgeschlossen;HOST setzt die begrenzte Serverportierung fort. Keine neuen Vorschau-/Referenzserver oder Wiederholung alter Fach-/UIprüfungen. Notwendige technische Prüfung der neuen Anschlüsse/des gemeinsamen Builds bleibt bei Aufgabenchats. Keine neue pauschale Startfreigabe;bestehende konkrete Kosten-/Daten-/Veröffentlichungsgrenzen bleiben.

## Verbindliche Nutzerkorrektur: Architektur koordinieren, alte Ansichten zurück ·23.10.2026

Niklas: „du sollst die arbeiten orchestrieren als architekt, zudem wollen wir das alte design und die alten ansicht zurück“. Priorität ist die tatsächliche Wiederverwendung der ursprünglichen Ansichten/Komponenten samt Gestaltung und Bedienung mit Kontodatenadaptern. Ähnlich gestaltete neue Kontoseiten reichen nicht. Der Orchestrator weist Dateibesitz und konkrete Arbeit zu,übernimmt knappe Ergebnisberichte und löst Blocker;Detailprüfungen/Tests/Builds erledigen die Aufgabenchats. Keine weiteren eigenen Prüf-/Warteschleifen und keine erneute17er-Inventur.

Die ursprünglichen Kernansichten einschließlich Schreiben,Notizblock,Einstellungen,Tagesempfehlung und altem/klausuren-Pfad sind lokal mit Kontodaten verbunden. UI-Writerende;ein enger Katalograndfall(fehlender Typ bei Schreibneuanlage) wird durch IMPORT behoben. DATA bereitet das gemeinsame öffentliche Releasepaket vor und darf erst nach erfolgreichem Fix/Writerende einfrieren,bauen und paketieren. Noch kein neues Serverrelease;vor weiterem großen UIauftrag nach3Abschlüssen rotieren. Zusätzliche PDF-/Feedback-/Anki-/Portal-/Modellfunktionen werden dieser Wiederherstellung nicht vorgezogen. Bestehende Freigabegrenzen und alleiniger HOST bleiben erhalten.

Stand:23.10.2026. Direkter Nutzerauftrag: neuer alleiniger Orchestrator soll Plan erstellen, umsetzen lassen und alle offenen Chats prüfen. Aktivierung nach bestätigter CHATS-Zuordnung erfolgt. Auftrag umfasst lokale Umsetzung und nötige begrenzte Prüfungen; kein erneutes pauschales Los erforderlich.

## Ziel und Ausgangspunkt

Die erhaltene Browserfassung im aktuellen Arbeitsbaum ist die verbindliche Gestaltungs- und Bedienreferenz. Kontopersistenz, Anmeldung, Rollen, Origin-/Dokumentschutz und vorhandene IDs bleiben erhalten. Keine Umschaltung auf Browserpersistenz. [Bestandsaufnahme](BESTANDSAUFNAHME_2026-10-23.md) und [Prüfung aller17Aufgaben](AUFGABENPRUEFUNG_2026-10-23.md) ersetzen historische Bereitschaftsmeldungen.

## Endliche Reihenfolge

| Schritt | Ergebnis und Abnahme | Zuständig |
|---|---|---|
|36.1|Originalnavigation, Themes und Startseitenaufbau im Kontobetrieb: Countdown,Tagesprogramm,Klausur-des-Tages-Karte,Themen,Plan-/Profilzugang und Check-in-Einstieg. Kontodaten statt localStorage; klare Lade-/Fehler-/Sperrzustände, keine falsche KI-Verfügbarkeitszusage. Desktop und schmale Ansicht mit synthetischem Konto geprüft.|UI-01, exklusiver erster UI-Block|
|36.2|Vertraute Kernseiten verbinden: Profil/Onboarding,Wochen-/Monatskalender,Planentwürfe,Klausurkatalog/PDF und Schreibbereich. Alte Pfade sinnvoll erhalten, Speichern/Rückkehr/Neuanmeldung nachvollziehbar. Datenanschlusslücken zuerst konkret ausweisen und gezielt schließen; vorhandene Services verwenden.|UI-01 nach36.1; DATA nur zugeordnete Backendlücken|
|36.3|Fehlende ursprüngliche Funktionen gezielt vervollständigen: persönliches PDF-Markieren/Leseposition,Feedback sowie Quellen-/KI-Plananschluss technisch reviewbar vorbereiten. Kein neuer Modellvergleich. Bewusste KI-Sperren erst bei konkreter gedeckter Aktivierung ändern; nicht als fertige Planung ausgeben.|PDF-02,FEEDBACK-01,AI-KEYS/PLAN nach genauer Pfadzuordnung, höchstens disjunkte Writer|
|36.4|Genau die neue Gesamtverbindung lokal prüfen, öffentliches Quellpaket mit festem Manifest erstellen; HOST erhält konkretes Release-/Rollbackpaket für die bestehende geschlossene Instanz. Kein Neuaufbau von HTTPS/DB/Konto, keine Wiederholung alter Prüfungen. Vollständigen Nutzerweg und offene Backup-/Restore-/Suchworkerreste am Ziel belegen.|jeweiliger Implementierer; DATA Paket; HOST allein Ziel|
|36.5|Altbestandsübernahme konkret vorbereiten: benannte Quelle/Zielkonto,IDs/Klassifizierungen/Notizen/Kalender-/Dateiverknüpfungen,vorherige Sicherung und bewiesener Rückweg. Reale Übertragung erst nach konkreter Transferfreigabe. Anschließend persönliche Nutzerabnahme.|DATA/IMPORT,HOST; Niklas konkrete Umfangsfreigabe|
|36.6|Für weitere eingeladene Nutzer nötigen regulären Mailbetrieb und unabhängige regelmäßige Sicherung abschließen, soweit konkrete Anbieter-/Kosten-/Empfängerfreigaben bestehen. Optionale Portalautomatik,Modellroutine,Anki und neue Analyseklassifizierung bleiben spätere Pakete.|AUTH/HOST; optionale IDs später|

Jeder Schritt endet mit tatsächlichen Dateien, passenden neuen Belegen und offenen Grenzen. Ein fertiger Teilblock beendet den Gesamtauftrag nicht. Bei einer echten Freigabegrenze zuerst eine konkrete reviewbare Vorbereitung herstellen und parallel unabhängige Arbeit fortsetzen.

## Aktuelle Dateibesitze

**Planung allein:** zentrale Status-/Architektur-/Koordinationsdateien,CHATS.json/CHATS.md,dieses Rundendokument und Aufgabenprüfbericht.

**UI-01 ·36.1 exklusiv:** src/components/account-learning-boundary.tsx,nav-bar.tsx,theme-picker.tsx,account-settings-provider.tsx,account-learning-dashboard.tsx; src/app/page.tsx; bei Bedarf neue src/components/account-dashboard-*.tsx bzw.account-klausur-des-tages.tsx; ausschließlich eigene tests/ui-account-shell*.test.ts(x) und docs/ergebnisse/UI-01.md sowie docs/entwuerfe/UI-01/R36-*. Kein anderer UIwriter. Layout/globals,store/types,Verträge,Services,Schema/Backup,Viewer und übrige Seiten zunächst read-only. Weitere notwendige Pfade vor Änderung konkret an Planung melden.

**DATA-01 ·36-V zunächst nur Analyse:** docs/entwuerfe/DATA-01/R36-ANSCHLUSSLUECKEN.md und eigener Ergebnisnachtrag. Produktdateien read-only. Prüft verbleibende Kontoanschlüsse und Bestandsübernahme-/Rollbackvorbereitung anhand bestehender Werkzeuge, keine private Bestandsauslese oder Zielaktion.

**Alle übrigen Aufgaben:** kein aktiver Writer. HOST ist alleiniger Serverbediener und derzeit ohne neuen Zielauftrag. Vor größerer AUTH-/HOST-Arbeit Rotation nach bestehender Regel; DATA nach zwei Abschlüssen geprüft, ein dritter begrenzter Analyseblock ohne Kontextfehler zulässig, danach vor großer Umsetzung rotieren.

## Verbindliche Grenzen

Astra und sämtliche Varianten für jede Arbeit ausgeschlossen. Bestehende zulässige Sol-/Luna-Einstellungen erhalten, aktuelle Aufträge gpt-6.1-sol/high. Keine bezahlte KI,neue Käufe,externen Dokumentuploads,reale Bestandsmigration,neuen Empfänger oder neue Veröffentlichungsreichweite ohne konkret gedeckten Umfang. Bestehender Heartbeat bleibt ACTIVE,90Minuten,bei unverändertem Stand still. Planung führt keine Tests/Builds und keine Serverbefehle aus. Großen gemeinsamen Arbeitsbaum erhalten; kein Reset/Clean/Stash oder Quellbasis nur aus altem HEAD.

## Fortschritt

- Aktivierung und alleinige Zuordnung unabhängig gelesen.
- Alle17Chats kompakt geprüft; kein aktiver Produktwriter.
-36.1 und36-V sind jetzt konkret zugewiesen; Versand/Abschluss werden in CHATS.json und hier nachgetragen.


### Anschlussanalyse übernommen ·23.10.2026

36-V fertig,lesend übernommen: [konkrete Anschlusslücken und Transferfolge](entwuerfe/DATA-01/R36-ANSCHLUSSLUECKEN.md). Drei tatsächliche Backendblöcke:B1vollständiges manuelles Profil/Budget(P1),B2geschützte Katalogmetadaten/JSON(P1),B3kontobezogenes Feedback(P2). B2 ist für Filter/PDF/Abschluss nicht Voraussetzung. Kein SQL-Post-Commit-Undo vorhanden; Restore in getrenntes Ziel bleibt vor echtem Transfer zu belegen.

DATA nach drittem Abschluss sicher rotiert: neuer Owner01a167c6-39bc-71c0-902c-839a71a06c9a,zunächst lesendes Setup. Danach B1exklusiv: src/lib/learning/personal-contract.ts,personal-client.ts,use-account-personal.ts,schedule-contract.ts;src/lib/server/learning/personal-service.ts,schedule-service.ts,plan-calculation.ts;neue src/lib/learning/profile-*.ts;eigene tests/r36-profile-*.test.ts;docs/ergebnisse/DATA-01.md und docs/entwuerfe/DATA-01/R36-B1-*. Keine Schema/Backup/Runtime/UI/Store/Typ/Paketpfade. UI-01unverändert36.1. Zusätzlicher Produktbedarf zuerst konkret zuordnen.

### B2 getrennt vorbereitet ·23.10.2026

Neuer alleiniger IMPORT-01-Nachfolger01a167d0-9b75-7d03-bc15-6072b8bf601c zunächst im lesenden Setup. Nach Zuordnung/Folgeauftrag exklusiv: neue src/lib/catalog/metadata-*.ts,use-catalog-metadata.ts;src/lib/server/catalog/metadata-*.ts;kleiner Zusatz catalog/runtime.ts;src/app/api/catalog/metadata/**;ausschließlich neue db/migrations/018_catalog_metadata_commands.sql bei nötigen dauerhaften Belegen;src/lib/server/persistence/backup.ts;tests/r36-catalog-metadata*.test.ts;docs/ergebnisse/IMPORT-01.md und eigene R36-B2-Belege. Schema-/Backupwriter bis Abschluss allein IMPORT. Vorherige001–017,database.ts,Auth,UI,Store/Typen/Pakete read-only. UI36.1undDATA36-B1 bleiben disjunkt;keine weiteren Produktwriter starten. B2 ergänzt die spätere Originalkatalogintegration,blockiert nicht die erste UIkorrektur.

### B1 lokal fertig und übernommen ·23.10.2026

[UI-Übergabe](entwuerfe/DATA-01/R36-B1-UEBERGABE.md) und Abschlussbelege lesend übernommen:11gebundene Quell-/Testdateien ohne Hashabweichung;46/46TAP-Einträge(45inhaltliche Fälle),gezielte Typ/Lintbelege grün. Neuer vollständiger manueller Profil-/Budgetvertrag,partielles Speichern mit Alt-/Quellenwerterhalt,gemeinsame Kalender-/Planprojektion und Planvorschaukonflikt bei geänderter Lernstart-/Budgetbasis. Keine neue Tabelle,keine UI-/Onlineabnahme;Writerende. Planung keine Tests/Builds. DATA-Pfade jetzt ohne aktiven Writer;UI darf neue Exports gemäß Übergabe lesen.

### Nächstes UI-Fenster36.2a vorbereitet

Nach lesender Übernahme und Writerende36.1 erhält derselbe UI-01(nach dann einem größeren Abschluss) den ursprünglichen manuellen Einstieg sowie Wochen-/Monatskalender und Planansicht. Vorhandene Kontohooks weiterverwenden,B1UI-Übergabe verbindlich. Exklusive nächste Pfade: src/components/account-profile-page.tsx,account-schedule.tsx,account-plan-page.tsx;src/app/onboarding/page.tsx,wochenplan/page.tsx,kalender/page.tsx,plan/page.tsx;neue src/components/account-onboarding-*.tsx/account-calendar-*.tsx und eigene tests/ui-account-workflow*.test.ts(x),eigene R36.2a-Belege/Ergebnisnachtrag. Bestehende36.1-UIpfade gehören bei notwendiger Integration weiter demselben Owner. Noch kein Auftrag an zweiten UIwriter. Datenverträge/Services/Schema/Backup/Store/Types bleiben read-only. Vollständige manuelle Eingaben mit bewusstem Speichern,Neuanmeldung,Kalender- und Planwirkung;kein schreibendes Default-Onboarding und keine KIaktivierung. Katalog/Schreiben/Einstellungen/heuristische Tagesempfehlung folgen36.2b nach B2;keine Abhängigkeit der ersten Korrektur von neuen optionalen PDF-/Ankifunktionen.

###36.1 lokal fertig und übernommen;36.2a startet

[Abschlussbericht](entwuerfe/UI-01/R36-ABSCHLUSS.md) lesend übernommen;9gebundene Produkt-/Testdateien hashgleich.4neue Verhaltenstests,gezielte Typ/Lintprüfung und echte synthetische Browserbelege(Desktop,390/320px,Theme/Tagesaufgabe+Reload,Sperre) vorhanden;Desktop-/Mobilbilder visuell geprüft. Eigene Laufzeit bereinigt. Kein Deploy und keine gemeinsame Abnahme paralleler DATA/IMPORT-Quellen. Ein größerer UIabschluss,gleicher Chat darf36.2a bearbeiten.

36.2a-Pfade wie oben reserviert plus nötige bisherige36.1-UIpfade beim selben Owner. Empfehlung: DATAbericht zeigt bereits ausreichende gelesene Kontodaten plus reine scoreKlausur-Funktion;für spätere heuristische Tagesempfehlung36.2b keinen neuen Endpoint als zwingend voraussetzen. Browserstore lesende Wrapper vermeiden,Kontokontexte/Gewichte/Historie tatsächlich abgleichen. Keine KIanfrage.

## Fortsetzung: ursprüngliche Klausuransicht parallel verbinden ·23.10.2026

B2 anhand kurzem Abschluss-/UI-Vertragsbericht übernommen;keine eigenen Tests,Quellhash-/Screenshotprüfungen.12gezielte Fälle gemeldet;abschließender Typ-/Restorebeleg stammt vor letztem kleinen Zusatz,keine neue Gesamtprüfung behauptet.018nur lokal,nicht auf Server. Schema-/Backupfenster beendet.

IMPORT-01(01a167d0-9b75-7d03-bc15-6072b8bf601c) erhält nach einem größeren Abschluss36.2-K: ursprüngliche Klausuransicht tatsächlich wiederverwenden und Kontodaten/Metadatenaktionen anschließen. Exklusiv src/app/klausuren/page.tsx,src/app/konto/klausuren/page.tsx,src/components/catalog-import-app.tsx,neue klausuren-view.tsx/account-klausuren-*.tsx,src/lib/catalog/use-account-catalog.ts;personal-contract.ts ausschließlich personalPageAllowed um /klausuren ergänzen,nach vorhandener sicherer Accountverzweigung. Eigene tests/r36-katalog-view*.test.ts(x),Ergebnis und R36-KATALOG-Belege. Keine Backend-/Schema-/Backup-/Store-/Typ-/Schreibseitenänderungen.

UI-01 behält36.2a samt gemeinsamen Nav-/Boundary-/Layout-/Stylepfaden. Alle Katalogpfade bleiben für UI-01 read-only;IMPORT fasst umgekehrt gemeinsame UI-/Kalender-/Profil-/Plan-/Schreibpfade nicht an. Damit zwei disjunkte UI-Fenster statt zweier Writer an derselben Ansicht. Nach36.2a folgen für UI-01 Schreiben/Einstellungen/Tagesempfehlung;Katalogarbeit nicht doppelt beauftragen. Ziel bleibt Originalansichten,keine zusätzlichen Funktionen.

##36.2a/K fertig;letzte ursprüngliche Kernansichten36.2b ·23.10.2026

Kurze Abschlussberichte übernommen: ursprünglicher Wizard,Wochen-/Monatskalender und Planansicht verwenden Kontodaten;Originalkatalog läuft unter/konto/klausuren. Gemeldet5bzw4neue Verhaltenstests,gezielte Typ/Lintprüfung und künstliche Browserabläufe. Keine eigenen Tests/Detailabnahme,kein Deploy. IMPORT-Writerende. Einzige gemeinsame Kataloglücke:/klausuren in schedulePageAllowed noch geschlossen;jetzt UI-01zugeordnet.

UI-01 nach2größeren Abschlüssen geprüft;ein dritter abgegrenzter Block36.2b ist zulässig,danach vor weiterer großer Umsetzung frisch übergeben. Keine Kontextfehler/30inhaltlichen Turns belegt;Cursorrevisionen sind keine Turnzahl. Ziel: Original-Schreibliste/-workspace/-notizblock und ursprüngliche persönliche Einstellungen wiederverwenden,heuristische Tagesempfehlung mit bestätigten Kontodaten anschließen,alte Pfade integrieren. Keine neuen Funktionen/Backendarchitektur.

Exklusive Pfade36.2b:
- `src/app/admin/page.tsx`
- `src/app/schreiben/page.tsx`
- `src/app/schreiben/[id]/page.tsx`
- `src/app/schreiben/notizblock/page.tsx`
- `src/components/schreiben-workspace.tsx`
- `src/components/account-writing-list.tsx`
- `src/components/account-writing-editor.tsx`
- `src/components/account-writing-status.tsx`
- `src/components/account-settings-page.tsx`
- `src/components/prompt-gear.tsx`
- `src/components/account-learning-boundary.tsx`
- `src/components/nav-bar.tsx`
- `src/components/account-learning-dashboard.tsx`
- `src/components/account-klausur-des-tages.tsx`
- `src/components/account-dashboard-model.tsx`
- `src/components/account-writing-*.tsx (new view helpers only,provider excluded)`
- `src/components/account-settings-*.tsx (new view helpers only,provider excluded)`
- `src/components/account-recommendation-*.tsx`
- `src/lib/learning/schedule-contract.ts (page allowlist only)`
- `tests/ui-account-remaining*.test.ts(x)`
- `docs/ergebnisse/UI-01.md`
- `docs/entwuerfe/UI-01/R36.2b-*`

Alle Kontodienste/anderen Verträge/Provider,Schema/Backup,Katalogansicht und globals/layout bleiben read-only. schedule-contract.ts ausschließlich Seitenfreigabe;keine Datensemantik. Gemeinsame Navigation/Boundary allein UI-01. Nach Abschluss konkretes gemeinsames Quell-/Releasepaket mit notwendigen kombinierten Prüfungen durch Aufgabenchat,keine Architekten-Testschleife. HOST bleibt alleiniger Zielbediener.

## Original-Kernansichten fertig;ein Randfall und gemeinsames Paket ·23.10.2026

36.2b anhand kurzem Bericht übernommen:Original-Schreiben/Notizblock,Einstellungen,Tagesempfehlung und alter/klausuren-Pfad lokal angeschlossen.9neue Tests,gezielte Typ/Lint- und künstliche Browserabläufe gemeldet;keine eigenen Detailprüfungen. UI-Writerende,nach3größeren Abschlüssen vor weiterem großen UIauftrag rotieren.

Ein enger Befund bleibt:Katalog-Schreibneuanlage bei fehlendem type muss vor Writingclient-Aufruf eine bewusste Typwahl anbieten. IMPORT erhält36.2-K-R,keine geratenen Klassifizierungen/Vertragslockerung. Exklusiv use-account-catalog.ts,account-klausuren-page.tsx,bei zwingendem Vorwahlanschluss account-writing-list.tsx/src/app/schreiben/page.tsx nur dafür,neuer gezielter r36-katalog-type-Test und eigener Ergebnis-/R36-KATALOG-TYP-ABSCHLUSS.md-Bericht. UIhat beendet,kein konkurrierender Writer. Backend/Schema/Backup unverändert.

DATA erhält36-PACK:öffentliche aktuelle Quellen und Migration018 lokal in neuem deploy/pilot/targets/contabo-test/source-r36-20261023/ binden,notwendigen gemeinsamen App-Typ-/Buildnachweis in isolierter Kopie herstellen und Upgrade/Rückweg für HOST konkret vorbereiten. Produkt read-only;zusätzlich nur docs/entwuerfe/DATA-01/R36-RELEASEPAKET.md und eigener Ergebnisnachtrag. QUELLFREEZE/BUILD/PAKETIERUNG ERST nach erfolgreichem Typ-Fix-Abschlussbericht und Writerende. Fehlt dieser nach der kurzen Vorbereitung,nur Dependency melden,keine lange Warteschleife. Keine alten Fach-/Infra-/Gesamttests wiederholen,keine Server-/Transfer-/Deployaktion.

###36-PACK freigegeben;Vorschau-Zusatz zurückgenommen

IMPORT-Typfix abgeschlossen/Writerende;DATA-Dependency erfüllt. Gemeinsamer Freeze/Appbuild/Programmpaket und konkrete Serverumstellungsvorlage fortsetzen. Der zusätzliche Vorschauauftrag wurde vor Nutzerausführung korrigiert und ausdrücklich abbestellt. Originalanwendung gilt als vom Nutzer bereits ausführlich getestet;keine weitere Gesamt-Browserprüfung.

##36-PACK fertig;HOST-Zielumstellung vorbereiten ·23.10.2026

[DATA-Übergabe](entwuerfe/DATA-01/R36-RELEASEPAKET.md) anhand kurzem Bericht übernommen.352öffentliche Programmdateien,gemeinsamer App-Typ-/macOS-Produktionsbuild bestanden;kein Linuxbinary/kein Deploy. DATA-Writerende,keine Nutzervorschau. Archiv96a3dc06d26ba0b9f98fe3b624e01b62d55f7203888ec4ca1b12305cd8a46654,Manifest899160105b6a979067bf89dcfa5c6940daddaf513465329bfde20ab8df5aaf27.

Alleiniger aktueller HOST erhält36-HOST-PREP:nur konkrete Transfer-/Linuxrelease-/Sicherungs-/018-/Grants-/Umschalt-/Rückwegvorlage und kompakte Kontextübergabe. Exklusive neue öffentliche Textpfade remote r36-upgrade-20261023-plan.md und r36-upgrade-20261023-handoff.md unter/home/stex-ops/stex-admin. Keine Servermutation,privaten Konfigurationen oder neuen Schlüssel;bestehende native Belege wiederverwenden. Vor größerem Liveupgrade Rotation prüfen. Bestehende Origin-/Auth-/Proxyintegration erhalten,kein Neuaufbau oder Wiederholung der Original-Funktionsabnahme.
