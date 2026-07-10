"use client";

// OWNER: Devanshi | COMPONENT: Customer portal frame (sidebar + mobile drawer)
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Crown,
  Sparkles,
  Star,
  Gift,
  User,
  LogOut,
  Globe,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";

const NAV = [
  { label: "Dashboard", href: "/customer/dashboard", icon: LayoutDashboard },
  { label: "My Bookings", href: "/customer/bookings", icon: CalendarDays },
  { label: "Wallet", href: "/customer/wallet", icon: Wallet },
  { label: "Membership", href: "/customer/membership", icon: Crown },
  { label: "Loyalty", href: "/customer/loyalty", icon: Sparkles },
  { label: "Reviews", href: "/customer/reviews", icon: Star },
  { label: "Gift Cards", href: "/customer/gift-cards", icon: Gift },
  { label: "Profile", href: "/customer/profile", icon: User },
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
      <div className="flex h-14 items-center border-b border-gray-200 px-6">
        <span className="text-base font-semibold text-gray-900">Renzo</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded px-3 py-2 text-sm",
                active
                  ? "bg-gray-100 font-medium text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold uppercase text-gray-700">
            {userName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-gray-800">{userName}</p>
            <p className="text-[11px] text-gray-400">Customer</p>
          </div>
          <button
            onClick={onLogout}
            disabled={loggingOut}
            title="Log out"
            className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <Link
          href="/"
          onClick={onNavigate}
          className="mt-1 flex items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
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
    <div className="flex min-h-screen bg-white text-gray-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-gray-200 bg-white lg:block">
        <SidebarContent
          userName={userName}
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <Link href="/customer/dashboard" className="text-base font-semibold text-gray-900">
          Renzo
        </Link>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5 text-gray-500" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-56 border-r border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-700"
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
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
