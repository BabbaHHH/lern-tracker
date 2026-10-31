import { AccountError, accountFailure, accountResponse, exactFields, sameOrigin } from "@/lib/server/auth/security";
import { aiCredentialRuntime } from "@/lib/server/ai-credentials/runtime";
import type { AiCredentialActorContext, AiCredentialRequestOptions, AiCredentialSelection } from "@/lib/ai-credentials/contract";
import { readJson, RequestError } from "@/lib/server/request-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new AccountError("invalid_input", "Ungültige Vorgangskennung.");
  return value;
}
function revision(value: unknown, nullable: boolean): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new AccountError("invalid_input", "Ungültiger Datenstand.");
  return value;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function actorContext(value: unknown): AiCredentialActorContext {
  if (!object(value)) throw new AccountError("invalid_input", "Der angezeigte Kontostand fehlt.");
  exactFields(value, ["accountId", "accessGeneration", "sessionContext"]);
  if (typeof value.accountId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.accountId)
    || typeof value.accessGeneration !== "number" || !Number.isSafeInteger(value.accessGeneration) || value.accessGeneration < 1
    || typeof value.sessionContext !== "string" || !/^[0-9a-f]{64}$/.test(value.sessionContext)) {
    throw new AccountError("invalid_input", "Der angezeigte Kontostand ist ungültig.");
  }
  return value as unknown as AiCredentialActorContext;
}
function options(body: Record<string, unknown>, nullable: boolean): AiCredentialRequestOptions {
  return {
    requestId: requestId(body.requestId),
    expectedRevision: revision(body.expectedRevision, nullable),
    expectedActorContext: actorContext(body.expectedActorContext),
  };
}
function failure(error: unknown): Response {
  if (error instanceof RequestError) return accountResponse({ contractVersion: 1, error: { code: "invalid_input", message: error.message } }, error.status);
  return accountFailure(error);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const service = await aiCredentialRuntime();
    sameOrigin(request, service.auth.baseURL);
    if (new URL(request.url).searchParams.get("contextOnly") === "1") return accountResponse(await service.ownerContext(request.headers));
    return accountResponse(await service.ownerStatus(request.headers));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const service = await aiCredentialRuntime();
    sameOrigin(request, service.auth.baseURL);
    const body = await readJson(request, 2_000);
    if (body.action === "set-own") {
      exactFields(body, ["action", "apiKey", "requestId", "expectedRevision", "expectedActorContext"]);
      if (typeof body.apiKey !== "string") throw new AccountError("invalid_input", "Bitte einen OpenRouter-Schlüssel einfügen.");
      const result = await service.setOwn(request.headers, body.apiKey, options(body, true));
      return accountResponse(result, 201);
    }
    if (body.action === "remove-own") {
      exactFields(body, ["action", "requestId", "expectedRevision", "expectedActorContext"]);
      const result = await service.removeOwn(request.headers, options(body, false));
      return accountResponse(result);
    }
    if (body.action === "select") {
      exactFields(body, ["action", "source", "requestId", "expectedRevision", "expectedActorContext"]);
      if (body.source !== "off" && body.source !== "pilot" && body.source !== "own") throw new AccountError("invalid_input", "Ungültige KI-Auswahl.");
      const result = await service.select(request.headers, body.source as AiCredentialSelection, options(body, false));
      return accountResponse(result);
    }
    throw new AccountError("invalid_input", "Unbekannte KI-Zugangsaktion.");
  } catch (error) {
    return failure(error);
  }
}
