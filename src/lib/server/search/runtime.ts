import { accountRuntime } from "../auth/runtime";
import { CatalogSearchService } from "./service";
export async function searchRuntime() { return new CatalogSearchService(await accountRuntime()); }
