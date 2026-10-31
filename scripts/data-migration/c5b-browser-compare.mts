/** Read-only comparison of the exact C5b browser dataset and its full restore. */
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
import {canonical,digest,recordKey} from '../../src/lib/data-migration/migration';
const dir='docs/entwuerfe/DATA-01/pruefungen',source=JSON.parse(await readFile(join(dir,'data-c5b-browser-runtime.json'),'utf8')),target=JSON.parse(await readFile(join(dir,'data-c5b-restore-runtime.json'),'utf8'));
if(source.root!=='/private/tmp/stex-c5b-browser-yuyGsF'||target.sourceRoot!==source.root)throw Error('Unexpected own fixture');
async function connect(rt:{root:string;port:number}){return new Database({host:'127.0.0.1',port:rt.port,user:'stex_local',password:(await readFile(join(rt.root,'postgres-password'),'utf8')).trim(),database:'stex_local'});}
const a=await connect(source),b=await connect(target);
try{
 const tables:Record<string,{count:number;sha256:string}>={};for(const t of ['personal_records','document_versions','document_pages','annotations','record_references','learning_commands','catalog_records','catalog_documents','catalog_document_versions']){const read=async(db:Database)=>(await db.pool.query(`SELECT to_jsonb(t) AS row FROM stex.${t} t`)).rows.map(r=>canonical(r.row)).sort();const x=await read(a),y=await read(b);if(canonical(x)!==canonical(y))throw Error('Table mismatch '+t);tables[t]={count:x.length,sha256:digest(x)};}
 const versions=(await a.pool.query('SELECT storage_key,sha256,byte_size FROM stex.document_versions UNION ALL SELECT storage_key,sha256,byte_size FROM stex.catalog_document_versions')).rows;
 for(const v of versions){const read=(rt:{root:string})=>new PrivateFiles(join(rt.root,'files')).read(v.storage_key,v.sha256,Number(v.byte_size));if(!(await read(source)).equals(await read(target)))throw Error('Byte mismatch');}
 const settings=(await b.pool.query("SELECT kind,id,revision,payload FROM stex.personal_records WHERE owner_user_id='c5b-browser-a' AND kind IN ('theme','recommender-settings','prompt','plan-model','reasoning-settings','ai-metrics') ORDER BY kind,id")).rows;
 const metric=settings.find(r=>r.kind==='ai-metrics')!.payload;if(metric.plansApplied!==2||metric.plansUndone!==1||metric.proposalsAccepted!==4||metric.proposalsRejected!==2||metric.future!==17)throw Error('Metric preservation mismatch');
 if(settings.find(r=>r.kind==='theme')!.payload!=='forest'||settings.find(r=>r.kind==='reasoning-settings')!.payload['future/model']!=='future-effort'||settings.find(r=>r.kind==='recommender-settings')!.payload.future.keep!=='synthetic'||!settings.some(r=>r.id==='future-prompt'))throw Error('Opaque setting lost');
 const ref=(await b.pool.query("SELECT path FROM stex.record_references WHERE target_personal_key=$1",[recordKey('document','c5b-browser-a','c5b-existing')])).rows;if(!ref.some(r=>r.path==='value.syntheticDocument'))throw Error('Draft reference lost');
 const ownCommands=(await b.pool.query("SELECT request_id FROM stex.learning_commands WHERE owner_user_id='c5b-browser-a' AND action='settings'")).rows;
 const bRows=Number((await b.pool.query("SELECT count(*) AS n FROM stex.personal_records WHERE owner_user_id='c5b-browser-b' AND kind IN ('theme','recommender-settings','prompt','plan-model','reasoning-settings','ai-metrics')")).rows[0].n);if(bRows!==0)throw Error('B defaults were persisted');
 await writeFile(join(dir,'data-c5b-browser-restore-compare.json'),JSON.stringify({recordedAt:new Date().toISOString(),sourceRoot:source.root,targetRoot:target.root,tables,allTablesEqual:true,filesCompared:versions.length,allFilesEqual:true,settings,metrics:metric,unknownFieldsAndIDsPreserved:true,existingDocumentDraftReferencePreserved:true,settingsCommands:ownCommands.length,settingsRequestIdsUnique:new Set(ownCommands.map(r=>r.request_id)).size===ownCommands.length,bSavedSettingRows:bRows},null,2)+'\n');console.log('Nine tables, all original files, personal settings/counters/opaque values and draft reference preserved. B defaults remain unwritten.');
}finally{await a.close();await b.close();}
