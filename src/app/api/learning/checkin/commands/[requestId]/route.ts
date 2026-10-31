import {checkinRuntime} from '@/lib/server/learning/runtime';
import {checkinHTTP} from '@/lib/server/learning/checkin-http';
import {accountFailure} from '@/lib/server/auth/security';
import {deferredPilotAiResponse} from '@/lib/server/pilot-ai-guard';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{requestId:string}>}){const deferred=deferredPilotAiResponse('checkin');if(deferred)return deferred;try{return await checkinHTTP(request,await checkinRuntime(),(await params).requestId);}catch(error){return accountFailure(error);}}
