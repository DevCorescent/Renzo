import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, type BranchScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";

type TimingInput = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen?: boolean;
  slotDuration?: number;
};

// The branch id is in the PATH, so it is entirely caller-controlled. Without
// this, a branch admin could rewrite ANOTHER branch's opening hours — which
// silently breaks that branch's bookable slots for every customer.
//
// 404 rather than 403, matching branch settings: an out-of-scope branch must not
// be distinguishable from one that does not exist.
const isHHMM = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim());

const toMinutes = (v: string) => {
  const [h, m] = v.trim().split(":").map(Number);
  return h * 60 + m;
};

function denyOtherBranch(scope: BranchScope, branchId: string) {
  return !scope.isGlobal && branchId !== scope.branchId
    ? err("Branch not found", 404)
    : null;
}

// OWNER: Aman | MODULE: Branch Timings
// GET /api/v1/admin/branches/[id]/timings — Get all 7-day timings for a branch
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;

    const denied = denyOtherBranch(scope, id);
    if (denied) return denied;

    const timings = await prisma.branchTiming.findMany({
      where: { branchId: id },
      orderBy: { dayOfWeek: "asc" },
    });
    return ok(timings);
  } catch {
    return err("Internal server error", 500);
  }
}

// PUT /api/v1/admin/branches/[id]/timings — Bulk upsert day timings
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;

    const denied = denyOtherBranch(scope, id);
    if (denied) return denied;

    const body = await req.json();

    const days: TimingInput[] = Array.isArray(body) ? body : body.timings;
    if (!Array.isArray(days) || days.length === 0) {
      return err("Expected a non-empty array of day timings", 422);
    }

    // Validate each entry before touching the DB. The slot engine parses these
    // strings with a bare split(":") (lib/slots.ts), so a malformed time would
    // become NaN and silently empty the day's slot grid instead of erroring.
    const seen = new Set<number>();
    for (const d of days) {
      if (
        typeof d.dayOfWeek !== "number" ||
        !Number.isInteger(d.dayOfWeek) ||
        d.dayOfWeek < 0 ||
        d.dayOfWeek > 6
      ) {
        return err("Each timing needs a dayOfWeek between 0 (Sun) and 6 (Sat)", 422);
      }
      if (seen.has(d.dayOfWeek)) {
        return err(`Day ${d.dayOfWeek} appears more than once`, 422);
      }
      seen.add(d.dayOfWeek);

      if (!d.openTime || !d.closeTime) {
        return err(`Day ${d.dayOfWeek} is missing openTime or closeTime`, 422);
      }
      if (!isHHMM(d.openTime) || !isHHMM(d.closeTime)) {
        return err(`Day ${d.dayOfWeek} needs times in 24-hour HH:MM format`, 422);
      }
      if (toMinutes(d.closeTime) <= toMinutes(d.openTime)) {
        return err(`Day ${d.dayOfWeek} closes at or before it opens`, 422);
      }
      if (d.slotDuration !== undefined) {
        if (
          !Number.isInteger(d.slotDuration) ||
          d.slotDuration < 5 ||
          d.slotDuration > 240
        ) {
          return err(`Day ${d.dayOfWeek} needs a slotDuration between 5 and 240 minutes`, 422);
        }
      }
    }

    // Guard against orphan timings for a non-existent branch.
    const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
    if (!branch) return err("Branch not found", 404);

    await prisma.$transaction(
      days.map((d) =>
        prisma.branchTiming.upsert({
          where: { branchId_dayOfWeek: { branchId: id, dayOfWeek: d.dayOfWeek } },
          update: {
            openTime: d.openTime.trim(),
            closeTime: d.closeTime.trim(),
            isOpen: d.isOpen ?? true,
            slotDuration: d.slotDuration ?? 30,
          },
          create: {
            branchId: id,
            dayOfWeek: d.dayOfWeek,
            openTime: d.openTime.trim(),
            closeTime: d.closeTime.trim(),
            isOpen: d.isOpen ?? true,
            slotDuration: d.slotDuration ?? 30,
          },
        })
      )
    );

    const timings = await prisma.branchTiming.findMany({
      where: { branchId: id },
      orderBy: { dayOfWeek: "asc" },
    });
    return ok(timings, "Timings updated");
  } catch {
    return err("Internal server error", 500);
  }
}
