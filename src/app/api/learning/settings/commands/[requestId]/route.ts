import {settingsRuntime} from '@/lib/server/learning/runtime';
import {settingsHTTP} from '@/lib/server/learning/settings-http';
import {accountFailure} from '@/lib/server/auth/security';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{requestId:string}>}){try{return await settingsHTTP(request,await settingsRuntime(),(await context.params).requestId);}catch(e){return accountFailure(e);}}
