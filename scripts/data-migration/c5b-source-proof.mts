import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const suffix=process.argv[2]??'final';if(!/^[a-z-]+$/.test(suffix))throw Error('Invalid proof name');
const directory='docs/entwuerfe/DATA-01/pruefungen',hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),current:Record<string,string>={};
async function walk(p:string){for(const x of await readdir(p,{withFileTypes:true})){const f=join(p,x.name);if(x.isDirectory())await walk(f);else if(x.isFile())current[f]=hash(await readFile(f));}}
await walk('src');await walk('db/migrations');for(const f of ['package.json','package-lock.json'])current[f]=hash(await readFile(f));
const before=JSON.parse(await readFile(join(directory,'data-c5b-source-before.json'),'utf8')) as Record<string,string>;
const copies=JSON.parse(await readFile(join(directory,'data-c5b-copies.json'),'utf8')) as Record<string,string>;
const comparisons:Record<string,string[]>={};for(const [role,root] of Object.entries(copies)){comparisons[role]=[];for(const [f,sha] of Object.entries(current)){try{if(hash(await readFile(join(root,f)))!==sha)comparisons[role].push(f);}catch{comparisons[role].push(f+':missing');}}}
const changed=Object.keys(before).filter(f=>current[f]!==before[f]),added=Object.keys(current).filter(f=>!Object.hasOwn(before,f));
const proof={recordedAt:new Date().toISOString(),count:Object.keys(current).length,baselineCount:Object.keys(before).length,changed,added,comparisons,hashes:current,testsHash:hash(await readFile('tests/learning-documents.test.ts')),scope:'C5b product/source identity only; browser and restore evidence are recorded separately'};
await writeFile(join(directory,`data-c5b-source-${suffix}.json`),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({count:proof.count,changed,added,comparisons},null,2));
if(Object.values(comparisons).some(v=>v.length))process.exitCode=1;
