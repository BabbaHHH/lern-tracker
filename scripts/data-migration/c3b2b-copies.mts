/** Copy only public source/config into own isolated QA checkouts; never .env or private inputs. */
import {cp,mkdtemp,writeFile,readFile,mkdir,symlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const base=resolve('.');const paths:Record<string,string>={};
for(const name of ['app','restore','build']){
 const root=await mkdtemp(`/private/tmp/stex-data-c3b2b-${name}-`);paths[name]=root;
 for(const directory of ['src','public','db/migrations'])await cp(join(base,directory),join(root,directory),{recursive:true});
 for(const file of ['package.json','package-lock.json','next-env.d.ts','tsconfig.json','next.config.ts','postcss.config.mjs','eslint.config.mjs'])await cp(join(base,file),join(root,file));
 await symlink(join(base,'node_modules'),join(root,'node_modules'),'dir');
 const config=JSON.parse(await readFile(join(root,'tsconfig.json'),'utf8'));config.compilerOptions.incremental=false;config.include=['next-env.d.ts','src/**/*.ts','src/**/*.tsx','.next/types/**/*.ts','.next-qa/types/**/*.ts'];config.exclude=['node_modules'];await writeFile(join(root,'tsconfig.json'),JSON.stringify(config,null,2)+'\n');
}
const sentinel=join(paths.app,'src/app/konto/c3b2b-test-sentinel');await mkdir(sentinel,{recursive:true});
await writeFile(join(sentinel,'page.tsx'),`'use client';
import {useState} from 'react';
const keys=['lerntracker-progress','lerntracker-prompts','lerntracker-ai-reasoning','lerntracker-tasks','lerntracker-calendar','lerntracker-tracking','lerntracker-ag-weeks','lerntracker-onboarding-airesult','lerntracker-plan-history','lerntracker-plan-applied-range'];
const value=JSON.stringify({onlySynthetic:'C3b2b ALT-UNVERAENDERT'});
export default function Sentinel(){const [message,setMessage]=useState('Nur künstliche Altkeys am isolierten Testorigin.');return <main><h1>C3b2b künstliche Altkeys</h1><button onClick={()=>{keys.forEach(k=>localStorage.setItem(k,value));setMessage('Zehn künstliche Altkeys gesetzt.');}}>Testkeys setzen</button><button onClick={()=>setMessage(keys.every(k=>localStorage.getItem(k)===value)?'Alle zehn künstlichen Altkeys unverändert.':'Testkeyabweichung.')}>Testkeys vergleichen</button><p role="status">{message}</p></main>;}
`);
await writeFile(resolve('docs/entwuerfe/DATA-01/pruefungen/data-c3b2b-copies.json'),JSON.stringify(paths,null,2)+'\n');console.log(JSON.stringify(paths));
