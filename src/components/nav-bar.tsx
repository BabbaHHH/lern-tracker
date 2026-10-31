"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, BookOpen, Scale, PenLine, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemePicker } from "@/components/theme-picker";
import { AccountDashboardMenu } from "./account-dashboard-menu";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/wochenplan", label: "Lernkalender", icon: Calendar },
  { href: "/themen", label: "Themen", icon: BookOpen },
  { href: "/klausuren", label: "Klausuren", icon: Scale },
  { href: "/schreiben", label: "Schreiben", icon: PenLine },
];

export function NavBar({ accountMode = false }: { accountMode?: boolean } = {}) {
  const pathname = usePathname();

  return (
    <>
    {accountMode && <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:fixed md:left-1/2 md:top-0 md:z-[51] md:w-full md:-translate-x-1/2 md:px-6 md:pt-0 md:pointer-events-none">
      <div className="flex items-center justify-between gap-2 border border-slate-200 bg-white px-4 py-3 md:h-14 md:justify-end md:border-0 md:bg-transparent md:px-0 md:py-0 md:pointer-events-none">
        <Link href="/" className="flex min-w-0 items-center gap-3 md:hidden"><span className="w-8 h-8 border border-slate-200 flex items-center justify-center font-sans text-[11px] font-bold shrink-0">S</span><span className="min-w-0 truncate font-serif text-base font-normal tracking-tight text-slate-900 sm:text-lg">Stex Tracker</span></Link>
        <div className="flex items-center gap-1 shrink-0 sm:gap-2 md:pointer-events-auto">
          <ThemePicker />
          <Link href="/onboarding" title="Profil & Stationen" aria-label="Profil & Stationen" className="hidden md:inline-flex">
            <div className="h-9 w-9 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors"><Sparkles className="h-4 w-4" /></div>
          </Link>
          <AccountDashboardMenu />
        </div>
      </div>
    </div>}
    <nav aria-label="Hauptnavigation" className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white md:top-0 md:bottom-auto md:border-b md:border-t-0">
      <div className="mx-auto max-w-5xl flex items-center justify-around md:justify-start md:gap-1 md:px-6 h-16 md:h-14">
        {/* Logo — Desktop */}
        <Link href="/" className={cn("hidden md:flex items-center gap-3 group", accountMode ? "mr-3 lg:mr-8" : "mr-8")}>
          <div className="w-7 h-7 border border-slate-200 flex items-center justify-center">
            <span className="font-sans text-[10px] font-bold text-slate-900">S</span>
          </div>
          <span className={cn("font-serif text-base font-normal tracking-tight text-slate-900", accountMode && "hidden lg:inline")}>Stex Tracker</span>
        </Link>

        {NAV_ITEMS.map(({ href: originalHref, label, icon: Icon }) => {
          const href = originalHref;
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href) || (accountMode && href === "/klausuren" && pathname.startsWith("/konto/klausuren")) || (accountMode && originalHref === "/wochenplan" && pathname === "/kalender");
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-sans font-bold uppercase tracking-[0.12em] transition-colors md:flex-row md:gap-2 md:text-[10px] md:px-3 md:py-2",
                accountMode && "min-w-0 flex-1 px-1 text-[9px] tracking-[0.06em] sm:text-[10px] md:flex-none",
                isActive
                  ? "text-slate-900"
                  : "text-slate-400 hover:text-slate-700"
              )}
            >
              <Icon
                className={cn("h-5 w-5 md:h-4 md:w-4", isActive && "text-accent-600")}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span>{label}</span>
              {isActive && (
                <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-8 h-px bg-slate-900 md:w-full md:left-0 md:translate-x-0" />
              )}
            </Link>
          );
        })}

        {/* Right side — Desktop only */}
        {!accountMode && <div className="hidden md:flex items-center gap-2 ml-auto">
          <ThemePicker />
          <Link href="/onboarding" title="Onboarding / Lernplan neu starten" aria-label="Onboarding / Lernplan neu starten">
            <div className="h-9 w-9 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors">
              <Sparkles className="h-4 w-4" />
            </div>
          </Link>
          <Link href="/admin" aria-label="Einstellungen">
            <div className="h-9 w-9 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors">
              <Settings className="h-4 w-4" />
            </div>
          </Link>
        </div>}
      </div>
    </nav>
    </>
  );
}
