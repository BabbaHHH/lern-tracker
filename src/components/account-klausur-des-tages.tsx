"use client";
import {useState} from 'react';
import {localDate} from '@/lib/dates';
import type {useAccountSchedule} from '@/lib/learning/use-account-schedule';
import type {PersonalView} from '@/lib/learning/personal-contract';
import type {ProgressView} from '@/lib/learning/progress-contract';
import {settingsAccountKey,type SettingsView} from '@/lib/learning/settings-contract';
import {scheduleValues} from '@/lib/learning/schedule-contract';
import {getLeafTopics,TOPICS} from '@/lib/topics';
import type {TrackingEntry} from '@/lib/types';
import type {DailyTask} from '@/lib/store';
import {AccountRecommendationView} from './account-recommendation-view';
import {accountRecommendation,recommendationTask} from './account-recommendation-model';
export function AccountKlausurDesTages({schedule,personal,progress,settings,onRecorded}:{schedule:ReturnType<typeof useAccountSchedule>;personal:PersonalView;progress:Pick<ProgressView,"account"|"progress">;settings:SettingsView;onRecorded:()=>void}){
 const [notice,setNotice]=useState({key:'',message:''});if(!schedule.view)return null;
 const view=schedule.view,date=localDate(),key=settingsAccountKey(view.account),result=accountRecommendation({schedule:view,personal,progress,settings,date});
 const entries=scheduleValues<TrackingEntry>(view,'tracking-entry').filter(e=>e.activityType==='klausur'&&e.klausurId&&e.date<=date),processed=new Map<string,{date:string;mode:'written'|'read'}>();
 for(const e of entries){if(!processed.has(e.klausurId!)||processed.get(e.klausurId!)!.date<e.date)processed.set(e.klausurId!,{date:e.date,mode:e.klausurMode??'written'});}
 if(!result.recommendation)return <section className="rounded-2xl bg-slate-900 p-5 text-white"><h2 className="text-xs mb-3">Klausur des Tages</h2><p className="text-sm">{result.message}</p></section>;
 return <AccountRecommendationView key={key+result.recommendation.klausur.id} recommendation={result.recommendation} hasKlausuren={!!view.klausuren.length} disabled={schedule.status!=='ready'||schedule.busy||!!schedule.uncertain} processed={processed} taskError={schedule.message||(notice.key===key?notice.message:'')}
 add={async(k,mode)=>{const proposed=recommendationTask(view,date,k,mode,`exam_${crypto.randomUUID()}`);if(proposed.message){setNotice({key,message:proposed.message});return false;}if(proposed.existing){setNotice({key,message:'Diese Klausur steht bereits in diesem Modus im Tagesplan.'});return true;}const r=await schedule.submit(proposed.operation!,view);if(r)setNotice({key,message:'Im Tagesplan gespeichert und bestätigt.'});return !!r;}}
 done={async(k,mode,rating,note)=>{const leaves=new Set(getLeafTopics(TOPICS).map(t=>t.id)),topics=k.topicIds.filter(id=>leaves.has(id));const topicIds=topics.length<=15?topics:[];const existing=scheduleValues<DailyTask>(view,'task').find(t=>t.date===date&&!t.deferred&&t.linkedKlausurId===k.id&&(mode==='read'?/^Skizze/i.test(t.title):!/^Skizze/i.test(t.title)));const r=await schedule.submit({type:'exam.record',taskId:existing?.id??`exam_${crypto.randomUUID()}`,trackingId:existing?.trackingEntryId??`tracking_${crypto.randomUUID()}`,date,klausurId:k.id,klausurMode:mode,topicIds,durationMinutes:mode==='written'?300:120,rating,note},view);if(r){onRecorded();setNotice({key,message:topics.length>15?'Eintrag bestätigt. Wegen mehr als 15 verknüpfter Themen wurde kein pauschaler Themenboost angewendet.':'Eintrag bestätigt.'});}return !!r;}}
 />;
}
