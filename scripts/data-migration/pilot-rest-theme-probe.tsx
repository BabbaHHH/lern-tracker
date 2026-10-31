/** Disposable browser fixture: real React/provider, mocked settings transport, no credentials/provider. */
import React,{useContext,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {AccountSettingsProvider,notifyAccountSignedOut} from '../../src/components/account-settings-provider';
import {SettingsContext} from '../../src/lib/learning/use-account-settings';
import type {SettingsClient} from '../../src/lib/learning/settings-client';
let current:SettingsClient,owner='a',late=false,release:(value:Response)=>void,aborted=false;
const view=(userId:string)=>({contractVersion:1,account:{userId,accessGeneration:1,sessionContext:userId.repeat(64)},rows:[{kind:'theme',id:'lerntracker-theme',revision:1,payload:userId==='a'?'azure':'forest',editable:true,issues:[]}],recent:[]});
window.fetch=async(_input,init)=>{if(late){late=false;init?.signal?.addEventListener('abort',()=>{aborted=true;});return new Promise<Response>(r=>{release=r;});}return owner?Response.json(view(owner)):Response.json({error:{code:'unauthorized',message:'Synthetic signed out'}},{status:401});};
function Probe(){const client=useContext(SettingsContext)!;useLayoutEffect(()=>{current=client;},[client]);return <p>Realer Provider montiert</p>;}
const delay=()=>new Promise<void>(r=>setTimeout(r,20));
async function run(){const checks:string[]=[];const check=(b:boolean,s:string)=>{if(!b)throw Error(s);checks.push(s);};
 flushSync(()=>createRoot(document.getElementById('root')!).render(<AccountSettingsProvider><Probe/></AccountSettingsProvider>));await delay();await current.load();await delay();
 check(document.documentElement.dataset.theme==='azure','A theme confirmed');const old=current;old.edit(old.state.view!.rows[0],'value','forest');late=true;const pending=old.load();owner='';
 flushSync(()=>notifyAccountSignedOut());check(document.documentElement.dataset.theme==='indigo','Synchronous neutral theme before returning to caller');check(old.state.hidden&&aborted,'Old client hidden and request aborted synchronously');check(current!==old&&current.state.view===null&&Object.keys(current.state.buffers).length===0,'New client has no old account or input buffer');
 release!(Response.json(view('a')));await pending;await delay();check(document.documentElement.dataset.theme==='indigo'&&current.state.hidden,'Late A response cannot restore theme after signout');owner='b';await current.load(true);await delay();check(document.documentElement.dataset.theme==='forest'&&current.state.view?.account.userId==='b','New login confirms only B theme');
 document.getElementById('result')!.textContent=JSON.stringify({passed:checks.length,checks},null,2);
}
document.getElementById('run')!.onclick=()=>{void run().catch(e=>{document.getElementById('result')!.textContent=String(e);});};
