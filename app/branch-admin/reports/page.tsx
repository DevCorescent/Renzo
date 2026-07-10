import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { StatCard } from "@/components/shared/ui";
import { IndianRupee, CalendarDays, Users, TrendingUp } from "lucide-react";

// OWNER: Hemant | MODULE: Branch Admin Reports

export default async function BranchAdminReportsPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
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
  ]);

  const thisRev = Number(monthRevenue._sum.paidAmount ?? 0);
  const lastRev = Number(lastMonthRevenue._sum.paidAmount ?? 0);
  const revDiff = lastRev > 0 ? (((thisRev - lastRev) / lastRev) * 100).toFixed(1) : null;
  const apptDiff =
    lastMonthAppointments > 0
      ? (((monthAppointments - lastMonthAppointments) / lastMonthAppointments) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </p>
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
        <div className="rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">This Month</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total Appointments</span>
              <span className="font-medium">{monthAppointments}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Completed</span>
              <span className="font-medium text-green-700">{completedThisMonth}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Cancelled</span>
              <span className="font-medium text-red-600">{cancelledThisMonth}</span>
            </div>
            <div className="flex justify-between text-gray-600 border-t border-gray-100 pt-2">
              <span>Revenue</span>
              <span className="font-semibold text-gray-900">₹{thisRev.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">Last Month</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total Appointments</span>
              <span className="font-medium">{lastMonthAppointments}</span>
            </div>
            <div className="flex justify-between text-gray-600 border-t border-gray-100 pt-2">
              <span>Revenue</span>
              <span className="font-semibold text-gray-900">₹{lastRev.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Recent Invoices</h3>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
              <th className="px-4 py-2.5">Invoice #</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentInvoices.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{inv.invoiceNo}</td>
                <td className="px-4 py-3 text-gray-700">
                  {inv.appointment?.customer.firstName} {inv.appointment?.customer.lastName}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  ₹{Number(inv.paidAmount).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
            {recentInvoices.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
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
