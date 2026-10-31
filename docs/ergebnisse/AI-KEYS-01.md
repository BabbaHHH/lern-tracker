# AI-KEYS-01 — Ergebnis

## Runde33 · enge Produktions-Pilotgrenze, 17.10.2026

Der letzte, nach direkter Scopeklärung neu erteilte enge Auftrag ist lokal abgeschlossen. KI-Lernplangenerierung (`purpose: planning`), KI-Check-in und KI-Korrektur erhalten in Produktion einen verständlichen `503 / pilot_ai_deferred` vor Runtime-, Schlüssel- oder Providerzugriff. Direkte Check-in-/Korrektur-Statusunterrouten sind eingeschlossen. Die beiden Produktionspanels zeigen die Vertagung, ohne ihre KI-Hooks einzuhängen; manuelles Schreiben und Fortschritt bleiben erhalten. Das zuvor abgelehnte breite Sperrfenster wurde nicht umgesetzt.

Geändert wurden ausschließlich der neue `src/lib/server/pilot-ai-guard.ts`, die fünf zugewiesenen Routen und zwei Panels; hinzu kommen die eigene gezielte Prüfung und eigene Beleg-/Ergebnisdateien. Schlüsselverwaltung, Credits/Modelllisten, Tagging, allgemeiner KI-Zweck sowie Authruntime, Schema/Backup, Layout und Pakete erhielten keine zusätzliche Sperre oder Änderung. Bestehende lokale Funktionen, Prompts, Schlüssel und Daten bleiben erhalten; Produktionsanmeldung weiterhin geschlossen.

**Prüfung:** 14/14 neue synthetische Guard-/Routen-/SSR-Fälle bestanden, darunter direkte Unterrouten und Null-Aufrufzähler vor Runtime/Credential/Provider. Gezielte Typprüfung und ESLint bestanden. Ergänzend ist der [isolierte Produktions-/Kontobuild](../entwuerfe/AI-KEYS-01/PILOT-KI-GRENZE/PRODUKTIONSBUILD.md) auf 437 aktuellen Quell-/Konfigurationsdateien mit Exit 0 geliefert: vollständige Anwendungstypprüfung, 30/30 Seitengenerierungen und tatsächliches NODE_ENV-Inlining beider deaktivierter Clientpanels. Nur in der Wegwerfkopie wurde die Typprüfmenge auf produktive Quellen begrenzt; der erste Versuch mit breiter Repository-Typprüfung scheiterte an fremden Testhilfen und bleibt dokumentiert. Keine Produkt-/Konfigurationsänderung im gemeinsamen Stand. Die 14 Fälle und alte Gesamtabnahmen wurden nicht wiederholt; beide Buildkopien entfernt. Kein Server/Browser/DB-Prozess gestartet, keine echte Anbieter-/Schlüssel-/Mail-/Netz-/Kauf-/Deploymentaktion oder normale Umgebungsumschaltung. Dies ist keine Online-, Geräte-, Modell-, Kosten- oder repositoryweite Typabnahme.

Vollständiger [Abschluss mit Grenzen](../entwuerfe/AI-KEYS-01/PILOT-KI-GRENZE/ABSCHLUSS.md), [genauer Task-Diff](../entwuerfe/AI-KEYS-01/PILOT-KI-GRENZE/aenderungen.patch), [finale Quellhashes](../entwuerfe/AI-KEYS-01/PILOT-KI-GRENZE/quellen.sha256.json) und [Prüfmanifest](../entwuerfe/AI-KEYS-01/PILOT-KI-GRENZE/pruefung.json) sind abgelegt. Auftrag nach Bericht abgeschlossen; weitere Schritte bleiben beim Planungsprozess.

## AI-KEYS-A: lokale Integrationsumsetzung

Stand: 13.10.2026. Die freigegebene lokale Umsetzung der Runde 17 ist abgeschlossen. D-18 und das aktuelle Briefing ersetzen Tracker-Guthaben und Kostenbuchhaltung durch einen individuell begrenzten OpenRouter-Schlüssel. Der einmalige Startbetrag von **4,00 EUR je Nutzer ohne Reset** ist bestätigt. Eigene OpenRouter-Schlüssel können anschließend hinterlegt und ausdrücklich ausgewählt werden.

### Ergebnis

- `/konto/ki` bietet Pilotzugang, eigenen OpenRouter-Zugang und „KI ausschalten“ als getrennte, ausdrücklich ausgewählte Quellen. Ein neu gespeicherter eigener Schlüssel wird nicht automatisch ausgewählt.
- Der Hinweis für eigene Schlüssel nennt drei einfache Schritte, verlinkt direkt auf [OpenRouter: API-Schlüssel](https://openrouter.ai/settings/keys), erklärt Einfügen und Auswahl im Tracker und weist darauf hin, dass OpenRouter die Nutzung dem eigenen Konto belastet. Die angemeldete Oberfläche wurde mit synthetischen Konten geprüft.
- Pilotzuordnungen sind einzeln und manuell möglich; die App validiert einen Pilot-Schlüssel und verlangt ein endliches Anbieterlimit ohne Reset. Die USD-Umrechnung aus 4,00 EUR bleibt die manuelle Aufgabe bei der Bereitstellung anhand des dann geltenden EZB-Referenzkurses mit Abrundung auf volle US-Cents.
- `stex.ai_credentials` speichert Schlüssel verschlüsselt mit AES-256-GCM und kontogebundener AAD; ein gesonderter HMAC-Fingerabdruck verhindert Mehrfachzuordnungen. Aktive Sitzung, Kontostatus und Credential-Revisionen werden vor und nach den relevanten Aufrufen geprüft. Schlüsselwerte bleiben im Request-Body und erscheinen nicht in Antworten, Audit, URLs, Fehlern oder Exporten.
- `/api/ai` und `/api/docs/tag` verwenden im Kontomodus dieselbe ausdrücklich gewählte Credential-Quelle und reichen den Schlüssel explizit an `chatCompletion` weiter. Mitglieder können nicht auf allgemeine `OPENROUTER_API_KEY*`-Werte zurückfallen. Es gibt keinen stillen Wechsel zwischen Pilot- und eigenem Schlüssel.
- Der Live-Status wird nur für die ausgewählte Quelle abgefragt; Restbeträge werden nicht als Tracker-Guthaben gespeichert. Fehler von OpenRouter werden bereinigt und verständlich angezeigt; ein unklarer Abbruch löst keinen automatischen erneuten Aufruf aus.
- Das Backupformat ist auf Version 4 erweitert und sichert die beiden Credential-Tabellen vollständig. Restore verlangt die separat gehaltenen Verschlüsselungs- und Fingerprint-Geheimnisse und prüft sie vor Schreibzugriffen.

### Geänderte Dateien

- Additive Migration `db/migrations/007_ai_credentials.sql` (Migrationen 001–006 unverändert), Vertrag `src/lib/ai-credentials/contract.ts` und Servermodule in `src/lib/server/ai-credentials/`.
- Neue Besitzer- und Admin-Routen `src/app/api/account/ai-credential/route.ts` und `src/app/api/account/admin/ai-credential/route.ts`, Seite `src/app/konto/ki/page.tsx` sowie `src/components/ai-credentials-page.tsx`.
- Gemeinsame KI-Anbindung in `src/lib/ai.ts`, `src/lib/use-ai.ts`, `src/app/api/ai/route.ts`, `src/app/api/docs/tag/route.ts`, `src/app/api/openrouter-credits/route.ts` und `src/components/credit-badge.tsx`; Navigationslink in `src/components/account-app.tsx` und `src/components/account-learning-boundary.tsx`.
- `src/lib/server/persistence/backup.ts` und `.env.example` für versionierte Sicherung und die getrennten Variablen `STEX_AI_CREDENTIAL_ENCRYPTION_KEY` und `STEX_AI_CREDENTIAL_FINGERPRINT_KEY`.
- Neue Prüfung `tests/ai-credentials.test.ts`. In `tests/learning-personal.test.ts` und `tests/learning-progress.test.ts` wurde nur die feste Formatversion 3→4 angepasst; `tests/search-integration.test.ts` erhielt nur die entsprechende Format-4-Bezeichnung. Weitere Testlogik dieser Dateien blieb unverändert.

### Prüfung

- `tests/ai-credentials.test.ts`: **1/1 bestanden**, mit isolierter PostgreSQL-Datenbank, synthetischem Admin und Mitgliedskonten sowie vollständig gemocktem OpenRouter.
- Betroffene Backup-/Lern-/Suchregressionen: **38/38 bestanden**. AUTH-/Persistenz-/Katalogregressionen: **56/56 bestanden**.
- Gezieltes ESLint für alle AI-KEYS-Dateien und die drei zugeordneten Regressionen: bestanden, keine Warnungen.
- Isolierter Next.js-Produktionsbuild mit Webpack: Kompilierung, TypeScript-Prüfung, Seitengenerierung und neue KI-Routen bestanden.
- Direkte Browserprüfung auf `/konto/ki` mit synthetischen Konten: synthetischen Schlüssel hinterlegt, ausdrücklich ausgewählt und wieder entfernt; kein realer Schlüssel und kein echter Anbieteraufruf.

Der separate vollständige Aufruf `npx tsc --noEmit` bleibt durch bereits vorhandene doppelte generierte Routentypen aus `.next`/`.next-qa` und archivierte Dokumente unter `docs/entwuerfe/DATA-01/ausgang-c1` und `ausgang-c2` blockiert. Diese fremden Dateien und zentrale TypeScript-Konfiguration wurden nicht geändert; der isolierte Produktionsbuild hat seine eigene TypeScript-Prüfung bestanden.

### Grenzen und offene Produktfragen

Keine realen OpenRouter-Schlüssel, Anbieterstatusaufrufe, Limitänderungen oder KI-Aufrufe wurden ausgeführt. Der Provider war in sämtlichen Tests gemockt; somit ist die Integration lokal geprüft, aber keine echte Modell- oder Kostenabnahme. Es wurde keine reguläre Nutzerinstanz migriert und keine Live-KI für normale Konten aktiviert. Anbieterbereitstellung und spätere Betriebsfreigabe bleiben getrennte Schritte. Zum Startbetrag besteht keine offene Produktfrage.

## AI-KEYS-A-R1: Reparatur des Architekturreviews

Stand: 13.10.2026. Die drei R1-Befunde zu altem Kontokontext, verspäteten Formular-/Antwortzuständen und widersprüchlichen Wiederholungsbelegen wurden gezielt behoben.

- Jede Besitzeraktion bindet das angezeigte Konto an Konto-ID, Zugangsgeneration und Sitzungskontext; Adminaktionen binden zusätzlich Zielkonto, Zielgeneration und angezeigte Credential-Revision. Der Server vergleicht dies mit der echten Sitzung vor Providerzugriff und innerhalb der gesperrten Schreibtransaktion. Ein alter A-Auftrag unter B oder einer neu aufgebauten A-Sitzung wird abgewiesen.
- UI-Lese- und Schreibvorgänge werden durch Anfragegenerationen und Kontextvergleiche getrennt. Beim erneuten Prüfen der Sitzung, bei Fokus-/Zurücknavigation und bei Kontowechsel werden Schlüssel-, Ziel-, Formular- und Meldungszustände verworfen. Eine unmittelbar vor dem Schreiben nachgeladene Zielrevision kann die alte Adminbestätigung nicht mehr erneuern.
- Der Wiederholungsbeleg bindet auch den Schlüsselinput über einen zweckgebundenen HMAC-Nachweis, ohne Rohschlüssel oder Credential-Fingerabdruck in Antwort/Audit zu speichern. Gleiche ID mit gleicher Eingabe kann nach unklarer Bestätigung sicher denselben Vorgang klären; gleiche ID mit geänderter Eingabe, Quelle, Ziel oder Revision ergibt Konflikt. Historische Antworten ersetzen keinen neueren sichtbaren Stand.
- Der einfache Hinweis für eigene OpenRouter-Schlüssel bleibt auf `/konto/ki`: drei Schritte, direkter Link zur Schlüsselverwaltung, ausdrückliche Auswahl sowie der Hinweis, dass OpenRouter das eigene Konto belastet.

### Geänderte Dateien

- `src/lib/ai-credentials/contract.ts`, neue Clientgrenze `src/lib/ai-credentials/client-boundary.ts` sowie `src/lib/server/ai-credentials/crypto.ts` und `service.ts`.
- Besitzer-/Adminrouten `src/app/api/account/ai-credential/route.ts` und `src/app/api/account/admin/ai-credential/route.ts`, Oberfläche `src/components/ai-credentials-page.tsx` und kompatible Statusroute `src/app/api/openrouter-credits/route.ts`.
- `tests/ai-credentials.test.ts`, neue `tests/ai-credential-client-boundary.test.ts` sowie dieser Ergebnisbericht.

### Prüfung und Grenzen

- `tests/ai-credentials.test.ts`: **1/1 bestanden** mit isolierter PostgreSQL-Datenbank und vollständig gemocktem OpenRouter. Geprüft wurden insbesondere alter A-Kontext unter B-Cookie, alte Sitzung nach Neuanmeldung, geänderte Pilotrevision vor Providerzugriff, verloren gegangene Bestätigung nach Commit und gleicher requestId mit geändertem Schlüssel.
- `tests/ai-credential-client-boundary.test.ts`: **2/2 bestanden** für verspätete Antworten und zweckgebundene HMAC-Nachweise.
- Gezieltes ESLint und isolierte TypeScript-Prüfung der betroffenen Credentialdateien: bestanden. Der vollständige TypeScript-Aufruf bleibt durch doppelte generierte `.next`/`.next-qa`-Routentypen und archivierte DATA-01-Beispiele blockiert; diese fremden Dateien und die gemeinsame Konfiguration wurden nicht geändert.
- Browserprüfung mit synthetischen Testkonten: A hinterlegte, wählte und entfernte einen synthetischen Schlüssel. Nach der Anmeldung von B im zweiten Tab wurde der zuvor als A geöffnete Tab neu geladen; dort war B angemeldet, das alte Schlüssel-Formular leer und „KI ausschalten“ ausgewählt. Der sichtbare Hinweis mit OpenRouter-Link ist auf derselben Seite vorhanden.

Alle Testschlüssel und Providerantworten waren synthetisch; echte OpenRouter-Schlüssel, Status-/Modellaufrufe und Kostenaktionen wurden nicht verwendet. Der Browser-Kontowechsel belegt die sichtbare Zustandsbereinigung; die Ablehnung vor Providerzugriff und vor jeder Änderung ist durch die isolierten Routen-/Datenbanktests belegt. Eine Live-Modell- oder Kostenabnahme ist weiterhin offen.

## AI-KEYS-V: Pilotlimit und eigener OpenRouter-Zugang — Vorbereitungsstand

Dieser Abschnitt hält den damaligen Vorbereitungsstand vor der Implementierung fest. D-18 aus Projektstatus und vorrangigem Abschnitt des aktuellen AI-KEYS-Briefings ersetzte die frühere Buchhaltungsplanung. Niklas bestätigte **4,00 EUR einmalig je Nutzer** und klärte, dass Nutzer nach dem Startlimit ihren eigenen OpenRouter-Schlüssel einfügen können sollen. Die Umsetzungsergebnisse stehen im vorstehenden AI-KEYS-A-Abschnitt.

### Maßgeblicher Ausgangspunkt

Projektstatus, TODO, CHAT_KOORDINATION, ARCHITEKTUR und aktuelles AI-KEYS-Briefing wurden gelesen. Die relevanten Providerpfade, Kontositzung, Auth-Verschlüsselung und explizite Backup-Tabellenliste wurden lesend geprüft. **Zum damaligen Vorbereitungsstand** führten /api/ai und /api/docs/tag noch über requireLocalAccess; src/lib/ai.ts wählte globale Umgebungs-Schlüssel mit Fallback. Die danach erfolgte kontogebundene Implementierung steht im AI-KEYS-A-Abschnitt oben.

### Aktualisierter Entwurf

Der frühere Entwurf mit Tracker-Guthaben, Monats-/Funktionsbudgets, Kostenreservierungen, Kostenledger und interner Abrechnung wurde vollständig ersetzt. Gemäß D-18 ist das per Nutzer begrenzte OpenRouter-Schlüssellimit die einzige Startzugangsgrenze. Der Tracker speichert höchstens den verschlüsselten persönlichen API-Schlüssel und dessen Kontozuordnung; Anbieterlimits und Restverbrauch werden nicht heruntergezählt oder als Guthaben geführt.

Als kleinster Pilot ist die Schlüsselanlage bei OpenRouter manuell vorgesehen; automatisches Anlegen/Ausgeben und ein Managementschlüssel in der App bleiben ausgeschlossen. Die Adminzuordnung verlangt eine frische Sitzung, prüft das Anbieterlimit und speichert nur verschlüsseltes Schlüsselmaterial. Im Integrationsauftrag ist außerdem vorgesehen, dass Nutzer nach Erschöpfung des Startlimits ihren eigenen OpenRouter-Schlüssel selbst einfügen, prüfen, ausdrücklich auswählen, ersetzen und entfernen können. Beide KI-Routen müssen dieselbe vom Nutzer gewählte Quelle verwenden, niemals Niklas' allgemeinen Umgebungsschlüssel und ohne stillen Wechsel zwischen Pilot- und Nutzer-Schlüssel. Der Hinweis verlinkt auf [OpenRouter-Konto und API-Schlüssel](https://openrouter.ai/settings/keys), sagt, dass das Einrichten in wenigen einfachen Schritten geht, und erklärt, dass OpenRouter die Nutzung dem eigenen Konto belastet. Verständliche Statusfehler, unklare Timeouts ohne automatische Wiederholung, vorhandene Laufzeitgrenzen sowie Sicherung/Wiederherstellung sind abgegrenzt.

Das bestätigte einmalige Startguthaben beträgt 4,00 EUR je Nutzer ohne Reset. Da OpenRouter das Schlüssellimit in USD führt, wird dieser Wert bei der manuellen Schlüsselanlage anhand des dann geltenden EZB-Referenzkurses umgerechnet und auf den nächstniedrigeren US-Cent abgerundet. Der Tracker führt weder ein paralleles EUR-/USD-Guthaben noch eine Kostenabrechnung. Tracker-weite und Funktionsbudgets sind aus dem Entwurf entfernt.

### Dateien der Vorbereitungsstufe

- Aktualisiert: docs/entwuerfe/AI-KEYS-01/PILOTKONTINGENTE.md
- Aktualisiert: docs/ergebnisse/AI-KEYS-01.md

In der Vorbereitungsstufe wurden nur die genannten eigenen Entwurfs-/Ergebnisdateien geändert. Die spätere AI-KEYS-A-Implementierung ist oben dokumentiert. Zentrale Projektdateien und reguläre Nutzerkonten wurden nicht geändert. Keine Nachrichten an andere Chats versendet.

### Prüfung und Grenzen der Vorbereitungsstufe

Offizielle OpenRouter-Dokumentation wurde lesend auf aktuelle Endpunkte, Schlüssel-Limit-/Resetfelder, Limitfehler, Verwaltungsrechte und den offiziellen Weg zum Erstellen eines API-Schlüssels geprüft und im Entwurf verlinkt. **Für die Vorbereitungsstufe** gab es keinen OpenRouter-API-Aufruf, keine Nutzung echter Schlüssel, keine Tests/Builds und keine Serverstarts. Die danach erfolgte lokale Implementierung und Prüfung sind oben beschrieben. Echte Anbieteraktionen und AI-Aktivierung bleiben bis zu einem gesonderten Betriebsfenster aus; AI-TEST-01 ersetzt keine ausstehende konkrete Aktivierungsfreigabe.

### Bestätigter Produktwert

Der einmalige Zielbetrag von 4,00 EUR pro Nutzer ist bestätigt. Der konkrete USD-Centwert wird bei der manuellen Bereitstellung berechnet; eine offene Produktfrage zum Startbetrag bleibt nicht bestehen. Die Summe der Anbieterlimits aller ausgegebenen Pilot-Schlüssel bestimmt die mögliche Projektbelastung; Kosten eigener Nutzer-Schlüssel trägt das jeweilige OpenRouter-Konto des Nutzers. Der Tracker führt weder ein zusätzliches Gesamtbudget noch ein Kostenledger.
