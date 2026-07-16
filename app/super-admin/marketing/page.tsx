import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { MarketingHeaderActions } from "@/components/marketing/marketing-header-actions";

// OWNER: Hemant | MODULE: Super Admin — Marketing

export default async function SuperAdminMarketingPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const [coupons, campaigns, offers] = await Promise.all([
    prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { _count: { select: { usages: true } } },
    }),
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { branch: { select: { name: true } } },
    }),
    prisma.offer.findMany({
      orderBy: { createdAt: "desc" },
      include: { branch: { select: { name: true } } },
    }),
  ]);

  const activeCoupons = coupons.filter((c) => c.isActive && (!c.validUntil || c.validUntil > new Date()));

  return (
    <div className="space-y-6">
      {/* Header — title/subtitle unchanged; the two primary create actions sit
          top-right (Super-Admin only, since the page itself is Super-Admin guarded). */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Marketing</h1>
          <p className="mt-0.5 text-sm text-gray-500">{activeCoupons.length} active coupons · {campaigns.length} campaigns · {offers.length} offers</p>
        </div>
        <MarketingHeaderActions />
      </div>

      <Card>
        <CardHeader><CardTitle>Coupons</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Code</TH>
              <TH>Type</TH>
              <TH>Value</TH>
              <TH>Min Order</TH>
              <TH>Used / Limit</TH>
              <TH>Valid Until</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {coupons.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">No coupons.</td></tr>
            ) : (
              coupons.map((c) => {
                const expired = c.validUntil && c.validUntil < new Date();
                return (
                  <TR key={c.id}>
                    <TD className="font-mono font-semibold text-gray-900">{c.code}</TD>
                    <TD><Badge tone={c.type === "FLAT" ? "info" : "warning"}>{c.type}</Badge></TD>
                    <TD className="text-gray-700">
                      {c.type === "FLAT" ? `₹${c.value}` : `${c.value}%`}
                      {c.maxDiscount && <span className="ml-1 text-[11px] text-gray-400">(max ₹{c.maxDiscount})</span>}
                    </TD>
                    <TD className="text-gray-500">₹{c.minOrderAmount}</TD>
                    <TD className="text-gray-500">
                      {c._count.usages} / {c.usageLimit ?? "∞"}
                    </TD>
                    <TD className="font-mono text-xs text-gray-500">
                      {c.validUntil ? new Date(c.validUntil).toLocaleDateString("en-IN") : "No limit"}
                    </TD>
                    <TD>
                      <Badge tone={expired ? "neutral" : c.isActive ? "success" : "danger"}>
                        {expired ? "Expired" : c.isActive ? "Active" : "Off"}
                      </Badge>
                    </TD>
                  </TR>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader><CardTitle>Campaigns</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Name</TH><TH>Channel</TH><TH>Branch</TH><TH>Sent</TH><TH>Status</TH><TH>Scheduled</TH></tr></THead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">No campaigns.</td></tr>
            ) : (
              campaigns.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-gray-900">{c.name}</TD>
                  <TD><Badge tone="info">{c.channel}</Badge></TD>
                  <TD className="text-gray-500">{c.branch?.name ?? "All branches"}</TD>
                  <TD className="text-gray-500">{c.sentCount} / {c.recipientCount}</TD>
                  <TD><Badge tone={c.status === "COMPLETED" ? "success" : c.status === "RUNNING" ? "primary" : c.status === "FAILED" ? "danger" : "neutral"}>{c.status}</Badge></TD>
                  <TD className="font-mono text-xs text-gray-500">
                    {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString("en-IN") : "—"}
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader><CardTitle>Offers</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Title</TH><TH>Type</TH><TH>Branch</TH><TH>Discount</TH><TH>Valid Until</TH><TH>Status</TH></tr></THead>
          <tbody>
            {offers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">No offers.</td></tr>
            ) : (
              offers.map((o) => (
                <TR key={o.id}>
                  <TD className="font-medium text-gray-900">{o.title}</TD>
                  <TD><Badge tone="info">{o.type}</Badge></TD>
                  <TD className="text-gray-500">{o.branch?.name ?? "All branches"}</TD>
                  <TD className="text-gray-700">
                    {o.discountPercent ? `${o.discountPercent}%` : o.discountAmount ? `₹${o.discountAmount}` : "—"}
                  </TD>
                  <TD className="font-mono text-xs text-gray-500">
                    {o.validUntil ? new Date(o.validUntil).toLocaleDateString("en-IN") : "No limit"}
                  </TD>
                  <TD><Badge tone={o.isActive ? "success" : "neutral"}>{o.isActive ? "Active" : "Off"}</Badge></TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
