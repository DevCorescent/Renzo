import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { API } from "@/lib/endpoints";
import {
  AttendanceReportsPage,
  buildSurface,
  type RawSearchParams,
} from "@/components/attendance/attendance-pages";

// MODULE: Branch Admin Attendance — reports

const BRANCH_ROLES = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] as const;

export default async function BranchAdminAttendanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !BRANCH_ROLES.includes(authUser.userType as (typeof BRANCH_ROLES)[number])) {
    redirect("/login");
  }

  return (
    <AttendanceReportsPage
      surface={buildSurface({
        basePath: "/branch-admin/attendance",
        eyebrow: "Branch",
        subtitle: "Daily, weekly and monthly attendance analytics for your branch.",
        userType: authUser.userType,
        markEndpoint: API.branchAdmin.attendance,
      })}
      searchParams={await searchParams}
    />
  );
}
