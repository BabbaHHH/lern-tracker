import { LEARNING_BODY_LIMIT } from "../../learning/progress-contract";
import { accountFailure, accountResponse, AccountError, atomicLimit, sameOrigin } from "../auth/security";
import type { ProgressService } from "./progress-service";

export async function readBody(request:Request):Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new AccountError("invalid_input","Bitte JSON senden.",415);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("invalid_input","Lernaktion fehlt.");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > LEARNING_BODY_LIMIT) {await reader.cancel();throw new AccountError("too_large","Die Lernaktion ist zu groß.",413);}
      chunks.push(part.value);
    }
  } finally {reader.releaseLock();}
  try {return JSON.parse(Buffer.concat(chunks).toString("utf8"));} catch {throw new AccountError("invalid_input","Ungültige Lernaktion.");}
}
export async function progressHTTP(request:Request,service:ProgressService):Promise<Response> {
  try {
    sameOrigin(request,service.auth.baseURL);
    const principal = await service.auth.principal(request.headers);
    await service.auth.database.transaction(client => atomicLimit(client,`learning:${principal.userId}`,240,60));
    if (request.method === "GET") return accountResponse(await service.read(request.headers));
    if (request.method === "POST") return accountResponse(await service.submit(request.headers,await readBody(request)));
    throw new AccountError("invalid_input","Nicht unterstützte Methode.",405);
  } catch(error) {return accountFailure(error);}
}
export async function commandHTTP(request:Request,service:ProgressService,id:string):Promise<Response> {
  try {sameOrigin(request,service.auth.baseURL);return accountResponse(await service.status(request.headers,id));} catch(error) {return accountFailure(error);}
}

export async function personalHTTP(request:Request,service:import('./personal-service').PersonalService,id?:string):Promise<Response> {
  try {
    sameOrigin(request,service.auth.baseURL);
    const principal=await service.auth.principal(request.headers);
    await service.auth.database.transaction(c=>atomicLimit(c,`learning-personal:${principal.userId}`,240,60));
    if(id!==undefined && request.method==='GET')return accountResponse(await service.status(request.headers,id));
    if(request.method==='GET')return accountResponse(await service.read(request.headers));
    if(request.method==='POST')return accountResponse(await service.submit(request.headers,await readBody(request)));
    throw new AccountError('invalid_input','Nicht unterstützte Methode.',405);
  }catch(error){return accountFailure(error);}
}

export async function scheduleHTTP(request:Request,service:import('./schedule-service').ScheduleService,id?:string):Promise<Response>{
 try{sameOrigin(request,service.auth.baseURL);const principal=await service.auth.principal(request.headers);await service.auth.database.transaction(c=>atomicLimit(c,`learning-schedule:${principal.userId}`,240,60));
 if(id!==undefined&&request.method==='GET')return accountResponse(await service.status(request.headers,id));
 if(request.method==='GET')return accountResponse(await service.read(request.headers));
 if(request.method==='POST')return accountResponse(await service.submit(request.headers,await readBody(request)));
 throw new AccountError('invalid_input','Nicht unterstützte Methode.',405);
 }catch(error){return accountFailure(error);}
}

export async function planHTTP(request:Request,service:import('./plan-service').PlanService,kind:'main'|'preview'|'status'='main',id?:string):Promise<Response>{
 try{sameOrigin(request,service.auth.baseURL);const principal=await service.auth.principal(request.headers);await service.auth.database.transaction(c=>atomicLimit(c,`learning-plan:${principal.userId}`,120,60));
 if(kind==='status'&&request.method==='GET'&&id)return accountResponse(await service.status(request.headers,id));
 if(kind==='main'&&request.method==='GET')return accountResponse(await service.read(request.headers));
 if(request.method==='POST'&&kind==='preview')return accountResponse(await service.preview(request.headers,await readBody(request)));
 if(request.method==='POST'&&kind==='main')return accountResponse(await service.submit(request.headers,await readBody(request)));
 throw new AccountError('invalid_input','Nicht unterstützte Methode.',405);
 }catch(error){return accountFailure(error);}
}

export async function preparationHTTP(request:Request,service:import('./preparation-service').PreparationService,kind:'main'|'preview'|'status'='main',id?:string):Promise<Response>{
 try{sameOrigin(request,service.auth.baseURL);const principal=await service.auth.principal(request.headers);await service.auth.database.transaction(c=>atomicLimit(c,`learning-preparation:${principal.userId}`,120,60));
 if(kind==='status'&&request.method==='GET'&&id)return accountResponse(await service.status(request.headers,id));
 if(kind==='main'&&request.method==='GET')return accountResponse(await service.read(request.headers));
 if(request.method==='POST'&&kind==='preview')return accountResponse(await service.preview(request.headers,await readBody(request)));
 if(request.method==='POST'&&kind==='main')return accountResponse(await service.submit(request.headers,await readBody(request)));
 throw new AccountError('invalid_input','Nicht unterstützte Methode.',405);
 }catch(error){return accountFailure(error);}
}
