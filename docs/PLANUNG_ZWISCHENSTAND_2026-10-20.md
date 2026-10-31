# Gesicherter Planungszwischenstand – 20.10.2026

**Auf direkte Nutzeranweisung pausiert.** Niklas: „kurz mal pause, speucher deinen stand“. Keine weitere Planung, Auftragsvergabe oder Serverbedienung bis zu seiner ausdrücklichen Fortsetzung; Heartbeats heben diese Pause nicht auf. Bestehende Automation nicht verändert. Keine laufenden Unteragenten oder neuen Ausführer aus diesem Planungsschritt.

## Auftrag und tatsächlicher Bearbeitungsstand

Niklas beauftragte im aktiven HOST-Chat zunächst ausschließlich den Umzugsplan und seine Zerlegung in kleine Aufgaben für weniger leistungsstarke zulässige Modelle. Planung hat die Originalnachricht selbst gelesen: Turn 01a158ec-05e0-74a1-b1fd-ed37caff224c, Thread 01a158a5-02f3-7c10-977f-845ce4c1bad5. Kein Umsetzungsauftrag, keine neue Chatanlage und keine Modellumstellung daraus. Die detaillierten Aufgabenpakete sind **noch nicht fertig ausgearbeitet oder freigegeben**.

Zentrale Dateien, Runde34, aktuelle Zuordnung, tatsächlicher uncommitteter Arbeitsstand sowie die neuen HOST-Berichte wurden gelesen. Alle17 Chats kompakt geprüft; nur HOST neu, übrige16 unverändert. Keine Tests, Builds, Installationen, Zielkontakte, Unteragenten oder Arbeitsaufträge durch Planung. Bereits gelieferter lesender HOST-Unteragentenreview wurde nicht wiederholt.

## Neuer geprüfter Zugangsstand

C0 ist durch den HOST-Bericht jetzt abgeschlossen: eigene Linux-VNC-Konsole als root angemeldet, öffentlicher ED25519-Fingerprint unabhängig über VNC gelesen und exakt zum ursprünglichen SSHwert passend; Ubuntu24.04.5 LTS/noble nach Anmeldung bestätigt. Planung hat den Abschlussbericht lesend übernommen und selbst keinen Server bedient. Bericht: [C0-ABSCHLUSS-2026-10-20.md](entwuerfe/HOST-01/C0-ABSCHLUSS-2026-10-20.md). Kein Kennwort-/Schlüsselwert in diesem Zwischenstand; nicht im alten Verlauf danach suchen.

Die Rootshell in QEMU(vmd209708) ist laut HOST erhalten; HOST hat seine Bedienung beendet und wartet auf den Plan. UFW ist inactive; andere Firewallregeln sind damit nicht geprüft. Weitere apt-cache-Eingabeversuche ohne beobachteten Befehl/Output: Paketkandidaten weiter unbekannt. VNC-Eingabe ist noch unzuverlässig; Mac-Terminal-App bleibt durch das Computerwerkzeug gesperrt, keine Umgehung oder alternative Steuerung dieses gesperrten Apps.

Ressourcen aus vorheriger direkter Nutzerausgabe: x86_64,4 CPUs,7.8Gi RAM,94G frei im Rootdateisystem und0Swap. Momentaufnahme, kein Lastnachweis. H1 weiterhin nicht begonnen; keine Pakete/Nutzer/Rechte/SSH/sudo/Firewall/DB/Dienste/Uploads geändert.

## Vorläufige Planstruktur – noch keine Arbeitsaufträge

Die folgenden U-Nummern sind nur Teile dieses Entwurfs, keine neuen Projektaufgaben-IDs oder zu startenden Chats.

| Paket | Vorgesehenes Ergebnis | Modellvorschlag / Verantwortungsgrenze |
|---|---|---|
| U01 | Zuverlässigen erlaubten Bedien-/Transferweg und fehlendes öffentliches Restinventar feststellen; C0 nicht wiederholen. | HOST10/Sol; nur ein Serverbediener. |
| U02 | Vollständigen heutigen Programmstand einschließlich Änderungen/untracked Dateien mit erlaubter Dateiliste und Hashes binden. | Luna Medium für mechanische Auswahl/Manifest unter HOST; Sol prüft Grenzen. Kein altes HEADarchiv. |
| U03 | Exakte Pakettransaktion und Nodequelle/-version/-hash aus Zielbestand festlegen; APTupdate und etwaige globale Startunterdrückung ausdrücklich erfassen. | Luna Medium entwirft feste Liste, Sol prüft Wirkungen. Noch kein Installbefehl mit erfundenen Versionen. |
| U04 | Nur konkret freigegebene Pakete/Runtime installieren, neue Zielbelege liefern. | HOST/Sol als serieller Bediener; keine SSH-/Firewalländerung im Paketblock. |
| U05 | Benutzer-/Pfad-/Rechteplan und mechanische Einrichtung für getrennten Build, Releases, synthetische Dateien und Secrets. | Luna Medium bereitet genau begrenzte Dateien/Befehle vor; HOST bedient, Sol prüft Privilegien. |
| U06 | Zweiten Betreiberzugang belegen, erst danach konkrete SSH-/sudo-/Firewallhärtung. | Sol High. Noch kein automatisches NOPASSWD:ALL aus älterem Entwurf übernehmen. |
| U07 | Zielvorlagen für Dienste, Proxy und nicht geheime Konfigurationsnamen aus festem Vertrag rendern. | Luna Medium; eigene HOST-Zielpfade, alte blockierte Beispiele unverändert. |
| U08 | Erlaubtes Release paketieren und in separater nicht privilegierter Linux-Bauumgebung mit bestehendem Lockfile bauen. | Luna Medium für Paketierung/Bauablauf und Belege; HOST bleibt einziger Serverbediener. Kein Mac-node_modules/Build als Linuxbeleg. |
| U09 | Neues leeres synthetisches DB-/Dateiziel mit001–016, geschützten lokalen Werten und tatsächlicher Runtimebindung einrichten. | DATA02/AUTH03 fachlich, Sol prüft; HOST führt allein am Server aus. |
| U10 | Neue Loopback-, Rechte-, Dokument-/Such- und Konto-Zielgrenzen gezielt prüfen. | Luna Medium für feste Proben/Auswertung; Sol für Auth-/Datenfehler. Keine alten Gesamttests. |
| U11 | Gewählte kostenlose Unteradresse, DNS, eigenes TLS und geschlossenen Proxy/Testzugang prüfen. | HOST/Sol; Luna kann feste Konfigdateien vorbereiten. Kein öffentliches Öffnen der App. |
| U12 | Synthetischen vollständigen Format4-Satz verschlüsseln, getrennten Sicherungsort und Restore in ein anderes leeres Ziel nachweisen. | DATA02/HOST, Sol prüft Wiederherstellung; Luna vergleicht feste Hash-/Summenbelege. Ort/Tool/Schlüsselverwahrung noch zu binden. |
| U13 | Geschlossenen HTTPS-Testbetrieb anhand tatsächlicher Ziel-/Geräte-/Ressourcen-/Restorebelege übernehmen. | Luna Medium für Befundmatrix; Sol entscheidet technische Abnahme, Planung übernimmt lesend. |
| U14 | Echten Quellbestand/Exportweg, Auswahlsatz, Einfrierpunkt und Erhaltungsprüfungen konkret planen. | DATA02/Sol. Keine neue Klassifizierung; IDs, Notizen, Kalender und persönliche Zuordnung erhalten. |
| U15 | Später separat freigegebenen echten Umzug durchführen und mit Quelle abgleichen. | DATA02/Sol plus HOST als alleiniger Serverbediener. Eigener DB-/Dateivertrag, synthetischen Bestand nicht als Echtbestand umdeuten. |
| U16 | Reale SMTP-Zustellung/Einladungen und kleinen geschlossenen Pilot separat konkret freigeben. | AUTH03/HOST/Sol; benannte Empfänger und Zustellnachweis. Keine öffentliche Öffnung oder KI-Erweiterung ableiten. |

Luna ist als gpt-6-luna/Medium für überschaubare mechanische Aufgaben vorgesehen; Sol als gpt-6.1-sol/High für Planung, Sicherheits-/Schemaentscheidungen, Fehleranalyse und Abnahme. Dies sind Empfehlungen, keine bereits geänderten Chateinstellungen oder gemessene Kosten-/Qualitätszusagen. Später kurze Unteragentenkontexte statt langer Historien; bestehende zulässige Modelle/Reasoningstufen erhalten. Astra in sämtlichen Varianten ausgeschlossen.

Abhängigkeiten noch vollständig festzuschreiben: U01→U03→U04; U02 parallel zur Inventarvorbereitung möglich; U05–U09 bauen auf freigegebenem Bestand und Release auf; U10/U11/U12 müssen vor U13 belegt sein; U14–U16 gehören zum später gesondert freizugebenden echten Umzug. Keine Parallelbedienung des Servers. Nutzer-/Sicherungs-/Schema-/Layout-/Kontodateien vor jedem späteren Schreibfenster genau einem Writer zuordnen.

## Beim Fortsetzen noch auszuarbeiten

1. Nach ausdrücklichem „weiter“ aktuelle Zentraldateien/CHATS und die kleinen neuen Belege lesen; keinen erledigten Test oder C0 neu starten.
2. Aus diesem Entwurf einen zentralen reviewbaren Umzugsplan erstellen, voraussichtlich als neue Runde35. Noch nicht angelegt und nicht aktiv; aktuelle Runde bleibt34 mit Pausen-/Planungsvorbehalt.
3. Für jedes Paket konkrete Eingaben, Abhängigkeiten, kleines Ergebnis, exklusive Dateipfade, Bediener, Befehle/Wirkungen, gezielte Abnahme, kleinsten Rückweg und sicheren Stopppunkt ergänzen.
4. Verbindliche erste Inventar-/Paketbindungsstufe von späteren Mutationen trennen. Fehlendes Restinventar und unzuverlässige Bedienung offen lassen; keine Zielversionen/Dateiquellen/Empfänger erfinden.
5. Rechtevertrag für getrennten nicht privilegierten Builder konkretisieren; Paket-/Buildskripte weder als root noch über einen Betreiber mit passwortlosem Vollsudo ausführen. Alte H1-Sudovorschläge nicht still übernehmen.
6. Neues synthetisches Ziel strikt von späterem Echtbestand trennen; Authprüfung ohne reale Mail nicht als Zustellabnahme ausgeben. Produktionsoperator init/mail bleiben nach aktuellem Code geschlossen; kein Guardbypass zur Testvereinfachung.
7. Plan Niklas vorlegen. Bis dahin keine Ausführungsaufträge, neuen Chats, Modellwechsel oder Fortsetzung des alten breiten H1-Auftrags.

## Gelesene Belege und offene Grenzen

- [H1-Einzelentwurf HOST](entwuerfe/HOST-01/H1-KONKRETER-AENDERUNGSPLAN-2026-10-20.md) und [HOST-Ergebnis](ergebnisse/HOST-01.md); ältere offene C0-Abschnitte sind historisch.
- [Runde34](ARBEITSRUNDE_34.md), [Betriebsvorlagen](../deploy/pilot/README.md), package.json/Lockfile; tatsächliches HEAD539bf2db8862edea310d558c4fc4e7f83725201f ist wegen vieler Änderungen/untracked Dateien kein vollständiger Releaseausgangspunkt.164 short-status-Pfade beim letzten Lesen; kein Reset/Clean/Worktree.
- Vorhandene CLIquellen persistence.mts (migrate/backup/restore), auth/operator.mts, production-operator-config.ts, Suchworker und Dienstvorlagen gelesen. Nur tatsächliche Schnittstellen verwenden; ältere HOST-L1-Annahmen mit Schema001–007/008 sind überholt, nicht als heutigen Gesamtfreigabeprüfer benutzen.
- Offizielle [Codex-Modellwahl](https://learn.chatgpt.com/docs/developer-commands#built-in-slash-commands) nennt Luna/Sol bei Verfügbarkeit; genaue Aufgabenaufteilung ist unsere Projektentscheidung. [Ubuntu SSH](https://ubuntu.com/server/docs/how-to/security/openssh-server/), [Ubuntu PostgreSQL](https://ubuntu.com/server/docs/how-to/databases/install-postgresql/), [Node22-Releases](https://nodejs.org/download/release/latest-v22.x/), [nip.io/sslip.io](https://nip.io/) und [ACME-Challenges](https://letsencrypt.org/docs/challenge-types/) lesend geöffnet. Quellenrecherche ist keine Zielabnahme.
- Kostenlose Unteradresse entschieden; Kandidat stex.62-171-162-115.sslip.io. DNS/TLS nicht abgenommen. HTTP-01 erfordert Port80; später nur Challenge, Wartung und konkret begrenzten Testzugang vorsehen. Kein gekaufter Domain-/Backupdienst.
- Frühere automatische Ablehnung des breiten H1-Mutationsauftrags bleibt wirksam: SSH-/sudo-/Firewall-/DB-/Proxy-/Dienständerungen waren nicht exakt samt Auswirkungen eingegrenzt. Aufgabenzerlegung umgeht dies nicht; genaue spätere Mutationen nach fertiger technischer Bindung und gegebenenfalls konkreter Freigabe.
- Keine neuen Kosten, echten Bestands-/Dokumenttransfers, realen Einladungen, öffentliche Öffnung oder bezahlten KI-Aufrufe. Planung, Korrektur und Check-in vertagt; übrige KI-/Schlüsselwege unverändert.
- Frühere Mac-Lastprobe wegen Speicherstop nicht wiederholen; daraus keine Linuxkapazität behaupten. Neue Linux-/HTTPS-/SMTP-/Offsite-/Geräte-/Echtbestandsabnahmen sind offen.

Dieser Zwischenstand sichert die begonnene Planung; er ist weder ein fertiger Umsetzungsplan noch eine Freigabe.

## Fortgesetzt und in Runde35 ausgearbeitet – 20.10.2026

Niklas hat mit „weiter, sind wieder back“ ausdrücklich fortgesetzt. Dieser gespeicherte Pausenstand bleibt historisch erhalten. Der fertige [Plan in Runde35](ARBEITSRUNDE_35.md) und die aktuelle Zuordnung in CHATS.json sind jetzt maßgeblich. Noch keine Ausführungsaufträge; zuerst Planvorlage.
