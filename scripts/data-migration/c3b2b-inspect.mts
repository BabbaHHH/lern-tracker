/** Read-only evidence for the own synthetic browser fixture; no payloads/credentials printed. */
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Database} from '../../src/lib/server/persistence/database';
import {digest} from '../../src/lib/data-migration/migration';
const [root,stage]=process.argv.slice(2);
if(!/^\/private\/tmp\/stex-c3b2b-(browser|restore)-[a-zA-Z0-9]+$/.test(root)||!/^[a-z0-9-]+$/.test(stage))throw Error('Only own synthetic fixture');
const db=new Database({host:'127.0.0.1',port:Number((await readFile(join(root,'postgres/postmaster.pid'),'utf8')).split('\n')[3]),user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try{
 const users=(await db.pool.query('SELECT user_id FROM stex.accounts ORDER BY user_id')).rows.map(r=>r.user_id);
 if(JSON.stringify(users)!==JSON.stringify(['c3b2b-browser-a','c3b2b-browser-b','c3b2b-browser-pending']))throw Error('Unexpected fixture users');
 const tables:Record<string,{count:number;sha256:string}>={};
 for(const table of ['personal_records','learning_commands','record_references','catalog_records','catalog_documents','catalog_document_versions','ai_credentials','ai_credential_selections']){const rows=(await db.pool.query(`SELECT to_jsonb(t) AS value FROM stex.${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.value);tables[table]={count:rows.length,sha256:digest(rows)};}
 const progress=(await db.pool.query("SELECT owner_user_id,id,revision,payload->>'percent' AS percent,payload->>'source' AS source FROM stex.personal_records WHERE kind='progress' ORDER BY owner_user_id,id")).rows;
 const checkin=(await db.pool.query("SELECT request_id,result->>'operation' AS operation,result->>'state' AS state FROM stex.learning_commands WHERE action='checkin' ORDER BY created_at")).rows;
 let calls:unknown[]=[];try{calls=(await readFile(join(root,'fake-provider-calls.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));}catch{}
 const result={stage,observedAt:new Date().toISOString(),root,tables,progress,checkin,localFakeCalls:calls};
 await writeFile(resolve(`docs/entwuerfe/DATA-01/pruefungen/data-c3b2b-${stage}.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({stage,progress,checkin,localFakeCalls:calls.length}));
}finally{await db.close();}
