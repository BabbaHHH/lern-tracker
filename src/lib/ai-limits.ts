/** Server-owned limits; clients select a purpose rather than an arbitrary timeout. */
export const AI_REQUEST_LIMITS = {
  general: { timeoutMs: 115_000, maxTokens: 16_000 },
  planning: { timeoutMs: 900_000, maxTokens: 50_000 },
} as const;

export type AiRequestPurpose = keyof typeof AI_REQUEST_LIMITS;
