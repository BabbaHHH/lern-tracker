# AUTH03: Schemaabgleich vor dem lokalen Maildispatcher

Stand: 18.10.2026. Auftrag: jüngstes exklusives AUTH-Maildispatcherfenster in Arbeitsrunde 33 und AUTH-Briefing. Alleiniger AUTH-Nachfolger laut CHATS.json: `01a14be1-b9fc-7593-8cd4-65c8eee70d60`. **Konkreter Vorschlag zum vorgeschriebenen Vorabgleich, noch keine Migration oder Dispatcherimplementierung.**

**Spätere Fortschreibung:** Dieser Vorschlag wurde vor Umsetzung zentral abgeglichen (Runde33, konkreter Mail-Schemaabgleich). Die danach gelieferte Implementierung und tatsächliche Prüfung stehen in [ERGEBNIS.md](ERGEBNIS.md). Der folgende ursprüngliche Vorschlag bleibt als Herkunft erhalten; seine damalige Aussage „noch keine Implementierung“ ist kein aktueller Implementierungsstatus.

## Lesender Befund

`stex.auth_mail_outbox` enthält derzeit ausschließlich `id,email,purpose,sealed,expires_at,created_at`. `AccountService.mail` schreibt darin verschlüsselte Links; Aufrufe mit übergebenem Client gehören zur Einladungstransaktion, Bibliothekscallbacks verwenden den gesonderten Authpool. Es gibt keinen Transportaufruf. Einladungen sind sieben Tage gültig; Bestätigung und Reset derzeit eine Stunde, die Outbox selbst 24 Stunden. Die Dispatcherprüfung muss deshalb zusätzlich den aktuellen Nachweis und Kontostatus prüfen. Ein lediglich noch nicht abgelaufener Outboxsatz genügt nicht.

`backup.ts` erzwingt feste Tabellen-/Spaltenlisten und gleiche Migrationsstände beim Restore. Format 4 widerruft nach erfolgreichem Vergleich bereits alle temporären Nachweise und löscht die Outbox. Die Migrationsfolge endet derzeit mit 015. Laufzeit, Produktionskonfiguration, Pakete, KI und Oberfläche bleiben unverändert; keine Produktionsöffnung.

## Genau vorgeschlagene Änderung

Neue additive Datei **`db/migrations/016_auth_mail_dispatch.sql`**, Nummer vor tatsächlichem Anlegen erneut prüfen. Keine neue Tabelle; ausschließlich folgende Spalten an `stex.auth_mail_outbox`:

| Spalte | Typ / Default / Bedeutung |
|---|---|
| `dispatch_status` | `text NOT NULL DEFAULT 'pending'`; CHECK auf `pending,claimed,sending,sent,failed,cancelled,expired,uncertain`. |
| `dispatch_attempts` | `integer NOT NULL DEFAULT 0`; CHECK 0 bis 5, dauerhafte Obergrenze je Mail. |
| `next_attempt_at` | `timestamptz NOT NULL DEFAULT now()`; frühester erneuter Claim. |
| `claim_token` | `text NULL`; zufällige interne UUID als Fence eines konkreten Versuchs. |
| `lease_until` | `timestamptz NULL`; endliche Claim-/Sendelease nach DBzeit. |
| `last_error_code` | `text NULL`; ausschließlich feste interne Fehlercodes, niemals Transportantwort, Link, Empfänger oder Exceptiontext. |
| `sent_at` | `timestamptz NULL`; nur bei bestätigter Transportannahme gesetzt; keine Behauptung einer Postfachzustellung. |

CHECKs koppeln `claim_token` und `lease_until` an `claimed/sending`, `sent_at` an `sent`; alle übrigen Zustände haben keine laufende Lease. Partieller Index auf `(next_attempt_at,created_at,id)` für `pending`, weiterer Index auf `lease_until` für `claimed/sending`. Bestehende Zeilen erhalten nur additive Defaults; kein Entschlüsseln oder Versenden durch Migration.

**Einzige nötige Sicherungsänderung:** die sieben genannten Spalten an `columns.auth_mail_outbox` in **`src/lib/server/persistence/backup.ts`** ergänzen. Keine neue Tabelle, keine neue Geheimnisart und kein Formatwechsel. Bestehende Prüfung auf genaue Migrationsfolge/Spalten und das Löschen der Outbox beim Restore bleiben erhalten. Sicherungen vor 016 gehören weiterhin zu ihrem passenden früheren Release/Migrationsstand; keine neue allgemeine Altschema-Restorekompatibilität behaupten.

Neue Produktdateien ausschließlich **`src/lib/server/auth/mail-dispatcher.ts`** und **`mail-transport.ts`**. Die öffentliche injizierbare Schnittstelle erhält eine ausdrücklich konstruierte `Database`, feste `baseURL`, bestehenden Mailkey und einen Transport; kein Environmentloader oder automatischer Start. `service.ts` muss nach aktuellem Befund nicht geändert werden: bestehende Zeilen und Bibliotheksnachweise reichen für die lesende Nachweisprüfung. Sollte sich bei Umsetzung ein zusätzlicher Pfadbedarf ergeben, vor Bearbeitung erneut melden.

## Vorgesehener Dispatchvertrag

- Ein Aufruf verarbeitet seriell höchstens zehn Kandidaten, je Mail höchstens fünf Versuche. Kurze Transaktion beansprucht mit `FOR UPDATE SKIP LOCKED`, setzt UUID/Lease und erhöht Versuche. Nur bereits committed sichtbare Zeilen sind Kandidaten; kein Versand aus einem Bibliothekscallback oder einer Einladungstransaktion.
- Vor Übergang `claimed -> sending` erneut aktuelles Fence, DBzeit, Outboxablauf und gültigen Nachweis prüfen. Einladungen: Tokenhash, passende Adresse, offene/nicht widerrufene Einladung und pending Konto. Bestätigung: aktueller Hash in `auth_email_tokens`, unbestätigter Bibliotheksnutzer, passende zugeordnete und nicht gesperrte Identität; eine noch nicht fertig committed Appzuordnung darf nur begrenzt warten, niemals vorzeitig senden. Reset: aktueller `reset-password:<token>`-Nachweis der Bibliothek, passende Identität/Adresse und nicht gesperrtes Konto. URL muss zu fester Origin und jeweiligem bekannten Authpfad gehören; kein beliebiger Linktransport.
- Commit vor jedem Transportaufruf; während Transport keine offene DBtransaktion, kein globaler Writerlock und keine gehaltene Verbindung. Transportdeadline kürzer als die Lease; AbortSignal und begrenztes Warten. Reine Fake-/Sinktransporte, keine SMTPbibliothek oder echte Provideranbindung.
- Transportergebnis unterscheidet bestätigte Annahme, nachweislich nicht angenommene vorübergehende Ablehnung, endgültige Ablehnung und unklaren Ausgang. Nur nachweislich nicht angenommene vorübergehende Ablehnung erlaubt begrenzten Backoff. Exception, Timeout oder unklarer Ausgang führen zu `uncertain`, ohne automatische Wiederholung. Transporttexte werden verworfen.
- Abgelaufener `claimed`-Versuch kann innerhalb der Grenzen neu versucht werden: `sending` war noch nicht committed, der alte Fence darf keinen Versand mehr beginnen. Abgelaufenes `sending` wird `uncertain`; niemals automatischer erneuter Versand nach möglicher Annahme. Abschlüsse schreiben nur mit gleichem Fence und gültiger Lease. Bei Crash nach Transportannahme vor Statuscommit bleibt der Ausgang konservativ unklar.
- Ablauf/ungültiger oder widerrufener Nachweis wird ohne Transport terminal `expired/cancelled`. Nachträglicher Widerruf während eines bereits gestarteten Transports kann dessen Annahme nicht atomar verhindern; kein exactly-once- oder widerrufssicheres SMTPversprechen. Der Link wird weiterhin von der vorhandenen Authsemantik geprüft. Kein Lock während SMTP als scheinbare Lösung.
- Der Mailservice räumt bislang abgelaufene Outboxzeilen auf. Ein gelöschter Satz verliert seinen Fence und wird niemals neu angelegt; Abschluss ohne passende Zeile bedeutet unbekannter/nicht mehr speicherbarer Ausgang. Keine neue dauerhafte Mailhistorie oder Retentionsaufgabe aus diesem Auftrag ableiten.

## Gezielte neue Abnahme nach Abgleich

Eigene Datei `tests/auth-mail-dispatcher.test.ts` und gegebenenfalls eigene `scripts/auth/mail-*`-Helfer. Eigene temporäre PostgreSQL-Instanz, künstliche Adressen/Links/Schlüssel nur im Testprozess, keine bestehenden privaten Daten oder Konfigurationen lesen.

1. Upgrade 001–015 auf 016 mit vorhandener synthetischer Outbox; Defaults, Constraints, wiederholtes Migrate und unveränderte alte Migrationen.
2. Commit-/Rollbackgrenze: vor Commit unsichtbar, nach Rollback kein Transport; nach Commit genau ein Fakeaufruf unter normalem Ablauf.
3. Zwei unabhängige Dispatcher konkurrieren um dieselben Zeilen; exklusive Claims, Batch-/Versuchsgrenze und Backoff.
4. Während angehaltenem Fake sind andere DBwriter/Kontosperren möglich; vor nächstem Sendebeginn erneut widerrufene/ersetzte/verbrauchte/abgelaufene Nachweise ablehnen. Alle drei Mailzwecke gezielt belegen, einschließlich unfertiger Appzuordnung.
5. Definitive Ablehnung, Retry, maximale Versuche, korrupte Verschlüsselung, falsche Origin/Pfade und feste bereinigte Fehlercodes.
6. Crash vor Sendebeginn, veralteter Claim, Crash nach möglicher Annahme, Timeout, Leaseverlust und spätes Ergebnis: keine automatische Doppelzustellung unklarer Versuche.
7. Verschlüsselte Format-4-Sicherung mit allen neuen Zuständen/Spalten und Restore in frisches isoliertes Ziel; Vergleich vor vorhandener Widerrufsstufe, danach leere Outbox und keine Wiederzustellung. Keine Wiederholung der alten Authgesamtabnahme.
8. Gezielte Typ-/Lintprüfung der tatsächlich betroffenen Module/Tests. Kein UI-/Next-Build ohne tatsächlichen Bedarf, keine Wiederholung der 21 fertigen Konfigurationsfälle.

## Tatsächlicher Stand und notwendiger Abgleich

Bisher ausschließlich Dateien gelesen und diesen eigenen Abgleichsbericht angelegt. Keine Produkt-/Schema-/Sicherungsänderung, kein Test/Build/Server/Browser/DB-/Netzkontakt, keine echten Geheimnisse gelesen. Umfangreicher bestehender uncommitteter Arbeitsbaum erhalten; kein Reset/Clean/Worktree. Astra bleibt ausgeschlossen.

Vor Schemaänderung muss die Planung den oben benannten Bedarf gemäß aktivem Fenster abgleichen. Dieser Bericht ist über den eigenen Chat und Ergebnisbereich verfügbar. Eine direkte Nachricht an andere Chats ist hier nicht autorisiert: die Projektregel verlangt dafür eine direkte Beauftragung durch Niklas; der empfangene Agentenauftrag allein genügt dafür ausdrücklich nicht. Es wurde keine Nachricht gesendet. Nach erfolgtem Abgleich mit diesem konkreten Vertrag kann der begrenzte lokale Implementierungs-/Prüfschritt fortgesetzt werden; reale Zustellung und Produktionsöffnung bleiben weiterhin ausgeschlossen.
