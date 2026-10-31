import {CORRECTION_BODY_LIMIT} from '../../learning/correction-contract';
import type {CorrectionService} from './correction-service';
import {AccountError,accountFailure,accountResponse,atomicLimit,sameOrigin} from '../auth/security';
async function body(r:Request){if(r.headers.get('content-type')?.split(';')[0]!=='application/json')throw new AccountError('invalid_input','Bitte JSON senden.',415);const reader=r.body?.getReader();if(!reader)throw new AccountError('invalid_input','Korrekturauftrag fehlt.');const parts:Uint8Array[]=[];let size=0,timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([(async()=>{while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>CORRECTION_BODY_LIMIT){await reader.cancel();throw new AccountError('too_large','Korrekturauftrag zu groß.',413);}parts.push(p.value);}})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel();reject(new AccountError('timeout','Übertragungszeit überschritten.',408));},10000);})]);}finally{clearTimeout(timer);reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new AccountError('invalid_input','Ungültiger Korrekturauftrag.');}
}
export async function correctionHTTP(r:Request,service:CorrectionService,id?:string){try{sameOrigin(r,service.auth.baseURL);const who=await service.auth.principal(r.headers);await service.auth.database.transaction(c=>atomicLimit(c,`learning-correction:${who.userId}:${r.method}`,r.method==='POST'?20:120,60));
 if(r.method==='GET'){if(id!==undefined)return accountResponse(await service.status(r.headers,id));const q=new URL(r.url).searchParams;if([...q.keys()].some(k=>k!=='draftId')||q.getAll('draftId').length>1)throw new AccountError('invalid_input','Ungültige Entwurfsauswahl.');return accountResponse(await service.read(r.headers,q.get('draftId')??undefined));}
 if(r.method==='POST'&&id===undefined)return accountResponse(await service.submit(r.headers,await body(r),r.signal));throw new AccountError('invalid_input','Nicht unterstützte Methode.',405);
 }catch(e){return accountFailure(e);}}
