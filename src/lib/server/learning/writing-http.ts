import {WRITING_BODY_LIMIT,type WritingKind} from '../../learning/writing-contract';
import type {WritingService} from './writing-service';
import {AccountError,accountFailure,accountResponse,atomicLimit,sameOrigin} from '../auth/security';
async function body(request:Request){
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new AccountError('invalid_input','Bitte JSON senden.',415);
 const reader=request.body?.getReader();if(!reader)throw new AccountError('invalid_input','Schreibauftrag fehlt.');let timer:ReturnType<typeof setTimeout>|undefined,size=0;const chunks:Uint8Array[]=[];
 try{await Promise.race([new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel();reject(new AccountError('timeout','Der Text wurde nicht rechtzeitig übertragen.',408));},10000);}), (async()=>{while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>WRITING_BODY_LIMIT){await reader.cancel();throw new AccountError('too_large','Der Schreibauftrag ist zu groß.',413);}chunks.push(p.value);}})()]);}finally{clearTimeout(timer);reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccountError('invalid_input','Ungültiger Schreibauftrag.');}
}
export async function writingHTTP(request:Request,service:WritingService,id?:string){
 try{sameOrigin(request,service.auth.baseURL);const who=await service.auth.principal(request.headers);await service.auth.database.transaction(c=>atomicLimit(c,`learning-writing:${who.userId}:${request.method}`,240,60));
  if(request.method==='GET'){if(id!==undefined)return accountResponse(await service.status(request.headers,id));const q=new URL(request.url).searchParams;if([...q.keys()].some(k=>!['kind','id'].includes(k))||q.getAll('kind').length>1||q.getAll('id').length>1)throw new AccountError('invalid_input','Ungültige Textauswahl.');const kind=q.get('kind'),key=q.get('id');if((kind===null)!==(key===null))throw new AccountError('invalid_input','Unvollständige Textauswahl.');return accountResponse(await service.read(request.headers,kind&&key?{kind:kind as WritingKind,id:key}:undefined));}
  if(request.method==='POST'&&id===undefined)return accountResponse(await service.submit(request.headers,await body(request)));
  throw new AccountError('invalid_input','Nicht unterstützte Methode.',405);
 }catch(error){return accountFailure(error);}
}
