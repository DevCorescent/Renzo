import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Branch Management
// GET /api/v1/admin/branches — List all branches paginated
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.branch.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/branches — Create a new branch
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json();

    const required = [
      "name",
      "slug",
      "code",
      "address",
      "city",
      "state",
      "pincode",
      "phone",
    ];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return err(
        "Validation failed",
        422,
        Object.fromEntries(missing.map((f) => [f, ["This field is required"]]))
      );
    }

    const branch = await prisma.branch.create({
      data: {
        name: body.name,
        slug: body.slug,
        code: body.code,
        address: body.address,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        country: body.country ?? "India",
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        phone: body.phone,
        email: body.email ?? null,
        whatsapp: body.whatsapp ?? null,
        mapUrl: body.mapUrl ?? null,
        coverImage: body.coverImage ?? null,
        description: body.description ?? null,
        isActive: body.isActive ?? true,
        isPublic: body.isPublic ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    return created(branch);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return err("A branch with that slug or code already exists", 409);
    }
    return err("Internal server error", 500);
  }
}
