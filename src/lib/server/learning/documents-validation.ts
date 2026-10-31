import {DOCUMENT_LIMIT,type DocumentsCommand} from '../../learning/documents-contract';
import {AccountError,exactFields} from '../auth/security';
import {fileHash} from '../persistence/files';
export const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const identifier=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\x00-\x1f\x7f/\\]/.test(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);
export function invalid(message='Ungültiger Dokumentauftrag.'):never{throw new AccountError('invalid_input',message);}
export function conflict(message='Das Dokument wurde inzwischen geändert. Bitte gespeicherten Stand bewusst neu laden.'):never{throw new AccountError('conflict',message,409);}
export function validateDocuments(v:unknown):DocumentsCommand {
 if(!object(v))invalid();exactFields(v,['contractVersion','action','requestId','expectedAccountId','expectedAccessGeneration','expectedSessionContext','id','expectedRevision','operation','fields','file']);
 if(v.contractVersion!==1||v.action!=='documents'||!identifier(v.requestId)||!/^c5a_[a-zA-Z0-9_-]+$/.test(v.requestId)||!identifier(v.id)||!identifier(v.expectedAccountId)||!Number.isSafeInteger(v.expectedAccessGeneration)||Number(v.expectedAccessGeneration)<1||typeof v.expectedSessionContext!=='string'||!/^\w{64}$/.test(v.expectedSessionContext)||!(v.expectedRevision===null||(Number.isSafeInteger(v.expectedRevision)&&Number(v.expectedRevision)>0)))invalid();
 if(v.operation==='remove'){if(v.fields!==undefined||v.file!==undefined||v.expectedRevision===null)invalid();}
 else if(v.operation==='upload'||v.operation==='metadata'){
  if(!object(v.fields))invalid();exactFields(v.fields,['name','tags','includeInNextPlan']);
  if(!text(v.fields.name,200)||!v.fields.name.trim()||!Array.isArray(v.fields.tags)||v.fields.tags.length>30||v.fields.tags.some(t=>!text(t,80)||!t.trim())||new Set(v.fields.tags).size!==v.fields.tags.length||typeof v.fields.includeInNextPlan!=='boolean')invalid('Bitte Namen, bis zu 30 eindeutige Tags und Planauswahl prüfen.');
  if(v.operation==='metadata'){if(v.file!==undefined||v.expectedRevision===null)invalid();}
  else {if(!object(v.file))invalid();exactFields(v.file,['name','size','type','sha256']);if(!text(v.file.name,200)||!v.file.name.trim()||/[\/\\]/.test(v.file.name)||!Number.isSafeInteger(v.file.size)||Number(v.file.size)<1||Number(v.file.size)>DOCUMENT_LIMIT||!text(v.file.type,120)||typeof v.file.sha256!=='string'||!(/^[a-f0-9]{64}$/).test(v.file.sha256))invalid('Eine Originaldatei bis 4 MiB auswählen.');}
 }else invalid();return v as unknown as DocumentsCommand;
}
/** Technical signature checks only; no extraction, macros or document content execution. */
export function validateOriginal(file:NonNullable<DocumentsCommand['file']>,bytes:Buffer):string{
 if(bytes.length!==file.size||fileHash(bytes)!==file.sha256)invalid('Dateigröße oder Prüfsumme stimmt nicht.');
 const ext=file.name.split('.').at(-1)?.toLowerCase();let type:string;
 if(ext==='pdf'){type='application/pdf';if(!bytes.subarray(0,8).toString().match(/^%PDF-\d\.\d/))invalid('Keine unterstützte PDF-Signatur.');}
 else if(ext==='docx'||ext==='xlsx'){type=ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';if((bytes.length<4||bytes.readUInt32LE(0)!==0x04034b50)||!bytes.includes(Buffer.from('[Content_Types].xml'))||!bytes.includes(Buffer.from(ext==='docx'?'word/':'xl/')))invalid('Keine unterstützte Office-Dateistruktur.');}
 else if(ext==='xls'){type='application/vnd.ms-excel';if(!bytes.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex')))invalid('Keine unterstützte XLS-Signatur.');}
 else if(['txt','md','csv'].includes(ext??'')){type=ext==='csv'?'text/csv':ext==='md'?'text/markdown':'text/plain';try{const value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))invalid();}catch{invalid('Textdateien müssen UTF-8 enthalten.');}}
 else invalid('Unterstützt werden PDF, DOCX, XLSX, XLS, TXT, MD und CSV.');
 if(file.type&&file.type!=='application/octet-stream'&&file.type!==type&&!(ext==='md'&&file.type==='text/plain'))invalid('Dateityp und Dateiendung passen nicht zusammen.');return type;
}
