'use client';
import {useEffect,useLayoutEffect,useState,useSyncExternalStore} from 'react';
import {usePathname} from 'next/navigation';
import {SettingsClient} from '@/lib/learning/settings-client';
import {SettingsContext} from '@/lib/learning/use-account-settings';
import {THEMES} from '@/lib/learning/settings-contract';
const SIGNED_OUT='stex:account-signed-out';
export function notifyAccountSignedOut(){
 document.documentElement.dataset.theme='indigo';
 window.dispatchEvent(new Event(SIGNED_OUT));
}
export function AccountSettingsProvider({children}:{children:React.ReactNode}){
 const [client,setClient]=useState(()=>new SettingsClient()),state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot),path=usePathname();
 useLayoutEffect(()=>{const reset=()=>{client.hide();document.documentElement.dataset.theme='indigo';setClient(new SettingsClient());};window.addEventListener(SIGNED_OUT,reset);return()=>window.removeEventListener(SIGNED_OUT,reset);},[client]);
 useLayoutEffect(()=>{client.hide();document.documentElement.dataset.theme='indigo';const timer=setTimeout(()=>void client.load(),0);return()=>clearTimeout(timer);},[client,path]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')void client.load(true);else client.hide();};window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);const poll=setInterval(()=>{if(document.visibilityState==='visible')void client.load();},5000);return()=>{clearInterval(poll);window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);client.hide();document.documentElement.dataset.theme='indigo';};},[client]);
 useLayoutEffect(()=>{const saved=state.hidden?null:state.view?.rows.find(r=>r.kind==='theme'&&r.id==='lerntracker-theme'&&r.revision!==null)?.payload;document.documentElement.dataset.theme=THEMES.some(t=>t.id===saved)?String(saved):'indigo';},[state.hidden,state.view]);
 return <SettingsContext.Provider value={client}>{children}</SettingsContext.Provider>;
}
