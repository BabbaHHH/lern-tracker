import {correctionRuntime} from '@/lib/server/learning/runtime';
import {correctionHTTP} from '@/lib/server/learning/correction-http';
import {accountFailure} from '@/lib/server/auth/security';
import {deferredPilotAiResponse} from '@/lib/server/pilot-ai-guard';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{requestId:string}>}){const deferred=deferredPilotAiResponse('correction');if(deferred)return deferred;try{return await correctionHTTP(request,await correctionRuntime(),(await params).requestId);}catch(error){return accountFailure(error);}}
