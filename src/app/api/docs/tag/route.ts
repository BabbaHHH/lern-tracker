import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/ai";
import { TOPICS, getLeafTopics } from "@/lib/topics";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, description } = body as {
      name?: string;
      type?: string;
      description?: string;
    };

    if (!name) {
      return NextResponse.json({ error: "name fehlt" }, { status: 400 });
    }

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

    const reply = await chatCompletion(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      "cheap",
    );

    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "KI-Antwort war kein JSON", raw: reply }, { status: 500 });
    }
    const parsed = JSON.parse(match[0]) as { summary?: unknown; topicIds?: unknown };

    const validIds = new Set(leaves.map(t => t.id));
    const topicIds = Array.isArray(parsed.topicIds)
      ? (parsed.topicIds as unknown[]).filter((v): v is string => typeof v === "string" && validIds.has(v))
      : [];
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "";

    return NextResponse.json({ summary, topicIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
