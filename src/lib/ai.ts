// OpenRouter API Client — Server-side only

export type ModelTier = "strong" | "cheap";

function getModel(tier: ModelTier): string {
  if (tier === "strong") {
    return process.env.OPENROUTER_MODEL_STRONG || "anthropic/claude-sonnet-4";
  }
  return process.env.OPENROUTER_MODEL_CHEAP || "anthropic/claude-haiku-4";
}

function getApiKey(tier: ModelTier): string {
  if (tier === "strong") {
    return process.env.OPENROUTER_API_KEY_STRONG || process.env.OPENROUTER_API_KEY || "";
  }
  return process.env.OPENROUTER_API_KEY_CHEAP || process.env.OPENROUTER_API_KEY || "";
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatCompletion(
  messages: AiMessage[],
  tier: ModelTier = "cheap",
): Promise<string> {
  const apiKey = getApiKey(tier);
  if (!apiKey || apiKey.includes("DEIN_KEY")) {
    throw new Error("OpenRouter API Key nicht konfiguriert. Bitte in .env.local setzen.");
  }

  const model = getModel(tier);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://lern-tracker.vercel.app",
      "X-Title": "Lern-Tracker Staatsexamen",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // Bei Model-Fehler: hilfreiche Meldung
    if (response.status === 404 || response.status === 400) {
      throw new Error(`Modell "${model}" nicht verfügbar. Bitte in /admin oder .env.local ein anderes Modell wählen. Details: ${error}`);
    }
    throw new Error(`OpenRouter API Fehler: ${response.status} — ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
