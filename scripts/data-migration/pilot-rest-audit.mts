/** Read only the named synthetic journey's actual persisted results; no module reacceptance. */
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
const p='docs/entwuerfe/DATA-01/pruefungen/pilot-rest',rt=JSON.parse(await readFile(join(p,'pilot-runtime.json'),'utf8'));
if(rt.root!=='/private/tmp/stex-pilot-data-zYx0a1'||rt.snapshot!=='/private/tmp/stex-pilot-rest-app-PJujsr')throw Error('Unexpected own fixture');
const db=new Database({host:'127.0.0.1',port:rt.port,user:'stex_local',password:(await readFile(join(rt.root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try{
 const accounts=(await db.pool.query('SELECT user_id FROM stex.accounts ORDER BY user_id')).rows.map(r=>r.user_id);if(JSON.stringify(accounts)!==JSON.stringify(['pilot-rest-a','pilot-rest-b']))throw Error('Unexpected accounts');
 const rows=(await db.pool.query("SELECT kind,id,revision,payload,normalized FROM stex.personal_records WHERE owner_user_id='pilot-rest-a' ORDER BY kind,id")).rows;
 const commands=(await db.pool.query("SELECT action,request_id,result->>'operation' AS operation,result->>'state' AS state FROM stex.learning_commands WHERE owner_user_id='pilot-rest-a' ORDER BY created_at,request_id")).rows;
 const bPersonalRows=Number((await db.pool.query("SELECT count(*) AS n FROM stex.personal_records WHERE owner_user_id='pilot-rest-b'")).rows[0].n);
 const forbidden=(await db.pool.query("SELECT count(*)::int AS n FROM stex.learning_commands WHERE action IN ('checkin','correction')")).rows[0].n;
 const versions=(await db.pool.query('SELECT storage_key,sha256,byte_size FROM stex.document_versions UNION ALL SELECT storage_key,sha256,byte_size FROM stex.catalog_document_versions')).rows;
 for(const v of versions)await new PrivateFiles(join(rt.root,'files')).read(v.storage_key,v.sha256,Number(v.byte_size));
 const proof=JSON.parse(await readFile(join(p,'pilot-source-before.json'),'utf8'));const changed:string[]=[];for(const [name,hash] of Object.entries(proof.hashes)){for(const root of ['.',rt.snapshot])if(createHash('sha256').update(await readFile(join(root,name))).digest('hex')!==hash)changed.push(`${root}:${name}`);}
 const log=await readFile(join(p,'pilot-server.log'),'utf8'),aiPostLines=log.split('\n').filter(line=>/POST \/api\/(ai(?:\s|\/)|learning\/(correction|checkin)(?:\s|\/)|docs\/(parse|tag)(?:\s|\/))/.test(line));
 const externalAttemptFile=join(rt.root,'blocked-external-attempts.jsonl');let blockedExternalAttempts=0;try{if((await stat(externalAttemptFile)).size)blockedExternalAttempts=(await readFile(externalAttemptFile,'utf8')).trim().split('\n').length;}catch{}
 await writeFile(join(p,'pilot-persisted-audit.json'),JSON.stringify({recordedAt:new Date().toISOString(),sourceFiles:Object.keys(proof.hashes).length,productDifferences:changed,accounts,rows,commands,privateFileCountVerified:versions.length,forbiddenAiReceiptCount:forbidden,aiPostLines,blockedExternalAttempts,bPersonalRows,pinnedCopyDifferences:changed.filter(x=>!x.startsWith('.:')),laterMainOwnershipChanges:changed.filter(x=>x.startsWith('.:'))},null,2)+'\n');console.log(JSON.stringify({personalRows:rows.length,commands:commands.length,privateFileCountVerified:versions.length,forbiddenAiReceiptCount:forbidden,aiPostCount:aiPostLines.length,blockedExternalAttempts,productDifferences:changed}));
}finally{await db.close();}
