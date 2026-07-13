"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Crown, Sparkles,
  Star, Gift, User, LogOut, Globe, Menu, X, ChevronRight, Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";

const NAV = [
  { label: "Dashboard",   href: "/customer/dashboard",   icon: LayoutDashboard },
  { label: "My Bookings", href: "/customer/bookings",    icon: CalendarDays },
  { label: "Membership",  href: "/customer/membership",  icon: Crown },
  { label: "Loyalty",     href: "/customer/loyalty",     icon: Sparkles },
  { label: "Reviews",     href: "/customer/reviews",     icon: Star },
  { label: "Gift Cards",  href: "/customer/gift-cards",  icon: Gift },
  { label: "Profile",     href: "/customer/profile",     icon: User },
];

function SidebarContent({
  userName,
  onNavigate,
  onLogout,
  loggingOut,
}: {
  userName: string;
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/8 px-5">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
          <Scissors className="size-3.5" />
        </span>
        <span className="font-heading text-base font-bold tracking-tight text-white">Renzo</span>
      </div>

      {/* Role label */}
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-500">
        Customer Portal
      </p>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-gold/10 font-medium text-gold ring-1 ring-gold/20"
                  : "text-stone-400 hover:bg-white/5 hover:text-stone-100"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
              {active && <ChevronRight className="ml-auto size-3 text-gold/60" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/8 p-3">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[11px] font-semibold uppercase text-stone-200">
            {userName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-stone-200">{userName}</p>
            <p className="text-[11px] text-stone-500">Customer</p>
          </div>
          <button
            onClick={onLogout}
            disabled={loggingOut}
            title="Log out"
            className="text-stone-500 hover:text-stone-200 transition-colors disabled:opacity-40"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <Link
          href="/"
          onClick={onNavigate}
          className="mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-stone-600 transition-colors hover:text-stone-400"
        >
          <Globe className="size-3.5" />
          Back to website
        </Link>
      </div>
    </div>
  );
}

export function CustomerShell({
  children,
  userName = "Customer",
}: {
  children: React.ReactNode;
  userName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch(API.auth.logout, { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen bg-stone-950 text-stone-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-white/8 bg-stone-900/80 backdrop-blur-sm lg:block">
        <SidebarContent userName={userName} onLogout={handleLogout} loggingOut={loggingOut} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/8 bg-stone-950/90 px-4 backdrop-blur-sm lg:hidden">
        <Link href="/customer/dashboard" className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
            <Scissors className="size-3.5" />
          </span>
          <span className="font-heading text-base font-bold text-white">Renzo</span>
        </Link>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5 text-stone-400" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-56 border-r border-white/8 bg-stone-900">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-stone-500 hover:text-stone-200 transition-colors"
            >
              <X className="size-4" />
            </button>
            <SidebarContent
              userName={userName}
              onNavigate={() => setOpen(false)}
              onLogout={handleLogout}
              loggingOut={loggingOut}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-30 hidden h-14 items-center border-b border-white/8 bg-stone-950/90 px-6 backdrop-blur-sm lg:flex">
          <span className="text-sm font-medium text-stone-400">Customer Portal</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
