import { accountRuntime } from "@/lib/server/auth/runtime";
import { accountFailure } from "@/lib/server/auth/security";
import { CatalogPdfService } from "@/lib/server/catalog-pdf/service";
import { catalogPdfDownloadHTTP } from "@/lib/server/catalog-pdf/download-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const auth = await accountRuntime();
    if (!auth.files) throw new Error("Private storage unavailable");
    return await catalogPdfDownloadHTTP(request, new CatalogPdfService(auth, auth.files));
  } catch (error) { return accountFailure(error); }
}
