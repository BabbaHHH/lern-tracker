"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, BookOpen, Scale, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/wochenplan", label: "Woche", icon: Calendar },
  { href: "/themen", label: "Themen", icon: BookOpen },
  { href: "/klausuren", label: "Klausuren", icon: Scale },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 glass md:top-0 md:bottom-auto md:border-b md:border-t-0">
      <div className="mx-auto max-w-5xl flex items-center justify-around md:justify-start md:gap-1 md:px-6 h-14 md:h-12">
        {/* Logo — Desktop */}
        <Link href="/" className="hidden md:flex items-center gap-2 font-bold text-sm mr-6 tracking-tight">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-white text-xs font-black">S</span>
          </div>
          <span className="text-gradient">Stex Tracker</span>
        </Link>

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-4 py-1.5 text-[11px] font-medium transition-colors md:flex-row md:gap-1.5 md:text-xs md:px-3 md:py-1.5 md:rounded-lg",
                isActive
                  ? "text-emerald-600 md:bg-emerald-50"
                  : "text-slate-400 hover:text-slate-700 md:hover:bg-slate-50"
              )}
            >
              <Icon className={cn("h-5 w-5 md:h-4 md:w-4", isActive && "text-emerald-600")} strokeWidth={isActive ? 2.5 : 2} />
              <span>{label}</span>
              {isActive && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-500 md:hidden" />
              )}
            </Link>
          );
        })}

        {/* Settings — Desktop only */}
        <Link href="/admin" className="hidden md:flex items-center ml-auto">
          <div className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
            <Settings className="h-4 w-4 text-slate-400" />
          </div>
        </Link>
      </div>
    </nav>
  );
}
