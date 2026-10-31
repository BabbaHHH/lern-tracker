# Übergabe an neuen Planungschat, 19.10.2026

Direkter Nutzerauftrag: „übergib mal an einen neuen planungschat“. Vorgänger 01a13510-7d19-74f0-9b34-d4fa3a6df6b9. Gleiche lokale Kopie, keine neue Worktree/kein Reset/Clean. App/Git: lern-tracker; letzter beobachteter Stand162 uncommittete Pfade, alter HEAD unvollständig. Alle Änderungen erhalten.

## Zuerst lesen

AGENTS.md und lern-tracker/AGENTS.md; docs/PROJEKTSTATUS.md, TODO.md, CHAT_KOORDINATION.md, ARCHITEKTUR.md, CHATS.json und aktive ARBEITSRUNDE_33.md. Neueste Fortschreibungen haben Vorrang vor historischen nächsten Aufträgen. CHATS.json enthält einzig aktuelle17 Aufgabenchat-Zuordnungen und lastObservedCursor. Nicht alle historischen Verläufe laden. Planung besitzt Zentraldateien; keine Tests/Builds/Browserfunktionsläufe wiederholen. Nur gezielte Berichte/Code/Belege lesend übernehmen. Keine Doppelaufträge. Bestehende Nutzerfreigabe erlaubt begrenzte lokale Aufträge an17Chats; keine externen Nachrichten.

## Unverrückbare Entscheidungen

Astra in ALLEN Varianten verboten, auch Planung/Tests/Reviews/Koordination/Fallback. Sol explizit verwenden, zulässige Reasoningstufe erhalten; Empfehlung Sol/High. Keine abgeschlossenen Aufgaben deswegen neu starten.

Erster geschlossener Pilot OHNE weiteren KI-Lernplanausbau, KI-Korrektur und KI-Check-in; diese drei Funktionen in Produktion gezielt gesperrt. Bestehende Arbeit/Prompts gespeichert; allgemeine KI/Schlüssel/Tagging nicht pauschal deaktivieren. C6-V nur Umsetzungsvertrag, C6 nicht Pilotvoraussetzung.450 vorhandene Klassifizierungen/IDs/Notizen/Kalender erhalten, keine neue Klassifizierung/Bestandsmigration.

## Stand und tatsächlicher nächster Schritt

Lokale Grundlage C1–C5b, Migrationen001–016, Backupformat4 geliefert; gezielte Integration/Restfixes übernommen. Produktionsconfig/runtime mit explizitem Betreiberflag, Operatoranschluss, SMTPadapter/Outboxdispatcher, Suchworkeranschluss und BackupCLI vorhanden. Standardmäßig503; KEIN echter Onlinebetrieb/SMTP/HTTPS/Linux-/Last-/Offsite-Nachweis. Betriebsvorlagen deploy/pilot noch absichtlich blockiert und an altem Quellenstand; aktueller Anschluss erfordert zugewiesenes Schreibfenster. Keine lokale Lastprobe wiederholen:41/41 OS-Stichproben132–202MiB unter unveränderter256MiB-Grenze. Fehlprobe beweist weder4GB-Untauglichkeit noch8GB-Eignung.

Aktuell alle17 letzten Aufträge abgeschlossen, keine zentral beauftragte Umsetzung aktiv. Letzter Check19.10.16:00Berlin unverändert. HOST beantwortet direkte Nutzerfragen im eigenen Chat; gezielt lesen, falls neue Zustandsänderung. Server noch NICHT gekauft/bereitgestellt, keine konkrete Einrichtung/Veröffentlichung/echte Mail/Bestandsübertragung freigegeben. Nicht aus „weiter“ oder Bestelloptionsfrage ableiten.

## Aktuelle Kostenentscheidung

docs/entwuerfe/HOST-01/KOSTENUEBERSICHT-2026-10-18.md ersetzt historische Hetzner-/Netcup-Empfehlung. HOST prüfte öffentlichen Contabo-Konfigurator: CloudVPS4 EU,4vCPU/8GB/100GBSSD/IPv4,1Monat,6,55EUR brutto/Monat,0Einrichtung. Keine Bestellannahme/Reservierung, Preise vor Kauf prüfen. BrevoFree/Let'sEncrypt und verschlüsselte lokale vollständige Sicherung auf vorhandenen Mac nur Vorschläge. Eigene Domain optional für DNS, feste HTTPS-DNS-Origin laut aktuellem Code erforderlich, IPabgelehnt; Mailabsender-Domain separat kontrollieren. Browserexport ist keine vollständige Onlinekonto-/Dateisicherung. Keine bezahlten Extras automatisch buchen. Genaues Datum/Preis/Gesamtbindung und Einrichtungsumfang separat freigeben lassen, erst nachdem konkretes Angebot vorliegt. Kein garantiertes Live-Datum.

## Gezielte Belege

- docs/entwuerfe/HOST-01/SERVER-PLAN-B.md und RESSOURCEN-MESSVERTRAG.md
- docs/ergebnisse/AUTH-01/PROD-INTEGRATION/ERGEBNIS.md:1 neuer echter isolierter Integrationstest mit10Prüfgrenzen, nicht10Testeinträge;316Quellen laut Aufgabenbericht unverändert. Root las Bericht, hat316noch nicht vollständig unabhängig gehasht.
- docs/ergebnisse/AUTH-01/SMTP/ERGEBNIS.md:15instrumentierte Fälle+1gezielte Callbackfehlerregression, keine echteSMTP-Verbindung.
- docs/entwuerfe/DATA-01/PILOT-RESTPUNKTE.md, PRODUKTIONS-SICHERUNGS-CLI.md, PILOT-RESSOURCENMESSUNG.md, pruefungen/pilot-preflight/BERICHT-2026-10-18T06-31-42-082Z.md.
- DATAaktuellerNachfolger01a14baa-de69-79d0-ba03-4d7db2421fc9:3größere Abschlüsse; vor nächstem größeren Auftrag rotieren, keine Tests deshalb neu starten. AUTHaktuell01a14d0f-ded1-7340-9bb7-b4666952b4d5:2größere Abschlüsse. Alle übrigen IDs nur ausCHATSlesen.

## Separate direkte Nutzerarbeit

HOST erstellte auf direkten Auftrag Designchat „Stex-Banner und NH Studios gestalten“,01a15413-49b9-75d1-8ede-e9ac46e1c405. Kein Ersatz für17Chats. Bei späteren gemeinsamen Layoutarbeiten Dateibesitz dort lesend prüfen; keine ungefragten Nachrichten/Übernahme.

## Fortlaufende Koordination

Bestehende Automation stex-projektchats-koordinieren alle30Minuten, keine zweite erstellen. Falls bestehender Heartbeat noch beim Vorgänger bleibt, zum neuen Chat aktualisieren, Prompt/Zeiten/Benachrichtigungsabsicht erhalten. Still bei unverändertem/nicht handlungsfähigem Stand, keine Routinefinals. Nur wesentlicher Fortschritt/Fehler/Entscheidung/Nutzeraktion melden. Cursor kompakt mit wait_threads nachführen. Keine kostenpflichtigen KI-Aufrufe, Keys, Portale, Geheimnisse auslesen/ausgeben, realen Mail-/Dokumenttransfer oder Veröffentlichung ohne gesonderte Freigabe. Verbrauchsunterbrechung als Hindernis, nicht falscher Erfolg. Alte erledigteDATA-C3b2a und archivierte Vorgänger nicht neu starten.
