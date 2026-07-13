import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { StatCard, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { IndianRupee, CalendarDays, Users, TrendingUp } from "lucide-react";

// OWNER: Hemant | MODULE: Super Admin — Reports

export default async function SuperAdminReportsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    monthRevenue, lastMonthRevenue,
    monthAppts, lastMonthAppts,
    completedThisMonth, newCustomers,
    branchStats,
  ] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { createdAt: { gte: startOfMonth } } }),
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    prisma.appointment.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.appointment.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    prisma.appointment.count({ where: { status: "COMPLETED", createdAt: { gte: startOfMonth } } }),
    prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, city: true,
        _count: { select: { appointments: true, workerBranches: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const thisRev = Number(monthRevenue._sum.paidAmount ?? 0);
  const lastRev = Number(lastMonthRevenue._sum.paidAmount ?? 0);
  const revChange = lastRev > 0 ? (((thisRev - lastRev) / lastRev) * 100).toFixed(1) : null;
  const apptChange = lastMonthAppts > 0 ? (((monthAppts - lastMonthAppts) / lastMonthAppts) * 100).toFixed(1) : null;

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
          delta={revChange ? { value: `${revChange}%`, positive: Number(revChange) >= 0 } : undefined}
          hint="vs last month"
        />
        <StatCard
          label="Appointments"
          value={monthAppts.toString()}
          icon={CalendarDays}
          delta={apptChange ? { value: `${apptChange}%`, positive: Number(apptChange) >= 0 } : undefined}
          hint="vs last month"
        />
        <StatCard label="Completed" value={completedThisMonth.toString()} icon={TrendingUp}
          hint={monthAppts > 0 ? `${Math.round((completedThisMonth / monthAppts) * 100)}% rate` : undefined}
        />
        <StatCard label="New Customers" value={newCustomers.toString()} icon={Users} />
      </div>

      <Card>
        <CardHeader><CardTitle>Branch Performance</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Branch</TH><TH>City</TH><TH>Total Appts</TH><TH>Workers</TH></tr></THead>
          <tbody>
            {branchStats.map((b) => (
              <TR key={b.id}>
                <TD className="font-medium text-gray-900">{b.name}</TD>
                <TD className="text-gray-500">{b.city}</TD>
                <TD className="text-gray-700">{b._count.appointments}</TD>
                <TD className="text-gray-500">{b._count.workerBranches}</TD>
              </TR>
            ))}
            {branchStats.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No branches.</td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
