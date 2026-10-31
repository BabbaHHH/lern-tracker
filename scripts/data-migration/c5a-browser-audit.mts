/** Narrow synthetic-state probes on the preserved C5a dataset, never new seeding. */
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
import {lockState} from '../../src/lib/server/persistence/repository';
import {canonical,digest,recordKey} from '../../src/lib/data-migration/migration';
const mode=process.argv[2],root='/private/tmp/stex-c5a-browser-aV9rqG',out='docs/entwuerfe/DATA-01/pruefungen';
async function connect(root:string,port:number){return new Database({host:'127.0.0.1',port,user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});}
const db=await connect(root,64213);
const tables=['personal_records','document_versions','document_pages','annotations','record_references','learning_commands','catalog_records','catalog_documents','catalog_document_versions'];
async function snapshot(database:Database){const result:Record<string,{count:number;sha256:string}>={};for(const t of tables){const rows=(await database.pool.query(`SELECT to_jsonb(t) AS row FROM stex.${t} t`)).rows.map(r=>canonical(r.row)).sort();result[t]={count:rows.length,sha256:digest(rows)};}return result;}
try {
 const accounts=(await db.pool.query('SELECT user_id FROM stex.accounts ORDER BY user_id')).rows.map(r=>r.user_id);if(JSON.stringify(accounts)!==JSON.stringify(['c5a-browser-a','c5a-browser-b']))throw Error('Unexpected accounts');
 if(mode==='null-source'){
  const proof=await db.transaction(async c=>{await lockState(c);const key=recordKey('document','c5a-browser-a','c5a-existing');const before=(await c.query('SELECT * FROM stex.personal_records WHERE record_key=$1',[key])).rows[0];if(before.revision!==2||!before.payload.textContent||!before.normalized.c5aSourceVersionId)throw Error('Unexpected existing synthetic document');const after=(await c.query("UPDATE stex.personal_records SET normalized=normalized||'{\"documentVersionId\":null,\"c5aSourceVersionId\":null}'::jsonb,revision=revision+1 WHERE record_key=$1 RETURNING *",[key])).rows[0];await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');return{before,after};});
  await writeFile(join(out,'data-c5a-null-source-fixture.json'),JSON.stringify({recordedAt:new Date().toISOString(),scope:'Only existing artificial document mapping; originals and references unchanged; no reseed',...proof},null,2)+'\n');console.log('Existing synthetic text now has explicitly unknown current/source mapping.');
 }else if(mode==='capture'){
  const result=await snapshot(db);await writeFile(join(out,'data-c5a-browser-source-tables.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }else if(mode==='compare'){
  const target=JSON.parse(await readFile(join(out,'data-c5a-restore-runtime.json'),'utf8'));if(target.sourceRoot!==root||!target.root.startsWith('/private/tmp/stex-c5a-restore-'))throw Error('Wrong restore target');
  const restored=await connect(target.root,target.port);try{const source=await snapshot(db),copy=await snapshot(restored);if(canonical(source)!==canonical(copy))throw Error('Restore table mismatch');const versions=(await db.pool.query('SELECT storage_key,sha256,byte_size FROM stex.document_versions UNION ALL SELECT storage_key,sha256,byte_size FROM stex.catalog_document_versions')).rows;for(const r of versions){const a=await new PrivateFiles(join(root,'files')).read(r.storage_key,r.sha256,Number(r.byte_size)),b=await new PrivateFiles(join(target.root,'files')).read(r.storage_key,r.sha256,Number(r.byte_size));if(!a.equals(b))throw Error('Restore file mismatch');}await writeFile(join(out,'data-c5a-browser-restore-compare.json'),JSON.stringify({recordedAt:new Date().toISOString(),sourceRoot:root,targetRoot:target.root,tables:source,allTablesEqual:true,filesCompared:versions.length,allFilesEqual:true},null,2)+'\n');console.log('Nine tables and all '+versions.length+' original files identical.');}finally{await restored.close();}
 }else throw Error('Unknown audit mode');
}finally{await db.close();}
