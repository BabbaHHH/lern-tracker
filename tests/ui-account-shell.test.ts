import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {accountDashboardCases} from '../src/components/account-dashboard-model';
import {AccountKlausurDesTages} from '../src/components/account-klausur-des-tages';
import {localDate} from '../src/lib/dates';
import type {ScheduleView} from '../src/lib/learning/schedule-contract';
const date=localDate();
const view=():ScheduleView=>({contractVersion:1,account:{userId:'synthetic',accessGeneration:1,sessionContext:'a'.repeat(64)},records:[],retired:[],personal:{contractVersion:1,account:{userId:'synthetic',accessGeneration:1,sessionContext:'a'.repeat(64)},profile:null,examDate:null,lernstart:null,notes:[]},settings:{},klausuren:[{id:'case-a',title:'Synthetischer Fall A',area:'zr',source:'synthetic',createdAt:date,updatedAt:date,date:'',topicIds:[]},{id:'case-b',title:'Synthetischer Fall B',area:'sr',source:'synthetic',createdAt:date,updatedAt:date,date:'',topicIds:[]}]});
test('R36 Startkarte erfindet aus Katalogreihenfolge keine Tagesempfehlung',()=>{
 const v=view();assert.deepEqual(accountDashboardCases(v,date),[]);
 const html=renderToStaticMarkup(createElement(AccountKlausurDesTages,{view:v}));
 assert.match(html,/Für heute ist noch keine konkrete Klausur ausgewählt/);assert.doesNotMatch(html,/Synthetischer Fall A/);assert.match(html,/noch nicht angeschlossen/);
});
test('R36 Startkarte zeigt ausschließlich heutige aktive Verknüpfungen und dedupliziert Termin/Aufgabe',()=>{
 const v=view();v.records=[{kind:'task',id:'active',revision:1,value:{id:'active',date,title:'Heutige Klausur',done:false,source:'manual',createdAt:date,linkedKlausurId:'case-b'}},{kind:'task',id:'deferred',revision:1,value:{id:'deferred',date,title:'Ausgelagert',done:false,source:'manual',createdAt:date,deferred:true,linkedKlausurId:'case-a'}},{kind:'task',id:'future',revision:1,value:{id:'future',date:'2099-12-31',title:'Später',done:false,source:'manual',createdAt:date,linkedKlausurId:'case-a'}},{kind:'calendar-event',id:'event',revision:1,value:{id:'event',date,label:'Klausurtermin',eventType:'klausur',recurring:false,linkedKlausurId:'case-b'}}];
 assert.deepEqual(accountDashboardCases(v,date).map(k=>k.id),['case-b']);
 const html=renderToStaticMarkup(createElement(AccountKlausurDesTages,{view:v}));assert.match(html,/Synthetischer Fall B/);assert.doesNotMatch(html,/Synthetischer Fall A/);assert.match(html,/noch kein PDF zugeordnet/);assert.doesNotMatch(html,/>Klausur lesen</);
});
test('R36 fehlender Katalogbezug bleibt sichtbar und wird nicht durch beliebigen Fall ersetzt',()=>{
 const v=view();v.records=[{kind:'task',id:'missing',revision:1,value:{id:'missing',date,title:'Alter Bezug',done:false,source:'manual',createdAt:date,linkedKlausurId:'unknown'}}];
 assert.equal(accountDashboardCases(v,date)[0].klausur,null);const html=renderToStaticMarkup(createElement(AccountKlausurDesTages,{view:v}));assert.match(html,/derzeit nicht im Katalog verfügbar/);assert.doesNotMatch(html,/Synthetischer Fall/);
});
test('R36 vorhandener geschützter PDF-Vertrag wird mit Dateiversion unverändert weitergereicht',()=>{
 const v=view(),url='/konto/klausuren/pdf?klausurId=case-a&documentId=doc-a&documentVersionId=v1';v.klausuren[0].viewerURL=url;v.records=[{kind:'task',id:'known',revision:1,value:{id:'known',date,title:'Fall',done:false,source:'manual',createdAt:date,linkedKlausurId:'case-a'}}];
 const html=renderToStaticMarkup(createElement(AccountKlausurDesTages,{view:v}));assert.ok(html.includes(url.replaceAll('&','&amp;')));assert.match(html,/>Klausur lesen</);
});
