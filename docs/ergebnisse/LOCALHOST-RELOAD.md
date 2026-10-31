# Localhost: ständige Neuladungen auf /admin

Stand: 10.10.2026. Direkter zusätzlicher Fehlerbehebungsauftrag von Niklas; keine Umsetzung eines der 17 geplanten Onlinepakete.

## Ausgangsstand und Befund

- Repository bei Auftrag: `539bf2d` mit zahlreichen bereits vorhandenen uncommitteten Änderungen. Diese Änderungen wurden erhalten.
- Der Entwicklungsserver auf Port 3000 zeigte wiederholte erfolgreiche Kompilierungen und `GET /admin 200`. Im Browser waren vollständige Neuladungen mit erneutem `[HMR] connected` mehrfach pro Sekunde reproduzierbar.
- Die Adminseite ruft `window.location.reload()` nur nach einem ausdrücklich ausgelösten Backup-Import auf. Dieser Ablauf wurde im Test nicht ausgelöst.
- Während der Schleife änderten sich bei einer Dateibeobachtung nur `.next/dev/trace` und das Entwicklungslog; keine Anwendungsquelldateien. Die letzten Trace-Ereignisse meldeten HMR mit leeren `updatedModules`.
- Derselbe aktuelle Anwendungscode lief auf einem frisch gestarteten, separaten Turbopack-Testserver auf Port 3001 mit `.next-qa` stabil. Der fehlerhafte Port-3000-Prozess gehörte zu einer länger laufenden `next dev`-Instanz.

## Behebung

Die eindeutig zugeordnete fehlerhafte `next dev`-Instanz wurde beendet. Anschließend war eine neu gestartete Instanz auf Port 3000 verfügbar und wurde im Browser geprüft. Ein Löschen des Entwicklungs-Caches oder Änderungen am Anwendungscode waren nicht erforderlich. Der genaue interne Auslöser der HMR-Schleife wurde nicht identifiziert; der Neustart beseitigte den reproduzierten Fehler.

Der separate Testserver wurde anschließend beendet. Die von Next.js für diesen Test automatisch ergänzten `.next-qa`-Einträge und Formatierungsänderungen in `tsconfig.json` wurden auf den Ausgangsstand zurückgesetzt; `git diff --exit-code -- tsconfig.json` bestand. Persistente Änderung dieses Auftrags ist nur diese Ergebnisdatei.

## Tatsächliche Prüfung

- `/admin` auf Port 3000 nach Neustart im Browser geladen: normale Darstellung, keine neue wiederholte HMR-Verbindung.
- Prompteditor geöffnet und eine lokale, nicht abgesendete Testeingabe eingesetzt. Editor und Eingabe blieben über mehrere Minuten erhalten, auch nach der einzelnen erwarteten HMR-Aktualisierung durch das Zurücksetzen der Testkonfiguration.
- Der separate Server auf Port 3001 zeigte ebenfalls keine wiederholten Neuladungen; anschließend war Port 3001 wieder frei.
- Keine KI-Test- oder Promptbearbeitungsaktion ausgelöst, keine externen Dokumentuploads, keine Browserdaten zurückgesetzt. Keine allgemeine Funktionsabnahme, keine erneute vollständige Test-/Buildserie, weil kein Anwendungscode geändert wurde.

## Grenzen und Übergabe

Der konkret gemeldete Localhost-Fehler ist nach dem Neustart nicht mehr reproduzierbar. Dies belegt keine allgemeine Fehlerfreiheit der Plattform. Bei erneutem Auftreten zuerst den aktuellen Entwicklungsprozess und die Browser-HMR-Meldungen prüfen; eine bereits laufende Instanz vor einem Neustart beenden. Dafür existieren bereits `npm run dev`, `npm run dev:clean` und `npm run dev:webpack`; kein zweiter Server sollte dieselbe `.next`-Ausgabe gleichzeitig verwenden. Zentrale Architektur- und Statusdateien wurden nicht verändert.
