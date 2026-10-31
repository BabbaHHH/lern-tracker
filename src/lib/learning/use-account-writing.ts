'use client';
import {createContext,useContext,useEffect,useSyncExternalStore} from 'react';
import type {WritingSelection} from './writing-contract';
import type {WritingClient} from './writing-client';
export const WritingContext=createContext<WritingClient|null>(null);
export function useAccountWriting(selection?:WritingSelection){
 const client=useContext(WritingContext);if(!client)throw Error('Kontoschreibkontext fehlt.');
 const state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
 const kind=selection?.kind,id=selection?.id;
 useEffect(()=>{void client.open(kind&&id?{kind,id}:undefined);return client.detach;},[client,kind,id]);
 return {...state,client};
}
