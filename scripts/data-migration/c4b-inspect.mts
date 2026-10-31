/** Read-only evidence for these exact synthetic QA fixtures. Secret files are consumed, never copied or printed. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {Database} from '../../src/lib/server/persistence/database';
import {canonical} from '../../src/lib/data-migration/migration';
const root=resolve(process.argv[2]),stage=process.argv[3];
if(!/^\/private\/tmp\/stex-c4b-(browser|restore)-[a-zA-Z0-9]+$/.test(root)||!/^[-a-z0-9]+$/.test(stage))throw Error('Only own synthetic fixtures and evidence names permitted.');
const port=Number((await readFile(join(root,'postgres/postmaster.pid'),'utf8')).split('\n')[3]);const db=new Database({host:'127.0.0.1',port,user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try{
 const accounts=(await db.pool.query('SELECT user_id FROM stex.accounts ORDER BY user_id')).rows.map(r=>r.user_id);if(JSON.stringify(accounts)!==JSON.stringify(['c4b-browser-a','c4b-browser-b']))throw Error('Unexpected accounts.');
 const tables:Record<string,unknown>={};for(const t of ['personal_records','learning_commands','record_references','catalog_records','catalog_documents','catalog_document_versions','ai_credentials','ai_credential_selections']){const rows=(await db.pool.query(`SELECT to_jsonb(t) AS row FROM stex.${t} t`)).rows.map(r=>canonical(r.row)).sort();tables[t]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}
 const records=(await db.pool.query("SELECT owner_user_id,kind,id,revision,payload,normalized FROM stex.personal_records WHERE kind IN ('draft','notepad','correction-settings','error-profile') ORDER BY owner_user_id,kind,id")).rows;
 const receipts=(await db.pool.query("SELECT owner_user_id,request_id,result->>'operation' AS operation,result->>'draftId' AS id,result->>'state' AS state,result->'feedback'->>'id' AS feedback_id,result->>'draftRevision' AS draft_revision,result->>'profileRevision' AS profile_revision FROM stex.learning_commands WHERE action='correction' ORDER BY created_at,request_id")).rows;
 const calls=await readFile(join(root,'fake-provider-calls.jsonl'),'utf8').then(v=>v.trim().split('\n').filter(Boolean).map(v=>JSON.parse(v))).catch(()=>[]);
 const result={calls,stage,observedAt:new Date().toISOString(),root,accounts,tables,records,receipts};await writeFile(resolve(`docs/entwuerfe/DATA-01/pruefungen/data-c4b-${stage}.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({stage,records:records.map(({kind,id,revision,normalized})=>({kind,id,revision,normalized})),receiptCount:receipts.length,tables}));
}finally{await db.close();}
