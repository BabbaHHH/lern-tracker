import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseISO} from 'date-fns';
import {accountOnboardingData,editedProfilePatch} from '../src/components/account-onboarding-model';
import {accountCalendarData,accountWeekAgDays} from '../src/components/account-calendar-model';
import type {PersonalView} from '../src/lib/learning/personal-contract';
import type {ScheduleView} from '../src/lib/learning/schedule-contract';
const personal=():PersonalView=>({contractVersion:1,account:{userId:'workflow-test',accessGeneration:1,sessionContext:'a'.repeat(64)},profile:null,examDate:null,lernstart:null,notes:[]});
const schedule=():ScheduleView=>({contractVersion:1,account:personal().account,personal:personal(),records:[],retired:[],klausuren:[],settings:{}});
test('36.2a Wizardvorgaben bleiben schreibfreie Anzeige; Stations-Defaults werden nicht mitgesendet',()=>{
 const v=personal(),before=JSON.stringify(v),draft=accountOnboardingData(v);assert.equal(draft.maxDailyHours,7);assert.deepEqual(editedProfilePatch(draft,{refStartDate:'',studyPlanningMode:'station',studyPhasesEnabled:true,studyPhases:[]}),{});assert.equal(JSON.stringify(v),before);assert.deepEqual(accountOnboardingData(v),draft);
});
test('36.2a bewusster Teilpatch erhält ausgelassene Terminlisten/Quellen; Dokumenttext ist kein Profilpatch',()=>{
 const before=accountOnboardingData(personal());before.studyPhases=[{id:'retained',label:'Aus Quelle',start:'2026-10-01',end:'2026-12-31',focus:'zr',perspective:'state',sourceDocument:'erhalten.pdf'}];
 assert.deepEqual(editedProfilePatch(before,{maxDailyHours:4,documents:[{name:'kein Profilfeld',type:'text/plain',fullText:'private source'}]}),{maxDailyHours:4});assert.equal(before.studyPhases[0].sourceDocument,'erhalten.pdf');assert.deepEqual(editedProfilePatch(before,{ags:[]}),{});assert.deepEqual(editedProfilePatch({...before,ags:[{id:'manual',label:'AG',day:'Montag',frequency:'wöchentlich',topic:'',durationHours:2,prepHours:0,postHours:0,startDate:'',endDate:''}]},{ags:[]}),{ags:[]});
});
test('36.2a Planungsart übermittelt stets das passende Aktivierungsfeld',()=>{
 const before=accountOnboardingData(personal());assert.deepEqual(editedProfilePatch(before,{studyPlanningMode:'custom'}),{studyPlanningMode:'custom',studyPhasesEnabled:false});
});
test('36.2a gemeinsame Kalenderprojektion verwendet bestätigte Budget-/Seminarwerte ohne gespeicherte Termine zu erzeugen',()=>{
 const v=schedule();v.settings={maxDailyHours:4,freeDayPerWeek:'Mittwoch',vacationDates:['2026-10-27'],kaiserSeminare:[{date:'2026-10-26',topic:'Synthetisches Seminar',durationDays:2}]};const before=JSON.stringify(v);const projected=accountCalendarData(v);assert.equal(projected.settings.maxDailyHours,4);assert.equal(projected.settings.freeDayPerWeek,'Mittwoch');assert.deepEqual(projected.settings.vacationDates,['2026-10-27']);assert.equal(projected.events.length,2);assert.ok(projected.events.every(e=>e.durationMinutes===240));assert.equal(JSON.stringify(v),before);
});
test('36.2a AG-Tage behalten bestätigte Wochenkorrektur und respektieren den Profilzeitraum',()=>{
 const v=schedule();v.settings.ags=[{id:'ag',label:'AG',day:'Montag',frequency:'wöchentlich',topic:'',durationHours:2,prepHours:0,postHours:0,startDate:'2026-10-01',endDate:'2026-10-31'}];assert.deepEqual(accountWeekAgDays(v,parseISO('2026-10-26')),[0]);assert.deepEqual(accountWeekAgDays(v,parseISO('2026-11-02')),[]);v.records=[{kind:'ag-week',id:'2026-W44',revision:1,value:{weekKey:'2026-W44',agDays:[1,3],source:'manual',updatedAt:'2026-10-23'}}];assert.deepEqual(accountWeekAgDays(v,parseISO('2026-10-26')),[1,3]);
});
