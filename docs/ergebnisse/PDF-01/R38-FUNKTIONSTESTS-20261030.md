# PDF-01 – R38 Funktionstest „Meine Dokumente“ · 30.10.2026

**Grün:** Der einzige beauftragte Testweg `node --import tsx --test --test-reporter=spec tests/learning-documents.test.ts` endete mit **21/21 bestanden, 0 fehlgeschlagen, 0 übersprungen** in 27,851 Sekunden. Geprüft wurden Formatvalidierung, synthetischer Upload und Metadaten, Besitzer-/Kontotrennung, Versionen, eigener GET/HEAD/Range-Abruf, Fehler-/Replay-/Statusfälle, Clientpuffer, Zeit-/Uploadgrenzen sowie ein vollständiger Restore synthetischer Daten.

Der erste Lauf in der Standardsandbox konnte drei lokale Testpfade wegen `EPERM` beim Binden temporärer `127.0.0.1`-Listener nicht starten (5 bestanden, 3 Startfehler). Der unveränderte Einzeltest lief anschließend mit lokaler Loopback-Freigabe vollständig grün. Verwendet wurden synthetische Konten, lokale temporäre PostgreSQL-/HTTP-Instanzen und temporäre Dateien.

**Offen:** PDF wird nur synthetisch vom Formatvalidator akzeptiert; Speicherung und eigener Abruf wurden in diesem Test für `.txt`-Bytes geprüft. Browser-/UI-Bedienung, persönlicher echter Login, Live-Daten und Live-Server bleiben ungeprüft. Das ist keine Gesamt- oder Produktionsabnahme. Produkt- und Testquellen blieben unverändert; Build, Lint und weitere Testdateien wurden nicht ausgeführt.

Manuelle Schritte für eine von Niklas selbst geöffnete bestehende Anmeldung stehen in [ERGEBNIS.md](../../entwuerfe/PDF-01/R38-FUNKTIONSTESTS-20261030/ERGEBNIS.md). Sie umfassen Upload einer harmlosen kleinen PDF unter `/konto/dokumente`, Listenaktualisierung/Reload und eigenen Originalabruf. **Writerende.**
