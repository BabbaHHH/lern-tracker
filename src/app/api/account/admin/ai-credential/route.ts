import { AccountError, accountFailure, accountResponse, exactFields, sameOrigin } from "@/lib/server/auth/security";
import { aiCredentialRuntime } from "@/lib/server/ai-credentials/runtime";
import type { AiCredentialActorContext, AiCredentialRequestOptions, AiCredentialTargetContext } from "@/lib/ai-credentials/contract";
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
  if (!object(value)) throw new AccountError("invalid_input", "Der angezeigte Verwaltungskontext fehlt.");
  exactFields(value, ["accountId", "accessGeneration", "sessionContext"]);
  if (typeof value.accountId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.accountId)
    || typeof value.accessGeneration !== "number" || !Number.isSafeInteger(value.accessGeneration) || value.accessGeneration < 1
    || typeof value.sessionContext !== "string" || !/^[0-9a-f]{64}$/.test(value.sessionContext)) {
    throw new AccountError("invalid_input", "Der angezeigte Verwaltungskontext ist ungültig.");
  }
  return value as unknown as AiCredentialActorContext;
}
function targetContext(value: unknown, targetUserId: string): AiCredentialTargetContext {
  if (!object(value)) throw new AccountError("invalid_input", "Der bestätigte Mitgliederkontext fehlt.");
  exactFields(value, ["accountId", "accessGeneration"]);
  if (value.accountId !== targetUserId || typeof value.accessGeneration !== "number"
    || !Number.isSafeInteger(value.accessGeneration) || value.accessGeneration < 1) {
    throw new AccountError("invalid_input", "Der bestätigte Mitgliederkontext ist ungültig.");
  }
  return value as unknown as AiCredentialTargetContext;
}
function options(body: Record<string, unknown>, targetUserId: string, nullable: boolean): AiCredentialRequestOptions {
  return {
    requestId: requestId(body.requestId),
    expectedRevision: revision(body.expectedRevision, nullable),
    expectedActorContext: actorContext(body.expectedActorContext),
    expectedTargetContext: targetContext(body.expectedTargetContext, targetUserId),
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
    const userId = new URL(request.url).searchParams.get("userId") ?? "";
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(userId)) throw new AccountError("invalid_input", "Bitte ein aktives Mitglied auswählen.");
    return accountResponse(await service.adminPilotStatus(request.headers, userId));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const service = await aiCredentialRuntime();
    sameOrigin(request, service.auth.baseURL);
    const body = await readJson(request, 2_000);
    if (body.action !== "set-pilot" && body.action !== "remove-pilot") throw new AccountError("invalid_input", "Unbekannte Pilotaktion.");
    if (typeof body.targetUserId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.targetUserId)) throw new AccountError("invalid_input", "Bitte ein aktives Mitglied auswählen.");
    if (body.action === "set-pilot") {
      exactFields(body, ["action", "targetUserId", "apiKey", "requestId", "expectedRevision", "expectedActorContext", "expectedTargetContext"]);
      if (typeof body.apiKey !== "string") throw new AccountError("invalid_input", "Bitte einen OpenRouter-Pilot-Schlüssel einfügen.");
      const result = await service.setPilot(request.headers, body.targetUserId, body.apiKey, options(body, body.targetUserId, true));
      return accountResponse(result, 201);
    }
    exactFields(body, ["action", "targetUserId", "requestId", "expectedRevision", "expectedActorContext", "expectedTargetContext"]);
    const result = await service.removePilot(request.headers, body.targetUserId, options(body, body.targetUserId, false));
    return accountResponse(result);
  } catch (error) {
    return failure(error);
  }
}
