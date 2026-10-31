import {addDays} from 'date-fns';
import type {OnboardingData,DailyTask,AgWeekOverride} from '@/lib/store';
import {getWeekKey} from '@/lib/store';
import type {CalendarEvent,TrackingEntry} from '@/lib/types';
import {scheduleValues,type ScheduleView} from '@/lib/learning/schedule-contract';
import {planningEvents} from '@/lib/day-budget';
import {frequencyMatches} from '@/lib/recurrence';
import {localDate} from '@/lib/dates';
import {accountOnboardingData} from './account-onboarding-model';
export function accountCalendarData(view:ScheduleView){
 const settings:OnboardingData={...accountOnboardingData(view.personal),...view.settings};
 const tasks=scheduleValues<DailyTask>(view,'task');
 return {settings,tasks,events:planningEvents(scheduleValues<CalendarEvent>(view,'calendar-event'),settings),tracking:scheduleValues<TrackingEntry>(view,'tracking-entry'),klausuren:view.klausuren,backlog:tasks.filter(t=>t.deferred&&!t.done)};
}
export function accountWeekAgDays(view:ScheduleView,monday:Date){
 const override=scheduleValues<AgWeekOverride>(view,'ag-week').find(w=>w.weekKey===getWeekKey(monday));
 if(override)return override.agDays;
 return [...new Set((view.settings.ags??[]).flatMap(ag=>{const index=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'].indexOf(ag.day);if(index<0)return [];const iso=localDate(addDays(monday,index));return (!ag.startDate||iso>=ag.startDate)&&(!ag.endDate||iso<=ag.endDate)&&frequencyMatches(ag.frequency,new Date(`${iso}T00:00:00Z`),ag.startDate)?[index]:[];}))];
}
export const accountDayTasks=(view:ScheduleView,date:string)=>scheduleValues<DailyTask>(view,'task').filter(t=>t.date===date&&!t.deferred);
