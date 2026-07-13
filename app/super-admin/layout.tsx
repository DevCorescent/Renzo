import { AppShell } from "@/components/shared/app-shell";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

// OWNER: Hemant | LAYOUT: Super Admin Panel

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  let userName = "Admin";
  const staff = await prisma.staffProfile.findFirst({
    where: { userId: authUser.userId },
    select: { firstName: true, lastName: true },
  });
  if (staff) userName = `${staff.firstName} ${staff.lastName}`.trim();

  return (
    <AppShell role="super-admin" userName={userName}>
      {children}
    </AppShell>
  );
}
