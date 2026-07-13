import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

export default async function MarketingCouponsPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const active = coupons.filter((c) => c.isActive && (!c.validUntil || c.validUntil > now)).length;
  const expired = coupons.filter((c) => c.validUntil && c.validUntil <= now).length;
  const totalUsed = coupons.reduce((sum, c) => sum + c.usedCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Coupons</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {coupons.length} coupons · {active} active · {totalUsed} total uses
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Coupons", value: coupons.length },
          { label: "Active", value: active },
          { label: "Expired", value: expired },
          { label: "Total Uses", value: totalUsed.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Coupons</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Code</TH>
              <TH>Type</TH>
              <TH>Value</TH>
              <TH>Min Order</TH>
              <TH>Max Discount</TH>
              <TH>Used</TH>
              <TH>Limit</TH>
              <TH>Valid Until</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {coupons.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">No coupons yet.</td></tr>
            ) : coupons.map((c) => {
              const isExpired = c.validUntil && c.validUntil <= now;
              const isActive = c.isActive && !isExpired;
              return (
                <TR key={c.id}>
                  <TD className="font-mono text-sm font-semibold text-gray-900 tracking-widest">{c.code}</TD>
                  <TD><Badge tone="info">{c.type}</Badge></TD>
                  <TD className="font-medium text-gray-900">
                    {c.type === "PERCENTAGE" ? `${c.value}%` : `₹${Number(c.value).toLocaleString("en-IN")}`}
                  </TD>
                  <TD className="text-gray-600">₹{Number(c.minOrderAmount).toLocaleString("en-IN")}</TD>
                  <TD className="text-gray-600">
                    {c.maxDiscount ? `₹${Number(c.maxDiscount).toLocaleString("en-IN")}` : "—"}
                  </TD>
                  <TD className="text-gray-700">{c.usedCount}</TD>
                  <TD className="text-gray-500">{c.usageLimit ?? "Unlimited"}</TD>
                  <TD className="text-xs text-gray-500">
                    {c.validUntil ? new Date(c.validUntil).toLocaleDateString("en-IN") : "No expiry"}
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
