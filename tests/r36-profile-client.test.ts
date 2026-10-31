import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PersonalClient } from '../src/lib/learning/personal-client';
import { profileRevisions,type PersonalView } from '../src/lib/learning/personal-contract';
const view=(owner:string,session=owner):PersonalView=>({contractVersion:1,account:{userId:owner,accessGeneration:1,sessionContext:session},profile:null,examDate:null,lernstart:null,notes:[]});
test('R36-B1: alter partieller Profilhandler darf unter anderem Konto nichts senden',async()=>{
  const a=view('a'),b=view('b');let current=a,writes=0;
  const client=new PersonalClient(async(_path,options)=>{if(options?.method==='POST')writes++;return Response.json(current);});
  await client.load();current=b;await client.load(true);
  assert.equal(await client.saveProfile({notes:'A-Puffer'},profileRevisions(a),a.account),null);assert.equal(writes,0);assert.equal(client.state.view!.account.userId,'b');client.hide();
});
test('R36-B1: späte Teilprofilbestätigung nach Sitzungswechsel wird verworfen',async()=>{
  const a=view('a','old'),fresh=view('a','new');let current=a,release:(r:Response)=>void=()=>{};
  const client=new PersonalClient(async(_path,options)=>options?.method==='POST'?new Promise<Response>(r=>{release=r;}):Response.json(current));
  await client.load();const saving=client.saveProfile({maxDailyHours:6},profileRevisions(a),a.account);client.hide();current=fresh;await client.load(true);
  release(Response.json({...a,requestId:'c2_old',action:'profile',replay:false,profile:{id:'lerntracker-onboarding',revision:1,value:{maxDailyHours:6}}}));
  assert.equal(await saving,null);assert.equal(client.state.view!.account.sessionContext,'new');assert.equal(client.state.view!.profile,null);assert.equal(client.state.uncertain,false);client.hide();
});
