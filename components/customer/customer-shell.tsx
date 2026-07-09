"use client";

// OWNER: Devanshi | COMPONENT: Customer portal frame (sidebar + mobile drawer)
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Scissors,
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
import { CUSTOMER } from "@/components/customer/data";

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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-20 items-center gap-2 border-b border-border px-6">
        <Scissors className="size-6 text-primary" />
        <span className="font-heading text-2xl font-bold tracking-tight">Renzo</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4.5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div className="space-y-1 border-t border-border p-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Globe className="size-4.5 shrink-0" />
          Back to Website
        </Link>
        <Link
          href="/login"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4.5 shrink-0" />
          Log out
        </Link>
      </div>
    </div>
  );
}

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-border bg-background lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/customer/dashboard" className="flex items-center gap-2">
          <Scissors className="size-5 text-primary" />
          <span className="font-heading text-xl font-bold tracking-tight">Renzo</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="inline-flex size-10 items-center justify-center"
        >
          <Menu className="size-6" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-background">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-6 inline-flex size-9 items-center justify-center text-muted-foreground"
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-72">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
