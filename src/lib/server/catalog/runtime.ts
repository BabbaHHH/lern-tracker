import { AccountError } from "../auth/security";
import { accountRuntime } from "../auth/runtime";
import { CatalogImportService } from "./import-service";
import { CatalogMetadataService } from "./metadata-service";

export async function catalogMetadataRuntime(): Promise<CatalogMetadataService> {
  return new CatalogMetadataService(await accountRuntime());
}

export async function catalogRuntime(): Promise<CatalogImportService> {
  const auth = await accountRuntime();
  if (!auth.files) throw new AccountError("unavailable", "Der private Dokumentenspeicher ist noch nicht eingerichtet.", 503);
  return new CatalogImportService(auth, auth.files);
}
