import { errorResponse, requireLocalAccess } from "@/lib/server/request-safety";
import { NextResponse } from "next/server";
import { aiCredentialRuntime, isAccountAiRequest } from "@/lib/server/ai-credentials/runtime";
import { accountFailure, accountResponse, sameOrigin } from "@/lib/server/auth/security";
import { accountRuntime } from "@/lib/server/auth/runtime";

type KeyData = {
  label?: string;
  usage?: number;
  limit?: number | null;
  is_free_tier?: boolean;
  rate_limit?: { requests: number; interval: string };
  error?: string;
};

async function fetchKeyData(key: string): Promise<KeyData> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { error: `OpenRouter ${res.status}` };
    const json = await res.json() as { data?: KeyData };
    return json.data ?? {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function legacyStatus(req: Request) {
  requireLocalAccess(req);
  const strongKey = process.env.OPENROUTER_API_KEY_STRONG || process.env.OPENROUTER_API_KEY;
  const cheapKey = process.env.OPENROUTER_API_KEY_CHEAP || process.env.OPENROUTER_API_KEY;
  const testKey = process.env.OPENROUTER_API_KEY_TEST;
  const [strong, cheap, test] = await Promise.all([
    strongKey ? fetchKeyData(strongKey) : Promise.resolve(null),
    cheapKey ? fetchKeyData(cheapKey) : Promise.resolve(null),
    testKey ? fetchKeyData(testKey) : Promise.resolve(null),
  ]);
  return { strong, cheap, test, configured: !!(strongKey || cheapKey || testKey) };
}

export async function GET(req: Request) {
  if (isAccountAiRequest(req)) {
    try {
      const auth = await accountRuntime();
      sameOrigin(req, auth.baseURL);
      const principal = await auth.principal(req.headers, "active");
      const credentials = await aiCredentialRuntime();
      const personal = await credentials.ownerStatus(req.headers);
      if (principal.role !== "admin") return accountResponse(personal);
      const global = await legacyStatus(req);
      return accountResponse({ ...global, ...personal });
    } catch (error) {
      return accountFailure(error);
    }
  }
  try {
    const global = await legacyStatus(req);
    if (!global.configured) return NextResponse.json({ error: "Kein API-Key konfiguriert" }, { status: 500 });
    const data = { strong: global.strong, cheap: global.cheap, test: global.test };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
