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
import { GraduationCap, MessageCircle, Sparkles, RotateCcw } from "lucide-react";
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
      <main className="flex-1 pb-20 pt-4 md:pt-20 px-4 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 md:hidden">
            <GraduationCap className="h-7 w-7 text-emerald-600" />
            <h1 className="text-xl font-bold">Lern-Tracker</h1>
          </div>
          <Link href="/onboarding" className="md:hidden">
            <Button variant="ghost" size="sm" className="text-gray-500">
              <RotateCcw className="h-4 w-4 mr-1" />
              Onboarding
            </Button>
          </Link>
        </div>

        {/* Onboarding Banner */}
        {!onboardingDone && (
          <Link href="/onboarding">
            <div className="mb-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3">
                <Sparkles className="h-8 w-8 shrink-0" />
                <div>
                  <h2 className="font-bold text-lg">Lernplan erstellen</h2>
                  <p className="text-sm text-emerald-100">
                    Starte das Onboarding — die KI erstellt deinen individuellen Examensplan.
                  </p>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Countdown */}
        <div className="mb-6">
          <Countdown />
        </div>

        {/* Themen-Grid */}
        <TopicGrid />
      </main>

      {/* Check-in FAB */}
      <button
        onClick={() => setCheckinOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all active:scale-95"
        title="Abend-Check-in"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Check-in Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-w-lg mx-auto h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Abend-Check-in
            </DialogTitle>
          </DialogHeader>
          <CheckinChat onClose={() => setCheckinOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
