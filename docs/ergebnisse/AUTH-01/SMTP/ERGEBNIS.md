# AUTH03 — SMTP-Adapter ohne echte Zustellung

Stand: 18.10.2026. **Begrenzter Adapter und Einzelbatch-Einstieg implementiert; 15/15 neue instrumentierte Fälle, Typprüfung und Lint bestanden.** Keine echte SMTP-/Empfänger-/Providerverbindung, kein SMTP-DNSlookup und kein tatsächlicher Mailbatch/Betreiberbefehl ausgeführt. Öffentliche Authruntime bleibt unverändert 503.

**Enger Abschlussreview danach:** Ein tatsächlich vorhandener Connect-Callbackfehlerpfad wurde zusätzlich korrigiert; genau ein neuer gezielter Fall bestand, ohne die früheren15 Fälle zu wiederholen. Finale Quellen und Belege sind entsprechend fortgeschrieben. Details unten unter „Connect-Callbackreview“; keine behauptete vollständige16-Fälle-Neuabnahme.

## Auftrag und Lieferumfang

Maßgeblich ist das jüngste exklusive AUTH03-SMTP-Fenster in Runde 33/Koordination/Briefing. Bestehende gemeinsame Arbeitskopie samt umfangreichem uncommittetem Stand erhalten; kein Reset/Clean/Worktree oder Commit. Dieser dritte begrenzte Abschluss im frischen AUTHverlauf wurde zentral vorab zugeordnet; vor größerer Folgeumsetzung ist die Rotation vorgesehen.

Neue Dateien:

- `src/lib/server/auth/smtp-config.ts`: reiner expliziter SMTPvertrag, keine Datei-/Netz-/Geheimniserzeugung.
- `src/lib/server/auth/smtp-transport.ts`: injizierbarer Adapter auf öffentlichen Nodemailer-Sitzungs-/MIME-APIs, ohne eigenes SMTPprotokoll oder interne Wiederholungsschleife.
- `scripts/auth/mail-dispatch.mts`: expliziter Produktions-Einzelbatch `once`, importierbar ohne Start. Keine Watch-/Daemonfunktion und keine automatische Runtimeanbindung.
- `tests/auth-smtp.test.ts`: neue rein instrumentierte Konfigurations-/Lebenszyklus-/CLIgrenzen plus lokale MIMEerzeugung durch die echte Bibliothek.

Geändert ausschließlich `package.json`/`package-lock.json`: **`nodemailer` exakt 10.1.2**, keine weiteren neuen Pakete und keine Änderung bestehender Paketversionen. Installierte Bibliothek verlangt Node >=20, passend zum vorhandenen Appvertrag >=22.13.0; Typen bereits enthalten, kein zusätzliches Typenpaket. Installation mit `--ignore-scripts --no-audit --no-fund`. Die erste Metadatenabfrage scheiterte an der Sandbox-DNSgrenze; die ausdrücklich benötigte öffentliche npm-Abfrage/Installation war anschließend mit Werkzeugfreigabe möglich. Ausschließlich öffentliche Dokumentations-/Paketquellen kontaktiert; keine SMTPzieladressen oder privaten Inhalte dabei übertragen.

`mail-transport.ts` benötigte keine Typänderung. Dispatcher, Authservice/-runtime, Produktionsleser, Schema 001–016, Backup, Layout/KI und bestehende Betreiber-/Suchmodule blieben unverändert im geschützten Quellenvergleich. Zentrale Dateien nicht geschrieben; eigene Belege und AUTH-Ergebnis ergänzt.

## Bibliotheksgrundlage

Offizielle Primärdokumentation geprüft: [SMTPConnection](https://nodemailer.com/extras/smtp-connection) beschreibt die verwendeten öffentlichen connect/login/send/close-Methoden und Fehlerereignisse. Die mit Nodemailer ausgelieferte Klasse verarbeitet SMTP einschließlich STARTTLS; unser Adapter steuert nur Sitzungsablauf und Ergebnisabbildung. [Mailcomposer](https://nodemailer.com/extras/mailcomposer) erstellt die MIME-Nachricht. Dadurch ist kein eigener Parser für SMTP oder MIME nötig.

[SMTPoptionen](https://nodemailer.com/smtp) und [Fehlerreferenz](https://nodemailer.com/errors) wurden für TLS, Fristen und strukturierte Fehlerfelder gelesen; zusätzlich die tatsächlich installierten Deklarationen/Implementierungen für `secure`, `close`, `send` und finale DATAantwort lesend geprüft. Ein gewöhnliches nicht gepooltes Transport-`close` verwaltet nicht die aktive Verbindung; die öffentliche SMTPConnection erlaubt hier das unmittelbar aufrufbare Schließen beim Abort. Keine privaten Bibliotheksfelder verwendet. Version und Integrität aus öffentlichem npm-Metadatensatz, installierter Paketdatei und Lockfile gegengeprüft, siehe [Quellzuordnung](quellstand.json).

## Expliziter Konfigurationsvertrag

| Variable | Vertrag |
|---|---|
| `STEX_SMTP_HOST` | Expliziter kleingeschriebener DNSname; keine URL, IP-/localhost-Angabe oder impliziter Host. |
| `STEX_SMTP_PORT` / `STEX_SMTP_TLS` | Genau `465` + `implicit` oder `587` + `starttls`. Keine Klartext-/opportunistische Alternative. |
| `STEX_SMTP_USER` | Expliziter nicht leerer Login, höchstens 254 Zeichen, ohne Steuerzeichen/Randwhitespace. |
| `STEX_SMTP_PASSWORD` | Explizites separates Passwort, 16–1024 Zeichen, ohne Steuerzeichen/Randwhitespace; nicht gleich übergebenem Auth-/Mailsecret. Keine Datei-, URL- oder Generierungsfallbacks. |
| `STEX_SMTP_FROM_ADDRESS` | Genau eine einfache ASCII-Mailbox mit DNSdomain; keine Listen, Anzeigenamen oder Kommentare. |
| `STEX_SMTP_FROM_NAME` | Expliziter Anzeigename, höchstens 100 Zeichen, keine Steuerzeichen/Randwhitespace. |

`SMTP_URL`, `STEX_SMTP_URL` und globales `NODE_TLS_REJECT_UNAUTHORIZED=0` werden abgewiesen. Weitere ungeprüfte Optionen aus Umgebung/URLs werden nicht weitergereicht. Feste HTTPS-App-Origin muss ohne Pfad-/Query-/Credentialteile vorliegen; der CLI benutzt dafür den vorhandenen vollständigen Produktionsleser. Kein aktueller Umgebungswert wurde gesetzt oder private Konfiguration eingelesen.

Verbindungsoptionen werden selbst fest aufgebaut: Zertifikatsprüfung `rejectUnauthorized:true`, Hostname/SNI explizit, mindestens TLS1.2, `requireTLS:true`, kein `ignoreTLS` oder `opportunisticTLS`, kein LMTP. Vor Login wird das von der Bibliothek bestätigte `secure` zusätzlich geprüft. DNSfrist drei Sekunden, Verbindung/Greeting/Socket jeweils fünf Sekunden, gesamte einzelne Sitzung acht Sekunden. Das passt unter den unveränderten Dispatcherstandard von zehn Sekunden. Keine `verify()`-Probeanmeldung oder Testkontoanlage.

## Nachrichten, Ergebnis und Abbruch

Empfänger ist eine einzelne validierte Mailbox; Steuerzeichen, Empfängerlisten und manipulierte Message-IDdaten werden vor jeder Bibliotheksinstanz abgewiesen. URLs müssen denselben bekannten Authpfaden/der festen Origin entsprechen; doppelte/unbekannte Queryparameter und fremde Rücksprungziele abweisen. Die aktuelle DB-/Nachweisprüfung bleibt beim unveränderten Dispatcher; der SMTPadapter ersetzt sie nicht.

Feste deutsche Betreffzeilen für Einladung, Bestätigung und Reset; ausschließlich einfacher Text mit dem geprüften persönlichen Link. Absender und genau ein Empfänger werden zusätzlich als festes SMTPenvelope übergeben. Message-ID ist stabil aus der Mail-ID gehasht, ohne Bearertoken; daraus folgt keine garantierte Providerdeduplizierung. Kein HTML, Anhang, frei übergebener Header oder Contentpfad; Datei-/URLquellen im Composer ausdrücklich deaktiviert. Keine Inhalte/Links/Credentials/Serverantworten in Loggern; Bibliothekslogger, Debug und Transaktionslogs abgeschaltet.

`accepted` wird nur aus erfolgreichem Sendcallback mit genau dem erwarteten angenommenen Empfänger, ohne abgewiesenen Empfänger und mit finaler 2xx-Antwort zurückgegeben. Das bedeutet SMTPannahme, keine Postfachzustellung. Eine sichere negative 4xx-/5xx-Antwort zu MAIL FROM/RCPT TO/DATA erlaubt die passende vorübergehende/endgültige Ablehnung. Andere Fehler nach Sendebeginn bleiben `unknown`. Vor Sendebeginn ist Nichtannahme belegbar; Auth-/TLSkonfigurationsfehler dabei endgültig, andere Verbindungsfehler innerhalb der vorhandenen Dispatchergrenzen wiederholbar.

Abort, absolute Frist, Streamfehler und Verbindungsende schließen die öffentliche Verbindung und zerstören den Stream. Nach begonnenem `send` bleibt das Ergebnis bei Abort/unklarer Unterbrechung `unknown`; spätere Callbacks überschreiben es nicht. Während eines aktiven Versuchs nimmt dieselbe Instanz keine zweite Nachricht an. Keine Pool-/Bibliotheks-/Adapterwiederholung. Netzwerkabbruch nach möglicher Annahme kann trotzdem bereits zugestellte Mail bedeuten; keine exactly-once-, Rückruf- oder Zustellgarantie. Die bereits dokumentierte Widerrufslücke zwischen letzter DBprüfung und tatsächlicher Transportannahme bleibt bestehen.

## Einzelbatch und geprüfter Umfang

Der CLI akzeptiert ausschließlich `once` ohne weitere Argumente. Er validiert **vollständige Produktions- und SMTPkonfiguration vor Ressourcen**, verwendet den gemeinsamen expliziten DBvertrag und ruft exakt einen begrenzten Dispatcherbatch auf. Keine Migration, Schlüsselanlage oder Produktionsruntimeöffnung. Ausgabe ausschließlich feste numerische Zähler; Fehler generisch ohne ursprüngliche Ursache. Der DBpool wird in `finally` geschlossen. Die ausführbare Fähigkeit ist keine aktuelle Versand-/Betriebsfreigabe; **hier wurde sie nicht real ausgeführt**.

[15 neue Fälle](tests.log), null Fehler/übersprungen: Konfigurationsmodi/Pflichtwerte/Overrides und Injektion, import-/konstruktionsfreies Verhalten, Preabort/ungültige Mails ohne Verbindung, TLS-/Envelope-/Logging-/Fristoptionen, unsicherer Handshake ohne Login, finale Annahme, explizite Negativantwort vs Verbindungsunsicherheit, Authfehler, Abort vor/nach Sendebeginn, Deadline mit verspäteten Callbacks, konkurrierende Nutzung, Event-/Stream-/Fabrikfehler, drei feste Nachrichtenzwecke mit echter lokaler MIMEerzeugung, CLIvalidierung vor Ressourcen, Einmalbatch/Zähler/Poolbereinigung und unveränderte Eingaben. Sitzungen und CLIressourcen vollständig instrumentiert; keine künstliche SMTPserverinstanz erforderlich und keine echte Verbindung aufgebaut. Timer werden für den Deadlinefall instrumentiert ausgelöst, keine achtsekündige Netz-/TLSmessung behauptet.

Erster Typdurchlauf fand ausschließlich unvollständige neue Fake-Antworttypen und den durch `EventEmitter.on` an die vollständige Bibliotheksklasse gebundenen Rückgabetyp. Enge öffentliche Verbindungs-Schnittstelle und vollständige Fakezeitfelder ergänzt; danach neue Suite, [isolierte Typprüfung](typen.log) und [Lint](lint.log) jeweils Exitcode 0. Keine alten 23/15/21-AUTHprüfungen, Repository-Gesamtprüfung oder Build wiederholt. Keine UI-/Buildpfade verändert.

[Selektiver Ausgangsstand](ausgangsstand.json), [sechs aktuelle Quellhashes und 27 unveränderte Vergleiche](quellstand.json), [reine Paketänderungen](package.json.diff), [Lockänderung](package-lock.json.diff) und [Prüfzusammenfassung](pruefungen.json) sind hinterlegt. Temporäre Paketvergleichskopie und Typkonfiguration entfernt; keine eigene DB-/SMTP-/Browser-/Serverlaufzeit entstanden. Nodemailer bleibt als beauftragte installierte Abhängigkeit im Projekt. Dies ist kein vollständiger atomarer Release-/Linux-/Betriebsbeleg.

## Offene Freigaben und Übergabe

Reale SMTPanbieter-/Domain-/Absenderauswahl, Credentials, DNS-/Zertifikatsprüfung am Ziel, SPF/DKIM/DMARC, Zustell-/Bouncebeobachtung, Betriebsstart und Überwachung sind separat zuzuordnen/freizugeben. Kein Kauf/Deployment, echter CLIbatch, SMTP-/Empfänger-DNSkontakt, reale Mail, Kontomutation, Schlüsselanlage oder Umgebungsumschaltung. Bestehende öffentliche Runtime bleibt503; kein Produktionszugang aus diesem Adapter ableiten. Keine privaten bestehenden Daten/Geheimnisse gelesen; keine Nachrichten an andere Chats. Astra in jeder Variante ausgeschlossen.

Nach diesem dritten begrenzten Abschluss vor großer Folgeumsetzung frischen Nachfolger verwenden. [Kurze sichere Übergabe](UEBERGABE.md) benennt Dateien, Belege und offene Betriebsgrenzen; sie überträgt selbst keinen Dateibesitz und startet nichts. Danach stoppen.

## Connect-Callbackreview — tatsächlicher installierter Fehlerpfad

Nach enger Reviewrückfrage ausschließlich installierten Nodemailer10.1.2-Code und Deklaration gelesen. `node_modules/nodemailer/dist/cjs/smtp-connection/index.d.ts:265` deklariert `SMTPConnectionConnectCallback = (err?: NodemailerError) => void`. Der häufige `_onError`-Pfad (`index.js:920`) emittiert zwar `error`, aber **nicht alle Connectfehler durchlaufen ihn**: `index.js:1000` behandelt einen stillen Abbruch vor dem Greeting ausdrücklich per gespeichertem Connectcallback, ruft `connectCallback(err)` auf und schließt erst anschließend. Weitere unmittelbare Callbackfehler bestehen für wiederholtes connect und bereits zerstörte Verbindungen (`index.js:227–251`). Quellhashes der installierten Dateien stehen in [review-connect.json](review-connect.json).

Damit war die bisherige Annahme eines ausschließlich über Events abgefangenen Verbindungsfehlers zu weit: Der bisher argumentlose Callback konnte bei bereits wahrem `secure` trotz Callbackfehler noch Login versuchen, bevor das folgende Endereignis den Versuch beendete. Kleinste Produktkorrektur ausschließlich `smtp-transport.ts`: Connectcallback nimmt `error` entgegen und führt vor TLS-/Login-/Sendelogik sofort `fail(error); return` aus. Vor Sendebeginn bleibt damit sicher `not_accepted`, bei diesem Verbindungsfehler begrenzt wiederholbar. Keine Änderung an TLS-, Annahme-, Abbruch-, CLI-, Paket- oder Dispatcherlogik.

Genau ein neuer synthetischer Fall in `tests/auth-smtp.test.ts` simuliert einen **Callbackfehler ohne error-Event bei `secure=true`**. Er belegt null Login-/Sendaufrufe, einmaliges Schließen, Stream-/Timerbereinigung und bereinigte Nichtannahme. Ausgeführt ausschließlich mit Namensfilter `Review: connect-Callbackfehler`: [ein Test, ein Erfolg, null Fehler](review-connect-tests.log). Die alten15 Tests nicht erneut gestartet. Gezieltes [Lint](review-connect-lint.log) der zwei geänderten Dateien und [isolierte Typprüfung](review-connect-typen.log) derselben vier SMTPeinstiege bestanden, Exitcode0. Keine echte Verbindung/SMTP-/Provider-/DNSaktion oder Konfigurationsumschaltung. Temporäre Review-Typkonfiguration entfernt.

Frühere Test-/Quellzuordnung unverändert erhalten in `quellstand-vor-connect-review.json` und `pruefungen-vor-connect-review.json`. `quellstand.json` enthält nun die beiden neuen Quellhashes; `pruefungen.json` trennt ursprüngliche15 Fälle von diesem einen Reviewfall. Übergabe aktualisiert. Gleicher begrenzter Auftrag abgeschlossen, keine neue große Arbeitsstufe oder Besitzübertragung.
