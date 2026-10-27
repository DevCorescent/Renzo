// ============================================================================
// MODULE : Services — Walk-in pins
//
// A branch's front desk pins the services it rings up all day ("Haircut",
// "Beard Styling" …) so they sit at the top of Walk-in → Services as one-tap
// "Quick add" buttons. Pins are per branch (ServicePin), managed by the branch's
// admins from Branch Services. The defaults that used to be hardcoded in the
// Walk-in console were carried over by the migration that created the table.
// ============================================================================

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Pinned service ids, in the order they were pinned.
 *
 * `branchId` null is a global user's branchless Walk-in: it shows every
 * branch's pins (each service once), which is what the old hardcoded pins did
 * for every user.
 */
export async function pinnedServiceIds(branchId: string | null, db: Db = prisma): Promise<string[]> {
  const pins = await db.servicePin.findMany({
    where: branchId ? { branchId } : {},
    orderBy: [{ createdAt: "asc" }, { serviceId: "asc" }],
    select: { serviceId: true },
  });
  return [...new Set(pins.map((p) => p.serviceId))];
}

/**
 * Pin or unpin one service for one branch. Idempotent: pinning a pinned
 * service or unpinning an unpinned one is a no-op.
 */
export async function setServicePin(params: {
  branchId: string;
  serviceId: string;
  pinned: boolean;
  userId: string;
}): Promise<void> {
  const { branchId, serviceId, pinned, userId } = params;
  if (pinned) {
    await prisma.servicePin.upsert({
      where: { branchId_serviceId: { branchId, serviceId } },
      create: { branchId, serviceId, pinnedBy: userId },
      update: {},
    });
  } else {
    await prisma.servicePin.deleteMany({ where: { branchId, serviceId } });
  }
}
