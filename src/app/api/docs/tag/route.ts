import { errorResponse, limitRequests, readJson, requireLocalAccess, RequestError } from "@/lib/server/request-safety";
import { NextRequest, NextResponse } from "next/server";
import { AiProviderError, chatCompletion } from "@/lib/ai";
import { TOPICS, getLeafTopics } from "@/lib/topics";
import { isReasoningPreference } from "@/lib/ai-config";
import { accountFailure, accountResponse } from "@/lib/server/auth/security";
import { aiCredentialRuntime, isAccountAiRequest, sameOriginAiRequest } from "@/lib/server/ai-credentials/runtime";

export async function POST(req: NextRequest) {
  let accountRequest = false;
  try {
    accountRequest = isAccountAiRequest(req);
    const credentials = accountRequest ? await aiCredentialRuntime() : null;
    if (credentials) sameOriginAiRequest(req, credentials.auth.baseURL);
    else requireLocalAccess(req);
    limitRequests("doc-tag", 20);
    const body = await readJson(req, 24_000);
    if (body.reasoningPreference !== undefined && !isReasoningPreference(body.reasoningPreference)) throw new RequestError("Ungültige Reasoning-Einstellung.");
    const { name, type, description } = body as {
      name?: string;
      type?: string;
      description?: string;
    };

    if (typeof name !== "string" || !name.trim() || name.length > 255) {
      return NextResponse.json({ error: "name fehlt" }, { status: 400 });
    }

    if (type !== undefined && (typeof type !== "string" || type.length > 100)) throw new RequestError("Ungültiger Dateityp.");
    if (description !== undefined && (typeof description !== "string" || description.length > 15000)) throw new RequestError("Beschreibung ist zu lang.");

    const leaves = getLeafTopics(TOPICS);
    const taxonomy = leaves.map(t => `${t.id} — ${t.label}`).join("\n");

    const system = `Du bist ein Jura-Assistent, der Lernmaterialien (Skripte, PDFs, Notizen) inhaltlich in eine Taxonomie für das 2. Staatsexamen einordnet.

Taxonomie (ID — Label):
${taxonomy}

Antworte AUSSCHLIESSLICH als reines JSON, ohne Markdown-Fences, ohne Kommentar:
{"summary": "...", "topicIds": ["...", "..."]}

Regeln:
- "summary" = max. 2 Sätze auf Deutsch zu Inhalt/Fokus des Dokuments
- "topicIds" = nur IDs die EXAKT in der Taxonomie stehen
- Max. 20 topicIds, priorisiere die Leaves die das Dokument tatsächlich inhaltlich abdeckt
- Bei sehr allgemeinem Material (z.B. "Skript ZR-AG") lieber weniger Leaves wählen als falsche raten.`;

    const user = `Dateiname: ${name}${type ? ` (Typ: ${type})` : ""}
${description?.trim() ? `\nBeschreibung durch den Nutzer:\n${description.trim()}` : "\n(Keine Beschreibung vorhanden — ordne rein nach Dateiname ein.)"}`;

    const access = credentials ? await credentials.resolveSelected(req.headers) : null;
    const reply = await chatCompletion(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      "cheap",
      { signal: req.signal, reasoningPreference: body.reasoningPreference, ...(access ? { apiKey: access.apiKey, credentialSource: access.source } : {}) },
    );
    if (access && credentials) await credentials.assertAccessCurrent(access);

    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) {
      return accountRequest
        ? accountResponse({ contractVersion: 1, error: { code: "invalid_provider_response", message: "Die KI-Antwort ließ sich nicht als JSON lesen. Bitte bewusst erneut versuchen." } }, 502)
        : NextResponse.json({ error: "KI-Antwort war kein JSON", raw: reply }, { status: 500 });
    }
    const parsed = JSON.parse(match[0]) as { summary?: unknown; topicIds?: unknown };

    const validIds = new Set(leaves.map(t => t.id));
    const topicIds = Array.isArray(parsed.topicIds)
      ? (parsed.topicIds as unknown[]).filter((v): v is string => typeof v === "string" && validIds.has(v))
      : [];
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "";

    return credentials ? accountResponse({ contractVersion: 1, summary, topicIds }) : NextResponse.json({ summary, topicIds });
  } catch (error) {
    if (accountRequest) {
      if (error instanceof AiProviderError) return accountResponse({ contractVersion: 1, error: { code: error.code, message: error.message } }, error.status);
      if (error instanceof RequestError) return accountResponse({ contractVersion: 1, error: { code: "invalid_request", message: error.message } }, error.status);
      return accountFailure(error);
    }
    return errorResponse(error);
  }
}
