"use client";

import { useState, useEffect } from "react";
import { NavBar } from "@/components/nav-bar";
import { Countdown } from "@/components/countdown";
import { TopicGrid } from "@/components/topic-grid";
import { CheckinChat } from "@/components/checkin-chat";
import { getOnboarding } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KlausurDesTages } from "@/components/klausur-des-tages";
import { TrackingFab } from "@/components/tracking-fab";
import { MessageCircle, Sparkles, Settings, Brain } from "lucide-react";
import { ThemePicker } from "@/components/theme-picker";
import { TodayProgram } from "@/components/today-program";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function DashboardPage() {
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(true);

  useEffect(() => {
    setOnboardingDone(getOnboarding().completed);
  }, []);

  return (
    <>
      <NavBar />
      <main className="flex-1 pb-24 pt-4 md:pt-20 px-4 max-w-5xl mx-auto w-full">
        {/* Mobile Header */}
        <div className="flex items-center justify-between mb-5 md:hidden border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-slate-200 flex items-center justify-center font-sans text-[11px] font-bold text-slate-900">
              S
            </div>
            <h1 className="font-serif text-lg font-normal tracking-tight text-slate-900">Stex Tracker</h1>
          </div>
          <div className="flex gap-2">
            <ThemePicker />
            <Link href="/onboarding">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-none">
                <Sparkles className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-none">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Onboarding Banner */}
        {!onboardingDone && (
          <Link href="/onboarding">
            <div className="mb-5 border border-slate-200 bg-white px-6 py-5 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="w-10 h-10 border border-slate-200 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-slate-900" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-serif text-lg font-normal text-slate-900 tracking-tight leading-tight">Lernplan erstellen</h2>
                <p className="font-sans text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 mt-1">
                  KI erstellt deinen individuellen Examensplan
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Countdown */}
        <div className="mb-5">
          <Countdown />
        </div>

        {/* Tagesprogramm */}
        <div className="mb-5">
          <TodayProgram />
        </div>

        {/* Klausur des Tages */}
        <div className="mb-5">
          <KlausurDesTages />
        </div>

        {/* Plan Adjust Button */}
        <Link href="/plan">
          <div className="mb-6 border border-slate-200 bg-white px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="w-10 h-10 border border-slate-200 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[15px] font-normal text-slate-900 tracking-tight leading-tight">Lernplan anpassen</div>
              <div className="font-sans text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 mt-1">Opus 4.6 analysiert deinen Fortschritt</div>
            </div>
            <span className="font-sans text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500 border border-slate-200 px-2 py-1 shrink-0">KI</span>
          </div>
        </Link>

        {/* Topic Grid */}
        <TopicGrid />
      </main>

      {/* Tracking FAB */}
      <TrackingFab />

      {/* Check-in FAB */}
      <button
        onClick={() => setCheckinOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-12 md:right-12 w-14 h-14 md:w-16 md:h-16 z-40 bg-slate-900 hover:bg-accent-600 text-white flex items-center justify-center transition-colors"
        title="Abend-Check-in"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      {/* Check-in Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-w-lg mx-auto h-[80vh] flex flex-col p-0 rounded-none border border-slate-200 shadow-none">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-3 font-serif text-lg font-normal text-slate-900 tracking-tight">
              <div className="w-8 h-8 border border-slate-200 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-slate-900" />
              </div>
              Abend-Check-in
            </DialogTitle>
          </DialogHeader>
          <CheckinChat onClose={() => setCheckinOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
