import { AppShell } from "@/components/shared/app-shell";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

// LAYOUT: Marketing Manager Panel

const ALLOWED = ["MARKETING_MANAGER", "SUPER_ADMIN", "OWNER"];

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getServerUser();
  if (!authUser || !ALLOWED.includes(authUser.userType)) redirect("/login");

  let userName = "Marketing";
  const staff = await prisma.staffProfile.findFirst({
    where: { userId: authUser.userId },
    select: { firstName: true, lastName: true },
  });
  if (staff) userName = `${staff.firstName} ${staff.lastName}`.trim();

  return (
    <AppShell role="marketing" userName={userName}>
      {children}
    </AppShell>
  );
}
