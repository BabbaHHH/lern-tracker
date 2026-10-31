import { accountRuntime } from "@/lib/server/auth/runtime";
import { accountFailure } from "@/lib/server/auth/security";
import { CatalogPdfService } from "@/lib/server/catalog-pdf/service";
import { catalogPdfHTTP } from "@/lib/server/catalog-pdf/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const auth = await accountRuntime();
    if (!auth.files) throw new Error("Private storage unavailable");
    return await catalogPdfHTTP(request, new CatalogPdfService(auth, auth.files));
  } catch (error) { return accountFailure(error); }
}
export async function HEAD(request: Request) {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
