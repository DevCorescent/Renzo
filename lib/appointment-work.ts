// ============================================================================
// MODULE : Appointment work records — who did which service, and when
//
// A worker's history, "services performed" and the branch Sheet are all read
// from AppointmentService rows (workerId + status + timestamps) and from the
// SheetLog. The desk can move an appointment along through several routes
// (status PATCH, billing, the walk-in console), so the bookkeeping that keeps
// those rows truthful lives here, once, instead of being half-done per route.
// ============================================================================

import { AppointmentStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/db";

type Tx = Prisma.TransactionClient;

/**
 * Mirror an appointment-level STARTED / COMPLETED transition onto its service
 * lines. Without this, a visit completed at the desk leaves every service
 * PENDING, and "services performed" never counts it for the worker.
 *
 * Only lines that have not already reached the state are touched, so a
 * worker's own start/complete timestamps from the worker portal are kept.
 */
export async function syncServiceProgress(
  tx: Tx,
  appointmentId: string,
  status: AppointmentStatus,
  now: Date = new Date()
): Promise<void> {
  if (status !== AppointmentStatus.STARTED && status !== AppointmentStatus.COMPLETED) return;

  await tx.appointmentService.updateMany({
    where: { appointmentId, startedAt: null },
    data: { startedAt: now },
  });

  if (status === AppointmentStatus.STARTED) {
    await tx.appointmentService.updateMany({
      where: {
        appointmentId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN] },
      },
      data: { status: AppointmentStatus.STARTED },
    });
    return;
  }

  await tx.appointmentService.updateMany({
    where: {
      appointmentId,
      status: { notIn: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
    },
    data: { status: AppointmentStatus.COMPLETED, completedAt: now },
  });
}

// ── Sheet (branch day log: { [workerId]: string[] }) ─────────────────────────

export type SheetEntry = { workerId: string; serviceName: string; price: number };

/** The exact text a service occupies in a worker's Sheet cell. */
export function sheetEntryText(serviceName: string, price: number): string {
  return `${serviceName} · ₹${Number(price ?? 0)}`;
}

function normaliseCells(raw: unknown): Record<string, string[]> {
  const cells: Record<string, string[]> = {};
  for (const [k, v] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    const arr = Array.isArray(v)
      ? (v as unknown[]).filter((x): x is string => typeof x === "string")
      : typeof v === "string" && v.trim() ? [v] : [];
    if (arr.length) cells[k] = arr;
  }
  return cells;
}

/**
 * Add and/or remove service entries on a branch's Sheet for one day. Removal
 * drops ONE matching entry per request (a worker can legitimately do the same
 * service twice in a day). Non-fatal by design: callers wrap it so a Sheet
 * failure never blocks a booking or a bill.
 */
export async function updateSheet(
  branchId: string,
  date: Date,
  changes: { add?: SheetEntry[]; remove?: SheetEntry[] }
): Promise<void> {
  const add = changes.add ?? [];
  const remove = changes.remove ?? [];
  if (add.length === 0 && remove.length === 0) return;

  const existing = await prisma.sheetLog.findUnique({
    where: { branchId_date: { branchId, date } },
    select: { cells: true },
  });
  const cells = normaliseCells(existing?.cells);

  for (const r of remove) {
    const list = cells[r.workerId];
    if (!list) continue;
    const idx = list.indexOf(sheetEntryText(r.serviceName, r.price));
    if (idx >= 0) list.splice(idx, 1);
    if (list.length === 0) delete cells[r.workerId];
  }
  for (const a of add) {
    cells[a.workerId] = [...(cells[a.workerId] ?? []), sheetEntryText(a.serviceName, a.price)];
  }

  const cellsJson = cells as unknown as Prisma.InputJsonValue;
  await prisma.sheetLog.upsert({
    where: { branchId_date: { branchId, date } },
    create: { branchId, date, cells: cellsJson },
    update: { cells: cellsJson },
  });
}
