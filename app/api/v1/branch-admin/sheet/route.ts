// ============================================================================
// MODULE : Branch Admin Sheet
// ROUTE  : /api/v1/branch-admin/sheet
//
// GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD
//      Returns workers + SheetLog rows.  Each cell is a string[].
//      Legacy rows that stored a plain string are normalised to [string] on read
//      so old data is never lost.
//
// PUT  { date: "YYYY-MM-DD", workerId: string, value: string[] }
//      Replaces one worker's entry for that date.  An empty array removes the key.
//      Read-merge-write keeps every other worker's values intact.
//
// ACCESS: BRANCH_ADMIN, OWNER, SUPER_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";

const ROLES = ["BRANCH_ADMIN", "OWNER", "SUPER_ADMIN"] as const;

/** Normalise a raw cell value from the DB to string[]. */
function toArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw === "string" && raw.trim()) return [raw];
  return [];
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const branchId = user.branchId;
  if (!branchId) return err("No branch associated with your account", 403);

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr   = searchParams.get("to");

  if (!fromStr || !toStr) return err("from and to query params are required", 400);

  const from = new Date(fromStr);
  const to   = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return err("Invalid date format", 400);
  if (from > to) return err("from must be before to", 400);

  const [sheetLogs, workerBranches] = await Promise.all([
    prisma.sheetLog.findMany({
      where: { branchId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: { date: true, cells: true },
    }),
    prisma.workerBranch.findMany({
      where: { branchId, isActive: true },
      orderBy: { joinedAt: "asc" },
      select: {
        worker: {
          select: {
            id: true, firstName: true, lastName: true,
            designation: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const workers = workerBranches.map((wb) => ({
    id: wb.worker.id,
    name: `${wb.worker.firstName} ${wb.worker.lastName}`.trim(),
    designation: wb.worker.designation?.name ?? null,
  }));

  // Normalise every cell to string[] (handles legacy plain-string rows).
  const logs = sheetLogs.map((row) => {
    const raw = (row.cells ?? {}) as Record<string, unknown>;
    const cells: Record<string, string[]> = {};
    for (const [wId, v] of Object.entries(raw)) {
      const arr = toArray(v);
      if (arr.length > 0) cells[wId] = arr;
    }
    return { date: row.date.toISOString().slice(0, 10), cells };
  });

  return ok({ workers, logs });
}

// ── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const branchId = user.branchId;
  if (!branchId) return err("No branch associated with your account", 403);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400); }

  const { date: dateStr, workerId, value } = body as Record<string, unknown>;

  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    return err("date must be YYYY-MM-DD", 400);
  if (typeof workerId !== "string" || !workerId.trim())
    return err("workerId is required", 400);

  // Accept string[] or a legacy plain string.
  const normalised = toArray(value);
  if (!Array.isArray(value) && typeof value !== "string")
    return err("value must be a string array", 400);

  const dateObj = new Date(dateStr);

  const existing = await prisma.sheetLog.findUnique({
    where: { branchId_date: { branchId, date: dateObj } },
    select: { cells: true },
  });

  const currentCells = (existing?.cells ?? {}) as Record<string, unknown>;
  const updatedCells: Record<string, string[]> = {};

  // Carry forward existing cells, normalising any legacy plain strings.
  for (const [k, v] of Object.entries(currentCells)) {
    const arr = toArray(v);
    if (arr.length > 0) updatedCells[k] = arr;
  }

  if (normalised.length === 0) {
    delete updatedCells[workerId]; // empty array → remove the key
  } else {
    updatedCells[workerId] = normalised;
  }

  // Cast to Prisma's InputJsonValue via unknown.
  const cellsJson = updatedCells as unknown as import("@prisma/client").Prisma.InputJsonValue;

  await prisma.sheetLog.upsert({
    where: { branchId_date: { branchId, date: dateObj } },
    create: { branchId, date: dateObj, cells: cellsJson },
    update: { cells: cellsJson },
  });

  return ok({ date: dateStr, workerId, value: normalised });
}
