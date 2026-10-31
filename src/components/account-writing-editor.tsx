"use client";
import {useAccountWriting} from "@/lib/learning/use-account-writing";
import {useAccountSchedule} from "@/lib/learning/use-account-schedule";
import {NOTEPAD_ID,writingKey,type WritingSelection} from "@/lib/learning/writing-contract";
import {settingsAccountKey} from "@/lib/learning/settings-contract";
import {sameLearningAccount} from "@/lib/learning/personal-contract";
import {scheduleValues} from "@/lib/learning/schedule-contract";
import {writingSafeHtml} from "@/lib/learning/writing-html";
import {calculateKlausurDelta,type DailyTask} from "@/lib/store";
import type {Progress,KlausurDraft} from "@/lib/types";
import {localDate} from "@/lib/dates";
import {OriginalSchreibenWorkspace} from "./account-writing-workspace-view";
import {OriginalNotepad} from "./account-writing-notepad-view";
import {AccountPersonalStatus} from "./account-personal-status";
import {AccountWritingStatus,WritingFeedback} from "./account-writing-status";
import {WritingPdfLinks,useWritingCatalog} from "./account-writing-list";
export function AccountWritingEditor({draftId}:{draftId?:string}){
 const selection:WritingSelection=draftId?{kind:'draft',id:draftId}:{kind:'notepad',id:NOTEPAD_ID};
 const state=useAccountWriting(selection),schedule=useAccountSchedule(),key=writingKey(selection),buffer=state.buffers[key];
 const ready=state.status==='ready'&&state.view&&buffer&&!buffer.deleted;
 const catalog=useWritingCatalog(ready&&draftId?settingsAccountKey(state.view!.account):'');
 const status=<AccountWritingStatus state={state} buffer={state.status==='ready'?buffer:undefined} selection={selection}/>;
 if(!ready)return <main className="mx-auto w-full max-w-6xl px-4 py-6">{status}{state.status==='ready'&&!buffer&&<p>Entwurf nicht gefunden.</p>}</main>;
 const editorKey=`${settingsAccountKey(state.view!.account)}:${key}:${buffer.editorVersion}`;
 const saved=!state.busy&&!state.uncertain&&!buffer.conflict&&!buffer.error&&buffer.version===buffer.confirmedVersion&&!!buffer.baseRevision;
 const fields=buffer.fields;
 if(!draftId&&'html' in fields)return <OriginalNotepad remote={{html:writingSafeHtml(fields.html),text:fields.text,editorKey,saved,status,onUpdate:(html,text)=>state.client.edit(selection,{html,text})}}/>;
 if(!('contentHtml' in fields))return null;
 const document=state.view!.document;
 // Existing feedback stays in its actual server shape; the original correction UI gets no invented entries.
 const draft:KlausurDraft={...fields,contentHtml:writingSafeHtml(fields.contentHtml),id:draftId!,feedback:[],createdAt:document?.createdAt??'',updatedAt:document?.updatedAt??''};
 const matched=schedule.status==='ready'&&schedule.view&&sameLearningAccount(schedule.view.account,state.view!.account);
 const progress=matched?new Map(scheduleValues<Progress>(schedule.view!,'progress').map(p=>[p.topicId,p.percent])):new Map<string,number>();
 return <OriginalSchreibenWorkspace draftId={draftId!} remote={{draft,editorKey,saved,
 status:<>{status}{schedule.status!=="ready"||schedule.uncertain?<AccountPersonalStatus {...schedule}/>:schedule.message&&<p role="status">{schedule.message}</p>}</>,
 links:<WritingPdfLinks klausurId={fields.klausurId} entries={catalog.entries}/>,feedback:<WritingFeedback document={document}/>,
 klausuren:matched?schedule.view!.klausuren:[],disabled:!matched||schedule.busy||!!schedule.uncertain||state.busy||state.uncertain,
 onUpdate:(contentHtml,contentText)=>{const latest=state.client.getSnapshot().buffers[key]?.fields;if(latest&&'contentHtml' in latest)state.client.edit(selection,{...latest,contentHtml,contentText});},
 onSachverhalt:sachverhalt=>{const latest=state.client.getSnapshot().buffers[key]?.fields;if(latest&&'contentHtml' in latest)state.client.edit(selection,{...latest,sachverhalt});},
 preview:(ids,rating,mode)=>ids.map(topicId=>{const before=progress.get(topicId)??0,delta=Math.max(0,Math.min(95-before,Math.round(calculateKlausurDelta(before,rating)*(mode==='read'?0.5:1))));return {topicId,before,after:before+delta,delta};}),
 onDone:async(klausur,mode,rating,topicIds)=>{if(!matched||topicIds.length>15)return false;const date=localDate(),existing=scheduleValues<DailyTask>(schedule.view!,'task').find(t=>t.date===date&&t.linkedKlausurId===klausur.id&&!t.deferred&&(mode==='read'?/^Skizze/i.test(t.title):!/^Skizze/i.test(t.title)));const result=await schedule.submit({type:'exam.record',taskId:existing?.id??`exam_${crypto.randomUUID()}`,trackingId:existing?.trackingEntryId??`tracking_${crypto.randomUUID()}`,date,klausurId:klausur.id,klausurMode:mode,topicIds,durationMinutes:mode==='written'?300:120,rating,note:''},schedule.view);return !!result;}
 }}/>;
}
