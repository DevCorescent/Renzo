// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — professional statistics
//
// KPI cards built ONLY from the statistics endpoint, reusing the shared StatCard.
// "Portfolio views" and "average service time" are intentionally absent — there is
// no backend figure for either, and a fabricated number would betray the whole
// point of a trustworthy portfolio. Growth rides in as the delta on completed work.
// ============================================================================

import * as React from "react";
import { Star, CheckCircle2, CalendarCheck, Users, Wallet, Percent } from "lucide-react";
import { StatCard } from "@/components/shared/ui";
import { Section, formatCurrency } from "./portfolio-ui";
import type { PortfolioStatistics } from "./types";

export function Statistics({ stats }: { stats: PortfolioStatistics }) {
  const growth =
    stats.growthPercentage !== 0
      ? { value: `${Math.abs(stats.growthPercentage)}%`, positive: stats.growthPercentage > 0 }
      : undefined;

  return (
    <Section eyebrow="Track record" title="Professional statistics">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Overall rating"
          value={stats.totalReviews > 0 ? `${stats.averageRating.toFixed(1)} / 5` : "—"}
          hint={`${stats.totalReviews} ${stats.totalReviews === 1 ? "review" : "reviews"}`}
          icon={Star}
        />
        <StatCard
          label="Completed services"
          value={stats.completedServices.toLocaleString("en-IN")}
          delta={growth}
          hint={growth ? "vs. previous 30 days" : undefined}
          icon={CheckCircle2}
        />
        <StatCard
          label="Completed bookings"
          value={stats.completedBookings.toLocaleString("en-IN")}
          icon={CalendarCheck}
        />
        <StatCard
          label="Repeat customers"
          value={stats.repeatCustomers.toLocaleString("en-IN")}
          hint="Booked more than once"
          icon={Users}
        />
        <StatCard
          label="Completion rate"
          value={`${stats.completionRate}%`}
          hint="Of resolved bookings"
          icon={Percent}
        />
        <StatCard
          label="Revenue generated"
          value={formatCurrency(stats.revenueGenerated)}
          hint="From completed work"
          icon={Wallet}
        />
      </div>
    </Section>
  );
}
