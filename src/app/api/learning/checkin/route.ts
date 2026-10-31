import {checkinRuntime} from '@/lib/server/learning/runtime';
import {checkinHTTP} from '@/lib/server/learning/checkin-http';
import {accountFailure} from '@/lib/server/auth/security';
import {deferredPilotAiResponse} from '@/lib/server/pilot-ai-guard';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=130;
export async function GET(request:Request){const deferred=deferredPilotAiResponse('checkin');if(deferred)return deferred;try{return await checkinHTTP(request,await checkinRuntime());}catch(error){return accountFailure(error);}}
export async function POST(request:Request){const deferred=deferredPilotAiResponse('checkin');if(deferred)return deferred;try{return await checkinHTTP(request,await checkinRuntime());}catch(error){return accountFailure(error);}}
