// Hilfsfunktionen rund um KI-Antworten.
// Wird von useAi() und allen Stellen verwendet die KI-Outputs verarbeiten.

/**
 * Extrahiert ein JSON-Objekt aus einer KI-Antwort.
 * KI-Modelle wrappen JSON gerne in Markdown-Codefences oder Prosa
 * — diese Funktion findet das erste vollständige `{...}`-Objekt
 * (klammer-balanciert, String-Literale werden korrekt übersprungen)
 * und parst es zu T.
 *
 * Liefert `{ data }` bei Erfolg, `{ error }` bei Fehler — kein Throw.
 */
export function parseAiJson<T>(raw: string): { data?: T; error?: string } {
  if (!raw || typeof raw !== "string") {
    return { error: "Leere KI-Antwort" };
  }

  // Zuerst Codefences entfernen (häufiger Wrapper)
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();

  // Klammer-balanciertes Objekt finden
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const chunk = cleaned.slice(start, i + 1);
        try {
          return { data: JSON.parse(chunk) as T };
        } catch (e) {
          return { error: `JSON-Parse-Fehler: ${(e as Error).message.slice(0, 100)}` };
        }
      }
    }
  }

  return { error: "Kein valides JSON-Objekt in der KI-Antwort gefunden" };
}

/**
 * Wie parseAiJson, aber für Arrays (Top-Level `[...]`).
 */
export function parseAiJsonArray<T>(raw: string): { data?: T[]; error?: string } {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return { error: "Kein JSON-Array in der KI-Antwort gefunden" };
  try {
    const parsed = JSON.parse(match[0]) as T[];
    if (!Array.isArray(parsed)) return { error: "Geparste Daten sind kein Array" };
    return { data: parsed };
  } catch (e) {
    return { error: `JSON-Parse-Fehler: ${(e as Error).message.slice(0, 100)}` };
  }
}
