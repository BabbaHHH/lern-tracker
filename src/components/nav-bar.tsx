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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/60 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 md:top-0 md:bottom-auto md:border-b md:border-t-0 md:shadow-[0_1px_20px_rgb(0,0,0,0.03)]">
      <div className="mx-auto max-w-5xl flex items-center justify-around md:justify-start md:gap-1 md:px-6 h-16 md:h-14">
        {/* Logo — Desktop */}
        <Link href="/" className="hidden md:flex items-center gap-2.5 font-bold text-sm mr-8 tracking-tight group">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-slate-900 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/30 transition-shadow">
            <span className="text-white text-xs font-black">S</span>
          </div>
          <span className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Stex Tracker</span>
        </Link>

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 px-4 py-1.5 text-[11px] font-medium transition-all md:flex-row md:gap-2 md:text-xs md:px-3.5 md:py-2 md:rounded-xl",
                isActive
                  ? "text-indigo-700 md:bg-indigo-50 md:shadow-sm md:shadow-indigo-500/5"
                  : "text-slate-400 hover:text-slate-700 md:hover:bg-slate-100/70"
              )}
            >
              <Icon
                className={cn("h-5 w-5 md:h-4 md:w-4 transition-transform", isActive && "text-indigo-600 md:scale-110")}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={cn("tracking-tight", isActive && "font-semibold")}>{label}</span>
              {isActive && (
                <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 md:hidden" />
              )}
            </Link>
          );
        })}

        {/* Settings — Desktop only */}
        <Link href="/admin" className="hidden md:flex items-center ml-auto">
          <div className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all">
            <Settings className="h-4 w-4" />
          </div>
        </Link>
      </div>
    </nav>
  );
}
