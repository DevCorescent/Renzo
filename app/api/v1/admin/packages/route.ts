import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { created, err, paginated } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Packages
// ROUTE  : /api/v1/admin/packages
//
// METHODS
// GET  - List Packages
// POST - Create Package
//
// ACCESS
// GET  : SUPER_ADMIN, OWNER, BRANCH_ADMIN
// POST : SUPER_ADMIN, OWNER
// ============================================================================

const VALID_GENDERS = ["MALE", "FEMALE", "UNISEX"] as const;

type Gender = (typeof VALID_GENDERS)[number];

// ============================================================================
// Type Guards
// ============================================================================

function isValidGender(value: unknown): value is Gender {
  return (
    typeof value === "string" &&
    VALID_GENDERS.includes(value as Gender)
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

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
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function parseFiniteNumber(value: unknown): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : NaN;
}

/* ============================================================================
   GET /api/v1/admin/packages

   Returns paginated list of packages.
============================================================================ */

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

    const page = Math.max(
      Number(url.searchParams.get("page") ?? "1"),
      1
    );

    const limit = Math.min(
      Math.max(
        Number(url.searchParams.get("limit") ?? "10"),
        1
      ),
      100
    );

    const skip = (page - 1) * limit;

    const search = url.searchParams.get("search")?.trim();
    const gender = url.searchParams.get("gender");
    const isActive = url.searchParams.get("isActive");
    const isPopular = url.searchParams.get("isPopular");

    const where: Prisma.PackageWhereInput = {};

    // ------------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------------

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // ------------------------------------------------------------------------
    // Filters
    // ------------------------------------------------------------------------

    if (isValidGender(gender)) {
      where.gender = gender;
    }

    if (isActive === "true") {
      where.isActive = true;
    }

    if (isActive === "false") {
      where.isActive = false;
    }

    if (isPopular === "true") {
      where.isPopular = true;
    }

    if (isPopular === "false") {
      where.isPopular = false;
    }

    const [packages, total] = await Promise.all([
      prisma.package.findMany({
        where,
        skip,
        take: limit,

        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            createdAt: "desc",
          },
        ],

        include: {
          _count: {
            select: {
              services: true,
              appointments: true,
            },
          },
        },
      }),

      prisma.package.count({
        where,
      }),
    ]);

    return paginated(
      packages,
      total,
      page,
      limit,
      "Packages fetched successfully"
    );
  } catch (error) {
    console.error(
      "GET Packages Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}
/* ============================================================================
   POST /api/v1/admin/packages

   Creates a new Package.
============================================================================ */

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER"
  );

  if (error) return error;

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const {
      name,
      description,
      image,
      price,
      originalPrice,
      validityDays,
      gender = "UNISEX",
      isPopular = false,
      isActive = true,
      sortOrder = 0,
    } = body;

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (!name || typeof name !== "string" || !name.trim()) {
      return err("Package name is required");
    }

    if (name.trim().length > 100) {
      return err("Package name cannot exceed 100 characters");
    }

    if (!isValidGender(gender)) {
      return err("Invalid gender");
    }

    if (
      isPopular !== undefined &&
      typeof isPopular !== "boolean"
    ) {
      return err("isPopular must be a boolean");
    }

    if (
      isActive !== undefined &&
      typeof isActive !== "boolean"
    ) {
      return err("isActive must be a boolean");
    }

    // ------------------------------------------------------------------------
    // Price Validation
    // ------------------------------------------------------------------------

    const parsedPrice = parseFiniteNumber(price);

    if (
      parsedPrice === null ||
      Number.isNaN(parsedPrice) ||
      parsedPrice < 0
    ) {
      return err("Valid package price is required");
    }

    // ------------------------------------------------------------------------
    // Original Price Validation
    // ------------------------------------------------------------------------

    let parsedOriginalPrice: number | null = null;

    if (
      originalPrice !== undefined &&
      originalPrice !== null
    ) {
      parsedOriginalPrice = parseFiniteNumber(originalPrice);

      if (
        parsedOriginalPrice === null ||
        Number.isNaN(parsedOriginalPrice) ||
        parsedOriginalPrice < 0
      ) {
        return err(
          "Original price must be zero or greater"
        );
      }

      if (parsedOriginalPrice < parsedPrice) {
        return err(
          "Original price cannot be less than package price"
        );
      }
    }

    // ------------------------------------------------------------------------
    // Validity Days Validation
    // ------------------------------------------------------------------------

    let parsedValidityDays: number | null = null;

    if (
      validityDays !== undefined &&
      validityDays !== null
    ) {
      parsedValidityDays = parseFiniteNumber(validityDays);

      if (
        parsedValidityDays === null ||
        Number.isNaN(parsedValidityDays) ||
        parsedValidityDays < 0
      ) {
        return err(
          "Validity days must be zero or greater"
        );
      }
    }

    // ------------------------------------------------------------------------
    // Sort Order
    // ------------------------------------------------------------------------

    const parsedSortOrder = parseFiniteNumber(sortOrder);

    const finalSortOrder =
      parsedSortOrder === null ||
      Number.isNaN(parsedSortOrder)
        ? 0
        : parsedSortOrder;

    // ------------------------------------------------------------------------
    // Generate Slug
    // ------------------------------------------------------------------------

    const slug = toSlug(name);

    if (!slug) {
      return err(
        "Package name must contain at least one letter or number"
      );
    }

    // ------------------------------------------------------------------------
    // Duplicate Checks
    // ------------------------------------------------------------------------

    const [existingName, existingSlug] =
      await Promise.all([
        prisma.package.findFirst({
          where: {
            name: {
              equals: name.trim(),
              mode: "insensitive",
            },
          },
        }),

        prisma.package.findUnique({
          where: {
            slug,
          },
        }),
      ]);

    if (existingName) {
      return err(
        "Package name already exists",
        409
      );
    }

    if (existingSlug) {
      return err(
        "Package slug already exists",
        409
      );
    }

    // ------------------------------------------------------------------------
    // Create Package
    // ------------------------------------------------------------------------

    const packageData = await prisma.package.create({
      data: {
        name: name.trim(),
        slug,

        description:
          optionalTrimmedString(description) ?? null,

        image:
          optionalTrimmedString(image) ?? null,

        price: parsedPrice,

        originalPrice: parsedOriginalPrice,

        validityDays: parsedValidityDays,

        gender,

        isPopular,

        isActive,

        sortOrder: finalSortOrder,
      },

      include: {
        _count: {
          select: {
            services: true,
            appointments: true,
          },
        },
      },
    });

    return created(
      packageData,
      "Package created successfully"
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      switch (error.code) {
        case "P2002":
          return err(
            "Package name or slug already exists",
            409
          );
      }
    }

    console.error(
      "POST Package Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}