// ============================================================================
// MODULE : Appointments — edit the visit record after the fact
// ROUTE  : PATCH /api/v1/reception/appointments/:id/details
//
// The desk finishes the visit first (bill, payment) and tidies the record later:
// who performed each service, the assistant, chair, room and notes. These are
// what a worker's history, "services performed" and the branch Sheet are built
// from, so they must stay editable even once the visit is completed and paid.
//
// Deliberately NOT editable here: services, prices, date/time. Those are on the
// invoice, which is the financial record — change them through billing.
//
// Unlike /assign (one stylist for the whole booking, before the visit), staff
// here is PER SERVICE and allowed on completed appointments. No double-booking
// check: this records work that happened, it does not reserve a future slot.
//
// BODY (both optional, at least one):
//   assignments: [{ serviceId, workerId }]        (workerId null = unassign)
//   details:     { chairCabinNo?, roomNo?, notes?, assistantWorkerId? }   (null/"" clears)
//
// ACCESS : RECEPTIONIST, BRANCH_ADMIN (own branch) · SUPER_ADMIN, OWNER (any)
// ============================================================================

import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";
import { updateSheet, type SheetEntry } from "@/lib/appointment-work";

const LOCKED: AppointmentStatus[] = [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW];

type Assignment = { serviceId: string; workerId: string | null };

/** undefined = leave alone; null = clear; string = set (trimmed, capped). */
function textField(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t ? t.slice(0, max) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as
      | { assignments?: unknown; details?: Record<string, unknown> }
      | null;
    if (!body || typeof body !== "object") return err("Invalid request body");

    // ── Parse ────────────────────────────────────────────────────────────────
    const assignments: Assignment[] = [];
    if (body.assignments !== undefined) {
      if (!Array.isArray(body.assignments)) {
        return err("Validation failed", 422, { assignments: ["Must be a list"] });
      }
      for (const a of body.assignments as unknown[]) {
        const serviceId = (a as { serviceId?: unknown })?.serviceId;
        const workerId = (a as { workerId?: unknown })?.workerId;
        if (typeof serviceId !== "string" || !(workerId === null || typeof workerId === "string")) {
          return err("Validation failed", 422, { assignments: ["Each entry needs a service and a staff member (or null)"] });
        }
        assignments.push({ serviceId, workerId: workerId?.trim() || null });
      }
    }

    const d = body.details && typeof body.details === "object" ? body.details : {};
    const details = {
      chairCabinNo: textField(d.chairCabinNo, 40),
      roomNo: textField(d.roomNo, 40),
      notes: textField(d.notes, 500),
      assistantWorkerId: textField(d.assistantWorkerId, 64),
    };
    const hasDetails = Object.values(details).some((v) => v !== undefined);

    if (assignments.length === 0 && !hasDetails) {
      return err("Nothing to update", 422);
    }

    // ── Load ─────────────────────────────────────────────────────────────────
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        appointmentNo: true,
        branchId: true,
        workerId: true,
        status: true,
        appointmentDate: true,
        chairCabinNo: true,
        roomNo: true,
        notes: true,
        assistantWorkerId: true,
        services: {
          select: { id: true, serviceId: true, workerId: true, price: true, service: { select: { name: true } } },
        },
      },
    });
    // 404 rather than 403 — another branch's appointment is not discoverable.
    if (!appointment || (!scope.isGlobal && appointment.branchId !== scope.branchId)) {
      return err("Appointment not found", 404);
    }
    if (LOCKED.includes(appointment.status)) {
      return err("A cancelled or no-show appointment cannot be edited", 400);
    }

    // ── Validate staff ───────────────────────────────────────────────────────
    const byService = new Map(appointment.services.map((s) => [s.serviceId, s]));
    if (assignments.some((a) => !byService.has(a.serviceId))) {
      return err("Validation failed", 422, { assignments: ["A service is not part of this appointment"] });
    }

    const staffIds = new Set(assignments.map((a) => a.workerId).filter((w): w is string => Boolean(w)));
    if (details.assistantWorkerId) staffIds.add(details.assistantWorkerId);
    if (staffIds.size > 0) {
      const valid = await prisma.workerProfile.count({
        where: {
          id: { in: [...staffIds] },
          isActive: true,
          branches: { some: { branchId: appointment.branchId, isActive: true } },
        },
      });
      if (valid !== staffIds.size) {
        return err("Validation failed", 422, { assignments: ["Choose staff who are active at this branch"] });
      }
    }

    const changed = assignments.filter((a) => byService.get(a.serviceId)!.workerId !== a.workerId);

    // Lead stylist on the appointment row: keep the current one if they still do
    // at least one service, otherwise the first person assigned. Worker screens
    // and reports key on this field, so it must not be left empty or stale.
    const finalWorkers = appointment.services.map((s) => {
      const a = assignments.find((x) => x.serviceId === s.serviceId);
      return a ? a.workerId : s.workerId; // an explicit null clears the line
    });
    // Only re-derived when staff actually changed — a notes-only edit must never
    // move the lead.
    const leadWorkerId =
      changed.length === 0
        ? appointment.workerId
        : appointment.workerId && finalWorkers.includes(appointment.workerId)
          ? appointment.workerId
          : finalWorkers.find(Boolean) ?? null;

    const assistantId =
      details.assistantWorkerId !== undefined ? details.assistantWorkerId : appointment.assistantWorkerId;
    if (assistantId && assistantId === leadWorkerId) {
      return err("Validation failed", 422, {
        assistantWorkerId: ["The assistant must be someone other than the lead stylist"],
      });
    }

    const apptData: Prisma.AppointmentUncheckedUpdateInput = {};
    if (leadWorkerId !== appointment.workerId) apptData.workerId = leadWorkerId;
    for (const key of ["chairCabinNo", "roomNo", "notes", "assistantWorkerId"] as const) {
      const next = details[key];
      if (next !== undefined && next !== appointment[key]) apptData[key] = next;
    }

    if (changed.length === 0 && Object.keys(apptData).length === 0) {
      return ok({ id: appointment.id, changed: 0 }, "No changes");
    }

    // ── Write ────────────────────────────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      for (const a of changed) {
        await tx.appointmentService.update({
          where: { id: byService.get(a.serviceId)!.id },
          data: { workerId: a.workerId },
        });
      }
      if (Object.keys(apptData).length > 0) {
        await tx.appointment.update({ where: { id: appointment.id }, data: apptData });
      }
    });

    // Move Sheet entries with the credit. Non-fatal.
    if (changed.length > 0) {
      try {
        const remove: SheetEntry[] = [];
        const add: SheetEntry[] = [];
        for (const a of changed) {
          const line = byService.get(a.serviceId)!;
          const entry = { serviceName: line.service.name, price: Number(line.price ?? 0) };
          if (line.workerId) remove.push({ workerId: line.workerId, ...entry });
          if (a.workerId) add.push({ workerId: a.workerId, ...entry });
        }
        await updateSheet(appointment.branchId, appointment.appointmentDate, { add, remove });
      } catch (sheetErr) {
        console.error("Sheet staff update error (non-fatal):", sheetErr);
      }
    }

    await writeAudit(user, {
      action: "UPDATE",
      module: "APPOINTMENT",
      refId: appointment.id,
      refType: "Appointment",
      oldValue: JSON.parse(JSON.stringify({
        workerId: appointment.workerId,
        chairCabinNo: appointment.chairCabinNo,
        roomNo: appointment.roomNo,
        notes: appointment.notes,
        assistantWorkerId: appointment.assistantWorkerId,
        services: changed.map((a) => ({ serviceId: a.serviceId, workerId: byService.get(a.serviceId)!.workerId })),
      })),
      newValue: JSON.parse(JSON.stringify({ ...apptData, services: changed })),
    });

    return ok(
      { id: appointment.id, workerId: leadWorkerId, changed: changed.length + Object.keys(apptData).length },
      `${appointment.appointmentNo} updated`
    );
  } catch (e) {
    console.error("PATCH appointment details error:", e);
    return err("Internal server error", 500);
  }
}
