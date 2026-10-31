import { accountFailure } from "@/lib/server/auth/security";
import { catalogListHTTP } from "@/lib/server/catalog/http";
import { catalogRuntime } from "@/lib/server/catalog/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { return catalogListHTTP(request, await catalogRuntime()); }
  catch (error) { return accountFailure(error); }
}
