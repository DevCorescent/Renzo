import { getServerUser, requireModule } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { StatCard } from "@/components/shared/ui";
import { IndianRupee, CalendarDays, Users, TrendingUp } from "lucide-react";
import { ReportsExport } from "./reports-export";
import Link from "next/link";

// OWNER: Hemant | MODULE: Branch Admin Reports

export default async function BranchAdminReportsPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  await requireModule("reports");
  const branchId = authUser.branchId;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    monthRevenue,
    lastMonthRevenue,
    monthAppointments,
    lastMonthAppointments,
    completedThisMonth,
    cancelledThisMonth,
    workerCount,
    recentInvoices,
    topProducts,
    tipsThisMonth,
    lastMonthTips,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { paidAmount: true },
      where: { branchId, createdAt: { gte: startOfMonth } },
    }),
    prisma.invoice.aggregate({
      _sum: { paidAmount: true },
      where: { branchId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),
    prisma.appointment.count({
      where: { branchId, createdAt: { gte: startOfMonth } },
    }),
    prisma.appointment.count({
      where: { branchId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),
    prisma.appointment.count({
      where: { branchId, status: "COMPLETED", createdAt: { gte: startOfMonth } },
    }),
    prisma.appointment.count({
      where: { branchId, status: "CANCELLED", createdAt: { gte: startOfMonth } },
    }),
    prisma.workerBranch.count({ where: { branchId, isActive: true } }),
    prisma.invoice.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        appointment: {
          select: { customer: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    // Top products sold this month
    prisma.invoiceItem.findMany({
      where: {
        type: "PRODUCT",
        invoice: { branchId, createdAt: { gte: startOfMonth } },
      },
      select: { name: true, quantity: true, total: true },
    }),
    // Tips collected this month
    prisma.invoiceItem.aggregate({
      _sum: { total: true },
      where: {
        type: "TIP",
        invoice: { branchId, createdAt: { gte: startOfMonth } },
      },
    }),
    // Tips last month
    prisma.invoiceItem.aggregate({
      _sum: { total: true },
      where: {
        type: "TIP",
        invoice: { branchId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      },
    }),
  ]);

  // Aggregate product sales by name
  const productMap = new Map<string, { qty: number; revenue: number }>();
  for (const item of topProducts) {
    const existing = productMap.get(item.name) ?? { qty: 0, revenue: 0 };
    productMap.set(item.name, {
      qty: existing.qty + item.quantity,
      revenue: existing.revenue + Number(item.total),
    });
  }
  const sortedProducts = [...productMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10);

  const totalProductRevenue = sortedProducts.reduce((s, [, v]) => s + v.revenue, 0);
  const tipsThisMonthAmt = Number(tipsThisMonth._sum.total ?? 0);
  const tipsLastMonthAmt = Number(lastMonthTips._sum.total ?? 0);
  const tipsDiff = tipsLastMonthAmt > 0 ? (((tipsThisMonthAmt - tipsLastMonthAmt) / tipsLastMonthAmt) * 100).toFixed(1) : null;

  const thisRev = Number(monthRevenue._sum.paidAmount ?? 0);
  const lastRev = Number(lastMonthRevenue._sum.paidAmount ?? 0);
  const revDiff = lastRev > 0 ? (((thisRev - lastRev) / lastRev) * 100).toFixed(1) : null;
  const apptDiff =
    lastMonthAppointments > 0
      ? (((monthAppointments - lastMonthAppointments) / lastMonthAppointments) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-[var(--sa-text)]">Reports</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-[var(--sa-muted)]">
            {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </p>
        </div>
        <ReportsExport />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue This Month"
          value={`₹${thisRev.toLocaleString("en-IN")}`}
          icon={IndianRupee}
          delta={revDiff ? { value: `${revDiff}%`, positive: Number(revDiff) >= 0 } : undefined}
          hint="vs last month"
        />
        <StatCard
          label="Appointments"
          value={monthAppointments.toString()}
          icon={CalendarDays}
          delta={apptDiff ? { value: `${apptDiff}%`, positive: Number(apptDiff) >= 0 } : undefined}
          hint="vs last month"
        />
        <StatCard
          label="Completed"
          value={completedThisMonth.toString()}
          icon={TrendingUp}
          hint={monthAppointments > 0 ? `${Math.round((completedThisMonth / monthAppointments) * 100)}% rate` : undefined}
        />
        <StatCard label="Active Workers" value={workerCount.toString()} icon={Users} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white p-4 dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[var(--sa-text-2)]">This Month</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-[var(--sa-text-2)]">
              <span>Total Appointments</span>
              <span className="font-medium">{monthAppointments}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-[var(--sa-text-2)]">
              <span>Completed</span>
              <span className="font-medium text-green-700">{completedThisMonth}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-[var(--sa-text-2)]">
              <span>Cancelled</span>
              <span className="font-medium text-red-600">{cancelledThisMonth}</span>
            </div>
            <div className="flex justify-between text-gray-600 border-t border-gray-100 pt-2 dark:border-[var(--sa-border)] dark:text-[var(--sa-text-2)]">
              <span>Revenue</span>
              <span className="font-semibold text-gray-900 dark:text-[var(--sa-text)]">₹{thisRev.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4 dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[var(--sa-text-2)]">Last Month</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-[var(--sa-text-2)]">
              <span>Total Appointments</span>
              <span className="font-medium">{lastMonthAppointments}</span>
            </div>
            <div className="flex justify-between text-gray-600 border-t border-gray-100 pt-2 dark:border-[var(--sa-border)] dark:text-[var(--sa-text-2)]">
              <span>Revenue</span>
              <span className="font-semibold text-gray-900 dark:text-[var(--sa-text)]">₹{lastRev.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product Sales + Tips */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-[var(--sa-border)]">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[var(--sa-text-2)]">
              Product Sales — {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </h3>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-[var(--sa-muted)]">
              Total: ₹{totalProductRevenue.toLocaleString("en-IN")}
            </p>
          </div>
          {sortedProducts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-[var(--sa-muted)]">
              No products sold this month.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400 dark:border-[var(--sa-border)] dark:text-[var(--sa-muted)]">
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map(([name, { qty, revenue }]) => (
                  <tr key={name} className="border-b border-gray-50 last:border-0 dark:border-[var(--sa-border)]">
                    <td className="px-4 py-3 text-gray-800 dark:text-[var(--sa-text)]">{name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-[var(--sa-muted)]">{qty}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-[var(--sa-text)]">
                      ₹{revenue.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded border border-gray-200 bg-white dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-[var(--sa-border)]">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[var(--sa-text-2)]">Tips</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-400 dark:text-[var(--sa-muted)]">
                  {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                </p>
                <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-[var(--sa-text)]">
                  ₹{tipsThisMonthAmt.toLocaleString("en-IN")}
                </p>
              </div>
              {tipsDiff && (
                <p className={`text-sm font-medium ${Number(tipsDiff) >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {Number(tipsDiff) >= 0 ? "+" : ""}{tipsDiff}% vs last month
                </p>
              )}
            </div>
            <div className="rounded bg-gray-50 px-3 py-2 dark:bg-white/5">
              <div className="flex justify-between text-sm text-gray-600 dark:text-[var(--sa-text-2)]">
                <span>Last month</span>
                <span className="font-medium">₹{tipsLastMonthAmt.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">
              Tips are added as line items during billing. See billing records for per-invoice details.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-[var(--sa-border)]">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[var(--sa-text-2)]">Recent Invoices</h3>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400 dark:border-[var(--sa-border)] dark:text-[var(--sa-muted)]">
              <th className="px-4 py-2.5">Invoice #</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentInvoices.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50 last:border-0 dark:border-[var(--sa-border)]">
                <td className="px-4 py-3">
                  <Link
                    href={`/branch-admin/billing/${inv.id}`}
                    className="font-mono text-xs text-gray-400 underline hover:text-gray-700 dark:text-[var(--sa-muted)] dark:hover:text-[var(--sa-text)]"
                  >
                    #{inv.invoiceNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-[var(--sa-text-2)]">
                  {inv.appointment?.customer.firstName} {inv.appointment?.customer.lastName}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-[var(--sa-muted)]">
                  {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-[var(--sa-text)]">
                  ₹{Number(inv.paidAmount).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
            {recentInvoices.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-[var(--sa-muted)]">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
