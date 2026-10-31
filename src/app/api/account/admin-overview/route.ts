import { accountRuntime } from "@/lib/server/auth/runtime";
import { accountFailure } from "@/lib/server/auth/security";
import { AdminService } from "@/lib/server/admin/service";
import { adminHTTP } from "@/lib/server/admin/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return await adminHTTP(request, new AdminService(await accountRuntime())); }
  catch (error) { return accountFailure(error); }
}
