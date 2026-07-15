"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";
import {
  LayoutDashboard, CalendarDays, Clock, CalendarOff, Images, User,
  UserCheck, Receipt, Users, Boxes, Star, BarChart3, Building2,
  Scissors, Package, Megaphone, ScrollText, Settings, PlusCircle,
  LayoutTemplate, Menu, X, LogOut, ChevronRight,
  Truck, Tag, Percent, Gift, ArrowLeftRight, ShoppingCart,
} from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

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
      { label: "Profile",    href: "/worker/profile",     icon: User },
    ],
  },
  reception: {
    brand: "Renzo", label: "Reception",
    items: [
      { label: "Dashboard",   href: "/reception/dashboard",     icon: LayoutDashboard },
      { label: "New Booking", href: "/reception/booking/new",   icon: PlusCircle },
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
      { label: "Leave Types",href: "/super-admin/leave-types", icon: CalendarOff },
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
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const cfg = NAV[role];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

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
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-gray-200 bg-white transition-transform lg:relative lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
          <Link href={cfg.items[0].href} className="text-base font-semibold text-gray-900">
            {cfg.brand}
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="size-4 text-gray-500" />
          </button>
        </div>

        {/* Role label */}
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
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
                    ? "bg-gray-100 font-medium text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
                {active && <ChevronRight className="ml-auto size-3 text-gray-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold uppercase text-gray-700">
              {(userName ?? "?")[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-gray-800">
                {userName ?? "Loading…"}
              </p>
              <p className="text-[11px] text-gray-400">{cfg.label}</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Log out"
              className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
            >
              <LogOut className="size-4" />
            </button>
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
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4">
          <button className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-5 text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
