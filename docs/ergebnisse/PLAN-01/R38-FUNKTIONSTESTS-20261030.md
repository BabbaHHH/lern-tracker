# PLAN-01 · R38 Funktionstests · 30.10.2026

Der gezielte synthetische PostgreSQL-/HTTP-Lauf prüfte Profil/Stationen/Datumswerte, private Planentwürfe, Kalender/Bearbeitungen und Lernfortschritt. **52 von 54 Testeinträgen bestanden; die zwei Runnerfehler stammen aus einer fehlgeschlagenen Assertion samt übergeordnetem Test in `DATA-C2`.** Die eigentlichen Speicher- und Wiederherstellungspfade für Profil, Plan, Kalender und Fortschritt waren überwiegend grün.

Der einzelne offene Profil-Untertest sollte einen HTTP-Antwortverlust nach erfolgreichem Commit prüfen. Seine Fixture enthält zuvor jedoch einen unvollständigen Alt-AG-Datensatz; der vollständige Client-Patch wird daher voraussichtlich vor dem Response-Drop abgelehnt. Die genaue HTTP-Antwort wurde im Test nicht ausgegeben. Der Test belegt den Antwortverlustpfad für Profil somit nicht. Die übrigen drei DB-gestützten Hauptfälle liefen samt Unterprüfungen grün.

Es gab keine Änderungen an Produkt- oder Testquellen, keinen echten Login und keine Live-/Browserabnahme. Einzelheiten, Testauswahl und Grenzen stehen in [ERGEBNIS.md](../../entwuerfe/PLAN-01/R38-FUNKTIONSTESTS-20261030/ERGEBNIS.md). **Writerende.**
