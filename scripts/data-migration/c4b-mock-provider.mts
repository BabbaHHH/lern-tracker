/** Local QA only. Fixed fake replies; all other external fetches denied. No keys or source text in audit. */
import {appendFile} from 'node:fs/promises';
import {join} from 'node:path';
const original=globalThis.fetch;
const content='Synthetisches Feedback: Den Satz kürzer formulieren.\n---MARKER-JSON---\n'+JSON.stringify({markers:[{key:'lange_saetze',label:'Lange Sätze',severity:'mittel'},{key:'praezision',label:'Präzision',severity:'niedrig'}]});
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(['127.0.0.1','localhost','[::1]'].includes(url.hostname))return original(input,init);
 if(url.href!=='https://openrouter.ai/api/v1/chat/completions')throw Error('C4b QA: external request blocked.');
 const h=new Headers(init?.headers);if(!h.get('authorization')?.includes('sk-or-v1-C4B-SYNTHETIC-'))throw Error('C4b QA requires the known synthetic credential.');
 const body=JSON.parse(String(init?.body)),messages=JSON.stringify(body.messages),root=process.env.STEX_LOCAL_DATA_DIR;if(!root||!/^\/private\/tmp\/stex-c4b-(browser|restore)-[A-Za-z0-9]+$/.test(root))throw Error('Unexpected QA root.');
 const mode=messages.includes('C4B QA OFFENER VORGANG')?'pending':messages.includes('C4B QA LANGSAM')?'slow':'normal';
 await appendFile(join(root,'fake-provider-calls.jsonl'),JSON.stringify({kind:'local-fake-correction',mode,model:body.model,ownPrompt:messages.includes('C4b eigene gespeicherte Vorlage'),profileContext:messages.includes('WIEDERKEHRENDE MUSTER'),timestamp:new Date().toISOString()})+'\n');
 if(mode==='pending')await new Promise<void>((_,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new DOMException('QA aborted','AbortError')),{once:true});});
 if(mode==='slow')await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,20000);init?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('QA aborted','AbortError'));},{once:true});});
 return Response.json({choices:[{finish_reason:'stop',message:{content}}]});
};
