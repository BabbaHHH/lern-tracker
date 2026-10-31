import { NextResponse } from "next/server";

export class RequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

/** Temporary local-only boundary. Replace with session + approval checks before hosting. */
export function requireLocalAccess(req: Request): void {
  if (process.env.NODE_ENV === "production") {
    throw new RequestError("Der Onlinezugang ist noch nicht eingerichtet. Diese Funktion ist nur lokal verfügbar.", 403);
  }
  const url = new URL(req.url);
  // Next may internally normalize the URL host; also validate the original Host.
  const host = req.headers.get("host");
  if (host && host !== url.host) throw new RequestError("Unzulässiger Host.", 403);
  const allowed = (process.env.LOCAL_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!loopback && !allowed.includes(url.origin)) {
    throw new RequestError("Diese Adresse ist für den lokalen Zugriff nicht freigegeben.", 403);
  }
  const origin = req.headers.get("origin");
  if ((origin && origin !== url.origin) || req.headers.get("sec-fetch-site") === "cross-site") {
    throw new RequestError("Zugriff von einer anderen Website ist nicht erlaubt.", 403);
  }
}

// Process-wide for the single-user local app. Hosting needs shared account quotas.
const limits = new Map<string, { count: number; resetAt: number }>();
export function limitRequests(bucket: string, max: number, now = Date.now()): void {
  let entry = limits.get(bucket);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 };
    limits.set(bucket, entry);
  }
  if (++entry.count > max) throw new RequestError("Zu viele Anfragen. Bitte in einer Minute erneut versuchen.", 429);
}

/** Enforce byte limits while streaming, including requests without Content-Length. */
export async function readJson(req: Request, maxBytes = 1_000_000): Promise<Record<string, unknown>> {
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new RequestError("Bitte JSON senden.", 415);
  }
  if (Number(req.headers.get("content-length")) > maxBytes) throw new RequestError("Anfrage ist zu groß.", 413);
  if (!req.body) throw new RequestError("Leere Anfrage.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestError("Anfrage ist zu groß.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new RequestError("Ungültiges JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new RequestError("JSON-Objekt erwartet.");
  return parsed as Record<string, unknown>;
}

export function errorResponse(error: unknown) {
  const status = error instanceof RequestError ? error.status : 500;
  const message = error instanceof RequestError ? error.message : "Die Anfrage konnte nicht verarbeitet werden. Bitte erneut versuchen.";
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) },
  });
}
