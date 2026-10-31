import {planRuntime} from '@/lib/server/learning/runtime';
import {planHTTP} from '@/lib/server/learning/http';
import {accountFailure} from '@/lib/server/auth/security';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){try{return await planHTTP(request,await planRuntime(),'preview');}catch(error){return accountFailure(error);}}
