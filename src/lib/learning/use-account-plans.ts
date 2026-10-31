'use client';
import { useEffect,useState,useSyncExternalStore } from 'react';
import type { PlanOperation,PlanView } from './plan-contract';
import { PlanClient } from './plan-client';
export function useAccountPlans(){
  const [client]=useState(()=>new PlanClient());const state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
  useEffect(()=>{const timer=setTimeout(()=>void client.load(true),0);const refresh=()=>{if(document.visibilityState==='visible')void client.load(true);else client.hide();};
    window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);const poll=setInterval(()=>{if(document.visibilityState==='visible'&&client.state.status==='ready')void client.load();},5000);
    return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);client.hide();};
  },[client]);
  return {...state,submit:(operation:PlanOperation,rendered:PlanView|null=state.view)=>rendered?client.submit(operation,rendered):Promise.resolve(null),previewDraft:(id:string,revision:number,rendered:PlanView)=>client.preview(id,revision,rendered),reload:()=>void client.load(true),recover:()=>void client.recover()};
}
