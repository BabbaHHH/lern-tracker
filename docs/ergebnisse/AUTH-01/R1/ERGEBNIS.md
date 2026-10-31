# AUTH-A-R1 — Abschluss der fünf lokalen Restvarianten

Stand: 13.10.2026. Auftrag aus Arbeitsrunde 16; Abschlussfortsetzung ausdrücklich nur Typkorrektur und Dokumentation. **16/16 gezielte API-/Prozess-Testeinträge bestanden**, ergänzt um tatsächliche Browserbedienung. I-02, I-05 und I-06 lokal geschlossen. A-06 und R-01 behalten die unten genannten Grenzen; kein vollständiger Onlinepilot.

## Ausgangsstand und Isolation

Die tatsächlich uncommittete Anwendung wurde gezielt in eine eigene temporäre Quellkopie übernommen, nicht aus dem alten Git-HEAD. [Quellstand und Prüfhilfen](quellstand.json) enthalten Zeitpunkt und Dateihashes. Die Momentaufnahme enthielt Migrationen 001–006 einschließlich des bereits vorhandenen C2-Zwischenstands. Alle diese Migrationen wurden ausschließlich lesend in eigenen synthetischen Datenbanken angewendet; AUTH änderte keine Migration.

Keine `.env.local`, dauerhaften Datenbank-/Dateibestände, vorhandenen Sitzungsdaten, privaten Lernunterlagen oder generierten gemeinsamen Ausgaben kopiert. Installierte Abhängigkeiten wurden über einen lesenden `node_modules`-Verweis wiederverwendet; kein Paketwechsel. Better Auth 1.7.7, PostgreSQL 18.4, Node 22.14.0 und Next 16.4.0 aus diesem Stand. Eigene temporäre Cluster, Datenbanken, Dateispeicher und zufällige Loopback-Ports. Neue Prüfhilfen und Belege sind der einzige AUTH-Schreibbereich neben Ergebnis und Matrix.

Die Quellkopie wurde nach den Prüfungen erneut gegen ihre erfassten Anwendungs-/Migrationshashes geprüft: unverändert. Die parallel weiterentwickelte gemeinsame Anwendung wird dadurch nicht als neu insgesamt abgenommen. Es gab keine Gesamtprüfung, keinen Produktionsbuild und keinen Zugriff auf echte Browser-Lerndaten. Für die Browserfälle wurden lediglich die benötigten Seiten der eigenen Next-Entwicklungsinstanz kompiliert.

## Prüfungen und konkrete Ergebnisse

| Fall | Tatsächlich ausgeführt | Ergebnis / Grenze |
|---|---|---|
| I-02 | Gültige Einladung C über lokales synthetisches Postfach zweimal öffnen; Einrichtungsseite insgesamt dreimal einschließlich Reload. Keine Registrierung absenden. | Konto unverändert `pending/member`, Revision 1; vorher/nachher jeweils 0 Authidentitäten, Passwortkonten, Besitzerzuordnungen und verbrauchte Einladungen. Ohne Authidentität auch keine C-Sitzung. Mailvorschau verbraucht nichts. **Lokal geschlossen.** |
| I-05 | Eigenen Appprozess hart mit `SIGKILL` beenden: vor Reservierung, innerhalb der echten Bibliothekstransaktion vor Credentialcommit, nach Authcommit und unmittelbar vor Appfinalisierung. Danach neuer Appprozess und Wiederaufnahme. | Vor Authcommit 0 persistente Identitäten/Passwortkonten; danach genau 1 Identität und 1 Passwortkonto, aber 0 Fachzuordnungen/Verbrauch. Teilzustand hat Login 401. Wiederaufnahme erzeugt genau 1 Zuordnung/Verbrauch und erhält Besitzer-ID sowie vorhandene Auth-ID und ursprüngliches Passwort. **Lokal geschlossen.** |
| I-06 | Einladung tatsächlich während pausierter Anlage ablaufen lassen; Widerruf/Neusendung bei laufender Anlage jeweils mit Abschluss und mit hartem Abbruch kombinieren. | Ablauf vor Finalisierung: 403, keine Zuordnung. Gewinnt die Anlage, warten Verwaltungsaktionen auf die echte Writer-Sperre und liefern nach Verbrauch 409. Stirbt die Anlage, committen Widerruf/Neusendung; alter Nachweis 403, Teilzustand Login 401. Erneute Einladung setzt denselben Claim fort, keine zweite Identität/kein Passwortersatz. **Lokal geschlossen.** |
| A-06 | Über echte HTTP-Cookies: erfundenes Cookie und gültiges, zuvor gesetztes A-Cookie vor B-Anmeldung; alter A-Nachweis danach; Abmelden/Replay; Admin mit vorgegebenem Cookie und tatsächlichem TOTP. Im Browser echte A-Anmeldung, anschließende B-Anmeldung ohne vorheriges Abmelden, B nach Reload. Formularattribute für Anmeldung, Einrichtung und Reset prüfen. | Neue Anmeldung erhält neuen Bibliotheksnachweis und richtige Besitzer-ID; alter A-Nachweis erhält ausschließlich A, niemals B. Erfundenes/abgemeldetes Cookie 401; Admin erreicht Verwaltung erst mit tatsächlichem Faktor. Browser zeigt A→B und B nach Reload. **Teilprüfung bestanden; reale Passwortmanager-Autofill-/Zweitgerätefälle weiter offen.** |
| R-01 | Echter Bibliotheksreset bei unbestätigtem pending, bestätigtem pending, blocked und Admin; unbekannte Adresse; abgelaufener tatsächlicher Resetnachweis. | Neutrale Antwort, keine Mail für unbekannt. Besitzer/Auth-ID, Status, Rolle und Konto-Revision erhalten; Faktor-/Recoverydaten und persönliche Datensätze unverändert. Blocked bleibt gesperrt; unbestätigt bleibt unbestätigt; pending bleibt ohne Fachzugriff. Admin verlangt nach Reset weiterhin TOTP. Abgelaufener Link: Fehlerredirect/Reset 400, Passwort, Generation und vorhandene gültige Sitzung unverändert. **Alle beauftragten lokalen Statusvarianten bestanden; externe Zustellung weiter offen.** |

### Art der Fehlersteuerung

Die Prozessfälle verwenden die reale `AccountService`-Implementierung, Better-Auth-Sitzungen und PostgreSQL. `SessionClient` ist ein HTTP-Testclient, kein grafischer Browser und kein simulierter Principal. Datenbanksperren und temporäre Trigger ausschließlich in synthetischen Testdatenbanken markieren die tatsächlich erreichten Fehlerpunkte; der vorhandene interne `afterSignup`-Prüfhook markiert den abgeschlossenen Authcommit. Keine Hooks in Anwendungscode ergänzt.

Im abschließenden Lauf wurde allein der eigene Appprozess mit `SIGKILL` beendet. PostgreSQL erkannte die Verbindungsschließung selbst; keine explizite Backendterminierung im finalen Prüfweg. Nach Freigabe der Prüfsperren wurden Verbindungsschließung und persistenter Zustand beobachtet, bevor ein neuer Prozess denselben Vorgang fortsetzte. Die Anwendungskonten wurden nicht durch direkte Datenbankänderungen künstlich angemeldet. Admin und Mitglieder entstehen über echte Einladungen, Bibliotheksbestätigung, Passwortsitzung und verifiziertes TOTP.

### Browser- und Passwortmanagergrenze

Die tatsächliche Browserprüfung lief im Codex-In-App-Browser auf der eigenen Next-/PostgreSQL-Instanz mit festem `localhost`-Origin. Getrennte Tabs/Instanzen sind keine Zweitgeräteabnahme. Geprüft: Mailvorschau und mehrmaliges GET, schreibgeschützte Zieladresse, `username`/`current-password`/`new-password`, Passwortfelder und Längengrenzen, reguläre native Formularbefüllung, A→B-Sitzungswechsel und Neuladen. Keine Passwörter im Passwortmanager gespeichert und keine vorhandenen Browser-Lerndaten gelesen oder übernommen.

Die Hilfsportal-Cookieinjektion über einen zweiten Port wird **nicht** als vollständiger grafischer Sessionfixationsnachweis verwendet. Maßgeblich sind der reproduzierbare Cookie-Fixationstest über HTTP und der tatsächliche Kontowechsel im selben Next-Origin. Kurzfristige Ladeansichten wurden erst nach Abschluss des Kontoabrufs bewertet. Ein blockierter direkter JSON-API-Aufruf im In-App-Browser wurde nicht umgangen und zählt nicht als Anwendungsbefund.

Nicht geprüft: automatische Befüllung eines tatsächlich eingerichteten Passwortmanagers, echte Safari-/iPad-/Handybedienung und Mail-App-/Gerätewechsel. A-06 bleibt deshalb in der Gesamtmatrix **ausstehend mit bestandenen lokalen Teilprüfungen**.

### Mail- und Resetgrenze

Bestätigungs- und Resetlinks stammen aus der tatsächlichen Bibliothek und werden über echte HTTP-Navigation eingelöst. Der Versand bleibt die verschlüsselte lokale PostgreSQL-Mail-Senke. Die Tests belegen Erzeugung, Adresszuordnung, Linknutzung und die Resetwirkung; sie belegen weder SMTP-Versand noch Erreichbarkeit, Spamfilter oder Zustellbarkeit eines externen Postfachs. R-01 bleibt deswegen **ausstehend mit bestandenen lokalen Status-/Ablaufvarianten**. Ein Passwortreset ersetzt keine persönliche Aktivierung und deaktiviert keinen Adminfaktor.

## Belege

- [Abschließendes API-/Prozessprotokoll](api-pruefung.log): 15 gezielte Unterfälle plus übergeordneter Test, 16 bestanden, 0 fehlgeschlagen/übersprungen.
- [Strukturierte API-Ergebnisse](api-ergebnisse.json): Zustände, Zähler, Statuscodes und Besitzererhalt; keine Cookies, Passwörter, Tokens oder Faktoren.
- [Browserbeobachtungen](browser-beobachtung.json) und [Datenbankvergleich vor/nach GET](browser-db-ergebnisse.json).
- [Einrichtungsseite](einladung-get.png), [unverbrauchte Einladung](einladung-unverbraucht.png), [B nach Kontowechsel und Reload](browser-kontowechsel.png). Ausschließlich synthetische Angaben, keine Sicherheitslinks oder Wiederherstellungscodes im Bild.
- [Abschließende Prüfung der neuen Dateien](abschluss-pruefungen.json): gezieltes Lint und isolierte Typprüfung. Keine vollständige Projektprüfung.

## Eigene Dateien und Abschlusskorrektur

Neu: `tests/auth-restfaelle.test.ts`; `scripts/auth/restfaelle/{snapshot.mts,worker.mts,helpers.ts,browser.mts}`; Belege in diesem R1-Ordner. Aktualisiert: AUTH-Ergebnis und fünf betroffene Matrixzeilen. Anwendung, Paketdateien, Schema, Sicherung und vorhandene Prüfdateien blieben read-only.

Zwei zuletzt gemeldete TS2741-Fehler in den eigenen Prüfhilfen behoben: die bereinigte Kindprozessumgebung wird nun ausdrücklich mit `NODE_ENV: "development"` initialisiert. Danach nur diese Hilfen gezielt gelintet und typgeprüft; die vorhandenen 16 bestandenen Funktionsprüfungen und die Browserprüfung wurden gemäß Abschlussauftrag nicht erneut gestartet. Der außerhalb der Isolation liegende Test überspringt sich ausdrücklich und startet keine zusätzliche PostgreSQL-Prüfung in einer allgemeinen Testsammlung.

## Reproduktion und bekannte Grenzen

Gezielte Quellkopie und API-/Prozessprüfung aus dem Anwendungsordner:

```sh
node --import tsx scripts/auth/restfaelle/snapshot.mts --keep-source
```

Der Helfer protokolliert die tatsächlichen Dateihashes, kopiert keine private Konfiguration und nennt den eigenen temporären Quellpfad. Der zusätzliche Browserhelfer wird bei Bedarf ausdrücklich in dieser Kopie mit `STEX_AUTH_R1_SNAPSHOT=1` und einem absoluten `STEX_AUTH_R1_REPORT_ROOT` gestartet. Er erstellt eigene synthetische Laufzeitdaten; das lokale Postfach und die Cookiehilfen gehören ausschließlich zu diesem Prüfvorgang. Nicht als öffentliches Produktpostfach oder produktive Kontoverwaltung verwenden. Die private Steuerdatei enthält nur synthetische Prüfdaten und wird beim geordneten Abschluss entfernt.

Im ersten Browserprüfaufbau mit festem `127.0.0.1`-Origin wurde ein Signup-403 beobachtet. Die finale Browserprüfung verwendet den bereits dokumentierten festen `localhost`-Origin und besteht. Eine zusätzliche Origin-Diagnose wurde wegen ausgefallener automatischer Freigabeprüfung beim Verbrauchslimit nicht ausgeführt; der ungetestete Diagnosezweig ist entfernt. Das ist **kein bestätigter Fehler in einem der bestandenen R1-Kriterien**. Falls Unterstützung für einen festen numerischen Host erforderlich wird: `src/lib/server/auth/runtime.ts` (zulässiger Host) und `src/lib/server/auth/security.ts:sameOrigin` (von Next gelieferter Request-Origin/Host) gezielt abgleichen, bevor ein produktiver Codeumbau erfolgt.

In den beauftragten, abschließend geprüften Varianten wurde kein reproduzierbarer Produktfehler und kein zwingend fehlender Anwendungshook nachgewiesen. Die Aufräumreihenfolge der neuen Prüfhilfe wurde vor dem abschließenden 16/16-Lauf korrigiert. Eigene Laufzeiten sind beendet; beide anhand ihrer R1-Identität erkannten temporären Quellkopien und die eigenen temporären Logs sind entfernt. Der Pfad im Quellstandbeleg ist ausschließlich historischer Identitätsnachweis; kein fremder Prozess und keine gemeinsame generierte Ausgabe wird bereinigt. Kein Auftrag an andere Chats, keine weitere Testserie, Automation oder Folgeimplementierung gestartet.
