// Modell-Wissensschicht für die Korrektur-UI.
//
// Die kostenlosen OpenRouter-Modelle wechseln täglich — eine feste Liste mit
// Beschreibungen würde veralten. Deshalb erkennen wir die *Familie* anhand des
// Slugs (Hersteller-Muster) und liefern dazu eine kurze, lehrreiche Erklärung
// plus eine grobe Eignungs-Heuristik ("Token-Jäger" trifft Modell-Kunde).
//
// WICHTIG: Die Eignung ist eine Faustregel aus Familien-Ruf + Größe + Kontext +
// Spezialisierung — KEIN echter Benchmark. Sie ordnet die Free-Modelle relativ
// zueinander für *unsere* Aufgabe: langes deutsches Jura-Prosa-Feedback mit
// striktem Antwortformat (Marker-JSON am Ende).

import { getKorrekturModel } from "@/lib/ai-models";

export interface ModelAnalysis {
  vendor: string;
  /** 1–2 Sätze, je mit einem KI-Konzept zum Mitlernen. */
  blurb: string;
  /** Grobe Eignung für die Korrektur, 0–100 (Heuristik, kein Benchmark). */
  fit: number;
  /** true = kuratiertes (kostenpflichtiges) Modell aus der Registry. */
  curated: boolean;
}

interface Family {
  test: RegExp;
  vendor: string;
  /** Basiswert für unsere Aufgabe vor Größe/Kontext/Spezialisierung. */
  base: number;
  blurb: string;
}

// Reihenfolge = Priorität: spezifische Muster vor generischen.
const FAMILIES: Family[] = [
  {
    test: /anthropic|claude/,
    vendor: "Anthropic (USA)",
    base: 88,
    blurb: "Sehr stark bei langer, strukturierter Prosa und Instruktionstreue — hält das strikte Antwortformat (Marker-JSON am Ende) zuverlässig ein und schreibt präzises, sauberes Deutsch. Ideal für ausführliches Korrektur-Feedback.",
  },
  {
    test: /poolside|laguna/,
    vendor: "Poolside",
    base: 48,
    blurb: "Spezialisiert auf Programmier-Assistenz. Versteht Sprache, ist für juristische Prosa aber nicht das Werkzeug der Wahl.",
  },
  {
    test: /deepseek/,
    vendor: "DeepSeek (China)",
    base: 82,
    blurb: "Mixture-of-Experts: aktiviert pro Token nur einen kleinen Teil seiner Parameter → sehr stark in Logik/Subsumtion und trotzdem günstig. Gutes Deutsch.",
  },
  {
    test: /qwen|qwq/,
    vendor: "Alibaba Qwen (China)",
    base: 80,
    blurb: "Eines der stärksten offen verfügbaren Mehrsprach-Modelle. Solides Deutsch und zuverlässige Instruktionstreue — wichtig für den Marker-JSON-Block.",
  },
  {
    test: /magistral/,
    vendor: "Mistral (Frankreich)",
    base: 78,
    blurb: "Ein „Reasoning“-Modell: denkt vor der Antwort in Zwischenschritten. Das hilft bei Aufbau- und Subsumtionskritik.",
  },
  {
    test: /mixtral|ministral|codestral|devstral|mistral|magistral/,
    vendor: "Mistral (Frankreich)",
    base: 75,
    blurb: "Auf europäische Sprachen getrimmt → meist sauberes Deutsch, effizient und schnell.",
  },
  {
    test: /gemma/,
    vendor: "Google",
    base: 66,
    blurb: "Googles kompakte, offene Modellfamilie. Für ihre Größe stark, bei langen Klausuren aber weniger tief als die großen Modelle.",
  },
  {
    test: /gemini/,
    vendor: "Google",
    base: 85,
    blurb: "Sehr langes Kontextfenster und starke Sprachqualität — gut, um eine ganze Klausur am Stück zu beurteilen.",
  },
  {
    test: /nemotron|nvidia/,
    vendor: "NVIDIA",
    base: 74,
    blurb: "Auf Reasoning nachtrainiertes Großmodell. Kann inhaltlich tief gehen, ist dafür oft langsamer.",
  },
  {
    test: /gpt-oss|openai|\bgpt-/,
    vendor: "OpenAI",
    base: 80,
    blurb: "Starke Instruktionstreue und sauberes Deutsch. „oss“ = offen gewichtet, also frei nutzbar.",
  },
  {
    test: /grok|x-ai/,
    vendor: "xAI",
    base: 80,
    blurb: "Starkes Allround-Modell mit gutem Deutsch und großem Kontextfenster.",
  },
  {
    test: /\bglm\b|chatglm|zhipu|z-ai/,
    vendor: "Zhipu GLM (China)",
    base: 73,
    blurb: "Solides zweisprachiges Modell mit ordentlicher Instruktionstreue.",
  },
  {
    test: /kimi|moonshot/,
    vendor: "Moonshot (China)",
    base: 74,
    blurb: "Bekannt für extrem lange Kontextfenster — praktisch, wenn Sachverhalt + Lösung zusammen reingehen sollen.",
  },
  {
    test: /minimax/,
    vendor: "MiniMax (China)",
    base: 70,
    blurb: "Effizientes Allround-Modell mit langem Kontext, brauchbar für Stil- und Formhinweise.",
  },
  {
    test: /llama|meta-llama/,
    vendor: "Meta",
    base: 72,
    blurb: "Robuster Allrounder mit riesiger Community. Gutes Deutsch, mittlere Tiefe bei feiner Stilkritik.",
  },
  {
    test: /phi/,
    vendor: "Microsoft",
    base: 58,
    blurb: "Klein, aber auf Reasoning trainiert („small language model“). Deutsch und Feinstil sind schwächer — eher zum Ausprobieren.",
  },
  {
    test: /command|cohere/,
    vendor: "Cohere",
    base: 64,
    blurb: "Auf Faktentreue/RAG optimiert. Bei freier Stilkritik etwas nüchterner.",
  },
  {
    test: /\byi[-\d]|01-ai/,
    vendor: "01.AI (China)",
    base: 66,
    blurb: "Zweisprachiges Modell der soliden Mittelklasse.",
  },
  {
    test: /hermes|nous/,
    vendor: "Nous Research",
    base: 68,
    blurb: "Community-Finetune, getrimmt auf Anweisungsbefolgung und neutrale Tonalität.",
  },
  {
    test: /dolphin/,
    vendor: "Community-Finetune",
    base: 62,
    blurb: "Nachtrainiertes offenes Modell, auf gehorsame Antworten getrimmt. Qualität schwankt je nach Basis.",
  },
  {
    test: /reka/,
    vendor: "Reka",
    base: 66,
    blurb: "Multimodale Modellfamilie der Mittelklasse mit brauchbarem Deutsch.",
  },
];

const FALLBACK: Omit<Family, "test"> = {
  vendor: "Unbekannter Anbieter",
  base: 55,
  blurb: "Wenig Erfahrungswerte für diese Aufgabe — am besten kurz selbst testen. (Free-Modelle rotieren täglich.)",
};

function matchFamily(idLower: string): Omit<Family, "test"> {
  return FAMILIES.find((f) => f.test.test(idLower)) ?? FALLBACK;
}

/** Größter Parameter-Wert im Slug (z.B. "120b-a12b" → 120), sonst null. */
function parseParamsB(idLower: string): number | null {
  const matches = [...idLower.matchAll(/(\d+(?:\.\d+)?)\s*b(?![a-z])/g)].map((m) => parseFloat(m[1]));
  return matches.length ? Math.max(...matches) : null;
}

function sizeBonus(b: number | null): number {
  if (b === null) return 0;
  if (b >= 100) return 8;
  if (b >= 60) return 6;
  if (b >= 30) return 4;
  if (b >= 14) return 1;
  if (b >= 8) return 0;
  return -8;
}

function contextBonus(ctx: number): number {
  if (ctx >= 400_000) return 10;
  if (ctx >= 200_000) return 8;
  if (ctx >= 128_000) return 6;
  if (ctx >= 64_000) return 4;
  if (ctx >= 32_000) return 2;
  if (ctx >= 16_000) return 1;
  return 0;
}

const CODER_RE = /coder|codestral|devstral|starcoder|code-|polyglot/;
const REASONING_RE = /thinking|reasoning|reasoner|-r1\b|\bqwq\b|magistral/;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Analysiert ein Modell (Free oder kuratiert) für die Korrektur-UI.
 * @param contextLength  nur bei Free-Modellen bekannt; fließt in die Eignung ein.
 */
export function analyzeModel(id: string, contextLength = 0): ModelAnalysis {
  const curated = getKorrekturModel(id);
  const idLower = id.toLowerCase();
  const fam = matchFamily(idLower);
  const isFallbackFamily = fam === FALLBACK;

  const isCoder = CODER_RE.test(idLower);
  const isReasoning = REASONING_RE.test(idLower);

  let fit = fam.base
    + sizeBonus(parseParamsB(idLower))
    + contextBonus(contextLength)
    // Reasoning-Modelle denken vor der Antwort in Zwischenschritten — genau das,
    // was Aufbau-/Subsumtionskritik braucht. Auf Augenhöhe mit dem max. Größen-Bonus
    // (+8), bleibt aber Modifikator (überstimmt die Familien-Basis nicht).
    + (isReasoning ? 8 : 0)
    + (isCoder ? -18 : 0);
  fit = clamp(Math.round(fit), 5, 95);

  // Kuratierte Modelle: Hersteller-Hinweis als Beschreibung (ist schon kuratiert),
  // aber Familien-Blurb anhängen, damit man trotzdem etwas über die Familie lernt.
  if (curated) {
    const extras: string[] = [];
    if (isReasoning) extras.push("Reasoning-Variante (denkt in Zwischenschritten).");
    // Familien-Blurb nur anhängen, wenn wirklich eine Familie erkannt wurde —
    // bei Fallback wäre der „wenig Erfahrungswerte"-Text irreführend (kuratiert = Spitzenmodell).
    const famNote = isFallbackFamily ? "" : ` ${fam.blurb}`;
    // Fallback-Familie hat keinen sinnvollen Basiswert für ein kuratiertes Modell →
    // mindestens „stark" ansetzen, damit der Default nicht künstlich niedrig wirkt.
    const curatedFit = isFallbackFamily ? Math.max(fit, 82) : fit;
    return {
      vendor: curated.vendor,
      blurb: `${curated.hinweis}${famNote}${extras.length ? " " + extras.join(" ") : ""}`.trim(),
      fit: clamp(curatedFit + 6, 5, 99), // kuratierte sind durchweg Spitzenmodelle
      curated: true,
    };
  }

  const extras: string[] = [];
  if (isCoder) extras.push("Diese Variante ist auf Code spezialisiert — für juristische Prosa schwächer.");
  if (isReasoning) extras.push("Reasoning-Variante: denkt vor der Antwort in Zwischenschritten, gut für Aufbaukritik.");

  return {
    vendor: fam.vendor,
    blurb: `${fam.blurb}${extras.length ? " " + extras.join(" ") : ""}`,
    fit,
    curated: false,
  };
}

export interface RankedFreeModel {
  id: string;
  name: string;
  contextLength: number;
  fit: number;
  rank: number;
}

/**
 * Sortiert die Free-Modelle nach Eignung für die Korrektur (best zuerst).
 * Tiebreaker: größeres Kontextfenster.
 */
export function rankFreeModels(
  models: { id: string; name: string; contextLength: number }[],
): RankedFreeModel[] {
  return models
    .map((m) => ({ ...m, fit: analyzeModel(m.id, m.contextLength).fit }))
    .sort((a, b) => b.fit - a.fit || b.contextLength - a.contextLength)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}
