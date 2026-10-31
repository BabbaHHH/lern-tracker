import { accountRuntime } from "../auth/runtime";
import { AccountError } from "../auth/security";
import { credentialSecretsFromEnvironment } from "./crypto";
import { AiCredentialService } from "./service";

export async function aiCredentialRuntime(): Promise<AiCredentialService> {
  const auth = await accountRuntime();
  return new AiCredentialService(auth, credentialSecretsFromEnvironment());
}

/** A present account cookie is never allowed to degrade into the local global-key path. */
export function isAccountAiRequest(request: Request): boolean {
  const hasSessionCookie = /(?:^|;)\s*(?:__Secure-)?better-auth\.session_token=/.test(request.headers.get("cookie") ?? "");
  return process.env.STEX_LEARNING_MODE === "account" || hasSessionCookie;
}

/** AI callers predate X-Stex-Action; exact Origin/Host checks still stop cross-site requests. */
export function sameOriginAiRequest(request: Request, baseURL: string): void {
  const expected = new URL(baseURL);
  const url = new URL(request.url);
  if (url.origin !== expected.origin || (request.headers.get("host") && request.headers.get("host") !== expected.host)
    || request.headers.get("origin") !== expected.origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AccountError("invalid_origin", "Bitte die KI-Anfrage innerhalb der Website ausführen.", 403);
  }
}
