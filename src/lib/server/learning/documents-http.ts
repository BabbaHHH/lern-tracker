import {DOCUMENT_LIMIT,DOCUMENT_META_LIMIT} from '../../learning/documents-contract';
import {AccountError,accountFailure,accountResponse,atomicLimit,sameOrigin} from '../auth/security';
import {byteRange} from '../catalog-pdf/http';
import type {DocumentsService} from './documents-service';
import {validateDocuments} from './documents-validation';
/** The real incoming stream is bounded before multipart parsing. */
async function body(request:Request){
 const type=request.headers.get('content-type')??'',multipart=type.startsWith('multipart/form-data;');
 if(!multipart&&type.split(';')[0]!=='application/json')throw new AccountError('invalid_input','JSON oder Multipart erforderlich.',415);
 const limit=multipart?DOCUMENT_LIMIT+DOCUMENT_META_LIMIT+4096:DOCUMENT_META_LIMIT;
 const reader=request.body?.getReader();if(!reader)throw new AccountError('invalid_input','Auftrag fehlt.');
 let size=0,timer:ReturnType<typeof setTimeout>|undefined;const chunks:Uint8Array[]=[];
 try{await Promise.race([(async()=>{while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>limit){void reader.cancel();throw new AccountError('too_large','Datei oder Auftrag überschreitet die Grenze von 4 MiB.',413);}chunks.push(p.value);}})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel();reject(new AccountError('timeout','Übertragung hat zu lange gedauert.',408));},15000);})]);}finally{clearTimeout(timer);reader.releaseLock();}
 const bytes=Buffer.concat(chunks);
 try{
  if(!multipart)return {command:validateDocuments(JSON.parse(bytes.toString('utf8'))),bytes:undefined};
  const form=await new Response(bytes,{headers:{'Content-Type':type}}).formData();
  if([...form.keys()].some(k=>!['command','file'].includes(k))||form.getAll('command').length!==1||form.getAll('file').length!==1)throw new AccountError('invalid_input','Genau ein Auftrag und eine Originaldatei erforderlich.');
  const raw=form.get('command'),file=form.get('file');if(typeof raw!=='string'||Buffer.byteLength(raw)>DOCUMENT_META_LIMIT||!file||typeof file==='string'||file.size>DOCUMENT_LIMIT)throw new AccountError('invalid_input','Ungültige Uploadfelder.');
  const command=validateDocuments(JSON.parse(raw));if(command.operation!=='upload'||command.file?.name!==file.name||command.file?.type!==file.type||command.file?.size!==file.size)throw new AccountError('invalid_input','Datei und Auftrag stimmen nicht überein.');
  return {command,bytes:Buffer.from(await file.arrayBuffer())};
 }catch(error){if(error instanceof AccountError)throw error;throw new AccountError('invalid_input','Der Dokumentauftrag ist nicht lesbar.');}
}
export async function documentsHTTP(request:Request,service:DocumentsService,selection?:{requestId:string}|{id:string;versionId:string}){
 try{
  sameOrigin(request,service.auth.baseURL);const who=await service.auth.principal(request.headers);
  await service.auth.database.transaction(c=>atomicLimit(c,`learning-documents:${who.userId}:${request.method}`,request.method==='POST'?30:240,60));
  if(selection&&'id' in selection){
   if(!['GET','HEAD'].includes(request.method))throw new AccountError('invalid_input','Methode nicht unterstützt.',405);
   const query=new URL(request.url).searchParams;if([...query.keys()].some(k=>!['revision','download'].includes(k))||query.getAll('revision').length!==1||query.getAll('download').length>1)throw new AccountError('invalid_input','Ungültiger Dateiabruf.');
   const file=await service.file(request.headers,selection.id,selection.versionId,Number(query.get('revision')));
   const headers=new Headers({'Content-Type':file.type,'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Accept-Ranges':'bytes','Content-Disposition':`${query.get('download')==='1'||file.type!=='application/pdf'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g,x=>'%'+x.charCodeAt(0).toString(16))}`});
   const raw=request.method==='GET'&&!request.headers.has('if-range')?request.headers.get('range'):null,range=raw?byteRange(raw,file.bytes.length):null;
   if(raw&&!range){headers.set('Content-Range',`bytes */${file.bytes.length}`);return new Response(null,{status:416,headers});}
   const start=range?.start??0,end=range?.end??file.bytes.length-1;headers.set('Content-Length',String(end-start+1));if(range)headers.set('Content-Range',`bytes ${start}-${end}/${file.bytes.length}`);
   return new Response(request.method==='HEAD'?null:new Uint8Array(file.bytes.subarray(start,end+1)),{status:range?206:200,headers});
  }
  if(request.method==='GET')return accountResponse(selection?await service.status(request.headers,selection.requestId):await service.read(request.headers));
  if(request.method==='POST'&&!selection){const b=await body(request);return accountResponse(await service.submit(request.headers,b.command,b.bytes));}
  throw new AccountError('invalid_input','Methode nicht unterstützt.',405);
 }catch(error){const r=accountFailure(error);return request.method==='HEAD'?new Response(null,{status:r.status,headers:r.headers}):r;}
}
