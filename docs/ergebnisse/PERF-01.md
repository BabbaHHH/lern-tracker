# PERF-01 · Ladezeitenanalyse

Die erste einmalige Wasserfallmessung erfolgte durch eine Navigation aus dem bestehenden Safari-Tab zu `/konto/klausuren`; ein Login und ein erneuter Seitenreload fanden nicht statt. Der Browser zeigte die geladene Klausur-Datenbank, aber auch „Die Anmeldung hat sich geändert“. Nachfolgende Konto-/Einstellungsabrufe meldeten 401, Schedule später 503 und Verbindungsfehler. Der Zustand „bereits angemeldet“ ist damit nicht verlässlich bestätigt.

**Beobachtete erste passende GETs:** `/api/learning/schedule` 769,56 KB, TTFB 371,4 ms, Gesamtdauer 897,2 ms; davor im Wasserfall zum Katalog-GET. `/api/catalog/klausuren` 848,56 KB, TTFB 851,1 ms, Gesamtdauer 1.385,8 ms. Der Ladehinweis war beim Anzeigen der gefüllten Seite verschwunden, sein genauer Endzeitpunkt und absolute Requeststarts relativ zum Seitenaufruf wurden nicht erfasst. Die zusammen 2,283 s Einzelzeit bestätigen einen seriellen Beitrag, belegen aber nicht die gemeldeten rund sieben Sekunden.

**Auswertung:** Kein Produktfix und keine Dateireservierung, da der Lauf keinen gültigen angemeldeten Zustand und keine vollständige Seitenwartezeit belegt. Nächster kleinstmöglicher Schritt wäre ein einzelner erneuter Wasserfall erst nach Wiederherstellung einer gültigen, von Niklas selbst bereits angemeldeten Sitzung. Kein Login durch Codex. Beim Auswählen der Kataloganfrage wurde kurz die Antwortvorschau geöffnet; daraus wurde nichts übernommen oder gespeichert.

Details, Quellenbelege, offene Punkte und die vier priorisierten Hypothesen: [ANALYSE-20261029.md](../entwuerfe/PERF-01/ANALYSE-20261029.md).

Analyse- und Prüf-Writerende angefordert. Kein Produktcode geändert; keine Produktdateien reserviert. Astra wurde nicht verwendet.

## Nachmessung · 29.10.2026

Niklas meldete, dass er angemeldet ist. In Safari war zunächst ein Financial-Times-Tab im Vordergrund; zwei vorhandene Stex-Tracker-Tabs waren sichtbar. Das Aktivieren eines Stex-Tabs und die anschließende reine Statusabfrage liefen jeweils in einen UI-Timeout. Für diese Nachmessung wurde kein Reload ausgelöst; URL, Anmeldung, Ladehinweis und Netzwerkrequests des Stex-Tabs konnten nicht verlässlich erfasst werden. Daher gibt es aus diesem Lauf keine Messwerte und keine Beobachtung zu 401, 503 oder Verbindungsfehlern. Die frühere Messung bleibt der einzige Messbeleg; sie bestätigt einen seriellen Beitrag, aber nicht die angemeldete Sieben-Sekunden-Wartezeit. Keine Produktänderung oder Dateireservierung. Writerende: Nachmessungsversuch wegen nicht ansprechbarer Safari-Oberfläche beendet.

## Neuer Incident: Katalog bleibt im Ladezustand · 29.10.2026

**Nutzerbefund:** Niklas meldet, dass die Klausur-Datenbank jetzt dauerhaft „Kontokatalog wird geladen …“ zeigt. Kein Browserreload, Login oder Serverzugriff für diese Untersuchung.

**Quellenbefund:** `account-klausuren-page.tsx` zeigt den Ladezustand solange `useAccountCatalog().status` `loading` bleibt. `use-account-catalog.ts` wartet auf Schedule-Bereitschaft und danach gemeinsam auf `/api/account` und `/api/catalog/klausuren`. Weder diese Fetches samt `response.json()` noch `ScheduleClient.load()` haben bisher eine Lese-Frist. Abgeschlossene HTTP-/JSON-Fehler werden bereits als Fehlerzustand angezeigt; ein offener Fetch oder Antwortbody kann dagegen unbegrenzt `loading` halten. Die API prüft same-origin und aktiven Principal. Es gibt keinen Quellenbeleg für fehlerhafte Anmeldung oder dafür, welche konkrete Live-Anfrage offen war.

**Fix:** In `schedule-client.ts` und `use-account-catalog.ts` bekommen ausschließlich die jeweiligen lesenden Abrufe eine 20-Sekunden-Frist. Bei Ablauf wird der Abruf abgebrochen und der Zustand auf eine Retry-fähige Fehlermeldung gesetzt; Kontoschlüssel, Abbruch bei Kontowechsel, Authprüfungen und Schreibvorgänge bleiben unberührt. Keine API-, Auth-, Seiten-, Server- oder Indexdatei geändert.

**Grenze und Abschluss:** Das behebt den lokal belegten Weg zu einem unbegrenzt sichtbaren Ladezustand, beweist aber nicht, ob Schedule, Kontoidentität oder Katalogantwort den konkreten Live-Vorfall ausgelöst hat. Keine neue Wasserfallmessung, kein Build und keine Tests. Produktdateien exklusiv durch die Planung reserviert; PERF-01-Writerende nach dieser Änderung. Server, Suchindex, PDFs, persönliche Daten, Domain und Mailschutz blieben unangetastet; kein Astra.
