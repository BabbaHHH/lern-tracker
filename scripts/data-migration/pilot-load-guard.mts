/** No external HTTP/DNS/mail/provider calls in this bounded synthetic process tree. */
import {appendFileSync} from 'node:fs';
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)){if(process.env.PILOT_LOAD_PROOF)appendFileSync(process.env.PILOT_LOAD_PROOF+'/blocked.jsonl',JSON.stringify({host:u.hostname})+'\n');throw Error('External fetch blocked by synthetic load probe');}return original(input,init);};
