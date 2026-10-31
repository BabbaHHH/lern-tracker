# AI-KEYS-A-R1 – begrenzte Reparatur aus dem Architekturreview

**Abgeschlossen/lesend übernommen am 13.10.2026, Check 22:00 Uhr / Stand 20.** Die folgenden Befunde/Aufträge sind Herkunft; aktuelle Zuständigkeiten in [Arbeitsrunde 20](ARBEITSRUNDE_20.md). 08-Reservierung beendet, kein weiterer R1-Start.

Stand: 13.10.2026, Check 21:00 Uhr / Koordinationsstand 19. Aktiver Planungsverantwortlicher und direkte lokale Befugnis unverändert. Dies ist eine gezielte Reparatur der gelieferten ersten Implementierung, kein Neustart von AI-KEYS-A. Gemeinsames Fenster bleibt exklusiv 08; DATA-C3 und Markierungen noch nicht starten.

**Versand:** Reparaturauftrag am 13.10.2026 direkt an 08 gesendet, keine Modelleinstellung verändert.

## Gelesene Lieferung und tatsächliche Grenze

08 meldet lokale Lieferung mit 1/1 gruppiertem Integrationstest, 38/38 und 56/56 betroffenen Regressionseinträgen, gezieltem Lint und isoliertem Produktionsbuild. Angemeldete KI-Zugangsseite mit synthetischem Konto geöffnet; im Browser kein Schlüssel eingegeben. Bericht und kritische Codebereiche lesend geprüft, keine Tests/Builds durch Architektur. Migration 007 und Backupformat 4 sind implementiert, die Gesamtabnahme bleibt bis zu folgenden Befunden offen. Keine echte Modell-/Kosten-/Bestands-/Onlineabnahme.

## Konkrete Reviewbefunde

1. **Alter A-Auftrag unter B-Sitzung:** `CredentialRequestOptions` enthält nur requestId/expectedRevision, die Schreibbody-Daten keinen erwarteten Konto-/Zugangsgenerations-/Sitzungskontext. `setOwn` ermittelt Besitzer aus dem beim Versand aktuellen Cookie. Bleibt A-Maske offen, während in anderem Tab B angemeldet wird, kann deren eigener Schlüsselauftrag bei ebenfalls leerem B-Credentialstand (`expectedRevision:null`) B zugeordnet werden. Frische Sitzung und Serveridentität prüfen dann B, nicht den ursprünglich dargestellten A-Kontext. Auswahl/Entfernung und Adminmaske brauchen dieselbe Bindung; Clientkontext ist nur Gleichheitsbedingung, niemals frei wählbare Serveridentität.
2. **Verspätete Anzeige und eingefrorener Formularstand:** `AiCredentialsPage.load()` hat keine Anfrage-/Kontogeneration und keine Fokus-/pageshow-/Sitzungsgrenze; alte Antworten können nach Wechsel in die neue Ansicht gelangen. Schlüssel-/Ziel-/Meldungszustände werden bei Wechsel nicht vollständig getrennt. Pilotaktionen lesen unmittelbar vor Schreiben erneut die Zielrevision (`loadPilotStatus`), wodurch ein alter Formularstand eine inzwischen geänderte Zuordnung ohne bewusste neue Bestätigung überschreiben kann.
3. **Unklare Bestätigung und widersprüchlicher Replay:** `requestFingerprint()` bindet Aktion/Ziel/Quelle/Revision, aber nicht den fachlichen Schlüsselinput. Derselbe requestId mit geändertem Schlüssel kann deshalb den alten Erfolgsbeleg erhalten. UI erzeugt IDs nur unmittelbar in Aktionen, leert Schlüssel vor Bestätigung und hat keinen sicheren Weg, unklaren Commit mit derselben fachlichen Aktion zu klären. Wiederaufnahme darf weder zweite Revision noch still geänderte Nutzereingabe als gleichen Erfolg behandeln.

Diese Befunde sind aus konkretem Codefluss abgeleitet und noch nicht als ausgeführte Reproduktion ausgegeben. 08 reproduziert sie gezielt an echter AUTH-/PostgreSQL-Integration mit synthetischen Konten/Schlüsseln und gemocktem Provider.

## Eindeutige Dateizuständigkeit

08 behält sämtliche AI-KEYS-Dateien aus ARBEITSRUNDE_17 einschließlich Credentialvertrag/-Service/-UI/-Routen, eigene Prüfung und notwendige kleine Backupanschlüsse. Neue reine Clienthilfen/gezielte Tests unter eigenem AI-KEYS-Bereich sowie eine auf eigene Verwaltungsbelege begrenzte Statusroute innerhalb der bereits zugeordneten Credentialrouten sind erlaubt. Kein anderer Bearbeiter erhält diese Dateien. Authkern, DATA-Lern-/Katalog-/PDF-/Suchbereiche, Store/Typen, Pakete und technische KI-Limits bleiben read-only. Keine neue Migration/Formatänderung ohne tatsächlichen Bedarf; vorhandene 001–007 unverändert. Zentrale Dateien/Briefings ausschließlich Planung.

## Startprompt – AI-KEYS-A-R1

**Modell: GPT-6.1 Sol · Reasoning: High · Geschwindigkeit: Standard.** Empfehlung; vorhandene Einstellungen erhalten.

Behebe ausschließlich die drei beschriebenen Architekturreviewbefunde. Deine bisherige AI-KEYS-Lieferung bleibt erhalten; keine allgemeine Neuimplementierung oder neue Entwurfsrunde. Du behältst das exklusive gemeinsame Fenster.

Nutze den C1/C2-Vertrag als lesende Referenz: Status liefert interne Konto-ID, Zugangsgeneration und nicht als Zugangsmittel nutzbaren Sitzungshinweis. Alle Besitzer-/Admin-Credentialänderungen binden ihren dargestellten Kontext und erwartete Revisionen; Server vergleicht diese mit dem aus der echten Sitzung ermittelten Kontext vor Provider-Validierung und erneut nach lockState/checkPrincipal innerhalb der Schreibtransaktion. Bei A→B und schneller Neuanmeldung von A eindeutig ablehnen, keine Schlüsselzuordnung, Auswahl, Entfernung, Audit-/Belegschreibung oder Provideranfrage für den alten Kontext. Erwartete Konto-ID ist ausschließlich Vorbedingung, keine wählbare Eigentümer-ID. Adminziel und Credentialrevision an den bestätigten Formularstand binden; kein stilles Nachladen einer Revision kurz vor Write.

Trenne und verwirf Anzeige-/Anfragegenerationen sowie alle Schlüssel-/Ziel-/Formular-/Meldungszustände bei Abmeldung, Wechsel, Fokus-/Zurücknavigation und verspäteten Antworten. Persönliche Ansicht vor erneuter Sitzungsbestätigung ausblenden. Ein alter Formularhandler darf seine Daten nicht unter dem inzwischen neuen Konto versenden; Abort allein verhindert keinen Servercommit. Eingaben nur im RAM, niemals Browserpersistenz oder Log. Keine alte A-Anzeige in B und keine alte Zielrevision unbemerkt erneuern.

Binde sichere Wiederholungsbelege an vollständige fachliche Eingabe einschließlich nicht offen gelegtem, separat zweckgebundenem Nachweis des Schlüsselinputs. Kein Rohschlüssel oder tatsächlicher Credential-Fingerabdruck in Audit/Antworten. Gleiche ID und gleicher Auftrag wiederholt ohne Änderung; gleiche ID mit anderem Schlüssel/Ziel/Quelle/Revision ergibt Konflikt. Nach verlorenem Commit zuerst eigenen Verwaltungsbeleg oder gleichen unveränderten Auftrag prüfen; keine neue ID/automatische neue Änderung. Schlüssel vor/nach normalem Abschluss aus Feld leeren; unklare Bestätigung verständlich behandeln und nötigen sicheren RAM-Zustand bis Aufklärung halten. Historischer Replay darf neueren sichtbaren Stand nicht ersetzen.

Prüfe neue Varianten gezielt mit echten A/B-Sitzungen/PostgreSQL und gemocktem Provider: beide ohne Schlüssel/gleiche Revision, alter A-Write bei aktuellem B-Cookie, alte A-Sitzung nach Neuanmeldung, verspätete UI-Reads/Writes, veränderte Pilotzuordnung zwischen Anzeige und Klick, gleicher/widersprüchlicher Replay samt geändertem Schlüssel und verlorener Bestätigung nach Commit. Tatsächlichen Browserweg für synthetische Schlüsseleingabe, explizite Auswahl und Entfernung sowie Kontowechsel prüfen; kein echter OpenRouter-Schlüssel oder Status-/Modellaufruf. Zeige, dass der Fehler vor Providerzugriff und vor Änderung abgelehnt wird und keine Geheimnisse in Ausgaben gelangen.

Nur diese Reparatur und konkret betroffene Regression/Typen/Lint prüfen, Build nur wegen tatsächlicher Änderungen nach Bedarf isoliert. Keine Tests durch Architekturchat, keine globalen Wiederholungen. Bestehende Produktionssperre, technische Grenzen, Providerfehler, verschlüsselte Sicherung/Restore und einmaliges 4-EUR-Produkt erhalten. Bericht um R1 ergänzen, alte Abnahmegrenzen korrigieren und tatsächliche Belege ablegen. Kein Auftrag an andere Chats nötig. Keine bezahlten/externalen Aktionen, echten Daten oder Veröffentlichung. Nach Reparatur abschließen; Planung prüft erneut lesend und ordnet danach DATA-C3 zu.

## Check 21:30 Uhr

08 arbeitet weiter an R1; neue Clientgrenze und Wiederaufnahme sind im Arbeitsstand vorhanden, noch keine fertige Abnahme. Die eigene temporäre Browserfixture scheiterte am Turbopack-Symlink außerhalb ihrer Quellwurzel. Das ist ein lokales Prüfumgebungsproblem, kein belegter Produktfehler. Vorherige isolierte Prüfungen nutzten explizit Webpack; gezielte Fortsetzung innerhalb desselben Auftrags. Gemeinsames Fenster bleibt 08, keine neue Aufgabenverteilung und keine Tests/Builds durch Planung.
