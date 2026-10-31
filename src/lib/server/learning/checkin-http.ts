import type {CheckinService} from './checkin-service';
import {AccountError,accountFailure,accountResponse,atomicLimit,sameOrigin} from '../auth/security';
async function body(request:Request){
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new AccountError('invalid_input','Bitte JSON senden.',415);
 const reader=request.body?.getReader();if(!reader)throw new AccountError('invalid_input','Check-in fehlt.');
 let timer:ReturnType<typeof setTimeout>|undefined,size=0;const chunks:Uint8Array[]=[];
 try{
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel();reject(new AccountError('timeout','Die Anfrage wurde nicht rechtzeitig übertragen.',408));},10000);});
  await Promise.race([timeout,(async()=>{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>96000){await reader.cancel();throw new AccountError('too_large','Der Check-in ist zu groß.',413);}chunks.push(part.value);}})()]);
 }finally{clearTimeout(timer);reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccountError('invalid_input','Ungültiger Check-in.');}
}
export async function checkinHTTP(request:Request,service:CheckinService,id?:string):Promise<Response>{
 try{
  sameOrigin(request,service.auth.baseURL);
  const principal=await service.auth.principal(request.headers);
  await service.auth.database.transaction(c=>atomicLimit(c,`learning-checkin:${principal.userId}:${request.method}`,request.method==='POST'?20:120,60));
  if(request.method==='GET')return accountResponse(id?await service.status(request.headers,id):await service.read(request.headers));
  if(request.method==='POST'&&!id)return accountResponse(await service.submit(request.headers,await body(request),request.signal));
  throw new AccountError('invalid_input','Nicht unterstützte Methode.',405);
 }catch(error){return accountFailure(error);}
}
