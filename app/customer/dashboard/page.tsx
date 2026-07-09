import Link from "next/link";
import {
  Wallet,
  Sparkles,
  Crown,
  CalendarDays,
  ArrowRight,
  Clock,
  MapPin,
  Scissors,
  User,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader, Card, StatusBadge } from "@/components/customer/ui";
import { CUSTOMER, BOOKINGS, WALLET, LOYALTY, MEMBERSHIP, rupee } from "@/components/customer/data";

// OWNER: Devanshi | MODULE: Customer Dashboard (hardcoded)
export default function CustomerDashboardPage() {
  const upcoming = BOOKINGS.filter((b) => b.status === "CONFIRMED" || b.status === "PENDING");
  const next = upcoming[0];

  const stats = [
    { label: "Wallet Balance", value: rupee(WALLET.balance), icon: Wallet, href: "/customer/wallet" },
    { label: "Loyalty Points", value: LOYALTY.points.toLocaleString("en-IN"), icon: Sparkles, href: "/customer/loyalty" },
    { label: "Membership", value: MEMBERSHIP.active ? MEMBERSHIP.plan : "None", icon: Crown, href: "/customer/membership" },
    { label: "Upcoming", value: `${upcoming.length} booking${upcoming.length === 1 ? "" : "s"}`, icon: CalendarDays, href: "/customer/bookings" },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${CUSTOMER.name.split(" ")[0]} 👋`}
        description="Here's what's happening with your account."
        action={
          <Link href="/book" className={cn(buttonVariants())}>
            <Scissors className="size-4" />
            Book New Appointment
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="group flex items-center gap-4 p-5 transition-colors hover:border-primary">
              <span className="inline-flex size-11 items-center justify-center bg-muted text-primary">
                <s.icon className="size-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-heading text-xl font-semibold">{s.value}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Next appointment */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold">Next appointment</h2>
            <Link href="/customer/bookings" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {next ? (
            <Card className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <img src={next.image} alt={next.service} className="h-40 w-full object-cover sm:h-auto sm:w-44" />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-heading text-lg font-semibold">{next.service}</h3>
                    <StatusBadge status={next.status} />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2"><User className="size-4 text-primary" /> {next.stylist}</p>
                    <p className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" /> {next.date} · {next.time}</p>
                    <p className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> {next.branch}</p>
                    <p className="flex items-center gap-2"><Clock className="size-4 text-primary" /> {next.duration}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                    <span className="font-heading text-lg font-semibold">{rupee(next.price)}</span>
                    <Link href={`/customer/bookings/${next.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                      View Details <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-10 text-center text-sm text-muted-foreground">No upcoming appointments.</Card>
          )}
        </div>

        {/* Loyalty snapshot */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold">Rewards</h2>
          </div>
          <Card className="space-y-5 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-11 items-center justify-center bg-primary text-primary-foreground">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="font-heading text-2xl font-bold">{LOYALTY.points.toLocaleString("en-IN")}</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{LOYALTY.tier} tier</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{LOYALTY.pointsToNext} pts to {LOYALTY.nextTier}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(LOYALTY.points / (LOYALTY.points + LOYALTY.pointsToNext)) * 100}%` }}
                />
              </div>
            </div>
            <Link href="/customer/loyalty" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
              Redeem Points
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
