export const FEEDBACK_CATEGORIES = { bug: "Fehler", idea: "Verbesserung", question: "Frage" } as const;
export interface AppFeedback { id: string; category: keyof typeof FEEDBACK_CATEGORIES; text: string; page: string; name?: string; createdAt: string; version: string }
export function validateFeedback(value: unknown): AppFeedback | null {
  if (!value || typeof value !== "object") return null;
  const item = value as AppFeedback;
  if (typeof item.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id) || !Object.hasOwn(FEEDBACK_CATEGORIES, item.category)
    || typeof item.text !== "string" || item.text.trim().length < 5 || item.text.length > 4000
    || typeof item.page !== "string" || !/^\/[\w/.-]*$/.test(item.page) || item.page.length > 200
    || (item.name !== undefined && (typeof item.name !== "string" || item.name.length > 80))
    || typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) || item.createdAt.length > 40
    || typeof item.version !== "string" || item.version.length > 50) return null;
  return { id: item.id, category: item.category, text: item.text.trim(), page: item.page, name: item.name?.trim() || undefined, createdAt: item.createdAt, version: item.version };
}
