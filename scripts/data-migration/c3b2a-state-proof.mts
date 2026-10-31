/** Read-only source/restore equality proof. Print only counts and hashes, never private values. */
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Database} from '../../src/lib/server/persistence/database';
const roots=['/private/tmp/stex-c3b2a-browser-4Mxty7','/private/tmp/stex-c3b2a-restore-29U1XV'];
const tables=['personal_records','learning_commands','record_references','catalog_records','catalog_documents','catalog_document_versions'];
const dig=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const states:Record<string,{count:number;sha256:string}>[]=[];
for(const root of roots){
 const lines=(await readFile(join(root,'postgres/postmaster.pid'),'utf8')).split('\n');
 const db=new Database({host:'127.0.0.1',port:Number(lines[3]),user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
 try{
  const users=(await db.pool.query<{user_id:string}>('SELECT user_id FROM stex.accounts ORDER BY user_id')).rows.map(r=>r.user_id);
  if(JSON.stringify(users)!==JSON.stringify(['c3b2a-browser-a','c3b2a-browser-b','c3b2a-browser-pending']))throw Error('Unerwartete Konten in eigener Fixture.');
  const state:Record<string,{count:number;sha256:string}>={};
  for(const table of tables){const rows=(await db.pool.query(`SELECT to_jsonb(t) AS value FROM stex.${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.value);state[table]={count:rows.length,sha256:dig(rows)};}
  states.push(state);
 }finally{await db.close();}
}
const same=JSON.stringify(states[0])===JSON.stringify(states[1]);
const result={sameActuallyEditedDataset:same,sourceAndRestoredTables:states,authSessionsExcludedBecauseNewLoginRequired:true,valuesNeverPrinted:true};
await writeFile(resolve('docs/entwuerfe/DATA-01/pruefungen/data-c3b2a-restore-datenabgleich.json'),JSON.stringify(result,null,2)+'\n');
if(!same)throw Error('Source-/Restore-Fachwerte unterscheiden sich.');console.log('Eigene Source-/Restore-Fachwerte: gleiche Zeilenanzahlen und SHA-256, einschließlich vollständiger Belege/Referenzen.');
