import { accountRuntime } from "@/lib/server/auth/runtime";
import { accountFailure } from "@/lib/server/auth/security";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:Request):Promise<Response> {
  try{return await (await accountRuntime()).authHTTP(request);}catch(error){return accountFailure(error);}
}
export {handle as GET,handle as POST};
