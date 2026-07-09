import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Packages
// ROUTE  : /api/v1/admin/packages/[id]
//
// METHODS
// GET    - Get Package By ID
// PATCH  - Update Package
// DELETE - Delete Package
//
// ACCESS
// GET    : SUPER_ADMIN, OWNER, BRANCH_ADMIN
// PATCH  : SUPER_ADMIN, OWNER
// DELETE : SUPER_ADMIN, OWNER
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
   GET /api/v1/admin/packages/[id]

   Returns a single package with its linked services.
============================================================================ */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );

  if (error) return error;

  try {
    const { id } = await params;

    if (!id.trim()) {
      return err("Package ID is required");
    }

    const packageData = await prisma.package.findUnique({
      where: {
        id,
      },

      include: {
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
                basePrice: true,
                duration: true,
                gender: true,
                isActive: true,
              },
            },
          },

          orderBy: {
            quantity: "asc",
          },
        },

        _count: {
          select: {
            services: true,
            appointments: true,
          },
        },
      },
    });

    if (!packageData) {
      return err("Package not found", 404);
    }

    return ok(
      packageData,
      "Package fetched successfully"
    );
  } catch (error) {
    console.error(
      "GET Package Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}
/* ============================================================================
   PATCH /api/v1/admin/packages/[id]

   Updates an existing package.
============================================================================ */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER"
  );

  if (error) return error;

  try {
    const { id } = await params;

    if (!id.trim()) {
      return err("Package ID is required");
    }

    const existingPackage = await prisma.package.findUnique({
      where: {
        id,
      },
    });

    if (!existingPackage) {
      return err("Package not found", 404);
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    if (Object.keys(body).length === 0) {
      return err("No fields provided to update");
    }

    const {
      name,
      description,
      image,
      price,
      originalPrice,
      validityDays,
      gender,
      isPopular,
      isActive,
      sortOrder,
    } = body;

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return err("Package name cannot be empty");
    }

    if (
      name !== undefined &&
      name.trim().length > 100
    ) {
      return err("Package name cannot exceed 100 characters");
    }

    if (
      gender !== undefined &&
      !isValidGender(gender)
    ) {
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

    const parsedPrice =
      price !== undefined
        ? parseFiniteNumber(price)
        : existingPackage.price;

    if (
      parsedPrice === null ||
      Number.isNaN(parsedPrice) ||
      parsedPrice < 0
    ) {
      return err("Valid package price is required");
    }

    let parsedOriginalPrice =
      existingPackage.originalPrice;

    if (
      originalPrice !== undefined
    ) {
      if (
        originalPrice === null ||
        originalPrice === ""
      ) {
        parsedOriginalPrice = null;
      } else {
        const value = parseFiniteNumber(originalPrice);

        if (
          value === null ||
          Number.isNaN(value) ||
          value < 0
        ) {
          return err(
            "Original price must be zero or greater"
          );
        }

        parsedOriginalPrice = value;
      }
    }

    if (
      parsedOriginalPrice !== null &&
      parsedOriginalPrice < parsedPrice
    ) {
      return err(
        "Original price cannot be less than package price"
      );
    }

    let parsedValidityDays =
      existingPackage.validityDays;

    if (
      validityDays !== undefined
    ) {
      if (
        validityDays === null ||
        validityDays === ""
      ) {
        parsedValidityDays = null;
      } else {
        const value = parseFiniteNumber(validityDays);

        if (
          value === null ||
          Number.isNaN(value) ||
          value < 0
        ) {
          return err(
            "Validity days must be zero or greater"
          );
        }

        parsedValidityDays = value;
      }
    }

    const parsedSortOrder =
      sortOrder !== undefined
        ? parseFiniteNumber(sortOrder)
        : existingPackage.sortOrder;

    if (
      parsedSortOrder === null ||
      Number.isNaN(parsedSortOrder)
    ) {
      return err("Invalid sort order");
    }

    // ------------------------------------------------------------------------
    // Generate Slug
    // ------------------------------------------------------------------------

    const finalName =
      name?.trim() ??
      existingPackage.name;

    const slug = toSlug(finalName);

    if (!slug) {
      return err(
        "Package name must contain at least one letter or number"
      );
    }

    // ------------------------------------------------------------------------
    // Duplicate Checks
    // ------------------------------------------------------------------------

    const [duplicateName, duplicateSlug] =
      await Promise.all([
        prisma.package.findFirst({
          where: {
            id: {
              not: id,
            },
            name: {
              equals: finalName,
              mode: "insensitive",
            },
          },
        }),

        prisma.package.findFirst({
          where: {
            id: {
              not: id,
            },
            slug,
          },
        }),
      ]);

    if (duplicateName) {
      return err(
        "Package name already exists",
        409
      );
    }

    if (duplicateSlug) {
      return err(
        "Package slug already exists",
        409
      );
    }

    // ------------------------------------------------------------------------
    // Update Package
    // ------------------------------------------------------------------------

    const updatedPackage =
      await prisma.package.update({
        where: {
          id,
        },

        data: {
          name: finalName,
          slug,

          description:
            description !== undefined
              ? optionalTrimmedString(description) ?? null
              : existingPackage.description,

          image:
            image !== undefined
              ? optionalTrimmedString(image) ?? null
              : existingPackage.image,

          price: parsedPrice,

          originalPrice: parsedOriginalPrice,

          validityDays: parsedValidityDays,

          gender:
            gender ??
            existingPackage.gender,

          isPopular:
            isPopular ??
            existingPackage.isPopular,

          isActive:
            isActive ??
            existingPackage.isActive,

          sortOrder: parsedSortOrder,
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

    return ok(
      updatedPackage,
      "Package updated successfully"
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

        case "P2025":
          return err(
            "Package not found",
            404
          );
      }
    }

    console.error(
      "PATCH Package Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}
/* ============================================================================
   DELETE /api/v1/admin/packages/[id]

   Deletes a package if it is not linked with other records.
============================================================================ */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER"
  );

  if (error) return error;

  try {
    const { id } = await params;

    if (!id.trim()) {
      return err("Package ID is required");
    }

    // ------------------------------------------------------------------------
    // Check Package Exists
    // ------------------------------------------------------------------------

    const existingPackage = await prisma.package.findUnique({
      where: {
        id,
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

    if (!existingPackage) {
      return err("Package not found", 404);
    }

    // ------------------------------------------------------------------------
    // Prevent deleting packages linked to other records
    // ------------------------------------------------------------------------

    if (
      existingPackage._count.services > 0 ||
      existingPackage._count.appointments > 0
    ) {
      return err(
        "Cannot delete package because it is linked with existing records",
        409
      );
    }

    // ------------------------------------------------------------------------
    // Delete Package
    // ------------------------------------------------------------------------

    await prisma.package.delete({
      where: {
        id,
      },
    });

    return ok(
      null,
      "Package deleted successfully"
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      switch (error.code) {
        case "P2025":
          return err("Package not found", 404);

        case "P2003":
          return err(
            "Cannot delete package because it is referenced by other records",
            409
          );
      }
    }

    console.error(
      "DELETE Package Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}