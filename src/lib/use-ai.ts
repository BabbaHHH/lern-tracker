"use client";

// Zentraler Wrapper für /api/ai-Calls.
// - callAi(): pure async Funktion (auch in nicht-React-Code nutzbar)
// - useAi(): React Hook mit loading/error State + Auto-Abort beim Unmount
//
// Vorher: 11 Call-Sites mit jeweils Loading-State, Fetch, JSON-Parse,
// Error-Mapping kopiert. Eine zentrale Stelle = einheitliches Verhalten.

import { fetchAi } from "@/lib/ai-settings";
import { useState, useCallback, useRef, useEffect } from "react";
import { getPromptById } from "@/lib/prompts";
import { buildContextFor } from "@/lib/prompt-context";
import { parseAiJson } from "@/lib/ai-helpers";
import type { ReasoningEffort } from "./ai-config";
import type { AiMessage, ModelTier } from "@/lib/ai";
import type { ContextFlag } from "@/lib/prompts";

/** Reasoning calls need more time; the server retains its own bounded timeout. */
const DEFAULT_TIMEOUT_MS = 120_000;

export interface AiCallOptions {
  /**
   * User-Message. Wird mit dem aus contextFlags gebauten Context zusammengeführt.
   * Wenn nicht gesetzt UND keine customMessages → wird nur der Context geschickt.
   */
  userMessage?: string;
  /**
   * Komplett eigenes Message-Array — überschreibt prompt+context+userMessage.
   * Für Chat-Verläufe oder Spezialfälle.
   */
  customMessages?: AiMessage[];
  /** Override der ContextFlags des Prompts. */
  contextFlags?: ContextFlag[];
  /** Override des ModelTiers. */
  tier?: ModelTier;
  /** Expliziter OpenRouter-Slug — überschreibt das Tier-Modell. */
  model?: string;
  /** Max. Output-Tokens (überschreibt Tier-Default). */
  maxTokens?: number;
  /** Sampling-Temperatur (überschreibt Tier-Default). */
  temperature?: number;
  /** OpenRouter reasoning-Parameter (nur bei Reasoning-Modellen). */
  reasoning?: { effort: ReasoningEffort };
  /** Externes AbortSignal — wird mit dem internen Timeout-Signal kombiniert. */
  signal?: AbortSignal;
  /** Timeout in ms (Default: 60s). */
  timeoutMs?: number;
}

export interface AiCallResult {
  reply: string;
  tier: ModelTier;
}

/**
 * Low-level: macht den HTTP-Call zu /api/ai.
 * - Baut Messages aus promptId + Context (oder customMessages)
 * - Timeout via AbortController
 * - Wirft strukturierte Errors
 */
export async function callAi(
  promptId: string | null,
  opts: AiCallOptions = {},
): Promise<AiCallResult> {
  const sys = promptId ? getPromptById(promptId) : null;
  const tier: ModelTier = opts.tier ?? sys?.modelTier ?? "cheap";

  let messages: AiMessage[];
  if (opts.customMessages) {
    messages = opts.customMessages;
  } else {
    const flags = opts.contextFlags ?? sys?.contextFlags ?? [];
    const context = buildContextFor(flags);
    const userMsg = opts.userMessage
      ? (context ? `${context}\n\n${opts.userMessage}` : opts.userMessage)
      : context;
    messages = [
      { role: "system", content: sys?.prompt ?? "" },
      { role: "user", content: userMsg },
    ];
  }

  // Timeout-Controller, ggf. mit externem Signal kombiniert
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (opts.signal?.aborted) controller.abort();
  else opts.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const res = await fetchAi({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, messages, model: opts.model, maxTokens: opts.maxTokens, temperature: opts.temperature, reasoning: opts.reasoning }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({ error: "Antwort konnte nicht gelesen werden" }));
    const errorMessage = typeof data.error === "object" && data.error ? data.error.message : data.error;
    if (!res.ok || errorMessage) throw new Error(typeof errorMessage === "string" ? errorMessage : `KI-Anfrage fehlgeschlagen (${res.status})`);

    return { reply: (data.reply as string) ?? "", tier };
  } catch (e) {
    const err = e as Error;
    if (err.name === "AbortError") {
      throw new Error(`KI-Anfrage abgebrochen oder Timeout nach ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * React Hook für KI-Calls mit verwaltetem loading/error State.
 *
 * - Beim Unmount: in-flight Call wird abgebrochen (kein React-State-Leak)
 * - Bei neuem call(): bisheriger in-flight Call wird abgebrochen
 * - callJson<T>(): Convenience für JSON-Antworten
 *
 * @param promptId Prompt-ID aus prompts.ts (oder null wenn customMessages)
 */
export function useAi(promptId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const call = useCallback(async (opts: AiCallOptions = {}): Promise<AiCallResult | null> => {
    abortRef.current?.abort();
    const requestController = new AbortController();
    abortRef.current = requestController;

    setLoading(true);
    setError(null);

    try {
      const result = await callAi(promptId, { ...opts, signal: requestController.signal });
      if (!mountedRef.current || abortRef.current !== requestController || requestController.signal.aborted) return null;
      setLoading(false);
      return result;
    } catch (e) {
      const msg = (e as Error).message;
      if (!mountedRef.current || abortRef.current !== requestController || requestController.signal.aborted) return null;
      // Wenn der Call durch einen neuen Call ersetzt wurde → keine Fehlermeldung
      if (msg.includes("abgebrochen") && !msg.includes("Timeout")) {
        return null;
      }
      setError(msg || "KI gerade nicht erreichbar");
      setLoading(false);
      return null;
    }
  }, [promptId]);

  /** Wie call(), aber parst die Antwort als JSON und liefert T | null. */
  const callJson = useCallback(async <T>(opts: AiCallOptions = {}): Promise<T | null> => {
    const result = await call(opts);
    if (!result) return null;
    const parsed = parseAiJson<T>(result.reply);
    if (parsed.error || !parsed.data) {
      if (mountedRef.current) setError(parsed.error || "KI-Antwort konnte nicht gelesen werden");
      return null;
    }
    return parsed.data;
  }, [call]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setError(null);
    setLoading(false);
  }, []);

  return { call, callJson, loading, error, reset };
}
