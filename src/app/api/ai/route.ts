import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, type AiMessage, type ModelTier } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, tier } = body as {
      messages: AiMessage[];
      tier?: ModelTier;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages Array fehlt" },
        { status: 400 }
      );
    }

    const reply = await chatCompletion(messages, tier || "cheap");

    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
