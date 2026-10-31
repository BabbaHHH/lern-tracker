# Geprüftes Programmpaket auf den Contabo-Server kopieren

Vorbereitet am21.10.2026. Dieser Schritt überträgt ausschließlich das bereits geprüfte öffentliche Programmarchiv U08 einschließlich PDF-DL1/017. Es enthält555Programm-/Assetdateien; private Lernunterlagen, Bestandsdaten und tatsächliche Konfigurationen sind ausgeschlossen. Die Serverabnahme der übertragenen Datei folgt vor jeder Entpack-/Build-/Startaktion.

Der Serverchat arbeitet auf dem VPS und kann den Macpfad nicht direkt lesen. Für die einmalige Kopie ist der bereits eingerichtete SSH-Zugang vom Mac nötig. Planung hat keinen alternativen SSH-/UI-Weg benutzt.

Im Mac-Terminal genau diesen einen Kopiervorgang ausführen:

```sh
scp -p \
  "/Users/niklashauser/Desktop/Coding/Stex. Countdown/lern-tracker/deploy/pilot/targets/contabo-test/source-u08-20261020/program-source.tar.gz" \
  stex-contabo:/home/stex-ops/stex-admin/u08-program-source-20261020.tar.gz
```

Danach im Planungschat kurz „kopiert“ melden oder die konkrete Fehlermeldung mitteilen. Keine Zugangsdaten in den Chat schreiben. Noch keine weiteren Serverkommandos oder Archive entpacken.

## Feste Quell-/Zielbindung für den nächsten HOST

- Quelle: oben genannter regulärer Singlelink-Pfad,0600,6.694.573Byte. Am21.10. vor Übergabe erneut lokal gehasht; unverändert.
- ArchivSHA256: `9988df3e98520f7cb38f3e9f05f0b15b7cc519e41bb56b413005bcf6a0e78af9`.
- ManifestSHA256: `bf8b0be3b6bcb430bc65da06905ebee0e4bf0bda44e9c013ccab1d68f813cba9`.
- Inhalt555eindeutige reguläre Dateien,23.574.674unkomprimierteQuellbytes; portableTar-Metadaten. KeinReleaseReady-/Linuxbuild-/Onlinebeleg.
- Serverziel: `/home/stex-ops/stex-admin/u08-program-source-20261020.tar.gz`. VorNodeausführung als abwesend belegt; Parentstex-ops:stex-ops1001:1001,0775. Nach Nutzerkopie zuerst tatsächlich Datei-/Parentidentität/Typ/Rechte/Größe/SHA lesend prüfen; unerwarteten Bestand nicht ersetzen.
- Nur der aktuelle alleinige HOST nach CHATS.json führt spätere serverseitige Prüfungen aus. Bei drei abgeschlossenen größeren HOST-Aufträgen vorher kurze sichere Rotation anhand vorhandener Abschlussbelege; keine fertigen Paket-/Runtimeprüfungen neu starten.
- Erst danach konkrete neue Quellstaging-/Dienst-/Testzielaufträge binden. Keine privaten Dokumente/Bestandsdaten, echte Mails, Veröffentlichung oder neuen Schlüssel aus dieser Programmkopie ableiten.

