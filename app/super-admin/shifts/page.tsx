import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { apiGet, type Paginated } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import { PageHeader } from "@/components/shared/ui";
import { AttendanceTabs } from "@/components/attendance/attendance-tabs";
import { AttendanceError, friendlyError } from "@/components/attendance/attendance-ui";
import { ShiftManager } from "@/components/attendance/shift-manager";
import type { ShiftRow } from "@/components/attendance/types";

// MODULE: Shift Management (Super Admin)
//
// Shifts are GLOBAL templates shared by every branch, which is why authoring them
// is platform-level and this page lives under /super-admin. A branch admin assigns
// from the catalogue (on the worker's own profile) but cannot mint new templates —
// the API enforces that, and this page is simply not in their sidebar.

const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

export default async function SuperAdminShiftsPage() {
  const authUser = await getServerUser();
  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])) {
    redirect("/login");
  }

  // includeInactive: this is the management screen, so a deactivated shift must
  // still be visible here — it is hidden from the pickers, not from its owner.
  const result = await apiGet<Paginated<ShiftRow>>(
    `${API.admin.shifts}?includeInactive=true&limit=100`
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HR"
        title="Shifts"
        subtitle="Shift templates that drive rostering, late minutes and overtime."
      />

      <AttendanceTabs basePath="/super-admin/attendance" shiftsPath="/super-admin/shifts" />

      {!result.ok ? (
        <AttendanceError message={friendlyError(result.status, result.message)} />
      ) : (
        <ShiftManager shifts={result.data.items} shiftsEndpoint={API.admin.shifts} canManage />
      )}
    </div>
  );
}
