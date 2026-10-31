# BANNER-01 — Entwurf und Vorschauprüfung

Stand: 19.10.2026. Ausschließlich Entwurfsarbeit; aktuelle direkte Nutzerkorrektur und neue Prüfung im Nachtrag unten. Keine Integration in Anwendungscode.

## Ausgangspunkt und Dateien

Übergebene Vorschau aus Planung gelesen und in den eigenen Chatordner kopiert. Aktuelle zentrale Projektabschnitte und Repo-Regeln gelesen; zahlreiche fremde uncommittete Änderungen vorhanden und erhalten. Keine Produktdatei geändert. UI-01 bleibt separat zuständig.

- Eigene Vorschau: `/Users/niklashauser/.codex/visualizations/2026/10/19/01a15415-53eb-7b32-b154-a9fb4c2344f2/stex-banner.html`.
- Eigenes Briefing: `docs/aufgaben/BANNER-01.md`.
- Dieser Ergebnisbericht: `docs/ergebnisse/BANNER-01.md`.

Varianten „Sanfter Anflug“ und „Feste Leiste“, exakte Wunschtexte. Gemeinsame Vorschauhöhe stabilisiert, Bewegung beim Schließen beendet, lokaler Schalter zum Testen ohne Bewegung ergänzt. Anflug wird in der Entwurfsvorschau bewusst erst über „Anflug ansehen“ ausgelöst. Georgia dient weiterhin als Annäherung an die Produktschrift Newsreader.

## Tatsächliche Prüfung

Lokale isolierte Vorschau mit dem Renderer des visualize-Skills im Codex-Browser geöffnet; kein Appserver/DB-/Build-/Lastlauf. Desktopansicht visuell geprüft. Bei expliziter Browserbreite 320 px beide Varianten visuell geprüft; beim Banner DOM-Messung ohne horizontales Überlaufen und Schließen-Ziel 44 px breit. Schließen entfernt Banner und setzt Fokus auf „Anflug ansehen“; erneutes Anzeigen geprüft. Variantenwechsel und bewegungsfreie Vorschau geprüft. Die Vorschau berücksichtigt `prefers-reduced-motion` sowie Änderungen dieses Signals im Code; keine tatsächliche Umschaltung des Betriebssystems und keine physische Handy-/Safari-Abnahme. Keine Modellaufrufe oder Dokumentuploads.

## Einfacher späterer Einbauweg — noch nicht beauftragt

Eine kleine Client-Komponente mit scoped Gestaltung und nativer Browseranimation; bestehende Produktschriften übernehmen, keine zusätzliche Animationsbibliothek nötig. An einem gemeinsam abgestimmten Platz in der Anwendungshülle einhängen. Vorgeschlagene Besuchskennung in sessionStorage könnte verhindern, dass interne Navigation oder Neuladen die Bewegung wiederholt; dies wäre pro Browser-Tab und müsste als genaue Bedeutung von „Besuch“ bestätigt werden. Bei blockiertem Speicher ohne Fehler weiterlaufen. Schließen und reduzierte Bewegung auch im echten Anwendungskontext prüfen. Die feste Leiste braucht keine Animation und bleibt im normalen Seitenfluss.

Finale Variante, Häufigkeit und konkretes gemeinsames Schreibfenster sind offen. Keine zentrale Architekturentscheidung, keine Integration, kein Deployment und kein Kauf erfolgt.

## Nutzerkorrektur und überarbeitete Vorschau — 19.10.2026

Die jüngste Anweisung entscheidet das gewünschte Verhalten: X großschreiben, „groß“ mit ß und abschließend „!“, automatisch beim ersten Öffnen zufliegen, immer größer werden und dann verschwinden; mehr Transparenz. Schriftzug in der Vorschau „SteX wird groß!“, „NH Studios“ erhalten. Frühere Empfehlung dauerhafter Sichtbarkeit und feste Leiste sind dadurch für den aktuellen Entwurf überholt.

Eigene Vorschau durch eine einzelne automatische Variante ersetzt: 2.800 ms, Wachstum von 0,28 auf 1,62, zuletzt ausblenden, anschließend komplette Überlagerung verborgen. Keine Endlosschleife. Dunkelblau mit 64 % Deckkraft statt ungefähr 90 %; weniger Hintergrundunschärfe. Schließen/Escape bleiben möglich. Reduzierte Bewegung: statische Anzeige und zeitgesteuertes Verbergen. Replay dient nur der Entwurfsbesprechung. Exakte Dauer und Deckkraft sind hier gewählte Entwurfswerte.

Im lokalen Codex-Browser automatisches Erscheinen beim Laden beobachtet; Replay und animierter Anfang visuell geprüft. Vollständiges automatisches Verbergen anschließend per sichtbarem Zustand und hidden-Attribut bestätigt. Bei 320 px bewegungsfreie Darstellung visuell geprüft, nach gleicher Dauer ebenfalls vollständig verborgen; kein horizontales Überlaufen gemessen. Keine Browser-Konsolenfehler. Temporäre Größenänderung zurückgesetzt und eigener Vorschauprozess beendet. Keine physische Handy-/Safari-/OS-Bewegungseinstellungsprüfung.

Nur eigene Vorschau, eigenes Briefing und dieser Bericht geändert. Der Unterschied zwischen erstem Appbesuch und interner Navigation bleibt beim späteren Einbau zu implementieren; die Vorschau startet einmal beim Laden. Keine Produktintegration, kein Build, Deployment, Kauf oder externer Dokumenttransfer.

## Weitere Textkorrektur — 19.10.2026

Auf direkte Anweisung „statt Stex bitte Es“ Bannerüberschrift und gespeicherten Vorschautext auf „Es wird groß!“ geändert. „NH Studios“, Transparenz und Bewegungsablauf erhalten. Reine Textänderung im eigenen Entwurf; per Dateirücklesen geprüft, keine neue Browser-/Geräteabnahme.

## Zentrierung und stärkerer Flug zum Zuschauer — 19.10.2026

Direkte Nutzerkorrektur umgesetzt: „Es wird groß!“ und „NH Studios“ mittig im Banner, symmetrische Innenabstände; sichtbares Schließkreuz von 24 auf 14 px verkleinert, 44-px-Berührungsfläche erhalten. Die bisherige Endgröße 1,62 ersetzt durch perspektivische Vorwärtsbewegung mit 800 px Perspektive, von −2.000 bis +740 px Tiefe. Rechnerisch projizierte Größe von circa 0,286 bis 13,33; Schrift und Fläche wachsen weit über den dargestellten Bildschirm hinaus. Deckkraft bis 86 % der Laufzeit erhalten, danach auf null; weiterhin 2.800 ms, anschließend vollständig verborgen. Reduzierte Bewegung bleibt statisch und zeitgesteuert.

Lokale Browserprüfung: zentrierte Texte und kleineres Kreuz auf Desktop und bei 320 px visuell geprüft; CSS-Messung bestätigt center/14 px/44 px. Perspektivische Transformationsmatrix während des Anflugs gelesen, automatisches vollständiges Verbergen erneut bestätigt. Keine Aufnahme der gesamten Bewegung oder physische Geräteabnahme. Nur eigene Vorschau, eigenes Briefing und dieser Bericht geändert; weiterhin keine Produktintegration.

## Schnellere Bewegung und fast unsichtbares Kreuz — 19.10.2026

Direkte Nutzerkorrektur: Animationsdauer von 2.800 auf 1.600 ms verkürzt; gleiche Flugbahn und Endgröße. Sichtbares Kreuz von 14 auf 9 px und 18 % Deckkraft reduziert. Bei Hover 60 %, bei Tastaturfokus vollständig sichtbar; Berührungsfläche weiterhin 44 px. Bewegungsfreie Anzeige bleibt 2.800 ms lesbar. Geänderte Werte per Dateirücklesen bestätigt; keine neue Browser-/Geräteabnahme für diese Parameteränderung. Nur eigene Vorschau und eigene Dokumentation geändert.

## Gleichmäßiger Ablauf ohne Tempowechsel — 19.10.2026

Nutzer bemängelt schnellen Eintritt, kurze Verzögerung und erneutes Beschleunigen. Ursache: unterschiedliche Geschwindigkeiten zwischen den Tiefen-Zwischenstufen, zusätzlich nichtlineare perspektivische Größenwirkung. Bewegung auf genau zwei Skalierungswerte (0,286 → 13,33) mit linearer Interpolation über unverändert 1.600 ms vereinfacht. Sichtbare Größe wächst damit durchgehend mit konstantem Tempo. Deckkraft läuft als eigene Animation; gemeinsame Bereinigung beendet beide Effekte. Keine Pause oder weitere Größen-Zwischenstufe.

Lokale Browserprüfung: Replay/Bewegung sichtbar, zwei aufeinanderfolgende DOM-Skalierungen 2,32445 und 3,13241 gelesen, Bildschirm überfüllende Größe visuell gesehen; vollständiges automatisches Verbergen bestätigt. Keine Konsolenfehler. Versuch des vorzeitigen Schließens an bewegtem Ziel lieferte keinen eindeutigen Sichtnachweis, daher hier keine erneute Schließen-Abnahme. Keine neue Geräteprüfung oder Produktintegration. Eigene Vorschau und Dokumentation aktualisiert.

## Dauer auf zwei Sekunden — 19.10.2026

Auf Nutzerwunsch „vllt 2 sek“ Größenanimation und separate Deckkraftanimation auf jeweils 2.000 ms gesetzt. Gleichmäßige lineare Bewegung erhalten. Werte per Dateirücklesen geprüft; keine neue Browser-/Geräteabnahme für diese reine Daueränderung. Eigene Vorschau und Dokumentation aktualisiert.

## Langsamer Start und schnellere Endbewegung — 19.10.2026

Auf neue Nutzersteuerung Größenanimation von linear auf `cubic-bezier(0.333333,0,0.666667,0)` geändert: annähernd kubischer Fortschritt, damit langsamer Anfang und kontinuierliches Beschleunigen ohne Geschwindigkeitswechsel durch Zwischenstufen. Dauer weiter 2.000 ms; separate Deckkraftkurve erhalten. Geänderte Werte per Dateirücklesen geprüft, keine neue Browser-/Geräteabnahme. Eigene Vorschau und Dokumentation aktualisiert.

## R37-Appintegration — 26.10.2026

Auf ausdrücklichen Einbauauftrag den Banner als Client-Komponente ergänzt und im bestehenden Root-Layout eingehängt. Die vorhandenen Änderungen an Layout, Scrollverhalten und übrigen Anwendungsdateien erhalten. Texte „Es wird groß!“ und „NH Studios“ sind mittig; dunkelblaue Fläche 64 % Deckkraft, kleines Kreuz 9 px bei 18 % Deckkraft mit 44-px-Berührungsfläche. Der Flug geht in zwei Sekunden kontinuierlich von Skala 0,286 auf 13,33 und verwendet die freigegebene Kurve `cubic-bezier(0.333333,0,0.666667,0)`. Die getrennte lineare Deckkraftanimation blendet den Banner aus.

Der Auftritt wird pro Browser-Tab mit `sessionStorage` nur einmal markiert; interne Navigation und Neuladen im Tab starten ihn nicht erneut. Falls `sessionStorage` nicht verfügbar ist, verhindert zusätzlich eine modulweite Kennung Wiederholungen während derselben geladenen Anwendung. Escape und das Schließkreuz beenden den Banner. Bei reduzierter Bewegung erscheint er statisch und verschwindet nach 2.800 ms. Es gibt keine Scrollsperre und keinen automatischen Fokuswechsel.

Gezielte Prüfung: `npx eslint src/components/branding-intro.tsx src/app/layout.tsx` erfolgreich. Kein Build, kein Appserver und keine Browser-/Produktabnahme gemäß Integrationsumfang. Details und Dateigrenzen stehen in [R37-INTEGRATION.md](../entwuerfe/BANNER-01/R37-INTEGRATION.md).

## Sichtbarkeitsbefund R37 — 27.10.2026

Auf den direkten Nutzerbefund „Es erscheint gar nicht“ den aktuellen BrandingIntro-Code, CSS und Layout-Mount geprüft. Kein belegter Mount-, SSR-/Hydration-, Storage- oder CSS-Fehler gefunden. Der freigegebene Einmal-pro-Tab-Ablauf und alle Designwerte bleiben erhalten.

Gezielter neuer Funktionsbeleg auf der öffentlichen Anmeldeseite `/konto/anmelden`, ohne Anmeldung oder Formulareingabe: in einem frischen Tab erschien „Es wird groß!“ mit „NH Studios“. Der sichtbare Card-State trug beide erwarteten Animationsnamen, `branding-intro-flight` und `branding-intro-fade`; gemessen wurden `opacity: 0.416844`, `transform: matrix(0.286484, 0, 0, 0.286484, 0, 0)` und `z-index: 100`. Der Screenshot zeigte den Banner über dem Anmeldeformular. Danach war der Banner ausgeblendet und die Überschrift „Anmelden“ weiterhin sichtbar. Ein Reload desselben Tabs zeigte ihn nicht erneut.

Damit funktioniert das erste Öffnen auf der geprüften öffentlichen Seite; die konkrete Ursache des Nutzerfalls ist nicht bestimmt. Die Regel unterdrückt absichtlich eine Wiederholung nach Reload/interner Navigation im selben Tab. Ohne Sitzungsdaten einzusehen lässt sich nicht feststellen, ob der gemeldete Fall in einem bereits verwendeten Tab auftrat. Keine Produktdatei geändert, kein Build, Testserver, DB-, Auth- oder Backupvorgang. Details: [R37-SICHTBARKEIT-FIX.md](../entwuerfe/BANNER-01/R37-SICHTBARKEIT-FIX.md).

## Erst-Render-Fix R37 — 28.10.2026

Den Grund für den verzögerten Erstauftritt behoben: Die Clientkomponente gab vor der Hydration und einem zusätzlichen Frame zunächst `null` zurück. Der Banner steht jetzt bereits im serverseitigen HTML. Ein über Next.js `beforeInteractive` eingebundenes, konstantes Bootstrap liest den vorhandenen Tabmarker früh; bei einem bereits gesehenen Tab blendet eine CSS-Marke das SSR-Element aus. Bei frischer oder blockierter Sitzung bleibt das Banner sichtbar; bestehender Fallback und modulweiter Schutz gegen Wiederholungen bei blockiertem Speicher bleiben erhalten.

Die Bewegung bleibt bei zwei Sekunden und hat nun ab dem ersten Animationsframe eine kleine Vorwärtsgeschwindigkeit, die stetig zunimmt: `cubic-bezier(0.333333,0.05,0.666667,0.25)`. Auch die Deckkraft startet sofort sichtbar und blendet nur am Ende aus. Bei reduzierter Bewegung bleibt der Banner statisch und endet nach 2.800 ms. Gezieltes ESLint, isoliertes SSR-Markup und VM-Mocks für frische, bereits gesehene und blockierte Sitzung waren erfolgreich. Kein Build, Browserlauf oder Deployment. Die Grenze der First-Paint-Abnahme und der lokale Stand stehen in [R37-FIRST-PAINT-20261028.md](../entwuerfe/BANNER-01/R37-FIRST-PAINT-20261028.md).

