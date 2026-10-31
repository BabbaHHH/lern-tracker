'use client';
import {createContext,useContext,useSyncExternalStore} from 'react';
import type {SettingsClient} from './settings-client';
export const SettingsContext=createContext<SettingsClient|null>(null);
export function useAccountSettings(){const client=useContext(SettingsContext);if(!client)throw Error('Kontoeinstellungen fehlen.');const state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);return {client,...state};}
