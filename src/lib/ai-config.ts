// OpenRouter model pages and reasoning guide checked on 2026-10-10.
export type ModelTier = "premium" | "strong" | "cheap";
export const REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;
export type ReasoningEffort = typeof REASONING_EFFORTS[number];
export type ReasoningPreference = ReasoningEffort | "provider";
export type ReasoningSettings = Partial<Record<string, ReasoningPreference>>;

export const AI_DEFAULTS = {
  premium: { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5", effort: "high" },
  strong: { id: "openai/gpt-6-luna", label: "GPT-6 Luna", effort: "max" },
  cheap: { id: "deepseek/deepseek-v4-flash-0731", label: "DeepSeek V4 Flash 0731", effort: "provider" },
} as const;

export const MODEL_REASONING: Record<string, readonly ReasoningEffort[]> = {
  [AI_DEFAULTS.premium.id]: ["low", "medium", "high", "xhigh", "max"],
  [AI_DEFAULTS.strong.id]: ["none", "low", "medium", "high", "xhigh", "max"],
  // V4's reasoning modes: high and xhigh (maximum); do not offer medium/low.
  [AI_DEFAULTS.cheap.id]: ["high", "xhigh"],
};

export function isReasoningPreference(value: unknown): value is ReasoningPreference {
  return value === "provider" || REASONING_EFFORTS.some(effort => effort === value);
}

export function supportsReasoning(model: string, value: ReasoningPreference): boolean {
  return value === "provider" || !MODEL_REASONING[model] || MODEL_REASONING[model].includes(value);
}

export function defaultReasoning(model: string): ReasoningPreference | undefined {
  return Object.values(AI_DEFAULTS).find(entry => entry.id === model)?.effort;
}

export function normalizeReasoningSettings(value: unknown): ReasoningSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([model, effort]) =>
    Object.hasOwn(MODEL_REASONING, model) && isReasoningPreference(effort) && supportsReasoning(model, effort)));
}

export function resolveReasoning(model: string, preference?: ReasoningPreference, legacy?: { effort: ReasoningEffort }) {
  const effort = preference ?? legacy?.effort ?? defaultReasoning(model);
  if (effort && !supportsReasoning(model, effort)) throw new Error("Diese Reasoning-Stufe wird für das Modell nicht unterstützt.");
  return !effort || effort === "provider" ? undefined : { effort };
}
