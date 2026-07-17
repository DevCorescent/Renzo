// OWNER: Gauransh
// MODULE: Membership Management (analytics cards)
// FLOW  : Presentational KPI band. Every figure comes from GET /admin/memberships/
//         analytics (computed live server-side) — this component only renders.
// ACCESS: Rendered inside the SUPER_ADMIN/OWNER-guarded membership page.

import * as React from "react";
import { Layers, CheckCircle2, Users, Wallet, Star, CalendarClock } from "lucide-react";
import { StatCard } from "@/components/shared/ui";
import { money, type Analytics } from "./types";

export function MembershipAnalyticsCards({ analytics }: { analytics: Analytics }) {
  const n = (v: number) => v.toLocaleString("en-IN");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Total plans" value={n(analytics.totalPlans)} icon={Layers} />
      <StatCard label="Active plans" value={n(analytics.activePlans)} icon={CheckCircle2} />
      <StatCard label="Active members" value={n(analytics.totalActiveMembers)} icon={Users} />
      <StatCard label="Membership revenue" value={money(analytics.totalRevenue)} icon={Wallet} />
      <StatCard label="Most popular" value={analytics.mostPopularPlan?.name ?? "—"} icon={Star} hint={analytics.mostPopularPlan ? `${analytics.mostPopularPlan.activeMembers} active` : undefined} />
      <StatCard label="Renewals due (30d)" value={n(analytics.renewalDue)} icon={CalendarClock} />
    </div>
  );
}
