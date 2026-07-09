import { NextRequest } from "next/server";
import { created, err, paginated } from "@/lib/response";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Service Categories
// ROUTE  : /api/v1/admin/services/categories
//
// METHODS
// GET  - List Service Categories
// POST - Create Service Category
//
// ACCESS
// GET  : SUPER_ADMIN, OWNER, BRANCH_ADMIN
// POST : SUPER_ADMIN, OWNER
// ============================================================================

const VALID_GENDERS = ["MALE", "FEMALE", "UNISEX"] as const;
type Gender = (typeof VALID_GENDERS)[number];

function isValidGender(value: unknown): value is Gender {
  return typeof value === "string" && (VALID_GENDERS as readonly string[]).includes(value);
}

// Minimal slugify — avoids pulling in a package that isn't in package.json.
// Lowercases, strips diacritics, replaces non-alphanumerics with "-".
function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Only trims if the value is actually a string; otherwise treats it as absent.
function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * GET /api/v1/admin/services/categories
 *
 * Returns paginated service categories.
 *
 * Query Params
 * -------------
 * page      : number
 * limit     : number
 * search    : string
 * gender    : MALE | FEMALE | UNISEX
 * isActive  : true | false
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );

  if (error) return error;

  try {
    const url = new URL(req.url);

    const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);

    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? "10"), 1),
      100
    );

    const skip = (page - 1) * limit;

    const search = url.searchParams.get("search")?.trim();
    const gender = url.searchParams.get("gender");
    const isActive = url.searchParams.get("isActive");

    const where: Prisma.ServiceCategoryWhereInput = {};

    // Search by category name
    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Filter by gender
    if (isValidGender(gender)) {
      where.gender = gender;
    }

    // Filter active/inactive
    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    const [categories, total] = await Promise.all([
      prisma.serviceCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
          _count: {
            select: {
              services: true,
              subCategories: true,
            },
          },
        },
      }),
      prisma.serviceCategory.count({ where }),
    ]);

    return paginated(
      categories,
      total,
      page,
      limit,
      "Service categories fetched successfully"
    );
  } catch (error) {
    console.error("GET Service Categories Error:", error);
    return err("Internal server error", 500);
  }
}

/**
 * POST /api/v1/admin/services/categories
 *
 * Creates a new Service Category.
 *
 * Required
 * --------
 * name
 *
 * Optional
 * --------
 * description
 * image
 * icon
 * gender
 * sortOrder
 * isActive
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");

  if (error) return error;

  try {
    const body = await req.json();

    const {
      name,
      description,
      image,
      icon,
      gender = "UNISEX",
      sortOrder = 0,
      isActive = true,
    } = body ?? {};

    // ------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------

    if (!name || typeof name !== "string" || !name.trim()) {
      return err("Category name is required");
    }

    if (!isValidGender(gender)) {
      return err("Invalid gender");
    }

    // ------------------------------------------------------------
    // Generate slug automatically
    // ------------------------------------------------------------

    const slug = toSlug(name);

    if (!slug) {
      return err("Category name must contain at least one letter or number");
    }

    // ------------------------------------------------------------
    // Duplicate Name / Slug Check (best-effort — see race-condition
    // note below; the DB unique constraint is the real guard)
    // ------------------------------------------------------------

    const [existingName, existingSlug] = await Promise.all([
      prisma.serviceCategory.findFirst({
        where: { name: { equals: name.trim(), mode: "insensitive" } },
      }),
      prisma.serviceCategory.findUnique({ where: { slug } }),
    ]);

    if (existingName) {
      return err("Category name already exists", 409);
    }

    if (existingSlug) {
      return err("Category slug already exists", 409);
    }

    // ------------------------------------------------------------
    // Create Category
    // ------------------------------------------------------------

    const category = await prisma.serviceCategory.create({
      data: {
        name: name.trim(),
        slug,
        description: optionalTrimmedString(description) ?? null,
        image: optionalTrimmedString(image) ?? null,
        icon: optionalTrimmedString(icon) ?? null,
        gender,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        isActive: Boolean(isActive),
      },
    });

    return created(category, "Service category created successfully");
  } catch (error) {
    // Handles the race where two requests pass the pre-check at the same
    // time and both try to insert the same name/slug.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return err("Category name or slug already exists", 409);
    }

    console.error("POST Service Category Error:", error);
    return err("Internal server error", 500);
  }
}