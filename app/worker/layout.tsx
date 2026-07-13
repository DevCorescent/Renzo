import { AppShell } from "@/components/shared/app-shell";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

// OWNER: Hemant | LAYOUT: Worker Panel

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getServerUser();
  if (!authUser?.workerId || authUser.userType !== "WORKER") redirect("/login");

  let userName = "Worker";
  const worker = await prisma.workerProfile.findFirst({
    where: { userId: authUser.userId },
    select: { firstName: true, lastName: true },
  });
  if (worker) userName = `${worker.firstName} ${worker.lastName}`.trim();

  return (
    <AppShell role="worker" userName={userName}>
      {children}
    </AppShell>
  );
}
