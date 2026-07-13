import prisma from "@/lib/db";
import {
  Activity, PieChart as PieIcon, BarChart3, TrendingUp, Package, Truck,
  ShoppingCart, TriangleAlert,
} from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel, PanelHeader, ChartCard } from "@/components/dashboard/card";
import { AreaTrendChart, BarCompareChart, StatusDonutChart, type DonutSlice } from "@/components/dashboard/charts-lazy";
import { InventoryTable, type StockRow } from "@/components/dashboard/inventory-table";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/recent-activity";
import { FadeIn, Stagger, StaggerItem } from "@/components/dashboard/motion";
import { THEME_ROOT_ID, THEME_INIT_SCRIPT } from "@/components/dashboard/use-dash-theme";

// MODULE: Inventory Manager Dashboard
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

const MOVE_META: Record<string, { label: string; color: string }> = {
  PURCHASE_IN: { label: "Purchase in", color: "#10b981" },
  TRANSFER_IN: { label: "Transfer in", color: "#0ea5e9" },
  TRANSFER_OUT: { label: "Transfer out", color: "#6366f1" },
  SERVICE_USE: { label: "Service use", color: "#f59e0b" },
  RETAIL_SALE: { label: "Retail sale", color: "#8b5cf6" },
  ADJUSTMENT: { label: "Adjustment", color: "#64748b" },
  DAMAGE: { label: "Damage", color: "#fb7185" },
  EXPIRY: { label: "Expiry", color: "#ef4444" },
};
const MOVE_ORDER = Object.keys(MOVE_META);

export default async function InventoryDashboardPage() {
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

  const [productCount, supplierCount, pendingPO, stocks, movements14, recentMovements] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.purchaseOrder.count({ where: { status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } } }),
    prisma.stock.findMany({
      where: branchFilter,
      select: {
        id: true, quantity: true,
        product: { select: { name: true, sku: true, reorderLevel: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.stockMovement.findMany({
      where: { ...branchFilter, createdAt: { gte: d14, lt: tomorrow } },
      select: { createdAt: true, type: true },
    }),
    prisma.stockMovement.findMany({
      where: branchFilter,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, type: true, quantity: true, createdAt: true, product: { select: { name: true } } },
    }),
  ]);

  /* ── derive ─────────────────────────────────────────────────────────────── */
  const userName = "Inventory";
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const stockRows: StockRow[] = stocks.map((s) => ({
    id: s.id,
    product: s.product.name,
    sku: s.product.sku,
    branch: s.branch.name,
    quantity: s.quantity,
    reorder: s.product.reorderLevel,
    low: s.quantity <= s.product.reorderLevel,
  }));
  const lowStockCount = stockRows.filter((r) => r.low).length;

  // movements trend (14 days) + type donut
  const axis = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    return { key: dayKey(d), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
  });
  const moveCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const m of movements14) {
    moveCounts[dayKey(m.createdAt)] = (moveCounts[dayKey(m.createdAt)] ?? 0) + 1;
    typeCounts[m.type] = (typeCounts[m.type] ?? 0) + 1;
  }
  const trend = axis.map((a) => ({ label: a.label, value: moveCounts[a.key] ?? 0 }));
  const donut: DonutSlice[] = MOVE_ORDER.filter((t) => typeCounts[t]).map((t) => ({
    label: MOVE_META[t].label, value: typeCounts[t], color: MOVE_META[t].color,
  }));

  // lowest-stock products (bar)
  const lowestStock = [...stockRows]
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 6)
    .map((r) => ({ label: r.product.length > 16 ? r.product.slice(0, 15) + "…" : r.product, value: r.quantity }));

  const activity: ActivityItem[] = recentMovements.map((m) => ({
    id: m.id,
    title: (
      <span>
        <span className="font-medium text-gray-900 dark:text-(--sa-text)">{MOVE_META[m.type]?.label ?? m.type}</span> · {m.quantity} × {m.product.name}
      </span>
    ),
    time: relTime(m.createdAt, now),
    tone: m.type === "DAMAGE" || m.type === "EXPIRY" ? "danger" : m.type === "PURCHASE_IN" || m.type === "TRANSFER_IN" ? "success" : "info",
    icon: Package,
    href: undefined,
  }));

  const glance = [
    { label: "Total products", value: productCount, icon: Package, tone: "text-sky-500" },
    { label: "Low on stock", value: lowStockCount, icon: TriangleAlert, tone: "text-rose-500" },
    { label: "Suppliers", value: supplierCount, icon: Truck, tone: "text-violet-500" },
    { label: "Pending orders", value: pendingPO, icon: ShoppingCart, tone: "text-amber-500" },
  ];

  const ok = lowStockCount === 0;
  const banner = ok
    ? { text: "Stock levels healthy", wrap: "bg-emerald-50/60 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20", txt: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", ping: "bg-emerald-400" }
    : { text: `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} low on stock`, wrap: "bg-amber-50/60 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20", txt: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", ping: "bg-amber-400" };

  return (
    <div id={THEME_ROOT_ID} suppressHydrationWarning className="sa-dash -m-6 min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 transition-colors duration-300 sm:p-6">
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <div className="mx-auto max-w-350 space-y-6">
        <FadeIn>
          <DashboardHeader role="inventory" userName={userName} greeting={greeting} dateLabel={dateLabel} notifications={[]} />
        </FadeIn>

        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem><StatCard label="Total Products" value={productCount} icon="inventory" accent="sky" hint="active catalogue" /></StaggerItem>
          <StaggerItem><StatCard label="Low Stock" value={lowStockCount} icon="alert" accent="rose" hint="at or below reorder" /></StaggerItem>
          <StaggerItem><StatCard label="Suppliers" value={supplierCount} icon="supplier" accent="violet" hint="active vendors" /></StaggerItem>
          <StaggerItem><StatCard label="Pending Orders" value={pendingPO} icon="purchase" accent="amber" hint="awaiting delivery" /></StaggerItem>
        </Stagger>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <FadeIn>
              <ChartCard title="Stock movements" subtitle="Activity over the last 14 days" icon={Activity}>
                <AreaTrendChart data={trend} />
              </ChartCard>
            </FadeIn>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FadeIn>
                <ChartCard title="Movement types" subtitle="Last 14 days" icon={PieIcon}>
                  <StatusDonutChart data={donut} />
                </ChartCard>
              </FadeIn>
              <FadeIn>
                <ChartCard title="Lowest stock" subtitle="Units on hand" icon={BarChart3}>
                  {lowestStock.length ? <BarCompareChart data={lowestStock} /> : <p className="py-16 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No stock data yet.</p>}
                </ChartCard>
              </FadeIn>
            </div>
            <FadeIn>
              <Panel>
                <PanelHeader title="Stock overview" subtitle={`${stockRows.length} tracked items`} icon={Package} />
                <InventoryTable rows={stockRows} />
              </Panel>
            </FadeIn>
          </div>

          <div className="space-y-6">
            <FadeIn>
              <Panel>
                <PanelHeader title="Recent movements" icon={TrendingUp} />
                {activity.length ? <RecentActivity items={activity} /> : <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No recent movements.</p>}
              </Panel>
            </FadeIn>
            <FadeIn>
              <Panel>
                <PanelHeader title="At a glance" icon={Package} />
                <div className="space-y-1 p-3">
                  <div className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 ring-1 ring-inset", banner.wrap)}>
                    <span className={cn("flex items-center gap-2 text-sm font-medium", banner.txt)}>
                      <TriangleAlert className="size-4" /> {banner.text}
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
