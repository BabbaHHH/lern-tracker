/** Seed only the named disposable C3b1 browser cluster, with genuine AUTH/C1/C2/C3a operations. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {addDays,parseISO} from 'date-fns';
import {Database} from '../../src/lib/server/persistence/database';
import {PrivateFiles} from '../../src/lib/server/persistence/files';
import {AccountService} from '../../src/lib/server/auth/service';
import {PersonalService} from '../../src/lib/server/learning/personal-service';
import {ProgressService} from '../../src/lib/server/learning/progress-service';
import {ScheduleService} from '../../src/lib/server/learning/schedule-service';
import {lockState} from '../../src/lib/server/persistence/repository';
import {scheduleExpected,type ScheduleOperation} from '../../src/lib/learning/schedule-contract';
import {profileDraft,profileRevisions} from '../../src/lib/learning/personal-contract';
import {localDate} from '../../src/lib/dates';
import {TOPICS,getLeafTopics} from '../../src/lib/topics';
import {SyntheticAccount,syntheticPassword} from '../pdf-a/fixtures';
const root=resolve(process.argv[2]),baseURL=process.argv[3];
if(!/^\/private\/tmp\/stex-c3b1-browser-[a-zA-Z0-9]+$/.test(root)||!/^http:\/\/localhost:\d+$/.test(baseURL))throw new Error('Nur eigene künstliche C3b1-Browserfixture erlaubt.');
const port=Number((await readFile(join(root,'postgres','postmaster.pid'),'utf8')).split('\n')[3]),database=new Database({host:'127.0.0.1',port,user:'stex_local',password:(await readFile(join(root,'postgres-password'),'utf8')).trim(),database:'stex_local'});
try{
 const auth=new AccountService({database,files:new PrivateFiles(join(root,'files')),baseURL,secret:(await readFile(join(root,'auth-secret'),'utf8')).trim(),mailKey:(await readFile(join(root,'auth-mail-key'),'utf8')).trim()}),a=new SyntheticAccount(auth,'c3b1-browser-a');await a.auth('/sign-in/email',{email:'c3b1-browser-a@example.test',password:syntheticPassword});
 const personal=new PersonalService(auth),v=await personal.read(a.headers()),context={contractVersion:1 as const,expectedAccountId:v.account.userId,expectedAccessGeneration:v.account.accessGeneration,expectedSessionContext:v.account.sessionContext},today=localDate(),tomorrow=localDate(addDays(parseISO(today),1)),topic=getLeafTopics(TOPICS)[0].id;
 await personal.submit(a.headers(),{...context,action:'profile',requestId:'c2_c3b1_browser_profile',expectedRevisions:profileRevisions(v),fields:{...profileDraft(v),bundesland:'Berlin',examDate:'2027-06-01',lernstart:'2026-10-01',studyPhases:[{id:'c3b1-existing-phase',label:'Erhaltener Stationsabschnitt',start:'2026-10-01',end:'2026-11-01',focus:'zr',perspective:'state'}]}});
 await personal.submit(a.headers(),{...context,action:'note',requestId:'c2_c3b1_browser_note',id:'c3b1-browser-note',topicId:topic,note:'C3b1 erhält C2-Lernnotiz',expectedRevision:null});
 const progress=new ProgressService(auth),pv=await progress.read(a.headers());await progress.submit(a.headers(),{contractVersion:1,action:'set',requestId:'c1-c3b1-browser',expectedAccountId:pv.account.userId,expectedAccessGeneration:pv.account.accessGeneration,expectedSessionContext:pv.account.sessionContext,changes:[{topicId:topic,percent:18,expectedRevision:null}]});
 const schedule=new ScheduleService(auth);let sequence=0;
 async function write(operation:ScheduleOperation){const s=await schedule.read(a.headers());return schedule.submit(a.headers(),{contractVersion:1,action:'schedule',requestId:`c3a_c3b1_fixture_${++sequence}`,expectedAccountId:s.account.userId,expectedAccessGeneration:s.account.accessGeneration,expectedSessionContext:s.account.sessionContext,operation,expected:scheduleExpected(s,operation)});}
 await write({type:'task.save',id:'c3b1-existing-manual',date:tomorrow,title:'C3b1 manuelle Verpflichtung',durationMinutes:90,topicIds:[topic],isReview:false});
 await write({type:'task.save',id:'c3b1-existing-done',date:today,title:'C3b1 schon erledigt',durationMinutes:45,topicIds:[topic],isReview:false});
 await write({type:'task.complete',id:'c3b1-existing-done',trackingId:'c3b1-existing-tracking',durationMinutes:45});
 await write({type:'task.save',id:'c3b1-existing-deleted',date:tomorrow,title:'C3b1 gelöschter Altauftrag',durationMinutes:30,topicIds:[],isReview:false});await write({type:'task.delete',id:'c3b1-existing-deleted'});
 await write({type:'event.save',id:'c3b1-fixed-source',date:tomorrow,label:'C3b1 fester Quelltermin',eventType:'ag',recurring:false,durationMinutes:60});
 await database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.personal_records SET payload=payload||$1::jsonb,revision=revision+1 WHERE owner_user_id=$2 AND kind='calendar-event' AND id='c3b1-fixed-source'",[JSON.stringify({source:'document',sourceDocument:'Nur künstlicher C3b1-Quellbeleg'}),a.name]);await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');});
 const plan={tasks:[{date:tomorrow,title:'C3b1 Browser-Lernblock',minutes:90,topicId:topic},{date:localDate(addDays(parseISO(today),2)),title:'C3b1 Browser-Wiederholung',minutes:45,topicId:topic,isReview:true}],klausuren:[{date:tomorrow,label:'C3b1 Browserklausur',area:'zr',klausurId:'c3b1-browser-case'}]};
 await writeFile(resolve('docs/entwuerfe/DATA-01/pruefungen/data-c3b1-browser-plan.json'),JSON.stringify(plan,null,2)+'\n');await a.auth('/sign-out',{});
 console.log(JSON.stringify({synthetic:true,today,tomorrow,topicPercent:18,manualTaskPreserved:true,fixedSourcePreserved:true,trackingPreserved:true,tombstone:true,planInput:'data-c3b1-browser-plan.json'}));
}finally{await database.close();}
