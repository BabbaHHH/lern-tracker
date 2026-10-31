'use client';
import {createContext,useContext,useEffect,useSyncExternalStore} from 'react';
import type {CorrectionClient} from './correction-client';
export const CorrectionContext=createContext<CorrectionClient|null>(null);
export function useAccountCorrection(draftId?:string){const client=useContext(CorrectionContext);if(!client)throw Error('Kontokorrekturkontext fehlt.');const state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);useEffect(()=>{void client.open(draftId);return client.detach;},[client,draftId]);return {...state,client};}
