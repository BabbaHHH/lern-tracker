/** Own source-only QA copies. No environment files, secrets or private learning inputs. */
import {cp,mkdtemp,writeFile,readFile,mkdir,symlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const base=resolve('.'),paths:Record<string,string>={};
for(const role of ['app','restore','build']){
 const root=await mkdtemp(`/private/tmp/stex-data-c4a-${role}-`);paths[role]=root;
 for(const dir of ['src','public','db/migrations'])await cp(join(base,dir),join(root,dir),{recursive:true});
 for(const f of ['package.json','package-lock.json','next-env.d.ts','tsconfig.json','next.config.ts','postcss.config.mjs','eslint.config.mjs'])await cp(join(base,f),join(root,f));
 await symlink(join(base,'node_modules'),join(root,'node_modules'),'dir');
 const config=JSON.parse(await readFile(join(root,'tsconfig.json'),'utf8'));config.compilerOptions.incremental=false;config.include=['next-env.d.ts','src/**/*.ts','src/**/*.tsx','.next/types/**/*.ts','.next-qa/types/**/*.ts'];config.exclude=['node_modules'];await writeFile(join(root,'tsconfig.json'),JSON.stringify(config,null,2)+'\n');
}
const dir=join(paths.app,'src/app/konto/c4a-test');await mkdir(dir,{recursive:true});
await writeFile(join(dir,'page.tsx'),`'use client';
import {useState} from 'react';
import Link from 'next/link';
interface Audit {reads:number;writes:number;external:number;mode:string;delay:number}
declare global {interface Window {c4aAudit?:Audit}}
export default function QA(){const [message,setMessage]=useState('Nur synthetischer C4a-Testorigin.');return <main className="p-8 space-y-4"><h1>C4a lokale Transport- und Altkeyprüfung</h1><button onClick={()=>{if(window.c4aAudit)return;const audit:Audit={reads:0,writes:0,external:0,mode:'normal',delay:0};window.c4aAudit=audit;const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k.startsWith('lerntracker-'))audit.reads++;return get.call(this,k);};Storage.prototype.setItem=function(k,v){if(k.startsWith('lerntracker-'))audit.writes++;return set.call(this,k,v);};const original=window.fetch.bind(window);window.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin);if(url.origin!==location.origin){audit.external++;throw Error('Externe QA-Anfrage blockiert.');}const writing=url.pathname==='/api/learning/writing'&&init?.method==='POST',mode=writing?audit.mode:'normal';if(writing)audit.mode='normal';const result=await original(input,init);if(writing&&mode==='drop')throw Error('C4a synthetic response loss after real server commit');if(writing&&mode==='delay')await new Promise(r=>setTimeout(r,20000));return result;};setMessage('Altkeyzähler aktiv. Externe fetch-Aufrufe blockiert.');}}>Prüfung aktivieren</button><button onClick={()=>{if(window.c4aAudit){window.c4aAudit.mode='drop';setMessage('Nächste Schreibantwort wird nach echtem Serverabschluss verworfen.');}}}>Nächste Schreibantwort verlieren</button><button onClick={()=>{if(window.c4aAudit){window.c4aAudit.mode='delay';setMessage('Nächste Schreibantwort wird 20 Sekunden zurückgehalten.');}}}>Nächste Schreibantwort verzögern</button><button onClick={()=>setMessage(JSON.stringify(window.c4aAudit??{}))}>Prüfwerte anzeigen</button><p role="status">{message}</p><Link href="/schreiben">Zu Entwürfen</Link><Link className="ml-4" href="/schreiben/notizblock">Zum Notizblock</Link></main>;}
`);
await writeFile(resolve('docs/entwuerfe/DATA-01/pruefungen/data-c4a-copies.json'),JSON.stringify(paths,null,2)+'\n');console.log(JSON.stringify(paths));
