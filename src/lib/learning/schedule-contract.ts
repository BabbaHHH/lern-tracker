import type { ProfileBudget } from './profile-fields';
import type { DailyTask,AgWeekOverride } from '../store';
import type { CalendarEvent,TrackingEntry,Klausur,Progress } from '../types';
import type { LearningAccount } from './progress-contract';
import type { PersonalRecord,PersonalView } from './personal-contract';
export type ScheduleKind='task'|'calendar-event'|'tracking-entry'|'ag-week'|'progress';
export interface ScheduleRecord extends PersonalRecord<DailyTask|CalendarEvent|TrackingEntry|AgWeekOverride|Progress>{kind:ScheduleKind;deleted?:boolean}
export interface ScheduleView {contractVersion:1;account:LearningAccount;records:ScheduleRecord[];retired:{kind:ScheduleKind;id:string;revision:number}[];klausuren:(Klausur&{viewerURL?:string})[];personal:PersonalView;settings:ProfileBudget}
export type ScheduleOperation=
 |{type:'task.save';id:string;date:string;title:string;durationMinutes?:number;topicIds:string[];klausurId?:string;isReview:boolean}
 |{type:'task.complete';id:string;trackingId:string;durationMinutes:number;recallRating?:TrackingEntry['recallRating']}
 |{type:'task.uncomplete'|'task.delete';id:string}
 |{type:'event.save';id:string;date:string;label:string;eventType:CalendarEvent['eventType'];recurring:boolean;recurringDay?:number;durationMinutes?:number}
 |{type:'event.delete';id:string}
 |{type:'event.link';id:string;klausurId:string;taskId:string}
 |{type:'tracking.save';id:string;date:string;activityType:Exclude<TrackingEntry['activityType'],'klausur'>;topicIds:string[];durationMinutes:number;rating?:number;recallRating?:TrackingEntry['recallRating'];note:string}
 |{type:'tracking.delete';id:string}
 |{type:'ag.save';id:string;agDays:number[]}
 |{type:'ag.clear';id:string}
 |{type:'exam.record';taskId:string;trackingId:string;date:string;klausurId:string;klausurMode:'written'|'read';topicIds:string[];durationMinutes:number;rating:number;note:string};
export interface ScheduleRevision {kind:ScheduleKind;id:string;revision:number|null}
export interface ScheduleCommand {contractVersion:1;action:'schedule';requestId:string;expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string;operation:ScheduleOperation;expected:ScheduleRevision[]}
export interface ScheduleResult {contractVersion:1;action:'schedule';requestId:string;account:LearningAccount;input:ScheduleCommand;changes:ScheduleRecord[];replay:boolean}
export const schedulePageAllowed=(path:string)=>['/','/onboarding','/themen','/kalender','/wochenplan','/klausuren','/konto'].includes(path)||path.startsWith('/konto/');
export const scheduleValues=<T,>(view:ScheduleView,kind:ScheduleKind)=>view.records.filter(r=>r.kind===kind).map(r=>r.value as T);
/** Freeze only the affected revision set from the rendered snapshot, never from a later poll. */
export function scheduleExpected(view:ScheduleView,op:ScheduleOperation):ScheduleRevision[]{
 const targets=new Map<string,{kind:ScheduleKind;id:string}>();const add=(kind:ScheduleKind,id:string)=>targets.set(`${kind}|${id}`,{kind,id});
 const task=(id:string)=>view.records.find(r=>r.kind==='task'&&r.id===id)?.value as DailyTask|undefined;
 if(op.type.startsWith('task.')){const id=(op as {id:string}).id;add('task',id);if(op.type==='task.complete')add('tracking-entry',op.trackingId);else if(['task.uncomplete','task.delete'].includes(op.type)&&task(id)?.trackingEntryId)add('tracking-entry',task(id)!.trackingEntryId!);}
 else if(op.type.startsWith('event.')){add('calendar-event',(op as {id:string}).id);if(op.type==='event.link')add('task',op.taskId);if(op.type==='event.save')for(const r of view.records)if(r.kind==='task'&&(r.value as DailyTask).calendarEventId===op.id)add('task',r.id);}
 else if(op.type.startsWith('tracking.'))add('tracking-entry',(op as {id:string}).id);
 else if(op.type.startsWith('ag.'))add('ag-week',(op as {id:string}).id);
 else if(op.type==='exam.record'){add('task',op.taskId);add('tracking-entry',op.trackingId);for(const id of op.topicIds)add('progress',id);}
 return [...targets.values()].map(t=>({...t,revision:view.records.find(r=>r.kind===t.kind&&r.id===t.id)?.revision??view.retired.find(r=>r.kind===t.kind&&r.id===t.id)?.revision??null}));
}
