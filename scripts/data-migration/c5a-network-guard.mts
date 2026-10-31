/** Test-only: no external AI, mail, portal or document requests from this QA runtime. */
import {existsSync,unlinkSync,writeFileSync} from 'node:fs';
import {ServerResponse} from 'node:http';
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('C5a QA: external fetch is prohibited.');return original(input,init);};
// One explicitly armed response loss in the existing synthetic source runtime only.
const end=ServerResponse.prototype.end;
ServerResponse.prototype.end=function(...args:Parameters<typeof end>){
 const root='/private/tmp/stex-c5a-browser-aV9rqG',marker=`${root}/drop-next-document-response`;
 if(process.env.STEX_LOCAL_DATA_DIR===root&&this.req.method==='POST'&&this.req.url==='/api/learning/documents'&&this.statusCode===200&&existsSync(marker)){
  unlinkSync(marker);writeFileSync(`${root}/response-loss-proof.json`,JSON.stringify({recordedAt:new Date().toISOString(),method:this.req.method,path:this.req.url,statusCode:this.statusCode,action:'socket destroyed before response end after successful handler'})+'\n');this.destroy();return this;
 }
 return end.apply(this,args);
} as typeof end;
