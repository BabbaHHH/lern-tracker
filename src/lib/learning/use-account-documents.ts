'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {DocumentsClient} from './documents-client';
export function useAccountDocuments(){const [client]=useState(()=>new DocumentsClient());const state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
 useEffect(()=>{const timer=setTimeout(()=>void client.load(true),0);const refresh=()=>{if(document.visibilityState==='visible')void client.load(true);else client.hide();};window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);const poll=setInterval(()=>{if(document.visibilityState==='visible')void client.load();},5000);return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);client.hide();};},[client]);return {client,...state};}
