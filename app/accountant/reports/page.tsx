import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default async function AccountantReportsPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");
  const branchFilter = authUser.branchId ? { branchId: authUser.branchId } : {};

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const d7 = new Date(today); d7.setDate(today.getDate() - 6);
  const d30 = new Date(today); d30.setDate(today.getDate() - 29);
  const d90 = new Date(today); d90.setDate(today.getDate() - 89);

  const [rev7, rev30, rev90, refund30, outstanding, paid, byMethod, byBranch] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { ...branchFilter, createdAt: { gte: d7 } } }),
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { ...branchFilter, createdAt: { gte: d30 } } }),
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { ...branchFilter, createdAt: { gte: d90 } } }),
    prisma.refund.aggregate({ _sum: { amount: true }, where: { processedAt: { gte: d30 }, invoice: branchFilter } }),
    prisma.invoice.aggregate({ _sum: { balanceDue: true }, where: { ...branchFilter, status: { in: ["UNPAID", "PARTIAL"] } } }),
    prisma.invoice.count({ where: { ...branchFilter, status: "PAID" } }),
    prisma.payment.groupBy({ by: ["method"], _sum: { amount: true }, where: { paidAt: { gte: d30 }, invoice: branchFilter } }),
    authUser.branchId
      ? Promise.resolve(null)
      : prisma.invoice.groupBy({ by: ["branchId"], _sum: { paidAmount: true }, where: { createdAt: { gte: d30 } }, orderBy: { _sum: { paidAmount: "desc" } }, take: 5 }),
  ]);

  // branch names for cross-branch view
  const branchIds = byBranch?.map((b) => b.branchId).filter(Boolean) as string[] | undefined;
  const branches = branchIds?.length
    ? await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
    : [];
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const revenue7 = Math.round(Number(rev7._sum.paidAmount ?? 0));
  const revenue30 = Math.round(Number(rev30._sum.paidAmount ?? 0));
  const revenue90 = Math.round(Number(rev90._sum.paidAmount ?? 0));
  const refunds = Math.round(Number(refund30._sum.amount ?? 0));
  const totalOutstanding = Math.round(Number(outstanding._sum.balanceDue ?? 0));

  const sections = [
    { label: "Last 7 days", value: inr(revenue7) },
    { label: "Last 30 days", value: inr(revenue30) },
    { label: "Last 90 days", value: inr(revenue90) },
    { label: "Refunds (30d)", value: inr(refunds) },
    { label: "Net (30d)", value: inr(revenue30 - refunds) },
    { label: "Outstanding", value: inr(totalOutstanding) },
    { label: "Paid invoices", value: paid.toString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Financial Reports</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          As of {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Revenue summary */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Revenue Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((s) => (
            <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="mt-2 text-xl font-semibold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue by payment method */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">By Payment Method (30 days)</h2>
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          {byMethod.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">No payment data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Method</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byMethod.map((m) => (
                  <tr key={m.method}>
                    <td className="px-4 py-2.5 font-medium text-gray-700">{m.method}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {inr(Math.round(Number(m._sum.amount ?? 0)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Revenue by branch (super admin view) */}
      {byBranch && byBranch.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Top Branches by Revenue (30 days)</h2>
          <div className="overflow-hidden rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Branch</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byBranch.map((b) => (
                  <tr key={b.branchId}>
                    <td className="px-4 py-2.5 font-medium text-gray-700">
                      {b.branchId ? branchMap.get(b.branchId) ?? b.branchId : "Unknown"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {inr(Math.round(Number(b._sum.paidAmount ?? 0)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
