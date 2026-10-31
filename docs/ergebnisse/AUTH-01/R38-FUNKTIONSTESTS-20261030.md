# AUTH-01 · R38 Funktionstests Onboarding · 30.10.2026

Nur die ausdrücklich beauftragten UI-Testdateien wurden ausgeführt. Ergebnis: **9 Tests, 5 grün, 4 fehlgeschlagen.**

- **Grün, 5/5:** `tests/ui-account-workflow.test.ts` — Stations-Defaults, erhaltene Teilpatchfelder/Quellen, Planungsart, Kalenderwerte und AG-Tage im Profilzeitraum.
- **Fehler, 0/4:** `tests/ui-account-shell.test.ts` — alle vier SSR-Fälle werfen denselben `TypeError`: `AccountKlausurDesTages` liest `schedule.view`, erhält von den Tests aber nur `view`. Keine Quelle wurde geändert.
- **Offen:** `tests/auth-postgres.test.ts` nicht ausgeführt. Der gelesene Fixturecode nutzt temporäres Embedded-PostgreSQL/Loopback; der breite Auth-Test richtet Konten ein und verwendet Testpasswörter, Testschlüssel, Sitzungen, TOTP/Recoverycodes, Bibliotheksmails und lokale HTTP-Server. Ein isolierter Kontotrennungsfall fehlt; Start und Abhängigkeitseffekte wurden nicht erprobt. Kontotrennung ist nicht belegt.

Manuelle Sichtprüfung für Niklas mit vorhandener Anmeldung: `/onboarding` auf gespeicherte Examens-/Lernstartdaten, Planungsart und Stationen/Phasen prüfen; `/kalender` auf die erwarteten Seminar-/AG-Tage im Profilzeitraum prüfen, ohne Änderungen zu speichern. Optional, nur falls bereits zwei autorisierte Konten vorhanden sind, bestehende persönliche Einträge nacheinander vergleichen.

Vollständige Testnamen, der konkrete Stackframe und Grenzen stehen in [ERGEBNIS.md](../../entwuerfe/AUTH-01/R38-FUNKTIONSTESTS-20261030/ERGEBNIS.md). Keine Test-/Produkt-/Zentraldateien geändert; kein Build, keine Gesamtabnahme, kein Live-/Server-/Netz-/Mail-/Keyzugriff. **Writerende.**
