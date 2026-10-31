import {writingRuntime} from '@/lib/server/learning/runtime';
import {writingHTTP} from '@/lib/server/learning/writing-http';
import {accountFailure} from '@/lib/server/auth/security';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{requestId:string}>}){try{return await writingHTTP(request,await writingRuntime(),(await params).requestId);}catch(e){return accountFailure(e);}}
