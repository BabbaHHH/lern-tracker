"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain, MessageCircle, Sparkles } from "lucide-react";
import { useAccountPersonal } from "@/lib/learning/use-account-personal";
import { useAccountProgress } from "@/lib/learning/use-account-progress";
import { useAccountSchedule } from "@/lib/learning/use-account-schedule";
import { useAccountSettings } from "@/lib/learning/use-account-settings";
import { profileDraft, sameLearningAccount } from "@/lib/learning/personal-contract";
import { settingsAccountKey } from "@/lib/learning/settings-contract";
import { AccountPersonalStatus } from "./account-personal-status";
import { Countdown } from "./countdown";
import { TopicGrid } from "./topic-grid";
import { AccountDashboardProgram } from "./account-dashboard-program";
import { AccountKlausurDesTages } from "./account-klausur-des-tages";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function AccountLearningDashboard() {
  const personal = useAccountPersonal(), progress = useAccountProgress(), schedule = useAccountSchedule(), settings = useAccountSettings();
  const ready = personal.status === "ready" && progress.status === "ready" && schedule.status === "ready"
    && !settings.hidden && personal.view && schedule.view
    && sameLearningAccount(personal.view.account, progress.account)
    && sameLearningAccount(personal.view.account, schedule.view.account)
    && sameLearningAccount(personal.view.account, settings.view?.account ?? null);
  return <main className="flex-1 pb-8 pt-4 md:pt-6 px-4 max-w-5xl mx-auto w-full">
    <h1 className="sr-only">Deine Lernübersicht</h1>
    {personal.status !== "ready" && <AccountPersonalStatus {...personal} />}
    {progress.status !== "ready" && <AccountPersonalStatus {...progress} />}
    {schedule.status !== "ready" && <AccountPersonalStatus {...schedule} />}
    {settings.hidden && <div role="status" className="border border-slate-200 p-4 my-4 text-sm"><p>{settings.message || "Anmeldung und Einstellungen werden geprüft …"}</p><button className="underline mt-2" disabled={settings.busy} onClick={() => void settings.client.recover()}>Erneut prüfen</button><Link className="underline ml-4" href="/konto/anmelden">Zur Anmeldung</Link></div>}
    {ready ? <AccountDashboardBody key={settingsAccountKey(personal.view!.account)} personal={personal} progress={progress} schedule={schedule} settings={settings} />
      : personal.status === "ready" && progress.status === "ready" && schedule.status === "ready" && !settings.hidden ? <p role="status">Die Anmeldung hat sich geändert. Der Lernstand wird erneut geprüft.</p> : null}
  </main>;
}

function AccountDashboardBody({ personal, progress, schedule, settings }: { personal: ReturnType<typeof useAccountPersonal>; progress: ReturnType<typeof useAccountProgress>; schedule: ReturnType<typeof useAccountSchedule>; settings: ReturnType<typeof useAccountSettings> }) {
  const [checkinOpen, setCheckinOpen] = useState(false);
  const dates = profileDraft(personal.view!);
  return <>
    <div className="mb-5"><Countdown accountDates={{ exam: dates.examDate, start: dates.lernstart }} /></div>
    {(schedule.message || progress.message || personal.message) && <p role="status" className="mb-4 text-sm text-slate-600">{schedule.message || progress.message || personal.message}</p>}
    <div className="mb-5"><AccountDashboardProgram data={{ ...schedule, view: schedule.view!, submit: async (op, rendered) => { const result = await schedule.submit(op, rendered); if (result && op.type === "exam.record") progress.refresh(); return result; } }} /></div>
    <div className="mb-5"><AccountKlausurDesTages schedule={schedule} personal={personal.view!} progress={{account:progress.account!,progress:progress.records}} settings={settings.view!} onRecorded={progress.refresh} /></div>
    <Link href="/plan" className="mb-6 border border-slate-200 bg-white px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
      <div className="w-10 h-10 border border-slate-200 flex items-center justify-center shrink-0"><Brain className="h-4 w-4 text-slate-900" /></div>
      <div className="flex-1 min-w-0"><div className="font-serif text-[15px] text-slate-900 tracking-tight leading-tight">Lernplan anpassen</div><div className="font-sans text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 mt-1">Gespeicherte Entwürfe prüfen · neue KI-Planung folgt später</div></div>
    </Link>
    <TopicGrid remote={{ progress, personal }} />
    <Link href="/onboarding" className="mt-6 mb-8 border border-slate-200 bg-white px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"><Sparkles className="h-4 w-4 shrink-0" /><span className="font-serif text-[15px]">Profil & Stationen bearbeiten</span></Link>
    <button onClick={() => setCheckinOpen(true)} className="fixed bottom-24 right-4 md:bottom-12 md:right-12 w-14 h-14 md:w-16 md:h-16 z-40 bg-slate-900 hover:bg-accent-600 text-white flex items-center justify-center transition-colors" title="Abend-Check-in" aria-label="Abend-Check-in"><MessageCircle className="h-5 w-5" /></button>
    <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}><DialogContent className="sm:max-w-lg rounded-none border border-slate-200 shadow-none"><DialogHeader><DialogTitle className="flex items-center gap-3 font-serif text-lg font-normal"><MessageCircle className="h-4 w-4" />Abend-Check-in</DialogTitle></DialogHeader><p className="text-sm text-slate-600">Der KI-Check-in ist im ersten Pilot noch nicht verfügbar. Du kannst deinen Lernfortschritt bei den Themen und deine tatsächlichen Lerneinheiten im Tagesprogramm manuell eintragen.</p><Link href="/themen" className="underline">Zu den Themen</Link><p className="text-xs text-slate-500">Auch neue KI-Lernplanung und KI-Korrektur bleiben im Pilot gesperrt.</p></DialogContent></Dialog>
  </>;
}
