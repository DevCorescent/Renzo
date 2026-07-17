// OWNER: Gauransh
// MODULE: Marketing — Gift Card analytics cards
// PURPOSE: KPI band from GET /admin/gift-cards/analytics (live server aggregation).

import * as React from "react";
import { Gift, CheckCircle2, ShoppingBag, BadgeCheck } from "lucide-react";
import { StatCard } from "@/components/shared/ui";
import type { GiftCardAnalytics } from "./types";

export function GiftCardAnalyticsCards({ analytics }: { analytics: GiftCardAnalytics }) {
  const n = (v: number) => v.toLocaleString("en-IN");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Total gift cards" value={n(analytics.totalGiftCards)} icon={Gift} />
      <StatCard label="Active" value={n(analytics.activeGiftCards)} icon={CheckCircle2} />
      <StatCard label="Purchased" value={n(analytics.purchasedByCustomers)} icon={ShoppingBag} />
      <StatCard label="Redeemed" value={n(analytics.redeemedCards)} icon={BadgeCheck} />
    </div>
  );
}
