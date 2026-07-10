import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Super Admin — Settings

export default async function SuperAdminSettingsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const [config, branchSettings] = await Promise.all([
    prisma.platformConfig.findUnique({ where: { id: "global" } }),
    prisma.branchSetting.findMany({
      include: { branch: { select: { name: true, city: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Platform configuration</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Platform Config</CardTitle></CardHeader>
        <CardBody>
          {config ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ["Business Name", config.businessName],
                ["Support Phone", config.supportPhone ?? "—"],
                ["Support Email", config.supportEmail ?? "—"],
                ["WhatsApp", config.whatsappNumber ?? "—"],
                ["Instagram", config.instagramHandle ?? "—"],
                ["Default Slot (min)", config.defaultBookingSlotMin],
                ["Maintenance Mode", config.maintenanceMode ? "ON" : "off"],
                ["Review Auto-Approve", config.reviewAutoApprove ? "Yes" : "No"],
                ["Portfolio Auto-Approve", config.portfolioAutoApprove ? "Yes" : "No"],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded border border-gray-100 p-3">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
                  <dd className="mt-1 text-sm text-gray-800">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No platform config found. Run the seed endpoint to create it.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Branch Settings</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
                <th className="px-4 py-2.5">Branch</th>
                <th className="px-4 py-2.5">Currency</th>
                <th className="px-4 py-2.5">Tax %</th>
                <th className="px-4 py-2.5">Advance Days</th>
                <th className="px-4 py-2.5">Cancel Hrs</th>
                <th className="px-4 py-2.5">Auto-Confirm</th>
                <th className="px-4 py-2.5">Online Pay</th>
              </tr>
            </thead>
            <tbody>
              {branchSettings.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.branch.name}
                    <span className="ml-1 text-[11px] text-gray-400">{s.branch.city}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.currency}</td>
                  <td className="px-4 py-3 text-gray-500">{s.taxPercent}%</td>
                  <td className="px-4 py-3 text-gray-500">{s.advanceBookingDays}d</td>
                  <td className="px-4 py-3 text-gray-500">{s.cancellationHours}h</td>
                  <td className="px-4 py-3 text-gray-500">{s.autoConfirmBookings ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.onlinePaymentEnabled ? "Yes" : "No"}</td>
                </tr>
              ))}
              {branchSettings.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">No branch settings configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
