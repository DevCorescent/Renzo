// OWNER: Gauransh
// MODULE: Marketing — Coupon analytics cards
// PURPOSE: Presentational KPI band from GET /admin/coupons/analytics (live server
//          aggregation). This component only renders — no fetching, no calculation.

import * as React from "react";
import { Ticket, CheckCircle2, XCircle, Users } from "lucide-react";
import { StatCard } from "@/components/shared/ui";
import type { CouponAnalytics } from "./types";

export function CouponAnalyticsCards({ analytics }: { analytics: CouponAnalytics }) {
  const n = (v: number) => v.toLocaleString("en-IN");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Total coupons" value={n(analytics.totalCoupons)} icon={Ticket} />
      <StatCard label="Active" value={n(analytics.activeCoupons)} icon={CheckCircle2} />
      <StatCard label="Expired" value={n(analytics.expiredCoupons)} icon={XCircle} />
      <StatCard label="Customers used" value={n(analytics.totalCustomersUsed)} icon={Users} />
    </div>
  );
}
