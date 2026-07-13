import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

export default async function MarketingOffersPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const offers = await prisma.offer.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { branch: { select: { name: true } } },
  });

  const now = new Date();
  const active = offers.filter((o) => o.isActive && (!o.validUntil || o.validUntil > now)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Offers</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {offers.length} offers · {active} active
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Offers", value: offers.length },
          { label: "Active", value: active },
          { label: "Expired / Inactive", value: offers.length - active },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Offers</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Title</TH>
              <TH>Branch</TH>
              <TH>Type</TH>
              <TH>Discount %</TH>
              <TH>Discount ₹</TH>
              <TH>Valid From</TH>
              <TH>Valid Until</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {offers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No offers yet.</td></tr>
            ) : offers.map((o) => {
              const isExpired = o.validUntil && o.validUntil <= now;
              const isActive = o.isActive && !isExpired;
              return (
                <TR key={o.id}>
                  <TD className="font-medium text-gray-900">{o.title}</TD>
                  <TD className="text-gray-500">{o.branch?.name ?? "All branches"}</TD>
                  <TD><Badge tone="info">{o.type}</Badge></TD>
                  <TD className="text-gray-700">{o.discountPercent ? `${o.discountPercent}%` : "—"}</TD>
                  <TD className="text-gray-700">
                    {o.discountAmount ? `₹${Number(o.discountAmount).toLocaleString("en-IN")}` : "—"}
                  </TD>
                  <TD className="text-xs text-gray-500">
                    {new Date(o.validFrom).toLocaleDateString("en-IN")}
                  </TD>
                  <TD className="text-xs text-gray-500">
                    {o.validUntil ? new Date(o.validUntil).toLocaleDateString("en-IN") : "No expiry"}
                  </TD>
                  <TD>
                    {isExpired ? (
                      <Badge tone="neutral">Expired</Badge>
                    ) : isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="danger">Inactive</Badge>
                    )}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
