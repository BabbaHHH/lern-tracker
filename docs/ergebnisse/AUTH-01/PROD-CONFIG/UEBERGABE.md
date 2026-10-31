# AUTH-01 / AUTH03 – sichere Übergabe

Stand: 17.10.2026. Letzter gültiger Umsetzungsauftrag: eng begrenzter Produktions-Konfigurationsadapter gemäß Fortschreibung der Arbeitsrunde 33. Der Adapter ist lokal implementiert und durch die Planung lesend übernommen. Dieser Abschlussauftrag sichert ausschließlich die Übergabe; er eröffnet kein weiteres Produktfenster.

## Ausgangsstand und Dateibesitz

Arbeitskopie: `lern-tracker/` im bestehenden gemeinsamen Projektordner. HEAD beim Ausgangsstand: `539bf2db8862edea310d558c4fc4e7f83725201f`. Die Arbeitskopie enthält umfangreiche uncommittete Änderungen und neue Dateien aus mehreren Aufgaben. HEAD allein bildet den gültigen Anwendungsstand deshalb nicht ab. Kein Reset, Clean oder Neubeginn ausschließlich von diesem Commit; fremde Änderungen erhalten.

Der tatsächliche Ausgangsstand ausgewählter Produktdateien ist mit Hashes in [ausgangsstand.json](ausgangsstand.json) festgehalten; dies ist kein atomarer Gesamtsnapshot. [quellstand.json](quellstand.json) ordnet den Abschluss den drei bearbeiteten Dateien zu. Unter den erfassten vorbestehenden Produktdateien änderte sich ausschließlich die zugewiesene Runtime; alle dort geschützten Vergleichsdateien blieben erhalten.

Das exklusive AUTH03-Fenster umfasst genau:

- `src/lib/server/auth/runtime.ts` – geändert;
- `src/lib/server/auth/production-config.ts` – neu;
- `tests/auth-production-config.test.ts` sowie eigene Belege unter `docs/ergebnisse/AUTH-01/PROD-CONFIG/`.

`service.ts`, Sicherheitslogik, Schema/Migrationen, Sicherung, Layout, Pakete, KI-/Providerdateien, Maildispatcher und Betreiberwerkzeuge gehören nicht zu diesem Schreibfenster. Zentrale Status-, Architektur-, Koordinations- und Briefingdateien pflegt die Planung. Der bisherige Besitzer behält seine zugewiesenen Dateien bis zur ausdrücklich koordinierten Übertragung. Diese Übergabe erstellt keinen Nachfolger und überträgt keinen Dateibesitz.

## Übernommenes Ergebnis

Der reine Konfigurationsleser verlangt einen expliziten Produktionsmodus, feste kanonische HTTPS-Origin, vollständig angegebene PostgreSQL-Verbindung, ausdrückliche TLS-Politik, privaten absoluten Dateipfad außerhalb des Releases und getrennte explizite Auth-/Mailgeheimnisse. Er verwirft lokale Konfigurationsreste, implizite Verbindungswerte und unsichere oder mehrdeutige Eingaben. Fehler enthalten keine verworfenen Werte. Die Prüfung führt weder Datei- noch Netzwerkzugriffe aus und erzeugt keine Geheimnisse.

Die Runtime erhält den lokalen Modus und verhindert die Wiederverwendung einer bereits initialisierten Instanz nach Konfigurationswechsel. Produktionskonfiguration wird validiert, danach folgt weiterhin zwingend `503 production_auth_not_released`, bevor Datenbank, Dateien oder Kontodienst angelegt werden. Es gibt keinen Freigabeschalter in der Umgebung. Der Adapter ist damit **keine Produktionsfreigabe**.

Der vollständige Vertrag und seine Grenzen stehen in [ERGEBNIS.md](ERGEBNIS.md). Insbesondere beweist syntaktische Prüfung weder echte Zufälligkeit von Geheimnissen noch Dateirechte, Symlinkfreiheit, Zertifikate, DNS oder Datenbankverfügbarkeit. Die aktuelle Umgebung wurde nicht umgestellt; bestehende Browserdaten und private Konfigurationen wurden nicht verändert.

## Gültige Prüfbelege

[pruefungen.json](pruefungen.json) und [tests.log](tests.log) belegen 21 bestandene gezielte Konfigurations-/Modusfälle, keine Fehler oder übersprungenen Fälle. Gezieltes Lint und eine begrenzte Typprüfung endeten mit Status 0; zugehörige Protokolle: [lint.log](lint.log), [typen.log](typen.log). Die Planung hat diese Belege und die drei Quellhashes gelesen und übernommen.

Diese Tests arbeiten mit synthetischen Konfigurationen und instrumentierten Ressourcenfabriken. Sie sind keine erneute Sitzungs-, Datenbank-, Mail- oder Onlineabnahme. Frühere echte lokale AUTH-Prüfungen bleiben getrennt im [AUTH-Ergebnis](../../AUTH-01.md) und in der [Prüfmatrix](../AUTH-A-PRUEFMATRIX.md) dokumentiert. Fertige Prüfungen nicht allein wegen eines Chatwechsels wiederholen. Es erfolgten kein Gesamtbuild und kein echter Zielkontakt. Eigene temporäre Prüfkonfiguration und Zwischenprotokolle sind bereinigt; dieser Teilauftrag startete keinen Server oder Datenbankcluster.

## Offene Anschlussgrenzen

1. **Pilot ohne KI:** Vor einer Produktionsöffnung braucht der Pilot eine ausdrücklich zugewiesene serverseitige KI-Sperre gemäß [HOST-Bereitschaft](../../../entwuerfe/HOST-01/PILOT-OHNE-KI-BEREITSCHAFT.md). Betroffen sind insbesondere KI-/Tagging-, Check-in-/Korrektur-, Schlüsselverwaltungs- und OpenRouter-Endpunkte einschließlich Unterrouten sowie `/konto/ki`. Fehlende zugeteilte Schlüssel reichen wegen eigener eintragbarer Schlüssel nicht aus. Bestehende KI-Arbeit bleibt für später erhalten; kein C6-Ausbau aus diesem Auftrag ableiten.

2. **E-Mail:** Der Kontodienst schreibt weiterhin ausschließlich in den verschlüsselten, befristeten lokalen Postausgang. `STEX_AUTH_MAIL_KEY` ermöglicht dessen Verschlüsselung, keinen Versand. Ein späterer Dispatcher benötigt Versand nach Transaktionsabschluss, begrenzte Wiederholungen, Ablauf- und Fehlerbehandlung ohne lange Datenbanksperren. Reale Absender-/Domainkonfiguration, SPF/DKIM/DMARC und Zustellprüfung brauchen einen eigenen Auftrag; jetzt keine echten Einladungen oder SMTP-Kontakte.

3. **Betreiberanschluss:** `scripts/data-migration/local-config.ts` nutzt derzeit die rohe Datenbank-URL ohne den neuen TLS-Vertrag; `scripts/auth/operator.mts` verwendet lokale Schlüsseldateien. Diese Werkzeuge müssen später unter eigenem Dateifenster denselben geprüften Datenbank-, Dateipfad- und Geheimnisvertrag erhalten. `scripts/search/worker.mts` nutzt die Runtime und bleibt produktiv ebenfalls gesperrt. Keine dieser Dateien wurde hier geändert.

4. **Betrieb und Wiederherstellung:** Offen bleiben reale HTTPS-/Proxy-/Origin- und Cookieprüfung, private dauerhafte Dateirechte einschließlich bestehender Verzeichnisse und Symlinks, Datenbankrechte/TLS, Zielsystem und native Laufzeitabhängigkeiten sowie vollständige Sicherungs-/Restore- und Geräteabnahme. Ursprüngliche Auth-/TOTP-Geheimnisse müssen beim Restore erhalten bleiben; keine lokalen Testschlüssel übernehmen. Eine Auth-Sicherungsbeschreibung verschlüsselt noch nicht sämtliche PDF-Dateien; gesonderte verschlüsselte externe Gesamtsicherung bleibt erforderlich.

## Nächster begrenzter Schritt

Die Planung ordnet zuerst ein konkretes Anschlussfenster für die KI-Sperre des geschlossenen Piloten oder den Mail-/Betreibervertrag mit exakten Dateien zu. Erst nach diesen Voraussetzungen darf eine gesondert beauftragte Produktionsöffnung samt Onlineabnahme folgen. Bis dahin bleibt die Runtime gesperrt. Keine realen Mails, bezahlten Aufrufe, Uploads, Hostingänderungen oder Bestandmigration aus dieser Übergabe ableiten. Astra und sämtliche Varianten bleiben ausgeschlossen.
