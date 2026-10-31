import {existsSync,unlinkSync,writeFileSync} from 'node:fs';
import {ServerResponse} from 'node:http';
/** Synthetic C5b runtimes must never call external services. */
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('C5b: external fetch prohibited.');return original(input,init);};
const end=ServerResponse.prototype.end;
ServerResponse.prototype.end=function(...args:Parameters<typeof end>){
 const root=process.env.STEX_LOCAL_DATA_DIR??'',marker=`${root}/drop-next-settings-response`;
 if(/^\/private\/tmp\/stex-c5b-browser-[a-zA-Z0-9]+$/.test(root)&&this.req.method==='POST'&&this.req.url==='/api/learning/settings'&&this.statusCode===200&&existsSync(marker)){
  unlinkSync(marker);writeFileSync(`${root}/response-loss-proof.json`,JSON.stringify({recordedAt:new Date().toISOString(),path:this.req.url,status:200,action:'socket destroyed before successful response end'})+'\n');this.destroy();return this;
 }
 return end.apply(this,args);
} as typeof end;
