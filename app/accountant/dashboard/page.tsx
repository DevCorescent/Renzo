import prisma from "@/lib/db";
import {
  Activity, PieChart as PieIcon, BarChart3, TrendingUp, Receipt, IndianRupee, Wallet,
} from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel, PanelHeader, ChartCard } from "@/components/dashboard/card";
import { AreaTrendChart, BarCompareChart, StatusDonutChart, type DonutSlice } from "@/components/dashboard/charts-lazy";
import { InvoiceTable, type InvoiceRow } from "@/components/dashboard/invoice-table";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/recent-activity";
import { FadeIn, Stagger, StaggerItem } from "@/components/dashboard/motion";
import { statusTone } from "@/components/dashboard/status-badge";
import { THEME_ROOT_ID, THEME_INIT_SCRIPT } from "@/components/dashboard/use-dash-theme";

// MODULE: Accountant Dashboard
// UI-only — reuses the shared RENZO design system. All queries are READ-ONLY.

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const fullName = (f: string, l?: string | null) => `${f}${l ? ` ${l}` : ""}`.trim();
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
function relTime(from: Date, now: Date) {
  const s = Math.max(1, Math.floor((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const INVOICE_META: Record<string, { label: string; color: string }> = {
  PAID: { label: "Paid", color: "#059669" },
  PARTIAL: { label: "Partial", color: "#0ea5e9" },
  UNPAID: { label: "Unpaid", color: "#f59e0b" },
  REFUNDED: { label: "Refunded", color: "#8b5cf6" },
  CANCELLED: { label: "Cancelled", color: "#ef4444" },
};
const INVOICE_ORDER = Object.keys(INVOICE_META);

export default async function AccountantDashboardPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");
  const branchFilter = authUser.branchId ? { branchId: authUser.branchId } : {};

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d14 = new Date(today);
  d14.setDate(d14.getDate() - 13);
  const d30 = new Date(today);
  d30.setDate(d30.getDate() - 30);

  const [revenueAgg, outstandingAgg, paidCount, refundAgg, invoicesWindow, statusGroups, paymentsByMethod, recentInvoices] =
    await Promise.all([
      prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { ...branchFilter, createdAt: { gte: d30, lt: tomorrow } } }),
      prisma.invoice.aggregate({ _sum: { balanceDue: true }, where: { ...branchFilter, status: { in: ["UNPAID", "PARTIAL"] } } }),
      prisma.invoice.count({ where: { ...branchFilter, status: "PAID" } }),
      prisma.refund.aggregate({ _sum: { amount: true }, where: { processedAt: { gte: d30, lt: tomorrow }, invoice: branchFilter } }),
      prisma.invoice.findMany({ where: { ...branchFilter, createdAt: { gte: d14, lt: tomorrow } }, select: { paidAmount: true, createdAt: true } }),
      prisma.invoice.groupBy({ by: ["status"], _count: { _all: true }, where: { ...branchFilter, createdAt: { gte: d30, lt: tomorrow } } }),
      prisma.payment.groupBy({ by: ["method"], _sum: { amount: true }, where: { paidAt: { gte: d30, lt: tomorrow }, invoice: branchFilter } }),
      prisma.invoice.findMany({
        where: branchFilter,
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, invoiceNo: true, totalAmount: true, paidAmount: true, balanceDue: true, status: true, createdAt: true, customerId: true,
        },
      }),
    ]);

  // Invoice has no `customer` relation — resolve names in one lookup.
  const custIds = [...new Set(recentInvoices.map((i) => i.customerId))];
  const customers = custIds.length
    ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const custMap = new Map(customers.map((c) => [c.id, fullName(c.firstName, c.lastName)]));

  /* ── derive ─────────────────────────────────────────────────────────────── */
  const userName = "Accounts";
  const revenue30 = Math.round(Number(revenueAgg._sum.paidAmount ?? 0));
  const outstanding = Math.round(Number(outstandingAgg._sum.balanceDue ?? 0));
  const refunds30 = Math.round(Number(refundAgg._sum.amount ?? 0));
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // revenue trend (14 days)
  const axis = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    return { key: dayKey(d), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
  });
  const revBuckets: Record<string, number> = {};
  for (const inv of invoicesWindow) revBuckets[dayKey(inv.createdAt)] = (revBuckets[dayKey(inv.createdAt)] ?? 0) + Number(inv.paidAmount ?? 0);
  const trend = axis.map((a) => ({ label: a.label, value: Math.round(revBuckets[a.key] ?? 0) }));

  // invoice status donut
  const statusCount: Record<string, number> = {};
  for (const g of statusGroups) statusCount[g.status] = g._count._all;
  const donut: DonutSlice[] = INVOICE_ORDER.filter((s) => statusCount[s]).map((s) => ({
    label: INVOICE_META[s].label, value: statusCount[s], color: INVOICE_META[s].color,
  }));

  // revenue by payment method (bar)
  const methodBars = paymentsByMethod
    .map((p) => ({ label: p.method, value: Math.round(Number(p._sum.amount ?? 0)) }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value);

  const invoiceRows: InvoiceRow[] = recentInvoices.map((i) => ({
    id: i.id,
    invoiceNo: i.invoiceNo,
    customer: custMap.get(i.customerId) ?? "—",
    date: new Date(i.createdAt).toLocaleDateString("en-IN"),
    dateSort: new Date(i.createdAt).getTime(),
    amount: Math.round(Number(i.totalAmount)),
    balance: Math.round(Number(i.balanceDue)),
    status: i.status,
  }));

  const activity: ActivityItem[] = recentInvoices.slice(0, 6).map((i) => ({
    id: i.id,
    title: (
      <span>
        <span className="font-medium text-gray-900 dark:text-(--sa-text)">{inr(Number(i.totalAmount))}</span> · {custMap.get(i.customerId) ?? "Customer"}
      </span>
    ),
    meta: `${i.invoiceNo} · ${INVOICE_META[i.status]?.label ?? i.status}`,
    time: relTime(i.createdAt, now),
    tone: statusTone(i.status),
    icon: Receipt,
    href: undefined,
  }));

  const glance = [
    { label: "Revenue (30d)", value: inr(revenue30), icon: IndianRupee, tone: "text-emerald-500" },
    { label: "Outstanding", value: inr(outstanding), icon: Receipt, tone: "text-amber-500" },
    { label: "Paid invoices", value: String(paidCount), icon: BarChart3, tone: "text-sky-500" },
    { label: "Refunds (30d)", value: inr(refunds30), icon: Wallet, tone: "text-rose-500" },
  ];

  const ok = outstanding === 0;
  const banner = ok
    ? { text: "All invoices settled", wrap: "bg-emerald-50/60 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20", txt: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", ping: "bg-emerald-400" }
    : { text: `${inr(outstanding)} outstanding`, wrap: "bg-amber-50/60 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20", txt: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", ping: "bg-amber-400" };

  return (
    <div id={THEME_ROOT_ID} suppressHydrationWarning className="sa-dash -m-6 min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 transition-colors duration-300 sm:p-6">
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <div className="mx-auto max-w-350 space-y-6">
        <FadeIn>
          <DashboardHeader role="accountant" userName={userName} greeting={greeting} dateLabel={dateLabel} notifications={[]} />
        </FadeIn>

        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem><StatCard label="Revenue (30d)" value={revenue30} icon="revenue" accent="emerald" format="inr" hint="collected" /></StaggerItem>
          <StaggerItem><StatCard label="Outstanding" value={outstanding} icon="invoice" accent="amber" format="inr" hint="unpaid balance" /></StaggerItem>
          <StaggerItem><StatCard label="Paid Invoices" value={paidCount} icon="chart" accent="sky" hint="fully settled" /></StaggerItem>
          <StaggerItem><StatCard label="Refunds (30d)" value={refunds30} icon="wallet" accent="rose" format="inr" hint="processed" /></StaggerItem>
        </Stagger>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <FadeIn>
              <ChartCard title="Revenue trend" subtitle="Collected over the last 14 days" icon={Activity}>
                <AreaTrendChart data={trend} money color="#10b981" />
              </ChartCard>
            </FadeIn>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FadeIn>
                <ChartCard title="Invoice status" subtitle="Last 30 days" icon={PieIcon}>
                  <StatusDonutChart data={donut} />
                </ChartCard>
              </FadeIn>
              <FadeIn>
                <ChartCard title="By payment method" subtitle="Revenue · last 30 days" icon={BarChart3}>
                  {methodBars.length ? <BarCompareChart data={methodBars} color="#10b981" /> : <p className="py-16 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No payments yet.</p>}
                </ChartCard>
              </FadeIn>
            </div>
            <FadeIn>
              <Panel>
                <PanelHeader title="Recent invoices" subtitle={`${invoiceRows.length} latest`} icon={Receipt} />
                <InvoiceTable rows={invoiceRows} />
              </Panel>
            </FadeIn>
          </div>

          <div className="space-y-6">
            <FadeIn>
              <Panel>
                <PanelHeader title="Recent invoices" icon={TrendingUp} />
                {activity.length ? <RecentActivity items={activity} /> : <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No recent invoices.</p>}
              </Panel>
            </FadeIn>
            <FadeIn>
              <Panel>
                <PanelHeader title="At a glance" icon={IndianRupee} />
                <div className="space-y-1 p-3">
                  <div className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 ring-1 ring-inset", banner.wrap)}>
                    <span className={cn("flex items-center gap-2 text-sm font-medium", banner.txt)}>
                      <Receipt className="size-4" /> {banner.text}
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
