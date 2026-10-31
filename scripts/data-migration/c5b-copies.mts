/** Own source-only QA copies. No environment files, secrets or private learning inputs. */
import {cp,mkdtemp,writeFile,readFile,symlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const base=resolve('.'),paths:Record<string,string>={};
for(const role of ['app','restore','build']){
 const root=await mkdtemp(`/private/tmp/stex-data-c5b-${role}-`);paths[role]=root;
 for(const dir of ['src','public','db/migrations'])await cp(join(base,dir),join(root,dir),{recursive:true});
 for(const f of ['package.json','package-lock.json','next-env.d.ts','tsconfig.json','next.config.ts','postcss.config.mjs','eslint.config.mjs'])await cp(join(base,f),join(root,f));
 await symlink(join(base,'node_modules'),join(root,'node_modules'),'dir');
 const config=JSON.parse(await readFile(join(root,'tsconfig.json'),'utf8'));config.compilerOptions.incremental=false;config.include=['next-env.d.ts','src/**/*.ts','src/**/*.tsx','.next/types/**/*.ts','.next-qa/types/**/*.ts'];config.exclude=['node_modules'];await writeFile(join(root,'tsconfig.json'),JSON.stringify(config,null,2)+'\n');
}
await writeFile(resolve('docs/entwuerfe/DATA-01/pruefungen/data-c5b-copies.json'),JSON.stringify(paths,null,2)+'\n');console.log(JSON.stringify(paths));
