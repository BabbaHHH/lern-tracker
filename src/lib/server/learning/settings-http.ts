import {AccountError,accountFailure,accountResponse,atomicLimit,sameOrigin} from '../auth/security';
import type {SettingsService} from './settings-service';
export async function settingsHTTP(request:Request,service:SettingsService,requestId?:string){try{
 sameOrigin(request,service.auth.baseURL);const who=await service.auth.principal(request.headers);await service.auth.database.transaction(c=>atomicLimit(c,`learning-settings:${who.userId}:${request.method}`,request.method==='POST'?60:240,60));
 if(request.method==='GET')return accountResponse(requestId?await service.status(request.headers,requestId):await service.read(request.headers));
 if(request.method!=='POST'||requestId)throw new AccountError('invalid_input','Methode nicht unterstützt.',405);
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new AccountError('invalid_input','JSON erforderlich.',415);
 const reader=request.body?.getReader();if(!reader)throw new AccountError('invalid_input','Auftrag fehlt.',400);let timer:ReturnType<typeof setTimeout>|undefined;const chunks:Uint8Array[]=[];let size=0;
 try{await Promise.race([(async()=>{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>131072){void reader.cancel();throw new AccountError('too_large','Einstellungsauftrag zu groß.',413);}chunks.push(r.value);}})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel();reject(new AccountError('timeout','Übertragung dauert zu lange.',408));},15000);})]);}finally{clearTimeout(timer);reader.releaseLock();}
 let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccountError('invalid_input','JSON nicht lesbar.',400);}return accountResponse(await service.submit(request.headers,value));
}catch(e){return accountFailure(e);}}
