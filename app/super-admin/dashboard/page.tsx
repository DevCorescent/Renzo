import Link from "next/link";
import prisma from "@/lib/db";
import { Building2, Users, UserCheck, CalendarDays } from "lucide-react";
import { StatCard, Card, CardHeader, CardTitle, Badge } from "@/components/shared/ui";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";

// OWNER: Hemant | MODULE: Super Admin Dashboard

export default async function SuperAdminDashboardPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [branchCount, workerCount, customerCount, todayCount, branches] =
    await Promise.all([
      prisma.branch.count({ where: { isActive: true } }),
      prisma.workerProfile.count({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.appointment.count({
        where: { appointmentDate: { gte: today, lt: tomorrow } },
      }),
      prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, name: true, city: true, code: true, isActive: true,
          _count: {
            select: {
              workerBranches: { where: { isActive: true } },
              appointments: { where: { appointmentDate: { gte: today, lt: tomorrow } } },
            },
          },
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Branches" value={branchCount.toString()} icon={Building2} />
        <StatCard label="Active Workers" value={workerCount.toString()} icon={Users} />
        <StatCard label="Total Customers" value={customerCount.toString()} icon={UserCheck} />
        <StatCard label="Today's Appointments" value={todayCount.toString()} icon={CalendarDays} />
      </div>

      {/* Branches */}
      <Card>
        <CardHeader>
          <CardTitle>Branches</CardTitle>
          <Link href="/super-admin/branches" className="text-xs text-gray-500 hover:text-gray-800">
            View all →
          </Link>
        </CardHeader>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">City</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Workers</th>
              <th className="px-4 py-2.5">Today</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                  No branches yet.{" "}
                  <Link href="/super-admin/branches" className="underline">
                    Create one
                  </Link>
                </td>
              </tr>
            ) : (
              branches.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-3 text-gray-500">{b.city}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{b.code}</td>
                  <td className="px-4 py-3 text-gray-700">{b._count.workerBranches}</td>
                  <td className="px-4 py-3 text-gray-700">{b._count.appointments}</td>
                  <td className="px-4 py-3">
                    <Badge tone="success">Active</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
