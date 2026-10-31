/** Local in-process fake provider for disposable browser/build fixtures. No external fetch can escape. */
import {appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {TOPICS,getLeafTopics} from '../../src/lib/topics';
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const address=input instanceof Request?input.url:String(input),url=new URL(address);
 if(url.hostname==='openrouter.ai'){
  if(url.pathname.endsWith('/chat/completions')){
   const body=JSON.parse(String(init?.body)),messages=body.messages as {role:string;content:string}[];
   const root=process.env.STEX_LOCAL_DATA_DIR;
   if(!root||!/^\/private\/tmp\/stex-c3b2b-(browser|restore)-[a-zA-Z0-9]+$/.test(root))throw Error('Fake provider requires own disposable test root');
   await appendFile(join(root,'fake-provider-calls.jsonl'),JSON.stringify({kind:'local-fake-completion',model:body.model,hasConfirmedTasks:messages[0].content.includes('C3b2a manuell belegter Tag'),containsDocumentUnavailable:messages[0].content.includes('Quelltexte sind im Konto-Check-in noch nicht angeschlossen'),timestamp:new Date().toISOString()})+'\n');
   const last=messages.at(-1)!.content;if(last.includes('langsam'))await new Promise(r=>setTimeout(r,4000));
   const leaves=getLeafTopics(TOPICS),percent=last.includes('ungültig')?101:65;
   return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({message:'Lokale Testantwort: Du hast Fälle aktiv gelöst. Prüfe die beiden Vorschläge und bestätige sie bewusst.',progressSuggestions:[{topicId:leaves[0].id,percent},{topicId:leaves[1].id,percent:35}]})}}]});
  }
  return Response.json({data:{is_management_key:false,is_provisioning_key:false,limit:100,limit_remaining:100,limit_reset:null,is_free_tier:false}});
 }
 if(!['localhost','127.0.0.1','::1'].includes(url.hostname))return new Response('Synthetic QA blocks outbound requests',{status:503});
 return original(input,init);
};
