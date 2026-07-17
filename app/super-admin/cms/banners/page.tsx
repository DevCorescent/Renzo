import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { CmsCopyGenerator } from "@/components/ai/cms-copy-generator";

// OWNER: Hemant | MODULE: CMS — Banners

export default async function SuperAdminCmsBannersPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const banners = await prisma.banner.findMany({ orderBy: [{ position: "asc" }, { sortOrder: "asc" }] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Banners</h1>
        <p className="mt-0.5 text-sm text-gray-500">{banners.length} total</p>
      </div>

      <CmsCopyGenerator defaultKind="banner" />

      <Card>
        <CardHeader><CardTitle>All Banners</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Title</TH><TH>Position</TH><TH>CTA</TH><TH>Valid From</TH><TH>Valid Until</TH><TH>Status</TH></tr></THead>
          <tbody>
            {banners.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No banners yet.</td></tr>
            ) : (
              banners.map((b) => (
                <TR key={b.id}>
                  <TD className="font-medium text-gray-900">{b.title}</TD>
                  <TD><Badge tone="info">{b.position}</Badge></TD>
                  <TD className="text-gray-500 text-xs">{b.ctaText ?? "—"}</TD>
                  <TD className="font-mono text-xs text-gray-500">{b.validFrom ? new Date(b.validFrom).toLocaleDateString("en-IN") : "Always"}</TD>
                  <TD className="font-mono text-xs text-gray-500">{b.validUntil ? new Date(b.validUntil).toLocaleDateString("en-IN") : "No limit"}</TD>
                  <TD><Badge tone={b.isActive ? "success" : "neutral"}>{b.isActive ? "Active" : "Off"}</Badge></TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
