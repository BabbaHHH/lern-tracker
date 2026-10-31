import { accountFailure } from '@/lib/server/auth/security';
import { catalogMetadataHTTP } from '@/lib/server/catalog/metadata-http';
import { catalogMetadataRuntime } from '@/lib/server/catalog/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try { return await catalogMetadataHTTP(request, await catalogMetadataRuntime(), true); }
  catch (error) { return accountFailure(error); }
}
