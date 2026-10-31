"use client";
import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { planPageAllowed } from "@/lib/learning/plan-contract";

import { writingPageAllowed } from '@/lib/learning/writing-contract';
import { AccountWritingProvider } from './account-writing-provider';
import {AccountSettingsProvider} from './account-settings-provider';
import {NavBar} from './nav-bar';
import {ProjectFooter} from './project-footer';

const LearningMode = createContext(false);
export const useAccountLearningMode = () => useContext(LearningMode);
export function AccountLearningBoundary({accountMode,children}:{accountMode:boolean;children:React.ReactNode}) {
  const path=usePathname();
  return <LearningMode.Provider value={accountMode}>{!accountMode?<>{children}<ProjectFooter /></>:<AccountSettingsProvider><AccountWritingProvider>
    <div className="flex min-h-screen flex-col pb-16 md:pb-0 md:pt-14">
      <NavBar accountMode />
      {path==="/konto"&&<p className="mx-auto w-full max-w-3xl px-4 pt-4 text-sm">Deine Lernnotizen findest du bei den Themen in der <Link href="/" className="underline">Lernübersicht</Link>.</p>}
      {path==="/admin"||planPageAllowed(path)||writingPageAllowed(path)?children:<main className="mx-auto max-w-2xl px-4 py-12"><h1 className="font-serif text-xl">Diese Lernansicht wird noch angebunden</h1><p className="mt-3">Profil, Themen, Lernkalender und Schreiben kannst du bereits mit deinem Konto nutzen.</p><Link href="/themen" className="mt-4 inline-block underline">Zu allen Themen</Link></main>}
      <ProjectFooter accountMode />
    </div>
  </AccountWritingProvider></AccountSettingsProvider>}</LearningMode.Provider>;
}
