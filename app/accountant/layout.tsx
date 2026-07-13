import { AppShell } from "@/components/shared/app-shell";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

// LAYOUT: Accountant Panel

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "OWNER"];

export default async function AccountantLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getServerUser();
  if (!authUser || !ALLOWED.includes(authUser.userType)) redirect("/login");

  let userName = "Accounts";
  const staff = await prisma.staffProfile.findFirst({
    where: { userId: authUser.userId },
    select: { firstName: true, lastName: true },
  });
  if (staff) userName = `${staff.firstName} ${staff.lastName}`.trim();

  return (
    <AppShell role="accountant" userName={userName}>
      {children}
    </AppShell>
  );
}
