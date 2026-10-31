# Modellwahl für die Projektchats

## Aktuelle verbindliche Modellgrenze

**Verbindliche Modellvorgabe von Niklas, 17.10.2026:** „nie mehr astra nutzen, in keinem der testruns!!“ Astra und sämtliche Astra-Varianten sind ab sofort ausgeschlossen: Planung, Umsetzung, Reviews, alle lokalen/automatisierten Tests, Testkoordination und Modellvergleiche. Kein Astra-Fallback, kein erneuter Astra-Vergleich zur Prüfung dieses Verbots. Sol ist die bestehende Alternative für anspruchsvolle Arbeit; vorhandene zulässige Sol-/Luna-Einstellungen und Reasoningstufen erhalten. Alte Astra-Angaben dokumentieren nur frühere Entscheidungen und erlauben keine weitere Nutzung.

Stand: 11.10.2026. Recherche in offizieller OpenAI-Dokumentation; die Zuordnung zu unseren Aufgaben ist eine Architekturempfehlung, kein projektspezifischer Modellvergleich. Keine Modelleinstellungen oder aktiven Chats wurden dadurch geändert. Die KI-Modelle der Website und deren OpenRouter-Budget bleiben davon getrennt.

## Nutzerwunsch und Ausgabeformat

Niklas möchte vor jedem künftigen kopierbaren Arbeitsauftrag kurz Modell und Reasoning-Stufe sehen, um sie selbst im Zielchat einzustellen. Die Zeile steht außerhalb und direkt vor dem kopierbaren Prompt, zum Beispiel:

**Modell: GPT-6.1 Sol · Reasoning: High (hoch) · Geschwindigkeit: Standard**

Ein Modellname im Prompt stellt den Modellwähler nicht automatisch um. Die Empfehlung gilt dem konkreten Teilauftrag, nicht dauerhaft dem gesamten Chat. Bestehende Modellkennungen in CHATS.json sind keine Behauptung der aktuell manuell eingestellten Stufe. Keinen Auftrag allein für einen Modellwechsel neu starten; vorhandene Ergebnisdateien und Kontext erhalten.

## Historischer Recherchebefund vom11.10.2026 – keine Astra-Freigabe

- OpenAI empfiehlt GPT-6.1 Sol für komplexe Programmier-/Agentenarbeit und GPT-6 Luna für klar umrissene, wiederholbare Aufgaben. Astra ist für besonders anspruchsvolle durchgängige Arbeit mit breitem Kontext positioniert. Sol 6.1 wird als nahe an Astra bei geringeren Kosten beschrieben; dies ist die Herstellerpositionierung, keine eigene Messung. [Modelle](https://learn.chatgpt.com/docs/models)
- Reasoning: niedrige Stufen für einfache begrenzte Aufgaben; Medium/High für Planung, Analyse und Programmierung. Extra High/Max nur bei begründetem Mehrwert. Ein höherer Denkaufwand erhöht Zeit und Tokenverbrauch; er garantiert nicht, dass ein kleineres Modell ein größeres überholt. In den gelesenen Quellen kein direkter belastbarer Vergleich Luna Max gegen Sol 6.1 Low für unsere Codebasis. [Auswahl](https://learn.chatgpt.com/docs/model-selection), [Reasoning](https://developers.openai.com/api/docs/guides/deployment-checklist#set-up-reasoningeffort)
- Luna unterstützt bis Max, kein Ultra. Ultra ist zusätzlich eine Form der Arbeit mit Subagenten und nicht nur mehr Denkzeit. Für die gemeinsame Arbeitskopie kein pauschaler Ultra-Standard. [Modelle und Stufen](https://learn.chatgpt.com/docs/models#know-when-to-use-max-or-ultra)
- Standard-Creditpreise je Million Tokens am Recherchedatum: Luna 2,5 Eingabe / 0,25 gecachte Eingabe / 12,5 Ausgabe; Sol 6.1 50 / 2,5 / 250; Astra 250 / 25 / 1.250. Bei identischer Menge nicht gecachter Ein-/Ausgabetokens kostet Sol damit das 20-Fache von Luna und Astra das 5-Fache von Sol. Bei gecachten Eingaben sind es andere Verhältnisse. Das ist kein Vergleich der Gesamtkosten eines erfolgreich erledigten Auftrags und keine direkte Umrechnung der Aboverbrauchsanzeige. [Codex-Preise](https://learn.chatgpt.com/docs/pricing#token-rates)
- Standardgeschwindigkeit als Sparvorgabe empfehlen. Fast/Ultrafast kosten bei gekauften Credits mehr; Abo-Multiplikatoren sind gesondert geregelt. Keine feste prozentuale Einsparung für das Projekt behaupten.

## Empfehlungen je Aufgabe

Sol meint stets GPT-6.1 Sol, Luna GPT-6 Luna. Astra ist vollständig ausgeschlossen; frühere Recherchen darunter/oben sind nur Historie. Schwierigkeit berücksichtigt Schnittstellen, Fehlerfolgen und Prüfbarkeit, nicht nur Codeumfang. Die Tabelle startet keine Aufgaben und ersetzt keine Abhängigkeiten aus ARBEITSSTART.

| Chat / Teilauftrag | Schwierigkeit | Empfehlung | Begründung / günstigere Teilaufgaben |
|---|---|---|---|
| Architektur: neue Verträge, Ergebnisintegration, kritischer Review | Sehr hoch | Sol High | Breiter Kontext und widersprüchliche Anforderungen; Routine-Statusbericht mit klaren Quellen Sol Low/Medium. Extra High nur bei konkretem schwerem Befund; Astra ausgeschlossen. |
| 01 PLAN: jetzt persönliche Angaben klären, Bedienweg erklären | Leicht bis mittel | Luna High | Begrenzte Quellen und klare fehlende Angaben; Lernlogik-/Kalenderänderungen dagegen Sol High. |
| 02 DATA: Migration, Datenbank, Restore | Sehr hoch | Sol High | Referenzerhalt, Transaktionen und Verlustvermeidung; bei unklarer Konkurrenz/Restorefehler gezielt Extra High. Inventarberichte Luna High. |
| 03 AUTH-A: echte Anmeldung integrieren | Sehr hoch | Sol High | Sitzungen, Einladung, Sperre, Eigentum, Sicherung greifen ineinander; anschließender unabhängiger Architektur-/Sicherheitsreview Sol High. |
| 04 IMPORT-B: gemeinsamen Import integrieren | Hoch | Sol High | Identität, Wiederholung, Dokumentversionen und persönliche Bezüge; reine Offline-Inventare Luna High. |
| 05 AI-TEST: Testablauf und Referenzvergleich | Mittel bis hoch | Sol High | Unvollständige Quellen und fachliche Erwartungen sauber unterscheiden. Berichtformatierung Luna Low. Empfehlung betrifft den Agenten, nicht das geprüfte Website-Modell. |
| 06 PDF: Viewer und berechtigter Dateiabruf | Hoch | Sol High | Berechtigungen, Dateiteile, Cache und Mobilgeräte; einzelne isolierte UI-Korrekturen Luna High. |
| 07 SEARCH: Volltext/Normsuche | Mittel bis hoch | Sol Medium | Definierte Normalisierung und testbare Treffer; Zugriffsschutz-/Indexversionsintegration oder späteres RAG Sol High. |
| 08 AI-KEYS: Kontingente und Schlüssel | Sehr hoch | Sol High | Sichere Schlüsselzuordnung, Wiederholung, Geheimnisse und Kontotrennung; keine zusätzliche Kostenbuchhaltung gemäß D-18. |
| 09 ADMIN: Ansichten auf vorhandenen Prüfwegen | Mittel | Sol Medium | Vorhandene AUTH-Grenzen wiederverwenden; neue Rechte-/Statusänderungen Sol High. |
| 10 HOST: Einrichtung und echte Wiederherstellung | Hoch | Sol High | Betriebszustand, Geheimnisse und verlässlicher Rückweg; Größen-/Anbietervergleich Luna High bei klaren Kriterien. |
| 11 PDF-02: Markierungen | Mittel bis hoch | Sol Medium | Koordinaten, Rotation, Dokumentversionen; bei Synchronisationsfehlern Sol High. Spätere Downloadregeln separat. |
| 12 IMPORT-02: KI-Analyse integrieren | Hoch | Sol High | Strukturiertes Ergebnis, unsichere Inhalte, Quellen und Reimport. Keine pauschale Neuprüfung des Bestands. |
| 13 MODELS: regelmäßige Vergleiche | Mittel bis hoch | Sol Medium | Reproduzierbare Auswertung; reale Qualitätsentscheidung/automatischer Wechsel Sol High. Katalogextraktion Luna High. |
| 14 FEEDBACK: Formular und Bearbeitungsstatus | Mittel | Sol Medium | Begrenzter Ablauf mit vorhandenen Rechten; reine UI Luna High. Automatische Codeänderungen später Sol High plus Review. |
| 15 IMPORT-03: Portalabruf | Hoch | Sol High | Sitzungsablauf, Wiederaufnahme, Versionen und Seiteneffekte; gespeicherte Offline-Listen Luna High. |
| 16 UI: abgegrenzte mobile Korrekturen | Leicht bis mittel | Luna High | Klarer Vorher-/Nachher-Vergleich; Umbau mehrerer zusammenhängender Abläufe Sol Medium. |
| 17 ANKI: kleiner isolierter Export | Mittel | Sol Medium | IDs, Format und Importprobe; vorgegebenes reines Umformatieren Luna High. Spätere Synchronisierung Sol High. |

## Verbrauch sinnvoll begrenzen

1. Standard für normale Implementierung: Sol Medium; High für sicherheits-/datenkritische oder eng gekoppelte Arbeiten. Sol Low für klare kleine Änderungen, Berichte und einfache Anschlussaufgaben.
2. Luna High für günstige fokussierte Aufgaben; Low für reine Extraktion/Formatierung. Max nicht pauschal wählen. Falls Kernanforderungen oder Zusammenhänge verloren gehen, Aufgabe klarer abgrenzen oder zu Sol wechseln statt unbegrenzt weiterdenken lassen.
3. Sol für Architektur und anspruchsvolle unabhängige Reviews; Astra in keinem Arbeits-/Testlauf oder Fallback verwenden. Keine fertigen Tests allein für diese Vorgabe neu starten.
4. Ergebnisse nach erfüllten Abnahmekriterien abschließen; keine wiederholten Gesamtprüfungen ohne neue Änderungen oder konkreten Befund. Status über kurze Ergebnisberichte lesen, nicht immer ganze Chatverläufe.
5. Für einen echten Kostenvergleich denselben begrenzten repräsentativen Auftrag mit identischen Abnahmekriterien bewerten: Qualität, gesamte verbrauchte Tokens/Credits, Dauer und nötige Reparaturen. Solche Vergleichsläufe sind hier nicht durchgeführt; insbesondere keine behaupteten Benchmark-Prozentwerte.
