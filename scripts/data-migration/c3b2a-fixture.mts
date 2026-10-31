/** Only synthetic seed data for the named preparation fixtures; no browser import. */
import {addDays,parseISO} from 'date-fns';
import {localDate} from '../../src/lib/dates';
import {PersonalService} from '../../src/lib/server/learning/personal-service';
import {ProgressService} from '../../src/lib/server/learning/progress-service';
import {ScheduleService} from '../../src/lib/server/learning/schedule-service';
import {PlanService} from '../../src/lib/server/learning/plan-service';
import {profileDraft,profileRevisions} from '../../src/lib/learning/personal-contract';
import {scheduleExpected,type ScheduleOperation} from '../../src/lib/learning/schedule-contract';
import {TOPICS,getLeafTopics} from '../../src/lib/topics';
import type {AccountService} from '../../src/lib/server/auth/service';
import type {SyntheticAccount} from '../pdf-a/fixtures';
import {lockState} from '../../src/lib/server/persistence/repository';

export async function seedPreparationFixture(auth:AccountService,account:SyntheticAccount,caseId:string,today=localDate()){
 const day=(n:number)=>localDate(addDays(parseISO(today),n)),topic=getLeafTopics(TOPICS)[0].id;
 const personal=new PersonalService(auth),p=await personal.read(account.headers());
 const context={contractVersion:1 as const,expectedAccountId:p.account.userId,expectedAccessGeneration:p.account.accessGeneration,expectedSessionContext:p.account.sessionContext};
 await personal.submit(account.headers(),{...context,action:'profile',requestId:'c2_prep_fixture_profile',expectedRevisions:profileRevisions(p),fields:{...profileDraft(p),bundesland:'Berlin',examDate:day(100),lernstart:day(-10),studyPhases:[{id:'prep-existing-phase',label:'Erhaltener C3b2a-Stationsabschnitt',start:day(-10),end:day(30),focus:'zr',perspective:'state'}]}});
 await personal.submit(account.headers(),{...context,action:'note',requestId:'c2_prep_fixture_note',id:'prep-existing-note',topicId:topic,note:'C3b2a erhält persönliche Lernnotiz',expectedRevision:null});
 const progress=new ProgressService(auth),v=await progress.read(account.headers());await progress.submit(account.headers(),{...context,action:'set',requestId:'c1-preparation-fixture',changes:[{topicId:topic,percent:18,expectedRevision:v.progress.find(r=>r.id===topic)?.revision??null}]});
 // A historical synthetic plan is created through the actual C3b1 service with an explicit test clock.
 const historical=new PlanService(auth,{today:()=>day(-1)}),h=await historical.read(account.headers());
 const saved=await historical.submit(account.headers(),{...context,action:'plan',requestId:'c3b1_prep_fixture_draft',operation:{type:'save',reply:JSON.stringify({tasks:[{date:day(-1),title:'C3b2a nachzuholender Planblock',minutes:90,topicId:topic},{date:day(-1),title:'C3b2a zu großer Planblock',minutes:600,topicId:topic}],klausuren:[{date:day(-1),label:'C3b2a gekoppelte Klausur',area:'zr',klausurId:caseId}]}),expectedResultRevision:h.resultRevision}});
 const d=saved.view.history.find(h=>h.id===saved.view.currentDraftId)!;
 const preview=await historical.preview(account.headers(),{...context,planId:d.id,planRevision:d.revision,snapshot:saved.view.snapshot});
 await historical.submit(account.headers(),{...context,action:'plan',requestId:'c3b1_prep_fixture_apply',operation:{type:'apply',planId:d.id,planRevision:d.revision,snapshot:preview.snapshot}});
 const schedule=new ScheduleService(auth);let n=0;
 const write=async(operation:ScheduleOperation)=>{const view=await schedule.read(account.headers());return schedule.submit(account.headers(),{...context,action:'schedule',requestId:`c3a_prep_fixture_${++n}`,operation,expected:scheduleExpected(view,operation)});};
 await write({type:'task.save',id:'prep-existing-manual',date:today,title:'C3b2a manuell belegter Tag',durationMinutes:420,topicIds:[],isReview:false});
 await write({type:'task.save',id:'prep-existing-done',date:day(-1),title:'C3b2a bereits bearbeitet',durationMinutes:45,topicIds:[topic],isReview:false});
 await write({type:'task.complete',id:'prep-existing-done',trackingId:'prep-existing-tracking',durationMinutes:45});
 await write({type:'task.save',id:'prep-existing-deleted',date:day(2),title:'C3b2a bewusst gelöschter Auftrag',durationMinutes:90,topicIds:[topic],isReview:false});await write({type:'task.delete',id:'prep-existing-deleted'});
 await write({type:'event.save',id:'prep-fixed-source',date:day(1),label:'C3b2a fester Quelltermin',eventType:'ag',durationMinutes:60,recurring:false});
 await auth.database.transaction(async c=>{await lockState(c);await c.query("UPDATE stex.personal_records SET payload=payload||$1::jsonb,revision=revision+1 WHERE owner_user_id=$2 AND kind='calendar-event' AND id='prep-fixed-source'",[JSON.stringify({source:'document',sourceDocument:'Nur künstlicher C3b2a-Quellbeleg'}),account.name]);await c.query('UPDATE stex.state SET generation=generation+1 WHERE singleton');});
 return {today,selectedDays:[day(1),day(2),day(3)],topic,note:'C3b2a erhält persönliche Lernnotiz'};
}
