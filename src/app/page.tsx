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
        <div className="flex items-center justify-between mb-5 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-900 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <span className="text-white text-sm font-black">S</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Stex Tracker</h1>
          </div>
          <div className="flex gap-1.5">
            <Link href="/onboarding">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/60 hover:bg-white text-slate-500 border border-slate-200/60">
                <Sparkles className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/60 hover:bg-white text-slate-500 border border-slate-200/60">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Onboarding Banner */}
        {!onboardingDone && (
          <Link href="/onboarding">
            <div className="mb-5 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-700 p-4 text-white cursor-pointer shadow-[0_10px_40px_-12px_rgba(99,102,241,0.45)] hover:shadow-[0_16px_50px_-12px_rgba(99,102,241,0.55)] transition-all ring-1 ring-white/10">
              <div className="pointer-events-none absolute top-0 right-0 w-40 h-40 bg-white/15 rounded-full blur-3xl -translate-y-8 translate-x-8" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="relative flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/20 shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold tracking-tight">Lernplan erstellen</h2>
                  <p className="text-sm text-white/85">
                    KI erstellt deinen individuellen Examensplan
                  </p>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Countdown */}
        <div className="mb-5">
          <Countdown />
        </div>

        {/* Klausur des Tages */}
        <div className="mb-5">
          <KlausurDesTages />
        </div>

        {/* Plan Adjust Button */}
        <Link href="/plan">
          <div className="group mb-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] p-4 flex items-center gap-3 transition-all cursor-pointer">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 ring-1 ring-indigo-200/60 text-indigo-600 shrink-0">
              <Brain className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 tracking-tight">Lernplan anpassen</div>
              <div className="text-[11px] text-slate-500">Opus 4.6 analysiert deinen Fortschritt</div>
            </div>
            <Badge className="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60 text-[10px] shrink-0 border-0">KI</Badge>
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
        className="fixed bottom-[80px] right-4 md:bottom-6 md:right-6 z-40 bg-gradient-to-br from-slate-900 to-indigo-600 text-white rounded-2xl p-3.5 shadow-[0_10px_30px_-8px_rgba(99,102,241,0.45)] hover:shadow-[0_16px_40px_-8px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 transition-all active:scale-95 ring-1 ring-white/20"
        title="Abend-Check-in"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      {/* Check-in Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-w-lg mx-auto h-[80vh] flex flex-col p-0 rounded-2xl">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-slate-900 to-indigo-600 flex items-center justify-center">
                <MessageCircle className="h-3.5 w-3.5 text-white" />
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
