import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { AuthUser } from "@/types/api";

// Resolve the caller's workerProfile id from the token (falling back to a lookup
// by userId if the JWT didn't embed workerId).
async function resolveWorkerId(user: AuthUser): Promise<string | null> {
  if (user.workerId) return user.workerId;
  const wp = await prisma.workerProfile.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  return wp?.id ?? null;
}

// Midnight-UTC date for the @db.Date column (unique key is [workerId, date]).
function todayDate(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

const ACTIONS = ["CHECK_IN", "CHECK_OUT", "BREAK_START", "BREAK_END"] as const;
type Action = (typeof ACTIONS)[number];

// OWNER: Aman | MODULE: Worker Attendance
// GET /api/v1/worker/attendance — Get own attendance log
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where = {
      workerId,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
      }),
      prisma.attendance.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/worker/attendance — Clock in/out or break action
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const body = await req.json();
    const action = body.action as Action;
    if (!ACTIONS.includes(action)) {
      return err(`action must be one of ${ACTIONS.join(", ")}`, 422);
    }

    // Attendance is branch-scoped; use the worker's primary (or first active) branch.
    const branch =
      (await prisma.workerBranch.findFirst({
        where: { workerId, isActive: true, isPrimary: true },
        select: { branchId: true },
      })) ??
      (await prisma.workerBranch.findFirst({
        where: { workerId, isActive: true },
        select: { branchId: true },
      }));
    if (!branch) return err("Worker is not assigned to a branch", 409);

    const date = todayDate();
    const now = new Date();
    const field =
      action === "CHECK_IN"
        ? { checkIn: now }
        : action === "CHECK_OUT"
        ? { checkOut: now }
        : action === "BREAK_START"
        ? { breakStart: now }
        : { breakEnd: now };

    const record = await prisma.attendance.upsert({
      where: { workerId_date: { workerId, date } },
      update: field,
      create: { workerId, branchId: branch.branchId, date, status: "PRESENT", ...field },
    });

    return created(record, `Attendance ${action} recorded`);
  } catch {
    return err("Internal server error", 500);
  }
}
