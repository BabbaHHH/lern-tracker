# IMPORT-01 Offline-Inventar

Das Skript untersucht lokale Klausurquellen, ohne Dateien in den Quellen zu ändern. Es erzeugt keine Klausur- oder Nutzerobjekte und führt keine Zusammenführung durch.

Vom App-Ordner aus lässt sich ein lokales Rohinventar mit aggregierter Zusammenfassung erzeugen:

```text
node --import tsx scripts/import-inventory/run.ts \
  --root '..' \
  --output /private/tmp/import-01-inventory.json \
  --summary docs/entwuerfe/IMPORT-01/inventory-summary-text.md \
  --text selected \
  --max-text-bytes 1048576
```

`--text none` liest nur Dateihash und Metadaten. `--text selected` bildet für die vorgesehenen Klausurquellen eine normalisierte Textprobe der ersten drei PDF-Seiten; große Dateien oberhalb von `--max-text-bytes` werden sichtbar übersprungen. Der Aufruf benötigt lokal `pdftotext`; fehlt das Programm, bleiben die Textstatuswerte als fehlgeschlagen erkennbar. Textinhalte selbst werden nicht in das Inventar geschrieben, sondern nur Länge und Hash der Probe.

Das Inventar unterscheidet:

- bytegleiche PDFs per SHA-256;
- normalisierte Fallkennungen aus Dateinamen und Metadaten;
- verschiedene Dateien mit gleicher Fallkennung als Versionskandidaten;
- getrennte Sachverhalts-/Lösungsdateien als mögliche Lösungsergänzung;
- gleiche Textproben auch bei abweichenden Dateinamen;
- wiederkehrende Klausur-IDs mit gleicher oder widersprüchlicher Metadatensignatur.

Die Zählungen der Quellen überschneiden sich. Absolute Pfade und vollständige Einzelzeilen gehören nur in das lokale Rohinventar; die eingecheckte Zusammenfassung enthält aggregierte Befunde und wenige notwendige Beispiele.

