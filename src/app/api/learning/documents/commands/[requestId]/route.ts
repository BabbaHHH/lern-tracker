import {documentsRuntime} from '@/lib/server/learning/runtime';
import {documentsHTTP} from '@/lib/server/learning/documents-http';
import {accountFailure} from '@/lib/server/auth/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request,context:{params:Promise<{requestId:string}>}){try{const {requestId}=await context.params;return await documentsHTTP(request,await documentsRuntime(),{requestId});}catch(e){const r=accountFailure(e);return request.method==='HEAD'?new Response(null,{status:r.status,headers:r.headers}):r;}}
export const GET=handle;
