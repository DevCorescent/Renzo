"use client";

// Premium dashboard header: breadcrumb, greeting + date, search, notifications,
// quick actions, user menu. Role-driven so every RENZO dashboard reuses the
// exact same chrome — only the config (label / routes / quick actions) differs.
// Presentational: the only side effect is logout, which reuses the existing
// auth endpoint (no new business logic).
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Home, ChevronRight, Store, UserPlus, CalendarPlus, Scissors,
  CalendarDays, BarChart3, Users, Receipt, Wallet, Crown, Sparkles, Star,
  ChevronDown, User, Settings, LogOut,
} from "lucide-react";
import { API } from "@/lib/endpoints";
import { Notifications, type NotificationItem } from "./notifications";
import { QuickActions, type QuickAction } from "./quick-actions";
import { ThemeToggle } from "./theme-toggle";
import { useDismiss } from "./use-dismiss";

/* ── Per-role chrome config (icon refs stay client-side) ──────────────────── */
export type DashRole = "super-admin" | "branch-admin" | "reception" | "worker" | "customer";

type RoleConfig = { label: string; home: string; settings?: string; quickActions: QuickAction[] };

const ROLE_CONFIG: Record<DashRole, RoleConfig> = {
  "super-admin": {
    label: "Super Admin",
    home: "/super-admin/dashboard",
    settings: "/super-admin/settings",
    quickActions: [
      { label: "New branch", href: "/super-admin/branches/new", icon: Store, description: "Add a salon location" },
      { label: "Add worker", href: "/super-admin/workers", icon: UserPlus, description: "Onboard a team member" },
      { label: "New service", href: "/super-admin/services", icon: Scissors, description: "Create a service" },
      { label: "New booking", href: "/super-admin/customers", icon: CalendarPlus, description: "Book for a customer" },
    ],
  },
  "branch-admin": {
    label: "Branch Admin",
    home: "/branch-admin/dashboard",
    quickActions: [
      { label: "New appointment", href: "/branch-admin/appointments", icon: CalendarPlus, description: "Book for a customer" },
      { label: "Manage workers", href: "/branch-admin/workers", icon: UserPlus, description: "Team & assignments" },
      { label: "Schedule", href: "/branch-admin/schedule", icon: CalendarDays, description: "Shifts & rota" },
      { label: "Reports", href: "/branch-admin/reports", icon: BarChart3, description: "Branch analytics" },
    ],
  },
  reception: {
    label: "Reception",
    home: "/reception/dashboard",
    quickActions: [
      { label: "New booking", href: "/reception/booking/new", icon: CalendarPlus, description: "Create an appointment" },
      { label: "Check-in", href: "/reception/checkin", icon: UserPlus, description: "Walk-in / arrival" },
      { label: "Queue", href: "/reception/queue", icon: Users, description: "Live waiting list" },
      { label: "Billing", href: "/reception/billing", icon: Receipt, description: "Invoices & payments" },
    ],
  },
  worker: {
    label: "Worker",
    home: "/worker/dashboard",
    quickActions: [
      { label: "My bookings", href: "/worker/bookings", icon: CalendarDays, description: "Today's clients" },
      { label: "Attendance", href: "/worker/attendance", icon: UserPlus, description: "Clock in / out" },
    ],
  },
  customer: {
    label: "Account",
    home: "/customer/bookings",
    settings: "/customer/profile",
    quickActions: [
      { label: "Wallet", href: "/customer/wallet", icon: Wallet, description: "Balance & top-ups" },
      { label: "Membership", href: "/customer/membership", icon: Crown, description: "Plan & benefits" },
      { label: "Loyalty", href: "/customer/loyalty", icon: Sparkles, description: "Points & rewards" },
      { label: "Reviews", href: "/customer/reviews", icon: Star, description: "Rate your visits" },
    ],
  },
};

function UserMenu({ userName, roleLabel, settingsHref }: { userName: string; roleLabel: string; settingsHref?: string }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();
  const ref = useDismiss<HTMLDivElement>(() => setOpen(false));
  const initials = userName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "A";

  async function logout() {
    setBusy(true);
    try {
      await fetch(API.auth.logout, { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-(--sa-hover)"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-linear-to-br from-gray-800 to-gray-900 text-[11px] font-semibold text-white dark:from-zinc-600 dark:to-zinc-800 dark:text-(--sa-text)">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-30 truncate text-[13px] font-medium leading-tight text-gray-900 dark:text-(--sa-text)">{userName}</span>
          <span className="block text-[11px] leading-tight text-gray-400 dark:text-(--sa-muted)">{roleLabel}</span>
        </span>
        <ChevronDown className="hidden size-4 text-gray-400 sm:block dark:text-(--sa-muted)" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-(--sa-border) dark:bg-(--sa-elevated) dark:shadow-black/40"
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-(--sa-text)">{userName}</p>
              <p className="text-xs text-gray-400 dark:text-(--sa-muted)">{roleLabel}</p>
            </div>
            {settingsHref && (
              <>
                <div className="my-1 h-px bg-gray-100 dark:bg-(--sa-border)" />
                <Link href={settingsHref} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text)">
                  <User className="size-4 text-gray-400 dark:text-(--sa-muted)" /> Profile
                </Link>
                <Link href={settingsHref} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text)">
                  <Settings className="size-4 text-gray-400 dark:text-(--sa-muted)" /> Settings
                </Link>
              </>
            )}
            <div className="my-1 h-px bg-gray-100 dark:bg-(--sa-border)" />
            <button
              onClick={logout}
              disabled={busy}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="size-4" /> {busy ? "Signing out…" : "Log out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DashboardHeader({
  role,
  userName,
  greeting,
  dateLabel,
  notifications,
}: {
  role: DashRole;
  userName: string;
  greeting: string;
  dateLabel: string;
  notifications: NotificationItem[];
}) {
  const cfg = ROLE_CONFIG[role];
  const firstName = userName.split(" ")[0] || userName;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-(--sa-muted)">
        <Link href={cfg.home} className="flex items-center gap-1 transition-colors hover:text-gray-600 dark:hover:text-(--sa-text-2)">
          <Home className="size-3.5" />
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-gray-500 dark:text-(--sa-text-2)">{cfg.label}</span>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-gray-700 dark:text-(--sa-text)">Dashboard</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-(--sa-text)">
            {greeting}, {firstName} <span className="inline-block">👋</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-(--sa-text-2)">{dateLabel}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <form
            onSubmit={(e) => e.preventDefault()}
            role="search"
            className="relative hidden lg:block"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-(--sa-muted)" />
            <input
              type="search"
              placeholder="Search…"
              aria-label="Search"
              className="h-9 w-52 rounded-lg border border-gray-200 bg-white pl-9 pr-10 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:w-64 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 dark:border-(--sa-border) dark:bg-(--sa-tile) dark:text-(--sa-text) dark:placeholder:text-(--sa-muted) dark:focus:border-amber-500/40 dark:focus:bg-(--sa-surface) dark:focus:ring-amber-500/20"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:border-(--sa-border) dark:bg-white/5 dark:text-(--sa-muted)">
              ⌘K
            </kbd>
          </form>

          <div className="flex items-center gap-0.5 rounded-lg">
            <ThemeToggle />
            <Notifications items={notifications} />
          </div>

          <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block dark:bg-(--sa-border)" />

          <QuickActions actions={cfg.quickActions} />

          <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block dark:bg-(--sa-border)" />

          <UserMenu userName={userName} roleLabel={cfg.label} settingsHref={cfg.settings} />
        </div>
      </div>
    </div>
  );
}
