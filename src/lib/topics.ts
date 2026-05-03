import { Topic } from "./types";

// Hierarchische Themenstruktur für das 2. juristische Staatsexamen Berlin (GJPA)
// 4-Ebenen: Rechtsgebiet → Mat/Proz → Subkategorie → Leaf

export const TOPICS: Topic[] = [
  // ===== ZIVILRECHT =====
  { id: "zr", parentId: null, label: "Zivilrecht", area: "zr", sortOrder: 1 },

  // ----- ZR Materielles Recht -----
  { id: "zr-mat", parentId: "zr", label: "Materielles Recht", area: "zr", sortOrder: 1 },

  // BGB AT
  { id: "zr-mat-at", parentId: "zr-mat", label: "BGB AT", area: "zr", sortOrder: 1 },
  { id: "zr-mat-at-vertragsschluss-145ff", parentId: "zr-mat-at", label: "Vertragsschluss (§§ 145 ff.)", area: "zr", sortOrder: 1 },
  { id: "zr-mat-at-willenserklaerung-wirksamwerden-130", parentId: "zr-mat-at", label: "WE / Wirksamwerden (§ 130)", area: "zr", sortOrder: 2 },
  { id: "zr-mat-at-geschaeftsfaehigkeit-104ff", parentId: "zr-mat-at", label: "Geschäftsfähigkeit (§§ 104 ff.)", area: "zr", sortOrder: 3 },
  { id: "zr-mat-at-stellvertretung-164ff", parentId: "zr-mat-at", label: "Stellvertretung (§§ 164 ff.)", area: "zr", sortOrder: 4 },
  { id: "zr-mat-at-agb-305ff", parentId: "zr-mat-at", label: "AGB (§§ 305 ff.)", area: "zr", sortOrder: 5 },
  { id: "zr-mat-at-scheingeschaeft-117", parentId: "zr-mat-at", label: "Scheingeschäft (§ 117)", area: "zr", sortOrder: 6 },
  { id: "zr-mat-at-formmangel-125", parentId: "zr-mat-at", label: "Formmangel (§ 125)", area: "zr", sortOrder: 7 },
  { id: "zr-mat-at-verbotsgesetz-134", parentId: "zr-mat-at", label: "Verbotsgesetz (§ 134)", area: "zr", sortOrder: 8 },
  { id: "zr-mat-at-sittenwidrigkeit-138", parentId: "zr-mat-at", label: "Sittenwidrigkeit (§ 138)", area: "zr", sortOrder: 9 },
  { id: "zr-mat-at-bedingung-158ff", parentId: "zr-mat-at", label: "Bedingung (§§ 158 ff.)", area: "zr", sortOrder: 10 },
  { id: "zr-mat-at-anfechtung-119ff", parentId: "zr-mat-at", label: "Anfechtung (§§ 119 ff.)", area: "zr", sortOrder: 11 },
  { id: "zr-mat-at-verjaehrung-214", parentId: "zr-mat-at", label: "Verjährung (§ 214)", area: "zr", sortOrder: 12 },
  { id: "zr-mat-at-treu-und-glauben-242", parentId: "zr-mat-at", label: "Treu und Glauben (§ 242)", area: "zr", sortOrder: 13 },

  // Schuldrecht AT
  { id: "zr-mat-schuld-at", parentId: "zr-mat", label: "Schuldrecht AT", area: "zr", sortOrder: 2 },
  { id: "zr-mat-schuld-at-erfuellung-362", parentId: "zr-mat-schuld-at", label: "Erfüllung (§ 362)", area: "zr", sortOrder: 1 },
  { id: "zr-mat-schuld-at-ruecktritt-346ff", parentId: "zr-mat-schuld-at", label: "Rücktritt (§§ 346 ff.)", area: "zr", sortOrder: 2 },
  { id: "zr-mat-schuld-at-stoerung-geschaeftsgrundlage-313", parentId: "zr-mat-schuld-at", label: "Störung der Geschäftsgrundlage (§ 313)", area: "zr", sortOrder: 3 },
  { id: "zr-mat-schuld-at-unmoeglichkeit-275", parentId: "zr-mat-schuld-at", label: "Unmöglichkeit (§ 275)", area: "zr", sortOrder: 4 },
  { id: "zr-mat-schuld-at-schadensersatz-nichtleistung-280ff", parentId: "zr-mat-schuld-at", label: "SE Nichtleistung (§§ 280 ff.)", area: "zr", sortOrder: 5 },
  { id: "zr-mat-schuld-at-schadensersatz-schlechtleistung-280ff", parentId: "zr-mat-schuld-at", label: "SE Schlechtleistung (§§ 280 ff.)", area: "zr", sortOrder: 6 },
  { id: "zr-mat-schuld-at-cic-311-2", parentId: "zr-mat-schuld-at", label: "c.i.c. (§ 311 II)", area: "zr", sortOrder: 7 },
  { id: "zr-mat-schuld-at-vsd", parentId: "zr-mat-schuld-at", label: "VSD", area: "zr", sortOrder: 8 },
  { id: "zr-mat-schuld-at-dsl", parentId: "zr-mat-schuld-at", label: "DSL", area: "zr", sortOrder: 9 },
  { id: "zr-mat-schuld-at-schadensumfang-249ff", parentId: "zr-mat-schuld-at", label: "Schadensumfang (§§ 249 ff.)", area: "zr", sortOrder: 10 },

  // Schuldrecht BT
  { id: "zr-mat-schuld-bt", parentId: "zr-mat", label: "Schuldrecht BT", area: "zr", sortOrder: 3 },
  { id: "zr-mat-schuld-bt-digitale-produkte-327ff", parentId: "zr-mat-schuld-bt", label: "Digitale Produkte (§§ 327 ff.)", area: "zr", sortOrder: 1 },
  { id: "zr-mat-schuld-bt-kauf-mangel-434ff", parentId: "zr-mat-schuld-bt", label: "Kauf: Mangel (§§ 434 ff.)", area: "zr", sortOrder: 2 },
  { id: "zr-mat-schuld-bt-kauf-nacherfuellung-439", parentId: "zr-mat-schuld-bt", label: "Kauf: Nacherfüllung (§ 439)", area: "zr", sortOrder: 3 },
  { id: "zr-mat-schuld-bt-kauf-minderung-441", parentId: "zr-mat-schuld-bt", label: "Kauf: Minderung (§ 441)", area: "zr", sortOrder: 4 },
  { id: "zr-mat-schuld-bt-kauf-verbrauchergueter-474ff", parentId: "zr-mat-schuld-bt", label: "Verbrauchsgüterkauf (§§ 474 ff.)", area: "zr", sortOrder: 5 },
  { id: "zr-mat-schuld-bt-werkvertrag-mangel-634ff", parentId: "zr-mat-schuld-bt", label: "Werkvertrag: Mangel (§§ 634 ff.)", area: "zr", sortOrder: 6 },
  { id: "zr-mat-schuld-bt-buergschaft-765ff", parentId: "zr-mat-schuld-bt", label: "Bürgschaft (§§ 765 ff.)", area: "zr", sortOrder: 7 },
  { id: "zr-mat-schuld-bt-darlehen-488ff", parentId: "zr-mat-schuld-bt", label: "Darlehen (§§ 488 ff.)", area: "zr", sortOrder: 8 },
  { id: "zr-mat-schuld-bt-verbundene-geschaefte-358ff", parentId: "zr-mat-schuld-bt", label: "Verbundene Geschäfte (§§ 358 ff.)", area: "zr", sortOrder: 9 },
  { id: "zr-mat-schuld-bt-makler-652ff", parentId: "zr-mat-schuld-bt", label: "Makler (§§ 652 ff.)", area: "zr", sortOrder: 10 },
  { id: "zr-mat-schuld-bt-reise-651aff", parentId: "zr-mat-schuld-bt", label: "Reise (§§ 651a ff.)", area: "zr", sortOrder: 11 },
  { id: "zr-mat-schuld-bt-miete-hauptpflichten-535ff", parentId: "zr-mat-schuld-bt", label: "Miete: Hauptpflichten (§§ 535 ff.)", area: "zr", sortOrder: 12 },
  { id: "zr-mat-schuld-bt-miete-vermieterpfandrecht-562", parentId: "zr-mat-schuld-bt", label: "Miete: Vermieterpfandrecht (§ 562)", area: "zr", sortOrder: 13 },
  { id: "zr-mat-schuld-bt-leasing", parentId: "zr-mat-schuld-bt", label: "Leasing", area: "zr", sortOrder: 14 },
  { id: "zr-mat-schuld-bt-dienstvertrag-611ff", parentId: "zr-mat-schuld-bt", label: "Dienstvertrag (§§ 611 ff.)", area: "zr", sortOrder: 15 },
  { id: "zr-mat-schuld-bt-schenkung-516ff", parentId: "zr-mat-schuld-bt", label: "Schenkung (§§ 516 ff.)", area: "zr", sortOrder: 16 },
  { id: "zr-mat-schuld-bt-schuldversprechen-780ff", parentId: "zr-mat-schuld-bt", label: "Schuldversprechen (§§ 780 ff.)", area: "zr", sortOrder: 17 },
  { id: "zr-mat-schuld-bt-goa-berechtigt-683", parentId: "zr-mat-schuld-bt", label: "GoA berechtigt (§ 683)", area: "zr", sortOrder: 18 },
  { id: "zr-mat-schuld-bt-goa-unberechtigt-684", parentId: "zr-mat-schuld-bt", label: "GoA unberechtigt (§ 684)", area: "zr", sortOrder: 19 },
  { id: "zr-mat-schuld-bt-bereicherung-leistungskondiktion-812", parentId: "zr-mat-schuld-bt", label: "Leistungskondiktion (§ 812)", area: "zr", sortOrder: 20 },
  { id: "zr-mat-schuld-bt-bereicherung-nichtleistungskondiktion-812", parentId: "zr-mat-schuld-bt", label: "Nichtleistungskondiktion (§ 812)", area: "zr", sortOrder: 21 },
  { id: "zr-mat-schuld-bt-bereicherung-umfang-818", parentId: "zr-mat-schuld-bt", label: "Bereicherung: Umfang (§ 818)", area: "zr", sortOrder: 22 },
  { id: "zr-mat-schuld-bt-bereicherung-mehrpersonenverhaeltnis", parentId: "zr-mat-schuld-bt", label: "Bereicherung: Mehrpersonenverhältnis", area: "zr", sortOrder: 23 },
  { id: "zr-mat-schuld-bt-delikt-verkehrsunfall-stvg", parentId: "zr-mat-schuld-bt", label: "Delikt: Verkehrsunfall / StVG", area: "zr", sortOrder: 24 },
  { id: "zr-mat-schuld-bt-delikt-rechtsgutsverletzung-823-1", parentId: "zr-mat-schuld-bt", label: "Delikt: Rechtsgut (§ 823 I)", area: "zr", sortOrder: 25 },
  { id: "zr-mat-schuld-bt-delikt-schutzgesetz-823-2", parentId: "zr-mat-schuld-bt", label: "Delikt: Schutzgesetz (§ 823 II)", area: "zr", sortOrder: 26 },
  { id: "zr-mat-schuld-bt-delikt-verrichtungsgehilfe-831", parentId: "zr-mat-schuld-bt", label: "Delikt: Verrichtungsgehilfe (§ 831)", area: "zr", sortOrder: 27 },
  { id: "zr-mat-schuld-bt-delikt-tierhalter-832ff", parentId: "zr-mat-schuld-bt", label: "Delikt: Tierhalter (§§ 832 ff.)", area: "zr", sortOrder: 28 },
  { id: "zr-mat-schuld-bt-beseitigung-unterlassung-1004", parentId: "zr-mat-schuld-bt", label: "Beseitigung/Unterlassung (§ 1004)", area: "zr", sortOrder: 29 },

  // Sachenrecht
  { id: "zr-mat-sach", parentId: "zr-mat", label: "Sachenrecht", area: "zr", sortOrder: 4 },
  { id: "zr-mat-sach-erwerb-beweglich-929ff", parentId: "zr-mat-sach", label: "Erwerb beweglich (§§ 929 ff.)", area: "zr", sortOrder: 1 },
  { id: "zr-mat-sach-anwartschaftsrecht", parentId: "zr-mat-sach", label: "Anwartschaftsrecht", area: "zr", sortOrder: 2 },
  { id: "zr-mat-sach-gutglaubenserwerb-932ff", parentId: "zr-mat-sach", label: "Gutglaubenserwerb (§§ 932 ff.)", area: "zr", sortOrder: 3 },
  { id: "zr-mat-sach-ersitzung-937", parentId: "zr-mat-sach", label: "Ersitzung (§ 937)", area: "zr", sortOrder: 4 },
  { id: "zr-mat-sach-verbindung-vermischung-946ff", parentId: "zr-mat-sach", label: "Verbindung/Vermischung (§§ 946 ff.)", area: "zr", sortOrder: 5 },
  { id: "zr-mat-sach-erwerb-grundstueck-873-925", parentId: "zr-mat-sach", label: "Erwerb Grundstück (§§ 873, 925)", area: "zr", sortOrder: 6 },
  { id: "zr-mat-sach-vormerkung-883ff", parentId: "zr-mat-sach", label: "Vormerkung (§§ 883 ff.)", area: "zr", sortOrder: 7 },
  { id: "zr-mat-sach-ebv-herausgabe-985", parentId: "zr-mat-sach", label: "EBV: Herausgabe (§ 985)", area: "zr", sortOrder: 8 },
  { id: "zr-mat-sach-ebv-nutzungen-schadensersatz-987ff", parentId: "zr-mat-sach", label: "EBV: Nutzungen/SE (§§ 987 ff.)", area: "zr", sortOrder: 9 },
  { id: "zr-mat-sach-ebv-verwendungen-994ff", parentId: "zr-mat-sach", label: "EBV: Verwendungen (§§ 994 ff.)", area: "zr", sortOrder: 10 },
  { id: "zr-mat-sach-hypothek-1113ff", parentId: "zr-mat-sach", label: "Hypothek (§§ 1113 ff.)", area: "zr", sortOrder: 11 },
  { id: "zr-mat-sach-grundschuld-1191ff", parentId: "zr-mat-sach", label: "Grundschuld (§§ 1191 ff.)", area: "zr", sortOrder: 12 },

  // HGB
  { id: "zr-mat-hgb", parentId: "zr-mat", label: "HGB", area: "zr", sortOrder: 5 },
  { id: "zr-mat-hgb-kaufmann-1ff", parentId: "zr-mat-hgb", label: "Kaufmann (§§ 1 ff.)", area: "zr", sortOrder: 1 },
  { id: "zr-mat-hgb-publizitaet-15", parentId: "zr-mat-hgb", label: "Publizität (§ 15)", area: "zr", sortOrder: 2 },
  { id: "zr-mat-hgb-handelsfirma-17ff", parentId: "zr-mat-hgb", label: "Handelsfirma (§§ 17 ff.)", area: "zr", sortOrder: 3 },
  { id: "zr-mat-hgb-vertretung-prokura-48ff", parentId: "zr-mat-hgb", label: "Vertretung/Prokura (§§ 48 ff.)", area: "zr", sortOrder: 4 },
  { id: "zr-mat-hgb-handelsgeschaeft-343ff", parentId: "zr-mat-hgb", label: "Handelsgeschäft (§§ 343 ff.)", area: "zr", sortOrder: 5 },

  // Gesellschaft
  { id: "zr-mat-ges", parentId: "zr-mat", label: "Gesellschaftsrecht", area: "zr", sortOrder: 6 },
  { id: "zr-mat-ges-gbr-aussenhaftung-akmo", parentId: "zr-mat-ges", label: "GbR: Außenhaftung (Akzessorietätsmodell)", area: "zr", sortOrder: 1 },
  { id: "zr-mat-ges-vertretung-zurechnung", parentId: "zr-mat-ges", label: "Vertretung/Zurechnung", area: "zr", sortOrder: 2 },

  // Familie
  { id: "zr-mat-fam", parentId: "zr-mat", label: "Familienrecht", area: "zr", sortOrder: 7 },
  { id: "zr-mat-fam-ehewirkungen-1353ff", parentId: "zr-mat-fam", label: "Ehewirkungen (§§ 1353 ff.)", area: "zr", sortOrder: 1 },
  { id: "zr-mat-fam-gueterrecht-1363ff", parentId: "zr-mat-fam", label: "Güterrecht (§§ 1363 ff.)", area: "zr", sortOrder: 2 },
  { id: "zr-mat-fam-scheidung-1564ff", parentId: "zr-mat-fam", label: "Scheidung (§§ 1564 ff.)", area: "zr", sortOrder: 3 },

  // Erbrecht
  { id: "zr-mat-erb", parentId: "zr-mat", label: "Erbrecht", area: "zr", sortOrder: 8 },
  { id: "zr-mat-erb-gesetzliche-erbfolge-1922ff", parentId: "zr-mat-erb", label: "Gesetzliche Erbfolge (§§ 1922 ff.)", area: "zr", sortOrder: 1 },
  { id: "zr-mat-erb-testament-2064ff", parentId: "zr-mat-erb", label: "Testament (§§ 2064 ff.)", area: "zr", sortOrder: 2 },
  { id: "zr-mat-erb-annahme-ausschlagung-1942ff", parentId: "zr-mat-erb", label: "Annahme/Ausschlagung (§§ 1942 ff.)", area: "zr", sortOrder: 3 },
  { id: "zr-mat-erb-erbschein-2353ff", parentId: "zr-mat-erb", label: "Erbschein (§§ 2353 ff.)", area: "zr", sortOrder: 4 },

  // Sonstiges / Nebengebiete
  { id: "zr-mat-sonst", parentId: "zr-mat", label: "Sonstiges", area: "zr", sortOrder: 9 },
  { id: "zr-mat-neb-anfechtungsgesetz-anfg", parentId: "zr-mat-sonst", label: "Anfechtungsgesetz (AnfG)", area: "zr", sortOrder: 1 },
  { id: "zr-mat-zpo-prozessvergleich-794", parentId: "zr-mat-sonst", label: "Prozessvergleich (§ 794)", area: "zr", sortOrder: 2 },

  // ----- ZR Prozessrecht -----
  { id: "zr-proz", parentId: "zr", label: "Prozessrecht", area: "zr", sortOrder: 2 },

  // Urteil
  { id: "zr-proz-urteil", parentId: "zr-proz", label: "Urteil & Tenor", area: "zr", sortOrder: 1 },
  { id: "zr-proz-urteil-rubrum-sonderfaelle", parentId: "zr-proz-urteil", label: "Rubrum Sonderfälle", area: "zr", sortOrder: 1 },
  { id: "zr-proz-urteil-kosten-mischentscheidung-92", parentId: "zr-proz-urteil", label: "Kosten: Mischentscheidung (§ 92)", area: "zr", sortOrder: 2 },
  { id: "zr-proz-urteil-kosten-sofortiges-anerkenntnis-93", parentId: "zr-proz-urteil", label: "Kosten: sofortiges Anerkenntnis (§ 93)", area: "zr", sortOrder: 3 },
  { id: "zr-proz-urteil-kosten-streitgenossen-100", parentId: "zr-proz-urteil", label: "Kosten: Streitgenossen (§ 100)", area: "zr", sortOrder: 4 },
  { id: "zr-proz-urteil-kosten-klageruecknahme-269", parentId: "zr-proz-urteil", label: "Kosten: Klagerücknahme (§ 269)", area: "zr", sortOrder: 5 },
  { id: "zr-proz-urteil-vollstreckbarkeit-mischentscheidung", parentId: "zr-proz-urteil", label: "Vollstreckbarkeit: Mischentscheidung", area: "zr", sortOrder: 6 },
  { id: "zr-proz-urteil-vollstreckbarkeit-schutzantrag", parentId: "zr-proz-urteil", label: "Vollstreckbarkeit: Schutzantrag", area: "zr", sortOrder: 7 },
  { id: "zr-proz-berufungsurteil-sachbericht", parentId: "zr-proz-urteil", label: "Berufungsurteil: Sachbericht", area: "zr", sortOrder: 8 },

  // Zuständigkeit
  { id: "zr-proz-zust", parentId: "zr-proz", label: "Zuständigkeit", area: "zr", sortOrder: 2 },
  { id: "zr-proz-zustaendigkeit-international", parentId: "zr-proz-zust", label: "Internationale Zuständigkeit", area: "zr", sortOrder: 1 },
  { id: "zr-proz-zustaendigkeit-oertlich-gerichtsstand", parentId: "zr-proz-zust", label: "Örtliche Zuständigkeit / Gerichtsstand", area: "zr", sortOrder: 2 },

  // Parteien & Beteiligte
  { id: "zr-proz-parteien", parentId: "zr-proz", label: "Parteien & Beteiligte", area: "zr", sortOrder: 3 },
  { id: "zr-proz-prozessstandschaft", parentId: "zr-proz-parteien", label: "Prozessstandschaft", area: "zr", sortOrder: 1 },
  { id: "zr-proz-streitgenossenschaft", parentId: "zr-proz-parteien", label: "Streitgenossenschaft", area: "zr", sortOrder: 2 },
  { id: "zr-proz-parteiaenderung-rubrumsberichtigung", parentId: "zr-proz-parteien", label: "Parteiänderung / Rubrumsberichtigung", area: "zr", sortOrder: 3 },
  { id: "zr-proz-streitverkuendung-72", parentId: "zr-proz-parteien", label: "Streitverkündung (§ 72)", area: "zr", sortOrder: 4 },
  { id: "zr-proz-nebenintervention-66", parentId: "zr-proz-parteien", label: "Nebenintervention (§ 66)", area: "zr", sortOrder: 5 },

  // Klagearten & Anträge
  { id: "zr-proz-klagearten", parentId: "zr-proz", label: "Klagearten & Anträge", area: "zr", sortOrder: 4 },
  { id: "zr-proz-widerklage-33", parentId: "zr-proz-klagearten", label: "Widerklage (§ 33)", area: "zr", sortOrder: 1 },
  { id: "zr-proz-hilfswiderklage", parentId: "zr-proz-klagearten", label: "Hilfswiderklage", area: "zr", sortOrder: 2 },
  { id: "zr-proz-stufenklage-254", parentId: "zr-proz-klagearten", label: "Stufenklage (§ 254)", area: "zr", sortOrder: 3 },
  { id: "zr-proz-feststellungsklage-256", parentId: "zr-proz-klagearten", label: "Feststellungsklage (§ 256)", area: "zr", sortOrder: 4 },
  { id: "zr-proz-zwischenfeststellungsklage", parentId: "zr-proz-klagearten", label: "Zwischenfeststellungsklage", area: "zr", sortOrder: 5 },
  { id: "zr-proz-klageaenderung-263", parentId: "zr-proz-klagearten", label: "Klageänderung (§ 263)", area: "zr", sortOrder: 6 },
  { id: "zr-proz-klageruecknahme-269", parentId: "zr-proz-klagearten", label: "Klagerücknahme (§ 269)", area: "zr", sortOrder: 7 },
  { id: "zr-proz-haupt-und-hilfsantrag", parentId: "zr-proz-klagearten", label: "Haupt- und Hilfsantrag", area: "zr", sortOrder: 8 },

  // Erledigung
  { id: "zr-proz-erledigung", parentId: "zr-proz", label: "Erledigung", area: "zr", sortOrder: 5 },
  { id: "zr-proz-erledigung-uebereinstimmend-91a", parentId: "zr-proz-erledigung", label: "Übereinstimmend (§ 91a)", area: "zr", sortOrder: 1 },
  { id: "zr-proz-erledigung-einseitig", parentId: "zr-proz-erledigung", label: "Einseitig", area: "zr", sortOrder: 2 },
  { id: "zr-proz-erledigung-teilerledigung", parentId: "zr-proz-erledigung", label: "Teilerledigung", area: "zr", sortOrder: 3 },

  // Aufrechnung
  { id: "zr-proz-aufr", parentId: "zr-proz", label: "Aufrechnung", area: "zr", sortOrder: 6 },
  { id: "zr-proz-aufrechnung-primaer", parentId: "zr-proz-aufr", label: "Primäraufrechnung", area: "zr", sortOrder: 1 },
  { id: "zr-proz-aufrechnung-hilfs", parentId: "zr-proz-aufr", label: "Hilfsaufrechnung", area: "zr", sortOrder: 2 },
  { id: "zr-proz-aufrechnung-rechtskraft-322", parentId: "zr-proz-aufr", label: "Rechtskraft (§ 322)", area: "zr", sortOrder: 3 },

  // Versäumnisurteil & Wiedereinsetzung
  { id: "zr-proz-vu", parentId: "zr-proz", label: "Versäumnisurteil & Mahnverfahren", area: "zr", sortOrder: 7 },
  { id: "zr-proz-versaeumnisurteil-echt", parentId: "zr-proz-vu", label: "Echtes VU", area: "zr", sortOrder: 1 },
  { id: "zr-proz-versaeumnisurteil-unecht", parentId: "zr-proz-vu", label: "Unechtes VU", area: "zr", sortOrder: 2 },
  { id: "zr-proz-einspruch-vu-338", parentId: "zr-proz-vu", label: "Einspruch VU (§ 338)", area: "zr", sortOrder: 3 },
  { id: "zr-proz-wiedereinsetzung-233", parentId: "zr-proz-vu", label: "Wiedereinsetzung (§ 233)", area: "zr", sortOrder: 4 },
  { id: "zr-proz-mahnverfahren", parentId: "zr-proz-vu", label: "Mahnverfahren", area: "zr", sortOrder: 5 },

  // Eilrechtsschutz
  { id: "zr-proz-eil", parentId: "zr-proz", label: "Eilrechtsschutz", area: "zr", sortOrder: 8 },
  { id: "zr-proz-einstweilige-verfuegung-935", parentId: "zr-proz-eil", label: "Einstweilige Verfügung (§ 935)", area: "zr", sortOrder: 1 },
  { id: "zr-proz-arrest-916", parentId: "zr-proz-eil", label: "Arrest (§ 916)", area: "zr", sortOrder: 2 },

  // Zwangsvollstreckung
  { id: "zr-proz-zv", parentId: "zr-proz", label: "Zwangsvollstreckung", area: "zr", sortOrder: 9 },
  { id: "zr-proz-zv-erinnerung-766", parentId: "zr-proz-zv", label: "Erinnerung (§ 766)", area: "zr", sortOrder: 1 },
  { id: "zr-proz-zv-vollstreckungsabwehrklage-767", parentId: "zr-proz-zv", label: "Vollstreckungsabwehrklage (§ 767)", area: "zr", sortOrder: 2 },
  { id: "zr-proz-zv-titelgegenklage", parentId: "zr-proz-zv", label: "Titelgegenklage", area: "zr", sortOrder: 3 },
  { id: "zr-proz-zv-drittwiderspruchsklage-771", parentId: "zr-proz-zv", label: "Drittwiderspruchsklage (§ 771)", area: "zr", sortOrder: 4 },
  { id: "zr-proz-zv-einziehungsklage", parentId: "zr-proz-zv", label: "Einziehungsklage", area: "zr", sortOrder: 5 },

  // Beweis
  { id: "zr-proz-beweis", parentId: "zr-proz", label: "Beweisrecht", area: "zr", sortOrder: 10 },
  { id: "zr-proz-beweis-darlegungs-und-beweislast", parentId: "zr-proz-beweis", label: "Darlegungs- und Beweislast", area: "zr", sortOrder: 1 },
  { id: "zr-proz-beweis-beweisvereitelung", parentId: "zr-proz-beweis", label: "Beweisvereitelung", area: "zr", sortOrder: 2 },
  { id: "zr-proz-beweis-anscheinsbeweis", parentId: "zr-proz-beweis", label: "Anscheinsbeweis", area: "zr", sortOrder: 3 },
  { id: "zr-proz-beweis-indizienbeweis", parentId: "zr-proz-beweis", label: "Indizienbeweis", area: "zr", sortOrder: 4 },
  { id: "zr-proz-beweis-wuerdigung-286", parentId: "zr-proz-beweis", label: "Beweiswürdigung (§ 286)", area: "zr", sortOrder: 5 },

  // Sonstiges ZR-Proz
  { id: "zr-proz-sonst", parentId: "zr-proz", label: "Sonstiges", area: "zr", sortOrder: 11 },
  { id: "zr-proz-prozessvergleich-794", parentId: "zr-proz-sonst", label: "Prozessvergleich (§ 794)", area: "zr", sortOrder: 1 },
  { id: "zr-proz-pkh-114", parentId: "zr-proz-sonst", label: "PKH (§ 114)", area: "zr", sortOrder: 2 },
  { id: "zr-proz-zustellungsmangel-heilung-189", parentId: "zr-proz-sonst", label: "Zustellungsmangel/Heilung (§ 189)", area: "zr", sortOrder: 3 },
  { id: "zr-proz-ersatzzustellung", parentId: "zr-proz-sonst", label: "Ersatzzustellung", area: "zr", sortOrder: 4 },

  // Klausurtyp-spezifisch ZR
  { id: "zr-proz-klausurtyp", parentId: "zr-proz", label: "Klausurtyp-spezifisch", area: "zr", sortOrder: 12 },
  { id: "zr-proz-klausurtyp-anwalt-angriff", parentId: "zr-proz-klausurtyp", label: "Anwalt: Angriff", area: "zr", sortOrder: 1 },
  { id: "zr-proz-klausurtyp-anwalt-verteidigung", parentId: "zr-proz-klausurtyp", label: "Anwalt: Verteidigung", area: "zr", sortOrder: 2 },
  { id: "zr-proz-klausurtyp-anwalt-kautelar", parentId: "zr-proz-klausurtyp", label: "Anwalt: Kautelar", area: "zr", sortOrder: 3 },

  // ===== ÖFFENTLICHES RECHT =====
  { id: "oeffr", parentId: null, label: "Öffentliches Recht", area: "oeffr", sortOrder: 2 },

  // ----- ÖR Materielles Recht -----
  { id: "or-mat", parentId: "oeffr", label: "Materielles Recht", area: "oeffr", sortOrder: 1 },

  // VwVfG / Verwaltungsrecht AT
  { id: "or-mat-verw", parentId: "or-mat", label: "Verwaltungsrecht AT", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-verw-va-begriff", parentId: "or-mat-verw", label: "VA-Begriff", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-verw-ruecknahme-48", parentId: "or-mat-verw", label: "Rücknahme (§ 48)", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-verw-widerruf-49", parentId: "or-mat-verw", label: "Widerruf (§ 49)", area: "oeffr", sortOrder: 3 },
  { id: "or-mat-verw-erstattung-49a", parentId: "or-mat-verw", label: "Erstattung (§ 49a)", area: "oeffr", sortOrder: 4 },
  { id: "or-mat-verw-wiederaufgreifen-51", parentId: "or-mat-verw", label: "Wiederaufgreifen (§ 51)", area: "oeffr", sortOrder: 5 },
  { id: "or-mat-verw-nebenbestimmung-36", parentId: "or-mat-verw", label: "Nebenbestimmung (§ 36)", area: "oeffr", sortOrder: 6 },
  { id: "or-mat-verw-zusage-zusicherung-38", parentId: "or-mat-verw", label: "Zusage/Zusicherung (§ 38)", area: "oeffr", sortOrder: 7 },
  { id: "or-mat-verw-vertrag-54ff", parentId: "or-mat-verw", label: "Öffentl.-rechtl. Vertrag (§§ 54 ff.)", area: "oeffr", sortOrder: 8 },

  // Staatshaftung
  { id: "or-mat-staatshaft", parentId: "or-mat", label: "Staatshaftung", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-staatshaft-fba", parentId: "or-mat-staatshaft", label: "FBA", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-staatshaft-unterlassung", parentId: "or-mat-staatshaft", label: "Unterlassung", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-staatshaft-erstattung", parentId: "or-mat-staatshaft", label: "Erstattung", area: "oeffr", sortOrder: 3 },
  { id: "or-mat-staatshaft-goa", parentId: "or-mat-staatshaft", label: "ö.-r. GoA", area: "oeffr", sortOrder: 4 },
  { id: "or-mat-staatshaft-sonderverbindung", parentId: "or-mat-staatshaft", label: "Sonderverbindung", area: "oeffr", sortOrder: 5 },

  // Vollstreckung
  { id: "or-mat-vollstr", parentId: "or-mat", label: "Verwaltungsvollstreckung", area: "oeffr", sortOrder: 3 },
  { id: "or-mat-vollstr-gestrecktes-verfahren", parentId: "or-mat-vollstr", label: "Gestrecktes Verfahren", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-vollstr-sofortvollzug", parentId: "or-mat-vollstr", label: "Sofortvollzug", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-vollstr-kostenbescheid", parentId: "or-mat-vollstr", label: "Kostenbescheid", area: "oeffr", sortOrder: 3 },

  // Polizei- & Ordnungsrecht
  { id: "or-mat-pol", parentId: "or-mat", label: "Polizei- & Ordnungsrecht", area: "oeffr", sortOrder: 4 },
  { id: "or-mat-pol-standard-idf", parentId: "or-mat-pol", label: "Standardmaßn.: Identitätsfeststellung", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-pol-standard-ed-behandlung", parentId: "or-mat-pol", label: "ED-Behandlung", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-pol-standard-video", parentId: "or-mat-pol", label: "Videoüberwachung", area: "oeffr", sortOrder: 3 },
  { id: "or-mat-pol-standard-platzverweis", parentId: "or-mat-pol", label: "Platzverweis", area: "oeffr", sortOrder: 4 },
  { id: "or-mat-pol-standard-aufenthaltsverbot", parentId: "or-mat-pol", label: "Aufenthaltsverbot", area: "oeffr", sortOrder: 5 },
  { id: "or-mat-pol-standard-wohnungsverweisung", parentId: "or-mat-pol", label: "Wohnungsverweisung", area: "oeffr", sortOrder: 6 },
  { id: "or-mat-pol-standard-gewahrsam", parentId: "or-mat-pol", label: "Gewahrsam", area: "oeffr", sortOrder: 7 },
  { id: "or-mat-pol-standard-durchsuchung-sicherstellung", parentId: "or-mat-pol", label: "Durchsuchung/Sicherstellung", area: "oeffr", sortOrder: 8 },
  { id: "or-mat-pol-generalklausel", parentId: "or-mat-pol", label: "Generalklausel", area: "oeffr", sortOrder: 9 },
  { id: "or-mat-pol-stoerer-verhaltensstoerer", parentId: "or-mat-pol", label: "Verhaltensstörer", area: "oeffr", sortOrder: 10 },
  { id: "or-mat-pol-stoerer-zustandsstoerer", parentId: "or-mat-pol", label: "Zustandsstörer", area: "oeffr", sortOrder: 11 },
  { id: "or-mat-pol-stoerer-nichtstoerer", parentId: "or-mat-pol", label: "Nichtstörer", area: "oeffr", sortOrder: 12 },
  { id: "or-mat-pol-kosten-entschaedigung", parentId: "or-mat-pol", label: "Kosten/Entschädigung", area: "oeffr", sortOrder: 13 },

  // Waffenrecht
  { id: "or-mat-waffen", parentId: "or-mat", label: "Waffenrecht", area: "oeffr", sortOrder: 5 },
  { id: "or-mat-waffen-erlaubnis", parentId: "or-mat-waffen", label: "Erlaubnis", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-waffen-widerruf", parentId: "or-mat-waffen", label: "Widerruf", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-waffen-besitzverbot", parentId: "or-mat-waffen", label: "Besitzverbot", area: "oeffr", sortOrder: 3 },

  // Versammlungsrecht
  { id: "or-mat-versamml", parentId: "or-mat", label: "Versammlungsrecht", area: "oeffr", sortOrder: 6 },
  { id: "or-mat-versamml-geschlossen", parentId: "or-mat-versamml", label: "Geschlossene Versammlung", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-versamml-frei-vor-beginn", parentId: "or-mat-versamml", label: "Freie Versammlung vor Beginn", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-versamml-frei-nach-beginn", parentId: "or-mat-versamml", label: "Freie Versammlung nach Beginn", area: "oeffr", sortOrder: 3 },

  // Baurecht
  { id: "or-mat-bau", parentId: "or-mat", label: "Baurecht", area: "oeffr", sortOrder: 7 },
  { id: "or-mat-bau-bauleitplan-abwaegung", parentId: "or-mat-bau", label: "Bauleitplan / Abwägung", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-bau-baugenehmigung-29ff", parentId: "or-mat-bau", label: "Baugenehmigung (§§ 29 ff.)", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-bau-einvernehmen-36", parentId: "or-mat-bau", label: "Einvernehmen (§ 36)", area: "oeffr", sortOrder: 3 },
  { id: "or-mat-bau-nachbarschutz", parentId: "or-mat-bau", label: "Nachbarschutz", area: "oeffr", sortOrder: 4 },
  { id: "or-mat-bau-bauaufsicht-verfuegung", parentId: "or-mat-bau", label: "Bauaufsichtsverfügung", area: "oeffr", sortOrder: 5 },

  // Umwelt
  { id: "or-mat-umwelt", parentId: "or-mat", label: "Umweltrecht", area: "oeffr", sortOrder: 8 },
  { id: "or-mat-umwelt-bimschg-genehmigung", parentId: "or-mat-umwelt", label: "BImSchG: Genehmigung", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-umwelt-bimschg-nachbarschutz", parentId: "or-mat-umwelt", label: "BImSchG: Nachbarschutz", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-umwelt-bimschg-nachtraeglich", parentId: "or-mat-umwelt", label: "BImSchG: nachträgliche Anordnung", area: "oeffr", sortOrder: 3 },
  { id: "or-mat-umwelt-abfall", parentId: "or-mat-umwelt", label: "Abfall", area: "oeffr", sortOrder: 4 },
  { id: "or-mat-umwelt-bodenschutz", parentId: "or-mat-umwelt", label: "Bodenschutz", area: "oeffr", sortOrder: 5 },
  { id: "or-mat-umwelt-wasser", parentId: "or-mat-umwelt", label: "Wasser", area: "oeffr", sortOrder: 6 },

  // Gewerberecht
  { id: "or-mat-gewerbe", parentId: "or-mat", label: "Gewerberecht", area: "oeffr", sortOrder: 9 },
  { id: "or-mat-gewerbe-stehend-erlaubnis", parentId: "or-mat-gewerbe", label: "Stehendes Gewerbe: Erlaubnis", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-gewerbe-stehend-untersagung-35", parentId: "or-mat-gewerbe", label: "Untersagung (§ 35)", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-gewerbe-reise-markt", parentId: "or-mat-gewerbe", label: "Reise-/Marktgewerbe", area: "oeffr", sortOrder: 3 },
  { id: "or-mat-gewerbe-gaststaette", parentId: "or-mat-gewerbe", label: "Gaststätte", area: "oeffr", sortOrder: 4 },
  { id: "or-mat-gewerbe-handwerk", parentId: "or-mat-gewerbe", label: "Handwerk", area: "oeffr", sortOrder: 5 },

  // Kommunalrecht
  { id: "or-mat-komm", parentId: "or-mat", label: "Kommunalrecht", area: "oeffr", sortOrder: 10 },
  { id: "or-mat-komm-oeffentliche-einrichtung", parentId: "or-mat-komm", label: "Öffentliche Einrichtung", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-komm-satzung", parentId: "or-mat-komm", label: "Satzung", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-komm-anschluss-benutzungszwang", parentId: "or-mat-komm", label: "Anschluss- & Benutzungszwang", area: "oeffr", sortOrder: 3 },
  { id: "or-mat-komm-buergerbegehren", parentId: "or-mat-komm", label: "Bürgerbegehren", area: "oeffr", sortOrder: 4 },
  { id: "or-mat-komm-kvs", parentId: "or-mat-komm", label: "KVS", area: "oeffr", sortOrder: 5 },
  { id: "or-mat-komm-aufsicht", parentId: "or-mat-komm", label: "Kommunalaufsicht", area: "oeffr", sortOrder: 6 },
  { id: "or-mat-komm-wirtschaft-konkurrent", parentId: "or-mat-komm", label: "Wirtschaft / Konkurrent", area: "oeffr", sortOrder: 7 },

  // Beamten
  { id: "or-mat-beamten", parentId: "or-mat", label: "Beamtenrecht", area: "oeffr", sortOrder: 11 },
  { id: "or-mat-beamten-konkurrentenstreit", parentId: "or-mat-beamten", label: "Konkurrentenstreit", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-beamten-schadensersatz", parentId: "or-mat-beamten", label: "Schadensersatz", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-beamten-dienstunfall", parentId: "or-mat-beamten", label: "Dienstunfall", area: "oeffr", sortOrder: 3 },

  // Schulrecht
  { id: "or-mat-schul", parentId: "or-mat", label: "Schulrecht", area: "oeffr", sortOrder: 12 },
  { id: "or-mat-schul-ordnungsmassnahme", parentId: "or-mat-schul", label: "Ordnungsmaßnahme", area: "oeffr", sortOrder: 1 },

  // Straßenverkehr
  { id: "or-mat-verkehr", parentId: "or-mat", label: "Straßenverkehrsrecht", area: "oeffr", sortOrder: 13 },
  { id: "or-mat-verkehr-fahrerlaubnis-entziehung", parentId: "or-mat-verkehr", label: "Fahrerlaubnis-Entziehung", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-verkehr-fahrtenbuch", parentId: "or-mat-verkehr", label: "Fahrtenbuch", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-verkehr-verkehrszeichen", parentId: "or-mat-verkehr", label: "Verkehrszeichen", area: "oeffr", sortOrder: 3 },

  // Ausländerrecht
  { id: "or-mat-ausl", parentId: "or-mat", label: "Ausländerrecht", area: "oeffr", sortOrder: 14 },
  { id: "or-mat-ausl-aufenthaltstitel", parentId: "or-mat-ausl", label: "Aufenthaltstitel", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-ausl-ausweisung", parentId: "or-mat-ausl", label: "Ausweisung", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-ausl-unionsbuerger", parentId: "or-mat-ausl", label: "Unionsbürger", area: "oeffr", sortOrder: 3 },

  // Subventionsrecht
  { id: "or-mat-subv", parentId: "or-mat", label: "Subventionsrecht", area: "oeffr", sortOrder: 15 },
  { id: "or-mat-subv-versagung", parentId: "or-mat-subv", label: "Versagung", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-subv-aufhebung", parentId: "or-mat-subv", label: "Aufhebung", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-subv-konkurrent", parentId: "or-mat-subv", label: "Konkurrent", area: "oeffr", sortOrder: 3 },

  // IFG
  { id: "or-mat-ifg", parentId: "or-mat", label: "Informationsfreiheitsrecht", area: "oeffr", sortOrder: 16 },
  { id: "or-mat-ifg-anspruch", parentId: "or-mat-ifg", label: "IFG-Anspruch", area: "oeffr", sortOrder: 1 },

  // Verfassungs-/Grundrechte
  { id: "or-mat-verf", parentId: "or-mat", label: "Verfassungs- & Grundrechte", area: "oeffr", sortOrder: 17 },
  { id: "or-mat-verf-rueckwirkung", parentId: "or-mat-verf", label: "Rückwirkung", area: "oeffr", sortOrder: 1 },
  { id: "or-mat-verf-eu-vorrang", parentId: "or-mat-verf", label: "EU-Vorrang", area: "oeffr", sortOrder: 2 },
  { id: "or-mat-verf-gr-ahf-2", parentId: "or-mat-verf", label: "AHF (Art. 2)", area: "oeffr", sortOrder: 3 },
  { id: "or-mat-verf-gr-apr", parentId: "or-mat-verf", label: "APR", area: "oeffr", sortOrder: 4 },
  { id: "or-mat-verf-gr-leben-gesundheit", parentId: "or-mat-verf", label: "Leben / Gesundheit", area: "oeffr", sortOrder: 5 },
  { id: "or-mat-verf-gr-religion-4", parentId: "or-mat-verf", label: "Religion (Art. 4)", area: "oeffr", sortOrder: 6 },
  { id: "or-mat-verf-gr-versamml-8", parentId: "or-mat-verf", label: "Versammlung (Art. 8)", area: "oeffr", sortOrder: 7 },
  { id: "or-mat-verf-gr-beruf-12", parentId: "or-mat-verf", label: "Beruf (Art. 12)", area: "oeffr", sortOrder: 8 },
  { id: "or-mat-verf-gr-eigentum-14", parentId: "or-mat-verf", label: "Eigentum (Art. 14)", area: "oeffr", sortOrder: 9 },
  { id: "or-mat-verf-gr-gleichheit-3", parentId: "or-mat-verf", label: "Gleichheit (Art. 3)", area: "oeffr", sortOrder: 10 },

  // ----- ÖR Prozessrecht -----
  { id: "or-proz", parentId: "oeffr", label: "Prozessrecht", area: "oeffr", sortOrder: 2 },

  // Urteil
  { id: "or-proz-urteil", parentId: "or-proz", label: "Urteil & Tenor", area: "oeffr", sortOrder: 1 },
  { id: "or-proz-urteil-rubrum-passivlegitimation-78", parentId: "or-proz-urteil", label: "Rubrum/Passivlegitimation (§ 78)", area: "oeffr", sortOrder: 1 },
  { id: "or-proz-urteil-kosten-beiladung-154-162", parentId: "or-proz-urteil", label: "Kosten Beiladung (§§ 154, 162)", area: "oeffr", sortOrder: 2 },
  { id: "or-proz-urteil-kosten-erledigung-161-2", parentId: "or-proz-urteil", label: "Kosten Erledigung (§ 161 II)", area: "oeffr", sortOrder: 3 },
  { id: "or-proz-urteil-kosten-teilweise-155", parentId: "or-proz-urteil", label: "Kosten teilweise (§ 155)", area: "oeffr", sortOrder: 4 },
  { id: "or-proz-urteil-vollstreckbarkeit-167", parentId: "or-proz-urteil", label: "Vollstreckbarkeit (§ 167)", area: "oeffr", sortOrder: 5 },

  // Klagearten & Zulässigkeit
  { id: "or-proz-klage", parentId: "or-proz", label: "Klagearten & Zulässigkeit", area: "oeffr", sortOrder: 2 },
  { id: "or-proz-einzelrichter-6", parentId: "or-proz-klage", label: "Einzelrichter (§ 6)", area: "oeffr", sortOrder: 1 },
  { id: "or-proz-klageauslegung-88", parentId: "or-proz-klage", label: "Klageauslegung (§ 88)", area: "oeffr", sortOrder: 2 },
  { id: "or-proz-klageruecknahme-fiktion-92", parentId: "or-proz-klage", label: "Klagerücknahme-Fiktion (§ 92)", area: "oeffr", sortOrder: 3 },
  { id: "or-proz-rechtsweg-40", parentId: "or-proz-klage", label: "Rechtsweg (§ 40)", area: "oeffr", sortOrder: 4 },
  { id: "or-proz-klagebefugnis-42", parentId: "or-proz-klage", label: "Klagebefugnis (§ 42)", area: "oeffr", sortOrder: 5 },
  { id: "or-proz-vorverfahren-entbehrlichkeit-68", parentId: "or-proz-klage", label: "Vorverfahren / Entbehrlichkeit (§ 68)", area: "oeffr", sortOrder: 6 },
  { id: "or-proz-klagefrist-74", parentId: "or-proz-klage", label: "Klagefrist (§ 74)", area: "oeffr", sortOrder: 7 },
  { id: "or-proz-feststellung-subsidiaritaet-43", parentId: "or-proz-klage", label: "FK: Subsidiarität (§ 43)", area: "oeffr", sortOrder: 8 },
  { id: "or-proz-ffk-fortsetzungsinteresse-113", parentId: "or-proz-klage", label: "FFK: Fortsetzungsinteresse (§ 113)", area: "oeffr", sortOrder: 9 },
  { id: "or-proz-klageaenderung-91", parentId: "or-proz-klage", label: "Klageänderung (§ 91)", area: "oeffr", sortOrder: 10 },
  { id: "or-proz-erledigung-einseitig", parentId: "or-proz-klage", label: "Erledigung einseitig", area: "oeffr", sortOrder: 11 },
  { id: "or-proz-normenkontrolle-47", parentId: "or-proz-klage", label: "Normenkontrolle (§ 47)", area: "oeffr", sortOrder: 12 },
  { id: "or-proz-beiladung-65", parentId: "or-proz-klage", label: "Beiladung (§ 65)", area: "oeffr", sortOrder: 13 },
  { id: "or-proz-berufung-zulassung-124", parentId: "or-proz-klage", label: "Berufung: Zulassung (§ 124)", area: "oeffr", sortOrder: 14 },
  { id: "or-proz-pkh-166", parentId: "or-proz-klage", label: "PKH (§ 166)", area: "oeffr", sortOrder: 15 },

  // Eilrechtsschutz
  { id: "or-proz-eil", parentId: "or-proz", label: "Eilrechtsschutz", area: "oeffr", sortOrder: 3 },
  { id: "or-proz-einstw-rs-80-5", parentId: "or-proz-eil", label: "§ 80 V VwGO", area: "oeffr", sortOrder: 1 },
  { id: "or-proz-einstw-rs-faktischer-vollzug", parentId: "or-proz-eil", label: "Faktischer Vollzug", area: "oeffr", sortOrder: 2 },
  { id: "or-proz-einstw-rs-abaenderung-80-7", parentId: "or-proz-eil", label: "Abänderung (§ 80 VII)", area: "oeffr", sortOrder: 3 },
  { id: "or-proz-einstw-rs-doppelwirkung-80a", parentId: "or-proz-eil", label: "Doppelwirkung (§ 80a)", area: "oeffr", sortOrder: 4 },
  { id: "or-proz-einstw-rs-123", parentId: "or-proz-eil", label: "§ 123 VwGO", area: "oeffr", sortOrder: 5 },

  // Bescheide & Vollziehung
  { id: "or-proz-bescheid", parentId: "or-proz", label: "Bescheide & Vollziehung", area: "oeffr", sortOrder: 4 },
  { id: "or-proz-bescheid-ausgangsbescheid", parentId: "or-proz-bescheid", label: "Ausgangsbescheid", area: "oeffr", sortOrder: 1 },
  { id: "or-proz-bescheid-widerspruchsbescheid", parentId: "or-proz-bescheid", label: "Widerspruchsbescheid", area: "oeffr", sortOrder: 2 },
  { id: "or-proz-bescheid-abhilfe", parentId: "or-proz-bescheid", label: "Abhilfe", area: "oeffr", sortOrder: 3 },
  { id: "or-proz-anordnung-sofortvollzug-80-2", parentId: "or-proz-bescheid", label: "Anordnung Sofortvollzug (§ 80 II)", area: "oeffr", sortOrder: 4 },
  { id: "or-proz-zwangsmittel-androhung", parentId: "or-proz-bescheid", label: "Zwangsmittel-Androhung", area: "oeffr", sortOrder: 5 },

  // Klausurtyp-spezifisch ÖR
  { id: "or-proz-klausurtyp", parentId: "or-proz", label: "Klausurtyp-spezifisch", area: "oeffr", sortOrder: 5 },
  { id: "or-proz-klausurtyp-anwalt-widerspruch", parentId: "or-proz-klausurtyp", label: "Anwalt: Widerspruch", area: "oeffr", sortOrder: 1 },
  { id: "or-proz-klausurtyp-anwalt-klage", parentId: "or-proz-klausurtyp", label: "Anwalt: Klage", area: "oeffr", sortOrder: 2 },
  { id: "or-proz-klausurtyp-anwalt-einstw-rs", parentId: "or-proz-klausurtyp", label: "Anwalt: Einstw. Rechtsschutz", area: "oeffr", sortOrder: 3 },

  // ===== STRAFRECHT =====
  { id: "sr", parentId: null, label: "Strafrecht", area: "sr", sortOrder: 3 },

  // ----- SR Materielles Recht -----
  { id: "sr-mat", parentId: "sr", label: "Materielles Recht", area: "sr", sortOrder: 1 },

  // SR Mat AT
  { id: "sr-mat-at", parentId: "sr-mat", label: "Allgemeiner Teil", area: "sr", sortOrder: 1 },
  { id: "sr-mat-at-vorsatz", parentId: "sr-mat-at", label: "Vorsatz", area: "sr", sortOrder: 1 },
  { id: "sr-mat-at-einverstaendnis", parentId: "sr-mat-at", label: "Einverständnis", area: "sr", sortOrder: 2 },
  { id: "sr-mat-at-rechtfertigung-notwehr-32", parentId: "sr-mat-at", label: "Notwehr (§ 32)", area: "sr", sortOrder: 3 },
  { id: "sr-mat-at-rechtfertigung-festnahme-127stpo", parentId: "sr-mat-at", label: "Festnahme (§ 127 StPO)", area: "sr", sortOrder: 4 },
  { id: "sr-mat-at-rechtfertigung-einwilligung", parentId: "sr-mat-at", label: "Einwilligung", area: "sr", sortOrder: 5 },
  { id: "sr-mat-at-rechtfertigung-selbsthilfe-229bgb", parentId: "sr-mat-at", label: "Selbsthilfe (§ 229 BGB)", area: "sr", sortOrder: 6 },
  { id: "sr-mat-at-rechtfertigung-notstand-34", parentId: "sr-mat-at", label: "Notstand (§ 34)", area: "sr", sortOrder: 7 },
  { id: "sr-mat-at-schuld", parentId: "sr-mat-at", label: "Schuld", area: "sr", sortOrder: 8 },
  { id: "sr-mat-at-irrtum-rechtfertigung", parentId: "sr-mat-at", label: "Irrtum/Rechtfertigung", area: "sr", sortOrder: 9 },
  { id: "sr-mat-at-versuch", parentId: "sr-mat-at", label: "Versuch", area: "sr", sortOrder: 10 },
  { id: "sr-mat-at-ruecktritt", parentId: "sr-mat-at", label: "Rücktritt", area: "sr", sortOrder: 11 },
  { id: "sr-mat-at-konkurrenzen", parentId: "sr-mat-at", label: "Konkurrenzen", area: "sr", sortOrder: 12 },
  { id: "sr-mat-at-mittaeterschaft-25-2", parentId: "sr-mat-at", label: "Mittäterschaft (§ 25 II)", area: "sr", sortOrder: 13 },
  { id: "sr-mat-at-mittelbare-taeterschaft-25-1", parentId: "sr-mat-at", label: "Mittelbare Täterschaft (§ 25 I)", area: "sr", sortOrder: 14 },
  { id: "sr-mat-at-teilnahme-26-27", parentId: "sr-mat-at", label: "Teilnahme (§§ 26, 27)", area: "sr", sortOrder: 15 },
  { id: "sr-mat-at-straftat-vorfeld-30", parentId: "sr-mat-at", label: "Vorfeld (§ 30)", area: "sr", sortOrder: 16 },
  { id: "sr-mat-at-fahrlaessigkeit", parentId: "sr-mat-at", label: "Fahrlässigkeit", area: "sr", sortOrder: 17 },
  { id: "sr-mat-at-erfolgsqualifikation", parentId: "sr-mat-at", label: "Erfolgsqualifikation", area: "sr", sortOrder: 18 },
  { id: "sr-mat-at-unterlassung", parentId: "sr-mat-at", label: "Unterlassung", area: "sr", sortOrder: 19 },

  // SR Mat BT
  { id: "sr-mat-bt", parentId: "sr-mat", label: "Besonderer Teil", area: "sr", sortOrder: 2 },
  { id: "sr-mat-bt-diebstahl-242", parentId: "sr-mat-bt", label: "Diebstahl (§ 242)", area: "sr", sortOrder: 1 },
  { id: "sr-mat-bt-unterschlagung-246", parentId: "sr-mat-bt", label: "Unterschlagung (§ 246)", area: "sr", sortOrder: 2 },
  { id: "sr-mat-bt-fahrzeuggebrauch-248b", parentId: "sr-mat-bt", label: "Fahrzeuggebrauch (§ 248b)", area: "sr", sortOrder: 3 },
  { id: "sr-mat-bt-betrug-263", parentId: "sr-mat-bt", label: "Betrug (§ 263)", area: "sr", sortOrder: 4 },
  { id: "sr-mat-bt-leistungserschleichung-265a", parentId: "sr-mat-bt", label: "Leistungserschleichung (§ 265a)", area: "sr", sortOrder: 5 },
  { id: "sr-mat-bt-untreue-266", parentId: "sr-mat-bt", label: "Untreue (§ 266)", area: "sr", sortOrder: 6 },
  { id: "sr-mat-bt-computerbetrug-263a", parentId: "sr-mat-bt", label: "Computerbetrug (§ 263a)", area: "sr", sortOrder: 7 },
  { id: "sr-mat-bt-kreditkartenmissbrauch-266b", parentId: "sr-mat-bt", label: "Kreditkartenmissbrauch (§ 266b)", area: "sr", sortOrder: 8 },
  { id: "sr-mat-bt-noetigung-240", parentId: "sr-mat-bt", label: "Nötigung (§ 240)", area: "sr", sortOrder: 9 },
  { id: "sr-mat-bt-erpressung-253", parentId: "sr-mat-bt", label: "Erpressung (§ 253)", area: "sr", sortOrder: 10 },
  { id: "sr-mat-bt-raeuberische-erpressung-255", parentId: "sr-mat-bt", label: "Räuberische Erpressung (§ 255)", area: "sr", sortOrder: 11 },
  { id: "sr-mat-bt-raub-249", parentId: "sr-mat-bt", label: "Raub (§ 249)", area: "sr", sortOrder: 12 },
  { id: "sr-mat-bt-raeuberischer-diebstahl-252", parentId: "sr-mat-bt", label: "Räuberischer Diebstahl (§ 252)", area: "sr", sortOrder: 13 },
  { id: "sr-mat-bt-freiheitsberaubung-239", parentId: "sr-mat-bt", label: "Freiheitsberaubung (§ 239)", area: "sr", sortOrder: 14 },
  { id: "sr-mat-bt-menschenraub-geiselnahme-239ab", parentId: "sr-mat-bt", label: "Menschenraub/Geiselnahme (§§ 239a, b)", area: "sr", sortOrder: 15 },
  { id: "sr-mat-bt-angriff-kraftfahrer-316a", parentId: "sr-mat-bt", label: "Angriff Kraftfahrer (§ 316a)", area: "sr", sortOrder: 16 },
  { id: "sr-mat-bt-hehlerei-259", parentId: "sr-mat-bt", label: "Hehlerei (§ 259)", area: "sr", sortOrder: 17 },
  { id: "sr-mat-bt-beguenstigung-257", parentId: "sr-mat-bt", label: "Begünstigung (§ 257)", area: "sr", sortOrder: 18 },
  { id: "sr-mat-bt-strafvereitelung-258", parentId: "sr-mat-bt", label: "Strafvereitelung (§ 258)", area: "sr", sortOrder: 19 },
  { id: "sr-mat-bt-urkundenfaelschung-267", parentId: "sr-mat-bt", label: "Urkundenfälschung (§ 267)", area: "sr", sortOrder: 20 },
  { id: "sr-mat-bt-urkundenunterdrueckung-274", parentId: "sr-mat-bt", label: "Urkundenunterdrückung (§ 274)", area: "sr", sortOrder: 21 },
  { id: "sr-mat-bt-falschbeurkundung-271", parentId: "sr-mat-bt", label: "Falschbeurkundung (§ 271)", area: "sr", sortOrder: 22 },
  { id: "sr-mat-bt-tech-aufzeichnung-268", parentId: "sr-mat-bt", label: "Tech. Aufzeichnung (§ 268)", area: "sr", sortOrder: 23 },
  { id: "sr-mat-bt-beweisdaten-269", parentId: "sr-mat-bt", label: "Beweisdaten (§ 269)", area: "sr", sortOrder: 24 },
  { id: "sr-mat-bt-aussagedelikte-153ff", parentId: "sr-mat-bt", label: "Aussagedelikte (§§ 153 ff.)", area: "sr", sortOrder: 25 },
  { id: "sr-mat-bt-brandstiftung-306ff", parentId: "sr-mat-bt", label: "Brandstiftung (§§ 306 ff.)", area: "sr", sortOrder: 26 },
  { id: "sr-mat-bt-strassenverkehr-315ff-316", parentId: "sr-mat-bt", label: "Straßenverkehr (§§ 315 ff., 316)", area: "sr", sortOrder: 27 },
  { id: "sr-mat-bt-unfallflucht-142", parentId: "sr-mat-bt", label: "Unfallflucht (§ 142)", area: "sr", sortOrder: 28 },
  { id: "sr-mat-bt-totschlag-212", parentId: "sr-mat-bt", label: "Totschlag (§ 212)", area: "sr", sortOrder: 29 },
  { id: "sr-mat-bt-mord-211", parentId: "sr-mat-bt", label: "Mord (§ 211)", area: "sr", sortOrder: 30 },
  { id: "sr-mat-bt-toetung-verlangen-216", parentId: "sr-mat-bt", label: "Tötung auf Verlangen (§ 216)", area: "sr", sortOrder: 31 },
  { id: "sr-mat-bt-aussetzung-221", parentId: "sr-mat-bt", label: "Aussetzung (§ 221)", area: "sr", sortOrder: 32 },
  { id: "sr-mat-bt-koerperverletzung-223ff", parentId: "sr-mat-bt", label: "Körperverletzung (§§ 223 ff.)", area: "sr", sortOrder: 33 },
  { id: "sr-mat-bt-schlaegerei-231", parentId: "sr-mat-bt", label: "Schlägerei (§ 231)", area: "sr", sortOrder: 34 },
  { id: "sr-mat-bt-beleidigung-185ff", parentId: "sr-mat-bt", label: "Beleidigung (§§ 185 ff.)", area: "sr", sortOrder: 35 },
  { id: "sr-mat-bt-hausfriedensbruch-123", parentId: "sr-mat-bt", label: "Hausfriedensbruch (§ 123)", area: "sr", sortOrder: 36 },

  // ----- SR Prozessrecht A: Allgemeine prozessuale Probleme -----
  { id: "sr-proz-allg", parentId: "sr", label: "Prozessrecht: Allgemein", area: "sr", sortOrder: 2 },

  // Verfahrenshindernisse
  { id: "sr-proz-vh", parentId: "sr-proz-allg", label: "Verfahrenshindernisse", area: "sr", sortOrder: 1 },
  { id: "sr-proz-vh-rechtskraft", parentId: "sr-proz-vh", label: "Rechtskraft", area: "sr", sortOrder: 1 },
  { id: "sr-proz-vh-strafantrag-77", parentId: "sr-proz-vh", label: "Strafantrag (§ 77)", area: "sr", sortOrder: 2 },
  { id: "sr-proz-vh-verjaehrung-78", parentId: "sr-proz-vh", label: "Verjährung (§ 78)", area: "sr", sortOrder: 3 },
  { id: "sr-proz-vh-tatprovokation", parentId: "sr-proz-vh", label: "Tatprovokation", area: "sr", sortOrder: 4 },

  // Zuständigkeit
  { id: "sr-proz-zust", parentId: "sr-proz-allg", label: "Zuständigkeit", area: "sr", sortOrder: 2 },
  { id: "sr-proz-zustaendigkeit-sachlich", parentId: "sr-proz-zust", label: "Sachliche Zuständigkeit", area: "sr", sortOrder: 1 },
  { id: "sr-proz-zustaendigkeit-oertlich", parentId: "sr-proz-zust", label: "Örtliche Zuständigkeit", area: "sr", sortOrder: 2 },

  // Wahlfeststellung / Postpendenz
  { id: "sr-proz-wahl", parentId: "sr-proz-allg", label: "Wahlfeststellung", area: "sr", sortOrder: 3 },
  { id: "sr-proz-wahlfeststellung-postpendenz", parentId: "sr-proz-wahl", label: "Wahlfeststellung / Postpendenz", area: "sr", sortOrder: 1 },

  // Beweisverwertungsverbote
  { id: "sr-proz-bvv", parentId: "sr-proz-allg", label: "Beweisverwertungsverbote", area: "sr", sortOrder: 4 },
  { id: "sr-proz-bvv-widerspruchsloesung", parentId: "sr-proz-bvv", label: "Widerspruchslösung", area: "sr", sortOrder: 1 },
  { id: "sr-proz-bvv-fernwirkung-fortwirkung", parentId: "sr-proz-bvv", label: "Fern-/Fortwirkung", area: "sr", sortOrder: 2 },
  { id: "sr-proz-bvv-belehrung-aussagefreiheit-136", parentId: "sr-proz-bvv", label: "Belehrung Aussagefreiheit (§ 136)", area: "sr", sortOrder: 3 },
  { id: "sr-proz-bvv-belehrung-verteidiger-136", parentId: "sr-proz-bvv", label: "Belehrung Verteidiger (§ 136)", area: "sr", sortOrder: 4 },
  { id: "sr-proz-bvv-pflichtverteidiger-141", parentId: "sr-proz-bvv", label: "Pflichtverteidiger (§ 141)", area: "sr", sortOrder: 5 },
  { id: "sr-proz-bvv-verbotene-methoden-136a", parentId: "sr-proz-bvv", label: "Verbotene Methoden (§ 136a)", area: "sr", sortOrder: 6 },
  { id: "sr-proz-bvv-auskunftsverweigerung-55", parentId: "sr-proz-bvv", label: "Auskunftsverweigerung (§ 55)", area: "sr", sortOrder: 7 },
  { id: "sr-proz-bvv-zeugnisverweigerung-52-53", parentId: "sr-proz-bvv", label: "Zeugnisverweigerung (§§ 52, 53)", area: "sr", sortOrder: 8 },
  { id: "sr-proz-bvv-zeuge-verstorb-schweig-252", parentId: "sr-proz-bvv", label: "Verstorbener/schweigender Zeuge (§ 252)", area: "sr", sortOrder: 9 },

  // Ermittlungsmaßnahmen
  { id: "sr-proz-erm", parentId: "sr-proz-allg", label: "Ermittlungsmaßnahmen", area: "sr", sortOrder: 5 },
  { id: "sr-proz-erm-durchsuchung-beschuldigt-102", parentId: "sr-proz-erm", label: "Durchsuchung Beschuldigter (§ 102)", area: "sr", sortOrder: 1 },
  { id: "sr-proz-erm-durchsuchung-dritte-103", parentId: "sr-proz-erm", label: "Durchsuchung Dritte (§ 103)", area: "sr", sortOrder: 2 },
  { id: "sr-proz-erm-zufallsfund-108", parentId: "sr-proz-erm", label: "Zufallsfund (§ 108)", area: "sr", sortOrder: 3 },
  { id: "sr-proz-erm-beschlagnahme-94", parentId: "sr-proz-erm", label: "Beschlagnahme (§ 94)", area: "sr", sortOrder: 4 },
  { id: "sr-proz-erm-beschlagnahmeverbot-97", parentId: "sr-proz-erm", label: "Beschlagnahmeverbot (§ 97)", area: "sr", sortOrder: 5 },
  { id: "sr-proz-erm-post-email-99", parentId: "sr-proz-erm", label: "Post/E-Mail (§ 99)", area: "sr", sortOrder: 6 },
  { id: "sr-proz-erm-tkue-100a", parentId: "sr-proz-erm", label: "TKÜ (§ 100a)", area: "sr", sortOrder: 7 },
  { id: "sr-proz-erm-wohnraumueberwachung-100c", parentId: "sr-proz-erm", label: "Wohnraumüberwachung (§ 100c)", area: "sr", sortOrder: 8 },
  { id: "sr-proz-erm-ve-vmann-110a", parentId: "sr-proz-erm", label: "VE/V-Mann (§ 110a)", area: "sr", sortOrder: 9 },
  { id: "sr-proz-erm-observation-163f", parentId: "sr-proz-erm", label: "Observation (§ 163f)", area: "sr", sortOrder: 10 },
  { id: "sr-proz-erm-blutprobe-81a", parentId: "sr-proz-erm", label: "Blutprobe (§ 81a)", area: "sr", sortOrder: 11 },
  { id: "sr-proz-erm-ed-behandlung-81b", parentId: "sr-proz-erm", label: "ED-Behandlung (§ 81b)", area: "sr", sortOrder: 12 },

  // Haft
  { id: "sr-proz-haft", parentId: "sr-proz-allg", label: "Haft", area: "sr", sortOrder: 6 },
  { id: "sr-proz-haft-dringender-tatverdacht-112", parentId: "sr-proz-haft", label: "Dringender Tatverdacht (§ 112)", area: "sr", sortOrder: 1 },
  { id: "sr-proz-haft-fluchtgefahr-112-2-2", parentId: "sr-proz-haft", label: "Fluchtgefahr (§ 112 II 2)", area: "sr", sortOrder: 2 },
  { id: "sr-proz-haft-verdunkelung-112-2-3", parentId: "sr-proz-haft", label: "Verdunkelung (§ 112 II 3)", area: "sr", sortOrder: 3 },
  { id: "sr-proz-haft-wiederholung-112a", parentId: "sr-proz-haft", label: "Wiederholungsgefahr (§ 112a)", area: "sr", sortOrder: 4 },
  { id: "sr-proz-haft-fuehrerschein-111a", parentId: "sr-proz-haft", label: "Führerschein (§ 111a)", area: "sr", sortOrder: 5 },

  // Einziehung
  { id: "sr-proz-einz", parentId: "sr-proz-allg", label: "Einziehung", area: "sr", sortOrder: 7 },
  { id: "sr-proz-einziehung-73-74", parentId: "sr-proz-einz", label: "Einziehung (§§ 73, 74)", area: "sr", sortOrder: 1 },

  // ----- SR Prozessrecht B: Klausurtyp-spezifisch -----
  { id: "sr-proz-typ", parentId: "sr", label: "Prozessrecht: Klausurtyp-spezifisch", area: "sr", sortOrder: 3 },

  // StA-Klausur-Inhalte
  { id: "sr-proz-sta", parentId: "sr-proz-typ", label: "StA-Klausur", area: "sr", sortOrder: 1 },
  { id: "sr-proz-sta-einstellung-170-2", parentId: "sr-proz-sta", label: "Einstellung (§ 170 II)", area: "sr", sortOrder: 1 },
  { id: "sr-proz-sta-einstellung-opportunitaet-153ff", parentId: "sr-proz-sta", label: "Opportunität (§§ 153 ff.)", area: "sr", sortOrder: 2 },
  { id: "sr-proz-sta-anklage-hinreichender-tatverdacht", parentId: "sr-proz-sta", label: "Anklage / Hinreich. Tatverdacht", area: "sr", sortOrder: 3 },
  { id: "sr-proz-sta-strafbefehl-407", parentId: "sr-proz-sta", label: "Strafbefehl (§ 407)", area: "sr", sortOrder: 4 },
  { id: "sr-proz-sta-beschleunigtes-verfahren-417", parentId: "sr-proz-sta", label: "Beschleunigtes Verfahren (§ 417)", area: "sr", sortOrder: 5 },
  { id: "sr-proz-sta-privatklage-374", parentId: "sr-proz-sta", label: "Privatklage (§ 374)", area: "sr", sortOrder: 6 },
  { id: "sr-proz-sta-nebenklage-395", parentId: "sr-proz-sta", label: "Nebenklage (§ 395)", area: "sr", sortOrder: 7 },
  { id: "sr-proz-sta-jugendstrafrecht-jgg", parentId: "sr-proz-sta", label: "Jugendstrafrecht (JGG)", area: "sr", sortOrder: 8 },

  // Revision: Formalia
  { id: "sr-proz-rev-form", parentId: "sr-proz-typ", label: "Revision: Formalia", area: "sr", sortOrder: 2 },
  { id: "sr-proz-rev-einlegung-frist-341", parentId: "sr-proz-rev-form", label: "Einlegung (§ 341)", area: "sr", sortOrder: 1 },
  { id: "sr-proz-rev-begruendung-frist-345", parentId: "sr-proz-rev-form", label: "Begründung (§ 345)", area: "sr", sortOrder: 2 },
  { id: "sr-proz-rev-reformatio-in-peius-331", parentId: "sr-proz-rev-form", label: "Reformatio in peius (§ 331)", area: "sr", sortOrder: 3 },

  // Revision: Absolute Revisionsgründe
  { id: "sr-proz-rev-abs", parentId: "sr-proz-typ", label: "Revision: Absolute Gründe (§ 338)", area: "sr", sortOrder: 3 },
  { id: "sr-proz-rev-abs-besetzung-338-1", parentId: "sr-proz-rev-abs", label: "Besetzung (§ 338 Nr. 1)", area: "sr", sortOrder: 1 },
  { id: "sr-proz-rev-abs-befangenheit-338-3", parentId: "sr-proz-rev-abs", label: "Befangenheit (§ 338 Nr. 3)", area: "sr", sortOrder: 2 },
  { id: "sr-proz-rev-abs-unzustaendigkeit-338-4", parentId: "sr-proz-rev-abs", label: "Unzuständigkeit (§ 338 Nr. 4)", area: "sr", sortOrder: 3 },
  { id: "sr-proz-rev-abs-abwesenheit-angeklagt-338-5", parentId: "sr-proz-rev-abs", label: "Abwesenheit Angeklagter (§ 338 Nr. 5)", area: "sr", sortOrder: 4 },
  { id: "sr-proz-rev-abs-abwesenheit-verteidiger-338-5", parentId: "sr-proz-rev-abs", label: "Abwesenheit Verteidiger (§ 338 Nr. 5)", area: "sr", sortOrder: 5 },
  { id: "sr-proz-rev-abs-oeffentlichkeit-338-6", parentId: "sr-proz-rev-abs", label: "Öffentlichkeit (§ 338 Nr. 6)", area: "sr", sortOrder: 6 },
  { id: "sr-proz-rev-abs-urteil-verspaetet-338-7", parentId: "sr-proz-rev-abs", label: "Urteil verspätet (§ 338 Nr. 7)", area: "sr", sortOrder: 7 },
  { id: "sr-proz-rev-abs-verteidigung-beschraenkt-338-8", parentId: "sr-proz-rev-abs", label: "Verteidigung beschränkt (§ 338 Nr. 8)", area: "sr", sortOrder: 8 },

  // Revision: Relative Revisionsgründe
  { id: "sr-proz-rev-rel", parentId: "sr-proz-typ", label: "Revision: Relative Gründe", area: "sr", sortOrder: 4 },
  { id: "sr-proz-rev-rel-aufklaerungspflicht-244-2", parentId: "sr-proz-rev-rel", label: "Aufklärungspflicht (§ 244 II)", area: "sr", sortOrder: 1 },
  { id: "sr-proz-rev-rel-beweisantrag-244-3", parentId: "sr-proz-rev-rel", label: "Beweisantrag (§ 244 III)", area: "sr", sortOrder: 2 },
  { id: "sr-proz-rev-rel-unmittelbarkeit-250", parentId: "sr-proz-rev-rel", label: "Unmittelbarkeit (§ 250)", area: "sr", sortOrder: 3 },
  { id: "sr-proz-rev-rel-letztes-wort-258", parentId: "sr-proz-rev-rel", label: "Letztes Wort (§ 258)", area: "sr", sortOrder: 4 },
  { id: "sr-proz-rev-rel-hinweispflicht-265", parentId: "sr-proz-rev-rel", label: "Hinweispflicht (§ 265)", area: "sr", sortOrder: 5 },
  { id: "sr-proz-rev-rel-dolmetscher", parentId: "sr-proz-rev-rel", label: "Dolmetscher", area: "sr", sortOrder: 6 },

  // Revision: Sachrüge
  { id: "sr-proz-rev-sach", parentId: "sr-proz-typ", label: "Revision: Sachrüge", area: "sr", sortOrder: 5 },
  { id: "sr-proz-rev-sach-beweiswuerdigung-261", parentId: "sr-proz-rev-sach", label: "Beweiswürdigung (§ 261)", area: "sr", sortOrder: 1 },
  { id: "sr-proz-rev-sach-strafzumessung-46", parentId: "sr-proz-rev-sach", label: "Strafzumessung (§ 46)", area: "sr", sortOrder: 2 },
  { id: "sr-proz-rev-sach-gesamtstrafe-53", parentId: "sr-proz-rev-sach", label: "Gesamtstrafe (§ 53)", area: "sr", sortOrder: 3 },
];

/**
 * Baut die hierarchische Baumstruktur aus der flachen Liste
 */
export function buildTopicTree(topics: Topic[]): Topic[] {
  const map = new Map<string, Topic>();
  const roots: Topic[] = [];

  for (const t of topics) {
    map.set(t.id, { ...t, children: [] });
  }

  for (const t of topics) {
    const node = map.get(t.id)!;
    if (t.parentId === null) {
      roots.push(node);
    } else {
      const parent = map.get(t.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    }
  }

  return roots;
}

/**
 * Gibt alle Blatt-Themen (ohne Kinder) zurück — die trackbaren Einheiten
 */
export function getLeafTopics(topics: Topic[]): Topic[] {
  return topics.filter(t => !topics.some(other => other.parentId === t.id));
}

/**
 * Gibt alle Themen einer bestimmten Tiefe zurück (0 = Root)
 */
export function getTopicsByDepth(topics: Topic[], depth: number): Topic[] {
  if (depth === 0) return topics.filter(t => t.parentId === null);

  let current = topics.filter(t => t.parentId === null);
  for (let d = 0; d < depth; d++) {
    const parentIds = new Set(current.map(t => t.id));
    current = topics.filter(t => t.parentId && parentIds.has(t.parentId));
  }
  return current;
}
