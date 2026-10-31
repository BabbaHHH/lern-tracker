# IMPORT-02 — Ergebnisse

## IMPORT-C-V: Schema-/Promptvorbereitung

Stand: 11.10.2026. Dieser abgegrenzte Vorbereitungsauftrag ist abgeschlossen. IMPORT-C und das Gesamtpaket IMPORT-02 sind nicht implementiert oder abgenommen. Niklas hat ausschließlich eigene Entwurfs-/Ergebnisdateien und keine KI-Aufrufe freigegeben.

### Ausgangsstand

Gemeinsamer Projektstatus, TODO, CHAT_KOORDINATION, ARCHITEKTUR, eigenes Briefing mit Stand 10 und ARBEITSSTART gelesen. `lern-tracker/AGENTS.md` berücksichtigt. Tatsächlichen Git-Status vor Änderungen geprüft: HEAD `539bf2db8862edea310d558c4fc4e7f83725201f`, zahlreiche vorhandene Änderungen und unversionierte Dateien. HEAD allein bildet den Arbeitsstand nicht ab. Eigener Entwurfsordner und Ergebnisbericht waren zuvor nicht vorhanden.

Lesend verglichen: historischer NotebookLM-Prompt, aktueller Themenbaum/Typen, Browser-JSON-Import und `importKlausuren`, aktueller Server-Importservice/HTTP-Vertrag/Uploadgrenzen sowie Migration 003. Aus dem Hamburg-Skript ausschließlich Prompt und Analyseauswahl gelesen; keine Zugangsdaten gelesen oder ausgegeben. Ausgangsdateien mit SHA-256 in [AUSGANGSSTAND](../entwuerfe/IMPORT-02/AUSGANGSSTAND-v0.1.json) dokumentiert. IMPORT-B-Abschluss war parallel aktiv; Streambegrenzung im gelesenen HTTP-Code bereits vorhanden, hier keine Abnahme dieses fremden Arbeitsstands.

### Geliefert und tatsächlich geschriebene Dateien

- [Vertragsvergleich und Integrationslücken](../entwuerfe/IMPORT-02/VERTRAG-UND-INTEGRATION-v0.1.md): akzeptierte Felder, historische Unterschiede, Bestandsschutz, Herkunft/Versionierung, ergänzende Validierungsregeln und begrenzter Folgeumfang.
- [Promptentwurf](../entwuerfe/IMPORT-02/PROMPT-v0.1.md): einzelne ausgewählte neue Klausur, belegte Themen/Datums-/Rollen-/Paarungsvorschläge, Dokumenttext als Daten, keine Inhaltsfreigabe.
- [JSON-Schemaentwurf](../entwuerfe/IMPORT-02/ANALYSE-SCHEMA-v0.1.json): unveränderlicher serverseitiger Eingabe-/Ausführungsbeleg getrennt von `$defs.response` als Modellantwort; zusätzlicher Snapshot der bestehenden Metadaten und Schutzstatus.
- [Themen-Snapshot](../entwuerfe/IMPORT-02/THEMEN-SNAPSHOT-v0.1.json): 365 aktuelle Blattkennungen aus 432 Themenknoten, Labels/Rechtsgebiete und Quelldateiprüfsumme. Keine Bestandsanalyse.
- [Drei synthetische Ein-/Ausgabebeispiele](../entwuerfe/IMPORT-02/SYNTHETISCHE-BEISPIELE-v0.1.json): vollständig, unvollständig, widersprüchlich; Seitenbelege und Anschlussgrenzen. Ausführung als `synthetic`, keine Modellkennung oder vermeintliche Abnahme.
- [Ausgangsstand](../entwuerfe/IMPORT-02/AUSGANGSSTAND-v0.1.json) und dieser Ergebnisbericht.

Nur diese sieben Dateien angelegt. Anwendungscode, bestehende Klassifizierungen/IDs, Datenbank, zentrale Dokumente und persönliche Daten unverändert durch diesen Auftrag. Keine Nachrichten an andere Chats, keine Paketänderungen, Uploads oder Serverstarts.

### Wesentliche Anschlussbefunde

Der heutige Serverimport akzeptiert genau `id/source/date/title/area/type/topicIds`; unbekanntes Datum ist bereits als `""` möglich. Neue Analysefelder werden dort ausdrücklich abgewiesen. Die HTTP-Route verlangt Sachverhalt **und** Lösung als PDFs; einzelne, kombinierte oder unklar zugeordnete Dokumente sind nicht durch den Entwurf plötzlich einreichbar.

Ein Reimport schreibt bestehende Katalogmetadaten nicht neu. Deshalb können die Vorschläge nicht durch erneutes Einreichen nachträglich ergänzt werden. Der Browser-JSON-Import ist ebenfalls kein geeigneter Anschluss: Er verlangt ein Datum und kann bei gleicher Quelle Themen überschreiben. Die neue Analyse benötigt einen getrennten Beleg und einen bewussten revisionstreuen Ergänzungsweg an derselben Klausur-ID. Zunächst Vorschläge speichern; keine automatische Übernahme auf Basis leerer Themenlisten.

Der historische NotebookLM-Prompt und Hamburg-Prompt haben unterschiedliche veraltete Ausgabe-/Themen-/Typverträge. Insbesondere modellmarkerabhängige Wiederanalyse und modellgenerierte `kg-…`-IDs werden nicht übernommen. Vorhandene Klassifizierungen bleiben erhalten, auch bei neuer Lösung, geänderten Bytes oder Modellwechsel.

### Tatsächliche Dokumentkontrollen und Grenzen

Alle vier JSON-Artefakte lokal eingelesen und ihre Syntax geprüft. Schema-Themenmenge und Snapshot sind identisch; alle Themen der drei Beispiele liegen im Snapshot. Sämtliche Beispielzitate stehen in den künstlichen Seitentexten und referenzieren im jeweiligen Manifest vorhandene Dokumentversionen und gültige PDF-Seiten. Alle drei Ausführungsbelege sind ausdrücklich synthetisch. Die neun im Ausgangsmanifest erfassten gelesenen Dateien waren bei der abschließenden Dokumentkontrolle unverändert gegenüber ihrer Aufnahme.

Keine Anwendungstests, Builds, Lint-/Typprüfungen oder laufenden Server ausgeführt. Kein vollständiger JSON-Schema-Validatorlauf und keine API-/Datenbankintegration; zusätzliche Kalender-, Querverweis-, Quellen-, Berechtigungs- und Revisionsregeln sind im Vertrag benannt. Keine realen Klausurinhalte analysiert, keine KI-Aufrufe, Schlüsselzugriffe oder externe Dokumentübertragung. Die Kontrollen belegen nur innere Konsistenz der Entwurfsartefakte, keine reale Modellqualität oder Produktionsfähigkeit.

### Belastbare Übergabe und offene Punkte

Nach geprüftem IMPORT-B-Abschluss braucht IMPORT-C ein eigenes Integrationsfenster für Analysespeicher, geschützte Ergänzungsoperation und Backup/Restore. DATA ist für additive Persistenzverträge betroffen; PDF/SEARCH für vollständige versionierte Seitentexte und OCR-Status; AI-KEYS für Finanzierung, Idempotenz und tatsächliche Modell-/Kostenbelege. Einzeldokumente und Rollenänderungen sind gesonderte Importerweiterungen. Aktuelle Importverträge vor Umsetzung erneut prüfen.

Der Folgeumfang ist in [Vertrag § 6](../entwuerfe/IMPORT-02/VERTRAG-UND-INTEGRATION-v0.1.md#6-integrationslücken-und-begrenzter-folgeumfang) begrenzt. Es fehlen insbesondere Klassifizierungsherkunft/Schutzregel, verbindliche Übernahmepolitik für neue Vorschläge, versionierte Analysespeicherung und echte Quellen-/Budgetabnahme. Keine dieser Lücken blockiert die abgeschlossene Vorbereitung; sie verhindern, den Entwurf als anschlussfertig zu bezeichnen. Hostinganbieter und persönliche Admineinsicht bleiben vertagt. Der Planungschat kann dieses Ergebnis lesen und den zentralen Stand pflegen; von hier wurde kein Auftrag versendet.
