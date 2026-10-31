import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOPICS, getLeafTopics } from '../src/lib/topics';
import { profilePatchError } from '../src/lib/learning/profile-fields';
import { validatePersonalCommand } from '../src/lib/server/learning/personal-service';

const term = {id:'ag-one',label:'AG',day:'Montag',frequency:'wöchentlich',topic:'Zivilrecht',durationHours:3,prepHours:1,postHours:0.5,startDate:'2026-10-01',endDate:'2027-01-31'};
const topic = getLeafTopics(TOPICS)[0].id;
const bad: [string,unknown][] = [
  ['leeres Patch',{}],['unbekanntes Feld',{documents:[]}],['Parsertext',{fullText:'Text'}],
  ['unmögliches Datum',{probeexamen1Start:'2027-02-29'}],['typfalsches Datum',{lernstart:20261001}],
  ['Planungsart als Liste',{studyPlanningMode:['station']}],['Boolstatus',{completed:1}],
  ['NaN',{maxDailyHours:NaN}],['unendliche Dauer',{maxDailyHours:Infinity}],['Tagesgrenze',{maxDailyHours:11}],
  ['Bruchteile von Minuten',{maxDailyHours:1.001}],['freier Tag',{freeDayPerWeek:'Funday'}],
  ['Urlaubsduplikat',{vacationDates:['2026-10-26','2026-10-26']}],['Urlaubsgrenze',{vacationDates:Array(731).fill('2026-10-26')}],
  ['unmöglicher Urlaubstag',{vacationDates:['2026-04-31']}],['Nulltermin',{ags:[null]}],
  ['doppelte Kennung',{ags:[term,term]}],['fehlende Kennung',{ags:[{...term,id:''}]}],['unerlaubte Kennung',{ags:[{...term,id:'../../other'}]}],
  ['leerer Titel',{ags:[{...term,label:' '}]}],['fehlende Dauer',{ags:[{...term,durationHours:undefined}]}],
  ['negative Vorbereitung',{ags:[{...term,prepHours:-1}]}],['Nullstunden',{ags:[{...term,durationHours:0}]}],
  ['Zeitumkehr',{ags:[{...term,startDate:'2027-01-01',endDate:'2026-12-31'}]}],
  ['Parseridentität',{reps:[{id:'rep',label:'Rep',day:'Dienstag',durationHours:2,prepHours:0,postHours:0,startDate:'',endDate:'',scheduleDocIndex:0}]}],
  ['Phasenquelle als Objekt',{studyPhases:[{id:'s',label:'Phase',start:'2026-10-01',end:'2026-10-31',focus:'zr',perspective:'state',sourceDocument:{name:'Quelle'}}]}],
  ['unmögliches Seminar',{kaiserSeminare:[{date:'2026-02-30',topic:'ZR',durationDays:2}]}],
  ['Seminardauer',{kaiserSeminare:[{date:'2026-10-26',topic:'ZR',durationDays:31}]}],
  ['unbekanntes Blattthema',{selfAssessment:{'invented-topic':50}}],['Prozentgrenze',{selfAssessment:{[topic]:101}}],
  ['Prozenttyp',{selfAssessment:{[topic]:'50'}}],['Textgrenze',{notes:'x'.repeat(10001)}],
];
for (const [name, fields] of bad) test(`R36-B1 Eingabegrenze: ${name}`,()=> {
  assert.ok(profilePatchError(fields));
  assert.throws(()=>validatePersonalCommand({contractVersion:1,requestId:'c2_invalid',expectedAccountId:'a',expectedAccessGeneration:1,expectedSessionContext:'a'.repeat(64),action:'profile',expectedRevisions:{profile:null,examDate:null,lernstart:null},fields}),{code:'invalid_input'});
});
test('R36-B1: gültige partielle und manuelle Grenzwerte',()=>{
  for (const fields of [{notes:''},{maxDailyHours:1},{maxDailyHours:10},{completed:false},{selfAssessment:{[topic]:0,[TOPICS[0].id]:100}},
    {probeexamen1Start:'2028-02-29',probeexamen2Start:''},{ags:[term]},{ags:[]},{kaiserSeminare:[{date:'2026-10-26',topic:'Zivilrecht',durationDays:30}]}]) assert.equal(profilePatchError(fields),null);
});
