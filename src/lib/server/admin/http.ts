import { accountFailure, accountResponse, AccountError, sameOrigin } from "../auth/security";
import type { AdminService } from "./service";
export async function adminHTTP(request: Request, service: AdminService): Promise<Response> {
  try {
    sameOrigin(request, service.auth.baseURL);
    if (request.method !== "GET") throw new AccountError("method_not_allowed", "Hier sind nur lesende Abrufe erlaubt.", 405);
    const params = new URL(request.url).searchParams;
    const view = params.get("view") ?? "overview";
    const result = view === "overview" ? await service.overview(request.headers)
      : view === "imports" ? await service.imports(request.headers, params)
      : view === "detail" ? await service.detail(request.headers, params.get("importId") ?? "")
      : view === "audit" ? await service.audit(request.headers, params)
      : await service.read(request.headers, async () => { throw new AccountError("invalid_input", "Unbekannte Verwaltungsansicht."); });
    return accountResponse({ contractVersion: 1, ...result });
  } catch (error) { return accountFailure(error); }
}
