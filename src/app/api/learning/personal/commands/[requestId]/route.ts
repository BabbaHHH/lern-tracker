import { personalRuntime } from '@/lib/server/learning/runtime';
import { personalHTTP } from '@/lib/server/learning/http';
import { accountFailure } from '@/lib/server/auth/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{requestId:string}>}) {try{return await personalHTTP(request,await personalRuntime(),(await params).requestId);}catch(error){return accountFailure(error);}}
