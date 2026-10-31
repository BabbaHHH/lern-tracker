import {preparationRuntime} from '@/lib/server/learning/runtime';
import {preparationHTTP} from '@/lib/server/learning/http';
import {accountFailure} from '@/lib/server/auth/security';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){try{return await preparationHTTP(request,await preparationRuntime(),'preview');}catch(error){return accountFailure(error);}}
