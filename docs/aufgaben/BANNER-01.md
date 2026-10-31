# BANNER-01 — Banner und Branding

Stand: 19.10.2026. Separater Bannerchat `01a15415-53eb-7b32-b154-a9fb4c2344f2`, eingerichtet auf ausdrücklichen Wunsch von Niklas im Planungschat. Lokale Aufgabenkennung für diesen begrenzten Zusatzauftrag; keine Übernahme von UI-01.

## Beauftragter Umfang

Bannerentwurf besprechen, Vorschau verbessern und prüfen, einfachen Einbauweg beschreiben. Dunkelblau, transparent, passend zum bestehenden hellen Tracker. Aktuelle direkte Nutzerkorrektur vom 19.10.: X großgeschrieben, „groß“ mit ß und Ausrufezeichen; in der Vorschau als „SteX wird groß!“ und „NH Studios“ umgesetzt. Automatisch beim ersten Öffnen auf den Besucher zufliegen, kontinuierlich größer werden und selbst verschwinden. Stärker transparent als der erste Entwurf. Handybedienbarkeit, Schließen und reduzierte Bewegung berücksichtigen.

Beim Anlegen noch keine Integration in Anwendungscode, Veröffentlichung, Bestellung oder weitere UI-/Hostingarbeit. Die minimale Appintegration wurde am 26.10.2026 ausdrücklich für R37 beauftragt und ist im Ergebnis dokumentiert. Gemeinsame Zentraldateien bleiben außerhalb dieses Schreibbereichs. Eigene Vorschau im beschreibbaren Chatordner und Ergebnis unter `docs/ergebnisse/BANNER-01.md`.

## Aktueller Entwurf

Gültiger Wortlaut „Es wird groß!“ und „NH Studios“, beide mittig. Dunkelblaue Fläche mit 64 % Deckkraft. Sichtbares Kreuz 9 px mit 18 % Deckkraft, bei Hover 60 %, bei Tastaturfokus klar sichtbar; Berührungsfläche 44 px.

Neueste direkte Korrektur: am Anfang langsamer, am Ende schneller; weiterhin zwei Sekunden Dauer und keine Verzögerung mitten im Flug. Skalierung von 0,286 auf 13,33 über 2.000 ms mit kontinuierlich beschleunigender Kurve `cubic-bezier(0.333333,0,0.666667,0)`. Ein-/Ausblenden separat mit gleicher Gesamtdauer; keine Zwischenstufen für die Größe. Automatischer Start, Wachstum über den dargestellten Bildschirm hinaus, am Ende vollständig verborgen, keine Wiederholungsschleife. Bei reduzierter Bewegung statische Anzeige für 2.800 ms. Diese Angaben ersetzen frühere Bewegungs-/Zeitvorschläge.

Abgleich beim App-Einbau am 26.10.2026: die zwei Sekunden lange Bewegung nutzt die bereits freigegebene Kurve `cubic-bezier(0.333333,0,0.666667,0)`; bei reduzierter Bewegung bleibt der Banner statisch und wird nach 2.800 ms verborgen. Der Text lautet weiterhin „Es wird groß!“.

Die R37-Appintegration unterscheidet das erste Öffnen von interner Navigation und merkt den Auftritt pro Browser-Tab.

## Ergebnis

Siehe [BANNER-01](../ergebnisse/BANNER-01.md). Astra bleibt in sämtlichen Varianten ausgeschlossen.
