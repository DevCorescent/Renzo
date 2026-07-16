// OWNER: Gauransh
// MODULE: Marketing — Campaign analytics cards
// PURPOSE: KPI band from GET /admin/campaigns/analytics (live server aggregation).

import * as React from "react";
import { Megaphone, Play, CheckCircle2, Users } from "lucide-react";
import { StatCard } from "@/components/shared/ui";
import type { CampaignAnalytics } from "./types";

export function CampaignAnalyticsCards({ analytics }: { analytics: CampaignAnalytics }) {
  const n = (v: number) => v.toLocaleString("en-IN");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Total campaigns" value={n(analytics.totalCampaigns)} icon={Megaphone} />
      <StatCard label="Active" value={n(analytics.activeCampaigns)} icon={Play} />
      <StatCard label="Completed" value={n(analytics.completedCampaigns)} icon={CheckCircle2} />
      <StatCard label="Participation" value={n(analytics.customerParticipation)} icon={Users} />
    </div>
  );
}
