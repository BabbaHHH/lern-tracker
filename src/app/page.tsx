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
      <main className="flex-1 pb-20 pt-3 md:pt-16 px-4 max-w-5xl mx-auto w-full">
        {/* Mobile Header */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-white text-sm font-black">S</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-gradient">Stex Tracker</h1>
          </div>
          <div className="flex gap-1">
            <Link href="/onboarding">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Sparkles className="h-4 w-4 text-slate-400" />
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4 text-slate-400" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Onboarding Banner */}
        {!onboardingDone && (
          <Link href="/onboarding">
            <div className="mb-5 relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-4 text-white cursor-pointer card-hover">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-8 translate-x-8" />
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold">Lernplan erstellen</h2>
                  <p className="text-sm text-white/80">
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

        {/* Plan Adjust Button */}
        <Link href="/plan">
          <div className="mb-5 bg-white rounded-2xl border border-slate-200 p-3.5 flex items-center gap-3 card-hover cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800">Lernplan anpassen</div>
              <div className="text-[11px] text-slate-400">Opus 4.6 analysiert deinen Fortschritt</div>
            </div>
            <Badge className="bg-purple-100 text-purple-700 text-[10px] shrink-0">KI</Badge>
          </div>
        </Link>

        {/* Topic Grid */}
        <TopicGrid />
      </main>

      {/* Check-in FAB */}
      <button
        onClick={() => setCheckinOpen(true)}
        className="fixed bottom-[72px] right-4 md:bottom-6 md:right-6 z-40 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-3.5 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all active:scale-95"
        title="Abend-Check-in"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      {/* Check-in Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-w-lg mx-auto h-[80vh] flex flex-col p-0 rounded-2xl">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
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
