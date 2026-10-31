/** Test-only: no external AI, mail, portal or document requests from this QA runtime. */
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('C4a QA: external fetch is prohibited.');return original(input,init);};
