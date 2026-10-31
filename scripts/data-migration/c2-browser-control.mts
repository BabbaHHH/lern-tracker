/** Synthetic fixture only: independent AUTH session for a competing edit, or a disposable block. */
import { readFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { Database } from '../../src/lib/server/persistence/database';
import { PrivateFiles } from '../../src/lib/server/persistence/files';
import { AccountService } from '../../src/lib/server/auth/service';
import { PersonalService } from '../../src/lib/server/learning/personal-service';
import { profileDraft,profileRevisions } from '../../src/lib/learning/personal-contract';
import { SyntheticAccount,syntheticPassword } from '../pdf-a/fixtures';
import { lockState } from '../../src/lib/server/persistence/repository';
const root=resolve(process.argv[2]),action=process.argv[3],baseURL=process.argv[4];
if(!/^\/private\/tmp\/stex-c2-browser-[a-zA-Z0-9]+$/.test(root)||!['profile-a','note-a','block-b'].includes(action)||!/^http:\/\/localhost:\d+$/.test(baseURL))throw new Error('Nur eigene C2-Testfixture und ausdrücklich begrenzte Aktionen zulässig.');
const port=Number((await readFile(join(root,'postgres','postmaster.pid'),'utf8')).split('\n')[3]);
const database=new Database({host:'127.0.0.1',port,user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try{
  if(action==='block-b')await database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id='c2-browser-b'");await c.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id='c2-browser-b'");});
  else{
    const auth=new AccountService({database,files:new PrivateFiles(join(root,'files')),baseURL,secret:(await readFile(join(root,'auth-secret'),'utf8')).trim(),mailKey:(await readFile(join(root,'auth-mail-key'),'utf8')).trim()});const a=new SyntheticAccount(auth,'c2-browser-a');await a.auth('/sign-in/email',{email:'c2-browser-a@example.test',password:syntheticPassword});
    const service=new PersonalService(auth),v=await service.read(a.headers());const base={contractVersion:1,requestId:`c2_qa_${action}_${Date.now()}`,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext};
    if(action==='profile-a')await service.submit(a.headers(),{...base,action:'profile',fields:{...profileDraft(v),bundesland:'Thüringen'},expectedRevisions:profileRevisions(v)});
    else{const n=v.notes[0];if(!n)throw new Error('Synthetische Notiz fehlt.');await service.submit(a.headers(),{...base,action:'note',id:n.id,topicId:n.value.topicId,note:'C2 konkurrierende Notiz',expectedRevision:n.revision});}
    await a.auth('/sign-out',{});
  }
  console.log('Begrenzte synthetische C2-Aktion abgeschlossen.');
}finally{await database.close();}
