import {profileBudgetProjection} from '../../learning/profile-fields';
import type {OnboardingData,DailyTask,AgWeekOverride,PlanAppliedRange} from '../../store';
import type {Klausur,CalendarEvent} from '../../types';
import {applyPlanWithAdapter,parseStructuredPlan,validateStructuredPlan,type PlanDataAdapter,type StructuredPlan} from '../../plan-core';
import {isDateOnly} from '../../dates';
import {isTerminTitle} from '../../day-budget';
import {planningEnd} from '../../learning-planner';
import {TOPICS,getLeafTopics} from '../../topics';
import {digest,canonical} from '../../data-migration/migration';
import {AccountError} from '../auth/security';
import type {PlanChange} from '../../learning/plan-contract';
export interface PlanRow {kind:string;id:string;revision:number;payload:unknown;normalized:Record<string,unknown>;legacyKey?:string}
export const planKinds=['profile','exam-date','lernstart','learning-start','progress','task','calendar-event','tracking-entry','ag-week','plan-result','plan-history','plan-range'];
export const live=(r:PlanRow)=>r.normalized.c3aDeleted!==true;
export const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function invalid(message:string):never{throw new AccountError('invalid_input',message);}
export function conflict(message='Die Planungsgrundlage hat sich geändert. Bitte eine neue Vorschau öffnen.'):never{throw new AccountError('conflict',message,409);}
const topics=new Set(getLeafTopics(TOPICS).map(t=>t.id));
function durationInTitle(title:string){const match=title.match(/\((\d+(?:[.,]\d+)?)\s*h\)/i);return !!match&&Number(match[1].replace(',','.'))>0;}
export function storedStructured(reply:string):StructuredPlan|null{try{return reply.trim().startsWith('{')?validateStructuredPlan(JSON.parse(reply)):parseStructuredPlan(reply);}catch{return null;}}
export function planSettings(rows:PlanRow[]):OnboardingData{
 const profile=rows.find(r=>r.kind==='profile'&&r.id==='lerntracker-onboarding'&&live(r));
 const p=object(profile?.payload)?profile.payload:{},budget=profileBudgetProjection(p,true);
 // View-only empty collections for the existing pure scheduler; never persisted as defaults.
 return {...p,...budget,examDate:rows.find(r=>r.kind==='exam-date'&&live(r))?.payload??p.examDate??'',lernstart:rows.find(r=>(r.kind==='lernstart'||r.kind==='learning-start')&&live(r))?.payload??p.lernstart??'',ags:budget.ags??[],reps:budget.reps??[],lerngruppen:budget.lerngruppen??[],sonstiges:budget.sonstiges??[],kaiserSeminare:budget.kaiserSeminare??[],vacationDates:budget.vacationDates??[],documents:p.documents??[],studyPhases:p.studyPhases??[],freeDayPerWeek:budget.freeDayPerWeek??'Sonntag'} as OnboardingData;
}
export function calculatePlan(rows:PlanRow[],catalog:Klausur[],draft:PlanRow,owner:string,snapshot:string,today:string,protectedTaskIds:ReadonlySet<string>=new Set()){
 const value=object(draft.payload)?draft.payload:{};const reply=typeof value.reply==='string'?value.reply:typeof value.result==='string'?value.result:'';
 const plan=storedStructured(reply)??validateStructuredPlan(value.structured);
 if(!plan)invalid('Der Entwurf braucht einen gültigen strukturierten Plan mit Lernaufgaben und Klausurterminen, als JSON oder im JSON-Block des Plantexts.');
 if(plan.appointments?.length||plan.studyPhases?.length)invalid('Neue Quelltermine und Lernphasen können erst nach dem persönlichen Dokumentanschluss übernommen werden. Bitte einen Entwurf ohne neue Quelltermine und Lernphasen verwenden; es wird nichts teilweise übernommen.');
 for(const item of plan.tasks){
  if(isTerminTitle(item.title))invalid(`„${item.title}“ ist ein Termin. Neue Quelltermine sind hier noch nicht freigegeben.`);
  if(!Number.isInteger(item.minutes))invalid(`Bitte eine konkrete Dauer in Minuten für „${item.title}“ ergänzen.`);
  if(item.topicId&&!topics.has(item.topicId))invalid(`Das Thema für „${item.title}“ fehlt im vorhandenen Themenvertrag.`);
 }
 const settings=planSettings(rows),active=rows.filter(live),tasks=active.filter(r=>r.kind==='task').map(r=>structuredClone(r.payload) as DailyTask),events=active.filter(r=>r.kind==='calendar-event').map(r=>structuredClone(r.payload) as CalendarEvent);
 const baseTasks=structuredClone(tasks),baseEvents=structuredClone(events);
 const dates=[...plan.tasks.map(t=>t.date),...plan.klausuren.map(k=>k.date)].sort();
 if(!dates.length)invalid('Der Entwurf enthält keine Lernaufgaben oder Klausurslots.');
 const horizon=planningEnd(dates.at(-1)!,settings,28);const relevant=(date:string)=>date>=dates[0]&&date<=horizon;
 for(const task of tasks)if(relevant(task.date)&&!task.deferred&&!(typeof task.durationMinutes==='number'&&Number.isFinite(task.durationMinutes)&&task.durationMinutes>0)&&!durationInTitle(task.title))invalid(`Die Dauer der vorhandenen Aufgabe „${task.title}“ (${task.date}) ist offen. Bitte zuerst ergänzen.`);
 for(const event of events)if((relevant(event.date)||(event.recurring&&event.date<=horizon))&&!['frei','urlaub','klausur','probeexamen'].includes(event.eventType)&&!(typeof event.durationMinutes==='number'&&Number.isFinite(event.durationMinutes)&&event.durationMinutes>0))invalid(`Die Dauer des vorhandenen Termins „${event.label}“ ist offen. Bitte zuerst ergänzen.`);
 for(const item of [...settings.ags,...settings.reps,...settings.lerngruppen,...settings.sonstiges]){
  if(!item.id||!item.day)invalid('Ein vorhandener wiederkehrender Profiltermin braucht seine bestehende Kennung und einen Wochentag.');
  if(!Number.isFinite(item.durationHours)||item.durationHours<=0)invalid(`Die Dauer des Profiltermins „${item.label}“ ist offen. Bitte zuerst ergänzen.`);
 }
 if(settings.examDate&&!isDateOnly(settings.examDate))invalid('Bitte den vorhandenen Prüfungstermin im Profil korrigieren.');
 let state={tasks,events,onboarding:settings,range:(active.find(r=>r.kind==='plan-range')?.payload??null) as PlanAppliedRange|null};let index=0;
 const stamp=typeof value.createdAt==='string'?value.createdAt:`${today}T12:00:00.000Z`;
 const adapter:PlanDataAdapter={mode:'account',protectedTaskIds,getTasks:()=>state.tasks,getCalendarEvents:()=>state.events,getOnboarding:()=>state.onboarding,getKlausuren:()=>catalog,getAgWeekOverrides:()=>Object.fromEntries(active.filter(r=>r.kind==='ag-week').map(r=>[r.id,r.payload as AgWeekOverride])),newId:()=>`c3b1_${digest([owner,draft.id,draft.revision,snapshot,++index]).slice(0,48)}`,now:()=>stamp,snapshot:()=>structuredClone(state),writeSnapshot:v=>{state=structuredClone(v);},setOnboarding:v=>{state={...state,onboarding:v};},addTask:v=>{state.tasks.push({...v,id:adapter.newId(),done:false,createdAt:stamp});},removeTask:id=>{state.tasks=state.tasks.filter(t=>t.id!==id);},updateTask:(id,fields)=>{state.tasks=state.tasks.map(t=>t.id===id?{...t,...fields}:t);}};
 let result;try{result=applyPlanWithAdapter(plan,adapter,today);}catch(error){if(error instanceof AccountError)throw error;invalid(error instanceof Error?error.message:'Der Entwurf kann nicht übernommen werden.');}
 const changes:PlanChange[]=[];
 for(const [kind,before,after] of [['calendar-event',baseEvents,result.after.events],['task',baseTasks,result.after.tasks]] as const){
  for(const id of new Set([...before.map(v=>v.id),...after.map(v=>v.id)])){const a=before.find(v=>v.id===id)??null,b=after.find(v=>v.id===id)??null;if(canonical(a)!==canonical(b))changes.push({kind,id,before:a,after:b});}
 }
 if(changes.length>2500)invalid('Diese Übernahme ist zu groß. Bitte einen kleineren Zeitraum planen.');
 return {result,changes};
}
