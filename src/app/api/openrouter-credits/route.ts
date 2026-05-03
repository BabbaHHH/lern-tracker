import { NextResponse } from "next/server";

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
    });
    if (!res.ok) return { error: `OpenRouter ${res.status}` };
    const json = await res.json() as { data?: KeyData };
    return json.data ?? {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function GET() {
  const strongKey = process.env.OPENROUTER_API_KEY_STRONG;
  const cheapKey = process.env.OPENROUTER_API_KEY_CHEAP;

  if (!strongKey && !cheapKey) {
    return NextResponse.json({ error: "Kein API-Key konfiguriert" }, { status: 500 });
  }

  const [strong, cheap] = await Promise.all([
    strongKey ? fetchKeyData(strongKey) : Promise.resolve(null),
    cheapKey ? fetchKeyData(cheapKey) : Promise.resolve(null),
  ]);

  return NextResponse.json({ strong, cheap });
}
