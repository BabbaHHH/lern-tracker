import { Topic } from "./types";

// Hierarchische Themenstruktur für das 2. juristische Staatsexamen Berlin (GJPA)
// Basiert auf den GJPA-Pflichtinhalten

export const TOPICS: Topic[] = [
  // ===== ZIVILRECHT (3 Klausuren) =====
  // -- BGB AT --
  { id: "zr", parentId: null, label: "Zivilrecht", area: "zr", sortOrder: 1 },

  { id: "zr-bgb-at", parentId: "zr", label: "BGB AT", area: "zr", sortOrder: 1 },
  { id: "zr-bgb-at-rg", parentId: "zr-bgb-at", label: "Rechtsgeschäftslehre", area: "zr", sortOrder: 1 },
  { id: "zr-bgb-at-we", parentId: "zr-bgb-at", label: "Willenserklärung & Anfechtung", area: "zr", sortOrder: 2 },
  { id: "zr-bgb-at-vertretung", parentId: "zr-bgb-at", label: "Stellvertretung", area: "zr", sortOrder: 3 },
  { id: "zr-bgb-at-agb", parentId: "zr-bgb-at", label: "AGB-Kontrolle", area: "zr", sortOrder: 4 },
  { id: "zr-bgb-at-fristen", parentId: "zr-bgb-at", label: "Fristen & Verjährung", area: "zr", sortOrder: 5 },

  // -- Schuldrecht AT --
  { id: "zr-schuld-at", parentId: "zr", label: "Schuldrecht AT", area: "zr", sortOrder: 2 },
  { id: "zr-schuld-at-lsr", parentId: "zr-schuld-at", label: "Leistungsstörungsrecht", area: "zr", sortOrder: 1 },
  { id: "zr-schuld-at-unmoeglich", parentId: "zr-schuld-at", label: "Unmöglichkeit", area: "zr", sortOrder: 2 },
  { id: "zr-schuld-at-verzug", parentId: "zr-schuld-at", label: "Schuldnerverzug", area: "zr", sortOrder: 3 },
  { id: "zr-schuld-at-pvv", parentId: "zr-schuld-at", label: "pVV & Schutzpflichten", area: "zr", sortOrder: 4 },
  { id: "zr-schuld-at-ruecktritt", parentId: "zr-schuld-at", label: "Rücktritt & Widerruf", area: "zr", sortOrder: 5 },
  { id: "zr-schuld-at-schadensrecht", parentId: "zr-schuld-at", label: "Schadensrecht (§§ 249 ff.)", area: "zr", sortOrder: 6 },
  { id: "zr-schuld-at-abtretung", parentId: "zr-schuld-at", label: "Abtretung & Schuldübernahme", area: "zr", sortOrder: 7 },

  // -- Schuldrecht BT --
  { id: "zr-schuld-bt", parentId: "zr", label: "Schuldrecht BT", area: "zr", sortOrder: 3 },
  { id: "zr-schuld-bt-kauf", parentId: "zr-schuld-bt", label: "Kaufrecht & Gewährleistung", area: "zr", sortOrder: 1 },
  { id: "zr-schuld-bt-miete", parentId: "zr-schuld-bt", label: "Mietrecht", area: "zr", sortOrder: 2 },
  { id: "zr-schuld-bt-werkvertrag", parentId: "zr-schuld-bt", label: "Werkvertrag", area: "zr", sortOrder: 3 },
  { id: "zr-schuld-bt-auftrag", parentId: "zr-schuld-bt", label: "Auftrag & Geschäftsbesorgung", area: "zr", sortOrder: 4 },
  { id: "zr-schuld-bt-darlehen", parentId: "zr-schuld-bt", label: "Darlehen & Bürgschaft", area: "zr", sortOrder: 5 },
  { id: "zr-schuld-bt-deliktsrecht", parentId: "zr-schuld-bt", label: "Deliktsrecht (§§ 823 ff.)", area: "zr", sortOrder: 6 },
  { id: "zr-schuld-bt-bereicherung", parentId: "zr-schuld-bt", label: "Bereicherungsrecht", area: "zr", sortOrder: 7 },
  { id: "zr-schuld-bt-goa", parentId: "zr-schuld-bt", label: "GoA", area: "zr", sortOrder: 8 },

  // -- Sachenrecht --
  { id: "zr-sachen", parentId: "zr", label: "Sachenrecht", area: "zr", sortOrder: 4 },
  { id: "zr-sachen-besitz", parentId: "zr-sachen", label: "Besitz & Besitzschutz", area: "zr", sortOrder: 1 },
  { id: "zr-sachen-eigentum", parentId: "zr-sachen", label: "Eigentumserwerb (beweglich)", area: "zr", sortOrder: 2 },
  { id: "zr-sachen-grundstueck", parentId: "zr-sachen", label: "Grundstücksrecht", area: "zr", sortOrder: 3 },
  { id: "zr-sachen-sicherheiten", parentId: "zr-sachen", label: "Kreditsicherheiten", area: "zr", sortOrder: 4 },
  { id: "zr-sachen-ebrv", parentId: "zr-sachen", label: "EBV (§§ 987 ff.)", area: "zr", sortOrder: 5 },

  // -- Familienrecht --
  { id: "zr-familie", parentId: "zr", label: "Familienrecht", area: "zr", sortOrder: 5 },
  { id: "zr-familie-ehe", parentId: "zr-familie", label: "Eherecht & Güterrecht", area: "zr", sortOrder: 1 },
  { id: "zr-familie-scheidung", parentId: "zr-familie", label: "Scheidungsfolgen", area: "zr", sortOrder: 2 },
  { id: "zr-familie-kindschaft", parentId: "zr-familie", label: "Kindschaftsrecht & Sorgerecht", area: "zr", sortOrder: 3 },
  { id: "zr-familie-unterhalt", parentId: "zr-familie", label: "Unterhaltsrecht", area: "zr", sortOrder: 4 },

  // -- Erbrecht --
  { id: "zr-erb", parentId: "zr", label: "Erbrecht", area: "zr", sortOrder: 6 },
  { id: "zr-erb-gesetzlich", parentId: "zr-erb", label: "Gesetzliche Erbfolge", area: "zr", sortOrder: 1 },
  { id: "zr-erb-testament", parentId: "zr-erb", label: "Testamentarische Erbfolge", area: "zr", sortOrder: 2 },
  { id: "zr-erb-pflichtteil", parentId: "zr-erb", label: "Pflichtteilsrecht", area: "zr", sortOrder: 3 },

  // -- Handelsrecht --
  { id: "zr-hr", parentId: "zr", label: "Handelsrecht", area: "zr", sortOrder: 7 },
  { id: "zr-hr-kaufmann", parentId: "zr-hr", label: "Kaufmannsbegriff & Register", area: "zr", sortOrder: 1 },
  { id: "zr-hr-hgb", parentId: "zr-hr", label: "Handelsgeschäfte", area: "zr", sortOrder: 2 },

  // -- Gesellschaftsrecht --
  { id: "zr-gesell", parentId: "zr", label: "Gesellschaftsrecht", area: "zr", sortOrder: 8 },
  { id: "zr-gesell-gbr", parentId: "zr-gesell", label: "GbR / OHG / KG", area: "zr", sortOrder: 1 },
  { id: "zr-gesell-gmbh", parentId: "zr-gesell", label: "GmbH-Recht", area: "zr", sortOrder: 2 },

  // -- Arbeitsrecht --
  { id: "zr-arbeit", parentId: "zr", label: "Arbeitsrecht", area: "zr", sortOrder: 9 },
  { id: "zr-arbeit-individual", parentId: "zr-arbeit", label: "Individualarbeitsrecht", area: "zr", sortOrder: 1 },
  { id: "zr-arbeit-kuendigung", parentId: "zr-arbeit", label: "Kündigungsschutz", area: "zr", sortOrder: 2 },
  { id: "zr-arbeit-betriebsverfassung", parentId: "zr-arbeit", label: "Betriebsverfassungsrecht", area: "zr", sortOrder: 3 },

  // -- ZPO --
  { id: "zr-zpo", parentId: "zr", label: "ZPO / Prozessrecht", area: "zr", sortOrder: 10 },
  { id: "zr-zpo-klage", parentId: "zr-zpo", label: "Klagearten & Zulässigkeit", area: "zr", sortOrder: 1 },
  { id: "zr-zpo-beweis", parentId: "zr-zpo", label: "Beweisrecht", area: "zr", sortOrder: 2 },
  { id: "zr-zpo-urteil", parentId: "zr-zpo", label: "Urteil & Tenorierung", area: "zr", sortOrder: 3 },
  { id: "zr-zpo-rm", parentId: "zr-zpo", label: "Rechtsmittel", area: "zr", sortOrder: 4 },
  { id: "zr-zpo-vollstreckung", parentId: "zr-zpo", label: "Zwangsvollstreckung", area: "zr", sortOrder: 5 },
  { id: "zr-zpo-eilrechtsschutz", parentId: "zr-zpo", label: "Einstweiliger Rechtsschutz", area: "zr", sortOrder: 6 },
  { id: "zr-zpo-famgericht", parentId: "zr-zpo", label: "Familiengerichtliches Verfahren", area: "zr", sortOrder: 7 },

  // ===== ÖFFENTLICHES RECHT (2 Klausuren) =====
  { id: "oeffr", parentId: null, label: "Öffentliches Recht", area: "oeffr", sortOrder: 2 },

  // -- Verwaltungsrecht AT --
  { id: "oeffr-vwat", parentId: "oeffr", label: "Verwaltungsrecht AT", area: "oeffr", sortOrder: 1 },
  { id: "oeffr-vwat-va", parentId: "oeffr-vwat", label: "Verwaltungsakt", area: "oeffr", sortOrder: 1 },
  { id: "oeffr-vwat-ermessen", parentId: "oeffr-vwat", label: "Ermessen & unbest. Rechtsbegriffe", area: "oeffr", sortOrder: 2 },
  { id: "oeffr-vwat-ruecknahme", parentId: "oeffr-vwat", label: "Rücknahme & Widerruf (§§ 48, 49)", area: "oeffr", sortOrder: 3 },
  { id: "oeffr-vwat-vwvfg", parentId: "oeffr-vwat", label: "Verwaltungsverfahren", area: "oeffr", sortOrder: 4 },
  { id: "oeffr-vwat-oeffentl-vertrag", parentId: "oeffr-vwat", label: "Öffentlich-rechtlicher Vertrag", area: "oeffr", sortOrder: 5 },

  // -- Verwaltungsprozessrecht --
  { id: "oeffr-vwgo", parentId: "oeffr", label: "Verwaltungsprozessrecht", area: "oeffr", sortOrder: 2 },
  { id: "oeffr-vwgo-klagearten", parentId: "oeffr-vwgo", label: "Klagearten (Anfechtung, Verpflichtung, Feststellung)", area: "oeffr", sortOrder: 1 },
  { id: "oeffr-vwgo-vorverfahren", parentId: "oeffr-vwgo", label: "Vorverfahren (Widerspruch)", area: "oeffr", sortOrder: 2 },
  { id: "oeffr-vwgo-eilrechtsschutz", parentId: "oeffr-vwgo", label: "Eilrechtsschutz (§§ 80, 123 VwGO)", area: "oeffr", sortOrder: 3 },
  { id: "oeffr-vwgo-urteil", parentId: "oeffr-vwgo", label: "Urteil & Tenorierung (VwGO)", area: "oeffr", sortOrder: 4 },

  // -- Polizei- und Ordnungsrecht --
  { id: "oeffr-polr", parentId: "oeffr", label: "Polizei- & Ordnungsrecht", area: "oeffr", sortOrder: 3 },
  { id: "oeffr-polr-generalklausel", parentId: "oeffr-polr", label: "Generalklausel & Standardmaßnahmen", area: "oeffr", sortOrder: 1 },
  { id: "oeffr-polr-stoerer", parentId: "oeffr-polr", label: "Störerauswahl", area: "oeffr", sortOrder: 2 },
  { id: "oeffr-polr-verhaeltnism", parentId: "oeffr-polr", label: "Verhältnismäßigkeit", area: "oeffr", sortOrder: 3 },

  // -- Baurecht --
  { id: "oeffr-bau", parentId: "oeffr", label: "Baurecht", area: "oeffr", sortOrder: 4 },
  { id: "oeffr-bau-bauplanungsrecht", parentId: "oeffr-bau", label: "Bauplanungsrecht (§§ 30–35 BauGB)", area: "oeffr", sortOrder: 1 },
  { id: "oeffr-bau-bauordnungsrecht", parentId: "oeffr-bau", label: "Bauordnungsrecht (BauO Bln)", area: "oeffr", sortOrder: 2 },
  { id: "oeffr-bau-nachbarschutz", parentId: "oeffr-bau", label: "Nachbarschutz", area: "oeffr", sortOrder: 3 },

  // -- Kommunalrecht --
  { id: "oeffr-komm", parentId: "oeffr", label: "Kommunalrecht", area: "oeffr", sortOrder: 5 },
  { id: "oeffr-komm-organe", parentId: "oeffr-komm", label: "Organe & Zuständigkeiten", area: "oeffr", sortOrder: 1 },
  { id: "oeffr-komm-satzung", parentId: "oeffr-komm", label: "Satzungsrecht", area: "oeffr", sortOrder: 2 },

  // -- Staatshaftungsrecht --
  { id: "oeffr-sthr", parentId: "oeffr", label: "Staatshaftungsrecht", area: "oeffr", sortOrder: 6 },
  { id: "oeffr-sthr-amtshaftung", parentId: "oeffr-sthr", label: "Amtshaftung (§ 839 / Art. 34 GG)", area: "oeffr", sortOrder: 1 },
  { id: "oeffr-sthr-enteignung", parentId: "oeffr-sthr", label: "Enteignung & Aufopferung", area: "oeffr", sortOrder: 2 },
  { id: "oeffr-sthr-folgenbeseitigung", parentId: "oeffr-sthr", label: "Folgenbeseitigungsanspruch", area: "oeffr", sortOrder: 3 },

  // -- Verfassungsrecht --
  { id: "oeffr-verfr", parentId: "oeffr", label: "Verfassungsrecht", area: "oeffr", sortOrder: 7 },
  { id: "oeffr-verfr-grundrechte", parentId: "oeffr-verfr", label: "Grundrechte (Prüfungsschema)", area: "oeffr", sortOrder: 1 },
  { id: "oeffr-verfr-staatsorgr", parentId: "oeffr-verfr", label: "Staatsorganisationsrecht", area: "oeffr", sortOrder: 2 },
  { id: "oeffr-verfr-verfbeschwerde", parentId: "oeffr-verfr", label: "Verfassungsbeschwerde", area: "oeffr", sortOrder: 3 },

  // -- Europarecht --
  { id: "oeffr-eu", parentId: "oeffr", label: "Europarecht", area: "oeffr", sortOrder: 8 },
  { id: "oeffr-eu-grundfreiheiten", parentId: "oeffr-eu", label: "Grundfreiheiten", area: "oeffr", sortOrder: 1 },
  { id: "oeffr-eu-vorlageverfahren", parentId: "oeffr-eu", label: "Vorlageverfahren (Art. 267 AEUV)", area: "oeffr", sortOrder: 2 },

  // ===== STRAFRECHT (2 Klausuren) =====
  { id: "sr", parentId: null, label: "Strafrecht", area: "sr", sortOrder: 3 },

  // -- StGB AT --
  { id: "sr-at", parentId: "sr", label: "StGB AT", area: "sr", sortOrder: 1 },
  { id: "sr-at-tatbestand", parentId: "sr-at", label: "Tatbestand & Kausalität", area: "sr", sortOrder: 1 },
  { id: "sr-at-rechtswidrigkeit", parentId: "sr-at", label: "Rechtswidrigkeit & Rechtfertigung", area: "sr", sortOrder: 2 },
  { id: "sr-at-schuld", parentId: "sr-at", label: "Schuld & Entschuldigung", area: "sr", sortOrder: 3 },
  { id: "sr-at-versuch", parentId: "sr-at", label: "Versuch & Rücktritt", area: "sr", sortOrder: 4 },
  { id: "sr-at-taeterschaft", parentId: "sr-at", label: "Täterschaft & Teilnahme", area: "sr", sortOrder: 5 },
  { id: "sr-at-unterlassen", parentId: "sr-at", label: "Unterlassungsdelikte", area: "sr", sortOrder: 6 },
  { id: "sr-at-fahrl", parentId: "sr-at", label: "Fahrlässigkeitsdelikte", area: "sr", sortOrder: 7 },
  { id: "sr-at-irrtum", parentId: "sr-at", label: "Irrtumslehre", area: "sr", sortOrder: 8 },
  { id: "sr-at-konkurrenzen", parentId: "sr-at", label: "Konkurrenzen", area: "sr", sortOrder: 9 },

  // -- StGB BT --
  { id: "sr-bt", parentId: "sr", label: "StGB BT", area: "sr", sortOrder: 2 },
  { id: "sr-bt-toetung", parentId: "sr-bt", label: "Tötungsdelikte (§§ 211 ff.)", area: "sr", sortOrder: 1 },
  { id: "sr-bt-koerperverl", parentId: "sr-bt", label: "Körperverletzung (§§ 223 ff.)", area: "sr", sortOrder: 2 },
  { id: "sr-bt-freiheit", parentId: "sr-bt", label: "Freiheitsdelikte", area: "sr", sortOrder: 3 },
  { id: "sr-bt-diebstahl", parentId: "sr-bt", label: "Diebstahl & Unterschlagung", area: "sr", sortOrder: 4 },
  { id: "sr-bt-raub", parentId: "sr-bt", label: "Raub & Erpressung", area: "sr", sortOrder: 5 },
  { id: "sr-bt-betrug", parentId: "sr-bt", label: "Betrug & Untreue", area: "sr", sortOrder: 6 },
  { id: "sr-bt-sachbesch", parentId: "sr-bt", label: "Sachbeschädigung", area: "sr", sortOrder: 7 },
  { id: "sr-bt-urkundenf", parentId: "sr-bt", label: "Urkundenfälschung", area: "sr", sortOrder: 8 },
  { id: "sr-bt-brandstiftung", parentId: "sr-bt", label: "Brandstiftung", area: "sr", sortOrder: 9 },
  { id: "sr-bt-amtsdelikte", parentId: "sr-bt", label: "Amtsdelikte (§§ 331 ff.)", area: "sr", sortOrder: 10 },
  { id: "sr-bt-widerstand", parentId: "sr-bt", label: "Widerstand & Aussagedelikte", area: "sr", sortOrder: 11 },

  // -- StPO --
  { id: "sr-stpo", parentId: "sr", label: "Strafprozessrecht", area: "sr", sortOrder: 3 },
  { id: "sr-stpo-ermittlung", parentId: "sr-stpo", label: "Ermittlungsverfahren", area: "sr", sortOrder: 1 },
  { id: "sr-stpo-zwangsmittel", parentId: "sr-stpo", label: "Zwangsmittel (Durchsuchung, U-Haft)", area: "sr", sortOrder: 2 },
  { id: "sr-stpo-hauptverhandlung", parentId: "sr-stpo", label: "Hauptverhandlung", area: "sr", sortOrder: 3 },
  { id: "sr-stpo-beweisverwertung", parentId: "sr-stpo", label: "Beweisverwertungsverbote", area: "sr", sortOrder: 4 },
  { id: "sr-stpo-urteil", parentId: "sr-stpo", label: "Urteil & Revision", area: "sr", sortOrder: 5 },
  { id: "sr-stpo-rechtsmittel", parentId: "sr-stpo", label: "Berufung & Revision", area: "sr", sortOrder: 6 },
  { id: "sr-stpo-strafzumessung", parentId: "sr-stpo", label: "Strafzumessung", area: "sr", sortOrder: 7 },

  // -- Aktenvortrag --
  { id: "sr-aktenvortrag", parentId: "sr", label: "Aktenvortrag", area: "sr", sortOrder: 4 },
  { id: "sr-aktenvortrag-aufbau", parentId: "sr-aktenvortrag", label: "Aufbau & Technik", area: "sr", sortOrder: 1 },
  { id: "sr-aktenvortrag-vortrag", parentId: "sr-aktenvortrag", label: "Vortragstechnik & Zeitmanagement", area: "sr", sortOrder: 2 },
];

/**
 * Baut die hierarchische Baumstruktur aus der flachen Liste
 */
export function buildTopicTree(topics: Topic[]): Topic[] {
  const map = new Map<string, Topic>();
  const roots: Topic[] = [];

  // Nur die 3 Hauptkategorien als Roots
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
