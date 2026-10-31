# Arbeitsrunde34 – Contabo-Einrichtung und geschlossener Testbetrieb

## Beauftragung und Ausgangsstand

Niklas im HOST10-Chat,20.10.2026, Turn `01a15899-6891-7012-9c14-22692401bb54`: „Du darfst im VNC-Fenster die Serverkennung und Ubuntu-Version prüfen. möchte eig auch dass du alles aufsetzt, vllt mal den planungschat fragen“. Planung hat diese direkte Nutzernachricht selbst lesend geprüft. Der Wunsch zur vollständigen Einrichtung ist ein Arbeitsauftrag; notwendige reversible Einrichtungsschritte auf dem gemieteten Ziel brauchen keine weitere pauschale Bestätigung. Die folgende Staffelung konkretisiert den Umfang.

Ziel laut Bereitstellungsmitteilung: Contabo Cloud VPS4 (2026), Hub Europe,62.171.162.115. HOST berichtet im VNC-Loginfenster Ubuntu24.04.5 LTS/Hostname vmd209708; dies ist bislang die gelesene Konsolenanzeige vor der Anmeldung, kein authentifizierter System-/Hostschlüsselnachweis. Tatsächliche Architektur/Ressourcen/Zugänge prüfen. Kunden-/Bestellnummern, vollständige Mail, Kennwörter und private Schlüssel nicht übernehmen.

Bestehende Anwendung C1–C5b, Migrationen001–016 und Backupformat4; lokale Produktionsruntime/Suchoperator/SMTP-/BackupCLI und Vorlagen geliefert. Die drei vertagten Funktionen Planung/Korrektur/Check-in bleiben geschlossen. Rund450 vorhandene Klassifizierungen/IDs/Notizen/Kalenderbezüge erhalten. Kein Reset/Clean, kein Worktree allein aus altem HEAD. Aktuellen vollständigen uncommitteten Stand erhalten. Astra in jeder Variante verboten; GPT-6.1 Sol ausdrücklich, High empfohlen, zulässige Reasoningstufen erhalten.

## C0 – laufender Identitätscheck, allein bisheriger HOST10

Einziger aktueller Bediener der bestehenden VNC-/SSH-Sitzung ist `01a1226d-24d7-7e51-999f-d8548dab507e`. Niklas gibt sein Kennwort selbst lokal ein. Bis zur gesicherten Übergabe keine zweite Serverbedienung und keine Installation.

Nach Anmeldung nur tatsächliches OS und öffentlichen ED25519-Hostfingerprint über den unabhängigen VNC-Weg prüfen; den vom SSH-Client gemeldeten Wert vergleichen. Kein blinder Trust-/Prüfungsbypass. Kurzen tatsächlichen Zustand und nächste sichere Übernahme im eigenen Bericht/Chat sichern: welche Ansicht/Sitzung erhalten ist, ob angemeldet, Identitätsvergleich tatsächlich gleich oder offen, keine Passwörter/privaten Schlüssel/Terminalvolltexte. Danach Serverbedienung beenden und auf Übergabe warten. Fehlender Zugang/Abweichung ist ein Hindernis, kein Erfolg.

## Rotation vor H1

Vor größerer Einrichtung frischen lokalen Nachfolger derselben Aufgaben-ID10 im gleichen Projekt anlegen; keine Kopie aus altem HEAD, kein vollständiger Historienfork. Vorlagen-/Ergebnisübergabe19.10. und C0-Zustand lesen, erledigte Tests nicht wiederholen. Planung überträgt genau einen Server-/Dateibesitz in CHATS.json/CHATS.md, hält Vorgänger/letzten Cursor fest und archiviert den ruhenden Vorgänger erst nach gesicherter Übernahme. Neuer Chat zunächst nur Kontext lesen; konkrete H1-Zuweisung erst nach abgeschlossenem C0 und eindeutiger Übertragung. Noch kein Nachfolger angelegt oder H1-Serverauftrag versendet.

## H1 – Servergrundinstallation, nach C0 und Rotation

Zuerst Ist-Inventar des authentifizierten Ziels: tatsächliches OS/Architektur, CPU/RAM/Platz, aktive Dienste/offene Ports und vorhandene Daten, ohne Geheimnisse oder fremde Prozessargumente auszulesen. Bei unerwarteter fremder Nutzung keinen Dienst/Datenbestand überschreiben. Kein OS-Neuaufsetzen, Löschen von Volumes oder destruktiver Datenersatz aus diesem Auftrag.

Dann die nötige kostenlose Basis installieren/aktualisieren: geeignete unterstützte Node-Version entsprechend bestehendem Node≥22.13-Vertrag und tatsächlichem Lockfile, PostgreSQL intern/Loopback und HTTPS-Proxy. Versionen/Installationsweg anhand des tatsächlichen Ziels und offizieller Quellen festlegen, keine Website-Option buchen. Getrennte Betreiber-/Dienstrechte sowie Release-, Daten-, Cache-, Backupstaging- und Secretpfade nach vorhandener Vorlage herstellen. Keine echten Lernunterlagen oder Zugangsdaten in Release/Repo/Belege kopieren.

SSH-Zugang mit geeignetem Betreiberkonto/Schlüssel vorbereiten, falls dafür erforderlich; dies sind Einrichtungsschlüssel dieser konkreten Integration, keine OpenRouter-/Anbieterschlüssel. Private Schlüssel/Passwörter verbleiben an ihrem geschützten Ort. Root-/Passwortzugang erst einschränken, nachdem ein zweiter unabhängiger Zugang und benötigte sudo-Rechte tatsächlich geprüft sind. Firewall nur mit nachgewiesen erhaltenem Zugang setzen; PostgreSQL und interne App nicht öffentlich exponieren. Bestehenden VNC-Rettungszugang erhalten. Noch keine Appfreischaltung, echte Mail oder Kundendaten.

Abnahme: konkrete Inventar-/Versions-/Rechte-/Zugangs-/Portbelege und kleinster Rückweg, vorhandene fremde Daten erhalten. Nur neue Zielgrenzen prüfen, keine alten lokalen Modul-/Gesamttests, kein Mac-Lastwiederholungslauf. Ressourcen vor längeren Installationen/Bauarbeiten prüfen; tatsächlichen Zielstop dokumentieren. Danach H1-Bericht und kurze Übergabe; Planung übernimmt lesend und vergibt das passende nächste Fenster.

## H2 – Anwendung auf geschlossenem Testziel

Nach H1 und bestätigter Webadresse folgt ein eigener begrenzter Ausführungsauftrag unter derselben Nutzerbeauftragung, ohne neue pauschale Zustimmung. Vollständigen tatsächlichen Programmstand mit expliziter öffentlicher Dateiliste/Hashes und passenden Lock-/PDF.js-/Operatorassets bereitstellen; keine Geheimnisse, privaten Dokumentbestände, lokalen DBs oder unnötigen Sammlungen übertragen. Erforderlichen Linuxbuild im Aufgabenchat ausführen, keine Root-Tests/Builds. Transitive Operatorabhängigkeiten/tsx berücksichtigen.

Datenbank und private Originalablage auf ein neues leeres synthetisches Testziel binden;001–016 bewusst und vor Requests anwenden. Serverlokale nötige Auth-/Datei-/Backupschutzwerte geschützt erzeugen und ablegen, nichts loggen. Gerenderte Dienste/Proxy/Secrets getrennt von unverändert blockierten Beispielvorlagen halten. Betreiberflag und Dienststarts nur bewusst für dieses kontrollierte Testziel setzen; drei vertagte KI-Wege bleiben geschlossen, allgemeine Schlüssel-/Taggingwege nicht zusätzlich verändern. Keine bezahlten KI-Aufrufe oder Providerkontenanlage.

HTTPS/DNS/Proxy und begrenzten Testzugang herstellen, sobald passende Webadresse/Kontrollmöglichkeit vorliegen. Bis dahin Serverbasis und nötige Loopbackarbeiten fortführen; keine DNS-Entscheidung erfinden und nichts kostenpflichtig buchen. Echte SMTP-Zustellung mit konkret benannten Eingaben/Empfänger erst gesondert konkretisieren, davor keine Einladungsmails an Personen. Gezielte neue Linux-/HTTPS-/Zugangs-/Dokument-/Such-/Sicherungsgrenzen mit künstlichen Konten/Dateien prüfen. Frühere Modulbelege nutzen. Verschlüsselte vollständige Sicherung des künstlichen Bestands an gewähltem unabhängigem Ort und Rückkehr in leeres Testziel prüfen; tatsächliche Offsitefähigkeit nicht bloß aus einem Skript behaupten.

## Spätere Freischaltung und offene Eingaben

Die allgemeine Einrichtung beauftragt weder neue kostenpflichtige Extras/Domainkäufe noch den echten Erstbestandstransfer, reale Einladungen, öffentliche Freischaltung oder weitere KI-Funktionen. Diese Schritte anhand konkreter fertiger Zielbelege und benannter Daten/Empfänger separat abstimmen. Zunächst ausschließlich künstlicher Testbetrieb.

Webadresse wird zentral abgefragt: kostenlose Unteradresse, vorhandene Domain/Subdomain oder spätere Wahl. Bestehende Browser-/Klausurdaten bleiben unberührt. Keine parallelen Aufgabenwriter starten, solange kein konkreter Produktfehler oder unabhängiges notwendiges Fenster vorliegt.

## Datei- und Serverbesitz

- C0: bisheriger HOST10 ausschließlich bestehende VNC-/SSH-Ansicht und eigener kurzer C0-Bericht; keine Serveränderung.
- H1/H2: erst nach expliziter Übertragung neuer HOST10 alleiniger Serverbediener. Vorgesehene eigene Pfade `deploy/pilot/targets/contabo-test/**`, `scripts/host/contabo-*` nur bei Bedarf, eigener Ergebnisbericht und eigene datierte Zielbelege unter `docs/entwuerfe/HOST-01/`. Keine Secretdateien im Repo. Alte static-*-/Quellbelege erhalten.
- Produktcode, Pakete/Lockfile, Schema/Backupkern und fremde UI-/Designpfade bleiben HOST read-only. Kleinsten nötigen Produktfix an Planung melden; dort genau einen zuständigen Owner zuweisen.
- Planung allein Zentraldateien, Rundendokument, Briefings und Zuordnung. Kein Test/Build oder Serverzugriff im Planungschat.

## Präzisierung des sicheren Wechselpunkts und Webadresse

Niklas hat die kostenlose Unteradresse gewählt. Als kostenfreier Testkandidat ist `stex.62-171-162-115.sslip.io` vorgesehen. Die [offizielle Dienstbeschreibung](https://nip.io/) dokumentiert IP-gebundene Hostnamen und individuelle HTTP-01-Zertifikate; [DuckDNS](https://www.duckdns.org/why.jsp) bleibt nur eine weitere kostenlose Option. Keine Domain/kein Providerkonto gekauft oder angelegt. Der Kandidat ist noch nicht per DNS/HTTPS abgenommen: der Web-DNSabruf war nicht verfügbar, die rein lokale DNS-Abfrage wurde vom Sandbox-Netzwerk blockiert. Das ist kein Ausfallnachweis des DNSdienstes und blockiert H1 nicht. H2 prüft Auflösung auf genau die Ziel-IP und ein eigenes gültiges Zertifikat, bevor eine Origin eingerichtet wird. Die Kostenentscheidung ist damit beantwortet; keine erneute Domainfrage nötig.

C0 steht weiterhin vor der lokalen Anmeldung; der letzte direkte HOST-Nutzerauftrag testete lediglich ungesendeten Text in der Loginzeile. Ein vorzeitiger Kontextwechsel darf deshalb auch mit sauber gesichertem offenem C0-Zwischenstand erfolgen: bisheriger HOST hält unverändert/angemeldet/offen ausdrücklich fest, beendet seine Bedienung und ruht; danach erhält genau ein frischer HOST die vorhandene Sitzung und den C0-Rest. Identitätsprüfung bleibt Voraussetzung für H1. Niemals aus einer Übergabe oder Loginbanneranzeige einen abgeschlossenen C0 ableiten. Keine zweite Bedienung, keine erneute Kennwortabfrage im Planungschat.

## HOST10-Nachfolger allein zugeordnet – 20.10.2026

Neuer alleiniger HOST10 ist `01a158a5-02f3-7c10-977f-845ce4c1bad5` (10 · HOST-01 — Servereinrichtung · Folge), lokal in derselben unveränderten Arbeitskopie mit ausdrücklich Sol. Vorgänger `01a1226d-24d7-7e51-999f-d8548dab507e` hat bei Cursor39 seine Bedienung beendet und die [offene C0-Zugangsübergabe](entwuerfe/HOST-01/C0-ZUGANGSUEBERGABE-2026-10-20.md) gesichert. Anmeldung/SSH-Identitätsvergleich bleiben offen; keine Abnahme dadurch. Der Nachfolger liest zunächst nur Kontext, Serverfortsetzung wird gesondert technisch zugewiesen. [Runde34](ARBEITSRUNDE_34.md) ist aktiv. Keine parallele Serverbedienung oder alten Testwiederholungen.

## Konkreter C0-Rest/H1-Besitz nach Rotation

Nachfolger `01a158a5-02f3-7c10-977f-845ce4c1bad5` hat Kontext/Übergabe lesend bestätigt; Vorgänger ist von der App bestätigt archiviert und hat seine Bedienung beendet. Ausschließlich der Nachfolger erhält nun den C0-Rest in der erhaltenen Sitzung und danach H1 nach tatsächlichem Identitätsvergleich. Eigene neue Berichte `docs/entwuerfe/HOST-01/C0-ABSCHLUSS-2026-10-20.md` und `H1-SERVERBASIS-2026-10-20.md`, eigener Ergebnisnachtrag, bei Bedarf ausschließlich neue eigene `deploy/pilot/targets/contabo-test/**` und `scripts/host/contabo-*`. Keine Secretdateien im Repo. H2/Produktcode/Schema/Pakete/Layout noch read-only. Installation am Ziel innerhalb H1 ist nach tatsächlichem C0 beauftragt; keine erneute pauschale Zustimmung. Fehlende lokale Anmeldung durch Niklas bleibt konkrete Nutzeraktion im neuen HOST-Chat.

## Automatische Freigabeprüfung: H1-Ausführung noch nicht versendet – 20.10.2026

Der kombinierte C0/H1-Versand an den frischen HOST wurde von der automatischen Freigabeprüfung abgelehnt: dauerhafte Änderungen an SSH/sudo, Firewall, Datenbank, Proxy, Diensten und Rechten waren noch nicht mit exakten Einstellungen und Auswirkungen eingegrenzt. Der allgemeine Einrichtungswunsch von Niklas ist belegt, ersetzt diese konkrete technische Prüfung aber nicht. Kein H1-Mutationsauftrag durch diesen Versand wirksam, keine Umgehung oder Aufteilung zur indirekten Ausführung. Frühere pauschale Ausführungssätze gelten insoweit nicht als Startsignal.

Unberührt bleiben die sichere Rotation, ursprüngliche C0-Leseerlaubnis und eigenständige direkte Nutzeraufträge im neuen HOST-Chat. Direkte Konsolen-/Neustartwünsche und zugehörige UI-Freigaben werden ausschließlich im HOST-Chat behandelt; ihr jeweiliger Livezustand steht in CHATS.json. Planung beginnt keine zweite Bedienung und löst keine fremde Freigabe aus. Sicherer Folgeumfang: ausschließlich C0/öffentliches Ist-Inventar lesen und daraus einen exakten H1-Änderungsplan mit Befehlen, Paketversionen/Quellen, Nutzern/Rechten, Ports/Firewall, SSH-Einstellungen, Diensten, geschützten Pfaden, betroffenen Bestandsobjekten und Rückweg erstellen. Installation und persistente Änderungen erst nach Prüfung dieses konkreten Plans/Freigabe. Kein Kennwort/privater Schlüssel/echter Datenbestand in Plan oder Log.

## Inventar und H1-Plan lesend geprüft – Fortschritt 20.10.2026

Planung hat HOST-Turn `01a158cf-6a04-7c83-89d6-fae9939243f0` mit der Originalnachricht von Niklas, den [H1-Änderungsplan](entwuerfe/HOST-01/H1-KONKRETER-AENDERUNGSPLAN-2026-10-20.md) und den neuesten eigenen Ergebnisnachtrag gelesen. Erfolgreiche SSH-Sitzung mit tatsächlicher Befehlsausgabe belegt nun Ubuntu24.04.5/noble, x86_64,4 CPUs,7.8Gi RAM und94G freien Rootdateisystemplatz. Frühere Kennwortprobleme bleiben historisch; aktuelle Anmeldung ist als Nutzerbeleg vorhanden. Kein eigener Serverzugriff durch Planung. SSH-Fingerprint aus derselben Sitzung ist nur konsistent; unabhängiger VNC-Abgleich bleibt offen. Kein Kapazitätsnachweis aus der Momentaufnahme.

Der Plan ist als sinnvoller Rahmen übernommen, **H1 nicht ausgeführt oder als ausführungsfertig abgenommen**. Bestandsstopps, absoluter Nodepfad, loopbackgebundene DB, gesperrter Proxy, spätere zweite Zugangskontrolle und Rückwege sind beschrieben. Noch offen: Zielpfade/-nutzer, effektive Firewall/SSH einschließlich Matchbedingungen, APT-Kandidaten/Abhängigkeiten und vollständige erste Transaktion. Beobachtete Webversionen ersetzen keine Zielversionen; Versions-/Quellenprüfung vor Installation anhand des dann gebundenen Blocks. APTupdate ist selbst Mutation, temporäre `policy-rc.d` wirkt systemweit. Beides gehört ausdrücklich in den späteren konkreten Auftrag. Volles sudo, Root-SSH-Abschaltung und UFWaktivierung bleiben spätere Schritte mit ihren Nachweisen; keine indirekte Ausführung des abgelehnten breiten Auftrags.

Niklas hat in derselben Originalnachricht sparsame Unteragenten und bevorzugte Bildschirmfreigabe ausdrücklich gewünscht. Ein lesender Unteragentenreview ist bereits geliefert; nicht wiederholen. Vorbereitung/Prüfung kann HOST mit kurzem Kontext delegieren, während genau ein namentlicher Bediener und Writer für eigene Dateien bleibt. Keine neuen sichtbaren Projektchats/IDs, keine zweite Serverbedienung. HOST besitzt weiterhin ausschließlich seinen Plan/Bericht und das bereits freigegebene lesende Restinventarfenster; gemeinsame Produkt-, Schema-, Sicherungs-, Layout- und Kontodateien bleiben unverändert. Planung pflegt nur zentrale Dateien.

Aktueller sicherer Stopppunkt: gespeicherte Bildschirmfreigabe wartet auf Niklas' lokale VNC-Anmeldung; HOST hat ihn direkt informiert. Danach innerhalb desselben bestehenden Leseauftrags fehlendes Inventar/C0 ergänzen und den ersten konkreten Mutationsblock fertig binden. Erst dann nötige genaue Freigabe anhand der fertigen Auswirkungen. Kein neuer Doppelauftrag an den wartenden HOST, keine Aufträge an die unveränderten übrigen16 Chats, keine Tests/Builds/Lastwiederholung in Planung. H2 und reale Daten/Mails/öffentliche Freischaltung weiter offen.

## Pause und gesicherter Umzugsentwurf – 20.10.2026

Niklas hat die begonnene reine Umzugsplanung ausdrücklich pausiert und Speichern beauftragt. [Zwischenstand und vorläufige Aufgabenpakete](PLANUNG_ZWISCHENSTAND_2026-10-20.md) sind gesichert; der fertige Detailplan steht noch aus. Bis zu ausdrücklicher Fortsetzung keine weitere Planung oder neuen Aufträge, auch nicht durch Heartbeats. Bestehende Automation unverändert, keine neuen Chats/Modelle/Unteragenten gestartet.

C0 ist inzwischen durch den [HOST-Abschluss](entwuerfe/HOST-01/C0-ABSCHLUSS-2026-10-20.md) unabhängig belegt und von Planung lesend übernommen: authentifizierte VNC-Rootshell, passender öffentlicher Hostfingerprint, Ubuntu24.04.5. HOST hat seine Bedienung beendet; H1 nicht begonnen. Frühere Hinweise auf ausstehende VNC-Anmeldung/C0 sind historisch. Fehlendes Restinventar, genaue Paketbindung und zuverlässige Bedienung bleiben offen. Der jüngste direkte Auftrag ist zunächst nur der Plan, keine Ausführung.

## Abgelöst durch Plan-only-Runde35 – 20.10.2026

Niklas hat die Planung nach der Pause fortgesetzt. [Runde35](ARBEITSRUNDE_35.md) konkretisiert jetzt16 Teilpakete mit Modell-/Datei-/Abnahme-/Rückweggrenzen und wird zuerst vorgelegt. C0 ist bereits unabhängig abgeschlossen, H1 unbegonnen. Frühere pauschale Ausführungssätze dieser Runde sind kein neuer Auftrag; keine Ausführungsnachricht/Chatstart/Modellumstellung erfolgt. Planungspause aufgehoben, Ausführung bleibt bis konkreter neuer Zuweisung gehalten.
