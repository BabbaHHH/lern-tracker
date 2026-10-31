# Bestandsaufnahme Stex Countdown · 23.10.2026

## Ergebnis

Hosting und persönlicher Adminzugang funktionieren. Die vertraute lokale Anwendung ist **noch nicht vollständig mit gleicher Oberfläche und gleichem Funktionsumfang online**. Die sichtbare Abweichung ist im Code belegt: Der Onlinebetrieb aktiviert eine parallel entwickelte Kontotestansicht. Diese ersetzt Navigation, Seitenaufbau und mehrere Abläufe. Das ist mehr als ein reiner Hostingumzug.

Der Originalcode ist erhalten. Der letzte lesende Vergleich vom 22.10. belegt 281 identische Src-Dateien zwischen aktuellem lokalen Quellstand und übertragenem Archiv; HOST hatte dieselben Archivquellen gegen den Server geprüft. Spätere Serverkorrekturen betrafen Start-/Operatorwerkzeuge, nicht diese Produktquellen. Das beweist vorhandenen Code, nicht gleichen sichtbaren Funktionsumfang: je nach Betriebsmodus werden verschiedene Komponenten ausgeführt.

Vergleichsbasis dieser Bestandsaufnahme ist die erhaltene Browserfassung im aktuellen Quellstand, nicht ein ungeprüfter alter Git-Commit oder ein angenommener Screenshot. Es wurden Code und vorhandene native Betriebsbelege gelesen; keine Tests, Builds, KI-Aufrufe oder Änderungen an Anwendung und Daten durchgeführt.

## Was tatsächlich auf dem Server belegt ist

- Erreichbarer geschlossener HTTPSbetrieb mit vertrauenswürdigem Zertifikat, bestehender Beschränkung auf die bestätigte Betreiberverbindung und privaten App-/DB-Verbindungen.
- Linuxrelease, PostgreSQL, 17 Migrationen und gezielte Runtime-Rechte.
- Automatischer Zertifikatsprüfdienst/Timer eingerichtet. Ein echter fälliger Zertifikatswechsel war beim bisherigen Einrichtungsbeleg nicht nötig; kein neuer Wartungslauf in dieser Bestandsaufnahme ausgelöst.
- Persönliche Registrierung und Adressbestätigung, echte Authenticator-Verifikation und regulärer Adminabschluss. Native Abschlussdaten zeigen active/admin, emailVerified=true, factorVerified=true, Bootstrap abgeschlossen und alte Sitzungen widerrufen. Niklas meldet anschließend erfolgreiche Anmeldung.
- Der beim ersten Registrierungsversuch gefundene Originfehler ist durch einen eigenen Serverstarter behoben. Die fünf geprüften falschen Host-/Origin-/Headerkombinationen bleiben gesperrt.
- Der persönliche Zugang wurde ohne externen Mailversand über private Einmal-Links eingerichtet.

Das ist eine betriebsfähige geschlossene Instanz mit Zugang. Daraus folgt noch keine vollständige Onlineabnahme aller Lernfunktionen.

## Oberfläche und Funktionsunterschiede

| Bereich | Erhaltene Browserfassung | Aktiver Kontobetrieb | Was fehlt bzw. abweicht |
|---|---|---|---|
| Navigation und Gestaltung | Bisherige Desktop-/Mobilnavigation mit Icons, Themeauswahl und vertrauten Abständen | Zusätzliche lineare Navigation mit ausdrücklich sichtbarer Bezeichnung „Kontotestansicht“ | Gemeinsame ursprüngliche Gestaltung ist nicht wiederhergestellt |
| Startseite | Countdown, Tagesprogramm, separate Klausur-des-Tages-Karte, Themenübersicht, schwebender Check-in und Backuphinweis | Eigene Lernübersicht; Countdown und Themenbausteine teils wiederverwendet, Tagesprogramm über AccountDayPanel | Alter Seitenaufbau, eigenständige Klausur-des-Tages-Karte und gleiche Bedienung fehlen |
| Themen und Lernfortschritt | Bisherige Themenansicht mit Browserdaten | Dieselbe Themenansicht wird über einen Kontodatenadapter versorgt | Anschluss vorhanden; alter persönlicher Fortschritt wurde nicht automatisch übernommen |
| Profil und Einstieg | Mehrstufiges Onboarding mit Terminen, Lernstand, Dokumenten und KI-Planerstellung | Separate manuelle Seite „Profil & Stationen“, eigene Dokumentablage | Der vertraute vollständige Einstieg bis zum neuen KI-Plan fehlt |
| Wochen-/Monatskalender und Tagesprogramm | Bisherige Kalender-/Tagesansichten mit Aufgaben, Terminen und Historie | Eigene Kontokalender mit serverseitigen Aufgaben, Terminen, Tracking und bestätigter Tagesvorbereitung | Datenfunktionen sind implementiert; Darstellung und Ablauf unterscheiden sich. Vollständige Gleichwertigkeit online nicht abgenommen |
| Lernplan | Bisherige KI-Erstellung und Anpassung mit Planungskontext | Text-/JSON-Entwürfe speichern, Vorschau, bewusst übernehmen und rückgängig machen | Neue KI-Erstellung ist nicht angeschlossen und zusätzlich im Pilot gesperrt |
| Klausuren | Bisherige /klausuren-Seite mit persönlichen Verknüpfungen und Bearbeitung | /klausuren wird durch die Kontogrenze geschlossen; eigener Katalog unter /konto/klausuren und Suche darunter | Alter integrierter Klausurablauf und tatsächliche Sammlung nicht gleichwertig online verfügbar |
| Schreiben | Bisheriger Schreibworkspace einschließlich KI-Korrektur | Eigene Kontofassung mit Entwürfen, Editor und bestätigtem Autosave; Teile des Editors werden wiederverwendet | Gleiche Oberfläche nicht hergestellt; KI-Korrektur bleibt ausdrücklich gesperrt |
| Persönliche Dokumente | Dokumenttexte können in den bisherigen Planungskontext eingehen | Eigene Originalablage mit Versionen, Download und Metadaten | Hochladen ist vorhanden, automatische Auswertung und Übergabe in neue KI-Pläne fehlen |
| Einstellungen und Themes | Bisherige lokale Themeauswahl, Prompts, Modelle und Gewichte | Kontoeinstellungen sind separat gespeichert; AccountSettingsProvider kann das Kontotheme anwenden | Nicht alle alten Bedienelemente sind in der gewohnten Oberfläche vorhanden; lokale Einstellungen sind nicht automatisch migriert |
| Feedback und Verwaltung | Bisheriges Feedbackwidget sowie lokale /feedback- und /admin-Seiten | Widget im Kontomodus ausgeblendet; diese alten Seiten werden nicht durchgelassen. Kontoverwaltung und Kontoeinstellungen sind getrennte Ersatzwege | Bisheriger Feedbackablauf fehlt online; neue Kontoverwaltung ist ein anderer Zweck als die alte Einstellungsseite |

Die globale CSS-Datei und Originalkomponenten fehlen somit nicht einfach auf dem Server. Der wichtigste Auslöser ist die Auswahl anderer Ansichten durch STEX_LEARNING_MODE=account.

## Bewusst gesperrt, nicht bloß versteckt

Der Produktionsguard in src/lib/server/pilot-ai-guard.ts gibt für **KI-Lernplanung, KI-Check-in und KI-Korrektur** HTTP 503/pilot_ai_deferred zurück. Diese Entscheidung stammt aus dem begrenzten ersten Pilotumfang. Sie ist unabhängig davon, ob ein KI-Schlüssel eingetragen wurde. Vorhandene lokale Implementierung oder auswählbare Modelle bedeuten daher keine Freischaltung am Server.

Es gibt widersprüchliche Oberflächentexte: Die Lernübersicht behauptet einen angeschlossenen Abend-Check-in, während die Produktion ihn sperrt. Die Planseite spricht von späteren Quelluploads, obwohl die separate persönliche Originalablage bereits implementiert ist. Solche Hinweise müssen beim Zusammenführen der Oberfläche aktualisiert werden; sie sind keine zuverlässige Fertigmeldung.

## Daten und noch nicht belegter Betrieb

**Der echte Altbestand ist noch nicht umgezogen.** Die Servereinrichtung begann mit einer leeren Testdatenbank; der persönliche Zugang kam danach hinzu. Es gibt keinen abgeschlossenen Transfer des bisherigen Browserkatalogs mit rund 450 klassifizierten Klausuren und der zugehörigen PDFs. Auch Fortschritt, Notizen, Termine, Schreibtexte und Einstellungen wurden nicht automatisch vom alten Browserursprung in dieses Konto übernommen. Neue Eingaben des Nutzers auf dem Server sind davon zu unterscheiden.

Vorhandene Migration-/Importwerkzeuge und lokale Nachweise sind keine tatsächlich erfolgte Bestandsübernahme. IDs, Klassifizierungen, persönliche Notizen und Kalenderverknüpfungen müssen bei einem später konkret beauftragten Transfer erhalten bleiben.

Weitere Grenzen:

- Sicherungs-/Restorecode mit lokal nachgewiesenen Abläufen ist vorhanden. Ein regelmäßiger unabhängiger Serverbackup- und tatsächlicher Serverrestore-Nachweis ist in den übernommenen Livebelegen noch nicht abgeschlossen.
- Suchseiten, Suchschnittstellen und Worker-Code sind vorhanden. Ein fertig eingerichteter, belegter Suchworker auf diesem VPS und ein Index des tatsächlichen Klausurbestands sind noch nicht belegt.
- Konto-CRUD für Profil, Fortschritt, Kalender, Schreiben, Dokumente und Einstellungen wurde lokal entwickelt und geprüft. Ein vollständiger realer Nutzerablauf durch alle diese Funktionen auf dem aktuellen Server wurde bisher nicht abgenommen.
- Regulärer externer Einladungs-/Verifikations-/Passwortresetversand ist weiterhin nicht eingerichtet. Die manuelle Einrichtung dieses einen Kontos ersetzt keinen automatischen Mailbetrieb.
- Echte Mehrgeräte-/iPad-Nutzung und Betriebsverhalten unter mehreren Nutzern sind offen; lokale Testberichte oder ein erfolgreicher Login ersetzen diese Nachweise nicht.

## Kürzester Weg zur vertrauten Anwendung online

1. **Oberfläche zusammenführen:** Ursprüngliche Navigation, Startseite, Kalender- und Schreibgestaltung als Referenz verwenden. Bereits vorhandene Kontodatenadapter nutzen, anstatt weitere Ersatzseiten zu bauen. Eine feste Vergleichsliste je Seite verhindert, dass nur Farben angeglichen werden und Abläufe fehlen.
2. **Fehlende Alt-Abläufe ausdrücklich entscheiden und anschließen:** Vor allem Einstieg/Planerstellung, Klausur-des-Tages-Auswahl und vollständiger Klausur-/Schreibablauf. Bei KI-Funktionen die dokumentierte Pilotbegrenzung und erforderliche konkrete Aufruffreigabe beachten.
3. **Datenumzug absichern:** Benannten Quellbestand, Sicherung und tatsächlich bewiesenen Rückweg festlegen; danach den konkret freigegebenen Altbestand mit erhaltenen IDs und Verknüpfungen übernehmen. Kein pauschaler Import des gesamten privaten Projektordners.
4. **Gezielte Endabnahme mit Niklas:** Profil → Wochenplan → konkrete Klausur/PDF → Schreiben → Speichern → Neuanmeldung. Nur tatsächlich geänderte oder bisher offene Verbindungen prüfen, keine Wiederholung der fertigen Serverinstallation.
5. Regulären Mailbetrieb und für weitere Nutzer nötige Betriebsreste anschließend im vorgesehenen Umfang abschließen.

Diese Liste ist eine Bewertung und Reihenfolge, kein neuer Umsetzungsauftrag. Der aktuelle Auftrag ist ausschließlich Bestandsaufnahme.

Ein bloßes Umschalten auf den alten lokalen Modus wäre keine vollständige Migration: Diese Seiten lesen und schreiben zum Teil Browserdaten bzw. lokale Dateischnittstellen. Unter dem neuen HTTPSursprung stünden die bisherigen Browserdaten ohnehin nicht automatisch zur Verfügung.

## Arbeitsstand und Belege

Die gemeinsame lokale Kopie enthält 44 geänderte getrackte Pfade; 34 davon liegen in src. Zusätzlich bestehen viele ungetrackte neue Module und Dokumente. Das ist ein erheblicher Umbau, aber kein Maß für fehlende oder fertige Funktionen. Ein Reset auf den alten HEAD würde den aktuellen gemeinsamen Arbeitsstand gefährden und ist kein Wiederherstellungsplan.

Wesentliche Belege:

- [Aktiver Adminzugang](HOST_ADMINABSCHLUSS_2026-10-23.json)
- [Erhaltener lokaler Quellstand gegenüber übertragenem Archiv](HOST_U09_LOKAL_ARCHIV_QUELLVERGLEICH_2026-10-22.json)
- [HTTPS und Dauerbetrieb](HOST_U09_ONLINE_STATUS_2026-10-22.json)
- [Korrigierte Originintegration](HOST_REGISTRIERUNG_ORIGIN_ABSCHLUSS_2026-10-22.json)
- [Zertifikatsprüfung/Timer](HOST_U09_ZERTIFIKATSERNEUERUNG_2026-10-22.json)
- Layoutmodus: src/app/layout.tsx:25
- Ersatznavigation und Seitengrenze: src/components/account-learning-boundary.tsx:13
- Getrennte Startseite: src/app/page.tsx:28 und src/components/account-learning-dashboard.tsx:12
- Getrennter Planablauf: src/components/account-plan-page.tsx:10
- Bewusste KI-Sperren: src/lib/server/pilot-ai-guard.ts:9
- Kontotheme statt Browserbootstrap: src/components/account-settings-provider.tsx:12
