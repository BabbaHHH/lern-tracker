import { progressRuntime } from "@/lib/server/learning/runtime";
import { commandHTTP } from "@/lib/server/learning/http";
import { accountFailure } from "@/lib/server/auth/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request:Request,context:{params:Promise<{requestId:string}>}) {
  try {return await commandHTTP(request,await progressRuntime(),(await context.params).requestId);} catch(error) {return accountFailure(error);}
}
