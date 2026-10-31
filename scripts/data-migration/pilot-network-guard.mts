/** Test-only network boundary; no external provider/mail/portal/document fetch allowed. */
import {appendFileSync} from 'node:fs';
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)){const root=process.env.STEX_LOCAL_DATA_DIR;if(root&&/^\/private\/tmp\/stex-pilot-data-[a-zA-Z0-9]+$/.test(root))appendFileSync(`${root}/blocked-external-attempts.jsonl`,JSON.stringify({host:url.hostname})+'\n');throw Error('Pilot integration: external fetch blocked.');}return original(input,init);};
