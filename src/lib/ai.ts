import { RequestError } from "./server/request-safety";
import { setTimeout as delay } from "node:timers/promises";
import { AI_DEFAULTS, MODEL_REASONING, resolveReasoning, type ModelTier, type ReasoningEffort, type ReasoningPreference } from "./ai-config";
import { AI_REQUEST_LIMITS, type AiRequestPurpose } from "./ai-limits";
import { mapProviderFailure } from "./server/ai-credentials/openrouter";
import type { CredentialSource } from "./server/ai-credentials/crypto";

// OpenRouter API Client — Server-side only

export type { ModelTier } from "./ai-config";

function getModel(tier: ModelTier): string {
  if (tier === "premium") {
    return process.env.OPENROUTER_MODEL_PREMIUM || AI_DEFAULTS.premium.id;
  }
  if (tier === "strong") {
    return process.env.OPENROUTER_MODEL_STRONG || AI_DEFAULTS.strong.id;
  }
  return process.env.OPENROUTER_MODEL_CHEAP || AI_DEFAULTS.cheap.id;
}

function getApiKey(tier: ModelTier): string {
  // Premium nutzt den strong key (gleicher Key, teureres Modell)
  if (tier === "premium" || tier === "strong") {
    return process.env.OPENROUTER_API_KEY_STRONG || process.env.OPENROUTER_API_KEY || "";
  }
  return process.env.OPENROUTER_API_KEY_CHEAP || process.env.OPENROUTER_API_KEY || "";
}

/**
 * Key für die Klausur-Korrektur (Schreiben-Feature, Calls mit explizitem Modell).
 * Erlaubt einen separaten Test-/Budget-Key, ohne den allgemeinen Strong-Key zu
 * belasten. Fallback-Kette: TEST → STRONG → Haupt-Key.
 * In .env.local setzbar als OPENROUTER_API_KEY_TEST.
 */
function getKorrekturKey(): string {
  return (
    process.env.OPENROUTER_API_KEY_TEST ||
    process.env.OPENROUTER_API_KEY_STRONG ||
    process.env.OPENROUTER_API_KEY ||
    ""
  );
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  signal?: AbortSignal;
  /** Personal credential explicitly resolved by an authenticated account route. */
  apiKey?: string;
  credentialSource?: CredentialSource;
  purpose?: AiRequestPurpose;
  /** Expliziter OpenRouter-Slug — überschreibt getModel(tier). */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** OpenRouter reasoning-Parameter für Reasoning-Modelle (z.B. Claude Fable).
   *  Bei gesetztem reasoning wird KEINE temperature mitgeschickt —
   *  Anthropic-Reasoning verlangt Default-Sampling. */
  reasoning?: { effort: ReasoningEffort };
  reasoningPreference?: ReasoningPreference;
}

export class AiProviderError extends RequestError {
  constructor(public readonly code: string, message: string, status: number) { super(message, status); }
}

/** Kurze Wartezeit (ms), bis zu der ein 429 automatisch *einmal* wiederholt wird. */
const AUTO_RETRY_MAX_WAIT_MS = 12_000;

/**
 * Übersetzt OpenRouter-Fehlerbodies in *handlungsleitende* deutsche Meldungen.
 * Free-Modelle produzieren typische, aber kryptische Fehler — hier auf Klartext
 * gemappt, damit der Nutzer weiß, was zu tun ist (warten vs. anderes Modell vs.
 * Datenschutz-Policy anpassen).
 */
function explainOpenRouterError(status: number, body: string, model: string): string {
  let parsed: { error?: { message?: string; metadata?: { raw?: string; retry_after_seconds?: number } } } | null = null;
  try { parsed = JSON.parse(body); } catch { /* kein JSON → Rohtext unten */ }
  const err = parsed?.error ?? {};
  const raw = err.metadata?.raw ?? "";
  const msg = err.message ?? "";
  const hay = `${raw} ${msg}`.toLowerCase();

  // Guardrail / Daten-Policy: das Modell erlaubt nur Anbieter, die deine
  // OpenRouter-Privacy-Einstellung gerade blockt. Nur vom Nutzer lösbar.
  if (hay.includes("guardrail") || hay.includes("data policy") || hay.includes("data-policy") || hay.includes("settings/privacy")) {
    return `Das Modell „${model}" ist mit deinen OpenRouter-Datenschutz-Einstellungen nicht nutzbar `
      + `(es verlangt eine andere Daten-Policy). Lösung: unter openrouter.ai/settings/privacy die Policy `
      + `anpassen — oder einfach ein anderes Modell wählen.`;
  }
  // Rate-Limit: Free-Pool gerade überlastet (upstream über alle Nutzer geteilt).
  if (status === 429 || hay.includes("rate-limit") || hay.includes("rate limit") || hay.includes("rate-limited")) {
    const secs = err.metadata?.retry_after_seconds;
    const wait = typeof secs === "number" && secs > 0 ? ` (ca. ${Math.ceil(secs)}s)` : "";
    return `Free-Modell „${model}" ist gerade überlastet${wait}. Kurz warten und erneut prüfen — `
      + `oder ein anderes (z. B. kostenpflichtiges) Modell wählen.`;
  }
  // Modell nicht gefunden / ungültiger Request.
  if (status === 404 || status === 400) {
    return `Modell „${model}" nicht verfügbar oder Anfrage nicht unterstützt.`;
  }
  if (status === 402) return "Das KI-Guthaben ist aufgebraucht.";
  if (status === 401 || status === 403) return "Der KI-Zugang wurde vom Anbieter abgelehnt.";
  return `Der KI-Anbieter ist momentan nicht verfügbar (Status ${status}).`;
}

export async function chatCompletion(
  messages: AiMessage[],
  tier: ModelTier = "cheap",
  opts: ChatCompletionOptions = {},
): Promise<string> {
  // Bei explizitem Modell (= Klausur-Korrektur) den dedizierten Korrektur-Key
  // nutzen (TEST → STRONG → Haupt). Modellwahl ist entkoppelt vom Tier-Schema.
  const apiKey = opts.apiKey ?? (opts.model ? getKorrekturKey() : getApiKey(tier));
  if (!apiKey || apiKey.includes("DEIN_KEY")) {
    throw new RequestError("Der KI-Zugang ist noch nicht eingerichtet.", 503);
  }

  const model = opts.model || getModel(tier);
  let reasoning;
  try { reasoning = resolveReasoning(model, opts.reasoningPreference, opts.reasoning); }
  catch (error) { throw new RequestError((error as Error).message); }
  const limits = AI_REQUEST_LIMITS[opts.purpose ?? "general"];
  const maxTokens = opts.maxTokens ?? (opts.purpose === "planning" ? limits.maxTokens : MODEL_REASONING[model] || reasoning ? 16000 : tier === "premium" ? 16000 : tier === "strong" ? 4096 : 2048);
  const temperature = opts.temperature ?? (tier === "premium" ? 0.4 : 0.7);

  const signal = AbortSignal.any([AbortSignal.timeout(limits.timeoutMs), ...(opts.signal ? [opts.signal] : [])]);
  const body = JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    // Reasoning-Modelle: reasoning-Parameter rein, temperature raus
    // (Anthropic-Reasoning akzeptiert nur Default-Sampling).
    ...(reasoning
      ? { reasoning, provider: { require_parameters: true } }
      : MODEL_REASONING[model] ? {} : { temperature }),
  });
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://lern-tracker.vercel.app",
    "X-Title": "Stex Tracker",
  };

  // Bei 429 (Free-Pool überlastet) genau EINMAL automatisch nachfassen, sofern
  // die vom Provider angegebene Wartezeit kurz genug ist (sonst lieber klare
  // Meldung als minutenlanges Hängen).
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body,
        signal,
      });
    } catch (error) {
      if (opts.credentialSource) {
        throw new AiProviderError("provider_uncertain", "Der Aufruf wurde abgebrochen oder hat das Zeitlimit erreicht. Der Anbieterstatus kann unklar sein und die Anfrage könnte deinem ausgewählten OpenRouter-Konto belastet worden sein. Bitte prüfe den Status, bevor du bewusst erneut versuchst.", 504);
      }
      throw error;
    }
    if (response.ok) break;
    if (response.status === 429 && attempt === 0) {
      const ra = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 4000;
      if (waitMs <= AUTO_RETRY_MAX_WAIT_MS) {
        await response.body?.cancel();
        await delay(waitMs, undefined, { signal });
        continue; // zweiter (und letzter) Versuch
      }
    }
    break; // nicht-429 oder Wartezeit zu lang → Fehler unten aufbereiten
  }

  if (!response || !response.ok) {
    const errBody = response ? await response.text() : "";
    if (opts.credentialSource) {
      const mapped = mapProviderFailure(response?.status ?? 0, errBody, opts.credentialSource);
      throw new AiProviderError(mapped.code, mapped.message, mapped.status);
    }
    throw new RequestError(explainOpenRouterError(response?.status ?? 0, errBody, model), 502);
  }

  let data: { choices?: { finish_reason?: string; message?: { content?: unknown } }[] };
  try { data = await response.json(); }
  catch {
    if (opts.credentialSource) throw new AiProviderError("provider_uncertain", "OpenRouter hat die Anfrage angenommen, aber keine lesbare Antwort geliefert. Bitte prüfe den Anbieterstatus, bevor du bewusst erneut versuchst.", 502);
    throw new RequestError("Die KI-Antwort konnte nicht gelesen werden. Bitte erneut versuchen.", 502);
  }
  if (data.choices?.[0]?.finish_reason === "length") throw new RequestError("Die KI-Antwort wurde wegen der Token-Grenze abgeschnitten. Bitte den Denkaufwand reduzieren oder den Auftrag verkleinern.", 502);
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new RequestError("Das Modell hat keine Textantwort geliefert. Bitte erneut versuchen.", 502);
  return reply;
}
