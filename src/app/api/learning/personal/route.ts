import { personalRuntime } from '@/lib/server/learning/runtime';
import { personalHTTP } from '@/lib/server/learning/http';
import { accountFailure } from '@/lib/server/auth/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request) {try{return await personalHTTP(request,await personalRuntime());}catch(error){return accountFailure(error);}}
export {handle as GET,handle as POST};
