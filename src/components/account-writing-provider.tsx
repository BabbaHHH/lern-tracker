'use client';
import {useEffect,useState} from 'react';
import {CorrectionClient} from '@/lib/learning/correction-client';
import {CorrectionContext} from '@/lib/learning/use-account-correction';
import {WritingClient} from '@/lib/learning/writing-client';
import {WritingContext} from '@/lib/learning/use-account-writing';
export function AccountWritingProvider({children}:{children:React.ReactNode}){
 const [client]=useState(()=>new WritingClient());
 const [correction]=useState(()=>new CorrectionClient(undefined,()=>client.load()));
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==='visible')void client.load(true);else client.hide();};
  const focus=()=>{if(client.active)refresh();if(correction.active){if(document.visibilityState==='visible')void correction.load(true);else correction.hide();}};
  const unload=(e:BeforeUnloadEvent)=>{if(client.hasUnconfirmed())e.preventDefault();};
  window.addEventListener('focus',focus);window.addEventListener('pageshow',focus);document.addEventListener('visibilitychange',focus);window.addEventListener('beforeunload',unload);
  const poll=setInterval(()=>{if(client.active&&document.visibilityState==='visible'&&!client.state.busy&&client.state.status==='ready')void client.load();if(correction.active&&document.visibilityState==='visible'&&!correction.state.busy&&correction.state.status==='ready')void correction.load();},8000);
  return()=>{clearInterval(poll);window.removeEventListener('focus',focus);window.removeEventListener('pageshow',focus);document.removeEventListener('visibilitychange',focus);window.removeEventListener('beforeunload',unload);client.dispose();correction.dispose();};
 },[client,correction]);
 return <WritingContext.Provider value={client}><CorrectionContext.Provider value={correction}>{children}</CorrectionContext.Provider></WritingContext.Provider>;
}
