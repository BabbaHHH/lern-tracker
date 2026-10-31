/** One source-only disposable QA copy for the bounded selection review. */
import {cp,mkdtemp,writeFile,readFile,mkdir,symlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const base=resolve('.'),root=await mkdtemp('/private/tmp/stex-c4b-selection-');
for(const dir of ['src','public','db/migrations'])await cp(join(base,dir),join(root,dir),{recursive:true});
for(const file of ['package.json','package-lock.json','next-env.d.ts','tsconfig.json','next.config.ts','postcss.config.mjs','eslint.config.mjs'])await cp(join(base,file),join(root,file));
await symlink(join(base,'node_modules'),join(root,'node_modules'),'dir');
const config=JSON.parse(await readFile(join(root,'tsconfig.json'),'utf8'));config.compilerOptions.incremental=false;config.include=['next-env.d.ts','src/**/*.ts','src/**/*.tsx','.next/types/**/*.ts','.next-qa/types/**/*.ts'];config.exclude=['node_modules'];await writeFile(join(root,'tsconfig.json'),JSON.stringify(config,null,2)+'\n');
const page=join(root,'src/app/c4b-selection-qa');await mkdir(page,{recursive:true});
await writeFile(join(page,'page.tsx'),`'use client';
import {useEffect,useRef,useState} from 'react';
import type {Editor} from '@tiptap/react';
import {KlausurEditor} from '@/components/klausur-editor';
import {AccountCorrectionPanel} from '@/components/account-correction-panel';
import {CorrectionContext} from '@/lib/learning/use-account-correction';
import {CorrectionClient} from '@/lib/learning/correction-client';
import type {CorrectionCommand,CorrectionView} from '@/lib/learning/correction-contract';
const repeated='ERSTER VORLAUF. Gleich. ERSTER NACHLAUF. ZWEITER VORLAUF.  Gleich.  ZWEITER NACHLAUF.';
const account={userId:'c4b-selection-synthetic',accessGeneration:1,sessionContext:'a'.repeat(64)};
export default function QA(){
 const editor=useRef<Editor|null>(null),text=useRef('a a');const [confirmed,setConfirmed]=useState('a a'),[audit,setAudit]=useState('Noch kein Aufruf'),[posts,setPosts]=useState(0),[selection,setSelection]=useState('');
 const [client]=useState(()=>new CorrectionClient(async(_path,init)=>{
  const view:CorrectionView={contractVersion:1,account,settings:{model:'synthetic/local-only',granularity:'manuell'},settingsRevision:null,settingsDefault:true,legacyModelUpgraded:false,profile:null,profileRevision:null,promptDefaults:true,reasoningDefault:true,issues:[],snapshot:'b'.repeat(64),draftId:'selection-draft',draftRevision:1,deleted:false,recent:[]};
  if(init?.method!=='POST')return Response.json(view);
  const cmd=JSON.parse(String(init.body)) as CorrectionCommand;if(cmd.operation!=='run')throw Error('Selection QA only');setPosts(n=>n+1);
  const response=await fetch('/api/c4b-selection-qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text.current,focus:cmd.focus})});const result=await response.json();if(!response.ok)throw Error('Local source validation rejected');setAudit(JSON.stringify({submitted:cmd.focus,server:result.focus},null,2));
  return Response.json({contractVersion:1,action:'correction',account,requestId:cmd.requestId,operation:'run',state:'applied',createdAt:'2026-10-16T14:00:00Z',message:'Lokale Auswahlprüfung bestätigt; kein Provider, keine Speicherung.',replay:false,sourceDraftRevision:1,feedback:{id:'c4b-selection-only',scope:result.focus.scope,excerpt:result.focus.focus,feedbackText:JSON.stringify(result.focus,null,2),markers:[],model:'synthetic/local-only',createdAt:'2026-10-16T14:00:00Z'}});
 }));
 useEffect(()=>()=>client.dispose(),[client]);
 function fixture(value:string){text.current=value;setConfirmed(value);editor.current?.commands.setContent({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:value}]}]});setAudit('Neue synthetische Quelle');}
 function selectSecond(){const e=editor.current;if(!e)return;const start=text.current==='a a'?2:text.current.lastIndexOf('Gleich.')-2,end=text.current==='a a'?3:start+10;e.commands.setTextSelection({from:start+1,to:end+1});setSelection(JSON.stringify({from:e.state.selection.from,to:e.state.selection.to,selected:e.state.doc.textBetween(e.state.selection.from,e.state.selection.to)}));}
 return <main className="p-6 space-y-4"><h1>C4b begrenzte Auswahlprüfung</h1><p>Ausschließlich künstlicher Text, echte Editor-/Panelzuordnung und reiner Serverfokus; keine Datenbank und kein KI-Anbieter.</p><div className="flex gap-4"><button onClick={()=>fixture('a a')}>Fall a a</button><button onClick={()=>fixture(repeated)}>Fall wiederholter Satz</button><button onClick={selectSecond}>Zweite Stelle im Editor markieren</button><button onClick={()=>setConfirmed(text.current+' ')}>Bestätigten Vergleich abweichen lassen</button></div><p>Lokale Aufrufe: {posts}</p><pre aria-label="Tatsächliche Editorauswahl">{selection}</pre><KlausurEditor label="Synthetischer Auswahltext" initialContent="<p>a a</p>" onReady={e=>{editor.current=e;}} onUpdate={()=>{}}/><pre aria-label="Auswahlprüfung Ergebnis" className="whitespace-pre-wrap">{audit}</pre><CorrectionContext.Provider value={client}><AccountCorrectionPanel account={account} draftId="selection-draft" confirmedText={confirmed} confirmed confirmedRevision={1} editor={editor}/></CorrectionContext.Provider></main>;
}
`);
const api=join(root,'src/app/api/c4b-selection-qa');await mkdir(api,{recursive:true});
await writeFile(join(api,'route.ts'),`import {correctionMessages,resolveCorrection,type CorrectionRow} from '@/lib/server/learning/correction-context';
import {KORREKTUR_MASTER_PROMPT_ID,resolveKlausurtypPromptId} from '@/lib/prompts';
export async function POST(request:Request){const {text,focus}=await request.json();if(typeof text!=='string'||text.length>1000||focus?.mode!=='manuell')return Response.json({}, {status:400});const draft:CorrectionRow={kind:'draft',id:'selection-draft',revision:1,payload:{contentText:text,contentHtml:'<p>'+text+'</p>',feedback:[],area:'zr',type:'Urteil'},normalized:{},legacy_key:'test'};const source={rows:[draft],refs:[],draft,settings:undefined,profile:undefined,ids:[KORREKTUR_MASTER_PROMPT_ID,resolveKlausurtypPromptId('Urteil')]};try{return Response.json(correctionMessages(source,resolveCorrection(source),focus));}catch{return Response.json({}, {status:400});}}
`);
await writeFile(resolve('docs/entwuerfe/DATA-01/pruefungen/data-c4b-selection-copy.json'),JSON.stringify({root,testOnlyRoutes:['/c4b-selection-qa','/api/c4b-selection-qa'],database:false,provider:false},null,2)+'\n');console.log(root);
