import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { AssignStaffForm } from "./assign-staff-form";
import { BranchCoverUpload } from "./branch-cover-upload";
import { BranchStatusToggle } from "./branch-status-toggle";
import { DeleteBranchButton } from "./delete-branch-button";
import { BranchStaffList } from "./branch-staff-list";

// OWNER: Hemant | MODULE: Super Admin — Branch Detail

export default async function SuperAdminBranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");
  const { id } = await params;

  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      timings: { orderBy: { dayOfWeek: "asc" } },
      setting: true,
      staffProfiles: {
        include: { user: { select: { userType: true, isActive: true, email: true, phone: true } } },
        orderBy: { createdAt: "desc" },
      },
      workerBranches: {
        where: { isActive: true },
        include: { worker: { select: { firstName: true, lastName: true, employeeCode: true, designation: { select: { name: true } } } } },
        orderBy: { joinedAt: "desc" },
      },
      _count: { select: { appointments: true } },
    },
  });

  if (!branch) return notFound();

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{branch.name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{branch.address}, {branch.city}, {branch.state} — {branch.pincode}</p>
        </div>
        <div className="flex items-start gap-4">
          <BranchCoverUpload branchId={id} currentImage={branch.coverImage ?? null} />
          <div className="flex flex-col items-end gap-2">
            <Badge tone={branch.isActive ? "success" : "danger"}>{branch.isActive ? "Active" : "Inactive"}</Badge>
            <BranchStatusToggle branchId={id} branchName={branch.name} isActive={branch.isActive} />
            <DeleteBranchButton branchId={id} branchName={branch.name} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total Appointments</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{branch._count.appointments}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Active Workers</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{branch.workerBranches.length}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Staff</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{branch.staffProfiles.length}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Phone</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{branch.phone}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Operating Hours</CardTitle></CardHeader>
          <div className="divide-y divide-gray-50">
            {branch.timings.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="w-8 text-sm font-medium text-gray-700">{DAYS[t.dayOfWeek]}</span>
                {t.isOpen ? (
                  <span className="font-mono text-xs text-gray-600">{t.openTime} – {t.closeTime}</span>
                ) : (
                  <Badge tone="neutral">Closed</Badge>
                )}
              </div>
            ))}
            {branch.timings.length === 0 && <p className="px-4 py-4 text-sm text-gray-400">No timings set.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff</CardTitle>
            <AssignStaffForm branchId={id} />
          </CardHeader>
          <BranchStaffList
            staff={branch.staffProfiles.map((s) => ({
              id: s.id,
              firstName: s.firstName,
              lastName: s.lastName,
              email: s.user.email,
              phone: s.user.phone,
              userType: s.user.userType,
              isActive: s.user.isActive && s.isActive,
            }))}
          />
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Workers ({branch.workerBranches.length})</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Name</TH><TH>Code</TH><TH>Designation</TH><TH>Assignment</TH></tr></THead>
          <tbody>
            {branch.workerBranches.map((wb) => (
              <TR key={wb.id}>
                <TD className="font-medium text-gray-900">{wb.worker.firstName} {wb.worker.lastName}</TD>
                <TD className="font-mono text-xs text-gray-400">{wb.worker.employeeCode}</TD>
                <TD className="text-gray-500">{wb.worker.designation?.name ?? "—"}</TD>
                <TD><Badge tone={wb.isPrimary ? "primary" : "neutral"}>{wb.isPrimary ? "Primary" : "Secondary"}</Badge></TD>
              </TR>
            ))}
            {branch.workerBranches.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No workers assigned.</td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      {branch.setting && (
        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Tax", `${branch.setting.taxPercent}% ${branch.setting.taxName}`],
              ["GST Number", branch.setting.taxNumber ?? "—"],
              ["Advance Booking", `${branch.setting.advanceBookingDays} days`],
              ["Min Advance", `${branch.setting.minAdvanceBookingHours}h`],
              ["Cancellation", `${branch.setting.cancellationHours}h notice`],
              ["Auto Confirm", branch.setting.autoConfirmBookings ? "Yes" : "No"],
              ["Online Pay", branch.setting.onlinePaymentEnabled ? "Yes" : "No"],
              ["Loyalty", branch.setting.loyaltyEnabled ? "Enabled" : "Disabled"],
              ["Membership", branch.setting.membershipEnabled ? "Enabled" : "Disabled"],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-gray-100 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
                <p className="mt-1 text-sm text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
