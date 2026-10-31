# Planung · frischer Orchestrator zur vollständigen Portierung · 23.10.2026

## Direkter Auftrag und sichere Übernahme

Niklas: „ok, neuen orchestrator chat, der soll einen plan dafür machen und ihn umsetzen lassen und auch die anderen offenen chats nochmal überprüfen“. Autorisiert sind ein frischer Planungschat im selben lokalen Projekt, die Prüfung aller bestehenden Aufgaben-IDs01–17, ein konkreter Plan und seine koordinierte Umsetzung innerhalb bestehender Freigabegrenzen. Dies ist mehr als Plan-only; keinen weiteren allgemeinen Startauftrag abwarten. Vorgänger01a15fdd-616f-7c71-9114-75450d0d174c schreibt nach bestätigter Aktivierung keine Zentraldateien und verschickt keine Folgeaufträge mehr.

Erst Bestandsaufnahme und aktuelle oberste Abschnitte lesen: BESTANDSAUFNAHME_2026-10-23.md, PROJEKTSTATUS.md, TODO.md, CHAT_KOORDINATION.md, ARCHITEKTUR.md, CHATS.json und aktuelles Rundendokument. Alte „Aktuell“-Abschnitte darunter enthalten überholte Zwischenstände. Keine vollständigen langen Verläufe erneut laden. Neuer Orchestrator übernimmt nach Zuordnungs-/Heartbeatübertragung allein die Zentraldateien. Eine eigene neue Arbeitsrunde36 mit endlicher Reihenfolge, Abnahmekriterien und eindeutigen Dateibesitzen ist sinnvoll; Runde35 ist historische Serverumzugsplanung mit vielen erledigten Schritten.

## Ziel und aktueller Befund

Niklas ist auf dem Server angemeldet und beanstandet zutreffend die andere Oberfläche. Ziel ist seine bisherige lokale Anwendung mit vertrauter Gestaltung und vollständigen Kernabläufen im geschlossenen Kontobetrieb. Der Onlinebetrieb aktiviert STEX_LEARNING_MODE=account und damit eine parallele „Kontotestansicht“: andere Navigation und getrennte Home-/Profil-/Plan-/Kalender-/Schreibseiten, alte /klausuren-/admin-/feedback-Pfade geschlossen. Einige Originalbausteine werden wiederverwendet, vollständige gleiche Bedienung ist nicht fertig.

Originalcode ist erhalten. Letzter lesender Nachweis22.10.:281lokale Src-Dateien identisch zum übertragenen Archiv, das HOST zuvor gegen Server geprüft hatte (HOST_U09_LOKAL_ARCHIV_QUELLVERGLEICH_2026-10-22.json). Bezug für alte UI sind erhaltene Browserkomponenten im aktuellen Quellstand, nicht ungeprüfter alter Git-HEAD. NavBar, BrowserDashboardPage, BrowserOnboardingPage, BrowserLernkalenderPage und bestehende Schreib-/Klausuransichten sind Referenz. Vorhandene Kontohooks/Services für Profil/Fortschritt/Kalender/Tagesvorbereitung/Entwürfe/Schreiben/Dokumente/Einstellungen weiterverwenden und gezielt integrieren. Nicht einfach lokalen Modus einschalten: Browserpersistenz und lokale Dateischnittstellen würden wieder aktiv; alter Browserursprung und neuer HTTPSursprung teilen keine Daten.

Produktionsguard sperrt KI-Planerstellung, Check-in und Korrektur bewusst mit503/pilot_ai_deferred (src/lib/server/pilot-ai-guard.ts). Entscheidung17.10. für ersten Pilot; nicht als verlorenen Code behandeln oder ungefragt per Schalter umgehen. Plan soll die Lücke zur ursprünglichen Funktion sichtbar machen und nötige Freigaben korrekt staffeln. Persönliche Originalablage ist implementiert; Auswertung/Verbindung zu neuer KI-Planung fehlt. Widersprüchliche UItexte im Bericht festgehalten.

## Fertiger Betrieb und persönlicher Zugang

Live https://stex.62-171-162-115.sslip.io, beschränkt auf bestätigte Betreiberverbindung78.120.243.206/32. Linuxrelease, PostgreSQL,17Migrationen, Runtimegrants, private App-/DBverbindung/Bridge, HTTPS und Zertifikatsprüftimer fertig. Nicht neu installieren, bauen, migrieren oder deren fertige Prüfungen wiederholen.

Aktiver alleiniger Remote-HOST:01a1652f-88d5-72c3-b32e-ecb8f2d74a03, „10 · HOST-01 — Persönlicher Testzugang“, hostId remote-ssh-discovered:stex-contabo, Remoteprojekt96783a67-6fc7-45ee-a277-81e1d14876fd, cwd/home/stex-ops/stex-admin. Letzter Cursor38844c6f-c81c-441b-a2ef-55b549585a3b:53, letzter Turn01a167a5-7a83-7660-98ac-33cac7cf7ea6, fertig/idle. gpt-6.1-sol/High. Vor größerem neuen Auftrag Wechselregel prüfen; vorhandene Nachweise/Liveprozesse erhalten.

Persönlicher Adminzugang chips-eiweiss.2k@icloud.com ist **active/admin, Adresse und TOTP verifiziert, Bootstrap fertig**. Native exec-3e534879-812a-45d5-adb6-a8ef57c540eb Exit0, Abschluss HOST_ADMINABSCHLUSS_2026-10-23.json, Nutzer bestätigt danach Login. Keine Einladung, Passwortreset oder Verifikation erneut starten. Historische pending-/Ausgabesperren sind erledigte Zwischenstände. Es wurde keine externe Mail versandt.

Release /srv/stex/releases/u09-account-20261021-5krZ1A-EhTzTzk6hyIbwG; Node22.23.3/Next16.4.0; DBstex_test_20261020, Runtime stex_u09_runtime_20261021. Bestehende Schutzdateien /etc/stex/contabo-test/ niemals ausgeben. Originfehler wurde durch eigenen festen Next-Custom-Serverstarter behoben: öffentlicher Metadatenhost/443, tatsächlicher Listener127.0.0.1:3000. App UID901/keineCapabilities im privaten Namespace. HOST_REGISTRIERUNG_ORIGIN_ABSCHLUSS_2026-10-22.json und zugehörige Übergabe belegen positive Origin und fünf abgewiesene falsche Umschläge; kein Release-/Produktpatch. PG blieb aktiv.

## Offene Daten- und Betriebsarbeit

Kein tatsächlicher Altbestandsumzug: rund450bereits klassifizierte Klausuren samt PDFs, Fortschritt, Notizen und Kalenderbezügen wurden nicht automatisch übertragen. Keine Neuklassifizierung oder pauschaler Import des ganzen privaten Projektordners. Vor echter Übernahme benannten Quell-/Zielumfang, Erhalt von IDs/Notizen/Links, Sicherung und echten Rückweg prüfen; ausdrückliche separate Transferfreigabe bleibt erforderlich.

Lokaler Backup-/Restorecode und Tests vorhanden; unabhängige regelmäßige Serverbackups und tatsächlicher Serverrestore noch nicht abschließend belegt. Suchworker/Indexcode vorhanden, fertig laufender VPSworker und echter Bestandsindex nicht belegt. Regulärer Mailversand nicht eingerichtet; manueller Zugang dieses einen Kontos ersetzt ihn nicht. Vollständiger Nutzerablauf auf aktuellem Server, echte Geräte-/Mehrnutzerproben offen. Keine fehlende Abnahme als bestanden behandeln.

## Umsetzung und alle17Chats prüfen

Alle aktiven Zuordnungen/Cursor/Modelle ausschließlich aus CHATS.json. Einmal aktuelle kompakte wait_threads-Stände für01–17, danach nur relevante Berichte und konkrete Code-/Belegstellen. Status je ID unterscheiden: tatsächlich fertig, verwertbar aber nicht integriert, offen, unterbrochen, späterer Ausbau. Nichts Fertiges neu starten. Nicht17Chats gleichzeitig anwerfen. Bestehende direkte Autorisierung für begrenzte Aufgaben und Folgeaufträge gilt; gezielte frische Nachfolger derselben IDs nach Wechselregel erlaubt, keine unabhängigen neuen Projekte.

Vor jedem Writer exakte Pfade zuweisen, besonders Layout/Kontoseiten, gemeinsame Store-/Typ-/Schema-/Backupdateien. HOST allein bedient Server; Planung keine Tests/Builds/SSHersatzwege. Aufgaben führen notwendige neue Prüfungen selbst durch und melden echte Ergebnisse/Grenzen. Lokale Umsetzung und passende begrenzte Prüfungen sind durch den neuen Auftrag beauftragt. Bestehende direkte Freigaben nicht pauschal neu abfragen. Neue Kosten, Providerbuchungen/Keys, externe Dokumente, bezahlte KIaufrufe, reale Mail/Bestandsmigration und neue Veröffentlichungsumfänge bleiben separat konkret freizugeben, sofern vorhandener direkter Umfang sie nicht bereits abdeckt. Erst konkretes reviewbares Ergebnis herstellen.

Repo lern-tracker/ innerhalb des Projektordners; großer uncommitteter Gesamtstand (44getrackte Änderungen, viele neue Module). Kein Reset/Clean/Stash oder Worktree nur vom alten HEAD. Aktuelle gemeinsame Kopie erhalten.

Astra in jeder Variante strikt ausgeschlossen für Planung, Umsetzung, Review und Tests. Vorgänger nutzt gpt-6.1-sol/High; neue Orchestrierung ebenfalls. Andere zulässige Modelle/Reasoningstufen erhalten. Kurze klare Aufträge, keine unnötigen Wiederholungen von Plan/Review/Tests; Nutzer möchte schnell die vertraute Anwendung online nutzen.

Bestehenden Heartbeat stex-projektchats-koordinieren übernehmen, keine zweite Automation. Tatsächlich gespeicherte Frequenz90Minuten erhalten (historischer Prompt sagt30). Bei unverändertem/nicht handlungsfähigem Stand still, nur wesentliche Ergebnisse/Fehler/Entscheidungen melden.
