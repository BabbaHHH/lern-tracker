'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {CheckinClient} from './checkin-client';
import type {CheckinView,CheckinResult} from './checkin-contract';
export function useAccountCheckin(){
 const [client]=useState(()=>new CheckinClient());const state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
 useEffect(()=>{const timer=setTimeout(()=>void client.load(true),0);const refresh=()=>{if(document.visibilityState==='visible')void client.load(true);else client.hide();};window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);const poll=setInterval(()=>{if(document.visibilityState==='visible')void client.load();},5000);return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);client.hide();};},[client]);
 return {...state,send:(text:string,view:CheckinView)=>client.send(text,view),apply:(proposal:CheckinResult,view:CheckinView)=>client.apply(proposal,view),select:(result:CheckinResult)=>client.select(result),reload:()=>void client.load(true),recover:()=>void client.recover()};
}
