# PERF-03 · Weitere Ladepfadabhängigkeiten · 30.10.2026

Abgeschlossene, begrenzte Lesanalyse zu Home, Lernplan, Onboarding und Dokumenten. Es wurden keine Produktdateien geändert und keine Tests, Builds, Browser-, Server-, Netzwerk-, Login- oder Indexaktionen ausgeführt. Die lokale Quelle wurde nicht an den Livebuild gebunden; es werden keine Laufzeit- oder Geschwindigkeitswerte behauptet.

Die vier belegten Kandidaten und ihre tatsächlichen Quellpfade, Ketten, Grenzen und gezielten Anschlussprüfungen stehen in [der Analyse](../entwuerfe/PERF-03/ANALYSE-20261030.md).

Priorität haben erstens die sichtbaren Fünf-Sekunden-Polls samt erneutem Settings-GET bei Routenwechsel, zweitens die Planansicht, die auf Plan-, Schedule- und Progressdaten wartet und beim Planlisten-GET einen vollständigen Katalogsnapshot liest. Die mögliche Sicherheitsfunktion der Aktualisierungspolls und die Snapshotbindung bleiben ausdrücklich ungeklärt; Principal-, Status-, Revisions-, Konto-, Sitzungs-, Origin- und Generationprüfungen sind keine pauschalen Optimierungsziele.

Auch der Onboarding-Leseweg überträgt Notizen, die seine Profilprojektion nicht nutzt; der Dokumentenlistenabruf lädt Versionsmetadaten mit einer Abfrage je Dokument. Umfang und Laufzeitwirkung beider Fälle sind ungemessen. Die Dokumentenliste lädt laut lokalem Service keine Originaldateibytes.

Der PERF-01-Liveness-Fix mit bestehenden 20-Sekunden-Fristen bleibt unberührt. Der Klausurkatalog→Schedule-Gate von PERF-02 wurde nicht bearbeitet. Der Suchindex bleibt außerhalb dieses Umfangs. Writerende.
