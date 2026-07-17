import prisma from "@/lib/db";
import type { Prisma, NotificationType } from "@prisma/client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Enterprise Notification Center — service
//
// Notifications are generated ONLY from business events, and every module
// publishes through this service instead of writing rows itself. Centralising it
// here is what keeps alerts consistent (one wording/format), scalable (fan-out to a
// role is one call) and cheap to change (a new channel or rule touches one file).
//
// Every function accepts an optional transaction client, so a notification can be
// written ATOMICALLY with the event that caused it — approve-a-request and
// notify-the-worker either both commit or both roll back, never half.
//
// Recipients are plain User ids, so a Super Admin, a Branch Admin and a Worker are
// all first-class targets. This service resolves role → users; callers pass intent
// ("tell the branch admins of branch X"), not a hand-built user list.
// ============================================================================

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

/** The event content. `type` defaults to INFO; refType/refId/href drive click-through. */
export type NotifyInput = {
  type?: NotificationType;
  title: string;
  message: string;
  href?: string;
  refType?: string;
  refId?: string;
};

/** Normalise an input into a row payload (minus userId), applying defaults once. */
function payload(input: NotifyInput) {
  return {
    type: input.type ?? "INFO",
    title: input.title,
    message: input.message,
    href: input.href ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
  };
}

/** Notify one user. */
export async function notify(userId: string, input: NotifyInput, tx?: Tx): Promise<void> {
  const db: Db = tx ?? prisma;
  await db.notification.create({ data: { userId, ...payload(input) } });
}

/** Notify many users in a single write. A no-op on an empty list. */
export async function notifyMany(userIds: string[], input: NotifyInput, tx?: Tx): Promise<void> {
  if (userIds.length === 0) return;
  const db: Db = tx ?? prisma;
  const row = payload(input);
  await db.notification.createMany({ data: userIds.map((userId) => ({ userId, ...row })) });
}

/**
 * Notify every platform admin (SUPER_ADMIN + OWNER). Used for the "Super Admin
 * receives every important business event" tier — the caller states the event, the
 * service resolves who the platform admins currently are.
 */
export async function notifySuperAdmins(input: NotifyInput, tx?: Tx): Promise<void> {
  const db: Db = tx ?? prisma;
  const admins = await db.user.findMany({
    where: { userType: { in: ["SUPER_ADMIN", "OWNER"] }, isActive: true },
    select: { id: true },
  });
  await notifyMany(admins.map((a) => a.id), input, tx);
}

/**
 * Notify the Branch Admins of one branch. A branch admin is a BRANCH_ADMIN User
 * whose StaffProfile is pinned to that branch — resolved here so callers never
 * duplicate that lookup.
 */
export async function notifyBranchAdmins(branchId: string, input: NotifyInput, tx?: Tx): Promise<void> {
  const db: Db = tx ?? prisma;
  const admins = await db.user.findMany({
    where: { userType: "BRANCH_ADMIN", isActive: true, staffProfile: { branchId } },
    select: { id: true },
  });
  await notifyMany(admins.map((a) => a.id), input, tx);
}
