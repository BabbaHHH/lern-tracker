import { errorResponse, requireLocalAccess } from "@/lib/server/request-safety";
import { NextRequest, NextResponse } from "next/server";
import os from "os";

/**
 * Liefert die Basis-URLs, unter denen dieser Dev-Server im Heimnetz erreichbar
 * ist (für den iPad-QR-Code). Zwei Varianten:
 * - IP-basiert (z.B. http://10.157.110.142:3000) — löst immer auf, kann sich
 *   aber per DHCP ändern → fürs "jetzt scannen" die verlässlichste.
 * - Bonjour-Hostname (http://macbook-pro-von-niklas.local:3000) — stabil über
 *   Tage, mDNS-Auflösung auf iOS aber gelegentlich zickig.
 */
export async function GET(req: NextRequest) {
  try { requireLocalAccess(req); } catch (error) { return errorResponse(error); }
  const port = req.nextUrl.port || "3000";

  const urls: string[] = [];

  // Alle nicht-internen IPv4-Adressen (WLAN zuerst — en0 ist auf Macs üblich)
  const ifaces = os.networkInterfaces();
  const names = Object.keys(ifaces).sort((a, b) =>
    (a === "en0" ? -1 : 0) - (b === "en0" ? -1 : 0),
  );
  for (const name of names) {
    for (const info of ifaces[name] ?? []) {
      if (info.family === "IPv4" && !info.internal) {
        urls.push(`http://${info.address}:${port}`);
      }
    }
  }

  // Bonjour-Name als stabile Alternative
  const host = os.hostname(); // z.B. "MacBook-Pro-von-Niklas.local"
  const local = host.endsWith(".local") ? host : `${host}.local`;
  urls.push(`http://${local.toLowerCase()}:${port}`);

  return NextResponse.json({ urls });
}
