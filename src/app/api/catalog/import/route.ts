import { accountFailure } from "@/lib/server/auth/security";
import { catalogImportHTTP, catalogStatusHTTP } from "@/lib/server/catalog/http";
import { catalogRuntime } from "@/lib/server/catalog/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { return catalogStatusHTTP(request, await catalogRuntime()); }
  catch (error) { return accountFailure(error); }
}

export async function POST(request: Request) {
  try { return catalogImportHTTP(request, await catalogRuntime()); }
  catch (error) { return accountFailure(error); }
}
