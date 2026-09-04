import { getServerUser, requireModule } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { SheetClient } from "./sheet-client";

export default async function SheetPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  await requireModule("sheet");

  const branchId = authUser.branchId;

  const workerBranches = await prisma.workerBranch.findMany({
    where: { branchId, isActive: true },
    orderBy: { joinedAt: "asc" },
    select: {
      worker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          designation: { select: { name: true } },
        },
      },
    },
  });

  const workers = workerBranches.map((wb) => ({
    id: wb.worker.id,
    name: `${wb.worker.firstName} ${wb.worker.lastName}`.trim(),
    designation: wb.worker.designation?.name ?? null,
  }));

  return <SheetClient initialWorkers={workers} />;
}
