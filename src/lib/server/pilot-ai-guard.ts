type DeferredPilotAiFeature = "planning" | "checkin" | "correction";

const messages: Record<DeferredPilotAiFeature, string> = {
  planning: "Die KI-Lernplangenerierung ist im ersten Pilot noch nicht verfügbar. Gespeicherte Pläne und manuelle Planung bleiben nutzbar.",
  checkin: "Der KI-Check-in ist im ersten Pilot noch nicht verfügbar. Du kannst deinen Lernfortschritt weiterhin manuell eintragen.",
  correction: "Die KI-Korrektur ist im ersten Pilot noch nicht verfügbar. Du kannst deine Texte weiterhin manuell schreiben und speichern.",
};

/** No request or release flag can enable the three deferred production features. */
export function deferredPilotAiResponse(feature: DeferredPilotAiFeature): Response | null {
  const local = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  if (local && process.env.STEX_AUTH_MODE !== "production") return null;
  return Response.json({ contractVersion: 1, error: { code: "pilot_ai_deferred", message: messages[feature] } }, {
    status: 503,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" },
  });
}
