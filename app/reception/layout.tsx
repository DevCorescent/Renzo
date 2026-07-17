import { AppShell } from "@/components/shared/app-shell";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

// OWNER: Hemant | LAYOUT: Reception Panel

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getServerUser();
  if (!authUser?.branchId || authUser.userType !== "RECEPTIONIST") redirect("/staff/login");

  let userName = "Reception";
  const staff = await prisma.staffProfile.findFirst({
    where: { userId: authUser.userId },
    select: { firstName: true, lastName: true },
  });
  if (staff) userName = `${staff.firstName} ${staff.lastName}`.trim();

  return (
    <AppShell role="reception" userName={userName}>
      {children}
    </AppShell>
  );
}
