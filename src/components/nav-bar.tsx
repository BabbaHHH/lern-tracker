"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, BookOpen, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wochenplan", label: "Wochenplan", icon: Calendar },
  { href: "/themen", label: "Themen", icon: BookOpen },
  { href: "/kalender", label: "Kalender", icon: GraduationCap },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:top-0 md:bottom-auto">
      <div className="mx-auto max-w-4xl flex items-center justify-around md:justify-start md:gap-6 md:px-6 h-16">
        {/* Logo - nur Desktop */}
        <Link href="/" className="hidden md:flex items-center gap-2 font-bold text-lg mr-8">
          <GraduationCap className="h-6 w-6 text-emerald-600" />
          <span>Lern-Tracker</span>
        </Link>

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors md:flex-row md:gap-2 md:text-sm",
                isActive
                  ? "text-emerald-600"
                  : "text-gray-500 hover:text-gray-900"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-emerald-600")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
