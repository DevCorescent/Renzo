// ============================================================================
// MODULE : Shift Management (admin)
// ROUTE  : /api/v1/admin/shifts/[id]
//
// METHODS
//   GET    — One shift template, with its assignment and attendance usage counts.
//   PATCH  — Update it. Send { isActive: false } to DEACTIVATE, which is the
//            correct way to retire a shift that has history.
//   DELETE — Hard-delete. REFUSED when the shift is referenced by any worker
//            assignment or any attendance record.
//
// ACCESS: SUPER_ADMIN, OWNER only (GET also allows BRANCH_ADMIN, who assigns from
//   the catalogue but does not author it).
//
// WHY DELETE REFUSES: Attendance.shiftId is the roster a historical record's late
// and overtime minutes were measured against. Cascading a delete through it would
// rewrite last month's payroll evidence; leaving a dangling id would make it
// unexplainable. Deactivation keeps history intact and removes the shift from
// every picker, which is what "delete this shift" actually means once it has been
// used. The response says so explicitly rather than returning a raw FK error.
// ============================================================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { ok, err } from "@/lib/response";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { ShiftSchema, SHIFT_SELECT, normalizeWorkingDays } from "@/lib/shift-schema";

const MODULE = "SHIFT";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const shift = await prisma.shift.findUnique({ where: { id }, select: SHIFT_SELECT });
    if (!shift) return err("Shift not found", 404);
    return ok(shift);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  // The full schema is re-validated on update, so a shift cannot be edited into a
  // state (break outside the window, no working days) that creation would reject.
  const parsed = validate(ShiftSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    const { id } = await params;

    const existing = await prisma.shift.findUnique({
      where: { id },
      select: {
        id: true, name: true, startTime: true, endTime: true,
        breakStart: true, breakEnd: true, workingDays: true,
        graceMinutes: true, isActive: true,
      },
    });
    if (!existing) return err("Shift not found", 404);

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        breakStart: input.breakStart ?? null,
        breakEnd: input.breakEnd ?? null,
        workingDays: normalizeWorkingDays(input.workingDays),
        ...(input.graceMinutes !== undefined ? { graceMinutes: input.graceMinutes } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: SHIFT_SELECT,
    });

    await writeAudit(user, {
      action: "UPDATE",
      module: MODULE,
      refId: id,
      refType: "Shift",
      oldValue: {
        name: existing.name,
        startTime: existing.startTime,
        endTime: existing.endTime,
        workingDays: existing.workingDays.join(","),
        graceMinutes: existing.graceMinutes,
        isActive: existing.isActive,
      },
      newValue: {
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        workingDays: shift.workingDays.join(","),
        graceMinutes: shift.graceMinutes,
        isActive: shift.isActive,
      },
    });

    return ok(
      shift,
      input.isActive === false ? "Shift deactivated" : "Shift updated"
    );
  } catch {
    return err("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;

    const shift = await prisma.shift.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: { select: { workerShifts: true, attendances: true } },
      },
    });
    if (!shift) return err("Shift not found", 404);

    const { workerShifts, attendances } = shift._count;

    if (workerShifts > 0 || attendances > 0) {
      const reasons = [
        workerShifts > 0 ? `${workerShifts} worker assignment(s)` : null,
        attendances > 0 ? `${attendances} attendance record(s)` : null,
      ].filter(Boolean);

      return err(
        `"${shift.name}" is in use by ${reasons.join(" and ")} and cannot be deleted. ` +
          `Deactivate it instead — it will disappear from every picker while its history stays intact.`,
        409
      );
    }

    await prisma.shift.delete({ where: { id } });

    await writeAudit(user, {
      action: "DELETE",
      module: MODULE,
      refId: id,
      refType: "Shift",
      oldValue: { name: shift.name },
    });

    return ok({ id }, "Shift deleted");
  } catch {
    return err("Internal server error", 500);
  }
}
