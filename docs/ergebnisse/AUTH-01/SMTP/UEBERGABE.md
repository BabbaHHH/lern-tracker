# AUTH03 — sichere Übergabe nach SMTP-Adapter

Stand: 18.10.2026. Dritter begrenzter Abschluss im frischen AUTH03-Verlauf. Vor größerem Folgeauftrag ist gemäß zentral bestätigter Wechselprüfung zu rotieren. Diese Datei sichert ausschließlich Kontext; sie erzeugt keinen Nachfolger, startet keine Arbeit und überträgt keinen Besitz.

## Gültiger Stand

Gemeinsame lokale Arbeitskopie `lern-tracker/`, umfangreicher uncommitteter Stand aus mehreren Chats. HEAD allein ist kein gültiger Gesamtausgang; kein Reset/Clean/Worktree aus altem Commit. Bestehende IDs, Nutzeränderungen und fremden Dateibesitz erhalten. Astra sämtliche Varianten vollständig verboten; Sol/High ist die Empfehlung, zulässige Einstellungen erhalten.

Seit der vorherigen AUTH-Übergabe drei begrenzte Teilaufträge geliefert:

1. [Maildispatcher](../MAIL-DISPATCH/ERGEBNIS.md): additive Migration016 mit sieben Outboxspalten und entsprechender Format-4-Spaltenliste. Explizit injizierter Dispatcher/Transport, Postcommit, UUIDfences, Leases, Backoff/Fünfversuchegrenze und Nachweisprüfung. Unklare Annahme bleibt ohne automatischen Resend. 23 neue PostgreSQL-Testeinträge einschließlich künstlicher Transport-/Restoregrenzen bestanden. Kein realer Versand.
2. [Betreiberkonfiguration](../PROD-OPERATOR/ERGEBNIS.md): `scripts/data-migration/local-config.ts`, `scripts/auth/operator.mts`, neuer reiner `production-operator-config.ts`. Wiederverwendet Produktions-DB/TLS/Datei/Auth-/Mailvertrag; Produktion ohne lokale Secrets. Init/Mailvorschau produktiv geschlossen, lokaler Weg erhalten. 15 neue rein instrumentierte Fälle plus Typ/Lint. Damals angrenzender Sicherungs-CLI-Fallback gemeldet; DATA02 erhielt dafür später ein eigenes Dateifenster. Dessen neuesten Abschluss vor Folgeauftrag separat lesen, den früheren offenen Stand nicht ungeprüft als aktuell behaupten.
3. [Dieser SMTP-Abschluss](ERGEBNIS.md): neue `src/lib/server/auth/smtp-config.ts`, `smtp-transport.ts`, expliziter `scripts/auth/mail-dispatch.mts`, neue `tests/auth-smtp.test.ts`; Pakete ausschließlich Nodemailer10.1.2 exakt ergänzt, Typen eingebaut. Public SMTPConnection/MailComposer für Sitzung/MIME, kein eigenes Protokoll. 15 neue rein instrumentierte Fälle, Typ/Lint bestanden. Kein SMTPserver, DNSlookup zu SMTPzielen, tatsächlicher CLIbatch oder Providerkontakt.

Enger Abschlussreview ergänzt: installierter Nodemailercode kann stillen Abbruch vor Greeting über `connectCallback(err)` ohne error-Event melden. `smtp-transport.ts` behandelt dieses Argument jetzt explizit vor Login/Send. Genau **ein** neuer synthetischer Callbackfehlerfall bestand mit Namensfilter, alte15 nicht wiederholt; Typ/Lint danach bestanden. Finale `quellstand.json`/`review-connect.json` gelten, frühere Quellen-/Prüfmanifestdateien mit Suffix `-vor-connect-review` erhalten. Keine vollständige16-Fälle-Neuabnahme behaupten.

Vorbereiteter Produktions-Konfigurationsadapter aus älterem Abschluss unverändert. Öffentliche `accountRuntime` liefert auch bei gültiger Konfiguration weiterhin **503 `production_auth_not_released`**. Enger KI-Guard schließt nur die drei ausdrücklich vertagten Funktionen Planung/Korrektur/Check-in; keine pauschale neue Sperre von Keys/Tagging etc ableiten. Keine alte Abnahme wegen Chatwechsel wiederholen.

## Exakte letzte Dateigrenze und Belege

Letztes exklusives SMTPfenster: drei neue Module und eigener Test, `package.json`/`package-lock.json` ausschließlich Nodemailer. `mail-transport.ts` musste nicht geändert werden. Service/Runtime/Schema/Backup/Layout/KI/Suche und vorhandene Betreiberadapter blieben im selektiven Vergleich unverändert. Eigentümer dieses Fensters bleibt bis zentraler Übertragung der aktuelle AUTH03-Chat `01a14be1-b9fc-7593-8cd4-65c8eee70d60`; keine zweite aktive Schreibverantwortung.

`quellstand.json` ordnet sechs finale Quell-/Paketdateien zu, 27 geschützte Vergleichsdateien stimmen. `ausgangsstand.json` ist selektiv, kein Gesamtsnapshot. `tests.log`, `typen.log`, `lint.log`, `pruefungen.json` und Paketdiffs belegen Umfang/Exitcodes. Typkonfiguration und Paketvergleichsordner entfernt; es gibt keine eigene temporäre Laufzeit zu übernehmen. Installiertes Nodemailer ist beauftragte Projektabhängigkeit, kein zu löschendes Testartefakt.

## Sicherheits-/Betriebsgrenzen

SMTP nur explizit465/implicit oder587/starttls, Zertifikat/SNI geprüft, mindestensTLS1.2; vor Login bestätigtes `secure`. Feste Einzelmailbox/Betreffzeilen, einfache Textnachricht, keine Header-/Datei-/URLcontentquellen und keine geheimen Logs. Maximal acht Sekunden pro Sitzung; vorhandener Dispatcherstandard zehn Sekunden. Abort/Timeout schließt Verbindung; nach möglichem Sendebeginn unbekanntes Ergebnis. Positive Empfängerliste allein reicht nicht, finale2xx nötig. Keine exactly-once-/Postfachzustellgarantie, keine behauptete Providerdeduplizierung und keine Wiederholung unklarer Transporte.

`mail-dispatch.mts` akzeptiert nur bewusst gestartetes `once` mit vollständiger Produktions-/SMTPkonfiguration und ruft einen bestehenden begrenzten Batch auf. Import/Konstruktion startet keinen Versand. Der Einstieg existiert als Fähigkeit, seine reale Verwendung ist weiterhin **nicht freigegeben**.

Offen: konkrete Anbieter-/Domain-/Absender-/Budgetentscheidung, sichere echte Credentials, TLS/DNS/SPF/DKIM/DMARC und reale Annahme/Zustellung/Bounces, Dienst-/Timer-/Überwachung und Operatorschritte bei `uncertain`, unabhängiger Linux-/Backup-/Restore-/Zielgeräte-/Lastnachweis sowie gesonderter Erstbestand. Betreiber-/Suchanschluss und öffentliche Öffnung nur nach neuer exakter Dateizuordnung und freigegebener Betriebsabnahme. Keine jetzt bestehenden persönlichen Konfigurationen/Schlüssel übernehmen oder ausgeben.

## Nächster Ablauf

Planung liest Abschluss, entscheidet Übernahme und legt nach Rotation genau nächsten begrenzten Umfang fest. Neuer lokaler Nachfolger zuerst nur aktuelle AGENTS/Zentraldateien/Runde33/eigenes Briefing/diese Übergabe lesen. Danach zentrale Besitzübertragung/Archivierung, dann separater Auftrag. Keine fertigen21/23/15/15-Prüfungen oder Buildpauschalen neu starten. Echte Mail/DB-/Onlineaktionen, Keys oder Konfigurationsumschaltung benötigen weiterhin ihren konkreten Auftrag. Keine Nachrichten an andere Chats allein auf Agentenweisung.
