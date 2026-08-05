// ============================================================================
// MODULE : Shift Management (admin)
// ROUTE  : /api/v1/admin/shifts
//
// METHODS
//   GET  — List shift templates. ?includeInactive=true, ?search=, paginated.
//   POST — Create a shift template.
//
// ACCESS
//   GET  : SUPER_ADMIN, OWNER, BRANCH_ADMIN — a branch admin must be able to READ
//          the catalogue in order to assign from it.
//   POST : SUPER_ADMIN, OWNER only. Shifts are GLOBAL templates shared by every
//          branch, so creating one is a platform decision; a branch admin assigns
//          existing shifts and cannot mint new ones.
//
// WHY THIS ROUTE EXISTS: the Shift table had no create/update/delete path anywhere
// in the codebase and no seed, so it was permanently empty — which made the
// worker-shift assignment endpoint unusable (every payload 422'd with "Unknown
// shift IDs") and left the attendance engine with nothing to measure lateness
// against. This is the missing half.
// ============================================================================

import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { ShiftSchema, SHIFT_SELECT, normalizeWorkingDays } from "@/lib/shift-schema";

const MODULE = "SHIFT";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const where: Prisma.ShiftWhereInput = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isActive: "desc" }, { startTime: "asc" }, { name: "asc" }],
        select: SHIFT_SELECT,
      }),
      prisma.shift.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  const parsed = validate(ShiftSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    const shift = await prisma.shift.create({
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
      action: "CREATE",
      module: MODULE,
      refId: shift.id,
      refType: "Shift",
      newValue: { name: shift.name, startTime: shift.startTime, endTime: shift.endTime },
    });

    return created(shift, "Shift created");
  } catch {
    return err("Internal server error", 500);
  }
}
