/** One bounded competing write through actual C3a, exclusively in own C3b2a fixture. No blocking action. */
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
import {AccountService} from '../../src/lib/server/auth/service';
import {ScheduleService} from '../../src/lib/server/learning/schedule-service';
import {scheduleExpected} from '../../src/lib/learning/schedule-contract';
import {SyntheticAccount,syntheticPassword} from '../pdf-a/fixtures';
import {isDateOnly} from '../../src/lib/dates';
const root=resolve(process.argv[2]),baseURL=process.argv[3],date=process.argv[4];
if(!/^\/private\/tmp\/stex-c3b2a-browser-[a-zA-Z0-9]+$/.test(root)||!/^http:\/\/localhost:\d+$/.test(baseURL)||!isDateOnly(date))throw Error('Nur eigene benannte synthetische C3b2a-Fixture erlaubt.');
const port=Number((await readFile(join(root,'postgres/postmaster.pid'),'utf8')).split('\n')[3]),database=new Database({host:'127.0.0.1',port,user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try{
 const auth=new AccountService({database,files:new PrivateFiles(join(root,'files')),baseURL,secret:(await readFile(join(root,'auth-secret'),'utf8')).trim(),mailKey:(await readFile(join(root,'auth-mail-key'),'utf8')).trim()}),a=new SyntheticAccount(auth,'c3b2a-browser-a');await a.auth('/sign-in/email',{email:'c3b2a-browser-a@example.test',password:syntheticPassword});
 const schedule=new ScheduleService(auth),v=await schedule.read(a.headers());const operation={type:'task.save' as const,id:'prep-browser-concurrent',date,title:'C3b2a konkurrierende manuelle Verpflichtung',durationMinutes:120,topicIds:[],isReview:false};
 await schedule.submit(a.headers(),{contractVersion:1,action:'schedule',requestId:`c3a_c3b2a_competing_${Date.now()}`,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,operation,expected:scheduleExpected(v,operation)});await a.auth('/sign-out',{});console.log('Künstliche konkurrierende Verpflichtung gespeichert.');
}finally{await database.close();}
