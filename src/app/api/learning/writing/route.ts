import {writingRuntime} from '@/lib/server/learning/runtime';
import {writingHTTP} from '@/lib/server/learning/writing-http';
import {accountFailure} from '@/lib/server/auth/security';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await writingHTTP(request,await writingRuntime());}catch(e){return accountFailure(e);}}
export async function POST(request:Request){try{return await writingHTTP(request,await writingRuntime());}catch(e){return accountFailure(e);}}
