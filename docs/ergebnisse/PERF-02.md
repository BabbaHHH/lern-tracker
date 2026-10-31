# PERF-02 · Katalogstart parallelisieren · 30.10.2026

## Ergebnis

Die Hypothese des unnötig seriellen Katalogstarts ist in der lokalen Quelle bestätigt: `useAccountCatalog` begann seine beiden Leseabrufe erst nach `schedule.status === 'ready'`. Der erste Schedule-GET startet jetzt den Schedule- und Katalogabruf parallel. Die vollständige Katalogantwort wird erst übernommen, wenn der zugehörige initiale Schedule-Abruf bereit ist und denselben aktuellen Kontoschlüssel bestätigt.

Geändert wurden:

- `src/lib/learning/schedule-client.ts`: interne Kennung des initialen Leseversuchs sowie Start-/Abbruchsignal für den optionalen Katalogvorabruf. Bestehender 20-Sekunden-Abbruch und Schedule-Schreibschutz erhalten.
- `src/lib/catalog/use-account-catalog.ts`: gemeinsamer Katalogleser, kontoschlüsselgebundene Koordination und Abbruch bei Kontowechsel, Abmeldung, Fehler, Zeitüberschreitung und Verbergen. Identitätsstatus, Rolle, Konto-Revision sowie Katalogeintragsrevisionen bleiben geprüft bzw. erhalten.
- `src/components/account-klausuren-page.tsx` blieb unverändert. Die Ansicht benötigt weiterhin Schedule-Daten für Tracking, Tagesplan, Erledigt-Status und Fortschrittswerte.

## Gezielte deterministische Prüfung

Ein einmaliger Inline-Harness mit kontrollierten Fetch-Antworten bestätigte:

- Katalog- und Identitätsrequests starten, solange der Schedule-Response noch offen ist.
- Nutzer-ID, Zugriffs-Generation und Sitzung erzeugen jeweils einen anderen Schlüssel; ein geänderter Sitzungsschlüssel bricht den gebundenen Vorabruf ab.
- Das Abmeldesignal, Verbergen eines noch offenen initialen Schedule-Laufs und ein 401-Schedulefehler brechen den Katalogvorabruf ab.
- Katalogfehler und Zeitüberschreitung landen im Fehlerergebnis.
- Konto-Revision `4` und Klausur-Revision `11` bleiben im Ergebnis erhalten.

Der Harness verwendete keine echten Kontodaten und wurde nicht als neue Repository-Testdatei abgelegt. Kein Gesamtbuild, keine bestehende Test-/Lintschleife, kein Browser-, Netz-, Server-, Mail- oder Indexzugriff.

## Stand und Grenzen

Die drei reservierten Produktdateien stehen im vorhandenen Arbeitsbaum weiterhin als untracked; keine fremden Änderungen wurden bereinigt oder überschrieben. Die lokale Quelle wurde nicht an Build `4SUwTUi-_3Hv5E76uLIIS` gebunden. Es gibt daher keinen Livebeleg und keine Messung der Wirkung auf die gemeldeten etwa sieben Sekunden. Der 20-Sekunden-Liveness-Fix aus PERF-01 bleibt lokal erhalten.
