import { AI_DEFAULTS, type ReasoningEffort } from "./ai-config";
import { AI_REQUEST_LIMITS } from "./ai-limits";
// Kuratierte Modell-Auswahl für die Klausur-Korrektur.
// Neue Standards: OpenRouter-Modellseiten vom 2026-10-10; Preise sind Richtwerte.
// Weitere Alternativen stammen aus der bestehenden Auswahl vom 2026-06-02.
// Spread über Preisklassen, inkl. chinesischer Modelle — bewusst klein gehalten,
// nicht die volle OpenRouter-Liste (300+).

export type ModelClass = "premium" | "stark" | "mittel" | "günstig";

export interface KorrekturModel {
  /** OpenRouter-Slug, direkt als `model` an die API. */
  id: string;
  label: string;
  vendor: string;
  klasse: ModelClass;
  /** Grobe Kosten in US-$ pro 1 Mio Tokens (Input/Output). */
  preis: { in: number; out: number };
  /** Kurzcharakterisierung für die Auswahl-UI. */
  hinweis: string;
  /** OpenRouter reasoning-Parameter (nur bei Reasoning-Modellen). */
  reasoning?: { effort: ReasoningEffort };
  /** Max-Output-Tokens — Reasoning braucht Headroom. */
  maxTokens?: number;
}

export const KORREKTUR_MODELS: KorrekturModel[] = [
  {
    id: AI_DEFAULTS.strong.id, label: AI_DEFAULTS.strong.label, vendor: "OpenAI",
    klasse: "stark", preis: { in: 0.10, out: 0.50 },
    hinweis: "Standard für die Korrektur; maximaler Denkaufwand, in den KI-Einstellungen anpassbar.",
    reasoning: { effort: "max" }, maxTokens: 16000,
  },
  {
    id: AI_DEFAULTS.cheap.id, label: AI_DEFAULTS.cheap.label, vendor: "DeepSeek",
    klasse: "günstig", preis: { in: 0.0152, out: 1.28 },
    hinweis: "Günstige Alternative; Anbieterpreise können abweichen.", maxTokens: 16000,
  },
  // — Premium —
  {
    id: AI_DEFAULTS.premium.id,
    label: AI_DEFAULTS.premium.label,
    vendor: "Anthropic",
    klasse: "premium",
    preis: { in: 4, out: 20 },
    reasoning: { effort: "high" },
    maxTokens: 16000,
    hinweis: "Premium-Modell für ausführliche Gesamt-Gutachten; hoher Denkaufwand.",
  },
  {
    id: "openai/gpt-5.4",
    label: "GPT-5.4",
    vendor: "OpenAI",
    klasse: "premium",
    preis: { in: 2.5, out: 15 },
    hinweis: "Sehr stark und ausgewogen.",
  },
  {
    id: "google/gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    vendor: "Google",
    klasse: "premium",
    preis: { in: 2, out: 12 },
    hinweis: "Stark, günstiger als Opus, großes Kontextfenster.",
  },
  // — Stark (Default) —
  {
    id: "z-ai/glm-5.2",
    label: "GLM-5.2",
    vendor: "Zhipu (China)",
    klasse: "stark",
    preis: { in: 1.0, out: 3.0 },
    hinweis: "Neuestes Reasoning-Modell von Zhipu AI — als Alternative wählbar.",
    reasoning: { effort: "medium" },
    maxTokens: 16000,
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    vendor: "Anthropic",
    klasse: "stark",
    preis: { in: 3, out: 15 },
    hinweis: "Top Preis/Leistung für Korrektur.",
  },
  // — Mittel —
  {
    id: "x-ai/grok-4.3",
    label: "Grok 4.3",
    vendor: "xAI",
    klasse: "mittel",
    preis: { in: 1.25, out: 2.5 },
    hinweis: "Günstige Ausgabe, sehr großes Kontextfenster.",
  },
  // — Günstig —
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 mini",
    vendor: "OpenAI",
    klasse: "günstig",
    preis: { in: 0.25, out: 2 },
    hinweis: "Schnell & günstig — gut für Wort/Satz-Feedback.",
  },
  {
    id: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    vendor: "Google",
    klasse: "günstig",
    preis: { in: 0.25, out: 1.5 },
    hinweis: "Sehr schnell und günstig.",
  },
  // — China —
  {
    id: "deepseek/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    vendor: "DeepSeek (China)",
    klasse: "günstig",
    preis: { in: 0.43, out: 0.87 },
    hinweis: "Sehr stark fürs Geld.",
  },
  {
    id: "qwen/qwen3.5-plus-20260420",
    label: "Qwen 3.5 Plus",
    vendor: "Alibaba (China)",
    klasse: "mittel",
    preis: { in: 0.3, out: 1.8 },
    hinweis: "Lange Kontexte, solide.",
  },
  {
    id: "z-ai/glm-5",
    label: "GLM-5",
    vendor: "Zhipu (China)",
    klasse: "mittel",
    preis: { in: 0.6, out: 2.08 },
    hinweis: "Sehr fähig, ausgewogen.",
  },
  {
    id: "moonshotai/kimi-k2.6",
    label: "Kimi K2.6",
    vendor: "Moonshot (China)",
    klasse: "mittel",
    preis: { in: 0.68, out: 3.42 },
    hinweis: "Stark im Schreiben.",
  },
  {
    id: "minimax/minimax-m3",
    label: "MiniMax M3",
    vendor: "MiniMax (China)",
    klasse: "günstig",
    preis: { in: 0.3, out: 1.2 },
    hinweis: "Günstig, sehr lange Kontexte.",
  },
];

/** Default-Modell für die Korrektur. */
export const DEFAULT_KORREKTUR_MODEL = AI_DEFAULTS.strong.id;

export function getKorrekturModel(id: string): KorrekturModel | undefined {
  return KORREKTUR_MODELS.find((m) => m.id === id);
}

// === Modell-Auswahl für die Lernplan-Anpassung ===
// Die Plananpassung ist ein Single-Shot-Call (kein Chat-Verlauf) — Modellwechsel
// ist daher unkritisch. Reasoning-Modelle bekommen den OpenRouter-reasoning-
// Parameter; reasoning_details müssen NICHT weitergereicht werden (keine
// Konversationsfortsetzung).

export interface PlanModel {
  /** OpenRouter-Slug, direkt als `model` an die API. */
  id: string;
  label: string;
  vendor: string;
  /** Kurzcharakterisierung für die Auswahl-UI. */
  hinweis: string;
  /** OpenRouter reasoning-Parameter (nur bei Reasoning-Modellen). */
  reasoning?: { effort: ReasoningEffort };
  /** Max-Output-Tokens — Reasoning braucht Headroom (Denk-Tokens zählen mit). */
  maxTokens?: number;
}

export const PLAN_MODELS: PlanModel[] = [
  { id: AI_DEFAULTS.premium.id, label: AI_DEFAULTS.premium.label, vendor: "Anthropic",
    hinweis: "Standard für die Lernplanung; hoher Denkaufwand, in den KI-Einstellungen anpassbar.",
    reasoning: { effort: "high" }, maxTokens: AI_REQUEST_LIMITS.planning.maxTokens },
  { id: AI_DEFAULTS.strong.id, label: AI_DEFAULTS.strong.label, vendor: "OpenAI",
    hinweis: "Starke Alternative mit maximalem Denkaufwand.", reasoning: { effort: "max" }, maxTokens: 16000 },
  { id: AI_DEFAULTS.cheap.id, label: AI_DEFAULTS.cheap.label, vendor: "DeepSeek",
    hinweis: "Günstige Alternative mit Anbietervorgabe für den Denkaufwand.", maxTokens: 16000 },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", vendor: "Anthropic",
    hinweis: "Bisherige Alternative für ausdrücklich gespeicherte Modellwahlen.", maxTokens: 16000 },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", vendor: "Google",
    hinweis: "Bisherige Alternative für ausdrücklich gespeicherte Modellwahlen.", maxTokens: 16000 },
  { id: "openai/gpt-5.4", label: "GPT-5.4", vendor: "OpenAI",
    hinweis: "Bisherige Alternative für ausdrücklich gespeicherte Modellwahlen.", maxTokens: 16000 },
];

export const DEFAULT_PLAN_MODEL = AI_DEFAULTS.premium.id;

export function getPlanModelInfo(id: string): PlanModel {
  return PLAN_MODELS.find((m) => m.id === id) ?? PLAN_MODELS[0];
}
