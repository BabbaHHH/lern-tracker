import { AI_DEFAULTS, defaultReasoning, type ModelTier, type ReasoningPreference, type ReasoningEffort, type ReasoningSettings } from "./ai-config";
import { getAiReasoningSettings } from "./store";

export function withAiPreferences<T extends { tier?: ModelTier; model?: string; reasoning?: { effort: ReasoningEffort }; reasoningPreference?: ReasoningPreference }>(
  body: T, settings: ReasoningSettings = getAiReasoningSettings(),
) {
  const model = body.model ?? AI_DEFAULTS[body.tier ?? "cheap"].id;
  return {
    ...body,
    reasoningPreference: body.reasoningPreference ?? settings[model] ?? body.reasoning?.effort ?? defaultReasoning(model),
  };
}

/** Reads the saved preference for every request, including an already open editor. */
export function fetchAi(init: RequestInit): Promise<Response> {
  return fetch("/api/ai", { ...init, body: JSON.stringify(withAiPreferences(JSON.parse(init.body as string))) });
}
