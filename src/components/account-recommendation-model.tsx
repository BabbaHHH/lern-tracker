import {scoreKlausur,parseAreaFromLabel} from '@/lib/klausur-recommender';
import {sameLearningAccount,profileDraft,type PersonalView} from '@/lib/learning/personal-contract';
import {scheduleValues,type ScheduleView,type ScheduleOperation} from '@/lib/learning/schedule-contract';
import {plain,DEFAULT_WEIGHTS,WEIGHT_LABELS,type SettingsView} from '@/lib/learning/settings-contract';
import type {ProgressView} from '@/lib/learning/progress-contract';
import {getStudyPhase,describeStudyPhase,klausurPerspective} from '@/lib/study-phases';
import {eventsOnDate,computeDayBudget,dailyHours,isStudyFreeDay,isSketchTask} from '@/lib/day-budget';
import {TOPICS,getLeafTopics} from '@/lib/topics';
import type {DailyTask,RecommenderWeights} from '@/lib/store';
import type {Klausur,Area,CalendarEvent,TrackingEntry} from '@/lib/types';
import {accountCalendarData} from "./account-calendar-model";
import {accountDashboardCases} from './account-dashboard-model';
export type AccountCase=ScheduleView['klausuren'][number];
export interface AccountRecommendation {klausur:AccountCase;reasons:string[];alternatives:{klausur:AccountCase;reason:string}[];assigned:boolean}
export interface RecommendationInput {schedule:ScheduleView;personal:PersonalView;progress:Pick<ProgressView,"account"|"progress">;settings:SettingsView;date:string}
const leaves=new Map(getLeafTopics(TOPICS).map(t=>[t.id,t]));
export function accountRecommendation(input:RecommendationInput):{recommendation:AccountRecommendation|null;message:string}{
 const {schedule,personal,progress,settings,date}=input;
 if(![personal.account,progress.account,settings.account,schedule.personal.account].every(a=>sameLearningAccount(schedule.account,a)))return {recommendation:null,message:'Anmeldung und Lernstand stimmen noch nicht überein.'};
 const assigned=accountDashboardCases(schedule,date);
 if(assigned.length){const main=assigned[0].klausur;if(!main)return {recommendation:null,message:'Die heute zugeordnete Klausur ist derzeit nicht im Katalog verfügbar. Bitte den Kalenderbezug prüfen.'};return {message:'',recommendation:{klausur:main,assigned:true,reasons:['Heute in deinem Lernkalender'],alternatives:assigned.slice(1).flatMap(a=>a.klausur?[{klausur:a.klausur,reason:'Heute im Lernkalender'}]:[])}};}
 const row=settings.rows.find(r=>r.kind==='recommender-settings'&&r.id==='lerntracker-recommender-weights');
 if(!row||!plain(row.payload)||Object.keys(DEFAULT_WEIGHTS).some(k=>Object.hasOwn(row.payload as object,k)&&(!Number.isFinite((row.payload as Record<string,unknown>)[k])||Math.abs(Number((row.payload as Record<string,unknown>)[k]))>10000)))return {recommendation:null,message:'Die persönlichen Empfehlungsgewichte müssen zuerst in den Einstellungen geprüft werden.'};
 const missingWeights=Object.keys(DEFAULT_WEIGHTS).some(k=>!Object.hasOwn(row.payload as object,k));
 const weights={...DEFAULT_WEIGHTS,...row.payload} as RecommenderWeights;
 const tasks=scheduleValues<DailyTask>(schedule,'task').filter(t=>t.date===date&&!t.deferred);
 const todayTopicIds=new Set(tasks.flatMap(t=>t.linkedTopicIds??(t.linkedTopicId?[t.linkedTopicId]:[])).filter(id=>leaves.has(id)));
 const counts:Record<Area,number>={zr:0,oeffr:0,sr:0};for(const task of tasks){const a=leaves.get(task.linkedTopicId??task.linkedTopicIds?.[0]??'')?.area;if(a)counts[a]++;}
 const areas=(Object.entries(counts) as [Area,number][]).sort((a,b)=>b[1]-a[1]);const total=areas.reduce((n,a)=>n+a[1],0),top=areas[0],second=areas[1];
 const todayDominantArea=total&&(top[1]/total>=0.6||(top[1]>=2&&top[1]>second[1]))?top[0]:null;
 const entries=scheduleValues<TrackingEntry>(schedule,'tracking-entry').filter(e=>e.activityType==='klausur'&&e.date<=date);
 const writtenMap=new Map<string,{date:string;rating?:number}>();const recentByArea:Record<Area,number>={zr:0,oeffr:0,sr:0};const cutoff=new Date(`${date}T12:00:00`);cutoff.setDate(cutoff.getDate()-14);
 for(const e of entries){if(!e.klausurId)continue;const prior=writtenMap.get(e.klausurId);if(!prior||prior.date<e.date)writtenMap.set(e.klausurId,{date:e.date,rating:e.rating});const area=schedule.klausuren.find(k=>k.id===e.klausurId)?.area;if(area&&new Date(`${e.date}T12:00:00`)>=cutoff)recentByArea[area]++;}
 const ctx={todayTopicIds,todayDominantArea,progressMap:Object.fromEntries(progress.progress.map(p=>[p.id,p.value.percent])),writtenMap,recentByArea};
 const open=schedule.klausuren.filter(k=>!writtenMap.has(k.id)),pool=open.length?open:schedule.klausuren;
 const scored=pool.map(k=>({klausur:k,...scoreKlausur({...k,topicIds:k.topicIds.filter(id=>leaves.has(id))},weights,ctx)})).sort((a,b)=>b.score-a.score||a.klausur.id.localeCompare(b.klausur.id));
 const profile=profileDraft(personal),phase=profile.studyPhasesEnabled===false?null:getStudyPhase(date,profile);
 const eventArea=eventsOnDate(scheduleValues<CalendarEvent>(schedule,'calendar-event'),date).filter(e=>e.eventType==='klausur').map(e=>parseAreaFromLabel(e.label)).find(Boolean);
 const focus=eventArea??(phase?.focus!=='mixed'?phase?.focus:null);
 const fit=(k:Klausur)=>(focus&&focus===k.area?3:0)+(phase&&phase.perspective!=='mixed'?(klausurPerspective(k.type)===phase.perspective?1:klausurPerspective(k.type)==='mixed'?0:-1):0);
 if(scored.length&&(focus||phase?.perspective&&phase.perspective!=='mixed')){const best=Math.max(...scored.map(s=>fit(s.klausur))),i=scored.findIndex(s=>fit(s.klausur)===best);if(i>0)scored.unshift(...scored.splice(i,1));}
 const main=scored[0];if(!main)return {recommendation:null,message:'Im gemeinsamen Klausurkatalog ist noch keine Klausur verfügbar.'};
 const signals=Object.entries(main.breakdown).filter(([,v])=>v!>0).sort((a,b)=>b[1]!-a[1]!).slice(0,3).map(([k,v])=>`${WEIGHT_LABELS[k as keyof RecommenderWeights]}: +${v}`);
 return {message:'',recommendation:{klausur:main.klausur,assigned:false,reasons:[`Heuristische Empfehlung · ${main.score} Punkte`,...(missingWeights?["Fehlende Gewichte: angezeigte Standardvorgaben, noch nicht persönlich gespeichert"]:[]),...(phase?[describeStudyPhase(phase)]:[]),...signals],alternatives:scored.slice(1,3).map(s=>({klausur:s.klausur,reason:`Heuristik · ${s.score} Punkte`}))}};
}
export function recommendationTask(view:ScheduleView,date:string,klausur:AccountCase,mode:'written'|'read',id:string):{operation?:ScheduleOperation;existing?:DailyTask;message?:string}{
 const tasks=scheduleValues<DailyTask>(view,'task').filter(t=>t.date===date&&!t.deferred),existing=tasks.find(t=>t.linkedKlausurId===klausur.id&&isSketchTask(t)===(mode==='read'));
 if(existing)return {existing};
 const {events,settings}=accountCalendarData(view);
 if(isStudyFreeDay(date,settings,events))return {message:'Heute ist ein freier Tag oder Urlaub. Bitte einen anderen Tag im Lernkalender wählen.'};
 const proposed={id,date,title:`${mode==='read'?'Skizze':'Klausur'}: ${klausur.title}`,durationMinutes:mode==='read'?120:300,linkedKlausurId:klausur.id};
 const budget=computeDayBudget([...tasks,proposed],eventsOnDate(events,date),{suppressReserve:true,maxHours:dailyHours(settings)});
 if(budget.overloadH>0)return {message:`Das Tagesbudget würde um ${budget.overloadH.toFixed(1)} Stunden überschritten. Bitte zuerst den Lernkalender anpassen.`};
 const validTopics=klausur.topicIds.filter(id=>leaves.has(id));
 return {operation:{type:'task.save',id,date,title:proposed.title,durationMinutes:proposed.durationMinutes,topicIds:validTopics.length<=15?validTopics:[],klausurId:klausur.id,isReview:false}};
}
