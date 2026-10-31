# Konkrete Leserechtsfreigabe für Davids private Einladung

**Tatsächliche spezifische Zustimmung erhalten:** Niklas antwortet „Genau dieses Leserecht freigeben“. Native Nutzerbeleg01a179dd-bb3c-7b63-adf9-130a1df252b1, Ursprungschat01a167b8-9e90-7222-b7f7-d199784ea100. Freigabe gilt ausschließlich für den unten benannten Umfang; noch kein Grant oder Zustellerfolg.

## Fertiger begrenzter Umfang

Auf der bestehenden Datenbank `stex_rollback_r36_20261023` erhält ausschließlich die vorhandene Anwendungsrolle `stex_u09_runtime_20261021` das folgende dauerhafte Leserecht:

```sql
GRANT SELECT ON TABLE stex.schema_migrations TO stex_u09_runtime_20261021;
```

Die technische Tabelle enthält nach bestehendem Quellvertrag ausschließlich Migrationsnamen (`name`) und Prüfsummen (`sha256`). Sie enthält keine Klausuren, persönlichen Notizen, Passwörter oder Kontoinhalte. Der Grant erlaubt ausschließlich Lesen dieser Tabelle, keine Schreib-/DDLrechte, keine anderen Tabellen, keine Weitergabe von Rechten und keine allgemeinen Standardrechte.

## Tatsächlicher Grund

Der echte, bereits adresskorrigierte Einladungsresolver erreicht die Runtime-Datenbank, bricht aber in `schema_validation` mit PostgreSQL `42501` beim Zugriff auf `stex.schema_migrations` ab. Ohne diesen vorhandenen Schema18-Nachweis läuft der private Zustellhelfer nicht weiter. Ein Link wurde nicht erzeugt. Die normale Einladung für David Willfort an david@willfort2day.de ist bereits angelegt und darf nicht wiederholt werden.

## Ausführung nach konkreter menschlicher Zustimmung

HOST bindet vor Ausführung die tatsächliche aktuelle Datenbank, Rolle, technische Tabelle und vorherige ACL; er wendet genau den festen Grant über den regulär geprüften bestehenden DBbetreiberkanal an. Er dokumentiert ausschließlich technische Ergebnisdaten. Ein Rückweg nimmt nur das tatsächlich neu hinzugefügte Recht bei Erhalt sämtlicher vorheriger Rechte zurück; Daten werden nicht zurückgesetzt. Danach genau ein echter normaler Resolver und bei Erfolg ein privater Dispatcheraufruf für Davids bestehende Einladung, mit allen bisherigen Empfänger-, Status-, Ablauf-, Lease-, Proof- und Fenceprüfungen. Link ausschließlich als private Datei0600/0700 an Niklas, kein SMTP oder Chat-/Logausdruck. Kein zusätzlicher Testlauf.

## Tatsächliche Freigabegrenze

Der automatische Approvalreview hat bereits die Beauftragung dieses dauerhaften Produktionsdatenbank-Leserechts abgelehnt: Davids allgemeine Einladung autorisiere das konkrete Berechtigungsdelta nicht ausdrücklich. Kein Grant oder Ausführungsauftrag aus dem abgelehnten Versuch. Diese vorbereitete genaue Freigabevorlage wird deshalb einmal Niklas vorgelegt. Ohne konkrete Zustimmung kein erneuter oder indirekter Ausführungsversuch; sichere reine Dokumentvorbereitung darf fortgesetzt werden.
