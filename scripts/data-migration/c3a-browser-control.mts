/** Competing authenticated edit / block in the named disposable C3a fixture only. */
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
import {AccountService} from '../../src/lib/server/auth/service';
import {ScheduleService} from '../../src/lib/server/learning/schedule-service';
import {scheduleExpected,type ScheduleOperation} from '../../src/lib/learning/schedule-contract';
import type {DailyTask} from '../../src/lib/store';
import {SyntheticAccount,syntheticPassword} from '../pdf-a/fixtures';
import {lockState} from '../../src/lib/server/persistence/repository';
const root=resolve(process.argv[2]),action=process.argv[3],baseURL=process.argv[4];
if(!/^\/private\/tmp\/stex-c3a-browser-[a-zA-Z0-9]+$/.test(root)||!['task-a','block-b'].includes(action)||!/^http:\/\/localhost:\d+$/.test(baseURL))throw new Error('Nur die eigene synthetische C3a-Fixture und begrenzte Aktionen sind zulässig.');
const port=Number((await readFile(join(root,'postgres','postmaster.pid'),'utf8')).split('\n')[3]);const database=new Database({host:'127.0.0.1',port,user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try{if(action==='block-b')await database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id='c3a-browser-b'");await c.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id='c3a-browser-b'");});else{
 const auth=new AccountService({database,files:new PrivateFiles(join(root,'files')),baseURL,secret:(await readFile(join(root,'auth-secret'),'utf8')).trim(),mailKey:(await readFile(join(root,'auth-mail-key'),'utf8')).trim()}),a=new SyntheticAccount(auth,'c3a-browser-a');await a.auth('/sign-in/email',{email:'c3a-browser-a@example.test',password:syntheticPassword});const service=new ScheduleService(auth),v=await service.read(a.headers());const task=v.records.find(r=>r.kind==='task'&&(r.value as DailyTask).title.includes('Erhaltene'))?.value as DailyTask|undefined;if(!task)throw new Error('Synthetische Erhaltene-Aufgabe fehlt.');const operation:ScheduleOperation={type:'task.save',id:task.id,date:task.date,title:'C3a Konkurrenzstand',durationMinutes:task.durationMinutes,topicIds:task.linkedTopicIds??[],isReview:task.isReview??false};await service.submit(a.headers(),{contractVersion:1,action:'schedule',requestId:`c3a_qa_${Date.now()}`,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,operation,expected:scheduleExpected(v,operation)});await a.auth('/sign-out',{});
}console.log('Begrenzte synthetische C3a-Aktion abgeschlossen.');}finally{await database.close();}
