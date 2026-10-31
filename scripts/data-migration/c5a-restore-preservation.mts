/** Read-only final assertions against the same synthetic browser restore. */
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Database} from '../../src/lib/server/persistence/database';
const p='docs/entwuerfe/DATA-01/pruefungen';
const rt=JSON.parse(await readFile(join(p,'data-c5a-restore-runtime.json'),'utf8'));
if(rt.sourceRoot!=='/private/tmp/stex-c5a-browser-aV9rqG'||rt.root!=='/private/tmp/stex-c5a-restore-gxKbvE')throw Error('Unexpected test target');
const db=new Database({host:'127.0.0.1',port:rt.port,user:'stex_local',password:(await readFile(join(rt.root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try {
 const doc=(await db.pool.query("SELECT * FROM stex.personal_records WHERE owner_user_id='c5a-browser-a' AND kind='document' AND id='c5a-existing'")).rows[0];
 const before=JSON.parse(await readFile(join(p,'data-c5a-null-source-fixture.json'),'utf8')).before;
 const keys=['textContent','summary','unknownPrivate'];for(const k of keys)if(JSON.stringify(doc.payload[k])!==JSON.stringify(before.payload[k]))throw Error('Lost old payload '+k);
 const refs=(await db.pool.query('SELECT path FROM stex.record_references WHERE target_personal_key=$1',[doc.record_key])).rows;
 if(!doc.normalized.c5aDeleted||refs.length!==1||refs[0].path!=='value.syntheticDocument')throw Error('Tombstone/reference mismatch');
 const versions=(await db.pool.query('SELECT count(*)::int AS n FROM stex.document_versions WHERE record_key=$1',[doc.record_key])).rows[0].n;if(versions!==2)throw Error('Original missing');
 const receipts=(await db.pool.query("SELECT request_id,result->>'status' AS status,result->'document'->>'revision' AS revision FROM stex.learning_commands WHERE owner_user_id='c5a-browser-a' AND action='documents' ORDER BY created_at DESC")).rows;
 if(receipts.length!==9||receipts.some(r=>r.status!=='committed')||receipts[0].revision!=='6')throw Error('Receipt/revision mismatch');
 await writeFile(join(p,'data-c5a-restore-preservation.json'),JSON.stringify({recordedAt:new Date().toISOString(),legacyPayloadKeysEqual:keys,tombstone:true,preservedOriginalVersions:versions,preservedDraftReference:refs[0].path,documentReceipts:receipts.length,allCommitted:true,responseLossRequestId:receipts[0].request_id,responseLossDocumentRevision:6,noDuplicateResponseLossReceipt:receipts.filter(r=>r.request_id===receipts[0].request_id).length===1},null,2)+'\n');console.log('Legacy payload, draft reference, originals and nine unique committed document receipts preserved.');
}finally{await db.close();}
