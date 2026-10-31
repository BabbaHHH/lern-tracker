import { accountFailure } from '@/lib/server/auth/security';
import { catalogLegacyImportHTTP } from '@/lib/server/catalog/legacy-import-http';
import { catalogRuntime } from '@/lib/server/catalog/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try { return catalogLegacyImportHTTP(request, await catalogRuntime()); }
  catch (error) { return accountFailure(error); }
}

export async function POST(request: Request) {
  try { return catalogLegacyImportHTTP(request, await catalogRuntime()); }
  catch (error) { return accountFailure(error); }
}
