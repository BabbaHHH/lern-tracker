/** Only synthetic data for a fresh, disposable C3a restore acceptance. */
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
import {AccountService} from '../../src/lib/server/auth/service';
import {ScheduleService} from '../../src/lib/server/learning/schedule-service';
import {PersonalService} from '../../src/lib/server/learning/personal-service';
import {scheduleExpected,type ScheduleOperation} from '../../src/lib/learning/schedule-contract';
import {profileDraft,profileRevisions} from '../../src/lib/learning/personal-contract';
import {SyntheticAccount,syntheticPassword} from '../pdf-a/fixtures';
import {TOPICS,getLeafTopics} from '../../src/lib/topics';
const root=resolve(process.argv[2]),baseURL=process.argv[3];
if(!/^\/private\/tmp\/stex-c3a-browser-[a-zA-Z0-9]+$/.test(root)||!/^http:\/\/localhost:\d+$/.test(baseURL))throw new Error('Nur eigene synthetische C3a-Fixture erlaubt.');
const port=Number((await readFile(join(root,'postgres','postmaster.pid'),'utf8')).split('\n')[3]);
const database=new Database({host:'127.0.0.1',port,user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try{
 const auth=new AccountService({database,files:new PrivateFiles(join(root,'files')),baseURL,secret:(await readFile(join(root,'auth-secret'),'utf8')).trim(),mailKey:(await readFile(join(root,'auth-mail-key'),'utf8')).trim()}),a=new SyntheticAccount(auth,'c3a-browser-a');
 await a.auth('/sign-in/email',{email:'c3a-browser-a@example.test',password:syntheticPassword});
 const service=new ScheduleService(auth),personal=new PersonalService(auth),topicId=getLeafTopics(TOPICS)[0].id,date='2026-10-13';
 let sequence=0;
 async function write(operation:ScheduleOperation){const v=await service.read(a.headers());return service.submit(a.headers(),{contractVersion:1,action:'schedule',requestId:`c3a_restore_fixture_${++sequence}`,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext,operation,expected:scheduleExpected(v,operation)});}
 const p=await personal.read(a.headers()),fields={...profileDraft(p),bundesland:'Berlin',examDate:'2027-06-01',lernstart:'2026-10-01'};
 const context={contractVersion:1 as const,expectedAccountId:p.account.userId,expectedAccessGeneration:p.account.accessGeneration,expectedSessionContext:p.account.sessionContext};
 await personal.submit(a.headers(),{...context,action:'profile',requestId:'c2_restore_fixture_profile',fields,expectedRevisions:profileRevisions(p)});
 await personal.submit(a.headers(),{...context,action:'note',requestId:'c2_restore_fixture_note',id:'c3a-restore-note',topicId,note:'C3a erhält C2-Lernnotiz',expectedRevision:null});
 await write({type:'task.save',id:'c3a-restore-task',date,title:'C3a Erhaltene Aufgabe',durationMinutes:60,topicIds:[topicId],isReview:false});
 await write({type:'event.save',id:'c3a-restore-event',date,label:'C3a Klausurtermin',eventType:'klausur',recurring:false});
 await write({type:'event.link',id:'c3a-restore-event',klausurId:'c3a-browser-case',taskId:'c3a-restore-written'});
 await write({type:'exam.record',taskId:'c3a-restore-written',trackingId:'c3a-restore-written-tracking',date,klausurId:'c3a-browser-case',klausurMode:'written',topicIds:[topicId],durationMinutes:300,rating:5,note:'C3a geschrieben'});
 await write({type:'exam.record',taskId:'c3a-restore-read',trackingId:'c3a-restore-read-tracking',date,klausurId:'c3a-browser-case',klausurMode:'read',topicIds:[topicId],durationMinutes:120,rating:5,note:'C3a gelesen'});
 await write({type:'event.save',id:'c3a-restore-weekly',date,label:'C3a wöchentliche AG',eventType:'ag',recurring:true,recurringDay:2,durationMinutes:60});
 await write({type:'ag.save',id:'2026-W42',agDays:[2]});
 const final=await service.read(a.headers());
 console.log(JSON.stringify({synthetic:true,records:final.records.length,topicPercent:final.records.find(r=>r.kind==='progress'&&r.id===topicId)?.value,note:final.personal.notes[0]?.value.note}));
 await a.auth('/sign-out',{});
}finally{await database.close();}
