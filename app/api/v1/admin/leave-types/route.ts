import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Leave Types (HR configuration)
//
// A NEW resource route, added because the LeaveType model existed with no admin
// API — a worker could not apply for leave because no types could be created.
// It mirrors the designations/departments routes exactly: same requireAuth roles,
// same response envelopes, same P2002 handling. Nothing existing is touched.
//
// RBAC: LeaveType is a GLOBAL catalog (no branchId), so only platform roles manage
// it — SUPER_ADMIN and OWNER. A BRANCH_ADMIN is intentionally NOT admitted; the
// backend, not the UI, is what enforces that.
//
// SCHEMA REALITY (the model is the source of truth, and it is small):
//   id, name, code (unique), isPaid, maxPerYear, isActive.
// There is NO createdAt and NO description column, so this route neither returns
// nor accepts them — inventing either would be faking a field the table cannot
// store.

const SORTABLE = new Set(["name", "code", "maxPerYear"]);

/** "true"/"false" query param → boolean, or undefined when absent/malformed. */
function boolParam(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

// GET /api/v1/admin/leave-types — List leave types (search, filter, sort, page).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);

    const isActive = boolParam(url.searchParams.get("isActive"));
    const isPaid = boolParam(url.searchParams.get("isPaid"));

    const where: Prisma.LeaveTypeWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(isPaid !== undefined ? { isPaid } : {}),
    };

    // Only whitelisted columns are sortable — an arbitrary ?sortBy cannot reach
    // Prisma. Default is name ascending, the natural order for a picker.
    const sortByRaw = url.searchParams.get("sortBy") ?? "name";
    const sortBy = SORTABLE.has(sortByRaw) ? sortByRaw : "name";
    const sortOrder = url.searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

    const [items, total] = await Promise.all([
      prisma.leaveType.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.leaveType.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/leave-types — Create a leave type.
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    // Code is the stable unique key. Uppercased and stripped of inner whitespace so
    // "cl" and "CL " can never become two different types.
    const code =
      typeof body.code === "string" ? body.code.trim().toUpperCase().replace(/\s+/g, "") : "";

    const fieldErrors: Record<string, string[]> = {};
    if (!name) fieldErrors.name = ["Name is required"];
    if (!code) fieldErrors.code = ["Code is required"];
    if (Object.keys(fieldErrors).length) return err("Validation failed", 422, fieldErrors);

    // maxPerYear is a real column (default 12). Accepted when a valid non-negative
    // integer is sent; otherwise the schema default stands.
    const maxPerYear =
      body.maxPerYear != null && Number.isFinite(Number(body.maxPerYear)) && Number(body.maxPerYear) >= 0
        ? Math.floor(Number(body.maxPerYear))
        : undefined;

    const leaveType = await prisma.leaveType.create({
      data: {
        name,
        code,
        isPaid: typeof body.isPaid === "boolean" ? body.isPaid : true,
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
        ...(maxPerYear !== undefined ? { maxPerYear } : {}),
      },
    });

    return created(leaveType);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return err("A leave type with that code already exists", 409, {
        code: ["This code is already in use"],
      });
    }
    return err("Internal server error", 500);
  }
}
