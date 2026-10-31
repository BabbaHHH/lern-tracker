import { accountFailure } from '@/lib/server/auth/security';
import { catalogMetadataHTTP } from '@/lib/server/catalog/metadata-http';
import { catalogMetadataRuntime } from '@/lib/server/catalog/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  try { return await catalogMetadataHTTP(request, await catalogMetadataRuntime()); }
  catch (error) { return accountFailure(error); }
}
export const GET = handle;
export const POST = handle;
