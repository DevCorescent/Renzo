import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Designations
// GET /api/v1/admin/designations — List all designations paginated
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));

    const where = search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {};

    const [items, total] = await Promise.all([
      prisma.designation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ level: "asc" }, { name: "asc" }],
      }),
      prisma.designation.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/designations — Create a new designation
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json();
    if (!body.name) return err("name is required", 422);

    const designation = await prisma.designation.create({
      data: {
        name: body.name,
        level: typeof body.level === "number" ? body.level : 1,
        isActive: body.isActive ?? true,
      },
    });

    return created(designation);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return err("A designation with that name already exists", 409);
    }
    return err("Internal server error", 500);
  }
}
