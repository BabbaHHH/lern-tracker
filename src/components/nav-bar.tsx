"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, BookOpen, Scale, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemePicker } from "@/components/theme-picker";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/wochenplan", label: "Lernkalender", icon: Calendar },
  { href: "/themen", label: "Themen", icon: BookOpen },
  { href: "/klausuren", label: "Klausuren", icon: Scale },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white md:top-0 md:bottom-auto md:border-b md:border-t-0">
      <div className="mx-auto max-w-5xl flex items-center justify-around md:justify-start md:gap-1 md:px-6 h-16 md:h-14">
        {/* Logo — Desktop */}
        <Link href="/" className="hidden md:flex items-center gap-3 mr-8 group">
          <div className="w-7 h-7 border border-slate-200 flex items-center justify-center">
            <span className="font-sans text-[10px] font-bold text-slate-900">S</span>
          </div>
          <span className="font-serif text-base font-normal tracking-tight text-slate-900">Stex Tracker</span>
        </Link>

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-sans font-bold uppercase tracking-[0.12em] transition-colors md:flex-row md:gap-2 md:text-[10px] md:px-3 md:py-2",
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
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <ThemePicker />
          <Link href="/admin">
            <div className="h-9 w-9 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors">
              <Settings className="h-4 w-4" />
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
