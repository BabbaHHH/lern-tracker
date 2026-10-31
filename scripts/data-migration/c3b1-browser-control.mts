/** Exactly bounded competing operations / block in the named disposable C3b1 fixture. */
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
import {addDays,parseISO} from 'date-fns';
import {localDate} from '../../src/lib/dates';
const root=resolve(process.argv[2]),action=process.argv[3],baseURL=process.argv[4];
if(!/^\/private\/tmp\/stex-c3b1-browser-[a-zA-Z0-9]+$/.test(root)||!['add-task-a','edit-plan-task-a','block-b'].includes(action)||!/^http:\/\/localhost:\d+$/.test(baseURL))throw new Error('Nur eigene künstliche C3b1-Fixture und benannte Aktionen erlaubt.');
const port=Number((await readFile(join(root,'postgres','postmaster.pid'),'utf8')).split('\n')[3]),database=new Database({host:'127.0.0.1',port,user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try{if(action==='block-b')await database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id='c3b1-browser-b'");await c.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id='c3b1-browser-b'");});else{
 const auth=new AccountService({database,files:new PrivateFiles(join(root,'files')),baseURL,secret:(await readFile(join(root,'auth-secret'),'utf8')).trim(),mailKey:(await readFile(join(root,'auth-mail-key'),'utf8')).trim()}),a=new SyntheticAccount(auth,'c3b1-browser-a');await a.auth('/sign-in/email',{email:'c3b1-browser-a@example.test',password:syntheticPassword});const service=new ScheduleService(auth),v=await service.read(a.headers());
 let operation:ScheduleOperation;
 if(action==='add-task-a')operation={type:'task.save',id:'c3b1-concurrent-new',date:localDate(addDays(parseISO(localDate()),1)),title:'C3b1 konkurrierende neue Aufgabe',durationMinutes:15,topicIds:[],isReview:false};
 else{const task=v.records.find(r=>r.kind==='task'&&(r.value as DailyTask).title==='C3b1 Browser-Lernblock')?.value as DailyTask|undefined;if(!task)throw new Error('Künstlicher Plan-Lernblock fehlt.');operation={type:'task.save',id:task.id,date:task.date,title:'C3b1 später bearbeiteter Lernblock',durationMinutes:task.durationMinutes,topicIds:task.linkedTopicIds??(task.linkedTopicId?[task.linkedTopicId]:[]),isReview:task.isReview??false};}
 await service.submit(a.headers(),{contractVersion:1,action:'schedule',requestId:`c3a_c3b1_control_${Date.now()}`,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,operation,expected:scheduleExpected(v,operation)});await a.auth('/sign-out',{});
}console.log('Begrenzte künstliche C3b1-Aktion abgeschlossen.');}finally{await database.close();}
