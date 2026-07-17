import { AppShell } from "@/components/shared/app-shell";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

// LAYOUT: Inventory Manager Panel

const ALLOWED = ["INVENTORY_MANAGER", "SUPER_ADMIN", "OWNER"];

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getServerUser();
  if (!authUser || !ALLOWED.includes(authUser.userType)) redirect("/staff/login");

  let userName = "Inventory";
  const staff = await prisma.staffProfile.findFirst({
    where: { userId: authUser.userId },
    select: { firstName: true, lastName: true },
  });
  if (staff) userName = `${staff.firstName} ${staff.lastName}`.trim();

  return (
    <AppShell role="inventory" userName={userName}>
      {children}
    </AppShell>
  );
}
