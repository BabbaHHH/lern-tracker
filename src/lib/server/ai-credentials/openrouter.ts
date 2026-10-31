import type { CredentialSource } from "./crypto";

export interface OpenRouterKeyStatus {
  limit: number | null;
  limitRemaining: number | null;
  limitReset: string | null;
  isFreeTier: boolean;
}

export type OpenRouterCredentialErrorCode = "provider_key_invalid" | "provider_busy" | "provider_unavailable";
export class OpenRouterCredentialError extends Error {
  constructor(public readonly code: OpenRouterCredentialErrorCode, message: string, public readonly status: number) {
    super(message);
  }
}

function asNullableNumber(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  throw new OpenRouterCredentialError("provider_unavailable", "OpenRouter hat einen unvollständigen Schlüsselstatus geliefert.", 502);
}

/** Reads the provider's current-key endpoint. Provider response bodies never leave this module. */
export async function getOpenRouterKeyStatus(apiKey: string, fetcher: typeof fetch = fetch): Promise<OpenRouterKeyStatus> {
  let response: Response;
  try {
    response = await fetcher("https://openrouter.ai/api/v1/key", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new OpenRouterCredentialError("provider_unavailable", "Der OpenRouter-Status ist gerade nicht erreichbar.", 503);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new OpenRouterCredentialError("provider_key_invalid", "Der OpenRouter-Schlüssel ist ungültig oder nicht freigegeben.", response.status);
    }
    if (response.status === 429) throw new OpenRouterCredentialError("provider_busy", "OpenRouter kann den Schlüsselstatus gerade nicht abrufen. Bitte später erneut versuchen.", 429);
    throw new OpenRouterCredentialError("provider_unavailable", "Der OpenRouter-Status ist gerade nicht verfügbar.", 503);
  }
  let data: unknown;
  try { data = (await response.json() as { data?: unknown }).data; }
  catch { throw new OpenRouterCredentialError("provider_unavailable", "OpenRouter hat einen ungültigen Schlüsselstatus geliefert.", 502); }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new OpenRouterCredentialError("provider_unavailable", "OpenRouter hat einen ungültigen Schlüsselstatus geliefert.", 502);
  }
  const info = data as Record<string, unknown>;
  if (info.is_management_key !== false || info.is_provisioning_key !== false) {
    throw new OpenRouterCredentialError("provider_key_invalid", "Dieser Schlüsseltyp ist für KI-Aufrufe nicht freigegeben.", 400);
  }
  if (!(info.limit_reset === null || typeof info.limit_reset === "string")
    || !(typeof info.is_free_tier === "boolean")) {
    throw new OpenRouterCredentialError("provider_unavailable", "OpenRouter hat einen unvollständigen Schlüsselstatus geliefert.", 502);
  }
  return {
    limit: asNullableNumber(info.limit),
    limitRemaining: asNullableNumber(info.limit_remaining),
    limitReset: info.limit_reset,
    isFreeTier: info.is_free_tier,
  };
}

export function validatePilotLimit(status: OpenRouterKeyStatus): void {
  if (status.limit === null || status.limit <= 0 || status.limitReset !== null) {
    throw new OpenRouterCredentialError("provider_key_invalid", "Der Pilot-Schlüssel benötigt ein endliches Limit ohne Reset.", 400);
  }
}

export function maskOpenRouterKey(apiKey: string): string {
  return `••••${apiKey.slice(-4)}`;
}

export function mapProviderFailure(status: number, body: string, source: CredentialSource): { code: string; message: string; status: number } {
  let limitSource: unknown;
  try {
    const parsed = JSON.parse(body) as { error?: { metadata?: { limit_source?: unknown } } };
    limitSource = parsed?.error?.metadata?.limit_source;
  } catch { /* Raw provider text is never returned. */ }
  if (status === 402 && limitSource === "openrouter_key_limit") {
    return source === "pilot"
      ? { code: "pilot_limit_exhausted", message: "Dein einmaliger KI-Startzugang ist aufgebraucht. Unter /konto/ki kannst du deinen eigenen OpenRouter-Schlüssel einfügen und ausdrücklich auswählen.", status: 402 }
      : { code: "own_limit_exhausted", message: "Das Limit deines eigenen OpenRouter-Zugangs ist erreicht. Prüfe dein OpenRouter-Konto oder passe dort dein Limit an.", status: 402 };
  }
  if (status === 402) return source === "pilot"
    ? { code: "pilot_provider_payment_required", message: "Der KI-Anbieter hat die Anfrage wegen Guthaben oder Limit abgelehnt. Bitte wende dich an die Kontoverwaltung.", status: 402 }
    : { code: "own_provider_payment_required", message: "OpenRouter hat die Anfrage wegen Guthaben oder Limit abgelehnt. Prüfe dein eigenes OpenRouter-Konto.", status: 402 };
  if (status === 401 || status === 403) return source === "pilot"
    ? { code: "pilot_key_invalid", message: "Dein KI-Startzugang ist ungültig oder nicht freigegeben. Bitte wende dich an die Kontoverwaltung.", status }
    : { code: "own_key_invalid", message: "Dein OpenRouter-Schlüssel ist ungültig oder nicht freigegeben. Prüfe ihn in deinem OpenRouter-Konto oder füge unter /konto/ki einen gültigen Schlüssel ein.", status };
  if (status === 429) return { code: "provider_rate_limited", message: "OpenRouter ist gerade überlastet. Bitte kurz warten und dann bewusst erneut versuchen.", status };
  return { code: "provider_unavailable", message: "Der KI-Anbieter ist momentan nicht verfügbar. Bitte später erneut versuchen.", status: 502 };
}
