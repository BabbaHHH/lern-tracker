import { NextResponse } from "next/server";
import { AiProviderError, chatCompletion, type AiMessage, type ModelTier, type ChatCompletionOptions } from "@/lib/ai";
import { errorResponse, limitRequests, readJson, requireLocalAccess, RequestError } from "@/lib/server/request-safety";
import { isReasoningPreference, REASONING_EFFORTS } from "@/lib/ai-config";
import { AI_REQUEST_LIMITS, type AiRequestPurpose } from "@/lib/ai-limits";
import { accountFailure, accountResponse } from "@/lib/server/auth/security";
import { aiCredentialRuntime, isAccountAiRequest, sameOriginAiRequest } from "@/lib/server/ai-credentials/runtime";
import { deferredPilotAiResponse } from "@/lib/server/pilot-ai-guard";

// The host must allow the planning timeout plus time to return a controlled error.
export const maxDuration = 915;

export async function POST(req: Request) {
  let accountRequest = false;
  try {
    accountRequest = isAccountAiRequest(req);
    const { messages, tier = "cheap", model, maxTokens, temperature, reasoning, reasoningPreference, purpose = "general" } = await readJson(req);
    if (purpose !== "general" && purpose !== "planning") throw new RequestError("Ungültiger KI-Auftrag.");
    if (purpose === "planning") {
      const deferred = deferredPilotAiResponse("planning");
      if (deferred) return deferred;
    }
    const credentials = accountRequest ? await aiCredentialRuntime() : null;
    if (credentials) sameOriginAiRequest(req, credentials.auth.baseURL);
    else requireLocalAccess(req);
    const limits = AI_REQUEST_LIMITS[purpose];
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100
      || messages.some((m) => !m || !["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string")
      || messages.reduce((n, m) => n + m.content.length, 0) > 250_000) {
      throw new RequestError("Ungültige oder zu lange KI-Nachrichten.");
    }
    if (!["cheap", "strong", "premium"].includes(tier as string)) throw new RequestError("Ungültige Modellstufe.");
    if (model !== undefined && (typeof model !== "string" || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9.:_-]+$/.test(model) || model.length > 160)) {
      throw new RequestError("Ungültiges Modell.");
    }
    if (maxTokens !== undefined && (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > limits.maxTokens)) {
      throw new RequestError(`Die Antwortlänge muss zwischen 1 und ${limits.maxTokens} Tokens liegen.`);
    }
    if (temperature !== undefined && (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
      throw new RequestError("Ungültige Temperatureinstellung.");
    }
    if (reasoning !== undefined && (!reasoning || typeof reasoning !== "object" || !("effort" in reasoning)
      || !REASONING_EFFORTS.some(effort => effort === reasoning.effort))) throw new RequestError("Ungültige Reasoning-Einstellung.");
    if (reasoningPreference !== undefined && !isReasoningPreference(reasoningPreference)) throw new RequestError("Ungültige Reasoning-Einstellung.");
    limitRequests("ai", 20);
    const access = credentials ? await credentials.resolveSelected(req.headers) : null;
    const reply = await chatCompletion(messages as AiMessage[], tier as ModelTier, {
      ...(access ? { apiKey: access.apiKey, credentialSource: access.source } : {}),
      purpose: purpose as AiRequestPurpose,
      model: model as string | undefined,
      maxTokens: maxTokens as number | undefined,
      temperature: temperature as number | undefined,
      reasoning: reasoning as ChatCompletionOptions["reasoning"],
      reasoningPreference: reasoningPreference as ChatCompletionOptions["reasoningPreference"],
      signal: req.signal,
    });
    if (access && credentials) await credentials.assertAccessCurrent(access);
    return credentials ? accountResponse({ contractVersion: 1, reply }) : NextResponse.json({ reply }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (accountRequest) {
      if (error instanceof AiProviderError) return accountResponse({ contractVersion: 1, error: { code: error.code, message: error.message } }, error.status);
      if (error instanceof RequestError) return accountResponse({ contractVersion: 1, error: { code: "invalid_request", message: error.message } }, error.status);
      return accountFailure(error);
    }
    if (error instanceof Error && error.name === "TimeoutError") {
      return errorResponse(new RequestError("Die KI hat das Zeitlimit erreicht und noch keine vollständige Antwort geliefert.", 504));
    }
    return errorResponse(error);
  }
}
