import {correctionRuntime} from '@/lib/server/learning/runtime';
import {correctionHTTP} from '@/lib/server/learning/correction-http';
import {accountFailure} from '@/lib/server/auth/security';
import {deferredPilotAiResponse} from '@/lib/server/pilot-ai-guard';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=130;
export async function GET(request:Request){const deferred=deferredPilotAiResponse('correction');if(deferred)return deferred;try{return await correctionHTTP(request,await correctionRuntime());}catch(error){return accountFailure(error);}}
export async function POST(request:Request){const deferred=deferredPilotAiResponse('correction');if(deferred)return deferred;try{return await correctionHTTP(request,await correctionRuntime());}catch(error){return accountFailure(error);}}
