import type {DailyTask,AgWeekOverride,PlanAppliedRange} from '../../store';
import type {CalendarEvent,Progress,TrackingEntry} from '../../types';
import {isDateOnly} from '../../dates';
import {autoTopicCount,planningEnd,rebalanceTasks} from '../../learning-planner';
import {materializeRecurringWithAdapter,type PlanDataAdapter} from '../../plan-core';
import {dailyHours,computeDayBudget,eventsOnDate,isFixedTask,planningEvents,taskMinutes} from '../../day-budget';
import {studyPhaseErrors,studySuggestionKey} from '../../study-phases';
import {dueTopicReviews,reviewHistoryKey} from '../../spaced-repetition';
import {selectAutoSprints} from '../../learning/preparation-selection';
import {preparationKnownMinutes} from '../../learning/preparation-duration';
import {TOPICS,getLeafTopics} from '../../topics';
import {canonical,digest,recordKey} from '../../data-migration/migration';
import {planSettings,live,object,invalid,type PlanRow} from './plan-calculation';
import type {PlanningState} from './plan-service';
import type {PreparationBacklog} from '../../learning/preparation-contract';
import type {PlanChange} from '../../learning/plan-contract';

export interface PreparationState extends PlanningState {derivedIds:ReadonlySet<string>}
type PreparedTask=DailyTask&{c3b2a?:{slot:string}};
const weekdays=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const topics=getLeafTopics(TOPICS);
const taskTopics=(task:DailyTask)=>task.linkedTopicIds??(task.linkedTopicId?[task.linkedTopicId]:[]);

export function protectedReason(task:DailyTask,state:PreparationState,owner:string):string|null {
 if(task.done||task.doneAt||task.trackingEntryId||task.reviewedAt)return 'Bereits bearbeitete Arbeit bleibt erhalten.';
 if(task.source==='manual'||state.protectedTaskIds.has(task.id))return 'Manuell festgelegt oder nachträglich bearbeitet; bitte bewusst einzeln ändern.';
 if(task.calendarEventId)return 'Mit einem Kalendertermin verbunden; Aufgabe und Termin bleiben gemeinsam erhalten.';
 if(isFixedTask(task))return 'Fester Quell- oder Wiederholungstermin bleibt erhalten.';
 const key=recordKey('task',owner,task.id);
 if(state.references.some(r=>r.target_personal_key===key))return 'Ein anderer gespeicherter Eintrag verweist auf diese Aufgabe; Zuordnung bleibt erhalten.';
 if(!state.derivedIds.has(task.id))return 'Kein eindeutiger Übernahmebeleg für eine unberührte Ableitung; bleibt erhalten.';
 return null;
}
export function preparationBacklog(tasks:DailyTask[],state:PreparationState,owner:string,today:string):PreparationBacklog[]{
 return tasks.filter(t=>!t.done&&(t.deferred||t.date<today)).map(task=>({task,reason:protectedReason(task,state,owner)??(task.deferred?'Passt derzeit nicht in den verfügbaren Zeitraum; bleibt gespeichert.':'Noch offen; kann in der bewussten Vorbereitung nachgeholt werden.')}));
}
function validateFoundation(state:PreparationState,today:string,end:string){
 const settings=planSettings(state.rows);
 if(settings.maxDailyHours!==undefined&&(!Number.isFinite(settings.maxDailyHours)||settings.maxDailyHours<1||settings.maxDailyHours>10))invalid('Die gespeicherte Tagesgrenze ist ungültig. Bitte zuerst das Zeitbudget klären.');
 for(const [label,value] of [['Prüfungstermin',settings.examDate],['Lernstart',settings.lernstart]] as const)if(value&&!isDateOnly(value))invalid(`Der gespeicherte ${label} ist ungültig.`);
 if(!weekdays.includes(settings.freeDayPerWeek)&&settings.freeDayPerWeek!=='')invalid('Der gespeicherte freie Wochentag ist ungültig.');
 if(!Array.isArray(settings.vacationDates)||settings.vacationDates.some(d=>!isDateOnly(d)))invalid('Ein gespeicherter Urlaubstag ist ungültig.');
 if(studyPhaseErrors(settings.studyPhases).length)invalid(studyPhaseErrors(settings.studyPhases)[0]);
 for(const key of ['ags','reps','lerngruppen','sonstiges','kaiserSeminare'] as const)if(!Array.isArray(settings[key]))invalid('Eine vorhandene Terminliste ist ungültig.');
 const termKeys=new Set<string>();
 for(const [kind,list] of [['ag',settings.ags],['rep',settings.reps],['lerngruppe',settings.lerngruppen],['sonstiges',settings.sonstiges]] as const)for(const term of list){
  if(!object(term)||typeof term.id!=='string'||!term.id||termKeys.has(`${kind}|${term.id}`))invalid('Ein vorhandener Profiltermin braucht eine eindeutige stabile Kennung.');
  termKeys.add(`${kind}|${term.id}`);
 }
 for(const term of [...settings.ags,...settings.reps,...settings.lerngruppen,...settings.sonstiges]){
  if(!term.id||typeof term.label!=='string'||!term.label.trim()||!weekdays.includes(term.day))invalid('Ein vorhandener Profiltermin braucht seine eindeutige Kennung, Bezeichnung und einen gültigen Wochentag.');
  if(!Number.isFinite(term.durationHours)||term.durationHours<=0||term.durationHours>24)invalid(`Die Dauer des Profiltermins „${term.label}“ ist offen oder ungültig.`);
  for(const field of ['prepHours','postHours'] as const){const v=(term as unknown as Record<string,unknown>)[field];if(v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>24))invalid(`Vor-/Nachbereitungsdauer für „${term.label}“ ist ungültig.`);}
  if(term.startDate&&!isDateOnly(term.startDate)||term.endDate&&!isDateOnly(term.endDate)||term.startDate&&term.endDate&&term.startDate>term.endDate)invalid(`Der Zeitraum des Profiltermins „${term.label}“ ist ungültig.`);
 }
 for(const rep of settings.reps)for(const entry of rep.schedule??[])if(!isDateOnly(entry.date)||!Array.isArray(entry.topicIds)||entry.topicIds.some(id=>!topics.some(t=>t.id===id)))invalid('Ein vorhandener Repetitoriumseintrag hat ungültige Daten oder Themenbezüge.');
 for(const seminar of settings.kaiserSeminare)if(!isDateOnly(seminar.date)||!Number.isInteger(seminar.durationDays)||seminar.durationDays<1||seminar.durationDays>30)invalid('Ein vorhandener Seminartermin ist ungültig.');
 const range=state.rows.find(r=>r.kind==='plan-range'&&live(r))?.payload;
 if(range!==undefined&&range!==null&&(!object(range)||!isDateOnly(String(range.start))||!isDateOnly(String(range.end))||String(range.start)>String(range.end)))invalid('Der übernommene Planzeitraum ist ungültig.');
 for(const row of state.rows.filter(live)){
  if(row.kind==='task'){
   const task=row.payload as DailyTask;
   if(!isDateOnly(task.date))invalid(`Die vorhandene Aufgabe „${task.title}“ hat kein gültiges Datum.`);
   if((task.date>=today&&task.date<=end||!task.done&&(task.date<today||task.deferred))&&preparationKnownMinutes(task)===null)invalid(`Die Dauer der vorhandenen Aufgabe „${task.title}“ ist offen. Bitte zuerst ergänzen.`);
  }
  if(row.kind==='calendar-event'){
   const event=row.payload as CalendarEvent;
   if(!isDateOnly(event.date)||(event.recurring&&(!Number.isInteger(event.recurringDay)||Number(event.recurringDay)<0||Number(event.recurringDay)>6)))invalid(`Der vorhandene Termin „${event.label}“ hat ungültige Kalenderdaten.`);
   if((event.recurring&&event.date<=end||event.date>=today&&event.date<=end)&&!['frei','urlaub','klausur','probeexamen'].includes(event.eventType)&&!(Number.isFinite(event.durationMinutes)&&Number(event.durationMinutes)>0))invalid(`Die Dauer des vorhandenen Termins „${event.label}“ ist offen. Bitte zuerst ergänzen.`);
  }
 }
 return settings;
}

/** All writes remain in cloned memory. Account work is never deleted or recreated under a new slot. */
export function calculatePreparation(state:PreparationState,owner:string,dates:string[],today:string){
 const initialSettings=planSettings(state.rows),end=planningEnd(today,initialSettings);
 const settings=validateFoundation(state,today,end);
 if(dates.some(d=>d<today||d>end||settings.examDate&&d>=settings.examDate))invalid('Bitte höchstens sieben Tage ab heute innerhalb der nächsten 90 Tage und vor dem Examen auswählen.');
 const active=state.rows.filter(live),before=active.filter(r=>r.kind==='task').map(r=>structuredClone(r.payload) as PreparedTask);
 let tasks=structuredClone(before);const events=active.filter(r=>r.kind==='calendar-event').map(r=>structuredClone(r.payload) as CalendarEvent);
 const retired=state.rows.filter(r=>r.kind==='task'&&!live(r)).map(r=>structuredClone(r.payload) as PreparedTask);
 const retiredEvents=state.rows.filter(r=>r.kind==='calendar-event'&&!live(r)).map(r=>r.payload as CalendarEvent);
 const occupied=new Set([...tasks,...retired].map(t=>t.id));
 const derived=new Set(state.derivedIds);const createdIds=new Set<string>();
 const add=(input:Omit<DailyTask,'id'|'done'|'createdAt'>,slot:string)=>{
  const [kind,,occurrence]=slot.split('|');
  const label=input.title.replace(/^(Vorb\.|Nachb\.)\s*/,'');
  if(occurrence&&isDateOnly(occurrence)&&eventsOnDate(retiredEvents,occurrence).some(e=>e.eventType===kind&&(label.startsWith(e.label+' (')||label.startsWith(e.label+' —'))))return;
  const id=`c3b2a_${digest([owner,slot]).slice(0,48)}`;
  if(occupied.has(id))return;
  tasks.push({...input,id,done:false,createdAt:`${today}T12:00:00.000Z`,c3b2a:{slot}});occupied.add(id);derived.add(id);createdIds.add(id);
 };
 const adapter:PlanDataAdapter={mode:'account',getTasks:()=>[...tasks,...retired],getCalendarEvents:()=>events,getOnboarding:()=>settings,getKlausuren:()=>state.catalog,getAgWeekOverrides:()=>Object.fromEntries(active.filter(r=>r.kind==='ag-week').map(r=>[r.id,r.payload as AgWeekOverride])),addTask:task=>add(task,task.recurringKey!),updateTask:()=>{throw Error('Account preparation cannot rewrite profile tasks');},removeTask:()=>{throw Error('Account preparation cannot delete tasks');},setOnboarding:()=>{throw Error('No profile defaults may be persisted');},snapshot:()=>({tasks,events,range:null,onboarding:settings}),writeSnapshot:()=>{throw Error('No unconfirmed snapshot writes');},newId:()=>{throw Error('Semantic task slot required');},now:()=>`${today}T12:00:00.000Z`};
 try{materializeRecurringWithAdapter(adapter,today,end);}catch(error){invalid(error instanceof Error?error.message:'Die bestehenden Wiederholungstermine sind nicht eindeutig.');}
 const computedState={...state,derivedIds:derived};
 const movable=new Set(tasks.filter(t=>!protectedReason(t,computedState,owner)).map(t=>t.id));
 const scheduledEvents=planningEvents(events,settings);
 const repaired=rebalanceTasks(tasks,scheduledEvents,settings,today,end,{preserveSuggestions:true,movableIds:movable,movableAutoIds:new Set(tasks.filter(t=>t.source==='auto'&&movable.has(t.id)).map(t=>t.id)),planFirst:true});
 tasks=repaired.tasks;
 const tracking=active.filter(r=>r.kind==='tracking-entry').map(r=>r.payload as TrackingEntry);
 const progress=Object.fromEntries(active.filter(r=>r.kind==='progress').map(r=>[r.id,r.payload as Progress]));
 const range=(active.find(r=>r.kind==='plan-range')?.payload??null) as PlanAppliedRange|null;
 for(const date of dates){
  const removedSlots=new Set([...retired.filter(t=>t.source==='auto'&&(t.date===date||t.rescheduledFrom===date)),...tasks.filter(t=>t.source==='auto'&&t.date!==date&&t.rescheduledFrom===date)].map(t=>t.c3b2a?.slot??t.recurringKey??t.id)).size;
  const count=Math.max(0,autoTopicCount(date,tasks,scheduledEvents,settings,range,today)-removedSlots);if(count<=0)continue;
  const done=new Set(tasks.filter(t=>t.done&&t.date===date).flatMap(taskTopics));
  const pendingReviews=new Set(tasks.filter(t=>!t.done&&t.isReview).flatMap(taskTopics));
  const due=dueTopicReviews(tracking,date,today).filter(r=>!pendingReviews.has(r.topicId)&&!retired.some(t=>t.isReview&&taskTopics(t).includes(r.topicId)&&(t.c3b2a?.slot===`review|${r.topicId}|${r.lastEntryId}|${r.due}`||!t.c3b2a&&t.date>=r.lastDate)));
  const available=topics.filter(topic=>!done.has(topic.id)&&![...tasks,...retired].some(t=>(t.date===date||t.rescheduledFrom===date)&&taskTopics(t).includes(topic.id)));
  for(const item of selectAutoSprints(date,count,available,progress,settings,due)){
   const review=due.find(r=>r.topicId===item.topic.id);
   const slot=item.isReview&&review?`review|${item.topic.id}|${review.lastEntryId}|${review.due}`:`auto|${date}|${item.topic.id}`;
   if([...tasks,...retired].some(t=>t.c3b2a?.slot===slot||t.recurringKey===slot))continue;
   add({date,title:item.title,linkedTopicId:item.topic.id,isReview:item.isReview,durationMinutes:90,source:'auto',deferred:false,recurringKey:slot,studySuggestionKey:studySuggestionKey(date,settings)+reviewHistoryKey(tracking,today)},slot);
  }
 }
 // Compare the actual JSON storage form; optional undefined placement fields are not changes.
 tasks=tasks.map(task=>JSON.parse(JSON.stringify(task)) as PreparedTask);
 const changes:PlanChange[]=tasks.flatMap(after=>{const old=before.find(t=>t.id===after.id)??null;return canonical(old)===canonical(after)?[]:[{kind:'task' as const,id:after.id,before:old,after}];});
 if(changes.length>2500)invalid('Diese Vorbereitung ist zu groß. Bitte zuerst die vorhandenen Termine klären.');
 const warnings:string[]=[];
 for(const date of dates){const budget=computeDayBudget(tasks.filter(t=>t.date===date),eventsOnDate(scheduledEvents,date),{maxHours:dailyHours(settings)});if(budget.overloadH>0)warnings.push(`${date}: feste oder bewusst bearbeitete Verpflichtungen übersteigen die Tagesgrenze; sie bleiben erhalten.`);if(range&&date>=range.start&&date<=range.end)warnings.push(`${date}: bereits übernommener Planzeitraum; keine zusätzlichen Themensprints.`);}
 return {end,changes,backlog:preparationBacklog(tasks,computedState,owner,today),warnings,created:createdIds.size,moved:repaired.moved.length,deferred:repaired.deferred.length};
}

export const preparationMinutes=(row:PlanRow)=>taskMinutes(row.payload as DailyTask);
