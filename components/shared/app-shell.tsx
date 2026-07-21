"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";
import {
  LayoutDashboard, CalendarDays, Clock, CalendarOff, Images, User,
  UserCheck, Receipt, Users, Boxes, Star, BarChart3, Building2,
  Scissors, Package, Megaphone, ScrollText, Settings, PlusCircle,
  LayoutTemplate, Menu, X, LogOut, ChevronRight, ChevronDown,
  Truck, Tag, Percent, Gift, ArrowLeftRight, ShoppingCart, ClipboardCheck,
  CalendarPlus, UserPlus, Wallet, Crown, Sparkles, Store,
} from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { DashThemeInit } from "@/components/dashboard/dash-theme-init";
import { THEME_ROOT_ID } from "@/components/dashboard/use-dash-theme";
import { Notifications } from "@/components/dashboard/notifications";
import { QuickActions, type QuickAction } from "@/components/dashboard/quick-actions";
import { useDismiss } from "@/components/dashboard/use-dismiss";

type Role = "worker" | "reception" | "branch-admin" | "super-admin" | "inventory" | "marketing" | "accountant";
type Icon = React.ComponentType<{ className?: string }>;
type NavItem = { label: string; href: string; icon: Icon };

const NAV: Record<Role, { brand: string; label: string; items: NavItem[] }> = {
  worker: {
    brand: "Renzo", label: "Worker",
    items: [
      { label: "Dashboard",  href: "/worker/dashboard",   icon: LayoutDashboard },
      { label: "Bookings",   href: "/worker/bookings",    icon: CalendarDays },
      { label: "Attendance", href: "/worker/attendance",  icon: Clock },
      { label: "Leaves",     href: "/worker/leaves",      icon: CalendarOff },
      { label: "Portfolio",  href: "/worker/portfolio",   icon: Images },
      { label: "Requests",   href: "/worker/portfolio/requests", icon: ClipboardCheck },
      { label: "Profile",    href: "/worker/profile",     icon: User },
    ],
  },
  reception: {
    brand: "Renzo", label: "Reception",
    items: [
      { label: "Dashboard",   href: "/reception/dashboard",     icon: LayoutDashboard },
      { label: "New Booking", href: "/reception/booking/new",   icon: PlusCircle },
      { label: "Calendar",    href: "/reception/calendar",      icon: CalendarDays },
      { label: "Check-in",   href: "/reception/checkin",       icon: UserCheck },
      { label: "Queue",       href: "/reception/queue",         icon: Users },
      { label: "Billing",     href: "/reception/billing",       icon: Receipt },
    ],
  },
  "branch-admin": {
    brand: "Renzo", label: "Branch Admin",
    items: [
      { label: "Dashboard",    href: "/branch-admin/dashboard",    icon: LayoutDashboard },
      { label: "Appointments", href: "/branch-admin/appointments", icon: CalendarDays },
      { label: "Workers",      href: "/branch-admin/workers",      icon: Users },
      { label: "Leaves",       href: "/branch-admin/leaves",       icon: CalendarOff },
      { label: "Portfolio",    href: "/branch-admin/portfolio-requests", icon: ClipboardCheck },
      { label: "Services",     href: "/branch-admin/services",     icon: Scissors },
      { label: "Schedule",     href: "/branch-admin/schedule",     icon: Clock },
      { label: "Inventory",    href: "/branch-admin/inventory",    icon: Boxes },
      { label: "Reviews",      href: "/branch-admin/reviews",      icon: Star },
      { label: "Reports",      href: "/branch-admin/reports",      icon: BarChart3 },
    ],
  },
  "super-admin": {
    brand: "Renzo", label: "Super Admin",
    items: [
      { label: "Dashboard",  href: "/super-admin/dashboard",   icon: LayoutDashboard },
      { label: "Branches",   href: "/super-admin/branches",    icon: Building2 },
      { label: "Workers",    href: "/super-admin/workers",     icon: Users },
      { label: "Bookings",   href: "/super-admin/bookings",    icon: CalendarDays },
      { label: "Leave Management",href: "/super-admin/leaves", icon: CalendarOff },
      { label: "Services",   href: "/super-admin/services",    icon: Scissors },
      { label: "Customers",  href: "/super-admin/customers",   icon: UserCheck },
      { label: "Memberships",href: "/super-admin/memberships", icon: Star },
      { label: "Inventory",  href: "/super-admin/inventory",   icon: Package },
      { label: "Marketing",  href: "/super-admin/marketing",   icon: Megaphone },
      { label: "Reviews",    href: "/super-admin/reviews",     icon: Star },
      { label: "Reports",    href: "/super-admin/reports",     icon: BarChart3 },
      { label: "CMS",        href: "/super-admin/cms",         icon: LayoutTemplate },
      { label: "Audit Logs", href: "/super-admin/audit-logs",  icon: ScrollText },
      { label: "Settings",   href: "/super-admin/settings",    icon: Settings },
    ],
  },
  inventory: {
    brand: "Renzo", label: "Inventory",
    items: [
      { label: "Dashboard",  href: "/inventory/dashboard",  icon: LayoutDashboard },
      { label: "Products",   href: "/inventory/products",   icon: Package },
      { label: "Stock",      href: "/inventory/stock",      icon: Boxes },
      { label: "Suppliers",  href: "/inventory/suppliers",  icon: Truck },
      { label: "Purchases",  href: "/inventory/purchases",  icon: ShoppingCart },
      { label: "Transfers",  href: "/inventory/transfers",  icon: ArrowLeftRight },
    ],
  },
  marketing: {
    brand: "Renzo", label: "Marketing",
    items: [
      { label: "Dashboard",   href: "/marketing/dashboard",   icon: LayoutDashboard },
      { label: "Coupons",     href: "/marketing/coupons",     icon: Tag },
      { label: "Campaigns",   href: "/marketing/campaigns",   icon: Megaphone },
      { label: "Offers",      href: "/marketing/offers",      icon: Percent },
      { label: "Gift Cards",  href: "/marketing/gift-cards",  icon: Gift },
      { label: "Reviews",     href: "/marketing/reviews",     icon: Star },
    ],
  },
  accountant: {
    brand: "Renzo", label: "Accounts",
    items: [
      { label: "Dashboard",  href: "/accountant/dashboard",  icon: LayoutDashboard },
      { label: "Invoices",   href: "/accountant/invoices",   icon: Receipt },
      { label: "Reports",    href: "/accountant/reports",    icon: BarChart3 },
    ],
  },
};

const QUICK_ACTIONS: Partial<Record<Role, QuickAction[]>> = {
  "branch-admin": [
    { label: "New appointment", href: "/branch-admin/appointments", icon: CalendarPlus, description: "Book for a customer" },
    { label: "Manage workers",  href: "/branch-admin/workers",      icon: UserPlus,     description: "Team & assignments" },
    { label: "Schedule",        href: "/branch-admin/schedule",     icon: CalendarDays, description: "Shifts & rota" },
    { label: "Reports",         href: "/branch-admin/reports",      icon: BarChart3,    description: "Branch analytics" },
  ],
  "super-admin": [
    { label: "New branch",  href: "/super-admin/branches/new", icon: Store,       description: "Add a salon location" },
    { label: "Add worker",  href: "/super-admin/workers",      icon: UserPlus,    description: "Onboard a team member" },
    { label: "New service", href: "/super-admin/services",     icon: Scissors,    description: "Create a service" },
  ],
  reception: [
    { label: "New booking", href: "/reception/booking/new", icon: CalendarPlus, description: "Create an appointment" },
    { label: "Check-in",    href: "/reception/checkin",     icon: UserPlus,     description: "Walk-in / arrival" },
    { label: "Queue",       href: "/reception/queue",       icon: Users,        description: "Live waiting list" },
    { label: "Billing",     href: "/reception/billing",     icon: Receipt,      description: "Invoices & payments" },
  ],
  worker: [
    { label: "My bookings", href: "/worker/bookings",    icon: CalendarDays, description: "Today's clients" },
    { label: "Attendance",  href: "/worker/attendance",  icon: UserPlus,     description: "Clock in / out" },
  ],
};

/* ── Shell UserMenu ──────────────────────────────────────────────────────── */
function ShellUserMenu({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();
  const ref = useDismiss<HTMLDivElement>(() => setOpen(false));
  const initials = userName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "A";

  async function logout() {
    setBusy(true);
    try { await fetch(API.auth.logout, { method: "POST" }); } finally {
      router.push("/staff/login");
      router.refresh();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-[var(--sa-hover)]"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white dark:bg-zinc-700 dark:text-[var(--sa-text)]">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-28 truncate text-[13px] font-medium leading-tight text-gray-900 dark:text-[var(--sa-text)]">{userName}</span>
          <span className="block text-[11px] leading-tight text-gray-400 dark:text-[var(--sa-muted)]">{roleLabel}</span>
        </span>
        <ChevronDown className="hidden size-3.5 text-gray-400 sm:block dark:text-[var(--sa-muted)]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-[var(--sa-border)] dark:bg-[var(--sa-elevated)] dark:shadow-black/40"
          >
            <div className="px-2.5 py-2 border-b border-gray-100 dark:border-[var(--sa-border)]">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-[var(--sa-text)]">{userName}</p>
              <p className="text-xs text-gray-400 dark:text-[var(--sa-muted)]">{roleLabel}</p>
            </div>
            <button
              onClick={logout}
              disabled={busy}
              role="menuitem"
              className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="size-4" /> {busy ? "Signing out…" : "Log out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({
  role,
  children,
  userName,
}: {
  role: Role;
  children: React.ReactNode;
  userName?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const cfg = NAV[role];
  const quickActions = QUICK_ACTIONS[role] ?? [];
  const displayName = userName ?? "Admin";

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div id={THEME_ROOT_ID} className="sa-dash flex min-h-screen bg-white text-gray-900">
      <DashThemeInit />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-gray-200 bg-white transition-transform dark:border-[var(--sa-border)] dark:bg-[var(--sa-sidebar)] lg:relative lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4 dark:border-[var(--sa-border)]">
          <Link href={cfg.items[0].href} className="text-base font-semibold text-gray-900 dark:text-[var(--sa-text)]">
            {cfg.brand}
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="size-4 text-gray-500 dark:text-[var(--sa-text-2)]" />
          </button>
        </div>

        {/* Role label */}
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[var(--sa-muted)]">
          {cfg.label}
        </p>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-1">
          {cfg.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded px-3 py-2 text-sm",
                  active
                    ? "bg-gray-100 font-medium text-gray-900 dark:bg-[var(--sa-hover)] dark:text-[var(--sa-text)]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)] dark:hover:text-[var(--sa-text)]"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
                {active && <ChevronRight className="ml-auto size-3 text-gray-400 dark:text-[var(--sa-muted)]" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar user (mobile only — topbar has the full menu on lg) */}
        <div className="border-t border-gray-200 p-3 dark:border-[var(--sa-border)] lg:hidden">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold uppercase text-gray-700 dark:bg-[var(--sa-hover)] dark:text-[var(--sa-text-2)]">
              {displayName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-gray-800 dark:text-[var(--sa-text)]">{displayName}</p>
              <p className="text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">{cfg.label}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-4 dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface-2)]">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5 text-gray-500 dark:text-[var(--sa-text-2)]" />
          </button>

          <div className="flex-1" />

          {/* Controls */}
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <Notifications items={[]} />
          </div>

          {quickActions.length > 0 && (
            <>
              <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-[var(--sa-border)]" />
              <QuickActions actions={quickActions} />
            </>
          )}

          <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-[var(--sa-border)]" />

          <ShellUserMenu userName={displayName} roleLabel={cfg.label} />
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
