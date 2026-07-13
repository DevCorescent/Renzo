import prisma from "@/lib/db";
import {
  Activity, PieChart as PieIcon, BarChart3, TrendingUp, Megaphone, Tag, Ticket, Star,
} from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel, PanelHeader, ChartCard } from "@/components/dashboard/card";
import { AreaTrendChart, BarCompareChart, StatusDonutChart, type DonutSlice } from "@/components/dashboard/charts-lazy";
import { CampaignTable, type CampaignRow } from "@/components/dashboard/campaign-table";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/recent-activity";
import { FadeIn, Stagger, StaggerItem } from "@/components/dashboard/motion";
import { statusTone } from "@/components/dashboard/status-badge";
import { THEME_ROOT_ID, THEME_INIT_SCRIPT } from "@/components/dashboard/use-dash-theme";

// MODULE: Marketing Manager Dashboard
// UI-only — reuses the shared RENZO design system. All queries are READ-ONLY.

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function relTime(from: Date, now: Date) {
  const s = Math.max(1, Math.floor((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CAMPAIGN_META: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: "Completed", color: "#059669" },
  RUNNING: { label: "Running", color: "#10b981" },
  SCHEDULED: { label: "Scheduled", color: "#0ea5e9" },
  DRAFT: { label: "Draft", color: "#64748b" },
  FAILED: { label: "Failed", color: "#ef4444" },
};
const CAMPAIGN_ORDER = Object.keys(CAMPAIGN_META);

export default async function MarketingDashboardPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d14 = new Date(today);
  d14.setDate(d14.getDate() - 13);

  const [activeCampaigns, activeOffers, activeCoupons, pendingReviews, campaigns, reviews14, recentReviews] = await Promise.all([
    prisma.campaign.count({ where: { status: { in: ["SCHEDULED", "RUNNING"] } } }),
    prisma.offer.count({ where: { isActive: true } }),
    prisma.coupon.count({ where: { isActive: true } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, name: true, channel: true, status: true, recipientCount: true, sentCount: true },
    }),
    prisma.review.findMany({ where: { createdAt: { gte: d14, lt: tomorrow } }, select: { createdAt: true } }),
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, overallRating: true, comment: true, status: true, createdAt: true },
    }),
  ]);

  /* ── derive ─────────────────────────────────────────────────────────────── */
  const userName = "Marketing";
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // reviews trend (14 days)
  const axis = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    return { key: dayKey(d), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
  });
  const reviewCounts: Record<string, number> = {};
  for (const r of reviews14) reviewCounts[dayKey(r.createdAt)] = (reviewCounts[dayKey(r.createdAt)] ?? 0) + 1;
  const trend = axis.map((a) => ({ label: a.label, value: reviewCounts[a.key] ?? 0 }));

  // campaign status donut + channel bar
  const statusCounts: Record<string, number> = {};
  const channelCounts: Record<string, number> = {};
  for (const c of campaigns) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
    channelCounts[c.channel] = (channelCounts[c.channel] ?? 0) + 1;
  }
  const donut: DonutSlice[] = CAMPAIGN_ORDER.filter((s) => statusCounts[s]).map((s) => ({
    label: CAMPAIGN_META[s].label, value: statusCounts[s], color: CAMPAIGN_META[s].color,
  }));
  const channelBars = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([channel, value]) => ({ label: channel, value }));

  const campaignRows: CampaignRow[] = campaigns.map((c) => ({
    id: c.id, name: c.name, channel: c.channel, recipients: c.recipientCount, sent: c.sentCount, status: c.status,
  }));

  const activity: ActivityItem[] = recentReviews.map((r) => ({
    id: r.id,
    title: (
      <span>
        <span className="font-medium text-gray-900 dark:text-(--sa-text)">{"★".repeat(Math.max(1, Math.min(5, r.overallRating)))}</span>{" "}
        {r.comment ? r.comment.slice(0, 40) : "New review"}
      </span>
    ),
    meta: CAMPAIGN_META[r.status]?.label ?? r.status.toLowerCase(),
    time: relTime(r.createdAt, now),
    tone: statusTone(r.status),
    icon: Star,
    href: undefined,
  }));

  const glance = [
    { label: "Active campaigns", value: activeCampaigns, icon: Megaphone, tone: "text-amber-500" },
    { label: "Live offers", value: activeOffers, icon: Tag, tone: "text-emerald-500" },
    { label: "Active coupons", value: activeCoupons, icon: Ticket, tone: "text-sky-500" },
    { label: "Reviews pending", value: pendingReviews, icon: Star, tone: "text-violet-500" },
  ];

  const ok = pendingReviews === 0;
  const banner = ok
    ? { text: "All reviews moderated", wrap: "bg-emerald-50/60 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20", txt: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", ping: "bg-emerald-400" }
    : { text: `${pendingReviews} review${pendingReviews === 1 ? "" : "s"} to moderate`, wrap: "bg-amber-50/60 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20", txt: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", ping: "bg-amber-400" };

  return (
    <div id={THEME_ROOT_ID} suppressHydrationWarning className="sa-dash -m-6 min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 transition-colors duration-300 sm:p-6">
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <div className="mx-auto max-w-350 space-y-6">
        <FadeIn>
          <DashboardHeader role="marketing" userName={userName} greeting={greeting} dateLabel={dateLabel} notifications={[]} />
        </FadeIn>

        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem><StatCard label="Active Campaigns" value={activeCampaigns} icon="marketing" accent="amber" hint="scheduled or running" /></StaggerItem>
          <StaggerItem><StatCard label="Live Offers" value={activeOffers} icon="offer" accent="emerald" hint="currently active" /></StaggerItem>
          <StaggerItem><StatCard label="Active Coupons" value={activeCoupons} icon="coupon" accent="sky" hint="redeemable now" /></StaggerItem>
          <StaggerItem><StatCard label="Pending Reviews" value={pendingReviews} icon="rating" accent="violet" hint="awaiting moderation" /></StaggerItem>
        </Stagger>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <FadeIn>
              <ChartCard title="Customer feedback" subtitle="Reviews over the last 14 days" icon={Activity}>
                <AreaTrendChart data={trend} />
              </ChartCard>
            </FadeIn>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FadeIn>
                <ChartCard title="Campaign status" subtitle="Recent campaigns" icon={PieIcon}>
                  <StatusDonutChart data={donut} />
                </ChartCard>
              </FadeIn>
              <FadeIn>
                <ChartCard title="By channel" subtitle="Campaigns per channel" icon={BarChart3}>
                  {channelBars.length ? <BarCompareChart data={channelBars} /> : <p className="py-16 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No campaign data yet.</p>}
                </ChartCard>
              </FadeIn>
            </div>
            <FadeIn>
              <Panel>
                <PanelHeader title="Campaigns" subtitle={`${campaignRows.length} recent`} icon={Megaphone} />
                <CampaignTable rows={campaignRows} />
              </Panel>
            </FadeIn>
          </div>

          <div className="space-y-6">
            <FadeIn>
              <Panel>
                <PanelHeader title="Recent reviews" icon={TrendingUp} />
                {activity.length ? <RecentActivity items={activity} /> : <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No recent reviews.</p>}
              </Panel>
            </FadeIn>
            <FadeIn>
              <Panel>
                <PanelHeader title="At a glance" icon={Megaphone} />
                <div className="space-y-1 p-3">
                  <div className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 ring-1 ring-inset", banner.wrap)}>
                    <span className={cn("flex items-center gap-2 text-sm font-medium", banner.txt)}>
                      <Star className="size-4" /> {banner.text}
                    </span>
                    <span className="relative flex size-2 items-center justify-center">
                      <span className={cn("absolute inline-flex size-2 animate-ping rounded-full opacity-60", banner.ping)} />
                      <span className={cn("relative size-2 rounded-full", banner.dot)} />
                    </span>
                  </div>
                  {glance.map((g) => (
                    <div key={g.label} className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-(--sa-text-2)">
                        <g.icon className={`size-4 ${g.tone}`} /> {g.label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">{g.value}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}
