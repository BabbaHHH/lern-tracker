'use client';
import { useEffect,useState,useSyncExternalStore } from 'react';
import type {PreparationPreview,PreparationView} from './preparation-contract';
import { PreparationClient } from './preparation-client';
export function useAccountPreparation(){
  const [client]=useState(()=>new PreparationClient());const state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
  useEffect(()=>{const timer=setTimeout(()=>void client.load(true),0);const refresh=()=>{if(document.visibilityState==='visible')void client.load(true);else client.hide();};
    window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);const poll=setInterval(()=>{if(document.visibilityState==='visible'&&client.state.status==='ready')void client.load();},5000);
    return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);client.hide();};
  },[client]);
  return {...state,submit:(preview:PreparationPreview,rendered:PreparationView|null=state.view)=>rendered?client.submit(preview,rendered):Promise.resolve(null),previewDays:(dates:string[],rendered:PreparationView)=>client.preview(dates,rendered),reload:()=>void client.load(true),recover:()=>void client.recover()};
}
