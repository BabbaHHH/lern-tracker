'use client';
import { useEffect,useState,useSyncExternalStore } from 'react';
import type { ProfilePatch,ProfileRevisions } from './personal-contract';
import { PersonalClient } from './personal-client';
export function useAccountPersonal(){
  const [client]=useState(()=>new PersonalClient());const state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
  useEffect(()=>{const timer=setTimeout(()=>void client.load(true),0);const refresh=()=>{if(document.visibilityState==='visible')void client.load(true);else client.hide();};
    window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);const poll=setInterval(()=>{if(document.visibilityState==='visible'&&client.state.status==='ready')void client.load();},5000);
    return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);client.hide();};
  },[client]);
  return {...state,saveProfile:(fields:ProfilePatch,revisions:ProfileRevisions)=>state.view?client.saveProfile(fields,revisions,state.view.account):Promise.resolve(null),saveNote:(id:string,topicId:string,note:string,revision:number|null)=>state.view?client.saveNote(id,topicId,note,revision,state.view.account):Promise.resolve(null),reload:()=>void client.load(true),recover:()=>void client.recover()};
}
