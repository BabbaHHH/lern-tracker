import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { Database } from '../../src/lib/server/persistence/database';
import { lockState } from '../../src/lib/server/persistence/repository';
const info=JSON.parse(await readFile('/tmp/pdf-a-qa-info.json','utf8'));
if(!basename(info.root).startsWith('stex-pdf-a-browser-') || info.port!==55466)throw new Error('Keine isolierte PDF-Testinstanz.');
const password=(await readFile(join(info.root,'postgres-password'),'utf8')).trim();
const db=new Database({host:'127.0.0.1',port:info.port,user:'stex_local',password,database:'stex_local'});
try {
  await db.transaction(async client=>{
    await lockState(client);
    const check=await client.query("SELECT 1 FROM stex.accounts WHERE user_id='pdf-browser-b'");
    if(check.rowCount!==1)throw new Error('Synthetisches Testkonto fehlt.');
    await client.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id='pdf-browser-b'");
    await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id='pdf-browser-b'");
  });
  console.log('Synthetisches B-Konto gesperrt.');
}finally{await db.close();}
