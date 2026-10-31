import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const hashes:Record<string,string>={};
async function walk(p:string){for(const x of await readdir(p,{withFileTypes:true})){const f=join(p,x.name);if(x.isDirectory())await walk(f);else if(x.isFile())hashes[f]=createHash('sha256').update(await readFile(f)).digest('hex');}}
await walk('src');await walk('db/migrations');for(const f of ['package.json','package-lock.json'])hashes[f]=createHash('sha256').update(await readFile(f)).digest('hex');
await mkdir('docs/entwuerfe/DATA-01/pruefungen',{recursive:true});await writeFile('docs/entwuerfe/DATA-01/pruefungen/data-c5a-source-before.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});console.log(Object.keys(hashes).length);
