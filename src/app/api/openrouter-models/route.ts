import { errorResponse, requireLocalAccess } from "@/lib/server/request-safety";
import { NextResponse } from "next/server";

// Liefert die aktuell KOSTENLOSEN Text-Chat-Modelle von OpenRouter.
// Der /models-Endpoint ist öffentlich (kein Key nötig). "Frei" = Preis 0 für
// prompt UND completion. Reine Bild-/Audio-/Video-Modelle werden ausgefiltert.
export const dynamic = "force-dynamic";

interface ORModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { output_modalities?: string[]; input_modalities?: string[]; modality?: string };
}

function isFreeTextModel(m: ORModel): boolean {
  const p = m.pricing ?? {};
  const free = String(p.prompt) === "0" && String(p.completion) === "0";
  if (!free) return false;
  const out = m.architecture?.output_modalities ?? [];
  // Nur reine Text-Ausgabe (keine Musik-/Bild-/Audio-Modelle wie Lyria).
  return out.includes("text") && out.every((x) => x === "text");
}

export async function GET(req: Request) {
  try {
    requireLocalAccess(req);
    const res = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return NextResponse.json({ error: `OpenRouter ${res.status}` }, { status: 502 });
    }
    const json = (await res.json()) as { data?: ORModel[] };
    const models = (json.data ?? [])
      .filter(isFreeTextModel)
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        contextLength: m.context_length ?? 0,
      }))
      .sort((a, b) => b.contextLength - a.contextLength);

    return NextResponse.json({ models, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[/api/openrouter-models] Fehler:", message);
    return errorResponse(error);
  }
}
