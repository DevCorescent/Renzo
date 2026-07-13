import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "info" | "danger"> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  RUNNING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
};

export default async function MarketingCampaignsPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  const running = campaigns.filter((c) => c.status === "RUNNING" || c.status === "SCHEDULED").length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + c.openCount, 0);
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Campaigns</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {campaigns.length} campaigns · {running} active · {openRate}% open rate
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Campaigns", value: campaigns.length },
          { label: "Active / Scheduled", value: running },
          { label: "Total Sent", value: totalSent.toLocaleString() },
          { label: "Open Rate", value: `${openRate}%` },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Campaigns</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Channel</TH>
              <TH>Recipients</TH>
              <TH>Sent</TH>
              <TH>Failed</TH>
              <TH>Opened</TH>
              <TH>Scheduled At</TH>
              <TH>Sent At</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">No campaigns yet.</td></tr>
            ) : campaigns.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-gray-900">{c.name}</TD>
                <TD><Badge tone="info">{c.channel}</Badge></TD>
                <TD className="text-gray-700">{c.recipientCount.toLocaleString()}</TD>
                <TD className="text-gray-700">{c.sentCount.toLocaleString()}</TD>
                <TD className={c.failedCount > 0 ? "text-red-600 font-medium" : "text-gray-400"}>
                  {c.failedCount.toLocaleString()}
                </TD>
                <TD className="text-gray-700">{c.openCount.toLocaleString()}</TD>
                <TD className="text-xs text-gray-500">
                  {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString("en-IN") : "—"}
                </TD>
                <TD className="text-xs text-gray-500">
                  {c.sentAt ? new Date(c.sentAt).toLocaleDateString("en-IN") : "—"}
                </TD>
                <TD><Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
