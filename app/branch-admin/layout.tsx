import { AppShell } from "@/components/shared/app-shell";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

// OWNER: Hemant | LAYOUT: Branch Admin Panel

export default async function BranchAdminLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getServerUser();
  if (!authUser?.branchId || !["BRANCH_ADMIN", "OWNER"].includes(authUser.userType)) redirect("/staff/login");

  let userName = "Admin";
  const staff = await prisma.staffProfile.findFirst({
    where: { userId: authUser.userId },
    select: { firstName: true, lastName: true },
  });
  if (staff) userName = `${staff.firstName} ${staff.lastName}`.trim();

  return (
    <AppShell role="branch-admin" userName={userName}>
      {children}
    </AppShell>
  );
}
