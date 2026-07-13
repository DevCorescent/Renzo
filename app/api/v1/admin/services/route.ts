import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { created, err, paginated } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Services
// ROUTE  : /api/v1/admin/services
//
// METHODS
// GET  - List Services
// POST - Create Service
//
// ACCESS
// GET  : SUPER_ADMIN, OWNER, BRANCH_ADMIN
// POST : SUPER_ADMIN, OWNER
// ============================================================================

const VALID_GENDERS = ["MALE", "FEMALE", "UNISEX"] as const;

type Gender = (typeof VALID_GENDERS)[number];

// ----------------------------------------------------------------------------
// Type Guards
// ----------------------------------------------------------------------------

function isValidGender(value: unknown): value is Gender {
  return typeof value === "string" && VALID_GENDERS.includes(value as Gender);
}

// Accepts a value that should become a positive/non-negative finite number.
// Rejects "abc", NaN, Infinity, etc. instead of silently letting them through.
function parseFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Treats "" the same as absent, so it collapses to null rather than being
// stored as a literal empty-string foreign key.
function optionalIdOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/* ============================================================================
   GET /api/v1/admin/services
============================================================================ */

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
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
    const categoryId = url.searchParams.get("categoryId");
    const subCategoryId = url.searchParams.get("subCategoryId");
    const gender = url.searchParams.get("gender");
    const isActive = url.searchParams.get("isActive");
    const isPopular = url.searchParams.get("isPopular");

    const where: Prisma.ServiceWhereInput = {};

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (subCategoryId) {
      where.subCategoryId = subCategoryId;
    }
    if (isValidGender(gender)) {
      where.gender = gender;
    }
    if (isActive === "true") where.isActive = true;
    if (isActive === "false") where.isActive = false;
    if (isPopular === "true") where.isPopular = true;
    if (isPopular === "false") where.isPopular = false;

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subCategory: { select: { id: true, name: true, slug: true } },
          _count: { select: { variants: true, serviceAddOns: true } },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return paginated(services, total, page, limit, "Services fetched successfully");
  } catch (error) {
    console.error("GET Services Error:", error);
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   POST /api/v1/admin/services
============================================================================ */

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid request body", 400);
    }

    const {
      name,
      categoryId,
      subCategoryId,
      description,
      image,
      basePrice,
      duration,
      bufferTime = 0,
      gender = "UNISEX",
      taxPercent = 18,
      isPopular = false,
      isActive = true,
      sortOrder = 0,
    } = body;

    // ------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------

    if (!name || typeof name !== "string" || !name.trim()) {
      return err("Service name is required");
    }

    if (!categoryId || typeof categoryId !== "string" || !categoryId.trim()) {
      return err("Category is required");
    }

    const parsedBasePrice = parseFiniteNumber(basePrice);
    if (parsedBasePrice === null || parsedBasePrice < 0) {
      return err("Valid base price is required");
    }

    const parsedDuration = parseFiniteNumber(duration);
    if (parsedDuration === null || parsedDuration <= 0) {
      return err("Valid duration is required");
    }

    const parsedBufferTime = parseFiniteNumber(bufferTime);
    if (parsedBufferTime === null || parsedBufferTime < 0) {
      return err("Buffer time must be a non-negative number");
    }

    const parsedTaxPercent = parseFiniteNumber(taxPercent);
    if (parsedTaxPercent === null || parsedTaxPercent < 0) {
      return err("Tax percent must be a non-negative number");
    }

    const parsedSortOrder = parseFiniteNumber(sortOrder) ?? 0;

    if (!isValidGender(gender)) {
      return err("Invalid gender");
    }

    // ------------------------------------------------------------
    // Generate Slug
    // ------------------------------------------------------------

    const slug = toSlug(name);
    if (!slug) {
      return err("Service name must contain at least one letter or number");
    }

    const normalizedSubCategoryId = optionalIdOrNull(subCategoryId);

    // ------------------------------------------------------------
    // Validate Category
    // ------------------------------------------------------------

    const category = await prisma.serviceCategory.findUnique({
      where: { id: categoryId.trim() },
    });

    if (!category) {
      return err("Selected category does not exist", 404);
    }

    // ------------------------------------------------------------
    // Validate Sub Category
    // ------------------------------------------------------------

    if (normalizedSubCategoryId) {
      const subCategory = await prisma.serviceSubCategory.findUnique({
        where: { id: normalizedSubCategoryId },
      });

      if (!subCategory) {
        return err("Selected sub category does not exist", 404);
      }

      if (subCategory.categoryId !== categoryId.trim()) {
        return err("Sub category does not belong to selected category");
      }
    }

    // ------------------------------------------------------------
    // Duplicate Checks
    // ------------------------------------------------------------

    const [existingName, existingSlug] = await Promise.all([
      prisma.service.findFirst({
        where: { name: { equals: name.trim(), mode: "insensitive" } },
      }),
      prisma.service.findUnique({ where: { slug } }),
    ]);

    if (existingName) {
      return err("Service name already exists", 409);
    }
    if (existingSlug) {
      return err("Service slug already exists", 409);
    }

    // ------------------------------------------------------------
    // Create Service
    // ------------------------------------------------------------

    const service = await prisma.service.create({
      data: {
        name: name.trim(),
        slug,
        categoryId: categoryId.trim(),
        subCategoryId: normalizedSubCategoryId,
        description: optionalTrimmedString(description) ?? null,
        image: optionalTrimmedString(image) ?? null,
        basePrice: parsedBasePrice,
        duration: parsedDuration,
        bufferTime: parsedBufferTime,
        gender,
        taxPercent: parsedTaxPercent,
        isPopular: Boolean(isPopular),
        isActive: Boolean(isActive),
        sortOrder: parsedSortOrder,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
      },
    });

    // Branch admin: auto-enable the newly created service at their branch
    if (user.userType === "BRANCH_ADMIN" && user.branchId) {
      await prisma.serviceBranchPricing.create({
        data: { serviceId: service.id, branchId: user.branchId, price: parsedBasePrice, isActive: true },
      });
    }

    return created(service, "Service created successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return err("Service name or slug already exists", 409);
      }
      if (error.code === "P2003") {
        return err("Selected category or sub category does not exist", 400);
      }
    }

    console.error("POST Service Error:", error);
    return err("Internal server error", 500);
  }
}