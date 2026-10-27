import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { API } from "@/lib/endpoints";
import {
  AttendanceBreaksPage,
  buildSurface,
  type RawSearchParams,
} from "@/components/attendance/attendance-pages";

// MODULE: Branch Admin Attendance — lunch breaks

const BRANCH_ROLES = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] as const;

export default async function BranchAdminAttendanceBreaksPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !BRANCH_ROLES.includes(authUser.userType as (typeof BRANCH_ROLES)[number])) {
    redirect("/login");
  }

  return (
    <AttendanceBreaksPage
      surface={buildSurface({
        basePath: "/branch-admin/attendance",
        eyebrow: "Branch",
        subtitle: "Lunch breaks at your branch.",
        userType: authUser.userType,
        markEndpoint: API.branchAdmin.attendance,
      })}
      searchParams={await searchParams}
    />
  );
}
