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

/** "21 Jul 2026, 3:30 PM" — UTC-pinned date (matching how times are stored) + 12h clock. */
function formatAppointmentWhen(date: Date, time: string): string {
  const day = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const [h, m] = time.split(":").map(Number);
  const meridiem = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${day}, ${hour12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

/**
 * Tell a customer their appointment was moved to a new date/time. Reuses the same
 * in-app Notification every other alert flows through, so it lands in the customer's
 * Notification Center with one consistent wording — callers pass the transaction
 * client so the alert commits ATOMICALLY with the appointment update (both, or
 * neither). One call per successful update keeps it exactly-once, no duplicates.
 */
export async function notifyCustomerAppointmentRescheduled(
  tx: Tx,
  appointment: {
    id: string;
    appointmentNo: string;
    appointmentDate: Date;
    startTime: string;
    customerUserId: string;
  }
): Promise<void> {
  await notify(
    appointment.customerUserId,
    {
      type: "INFO",
      title: "Appointment rescheduled",
      message: `Your appointment ${appointment.appointmentNo} has been rescheduled to ${formatAppointmentWhen(
        appointment.appointmentDate,
        appointment.startTime
      )}.`,
      href: `/customer/bookings/${appointment.id}`,
      refType: "Appointment",
      refId: appointment.id,
    },
    tx
  );
}

/**
 * Tell the customer (and their assigned worker, if any) that an appointment was
 * CONFIRMED. Same shared Notification path as every other alert; pass the tx so the
 * notifications commit atomically with the status change. `workerUserId` is optional
 * because an appointment can be confirmed before a worker is assigned.
 */
export async function notifyAppointmentConfirmed(
  tx: Tx,
  appointment: {
    id: string;
    appointmentNo: string;
    appointmentDate: Date;
    startTime: string;
    customerUserId: string;
    workerUserId?: string | null;
  }
): Promise<void> {
  const when = formatAppointmentWhen(appointment.appointmentDate, appointment.startTime);

  await notify(
    appointment.customerUserId,
    {
      type: "SUCCESS",
      title: "Appointment confirmed",
      message: `Your appointment ${appointment.appointmentNo} is confirmed for ${when}.`,
      href: `/customer/bookings/${appointment.id}`,
      refType: "Appointment",
      refId: appointment.id,
    },
    tx
  );

  if (appointment.workerUserId) {
    await notify(
      appointment.workerUserId,
      {
        type: "INFO",
        title: "Appointment confirmed",
        message: `Appointment ${appointment.appointmentNo} on ${when} is confirmed.`,
        href: `/worker/bookings/${appointment.id}`,
        refType: "Appointment",
        refId: appointment.id,
      },
      tx
    );
  }
}

/**
 * Tell a worker they were assigned to an appointment. Reuses the shared Notification
 * path; pass the tx so it commits atomically with the assignment. Callers should only
 * invoke this when the worker actually CHANGED, so re-saving the same worker never
 * re-notifies (no duplicates).
 */
export async function notifyWorkerAppointmentAssigned(
  tx: Tx,
  appointment: {
    id: string;
    appointmentNo: string;
    appointmentDate: Date;
    startTime: string;
    workerUserId: string;
  }
): Promise<void> {
  await notify(
    appointment.workerUserId,
    {
      type: "INFO",
      title: "New appointment assigned",
      message: `You've been assigned appointment ${appointment.appointmentNo} on ${formatAppointmentWhen(
        appointment.appointmentDate,
        appointment.startTime
      )}.`,
      href: `/worker/bookings/${appointment.id}`,
      refType: "Appointment",
      refId: appointment.id,
    },
    tx
  );
}
