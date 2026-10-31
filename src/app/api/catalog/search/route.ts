import { catalogSearchHTTP } from "@/lib/server/search/http";
import { searchRuntime } from "@/lib/server/search/runtime";
import { accountFailure } from "@/lib/server/auth/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return await catalogSearchHTTP(request, await searchRuntime()); } catch (error) { return accountFailure(error); }
}
export async function POST(request: Request) { return GET(request); }
