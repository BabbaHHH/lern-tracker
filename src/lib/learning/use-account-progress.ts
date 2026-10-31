"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ProgressClient } from "./progress-client";

export function useAccountProgress() {
  const [client] = useState(()=>new ProgressClient());
  const state = useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
  useEffect(()=>{
    // A React development effect replay must not permanently dispose the client.
    const timer=setTimeout(()=>void client.load(true),0);
    const refresh=()=>{if(document.visibilityState==="visible")void client.load(true);else client.hide();};
    window.addEventListener("pageshow",refresh);window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    const poll=setInterval(()=>{if(document.visibilityState==="visible")void client.load();},5000);
    return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener("pageshow",refresh);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);client.hide();};
  },[client]);
  return {...state,progressMap:{...Object.fromEntries(state.records.map(record=>[record.id,record.value.percent])),...state.draft},
    change:(updates:Record<string,number>,bulk=false)=>client.stage(updates,bulk,Object.fromEntries(state.records.map(r=>[r.id,r.revision]))),undo:()=>void client.undo(),dismissUndo:client.dismissUndo,refresh:()=>void client.load(),reload:()=>void client.load(true),recover:()=>void client.recover()};
}
