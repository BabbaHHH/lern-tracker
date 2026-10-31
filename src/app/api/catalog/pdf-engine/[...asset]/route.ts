import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
// Public library assets only; no document storage paths can enter this route.
export async function GET(_request: Request, context: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await context.params;
  const path = asset.join("/");
  if (!/^(?:LICENSE|build\/pdf(?:\.worker)?\.min\.mjs|cmaps\/[A-Za-z0-9_-]+\.bcmap|standard_fonts\/[A-Za-z0-9_.-]+\.(?:pfb|ttf)|wasm\/[A-Za-z0-9_-]+\.wasm)$/.test(path)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(join(process.cwd(), "node_modules/pdfjs-dist", path));
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": path === "LICENSE" ? "text/plain" : path.endsWith(".mjs") ? "text/javascript" : path.endsWith(".wasm") ? "application/wasm" : "application/octet-stream", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
