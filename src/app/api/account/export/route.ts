import { accountRuntime } from "@/lib/server/auth/runtime";
import { AccountError, accountFailure } from "@/lib/server/auth/security";
import { AccountExportService, accountExportHTTP } from "@/lib/server/account-export-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    if (process.env.STEX_LEARNING_MODE !== "account") {
      throw new AccountError("unavailable", "Der persönliche Kontodownload ist nicht eingerichtet.", 503);
    }
    const service = new AccountExportService(await accountRuntime());
    return await accountExportHTTP(request, service);
  } catch (error) {
    const response = accountFailure(error);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Vary", "Cookie");
    return response;
  }
}
