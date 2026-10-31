# LEGAL-01 · Erstbewertung

**Stand: 28.10.2026 · Arbeitsannahme: Betreiber und Pilot in Deutschland, Nutzer überwiegend in der EU.** Dies ist eine kompakte Recherche, keine abschließende Rechtsberatung. Bewertet wurden das Briefing, der dokumentierte Projektstand und der Anwendungscode lesend; Serverkonfigurationen, Providerkonten, Verträge und eine außerhalb des Quellcodes betriebene Website wurden nicht geprüft.

## Kurzurteil

Ein kostenloser Zugang mit Einladungen ist nicht automatisch privat und erzeugt auch nicht automatisch eine Impressums-, AGB- oder Cookiebannerpflicht. Die persönliche Einladungsreihe kann die Ausnahme für rein persönliche oder familiäre Tätigkeit verlassen; entscheidend sind tatsächlicher Betreiber, Zweck, Zugangsauswahl und Nutzerkreis. Für den Betrieb mit fremden Konten sollte die DSGVO vorsorglich als anwendbar behandelt werden. Eine kosten- und prämienlose Einladungskette ist für sich genommen kein Schneeballsystem.

Vor einer breiteren Einladung sollten Betreiber-/Datenschutzinformationen, Providerverträge, Lösch- und Aufbewahrungsregeln sowie die Rechte der PDFs geklärt sein. Ob DSA, BFSG und Teile des Verbraucherrechts greifen, hängt noch von konkreten Betriebs- und Produktfakten ab.

## Vor einer breiteren Einladung

### 1. Betreiberangaben und Datenschutzhinweise bereitstellen

Der Medienstaatsvertrag verlangt von Anbietern von Telemedien, die nicht ausschließlich persönlichen oder familiären Zwecken dienen, Name und Anschrift leicht erkennbar, unmittelbar erreichbar und ständig verfügbar zu halten ([MStV § 18 Abs. 1, geltender Text](https://www.gesetze-bayern.de/Content/Document/MStV-18?view=Print)). Eine Einladungskette über den privaten Nahkreis hinaus macht diese Pflicht naheliegend; die Einordnung ist ohne tatsächlichen Betreiber- und Nutzungsrahmen nicht abschließend. Das DDG verlangt zusätzlich elektronische Kontaktangaben, wenn der Dienst geschäftsmäßig und in der Regel gegen Entgelt angeboten wird ([DDG § 5](https://www.gesetze-im-internet.de/ddg/__5.html)). „Kostenlos“ entscheidet diese Frage nicht allein. Aus dem beschriebenen Pilot folgt aber auch keine Pflicht, ein Unternehmen zu gründen.

Im geprüften Anwendungscode fand ich keine Impressums- oder Datenschutzseite und keinen entsprechenden Link. Vor dem nächsten größeren Nutzerkreis sollten eine erreichbare Betreiberinformation und eine Datenschutzinformation vorhanden sein. Falls eine private Wohnanschrift nicht veröffentlicht werden soll, muss eine rechtlich geeignete ladungsfähige Anschrift vorab geklärt werden; keine Ersatzadresse erfinden. Für ein journalistisch-redaktionelles Angebot sehe ich im Briefing und geprüften Code keinen Anhaltspunkt.

Die DSGVO-Ausnahme gilt nur für eine natürliche Person, die Daten im Rahmen ausschließlich persönlicher oder familiärer Tätigkeiten verarbeitet (Art. 2 Abs. 2 Buchst. c DSGVO). Dass der Pilot gratis, zugangsbeschränkt oder technisch privat ist, genügt dafür nicht. **Meine Einordnung:** Eine von einem Betreiber gehostete Kontoplattform mit fremden E-Mail-Adressen und einer weitergebbaren Mitgliederkette sollte nicht auf diese Ausnahme gestützt werden. Der EuGH hat eine freiwillige, nicht kommerzielle Veröffentlichung von Personendaten im Internet ebenfalls nicht als rein persönliche oder familiäre Tätigkeit behandelt; der Fall ist ein Hinweis, aber nicht identisch mit einer geschlossenen Kontoplattform ([EuGH, C-101/01, Lindqvist](https://curia.europa.eu/juris/showPdf.jsf?docid=71269&doclang=en)).

Vor Erhebung der Registrierungsdaten braucht es dann eine verständliche Information nach Art. 13 DSGVO: Betreiber/Verantwortlicher und Kontakt, Daten und Zwecke, Rechtsgrundlagen, Empfänger, Speicherfristen, Betroffenenrechte und Beschwerdeweg sowie gegebenenfalls Drittlandübermittlungen. Für Konto, E-Mail-Bestätigung und Login kommt Art. 6 Abs. 1 Buchst. b in Betracht, soweit ein Nutzungsvertrag besteht; Sicherheits- und Missbrauchsschutz kann auf Art. 6 Abs. 1 Buchst. f beruhen, aber erst nach dokumentierter Interessenabwägung. Erforderliche Kontoverarbeitung nicht pauschal als „Einwilligung“ abfragen. Die Anforderungen folgen insbesondere aus [Art. 5, 6, 12–13, 17, 24, 28, 32–34 und 44 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj/deu).

### 2. Hosting, Mail und Datenlebenszyklus dokumentieren

Für Contabo-Hosting und den im Briefing genannten Mittaro-Mailversand prüfen, wer welche Konto-, Einladungs-, Versand- und Protokolldaten verarbeitet, an welchem Ort und mit welchen Unterauftragnehmern. Soweit ein Anbieter als Auftragsverarbeiter handelt, braucht es den Vertrag nach Art. 28 DSGVO. Liegt eine Verarbeitung oder Weiterübermittlung außerhalb des EWR vor, ist zusätzlich ein zulässiger Transfermechanismus nach Kapitel V zu klären. Die vorliegenden Unterlagen belegen weder die konkreten Providerstandorte noch die dazugehörigen AV-Verträge; daraus folgt nicht, dass kein Vertrag existiert.

Vor Pilotbetrieb eine kurze Datenübersicht mit Fristen festlegen: insbesondere abgebrochene/abgelaufene Einladungen und Bestätigungsnachweise, Mail-Outbox, Sicherheitsprotokolle, Konten, Lernnotizen/-fortschritte und Sicherungen. Eine Selbstbedienungs-Schaltfläche zur Löschung verlangt die DSGVO nicht zwingend; erreichbar sein muss aber ein Verfahren für Auskunfts- und Löschbegehren. In den geprüften Auth-/Kontorouten fand ich keinen nutzerseitigen Weg zur vollständigen Kontolöschung. Art. 17 gewährt Löschung, soweit keine Ausnahme greift; Daten dürfen nicht ohne konkreten Zweck unbegrenzt in Logs und Sicherungen verbleiben. Für Sicherheitsvorfälle einen Zuständigen und Ablauf festhalten: Eine Meldung an die Aufsicht ist nach Art. 33 grundsätzlich binnen 72 Stunden nötig, wenn die Verletzung voraussichtlich ein Risiko für Betroffene begründet; Art. 34 betrifft voraussichtlich hohes Risiko.

Die DSGVO verlangt angemessene, risikogerechte Sicherheitsmaßnahmen und deren Nachweis, keinen pauschalen Maßnahmenkatalog ([Art. 24 und 32–34 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj/deu)). Im geprüften Authcode sind Admin-TOTP und eine HttpOnly-/SameSite-Sitzung erkennbar; das Secure-Cookie wird abhängig von einer HTTPS-Basisadresse gesetzt. Der Projektstatus belegt die neue Webdomain noch nicht mit einem produktiven HTTPS-/App-Origin. Vor Kontenbetrieb auf dieser Domain deshalb die tatsächliche HTTPS-Origin und Secure-Cookie-Konfiguration bestätigen.

### 3. Einladungskette eng und nachvollziehbar halten

Die gewünschte Aktivierung nach gültiger Einladung plus bestätigter E-Mail ist rechtlich nicht an sich problematisch. Maßgeblich sind Datenminimierung, klare Information und verlässliche Zugriffskontrolle. Der aktuelle Authcode kennt persönliche, an eine konkrete E-Mail gebundene Einladungen mit Ablauf-/Verbrauchsstatus; die geplante Mitglieder-zu-Mitglieder-Kette und automatische Aktivierung sind laut Briefing noch nicht umgesetzt.

Für eine klar begrenzte 1:1-Kette sollte jede Einladung einzeln, einmalig und befristet sein, widerrufbar bleiben und nach Bestätigung genau dem vorgesehenen Konto zugeordnet werden. Wenn die Einladung für eine bestimmte Person bestimmt ist, sollte die verifizierte Adresse mit ihr abgeglichen werden. Ein frei weiterleitbarer Token, der irgendeinen Inhaber automatisch zum Mitglied macht, verwischt diese Auswahl. Nur die normale Mitgliedsrolle vergeben; Einladungsbeziehung und Missbrauchsschutz sparsam speichern. Zweck und Frist der Einladungsdaten in die Datenschutzinformation aufnehmen.

Die derzeitigen Auth-Mails sind im geprüften Code auf Einladung, Adressbestätigung und Passwortzurücksetzung beschränkt; Marketing wurde dort nicht gefunden. Diese Nachrichten knapp und zweckgebunden halten. Der beschriebene manuelle Linkaustausch löst keine automatische Einladungswerbung per E-Mail aus. Sollte der Dienst selbst Nichtmitgliedern Einladungs-E-Mails senden, kann das Werbung sein; soweit § 7 UWG anwendbar ist, braucht E-Mail-Werbung die vorherige ausdrückliche Einwilligung des Empfängers. Die Eingabe einer fremden Adresse durch den Einladenden ersetzt diese nicht ([UWG § 7](https://www.gesetze-im-internet.de/uwg_2004/__7.html)).

### 4. PDF-Rechte für genau diesen Empfängerkreis bestätigen

Die Rechte sind nach Nutzerangabe grundsätzlich geklärt; ich habe keine Lizenzen oder Unterlagen geprüft und ziehe das nicht pauschal wieder in Zweifel. Vor der Erweiterung nur den konkreten Umfang belegen: Decken die Rechte Speicherung auf dem Server und Abruf durch alle Mitglieder der Einladungskette ab, oder nur einen kleineren/persönlichen Kreis? Nach § 15 Abs. 3 UrhG hängt „Öffentlichkeit“ davon ab, ob die Empfänger persönlich miteinander oder mit dem Verwerter verbunden sind; § 19a betrifft die öffentliche Zugänglichmachung. Ein Login allein beantwortet das nicht ([UrhG § 15](https://www.gesetze-im-internet.de/urhg/__15.html), [§ 19a](https://www.gesetze-im-internet.de/urhg/__19a.html)). Keine neue Klassifizierung der 449 PDFs ableiten. Nur bei unklarem Lizenzumfang vor dem breiten Zugang gezielt urheberrechtlich prüfen lassen.

## Bedingt relevant oder derzeit kein eigener Blocker

### DSA und Nutzerinhalte

Das Briefing beschreibt persönliche Notizen, Pläne und Fortschritte als getrennt; im geprüften Code fand ich keine öffentliche Nutzer-Postingfläche. Das spricht gegen die Unterkategorie „Online-Plattform“, die Informationen auf Bitte der Nutzer speichert und an die Öffentlichkeit verbreitet. Der DSA unterscheidet jedoch Hosting von Online-Plattformen; ob der Dienst als Hostingdienst einzuordnen ist, hängt unter anderem davon ab, ob er nutzerbereitgestellte Informationen als Vermittlungsdienst speichert und in den sachlichen DSA-Anwendungsbereich fällt. Der DSA stellt bei „Öffentlichkeit“ klar, dass Zugang per Registrierung nicht genügt, wenn Interessierte ohne menschliche Auswahl automatisch aufgenommen werden ([DSA Art. 3 und Erwägungsgrund 14](https://eur-lex.europa.eu/eli/reg/2022/2065/oj/deu)).

Vor dem Kettenstart deshalb verbindlich festhalten: Welche Texte/Dateien/Feedbacks laden Nutzer hoch, wer kann sie sehen, und wird jeder Empfänger wirklich einzeln ausgewählt? Ist DSA-Hosting einschlägig, braucht es unter anderem eine leicht erreichbare Meldemöglichkeit für rechtswidrige Inhalte (Art. 16), Kontaktpunkte (Art. 11–12) und gegebenenfalls Nutzungsbedingungen zu Inhaltsbeschränkungen (Art. 14). Eine allgemeine Pflicht zur Überwachung aller Inhalte besteht nach Art. 8 gerade nicht. Nicht allein aufgrund der Einladungskette eine Online-Plattform unterstellen.

### Cookies, Browser-Speicher, BFSG und Verbraucherrecht

§ 25 TDDDG verlangt grundsätzlich Einwilligung für Speicherungen/Zugriffe auf dem Endgerät, nimmt aber aus, was unbedingt erforderlich ist, um einen ausdrücklich gewünschten Dienst bereitzustellen ([TDDDG § 25](https://www.gesetze-im-internet.de/ttdsg/__25.html)). Die notwendige Anmeldesitzung dürfte darunter fallen; dafür ist kein pauschaler Cookiebanner nötig. Im aktuellen Code gibt es außerdem eine Session-Storage-Markierung, die eine Einführungsanimation ausblendet, und verschiedene Local-Storage-/Cache-Nutzungen. Die Animation ist nicht offensichtlich notwendig. Speicherzwecke einzeln klassifizieren; nicht notwendige Zugriffe entfernen oder vorab einwilligen lassen. Im geprüften Quellcode fand ich keine explizite Werbe- oder Analyse-Tracking-Einbindung; ein Live-Browseraudit war nicht Teil des Auftrags.

Das BFSG gilt nicht automatisch für jede kostenlose Website, sondern für benannte Produkt-/Dienstleistungskategorien und unter anderem für E-Commerce-Dienste, die im Hinblick auf einen Verbrauchervertrag angeboten werden. Bei digitalen Dienstleistungen können personenbezogene Daten verbrauchervertragliche Folgen haben; die §§ 312 Abs. 1a und 327 Abs. 3 BGB nehmen jedoch Daten aus, die ausschließlich zur Erfüllung der Leistung oder rechtlicher Pflichten verarbeitet werden ([BFSG §§ 1–3](https://www.gesetze-im-internet.de/bfsg/__1.html), [BGB § 312](https://www.gesetze-im-internet.de/bgb/__312.html), [§ 327](https://www.gesetze-im-internet.de/bgb/__327.html)). Auf dem derzeit beschriebenen kostenlosen, geschlossenen Pilot ohne Verkauf, Entgelt oder Werbung sehe ich keinen sicheren Anlass, ein vollständiges Verbraucher- oder BFSG-Pflichtenpaket als Vorbedingung anzunehmen. Vor entgeltlichen Angeboten, zusätzlichen Datenzwecken oder einer auf Vertragsschluss ausgerichteten Verbraucherleistung neu einordnen. Kleinstunternehmen sind bei Dienstleistungen nach § 3 Abs. 3 BFSG ausgenommen, falls die gesetzlichen Voraussetzungen erfüllt sind.

### Einladungskette ist nicht automatisch ein Schneeballsystem

Die UWG-Verbotsliste Nr. 14 setzt ein System voraus, bei dem Verbraucher einen finanziellen Beitrag leisten, um eine Vergütung allein oder hauptsächlich durch das Einführen weiterer Teilnehmer zu erlangen. Laut Briefing gibt es keine Zahlung, Prämie, Provision oder Verkäufe. Die bloße Form „Mitglied lädt eine Person ein“ erfüllt diese Merkmale daher nicht ([UWG, Anhang Nr. 14](https://www.gesetze-im-internet.de/uwg_2004/BJNR141400004.html)).

## Höchstens fünf entscheidende offene Fakten

1. Wer ist der tatsächliche Betreiber und wo ist er niedergelassen? Gibt es einen Verein/ein Unternehmen, Werbung, Spenden, wirtschaftliche Gegenleistungen oder ein verbundenes kostenpflichtiges Angebot?
2. Wird der geplante Einladungslink an eine bestimmte E-Mail gebunden, ist er einmalig/befristet, und darf er weitergeleitet werden, bevor diese Bindung greift?
3. Welche nutzerbereitgestellten Inhalte speichert der Dienst, und bleiben sie ausschließlich für das jeweilige Konto sichtbar oder können andere Mitglieder sie sehen?
4. Wo verarbeiten Contabo und Mittaro die betreffenden Daten, welche Unterauftragnehmer sind beteiligt, und liegen die passenden Art.-28-Vereinbarungen vor?
5. Decken die vorhandenen Rechtebelege Serverhosting und den Abruf durch sämtliche Mitglieder einer wachsenden Einladungskette ausdrücklich ab?

## Geprüfte Projektstellen

- In der aktuellen Anwendungssuche fand ich keine Impressums-/Datenschutzseite oder deren Link. Die Prüfung erfasst den Quellcode, nicht mögliche separat betriebene Webseiten.
- Der Authcode verwendet derzeit persönliche, E-Mail-gebundene Einladungen und Verifizierungs-/Passwortmails; die geplante automatische Mitgliederkette ist noch nicht umgesetzt.
- Es gibt Browser-Speicher und eine notwendige Auth-Sitzung; keine explizite Analytics-/Werbeeinbindung wurde im gezielten Quellcode-Suchlauf gefunden.
- Ein nutzerseitiger vollständiger Kontolöschweg war in den geprüften Auth-/Kontorouten nicht auffindbar.
- Diese Punkte belegen keine Gesamt-Compliance und ersetzen keine aktuelle Server-, Vertrags- oder Live-Origin-Prüfung.
