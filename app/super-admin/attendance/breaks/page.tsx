import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { API } from "@/lib/endpoints";
import {
  AttendanceBreaksPage,
  buildSurface,
  type RawSearchParams,
} from "@/components/attendance/attendance-pages";

// MODULE: Super Admin Attendance — lunch breaks

const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

export default async function SuperAdminAttendanceBreaksPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])) {
    redirect("/login");
  }

  return (
    <AttendanceBreaksPage
      surface={buildSurface({
        basePath: "/super-admin/attendance",
        shiftsPath: "/super-admin/shifts",
        eyebrow: "HR",
        subtitle: "Lunch breaks across every branch.",
        userType: authUser.userType,
        markEndpoint: API.admin.attendance,
      })}
      searchParams={await searchParams}
    />
  );
}
