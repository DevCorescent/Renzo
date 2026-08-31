import { AppShell } from "@/components/shared/app-shell";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

// OWNER: Hemant | LAYOUT: Reception Panel

// The reception panel is shared: the front desk runs it day to day, but the
// Operations hub links every admin role straight to reception screens (e.g.
// "Manual Appointment" → /reception/booking/new), so they must be allowed in.
// This mirrors the same role list the middleware enforces (see proxy.ts) — the
// two disagreeing is what bounced a branch admin back to the login page.
const RECEPTION_ROLES = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] as const;

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getServerUser();
  if (!authUser || !(RECEPTION_ROLES as readonly string[]).includes(authUser.userType)) {
    redirect("/staff/login");
  }
  // Reception screens are branch-scoped: a branch-bound role must actually have a
  // branch. Platform roles (super admin / owner) operate across branches and the
  // pages resolve the branch themselves, so they are exempt from this check.
  const branchBound = authUser.userType === "RECEPTIONIST" || authUser.userType === "BRANCH_ADMIN";
  if (branchBound && !authUser.branchId) redirect("/staff/login");

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
