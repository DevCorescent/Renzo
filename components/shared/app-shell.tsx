"use client";
// OWNER: Hemant | Shared panel shell — dark "Veloura" theme (orange accent, rounded, pill CTAs).
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  CalendarOff,
  Images,
  User,
  UserCheck,
  Receipt,
  Users,
  Boxes,
  Star,
  BarChart3,
  Building2,
  Scissors,
  Package,
  Megaphone,
  ScrollText,
  Settings,
  PlusCircle,
  LayoutTemplate,
  Menu,
  X,
  Bell,
  LogOut,
  Sparkles,
} from "lucide-react";

type Role = "worker" | "reception" | "branch-admin" | "super-admin";
type Icon = React.ComponentType<{ className?: string }>;
type NavItem = { label: string; href: string; icon: Icon };

const NAV: Record<Role, { brand: string; tag: string; user: { name: string; role: string }; items: NavItem[] }> = {
  worker: {
    brand: "Renzo",
    tag: "Stylist",
    user: { name: "Priya Nair", role: "Senior Stylist" },
    items: [
      { label: "Dashboard", href: "/worker/dashboard", icon: LayoutDashboard },
      { label: "Bookings", href: "/worker/bookings", icon: CalendarDays },
      { label: "Attendance", href: "/worker/attendance", icon: Clock },
      { label: "Leaves", href: "/worker/leaves", icon: CalendarOff },
      { label: "Portfolio", href: "/worker/portfolio", icon: Images },
      { label: "Profile", href: "/worker/profile", icon: User },
    ],
  },
  reception: {
    brand: "Renzo",
    tag: "Front Desk",
    user: { name: "Anita Rao", role: "Receptionist" },
    items: [
      { label: "Dashboard", href: "/reception/dashboard", icon: LayoutDashboard },
      { label: "New Booking", href: "/reception/booking/new", icon: PlusCircle },
      { label: "Check-in", href: "/reception/checkin", icon: UserCheck },
      { label: "Queue", href: "/reception/queue", icon: Users },
      { label: "Billing", href: "/reception/billing", icon: Receipt },
    ],
  },
  "branch-admin": {
    brand: "Renzo",
    tag: "Branch Admin",
    user: { name: "Rohit Menon", role: "Branch Manager · Bandra" },
    items: [
      { label: "Dashboard", href: "/branch-admin/dashboard", icon: LayoutDashboard },
      { label: "Appointments", href: "/branch-admin/appointments", icon: CalendarDays },
      { label: "Workers", href: "/branch-admin/workers", icon: Users },
      { label: "Schedule", href: "/branch-admin/schedule", icon: Clock },
      { label: "Inventory", href: "/branch-admin/inventory", icon: Boxes },
      { label: "Reviews", href: "/branch-admin/reviews", icon: Star },
      { label: "Reports", href: "/branch-admin/reports", icon: BarChart3 },
    ],
  },
  "super-admin": {
    brand: "Renzo",
    tag: "Platform",
    user: { name: "Kabir Shah", role: "Super Admin" },
    items: [
      { label: "Dashboard", href: "/super-admin/dashboard", icon: LayoutDashboard },
      { label: "Branches", href: "/super-admin/branches", icon: Building2 },
      { label: "Workers", href: "/super-admin/workers", icon: Users },
      { label: "Services", href: "/super-admin/services", icon: Scissors },
      { label: "Customers", href: "/super-admin/customers", icon: UserCheck },
      { label: "Memberships", href: "/super-admin/memberships", icon: Star },
      { label: "Inventory", href: "/super-admin/inventory", icon: Package },
      { label: "Marketing", href: "/super-admin/marketing", icon: Megaphone },
      { label: "Reviews", href: "/super-admin/reviews", icon: Star },
      { label: "Reports", href: "/super-admin/reports", icon: BarChart3 },
      { label: "CMS", href: "/super-admin/cms", icon: LayoutTemplate },
      { label: "Audit Logs", href: "/super-admin/audit-logs", icon: ScrollText },
      { label: "Settings", href: "/super-admin/settings", icon: Settings },
    ],
  },
};

// Scoped dark + orange palette. Overrides the shadcn tokens for this subtree only,
// so every Card / StatCard / Badge / Button re-themes without touching globals.css.
const PANEL_THEME: Record<string, string> = {
  "--background": "#0a0c12",
  "--foreground": "#f3f4f7",
  "--card": "#141824",
  "--card-foreground": "#f3f4f7",
  "--popover": "#141824",
  "--popover-foreground": "#f3f4f7",
  "--primary": "#f97316",
  "--primary-foreground": "#160c02",
  "--secondary": "#1b202d",
  "--secondary-foreground": "#f3f4f7",
  "--muted": "#1b202d",
  "--muted-foreground": "#9aa1af",
  "--accent": "#232a3a",
  "--accent-foreground": "#f3f4f7",
  "--border": "rgba(255,255,255,0.08)",
  "--input": "rgba(255,255,255,0.14)",
  "--ring": "#f97316",
  "--sidebar": "#0c0e17",
  "--sidebar-foreground": "#f3f4f7",
  "--sidebar-accent": "#1b202d",
  "--sidebar-accent-foreground": "#ffffff",
  "--sidebar-border": "rgba(255,255,255,0.07)",
  "--radius": "0.9rem",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("");
}

export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const cfg = NAV[role];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // 3D scroll reveal: reveal each top-level section as it enters the viewport,
  // staggered within each batch. Re-runs whenever the route (page content) changes.
  React.useEffect(() => {
    const stage = document.querySelector(".renzo-stage");
    if (!stage) return;
    const els = Array.from(stage.children) as HTMLElement[];

    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, i) => {
            const el = e.target as HTMLElement;
            el.style.transitionDelay = `${i * 80}ms`;
            el.classList.add("is-visible");
            io.unobserve(el);
          });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return (
    <div className="renzo-panel dark relative flex min-h-screen w-full overflow-hidden bg-background text-foreground" style={PANEL_THEME as React.CSSProperties}>
      {/* Scoped chrome: pill buttons, rounded inputs, glow + entrance — panels only, not global */}
      <style>{`
        .renzo-panel [data-slot="button"]{ border-radius:9999px; text-transform:none; letter-spacing:0; transition:box-shadow .25s, transform .15s; }
        .renzo-panel [data-slot="button"][class*="bg-primary"]{ box-shadow:0 10px 30px -12px rgba(249,115,22,.6); }
        .renzo-panel [data-slot="button"][class*="bg-primary"]:hover{ box-shadow:0 14px 36px -10px rgba(249,115,22,.75); }
        .renzo-panel input,.renzo-panel select,.renzo-panel textarea{ border-radius:0.7rem; }

        /* 3D scroll reveal — each section rotates up into place as it enters the viewport */
        .renzo-stage{ perspective:1500px; perspective-origin:50% 0; }
        .renzo-stage > *{
          opacity:0;
          transform:translateY(48px) translateZ(-140px) rotateX(13deg) scale(.985);
          transform-origin:50% 0;
          transition:opacity .6s ease, transform .8s cubic-bezier(.22,1,.36,1);
          will-change:transform,opacity;
        }
        .renzo-stage > *.is-visible{ opacity:1; transform:none; }

        /* Sidebar links glide in from the left */
        @keyframes renzoSlideL{ from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:none} }
        .renzo-nav a{ animation:renzoSlideL .45s ease both }
        .renzo-nav a:nth-child(1){animation-delay:.04s}
        .renzo-nav a:nth-child(2){animation-delay:.09s}
        .renzo-nav a:nth-child(3){animation-delay:.14s}
        .renzo-nav a:nth-child(4){animation-delay:.19s}
        .renzo-nav a:nth-child(5){animation-delay:.24s}
        .renzo-nav a:nth-child(6){animation-delay:.29s}
        .renzo-nav a:nth-child(7){animation-delay:.34s}
        .renzo-nav a:nth-child(n+8){animation-delay:.39s}

        @media (prefers-reduced-motion: reduce){
          .renzo-stage > *{ opacity:1 !important; transform:none !important; transition:none !important; }
          .renzo-nav a{ animation:none !important; }
        }
      `}</style>

      {/* Ambient backdrop — orange glow + faint grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(600px circle at 0% 0%, rgba(249,115,22,0.14), transparent 45%)," +
            "radial-gradient(500px circle at 100% 30%, rgba(234,88,12,0.10), transparent 40%)," +
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "auto, auto, 46px 46px, 46px 46px",
        }}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:relative lg:z-20 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <Link href={cfg.items[0].href} className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-orange-500 text-white">
              <Sparkles className="size-4" />
            </span>
            <span className="text-xl font-bold tracking-tight">{cfg.brand}</span>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <p className="px-6 pb-4 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-orange-500/90">{cfg.tag}</p>

        <nav className="renzo-nav flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {cfg.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-orange-500/12 font-semibold text-orange-400"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
                {active && <span className="ml-auto size-1.5 rounded-full bg-orange-500" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-xs font-semibold uppercase text-white">
              {initials(cfg.user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{cfg.user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{cfg.user.role}</p>
            </div>
            <button className="text-muted-foreground hover:text-foreground" aria-label="Log out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop (mobile) */}
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {cfg.tag} <span className="text-orange-500">Console</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative text-muted-foreground hover:text-foreground" aria-label="Notifications">
              <Bell className="size-5" />
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-orange-500" />
            </button>
            <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-[0.65rem] font-semibold uppercase text-white">
              {initials(cfg.user.name)}
            </div>
          </div>
        </header>

        <main key={pathname} className="renzo-stage mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
