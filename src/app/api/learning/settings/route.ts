import {settingsRuntime} from '@/lib/server/learning/runtime';
import {settingsHTTP} from '@/lib/server/learning/settings-http';
import {accountFailure} from '@/lib/server/auth/security';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handle(request:Request){try{return await settingsHTTP(request,await settingsRuntime());}catch(e){return accountFailure(e);}}
export const GET=handle;export const POST=handle;
